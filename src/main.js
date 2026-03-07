const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
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

let scheduler;
let bbcScheduler;
let appSettings = null;

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

function getDefaultDownloadDir(sourceType = "rte") {
  const folder = sourceType === "bbc" ? "BBC" : "RTE";
  return path.join(app.getPath("downloads"), folder);
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
    rteDownloadDir: getDefaultDownloadDir("rte"),
    bbcDownloadDir: getDefaultDownloadDir("bbc"),
    episodeNameMode: "date-only",
    cueAutoGenerate: false
  };
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function normalizeSettings(input) {
  const defaults = getDefaultSettings();
  const raw = input && typeof input === "object" ? input : {};
  const timeFormat = raw.timeFormat === "12h" ? "12h" : "24h";
  const episodeNameMode = raw.episodeNameMode === "full-title" ? "full-title" : "date-only";
  const cueAutoGenerate = Boolean(raw.cueAutoGenerate);
  const legacyDownloadDir = typeof raw.downloadDir === "string" && raw.downloadDir.trim()
    ? raw.downloadDir.trim()
    : "";
  let rteDownloadDir = typeof raw.rteDownloadDir === "string" && raw.rteDownloadDir.trim()
    ? raw.rteDownloadDir.trim()
    : (legacyDownloadDir || defaults.rteDownloadDir);
  let bbcDownloadDir = typeof raw.bbcDownloadDir === "string" && raw.bbcDownloadDir.trim()
    ? raw.bbcDownloadDir.trim()
    : defaults.bbcDownloadDir;

  if (isEphemeralTempDataPath(rteDownloadDir)) {
    rteDownloadDir = defaults.rteDownloadDir;
  }
  if (isEphemeralTempDataPath(bbcDownloadDir)) {
    bbcDownloadDir = defaults.bbcDownloadDir;
  }

  return {
    timeFormat,
    rteDownloadDir,
    bbcDownloadDir,
    episodeNameMode,
    cueAutoGenerate
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
  const outputDir = sourceType === "bbc" ? settings.bbcDownloadDir : settings.rteDownloadDir;
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function sanitizeDirName(name) {
  return String(name || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
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

function extractDateFromEpisodeTitle(input) {
  const text = String(input || "").trim();
  const match = text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/i);
  return match ? match[0] : "";
}

function buildEpisodeFileTitle({ episodeTitle, programTitle, clipId }) {
  const settings = readSettings();
  const safeEpisodeTitle = String(episodeTitle || "").trim();
  const safeProgramTitle = String(programTitle || "").trim();
  const dateText = extractDateFromEpisodeTitle(safeEpisodeTitle);

  if (settings.episodeNameMode === "full-title") {
    return safeEpisodeTitle || (safeProgramTitle ? `${safeProgramTitle} ${clipId}` : `rte-episode-${clipId}`);
  }

  if (dateText) {
    return dateText;
  }

  return safeEpisodeTitle || (safeProgramTitle ? `${safeProgramTitle} ${clipId}` : `rte-episode-${clipId}`);
}

async function downloadFromManifest({ manifestUrl, sourceUrl, title, programTitle, onProgress, sourceType = "rte", forceDownload = false }) {
  const baseOutputDir = ensureOutputDir(sourceType);
  const programFolder = sanitizeDirName(programTitle) || "misc";
  const outputDir = path.join(baseOutputDir, programFolder);
  fs.mkdirSync(outputDir, { recursive: true });
  const result = await runYtDlpDownload({
    manifestUrl,
    sourceUrl,
    title,
    outputDir,
    onProgress,
    forceDownload
  });

  return {
    ...result,
    outputDir
  };
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

async function downloadEpisodeByClip({ clipId, title, episodeUrl, programTitle, onProgress, forceDownload = false }) {
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
    onProgress,
    sourceType: "rte",
    forceDownload
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
    cue,
    ...download
  };
}

async function downloadBbcEpisode({ episodeUrl, title, programTitle, onProgress, forceDownload = false }) {
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
    onProgress,
    sourceType: "bbc",
    forceDownload
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
    cue,
    ...download
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

  return {
    ...info,
    cue,
    ...download
  };
});

ipcMain.handle("download-bbc-url", async (event, { pageUrl, progressToken, title, programTitle, forceDownload = false }) => {
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
  const sourceType = String(payload.sourceType || "rte").toLowerCase() === "bbc" ? "bbc" : "rte";
  const defaultPath = sourceType === "bbc" ? current.bbcDownloadDir : current.rteDownloadDir;
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

app.whenReady().then(() => {
  readSettings();

  scheduler = createSchedulerStore({
    app,
    getProgramSummary,
    getProgramEpisodes,
    runEpisodeDownload: async (episode) =>
      downloadEpisodeByClip({
        clipId: episode.clipId,
        title: episode.title,
        programTitle: episode.programTitle,
        episodeUrl: episode.episodeUrl
      })
  });

  bbcScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "bbc"),
    getProgramSummary: async (programUrl) => getBbcProgramSummary(programUrl, runYtDlpJson),
    getProgramEpisodes: async (programUrl, page) => getBbcProgramEpisodes(programUrl, runYtDlpJson, page),
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
