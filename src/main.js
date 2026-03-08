const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
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
const { runYtDlpDownload, runYtDlpJson } = require("./lib/downloader");
const { generateCueForAudio } = require("./lib/cue");
const { createSchedulerStore } = require("./lib/scheduler");
const { buildDownloadTarget, sanitizePathSegment } = require("./lib/path-format");
const { createDownloadQueue } = require("./lib/download-queue");
const { applyId3Tags } = require("./lib/tags");
const { writeProgramFeedFiles } = require("./lib/feeds");

let scheduler;
let bbcScheduler;
let appSettings = null;
const downloadQueue = createDownloadQueue(() => readSettings().maxConcurrentDownloads || 2);

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
    outputFormat: "mp3",
    outputQuality: "128K",
    normalizeLoudness: true,
    dedupeMode: "source-id",
    id3Tagging: true,
    feedExportEnabled: true,
    webhookUrl: ""
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
  const outputFormat = String(raw.outputFormat || defaults.outputFormat).toLowerCase();
  const outputQuality = String(raw.outputQuality || defaults.outputQuality).trim() || defaults.outputQuality;
  const normalizeLoudness = raw.normalizeLoudness == null ? defaults.normalizeLoudness : Boolean(raw.normalizeLoudness);
  const dedupeModeRaw = String(raw.dedupeMode || defaults.dedupeMode).toLowerCase();
  const dedupeMode = ["source-id", "title-date", "none"].includes(dedupeModeRaw) ? dedupeModeRaw : defaults.dedupeMode;
  const id3Tagging = raw.id3Tagging == null ? defaults.id3Tagging : Boolean(raw.id3Tagging);
  const feedExportEnabled = raw.feedExportEnabled == null ? defaults.feedExportEnabled : Boolean(raw.feedExportEnabled);
  const webhookUrl = typeof raw.webhookUrl === "string" ? raw.webhookUrl.trim() : "";

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
    webhookUrl
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
      dedupeMode: settings.dedupeMode
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
      episodeUrl,
      clipId,
      description
    });
  } catch {
    return null;
  }
}

async function maybeGenerateCue({
  downloadResult,
  sourceType,
  episodeUrl,
  episodeTitle,
  programTitle,
  tracklistUrl = "",
  force = false
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
    return await generateCueForAudio({
      audioPath,
      sourceType,
      episodeUrl,
      episodeTitle,
      programTitle,
      tracklistUrl,
      getRteTracks: getEpisodePlaylist,
      getBbcTracks: getBbcEpisodePlaylist
    });
  } catch {
    return null;
  }
}

async function downloadEpisodeByClip({ clipId, title, episodeUrl, programTitle, publishedTime, onProgress, forceDownload = false }) {
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
    artworkUrl: "",
    episodeUrl,
    clipId: String(clipId || "")
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "rte",
    episodeUrl,
    episodeTitle: resolvedTitle,
    programTitle
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

async function downloadBbcEpisode({ episodeUrl, title, programTitle, publishedTime, onProgress, forceDownload = false }) {
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
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "bbc",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "BBC",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: "",
    episodeUrl: sourceUrl
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "bbc",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle
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
    programTitle: inferProgramNameFromUrl(pageUrl)
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "rte",
    episodeTitle: info.title,
    programTitle: inferProgramNameFromUrl(pageUrl),
    publishedTime: info.title,
    sourceUrl: pageUrl,
    artworkUrl: "",
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

ipcMain.handle("download-bbc-url", async (event, { pageUrl, progressToken, title, programTitle, publishedTime, forceDownload = false }) => {
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
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "bbc",
    episodeTitle: inferredTitle,
    programTitle: providedProgramTitle || inferProgramNameFromUrl(usedUrl) || "BBC",
    publishedTime: publishedTime || inferredTitle,
    sourceUrl: usedUrl,
    artworkUrl: "",
    episodeUrl: usedUrl
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "bbc",
    episodeUrl: usedUrl,
    episodeTitle: inferredTitle,
    programTitle: providedProgramTitle || inferProgramNameFromUrl(usedUrl) || "BBC"
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
  const sourceType = String(payload.sourceType || "rte").toLowerCase() === "bbc" ? "bbc" : "rte";
  const episodeUrl = String(payload.episodeUrl || "").trim();
  const episodeTitle = String(payload.title || "").trim();
  const programTitle = String(payload.programTitle || "").trim();
  const outputDir = String(payload.outputDir || "").trim();
  const fileName = String(payload.fileName || "").trim();
  const tracklistUrl = String(payload.tracklistUrl || "").trim();
  if (!outputDir || !fileName) {
    throw new Error("Download the episode first so an audio file exists.");
  }
  const cue = await maybeGenerateCue({
    force: true,
    sourceType,
    episodeUrl,
    episodeTitle,
    programTitle,
    tracklistUrl,
    downloadResult: { outputDir, fileName }
  });
  if (!cue) {
    throw new Error("Unable to generate CUE/chapters for this episode.");
  }
  return cue;
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
  return sourceType === "bbc"
    ? path.join(app.getPath("userData"), "bbc")
    : app.getPath("userData");
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
        publishedTime: episode.publishedTime
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
        programTitle: episode.programTitle
      })
  });

  scheduler.start();
  scheduler.runAll().catch(() => {});
  bbcScheduler.start();
  bbcScheduler.runAll().catch(() => {});

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
});
