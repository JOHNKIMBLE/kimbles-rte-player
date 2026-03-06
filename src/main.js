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
const { runYtDlpDownload } = require("./lib/downloader");
const { createSchedulerStore } = require("./lib/scheduler");

let scheduler;
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

function getDefaultDownloadDir() {
  return path.join(app.getPath("downloads"), "RTE");
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
    episodeNameMode: "date-only"
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
  let downloadDir = typeof raw.downloadDir === "string" && raw.downloadDir.trim()
    ? raw.downloadDir.trim()
    : defaults.downloadDir;

  if (isEphemeralTempDataPath(downloadDir)) {
    downloadDir = defaults.downloadDir;
  }

  return {
    timeFormat,
    downloadDir,
    episodeNameMode
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

function ensureOutputDir() {
  const outputDir = readSettings().downloadDir;
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
  } catch {
    return "";
  }
  return "";
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

async function downloadFromManifest({ manifestUrl, title, programTitle, onProgress }) {
  const baseOutputDir = ensureOutputDir();
  const programFolder = sanitizeDirName(programTitle) || "misc";
  const outputDir = path.join(baseOutputDir, programFolder);
  fs.mkdirSync(outputDir, { recursive: true });
  const result = await runYtDlpDownload({
    manifestUrl,
    title,
    outputDir,
    onProgress
  });

  return {
    ...result,
    outputDir
  };
}

async function downloadEpisodeByClip({ clipId, title, episodeUrl, programTitle, onProgress }) {
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
    onProgress
  });

  return {
    clipId: String(clipId),
    episodeUrl: episodeUrl || "",
    title: resolvedTitle,
    playlistApiUrl: playlist.apiUrl,
    m3u8Url: playlist.m3u8Url,
    ...download
  };
}

ipcMain.handle("download-rte-url", async (event, { pageUrl, progressToken }) => {
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
    }
  });

  return {
    ...info,
    ...download
  };
});

ipcMain.handle("download-rte-episode", async (event, payload) => {
  const safePayload = payload || {};
  return downloadEpisodeByClip({
    ...safePayload,
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

ipcMain.handle("settings-pick-download-dir", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const current = readSettings();
  const response = await dialog.showOpenDialog(window, {
    title: "Choose Download Directory",
    defaultPath: current.downloadDir,
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

  scheduler.start();
  scheduler.runAll().catch(() => {});

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
});
