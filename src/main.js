const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
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
  getRteDiscovery,
  searchPrograms,
  configure: configureRte
} = require("./lib/rte");
const {
  getBbcDiscovery,
  getBbcEpisodePlaylist,
  getBbcLiveStations,
  getBbcProgramEpisodes,
  getBbcProgramSummary,
  normalizeBbcProgramUrl,
  searchBbcPrograms
} = require("./lib/bbc");
const {
  getWwfDiscovery,
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
  getNtsDiscovery,
  getNtsEpisodeInfo,
  getNtsProgramSummary,
  getNtsProgramEpisodes,
  searchNtsPrograms,
  getNtsEpisodePlaylist,
  getNtsLiveNow,
  LIVE_STATIONS: NTS_LIVE_STATIONS,
  normalizeNtsProgramUrl,
  configure: configureNts
} = require("./lib/nts");
const {
  LIVE_STATIONS: FIP_LIVE_STATIONS,
  getFipNowPlaying,
  searchFipPrograms,
  getFipDiscovery,
  getFipProgramSummary,
  getFipProgramEpisodes,
  getFipEpisodeStream,
  getFipEpisodeTracklist,
  normalizeFipProgramUrl,
  configure: configureFip
} = require("./lib/fip");
const {
  LIVE_STATIONS: KEXP_LIVE_STATIONS,
  normalizeKexpProgramUrl,
  getKexpNowPlaying,
  searchKexpPrograms,
  getKexpDiscovery,
  getKexpProgramSummary,
  getKexpProgramEpisodes,
  getKexpEpisodeTracklist,
  getKexpSchedule,
  getKexpEpisodeStream,
  searchKexpExtendedPrograms,
  getKexpExtendedDiscovery,
  getKexpExtendedProgramSummary,
  getKexpExtendedEpisodes,
  getKexpExtendedEpisodeStream,
  getKexpExtendedEpisodeTracklist
} = require("./lib/kexp");
const { runYtDlpDownload, runYtDlpJson, spawnYtDlpPipe, resolveYtDlpCommand } = require("./lib/downloader");
const { createSchedulerStore } = require("./lib/scheduler");
const { buildDownloadTarget, sanitizePathSegment } = require("./lib/path-format");
const { createDownloadQueue } = require("./lib/download-queue");
const { applyId3Tags } = require("./lib/tags");
const { enforceDownloadRules, isLikelyRerun } = require("./lib/download-rules");
const { listProgramFeedFiles, writeProgramFeedFiles, rebuildProgramFeedsFromSchedules } = require("./lib/feeds");
const { readCueChaptersForAudio } = require("./lib/cue-reader");
const { runCueTaskInChild } = require("./lib/cue-worker-client");
const {
  fetchWithGenericWebhookAssert
} = require("./lib/outbound-http");
const {
  hostMatchesAnySuffix,
  hostMatchesSuffix
} = require("./lib/url-safety");
const {
  buildMetadataIndex,
  buildScheduleMetadataDocs,
  buildFeedMetadataDocs,
  buildHistoryMetadataDocs,
  sortMetadataDocs,
  searchMetadataIndex,
  discoverMetadataIndex,
  buildCollectionRecommendations,
  buildSubscriptionDiscoveryRecommendations,
  buildForYouRecommendations
} = require("./lib/metadata-index");
const { buildEntityGraph, searchEntityGraph, getEntityGraphEntity } = require("./lib/entity-graph");
const { createCollectionsStore } = require("./lib/collections-store");
const { createMetadataHarvestStore } = require("./lib/metadata-harvest-store");
const {
  MATERIALIZED_METADATA_SCHEMA_VERSION,
  createMaterializedMetadataStore
} = require("./lib/materialized-metadata-store");
const {
  deriveHarvestSearchTerms,
  harvestMetadataDocs,
  mergeHarvestDocs,
  planMetadataHarvest
} = require("./lib/metadata-harvester");
const {
  createDefaultSettings,
  normalizeSettings: normalizeSharedSettings,
  shouldGenerateEmbeddedChapters,
  shouldWriteCueSidecar
} = require("./lib/app-settings");
const { collectRuntimeDiagnostics } = require("./lib/runtime-diagnostics");
const { runVendorBootstrap } = require("./lib/vendor-bootstrap");

let scheduler;
let bbcScheduler;
let wwfScheduler;
let ntsScheduler;
let fipScheduler;
let kexpScheduler;
let appSettings = null;
const downloadQueue = createDownloadQueue(
  () => readSettings().maxConcurrentDownloads || 2,
  {
    getStoragePath: () => path.join(app.getPath("userData"), "download-queue.json"),
    restoreTask: (persisted) => restoreDownloadQueueTask(persisted)
  }
);

const { createDiskCache } = require("./lib/disk-cache");
const { createDownloadHistory } = require("./lib/download-history");
const { createRecentErrorsLog } = require("./lib/recent-errors-log");
let downloadHistory = null;
let recentErrorsLog = null;
let metadataHarvestStore = null;
let materializedMetadataStore = null;
let collectionsStore = null;
let materializedMetadataCache = null;
let materializedMetadataDirty = true;
let materializedMetadataRefreshPromise = null;
let metadataHarvestRefreshPromise = null;
const METADATA_HARVEST_POLL_MS = 1000 * 60 * 5;

const streamProxyTokens = new Map();
const ytDlpPipeTokens = new Map();
const wwfTempAudioTokens = new Map();
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
    if ((u.pathname !== "/stream" && u.pathname !== "/ytdlp-pipe" && u.pathname !== "/temp-audio") || req.method !== "GET") {
      res.writeHead(404);
      res.end();
      return;
    }
    // yt-dlp pipe streaming (legacy, kept for other sources)
    if (u.pathname === "/ytdlp-pipe") {
      const pipeToken = u.searchParams.get("token") || "";
      const pipeEntry = ytDlpPipeTokens.get(pipeToken);
      if (!pipeEntry) { res.writeHead(404); res.end(); return; }
      let child;
      try {
        child = spawnYtDlpPipe(pipeEntry.url);
      } catch {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "yt-dlp pipe failed" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Transfer-Encoding": "chunked" });
      child.stdout.pipe(res);
      res.on("close", () => { try { child.kill(); } catch {} });
      child.on("error", () => {
        try {
          if (!res.headersSent) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "yt-dlp pipe failed" }));
          } else {
            res.end();
          }
        } catch {}
      });
      return;
    }
    // Seekable temp-file serving (WWF episodes downloaded to tmpdir)
    if (u.pathname === "/temp-audio") {
      const tempToken = u.searchParams.get("token") || "";
      const tempEntry = wwfTempAudioTokens.get(tempToken);
      if (!tempEntry || !fs.existsSync(tempEntry.path)) { res.writeHead(404); res.end(); return; }
      const stat = fs.statSync(tempEntry.path);
      const fileSize = stat.size;
      const range = req.headers.range;
      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "audio/mpeg"
        });
        fs.createReadStream(tempEntry.path, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Accept-Ranges": "bytes",
          "Content-Type": "audio/mpeg"
        });
        fs.createReadStream(tempEntry.path).pipe(res);
      }
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
      for (const [t, e] of ytDlpPipeTokens.entries()) {
        if (now - (e.createdAt || 0) > STREAM_PROXY_TTL_MS) ytDlpPipeTokens.delete(t);
      }
      for (const [t, e] of wwfTempAudioTokens.entries()) {
        if (now - (e.createdAt || 0) > STREAM_PROXY_TTL_MS) {
          wwfTempAudioTokens.delete(t);
          try { if (e.path) fs.unlinkSync(e.path); } catch {}
        }
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

async function registerYtDlpPipeUrl(sourceUrl) {
  await createStreamProxyServer();
  const token = crypto.randomBytes(12).toString("hex");
  ytDlpPipeTokens.set(token, { url: sourceUrl, createdAt: Date.now() });
  return `${streamProxyBaseUrl}/ytdlp-pipe?token=${token}`;
}

function getDefaultDownloadDir() {
  return app.getPath("downloads");
}

function broadcastGlobalEvent(payload) {
  const event = payload && typeof payload === "object" ? payload : {};
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("global-event", event);
    } catch {}
  }
}

function feedDataDirFor(sourceType) {
  if (sourceType === "bbc") return path.join(app.getPath("userData"), "bbc");
  if (sourceType === "wwf") return path.join(app.getPath("userData"), "wwf");
  if (sourceType === "nts") return path.join(app.getPath("userData"), "nts");
  if (sourceType === "fip") return path.join(app.getPath("userData"), "fip");
  if (sourceType === "kexp") return path.join(app.getPath("userData"), "kexp");
  return app.getPath("userData");
}

function getFeedSourceConfigs() {
  return [
    { sourceType: "rte", dataDir: feedDataDirFor("rte"), publicBasePath: "" },
    { sourceType: "bbc", dataDir: feedDataDirFor("bbc"), publicBasePath: "" },
    { sourceType: "wwf", dataDir: feedDataDirFor("wwf"), publicBasePath: "" },
    { sourceType: "nts", dataDir: feedDataDirFor("nts"), publicBasePath: "" },
    { sourceType: "fip", dataDir: feedDataDirFor("fip"), publicBasePath: "" },
    { sourceType: "kexp", dataDir: feedDataDirFor("kexp"), publicBasePath: "" }
  ];
}

function listAllProgramFeeds() {
  return getFeedSourceConfigs()
    .flatMap((config) => listProgramFeedFiles(config))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
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
  return createDefaultSettings(getDefaultDownloadDir());
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getDownloadArchivePath() {
  return path.join(app.getPath("userData"), "download-archive.txt");
}

function normalizeSettings(input) {
  const defaults = getDefaultSettings();
  const normalized = normalizeSharedSettings(input, {
    defaultDownloadDir: defaults.downloadDir
  });
  let downloadDir = normalized.downloadDir;
  if (!downloadDir || isEphemeralTempDataPath(downloadDir)) {
    downloadDir = defaults.downloadDir;
  }
  return {
    ...normalized,
    downloadDir
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

function ensureOutputDir(_sourceType = "rte") {
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
    if (hostMatchesAnySuffix(parsed.hostname, ["bbc.co.uk", "bbc.com"])) {
      return "BBC";
    }
    if (hostMatchesSuffix(parsed.hostname, "worldwidefm.net")) {
      return "Worldwide FM";
    }
    if (hostMatchesSuffix(parsed.hostname, "nts.live")) {
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
    if (!hostMatchesAnySuffix(parsed.hostname, ["bbc.co.uk", "bbc.com"])) {
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

function normalizeMetadataList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/,\s*/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeMetadataText(value) {
  return String(value || "").trim();
}

function parseTrackStartSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  const text = String(value || "").trim();
  if (!text) {
    return undefined;
  }
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return Math.max(0, Number(text));
  }
  const match = text.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return Math.max(0, hours * 3600 + minutes * 60 + seconds);
}

function normalizeCueTracks(tracks = [], options = {}) {
  const offsetSeconds = Number(options.offsetSeconds || 0) || 0;
  return (Array.isArray(tracks) ? tracks : [])
    .map((track, index) => {
      const title = String(track?.title || "").trim();
      const artist = String(track?.artist || "").trim();
      if (!title && !artist) {
        return null;
      }
      const startSeconds = parseTrackStartSeconds(track?.startSeconds);
      return {
        title: title || `Track ${index + 1}`,
        artist,
        startSeconds: Number.isFinite(startSeconds) ? Math.max(0, startSeconds + offsetSeconds) : undefined
      };
    })
    .filter(Boolean);
}

async function getPrefetchedCueTracks({ sourceType = "", episodeUrl = "", tracklistUrl = "", fileStartOffset = 0 } = {}) {
  const safeSourceType = String(sourceType || "").trim().toLowerCase();
  const safeEpisodeUrl = String(episodeUrl || "").trim();
  if (!safeSourceType || !safeEpisodeUrl) {
    return [];
  }
  try {
    if (safeSourceType === "rte") {
      const payload = await getEpisodePlaylist(safeEpisodeUrl);
      return normalizeCueTracks(payload?.tracks);
    }
    if (safeSourceType === "bbc") {
      const payload = await getBbcEpisodePlaylist(safeEpisodeUrl);
      return normalizeCueTracks(payload?.tracks);
    }
    if (safeSourceType === "wwf") {
      const payload = await getWwfEpisodePlaylist(safeEpisodeUrl);
      return normalizeCueTracks(payload?.tracks);
    }
    if (safeSourceType === "nts") {
      const payload = await getNtsEpisodePlaylist(safeEpisodeUrl);
      return normalizeCueTracks(payload?.tracks);
    }
    if (safeSourceType === "fip") {
      const tracks = await getFipEpisodeTracklist(safeEpisodeUrl);
      return normalizeCueTracks(tracks);
    }
    if (safeSourceType === "kexp") {
      const tracks = await getKexpEpisodeTracklist(safeEpisodeUrl);
      return normalizeCueTracks(tracks, { offsetSeconds: Number(fileStartOffset || 0) || 0 });
    }
  } catch {}
  if (tracklistUrl) {
    return [];
  }
  return [];
}

function buildMetadata(options = {}) {
  return {
    description: normalizeMetadataText(options.description),
    location: normalizeMetadataText(options.location),
    hosts: normalizeMetadataList(options.hosts),
    genres: normalizeMetadataList(options.genres)
  };
}

function createPersistentDownloadPayload({ job, postProcess = {} }) {
  const metadata = buildMetadata(postProcess);
  return {
    type: "manifest-download-v1",
    job,
    postProcess: {
      sourceType: String(postProcess.sourceType || job.sourceType || ""),
      episodeTitle: String(postProcess.episodeTitle || ""),
      programTitle: String(postProcess.programTitle || ""),
      publishedTime: String(postProcess.publishedTime || ""),
      sourceUrl: String(postProcess.sourceUrl || job.sourceUrl || ""),
      artworkUrl: String(postProcess.artworkUrl || ""),
      episodeUrl: String(postProcess.episodeUrl || job.episodeUrl || ""),
      clipId: String(postProcess.clipId || ""),
      description: metadata.description,
      location: metadata.location,
      hosts: metadata.hosts,
      genres: metadata.genres,
      tracklistUrl: String(postProcess.tracklistUrl || "")
    }
  };
}

function appendDownloadHistoryEntry(entry) {
  try {
    if (downloadHistory) {
      downloadHistory.append(entry);
      enforceDownloadRules({
        downloadHistory,
        settings: readSettings(),
        sourceType: entry?.sourceType,
        programTitle: entry?.programTitle
      });
    }
    patchMaterializedHistory();
    broadcastGlobalEvent({
      type: "download.history.updated",
      source: entry.sourceType,
      programTitle: entry.programTitle,
      episodeTitle: entry.episodeTitle
    });
  } catch {}
}

function appendDownloadHistoryFromPayload(payload, result) {
  if (!payload || payload.type !== "manifest-download-v1" || result?.existing) {
    return;
  }
  const job = payload.job || {};
  appendDownloadHistoryEntry({
    sourceType: String(job.sourceType || "rte"),
    programTitle: String(payload.postProcess?.programTitle || ""),
    episodeTitle: String(payload.postProcess?.episodeTitle || job.title || ""),
    filePath: result?.fileName ? path.join(result.outputDir || job.outputDir || "", result.fileName) : "",
    outputDir: result?.outputDir || job.outputDir || "",
    fileName: result?.fileName || "",
    episodeUrl: String(payload.postProcess?.episodeUrl || job.episodeUrl || job.sourceUrl || ""),
    sourceUrl: String(payload.postProcess?.sourceUrl || job.sourceUrl || ""),
    artworkUrl: String(payload.postProcess?.artworkUrl || ""),
    clipId: String(payload.postProcess?.clipId || ""),
    publishedTime: String(payload.postProcess?.publishedTime || ""),
    tracklistUrl: String(payload.postProcess?.tracklistUrl || ""),
    fileStartOffset: Number(payload.postProcess?.fileStartOffset || 0),
    description: String(payload.postProcess?.description || ""),
    location: String(payload.postProcess?.location || ""),
    hosts: normalizeMetadataList(payload.postProcess?.hosts),
    genres: normalizeMetadataList(payload.postProcess?.genres)
  });
}

function buildLibraryMetadataDataset() {
  return {
    schedulesBySource: {
      rte: scheduler?.list?.() || [],
      bbc: bbcScheduler?.list?.() || [],
      wwf: wwfScheduler?.list?.() || [],
      nts: ntsScheduler?.list?.() || [],
      fip: fipScheduler?.list?.() || [],
      kexp: kexpScheduler?.list?.() || []
    },
    feeds: listAllProgramFeeds(),
    history: downloadHistory ? downloadHistory.list() : [],
    harvested: metadataHarvestStore ? metadataHarvestStore.list() : []
  };
}

function createEmptyMaterializedMetadataSnapshot() {
  return {
    schemaVersion: MATERIALIZED_METADATA_SCHEMA_VERSION,
    updatedAt: "",
    index: [],
    graph: {
      entities: [],
      relations: [],
      metrics: {
        entityCount: 0,
        relationCount: 0,
        sourceCount: 0
      }
    }
  };
}

function getMaterializedMetadataSnapshot() {
  if (materializedMetadataCache) {
    return materializedMetadataCache;
  }
  if (!materializedMetadataStore) {
    materializedMetadataCache = createEmptyMaterializedMetadataSnapshot();
    return materializedMetadataCache;
  }
  const stored = materializedMetadataStore.get();
  if (!materializedMetadataStore.isCompatible(stored)) {
    materializedMetadataCache = createEmptyMaterializedMetadataSnapshot();
    materializedMetadataDirty = true;
    return materializedMetadataCache;
  }
  materializedMetadataCache = stored;
  return materializedMetadataCache;
}

function buildMaterializedMetadataSnapshot() {
  const index = buildMetadataIndex(buildLibraryMetadataDataset());
  const graph = buildEntityGraph(index);
  return {
    schemaVersion: MATERIALIZED_METADATA_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    index,
    graph
  };
}

function replaceMaterializedMetadataSections(sectionKinds, nextDocs) {
  if (!materializedMetadataStore) {
    markMaterializedMetadataDirty({ refreshInBackground: true });
    return null;
  }
  const snapshot = getMaterializedMetadataSnapshot();
  const removeKinds = new Set((Array.isArray(sectionKinds) ? sectionKinds : [sectionKinds]).map((kind) => String(kind || "").trim().toLowerCase()).filter(Boolean));
  const filtered = (Array.isArray(snapshot?.index) ? snapshot.index : []).filter((doc) => !removeKinds.has(String(doc?.kind || "").trim().toLowerCase()));
  const index = sortMetadataDocs([
    ...filtered,
    ...(Array.isArray(nextDocs) ? nextDocs : [])
  ]);
  const graph = buildEntityGraph(index);
  const updated = {
    schemaVersion: MATERIALIZED_METADATA_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    index,
    graph
  };
  materializedMetadataStore.replace(updated);
  materializedMetadataCache = updated;
  materializedMetadataDirty = false;
  return updated;
}

function patchMaterializedSubscriptions() {
  return replaceMaterializedMetadataSections("subscription", buildScheduleMetadataDocs(buildLibraryMetadataDataset().schedulesBySource));
}

function patchMaterializedFeeds() {
  return replaceMaterializedMetadataSections("feed", buildFeedMetadataDocs(listAllProgramFeeds()));
}

function patchMaterializedHistory() {
  return replaceMaterializedMetadataSections("history", buildHistoryMetadataDocs(downloadHistory ? downloadHistory.list() : []));
}

function markMaterializedMetadataDirty(options = {}) {
  materializedMetadataDirty = true;
  if (options.refreshInBackground) {
    void refreshMaterializedMetadataSnapshot().catch(() => {});
  }
}

async function refreshMaterializedMetadataSnapshot(_options = {}) {
  if (materializedMetadataRefreshPromise) {
    return materializedMetadataRefreshPromise;
  }
  materializedMetadataRefreshPromise = Promise.resolve().then(() => {
    const snapshot = buildMaterializedMetadataSnapshot();
    if (materializedMetadataStore) {
      materializedMetadataStore.replace(snapshot);
    }
    materializedMetadataCache = snapshot;
    materializedMetadataDirty = false;
    return snapshot;
  }).finally(() => {
    materializedMetadataRefreshPromise = null;
  });
  return materializedMetadataRefreshPromise;
}

async function ensureMaterializedMetadata(options = {}) {
  const forceRebuild = Boolean(options.forceRebuild);
  const allowStale = options.allowStale !== false;
  const refreshInBackground = options.refreshInBackground !== false;
  const snapshot = getMaterializedMetadataSnapshot();
  const hasMaterializedData = Array.isArray(snapshot?.index) && snapshot.index.length > 0;
  if (!forceRebuild && !materializedMetadataDirty && hasMaterializedData) {
    return snapshot;
  }
  if (!forceRebuild && allowStale && hasMaterializedData) {
    if (refreshInBackground) {
      void refreshMaterializedMetadataSnapshot().catch(() => {});
    }
    return snapshot;
  }
  return refreshMaterializedMetadataSnapshot({ forceRebuild: true });
}

function getMetadataHarvestSources() {
  return [
    {
      sourceType: "rte",
      getDiscovery: () => getRteDiscovery(12),
      search: (term) => searchPrograms(term),
      getSummary: (programUrl) => getProgramSummary(programUrl),
      getEpisodes: (programUrl, page = 1) => getProgramEpisodes(programUrl, page),
      perSearchLimit: 6,
      summaryLimit: 8,
      harvestCadenceMs: 1000 * 60 * 60 * 4,
      maxEpisodePages: 3
    },
    {
      sourceType: "bbc",
      getDiscovery: () => getBbcDiscovery(12),
      search: (term) => searchBbcPrograms(term, runYtDlpJson),
      getSummary: (programUrl) => getBbcProgramSummary(programUrl, runYtDlpJson, { includeSchedule: false }),
      getEpisodes: (programUrl, page = 1) => getBbcProgramEpisodes(programUrl, runYtDlpJson, page),
      perSearchLimit: 6,
      summaryLimit: 8,
      harvestCadenceMs: 1000 * 60 * 60 * 6,
      maxEpisodePages: 3
    },
    {
      sourceType: "wwf",
      getDiscovery: () => getWwfDiscovery(12),
      search: (term) => searchWwfPrograms(term),
      getSummary: (programUrl) => getWwfProgramSummary(programUrl),
      getEpisodes: (programUrl, page = 1) => getWwfProgramEpisodes(programUrl, page),
      perSearchLimit: 6,
      summaryLimit: 8,
      harvestCadenceMs: 1000 * 60 * 60 * 4,
      maxEpisodePages: 4
    },
    {
      sourceType: "nts",
      getDiscovery: () => getNtsDiscovery(12),
      search: (term) => searchNtsPrograms(term, { sort: "recent" }),
      getSummary: (programUrl) => getNtsProgramSummary(programUrl),
      getEpisodes: (programUrl, page = 1) => getNtsProgramEpisodes(programUrl, page),
      perSearchLimit: 6,
      summaryLimit: 8,
      harvestCadenceMs: 1000 * 60 * 60 * 4,
      maxEpisodePages: 4
    },
    {
      sourceType: "fip",
      getDiscovery: () => getFipDiscovery(12),
      search: (term) => searchFipPrograms(term),
      getSummary: (programUrl) => getFipProgramSummary(programUrl),
      getEpisodes: (programUrl, page = 1) => getFipProgramEpisodes(programUrl, page),
      perSearchLimit: 6,
      summaryLimit: 8,
      harvestCadenceMs: 1000 * 60 * 60 * 8,
      maxEpisodePages: 3
    },
    {
      sourceType: "kexp",
      getDiscovery: () => getKexpDiscovery(12),
      search: (term) => searchKexpPrograms(term),
      getSummary: (programUrl) => getKexpProgramSummary(programUrl),
      getEpisodes: (programUrl, page = 1) => getKexpProgramEpisodes(programUrl, page),
      perSearchLimit: 6,
      summaryLimit: 8,
      harvestCadenceMs: 1000 * 60 * 60 * 6,
      maxEpisodePages: 3
    }
  ];
}

async function refreshMetadataHarvestCache(force = false) {
  if (!metadataHarvestStore) {
    return [];
  }
  if (metadataHarvestRefreshPromise) {
    return metadataHarvestRefreshPromise;
  }
  metadataHarvestRefreshPromise = Promise.resolve().then(async () => {
    const existing = metadataHarvestStore.list();
    const priorState = metadataHarvestStore.getState();
    const localSnapshot = await ensureMaterializedMetadata({
      allowStale: true,
      refreshInBackground: false
    });
    const localIndex = Array.isArray(localSnapshot?.index) ? localSnapshot.index : buildMetadataIndex(buildLibraryMetadataDataset());
    const harvestPlan = planMetadataHarvest(
      getMetadataHarvestSources(),
      priorState,
      force,
      Date.now()
    );
    if (!force && existing.length && !harvestPlan.plannedSources.length) {
      return existing;
    }
    const docs = await harvestMetadataDocs({
      sources: harvestPlan.plannedSources,
      searchTerms: deriveHarvestSearchTerms(localIndex)
    });
    const merged = mergeHarvestDocs(existing, docs);
    metadataHarvestStore.replace(merged, new Date().toISOString(), harvestPlan.nextState);
    patchMaterializedFeeds();
    return merged;
  }).finally(() => {
    metadataHarvestRefreshPromise = null;
  });
  return metadataHarvestRefreshPromise;
}

async function refreshMetadataHarvestSource(sourceType, options = {}) {
  if (!metadataHarvestStore) {
    return { ok: false, sourceType: "", count: 0, updatedAt: "" };
  }
  const safeSourceType = String(sourceType || "").trim().toLowerCase();
  if (!safeSourceType) {
    throw new Error("Source type is required.");
  }
  if (metadataHarvestRefreshPromise) {
    await metadataHarvestRefreshPromise.catch(() => {});
  }
  metadataHarvestRefreshPromise = Promise.resolve().then(async () => {
    const source = getMetadataHarvestSources().find((entry) => String(entry?.sourceType || "").trim().toLowerCase() === safeSourceType);
    if (!source) {
      throw new Error(`Unknown source: ${safeSourceType}`);
    }
    const existing = metadataHarvestStore.list();
    const priorState = metadataHarvestStore.getState();
    const localSnapshot = await ensureMaterializedMetadata({
      allowStale: true,
      refreshInBackground: false
    });
    const localIndex = Array.isArray(localSnapshot?.index) ? localSnapshot.index : buildMetadataIndex(buildLibraryMetadataDataset());
    const current = priorState?.sources?.[safeSourceType] && typeof priorState.sources[safeSourceType] === "object"
      ? { ...priorState.sources[safeSourceType] }
      : {};
    const maxEpisodePages = Math.max(1, Number(source.maxEpisodePages || current.maxEpisodePages || 3) || 3);
    const requestedPages = options?.deeper
      ? maxEpisodePages
      : Math.max(1, Math.min(maxEpisodePages, Number(current.nextEpisodePages || current.lastEpisodePages || 1) || 1));
    const docs = await harvestMetadataDocs({
      sources: [{ ...source, episodePages: requestedPages }],
      searchTerms: deriveHarvestSearchTerms(localIndex)
    });
    const merged = mergeHarvestDocs(existing, docs);
    const cadenceMs = Math.max(1000 * 60 * 15, Number(source.harvestCadenceMs || current.harvestCadenceMs || 1000 * 60 * 60 * 6) || 1000 * 60 * 60 * 6);
    const updatedState = {
      ...(priorState && typeof priorState === "object" ? priorState : { sources: {} }),
      sources: {
        ...((priorState && priorState.sources && typeof priorState.sources === "object") ? priorState.sources : {}),
        [safeSourceType]: {
          ...current,
          lastRunAt: new Date().toISOString(),
          lastEpisodePages: requestedPages,
          nextEpisodePages: requestedPages >= maxEpisodePages ? 1 : requestedPages + 1,
          maxEpisodePages,
          harvestCadenceMs: cadenceMs,
          nextDueAt: new Date(Date.now() + cadenceMs).toISOString()
        }
      }
    };
    metadataHarvestStore.replace(merged, new Date().toISOString(), updatedState);
    patchMaterializedFeeds();
    return {
      ok: true,
      sourceType: safeSourceType,
      count: docs.length,
      updatedAt: metadataHarvestStore.getUpdatedAt()
    };
  }).finally(() => {
    metadataHarvestRefreshPromise = null;
  });
  return metadataHarvestRefreshPromise;
}

async function rebuildDownloadedFileMetadata(payload = {}) {
  const outputDir = String(payload.outputDir || "").trim();
  const fileName = String(payload.fileName || "").trim();
  if (!outputDir || !fileName) {
    throw new Error("A downloaded file is required.");
  }

  const audioPath = path.join(outputDir, fileName);
  if (!fs.existsSync(audioPath)) {
    throw new Error("Downloaded file not found.");
  }

  const sourceType = String(payload.sourceType || "rte").trim().toLowerCase();
  const cue = await maybeGenerateCue({
    force: true,
    writeCueFile: false,
    revealErrors: false,
    sourceType,
    episodeUrl: String(payload.episodeUrl || "").trim(),
    episodeTitle: String(payload.episodeTitle || fileName).trim(),
    programTitle: String(payload.programTitle || "").trim(),
    tracklistUrl: String(payload.tracklistUrl || "").trim(),
    fileStartOffset: Number(payload.fileStartOffset || 0),
    downloadResult: { outputDir, fileName }
  });

  const tags = await applyId3Tags({
    audioPath,
    title: String(payload.episodeTitle || fileName).trim(),
    programTitle: String(payload.programTitle || "").trim(),
    sourceType,
    publishedTime: String(payload.publishedTime || "").trim(),
    sourceUrl: String(payload.sourceUrl || payload.episodeUrl || "").trim(),
    artworkUrl: String(payload.artworkUrl || "").trim(),
    episodeUrl: String(payload.episodeUrl || "").trim(),
    clipId: String(payload.clipId || "").trim(),
    description: String(payload.description || "").trim(),
    location: String(payload.location || "").trim(),
    hosts: normalizeMetadataList(payload.hosts),
    genres: normalizeMetadataList(payload.genres),
    chapters: Array.isArray(cue?.chapters) ? cue.chapters : [],
    durationSeconds: Number(cue?.durationSeconds || 0),
    cleanupOptions: {
      smartCleanup: readSettings().smartTagCleanup
    }
  });

  return { ok: true, cue, tags };
}

function restoreDownloadQueueTask(payload, _item, options = {}) {
  if (!payload || payload.type !== "manifest-download-v1" || !payload.job) {
    return null;
  }
  if (options.mode === "current-settings") {
    const job = payload.job;
    return {
      run: async () => downloadFromManifest({
        manifestUrl: job.manifestUrl,
        sourceUrl: job.sourceUrl,
        title: payload.postProcess?.episodeTitle || job.title,
        programTitle: payload.postProcess?.programTitle || "",
        publishedTime: payload.postProcess?.publishedTime || "",
        clipId: payload.postProcess?.clipId || "",
        episodeUrl: payload.postProcess?.episodeUrl || job.episodeUrl || job.sourceUrl || "",
        sourceType: payload.postProcess?.sourceType || job.sourceType || "rte",
        forceDownload: true,
        postProcess: payload.postProcess || null
      }),
      meta: {
        label: payload.postProcess?.episodeTitle || payload.job.title,
        sourceType: payload.postProcess?.sourceType || payload.job.sourceType,
        programTitle: payload.postProcess?.programTitle || "",
        episodeUrl: payload.postProcess?.episodeUrl || payload.job.episodeUrl || "",
        description: payload.postProcess?.description || "",
        location: payload.postProcess?.location || "",
        hosts: normalizeMetadataList(payload.postProcess?.hosts),
        genres: normalizeMetadataList(payload.postProcess?.genres),
        persisted: payload
      }
    };
  }
  return {
    run: async (queueTask) => {
      const job = payload.job;
      const result = await runYtDlpDownload({
        manifestUrl: job.manifestUrl,
        sourceUrl: job.sourceUrl,
        title: job.title,
        outputDir: job.outputDir,
        archivePath: job.archivePath,
        registerCancel: queueTask?.registerCancel,
        onProgress: null,
        forceDownload: Boolean(job.forceDownload),
        audioFormat: job.audioFormat,
        audioQuality: job.audioQuality,
        normalizeLoudness: Boolean(job.normalizeLoudness),
        dedupeMode: job.dedupeMode,
        fetchThumbnail: Boolean(job.fetchThumbnail)
      });
      appendDownloadHistoryFromPayload(payload, result);
      const cue = await maybeGenerateCue({
        downloadResult: result,
        sourceType: payload.postProcess?.sourceType || job.sourceType || "rte",
        episodeUrl: payload.postProcess?.episodeUrl || job.episodeUrl || "",
        episodeTitle: payload.postProcess?.episodeTitle || job.title || "",
        programTitle: payload.postProcess?.programTitle || "",
        tracklistUrl: payload.postProcess?.tracklistUrl || "",
        fileStartOffset: Number(payload.postProcess?.fileStartOffset || 0)
      });
      await maybeApplyId3({
        downloadResult: result,
        sourceType: payload.postProcess?.sourceType || job.sourceType || "rte",
        episodeTitle: payload.postProcess?.episodeTitle || job.title || "",
        programTitle: payload.postProcess?.programTitle || "",
        publishedTime: payload.postProcess?.publishedTime || "",
        sourceUrl: payload.postProcess?.sourceUrl || job.sourceUrl || "",
        artworkUrl: payload.postProcess?.artworkUrl || "",
        episodeUrl: payload.postProcess?.episodeUrl || job.episodeUrl || "",
        clipId: payload.postProcess?.clipId || "",
        description: payload.postProcess?.description || "",
        location: payload.postProcess?.location || "",
        hosts: normalizeMetadataList(payload.postProcess?.hosts),
        genres: normalizeMetadataList(payload.postProcess?.genres),
        cue
      });
      return result;
    },
    meta: {
      label: payload.job.title,
      sourceType: payload.job.sourceType,
      programTitle: payload.postProcess?.programTitle || "",
      episodeUrl: payload.postProcess?.episodeUrl || payload.job.episodeUrl || "",
      description: payload.postProcess?.description || "",
      location: payload.postProcess?.location || "",
      hosts: normalizeMetadataList(payload.postProcess?.hosts),
      genres: normalizeMetadataList(payload.postProcess?.genres),
      persisted: payload
    }
  };
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
  forceDownload = false,
  postProcess = null
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
  const persistedPayload = createPersistentDownloadPayload({
    job: {
      manifestUrl,
      sourceUrl,
      title: target.fileStem,
      outputDir,
      archivePath: getDownloadArchivePath(),
      forceDownload: Boolean(forceDownload),
      audioFormat: settings.outputFormat,
      audioQuality: settings.outputQuality,
      normalizeLoudness: settings.normalizeLoudness,
      dedupeMode: settings.dedupeMode,
      fetchThumbnail: Boolean(settings.id3Tagging),
      sourceType,
      episodeUrl: episodeUrl || sourceUrl || manifestUrl
    },
    postProcess: {
      ...(postProcess || {}),
      sourceType,
      episodeTitle: postProcess?.episodeTitle || title,
      programTitle: postProcess?.programTitle || programTitle,
      publishedTime: postProcess?.publishedTime || publishedTime,
      sourceUrl: postProcess?.sourceUrl || sourceUrl || manifestUrl,
      episodeUrl: postProcess?.episodeUrl || episodeUrl || sourceUrl || manifestUrl,
      clipId: postProcess?.clipId || clipId
    }
  });
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
      sourceType,
      programTitle: postProcess?.programTitle || programTitle || "",
      episodeUrl: episodeUrl || sourceUrl || manifestUrl || "",
      description: postProcess?.description || "",
      location: postProcess?.location || "",
      hosts: normalizeMetadataList(postProcess?.hosts),
      genres: normalizeMetadataList(postProcess?.genres),
      persisted: persistedPayload
    }
  );
  appendDownloadHistoryFromPayload(persistedPayload, result);

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
  description = "",
  location = "",
  hosts = [],
  genres = [],
  cue = null
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
      description,
      location,
      hosts,
      genres,
      chapters: Array.isArray(cue?.chapters) ? cue.chapters : [],
      durationSeconds: Number(cue?.durationSeconds || 0),
      cleanupOptions: {
        smartCleanup: settings.smartTagCleanup
      }
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
  fileStartOffset = 0,
  prefetchedTracks = [],
  writeCueFile = false,
  force = false,
  revealErrors = false,
  onProgress = null
}) {
  const settings = readSettings();
  const generateEmbeddedChapters = shouldGenerateEmbeddedChapters(settings, { force });
  const generateCueSidecar = writeCueFile && shouldWriteCueSidecar(settings, { force });
  if (!generateEmbeddedChapters && !generateCueSidecar) {
    return null;
  }

  const outputDir = String(downloadResult?.outputDir || "");
  const fileName = String(downloadResult?.fileName || "");
  if (!outputDir || !fileName) {
    return null;
  }

  const audioPath = path.join(outputDir, fileName);
  const resolvedPrefetchedTracks = normalizeCueTracks(
    Array.isArray(prefetchedTracks) && prefetchedTracks.length
      ? prefetchedTracks
      : await getPrefetchedCueTracks({ sourceType, episodeUrl, tracklistUrl, fileStartOffset }),
    { offsetSeconds: 0 }
  );
  try {
    return await runCueTaskInChild({
      mode: generateCueSidecar ? "generate" : "preview",
      onProgress,
      options: {
      audioPath,
      sourceType,
      episodeUrl,
      episodeTitle,
      programTitle,
      tracklistUrl,
      fileStartOffset: Number(fileStartOffset) || 0,
      prefetchedTracks: resolvedPrefetchedTracks,
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
  fileStartOffset = 0,
  onProgress = null
}) {
  const settings = readSettings();
  const raw = String(sourceType || "rte").toLowerCase();
  const safeSourceType = raw === "bbc" ? "bbc" : raw === "wwf" ? "wwf" : raw === "nts" ? "nts" : raw === "fip" ? "fip" : raw === "kexp" ? "kexp" : "rte";
  const safeOutputDir = String(outputDir || "").trim();
  const safeFileName = String(fileName || "").trim();
  let inputSource;

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
  } else if (safeSourceType === "kexp") {
    const kexpStream = await getKexpEpisodeStream(episodeUrl, runYtDlpJson);
    inputSource = kexpStream.streamUrl;
    if (!fileStartOffset) fileStartOffset = Number(kexpStream.startOffset) || 0;
  } else {
    inputSource = (await resolveBbcEpisodeStream(episodeUrl)).streamUrl;
  }
  const prefetchedTracks = await getPrefetchedCueTracks({
    sourceType: safeSourceType,
    episodeUrl,
    tracklistUrl,
    fileStartOffset
  });

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
      fileStartOffset: Number(fileStartOffset) || 0,
      prefetchedTracks,
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

async function downloadEpisodeByClip({
  clipId,
  title,
  episodeUrl,
  programTitle,
  publishedTime,
  artworkUrl = "",
  description = "",
  location = "",
  hosts = [],
  genres = [],
  onProgress,
  forceDownload = false
}) {
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
    forceDownload,
    postProcess: {
      ...buildMetadata({ description, location, hosts, genres }),
      sourceType: "rte",
      episodeTitle: resolvedTitle,
      programTitle,
      publishedTime: publishedTime || resolvedTitle,
      sourceUrl: episodeUrl,
      artworkUrl: String(artworkUrl || "").trim(),
      episodeUrl,
      clipId: String(clipId || "")
    }
  });
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "rte",
    episodeUrl,
    episodeTitle: resolvedTitle,
    programTitle,
    onProgress
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
    clipId: String(clipId || ""),
    description,
    location,
    hosts,
    genres,
    cue
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

async function downloadBbcEpisode({
  episodeUrl,
  title,
  programTitle,
  publishedTime,
  artworkUrl = "",
  description = "",
  location = "",
  hosts = [],
  genres = [],
  onProgress,
  forceDownload = false
}) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("episodeUrl is required.");
  }

  const resolvedTitle = String(title || "").trim() || inferTitleFromUrl(sourceUrl, "bbc-episode");
  const metadata = buildMetadata({ description, location, hosts, genres });
  const download = await downloadFromManifest({
    sourceUrl,
    manifestUrl: sourceUrl,
    title: resolvedTitle,
    programTitle: programTitle || "BBC",
    publishedTime: publishedTime || resolvedTitle,
    episodeUrl,
    onProgress,
    sourceType: "bbc",
    forceDownload,
    postProcess: {
      ...metadata,
      sourceType: "bbc",
      episodeTitle: resolvedTitle,
      programTitle: programTitle || "BBC",
      publishedTime: publishedTime || resolvedTitle,
      sourceUrl,
      artworkUrl: String(artworkUrl || "").trim(),
      episodeUrl: sourceUrl
    }
  });
  const resolvedArtwork = String(artworkUrl || "").trim() || await resolveBbcArtwork(sourceUrl);
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "bbc",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle,
    onProgress
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "bbc",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "BBC",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl,
    description: metadata.description,
    location: metadata.location,
    hosts: metadata.hosts,
    genres: metadata.genres,
    cue
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

ipcMain.handle("download-rte-url", async (event, { pageUrl, progressToken, description = "", location = "", hosts = [], genres = [], forceDownload = false }) => {
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
    forceDownload: Boolean(forceDownload),
    postProcess: {
      ...buildMetadata({ description, location, hosts, genres }),
      sourceType: "rte",
      episodeTitle: info.title,
      programTitle: inferProgramNameFromUrl(pageUrl),
      publishedTime: info.title,
      sourceUrl: pageUrl,
      artworkUrl: String(info.image || "").trim(),
      episodeUrl: pageUrl,
      clipId: String(info.clipId || "")
    }
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
    clipId: String(info.clipId || ""),
    description,
    location,
    hosts,
    genres,
    cue
  });

  return {
    ...info,
    tags,
    cue,
    ...download
  };
});

ipcMain.handle("download-wwf-url", async (event, { pageUrl, progressToken, title, programTitle, publishedTime, image, description = "", location = "", hosts = [], genres = [], forceDownload = false }) => {
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
    description,
    location,
    hosts,
    genres,
    onProgress: (progress) => {
      if (!progressToken) return;
      event.sender.send("download-progress", { token: progressToken, ...progress });
    },
    forceDownload: Boolean(forceDownload)
  });
});

ipcMain.handle("download-nts-url", async (event, { pageUrl, progressToken, title, programTitle, publishedTime, image, description = "", location = "", hosts = [], genres = [], forceDownload = false }) => {
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
    description,
    location,
    hosts,
    genres,
    onProgress: (progress) => {
      if (!progressToken) return;
      event.sender.send("download-progress", { token: progressToken, ...progress });
    },
    forceDownload: Boolean(forceDownload)
  });
});

ipcMain.handle("download-bbc-url", async (event, { pageUrl, progressToken, title, programTitle, publishedTime, image, description = "", location = "", hosts = [], genres = [], forceDownload = false }) => {
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
        forceDownload: Boolean(forceDownload),
        postProcess: {
          ...buildMetadata({ description, location, hosts, genres }),
          sourceType: "bbc",
          episodeTitle: inferredTitle,
          programTitle: providedProgramTitle || inferProgramNameFromUrl(candidate) || inferProgramNameFromUrl(pageUrl) || "BBC",
          publishedTime: publishedTime || inferredTitle,
          sourceUrl: candidate,
          artworkUrl: String(image || "").trim(),
          episodeUrl: candidate
        }
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
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "bbc",
    episodeUrl: usedUrl,
    episodeTitle: inferredTitle,
    programTitle: providedProgramTitle || inferProgramNameFromUrl(usedUrl) || "BBC",
    onProgress: (progress) => emitRendererProgress(event.sender, progressToken, progress)
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "bbc",
    episodeTitle: inferredTitle,
    programTitle: providedProgramTitle || inferProgramNameFromUrl(usedUrl) || "BBC",
    publishedTime: publishedTime || inferredTitle,
    sourceUrl: usedUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: usedUrl,
    description,
    location,
    hosts,
    genres,
    cue
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
  if (!url) throw new Error("episodeUrl is required.");

  // If already a Mixcloud URL, use it directly; otherwise resolve via WWF episode page
  let sourceUrl;
  if (/mixcloud\.com\//i.test(url)) {
    sourceUrl = url;
  } else {
    const mixcloudUrl = await getWwfEpisodeMixcloudUrl(url).catch(() => "");
    sourceUrl = mixcloudUrl || url;
  }

  if (/mixcloud\.com\//i.test(sourceUrl)) {
    resolveYtDlpCommand();
  }

  // Mixcloud uses AES-128 encrypted HLS — pipe yt-dlp decoded output through the
  // local proxy server for fast playback start (~5-10s). No seek support.
  const streamUrl = await registerYtDlpPipeUrl(sourceUrl);
  return { episodeUrl: url, streamUrl, title: "", image: "" };
}

async function downloadWwfEpisode({
  episodeUrl,
  title,
  programTitle,
  publishedTime,
  artworkUrl = "",
  description = "",
  location = "",
  hosts = [],
  genres = [],
  onProgress,
  forceDownload = false
}) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("episodeUrl is required.");
  }
  const info = await getWwfEpisodeInfo(sourceUrl).catch(() => ({}));
  const resolvedTitle = String(title || info.title || "").trim() || inferTitleFromUrl(sourceUrl, "wwf-episode");
  const ytDlpUrl = (info.mixcloudUrl && info.mixcloudUrl.trim()) || (await getWwfEpisodeMixcloudUrl(sourceUrl).catch(() => "")) || sourceUrl;
  const metadata = buildMetadata({
    description: description || info.description,
    location: location || info.location,
    hosts: normalizeMetadataList(hosts).length ? hosts : info.hosts,
    genres: normalizeMetadataList(genres).length ? genres : info.genres
  });
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
    forceDownload,
    postProcess: {
      ...metadata,
      sourceType: "wwf",
      episodeTitle: resolvedTitle,
      programTitle: programTitle || info.showName || "Worldwide FM",
      publishedTime: publishedTime || resolvedTitle,
      sourceUrl,
      artworkUrl: String(artworkUrl || info.image || "").trim(),
      episodeUrl: sourceUrl,
      clipId: String(info.clipId || sourceUrl)
    }
  });
  const resolvedArtwork = String(artworkUrl || info.image || "").trim();
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "wwf",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle: programTitle || info.showName || "Worldwide FM",
    onProgress
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "wwf",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || info.showName || "Worldwide FM",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl,
    clipId: String(info.clipId || sourceUrl),
    description: metadata.description,
    location: metadata.location,
    hosts: metadata.hosts,
    genres: metadata.genres,
    cue
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
  patchMaterializedSubscriptions();
  return added;
});

ipcMain.handle("wwf-scheduler-remove", async (_event, { scheduleId }) => {
  wwfScheduler.remove(scheduleId);
  patchMaterializedSubscriptions();
  return wwfScheduler.list();
});

ipcMain.handle("wwf-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  wwfScheduler.setEnabled(scheduleId, enabled);
  patchMaterializedSubscriptions();
  return wwfScheduler.list();
});

ipcMain.handle("wwf-scheduler-check-one", async (_event, { scheduleId }) => {
  const data = await wwfScheduler.checkOne(scheduleId);
  patchMaterializedSubscriptions();
  return data;
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
    throw new Error(err?.message || "No playable NTS stream found. Try downloading the episode first.", { cause: err });
  }
}

async function downloadNtsEpisode({
  episodeUrl,
  title,
  programTitle,
  publishedTime,
  artworkUrl = "",
  description = "",
  location = "",
  hosts = [],
  genres = [],
  onProgress,
  forceDownload = false
}) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) throw new Error("episodeUrl is required.");
  const info = await getNtsEpisodeInfo(sourceUrl).catch(() => ({}));
  const resolvedTitle = String(title || info.title || "").trim() || inferTitleFromUrl(sourceUrl, "nts-episode");
  const metadata = buildMetadata({
    description: description || info.description,
    location: location || info.location,
    hosts: normalizeMetadataList(hosts).length ? hosts : info.hosts,
    genres: normalizeMetadataList(genres).length ? genres : info.genres
  });
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
    forceDownload,
    postProcess: {
      ...metadata,
      sourceType: "nts",
      episodeTitle: resolvedTitle,
      programTitle: programTitle || "NTS",
      publishedTime: publishedTime || resolvedTitle,
      sourceUrl,
      artworkUrl: String(artworkUrl || info.image || "").trim(),
      episodeUrl: sourceUrl,
      clipId: String(info.clipId || sourceUrl)
    }
  });
  const resolvedArtwork = String(artworkUrl || info.image || "").trim();
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "nts",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "NTS",
    onProgress
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "nts",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "NTS",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl,
    clipId: String(info.clipId || sourceUrl),
    description: metadata.description,
    location: metadata.location,
    hosts: metadata.hosts,
    genres: metadata.genres,
    cue
  });
  return { episodeUrl: sourceUrl, title: resolvedTitle, ...download, tags, cue };
}

ipcMain.handle("nts-episode-stream", async (_event, { episodeUrl }) => {
  return resolveNtsEpisodeStream(episodeUrl);
});

// ── FIP IPC handlers ──────────────────────────────────────────────────────────

async function downloadFipEpisode({
  episodeUrl,
  title,
  programTitle,
  publishedTime,
  artworkUrl = "",
  description = "",
  location = "",
  hosts = [],
  genres = [],
  onProgress,
  forceDownload = false
}) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) throw new Error("episodeUrl is required.");
  const resolvedTitle = String(title || "").trim() || inferTitleFromUrl(sourceUrl, "fip-episode");
  const metadata = buildMetadata({ description, location, hosts, genres });
  const download = await downloadFromManifest({
    sourceUrl,
    manifestUrl: sourceUrl,
    title: resolvedTitle,
    programTitle: programTitle || "FIP",
    publishedTime: publishedTime || resolvedTitle,
    episodeUrl: sourceUrl,
    clipId: sourceUrl,
    onProgress,
    sourceType: "fip",
    forceDownload,
    postProcess: {
      ...metadata,
      sourceType: "fip",
      episodeTitle: resolvedTitle,
      programTitle: programTitle || "FIP",
      publishedTime: publishedTime || resolvedTitle,
      sourceUrl,
      artworkUrl: String(artworkUrl || "").trim(),
      episodeUrl: sourceUrl,
      clipId: sourceUrl
    }
  });
  const resolvedArtwork = String(artworkUrl || "").trim();
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "fip",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "FIP",
    onProgress
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "fip",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "FIP",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl,
    clipId: sourceUrl,
    description: metadata.description,
    location: metadata.location,
    hosts: metadata.hosts,
    genres: metadata.genres,
    cue
  });
  return { episodeUrl: sourceUrl, title: resolvedTitle, ...download, tags, cue };
}

// ── KEXP IPC handlers ─────────────────────────────────────────────────────────

async function downloadKexpEpisode({
  episodeUrl,
  title,
  programTitle,
  publishedTime,
  artworkUrl = "",
  description = "",
  location = "",
  hosts = [],
  genres = [],
  onProgress,
  forceDownload = false
}) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) throw new Error("episodeUrl is required.");
  const resolvedTitle = String(title || "").trim() || inferTitleFromUrl(sourceUrl, "kexp-episode");
  const metadata = buildMetadata({ description, location, hosts, genres });

  // Resolve direct StreamGuys archive MP3 URL via KEXP get_streaming_url API
  const streamInfo = await getKexpEpisodeStream(sourceUrl, null, publishedTime);
  const sgUrl = streamInfo.streamUrl;
  const sgOffset = Number(streamInfo.startOffset) || 0;

  const download = await downloadFromManifest({
    sourceUrl: sgUrl,
    manifestUrl: sgUrl,
    title: resolvedTitle,
    programTitle: programTitle || "KEXP",
    publishedTime: publishedTime || resolvedTitle,
    episodeUrl: sourceUrl,
    clipId: sourceUrl,
    onProgress,
    sourceType: "kexp",
    forceDownload,
    postProcess: {
      ...metadata,
      sourceType: "kexp",
      episodeTitle: resolvedTitle,
      programTitle: programTitle || "KEXP",
      publishedTime: publishedTime || resolvedTitle,
      sourceUrl,
      artworkUrl: String(artworkUrl || "").trim(),
      episodeUrl: sourceUrl,
      clipId: sourceUrl
    }
  });
  const resolvedArtwork = String(artworkUrl || "").trim();
  const cue = await maybeGenerateCue({
    downloadResult: download,
    sourceType: "kexp",
    episodeUrl: sourceUrl,
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "KEXP",
    fileStartOffset: sgOffset,
    onProgress
  });
  const tags = await maybeApplyId3({
    downloadResult: download,
    sourceType: "kexp",
    episodeTitle: resolvedTitle,
    programTitle: programTitle || "KEXP",
    publishedTime: publishedTime || resolvedTitle,
    sourceUrl,
    artworkUrl: resolvedArtwork,
    episodeUrl: sourceUrl,
    clipId: sourceUrl,
    description: metadata.description,
    location: metadata.location,
    hosts: metadata.hosts,
    genres: metadata.genres,
    cue
  });
  return { episodeUrl: sourceUrl, title: resolvedTitle, ...download, tags, cue };
}

ipcMain.handle("download-kexp-url", async (_event, { pageUrl, progressToken, title, programTitle, publishedTime, image, description = "", location = "", hosts = [], genres = [], forceDownload }) => {
  const onProgress = progressToken
    ? (payload) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send("download-progress", { token: progressToken, ...payload });
      }
    : undefined;
  return downloadKexpEpisode({
    episodeUrl: String(pageUrl || ""),
    title: String(title || "").trim(),
    programTitle: String(programTitle || "").trim(),
    publishedTime: String(publishedTime || "").trim(),
    artworkUrl: String(image || "").trim(),
    description,
    location,
    hosts,
    genres,
    onProgress,
    forceDownload: Boolean(forceDownload)
  });
});

ipcMain.handle("download-kexp-extended-url", async (_event, { pageUrl, progressToken, title, programTitle, publishedTime, image, description = "", location = "", hosts = [], genres = [], forceDownload }) => {
  const onProgress = progressToken
    ? (payload) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send("download-progress", { token: progressToken, ...payload });
      }
    : undefined;
  // Resolve CloudFront stream URL from Splixer mix
  const streamInfo = await getKexpExtendedEpisodeStream(String(pageUrl || ""));
  const streamUrl = streamInfo.streamUrl;
  return downloadKexpEpisode({
    episodeUrl: streamUrl,
    title: String(title || streamInfo.title || "").trim(),
    programTitle: String(programTitle || streamInfo.programTitle || "").trim(),
    publishedTime: String(publishedTime || streamInfo.broadcastedAt || "").trim(),
    artworkUrl: String(image || streamInfo.image || "").trim(),
    description,
    location,
    hosts,
    genres,
    onProgress,
    forceDownload: Boolean(forceDownload)
  });
});

ipcMain.handle("kexp-live-stations", () => {
  return KEXP_LIVE_STATIONS;
});

ipcMain.handle("kexp-live-now", async () => {
  return getKexpNowPlaying();
});

ipcMain.handle("kexp-program-search", async (_event, { query }) => {
  try {
    return await searchKexpPrograms(query || "");
  } catch (e) {
    return { results: [], error: e?.message || "Search unavailable" };
  }
});

ipcMain.handle("kexp-discovery", async (_event, { count }) => {
  try {
    return await getKexpDiscovery(count || 12);
  } catch {
    return [];
  }
});

ipcMain.handle("kexp-program-summary", async (_event, { programUrl }) => {
  return getKexpProgramSummary(programUrl || "");
});

ipcMain.handle("kexp-program-episodes", async (_event, { programUrl, page = 1 }) => {
  return getKexpProgramEpisodes(programUrl, page);
});

ipcMain.handle("kexp-episode-tracklist", async (_event, { episodeUrl }) => {
  const tracks = await getKexpEpisodeTracklist(episodeUrl || "");
  return { tracks };
});

ipcMain.handle("kexp-episode-stream", async (_event, { episodeUrl, startTime }) => {
  const info = await getKexpEpisodeStream(episodeUrl, runYtDlpJson, startTime);
  // Proxy CloudFront URLs through the local stream proxy to avoid CORS in the renderer
  if (info?.streamUrl && /cloudfront\.net/i.test(info.streamUrl)) {
    info.streamUrl = await registerStreamProxyUrl(info.streamUrl);
  }
  return info;
});

ipcMain.handle("kexp-schedule", async () => {
  return getKexpSchedule();
});

// ── KEXP Extended Archive (Splixer) IPC handlers ───────────────────────────

ipcMain.handle("kexp-extended-program-search", async (_event, { query }) => {
  const results = await searchKexpExtendedPrograms(query || "");
  return { results };
});

ipcMain.handle("kexp-extended-discovery", async () => {
  const results = await getKexpExtendedDiscovery(12);
  return { results };
});

ipcMain.handle("kexp-extended-program-summary", async (_event, { programUrl }) => {
  return getKexpExtendedProgramSummary(programUrl || "");
});

ipcMain.handle("kexp-extended-program-episodes", async (_event, { programUrl, page = 1 }) => {
  return getKexpExtendedEpisodes(programUrl, page);
});

ipcMain.handle("kexp-extended-episode-stream", async (_event, { episodeUrl }) => {
  const result = await getKexpExtendedEpisodeStream(episodeUrl || "");
  result.streamUrl = await registerStreamProxyUrl(result.streamUrl);
  return result;
});

ipcMain.handle("kexp-extended-episode-tracklist", async (_event, { episodeUrl }) => {
  const tracks = await getKexpExtendedEpisodeTracklist(episodeUrl || "");
  return { tracks };
});

ipcMain.handle("kexp-scheduler-list", async () => {
  return kexpScheduler.list();
});

ipcMain.handle("kexp-scheduler-add", async (_event, { programUrl, options }) => {
  const normalized = normalizeKexpProgramUrl(programUrl || "");
  const data = await kexpScheduler.add(normalized, options || {});
  patchMaterializedSubscriptions();
  return data;
});

ipcMain.handle("kexp-scheduler-remove", async (_event, { scheduleId }) => {
  kexpScheduler.remove(scheduleId);
  patchMaterializedSubscriptions();
  return kexpScheduler.list();
});

ipcMain.handle("kexp-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  kexpScheduler.setEnabled(scheduleId, enabled);
  patchMaterializedSubscriptions();
  return kexpScheduler.list();
});

ipcMain.handle("kexp-scheduler-check-one", async (_event, { scheduleId }) => {
  const data = await kexpScheduler.checkOne(scheduleId);
  patchMaterializedSubscriptions();
  return data;
});

ipcMain.handle("download-fip-url", async (_event, { pageUrl, progressToken, title, programTitle, publishedTime, image, description = "", location = "", hosts = [], genres = [], forceDownload }) => {
  const onProgress = progressToken
    ? (payload) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send("download-progress", { token: progressToken, ...payload });
      }
    : undefined;
  return downloadFipEpisode({
    episodeUrl: String(pageUrl || ""),
    title: String(title || "").trim(),
    programTitle: String(programTitle || "").trim(),
    publishedTime: String(publishedTime || "").trim(),
    artworkUrl: String(image || "").trim(),
    description,
    location,
    hosts,
    genres,
    onProgress,
    forceDownload: Boolean(forceDownload)
  });
});

ipcMain.handle("fip-live-stations", () => {
  return FIP_LIVE_STATIONS;
});

ipcMain.handle("fip-live-now", async (_event, { stationId }) => {
  return getFipNowPlaying(stationId || "fip");
});

ipcMain.handle("fip-program-search", async (_event, { query }) => {
  try {
    const results = await searchFipPrograms(query || "");
    return { results };
  } catch (e) {
    return { results: [], error: e?.message || "Search unavailable" };
  }
});

ipcMain.handle("fip-discovery", async (_event, { count } = {}) => {
  try {
    const results = await getFipDiscovery(Math.min(24, Math.max(1, count || 12)));
    return { results };
  } catch (e) {
    return { results: [], error: e?.message || "Discovery unavailable" };
  }
});

ipcMain.handle("nts-discovery", async (_event, { count } = {}) => {
  try {
    const results = await getNtsDiscovery(Math.min(24, Math.max(1, count || 5)));
    return { results };
  } catch (e) {
    return { results: [], error: e?.message || "Discovery unavailable" };
  }
});

ipcMain.handle("wwf-discovery", async (_event, { count } = {}) => {
  try {
    const results = await getWwfDiscovery(Math.min(24, Math.max(1, count || 5)));
    return { results };
  } catch (e) {
    return { results: [], error: e?.message || "Discovery unavailable" };
  }
});

ipcMain.handle("bbc-discovery", async (_event, { count } = {}) => {
  try {
    const results = await getBbcDiscovery(Math.min(24, Math.max(1, count || 5)));
    return { results };
  } catch (e) {
    return { results: [], error: e?.message || "Discovery unavailable" };
  }
});

ipcMain.handle("rte-discovery", async (_event, { count } = {}) => {
  try {
    const results = await getRteDiscovery(Math.min(24, Math.max(1, count || 5)));
    return { results };
  } catch (e) {
    return { results: [], error: e?.message || "Discovery unavailable" };
  }
});

ipcMain.handle("fip-program-summary", async (_event, { programUrl }) => {
  return getFipProgramSummary(programUrl || "");
});

ipcMain.handle("fip-program-episodes", async (_event, { programUrl, page = 1 }) => {
  return getFipProgramEpisodes(programUrl, page);
});

ipcMain.handle("fip-episode-stream", async (_event, { episodeUrl }) => {
  return getFipEpisodeStream(episodeUrl, runYtDlpJson);
});

ipcMain.handle("fip-episode-tracklist", async (_event, { episodeUrl, startTs, durationSecs }) => {
  const tracks = await getFipEpisodeTracklist(episodeUrl || "", { startTs: Number(startTs || 0), durationSecs: Number(durationSecs || 0) });
  return { tracks };
});

ipcMain.handle("fip-scheduler-list", async () => {
  return fipScheduler.list();
});

ipcMain.handle("fip-scheduler-add", async (_event, { programUrl, options }) => {
  const normalized = normalizeFipProgramUrl(programUrl || "");
  const data = await fipScheduler.add(normalized, options || {});
  patchMaterializedSubscriptions();
  return data;
});

ipcMain.handle("fip-scheduler-remove", async (_event, { scheduleId }) => {
  fipScheduler.remove(scheduleId);
  patchMaterializedSubscriptions();
  return fipScheduler.list();
});

ipcMain.handle("fip-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  fipScheduler.setEnabled(scheduleId, enabled);
  patchMaterializedSubscriptions();
  return fipScheduler.list();
});

ipcMain.handle("fip-scheduler-check-one", async (_event, { scheduleId }) => {
  const data = await fipScheduler.checkOne(scheduleId);
  patchMaterializedSubscriptions();
  return data;
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
  patchMaterializedSubscriptions();
  return added;
});

ipcMain.handle("nts-scheduler-remove", async (_event, { scheduleId }) => {
  ntsScheduler.remove(scheduleId);
  patchMaterializedSubscriptions();
  return ntsScheduler.list();
});

ipcMain.handle("nts-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  ntsScheduler.setEnabled(scheduleId, enabled);
  patchMaterializedSubscriptions();
  return ntsScheduler.list();
});

ipcMain.handle("nts-scheduler-check-one", async (_event, { scheduleId }) => {
  const data = await ntsScheduler.checkOne(scheduleId);
  patchMaterializedSubscriptions();
  return data;
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
  patchMaterializedSubscriptions();
  return added;
});

ipcMain.handle("scheduler-remove", async (_event, { scheduleId }) => {
  scheduler.remove(scheduleId);
  patchMaterializedSubscriptions();
  return scheduler.list();
});

ipcMain.handle("scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  scheduler.setEnabled(scheduleId, enabled);
  patchMaterializedSubscriptions();
  return scheduler.list();
});

ipcMain.handle("scheduler-check-one", async (_event, { scheduleId }) => {
  const data = await scheduler.checkOne(scheduleId);
  patchMaterializedSubscriptions();
  return data;
});

ipcMain.handle("bbc-scheduler-list", async () => {
  return bbcScheduler.list();
});

ipcMain.handle("bbc-scheduler-add", async (_event, { programUrl, options }) => {
  const normalized = normalizeBbcProgramUrl(programUrl);
  const added = await bbcScheduler.add(normalized, options || {});
  patchMaterializedSubscriptions();
  return added;
});

ipcMain.handle("bbc-scheduler-remove", async (_event, { scheduleId }) => {
  bbcScheduler.remove(scheduleId);
  patchMaterializedSubscriptions();
  return bbcScheduler.list();
});

ipcMain.handle("bbc-scheduler-set-enabled", async (_event, { scheduleId, enabled }) => {
  bbcScheduler.setEnabled(scheduleId, enabled);
  patchMaterializedSubscriptions();
  return bbcScheduler.list();
});

ipcMain.handle("bbc-scheduler-check-one", async (_event, { scheduleId }) => {
  const data = await bbcScheduler.checkOne(scheduleId);
  patchMaterializedSubscriptions();
  return data;
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
    writeCueFile: true,
    revealErrors: true,
    sourceType,
    episodeUrl,
    episodeTitle,
    programTitle,
    tracklistUrl,
    fileStartOffset: Number(payload.fileStartOffset || 0),
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
    fileStartOffset: Number(payload.fileStartOffset || 0),
    onProgress: (progress) => emitRendererProgress(event.sender, String(payload.progressToken || "").trim(), progress)
  });
});

ipcMain.handle("settings-pick-download-dir", async (event, _payload = {}) => {
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

ipcMain.handle("download-history-list", () => downloadHistory ? downloadHistory.list() : []);
ipcMain.handle("download-history-clear", () => {
  if (downloadHistory) {
    downloadHistory.clear();
  }
  patchMaterializedHistory();
  broadcastGlobalEvent({ type: "download.history.cleared" });
  return { ok: true };
});
ipcMain.handle("program-feeds-list", () => listAllProgramFeeds());

async function executeProgramFeedsRefresh() {
  try {
    const result = await rebuildProgramFeedsFromSchedules({
      feedExportEnabled: readSettings().feedExportEnabled,
      getDataDir: feedDataDirFor,
      sources: [
        { sourceType: "rte", listSchedules: () => scheduler.list(), getEpisodes: (url, page) => getProgramEpisodes(url, page) },
        { sourceType: "bbc", listSchedules: () => bbcScheduler.list(), getEpisodes: (url, page) => getBbcProgramEpisodes(url, runYtDlpJson, page) },
        { sourceType: "wwf", listSchedules: () => wwfScheduler.list(), getEpisodes: (url, page) => getWwfProgramEpisodes(url, page) },
        { sourceType: "nts", listSchedules: () => ntsScheduler.list(), getEpisodes: (url, page) => getNtsProgramEpisodes(url, page) },
        { sourceType: "fip", listSchedules: () => fipScheduler.list(), getEpisodes: (url, page) => getFipProgramEpisodes(url, page) },
        { sourceType: "kexp", listSchedules: () => kexpScheduler.list(), getEpisodes: (url, page) => getKexpProgramEpisodes(url, page) }
      ]
    });
    if (result.ok && result.rebuilt > 0) {
      patchMaterializedFeeds();
      broadcastGlobalEvent({ type: "feeds.updated", source: "refresh", title: "", slug: "" });
    }
    return { ...result, feeds: listAllProgramFeeds() };
  } catch (error) {
    return {
      ok: false,
      rebuilt: 0,
      errors: [],
      message: String(error?.message || error || "Feed refresh failed"),
      feeds: listAllProgramFeeds()
    };
  }
}

ipcMain.handle("program-feeds-refresh", () => executeProgramFeedsRefresh());

ipcMain.handle("open-external-url", async (_event, url) => {
  const target = String(url || "").trim();
  if (!/^https?:\/\//i.test(target)) {
    throw new Error("Only http(s) URLs can be opened.");
  }
  await shell.openExternal(target);
  return { ok: true };
});
ipcMain.handle("metadata-search", async (_event, payload = {}) => {
  const snapshot = await ensureMaterializedMetadata();
  return searchMetadataIndex(snapshot.index, payload || {});
});
ipcMain.handle("entity-graph-search", async (_event, payload = {}) => {
  const forceRefresh = payload?.forceRefresh === true;
  await refreshMetadataHarvestCache(forceRefresh);
  const snapshot = await ensureMaterializedMetadata({
    forceRebuild: forceRefresh,
    allowStale: !forceRefresh
  });
  return searchEntityGraph(snapshot.graph, payload || {});
});
ipcMain.handle("entity-graph-detail", async (_event, payload = {}) => {
  const forceRefresh = payload?.forceRefresh === true;
  await refreshMetadataHarvestCache(forceRefresh);
  const snapshot = await ensureMaterializedMetadata({
    forceRebuild: forceRefresh,
    allowStale: !forceRefresh
  });
  return getEntityGraphEntity(snapshot.graph, payload || {});
});
ipcMain.handle("metadata-discover", async (_event, payload = {}) => {
  const forceRefresh = payload?.forceRefresh === true;
  await refreshMetadataHarvestCache(forceRefresh);
  const snapshot = await ensureMaterializedMetadata({
    forceRebuild: forceRefresh,
    allowStale: !forceRefresh
  });
  return discoverMetadataIndex(snapshot.index, payload || {});
});
ipcMain.handle("metadata-subscription-discovery", async (_event, payload = {}) => {
  const snapshot = await ensureMaterializedMetadata();
  return buildSubscriptionDiscoveryRecommendations(snapshot.index, payload || {});
});
ipcMain.handle("metadata-for-you-discovery", async (_event, payload = {}) => {
  const snapshot = await ensureMaterializedMetadata();
  return buildForYouRecommendations(snapshot.index, payload || {});
});
ipcMain.handle("metadata-harvest-refresh", async () => {
  const items = await refreshMetadataHarvestCache(true);
  return { ok: true, count: items.length, updatedAt: metadataHarvestStore?.getUpdatedAt?.() || "" };
});
ipcMain.handle("metadata-harvest-refresh-source", async (_event, payload = {}) => {
  return refreshMetadataHarvestSource(String(payload.sourceType || ""), {
    deeper: Boolean(payload.deeper)
  });
});
ipcMain.handle("collections-list", () => collectionsStore ? collectionsStore.list() : []);
ipcMain.handle("collections-create", (_event, payload = {}) => {
  if (!collectionsStore) {
    return [];
  }
  collectionsStore.create(String(payload.name || ""));
  return collectionsStore.list();
});
ipcMain.handle("collections-delete", (_event, payload = {}) => {
  if (!collectionsStore) {
    return [];
  }
  collectionsStore.remove(String(payload.collectionId || ""));
  return collectionsStore.list();
});
ipcMain.handle("collections-add-entry", (_event, payload = {}) => {
  if (!collectionsStore) {
    return [];
  }
  collectionsStore.addEntry(String(payload.collectionId || ""), payload.entry || {});
  return collectionsStore.list();
});
ipcMain.handle("collections-add-entries", (_event, payload = {}) => {
  if (!collectionsStore) {
    return { collections: [], addedCount: 0 };
  }
  const result = collectionsStore.addEntries(String(payload.collectionId || ""), payload.entries || []);
  return {
    collections: collectionsStore.list(),
    addedCount: Number(result?.addedCount || 0)
  };
});
ipcMain.handle("collections-remove-entry", (_event, payload = {}) => {
  if (!collectionsStore) {
    return [];
  }
  collectionsStore.removeEntry(String(payload.collectionId || ""), String(payload.entryId || ""));
  return collectionsStore.list();
});
ipcMain.handle("collections-recommendations", async (_event, payload = {}) => {
  const forceRefresh = payload?.forceRefresh === true;
  await refreshMetadataHarvestCache(forceRefresh);
  const snapshot = await ensureMaterializedMetadata({
    forceRebuild: forceRefresh,
    allowStale: !forceRefresh
  });
  const collections = collectionsStore ? collectionsStore.list() : [];
  const collection = collections.find((item) => item.id === String(payload.collectionId || ""));
  if (!collection) {
    return {
      collectionId: "",
      collectionName: "",
      query: "",
      sourceType: "",
      terms: [],
      totalCandidates: 0,
      results: [],
      facets: { hosts: [], genres: [], locations: [] }
    };
  }
  return buildCollectionRecommendations(
    snapshot.index,
    collection,
    payload || {}
  );
});
ipcMain.handle("history-postprocess", async (_event, payload = {}) => rebuildDownloadedFileMetadata(payload || {}));
ipcMain.handle("diagnostics-get", async () => {
  const settings = readSettings();
  if (process.env.NODE_ENV !== "test") {
    await refreshMetadataHarvestCache(false);
  }
  const snapshot = await ensureMaterializedMetadata();
  return collectRuntimeDiagnostics({
    dataDir: app.getPath("userData"),
    downloadDir: settings.downloadDir,
    projectRoot: path.join(__dirname, ".."),
    recentErrors: recentErrorsLog ? recentErrorsLog.list() : [],
    schedulesBySource: buildLibraryMetadataDataset().schedulesBySource,
    queueSnapshot: downloadQueue.snapshot(),
    settings,
    harvestUpdatedAt: metadataHarvestStore?.getUpdatedAt?.() || "",
    harvestState: metadataHarvestStore?.getState?.() || { sources: {} },
    harvestedItems: metadataHarvestStore?.list?.() || [],
    metadataIndex: snapshot.index,
    entityGraph: snapshot.graph
  });
});
ipcMain.handle("diagnostics-repair", async () => runVendorBootstrap({
  projectRoot: path.join(__dirname, "..")
}));
ipcMain.handle("open-path", async (_event, targetPath) => {
  const inputPath = String(targetPath || "").trim();
  if (!inputPath) {
    return { ok: false, error: "Path is required." };
  }
  try {
    const errorMessage = await shell.openPath(inputPath);
    return errorMessage ? { ok: false, error: errorMessage } : { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message || error || "Failed to open path.") };
  }
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

ipcMain.handle("download-queue-rerun", async (_event, { taskId, mode = "exact" }) => {
  const rerun = downloadQueue.rerun(taskId, {
    restoreTask: restoreDownloadQueueTask,
    mode
  });
  if (!rerun) {
    return { ok: false, error: "Task cannot be rerun.", snapshot: downloadQueue.snapshot() };
  }
  return { ok: true, taskId: rerun.id, snapshot: downloadQueue.snapshot() };
});

ipcMain.handle("download-queue-clear-pending", async () => {
  downloadQueue.clearPending();
  return downloadQueue.snapshot();
});

async function sendWebhookIfConfigured(payload) {
  const webhookUrl = String(readSettings().webhookUrl || "").trim();
  if (!webhookUrl) {
    return;
  }
  try {
    await fetchWithGenericWebhookAssert(webhookUrl, {
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
  const feed = writeProgramFeedFiles({
    dataDir: feedDataDirFor(sourceType),
    schedule,
    latest
  });
  patchMaterializedFeeds();
  broadcastGlobalEvent({
    type: "feeds.updated",
    source: sourceType,
    title: schedule?.title || "",
    slug: feed?.slug || ""
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
  broadcastGlobalEvent({
    type: "episode.downloaded",
    source: sourceType,
    title: schedule?.title || "",
    episodeTitle: Array.isArray(downloaded) && downloaded[0]?.title ? downloaded[0].title : ""
  });
  try {
    const { Notification } = require("electron");
    if (Notification.isSupported()) {
      const ep = Array.isArray(downloaded) && downloaded[0]?.title ? downloaded[0].title : "";
      new Notification({
        title: `New episode: ${schedule.title}`,
        body: ep || `${String(sourceType || "").toUpperCase()} download complete`
      }).show();
    }
  } catch {}
}

async function onScheduleError(sourceType, schedule, error) {
  if (recentErrorsLog) {
    recentErrorsLog.append({
      sourceType,
      title: schedule?.title || "",
      error: String(error?.message || error || "Unknown error")
    });
  }
  await sendWebhookIfConfigured({
    event: "download.error",
    source: sourceType,
    scheduleId: schedule?.id || "",
    title: schedule?.title || "",
    error: String(error?.message || error || "Unknown error")
  });
  broadcastGlobalEvent({
    type: "download.error",
    source: sourceType,
    title: schedule?.title || "",
    error: String(error?.message || error || "Unknown error")
  });
}

function shouldSkipSchedulerEpisode({ episode } = {}) {
  return Boolean(readSettings()?.skipReruns) && isLikelyRerun(episode);
}

app.whenReady().then(() => {
  readSettings();

  const DATA_DIR = app.getPath("userData");
  const CACHE_DIR = path.join(DATA_DIR, "cache");
  const diskCache = createDiskCache(CACHE_DIR);
  configureRte({ diskCache });
  configureNts({ diskCache });
  configureFip({ diskCache });

  const DOWNLOAD_HISTORY_PATH = path.join(DATA_DIR, "download-history.json");
  downloadHistory = createDownloadHistory(DOWNLOAD_HISTORY_PATH);
  const RECENT_ERRORS_PATH = path.join(DATA_DIR, "recent-errors.json");
  recentErrorsLog = createRecentErrorsLog(RECENT_ERRORS_PATH);
  metadataHarvestStore = createMetadataHarvestStore(path.join(DATA_DIR, "metadata-harvest.json"));
  materializedMetadataStore = createMaterializedMetadataStore(path.join(DATA_DIR, "materialized-metadata.json"));
  materializedMetadataCache = getMaterializedMetadataSnapshot();
  collectionsStore = createCollectionsStore(path.join(DATA_DIR, "collections.json"));
  const restoredQueueItems = downloadQueue.restorePending();
  if (restoredQueueItems > 0) {
    broadcastGlobalEvent({
      type: "download.queue.restored",
      count: restoredQueueItems
    });
  }

  scheduler = createSchedulerStore({
    app,
    getProgramSummary,
    getProgramEpisodes,
    shouldSkipEpisodeDownload: shouldSkipSchedulerEpisode,
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
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
      forceDownload: episode.forceDownload || false
    })
  });

  bbcScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "bbc"),
    getProgramSummary: async (programUrl) => getBbcProgramSummary(programUrl, runYtDlpJson),
    getProgramEpisodes: async (programUrl, page) => getBbcProgramEpisodes(programUrl, runYtDlpJson, page),
    shouldSkipEpisodeDownload: shouldSkipSchedulerEpisode,
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
        description: episode.description || "",
        location: episode.location || "",
        hosts: episode.hosts || [],
        genres: episode.genres || [],
        forceDownload: episode.forceDownload || false
      })
  });

  wwfScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "wwf"),
    getProgramSummary: async (programUrl) => getWwfProgramSummary(programUrl),
    getProgramEpisodes: async (programUrl, page) => getWwfProgramEpisodes(programUrl, page),
    shouldSkipEpisodeDownload: shouldSkipSchedulerEpisode,
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
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
      forceDownload: episode.forceDownload || false
    })
  });

  ntsScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "nts"),
    getProgramSummary: async (programUrl) => getNtsProgramSummary(programUrl),
    getProgramEpisodes: async (programUrl, page) => getNtsProgramEpisodes(programUrl, page),
    shouldSkipEpisodeDownload: shouldSkipSchedulerEpisode,
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
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
      forceDownload: episode.forceDownload || false
    })
  });

  fipScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "fip"),
    getProgramSummary: async (programUrl) => getFipProgramSummary(programUrl),
    getProgramEpisodes: async (programUrl, page) => getFipProgramEpisodes(programUrl, page),
    shouldSkipEpisodeDownload: shouldSkipSchedulerEpisode,
    onScheduleRefreshed: (schedule, latest) => onScheduleRefreshed("fip", schedule, latest),
    onScheduleRunComplete: (schedule, downloaded) => onScheduleComplete("fip", schedule, downloaded),
    onScheduleRunError: (schedule, error) => onScheduleError("fip", schedule, error),
    runEpisodeDownload: async (episode) =>
      downloadFipEpisode({
        episodeUrl: episode.episodeUrl,
      title: episode.title || episode.fullTitle,
      programTitle: episode.programTitle || "FIP",
      publishedTime: episode.publishedTime,
      artworkUrl: episode.image || "",
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
      forceDownload: episode.forceDownload || false
    })
  });

  kexpScheduler = createSchedulerStore({
    app,
    dataDir: path.join(app.getPath("userData"), "kexp"),
    getProgramSummary: async (programUrl) => getKexpProgramSummary(programUrl),
    getProgramEpisodes: async (programUrl, page) => getKexpProgramEpisodes(programUrl, page),
    shouldSkipEpisodeDownload: shouldSkipSchedulerEpisode,
    onScheduleRefreshed: (schedule, latest) => onScheduleRefreshed("kexp", schedule, latest),
    onScheduleRunComplete: (schedule, downloaded) => onScheduleComplete("kexp", schedule, downloaded),
    onScheduleRunError: (schedule, error) => onScheduleError("kexp", schedule, error),
    runEpisodeDownload: async (episode) =>
      downloadKexpEpisode({
        episodeUrl: episode.episodeUrl,
      title: episode.title || episode.fullTitle,
      programTitle: episode.programTitle || "KEXP",
      publishedTime: episode.publishedTime,
      artworkUrl: episode.image || "",
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
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
  fipScheduler.start();
  fipScheduler.runAll().catch(() => {});
  kexpScheduler.start();
  kexpScheduler.runAll().catch(() => {});
  if (process.env.NODE_ENV !== "test") {
    setTimeout(() => {
      refreshMetadataHarvestCache(false).catch(() => {});
      refreshMaterializedMetadataSnapshot().catch(() => {});
    }, 2500);
    setInterval(() => {
      refreshMetadataHarvestCache(false).catch(() => {});
    }, METADATA_HARVEST_POLL_MS);
  }

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
  if (fipScheduler) {
    fipScheduler.stop();
  }
  if (kexpScheduler) {
    kexpScheduler.stop();
  }
});
