const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
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

let scheduler;
let bbcScheduler;
let wwfScheduler;
let ntsScheduler;
let appSettings = null;
const downloadQueue = createDownloadQueue(() => readSettings().maxConcurrentDownloads || 2);

const streamProxyTokens = new Map();
const STREAM_PROXY_TTL_MS = 60 * 60 * 1000;
let streamProxyServer = null;
let streamProxyBaseUrl = "";

function isAllowedStreamProxyHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      /mixcloud\.com$/i.test(host) || /\.mixcloud\.com$/i.test(host) ||
      /ntslive\.co\.uk$/i.test(host) || /\.ntslive\.co\.uk$/i.test(host) ||
      /\.cloudfront\.net$/i.test(host) || /\.akamaized\.net$/i.test(host) ||
      host === "localhost" || host === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function createStreamProxyServer() {
  if (streamProxyServer) return Promise.resolve(streamProxyBaseUrl);
  streamProxyServer = http.createServer((req, res) => {
    const u = new URL(req.url || "", `http://127.0.0.1`);
    if (u.pathname !== "/stream" || req.method !== "GET") {
      res.writeHead(404);
      res.end();
      return;
    }
    const token = u.searchParams.get("token") || "";
    const entry = streamProxyTokens.get(token);
    if (!entry || !isAllowedStreamProxyHost(entry.url)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const targetUrl = entry.url;
    const referer = /mixcloud/i.test(targetUrl) ? "https://www.mixcloud.com/" : "https://www.nts.live/";
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: referer
    };
    const range = req.headers.range;
    if (range) headers.Range = range;
    const mod = targetUrl.startsWith("https") ? https : http;
    const proxyReq = mod.get(targetUrl, { headers }, (proxyRes) => {
      const ct = proxyRes.headers["content-type"] || "audio/mpeg";
      res.writeHead(proxyRes.statusCode || 200, {
        "Content-Type": ct,
        "Accept-Ranges": proxyRes.headers["accept-ranges"] || "bytes",
        ...(proxyRes.headers["content-length"] && { "Content-Length": proxyRes.headers["content-length"] }),
        ...(proxyRes.headers["content-range"] && { "Content-Range": proxyRes.headers["content-range"] })
      });
      proxyRes.pipe(res);
    });
    proxyReq.on("error", () => {
      res.writeHead(502);
      res.end();
    });
  });
  if (!streamProxyServer._cleanupScheduled) {
    streamProxyServer._cleanupScheduled = true;
    setInterval(() => {
      const now = Date.now();
      for (const [t, e] of streamProxyTokens.entries()) {
        if (now - (e.createdAt || 0) > STREAM_PROXY_TTL_MS) streamProxyTokens.delete(t);
      }
    }, 60000);
  }
  return new Promise((resolve) => {
    streamProxyServer.listen(0, "127.0.0.1", () => {
      const port = streamProxyServer.address().port;
      streamProxyBaseUrl = `http://127.0.0.1:${port}`;
      resolve(streamProxyBaseUrl);
    });
  });
}

async function registerStreamProxyUrl(directStreamUrl) {
  if (!directStreamUrl || !isAllowedStreamProxyHost(directStreamUrl)) return directStreamUrl;
  await createStreamProxyServer();
  const token = crypto.randomBytes(12).toString("hex");
  streamProxyTokens.set(token, { url: directStreamUrl, createdAt: Date.now() });
  return `${streamProxyBaseUrl}/stream?token=${token}`;
}

function getAppRootDir() {
  if (app.isPackaged) {
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
      ? path.resolve(process.env.PORTABLE_EXECUTABLE_DIR)
      : "";
    if (portableDir) {
      return portableDir;
    }
    return path.dirname(app.getPath("exe"));
  }
  return process.cwd();
}

function getDefaultDownloadDir() {
  return app.getPath("downloads");
}

function isEphemeralTempDataPath(inputPath) {
  if (!inputPath) {
    return false;
  }

  const normalized = path.resolve(String(inputPath)).toLowerCase();
  const tempRoot = path.resolve(app.getPath("temp")).toLowerCase();
  return normalized.startsWith(tempRoot) && path.basename(normalized) === "data";
}

function getDefaultSettings() {
  return {
    timeFormat: "24h",
    downloadDir: getDefaultDownloadDir(),
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

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getDownloadArchivePath() {
  return path.join(app.getPath("userData"), "download-archive.txt");
}

function normalizeSettings(input) {
  const defaults = getDefaultSettings();
  const raw = input && typeof input === "object" ? input : {};
  const timeFormat = raw.timeFormat === "12h" ? "12h" : "24h";
  const cueAutoGenerate = Boolean(raw.cueAutoGenerate);
  let downloadDir = typeof raw.downloadDir === "string" && raw.downloadDir.trim()
    ? raw.downloadDir.trim()
    : "";
  if (!downloadDir) {
    const legacyRte = typeof raw.rteDownloadDir === "string" && raw.rteDownloadDir.trim() ? raw.rteDownloadDir.trim() : "";
    const legacyBbc = typeof raw.bbcDownloadDir === "string" && raw.bbcDownloadDir.trim() ? raw.bbcDownloadDir.trim() : "";
    const candidate = legacyRte || legacyBbc;
    if (candidate) {
      downloadDir = path.dirname(candidate);
    }
  }
  if (!downloadDir || isEphemeralTempDataPath(downloadDir)) {
    downloadDir = defaults.downloadDir;
  }
  const pathFormat = typeof raw.pathFormat === "string" && raw.pathFormat.trim()
    ? raw.pathFormat.trim()
    : defaults.pathFormat;
  const maxConcurrentDownloads = Math.max(1, Math.min(8, Math.floor(Number(raw.maxConcurrentDownloads || defaults.maxConcurrentDownloads))));
  const outputFormat = String(raw.outputFormat || defaults.outputFormat).trim().toLowerCase() === "mp3" ? "mp3" : "m4a";
  const outputQuality = String(raw.outputQuality || defaults.outputQuality).trim() || defaults.outputQuality;
  const normalizeLoudness = raw.normalizeLoudness == null ? defaults.normalizeLoudness : Boolean(raw.normalizeLoudness);
  const dedupeModeRaw = String(raw.dedupeMode || defaults.dedupeMode).toLowerCase();
  const dedupeMode = ["source-id", "title-date", "none"].includes(dedupeModeRaw) ? dedupeModeRaw : defaults.dedupeMode;
  const id3Tagging = raw.id3Tagging == null ? defaults.id3Tagging : Boolean(raw.id3Tagging);
  const feedExportEnabled = raw.feedExportEnabled == null ? defaults.feedExportEnabled : Boolean(raw.feedExportEnabled);
  const webhookUrl = typeof raw.webhookUrl === "string" ? raw.webhookUrl.trim() : "";
  const auddTrackMatching = raw.auddTrackMatching == null ? defaults.auddTrackMatching : Boolean(raw.auddTrackMatching);
  const auddApiToken = typeof raw.auddApiToken === "string" ? raw.auddApiToken.trim() : "";
  const fingerprintTrackMatching = raw.fingerprintTrackMatching == null
    ? defaults.fingerprintTrackMatching
    : Boolean(raw.fingerprintTrackMatching);
  const acoustidApiKey = typeof raw.acoustidApiKey === "string" ? raw.acoustidApiKey.trim() : "";
  const songrecTrackMatching = raw.songrecTrackMatching == null ? defaults.songrecTrackMatching : Boolean(raw.songrecTrackMatching);
  const songrecSampleSeconds = Math.max(8, Math.min(45, Math.floor(Number(raw.songrecSampleSeconds || defaults.songrecSampleSeconds))));
  const ffmpegCueSilenceDetect = raw.ffmpegCueSilenceDetect == null ? defaults.ffmpegCueSilenceDetect : Boolean(raw.ffmpegCueSilenceDetect);
  const ffmpegCueLoudnessDetect = raw.ffmpegCueLoudnessDetect == null ? defaults.ffmpegCueLoudnessDetect : Boolean(raw.ffmpegCueLoudnessDetect);
  const ffmpegCueSpectralDetect = raw.ffmpegCueSpectralDetect == null ? defaults.ffmpegCueSpectralDetect : Boolean(raw.ffmpegCueSpectralDetect);

  return {
    timeFormat,
    downloadDir,
    pathFormat,
    cueAutoGenerate,
    maxConcurrentDownloads,
    outputFormat,
    outputQuality,
    normalizeLoudness,
    dedupeMode,
    id3Tagging,
    feedExportEnabled,
    webhookUrl,
    auddTrackMatching,
    auddApiToken,
    fingerprintTrackMatching,
    acoustidApiKey,
    songrecTrackMatching,
    songrecSampleSeconds,
    ffmpegCueSilenceDetect,
    ffmpegCueLoudnessDetect,
    ffmpegCueSpectralDetect
  };
}

function readSettings() {
  if (appSettings) {
    return appSettings;
  }

  const settingsPath = getSettingsPath();
  try {
    const content = fs.readFileSync(settingsPath, "utf8");
    appSettings = normalizeSettings(JSON.parse(content));
  } catch {
    appSettings = getDefaultSettings();
  }

  return appSettings;
}

function writeSettings(next) {
  const settingsPath = getSettingsPath();
  const normalized = normalizeSettings(next);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(normalized, null, 2), "utf8");
  appSettings = normalized;
  return normalized;
}

function resolveWindowIcon() {
  const rootDir = path.resolve(__dirname, "..");
  const preferred = process.platform === "win32" ? "icon.ico" : "icon.png";
  const fallbacks = [preferred, "icon.png", "icon.ico"];
  const folders = [
    path.join(rootDir, "build"),
    process.resourcesPath ? path.join(process.resourcesPath, "build") : null,
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar.unpacked", "build") : null
  ].filter(Boolean);

  for (const folder of folders) {
    for (const fileName of fallbacks) {
      const candidate = path.join(folder, fileName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function ensureOutputDir(sourceType = "rte") {
  const settings = readSettings();
  const outputDir = settings.downloadDir;
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
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
    if (parsed.hostname.includes("worldwidefm.net")) {
      return "Worldwide FM";
    }
    if (parsed.hostname.includes("nts.live")) {
      return "NTS";
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

function buildEpisodeFileTitle({ episodeTitle, programTitle, clipId }) {
  const safeEpisodeTitle = String(episodeTitle || "").trim();
  const safeProgramTitle = String(programTitle || "").trim();

  return safeEpisodeTitle || (safeProgramTitle ? `${safeProgramTitle} ${clipId}` : `rte-episode-${clipId}`);
}

async function downloadFromManifest({
  manifestUrl,
  sourceUrl,
  title,
  programTitle,
  publishedTime,
  clipId,
  episodeUrl,
  onProgress,
  sourceType = "rte",
  forceDownload = false
}) {
  const baseOutputDir = ensureOutputDir(sourceType);
  const settings = readSettings();
  const target = buildDownloadTarget({
    baseDownloadDir: baseOutputDir,
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
  const result = await downloadQueue.run(
    (queueTask) => runYtDlpDownload({
      manifestUrl,
      sourceUrl,
      title: target.fileStem,
      outputDir,
      archivePath: getDownloadArchivePath(),
      registerCancel: queueTask?.registerCancel,
      onProgress,
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
    inputSource = String(streamUrl || "").trim();
  } else if (safeSourceType === "rte") {
    inputSource = (await resolveRteEpisodeStream(clipId)).streamUrl;
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

function emitRendererProgress(sender, progressToken, payload) {
  if (!progressToken) {
    return;
  }
  sender.send("download-progress", {
    token: progressToken,
    ...payload
  });
}

async function downloadEpisodeByClip({ clipId, title, episodeUrl, programTitle, publishedTime, artworkUrl = "", onProgress, forceDownload = false }) {
  if (!clipId) {
    throw new Error("clipId is required.");
  }

  const playlist = await getPlaylist(String(clipId));
  const resolvedTitle = buildEpisodeFileTitle({
    episodeTitle: title,
    programTitle,
    clipId
  });
  const download = await downloadFromManifest({
    manifestUrl: playlist.m3u8Url,
    title: resolvedTitle,
    programTitle,
    publishedTime: publishedTime || resolvedTitle,
    clipId,
    episodeUrl,
    onProgress,
    sourceType: "rte",
    forceDownload
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
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "rte",
    episodeUrl,
    episodeTitle: resolvedTitle,
    programTitle,
    onProgress
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

async function downloadBbcEpisode({ episodeUrl, title, programTitle, publishedTime, artworkUrl = "", onProgress, forceDownload = false }) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("episodeUrl is required.");
  }

  const resolvedTitle = String(title || "").trim() || inferTitleFromUrl(sourceUrl, "bbc-episode");
  const download = await downloadFromManifest({
    sourceUrl,
    manifestUrl: sourceUrl,
    title: resolvedTitle,
    programTitle: programTitle || "BBC",
    publishedTime: publishedTime || resolvedTitle,
    episodeUrl,
    onProgress,
    sourceType: "bbc",
    forceDownload
  });
  const resolvedArtwork = String(artworkUrl || "").trim() || await resolveBbcArtwork(sourceUrl);
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "bbc",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "BBC",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "bbc",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle,
    onProgress
  });

  return {
    episodeUrl: sourceUrl,
    title: resolvedTitle,
    clipId: inferTitleFromUrl(sourceUrl, resolvedTitle).replace(/\s+/g, "-").toLowerCase(),
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
    streamUrl: playlist.m3u8Url
  };
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

ipcMain.handle("download-rte-url", async (event, { pageUrl, progressToken, forceDownload = false }) => {
  if (!pageUrl || typeof pageUrl !== "string") {
    throw new Error("A valid RTE page URL is required.");
  }

  const info = await extractRteInfo(pageUrl);
  const download = await downloadFromManifest({
    manifestUrl: info.m3u8Url,
    title: info.title,
    programTitle: inferProgramNameFromUrl(pageUrl),
    publishedTime: info.title,
    clipId: info.clipId,
    episodeUrl: pageUrl,
    onProgress: (progress) => {
      if (!progressToken) {
        return;
      }
      event.sender.send("download-progress", {
        token: progressToken,
        ...progress
      });
    },
    forceDownload: Boolean(forceDownload)
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "rte",
    episodeUrl: pageUrl,
    episodeTitle: info.title,
    programTitle: inferProgramNameFromUrl(pageUrl),
    onProgress: (progress) => emitRendererProgress(event.sender, progressToken, progress)
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

  return {
    ...info,
    tags,
    cue,
    ...download
  };
});

ipcMain.handle("download-wwf-url", async (event, { pageUrl, progressToken, title, programTitle, publishedTime, image, forceDownload = false }) => {
  if (!pageUrl || typeof pageUrl !== "string") {
    throw new Error("A valid Worldwide FM page URL is required.");
  }
  const info = await getWwfEpisodeInfo(pageUrl);
  const resolvedTitle = String(title || info.title || "").trim() || inferTitleFromUrl(pageUrl, "wwf-episode");
  return downloadWwfEpisode({
    episodeUrl: pageUrl,
    title: resolvedTitle,
    programTitle: programTitle || info.showName || "Worldwide FM",
    publishedTime: publishedTime || info.title || resolvedTitle,
    artworkUrl: String(image || info.image || "").trim(),
    onProgress: (progress) => {
      if (!progressToken) return;
      event.sender.send("download-progress", { token: progressToken, ...progress });
    },
    forceDownload: Boolean(forceDownload)
  });
});

ipcMain.handle("download-nts-url", async (event, { pageUrl, progressToken, title, programTitle, publishedTime, image, forceDownload = false }) => {
  if (!pageUrl || typeof pageUrl !== "string") {
    throw new Error("A valid NTS episode URL is required.");
  }
  const info = await getNtsEpisodeInfo(pageUrl);
  const resolvedTitle = String(title || info.title || "").trim() || inferTitleFromUrl(pageUrl, "nts-episode");
  return downloadNtsEpisode({
    episodeUrl: pageUrl,
    title: resolvedTitle,
    programTitle: programTitle || "NTS",
    publishedTime: publishedTime || info.title || resolvedTitle,
    artworkUrl: String(image || info.image || "").trim(),
    onProgress: (progress) => {
      if (!progressToken) return;
      event.sender.send("download-progress", { token: progressToken, ...progress });
    },
    forceDownload: Boolean(forceDownload)
  });
});

ipcMain.handle("download-bbc-url", async (event, { pageUrl, progressToken, title, programTitle, publishedTime, image, forceDownload = false }) => {
  if (!pageUrl || typeof pageUrl !== "string") {
    throw new Error("A valid BBC page URL is required.");
  }

  const providedTitle = String(title || "").trim();
  const providedProgramTitle = String(programTitle || "").trim();
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
        sourceType: "bbc",
        onProgress: (progress) => {
          if (!progressToken) {
            return;
          }
          event.sender.send("download-progress", {
            token: progressToken,
            ...progress
          });
        },
        forceDownload: Boolean(forceDownload)
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
  const resolvedArtwork = String(image || "").trim() || await resolveBbcArtwork(usedUrl);
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
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "bbc",
    episodeUrl: usedUrl,
    episodeTitle: inferredTitle,
    programTitle: providedProgramTitle || inferProgramNameFromUrl(usedUrl) || "BBC",
    onProgress: (progress) => emitRendererProgress(event.sender, progressToken, progress)
  });

  return {
    pageUrl,
    sourceUrlUsed: usedUrl,
    title: inferredTitle,
    tags,
    cue,
    ...download
  };
});

ipcMain.handle("download-rte-episode", async (event, payload) => {
  const safePayload = payload || {};
  return downloadEpisodeByClip({
    ...safePayload,
    forceDownload: Boolean(safePayload.forceDownload),
    onProgress: (progress) => {
      if (!safePayload.progressToken) {
        return;
      }
      event.sender.send("download-progress", {
        token: safePayload.progressToken,
        ...progress
      });
    }
  });
});

ipcMain.handle("rte-live-stations", async () => {
  return LIVE_STATIONS;
});

ipcMain.handle("rte-live-now", async (_event, { channelId }) => {
  return getLiveStationNow(channelId);
});

ipcMain.handle("rte-program-summary", async (_event, { programUrl }) => {
  return getProgramSummary(programUrl);
});

ipcMain.handle("rte-program-episodes", async (_event, { programUrl, page = 1 }) => {
  const episodes = await getProgramEpisodes(programUrl, page);
  const summary = await getProgramSummary(programUrl);

  return {
    ...summary,
    ...episodes
  };
});

ipcMain.handle("rte-program-search", async (_event, { query }) => {
  return searchPrograms(query || "");
});

ipcMain.handle("bbc-program-episodes", async (_event, { programUrl, page = 1 }) => {
  return getBbcProgramEpisodes(programUrl, runYtDlpJson, page);
});

ipcMain.handle("bbc-program-search", async (_event, { query }) => {
  return searchBbcPrograms(query || "", runYtDlpJson);
});

ipcMain.handle("bbc-live-stations", async () => {
  return getBbcLiveStations(runYtDlpJson);
});

ipcMain.handle("bbc-episode-playlist", async (_event, { episodeUrl }) => {
  return getBbcEpisodePlaylist(episodeUrl);
});

ipcMain.handle("rte-episode-playlist", async (_event, { episodeUrl }) => {
  return getEpisodePlaylist(episodeUrl);
});

ipcMain.handle("rte-episode-stream", async (_event, { clipId }) => {
  return resolveRteEpisodeStream(clipId);
});

ipcMain.handle("bbc-episode-stream", async (_event, { episodeUrl }) => {
  return resolveBbcEpisodeStream(episodeUrl);
});

async function resolveWwfEpisodeStream(episodeUrl) {
  const url = String(episodeUrl || "").trim();
  if (!url) {
    throw new Error("episodeUrl is required.");
  }
  const tryStream = async (sourceUrl) => {
    const json = await runYtDlpJson({
      url: sourceUrl,
      args: ["-J", "--no-playlist", "--playlist-items", "1"]
    });
    const direct = String(
      json?.url
      || json?.requested_downloads?.[0]?.url
      || json?.formats?.find((f) => f && String(f.protocol || "").includes("m3u8"))?.url
      || ""
    ).trim();
    if (!direct) throw new Error("No playable stream URL found.");
    return {
      episodeUrl: url,
      streamUrl: direct,
      title: String(json?.title || "").trim(),
      image: String(json?.thumbnail || "").trim()
    };
  };
  let result;
  try {
    result = await tryStream(url);
  } catch {
    const mixcloudUrl = await getWwfEpisodeMixcloudUrl(url).catch(() => "");
    if (mixcloudUrl) {
      try {
        result = await tryStream(mixcloudUrl);
      } catch (e) {
        throw new Error(e?.message || "Mixcloud source failed. Try downloading the episode first.");
      }
    } else {
      throw new Error("No playable Worldwide FM stream found. Episodes are mirrored on Mixcloud; the app could not resolve the link. Try downloading the episode first.");
    }
  }
  result.streamUrl = await registerStreamProxyUrl(result.streamUrl);
  return result;
}

async function downloadWwfEpisode({ episodeUrl, title, programTitle, publishedTime, artworkUrl = "", onProgress, forceDownload = false }) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("episodeUrl is required.");
  }
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
    onProgress,
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
    onProgress
  });
  return {
    episodeUrl: sourceUrl,
    title: resolvedTitle,
    ...download,
    tags,
    cue
  };
}

ipcMain.handle("wwf-episode-stream", async (_event, { episodeUrl }) => {
  return resolveWwfEpisodeStream(episodeUrl);
});

ipcMain.handle("wwf-live-stations", async () => {
  return WWF_LIVE_STATIONS;
});

ipcMain.handle("wwf-live-now", async () => {
  return getWwfLiveNow();
});

ipcMain.handle("wwf-program-search", async (_event, { query }) => {
  return searchWwfPrograms(query || "");
});

ipcMain.handle("wwf-program-summary", async (_event, { programUrl }) => {
  return getWwfProgramSummary(programUrl || "");
});

ipcMain.handle("wwf-program-episodes", async (_event, { programUrl, page = 1 }) => {
  return getWwfProgramEpisodes(programUrl, page);
});

ipcMain.handle("wwf-episode-playlist", async (_event, { episodeUrl }) => {
  return getWwfEpisodePlaylist(episodeUrl);
});

ipcMain.handle("wwf-scheduler-list", async () => {
  return wwfScheduler.list();
});

ipcMain.handle("wwf-scheduler-add", async (_event, { programUrl, options }) => {
  const normalized = normalizeWwfProgramUrl(programUrl || "");
  const added = await wwfScheduler.add(normalized, options || {});
  return added;
});

ipcMain.handle("wwf-scheduler-remove", async (_event, { scheduleId }) => {
  wwfScheduler.remove(scheduleId);
  return wwfScheduler.list();
});

ipcMain.handle("wwf-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  wwfScheduler.setEnabled(scheduleId, enabled);
  return wwfScheduler.list();
});

ipcMain.handle("wwf-scheduler-check-one", async (_event, { scheduleId }) => {
  return wwfScheduler.checkOne(scheduleId);
});

async function resolveNtsEpisodeStream(episodeUrl) {
  const url = String(episodeUrl || "").trim();
  if (!url) throw new Error("episodeUrl is required.");
  try {
    const json = await runYtDlpJson({ url, args: ["-J", "--no-playlist", "--playlist-items", "1"] });
    const direct = String(
      json?.url || json?.requested_downloads?.[0]?.url || json?.formats?.find((f) => f && String(f.protocol || "").includes("m3u8"))?.url || ""
    ).trim();
    if (!direct) throw new Error("No playable NTS stream URL found.");
    return { episodeUrl: url, streamUrl: direct, title: String(json?.title || "").trim(), image: String(json?.thumbnail || "").trim() };
  } catch (err) {
    await getNtsEpisodeInfo(url).catch(() => ({}));
    throw new Error(err?.message || "No playable NTS stream found. Try downloading the episode first.");
  }
}

async function downloadNtsEpisode({ episodeUrl, title, programTitle, publishedTime, artworkUrl = "", onProgress, forceDownload = false }) {
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
    onProgress,
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
    onProgress
  });
  return { episodeUrl: sourceUrl, title: resolvedTitle, ...download, tags, cue };
}

ipcMain.handle("nts-episode-stream", async (_event, { episodeUrl }) => {
  return resolveNtsEpisodeStream(episodeUrl);
});

ipcMain.handle("nts-live-stations", () => {
  return NTS_LIVE_STATIONS;
});

ipcMain.handle("nts-live-now", async (_event, { channelId }) => {
  return getNtsLiveNow(channelId || "");
});

ipcMain.handle("nts-program-search", async (_event, { query, options }) => {
  try {
    return await searchNtsPrograms(query || "", options);
  } catch (e) {
    return { results: [], error: e?.message || "Search unavailable" };
  }
});

ipcMain.handle("nts-program-summary", async (_event, { programUrl }) => {
  return getNtsProgramSummary(programUrl || "");
});

ipcMain.handle("nts-program-episodes", async (_event, { programUrl, page = 1 }) => {
  return getNtsProgramEpisodes(programUrl, page);
});

ipcMain.handle("nts-episode-playlist", async (_event, { episodeUrl }) => {
  return getNtsEpisodePlaylist(episodeUrl);
});

ipcMain.handle("nts-scheduler-list", async () => {
  return ntsScheduler.list();
});

ipcMain.handle("nts-scheduler-add", async (_event, { programUrl, options }) => {
  const normalized = normalizeNtsProgramUrl(programUrl || "");
  const added = await ntsScheduler.add(normalized, options || {});
  return added;
});

ipcMain.handle("nts-scheduler-remove", async (_event, { scheduleId }) => {
  ntsScheduler.remove(scheduleId);
  return ntsScheduler.list();
});

ipcMain.handle("nts-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  ntsScheduler.setEnabled(scheduleId, enabled);
  return ntsScheduler.list();
});

ipcMain.handle("nts-scheduler-check-one", async (_event, { scheduleId }) => {
  return ntsScheduler.checkOne(scheduleId);
});

ipcMain.handle("local-playback-url", async (_event, { outputDir, fileName }) => {
  const dir = path.resolve(String(outputDir || "").trim());
  const name = String(fileName || "").trim();
  if (!dir || !name) {
    throw new Error("outputDir and fileName are required.");
  }
  const fullPath = path.resolve(dir, name);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  return pathToFileURL(fullPath).toString();
});

ipcMain.handle("local-cue-chapters", async (_event, { outputDir, fileName }) => {
  return readCueChaptersForAudio(outputDir, fileName);
});

ipcMain.handle("scheduler-list", async () => {
  return scheduler.list();
});

ipcMain.handle("scheduler-add", async (_event, { programUrl, options }) => {
  const normalized = normalizeProgramUrl(programUrl);
  const added = await scheduler.add(normalized, options || {});
  return added;
});

ipcMain.handle("scheduler-remove", async (_event, { scheduleId }) => {
  scheduler.remove(scheduleId);
  return scheduler.list();
});

ipcMain.handle("scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  scheduler.setEnabled(scheduleId, enabled);
  return scheduler.list();
});

ipcMain.handle("scheduler-check-one", async (_event, { scheduleId }) => {
  return scheduler.checkOne(scheduleId);
});

ipcMain.handle("bbc-scheduler-list", async () => {
  return bbcScheduler.list();
});

ipcMain.handle("bbc-scheduler-add", async (_event, { programUrl, options }) => {
  const normalized = normalizeBbcProgramUrl(programUrl);
  const added = await bbcScheduler.add(normalized, options || {});
  return added;
});

ipcMain.handle("bbc-scheduler-remove", async (_event, { scheduleId }) => {
  bbcScheduler.remove(scheduleId);
  return bbcScheduler.list();
});

ipcMain.handle("bbc-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  bbcScheduler.setEnabled(scheduleId, enabled);
  return bbcScheduler.list();
});

ipcMain.handle("bbc-scheduler-check-one", async (_event, { scheduleId }) => {
  return bbcScheduler.checkOne(scheduleId);
});

ipcMain.handle("settings-get", async () => {
  return readSettings();
});

ipcMain.handle("settings-save", async (_event, payload) => {
  const current = readSettings();
  return writeSettings({
    ...current,
    ...(payload || {})
  });
});

ipcMain.handle("cue-generate", async (_event, payload = {}) => {
  const raw = String(payload.sourceType || "rte").toLowerCase();
  const sourceType = raw === "bbc" ? "bbc" : raw === "wwf" ? "wwf" : raw === "nts" ? "nts" : "rte";
  const episodeUrl = String(payload.episodeUrl || "").trim();
  const episodeTitle = String(payload.title || "").trim();
  const programTitle = String(payload.programTitle || "").trim();
  const outputDir = String(payload.outputDir || "").trim();
  const fileName = String(payload.fileName || "").trim();
  const tracklistUrl = String(payload.tracklistUrl || "").trim();
  const progressToken = String(payload.progressToken || "").trim();
  if (!outputDir || !fileName) {
    throw new Error("Download the episode first so an audio file exists.");
  }
  const cue = await maybeGenerateCue({
    force: true,
    revealErrors: true,
    sourceType,
    episodeUrl,
    episodeTitle,
    programTitle,
    tracklistUrl,
    downloadResult: { outputDir, fileName },
    onProgress: (progress) => emitRendererProgress(_event.sender, progressToken, progress)
  });
  return cue;
});

ipcMain.handle("cue-preview", async (event, payload = {}) => {
  return previewCue({
    sourceType: String(payload.sourceType || "rte"),
    episodeUrl: String(payload.episodeUrl || ""),
    episodeTitle: String(payload.title || ""),
    programTitle: String(payload.programTitle || ""),
    tracklistUrl: String(payload.tracklistUrl || ""),
    clipId: String(payload.clipId || ""),
    streamUrl: String(payload.streamUrl || ""),
    durationSeconds: Number(payload.durationSeconds || 0),
    outputDir: String(payload.outputDir || ""),
    fileName: String(payload.fileName || ""),
    onProgress: (progress) => emitRendererProgress(event.sender, String(payload.progressToken || "").trim(), progress)
  });
});

ipcMain.handle("settings-pick-download-dir", async (event, payload = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const current = readSettings();
  const defaultPath = current.downloadDir;
  const response = await dialog.showOpenDialog(window, {
    title: "Choose Download Directory",
    defaultPath,
    properties: ["openDirectory", "createDirectory"]
  });

  if (response.canceled || !response.filePaths?.[0]) {
    return "";
  }

  return response.filePaths[0];
});

ipcMain.handle("download-queue-stats", async () => {
  return downloadQueue.stats();
});

ipcMain.handle("download-queue-snapshot", async () => {
  return downloadQueue.snapshot();
});

ipcMain.handle("download-queue-pause", async () => {
  downloadQueue.pause();
  return downloadQueue.snapshot();
});

ipcMain.handle("download-queue-resume", async () => {
  downloadQueue.resume();
  return downloadQueue.snapshot();
});

ipcMain.handle("download-queue-cancel", async (_event, { taskId }) => {
  return {
    ok: downloadQueue.cancel(taskId),
    snapshot: downloadQueue.snapshot()
  };
});

ipcMain.handle("download-queue-clear-pending", async () => {
  downloadQueue.clearPending();
  return downloadQueue.snapshot();
});

function feedDataDirFor(sourceType) {
  if (sourceType === "bbc") return path.join(app.getPath("userData"), "bbc");
  if (sourceType === "wwf") return path.join(app.getPath("userData"), "wwf");
  if (sourceType === "nts") return path.join(app.getPath("userData"), "nts");
  return app.getPath("userData");
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

app.whenReady().then(() => {
  readSettings();

  scheduler = createSchedulerStore({
    app,
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

  bbcScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "bbc"),
    getProgramSummary: async (programUrl) => getBbcProgramSummary(programUrl, runYtDlpJson),
    getProgramEpisodes: async (programUrl, page) => getBbcProgramEpisodes(programUrl, runYtDlpJson, page),
    onScheduleRefreshed: (schedule, latest) => onScheduleRefreshed("bbc", schedule, latest),
    onScheduleRunComplete: (schedule, downloaded) => onScheduleComplete("bbc", schedule, downloaded),
    onScheduleRunError: (schedule, error) => onScheduleError("bbc", schedule, error),
    runEpisodeDownload: async (episode) =>
      downloadBbcEpisode({
        episodeUrl: episode.episodeUrl,
        title: episode.title,
        programTitle: episode.programTitle,
        publishedTime: episode.publishedTime,
        artworkUrl: episode.image || "",
        forceDownload: episode.forceDownload || false
      })
  });

  wwfScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "wwf"),
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

  ntsScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "nts"),
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

  scheduler.start();
  scheduler.runAll().catch(() => {});
  bbcScheduler.start();
  bbcScheduler.runAll().catch(() => {});
  wwfScheduler.start();
  wwfScheduler.runAll().catch(() => {});
  ntsScheduler.start();
  ntsScheduler.runAll().catch(() => {});

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (scheduler) {
    scheduler.stop();
  }
  if (bbcScheduler) {
    bbcScheduler.stop();
  }
  if (wwfScheduler) {
    wwfScheduler.stop();
  }
  if (ntsScheduler) {
    ntsScheduler.stop();
  }
});
