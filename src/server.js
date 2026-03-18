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
  getKexpExtendedEpisodeTracklist,
  ISO_DAY_NAMES: KEXP_ISO_DAY_NAMES
} = require("./lib/kexp");
const { runYtDlpDownload, runYtDlpJson, spawnYtDlpPipe, resolveYtDlpCommand } = require("./lib/downloader");
const { createSchedulerStore } = require("./lib/scheduler");
const { buildDownloadTarget, sanitizePathSegment } = require("./lib/path-format");
const { createDownloadQueue } = require("./lib/download-queue");
const { applyId3Tags } = require("./lib/tags");
const { listProgramFeedFiles, writeProgramFeedFiles } = require("./lib/feeds");
const { readCueChaptersForAudio } = require("./lib/cue-reader");
const { runCueTaskInChild } = require("./lib/cue-worker-client");
const {
  buildMetadataIndex,
  buildScheduleMetadataDocs,
  buildFeedMetadataDocs,
  buildHistoryMetadataDocs,
  sortMetadataDocs,
  searchMetadataIndex,
  discoverMetadataIndex,
  buildCollectionRecommendations
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

const app = express();
app.use(express.json({ limit: "1mb" }));
const rendererDir = path.join(__dirname, "renderer");
app.use(express.static(rendererDir));
app.use("/build", express.static(path.join(__dirname, "..", "build")));
const progressSubscribers = new Map();
const localPlaybackTokens = new Map();
const wwfTempTokens = new Map();

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || "/downloads";
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const DOWNLOAD_ARCHIVE_PATH = path.join(DATA_DIR, "download-archive.txt");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
app.use("/feeds/rte", express.static(path.join(DATA_DIR, "feeds")));
app.use("/feeds/bbc", express.static(path.join(DATA_DIR, "bbc", "feeds")));
app.use("/feeds/wwf", express.static(path.join(DATA_DIR, "wwf", "feeds")));
app.use("/feeds/nts", express.static(path.join(DATA_DIR, "nts", "feeds")));
app.use("/feeds/fip", express.static(path.join(DATA_DIR, "fip", "feeds")));
app.use("/feeds/kexp", express.static(path.join(DATA_DIR, "kexp", "feeds")));

const { createDiskCache } = require("./lib/disk-cache");
const { createDownloadHistory } = require("./lib/download-history");
const { createRecentErrorsLog } = require("./lib/recent-errors-log");
const collectionsStore = createCollectionsStore(path.join(DATA_DIR, "collections.json"));

const CACHE_DIR = path.join(DATA_DIR, "cache");
const diskCache = createDiskCache(CACHE_DIR);
configureRte({ diskCache });
configureNts({ diskCache });
configureFip({ diskCache });

const DOWNLOAD_HISTORY_PATH = path.join(DATA_DIR, "download-history.json");
const downloadHistory = createDownloadHistory(DOWNLOAD_HISTORY_PATH);
const RECENT_ERRORS_PATH = path.join(DATA_DIR, "recent-errors.json");
const recentErrorsLog = createRecentErrorsLog(RECENT_ERRORS_PATH);
const metadataHarvestStore = createMetadataHarvestStore(path.join(DATA_DIR, "metadata-harvest.json"));
const materializedMetadataStore = createMaterializedMetadataStore(path.join(DATA_DIR, "materialized-metadata.json"));
let materializedMetadataCache = null;
let materializedMetadataDirty = true;
let materializedMetadataRefreshPromise = null;

const globalEventSubscribers = new Set();
function broadcastGlobalEvent(payload) {
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of globalEventSubscribers) {
    try { res.write(line); } catch {}
  }
}

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
  return createDefaultSettings(DOWNLOAD_DIR);
}

let cachedSettings = null;
function normalizeSettings(input) {
  return normalizeSharedSettings(input, {
    defaultDownloadDir: getDefaultSettings().downloadDir
  });
}

const downloadQueue = createDownloadQueue(
  () => readSettings().maxConcurrentDownloads || 2,
  {
    getStoragePath: () => path.join(DATA_DIR, "download-queue.json"),
    restoreTask: (persisted) => restoreDownloadQueueTask(persisted)
  }
);
const restoredQueueItems = downloadQueue.restorePending();
if (restoredQueueItems > 0) {
  broadcastGlobalEvent({
    type: "download.queue.restored",
    count: restoredQueueItems
  });
}

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
      tracklistUrl: String(postProcess.tracklistUrl || ""),
      fileStartOffset: Number(postProcess.fileStartOffset || 0)
    }
  };
}

function appendDownloadHistoryEntry(entry) {
  try {
    downloadHistory.append(entry);
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
    history: downloadHistory.list(),
    harvested: metadataHarvestStore.list()
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
  return replaceMaterializedMetadataSections("history", buildHistoryMetadataDocs(downloadHistory.list()));
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
    materializedMetadataStore.replace(snapshot);
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
  markMaterializedMetadataDirty({ refreshInBackground: true });
  return merged;
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
    durationSeconds: Number(cue?.durationSeconds || 0)
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
        fileStartOffset: Number(payload.postProcess?.fileStartOffset || 0),
        onProgress: null
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
  forceDownload = false,
  postProcess = null
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
  const persistedPayload = createPersistentDownloadPayload({
    job: {
      manifestUrl,
      sourceUrl,
      title: target.fileStem,
      outputDir,
      archivePath: DOWNLOAD_ARCHIVE_PATH,
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
      durationSeconds: Number(cue?.durationSeconds || 0)
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
    inputSource = absolutizeInternalMediaUrl(streamUrl);
  } else if (safeSourceType === "rte") {
    inputSource = absolutizeInternalMediaUrl((await resolveRteEpisodeStream(clipId)).streamUrl);
  } else if (safeSourceType === "wwf") {
    inputSource = (await resolveWwfEpisodeStream(episodeUrl)).streamUrl;
  } else if (safeSourceType === "nts") {
    inputSource = (await resolveNtsEpisodeStream(episodeUrl)).streamUrl;
  } else if (safeSourceType === "fip") {
    inputSource = (await getFipEpisodeStream(episodeUrl, runYtDlpJson)).streamUrl;
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
  progressToken,
  forceDownload = false
}) {
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
  if (sourceType === "fip") return path.join(DATA_DIR, "fip");
  if (sourceType === "kexp") return path.join(DATA_DIR, "kexp");
  return DATA_DIR;
}

function getFeedSourceConfigs() {
  return [
    { sourceType: "rte", dataDir: feedDataDirFor("rte"), publicBasePath: "/feeds/rte" },
    { sourceType: "bbc", dataDir: feedDataDirFor("bbc"), publicBasePath: "/feeds/bbc" },
    { sourceType: "wwf", dataDir: feedDataDirFor("wwf"), publicBasePath: "/feeds/wwf" },
    { sourceType: "nts", dataDir: feedDataDirFor("nts"), publicBasePath: "/feeds/nts" },
    { sourceType: "fip", dataDir: feedDataDirFor("fip"), publicBasePath: "/feeds/fip" },
    { sourceType: "kexp", dataDir: feedDataDirFor("kexp"), publicBasePath: "/feeds/kexp" }
  ];
}

function listAllProgramFeeds() {
  return getFeedSourceConfigs()
    .flatMap((config) => listProgramFeedFiles(config))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

async function resolveWwfEpisodeStream(episodeUrl) {
  const url = String(episodeUrl || "").trim();
  if (!url) throw new Error("episodeUrl is required.");

  // Resolve Mixcloud URL if needed (skip re-fetch if already a Mixcloud URL)
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

  // Mixcloud uses AES-128 encrypted HLS — pipe yt-dlp decoded output for fast
  // playback start (~5-10s). No seek support.
  return { episodeUrl: url, streamUrl: `/api/wwf/ytdlp-pipe?url=${encodeURIComponent(sourceUrl)}`, title: "", image: "" };
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
  progressToken,
  forceDownload = false
}) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) throw new Error("episodeUrl is required.");
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
    progressToken,
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
    onProgress: (progress) => emitProgressEvent(progressToken, progress)
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
  progressToken,
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
    progressToken,
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
    onProgress: (progress) => emitProgressEvent(progressToken, progress)
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
  progressToken,
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
    progressToken,
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
    onProgress: (progress) => emitProgressEvent(progressToken, progress)
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
  progressToken,
  forceDownload = false
}) {
  const sourceUrl = String(episodeUrl || "").trim();
  if (!sourceUrl) throw new Error("episodeUrl is required.");
  const resolvedTitle = String(title || "").trim() || inferTitleFromUrl(sourceUrl, "kexp-episode");
  const metadata = buildMetadata({ description, location, hosts, genres });

  // If already a direct CDN URL (e.g. CloudFront from KEXP Extended), use it directly
  let sgUrl, sgOffset;
  if (/cloudfront\.net\/segments\//i.test(sourceUrl)) {
    sgUrl = sourceUrl;
    sgOffset = 0;
  } else {
    const streamInfo = await getKexpEpisodeStream(sourceUrl, null, publishedTime);
    sgUrl = streamInfo.streamUrl;
    sgOffset = Number(streamInfo.startOffset) || 0;
  }

  const download = await downloadFromManifest({
    sourceUrl: sgUrl,
    manifestUrl: sgUrl,
    title: resolvedTitle,
    programTitle: programTitle || "KEXP",
    publishedTime: publishedTime || resolvedTitle,
    episodeUrl: sourceUrl,
    clipId: sourceUrl,
    progressToken,
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
      clipId: sourceUrl,
      fileStartOffset: sgOffset
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
    onProgress: (progress) => emitProgressEvent(progressToken, progress)
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
    clipId: String(sourceUrl),
    description: metadata.description,
    location: metadata.location,
    hosts: metadata.hosts,
    genres: metadata.genres,
    cue
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
    title: schedule.title,
    episodeTitle: Array.isArray(downloaded) && downloaded[0]?.title ? downloaded[0].title : ""
  });
}

async function onScheduleError(sourceType, schedule, error) {
  recentErrorsLog.append({
    sourceType,
    title: schedule?.title || "",
    error: String(error?.message || error || "Unknown error")
  });
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
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
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
        forceDownload: episode.forceDownload || false,
        postProcess: {
          ...buildMetadata({
            description: episode.description || "",
            location: episode.location || "",
            hosts: episode.hosts || [],
            genres: episode.genres || []
          }),
          sourceType: "bbc",
          episodeTitle: String(episode.title || "bbc-episode"),
          programTitle: String(episode.programTitle || "BBC"),
          publishedTime: String(episode.publishedTime || episode.title || ""),
          sourceUrl: String(episode.episodeUrl || ""),
          artworkUrl: String(episode.image || ""),
          episodeUrl: String(episode.episodeUrl || ""),
          clipId: String(episode.clipId || "")
        }
      });
      const cue = await maybeGenerateCue({
        downloadResult: download,
        sourceType: "bbc",
        episodeUrl: String(episode.episodeUrl || ""),
        episodeTitle: String(episode.title || "bbc-episode"),
        programTitle: String(episode.programTitle || "BBC")
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
        clipId: String(episode.clipId || ""),
        description: String(episode.description || ""),
        location: String(episode.location || ""),
        hosts: episode.hosts || [],
        genres: episode.genres || [],
        cue
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
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
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
      description: episode.description || "",
      location: episode.location || "",
      hosts: episode.hosts || [],
      genres: episode.genres || [],
      forceDownload: episode.forceDownload || false
    })
});

const fipScheduler = createSchedulerStore({
  dataDir: path.join(DATA_DIR, "fip"),
  getProgramSummary: async (programUrl) => getFipProgramSummary(programUrl),
  getProgramEpisodes: async (programUrl, page) => getFipProgramEpisodes(programUrl, page),
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

const kexpScheduler = createSchedulerStore({
  dataDir: path.join(DATA_DIR, "kexp"),
  getProgramSummary: async (programUrl) => getKexpProgramSummary(programUrl),
  getProgramEpisodes: async (programUrl, page) => getKexpProgramEpisodes(programUrl, page),
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

if (process.env.NODE_ENV !== "test") {
  materializedMetadataCache = getMaterializedMetadataSnapshot();
  setTimeout(() => {
    refreshMetadataHarvestCache(false).catch(() => {});
    refreshMaterializedMetadataSnapshot().catch(() => {});
  }, 2500);
}

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

app.get("/api/wwf/ytdlp-pipe", (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!/mixcloud\.com\//i.test(url)) {
    return res.status(400).json({ error: "Invalid URL: must be a Mixcloud URL" });
  }
  let child;
  try {
    child = spawnYtDlpPipe(url);
  } catch (error) {
    return res.status(503).json({ error: String(error?.message || error || "yt-dlp pipe failed") });
  }
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Transfer-Encoding", "chunked");
  child.stdout.pipe(res);
  req.on("close", () => { try { child.kill(); } catch {} });
  child.on("error", () => {
    try {
      if (!res.headersSent) {
        res.status(503).json({ error: "yt-dlp pipe failed" });
      } else {
        res.end();
      }
    } catch {}
  });
});

app.get("/api/wwf/temp-audio/:token", (req, res) => {
  const token = String(req.params.token || "").trim();
  const entry = wwfTempTokens.get(token);
  if (!entry || !fs.existsSync(entry.path)) return res.status(404).end();
  res.sendFile(entry.path);
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

// ── FIP routes ────────────────────────────────────────────────────────────────

app.get("/api/fip/live/stations", (_req, res) => {
  res.json(FIP_LIVE_STATIONS);
});

app.get("/api/fip/live/now/:stationId", async (req, res) => {
  try {
    const data = await getFipNowPlaying(req.params.stationId || "fip");
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});



app.get("/api/fip/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchFipPrograms(query);
    res.json({ results: data });
  } catch (error) {
    res.json({ results: [], error: error.message || "Search unavailable" });
  }
});

app.get("/api/fip/discovery", async (req, res) => {
  try {
    const count = Math.min(24, Math.max(1, parseInt(req.query.count || "12", 10)));
    const data = await getFipDiscovery(count);
    res.json({ results: data });
  } catch (error) {
    res.json({ results: [], error: error.message || "Discovery unavailable" });
  }
});

app.get("/api/nts/discovery", async (req, res) => {
  try {
    const count = Math.min(24, Math.max(1, parseInt(req.query.count || "5", 10)));
    const data = await getNtsDiscovery(count);
    res.json({ results: data });
  } catch (error) {
    res.json({ results: [], error: error.message || "Discovery unavailable" });
  }
});

app.get("/api/wwf/discovery", async (req, res) => {
  try {
    const count = Math.min(24, Math.max(1, parseInt(req.query.count || "5", 10)));
    const data = await getWwfDiscovery(count);
    res.json({ results: data });
  } catch (error) {
    res.json({ results: [], error: error.message || "Discovery unavailable" });
  }
});

app.get("/api/bbc/discovery", async (req, res) => {
  try {
    const count = Math.min(24, Math.max(1, parseInt(req.query.count || "5", 10)));
    const data = await getBbcDiscovery(count);
    res.json({ results: data });
  } catch (error) {
    res.json({ results: [], error: error.message || "Discovery unavailable" });
  }
});

app.get("/api/rte/discovery", async (req, res) => {
  try {
    const count = Math.min(24, Math.max(1, parseInt(req.query.count || "5", 10)));
    const data = await getRteDiscovery(count);
    res.json({ results: data });
  } catch (error) {
    res.json({ results: [], error: error.message || "Discovery unavailable" });
  }
});

app.get("/api/fip/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const data = await getFipProgramEpisodes(programUrl, page);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/fip/program/summary", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const data = await getFipProgramSummary(programUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/fip/episode/stream", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getFipEpisodeStream(episodeUrl, runYtDlpJson);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/fip/episode/tracklist", async (req, res) => {
  try {
    const episodeUrl   = String(req.query.url || "");
    const startTs      = Number(req.query.startTs || 0);
    const durationSecs = Number(req.query.durationSecs || 0);
    const tracks = await getFipEpisodeTracklist(episodeUrl, { startTs, durationSecs });
    res.json({ tracks });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/fip/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const providedTitle = String(req.body.title || "").trim();
    const providedProgramTitle = String(req.body.programTitle || "").trim();
    const publishedTime = String(req.body.publishedTime || "").trim();
    const providedImage = String(req.body.image || "").trim();
    const { description, location, hosts, genres } = buildMetadata(req.body || {});
    const data = await downloadFipEpisode({
      episodeUrl: pageUrl,
      title: providedTitle,
      programTitle: providedProgramTitle,
      publishedTime,
      artworkUrl: providedImage,
      description,
      location,
      hosts,
      genres,
      progressToken,
      forceDownload
    });
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
    const metadata = buildMetadata(req.body || {});
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
      forceDownload,
      postProcess: {
        ...metadata,
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
      clipId: String(info.clipId || ""),
      description: metadata.description,
      location: metadata.location,
      hosts: metadata.hosts,
      genres: metadata.genres,
      cue
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
    const metadata = buildMetadata(req.body || {});
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
          forceDownload,
          postProcess: {
            ...metadata,
            sourceType: "bbc",
            episodeTitle: inferredTitle,
            programTitle: providedProgramTitle || inferProgramNameFromUrl(candidate) || inferProgramNameFromUrl(pageUrl) || "BBC",
            publishedTime: publishedTime || inferredTitle,
            sourceUrl: candidate,
            artworkUrl: providedImage,
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
      episodeUrl: usedUrl,
      description: metadata.description,
      location: metadata.location,
      hosts: metadata.hosts,
      genres: metadata.genres,
      cue
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
    const { description, location, hosts, genres } = buildMetadata(req.body || {});
    const data = await downloadWwfEpisode({
      episodeUrl: pageUrl,
      title: title || undefined,
      programTitle: programTitle || undefined,
      publishedTime: publishedTime || undefined,
      artworkUrl: image,
      description,
      location,
      hosts,
      genres,
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
    const { description, location, hosts, genres } = buildMetadata(req.body || {});
    const data = await downloadNtsEpisode({
      episodeUrl: pageUrl,
      title: title || undefined,
      programTitle: programTitle || undefined,
      publishedTime: publishedTime || undefined,
      artworkUrl: image,
      description,
      location,
      hosts,
      genres,
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
    const { description, location, hosts, genres } = buildMetadata(req.body || {});
    const data = await downloadEpisodeByClip({
      clipId,
      title,
      programTitle,
      episodeUrl,
      publishedTime,
      artworkUrl,
      description,
      location,
      hosts,
      genres,
      progressToken,
      forceDownload
    });
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

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  res.write("data: {\"type\":\"ready\"}\n\n");
  globalEventSubscribers.add(res);
  req.on("close", () => globalEventSubscribers.delete(res));
});

app.get("/api/download-history", (_req, res) => {
  res.json({ history: downloadHistory.list() });
});

app.delete("/api/download-history", (_req, res) => {
  downloadHistory.clear();
  patchMaterializedHistory();
  broadcastGlobalEvent({ type: "download.history.cleared" });
  res.json({ ok: true });
});

app.get("/api/feeds", (_req, res) => {
  res.json({ feeds: listAllProgramFeeds() });
});

app.get("/api/metadata/search", async (req, res) => {
  try {
    const snapshot = await ensureMaterializedMetadata();
    const result = searchMetadataIndex(
      snapshot.index,
      {
        query: String(req.query.q || ""),
        sourceType: String(req.query.sourceType || ""),
        kind: String(req.query.kind || ""),
        limit: Number(req.query.limit || 50)
      }
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/entity-graph/search", async (req, res) => {
  try {
    const forceRefresh = String(req.query.forceRefresh || "").trim().toLowerCase() === "true";
    await refreshMetadataHarvestCache(forceRefresh);
    const snapshot = await ensureMaterializedMetadata({
      forceRebuild: forceRefresh,
      allowStale: !forceRefresh
    });
    const result = searchEntityGraph(
      snapshot.graph,
      {
        query: String(req.query.q || ""),
        type: String(req.query.type || ""),
        sourceType: String(req.query.sourceType || ""),
        limit: Number(req.query.limit || 24)
      }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/entity-graph/entity", async (req, res) => {
  try {
    const forceRefresh = String(req.query.forceRefresh || "").trim().toLowerCase() === "true";
    await refreshMetadataHarvestCache(forceRefresh);
    const snapshot = await ensureMaterializedMetadata({
      forceRebuild: forceRefresh,
      allowStale: !forceRefresh
    });
    const result = getEntityGraphEntity(
      snapshot.graph,
      {
        entityId: String(req.query.entityId || "")
      }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/metadata/discover", async (req, res) => {
  try {
    const forceRefresh = String(req.query.forceRefresh || "").trim().toLowerCase() === "true";
    await refreshMetadataHarvestCache(forceRefresh);
    const snapshot = await ensureMaterializedMetadata({
      forceRebuild: forceRefresh,
      allowStale: !forceRefresh
    });
    const result = discoverMetadataIndex(
      snapshot.index,
      {
        query: String(req.query.q || ""),
        sourceType: String(req.query.sourceType || ""),
        kind: String(req.query.kind || ""),
        limit: Number(req.query.limit || 12)
      }
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/metadata/harvest-refresh", async (_req, res) => {
  try {
    const items = await refreshMetadataHarvestCache(true);
    res.json({ ok: true, count: items.length, updatedAt: metadataHarvestStore.getUpdatedAt() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/collections", (_req, res) => {
  res.json({ collections: collectionsStore.list() });
});

app.post("/api/collections", (req, res) => {
  try {
    collectionsStore.create(String(req.body.name || ""));
    res.json({ collections: collectionsStore.list() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/collections/:id", (req, res) => {
  collectionsStore.remove(String(req.params.id || ""));
  res.json({ collections: collectionsStore.list() });
});

app.post("/api/collections/:id/entries", (req, res) => {
  try {
    collectionsStore.addEntry(String(req.params.id || ""), req.body || {});
    res.json({ collections: collectionsStore.list() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/collections/:id/entries/batch", (req, res) => {
  try {
    const result = collectionsStore.addEntries(String(req.params.id || ""), req.body?.entries || []);
    res.json({
      collections: collectionsStore.list(),
      addedCount: Number(result?.addedCount || 0)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/collections/:id/entries/:entryId", (req, res) => {
  collectionsStore.removeEntry(String(req.params.id || ""), String(req.params.entryId || ""));
  res.json({ collections: collectionsStore.list() });
});

app.get("/api/collections/:id/recommendations", async (req, res) => {
  try {
    const forceRefresh = String(req.query.forceRefresh || "").trim().toLowerCase() === "true";
    await refreshMetadataHarvestCache(forceRefresh);
    const snapshot = await ensureMaterializedMetadata({
      forceRebuild: forceRefresh,
      allowStale: !forceRefresh
    });
    const collection = collectionsStore.list().find((item) => item.id === String(req.params.id || ""));
    if (!collection) {
      res.status(404).json({ error: "Collection not found." });
      return;
    }
    const result = buildCollectionRecommendations(
      snapshot.index,
      collection,
      {
        query: String(req.query.q || ""),
        sourceType: String(req.query.sourceType || ""),
        limit: Number(req.query.limit || 12)
      }
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/history/postprocess", async (req, res) => {
  try {
    const result = await rebuildDownloadedFileMetadata(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/diagnostics", async (_req, res) => {
  const settings = readSettings();
  const snapshot = await ensureMaterializedMetadata();
  res.json(collectRuntimeDiagnostics({
    dataDir: DATA_DIR,
    downloadDir: settings.downloadDir,
    projectRoot: path.join(__dirname, ".."),
    recentErrors: recentErrorsLog.list(),
    settings,
    harvestUpdatedAt: metadataHarvestStore.getUpdatedAt(),
    harvestState: metadataHarvestStore.getState(),
    harvestedItems: metadataHarvestStore.list(),
    metadataIndex: snapshot.index,
    entityGraph: snapshot.graph
  }));
});

app.post("/api/diagnostics/repair", async (_req, res) => {
  const result = await runVendorBootstrap({
    projectRoot: path.join(__dirname, "..")
  });
  res.status(result.ok ? 200 : 500).json(result);
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

app.post("/api/download-queue/rerun", (req, res) => {
  const taskId = String(req.body.taskId || "").trim();
  const mode = String(req.body.mode || "exact").trim().toLowerCase() === "current-settings"
    ? "current-settings"
    : "exact";
  const rerun = downloadQueue.rerun(taskId, {
    restoreTask: restoreDownloadQueueTask,
    mode
  });
  if (!rerun) {
    res.status(400).json({ ok: false, error: "Task cannot be rerun.", snapshot: downloadQueue.snapshot() });
    return;
  }
  res.json({ ok: true, taskId: rerun.id, snapshot: downloadQueue.snapshot() });
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
      writeCueFile: true,
      revealErrors: true,
      sourceType,
      episodeUrl: String(req.body.episodeUrl || ""),
      episodeTitle: String(req.body.title || ""),
      programTitle: String(req.body.programTitle || ""),
      tracklistUrl: String(req.body.tracklistUrl || ""),
      fileStartOffset: Number(req.body.fileStartOffset || 0),
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
      fileStartOffset: Number(req.body.fileStartOffset || 0),
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
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = scheduler.setEnabled(req.params.id, enabled);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/scheduler/:id/run", async (req, res) => {
  try {
    const data = await scheduler.checkOne(req.params.id);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/scheduler/:id", (req, res) => {
  scheduler.remove(req.params.id);
  patchMaterializedSubscriptions();
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
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/bbc/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = bbcScheduler.setEnabled(req.params.id, enabled);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/bbc/scheduler/:id/run", async (req, res) => {
  try {
    const data = await bbcScheduler.checkOne(req.params.id);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/bbc/scheduler/:id", (req, res) => {
  bbcScheduler.remove(req.params.id);
  patchMaterializedSubscriptions();
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
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/wwf/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = wwfScheduler.setEnabled(req.params.id, enabled);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/wwf/scheduler/:id/run", async (req, res) => {
  try {
    const data = await wwfScheduler.checkOne(req.params.id);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/wwf/scheduler/:id", (req, res) => {
  wwfScheduler.remove(req.params.id);
  patchMaterializedSubscriptions();
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
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/nts/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = ntsScheduler.setEnabled(req.params.id, enabled);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/nts/scheduler/:id/run", async (req, res) => {
  try {
    const data = await ntsScheduler.checkOne(req.params.id);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/nts/scheduler/:id", (req, res) => {
  ntsScheduler.remove(req.params.id);
  patchMaterializedSubscriptions();
  res.json({ ok: true });
});

app.get("/api/fip/scheduler", (_req, res) => {
  res.json(fipScheduler.list());
});

app.post("/api/fip/scheduler", async (req, res) => {
  try {
    const programUrl = String(req.body.programUrl || "").trim();
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const normalized = normalizeFipProgramUrl(programUrl || "");
    const data = await fipScheduler.add(normalized, { backfillCount });
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/fip/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = fipScheduler.setEnabled(req.params.id, enabled);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/fip/scheduler/:id/run", async (req, res) => {
  try {
    const data = await fipScheduler.checkOne(req.params.id);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/fip/scheduler/:id", (req, res) => {
  fipScheduler.remove(req.params.id);
  patchMaterializedSubscriptions();
  res.json({ ok: true });
});

// ── KEXP routes ───────────────────────────────────────────────────────────────

app.get("/api/kexp/live/stations", (_req, res) => {
  res.json(KEXP_LIVE_STATIONS);
});

app.get("/api/kexp/live/now", async (_req, res) => {
  try {
    const data = await getKexpNowPlaying();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchKexpPrograms(query);
    res.json({ results: data });
  } catch (error) {
    res.json({ results: [], error: error.message || "Search unavailable" });
  }
});

app.get("/api/kexp/discovery", async (req, res) => {
  try {
    const count = Math.min(24, Math.max(1, parseInt(req.query.count || "12", 10)));
    const data = await getKexpDiscovery(count);
    res.json(data);
  } catch {
    res.json([]);
  }
});

app.get("/api/kexp/program/summary", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const data = await getKexpProgramSummary(programUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const data = await getKexpProgramEpisodes(programUrl, page);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/episode/tracklist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getKexpEpisodeTracklist(episodeUrl);
    res.json({ tracks: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/episode/stream", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const startTime = String(req.query.startTime || "");
    const data = await getKexpEpisodeStream(episodeUrl, runYtDlpJson, startTime);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/schedule", async (_req, res) => {
  try {
    const data = await getKexpSchedule();
    res.json({ schedule: data, days: KEXP_ISO_DAY_NAMES });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── KEXP Extended Archive (Splixer) routes ─────────────────────────────────

app.get("/api/kexp/extended/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchKexpExtendedPrograms(query);
    res.json({ results: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/extended/discovery", async (_req, res) => {
  try {
    const data = await getKexpExtendedDiscovery(12);
    res.json({ results: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/extended/program/summary", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const data = await getKexpExtendedProgramSummary(programUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/extended/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = parseInt(req.query.page || "1", 10);
    const data = await getKexpExtendedEpisodes(programUrl, page);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/extended/episode/stream", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getKexpExtendedEpisodeStream(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/extended/episode/tracklist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getKexpExtendedEpisodeTracklist(episodeUrl);
    res.json({ tracks: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/kexp-extended/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const providedTitle = String(req.body.title || "").trim();
    const providedProgramTitle = String(req.body.programTitle || "").trim();
    const publishedTime = String(req.body.publishedTime || "").trim();
    const providedImage = String(req.body.image || "").trim();
    const { description, location, hosts, genres } = buildMetadata(req.body || {});
    // Resolve stream URL directly from Splixer/CloudFront
    const streamInfo = await getKexpExtendedEpisodeStream(pageUrl);
    const streamUrl = streamInfo.streamUrl;
    const title = providedTitle || streamInfo.title;
    const programTitle = providedProgramTitle || streamInfo.programTitle;
    const artworkUrl = providedImage || streamInfo.image;
    const broadcastedAt = publishedTime || streamInfo.broadcastedAt || "";
    const data = await downloadKexpEpisode({
      episodeUrl: streamUrl,
      title,
      programTitle,
      publishedTime: broadcastedAt,
      artworkUrl,
      description,
      location,
      hosts,
      genres,
      progressToken,
      forceDownload
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/kexp/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const forceDownload = Boolean(req.body.forceDownload);
    const providedTitle = String(req.body.title || "").trim();
    const providedProgramTitle = String(req.body.programTitle || "").trim();
    const publishedTime = String(req.body.publishedTime || "").trim();
    const providedImage = String(req.body.image || "").trim();
    const { description, location, hosts, genres } = buildMetadata(req.body || {});
    const data = await downloadKexpEpisode({
      episodeUrl: pageUrl,
      title: providedTitle,
      programTitle: providedProgramTitle,
      publishedTime,
      artworkUrl: providedImage,
      description,
      location,
      hosts,
      genres,
      progressToken,
      forceDownload
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/kexp/scheduler", (_req, res) => {
  res.json(kexpScheduler.list());
});

app.post("/api/kexp/scheduler", async (req, res) => {
  try {
    const programUrl = String(req.body.programUrl || "").trim();
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const normalized = normalizeKexpProgramUrl(programUrl || "");
    const data = await kexpScheduler.add(normalized, { backfillCount });
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/kexp/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = kexpScheduler.setEnabled(req.params.id, enabled);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/kexp/scheduler/:id/run", async (req, res) => {
  try {
    const data = await kexpScheduler.checkOne(req.params.id);
    patchMaterializedSubscriptions();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/kexp/scheduler/:id", (req, res) => {
  kexpScheduler.remove(req.params.id);
  patchMaterializedSubscriptions();
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(rendererDir, "index.html"));
});

if (require.main === module) {
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

  app.listen(PORT, () => {
    console.log(`Kimble's RTE Player API listening on ${PORT}`);
    console.log(`DATA_DIR=${DATA_DIR}`);
    console.log(`DOWNLOAD_DIR=${DOWNLOAD_DIR}`);
  });
}

module.exports = app;
