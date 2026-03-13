const path = require("node:path");
const fs = require("node:fs");
const { Readable } = require("node:stream");
const express = require("express");
const {
  LIVE_STATIONS,
  extractRteInfo,
  getEpisodePlaylist,
  getPlaylist,
  getProgramEpisodes,
  getProgramSummary,
  getLiveStationNow,
  normalizeProgramUrl,
  searchPrograms
} = require("./lib/rte");
const {
  getBbcEpisodePlaylist,
  getBbcLiveStations,
  getBbcProgramEpisodes,
  getBbcProgramSummary,
  normalizeBbcProgramUrl,
  searchBbcPrograms
} = require("./lib/bbc");
const {
  getWwfEpisodeInfo,
  getWwfEpisodeMixcloudUrl,
  getWwfProgramSummary,
  getWwfProgramEpisodes,
  searchWwfPrograms,
  getWwfEpisodePlaylist,
  getWwfLiveNow,
  LIVE_STATIONS: WWF_LIVE_STATIONS,
  normalizeWwfProgramUrl
} = require("./lib/worldwidefm");
const {
  getNtsEpisodeInfo,
  getNtsProgramSummary,
  getNtsProgramEpisodes,
  searchNtsPrograms,
  getNtsEpisodePlaylist,
  getNtsLiveNow,
  LIVE_STATIONS: NTS_LIVE_STATIONS,
  normalizeNtsProgramUrl
} = require("./lib/nts");
const { runYtDlpDownload, runYtDlpJson } = require("./lib/downloader");
const { createSchedulerStore } = require("./lib/scheduler");
const { buildDownloadTarget, sanitizePathSegment } = require("./lib/path-format");
const { createDownloadQueue } = require("./lib/download-queue");
const { applyId3Tags } = require("./lib/tags");
const { writeProgramFeedFiles } = require("./lib/feeds");
const { readCueChaptersForAudio } = require("./lib/cue-reader");
const { runCueTaskInChild } = require("./lib/cue-worker-client");

const app = express();
app.use(express.json({ limit: "1mb" }));
const rendererDir = path.join(__dirname, "renderer");
app.use(express.static(rendererDir));
app.use("/build", express.static(path.join(__dirname, "..", "build")));
const progressSubscribers = new Map();
const localPlaybackTokens = new Map();

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || "/downloads";
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const DOWNLOAD_ARCHIVE_PATH = path.join(DATA_DIR, "download-archive.txt");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function emitProgressEvent(progressToken, payload) {
  if (!progressToken) {
    return;
  }
  const listeners = progressSubscribers.get(progressToken);
  if (!listeners || listeners.size === 0) {
    return;
  }
  const event = `data: ${JSON.stringify({ token: progressToken, ...payload })}\n\n`;
  for (const res of listeners) {
    res.write(event);
  }
}

function isPathInside(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  return target === base || target.startsWith(`${base}${path.sep}`);
}

function issueLocalPlaybackToken(filePath) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  localPlaybackTokens.set(token, {
    path: filePath,
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  return token;
}

function resolveLocalPlaybackToken(token) {
  const item = localPlaybackTokens.get(String(token || ""));
  if (!item) {
    return "";
  }
  if (Date.now() > item.expiresAt) {
    localPlaybackTokens.delete(String(token || ""));
    return "";
  }
  return item.path;
}

function absolutizeInternalMediaUrl(inputUrl) {
  const text = String(inputUrl || "").trim();
  if (!text || /^https?:\/\//i.test(text)) {
    return text;
  }
  if (!text.startsWith("/")) {
    return text;
  }
  return `http://127.0.0.1:${PORT}${text}`;
}

function getDefaultSettings() {
  return {
    timeFormat: "24h",
    downloadDir: DOWNLOAD_DIR,
    pathFormat: "{radio}/{program}/{episode_short} {release_date}",
    cueAutoGenerate: false,
    maxConcurrentDownloads: 2,
    outputFormat: "m4a",
    outputQuality: "128K",
    normalizeLoudness: true,
    dedupeMode: "source-id",
    id3Tagging: true,
    feedExportEnabled: true,
    webhookUrl: "",
    auddTrackMatching: false,
    auddApiToken: "",
    fingerprintTrackMatching: false,
    acoustidApiKey: "",
    songrecTrackMatching: false,
    songrecSampleSeconds: 20,
    ffmpegCueSilenceDetect: true,
    ffmpegCueLoudnessDetect: true,
    ffmpegCueSpectralDetect: true
  };
}

let cachedSettings = null;
function normalizeSettings(input) {
  const defaults = getDefaultSettings();
  const raw = input && typeof input === "object" ? input : {};
  const legacyRte = typeof raw.rteDownloadDir === "string" && raw.rteDownloadDir.trim() ? raw.rteDownloadDir.trim() : "";
  const dedupeModeRaw = String(raw.dedupeMode || defaults.dedupeMode).toLowerCase();
  return {
    timeFormat: raw.timeFormat === "12h" ? "12h" : "24h",
    downloadDir: typeof raw.downloadDir === "string" && raw.downloadDir.trim()
      ? raw.downloadDir.trim()
      : (legacyRte ? path.dirname(legacyRte) : defaults.downloadDir),
    pathFormat: typeof raw.pathFormat === "string" && raw.pathFormat.trim()
      ? raw.pathFormat.trim()
      : defaults.pathFormat,
    cueAutoGenerate: Boolean(raw.cueAutoGenerate),
    maxConcurrentDownloads: Math.max(1, Math.min(8, Math.floor(Number(raw.maxConcurrentDownloads || defaults.maxConcurrentDownloads)))),
    outputFormat: String(raw.outputFormat || defaults.outputFormat).trim().toLowerCase() === "mp3" ? "mp3" : "m4a",
    outputQuality: String(raw.outputQuality || defaults.outputQuality).trim() || defaults.outputQuality,
    normalizeLoudness: raw.normalizeLoudness == null ? defaults.normalizeLoudness : Boolean(raw.normalizeLoudness),
    dedupeMode: ["source-id", "title-date", "none"].includes(dedupeModeRaw) ? dedupeModeRaw : defaults.dedupeMode,
    id3Tagging: raw.id3Tagging == null ? defaults.id3Tagging : Boolean(raw.id3Tagging),
    feedExportEnabled: raw.feedExportEnabled == null ? defaults.feedExportEnabled : Boolean(raw.feedExportEnabled),
    webhookUrl: typeof raw.webhookUrl === "string" ? raw.webhookUrl.trim() : "",
    auddTrackMatching: raw.auddTrackMatching == null ? defaults.auddTrackMatching : Boolean(raw.auddTrackMatching),
    auddApiToken: typeof raw.auddApiToken === "string" ? raw.auddApiToken.trim() : "",
    fingerprintTrackMatching: raw.fingerprintTrackMatching == null ? defaults.fingerprintTrackMatching : Boolean(raw.fingerprintTrackMatching),
    acoustidApiKey: typeof raw.acoustidApiKey === "string" ? raw.acoustidApiKey.trim() : "",
    songrecTrackMatching: raw.songrecTrackMatching == null ? defaults.songrecTrackMatching : Boolean(raw.songrecTrackMatching),
    songrecSampleSeconds: Math.max(8, Math.min(45, Math.floor(Number(raw.songrecSampleSeconds || defaults.songrecSampleSeconds)))),
    ffmpegCueSilenceDetect: raw.ffmpegCueSilenceDetect == null ? defaults.ffmpegCueSilenceDetect : Boolean(raw.ffmpegCueSilenceDetect),
    ffmpegCueLoudnessDetect: raw.ffmpegCueLoudnessDetect == null ? defaults.ffmpegCueLoudnessDetect : Boolean(raw.ffmpegCueLoudnessDetect),
    ffmpegCueSpectralDetect: raw.ffmpegCueSpectralDetect == null ? defaults.ffmpegCueSpectralDetect : Boolean(raw.ffmpegCueSpectralDetect)
  };
}

const downloadQueue = createDownloadQueue(() => readSettings().maxConcurrentDownloads || 2);

function readSettings() {
  if (cachedSettings) {
    return cachedSettings;
  }
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    cachedSettings = normalizeSettings(JSON.parse(raw));
  } catch {
    cachedSettings = getDefaultSettings();
  }
  return cachedSettings;
}

function writeSettings(next) {
  const normalized = normalizeSettings(next);
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(normalized, null, 2), "utf8");
  cachedSettings = normalized;
  return normalized;
}

function inferProgramNameFromUrl(inputUrl) {
  try {
    const parsed = new URL(String(inputUrl || ""), "https://www.rte.ie");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "radio" && parts.length >= 3) {
      return parts[2].replace(/-/g, " ");
    }
    if (parsed.hostname.includes("bbc.")) {
      return "BBC";
    }
  } catch {
    return "";
  }
  return "";
}

function toCanonicalBbcEpisodeUrl(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (!/bbc\./i.test(parsed.hostname)) {
      return raw;
    }
    const match = parsed.pathname.match(/\/sounds\/play\/([a-z0-9]{8})/i);
    if (match?.[1]) {
      return `https://www.bbc.co.uk/programmes/${match[1].toLowerCase()}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

function shouldRetryBbcWithFallback(error) {
  const text = String(error?.message || "");
  return /\[bbc\]/i.test(text) && /Unable to extract playlist data/i.test(text);
}

function inferTitleFromUrl(inputUrl, fallback = "audio") {
  try {
    const parsed = new URL(String(inputUrl || ""), "https://example.com");
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const clean = last
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (clean) {
      return clean;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

async function downloadFromManifest({
  manifestUrl,
  sourceUrl,
  title,
  programTitle,
  publishedTime,
  clipId,
  episodeUrl,
  progressToken,
  sourceType = "rte",
  forceDownload = false
}) {
  const settings = readSettings();
  const target = buildDownloadTarget({
    baseDownloadDir: settings.downloadDir,
    pathFormat: settings.pathFormat,
    sourceType,
    programTitle: sanitizePathSegment(programTitle) || inferProgramNameFromUrl(sourceUrl || manifestUrl || ""),
    episodeTitle: title,
    publishedTime,
    clipId,
    episodeUrl: episodeUrl || sourceUrl || manifestUrl
  });
  const outputDir = target.outputDir;
  fs.mkdirSync(outputDir, { recursive: true });

  function emitProgress(payload) {
    emitProgressEvent(progressToken, payload);
  }

  const result = await downloadQueue.run(
    (queueTask) => runYtDlpDownload({
      manifestUrl,
      sourceUrl,
      title: target.fileStem,
      outputDir,
      archivePath: DOWNLOAD_ARCHIVE_PATH,
      registerCancel: queueTask?.registerCancel,
      onProgress: emitProgress,
      forceDownload,
      audioFormat: settings.outputFormat,
      audioQuality: settings.outputQuality,
      normalizeLoudness: settings.normalizeLoudness,
      dedupeMode: settings.dedupeMode,
      fetchThumbnail: Boolean(settings.id3Tagging)
    }),
    {
      label: target.fileStem,
      sourceType
    }
  );

  return {
    ...result,
    outputDir
  };
}

async function maybeApplyId3({
  downloadResult,
  sourceType,
  episodeTitle,
  programTitle,
  publishedTime,
  sourceUrl,
  artworkUrl,
  episodeUrl = "",
  clipId = "",
  description = ""
}) {
  const settings = readSettings();
  if (!settings.id3Tagging) {
    return null;
  }
  if (downloadResult?.existing) {
    return null;
  }

  const outputDir = String(downloadResult?.outputDir || "");
  const fileName = String(downloadResult?.fileName || "");
  if (!outputDir || !fileName) {
    return null;
  }

  try {
    return await applyId3Tags({
      audioPath: path.join(outputDir, fileName),
      title: episodeTitle,
      programTitle,
      sourceType,
      publishedTime,
      sourceUrl,
      artworkUrl,
      artworkPath: String(downloadResult?.artworkPath || ""),
      episodeUrl,
      clipId,
      description
    });
  } catch {
    return null;
  } finally {
    const stagedArtworkPath = String(downloadResult?.artworkPath || "");
    if (stagedArtworkPath) {
      try {
        fs.unlinkSync(stagedArtworkPath);
      } catch {}
    }
  }
}

async function maybeGenerateCue({
  downloadResult,
  sourceType,
  episodeUrl,
  episodeTitle,
  programTitle,
  tracklistUrl = "",
  force = false,
  revealErrors = false,
  onProgress = null
}) {
  const settings = readSettings();
  if (!force && !settings.cueAutoGenerate) {
    return null;
  }

  const outputDir = String(downloadResult?.outputDir || "");
  const fileName = String(downloadResult?.fileName || "");
  if (!outputDir || !fileName) {
    return null;
  }

  const audioPath = path.join(outputDir, fileName);
  try {
    return await runCueTaskInChild({
      mode: "generate",
      onProgress,
      options: {
      audioPath,
      sourceType,
      episodeUrl,
      episodeTitle,
      programTitle,
      tracklistUrl,
      fingerprintTrackMatching: Boolean(settings.fingerprintTrackMatching),
      auddTrackMatching: Boolean(settings.auddTrackMatching),
      auddApiToken: String(settings.auddApiToken || ""),
      acoustidApiKey: String(settings.acoustidApiKey || ""),
      songrecTrackMatching: Boolean(settings.songrecTrackMatching),
      songrecSampleSeconds: Number(settings.songrecSampleSeconds || 20),
      ffmpegCueSilenceDetect: settings.ffmpegCueSilenceDetect == null ? true : Boolean(settings.ffmpegCueSilenceDetect),
      ffmpegCueLoudnessDetect: settings.ffmpegCueLoudnessDetect == null ? true : Boolean(settings.ffmpegCueLoudnessDetect),
      ffmpegCueSpectralDetect: settings.ffmpegCueSpectralDetect == null ? true : Boolean(settings.ffmpegCueSpectralDetect)
      }
    });
  } catch (error) {
    if (revealErrors) {
      throw error;
    }
    return null;
  }
}

async function previewCue({
  sourceType = "rte",
  episodeUrl = "",
  episodeTitle = "",
  programTitle = "",
  tracklistUrl = "",
  clipId = "",
  streamUrl = "",
  durationSeconds = 0,
  outputDir = "",
  fileName = "",
  onProgress = null
}) {
  const settings = readSettings();
  const raw = String(sourceType || "rte").toLowerCase();
  const safeSourceType = raw === "bbc" ? "bbc" : raw === "wwf" ? "wwf" : raw === "nts" ? "nts" : "rte";
  const safeOutputDir = String(outputDir || "").trim();
  const safeFileName = String(fileName || "").trim();
  let inputSource = "";

  if (safeOutputDir && safeFileName) {
    inputSource = path.join(safeOutputDir, safeFileName);
  } else if (String(streamUrl || "").trim()) {
    inputSource = absolutizeInternalMediaUrl(streamUrl);
  } else if (safeSourceType === "rte") {
    inputSource = absolutizeInternalMediaUrl((await resolveRteEpisodeStream(clipId)).streamUrl);
  } else if (safeSourceType === "wwf") {
    inputSource = (await resolveWwfEpisodeStream(episodeUrl)).streamUrl;
  } else if (safeSourceType === "nts") {
    inputSource = (await resolveNtsEpisodeStream(episodeUrl)).streamUrl;
  } else {
    inputSource = (await resolveBbcEpisodeStream(episodeUrl)).streamUrl;
  }

  return runCueTaskInChild({
    mode: "preview",
    onProgress,
    options: {
      inputSource,
      sourceType: safeSourceType,
      episodeUrl: String(episodeUrl || "").trim(),
      episodeTitle: String(episodeTitle || "").trim(),
      programTitle: String(programTitle || "").trim(),
      tracklistUrl: String(tracklistUrl || "").trim(),
      durationSecondsHint: Number(durationSeconds || 0),
      fingerprintTrackMatching: Boolean(settings.fingerprintTrackMatching),
      auddTrackMatching: Boolean(settings.auddTrackMatching),
      auddApiToken: String(settings.auddApiToken || ""),
      acoustidApiKey: String(settings.acoustidApiKey || ""),
      songrecTrackMatching: Boolean(settings.songrecTrackMatching),
      songrecSampleSeconds: Number(settings.songrecSampleSeconds || 20),
      ffmpegCueSilenceDetect: settings.ffmpegCueSilenceDetect == null ? true : Boolean(settings.ffmpegCueSilenceDetect),
      ffmpegCueLoudnessDetect: settings.ffmpegCueLoudnessDetect == null ? true : Boolean(settings.ffmpegCueLoudnessDetect),
      ffmpegCueSpectralDetect: settings.ffmpegCueSpectralDetect == null ? true : Boolean(settings.ffmpegCueSpectralDetect)
    }
  });
}

async function resolveBbcArtwork(episodeUrl) {
  const url = String(episodeUrl || "").trim();
  if (!url) {
    return "";
  }
  try {
    const json = await runYtDlpJson({
      url,
      args: ["-J", "--no-playlist", "--playlist-items", "1"]
    });
    return String(json?.thumbnail || "").trim();
  } catch {
    return "";
  }
}

async function downloadEpisodeByClip({ clipId, title, episodeUrl, programTitle, publishedTime, artworkUrl = "", progressToken, forceDownload = false }) {
  const playlist = await getPlaylist(String(clipId));
  const resolvedTitle = title || `rte-episode-${clipId}`;
  const download = await downloadFromManifest({
    manifestUrl: playlist.m3u8Url,
    title: resolvedTitle,
    programTitle,
    publishedTime: publishedTime || resolvedTitle,
    clipId,
    episodeUrl,
    progressToken,
    sourceType: "rte",
    forceDownload
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "rte",
    episodeUrl,
    episodeTitle: resolvedTitle,
    programTitle,
    onProgress: (progress) => emitProgressEvent(progressToken, progress)
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "rte",
    episodeTitle: resolvedTitle,
    programTitle,
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl: episodeUrl,
    artworkUrl: String(artworkUrl || "").trim(),
    episodeUrl,
    clipId: String(clipId || "")
  });

  return {
    clipId: String(clipId),
    episodeUrl: episodeUrl || "",
    title: resolvedTitle,
    playlistApiUrl: playlist.apiUrl,
    m3u8Url: playlist.m3u8Url,
    tags,
    cue,
    ...download
  };
}

async function resolveRteEpisodeStream(clipId) {
  const id = String(clipId || "").trim();
  if (!id) {
    throw new Error("clipId is required.");
  }
  const playlist = await getPlaylist(id);
  return {
    clipId: id,
    streamUrl: `/api/rte/stream-proxy?url=${encodeURIComponent(playlist.m3u8Url)}`
  };
}

function isAllowedRteProxyUrl(inputUrl) {
  try {
    const parsed = new URL(String(inputUrl || ""));
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }
    const host = String(parsed.hostname || "").toLowerCase();
    return (
      host.endsWith("rasset.ie")
      || host.endsWith("rte.ie")
    );
  } catch {
    return false;
  }
}

function rewriteHlsManifest(text, baseUrl) {
  const base = new URL(baseUrl);
  const wrapUrl = (value) => `/api/rte/stream-proxy?url=${encodeURIComponent(value)}`;
  const lines = String(text || "").split(/\r?\n/);
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return line;
    }
    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/gi, (_m, uri) => {
        const absolute = new URL(uri, base).toString();
        return `URI="${wrapUrl(absolute)}"`;
      });
    }
    const absolute = new URL(trimmed, base).toString();
    return wrapUrl(absolute);
  });
  return rewritten.join("\n");
}

async function resolveBbcEpisodeStream(episodeUrl) {
  const url = String(episodeUrl || "").trim();
  if (!url) {
    throw new Error("episodeUrl is required.");
  }

  const json = await runYtDlpJson({
    url,
    args: ["-J", "--no-playlist", "--playlist-items", "1"]
  });

  const direct = String(
    json?.url
    || json?.requested_downloads?.[0]?.url
    || json?.formats?.find((f) => f && String(f.protocol || "").includes("m3u8"))?.url
    || ""
  ).trim();

  if (!direct) {
    throw new Error("No playable BBC stream URL found for this episode.");
  }

  return {
    episodeUrl: url,
    streamUrl: direct,
    title: String(json?.title || "").trim(),
    image: String(json?.thumbnail || "").trim()
  };
}

function feedDataDirFor(sourceType) {
  if (sourceType === "bbc") return path.join(DATA_DIR, "bbc");
  if (sourceType === "wwf") return path.join(DATA_DIR, "wwf");
  if (sourceType === "nts") return path.join(DATA_DIR, "nts");
  return DATA_DIR;
}

async function resolveWwfEpisodeStream(episodeUrl) {
  const url = String(episodeUrl || "").trim();
  if (!url) throw new Error("episodeUrl is required.");
  const tryStream = async (sourceUrl) => {
    const json = await runYtDlpJson({ url: sourceUrl, args: ["-J", "--no-playlist", "--playlist-items", "1"] });
    const direct = String(
      json?.url || json?.requested_downloads?.[0]?.url || json?.formats?.find((f) => f && String(f.protocol || "").includes("m3u8"))?.url || ""
    ).trim();
    if (!direct) throw new Error("No playable stream URL found.");
    return { episodeUrl: url, streamUrl: direct, title: String(json?.title || "").trim(), image: String(json?.thumbnail || "").trim() };
  };
  try {
    return await tryStream(url);
  } catch {
    const mixcloudUrl = await getWwfEpisodeMixcloudUrl(url).catch(() => "");
    if (mixcloudUrl) {
      try {
        return await tryStream(mixcloudUrl);
      } catch (e) {
        throw new Error(e?.message || "Mixcloud source failed.");
      }
    }
    throw new Error("No playable Worldwide FM stream found. Episodes are mirrored on Mixcloud.");
  }
}

async function downloadWwfEpisode({ episodeUrl, title, programTitle, publishedTime, artworkUrl = "", progressToken, forceDownload = false }) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) throw new Error("episodeUrl is required.");
  const info = await getWwfEpisodeInfo(sourceUrl).catch(() => ({}));
  const resolvedTitle = String(title || info.title || "").trim() || inferTitleFromUrl(sourceUrl, "wwf-episode");
  const ytDlpUrl = (info.mixcloudUrl && info.mixcloudUrl.trim()) || (await getWwfEpisodeMixcloudUrl(sourceUrl).catch(() => "")) || sourceUrl;
  const download = await downloadFromManifest({
    sourceUrl: ytDlpUrl,
    manifestUrl: ytDlpUrl,
    title: resolvedTitle,
    programTitle: programTitle || info.showName || "Worldwide FM",
    publishedTime: publishedTime || info.publishedTime || info.title || resolvedTitle,
    episodeUrl: sourceUrl,
    clipId: info.clipId || sourceUrl,
    progressToken,
    sourceType: "wwf",
    forceDownload
  });
  const resolvedArtwork = String(artworkUrl || info.image || "").trim();
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "wwf",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || info.showName || "Worldwide FM",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl,
    clipId: String(info.clipId || sourceUrl)
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "wwf",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle: programTitle || info.showName || "Worldwide FM",
    onProgress: (progress) => emitProgressEvent(progressToken, progress)
  });
  return { episodeUrl: sourceUrl, title: resolvedTitle, ...download, tags, cue };
}

async function resolveNtsEpisodeStream(episodeUrl) {
  const url = String(episodeUrl || "").trim();
  if (!url) throw new Error("episodeUrl is required.");
  const json = await runYtDlpJson({ url, args: ["-J", "--no-playlist", "--playlist-items", "1"] });
  const direct = String(
    json?.url || json?.requested_downloads?.[0]?.url || json?.formats?.find((f) => f && String(f.protocol || "").includes("m3u8"))?.url || ""
  ).trim();
  if (!direct) throw new Error("No playable NTS stream URL found.");
  return { episodeUrl: url, streamUrl: direct, title: String(json?.title || "").trim(), image: String(json?.thumbnail || "").trim() };
}

async function downloadNtsEpisode({ episodeUrl, title, programTitle, publishedTime, artworkUrl = "", progressToken, forceDownload = false }) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) throw new Error("episodeUrl is required.");
  const info = await getNtsEpisodeInfo(sourceUrl).catch(() => ({}));
  const resolvedTitle = String(title || info.title || "").trim() || inferTitleFromUrl(sourceUrl, "nts-episode");
  const download = await downloadFromManifest({
    sourceUrl,
    manifestUrl: sourceUrl,
    title: resolvedTitle,
    programTitle: programTitle || "NTS",
    publishedTime: publishedTime || info.title || resolvedTitle,
    episodeUrl: sourceUrl,
    clipId: info.clipId || sourceUrl,
    progressToken,
    sourceType: "nts",
    forceDownload
  });
  const resolvedArtwork = String(artworkUrl || info.image || "").trim();
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "nts",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "NTS",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl,
    clipId: String(info.clipId || sourceUrl)
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "nts",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "NTS",
    onProgress: (progress) => emitProgressEvent(progressToken, progress)
  });
  return { episodeUrl: sourceUrl, title: resolvedTitle, ...download, tags, cue };
}

async function sendWebhookIfConfigured(payload) {
  const webhookUrl = String(readSettings().webhookUrl || "").trim();
  if (!webhookUrl) {
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  } catch {}
}

async function onScheduleRefreshed(sourceType, schedule, latest) {
  if (!readSettings().feedExportEnabled) {
    return;
  }
  writeProgramFeedFiles({
    dataDir: feedDataDirFor(sourceType),
    schedule,
    latest
  });
}

async function onScheduleComplete(sourceType, schedule, downloaded) {
  if (!Array.isArray(downloaded) || !downloaded.length) {
    return;
  }
  await sendWebhookIfConfigured({
    event: "download.complete",
    source: sourceType,
    scheduleId: schedule.id,
    title: schedule.title,
    count: downloaded.length,
    downloaded
  });
}

async function onScheduleError(sourceType, schedule, error) {
  await sendWebhookIfConfigured({
    event: "download.error",
    source: sourceType,
    scheduleId: schedule?.id || "",
    title: schedule?.title || "",
    error: String(error?.message || error || "Unknown error")
  });
}

const scheduler = createSchedulerStore({
  dataDir: DATA_DIR,
  getProgramSummary,
  getProgramEpisodes,
  onScheduleRefreshed: (schedule, latest) => onScheduleRefreshed("rte", schedule, latest),
  onScheduleRunComplete: (schedule, downloaded) => onScheduleComplete("rte", schedule, downloaded),
  onScheduleRunError: (schedule, error) => onScheduleError("rte", schedule, error),
  runEpisodeDownload: async (episode) =>
    downloadEpisodeByClip({
      clipId: episode.clipId,
      title: episode.title,
      programTitle: episode.programTitle,
      episodeUrl: episode.episodeUrl,
      publishedTime: episode.publishedTime,
      artworkUrl: episode.image || "",
      forceDownload: episode.forceDownload || false
    })
});

const bbcScheduler = createSchedulerStore({
  dataDir: path.join(DATA_DIR, "bbc"),
  getProgramSummary: async (programUrl) => getBbcProgramSummary(programUrl, runYtDlpJson),
  getProgramEpisodes: async (programUrl, page) => getBbcProgramEpisodes(programUrl, runYtDlpJson, page),
  onScheduleRefreshed: (schedule, latest) => onScheduleRefreshed("bbc", schedule, latest),
  onScheduleRunComplete: (schedule, downloaded) => onScheduleComplete("bbc", schedule, downloaded),
  onScheduleRunError: (schedule, error) => onScheduleError("bbc", schedule, error),
  runEpisodeDownload: async (episode) =>
    (async () => {
      const download = await downloadFromManifest({
        sourceUrl: String(episode.episodeUrl || ""),
        manifestUrl: String(episode.episodeUrl || ""),
        title: String(episode.title || "bbc-episode"),
        programTitle: String(episode.programTitle || "BBC"),
        publishedTime: String(episode.publishedTime || episode.title || ""),
        clipId: episode.clipId,
        episodeUrl: String(episode.episodeUrl || ""),
        sourceType: "bbc",
        forceDownload: episode.forceDownload || false
      });
      const tags = await maybeApplyId3({
        downloadResult: download,
        sourceType: "bbc",
        episodeTitle: String(episode.title || "bbc-episode"),
        programTitle: String(episode.programTitle || "BBC"),
        publishedTime: String(episode.publishedTime || episode.title || ""),
        sourceUrl: String(episode.episodeUrl || ""),
        artworkUrl: String(episode.image || ""),
        episodeUrl: String(episode.episodeUrl || ""),
        clipId: String(episode.clipId || "")
      });
      const cue = await maybeGenerateCue({
        downloadResult: download,
        sourceType: "bbc",
        episodeUrl: String(episode.episodeUrl || ""),
        episodeTitle: String(episode.title || "bbc-episode"),
        programTitle: String(episode.programTitle || "BBC")
      });
      return { ...download, tags, cue };
    })()
});

const wwfScheduler = createSchedulerStore({
  dataDir: path.join(DATA_DIR, "wwf"),
  getProgramSummary: async (programUrl) => getWwfProgramSummary(programUrl),
  getProgramEpisodes: async (programUrl, page) => getWwfProgramEpisodes(programUrl, page),
  onScheduleRefreshed: (schedule, latest) => onScheduleRefreshed("wwf", schedule, latest),
  onScheduleRunComplete: (schedule, downloaded) => onScheduleComplete("wwf", schedule, downloaded),
  onScheduleRunError: (schedule, error) => onScheduleError("wwf", schedule, error),
  runEpisodeDownload: async (episode) =>
    downloadWwfEpisode({
      episodeUrl: episode.episodeUrl,
      title: episode.title || episode.fullTitle,
      programTitle: episode.programTitle || episode.showName,
      publishedTime: episode.publishedTime,
      artworkUrl: episode.image || "",
      forceDownload: episode.forceDownload || false
    })
});

const ntsScheduler = createSchedulerStore({
  dataDir: path.join(DATA_DIR, "nts"),
  getProgramSummary: async (programUrl) => getNtsProgramSummary(programUrl),
  getProgramEpisodes: async (programUrl, page) => getNtsProgramEpisodes(programUrl, page),
  onScheduleRefreshed: (schedule, latest) => onScheduleRefreshed("nts", schedule, latest),
  onScheduleRunComplete: (schedule, downloaded) => onScheduleComplete("nts", schedule, downloaded),
  onScheduleRunError: (schedule, error) => onScheduleError("nts", schedule, error),
  runEpisodeDownload: async (episode) =>
    downloadNtsEpisode({
      episodeUrl: episode.episodeUrl,
      title: episode.title || episode.fullTitle,
      programTitle: episode.programTitle || "NTS",
      publishedTime: episode.publishedTime,
      artworkUrl: episode.image || "",
      forceDownload: episode.forceDownload || false
    })
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/live/stations", (_req, res) => {
  res.json(LIVE_STATIONS);
});

app.get("/api/live/now/:channelId", async (req, res) => {
  try {
    const data = await getLiveStationNow(req.params.channelId);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/bbc/live/stations", async (_req, res) => {
  try {
    const data = await getBbcLiveStations(runYtDlpJson);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/wwf/live/stations", (_req, res) => {
  res.json(WWF_LIVE_STATIONS);
});

app.get("/api/wwf/live/now", async (_req, res) => {
  try {
    const data = await getWwfLiveNow();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/api/wwf/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchWwfPrograms(query);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/wwf/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const data = await getWwfProgramEpisodes(programUrl, page);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/wwf/program/summary", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const data = await getWwfProgramSummary(programUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/wwf/episode/playlist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getWwfEpisodePlaylist(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/wwf/episode/stream", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await resolveWwfEpisodeStream(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/nts/live/stations", (_req, res) => {
  res.json(NTS_LIVE_STATIONS);
});

app.get("/api/nts/live/now/:channelId", async (req, res) => {
  try {
    const data = await getNtsLiveNow(req.params.channelId || "");
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/nts/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const sort = String(req.query.sort || "recent");
    const data = await searchNtsPrograms(query, { sort });
    res.json(data);
  } catch (error) {
    res.json({ results: [], error: error.message || "Search unavailable" });
  }
});

app.get("/api/nts/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const data = await getNtsProgramEpisodes(programUrl, page);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/nts/program/summary", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const data = await getNtsProgramSummary(programUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/nts/episode/playlist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getNtsEpisodePlaylist(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/nts/episode/stream", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await resolveNtsEpisodeStream(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchPrograms(query);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/bbc/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchBbcPrograms(query, runYtDlpJson);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/bbc/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const data = await getBbcProgramEpisodes(programUrl, runYtDlpJson, page);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/program/summary", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const data = await getProgramSummary(programUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const episodes = await getProgramEpisodes(programUrl, page);
    const summary = await getProgramSummary(programUrl);
    res.json({ ...summary, ...episodes });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/episode/playlist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getEpisodePlaylist(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/bbc/episode/playlist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getBbcEpisodePlaylist(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/rte/episode/stream", async (req, res) => {
  try {
    const clipId = String(req.query.clipId || "").trim();
    const data = await resolveRteEpisodeStream(clipId);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/rte/stream-proxy", async (req, res) => {
  try {
    const targetUrl = String(req.query.url || "").trim();
    if (!targetUrl) {
      throw new Error("url is required.");
    }
    if (!isAllowedRteProxyUrl(targetUrl)) {
      throw new Error("Proxy target host is not allowed.");
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };
    const reqRange = String(req.headers.range || "").trim();
    if (reqRange) {
      headers.Range = reqRange;
    }

    const upstream = await fetch(targetUrl, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      const bodyText = await upstream.text().catch(() => "");
      res.status(upstream.status).send(bodyText || `Upstream error: ${upstream.status}`);
      return;
    }

    const contentType = String(upstream.headers.get("content-type") || "").toLowerCase();
    const isManifest = contentType.includes("mpegurl") || /\.m3u8($|[?#])/i.test(targetUrl);
    if (isManifest) {
      const text = await upstream.text();
      const rewritten = rewriteHlsManifest(text, targetUrl);
      res.status(upstream.status);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-store");
      res.send(rewritten);
      return;
    }

    res.status(upstream.status);
    const passHeaders = ["content-type", "content-length", "accept-ranges", "content-range", "cache-control"];
    for (const key of passHeaders) {
      const value = upstream.headers.get(key);
      if (value) {
        res.setHeader(key, value);
      }
    }
    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    res.status(400).json({ error: String(error?.message || error || "Stream proxy failed") });
  }
});

app.get("/api/bbc/episode/stream", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "").trim();
    const data = await resolveBbcEpisodeStream(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/progress/stream", (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("event: ready\ndata: ok\n\n");

  let listeners = progressSubscribers.get(token);
  if (!listeners) {
    listeners = new Set();
    progressSubscribers.set(token, listeners);
  }
  listeners.add(res);

  req.on("close", () => {
    const current = progressSubscribers.get(token);
    if (!current) {
      return;
    }
    current.delete(res);
    if (current.size === 0) {
      progressSubscribers.delete(token);
    }
  });
});

app.post("/api/download/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const info = await extractRteInfo(pageUrl);
    const download = await downloadFromManifest({
      manifestUrl: info.m3u8Url,
      title: info.title,
      programTitle: inferProgramNameFromUrl(pageUrl),
      publishedTime: info.title,
      clipId: info.clipId,
      episodeUrl: pageUrl,
      progressToken,
      sourceType: "rte",
      forceDownload
    });
    const cue = await maybeGenerateCue({
      downloadResult: download,
      sourceType: "rte",
      episodeUrl: pageUrl,
      episodeTitle: info.title,
      programTitle: inferProgramNameFromUrl(pageUrl),
      onProgress: (progress) => emitProgressEvent(progressToken, progress)
    });
    const tags = await maybeApplyId3({
      downloadResult: download,
      sourceType: "rte",
      episodeTitle: info.title,
      programTitle: inferProgramNameFromUrl(pageUrl),
      publishedTime: info.title,
      sourceUrl: pageUrl,
      artworkUrl: String(info.image || "").trim(),
      episodeUrl: pageUrl,
      clipId: String(info.clipId || "")
    });
    res.json({ ...info, tags, cue, ...download });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/bbc/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const providedTitle = String(req.body.title || "").trim();
    const providedProgramTitle = String(req.body.programTitle || "").trim();
    const publishedTime = String(req.body.publishedTime || "").trim();
    const providedImage = String(req.body.image || "").trim();
    const inferredTitle = providedTitle || inferTitleFromUrl(pageUrl, "bbc-audio");
    const canonicalUrl = toCanonicalBbcEpisodeUrl(pageUrl);
    const attemptUrls = Array.from(new Set([canonicalUrl, String(pageUrl).trim()].filter(Boolean)));
    let download = null;
    let lastError = null;
    let usedUrl = canonicalUrl || String(pageUrl).trim();

    for (let i = 0; i < attemptUrls.length; i += 1) {
      const candidate = attemptUrls[i];
      try {
        download = await downloadFromManifest({
          sourceUrl: candidate,
          manifestUrl: candidate,
          title: inferredTitle,
          programTitle: providedProgramTitle || inferProgramNameFromUrl(candidate) || inferProgramNameFromUrl(pageUrl) || "BBC",
          publishedTime: publishedTime || inferredTitle,
          episodeUrl: candidate,
          progressToken,
          sourceType: "bbc",
          forceDownload
        });
        usedUrl = candidate;
        break;
      } catch (error) {
        lastError = error;
        const hasNext = i < attemptUrls.length - 1;
        if (!hasNext || !shouldRetryBbcWithFallback(error)) {
          throw error;
        }
      }
    }

    if (!download) {
      throw lastError || new Error("BBC download failed.");
    }
    const resolvedArtwork = providedImage || await resolveBbcArtwork(usedUrl);
    const cue = await maybeGenerateCue({
      downloadResult: download,
      sourceType: "bbc",
      episodeUrl: usedUrl,
      episodeTitle: inferredTitle,
      programTitle: providedProgramTitle || inferProgramNameFromUrl(usedUrl) || "BBC",
      onProgress: (progress) => emitProgressEvent(progressToken, progress)
    });
    const tags = await maybeApplyId3({
      downloadResult: download,
      sourceType: "bbc",
      episodeTitle: inferredTitle,
      programTitle: providedProgramTitle || inferProgramNameFromUrl(usedUrl) || "BBC",
      publishedTime: publishedTime || inferredTitle,
      sourceUrl: usedUrl,
      artworkUrl: resolvedArtwork,
      episodeUrl: usedUrl
    });
    res.json({ pageUrl, sourceUrlUsed: usedUrl, title: inferredTitle, tags, cue, ...download });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/wwf/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const title = String(req.body.title || "").trim();
    const programTitle = String(req.body.programTitle || "").trim();
    const publishedTime = String(req.body.publishedTime || "").trim();
    const image = String(req.body.image || "").trim();
    const data = await downloadWwfEpisode({
      episodeUrl: pageUrl,
      title: title || undefined,
      programTitle: programTitle || undefined,
      publishedTime: publishedTime || undefined,
      artworkUrl: image,
      progressToken,
      forceDownload
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/nts/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const title = String(req.body.title || "").trim();
    const programTitle = String(req.body.programTitle || "").trim();
    const publishedTime = String(req.body.publishedTime || "").trim();
    const image = String(req.body.image || "").trim();
    const data = await downloadNtsEpisode({
      episodeUrl: pageUrl,
      title: title || undefined,
      programTitle: programTitle || undefined,
      publishedTime: publishedTime || undefined,
      artworkUrl: image,
      progressToken,
      forceDownload
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/episode", async (req, res) => {
  try {
    const clipId = String(req.body.clipId || "");
    const title = String(req.body.title || "");
    const programTitle = String(req.body.programTitle || "");
    const publishedTime = String(req.body.publishedTime || "");
    const episodeUrl = String(req.body.episodeUrl || "");
    const artworkUrl = String(req.body.artworkUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const data = await downloadEpisodeByClip({ clipId, title, programTitle, episodeUrl, publishedTime, artworkUrl, progressToken, forceDownload });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/settings", (_req, res) => {
  res.json(readSettings());
});

app.post("/api/settings", (req, res) => {
  try {
    const saved = writeSettings({
      ...readSettings(),
      ...(req.body || {})
    });
    res.json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/local-playback-url", (req, res) => {
  try {
    const outputDir = path.resolve(String(req.body.outputDir || "").trim());
    const fileName = String(req.body.fileName || "").trim();
    if (!outputDir || !fileName) {
      throw new Error("outputDir and fileName are required.");
    }
    const fullPath = path.resolve(outputDir, fileName);
    const baseDir = path.resolve(readSettings().downloadDir || DOWNLOAD_DIR);
    if (!isPathInside(baseDir, fullPath)) {
      throw new Error("Requested file is outside download directory.");
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    const token = issueLocalPlaybackToken(fullPath);
    res.json({ url: `/api/local-audio/${encodeURIComponent(token)}` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/local-audio/:token", (req, res) => {
  const token = String(req.params.token || "").trim();
  const fullPath = resolveLocalPlaybackToken(token);
  if (!fullPath) {
    res.status(404).json({ error: "Playback token expired or invalid." });
    return;
  }
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: "Audio file no longer exists." });
    return;
  }
  res.sendFile(fullPath);
});

app.post("/api/local-cue-chapters", (req, res) => {
  try {
    const outputDir = path.resolve(String(req.body.outputDir || "").trim());
    const fileName = String(req.body.fileName || "").trim();
    if (!outputDir || !fileName) {
      throw new Error("outputDir and fileName are required.");
    }
    const fullPath = path.resolve(outputDir, fileName);
    const baseDir = path.resolve(readSettings().downloadDir || DOWNLOAD_DIR);
    if (!isPathInside(baseDir, fullPath)) {
      throw new Error("Requested file is outside download directory.");
    }
    const chapters = readCueChaptersForAudio(outputDir, fileName);
    res.json({ chapters });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/download-queue/stats", (_req, res) => {
  res.json(downloadQueue.stats());
});

app.get("/api/download-queue", (_req, res) => {
  res.json(downloadQueue.snapshot());
});

app.post("/api/download-queue/pause", (_req, res) => {
  downloadQueue.pause();
  res.json(downloadQueue.snapshot());
});

app.post("/api/download-queue/resume", (_req, res) => {
  downloadQueue.resume();
  res.json(downloadQueue.snapshot());
});

app.post("/api/download-queue/cancel", (req, res) => {
  const taskId = String(req.body.taskId || "").trim();
  res.json({
    ok: downloadQueue.cancel(taskId),
    snapshot: downloadQueue.snapshot()
  });
});

app.post("/api/download-queue/clear-pending", (_req, res) => {
  downloadQueue.clearPending();
  res.json(downloadQueue.snapshot());
});

app.post("/api/cue/generate", async (req, res) => {
  try {
    const raw = String(req.body.sourceType || "rte").toLowerCase();
    const sourceType = raw === "bbc" ? "bbc" : raw === "wwf" ? "wwf" : raw === "nts" ? "nts" : "rte";
    const progressToken = String(req.body.progressToken || "");
    const cue = await maybeGenerateCue({
      force: true,
      revealErrors: true,
      sourceType,
      episodeUrl: String(req.body.episodeUrl || ""),
      episodeTitle: String(req.body.title || ""),
      programTitle: String(req.body.programTitle || ""),
      tracklistUrl: String(req.body.tracklistUrl || ""),
      downloadResult: {
        outputDir: String(req.body.outputDir || ""),
        fileName: String(req.body.fileName || "")
      },
      onProgress: (progress) => emitProgressEvent(progressToken, progress)
    });
    res.json(cue);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/cue/preview", async (req, res) => {
  try {
    const progressToken = String(req.body.progressToken || "");
    const cue = await previewCue({
      sourceType: String(req.body.sourceType || "rte"),
      episodeUrl: String(req.body.episodeUrl || ""),
      episodeTitle: String(req.body.title || ""),
      programTitle: String(req.body.programTitle || ""),
      tracklistUrl: String(req.body.tracklistUrl || ""),
      clipId: String(req.body.clipId || ""),
      streamUrl: String(req.body.streamUrl || ""),
      durationSeconds: Number(req.body.durationSeconds || 0),
      outputDir: String(req.body.outputDir || ""),
      fileName: String(req.body.fileName || ""),
      onProgress: (progress) => emitProgressEvent(progressToken, progress)
    });
    res.json(cue);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/scheduler", (_req, res) => {
  res.json(scheduler.list());
});

app.post("/api/scheduler", async (req, res) => {
  try {
    const programUrl = normalizeProgramUrl(String(req.body.programUrl || ""));
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const data = await scheduler.add(programUrl, { backfillCount });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = scheduler.setEnabled(req.params.id, enabled);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/scheduler/:id/run", async (req, res) => {
  try {
    const data = await scheduler.checkOne(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/scheduler/:id", (req, res) => {
  scheduler.remove(req.params.id);
  res.json({ ok: true });
});

app.get("/api/bbc/scheduler", (_req, res) => {
  res.json(bbcScheduler.list());
});

app.post("/api/bbc/scheduler", async (req, res) => {
  try {
    const programUrl = normalizeBbcProgramUrl(String(req.body.programUrl || ""));
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const data = await bbcScheduler.add(programUrl, { backfillCount });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/bbc/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = bbcScheduler.setEnabled(req.params.id, enabled);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/bbc/scheduler/:id/run", async (req, res) => {
  try {
    const data = await bbcScheduler.checkOne(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/bbc/scheduler/:id", (req, res) => {
  bbcScheduler.remove(req.params.id);
  res.json({ ok: true });
});

app.get("/api/wwf/scheduler", (_req, res) => {
  res.json(wwfScheduler.list());
});

app.post("/api/wwf/scheduler", async (req, res) => {
  try {
    const programUrl = String(req.body.programUrl || "").trim();
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const normalized = normalizeWwfProgramUrl(programUrl || "");
    const data = await wwfScheduler.add(normalized, { backfillCount });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/wwf/scheduler/:id", (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const data = wwfScheduler.setEnabled(req.params.id, enabled);
  res.json(data);
});

app.post("/api/wwf/scheduler/:id/run", async (req, res) => {
  try {
    const data = await wwfScheduler.checkOne(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/wwf/scheduler/:id", (req, res) => {
  wwfScheduler.remove(req.params.id);
  res.json({ ok: true });
});

app.get("/api/nts/scheduler", (_req, res) => {
  res.json(ntsScheduler.list());
});

app.post("/api/nts/scheduler", async (req, res) => {
  try {
    const programUrl = String(req.body.programUrl || "").trim();
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const normalized = normalizeNtsProgramUrl(programUrl || "");
    const data = await ntsScheduler.add(normalized, { backfillCount });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/nts/scheduler/:id", (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const data = ntsScheduler.setEnabled(req.params.id, enabled);
  res.json(data);
});

app.post("/api/nts/scheduler/:id/run", async (req, res) => {
  try {
    const data = await ntsScheduler.checkOne(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/nts/scheduler/:id", (req, res) => {
  ntsScheduler.remove(req.params.id);
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(rendererDir, "index.html"));
});

scheduler.start();
scheduler.runAll().catch(() => {});
bbcScheduler.start();
bbcScheduler.runAll().catch(() => {});
wwfScheduler.start();
wwfScheduler.runAll().catch(() => {});
ntsScheduler.start();
ntsScheduler.runAll().catch(() => {});

app.listen(PORT, () => {
  console.log(`Kimble's RTE Player API listening on ${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
  console.log(`DOWNLOAD_DIR=${DOWNLOAD_DIR}`);
});
