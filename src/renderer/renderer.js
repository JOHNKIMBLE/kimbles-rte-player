const quickUrlInput = document.getElementById("quickUrlInput");
const quickDownloadBtn = document.getElementById("quickDownloadBtn");
const quickResult = document.getElementById("quickResult");
const quickLog = document.getElementById("quickLog");
const bbcUrlInput = document.getElementById("bbcUrlInput");
const bbcDownloadBtn = document.getElementById("bbcDownloadBtn");
const bbcResult = document.getElementById("bbcResult");
const bbcLog = document.getElementById("bbcLog");
const bbcProgramUrlInput = document.getElementById("bbcProgramUrlInput");
const bbcLoadProgramBtn = document.getElementById("bbcLoadProgramBtn");
const bbcProgramMeta = document.getElementById("bbcProgramMeta");
const bbcPrevPageBtn = document.getElementById("bbcPrevPageBtn");
const bbcNextPageBtn = document.getElementById("bbcNextPageBtn");
const bbcEpisodesResult = document.getElementById("bbcEpisodesResult");
const bbcProgramSearchInput = document.getElementById("bbcProgramSearchInput");
const bbcProgramSearchBtn = document.getElementById("bbcProgramSearchBtn");
const bbcProgramSearchResult = document.getElementById("bbcProgramSearchResult");
const bbcAddScheduleBtn = document.getElementById("bbcAddScheduleBtn");
const bbcScheduleBackfillMode = document.getElementById("bbcScheduleBackfillMode");
const bbcScheduleBackfillCount = document.getElementById("bbcScheduleBackfillCount");
const bbcScheduleList = document.getElementById("bbcScheduleList");
const bbcStationSelect = document.getElementById("bbcStationSelect");
const bbcRefreshLiveBtn = document.getElementById("bbcRefreshLiveBtn");
const bbcLiveNow = document.getElementById("bbcLiveNow");
const bbcLivePlayerFrame = document.getElementById("bbcLivePlayerFrame");
const bbcLiveOverlayPlayBtn = document.getElementById("bbcLiveOverlayPlayBtn");

const tabWwfBtn = document.getElementById("tabWwfBtn");
const wwfTabContent = document.getElementById("wwfTabContent");
const wwfStationSelect = document.getElementById("wwfStationSelect");
const wwfRefreshLiveBtn = document.getElementById("wwfRefreshLiveBtn");
const wwfLiveNow = document.getElementById("wwfLiveNow");
const wwfUrlInput = document.getElementById("wwfUrlInput");
const wwfDownloadBtn = document.getElementById("wwfDownloadBtn");
const wwfResult = document.getElementById("wwfResult");
const wwfProgramUrlInput = document.getElementById("wwfProgramUrlInput");
const wwfLoadProgramBtn = document.getElementById("wwfLoadProgramBtn");
const wwfProgramMeta = document.getElementById("wwfProgramMeta");
const wwfPrevPageBtn = document.getElementById("wwfPrevPageBtn");
const wwfNextPageBtn = document.getElementById("wwfNextPageBtn");
const wwfEpisodesResult = document.getElementById("wwfEpisodesResult");
const wwfProgramSearchInput = document.getElementById("wwfProgramSearchInput");
const wwfProgramSearchBtn = document.getElementById("wwfProgramSearchBtn");
const wwfProgramSearchResult = document.getElementById("wwfProgramSearchResult");
const wwfAddScheduleBtn = document.getElementById("wwfAddScheduleBtn");
const wwfScheduleBackfillMode = document.getElementById("wwfScheduleBackfillMode");
const wwfScheduleBackfillCount = document.getElementById("wwfScheduleBackfillCount");
const wwfScheduleList = document.getElementById("wwfScheduleList");

const tabNtsBtn = document.getElementById("tabNtsBtn");
const ntsTabContent = document.getElementById("ntsTabContent");

const tabFipBtn = document.getElementById("tabFipBtn");
const fipTabContent = document.getElementById("fipTabContent");
const fipStationSelect = document.getElementById("fipStationSelect");
const fipRefreshLiveBtn = document.getElementById("fipRefreshLiveBtn");
const fipLiveNow = document.getElementById("fipLiveNow");
const fipLiveAudio = document.getElementById("fipLiveAudio");
const fipLiveAudioWrap = document.getElementById("fipLiveAudioWrap");
const fipUrlInput = document.getElementById("fipUrlInput");
const fipDownloadBtn = document.getElementById("fipDownloadBtn");
const fipResult = document.getElementById("fipResult");
const fipProgramUrlInput = document.getElementById("fipProgramUrlInput");
const fipLoadProgramBtn = document.getElementById("fipLoadProgramBtn");
const fipProgramMeta = document.getElementById("fipProgramMeta");
const fipPrevPageBtn = document.getElementById("fipPrevPageBtn");
const fipNextPageBtn = document.getElementById("fipNextPageBtn");
const fipEpisodesResult = document.getElementById("fipEpisodesResult");
const fipProgramSearchInput = document.getElementById("fipProgramSearchInput");
const fipProgramSearchBtn = document.getElementById("fipProgramSearchBtn");
const fipProgramSearchResult = document.getElementById("fipProgramSearchResult");
const fipAddScheduleBtn = document.getElementById("fipAddScheduleBtn");
const fipScheduleBackfillMode = document.getElementById("fipScheduleBackfillMode");
const fipScheduleBackfillCount = document.getElementById("fipScheduleBackfillCount");
const fipDiscoverBtn = document.getElementById("fipDiscoverBtn");
const fipDiscoveryResult = document.getElementById("fipDiscoveryResult");
const fipScheduleList = document.getElementById("fipScheduleList");
const tabKexpBtn = document.getElementById("tabKexpBtn");
const kexpTabContent = document.getElementById("kexpTabContent");
const kexpLiveNow = document.getElementById("kexpLiveNow");
const kexpLiveAudio = document.getElementById("kexpLiveAudio");
const kexpLiveAudioWrap = document.getElementById("kexpLiveAudioWrap");
const kexpLiveInfo = document.getElementById("kexpLiveInfo");
const kexpUrlInput = document.getElementById("kexpUrlInput");
const kexpDownloadBtn = document.getElementById("kexpDownloadBtn");
const kexpResult = document.getElementById("kexpResult");
const kexpProgramUrlInput = document.getElementById("kexpProgramUrlInput");
const kexpLoadProgramBtn = document.getElementById("kexpLoadProgramBtn");
const kexpProgramMeta = document.getElementById("kexpProgramMeta");
const kexpPrevPageBtn = document.getElementById("kexpPrevPageBtn");
const kexpNextPageBtn = document.getElementById("kexpNextPageBtn");
const kexpEpisodesResult = document.getElementById("kexpEpisodesResult");
const kexpProgramSearchInput = document.getElementById("kexpProgramSearchInput");
const kexpProgramSearchBtn = document.getElementById("kexpProgramSearchBtn");
const kexpProgramSearchResult = document.getElementById("kexpProgramSearchResult");
const kexpAddScheduleBtn = document.getElementById("kexpAddScheduleBtn");
const kexpScheduleBackfillMode = document.getElementById("kexpScheduleBackfillMode");
const kexpScheduleBackfillCount = document.getElementById("kexpScheduleBackfillCount");
const kexpDiscoverBtn = document.getElementById("kexpDiscoverBtn");
const kexpDiscoveryResult = document.getElementById("kexpDiscoveryResult");
const kexpScheduleList = document.getElementById("kexpScheduleList");
// Extended archive
const kexpExtSearchInput = document.getElementById("kexpExtSearchInput");
const kexpExtSearchBtn = document.getElementById("kexpExtSearchBtn");
const kexpExtDiscoverBtn = document.getElementById("kexpExtDiscoverBtn");
const kexpExtSearchResult = document.getElementById("kexpExtSearchResult");
const kexpExtProgramMeta = document.getElementById("kexpExtProgramMeta");
const kexpExtPaginationRow = document.getElementById("kexpExtPaginationRow");
const kexpExtPrevPageBtn = document.getElementById("kexpExtPrevPageBtn");
const kexpExtNextPageBtn = document.getElementById("kexpExtNextPageBtn");
const kexpExtEpisodesResult = document.getElementById("kexpExtEpisodesResult");
const ntsStationSelect = document.getElementById("ntsStationSelect");
const ntsRefreshLiveBtn = document.getElementById("ntsRefreshLiveBtn");
const ntsLiveNow = document.getElementById("ntsLiveNow");
const ntsLiveAudio = document.getElementById("ntsLiveAudio");
const ntsUrlInput = document.getElementById("ntsUrlInput");
const ntsDownloadBtn = document.getElementById("ntsDownloadBtn");
const ntsResult = document.getElementById("ntsResult");
const ntsProgramUrlInput = document.getElementById("ntsProgramUrlInput");
const ntsLoadProgramBtn = document.getElementById("ntsLoadProgramBtn");
const ntsProgramMeta = document.getElementById("ntsProgramMeta");
const ntsPrevPageBtn = document.getElementById("ntsPrevPageBtn");
const ntsNextPageBtn = document.getElementById("ntsNextPageBtn");
const ntsEpisodesResult = document.getElementById("ntsEpisodesResult");
const ntsProgramSearchInput = document.getElementById("ntsProgramSearchInput");
const ntsProgramSearchBtn = document.getElementById("ntsProgramSearchBtn");
const ntsProgramSearchResult = document.getElementById("ntsProgramSearchResult");
const ntsAddScheduleBtn = document.getElementById("ntsAddScheduleBtn");
const ntsScheduleBackfillMode = document.getElementById("ntsScheduleBackfillMode");
const ntsScheduleBackfillCount = document.getElementById("ntsScheduleBackfillCount");
const ntsScheduleList = document.getElementById("ntsScheduleList");

const stationSelect = document.getElementById("stationSelect");
const refreshLiveBtn = document.getElementById("refreshLiveBtn");
const liveNow = document.getElementById("liveNow");
const livePlayerFrame = document.getElementById("livePlayerFrame");
const liveOverlayPlayBtn = document.getElementById("liveOverlayPlayBtn");

const programSearchInput = document.getElementById("programSearchInput");
const programSearchBtn = document.getElementById("programSearchBtn");
const programSearchResult = document.getElementById("programSearchResult");
const programUrlInput = document.getElementById("programUrlInput");
const loadProgramBtn = document.getElementById("loadProgramBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const addScheduleBtn = document.getElementById("addScheduleBtn");
const scheduleBackfillMode = document.getElementById("scheduleBackfillMode");
const scheduleBackfillCount = document.getElementById("scheduleBackfillCount");
const programMeta = document.getElementById("programMeta");
const episodesResult = document.getElementById("episodesResult");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const scheduleList = document.getElementById("scheduleList");
const timeFormatSelect = document.getElementById("timeFormatSelect");
const downloadDirInput = document.getElementById("downloadDirInput");
const pathFormatInput = document.getElementById("pathFormatInput");
const pathFormatPreview = document.getElementById("pathFormatPreview");
const pathFormatPresetsRow = document.getElementById("pathFormatPresetsRow");
const cueAutoGenerateCheckbox = document.getElementById("cueAutoGenerateCheckbox");
const outputFormatSelect = document.getElementById("outputFormatSelect");
const outputQualitySelect = document.getElementById("outputQualitySelect");
const normalizeLoudnessCheckbox = document.getElementById("normalizeLoudnessCheckbox");
const maxConcurrentInput = document.getElementById("maxConcurrentInput");
const dedupeModeSelect = document.getElementById("dedupeModeSelect");
const id3TaggingCheckbox = document.getElementById("id3TaggingCheckbox");
const feedExportCheckbox = document.getElementById("feedExportCheckbox");
const webhookUrlInput = document.getElementById("webhookUrlInput");
const auddTrackMatchingCheckbox = document.getElementById("auddTrackMatchingCheckbox");
const auddApiTokenInput = document.getElementById("auddApiTokenInput");
const fingerprintTrackMatchingCheckbox = document.getElementById("fingerprintTrackMatchingCheckbox");
const acoustidApiKeyInput = document.getElementById("acoustidApiKeyInput");
const songrecTrackMatchingCheckbox = document.getElementById("songrecTrackMatchingCheckbox");
const songrecSampleSecondsInput = document.getElementById("songrecSampleSecondsInput");
const ffmpegCueSilenceCheckbox = document.getElementById("ffmpegCueSilenceCheckbox");
const ffmpegCueLoudnessCheckbox = document.getElementById("ffmpegCueLoudnessCheckbox");
const ffmpegCueSpectralCheckbox = document.getElementById("ffmpegCueSpectralCheckbox");
const downloadQueueStatus = document.getElementById("downloadQueueStatus");
const downloadQueueActive = document.getElementById("downloadQueueActive");
const downloadQueuePending = document.getElementById("downloadQueuePending");
const downloadQueueRecent = document.getElementById("downloadQueueRecent");
const queuePauseBtn = document.getElementById("queuePauseBtn");
const queueResumeBtn = document.getElementById("queueResumeBtn");
const queueClearBtn = document.getElementById("queueClearBtn");
const chooseDownloadDirBtn = document.getElementById("chooseDownloadDirBtn");
const episodesPerPageInput = document.getElementById("episodesPerPageInput");
const discoveryCountInput = document.getElementById("discoveryCountInput");
const rteDiscoverBtn = document.getElementById("rteDiscoverBtn");
const rteDiscoveryResult = document.getElementById("rteDiscoveryResult");
const bbcDiscoverBtn = document.getElementById("bbcDiscoverBtn");
const bbcDiscoveryResult = document.getElementById("bbcDiscoveryResult");
const wwfDiscoverBtn = document.getElementById("wwfDiscoverBtn");
const wwfDiscoveryResult = document.getElementById("wwfDiscoveryResult");
const ntsDiscoverBtn = document.getElementById("ntsDiscoverBtn");
const ntsDiscoveryResult = document.getElementById("ntsDiscoveryResult");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");
const tabRteBtn = document.getElementById("tabRteBtn");
const tabBbcBtn = document.getElementById("tabBbcBtn");
const tabSchedulesBtn = document.getElementById("tabSchedulesBtn");
const tabSettingsBtn = document.getElementById("tabSettingsBtn");
const rteTabContent = document.getElementById("rteTabContent");
const bbcTabContent = document.getElementById("bbcTabContent");
const schedulesTabContent = document.getElementById("schedulesTabContent");
const settingsTabContent = document.getElementById("settingsTabContent");
const allSchedulesList = document.getElementById("allSchedulesList");
const refreshAllSchedulesBtn = document.getElementById("refreshAllSchedulesBtn");
const nowPlayingBar = document.getElementById("nowPlayingBar");
const nowPlayingTitle = document.getElementById("nowPlayingTitle");
const nowPlayingMeta = document.getElementById("nowPlayingMeta");
const nowPlayingTrack = document.getElementById("nowPlayingTrack");
const nowPlayingImage = document.getElementById("nowPlayingImage");
const nowPlayingAudio = document.getElementById("nowPlayingAudio");
const nowPlayingCloseBtn = document.getElementById("nowPlayingCloseBtn");
const nowPlayingChapterControls = document.getElementById("nowPlayingChapterControls");
const nowPlayingPrevChapterBtn = document.getElementById("nowPlayingPrevChapterBtn");
const nowPlayingNextChapterBtn = document.getElementById("nowPlayingNextChapterBtn");
const nowPlayingResumeBtn = document.getElementById("nowPlayingResumeBtn");

function updateResumeBadge() {
  if (!nowPlayingResumeBtn) return;
  const key = activeNowPlaying?.playbackKey;
  if (!key) { nowPlayingResumeBtn.style.display = "none"; return; }
  const pos = loadResumePosition(key);
  if (!pos || pos < 5) { nowPlayingResumeBtn.style.display = "none"; return; }
  nowPlayingResumeBtn.textContent = `Resume from ${formatDurationFromSeconds(Math.floor(pos))}`;
  nowPlayingResumeBtn.style.display = "";
}
const DEFAULT_NOW_PLAYING_ART = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'%3E%3Crect width='56' height='56' rx='8' fill='%231f2a3a'/%3E%3Ccircle cx='28' cy='28' r='17' fill='%2335445a'/%3E%3Cpath d='M21 20h4v16h-4zM31 20l10 8-10 8z' fill='%23c9d6e8'/%3E%3C/svg%3E";

const RESUME_KEY_PREFIX = "resume:";
let resumeSaveTimer = null;

function saveResumePosition(key, pos) {
  if (!key || pos < 5) return;
  try { localStorage.setItem(RESUME_KEY_PREFIX + key, String(pos)); } catch {}
}
function loadResumePosition(key) {
  if (!key) return null;
  try { const v = localStorage.getItem(RESUME_KEY_PREFIX + key); return v ? parseFloat(v) || null : null; } catch { return null; }
}
function clearResumePosition(key) {
  if (!key) return;
  try { localStorage.removeItem(RESUME_KEY_PREFIX + key); } catch {}
}

const state = {
  liveStations: [],
  bbcLiveStations: [],
  currentProgramUrl: "",
  currentProgramPage: 1,
  currentMaxPages: 1,
  currentEpisodes: null,
  bbcProgramUrl: "",
  bbcProgramPage: 1,
  bbcProgramMaxPages: 1,
  bbcEpisodesPayload: null,
  hasLoadedBbcProgramCatalog: false,
  theme: "dark",
  hasLoadedProgramCatalog: false,
  timeFormat: "24h",
  downloadDir: "",
  pathFormat: "{radio}/{program}/{episode_short} {release_date}",
  cueAutoGenerate: false,
  outputFormat: "m4a",
  outputQuality: "128K",
  normalizeLoudness: true,
  maxConcurrentDownloads: 2,
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
  ffmpegCueSpectralDetect: true,
  activeTab: "rte",
  lastSourceTab: "rte",
  canPickDownloadDirectory: true,
  rteDownloadedAudioByClip: {},
  bbcDownloadedAudioByEpisode: {},
  rteTracksByClip: {},
  bbcTracksByEpisode: {},
  wwfTracksByEpisode: {},
  rteChaptersByClip: {},
  bbcChaptersByEpisode: {},
  wwfChaptersByEpisode: {},
  wwfLiveStations: [],
  wwfProgramUrl: "",
  wwfProgramPage: 1,
  wwfProgramMaxPages: 1,
  wwfEpisodesPayload: null,
  wwfDownloadedAudioByEpisode: {},
  ntsTracksByEpisode: {},
  ntsChaptersByEpisode: {},
  ntsLiveStations: [],
  ntsProgramUrl: "",
  ntsProgramPage: 1,
  ntsProgramMaxPages: 1,
  ntsEpisodesPayload: null,
  ntsDownloadedAudioByEpisode: {},
  fipLiveStations: [],
  fipProgramUrl: "",
  fipProgramPage: 1,
  fipProgramMaxPages: 1,
  fipEpisodesPayload: null,
  fipDownloadedAudioByEpisode: {},
  kexpProgramUrl: "",
  kexpProgramPage: 1,
  kexpProgramMaxPages: 1,
  kexpEpisodesPayload: null,
  kexpDownloadedAudioByEpisode: {},
  kexpTracksByEpisode: {},
  kexpChaptersByEpisode: {},
  kexpExtProgramUrl: "",
  kexpExtProgramPage: 1,
  kexpExtProgramMaxPages: 1,
  kexpExtDownloadedAudioByEpisode: {},
  fipTracksByEpisode: {},
  fipChaptersByEpisode: {},
  episodesPerPage: 5,
  discoveryCount: 5
};
const DEFAULT_EPISODES_PER_PAGE = 5;
const DEFAULT_DISCOVERY_COUNT = 5;
function getEpisodesPerPage() {
  return state.episodesPerPage || DEFAULT_EPISODES_PER_PAGE;
}
function getDiscoveryCount() {
  return state.discoveryCount || DEFAULT_DISCOVERY_COUNT;
}
let searchDebounceTimer = null;
let wwfSearchDebounceTimer = null;
let ntsSearchDebounceTimer = null;
let fipSearchDebounceTimer = null;
let bbcSearchDebounceTimer = null;
let kexpSearchDebounceTimer = null;
const downloadProgressHandlers = new Map();
let queueRefreshTimer = null;
let scheduleRefreshTimer = null;
let fipLiveInterval = null;
let kexpLiveInterval = null;
let healthDashboardTimer = null;
let activeNowPlaying = null;
let activeHls = null;
let pendingNowPlayingVisible = false;
const cuePreviewInflight = new Map();
const cueDebugState = new Map();

window.rteDownloader.onDownloadProgress((payload) => {
  const token = payload?.token;
  if (!token || !downloadProgressHandlers.has(token)) {
    return;
  }

  const handler = downloadProgressHandlers.get(token);
  if (typeof handler === "function") {
    handler(payload);
  }
});

function createProgressToken(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function attachDownloadProgress(token, handler) {
  downloadProgressHandlers.set(token, handler);
  return () => {
    downloadProgressHandlers.delete(token);
  };
}

function formatProgressText(progress, fallbackText) {
  if (!progress) {
    return fallbackText;
  }

  if (progress.kind === "download") {
    const percent = Number.isFinite(progress.percent) ? `${progress.percent.toFixed(1)}%` : "";
    const frag = progress.fragmentCurrent && progress.fragmentTotal
      ? ` (frag ${progress.fragmentCurrent}/${progress.fragmentTotal})`
      : "";
    return `Downloading... ${percent}${frag}`.trim();
  }

  if (progress.kind === "extractaudio") {
    return "Converting to MP3...";
  }

  if (progress.kind === "fixupm3u8") {
    return "Finalizing stream container...";
  }

  if (progress.kind === "cue") {
    return progress.message || fallbackText;
  }

  if (progress.kind === "generic" || progress.kind === "info" || progress.kind === "hlsnative") {
    return progress.message || fallbackText;
  }

  return progress.message || fallbackText;
}

function escapeHtml(text) {
  return decodeHtmlEntities(String(text || ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format NTS live time slot in user's local timezone (e.g. CST). */
function formatNtsTimeSlotLocal(startTimestamp, endTimestamp) {
  if (!startTimestamp || !endTimestamp) return "";
  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);
  const opts = { hour: "2-digit", minute: "2-digit", hour12: false };
  return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

function decodeHtmlEntities(input) {
  let value = String(input || "");
  // Decode a couple of rounds to handle nested encodings like &amp;#x27;
  for (let i = 0; i < 2; i += 1) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    const decoded = textarea.value;
    if (decoded === value) {
      break;
    }
    value = decoded;
  }
  return value;
}

function normalizeOutputFormatValue(input) {
  return String(input || "").trim().toLowerCase() === "mp3" ? "mp3" : "m4a";
}

function setQuickStatus(text, isError = false) {
  quickResult.className = `status ${isError ? "" : "muted"}`;
  quickResult.textContent = text;
}

function setBbcStatus(text, isError = false) {
  bbcResult.className = `status ${isError ? "" : "muted"}`;
  bbcResult.textContent = text;
}

function setButtonBusy(button, busy, normalLabel, busyLabel = "Working...") {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : normalLabel;
}

function setSettingsStatus(text, isError = false) {
  settingsStatus.className = `status ${isError ? "" : "muted"}`;
  settingsStatus.textContent = text;
}

function shouldArmForceRetry(message) {
  return /click\s+download\s+again\s+to\s+force/i.test(String(message || ""));
}

function formatCueAlignment(cue) {
  const method = String(cue?.alignment?.method || "").trim();
  const confidenceRaw = Number(cue?.alignment?.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? `${Math.round(confidenceRaw * 100)}%` : "";
  const reason = String(cue?.alignment?.reason || "").trim();
  const auddDetections = Number(cue?.alignment?.auddWindows?.detections || 0);
  const acoustidScoreRaw = Number(cue?.alignment?.acoustid?.score ?? cue?.acoustid?.score);
  const acoustidScore = Number.isFinite(acoustidScoreRaw) ? `acoustid ${Math.round(acoustidScoreRaw * 100)}%` : "";
  const songrecDetections = Number(cue?.alignment?.songrec?.detections || 0);
  const songrecMatched = Number(cue?.alignment?.songrec?.matched || 0);
  const insertedRecognitionTracks = Number(cue?.alignment?.insertedRecognitionTracks || 0);
  const landmarkSummary = cue?.alignment?.landmarks || null;
  const silenceCount = Number(landmarkSummary?.silenceCount || 0);
  const loudnessCount = Number(landmarkSummary?.loudnessCount || 0);
  const spectralCount = Number(landmarkSummary?.spectralCount || 0);
  const mergedCount = Number(landmarkSummary?.mergedCount || 0);
  const parts = [];
  if (method) {
    parts.push(method.replace(/[-_]+/g, " "));
  }
  if (confidence) {
    parts.push(confidence);
  }
  if (auddDetections > 0) {
    parts.push(`audd ${auddDetections}`);
  }
  if (acoustidScore) {
    parts.push(acoustidScore);
  }
  if (songrecDetections > 0) {
    parts.push(`songrec ${songrecMatched}/${songrecDetections}`);
  }
  if (insertedRecognitionTracks > 0) {
    parts.push(`inferred +${insertedRecognitionTracks}`);
  }
  if (mergedCount > 0) {
    parts.push(`landmarks ${mergedCount} (s${silenceCount}/l${loudnessCount}/f${spectralCount})`);
  }
  if (reason) {
    parts.push(reason);
  }
  if (!parts.length) {
    return "";
  }
  return ` (${parts.join(", ")})`;
}

function formatCueSource(cue) {
  const source = String(cue?.source || "").trim().toLowerCase();
  if (!source || source === "none") {
    return "";
  }
  const labels = {
    "external-tracklist": "external tracklist",
    "rte-episode-playlist": "RTE episode playlist",
    "bbc-music-played": "BBC music played",
    "common-tracklist-sites": "common tracklist sites",
    "common-tracklist-sites+acoustid": "common tracklist sites + AcoustID",
    "window-recognition-audd": "AudD window recognition",
    "window-recognition-audd+acoustid": "AudD + AcoustID window recognition",
    "window-recognition-audd+songrec": "AudD + Songrec window recognition",
    "window-recognition-audd+acoustid+songrec": "AudD + AcoustID + Songrec window recognition",
    "window-recognition-songrec": "Songrec window recognition",
    "window-recognition-acoustid": "AcoustID window recognition",
    "window-recognition-songrec+acoustid": "Songrec + AcoustID window recognition",
    "window-recognition-acoustid+songrec": "AcoustID + Songrec window recognition",
    "window-recognition-acoustid+audd": "AcoustID + AudD window recognition",
    "window-recognition-songrec+audd": "Songrec + AudD window recognition",
    "window-recognition-acoustid+songrec+audd": "AcoustID + Songrec + AudD window recognition"
  };
  const label = labels[source] || source.replace(/[-_]+/g, " ");
  return ` from ${label}`;
}

function formatLocalDateTime(input) {
  const text = String(input || "").trim();
  if (!text) {
    return "";
  }
  const dt = new Date(text);
  if (!Number.isFinite(dt.getTime())) {
    return text;
  }
  return dt.toLocaleString();
}

function formatLocalDate(input) {
  const text = String(input || "").trim();
  if (!text) {
    return "";
  }
  const dt = new Date(text);
  if (!Number.isFinite(dt.getTime())) {
    return text;
  }
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function parseDatePartsFromText(input) {
  const text = String(input || "");
  const monthMap = new Map([
    ["jan", 1], ["january", 1],
    ["feb", 2], ["february", 2],
    ["mar", 3], ["march", 3],
    ["apr", 4], ["april", 4],
    ["may", 5],
    ["jun", 6], ["june", 6],
    ["jul", 7], ["july", 7],
    ["aug", 8], ["august", 8],
    ["sep", 9], ["sept", 9], ["september", 9],
    ["oct", 10], ["october", 10],
    ["nov", 11], ["november", 11],
    ["dec", 12], ["december", 12]
  ]);

  const dmyWord = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,10})\s+(\d{4})\b/);
  if (dmyWord) {
    const day = Number(dmyWord[1]);
    const month = monthMap.get(String(dmyWord[2] || "").toLowerCase()) || 0;
    const year = Number(dmyWord[3]);
    if (day > 0 && month > 0 && year > 0) {
      return { year, month, day };
    }
  }

  const dmySlash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (dmySlash) {
    const day = Number(dmySlash[1]);
    const month = Number(dmySlash[2]);
    const year = Number(dmySlash[3]);
    if (day > 0 && month > 0 && year > 0) {
      return { year, month, day };
    }
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (day > 0 && month > 0 && year > 0) {
      return { year, month, day };
    }
  }

  return null;
}

function utcDateTimeToLocalString({ year, month, day, hour, minute }) {
  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute);
  const localDate = new Date(utcTimestamp);
  if (!Number.isFinite(localDate.getTime())) {
    return "";
  }
  return localDate.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: state.timeFormat === "12h"
  });
}

function localizeNextBroadcast(nextBroadcastAt) {
  const text = String(nextBroadcastAt || "").trim();
  if (!text) {
    return "";
  }
  // Try ISO date first (e.g. "2026-03-11T14:00:00.000Z")
  const isoDate = new Date(text);
  if (Number.isFinite(isoDate.getTime())) {
    return isoDate.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: state.timeFormat === "12h"
    });
  }
  // Fallback: parse date parts + time from text (UTC)
  const dateParts = parseDatePartsFromText(text);
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!dateParts || !timeMatch) {
    return "";
  }
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return "";
  }
  return utcDateTimeToLocalString({ ...dateParts, hour, minute }) || "";
}

function formatRunScheduleLocalOnly(runScheduleText) {
  const text = String(runScheduleText || "").trim();
  if (!text) {
    return "";
  }
  return text.replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, (_all, start, end) => {
    return `${utcTimeToLocal(start)} - ${utcTimeToLocal(end)}`;
  });
}

function hhmmToMinutes(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    return null;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

function minutesToHhMm(totalMinutes) {
  const minutesInDay = 24 * 60;
  let value = Number(totalMinutes || 0);
  while (value < 0) {
    value += minutesInDay;
  }
  value %= minutesInDay;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatSchedulerCheckWindowLocal(runScheduleText) {
  const text = String(runScheduleText || "").trim();
  if (!text) {
    return "";
  }
  const segments = text.split(/\s*,\s*/g);
  const windows = [];
  for (const segment of segments) {
    const match = segment.match(/^(.*?)\s*[•]\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
    if (!match) {
      continue;
    }
    const dayText = String(match[1] || "").trim();
    const endMin = hhmmToMinutes(match[3]);
    if (endMin == null) {
      continue;
    }
    const checkStart = minutesToHhMm(endMin + 30);
    const checkEnd = minutesToHhMm(endMin + 6 * 60);
    windows.push(`${dayText} • ${utcTimeToLocal(checkStart)} - ${utcTimeToLocal(checkEnd)}`);
  }
  return windows.join(", ");
}

function looksLikeDateOnlyText(input) {
  const text = String(input || "").trim();
  if (!text) {
    return false;
  }
  return (
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text) ||
    /^\d{4}-\d{2}-\d{2}$/.test(text) ||
    /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/i.test(text)
  );
}

async function getLocalCueChaptersSafe(outputDir, fileName) {
  if (!window.rteDownloader?.getLocalCueChapters) {
    return [];
  }
  try {
    const chapters = await window.rteDownloader.getLocalCueChapters(outputDir, fileName);
    return normalizeChapters(chapters || []);
  } catch {
    return [];
  }
}

async function playFromDownloadedFile({
  outputDir,
  fileName,
  title = "",
  source = "Local",
  subtitle = "",
  image = "",
  episodeUrl = "",
  sourceType = ""
}) {
  const safeOutputDir = String(outputDir || "").trim();
  const safeFileName = String(fileName || "").trim();
  if (!safeOutputDir || !safeFileName) {
    throw new Error("No downloaded file path available.");
  }
  const safeEpisodeUrl = String(episodeUrl || "").trim();
  const safeSourceType = String(sourceType || "").trim().toLowerCase();
  if (safeEpisodeUrl && (safeSourceType === "rte" || safeSourceType === "bbc" || safeSourceType === "wwf" || safeSourceType === "nts")) {
    const cacheKey = safeEpisodeUrl;
    await playEpisodeWithBackgroundCue({
      sourceType: safeSourceType,
      cacheKey,
      sourceLabel: source,
      title: title || safeFileName,
      subtitle,
      image,
      episodeUrl: safeEpisodeUrl,
      durationSeconds: 0,
      outputDir: safeOutputDir,
      fileName: safeFileName,
      playbackKey: `${safeSourceType}:local:${cacheKey}`
    });
    return;
  }

  const url = await window.rteDownloader.getLocalPlaybackUrl(safeOutputDir, safeFileName);
  const cueChapters = await getLocalCueChaptersSafe(safeOutputDir, safeFileName);
  await startGlobalNowPlaying({
    source,
    title: title || safeFileName,
    subtitle,
    image,
    streamUrl: url,
    chapters: cueChapters,
    tracks: []
  });
}

function getTracksCache(sourceType) {
  if (sourceType === "bbc")  return state.bbcTracksByEpisode;
  if (sourceType === "wwf")  return state.wwfTracksByEpisode;
  if (sourceType === "nts")  return state.ntsTracksByEpisode;
  if (sourceType === "kexp") return state.kexpTracksByEpisode;
  if (sourceType === "fip")  return state.fipTracksByEpisode;
  return state.rteTracksByClip;
}

function getChaptersCache(sourceType) {
  if (sourceType === "bbc")  return state.bbcChaptersByEpisode;
  if (sourceType === "wwf")  return state.wwfChaptersByEpisode;
  if (sourceType === "nts")  return state.ntsChaptersByEpisode;
  if (sourceType === "kexp") return state.kexpChaptersByEpisode;
  if (sourceType === "fip")  return state.fipChaptersByEpisode;
  return state.rteChaptersByClip;
}

function setCachedTracks(sourceType, cacheKey, tracks) {
  getTracksCache(sourceType)[String(cacheKey || "")] = Array.isArray(tracks) ? tracks : [];
}

function getCachedTracks(sourceType, cacheKey) {
  return Array.isArray(getTracksCache(sourceType)[String(cacheKey || "")])
    ? getTracksCache(sourceType)[String(cacheKey || "")]
    : [];
}

function getCachedChapters(sourceType, cacheKey) {
  return normalizeChapters(getChaptersCache(sourceType)[String(cacheKey || "")] || []);
}

function setCachedChapters(sourceType, cacheKey, chapters) {
  if (sourceType === "bbc") {
    setBbcEpisodeChapters(cacheKey, chapters);
    return;
  }
  if (sourceType === "wwf") {
    state.wwfChaptersByEpisode[String(cacheKey || "")] = Array.isArray(chapters) ? chapters : [];
    return;
  }
  if (sourceType === "nts") {
    state.ntsChaptersByEpisode[String(cacheKey || "")] = Array.isArray(chapters) ? chapters : [];
    return;
  }
  if (sourceType === "kexp") {
    state.kexpChaptersByEpisode[String(cacheKey || "")] = Array.isArray(chapters) ? chapters : [];
    return;
  }
  if (sourceType === "fip") {
    setFipEpisodeChapters(cacheKey, chapters);
    return;
  }
  setEpisodeChapters(cacheKey, chapters);
}

async function ensureEpisodeTracks(sourceType, cacheKey, episodeUrl) {
  const cached = normalizeTracks(getCachedTracks(sourceType, cacheKey));
  if (cached.length || !episodeUrl) {
    return cached;
  }
  try {
    let payload;
    if (sourceType === "bbc") {
      payload = await window.rteDownloader.getBbcEpisodePlaylist(episodeUrl);
    } else if (sourceType === "wwf") {
      payload = await window.rteDownloader.getWwfEpisodePlaylist(episodeUrl);
    } else if (sourceType === "nts") {
      payload = await window.rteDownloader.getNtsEpisodePlaylist(episodeUrl);
    } else if (sourceType === "kexp") {
      const kexpTracks = await window.rteDownloader.getKexpEpisodeTracklist(episodeUrl);
      payload = { tracks: Array.isArray(kexpTracks) ? kexpTracks : (kexpTracks?.tracks || []) };
    } else if (sourceType === "fip") {
      const fipData = await window.rteDownloader.getFipEpisodeTracklist(episodeUrl);
      payload = { tracks: Array.isArray(fipData) ? fipData : (fipData?.tracks || []) };
    } else {
      payload = await window.rteDownloader.getEpisodePlaylist(episodeUrl);
    }
    const tracks = normalizeTracks(payload?.tracks || []);
    setCachedTracks(sourceType, cacheKey, tracks);
    return tracks;
  } catch {
    return [];
  }
}

function updateActiveNowPlayingChapters(playbackKey, chapters) {
  if (!activeNowPlaying || activeNowPlaying.playbackKey !== String(playbackKey || "")) {
    return;
  }
  activeNowPlaying.chapters = normalizeChapters(chapters || []);
  activeNowPlaying.chaptersFromTracks = false;
  refreshNowPlayingTrackLabel();
}

async function queueBackgroundCuePreview({
  sourceType,
  cacheKey,
  playbackKey,
  episodeUrl = "",
  clipId = "",
  title = "",
  programTitle = "",
  streamUrl = "",
  durationSeconds = 0,
  outputDir = "",
  fileName = "",
  fileStartOffset = 0,
  statusUpdater = null
}) {
  const inflightKey = `${sourceType}:${cacheKey}:${outputDir && fileName ? "local" : "remote"}`;
  if (cuePreviewInflight.has(inflightKey)) {
    return cuePreviewInflight.get(inflightKey);
  }

  clearCueDebugLog(sourceType, cacheKey);
  const progressToken = createProgressToken(`cue-${sourceType}`);
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    if (progress?.kind === "cue" && progress?.message) {
      appendCueDebugLog(sourceType, cacheKey, progress.message);
    }
    if (typeof statusUpdater === "function") {
      statusUpdater(formatProgressText(progress, "Cue: Building chapters..."));
    }
  });

  const job = (async () => {
    try {
      if (typeof statusUpdater === "function") {
        statusUpdater("Playback started. Building chapters in background...");
      }
      const cue = await window.rteDownloader.previewCue({
        sourceType,
        episodeUrl,
        clipId,
        title,
        programTitle,
        streamUrl,
        durationSeconds,
        outputDir,
        fileName,
        fileStartOffset,
        progressToken
      });
      if (Array.isArray(cue?.chapters) && cue.chapters.length) {
        setCachedChapters(sourceType, cacheKey, cue.chapters);
        updateActiveNowPlayingChapters(playbackKey, cue.chapters);
        if (typeof statusUpdater === "function") {
          statusUpdater(`Chapters ready${formatCueSource(cue)}${formatCueAlignment(cue)}`);
        }
      } else if (typeof statusUpdater === "function") {
        statusUpdater("No tracklist or recognition matches found yet. Playback will continue without chapter skips.");
      }
      return cue;
    } catch (error) {
      if (typeof statusUpdater === "function") {
        statusUpdater(`Chapter alignment failed: ${error.message}`, true);
      }
      return null;
    } finally {
      detachProgress();
      cuePreviewInflight.delete(inflightKey);
    }
  })();

  cuePreviewInflight.set(inflightKey, job);
  return job;
}

async function playEpisodeWithBackgroundCue({
  sourceType,
  cacheKey,
  sourceLabel,
  title,
  programTitle = "",
  subtitle = "",
  image = "",
  episodeUrl = "",
  clipId = "",
  durationSeconds = 0,
  outputDir = "",
  fileName = "",
  streamUrl = "",
  playbackKey = "",
  startOffset = 0,
  statusUpdater = null
}) {
  const raw = String(sourceType || "").toLowerCase();
  const safeSourceType = raw === "bbc" ? "bbc" : raw === "wwf" ? "wwf" : raw === "nts" ? "nts" : raw === "fip" ? "fip" : raw === "kexp" ? "kexp" : "rte";
  const safeCacheKey = String(cacheKey || "").trim();
  const safePlaybackKey = String(playbackKey || `${safeSourceType}:${safeCacheKey}`).trim();
  const safeEpisodeUrl = String(episodeUrl || "").trim();
  const safeOutputDir = String(outputDir || "").trim();
  const safeFileName = String(fileName || "").trim();
  const tracks = await ensureEpisodeTracks(safeSourceType, safeCacheKey, safeEpisodeUrl);
  let chapters = getCachedChapters(safeSourceType, safeCacheKey);
  let chaptersFromTracks = false;
  let resolvedStreamUrl = String(streamUrl || "").trim();
  let hasResolvedCue = chapters.length > 0;

  if (safeOutputDir && safeFileName) {
    resolvedStreamUrl = await window.rteDownloader.getLocalPlaybackUrl(safeOutputDir, safeFileName);
    const localCueChapters = await getLocalCueChaptersSafe(safeOutputDir, safeFileName);
    if (localCueChapters.length) {
      chapters = localCueChapters;
      hasResolvedCue = true;
      setCachedChapters(safeSourceType, safeCacheKey, localCueChapters);
    }
  }

  if (!chapters.length) {
    chapters = estimateChaptersFromTracks(tracks, durationSeconds);
    chaptersFromTracks = chapters.length > 0;
  }

  // If the audio file has a start offset (e.g. KEXP sg-offset), shift all chapter
  // positions so they align with the correct currentTime in the audio element.
  const safeStartOffset = Number(startOffset) || 0;
  if (safeStartOffset > 0 && chaptersFromTracks && chapters.length) {
    chapters = chapters.map((ch) => ({ ...ch, startSec: (ch.startSec || 0) + safeStartOffset }));
  }

  await startGlobalNowPlaying({
    source: sourceLabel,
    title,
    subtitle,
    image,
    streamUrl: resolvedStreamUrl,
    chapters,
    tracks,
    chaptersFromTracks,
    playbackKey: safePlaybackKey,
    startOffset: Number(startOffset) || 0
  });

  if (!hasResolvedCue) {
    queueBackgroundCuePreview({
      sourceType: safeSourceType,
      cacheKey: safeCacheKey,
      playbackKey: safePlaybackKey,
      episodeUrl: safeEpisodeUrl,
      clipId: String(clipId || "").trim(),
      title,
      programTitle: String(programTitle || "").trim(),
      streamUrl: resolvedStreamUrl,
      durationSeconds,
      outputDir: safeOutputDir,
      fileName: safeFileName,
      fileStartOffset: Number(startOffset) || 0,
      statusUpdater
    }).catch(() => {});
  }
}

function renderQueueItems(container, rows, allowCancel = false) {
  if (!container) {
    return;
  }
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    container.innerHTML = `<div class="item"><div class="item-meta">None</div></div>`;
    return;
  }
  container.innerHTML = list
    .map((row) => `
      <div class="item">
        <div class="item-title">${escapeHtml(String(row.label || "Download"))}</div>
        <div class="item-meta">${escapeHtml(String(row.sourceType || "").toUpperCase() || "MEDIA")} • ${escapeHtml(String(row.status || ""))}</div>
        ${row.endedAt ? `<div class="item-meta">Finished: ${escapeHtml(formatLocalDateTime(row.endedAt))}</div>` : ""}
        ${row.filePath ? `<div class="item-meta">Path: ${escapeHtml(row.filePath)}</div>` : ""}
        <div class="item-actions">
          ${allowCancel ? `<button class="secondary" data-queue-cancel="${escapeHtml(String(row.id || ""))}">Cancel</button>` : ""}
          ${row.outputDir && row.fileName ? `<button class="secondary" data-queue-play="${escapeHtml(String(row.outputDir || ""))}" data-queue-file="${escapeHtml(String(row.fileName || ""))}" data-queue-title="${escapeHtml(String(row.label || row.fileName || "Download"))}" data-queue-source="${escapeHtml(String(row.sourceType || "local").toUpperCase())}" data-queue-image="${escapeHtml(String(row.image || ""))}">Play</button>` : ""}
        </div>
      </div>
    `)
    .join("");
}

function renderQueueSnapshot(snapshot) {
  const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
  const activeCount = Number(snap.activeCount || 0);
  const queuedCount = Number(snap.queuedCount || 0);
  const maxConcurrent = Number(snap.maxConcurrent || state.maxConcurrentDownloads || 1);
  const paused = Boolean(snap.paused);
  if (downloadQueueStatus) {
    downloadQueueStatus.textContent = `Active: ${activeCount} • Queued: ${queuedCount} • Max: ${maxConcurrent} • ${paused ? "Paused" : "Running"}`;
  }
  renderQueueItems(downloadQueueActive, snap.active || [], true);
  renderQueueItems(downloadQueuePending, snap.queued || [], true);
  renderQueueItems(downloadQueueRecent, snap.recent || [], false);
}

async function refreshDownloadQueueSnapshot() {
  if (!window.rteDownloader?.getDownloadQueueSnapshot) {
    return;
  }
  try {
    const snapshot = await window.rteDownloader.getDownloadQueueSnapshot();
    renderQueueSnapshot(snapshot);
  } catch {}
}

function updateDownloadDirPickerUi() {
  if (!chooseDownloadDirBtn) {
    return;
  }
  const canPick = Boolean(state.canPickDownloadDirectory);
  chooseDownloadDirBtn.disabled = !canPick;
  chooseDownloadDirBtn.title = canPick
    ? "Open folder picker"
    : "Folder picker is only available in Electron desktop build. Edit path manually here.";
}

function getActiveDownloadDir() {
  return state.downloadDir;
}

function setActiveDownloadDir(dir) {
  state.downloadDir = String(dir || "").trim();
}

function parseReleaseDate(input) {
  const text = String(input || "").trim();
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    return iso[1];
  }
  const dmy = text.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (!dmy) {
    return "YYYY-MM-DD";
  }
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const idx = months.indexOf(String(dmy[2]).toLowerCase());
  if (idx < 0) {
    return "YYYY-MM-DD";
  }
  return `${dmy[3]}-${String(idx + 1).padStart(2, "0")}-${String(Number(dmy[1])).padStart(2, "0")}`;
}

function renderPathFormatPreview() {
  if (!pathFormatPreview) {
    return;
  }
  const format = String(pathFormatInput?.value || state.pathFormat || "").trim();
  if (!format) {
    pathFormatPreview.textContent = "Preview: (empty format)";
    return;
  }
  const sampleProgram = state.currentEpisodes?.title || state.bbcEpisodesPayload?.title || "2FM Greene Room with Jenny Greene";
  const sampleEpisode = "Wednesday 4 March 2026";
  const sampleDate = parseReleaseDate(state.currentEpisodes?.episodes?.[0]?.publishedTime || state.bbcEpisodesPayload?.episodes?.[0]?.publishedTime || "2026-03-04");
  const [year = "2026", month = "03", day = "04"] = sampleDate.split("-");
  const sample = format
    .replace(/\{radio\}/gi, "RTE")
    .replace(/\{program\}/gi, sampleProgram)
    .replace(/\{program_slug\}/gi, "2fm-greene-room-with-jenny-greene")
    .replace(/\{episode_short\}/gi, "Wednesday 4 March 2026")
    .replace(/\{episode\}/gi, sampleEpisode)
    .replace(/\{episode_slug\}/gi, "wednesday-4-march-2026")
    .replace(/\{release_date\}/gi, sampleDate)
    .replace(/\{year\}/gi, year)
    .replace(/\{month\}/gi, month)
    .replace(/\{day\}/gi, day)
    .replace(/\{date_compact\}/gi, `${year}${month}${day}`)
    .replace(/\{source_id\}/gi, "11783152");
  const ext = String(outputFormatSelect?.value || state.outputFormat || "m4a")
    .replace(/^\./, "")
    .toLowerCase();
  pathFormatPreview.textContent = `Preview: ${sample}.${ext || "m4a"}`;
}

function setActiveTab(tabName) {
  const valid = ["bbc", "wwf", "nts", "fip", "kexp", "schedules", "settings"];
  state.activeTab = valid.includes(tabName) ? tabName : "rte";
  if (["rte", "bbc", "wwf", "nts", "fip", "kexp"].includes(state.activeTab)) {
    state.lastSourceTab = state.activeTab;
  }
  const isRte = state.activeTab === "rte";
  const isBbc = state.activeTab === "bbc";
  const isWwf = state.activeTab === "wwf";
  const isNts = state.activeTab === "nts";
  const isFip = state.activeTab === "fip";
  const isKexp = state.activeTab === "kexp";
  const isSchedules = state.activeTab === "schedules";
  const isSettings = state.activeTab === "settings";
  rteTabContent.classList.toggle("hidden", !isRte);
  bbcTabContent.classList.toggle("hidden", !isBbc);
  if (wwfTabContent) wwfTabContent.classList.toggle("hidden", !isWwf);
  if (ntsTabContent) ntsTabContent.classList.toggle("hidden", !isNts);
  if (fipTabContent) fipTabContent.classList.toggle("hidden", !isFip);
  if (kexpTabContent) kexpTabContent.classList.toggle("hidden", !isKexp);
  if (schedulesTabContent) schedulesTabContent.classList.toggle("hidden", !isSchedules);
  if (settingsTabContent) settingsTabContent.classList.toggle("hidden", !isSettings);
  tabRteBtn.classList.toggle("active-tab", isRte);
  tabBbcBtn.classList.toggle("active-tab", isBbc);
  if (tabWwfBtn) tabWwfBtn.classList.toggle("active-tab", isWwf);
  if (tabNtsBtn) tabNtsBtn.classList.toggle("active-tab", isNts);
  if (tabFipBtn) tabFipBtn.classList.toggle("active-tab", isFip);
  if (tabKexpBtn) tabKexpBtn.classList.toggle("active-tab", isKexp);
  if (tabSchedulesBtn) tabSchedulesBtn.classList.toggle("active-tab", isSchedules);
  tabSettingsBtn.classList.toggle("active-tab", isSettings);
  if (isSchedules) {
    renderAllSchedules().catch(() => {});
  } else {
    clearInterval(healthDashboardTimer);
    healthDashboardTimer = null;
  }
  if (isWwf) {
    if (wwfStationSelect && state.wwfLiveStations.length === 0 && window.rteDownloader?.getWwfLiveStations) {
      window.rteDownloader.getWwfLiveStations().then((stations) => {
        state.wwfLiveStations = stations || [];
        if (wwfStationSelect && state.wwfLiveStations.length) {
          wwfStationSelect.innerHTML = state.wwfLiveStations.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("");
        }
      }).catch(() => {});
    }
    refreshWwfLiveNow().catch(() => {});
    renderWwfScheduleList().catch(() => {});
  }
  if (isNts) {
    if (ntsStationSelect && state.ntsLiveStations.length === 0 && window.rteDownloader?.getNtsLiveStations) {
      window.rteDownloader.getNtsLiveStations().then((stations) => {
        state.ntsLiveStations = stations || [];
        if (ntsStationSelect && state.ntsLiveStations.length) {
          ntsStationSelect.innerHTML = state.ntsLiveStations.map((s) => {
            const streamUrl = (s.streamUrl || "").trim();
            return `<option value="${escapeHtml(s.id)}"${streamUrl ? ` data-stream-url="${escapeHtml(streamUrl)}"` : ""}>${escapeHtml(s.name)}</option>`;
          }).join("");
          const firstWithStream = state.ntsLiveStations.find((s) => (s.streamUrl || "").trim());
          if (firstWithStream && ntsLiveAudio) {
            ntsLiveAudio.src = firstWithStream.streamUrl || "";
          }
          refreshNtsLiveNow().catch(() => {});
        }
      }).catch(() => {});
    } else if (ntsStationSelect && state.ntsLiveStations.length > 0) {
      refreshNtsLiveNow().catch(() => {});
    }
    renderNtsScheduleList().catch(() => {});
  }
  if (isFip) {
    if (fipStationSelect && state.fipLiveStations.length === 0 && window.rteDownloader?.getFipLiveStations) {
      window.rteDownloader.getFipLiveStations().then((stations) => {
        state.fipLiveStations = Array.isArray(stations) ? stations : [];
        if (fipStationSelect && state.fipLiveStations.length) {
          fipStationSelect.innerHTML = state.fipLiveStations.map((s) => {
            const streamUrl = (s.streamUrl || "").trim();
            return `<option value="${escapeHtml(s.id)}"${streamUrl ? ` data-stream-url="${escapeHtml(streamUrl)}"` : ""}>${escapeHtml(s.name)}</option>`;
          }).join("");
          refreshFipLiveNow().catch(() => {});
        }
      }).catch(() => {});
    } else if (fipStationSelect && state.fipLiveStations.length > 0) {
      refreshFipLiveNow().catch(() => {});
    }
    // Poll now-playing every 30s while FIP tab is active
    if (fipLiveInterval) clearInterval(fipLiveInterval);
    fipLiveInterval = setInterval(() => {
      if (state.activeTab === "fip") refreshFipLiveNow().catch(() => {});
      else { clearInterval(fipLiveInterval); fipLiveInterval = null; }
    }, 30000);
    renderFipScheduleList().catch(() => {});
  } else {
    if (fipLiveInterval) { clearInterval(fipLiveInterval); fipLiveInterval = null; }
  }
  if (isKexp) {
    refreshKexpLiveNow().catch(() => {});
    if (kexpLiveInterval) clearInterval(kexpLiveInterval);
    kexpLiveInterval = setInterval(() => {
      if (state.activeTab === "kexp") refreshKexpLiveNow().catch(() => {});
      else { clearInterval(kexpLiveInterval); kexpLiveInterval = null; }
    }, 30000);
    renderKexpScheduleList().catch(() => {});
  } else {
    if (kexpLiveInterval) { clearInterval(kexpLiveInterval); kexpLiveInterval = null; }
  }
  downloadDirInput.value = getActiveDownloadDir();
  renderPathFormatPreview();
}


function utcTimeToLocal(hhmm) {
  const match = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return hhmm;
  }

  const now = new Date();
  const utcTimestamp = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(match[1]), Number(match[2]));
  const localDate = new Date(utcTimestamp);

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: state.timeFormat === "12h"
  }).format(localDate);
}

function toLocalSchedule(runScheduleText) {
  if (!runScheduleText) {
    return "";
  }

  // Replace all HH:MM times with local equivalents
  return runScheduleText.replace(/(\d{1,2}:\d{2})/g, (match) => utcTimeToLocal(match));
}

function applyTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.body.classList.toggle("light-mode", state.theme === "light");
  themeToggleBtn.textContent = state.theme === "light" ? "Dark Mode" : "Light Mode";
  localStorage.setItem("kimble_theme", state.theme);
}

function setUrlParam(inputUrl, key, value) {
  try {
    const url = new URL(inputUrl);
    url.searchParams.set(key, value);
    return url.toString();
  } catch {
    const glue = String(inputUrl).includes("?") ? "&" : "?";
    return `${inputUrl}${glue}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

function setLiveOverlayTarget(button, src) {
  if (!button) {
    return;
  }
  button.dataset.autoplaySrc = String(src || "");
  button.classList.toggle("hidden", !src);
}

function buildBbcAutoplayCandidates(stationUrl) {
  const base = String(stationUrl || "").trim();
  if (!base) {
    return [];
  }
  const variants = [
    `${setUrlParam(setUrlParam(setUrlParam(base, "autoplay", "1"), "autostart", "true"), "play", "1")}#play`,
    `${setUrlParam(setUrlParam(setUrlParam(base, "autoplay", "true"), "autostart", "true"), "play", "true")}#play`,
    `${setUrlParam(setUrlParam(base, "play", "1"), "autostart", "true")}#play`
  ];
  return Array.from(new Set(variants));
}

async function refreshLivePanel() {
  const selectedId = Number(stationSelect.value);
  if (!Number.isFinite(selectedId)) {
    return;
  }

  const info = await window.rteDownloader.getLiveNow(selectedId);
  liveNow.innerHTML = `<strong>${escapeHtml(info.stationName)}</strong> - ${escapeHtml(info.programmeName)}<br>${escapeHtml(info.description)}`;
  const baseSrc = `https://www.rte.ie/bosco/components/player/iframe.html?radioUI=true&autostart=false&app_name=rnn&clipid=${selectedId}`;
  livePlayerFrame.src = baseSrc;
  setLiveOverlayTarget(liveOverlayPlayBtn, setUrlParam(baseSrc, "autostart", "true"));
}

async function loadLiveStations() {
  state.liveStations = await window.rteDownloader.getLiveStations();
  stationSelect.innerHTML = state.liveStations
    .map((station) => `<option value="${station.id}">${escapeHtml(station.name)}</option>`)
    .join("");

  await refreshLivePanel();
}

async function refreshBbcLivePanel() {
  const selectedId = String(bbcStationSelect.value || "").trim();
  if (!selectedId) {
    bbcLiveNow.textContent = "No BBC station selected.";
    bbcLivePlayerFrame.src = "";
    setLiveOverlayTarget(bbcLiveOverlayPlayBtn, "");
    return;
  }

  const station = (state.bbcLiveStations || []).find((item) => String(item.id) === selectedId);
  if (!station) {
    bbcLiveNow.textContent = "Station not found.";
    bbcLivePlayerFrame.src = "";
    setLiveOverlayTarget(bbcLiveOverlayPlayBtn, "");
    return;
  }

  bbcLiveNow.innerHTML = `<strong>${escapeHtml(station.name)}</strong>`;
  const baseSrc = `${setUrlParam(setUrlParam(setUrlParam(station.liveUrl, "autoplay", "0"), "autostart", "false"), "play", "1")}#play`;
  const autoplaySrc = buildBbcAutoplayCandidates(station.liveUrl)[0] || "";
  bbcLivePlayerFrame.src = baseSrc;
  bbcLiveOverlayPlayBtn.dataset.stationUrl = station.liveUrl;
  setLiveOverlayTarget(bbcLiveOverlayPlayBtn, autoplaySrc);
}

async function loadBbcLiveStations() {
  state.bbcLiveStations = await window.rteDownloader.getBbcLiveStations();
  bbcStationSelect.innerHTML = state.bbcLiveStations
    .map((station) => `<option value="${escapeHtml(station.id)}">${escapeHtml(station.name)}</option>`)
    .join("");
  await refreshBbcLivePanel();
}

function renderSearchPrograms(items) {
  programSearchResult.classList.remove("hidden");

  if (!items.length) {
    programSearchResult.innerHTML = `<div class="item">No programs found.</div>`;
    return;
  }

  programSearchResult.innerHTML = items
    .map((item) => {
      const genresHtml = (item.genres && item.genres.length)
        ? `<div class="genre-pills">${item.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
        : "";
      const desc = (item.description || "").trim();
      return `
        <div class="item clickable" data-load-program-url="${escapeHtml(item.programUrl)}">
          <div class="search-card">
            <div>${item.image ? `<img src="${escapeHtml(item.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
            <div>
              <div class="item-title">${escapeHtml(item.title)}</div>
              ${item.runSchedule ? `<div class="item-meta">🕐 ${escapeHtml(toLocalSchedule(item.runSchedule))}</div>` : ""}
              ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "…" : ""}</div>` : ""}
              ${genresHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function hideSearchDropdown() {
  programSearchResult.classList.add("hidden");
}

function hideBbcSearchDropdown() {
  bbcProgramSearchResult.classList.add("hidden");
}

async function runProgramSearch(query) {
  setButtonBusy(programSearchBtn, true, "Search");
  programSearchResult.classList.remove("hidden");
  programSearchResult.innerHTML = `<div class="item">Searching...</div>`;

  try {
    const items = await window.rteDownloader.searchPrograms(query);
    renderSearchPrograms(items);
  } catch (error) {
    programSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
  } finally {
    setButtonBusy(programSearchBtn, false, "Search");
  }
}

async function runBbcProgramSearch(query) {
  const q = String(query || "").trim();
  if (q.length < 2) {
    bbcProgramSearchResult.classList.remove("hidden");
    bbcProgramSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
    return;
  }

  setButtonBusy(bbcProgramSearchBtn, true, "Search");
  bbcProgramSearchResult.classList.remove("hidden");
  bbcProgramSearchResult.innerHTML = `<div class="item">Searching...</div>`;

  try {
    const items = await window.rteDownloader.searchBbcPrograms(q);
    if (!items.length) {
      bbcProgramSearchResult.innerHTML = `<div class="item">No BBC programs found.</div>`;
      return;
    }

    bbcProgramSearchResult.innerHTML = items
      .map((item) => renderBbcShowCard(item, { showScheduleBtn: true }))
      .join("");
  } catch (error) {
    bbcProgramSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
  } finally {
    setButtonBusy(bbcProgramSearchBtn, false, "Search");
  }
}

function renderPlaylistTracks(tracks) {
  if (!tracks.length) {
    return `<div class="playlist-note">No tracks found.</div>`;
  }

  return `
    <div class="playlist-grid compact-playlist-grid">
      ${tracks
        .map(
          (track) => `
            <div class="playlist-track">
              <div>${track.image ? `<img src="${escapeHtml(track.image)}" alt="${escapeHtml(track.title)}" width="24" height="24" />` : "*"}</div>
              <div>
                <div class="item-title">${escapeHtml(track.title)}</div>
                <div class="item-meta">${escapeHtml(track.artist)}</div>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderChapters(chapters) {
  const rows = Array.isArray(chapters) ? chapters : [];
  if (!rows.length) {
    return `<div class="playlist-note">No chapters generated.</div>`;
  }
  return `
    <div class="playlist-grid compact-playlist-grid">
      ${rows
        .map((chapter) => `
          <div class="playlist-track">
            <div>${escapeHtml(chapter.start || "00:00")}</div>
            <div>
              <div class="item-title">${escapeHtml(chapter.title || "")}</div>
              <div class="item-meta">${escapeHtml(chapter.artist || "")}</div>
              ${chapter.inferred ? `<div class="item-meta">Inferred${chapter.inferredSource ? ` via ${escapeHtml(chapter.inferredSource)}` : ""}</div>` : ""}
            </div>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function stopHlsPlayback() {
  if (activeHls && typeof activeHls.destroy === "function") {
    try {
      activeHls.destroy();
    } catch {}
  }
  activeHls = null;
}

function clearGlobalNowPlaying() {
  stopHlsPlayback();
  try {
    nowPlayingAudio.pause();
  } catch {}
  pendingNowPlayingVisible = false;
  nowPlayingAudio.removeAttribute("src");
  nowPlayingAudio.load();
  nowPlayingImage.src = DEFAULT_NOW_PLAYING_ART;
  nowPlayingImage.style.display = "";
  nowPlayingTitle.textContent = "Now Playing";
  nowPlayingMeta.textContent = "";
  nowPlayingTrack.textContent = "";
  if (nowPlayingChapterControls) {
    nowPlayingChapterControls.classList.add("hidden");
  }
  nowPlayingBar.classList.add("hidden");
  activeNowPlaying = null;
}

async function startGlobalNowPlaying({
  source,
  title,
  subtitle,
  image,
  streamUrl,
  chapters = [],
  tracks = [],
  chaptersFromTracks = false,
  playbackKey = "",
  startOffset = 0
}) {
  const url = String(streamUrl || "").trim();
  if (!url) {
    throw new Error("No stream URL available.");
  }

  clearGlobalNowPlaying();
  activeNowPlaying = {
    source: String(source || "").trim(),
    title: String(title || "").trim(),
    streamUrl: url,
    chapters: normalizeChapters(chapters),
    tracks: normalizeTracks(tracks),
    chaptersFromTracks: Boolean(chaptersFromTracks),
    playbackKey: String(playbackKey || "").trim()
  };

  nowPlayingTitle.textContent = `${activeNowPlaying.source || "Audio"}: ${activeNowPlaying.title || "Now Playing"}`;
  nowPlayingMeta.textContent = String(subtitle || "").trim();
  refreshNowPlayingTrackLabel();
  updateNowPlayingChapterControls();

  const img = String(image || "").trim();
  if (img) {
    nowPlayingImage.src = img;
    nowPlayingImage.style.display = "";
  } else {
    nowPlayingImage.src = DEFAULT_NOW_PLAYING_ART;
    nowPlayingImage.style.display = "";
  }
  pendingNowPlayingVisible = false;
  nowPlayingBar.classList.remove("hidden");
  const revealPendingPlayer = () => {
    if (pendingNowPlayingVisible) {
      nowPlayingBar.classList.remove("hidden");
      pendingNowPlayingVisible = false;
    }
    if (!String(nowPlayingMeta.textContent || "").trim()) {
      nowPlayingMeta.textContent = "Press Play to start";
    }
  };

  const hlsCtor = typeof window !== "undefined" ? window.Hls : null;
  const looksLikeHls = /(^|[/?&])[^#]*\.m3u8($|[?#&])/i.test(url) || /manifest\.m3u8/i.test(url);
  if (looksLikeHls && hlsCtor && typeof hlsCtor.isSupported === "function" && hlsCtor.isSupported()) {
    activeHls = new hlsCtor({
      lowLatencyMode: false,
      maxBufferLength: 40,
      backBufferLength: 30,
      maxBufferHole: 0.8,
      enableWorker: true
    });
    activeHls.loadSource(url);
    activeHls.attachMedia(nowPlayingAudio);
    activeHls.on(hlsCtor.Events.MANIFEST_PARSED, () => {
      nowPlayingAudio.play().catch(() => {
        revealPendingPlayer();
      });
    });
    activeHls.on(hlsCtor.Events.ERROR, (_event, data) => {
      if (data?.fatal) {
        setSettingsStatus(`Playback failed: ${data?.details || "HLS error"}`, true);
      }
    });
    return;
  }

  const safeOffset = Number(startOffset) || 0;
  const applyOffset = (audio) => {
    if (safeOffset > 0) {
      const seek = () => { audio.currentTime = safeOffset; audio.removeEventListener("loadedmetadata", seek); };
      audio.addEventListener("loadedmetadata", seek);
    }
  };

  if (!looksLikeHls) {
    nowPlayingAudio.src = url;
    applyOffset(nowPlayingAudio);
    nowPlayingAudio.play().catch(() => {
      revealPendingPlayer();
    });
    return;
  }

  if (nowPlayingAudio.canPlayType("application/vnd.apple.mpegurl")) {
    nowPlayingAudio.src = url;
    applyOffset(nowPlayingAudio);
    nowPlayingAudio.play().catch(() => {
      revealPendingPlayer();
    });
    return;
  }

  pendingNowPlayingVisible = false;
  throw new Error("HLS playback is not supported in this browser build.");
}

function setEpisodeStatus(clipId, text, isError = false) {
  const statusNode = document.querySelector(`[data-episode-status="${clipId}"]`);
  if (!statusNode) {
    return;
  }

  const safeText = String(text || "");
  statusNode.textContent = safeText;
  statusNode.style.display = safeText ? "block" : "none";
  statusNode.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
}

function getCueDebugNode(sourceType, key) {
  const encodedKey = encodeURIComponent(String(key || ""));
  if (sourceType === "bbc")  return document.querySelector(`[data-bbc-episode-cue-debug="${encodedKey}"]`);
  if (sourceType === "kexp") return document.querySelector(`[data-kexp-episode-cue-debug="${encodedKey}"]`);
  if (sourceType === "fip")  return document.querySelector(`[data-fip-episode-cue-debug="${encodedKey}"]`);
  if (sourceType === "wwf")  return document.querySelector(`[data-wwf-episode-cue-debug="${encodedKey}"]`);
  return document.querySelector(`[data-episode-cue-debug="${String(key || "")}"]`);
}

function makeCueDebugStateKey(sourceType, key) {
  return `${sourceType}:${String(key || "")}`;
}

function clearCueDebugLog(sourceType, key) {
  cueDebugState.delete(makeCueDebugStateKey(sourceType, key));
  const node = getCueDebugNode(sourceType, key);
  if (!node) {
    return;
  }
  node.innerHTML = "";
  node.style.display = "none";
}

function appendCueDebugLog(sourceType, key, message) {
  const text = String(message || "").trim();
  if (!text) {
    return;
  }
  const stateKey = makeCueDebugStateKey(sourceType, key);
  const rows = cueDebugState.get(stateKey) || [];
  if (rows[rows.length - 1] === text) {
    return;
  }
  rows.push(text);
  const trimmed = rows.slice(-8);
  cueDebugState.set(stateKey, trimmed);
  const node = getCueDebugNode(sourceType, key);
  if (!node) {
    return;
  }
  node.innerHTML = trimmed.map((row) => `<div class="cue-debug-line">${escapeHtml(row)}</div>`).join("");
  node.style.display = trimmed.length ? "block" : "none";
}

function setBbcEpisodeStatus(episodeUrl, text, isError = false) {
  const key = encodeURIComponent(String(episodeUrl || ""));
  const statusNode = document.querySelector(`[data-bbc-episode-status="${key}"]`);
  if (!statusNode) {
    return;
  }
  const safeText = String(text || "");
  statusNode.textContent = safeText;
  statusNode.style.display = safeText ? "block" : "none";
  statusNode.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
}

function setScheduleStatus(scheduleId, text, isError = false) {
  const node = document.querySelector(`[data-schedule-status="${escapeHtml(scheduleId)}"]`);
  if (!node) {
    return;
  }
  const safeText = String(text || "");
  node.textContent = safeText;
  node.style.display = safeText ? "block" : "none";
  node.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
}

function setBbcScheduleStatus(scheduleId, text, isError = false) {
  const node = document.querySelector(`[data-bbc-schedule-status="${escapeHtml(scheduleId)}"]`);
  if (!node) {
    return;
  }
  const safeText = String(text || "");
  node.textContent = safeText;
  node.style.display = safeText ? "block" : "none";
  node.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
}

function formatRunNowResult(result) {
  const downloaded = Array.isArray(result?.downloaded) ? result.downloaded : [];
  if (downloaded.length) {
    const names = downloaded
      .slice(0, 3)
      .map((row) => row.fileName || row.title || "")
      .filter(Boolean)
      .join(", ");
    const more = downloaded.length > 3 ? ` +${downloaded.length - 3} more` : "";
    return `Run Now: Downloaded ${downloaded.length} episode(s)${names ? ` (${names}${more})` : ""}`;
  }
  return `Run Now: ${String(result?.status || "No new episodes")}`;
}

function setEpisodeChapters(clipId, chapters) {
  state.rteChaptersByClip[String(clipId || "")] = Array.isArray(chapters) ? chapters : [];
  const node = document.querySelector(`[data-episode-chapters="${clipId}"]`);
  if (!node) {
    return;
  }
  node.innerHTML = renderChapters(chapters);
}

function setBbcEpisodeChapters(episodeUrl, chapters) {
  state.bbcChaptersByEpisode[String(episodeUrl || "")] = Array.isArray(chapters) ? chapters : [];
  const key = encodeURIComponent(String(episodeUrl || ""));
  const node = document.querySelector(`[data-bbc-episode-chapters="${key}"]`);
  if (!node) {
    return;
  }
  node.innerHTML = renderChapters(chapters);
}

function formatDurationFromSeconds(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  if (!total) {
    return "";
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function parseRteDurationSeconds(input) {
  const text = String(input || "").trim().toLowerCase();
  if (!text) {
    return 0;
  }
  const h = Number(text.match(/(\d+)\s*h/)?.[1] || 0);
  const m = Number(text.match(/(\d+)\s*m/)?.[1] || 0);
  const s = Number(text.match(/(\d+)\s*s/)?.[1] || 0);
  return Math.max(0, h * 3600 + m * 60 + s);
}

function chapterStartToSeconds(startText) {
  const parts = String(startText || "").split(":").map((n) => Number(n));
  if (parts.some((v) => !Number.isFinite(v))) {
    return 0;
  }
  if (parts.length === 3) {
    return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  if (parts.length === 2) {
    return Math.max(0, parts[0] * 60 + parts[1]);
  }
  if (parts.length === 1) {
    return Math.max(0, parts[0]);
  }
  return 0;
}

function normalizeChapters(chapters) {
  const rows = Array.isArray(chapters) ? chapters : [];
  const normalized = rows
    .map((chapter) => ({
      startSec: Number.isFinite(Number(chapter?.startSeconds))
        ? Math.max(0, Number(chapter.startSeconds))
        : chapterStartToSeconds(chapter?.start),
      title: decodeHtmlEntities(String(chapter?.title || "")).trim(),
      artist: decodeHtmlEntities(String(chapter?.artist || "")).trim(),
      inferred: Boolean(chapter?.inferred),
      inferredSource: decodeHtmlEntities(String(chapter?.inferredSource || "")).trim()
    }))
    .filter((chapter) => chapter.title)
    .sort((a, b) => a.startSec - b.startSec);
  if (normalized.length > 1 && normalized.every((chapter) => chapter.startSec === 0)) {
    return [];
  }
  return normalized;
}

function normalizeTracks(tracks) {
  const rows = Array.isArray(tracks) ? tracks : [];
  return rows
    .map((track) => {
      const t = {
        title: decodeHtmlEntities(String(track?.title || track?.name || track?.track || "")).trim(),
        artist: decodeHtmlEntities(String(track?.artist || track?.performer || "")).trim(),
        inferred: Boolean(track?.inferred),
        inferredSource: decodeHtmlEntities(String(track?.inferredSource || "")).trim()
      };
      // Preserve startSeconds if present (used by KEXP and other timed tracklists)
      if (Number.isFinite(Number(track?.startSeconds)) && Number(track.startSeconds) >= 0) {
        t.startSeconds = Number(track.startSeconds);
      }
      return t;
    })
    .filter((track) => track.title);
}

function estimateChaptersFromTracks(tracks, durationSeconds) {
  const rows = normalizeTracks(tracks);
  if (!rows.length) {
    return [];
  }
  // If tracks have timing data (e.g. KEXP), use it directly
  if (rows.every((t) => Number.isFinite(t.startSeconds))) {
    return rows.map((track) => ({
      startSec: track.startSeconds,
      title: String(track?.title || "").trim(),
      artist: String(track?.artist || "").trim()
    })).filter((item) => item.title);
  }
  // Otherwise evenly divide the duration
  const total = Math.max(Number(durationSeconds || 0), rows.length * 180);
  const step = total / rows.length;
  return rows.map((track, index) => ({
    startSec: Math.floor(step * index),
    title: String(track?.title || "").trim(),
    artist: String(track?.artist || "").trim()
  })).filter((item) => item.title);
}

function findChapterAtTime(chapters, seconds) {
  const rows = Array.isArray(chapters) ? chapters : [];
  if (!rows.length) {
    return null;
  }
  if (rows.length > 1 && rows.every((row) => row.startSec === rows[0].startSec)) {
    return rows[0];
  }
  const t = Math.max(0, Number(seconds || 0));
  let current = rows[0];
  for (const row of rows) {
    if (row.startSec <= t) {
      current = row;
    } else {
      break;
    }
  }
  return current;
}

function updateNowPlayingChapterControls() {
  const hasChapters = Boolean(
    activeNowPlaying
    && Array.isArray(activeNowPlaying.chapters)
    && activeNowPlaying.chapters.length > 1
  );
  if (nowPlayingChapterControls) {
    nowPlayingChapterControls.classList.toggle("hidden", !hasChapters);
  }
  if (nowPlayingPrevChapterBtn) {
    nowPlayingPrevChapterBtn.disabled = !hasChapters;
  }
  if (nowPlayingNextChapterBtn) {
    nowPlayingNextChapterBtn.disabled = !hasChapters;
  }
}

function jumpToAdjacentChapter(direction) {
  if (!activeNowPlaying || !Array.isArray(activeNowPlaying.chapters) || !activeNowPlaying.chapters.length) {
    return;
  }
  const rows = activeNowPlaying.chapters;
  const currentTime = Number(nowPlayingAudio.currentTime || 0);
  const epsilon = 0.35;
  let target = null;
  if (direction < 0) {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (Number(rows[i].startSec || 0) < currentTime - epsilon) {
        target = rows[i];
        break;
      }
    }
    if (!target) {
      target = rows[0];
    }
  } else {
    for (let i = 0; i < rows.length; i += 1) {
      if (Number(rows[i].startSec || 0) > currentTime + epsilon) {
        target = rows[i];
        break;
      }
    }
    if (!target) {
      target = rows[rows.length - 1];
    }
  }
  if (!target) {
    return;
  }
  nowPlayingAudio.currentTime = Math.max(0, Number(target.startSec || 0));
  refreshNowPlayingTrackLabel();
}

function refreshNowPlayingTrackLabel() {
  if (!activeNowPlaying) {
    nowPlayingTrack.textContent = "";
    updateNowPlayingChapterControls();
    return;
  }
  const currentDuration = Number(nowPlayingAudio.duration || 0);
  if ((!Array.isArray(activeNowPlaying.chapters) || !activeNowPlaying.chapters.length) && Array.isArray(activeNowPlaying.tracks) && activeNowPlaying.tracks.length) {
    activeNowPlaying.chapters = estimateChaptersFromTracks(activeNowPlaying.tracks, currentDuration);
    activeNowPlaying.chaptersFromTracks = true;
  } else if (activeNowPlaying.chaptersFromTracks && currentDuration > 30 && Array.isArray(activeNowPlaying.tracks) && activeNowPlaying.tracks.length) {
    const currentMax = Math.max(...(activeNowPlaying.chapters || []).map((row) => Number(row?.startSec || 0)), 0);
    if (currentMax < currentDuration * 0.75) {
      activeNowPlaying.chapters = estimateChaptersFromTracks(activeNowPlaying.tracks, currentDuration);
    }
  }
  if (!Array.isArray(activeNowPlaying.chapters) || !activeNowPlaying.chapters.length) {
    nowPlayingTrack.textContent = "";
    updateNowPlayingChapterControls();
    return;
  }
  const row = findChapterAtTime(activeNowPlaying.chapters, nowPlayingAudio.currentTime || 0);
  if (!row) {
    nowPlayingTrack.textContent = "";
    updateNowPlayingChapterControls();
    return;
  }
  const trackText = row.artist ? `Track: ${row.title} — ${row.artist}` : `Track: ${row.title}`;
  const inferredText = row.inferred
    ? ` (Inferred${row.inferredSource ? ` via ${row.inferredSource}` : ""})`
    : "";
  nowPlayingTrack.textContent = `${trackText}${inferredText}`;
  updateNowPlayingChapterControls();
}

async function loadEpisodePlaylistInto(episodeUrl, clipId) {
  const container = document.querySelector(`[data-episode-playlist="${clipId}"]`);
  if (!container) {
    return;
  }

  if (!episodeUrl) {
    container.innerHTML = `<div class="playlist-note">No episode URL for playlist lookup.</div>`;
    return;
  }

  container.innerHTML = `<div class="playlist-note">Loading playlist...</div>`;

  try {
    const payload = await window.rteDownloader.getEpisodePlaylist(episodeUrl);
    state.rteTracksByClip[String(clipId || "")] = Array.isArray(payload?.tracks) ? payload.tracks : [];
    container.innerHTML = renderPlaylistTracks(payload.tracks || []);
  } catch (error) {
    container.innerHTML = `<div class="playlist-note">Playlist load failed: ${escapeHtml(error.message)}</div>`;
  }
}

async function loadBbcEpisodePlaylistInto(episodeUrl) {
  const key = encodeURIComponent(String(episodeUrl || ""));
  const container = document.querySelector(`[data-bbc-episode-playlist="${key}"]`);
  if (!container) {
    return;
  }

  if (!episodeUrl) {
    container.innerHTML = `<div class="playlist-note">No episode URL for music lookup.</div>`;
    return;
  }

  container.innerHTML = `<div class="playlist-note">Loading music played...</div>`;

  try {
    const payload = await window.rteDownloader.getBbcEpisodePlaylist(episodeUrl);
    state.bbcTracksByEpisode[String(episodeUrl || "")] = Array.isArray(payload?.tracks) ? payload.tracks : [];
    container.innerHTML = renderPlaylistTracks(payload.tracks || []);
  } catch (error) {
    container.innerHTML = `<div class="playlist-note">Music load failed: ${escapeHtml(error.message)}</div>`;
  }
}

async function autoLoadVisiblePlaylists(episodes) {
  const queue = (episodes || []).filter((episode) => episode.clipId && episode.episodeUrl);
  const concurrency = 3;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const next = queue[index];
      index += 1;
      await loadEpisodePlaylistInto(next.episodeUrl, String(next.clipId));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

async function autoLoadVisibleBbcPlaylists(episodes) {
  const queue = (episodes || []).filter((episode) => episode.episodeUrl);
  const concurrency = 2;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const next = queue[index];
      index += 1;
      await loadBbcEpisodePlaylistInto(next.episodeUrl);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

function renderEpisodes(payload) {
  const rows = payload.episodes || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / getEpisodesPerPage()));
  const currentPage = Math.max(1, Math.min(totalPages, Number(state.currentProgramPage || 1)));
  const start = (currentPage - 1) * getEpisodesPerPage();
  const visibleRows = rows.slice(start, start + getEpisodesPerPage());

  if (!rows.length) {
    episodesResult.innerHTML = `<div class="item">No episodes returned for this page.</div>`;
    return;
  }

  episodesResult.innerHTML = visibleRows
    .map((episode) => {
      const clipId = String(episode.clipId || "");
      const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
      const desc = String(episode.description || "").trim();
      const descHtml = desc ? `<div class="item-meta muted" style="max-width:600px;">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "…" : ""}</div>` : "";

      return `
        <div class="item">
          ${img}
          <div class="item-title">${escapeHtml(episode.title)}</div>
          <div class="item-meta">
            ${escapeHtml(episode.publishedTimeFormatted || episode.publishedTime)}
            ${episode.durationString ? ` · ${escapeHtml(episode.durationString)}` : ""}
          </div>
          ${descHtml}
          <div class="item-actions">
            <button
              class="secondary"
              data-play-clip="${escapeHtml(clipId)}"
              data-play-title="${escapeHtml(episode.fullTitle || episode.title)}"
              data-play-program-title="${escapeHtml(payload.title || "")}"
              data-play-subtitle="${escapeHtml((payload.title || "RTÉ Program") + (episode.publishedTimeFormatted ? ` • ${episode.publishedTimeFormatted}` : ""))}"
              data-play-image="${escapeHtml(episode.image || "")}"
              data-play-duration="${escapeHtml(episode.durationString || "")}"
              data-play-episode-url="${escapeHtml(episode.episodeUrl || "")}"
            >Play</button>
            <button
              class="secondary"
              data-play-local-clip="${escapeHtml(clipId)}"
              data-play-local-title="${escapeHtml(episode.fullTitle || episode.title)}"
              data-play-local-program-title="${escapeHtml(payload.title || "")}"
              data-play-local-subtitle="${escapeHtml((payload.title || "RTÉ Program") + (episode.publishedTimeFormatted ? ` • ${episode.publishedTimeFormatted}` : ""))}"
              data-play-local-image="${escapeHtml(episode.image || "")}"
              data-play-local-duration="${escapeHtml(episode.durationString || "")}"
              data-play-local-episode-url="${escapeHtml(episode.episodeUrl || "")}"
            >Play Local</button>
            <button data-download-clip="${escapeHtml(clipId)}" data-download-title="${escapeHtml(episode.fullTitle || episode.title)}" data-download-program-title="${escapeHtml(payload.title || "")}" data-download-url="${escapeHtml(episode.episodeUrl || "")}" data-download-published="${escapeHtml(episode.publishedTime || episode.publishedTimeFormatted || "")}" data-download-image="${escapeHtml(episode.image || payload.image || "")}">Download</button>
            <button class="secondary" data-generate-cue-clip="${escapeHtml(clipId)}" data-generate-cue-title="${escapeHtml(episode.fullTitle || episode.title)}" data-generate-cue-program-title="${escapeHtml(payload.title || "")}" data-generate-cue-url="${escapeHtml(episode.episodeUrl || "")}">Generate CUE</button>
          </div>
          <div class="item-meta episode-status" data-episode-status="${escapeHtml(clipId)}" style="display:none;"></div>
          <div class="cue-debug-log" data-episode-cue-debug="${escapeHtml(clipId)}" style="display:none;"></div>
          <div class="episode-inline-playlist" data-episode-chapters="${escapeHtml(clipId)}"></div>
          <div class="episode-inline-playlist" data-episode-playlist="${escapeHtml(clipId)}">
            <div class="playlist-note">Queued playlist load...</div>
          </div>
        </div>
      `;
    })
    .join("");

  autoLoadVisiblePlaylists(visibleRows).catch(() => {});
}

function renderBbcEpisodes(payload) {
  const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / getEpisodesPerPage()));
  const currentPage = Math.max(1, Math.min(totalPages, Number(state.bbcProgramPage || 1)));
  const start = (currentPage - 1) * getEpisodesPerPage();
  const visibleRows = rows.slice(start, start + getEpisodesPerPage());

  if (!rows.length) {
    bbcEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
    return;
  }

  bbcEpisodesResult.innerHTML = visibleRows
    .map((episode) => {
      const episodeUrl = String(episode.episodeUrl || "").trim();
      const downloadUrl = String(episode.downloadUrl || episodeUrl).trim();
      const episodeStatusKey = encodeURIComponent(episodeUrl);
      const duration = formatDurationFromSeconds(episode.durationSeconds);
      const published = String(episode.publishedTime || "").trim();
      const description = String(episode.description || "").trim();
      const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
      const descHtml = description ? `<div class="item-meta muted" style="max-width:600px;">${escapeHtml(description.slice(0, 200))}${description.length > 200 ? "…" : ""}</div>` : "";

      return `
        <div class="item">
          ${img}
          <div class="item-title">${escapeHtml(episode.title)}</div>
          <div class="item-meta">
            ${published ? escapeHtml(published) : "Date unknown"}
            ${duration ? ` · ${escapeHtml(duration)}` : ""}
          </div>
          ${descHtml}
          <div class="item-actions">
            <button
              class="secondary"
              data-bbc-play-url="${escapeHtml(episodeUrl)}"
              data-bbc-play-title="${escapeHtml(episode.title)}"
              data-bbc-play-program-title="${escapeHtml(payload.title || "BBC")}"
              data-bbc-play-subtitle="${escapeHtml((payload.title || "BBC Program") + (published ? ` • ${published}` : ""))}"
              data-bbc-play-image="${escapeHtml(episode.image || "")}"
              data-bbc-play-duration="${escapeHtml(String(episode.durationSeconds || 0))}"
            >Play</button>
            <button
              class="secondary"
              data-bbc-play-local-url="${escapeHtml(episodeUrl)}"
              data-bbc-play-local-title="${escapeHtml(episode.title)}"
              data-bbc-play-local-program-title="${escapeHtml(payload.title || "BBC")}"
              data-bbc-play-local-subtitle="${escapeHtml((payload.title || "BBC Program") + (published ? ` • ${published}` : ""))}"
              data-bbc-play-local-image="${escapeHtml(episode.image || "")}"
              data-bbc-play-local-duration="${escapeHtml(String(episode.durationSeconds || 0))}"
            >Play Local</button>
            <button data-bbc-episode-url="${escapeHtml(episodeUrl)}" data-bbc-download-url="${escapeHtml(downloadUrl)}" data-bbc-episode-title="${escapeHtml(episode.title)}" data-bbc-program-title="${escapeHtml(payload.title || "BBC")}" data-bbc-published="${escapeHtml(published)}" data-bbc-image="${escapeHtml(episode.image || payload.image || "")}">Download</button>
            <button class="secondary" data-bbc-generate-cue-url="${escapeHtml(episodeUrl)}" data-bbc-generate-cue-title="${escapeHtml(episode.title)}" data-bbc-generate-cue-program-title="${escapeHtml(payload.title || "BBC")}">Generate CUE</button>
          </div>
          <div class="item-meta episode-status" data-bbc-episode-status="${episodeStatusKey}" style="display:none;"></div>
          <div class="cue-debug-log" data-bbc-episode-cue-debug="${episodeStatusKey}" style="display:none;"></div>
          <div class="episode-inline-playlist" data-bbc-episode-chapters="${episodeStatusKey}"></div>
          <div class="episode-inline-playlist" data-bbc-episode-playlist="${episodeStatusKey}">
            <div class="playlist-note">Music Played: loading...</div>
          </div>
        </div>
      `;
    })
    .join("");

  autoLoadVisibleBbcPlaylists(visibleRows).catch(() => {});
}

function renderWwfEpisodes(payload) {
  if (!wwfEpisodesResult) return;
  const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];

  if (!rows.length) {
    wwfEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
    return;
  }

  wwfEpisodesResult.innerHTML = rows
    .map((episode) => {
      const episodeUrl = String(episode.episodeUrl || "").trim();
      const statusKey = encodeURIComponent(episodeUrl);
      const published = String(episode.publishedTime || "").trim();
      const fullTitle = String(episode.fullTitle || episode.title || "").trim();
      const programTitle = String(payload?.title || episode.showName || "Worldwide FM").trim();
      const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
      const genresHtml = (episode.genres && episode.genres.length)
        ? `<div class="genre-pills">${episode.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
        : "";
      // Hide "Host: X" when all hosts match the program title (redundant)
      const programTitleLower = String(payload?.title || "").toLowerCase();
      const hostsRedundant = episode.hosts && episode.hosts.length
        ? episode.hosts.every((h) => h.toLowerCase() === programTitleLower)
        : true;
      const hostsHtml = (episode.hosts && episode.hosts.length && !hostsRedundant)
        ? `<div class="item-meta">Host: ${episode.hosts.map((h) => escapeHtml(h)).join(", ")}</div>`
        : "";
      const descHtml = episode.description
        ? `<div class="item-meta muted" style="max-width:600px;">${escapeHtml(episode.description.slice(0, 200))}${episode.description.length > 200 ? "…" : ""}</div>`
        : "";
      const durationHtml = episode.durationMinutes
        ? ` · ${episode.durationMinutes >= 60 ? Math.floor(episode.durationMinutes / 60) + "h" : ""}${episode.durationMinutes % 60 ? (episode.durationMinutes % 60) + "m" : ""}`
        : "";
      const runScheduleHtml = episode.runSchedule
        ? `<div class="item-meta"><strong>${escapeHtml(toLocalSchedule(episode.runSchedule))}</strong></div>`
        : episode.showTime ? `<div class="item-meta">${escapeHtml(utcTimeToLocal(episode.showTime))}${durationHtml}</div>` : "";
      const locationHtml = episode.location ? `<div class="item-meta">${escapeHtml(episode.location)}</div>` : "";
      return `
        <div class="item">
          ${img}
          <div class="item-title">${escapeHtml(fullTitle)}</div>
          <div class="item-meta">${published ? escapeHtml(published) : "Date unknown"}${!episode.runSchedule && !episode.showTime && durationHtml ? durationHtml : ""}</div>
          ${hostsHtml}
          ${runScheduleHtml}
          ${locationHtml}
          ${descHtml}
          ${genresHtml}
          <div class="item-actions">
            <button class="secondary" data-wwf-play-url="${escapeHtml(episode.playerUrl || episode.downloadUrl || episodeUrl)}" data-wwf-play-title="${escapeHtml(fullTitle)}" data-wwf-play-program-title="${escapeHtml(programTitle)}" data-wwf-play-image="${escapeHtml(episode.image || "")}">Play</button>
            <button class="secondary" data-wwf-play-local-url="${escapeHtml(episodeUrl)}" data-wwf-play-local-title="${escapeHtml(fullTitle)}" data-wwf-play-local-program-title="${escapeHtml(programTitle)}" data-wwf-play-local-image="${escapeHtml(episode.image || "")}">Play Local</button>
            <button data-wwf-download-url="${escapeHtml(episodeUrl)}" data-wwf-episode-title="${escapeHtml(fullTitle)}" data-wwf-program-title="${escapeHtml(programTitle)}" data-wwf-published="${escapeHtml(published)}" data-wwf-image="${escapeHtml(episode.image || "")}">Download</button>
            <button class="secondary" data-wwf-generate-cue-url="${escapeHtml(episodeUrl)}" data-wwf-generate-cue-title="${escapeHtml(fullTitle)}" data-wwf-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>
          </div>
          <div class="item-meta episode-status" data-wwf-episode-status="${statusKey}" style="display:none;"></div>
          <div class="cue-debug-log" data-wwf-episode-cue-debug="${statusKey}" style="display:none;"></div>
          <div class="episode-inline-playlist" data-wwf-episode-playlist="${statusKey}">
            <div class="playlist-note">Loading tracklist...</div>
          </div>
        </div>
      `;
    })
    .join("");

  autoLoadWwfPlaylists(rows).catch(() => {});
}

async function loadWwfProgram(programNameOrUrl, page = 1) {
  if (!window.rteDownloader?.getWwfProgramEpisodes) return;
  const perPage = getEpisodesPerPage();
  // WWF server pages are 20; map client page to server page
  const serverPage = Math.max(1, Math.ceil((((Number(page) || 1) - 1) * perPage + 1) / 20));
  const payload = await window.rteDownloader.getWwfProgramEpisodes(programNameOrUrl, serverPage);
  const totalItems = Number(payload?.totalItems || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  // Client-side offset within server response
  const clientOffset = ((targetPage - 1) * perPage) % 20;
  if (payload.episodes) payload.episodes = payload.episodes.slice(clientOffset, clientOffset + perPage);
  state.wwfProgramUrl = payload.programUrl || programNameOrUrl;
  state.wwfProgramPage = targetPage;
  state.wwfProgramMaxPages = totalPages;
  state.wwfEpisodesPayload = payload;
  if (wwfProgramUrlInput) wwfProgramUrlInput.value = state.wwfProgramUrl;
  if (wwfProgramMeta) {
    const img = (payload.image || "").trim();
    const genres = payload.genres || [];
    const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    const cadence = String(payload.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    const locationBadge = payload.location ? ` <span class="genre-pill">📍 ${escapeHtml(payload.location)}</span>` : "";
    wwfProgramMeta.innerHTML = `
      ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
      <strong>${escapeHtml(payload.title || "Worldwide FM")}</strong>${cadenceBadge}${locationBadge}<br>
      ${payload.runSchedule ? `<span class="muted">🕐 ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
      ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` — ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
      ${payload.description ? `<span class="muted">${escapeHtml(payload.description.slice(0, 300))}${payload.description.length > 300 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      Page ${state.wwfProgramPage} of ${state.wwfProgramMaxPages} - ${Number(payload?.totalItems || 0)} episodes
    `;
  }
  renderWwfEpisodes(payload);
}

function setWwfEpisodeStatus(episodeUrl, text, isError = false) {
  if (!wwfEpisodesResult) return;
  const key = encodeURIComponent(String(episodeUrl || ""));
  const el = wwfEpisodesResult.querySelector(`[data-wwf-episode-status="${key}"]`);
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
  el.className = `item-meta episode-status ${isError ? "error" : ""}`;
}

async function loadBbcProgram(programUrl, page = 1) {
  const payload = await window.rteDownloader.getBbcProgramEpisodes(programUrl, 1);
  const totalRows = Number(payload?.episodes?.length || 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / getEpisodesPerPage()));
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));

  state.bbcProgramUrl = payload.programUrl;
  state.bbcProgramPage = targetPage;
  state.bbcProgramMaxPages = totalPages;
  state.bbcEpisodesPayload = payload;

  bbcProgramUrlInput.value = payload.programUrl;
  {
    const img = (payload.image || "").trim();
    const desc = (payload.description || "").trim();
    const cadence = String(payload.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" && cadence !== "unknown" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    const genres = Array.isArray(payload.genres) ? payload.genres : [];
    const genresHtml = genres.length ? `<div class="genre-pills" style="margin-top:0.3rem;">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    bbcProgramMeta.innerHTML = `
      ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
      <strong>${escapeHtml(payload.title || "BBC Program")}</strong>${cadenceBadge}<br>
      ${payload.runSchedule ? `<span class="muted">🕐 ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
      ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` — ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
      ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 300))}${desc.length > 300 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
    `;
  }

  renderBbcEpisodes(payload);
}

async function loadProgram(programUrl, page = 1) {
  const payload = await window.rteDownloader.getProgramEpisodes(programUrl, 1);
  const totalRows = Number(payload.episodes?.length || 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / getEpisodesPerPage()));
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));

  state.currentProgramUrl = payload.programUrl;
  state.currentProgramPage = targetPage;
  state.currentMaxPages = totalPages;
  state.currentEpisodes = payload;

  programUrlInput.value = payload.programUrl;
  {
    const img = (payload.image || "").trim();
    const desc = (payload.description || "").trim();
    const cadence = String(payload.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" && cadence !== "unknown" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    const genres = Array.isArray(payload.genres) ? payload.genres : [];
    const genresHtml = genres.length ? `<div class="genre-pills" style="margin-top:0.3rem;">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    programMeta.innerHTML = `
      ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
      <strong>${escapeHtml(payload.title)}</strong>${cadenceBadge}<br>
      ${payload.runSchedule ? `<span class="muted">🕐 ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
      ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` — ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
      ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 300))}${desc.length > 300 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      Page ${state.currentProgramPage} of ${state.currentMaxPages} - ${totalRows} episodes
    `;
  }

  renderEpisodes(payload);
}

function formatBackfillSummary(schedule) {
  const total = Number(schedule?.backfillTotal || 0);
  const completed = Number(schedule?.backfillCompleted || 0);
  const failed = Number(schedule?.backfillFailed || 0);
  if (!schedule?.backfillInProgress && total <= 0) {
    return "";
  }
  const text = `${completed}/${total > 0 ? total : completed}`;
  return failed > 0 ? `${text} (${failed} failed)` : text;
}

function formatSchedulerNextShowLocal(schedule) {
  const local = localizeNextBroadcast(schedule?.nextBroadcastAt || "");
  if (!local) {
    return "";
  }
  const title = String(schedule?.nextBroadcastTitle || "").trim();
  if (!title || looksLikeDateOnlyText(title)) {
    return local;
  }
  return `${local} — ${title}`;
}

function renderSchedulerCard(schedule, sourceType = "rte") {
  const isBbc = sourceType === "bbc";
  const isWwf = sourceType === "wwf";
  const isNts = sourceType === "nts";
  const isFip = sourceType === "fip";
  const isKexp = sourceType === "kexp";
  const latestImage = schedule?.latestEpisodeImage || schedule?.image || "";
  const latestPublished = formatLocalDate(schedule?.latestEpisodePublishedTime || "");
  const runLocal = toLocalSchedule(schedule?.runSchedule || "");
  const checkWindowLocal = formatSchedulerCheckWindowLocal(schedule?.runSchedule || "");
  const nextShowLocal = formatSchedulerNextShowLocal(schedule);
  const retryPending = Array.isArray(schedule?.retryQueue) ? schedule.retryQueue.length : 0;
  const cadence = String(schedule?.cadence || "unknown");
  const backfillSummary = formatBackfillSummary(schedule);
  const checked = formatLocalDateTime(schedule?.lastCheckedAt || "never");
  const ran = formatLocalDateTime(schedule?.lastRunAt || "never");
  const latestFileTime = schedule?.lastDownloaded?.at ? formatLocalDateTime(schedule.lastDownloaded.at) : "";
  const latestFilePath = String(schedule?.lastDownloaded?.filePath || "").trim();
  const status = String(schedule?.lastStatus || "Idle");
  const toggleAttr = isKexp ? "data-kexp-schedule-toggle" : isFip ? "data-fip-schedule-toggle" : isNts ? "data-nts-schedule-toggle" : isWwf ? "data-wwf-schedule-toggle" : isBbc ? "data-bbc-schedule-toggle" : "data-schedule-toggle";
  const runAttr = isKexp ? "data-kexp-schedule-run" : isFip ? "data-fip-schedule-run" : isNts ? "data-nts-schedule-run" : isWwf ? "data-wwf-schedule-run" : isBbc ? "data-bbc-schedule-run" : "data-schedule-run";
  const removeAttr = isKexp ? "data-kexp-schedule-remove" : isFip ? "data-fip-schedule-remove" : isNts ? "data-nts-schedule-remove" : isWwf ? "data-wwf-schedule-remove" : isBbc ? "data-bbc-schedule-remove" : "data-schedule-remove";
  const playOutputAttr = isKexp ? "data-kexp-schedule-play-output" : isFip ? "data-fip-schedule-play-output" : isNts ? "data-nts-schedule-play-output" : isWwf ? "data-wwf-schedule-play-output" : isBbc ? "data-bbc-schedule-play-output" : "data-schedule-play-output";
  const playFileAttr = isKexp ? "data-kexp-schedule-play-file" : isFip ? "data-fip-schedule-play-file" : isNts ? "data-nts-schedule-play-file" : isWwf ? "data-wwf-schedule-play-file" : isBbc ? "data-bbc-schedule-play-file" : "data-schedule-play-file";
  const playTitleAttr = isKexp ? "data-kexp-schedule-play-title" : isFip ? "data-fip-schedule-play-title" : isNts ? "data-nts-schedule-play-title" : isWwf ? "data-wwf-schedule-play-title" : isBbc ? "data-bbc-schedule-play-title" : "data-schedule-play-title";
  const playImageAttr = isKexp ? "data-kexp-schedule-play-image" : isFip ? "data-fip-schedule-play-image" : isNts ? "data-nts-schedule-play-image" : isWwf ? "data-wwf-schedule-play-image" : isBbc ? "data-bbc-schedule-play-image" : "data-schedule-play-image";
  const playEpisodeUrlAttr = isKexp ? "data-kexp-schedule-play-episode-url" : isFip ? "data-fip-schedule-play-episode-url" : isNts ? "data-nts-schedule-play-episode-url" : isWwf ? "data-wwf-schedule-play-episode-url" : isBbc ? "data-bbc-schedule-play-episode-url" : "data-schedule-play-episode-url";
  const playSourceTypeAttr = isKexp ? "data-kexp-schedule-play-source-type" : isFip ? "data-fip-schedule-play-source-type" : isNts ? "data-nts-schedule-play-source-type" : isWwf ? "data-wwf-schedule-play-source-type" : isBbc ? "data-bbc-schedule-play-source-type" : "data-schedule-play-source-type";
  const statusAttr = isKexp ? "data-kexp-schedule-status" : isFip ? "data-fip-schedule-status" : isNts ? "data-nts-schedule-status" : isWwf ? "data-wwf-schedule-status" : isBbc ? "data-bbc-schedule-status" : "data-schedule-status";
  const playSourceTypeValue = isKexp ? "kexp" : isFip ? "fip" : isNts ? "nts" : isWwf ? "wwf" : isBbc ? "bbc" : "rte";

  return `
    <div class="item scheduler-card">
      <div class="scheduler-head">
        ${latestImage ? `<img class="scheduler-thumb" src="${escapeHtml(latestImage)}" alt="${escapeHtml(schedule?.latestEpisodeTitle || schedule?.title || "Program")}" loading="lazy" />` : `<div class="scheduler-thumb scheduler-thumb-placeholder"></div>`}
        <div class="scheduler-head-main">
          <div class="item-title">${escapeHtml(schedule?.title || "Program")}</div>
          <div class="scheduler-badges">
            <span class="scheduler-badge">${escapeHtml(cadence)}</span>
            <span class="scheduler-badge scheduler-badge-status">${escapeHtml(status)}</span>
            ${backfillSummary ? `<span class="scheduler-badge scheduler-badge-progress">Backfill ${escapeHtml(backfillSummary)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="scheduler-grid">
        ${schedule?.latestEpisodeTitle ? `<div><span class="scheduler-k">Latest</span><span class="scheduler-v">${escapeHtml(schedule.latestEpisodeTitle)}${latestPublished ? ` • ${escapeHtml(latestPublished)}` : ""}</span></div>` : ""}
        ${runLocal ? `<div><span class="scheduler-k">Airs (Local)</span><span class="scheduler-v">${escapeHtml(runLocal)}</span></div>` : ""}
        ${checkWindowLocal ? `<div><span class="scheduler-k">Check Window (Local)</span><span class="scheduler-v">${escapeHtml(checkWindowLocal)}</span></div>` : ""}
        ${nextShowLocal ? `<div><span class="scheduler-k">Next Broadcast (Local)</span><span class="scheduler-v">${escapeHtml(nextShowLocal)}</span></div>` : ""}
        <div><span class="scheduler-k">Retry Queue</span><span class="scheduler-v">${escapeHtml(String(retryPending))} pending</span></div>
        ${latestFilePath ? `<div><span class="scheduler-k">Latest File</span><span class="scheduler-v scheduler-path">${escapeHtml(latestFilePath)}</span></div>` : ""}
        ${latestFileTime ? `<div><span class="scheduler-k">Saved</span><span class="scheduler-v">${escapeHtml(latestFileTime)}</span></div>` : ""}
        <div><span class="scheduler-k">Last Checked</span><span class="scheduler-v">${escapeHtml(checked)}</span></div>
        <div><span class="scheduler-k">Last Run</span><span class="scheduler-v">${escapeHtml(ran)}</span></div>
      </div>
      <div class="item-actions">
        <button class="secondary" ${toggleAttr}="${escapeHtml(schedule.id)}" data-enabled="${schedule.enabled ? "1" : "0"}">${schedule.enabled ? "Pause" : "Enable"}</button>
        <button class="secondary" ${runAttr}="${escapeHtml(schedule.id)}">Run Now</button>
        ${schedule?.lastDownloaded?.outputDir && schedule?.lastDownloaded?.fileName ? `<button class="secondary" ${playOutputAttr}="${escapeHtml(schedule.lastDownloaded.outputDir)}" ${playFileAttr}="${escapeHtml(schedule.lastDownloaded.fileName)}" ${playTitleAttr}="${escapeHtml(schedule.lastDownloaded.title || schedule.title)}" ${playImageAttr}="${escapeHtml(schedule.lastDownloaded.image || schedule.latestEpisodeImage || schedule.image || "")}" ${playEpisodeUrlAttr}="${escapeHtml(schedule.lastDownloaded.episodeUrl || "")}" ${playSourceTypeAttr}="${escapeHtml(playSourceTypeValue)}">Play Latest</button>` : ""}
        <button class="secondary" ${removeAttr}="${escapeHtml(schedule.id)}">Remove</button>
      </div>
      <div class="item-meta episode-status" ${statusAttr}="${escapeHtml(schedule.id)}" style="display:none;"></div>
    </div>
  `;
}

async function refreshSchedules() {
  const schedules = await window.rteDownloader.listSchedules();
  if (!schedules.length) {
    scheduleList.innerHTML = `<div class="item">No schedules yet.</div>`;
    return;
  }

  scheduleList.innerHTML = schedules.map((s) => renderSchedulerCard(s, "rte")).join("");
}

async function refreshBbcSchedules() {
  const schedules = await window.rteDownloader.listBbcSchedules();
  if (!schedules.length) {
    bbcScheduleList.innerHTML = `<div class="item">No BBC schedules yet.</div>`;
    return;
  }

  bbcScheduleList.innerHTML = schedules.map((s) => renderSchedulerCard(s, "bbc")).join("");
}

async function renderWwfScheduleList() {
  if (!wwfScheduleList || !window.rteDownloader?.listWwfSchedules) return;
  const schedules = await window.rteDownloader.listWwfSchedules();
  if (!schedules.length) {
    wwfScheduleList.innerHTML = `<div class="item">No Worldwide FM schedules yet.</div>`;
    return;
  }
  wwfScheduleList.innerHTML = schedules.map((s) => renderSchedulerCard(s, "wwf")).join("");
}

const SOURCE_LABELS = { rte: "RTÉ", bbc: "BBC", wwf: "WWF", nts: "NTS", fip: "FIP", kexp: "KEXP" };

function renderHealthDashboard(schedulesMap) {
  const grid = document.getElementById("healthGrid");
  if (!grid) return;
  const sources = [
    { key: "rte", name: "RTÉ" },
    { key: "bbc", name: "BBC" },
    { key: "wwf", name: "Worldwide FM" },
    { key: "nts", name: "NTS" },
    { key: "fip", name: "FIP" },
    { key: "kexp", name: "KEXP" },
  ];
  grid.innerHTML = sources.map(({ key, name }) => {
    const schedules = schedulesMap[key] || [];
    const count = schedules.length;
    const retries = schedules.reduce((s, sc) => s + (sc.retryQueue?.length || 0), 0);
    const lastRun = schedules.map(sc => sc.lastRunAt).filter(Boolean).sort().pop();
    let dotClass = "health-dot-grey";
    if (count > 0) {
      if (retries > 0) dotClass = "health-dot-yellow";
      else dotClass = "health-dot-green";
    }
    const lastRunStr = lastRun ? new Date(lastRun).toLocaleDateString() : "Never";
    return `<div class="health-card">
      <div class="health-card-name"><span class="health-dot ${dotClass}"></span>${escapeHtml(name)}</div>
      <div class="health-card-meta">${count} schedule${count !== 1 ? "s" : ""}</div>
      <div class="health-card-meta">Last run: ${escapeHtml(lastRunStr)}</div>
      ${retries > 0 ? `<div class="health-card-meta" style="color:#f1c40f;">${retries} retry${retries !== 1 ? "s" : ""} pending</div>` : ""}
    </div>`;
  }).join("");
}

async function renderAllSchedules() {
  if (!allSchedulesList) return;
  allSchedulesList.innerHTML = `<div class="item muted">Loading…</div>`;
  try {
    const [rte, bbc, wwf, nts, fip, kexp] = await Promise.all([
      window.rteDownloader?.listSchedules?.().catch(() => []),
      window.rteDownloader?.listBbcSchedules?.().catch(() => []),
      window.rteDownloader?.listWwfSchedules?.().catch(() => []),
      window.rteDownloader?.listNtsSchedules?.().catch(() => []),
      window.rteDownloader?.listFipSchedules?.().catch(() => []),
      window.rteDownloader?.listKexpSchedules?.().catch(() => [])
    ]);
    renderHealthDashboard({ rte: rte || [], bbc: bbc || [], wwf: wwf || [], nts: nts || [], fip: fip || [], kexp: kexp || [] });
    const tagged = [
      ...(rte || []).map((s) => ({ ...s, _source: "rte" })),
      ...(bbc || []).map((s) => ({ ...s, _source: "bbc" })),
      ...(wwf || []).map((s) => ({ ...s, _source: "wwf" })),
      ...(nts || []).map((s) => ({ ...s, _source: "nts" })),
      ...(fip || []).map((s) => ({ ...s, _source: "fip" })),
      ...(kexp || []).map((s) => ({ ...s, _source: "kexp" }))
    ];
    if (!tagged.length) {
      allSchedulesList.innerHTML = `<div class="item">No schedules yet across any source.</div>`;
      return;
    }
    allSchedulesList.innerHTML = tagged.map((s) => {
      const src = s._source;
      const card = renderSchedulerCard(s, src);
      // Inject source badge after scheduler-head-main title
      return card.replace(
        `<div class="item-title">${escapeHtml(s.title || "Program")}`,
        `<div class="item-title"><span class="source-badge source-badge-${escapeHtml(src)}">${escapeHtml(SOURCE_LABELS[src] || src.toUpperCase())}</span> ${escapeHtml(s.title || "Program")}`
      );
    }).join("");
  } catch (e) {
    allSchedulesList.innerHTML = `<div class="item error">${escapeHtml(String(e?.message || e))}</div>`;
  }
}

function renderNtsEpisodes(payload) {
  if (!ntsEpisodesResult) return;
  const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];

  if (!rows.length) {
    ntsEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
    return;
  }

  ntsEpisodesResult.innerHTML = rows
    .map((episode) => {
      const episodeUrl = String(episode.episodeUrl || "").trim();
      const statusKey = encodeURIComponent(episodeUrl);
      const published = String(episode.publishedTime || "").trim();
      const fullTitle = String(episode.fullTitle || episode.title || "").trim();
      const programTitle = String(payload?.title || episode.showName || "NTS").trim();
      const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
      const genresHtml = (episode.genres && episode.genres.length)
        ? `<div class="genre-pills">${episode.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
        : "";
      const locationHtml = episode.location ? `<div class="item-meta">${escapeHtml(episode.location)}</div>` : "";
      return `
        <div class="item">
          ${img}
          <div class="item-title">${escapeHtml(fullTitle)}</div>
          <div class="item-meta">${published ? escapeHtml(published) : "Date unknown"}</div>
          ${locationHtml}
          ${genresHtml}
          <div class="item-actions">
            <button class="secondary" data-nts-play-url="${escapeHtml(episodeUrl)}" data-nts-play-title="${escapeHtml(fullTitle)}" data-nts-play-program-title="${escapeHtml(programTitle)}" data-nts-play-image="${escapeHtml(episode.image || "")}">Play</button>
            <button class="secondary" data-nts-play-local-url="${escapeHtml(episodeUrl)}" data-nts-play-local-title="${escapeHtml(fullTitle)}" data-nts-play-local-program-title="${escapeHtml(programTitle)}" data-nts-play-local-image="${escapeHtml(episode.image || "")}">Play Local</button>
            <button data-nts-download-url="${escapeHtml(episodeUrl)}" data-nts-episode-title="${escapeHtml(fullTitle)}" data-nts-program-title="${escapeHtml(programTitle)}" data-nts-published="${escapeHtml(published)}" data-nts-image="${escapeHtml(episode.image || "")}">Download</button>
            <button class="secondary" data-nts-generate-cue-url="${escapeHtml(episodeUrl)}" data-nts-generate-cue-title="${escapeHtml(fullTitle)}" data-nts-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>
          </div>
          <div class="item-meta episode-status" data-nts-episode-status="${statusKey}" style="display:none;"></div>
          <div class="episode-inline-playlist" data-nts-episode-playlist="${statusKey}">
            <div class="playlist-note">Loading tracklist...</div>
          </div>
        </div>
      `;
    })
    .join("");

  autoLoadNtsPlaylists(rows).catch(() => {});
}

async function autoLoadNtsPlaylists(episodes) {
  if (!window.rteDownloader?.getNtsEpisodePlaylist) return;
  const queue = (episodes || []).filter((e) => e.episodeUrl);
  const concurrency = 3;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const ep = queue[index];
      index += 1;
      const statusKey = encodeURIComponent(String(ep.episodeUrl || ""));
      const node = ntsEpisodesResult?.querySelector(`[data-nts-episode-playlist="${statusKey}"]`);
      if (!node) continue;
      try {
        const data = await window.rteDownloader.getNtsEpisodePlaylist(ep.episodeUrl);
        const tracks = data?.tracks || [];
        if (tracks.length) {
          node.innerHTML = renderPlaylistTracks(tracks);
        } else {
          node.innerHTML = `<div class="playlist-note">No tracklist available.</div>`;
        }
      } catch {
        node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

async function autoLoadWwfPlaylists(episodes) {
  if (!window.rteDownloader?.getWwfEpisodePlaylist) return;
  const queue = (episodes || []).filter((e) => e.episodeUrl);
  const concurrency = 2;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const ep = queue[index];
      index += 1;
      const statusKey = encodeURIComponent(String(ep.episodeUrl || ""));
      const node = wwfEpisodesResult?.querySelector(`[data-wwf-episode-playlist="${statusKey}"]`);
      if (!node) continue;
      try {
        const data = await window.rteDownloader.getWwfEpisodePlaylist(ep.episodeUrl);
        const tracks = data?.tracks || [];
        if (tracks.length) {
          node.innerHTML = renderPlaylistTracks(tracks);
        } else {
          node.innerHTML = `<div class="playlist-note">No tracklist available.</div>`;
        }
      } catch {
        node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

async function loadNtsProgram(programUrlOrSlug, page = 1) {
  if (!window.rteDownloader?.getNtsProgramEpisodes) return;
  const perPage = getEpisodesPerPage();
  // NTS server pages are 20; map client page to server page
  const serverPage = Math.max(1, Math.ceil((((Number(page) || 1) - 1) * perPage + 1) / 20));
  const payload = await window.rteDownloader.getNtsProgramEpisodes(programUrlOrSlug, serverPage);
  const totalItems = Number(payload?.totalItems || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  // Client-side offset within server response
  const clientOffset = ((targetPage - 1) * perPage) % 20;
  if (payload.episodes) payload.episodes = payload.episodes.slice(clientOffset, clientOffset + perPage);
  state.ntsProgramUrl = payload.programUrl || programUrlOrSlug;
  state.ntsProgramPage = targetPage;
  state.ntsProgramMaxPages = totalPages;
  state.ntsEpisodesPayload = payload;
  if (ntsProgramUrlInput) ntsProgramUrlInput.value = state.ntsProgramUrl;
  if (ntsProgramMeta) {
    const desc = (payload.description || "").trim();
    const img = (payload.image || "").trim();
    const genres = payload.genres || [];
    const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    const cadence = String(payload.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    const locationBadge = payload.location ? ` <span class="genre-pill">📍 ${escapeHtml(payload.location)}</span>` : "";
    ntsProgramMeta.innerHTML = `
      ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
      <strong>${escapeHtml(payload.title || "NTS")}</strong>${cadenceBadge}${locationBadge}<br>
      ${payload.runSchedule ? `<span class="muted">🕐 ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
      ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` — ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
      ${desc ? `<span class="muted">${escapeHtml(desc)}</span><br>` : ""}
      ${genresHtml}
      Page ${state.ntsProgramPage} of ${state.ntsProgramMaxPages} - ${Number(payload?.totalItems || 0)} episodes
    `;
  }
  renderNtsEpisodes(payload);
}

function setNtsEpisodeStatus(episodeUrl, text, isError = false) {
  if (!ntsEpisodesResult) return;
  const key = encodeURIComponent(String(episodeUrl || ""));
  const el = ntsEpisodesResult.querySelector(`[data-nts-episode-status="${key}"]`);
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
  el.className = `item-meta episode-status ${isError ? "error" : ""}`;
}

async function renderNtsScheduleList() {
  if (!ntsScheduleList || !window.rteDownloader?.listNtsSchedules) return;
  const schedules = await window.rteDownloader.listNtsSchedules();
  if (!schedules.length) {
    ntsScheduleList.innerHTML = `<div class="item">No NTS schedules yet.</div>`;
    return;
  }
  ntsScheduleList.innerHTML = schedules.map((s) => renderSchedulerCard(s, "nts")).join("");
}

// ── FIP ────────────────────────────────────────────────────────────────────────

async function refreshFipLiveNow() {
  if (!fipLiveNow || !fipStationSelect) return;
  const stationId = fipStationSelect.value || "fip";
  const stationName = fipStationSelect.options[fipStationSelect.selectedIndex]?.text || "FIP";
  const fipSection = fipLiveNow.closest(".nts-live-section-wrap");
  const audioWrap = fipSection ? fipSection.querySelector(".nts-live-audio-wrap") : fipLiveAudioWrap;
  const isPlaying = fipLiveAudio && !fipLiveAudio.paused;
  // Hide audio wrap only when not actively playing
  if (audioWrap && !isPlaying) {
    audioWrap.classList.add("nts-live-audio-hidden");
    audioWrap.classList.remove("nts-live-audio-at-bottom");
  }

  if (!window.rteDownloader?.getFipNowPlaying) {
    fipLiveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationName)}</strong> — Live</div><div class="nts-live-hero nts-live-hero-placeholder"><button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button></div>`;
    return;
  }
  try {
    const info = await window.rteDownloader.getFipNowPlaying(stationId);
    const title = String(info?.title || "").trim();
    const artist = String(info?.artist || "").trim();
    const coverUrl = String(info?.coverUrl || "").trim();

    const song = info?.currentSong;
    // Build single ♪ line: prefer livemeta currentSong (title — artist),
    // fall back to live API data using artist-first convention for sub-stations
    let songLine = "";
    if (song?.title) {
      songLine = `♪ ${escapeHtml(song.title)}${song.artist ? ` — ${escapeHtml(song.artist)}` : ""}`;
    } else if (title || artist) {
      songLine = artist
        ? `♪ ${escapeHtml(artist)}${title ? ` — ${escapeHtml(title)}` : ""}`
        : `♪ ${escapeHtml(title)}`;
    }

    const playBtnClass = isPlaying ? "nts-live-play-overlay live-overlay-btn hidden" : "nts-live-play-overlay live-overlay-btn";
    const parts = [];
    parts.push(`<div class="nts-live-header status"><strong>${escapeHtml(stationName)}</strong>`);
    if (songLine) parts.push(`<br><span class="muted" style="font-size:0.85em">${songLine}</span>`);
    parts.push("</div>");

    if (coverUrl) {
      parts.push('<div class="nts-live-hero">');
      parts.push(`<img src="${escapeHtml(coverUrl)}" alt="" class="nts-live-hero-img" loading="lazy" />`);
      parts.push(`<button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button>`);
      parts.push("</div>");
    } else {
      parts.push('<div class="nts-live-hero nts-live-hero-placeholder">');
      parts.push(`<button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button>`);
      parts.push(`<a href="https://www.radiofrance.fr/fip" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">radiofrance.fr/fip</a>`);
      parts.push("</div>");
    }
    fipLiveNow.innerHTML = parts.join("");
  } catch {
    const catchPlayBtnClass = isPlaying ? "nts-live-play-overlay live-overlay-btn hidden" : "nts-live-play-overlay live-overlay-btn";
    fipLiveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationName)}</strong> — Live</div><div class="nts-live-hero nts-live-hero-placeholder"><button type="button" class="${catchPlayBtnClass}" aria-label="Play Live">Play Live</button></div>`;
  }
}

function setFipEpisodeStatus(episodeUrl, text, isError = false) {
  if (!fipEpisodesResult) return;
  const key = encodeURIComponent(String(episodeUrl || ""));
  const el = fipEpisodesResult.querySelector(`[data-fip-episode-status="${key}"]`);
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
  el.className = `item-meta episode-status ${isError ? "error" : ""}`;
}

function setFipEpisodeChapters(episodeUrl, chapters) {
  state.fipChaptersByEpisode[String(episodeUrl || "")] = Array.isArray(chapters) ? chapters : [];
  const key = encodeURIComponent(String(episodeUrl || ""));
  const debugEl = fipEpisodesResult?.querySelector(`[data-fip-episode-cue-debug="${key}"]`);
  if (debugEl && chapters.length) {
    debugEl.style.display = "";
  }
}

// The Radio France songs API has no documented date limit — works for episodes
// many months old. Show the tracklist section whenever we have a broadcast timestamp.
function fipEpisodeHasTracklist(episode) {
  const ts = Number(episode?.broadcastStartTs || 0);
  return ts > 0 && ts < (Date.now() / 1000) + 300; // has timestamp and isn't in the future
}

function renderFipEpisodes(payload) {
  if (!fipEpisodesResult) return;
  const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];
  if (!rows.length) {
    fipEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
    return;
  }
  fipEpisodesResult.innerHTML = rows.map((episode) => {
    const episodeUrl = String(episode.episodeUrl || "").trim();
    const statusKey = encodeURIComponent(episodeUrl);
    const published = String(episode.publishedTime || "").trim();
    const fullTitle = String(episode.fullTitle || episode.title || "").trim();
    const desc = String(episode.description || "").trim();
    const programTitle = String(payload?.title || "FIP").trim();
    const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
    const genresHtml = (episode.genres && episode.genres.length)
      ? `<div class="genre-pills">${episode.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
      : "";
    const hasTracklist = fipEpisodeHasTracklist(episode);
    const startTs     = Number(episode.broadcastStartTs || 0);
    const durSecs     = episode.duration ? String(episode.duration) : "";
    const playlistHtml = hasTracklist
      ? `<div class="episode-inline-playlist" data-fip-episode-playlist="${statusKey}" data-fip-start-ts="${startTs}" data-fip-duration="${escapeHtml(durSecs)}"><div class="playlist-note">Loading tracklist...</div></div>`
      : `<div class="playlist-note">No broadcast timestamp available — tracklist cannot be loaded.</div>`;
    return `
      <div class="item">
        ${img}
        <div class="item-title">${escapeHtml(fullTitle)}</div>
        <div class="item-meta">${published ? escapeHtml(published) : "Date unknown"}</div>
        ${desc ? `<div class="item-meta muted">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "…" : ""}</div>` : ""}
        ${genresHtml}
        <div class="item-actions">
          <button class="secondary" data-fip-play-url="${escapeHtml(episodeUrl)}" data-fip-play-title="${escapeHtml(fullTitle)}" data-fip-play-program-title="${escapeHtml(programTitle)}" data-fip-play-image="${escapeHtml(episode.image || "")}">Play</button>
          <button class="secondary" data-fip-play-local-url="${escapeHtml(episodeUrl)}" data-fip-play-local-title="${escapeHtml(fullTitle)}" data-fip-play-local-program-title="${escapeHtml(programTitle)}" data-fip-play-local-image="${escapeHtml(episode.image || "")}">Play Local</button>
          <button data-fip-download-url="${escapeHtml(episodeUrl)}" data-fip-episode-title="${escapeHtml(fullTitle)}" data-fip-program-title="${escapeHtml(programTitle)}" data-fip-published="${escapeHtml(published)}" data-fip-image="${escapeHtml(episode.image || "")}">Download</button>
          <button class="secondary" data-fip-generate-cue-url="${escapeHtml(episodeUrl)}" data-fip-generate-cue-title="${escapeHtml(fullTitle)}" data-fip-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>
        </div>
        <div class="item-meta episode-status" data-fip-episode-status="${statusKey}" style="display:none;"></div>
        <div class="cue-debug-log" data-fip-episode-cue-debug="${statusKey}" style="display:none;"></div>
        ${playlistHtml}
      </div>
    `;
  }).join("");
  autoLoadFipPlaylists(rows).catch(() => {});
}

async function autoLoadFipPlaylists(episodes) {
  if (!window.rteDownloader?.getFipEpisodeTracklist) return;
  const queue = (episodes || []).filter((e) => e.episodeUrl && fipEpisodeHasTracklist(e));
  if (!queue.length) return;
  const concurrency = 3;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const ep = queue[index];
      index += 1;
      const statusKey  = encodeURIComponent(String(ep.episodeUrl || ""));
      const node       = fipEpisodesResult?.querySelector(`[data-fip-episode-playlist="${statusKey}"]`);
      if (!node) continue;
      const startTs    = Number(node.getAttribute("data-fip-start-ts") || 0);
      const durStr     = node.getAttribute("data-fip-duration") || "";
      const durSecs    = durStr ? Number(durStr) || 0 : 0;
      try {
        const data   = await window.rteDownloader.getFipEpisodeTracklist(ep.episodeUrl, startTs || undefined, durSecs || undefined);
        const tracks = Array.isArray(data) ? data : (data?.tracks || []);
        if (tracks.length) {
          node.innerHTML = renderPlaylistTracks(tracks);
        } else {
          node.innerHTML = `<div class="playlist-note">No song data found for this episode.</div>`;
        }
      } catch {
        node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

function renderBbcShowCard(r, { showScheduleBtn = false } = {}) {
  const genresHtml = (r.genres && r.genres.length)
    ? `<div class="genre-pills">${r.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const cadenceLabel = r.cadence && r.cadence !== "irregular" && r.cadence !== "unknown"
    ? r.cadence.charAt(0).toUpperCase() + r.cadence.slice(1)
    : "";
  const desc = (r.description || "").trim();
  const schedBtn = showScheduleBtn
    ? `<button class="secondary bbc-quick-schedule-btn" data-bbc-schedule-url="${escapeHtml(r.programUrl)}" style="margin-top:0.4rem;font-size:0.8em;">+ Scheduler</button>`
    : "";
  return `
  <div class="item clickable" data-load-bbc-program-url="${escapeHtml(r.programUrl)}">
    <div class="search-card">
      <div>${r.image ? `<img src="${escapeHtml(r.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
      <div>
        <div class="item-title">${escapeHtml(r.title || "BBC Program")}</div>
        ${cadenceLabel ? `<div class="item-meta"><strong>${escapeHtml(cadenceLabel)}</strong></div>` : ""}
        ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "…" : ""}</div>` : ""}
        ${genresHtml}
        ${schedBtn}
      </div>
    </div>
  </div>`;
}

function renderFipShowCard(r, { showScheduleBtn = false } = {}) {
  const genresHtml = (r.genres && r.genres.length)
    ? `<div class="genre-pills">${r.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const cadenceLabel = r.cadence && r.cadence !== "irregular" ? r.cadence.charAt(0).toUpperCase() + r.cadence.slice(1) : "";
  const metaParts = [cadenceLabel].filter(Boolean).join(" · ");
  const desc = (r.description || "").trim();
  const schedBtn = showScheduleBtn
    ? `<button class="secondary fip-quick-schedule-btn" data-fip-schedule-url="${escapeHtml(r.programUrl)}" style="margin-top:0.4rem;font-size:0.8em;">+ Scheduler</button>`
    : "";
  return `
  <div class="item clickable" data-fip-program-url="${escapeHtml(r.programUrl)}">
    <div class="search-card">
      <div>${r.image ? `<img src="${escapeHtml(r.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
      <div>
        <div class="item-title">${escapeHtml(r.title || "Show")}</div>
        ${metaParts ? `<div class="item-meta"><strong>${escapeHtml(metaParts)}</strong></div>` : ""}
        ${r.airtime ? `<div class="item-meta">🕐 ${escapeHtml(r.airtime)}</div>` : ""}
        ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "…" : ""}</div>` : ""}
        ${genresHtml}
        ${schedBtn}
      </div>
    </div>
  </div>`;
}

async function loadFipProgram(programUrlOrSlug, page = 1) {
  if (!window.rteDownloader?.getFipProgramEpisodes) return;
  const perPage = getEpisodesPerPage();
  const serverPage = Math.max(1, Math.ceil((((Number(page) || 1) - 1) * perPage + 1) / 20));
  const payload = await window.rteDownloader.getFipProgramEpisodes(programUrlOrSlug, serverPage);
  const totalItems = Number(payload?.totalItems || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage) || payload?.numPages || 1);
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  const clientOffset = ((targetPage - 1) * perPage) % 20;
  if (payload.episodes) payload.episodes = payload.episodes.slice(clientOffset, clientOffset + perPage);
  state.fipProgramUrl = payload.programUrl || programUrlOrSlug;
  state.fipProgramPage = targetPage;
  state.fipProgramMaxPages = totalPages;
  state.fipEpisodesPayload = payload;
  if (fipProgramUrlInput) fipProgramUrlInput.value = state.fipProgramUrl;
  if (fipProgramMeta) {
    const desc = (payload.description || "").trim();
    const img = (payload.image || "").trim();
    const genres = payload.genres || [];
    const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    const airtime = String(payload.airtime || "").trim();
    const cadence = String(payload.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    fipProgramMeta.innerHTML = `
      ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
      <strong>${escapeHtml(payload.title || "FIP")}</strong>${cadenceBadge}<br>
      ${airtime ? `<span class="muted">🕐 ${escapeHtml(airtime)}</span><br>` : ""}
      ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 300))}${desc.length > 300 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      Page ${state.fipProgramPage} of ${state.fipProgramMaxPages}${totalItems ? ` - ${totalItems} episodes` : ""}
    `;
  }
  renderFipEpisodes(payload);
}

async function renderFipScheduleList() {
  if (!fipScheduleList || !window.rteDownloader?.listFipSchedules) return;
  const schedules = await window.rteDownloader.listFipSchedules();
  if (!schedules.length) {
    fipScheduleList.innerHTML = `<div class="item">No FIP schedules yet.</div>`;
    return;
  }
  fipScheduleList.innerHTML = schedules.map((s) => renderSchedulerCard(s, "fip")).join("");
}

// ── KEXP ──────────────────────────────────────────────────────────────────────

const KEXP_STREAM_URL = "https://kexp.streamguys1.com/kexp160.aac";

async function refreshKexpLiveNow() {
  if (!kexpLiveNow) return;
  const isPlaying = kexpLiveAudio && !kexpLiveAudio.paused;
  if (kexpLiveAudioWrap && !isPlaying) {
    kexpLiveAudioWrap.classList.add("nts-live-audio-hidden");
    kexpLiveAudioWrap.classList.remove("nts-live-audio-at-bottom");
  }
  if (!window.rteDownloader?.getKexpNowPlaying) {
    if (kexpLiveInfo) kexpLiveInfo.innerHTML = `<div class="nts-live-header status muted"><strong>KEXP 90.3 FM</strong> — Live</div>`;
    kexpLiveNow.innerHTML = `<div class="nts-live-hero nts-live-hero-placeholder"></div>`;
    return;
  }
  try {
    const info = await window.rteDownloader.getKexpNowPlaying();
    const play = info?.play;
    const show = info?.show;
    const coverUrl = play?.image || show?.image || "";
    const isPlayingNow = kexpLiveAudio && !kexpLiveAudio.paused;

    // Info area — station name, now-playing track, album, DJ, show — displayed above image
    const infoLines = [];
    infoLines.push(`<div class="nts-live-header status"><strong>KEXP 90.3 FM</strong>`);
    if (play?.artist || play?.title) {
      const trackLine = [play.artist, play.title].filter(Boolean).join(" — ");
      infoLines.push(`<br><span class="muted" style="font-size:0.85em">♪ ${escapeHtml(trackLine)}</span>`);
    }
    if (play?.album) {
      infoLines.push(`<br><span class="muted" style="font-size:0.82em">Album: ${escapeHtml(play.album)}</span>`);
    }
    if (show?.hosts) {
      infoLines.push(`<br><span class="muted" style="font-size:0.82em">DJ: ${escapeHtml(show.hosts)}</span>`);
    }
    if (show?.programTitle) {
      infoLines.push(`<br><span class="muted" style="font-size:0.82em">${escapeHtml(show.programTitle)}</span>`);
    }
    if (play?.comment) {
      infoLines.push(`<br><span class="muted" style="font-size:0.8em;font-style:italic;">"${escapeHtml(play.comment)}"</span>`);
    }
    infoLines.push("</div>");
    if (kexpLiveInfo) kexpLiveInfo.innerHTML = infoLines.join("");

    // Hero area — image only, play overlay button; audio bar is CSS-positioned at bottom of image wrap
    const playBtnClass = isPlayingNow ? "nts-live-play-overlay live-overlay-btn hidden" : "nts-live-play-overlay live-overlay-btn";
    const heroLines = [];
    if (coverUrl) {
      heroLines.push('<div class="nts-live-hero">');
      heroLines.push(`<img src="${escapeHtml(coverUrl)}" alt="" class="nts-live-hero-img" loading="lazy" />`);
      heroLines.push(`<button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button>`);
      heroLines.push("</div>");
    } else {
      heroLines.push('<div class="nts-live-hero nts-live-hero-placeholder">');
      heroLines.push(`<button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button>`);
      heroLines.push(`<a href="https://www.kexp.org/listen" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">kexp.org/listen</a>`);
      heroLines.push("</div>");
    }
    kexpLiveNow.innerHTML = heroLines.join("");
  } catch {
    if (kexpLiveInfo) kexpLiveInfo.innerHTML = `<div class="nts-live-header status muted"><strong>KEXP 90.3 FM</strong> — Live</div>`;
    kexpLiveNow.innerHTML = `<div class="nts-live-hero nts-live-hero-placeholder"></div>`;
  }
}

function formatKexpEpisodeWindow(start, end) {
  if (!start) return "Date unknown";
  try {
    const startD = new Date(start);
    if (isNaN(startD.getTime())) return start;
    const dateOpts = { month: "short", day: "numeric", year: "numeric" };
    const timeOpts = { hour: "numeric", minute: "2-digit", hour12: state.timeFormat !== "24h" };
    const dateStr = startD.toLocaleDateString(undefined, dateOpts);
    const startTime = startD.toLocaleTimeString(undefined, timeOpts);
    if (end) {
      const endD = new Date(end);
      if (!isNaN(endD.getTime())) {
        const endTime = endD.toLocaleTimeString(undefined, timeOpts);
        return `${dateStr} · ${startTime}–${endTime}`;
      }
    }
    return `${dateStr} · ${startTime}`;
  } catch {
    return start;
  }
}

function setKexpEpisodeStatus(episodeUrl, text, isError = false) {
  if (!kexpEpisodesResult) return;
  const key = encodeURIComponent(String(episodeUrl || ""));
  const el = kexpEpisodesResult.querySelector(`[data-kexp-episode-status="${key}"]`);
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
  el.className = `item-meta episode-status ${isError ? "error" : ""}`;
}

// KEXP only keeps ~2 weeks of archive recordings via get_streaming_url
const KEXP_ARCHIVE_DAYS = 14;

function kexpArchiveAvailable(publishedTime) {
  if (!publishedTime) return false;
  const d = new Date(publishedTime);
  if (isNaN(d.getTime())) return false;
  return (Date.now() - d.getTime()) < KEXP_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
}

function renderKexpEpisodes(payload) {
  if (!kexpEpisodesResult) return;
  const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];
  if (!rows.length) {
    kexpEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
    return;
  }
  const programTitle = String(payload?.title || "KEXP").trim();
  kexpEpisodesResult.innerHTML = rows.map((episode) => {
    const episodeUrl = String(episode.episodeUrl || "").trim();
    const statusKey = encodeURIComponent(episodeUrl);
    const published = String(episode.publishedTime || "").trim();
    const fullTitle = String(episode.fullTitle || episode.title || "").trim();
    const hosts = String(episode.hosts || "").trim();
    const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
    const genresHtml = (episode.genres && episode.genres.length)
      ? `<div class="genre-pills">${episode.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
      : "";
    const timeWindow = formatKexpEpisodeWindow(published, episode.endTime);
    const hasArchive = kexpArchiveAvailable(published);
    const unavailableAttr = !hasArchive ? ` class="item kexp-unavailable" title="Archive window has passed — audio may be unavailable"` : ` class="item"`;
    return `
      <div${unavailableAttr}>
        ${img}
        <div class="item-title">${escapeHtml(fullTitle)}</div>
        ${hosts ? `<div class="item-meta muted">DJ: ${escapeHtml(hosts)}</div>` : ""}
        <div class="item-meta">${escapeHtml(timeWindow)}</div>
        ${genresHtml}
        <div class="item-actions">
          <button class="secondary" data-kexp-play-url="${escapeHtml(episodeUrl)}" data-kexp-play-title="${escapeHtml(fullTitle)}" data-kexp-play-program-title="${escapeHtml(programTitle)}" data-kexp-play-image="${escapeHtml(episode.image || "")}" data-kexp-play-published="${escapeHtml(published)}">Play</button>
          <button class="secondary" data-kexp-play-local-url="${escapeHtml(episodeUrl)}" data-kexp-play-local-title="${escapeHtml(fullTitle)}" data-kexp-play-local-program-title="${escapeHtml(programTitle)}" data-kexp-play-local-image="${escapeHtml(episode.image || "")}">Play Local</button>
          <button data-kexp-download-url="${escapeHtml(episodeUrl)}" data-kexp-episode-title="${escapeHtml(fullTitle)}" data-kexp-program-title="${escapeHtml(programTitle)}" data-kexp-published="${escapeHtml(published)}" data-kexp-image="${escapeHtml(episode.image || "")}">Download</button>
          <button class="secondary" data-kexp-generate-cue-url="${escapeHtml(episodeUrl)}" data-kexp-generate-cue-title="${escapeHtml(fullTitle)}" data-kexp-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>
        </div>
        <div class="item-meta episode-status" data-kexp-episode-status="${statusKey}" style="display:none;"></div>
        <div class="cue-debug-log" data-kexp-episode-cue-debug="${statusKey}" style="display:none;"></div>
        <div class="episode-inline-playlist" data-kexp-episode-playlist="${statusKey}">
          <div class="playlist-note">Loading tracklist...</div>
        </div>
      </div>
    `;
  }).join("");
  autoLoadKexpPlaylists(rows).catch(() => {});
}

async function autoLoadKexpPlaylists(episodes) {
  if (!window.rteDownloader?.getKexpEpisodeTracklist) return;
  const queue = (episodes || []).filter((e) => e.episodeUrl);
  const concurrency = 3;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const ep = queue[index];
      index += 1;
      const statusKey = encodeURIComponent(String(ep.episodeUrl || ""));
      const node = kexpEpisodesResult?.querySelector(`[data-kexp-episode-playlist="${statusKey}"]`);
      if (!node) continue;
      try {
        const data = await window.rteDownloader.getKexpEpisodeTracklist(ep.episodeUrl);
        const tracks = Array.isArray(data) ? data : (data?.tracks || []);
        if (tracks.length) {
          node.innerHTML = renderPlaylistTracks(tracks);
        } else {
          node.innerHTML = `<div class="playlist-note">No tracks logged for this show.</div>`;
        }
      } catch {
        node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

function renderKexpShowCard(r, { showScheduleBtn = false } = {}) {
  const genresHtml = (r.genres && r.genres.length)
    ? `<div class="genre-pills">${r.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const cadenceLabel = r.cadence && r.cadence !== "irregular" ? r.cadence.charAt(0).toUpperCase() + r.cadence.slice(1) : "";
  const desc = (r.description || "").trim();
  const location = (r.location || "").trim();
  const schedBtn = showScheduleBtn
    ? `<button class="secondary kexp-quick-schedule-btn" data-kexp-schedule-url="${escapeHtml(r.programUrl)}" style="margin-top:0.4rem;font-size:0.8em;">+ Scheduler</button>`
    : "";
  return `
  <div class="item clickable" data-kexp-program-url="${escapeHtml(r.programUrl)}">
    <div class="search-card">
      <div>${r.image ? `<img src="${escapeHtml(r.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
      <div>
        <div class="item-title">${escapeHtml(r.title || "Show")}</div>
        ${cadenceLabel ? `<div class="item-meta"><strong>${escapeHtml(cadenceLabel)}</strong></div>` : ""}
        ${r.airtime || r.timeSlot ? `<div class="item-meta">🕐 ${escapeHtml(r.airtime || r.timeSlot)}</div>` : ""}
        ${location ? `<div class="item-meta">📍 ${escapeHtml(location)}</div>` : ""}
        ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "…" : ""}</div>` : ""}
        ${genresHtml}
        ${schedBtn}
      </div>
    </div>
  </div>`;
}

// ── KEXP Extended Archive rendering ──────────────────────────────────────────

function renderKexpExtEpisodes(payload, programTitle) {
  if (!kexpExtEpisodesResult) return;
  const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];
  if (!rows.length) {
    kexpExtEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
    return;
  }
  const pTitle = String(programTitle || payload?.title || "KEXP Extended").trim();
  kexpExtEpisodesResult.innerHTML = rows.map((episode) => {
    const episodeUrl = String(episode.episodeUrl || "").trim();
    const statusKey = encodeURIComponent(episodeUrl);
    const published = String(episode.publishedTime || "").trim();
    const fullTitle = String(episode.fullTitle || episode.title || "").trim();
    const hosts = String(episode.hosts || "").trim();
    const durationSec = Number(episode.duration || 0);
    const durationStr = durationSec > 0 ? formatDurationFromSeconds(durationSec) : "";
    const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
    const timeStr = published ? new Date(published).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "";
    return `
      <div class="item">
        ${img}
        <div class="item-title">${escapeHtml(fullTitle || pTitle)}</div>
        ${hosts ? `<div class="item-meta muted">DJ: ${escapeHtml(hosts)}</div>` : ""}
        ${timeStr ? `<div class="item-meta">${escapeHtml(timeStr)}${durationStr ? ` · ${escapeHtml(durationStr)}` : ""}</div>` : ""}
        <div class="item-actions">
          <button class="secondary" data-kexp-ext-play-url="${escapeHtml(episodeUrl)}" data-kexp-ext-play-title="${escapeHtml(fullTitle)}" data-kexp-ext-play-program-title="${escapeHtml(pTitle)}" data-kexp-ext-play-image="${escapeHtml(episode.image || "")}">Play</button>
          <button class="secondary" data-kexp-ext-play-local-url="${escapeHtml(episodeUrl)}" data-kexp-ext-play-local-title="${escapeHtml(fullTitle)}" data-kexp-ext-play-local-program-title="${escapeHtml(pTitle)}" data-kexp-ext-play-local-image="${escapeHtml(episode.image || "")}">Play Local</button>
          <button data-kexp-ext-download-url="${escapeHtml(episodeUrl)}" data-kexp-ext-episode-title="${escapeHtml(fullTitle)}" data-kexp-ext-program-title="${escapeHtml(pTitle)}" data-kexp-ext-published="${escapeHtml(published)}" data-kexp-ext-image="${escapeHtml(episode.image || "")}">Download</button>
          <button class="secondary" data-kexp-ext-generate-cue-url="${escapeHtml(episodeUrl)}" data-kexp-ext-generate-cue-title="${escapeHtml(fullTitle)}" data-kexp-ext-generate-cue-program-title="${escapeHtml(pTitle)}">Generate CUE</button>
        </div>
        <div class="item-meta episode-status" data-kexp-ext-episode-status="${statusKey}" style="display:none;"></div>
        <div class="cue-debug-log" data-kexp-ext-episode-cue-debug="${statusKey}" style="display:none;"></div>
        <div class="episode-inline-playlist" data-kexp-ext-episode-playlist="${statusKey}">
          <div class="playlist-note">Loading tracklist...</div>
        </div>
      </div>`;
  }).join("");
  autoLoadKexpExtPlaylists(rows).catch(() => {});
}

async function autoLoadKexpExtPlaylists(episodes) {
  if (!window.rteDownloader?.getKexpExtendedEpisodeTracklist) return;
  const queue = (episodes || []).filter((e) => e.episodeUrl);
  const concurrency = 2;
  let index = 0;
  async function worker() {
    while (index < queue.length) {
      const ep = queue[index++];
      const statusKey = encodeURIComponent(String(ep.episodeUrl || ""));
      const node = kexpExtEpisodesResult?.querySelector(`[data-kexp-ext-episode-playlist="${statusKey}"]`);
      if (!node) continue;
      try {
        const data = await window.rteDownloader.getKexpExtendedEpisodeTracklist(ep.episodeUrl);
        const tracks = Array.isArray(data) ? data : (data?.tracks || []);
        node.innerHTML = tracks.length ? renderPlaylistTracks(tracks) : `<div class="playlist-note">No tracks logged.</div>`;
      } catch {
        node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

async function loadKexpExtendedProgram(programUrl, page = 1) {
  if (!window.rteDownloader?.getKexpExtendedProgramEpisodes) return;
  const pageNum = Math.max(1, Number(page) || 1);
  const perPage = getEpisodesPerPage();

  if (kexpExtProgramMeta) {
    kexpExtProgramMeta.style.display = "block";
    kexpExtProgramMeta.textContent = "Loading…";
  }
  if (kexpExtEpisodesResult) kexpExtEpisodesResult.innerHTML = "";

  let summary = null;
  try { summary = await window.rteDownloader.getKexpExtendedProgramSummary(programUrl); } catch {}

  const payload = await window.rteDownloader.getKexpExtendedProgramEpisodes(programUrl, pageNum);
  const total = Number(payload?.total || 0);
  const totalPages = total ? Math.max(1, Math.ceil(total / perPage)) : (payload?.hasMore ? pageNum + 1 : pageNum);
  const clampedPage = Math.max(1, Math.min(totalPages, pageNum));

  state.kexpExtProgramUrl = programUrl;
  state.kexpExtProgramPage = clampedPage;
  state.kexpExtProgramMaxPages = totalPages;

  const title = summary?.title || "KEXP Extended Show";
  const desc = (summary?.description || "").trim();
  const img = (summary?.image || "").trim();
  const genres = summary?.genres || [];
  const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";

  if (kexpExtProgramMeta) {
    kexpExtProgramMeta.style.display = "block";
    kexpExtProgramMeta.innerHTML = `
      ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:120px;margin-bottom:0.4rem;" loading="lazy" /><br>` : ""}
      <strong>${escapeHtml(title)}</strong><br>
      ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 250))}${desc.length > 250 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      <span class="muted">Page ${clampedPage} of ${totalPages}${total ? ` — ${total} episodes` : ""}</span>
    `;
  }
  if (kexpExtPaginationRow) kexpExtPaginationRow.style.display = "flex";

  // Client-side slice for perPage
  if (payload.episodes) {
    const offset = ((clampedPage - 1) * perPage) % perPage; // server returns per-page already
    payload.episodes = payload.episodes.slice(0, perPage);
  }
  renderKexpExtEpisodes(payload, title);
}

async function loadKexpProgram(programUrl, page = 1) {
  if (!window.rteDownloader?.getKexpProgramEpisodes) return;
  const perPage = getEpisodesPerPage();
  const serverPage = Math.max(1, Math.ceil((((Number(page) || 1) - 1) * perPage + 1) / 20));
  const payload = await window.rteDownloader.getKexpProgramEpisodes(programUrl, serverPage);
  const totalItems = Number(payload?.total || 0);
  const totalPages = totalItems ? Math.max(1, Math.ceil(totalItems / perPage)) : (payload?.hasMore ? (Number(page) || 1) + 1 : Number(page) || 1);
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  const clientOffset = ((targetPage - 1) * perPage) % 20;
  if (payload.episodes) payload.episodes = payload.episodes.slice(clientOffset, clientOffset + perPage);
  state.kexpProgramUrl = programUrl;
  state.kexpProgramPage = targetPage;
  state.kexpProgramMaxPages = totalPages;
  state.kexpEpisodesPayload = payload;
  if (kexpProgramUrlInput) kexpProgramUrlInput.value = programUrl;
  if (kexpProgramMeta) {
    // Try to get summary for display
    let summary = null;
    try { summary = await window.rteDownloader.getKexpProgramSummary(programUrl); } catch {}
    const title = summary?.title || "KEXP Program";
    const desc = (summary?.description || "").trim();
    const img = (summary?.image || "").trim();
    const genres = summary?.genres || [];
    const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    const cadence = String(summary?.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    const location = String(summary?.location || "").trim();
    kexpProgramMeta.innerHTML = `
      ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
      <strong>${escapeHtml(title)}</strong>${cadenceBadge}<br>
      ${location ? `<span class="muted">${escapeHtml(location)}</span><br>` : ""}
      ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 300))}${desc.length > 300 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      Page ${state.kexpProgramPage} of ${state.kexpProgramMaxPages}${totalItems ? ` — ${totalItems} shows` : ""}
    `;
    payload.title = title;
  }
  renderKexpEpisodes(payload);
}

async function renderKexpScheduleList() {
  if (!kexpScheduleList || !window.rteDownloader?.listKexpSchedules) return;
  const schedules = await window.rteDownloader.listKexpSchedules();
  if (!schedules.length) {
    kexpScheduleList.innerHTML = `<div class="item">No KEXP schedules yet.</div>`;
    return;
  }
  kexpScheduleList.innerHTML = schedules.map((s) => renderSchedulerCard(s, "kexp")).join("");
}

async function loadSettings() {
  const settings = await window.rteDownloader.getSettings();
  state.timeFormat = settings?.timeFormat === "12h" ? "12h" : "24h";
  state.episodesPerPage = Math.max(1, Math.min(50, Number(settings?.episodesPerPage || DEFAULT_EPISODES_PER_PAGE) || DEFAULT_EPISODES_PER_PAGE));
  state.discoveryCount = Math.max(1, Math.min(24, Number(settings?.discoveryCount || DEFAULT_DISCOVERY_COUNT) || DEFAULT_DISCOVERY_COUNT));
  state.downloadDir = String(settings?.downloadDir || settings?.rteDownloadDir || "");
  state.pathFormat = String(settings?.pathFormat || state.pathFormat);
  state.cueAutoGenerate = Boolean(settings?.cueAutoGenerate);
  state.outputFormat = normalizeOutputFormatValue(settings?.outputFormat || "m4a");
  state.outputQuality = String(settings?.outputQuality || "128K");
  state.normalizeLoudness = settings?.normalizeLoudness == null ? true : Boolean(settings.normalizeLoudness);
  state.maxConcurrentDownloads = Math.max(1, Math.min(8, Number(settings?.maxConcurrentDownloads || 2) || 2));
  state.dedupeMode = String(settings?.dedupeMode || "source-id");
  state.id3Tagging = settings?.id3Tagging == null ? true : Boolean(settings.id3Tagging);
  state.feedExportEnabled = settings?.feedExportEnabled == null ? true : Boolean(settings.feedExportEnabled);
  state.webhookUrl = String(settings?.webhookUrl || "");
  state.auddTrackMatching = settings?.auddTrackMatching == null ? false : Boolean(settings.auddTrackMatching);
  state.auddApiToken = String(settings?.auddApiToken || "");
  state.fingerprintTrackMatching = settings?.fingerprintTrackMatching == null ? false : Boolean(settings.fingerprintTrackMatching);
  state.acoustidApiKey = String(settings?.acoustidApiKey || "");
  state.songrecTrackMatching = settings?.songrecTrackMatching == null ? false : Boolean(settings.songrecTrackMatching);
  state.songrecSampleSeconds = Math.max(8, Math.min(45, Number(settings?.songrecSampleSeconds || 20) || 20));
  state.ffmpegCueSilenceDetect = settings?.ffmpegCueSilenceDetect == null ? true : Boolean(settings.ffmpegCueSilenceDetect);
  state.ffmpegCueLoudnessDetect = settings?.ffmpegCueLoudnessDetect == null ? true : Boolean(settings.ffmpegCueLoudnessDetect);
  state.ffmpegCueSpectralDetect = settings?.ffmpegCueSpectralDetect == null ? true : Boolean(settings.ffmpegCueSpectralDetect);
  timeFormatSelect.value = state.timeFormat;
  if (episodesPerPageInput) episodesPerPageInput.value = String(state.episodesPerPage);
  if (discoveryCountInput) discoveryCountInput.value = String(state.discoveryCount);
  downloadDirInput.value = getActiveDownloadDir();
  if (pathFormatInput) {
    pathFormatInput.value = state.pathFormat;
  }
  cueAutoGenerateCheckbox.checked = state.cueAutoGenerate;
  outputFormatSelect.value = normalizeOutputFormatValue(state.outputFormat);
  outputQualitySelect.value = state.outputQuality;
  normalizeLoudnessCheckbox.checked = state.normalizeLoudness;
  maxConcurrentInput.value = String(state.maxConcurrentDownloads);
  dedupeModeSelect.value = state.dedupeMode;
  id3TaggingCheckbox.checked = state.id3Tagging;
  feedExportCheckbox.checked = state.feedExportEnabled;
  webhookUrlInput.value = state.webhookUrl;
  if (auddTrackMatchingCheckbox) {
    auddTrackMatchingCheckbox.checked = state.auddTrackMatching;
  }
  if (auddApiTokenInput) {
    auddApiTokenInput.value = state.auddApiToken;
  }
  if (fingerprintTrackMatchingCheckbox) {
    fingerprintTrackMatchingCheckbox.checked = state.fingerprintTrackMatching;
  }
  if (acoustidApiKeyInput) {
    acoustidApiKeyInput.value = state.acoustidApiKey;
  }
  if (songrecTrackMatchingCheckbox) {
    songrecTrackMatchingCheckbox.checked = state.songrecTrackMatching;
  }
  if (songrecSampleSecondsInput) {
    songrecSampleSecondsInput.value = String(state.songrecSampleSeconds);
  }
  if (ffmpegCueSilenceCheckbox) {
    ffmpegCueSilenceCheckbox.checked = state.ffmpegCueSilenceDetect;
  }
  if (ffmpegCueLoudnessCheckbox) {
    ffmpegCueLoudnessCheckbox.checked = state.ffmpegCueLoudnessDetect;
  }
  if (ffmpegCueSpectralCheckbox) {
    ffmpegCueSpectralCheckbox.checked = state.ffmpegCueSpectralDetect;
  }
  renderPathFormatPreview();
}

async function refreshTimeBasedUi() {
  await refreshSchedules();
  await refreshBbcSchedules();
  if (state.currentProgramUrl) {
    await loadProgram(state.currentProgramUrl, state.currentProgramPage);
  }
  if (state.bbcProgramUrl) {
    await loadBbcProgram(state.bbcProgramUrl, state.bbcProgramPage);
  }
}

quickDownloadBtn.addEventListener("click", async () => {
  const pageUrl = quickUrlInput.value.trim();
  if (!pageUrl) {
    setQuickStatus("Enter an RTE episode URL.", true);
    return;
  }

  const forceDownload = quickDownloadBtn.dataset.forceNext === "1";
  if (forceDownload) {
    delete quickDownloadBtn.dataset.forceNext;
  }
  setButtonBusy(quickDownloadBtn, true, "Download");
  quickLog.textContent = "";
  setQuickStatus(forceDownload ? "Forcing re-download..." : "Resolving title and stream...");
  const progressToken = createProgressToken("quick");
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setQuickStatus(formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadFromPageUrl(pageUrl, progressToken, { forceDownload });
    const cueText = data?.cue?.cuePath ? ` + CUE/chapters generated${formatCueAlignment(data.cue)}` : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Saved";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setQuickStatus(`${statusPrefix}: ${data.outputDir}\\${data.fileName}${cueText}${hintText}`);
    if (data?.existing) {
      quickDownloadBtn.dataset.forceNext = "1";
    } else {
      delete quickDownloadBtn.dataset.forceNext;
    }
    quickLog.textContent = data.log || "Done.";
  } catch (error) {
    if (shouldArmForceRetry(error?.message)) {
      quickDownloadBtn.dataset.forceNext = "1";
    }
    setQuickStatus(error.message, true);
  } finally {
    detachProgress();
    setButtonBusy(quickDownloadBtn, false, "Download");
  }
});

quickUrlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  if (!quickDownloadBtn.disabled) {
    quickDownloadBtn.click();
  }
});

bbcDownloadBtn.addEventListener("click", async () => {
  const pageUrl = bbcUrlInput.value.trim();
  if (!pageUrl) {
    setBbcStatus("Enter a BBC URL.", true);
    return;
  }

  const forceDownload = bbcDownloadBtn.dataset.forceNext === "1";
  if (forceDownload) {
    delete bbcDownloadBtn.dataset.forceNext;
  }
  setButtonBusy(bbcDownloadBtn, true, "Download");
  bbcLog.textContent = "";
  setBbcStatus(forceDownload ? "Forcing re-download..." : "Resolving stream...");
  const progressToken = createProgressToken("bbc");
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setBbcStatus(formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadFromBbcUrl(pageUrl, progressToken, { forceDownload });
    const cueText = data?.cue?.cuePath ? ` + CUE/chapters generated${formatCueAlignment(data.cue)}` : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Saved";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setBbcStatus(`${statusPrefix}: ${data.outputDir}\\${data.fileName}${cueText}${hintText}`);
    if (data?.existing) {
      bbcDownloadBtn.dataset.forceNext = "1";
    } else {
      delete bbcDownloadBtn.dataset.forceNext;
    }
    bbcLog.textContent = data.log || "Done.";
  } catch (error) {
    if (shouldArmForceRetry(error?.message)) {
      bbcDownloadBtn.dataset.forceNext = "1";
    }
    setBbcStatus(error.message, true);
  } finally {
    detachProgress();
    setButtonBusy(bbcDownloadBtn, false, "Download");
  }
});

bbcUrlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  if (!bbcDownloadBtn.disabled) {
    bbcDownloadBtn.click();
  }
});

stationSelect.addEventListener("change", () => {
  refreshLivePanel().catch((error) => {
    liveNow.textContent = error.message;
  });
});

refreshLiveBtn.addEventListener("click", () => {
  setButtonBusy(refreshLiveBtn, true, "Refresh");
  refreshLivePanel()
    .catch((error) => {
      liveNow.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(refreshLiveBtn, false, "Refresh");
    });
});

bbcStationSelect.addEventListener("change", () => {
  refreshBbcLivePanel().catch((error) => {
    bbcLiveNow.textContent = error.message;
  });
});

bbcRefreshLiveBtn.addEventListener("click", () => {
  setButtonBusy(bbcRefreshLiveBtn, true, "Refresh");
  loadBbcLiveStations()
    .catch((error) => {
      bbcLiveNow.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(bbcRefreshLiveBtn, false, "Refresh");
    });
});

async function refreshNtsLiveNow() {
  if (!ntsLiveNow || !ntsStationSelect) return;
  const channelId = ntsStationSelect.value || "nts1";
  const stationLabel = (state.ntsLiveStations || []).find((s) => String(s.id) === channelId)?.name || (channelId === "nts2" ? "NTS 2" : "NTS 1");
  const ntsSection = ntsLiveNow.closest(".nts-live-section-wrap");
  const audioWrap = ntsSection ? ntsSection.querySelector(".nts-live-audio-wrap") : document.getElementById("ntsLiveAudio")?.parentElement;
  if (audioWrap) {
    audioWrap.classList.add("nts-live-audio-hidden");
    audioWrap.classList.remove("nts-live-audio-at-bottom");
  }

  if (!window.rteDownloader?.getNtsLiveNow) {
    ntsLiveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationLabel)}</strong> — Live<br><span class="muted">Select a station to stream.</span></div><div class="nts-live-hero nts-live-hero-placeholder"><span class="nts-live-location-overlay"></span><a href="https://www.nts.live/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">nts.live</a></div>`;
    return;
  }
  try {
    const info = await window.rteDownloader.getNtsLiveNow(channelId);
    const img = (info.image || "").trim();
    const programmeName = info.programmeName || "Live";
    const description = (info.description || "").trim();
    const location = (info.location || "").trim();
    const timeSlotLocal = formatNtsTimeSlotLocal(info.startTimestamp, info.endTimestamp);
    const timeSlotDisplay = timeSlotLocal || (info.timeSlot || "").trim();

    const line1Parts = [`<strong>${escapeHtml(info.stationName || stationLabel)}</strong> — ${escapeHtml(programmeName)}`];
    if (timeSlotDisplay) line1Parts.push(` (${escapeHtml(timeSlotDisplay)})`);
    const line1 = line1Parts.join("");
    const line2 = description ? escapeHtml(description) : "";

    const parts = [];
    parts.push(`<div class="nts-live-header status">${line1}`);
    if (line2) parts.push(`<br><span class="muted">${line2}</span>`);
    parts.push("</div>");

    if (img) {
      parts.push('<div class="nts-live-hero">');
      parts.push(`<img src="${escapeHtml(img)}" alt="" class="nts-live-hero-img" loading="lazy" />`);
      if (location) parts.push(`<span class="nts-live-location-overlay">${escapeHtml(location)}</span>`);
      parts.push('<button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button>');
      parts.push("</div>");
    } else {
      parts.push('<div class="nts-live-hero nts-live-hero-placeholder">');
      if (location) parts.push(`<span class="nts-live-location-overlay">${escapeHtml(location)}</span>`);
      parts.push('<button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button>');
      parts.push('<a href="https://www.nts.live/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">nts.live</a>');
      parts.push("</div>");
    }
    ntsLiveNow.innerHTML = parts.join("");
  } catch {
    ntsLiveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationLabel)}</strong> — Live<br><span class="muted">Stream loading. Click Refresh to fetch current show.</span></div><div class="nts-live-hero nts-live-hero-placeholder"><a href="https://www.nts.live/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">nts.live</a></div>`;
  }
}

async function refreshWwfLiveNow() {
  if (!wwfLiveNow) return;
  if (!window.rteDownloader?.getWwfLiveNow) {
    wwfLiveNow.innerHTML = `<div class="nts-live-header status muted"><strong>Worldwide FM</strong> — Live<br><span class="muted">Listen at <a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer">worldwidefm.net</a></span></div><div class="nts-live-hero nts-live-hero-placeholder"><a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">worldwidefm.net</a></div>`;
    return;
  }
  try {
    const info = await window.rteDownloader.getWwfLiveNow();
    const timeSlotLocal = formatNtsTimeSlotLocal(info.startTimestamp, info.endTimestamp);
    const timeSlotDisplay = timeSlotLocal || (info.timeSlot || "").trim();
    const upNextLabel = info.isUpcoming ? "Up Next: " : "";
    const line1Parts = [`<strong>${escapeHtml(info.stationName || "Worldwide FM")}</strong> — ${upNextLabel}${escapeHtml(info.programmeName || "Live")}`];
    if (timeSlotDisplay) line1Parts.push(` (${escapeHtml(timeSlotDisplay)})`);
    const line1 = line1Parts.join("");
    const line2 = (info.description || "").trim() ? escapeHtml(info.description) : "";
    const parts = [];
    parts.push(`<div class="nts-live-header status">${line1}`);
    if (line2) parts.push(`<br><span class="muted">${line2}</span>`);
    parts.push("</div>");
    const img = (info.image || "").trim();
    const location = (info.location || "").trim();
    if (img) {
      parts.push('<div class="nts-live-hero">');
      parts.push(`<img src="${escapeHtml(img)}" alt="" class="nts-live-hero-img" loading="lazy" />`);
      if (location) parts.push(`<span class="nts-live-location-overlay">${escapeHtml(location)}</span>`);
      parts.push('<button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button>');
      parts.push("</div>");
    } else {
      parts.push('<div class="nts-live-hero nts-live-hero-placeholder">');
      if (location) parts.push(`<span class="nts-live-location-overlay">${escapeHtml(location)}</span>`);
      parts.push('<button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button>');
      parts.push('<a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">worldwidefm.net</a>');
      parts.push("</div>");
    }
    wwfLiveNow.innerHTML = parts.join("");
  } catch {
    wwfLiveNow.innerHTML = `<div class="nts-live-header status muted"><strong>Worldwide FM</strong> — Live<br><span class="muted">Could not load schedule. <a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer">worldwidefm.net</a></span></div><div class="nts-live-hero nts-live-hero-placeholder"><a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">worldwidefm.net</a></div>`;
  }
}

if (wwfLiveNow) {
  wwfLiveNow.addEventListener("click", (e) => {
    const playBtn = e.target.closest(".nts-live-play-overlay");
    if (!playBtn) return;
    const wwfLiveAudio = document.getElementById("wwfLiveAudio");
    const wwfAudioWrap = document.querySelector(".wwf-live-audio-wrap");
    const streamUrl = (state.wwfLiveStations && state.wwfLiveStations[0]?.streamUrl) || "https://worldwide-fm.radiocult.fm/stream";
    if (wwfLiveAudio) {
      wwfLiveAudio.src = streamUrl;
      wwfLiveAudio.play().catch(() => {});
    }
    if (wwfAudioWrap) {
      wwfAudioWrap.classList.remove("nts-live-audio-hidden");
      wwfAudioWrap.classList.add("nts-live-audio-at-bottom");
    }
    playBtn.classList.add("hidden");
  });
}
if (wwfRefreshLiveBtn) {
  wwfRefreshLiveBtn.addEventListener("click", () => {
    setActiveTab("wwf");
    refreshWwfLiveNow().catch(() => {});
  });
}

if (ntsLiveNow) {
  ntsLiveNow.addEventListener("click", (e) => {
    const playBtn = e.target.closest(".nts-live-play-overlay");
    if (!playBtn || !ntsStationSelect || !ntsLiveAudio) return;
    const opt = ntsStationSelect.options[ntsStationSelect.selectedIndex];
    const streamUrl = (opt && opt.getAttribute("data-stream-url")) || "";
    if (!streamUrl) return;
    ntsLiveAudio.src = streamUrl;
    ntsLiveAudio.play().catch(() => {});
    playBtn.classList.add("hidden");
    const ntsSection = ntsLiveNow.closest(".nts-live-section-wrap");
    const audioWrap = ntsSection ? ntsSection.querySelector(".nts-live-audio-wrap") : document.getElementById("ntsLiveAudio")?.parentElement;
    if (audioWrap) {
      audioWrap.classList.remove("nts-live-audio-hidden");
      audioWrap.classList.add("nts-live-audio-at-bottom");
    }
  });
}
if (ntsStationSelect) {
  ntsStationSelect.addEventListener("change", () => {
    const opt = ntsStationSelect.options[ntsStationSelect.selectedIndex];
    const streamUrl = (opt && opt.getAttribute("data-stream-url")) || "";
    if (ntsLiveAudio && !ntsLiveAudio.paused) {
      ntsLiveAudio.src = streamUrl;
      if (streamUrl) ntsLiveAudio.play().catch(() => {});
    }
    refreshNtsLiveNow().catch(() => {});
  });
}
if (ntsRefreshLiveBtn) {
  ntsRefreshLiveBtn.addEventListener("click", () => {
    setActiveTab("nts");
    if (ntsStationSelect && state.ntsLiveStations.length === 0 && window.rteDownloader?.getNtsLiveStations) {
      window.rteDownloader.getNtsLiveStations().then((stations) => {
        state.ntsLiveStations = stations || [];
        if (ntsStationSelect && state.ntsLiveStations.length) {
          ntsStationSelect.innerHTML = state.ntsLiveStations.map((s) => {
            const streamUrl = (s.streamUrl || "").trim();
            return `<option value="${escapeHtml(s.id)}"${streamUrl ? ` data-stream-url="${escapeHtml(streamUrl)}"` : ""}>${escapeHtml(s.name)}</option>`;
          }).join("");
          const firstWithStream = state.ntsLiveStations.find((s) => (s.streamUrl || "").trim());
          if (firstWithStream && ntsLiveAudio) ntsLiveAudio.src = firstWithStream.streamUrl || "";
          refreshNtsLiveNow().catch(() => {});
        }
      }).catch(() => {});
    } else {
      refreshNtsLiveNow().catch(() => {});
    }
  });
}

liveOverlayPlayBtn.addEventListener("click", () => {
  const rawSrc = liveOverlayPlayBtn.dataset.autoplaySrc || "";
  if (!rawSrc) {
    return;
  }
  const autoplaySrc = setUrlParam(rawSrc, "_ts", String(Date.now()));
  livePlayerFrame.src = autoplaySrc;
  liveOverlayPlayBtn.classList.add("hidden");
});

bbcLiveOverlayPlayBtn.addEventListener("click", () => {
  const stationUrl = bbcLiveOverlayPlayBtn.dataset.stationUrl || "";
  const candidates = buildBbcAutoplayCandidates(stationUrl);
  if (!candidates.length) {
    return;
  }
  const ts = String(Date.now());
  bbcLivePlayerFrame.src = setUrlParam(candidates[0], "_ts", ts);
  if (candidates[1]) {
    setTimeout(() => {
      bbcLivePlayerFrame.src = setUrlParam(candidates[1], "_ts", String(Date.now()));
    }, 450);
  }
  if (candidates[2]) {
    setTimeout(() => {
      bbcLivePlayerFrame.src = setUrlParam(candidates[2], "_ts", String(Date.now()));
    }, 1000);
  }
  bbcLiveOverlayPlayBtn.classList.add("hidden");
});

programSearchBtn.addEventListener("click", async () => {
  await runProgramSearch(programSearchInput.value.trim());
});

programSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  await runProgramSearch(programSearchInput.value.trim());
});

programSearchInput.addEventListener("focus", async () => {
  if (state.hasLoadedProgramCatalog) {
    programSearchResult.classList.remove("hidden");
    return;
  }

  await runProgramSearch("");
  state.hasLoadedProgramCatalog = true;
});

programSearchInput.addEventListener("input", async () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  const query = programSearchInput.value.trim();
  searchDebounceTimer = setTimeout(async () => {
    if (!query) {
      await runProgramSearch("");
      state.hasLoadedProgramCatalog = true;
      return;
    }

    await runProgramSearch(query);
  }, 220);
});

programSearchResult.addEventListener("click", (event) => {
  const item = event.target.closest(".item[data-load-program-url]");
  if (!item) {
    return;
  }

  const url = item.getAttribute("data-load-program-url");
  if (url) {
    hideSearchDropdown();
    loadProgram(url, 1).catch((error) => {
      programMeta.textContent = error.message;
    });
  }
});

bbcProgramSearchResult.addEventListener("click", async (event) => {
  const schedBtn = event.target.closest(".bbc-quick-schedule-btn");
  if (schedBtn) {
    event.stopPropagation();
    const url = schedBtn.getAttribute("data-bbc-schedule-url") || "";
    if (!url || !window.rteDownloader?.addBbcSchedule) return;
    schedBtn.textContent = "Adding…";
    schedBtn.disabled = true;
    try {
      await window.rteDownloader.addBbcSchedule(url, { backfillCount: 1 });
      schedBtn.textContent = "✓ Scheduled";
      await refreshBbcSchedules();
    } catch {
      schedBtn.textContent = "Error";
      schedBtn.disabled = false;
    }
    return;
  }

  const item = event.target.closest(".item[data-load-bbc-program-url]");
  if (!item) {
    return;
  }

  const url = item.getAttribute("data-load-bbc-program-url");
  if (url) {
    hideBbcSearchDropdown();
    loadBbcProgram(url, 1).catch((error) => {
      bbcProgramMeta.textContent = error.message;
    });
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".search-box")) {
    return;
  }
  hideSearchDropdown();
  hideBbcSearchDropdown();
});

loadProgramBtn.addEventListener("click", () => {
  const url = programUrlInput.value.trim();
  if (!url) {
    return;
  }

  setButtonBusy(loadProgramBtn, true, "Load Episodes");
  loadProgram(url, 1)
    .catch((error) => {
      programMeta.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(loadProgramBtn, false, "Load Episodes");
    });
});

bbcLoadProgramBtn.addEventListener("click", () => {
  const url = bbcProgramUrlInput.value.trim();
  if (!url) {
    bbcProgramMeta.textContent = "Enter a BBC program URL first.";
    return;
  }

  setButtonBusy(bbcLoadProgramBtn, true, "Load Episodes");
  loadBbcProgram(url, 1)
    .catch((error) => {
      bbcProgramMeta.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(bbcLoadProgramBtn, false, "Load Episodes");
    });
});

bbcProgramSearchBtn.addEventListener("click", async () => {
  await runBbcProgramSearch(bbcProgramSearchInput.value.trim());
});

bbcProgramSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  await runBbcProgramSearch(bbcProgramSearchInput.value.trim());
});

bbcProgramSearchInput.addEventListener("focus", async () => {
  if (state.hasLoadedBbcProgramCatalog) {
    bbcProgramSearchResult.classList.remove("hidden");
    return;
  }
  bbcProgramSearchResult.classList.remove("hidden");
  bbcProgramSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
  state.hasLoadedBbcProgramCatalog = true;
});

bbcProgramSearchInput.addEventListener("input", async () => {
  if (bbcSearchDebounceTimer) {
    clearTimeout(bbcSearchDebounceTimer);
  }

  const query = bbcProgramSearchInput.value.trim();
  bbcSearchDebounceTimer = setTimeout(async () => {
    if (query.length < 2) {
      bbcProgramSearchResult.classList.remove("hidden");
      bbcProgramSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
      return;
    }

    await runBbcProgramSearch(query);
  }, 220);
});

bbcProgramUrlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  if (!bbcLoadProgramBtn.disabled) {
    bbcLoadProgramBtn.click();
  }
});

prevPageBtn.addEventListener("click", () => {
  if (!state.currentProgramUrl || state.currentProgramPage <= 1) {
    return;
  }

  state.currentProgramPage -= 1;
  loadProgram(state.currentProgramUrl, state.currentProgramPage).catch((error) => {
    programMeta.textContent = error.message;
  });
});

nextPageBtn.addEventListener("click", () => {
  if (!state.currentProgramUrl || !state.currentEpisodes) {
    return;
  }

  if (state.currentProgramPage >= state.currentMaxPages) {
    return;
  }

  state.currentProgramPage += 1;
  loadProgram(state.currentProgramUrl, state.currentProgramPage).catch((error) => {
    programMeta.textContent = error.message;
  });
});

bbcPrevPageBtn.addEventListener("click", () => {
  if (!state.bbcProgramUrl || state.bbcProgramPage <= 1) {
    return;
  }

  state.bbcProgramPage -= 1;
  renderBbcEpisodes(state.bbcEpisodesPayload || { episodes: [] });
  const totalRows = Number(state.bbcEpisodesPayload?.episodes?.length || 0);
  {
    const p = state.bbcEpisodesPayload || {};
    const cadence = String(p.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" && cadence !== "unknown" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    const genres = Array.isArray(p.genres) ? p.genres : [];
    const genresHtml = genres.length ? `<div class="genre-pills" style="margin-top:0.3rem;">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    bbcProgramMeta.innerHTML = `
      <strong>${escapeHtml(p.title || "BBC Program")}</strong>${cadenceBadge}<br>
      ${p.runSchedule ? `<span class="muted">🕐 ${escapeHtml(toLocalSchedule(p.runSchedule))}</span><br>` : ""}
      ${p.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(p.nextBroadcastAt))}${p.nextBroadcastTitle ? ` — ${escapeHtml(p.nextBroadcastTitle)}` : ""}<br>` : ""}
      ${p.description ? `<span class="muted">${escapeHtml(String(p.description).slice(0, 300))}${String(p.description).length > 300 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
    `;
  }
});

bbcNextPageBtn.addEventListener("click", () => {
  if (!state.bbcProgramUrl || !state.bbcEpisodesPayload) {
    return;
  }

  if (state.bbcProgramPage >= state.bbcProgramMaxPages) {
    return;
  }

  state.bbcProgramPage += 1;
  renderBbcEpisodes(state.bbcEpisodesPayload || { episodes: [] });
  const totalRows = Number(state.bbcEpisodesPayload?.episodes?.length || 0);
  {
    const p = state.bbcEpisodesPayload || {};
    const cadence = String(p.cadence || "").trim();
    const cadenceBadge = cadence && cadence !== "irregular" && cadence !== "unknown" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
    const genres = Array.isArray(p.genres) ? p.genres : [];
    const genresHtml = genres.length ? `<div class="genre-pills" style="margin-top:0.3rem;">${genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
    bbcProgramMeta.innerHTML = `
      <strong>${escapeHtml(p.title || "BBC Program")}</strong>${cadenceBadge}<br>
      ${p.runSchedule ? `<span class="muted">🕐 ${escapeHtml(toLocalSchedule(p.runSchedule))}</span><br>` : ""}
      ${p.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(p.nextBroadcastAt))}${p.nextBroadcastTitle ? ` — ${escapeHtml(p.nextBroadcastTitle)}` : ""}<br>` : ""}
      ${p.description ? `<span class="muted">${escapeHtml(String(p.description).slice(0, 300))}${String(p.description).length > 300 ? "…" : ""}</span><br>` : ""}
      ${genresHtml}
      Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
    `;
  }
});

tabRteBtn.addEventListener("click", () => {
  setActiveTab("rte");
});

tabBbcBtn.addEventListener("click", () => {
  setActiveTab("bbc");
});
if (tabWwfBtn) {
  tabWwfBtn.addEventListener("click", () => setActiveTab("wwf"));
}
if (tabNtsBtn) {
  tabNtsBtn.addEventListener("click", () => setActiveTab("nts"));
}
if (tabFipBtn) {
  tabFipBtn.addEventListener("click", () => setActiveTab("fip"));
}
if (tabKexpBtn) {
  tabKexpBtn.addEventListener("click", () => setActiveTab("kexp"));
}
if (tabSchedulesBtn) {
  tabSchedulesBtn.addEventListener("click", () => {
    setActiveTab("schedules");
    clearInterval(healthDashboardTimer);
    healthDashboardTimer = setInterval(() => renderAllSchedules().catch(() => {}), 5 * 60 * 1000);
  });
}
if (refreshAllSchedulesBtn) {
  refreshAllSchedulesBtn.addEventListener("click", () => renderAllSchedules().catch(() => {}));
}
tabSettingsBtn.addEventListener("click", () => {
  setActiveTab("settings");
  loadHistory().catch(() => {});
});

themeToggleBtn.addEventListener("click", () => {
  applyTheme(state.theme === "dark" ? "light" : "dark");
});

scheduleBackfillMode.addEventListener("change", () => {
  const isBackfill = scheduleBackfillMode.value === "backfill";
  scheduleBackfillCount.disabled = !isBackfill;
});

bbcScheduleBackfillMode.addEventListener("change", () => {
  const isBackfill = bbcScheduleBackfillMode.value === "backfill";
  bbcScheduleBackfillCount.disabled = !isBackfill;
});

if (pathFormatInput) {
  pathFormatInput.addEventListener("input", () => {
    renderPathFormatPreview();
  });
}

if (outputFormatSelect) {
  outputFormatSelect.addEventListener("change", () => {
    renderPathFormatPreview();
  });
}

if (pathFormatPresetsRow) {
  pathFormatPresetsRow.addEventListener("click", (event) => {
    const presetBtn = event.target.closest("button[data-path-preset]");
    if (!presetBtn || !pathFormatInput) {
      return;
    }
    pathFormatInput.value = presetBtn.getAttribute("data-path-preset") || "";
    renderPathFormatPreview();
    setSettingsStatus("Preset applied. Click Save Settings to apply.");
  });
}

chooseDownloadDirBtn.addEventListener("click", async () => {
  if (!state.canPickDownloadDirectory) {
    setSettingsStatus("Folder picker is desktop-only. In Docker/web, type the path manually and click Save Settings.");
    return;
  }
  setButtonBusy(chooseDownloadDirBtn, true, "Choose Folder", "Opening...");
  try {
    const chosen = await window.rteDownloader.pickDownloadDirectory();
    if (chosen) {
      downloadDirInput.value = chosen;
      setActiveDownloadDir(chosen);
      setSettingsStatus("Folder selected. Click Save Settings to apply.");
    }
  } catch (error) {
    setSettingsStatus(error.message, true);
  } finally {
    setButtonBusy(chooseDownloadDirBtn, false, "Choose Folder");
  }
});

saveSettingsBtn.addEventListener("click", async () => {
  const activeDownloadDir = downloadDirInput.value.trim();
  const pathFormat = String(pathFormatInput?.value || "").trim();
  const timeFormat = timeFormatSelect.value === "12h" ? "12h" : "24h";
  const episodesPerPage = Math.max(1, Math.min(50, Math.floor(Number(episodesPerPageInput?.value || DEFAULT_EPISODES_PER_PAGE) || DEFAULT_EPISODES_PER_PAGE)));
  const discoveryCount = Math.max(1, Math.min(24, Math.floor(Number(discoveryCountInput?.value || DEFAULT_DISCOVERY_COUNT) || DEFAULT_DISCOVERY_COUNT)));
  const cueAutoGenerate = Boolean(cueAutoGenerateCheckbox.checked);
  const outputFormat = normalizeOutputFormatValue(outputFormatSelect?.value || "m4a");
  const outputQuality = String(outputQualitySelect?.value || "128K");
  const normalizeLoudness = Boolean(normalizeLoudnessCheckbox?.checked);
  const dedupeMode = String(dedupeModeSelect?.value || "source-id");
  const id3Tagging = Boolean(id3TaggingCheckbox?.checked);
  const feedExportEnabled = Boolean(feedExportCheckbox?.checked);
  const webhookUrl = String(webhookUrlInput?.value || "").trim();
  const auddTrackMatching = Boolean(auddTrackMatchingCheckbox?.checked);
  const auddApiToken = String(auddApiTokenInput?.value || "").trim();
  const fingerprintTrackMatching = Boolean(fingerprintTrackMatchingCheckbox?.checked);
  const acoustidApiKey = String(acoustidApiKeyInput?.value || "").trim();
  const songrecTrackMatching = Boolean(songrecTrackMatchingCheckbox?.checked);
  const songrecSampleSeconds = Math.max(8, Math.min(45, Math.floor(Number(songrecSampleSecondsInput?.value || 20) || 20)));
  const ffmpegCueSilenceDetect = Boolean(ffmpegCueSilenceCheckbox?.checked);
  const ffmpegCueLoudnessDetect = Boolean(ffmpegCueLoudnessCheckbox?.checked);
  const ffmpegCueSpectralDetect = Boolean(ffmpegCueSpectralCheckbox?.checked);
  const maxConcurrentDownloads = Math.max(1, Math.min(8, Math.floor(Number(maxConcurrentInput?.value || 2) || 2)));

  if (!activeDownloadDir) {
    setSettingsStatus("Choose a download directory first.", true);
    return;
  }
  if (!pathFormat) {
    setSettingsStatus("Set a path format first.", true);
    return;
  }

  setButtonBusy(saveSettingsBtn, true, "Save Settings", "Saving...");
  try {
    setActiveDownloadDir(activeDownloadDir);
    const saved = await window.rteDownloader.saveSettings({
      timeFormat,
      episodesPerPage,
      discoveryCount,
      downloadDir: state.downloadDir,
      pathFormat,
      cueAutoGenerate,
      outputFormat,
      outputQuality,
      normalizeLoudness,
      maxConcurrentDownloads,
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
    });
    state.timeFormat = saved.timeFormat === "12h" ? "12h" : "24h";
    state.episodesPerPage = Math.max(1, Math.min(50, Number(saved.episodesPerPage || DEFAULT_EPISODES_PER_PAGE) || DEFAULT_EPISODES_PER_PAGE));
    state.downloadDir = String(saved.downloadDir || "");
    state.pathFormat = String(saved.pathFormat || state.pathFormat);
    state.cueAutoGenerate = Boolean(saved.cueAutoGenerate);
    state.outputFormat = normalizeOutputFormatValue(saved.outputFormat || "m4a");
    state.outputQuality = String(saved.outputQuality || "128K");
    state.normalizeLoudness = saved.normalizeLoudness == null ? true : Boolean(saved.normalizeLoudness);
    state.maxConcurrentDownloads = Math.max(1, Math.min(8, Number(saved.maxConcurrentDownloads || 2) || 2));
    state.dedupeMode = String(saved.dedupeMode || "source-id");
    state.id3Tagging = saved.id3Tagging == null ? true : Boolean(saved.id3Tagging);
    state.feedExportEnabled = saved.feedExportEnabled == null ? true : Boolean(saved.feedExportEnabled);
    state.webhookUrl = String(saved.webhookUrl || "");
    state.auddTrackMatching = saved.auddTrackMatching == null ? false : Boolean(saved.auddTrackMatching);
    state.auddApiToken = String(saved.auddApiToken || "");
    state.fingerprintTrackMatching = saved.fingerprintTrackMatching == null ? false : Boolean(saved.fingerprintTrackMatching);
    state.acoustidApiKey = String(saved.acoustidApiKey || "");
    state.songrecTrackMatching = saved.songrecTrackMatching == null ? false : Boolean(saved.songrecTrackMatching);
    state.songrecSampleSeconds = Math.max(8, Math.min(45, Number(saved.songrecSampleSeconds || 20) || 20));
    state.ffmpegCueSilenceDetect = saved.ffmpegCueSilenceDetect == null ? true : Boolean(saved.ffmpegCueSilenceDetect);
    state.ffmpegCueLoudnessDetect = saved.ffmpegCueLoudnessDetect == null ? true : Boolean(saved.ffmpegCueLoudnessDetect);
    state.ffmpegCueSpectralDetect = saved.ffmpegCueSpectralDetect == null ? true : Boolean(saved.ffmpegCueSpectralDetect);
    state.discoveryCount = Math.max(1, Math.min(24, Number(saved.discoveryCount || DEFAULT_DISCOVERY_COUNT) || DEFAULT_DISCOVERY_COUNT));
    timeFormatSelect.value = state.timeFormat;
    if (episodesPerPageInput) episodesPerPageInput.value = String(state.episodesPerPage);
    if (discoveryCountInput) discoveryCountInput.value = String(state.discoveryCount);
    downloadDirInput.value = getActiveDownloadDir();
    if (pathFormatInput) {
      pathFormatInput.value = state.pathFormat;
    }
    cueAutoGenerateCheckbox.checked = state.cueAutoGenerate;
    outputFormatSelect.value = normalizeOutputFormatValue(state.outputFormat);
    outputQualitySelect.value = state.outputQuality;
    normalizeLoudnessCheckbox.checked = state.normalizeLoudness;
    maxConcurrentInput.value = String(state.maxConcurrentDownloads);
    dedupeModeSelect.value = state.dedupeMode;
    id3TaggingCheckbox.checked = state.id3Tagging;
    feedExportCheckbox.checked = state.feedExportEnabled;
    webhookUrlInput.value = state.webhookUrl;
    if (auddTrackMatchingCheckbox) {
      auddTrackMatchingCheckbox.checked = state.auddTrackMatching;
    }
    if (auddApiTokenInput) {
      auddApiTokenInput.value = state.auddApiToken;
    }
    if (fingerprintTrackMatchingCheckbox) {
      fingerprintTrackMatchingCheckbox.checked = state.fingerprintTrackMatching;
    }
    if (acoustidApiKeyInput) {
      acoustidApiKeyInput.value = state.acoustidApiKey;
    }
    if (songrecTrackMatchingCheckbox) {
      songrecTrackMatchingCheckbox.checked = state.songrecTrackMatching;
    }
    if (songrecSampleSecondsInput) {
      songrecSampleSecondsInput.value = String(state.songrecSampleSeconds);
    }
    if (ffmpegCueSilenceCheckbox) {
      ffmpegCueSilenceCheckbox.checked = state.ffmpegCueSilenceDetect;
    }
    if (ffmpegCueLoudnessCheckbox) {
      ffmpegCueLoudnessCheckbox.checked = state.ffmpegCueLoudnessDetect;
    }
    if (ffmpegCueSpectralCheckbox) {
      ffmpegCueSpectralCheckbox.checked = state.ffmpegCueSpectralDetect;
    }
    renderPathFormatPreview();
    if (state.auddTrackMatching && !state.auddApiToken) {
      setSettingsStatus("Settings saved. AudD is enabled, but no API token is configured, so AudD matching will be skipped.", true);
    } else if (state.fingerprintTrackMatching && !state.acoustidApiKey) {
      setSettingsStatus("Settings saved. AcoustID is enabled, but no API key is configured, so AcoustID matching will be skipped.", true);
    } else if (!state.ffmpegCueSilenceDetect && !state.ffmpegCueLoudnessDetect && !state.ffmpegCueSpectralDetect) {
      setSettingsStatus("Settings saved. All FFmpeg cue landmark filters are disabled, so cue timing will rely on source timings and spacing fallback.", true);
    } else {
      setSettingsStatus("Settings saved.");
    }
    await refreshTimeBasedUi();
  } catch (error) {
    setSettingsStatus(error.message, true);
  } finally {
    setButtonBusy(saveSettingsBtn, false, "Save Settings");
  }
});

addScheduleBtn.addEventListener("click", async () => {
  if (!state.currentProgramUrl) {
    programMeta.textContent = "Load a program first.";
    return;
  }

  const backfillCount = scheduleBackfillMode.value === "backfill"
    ? Math.max(1, Math.floor(Number(scheduleBackfillCount.value || 1)))
    : 0;

  setButtonBusy(addScheduleBtn, true, "Add Scheduler", "Adding...");

  try {
    const added = await window.rteDownloader.addSchedule(state.currentProgramUrl, { backfillCount });
    await refreshSchedules();
    if (added?.id && backfillCount > 0) {
      setScheduleStatus(added.id, `Backfill queued: 0/${backfillCount}`);
    }
  } catch (error) {
    programMeta.textContent = error.message;
  } finally {
    setButtonBusy(addScheduleBtn, false, "Add Scheduler");
  }
});

bbcAddScheduleBtn.addEventListener("click", async () => {
  if (!state.bbcProgramUrl) {
    bbcProgramMeta.textContent = "Load a BBC program first.";
    return;
  }

  const backfillCount = bbcScheduleBackfillMode.value === "backfill"
    ? Math.max(1, Math.floor(Number(bbcScheduleBackfillCount.value || 1)))
    : 0;

  setButtonBusy(bbcAddScheduleBtn, true, "Add Scheduler", "Adding...");

  try {
    const added = await window.rteDownloader.addBbcSchedule(state.bbcProgramUrl, { backfillCount });
    await refreshBbcSchedules();
    if (added?.id && backfillCount > 0) {
      setBbcScheduleStatus(added.id, `Backfill queued: 0/${backfillCount}`);
    }
  } catch (error) {
    bbcProgramMeta.textContent = error.message;
  } finally {
    setButtonBusy(bbcAddScheduleBtn, false, "Add Scheduler");
  }
});

if (wwfLoadProgramBtn) {
  wwfLoadProgramBtn.addEventListener("click", () => {
    const name = (wwfProgramUrlInput && wwfProgramUrlInput.value.trim()) || "";
    setButtonBusy(wwfLoadProgramBtn, true, "Load Episodes");
    loadWwfProgram(name || "Worldwide FM", 1)
      .catch((error) => {
        if (wwfProgramMeta) wwfProgramMeta.textContent = error.message;
      })
      .finally(() => setButtonBusy(wwfLoadProgramBtn, false, "Load Episodes"));
  });
}
async function runWwfProgramSearch(query) {
  if (!window.rteDownloader?.searchWwfPrograms) return;
  if (wwfProgramSearchResult) wwfProgramSearchResult.classList.remove("hidden");
  if (!wwfProgramSearchResult) return;
  wwfProgramSearchResult.innerHTML = "<div class=\"item\">Searching...</div>";
  try {
    const results = await window.rteDownloader.searchWwfPrograms(query || "");
    if (!results.length) {
      wwfProgramSearchResult.innerHTML = "<div class=\"item\">No shows found. Try a different search or load by name below.</div>";
      return;
    }
    wwfProgramSearchResult.innerHTML = results.map((r) => {
      const cadenceBadge = r.cadence && r.cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(r.cadence)}</span>` : "";
      const locationBadge = r.location ? ` <span class="genre-pill">📍 ${escapeHtml(r.location)}</span>` : "";
      const genresHtml = (r.genres && r.genres.length) ? `<div class="genre-pills">${r.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
      const scheduleHtml = r.runSchedule ? `<div class="item-meta">🕐 ${escapeHtml(toLocalSchedule(r.runSchedule))}</div>` : "";
      return `
      <div class="item clickable" data-wwf-pick-program="${escapeHtml(r.hostSlug ? `${r.programUrl}` : (r.title || r.programUrl || ""))}">
        <div class="search-card">
          <div>${r.image ? `<img src="${escapeHtml(r.image)}" alt="" class="episode-thumb" loading="lazy" />` : "<img alt=\"\" class=\"episode-thumb\" loading=\"lazy\" />"}</div>
          <div>
            <div class="item-title">${escapeHtml(r.title || "Show")}${cadenceBadge}${locationBadge}</div>
            ${scheduleHtml}
            ${r.description ? `<div class="item-meta">${escapeHtml(r.description.slice(0, 200))}${r.description.length > 200 ? "…" : ""}</div>` : ""}
            ${genresHtml}
          </div>
        </div>
      </div>
    `;}).join("");
  } catch (e) {
    wwfProgramSearchResult.innerHTML = `<div class="item">${escapeHtml(e.message)}</div>`;
  }
}
if (wwfProgramSearchBtn && wwfProgramSearchInput) {
  wwfProgramSearchBtn.addEventListener("click", () => runWwfProgramSearch(wwfProgramSearchInput.value.trim()));
}
if (wwfProgramSearchInput) {
  wwfProgramSearchInput.addEventListener("input", () => {
    if (wwfSearchDebounceTimer) clearTimeout(wwfSearchDebounceTimer);
    const q = wwfProgramSearchInput.value.trim();
    wwfSearchDebounceTimer = setTimeout(() => runWwfProgramSearch(q), 280);
  });
  wwfProgramSearchInput.addEventListener("focus", () => {
    const q = wwfProgramSearchInput.value.trim();
    if (q) runWwfProgramSearch(q);
    else if (wwfProgramSearchResult && !wwfProgramSearchResult.classList.contains("hidden")) {
      runWwfProgramSearch("");
    }
  });
}
if (wwfProgramSearchResult) {
  wwfProgramSearchResult.addEventListener("click", (event) => {
    const row = event.target.closest("[data-wwf-pick-program]");
    if (!row) return;
    const programName = row.getAttribute("data-wwf-pick-program") || "";
    if (wwfProgramUrlInput) wwfProgramUrlInput.value = programName;
    loadWwfProgram(programName, 1).catch(() => {});
    wwfProgramSearchResult.classList.add("hidden");
  });
}
if (wwfPrevPageBtn) {
  wwfPrevPageBtn.addEventListener("click", () => {
    const page = Math.max(1, (state.wwfProgramPage || 1) - 1);
    loadWwfProgram(state.wwfProgramUrl, page).catch(() => {});
  });
}
if (wwfNextPageBtn) {
  wwfNextPageBtn.addEventListener("click", () => {
    const page = Math.min(state.wwfProgramMaxPages || 1, (state.wwfProgramPage || 1) + 1);
    loadWwfProgram(state.wwfProgramUrl, page).catch(() => {});
  });
}
if (wwfAddScheduleBtn) {
  wwfAddScheduleBtn.addEventListener("click", async () => {
    const programName = (wwfProgramUrlInput && wwfProgramUrlInput.value.trim()) || state.wwfProgramUrl;
    if (!programName) {
      if (wwfProgramMeta) wwfProgramMeta.textContent = "Enter or load a program name first.";
      return;
    }
    const backfillCount = (wwfScheduleBackfillMode && wwfScheduleBackfillMode.value === "backfill")
      ? Math.max(1, Math.floor(Number(wwfScheduleBackfillCount && wwfScheduleBackfillCount.value || 1)))
      : 0;
    setButtonBusy(wwfAddScheduleBtn, true, "Add Scheduler", "Adding...");
    try {
      await window.rteDownloader.addWwfSchedule(programName, { backfillCount });
      await renderWwfScheduleList();
    } catch (error) {
      if (wwfProgramMeta) wwfProgramMeta.textContent = error.message;
    } finally {
      setButtonBusy(wwfAddScheduleBtn, false, "Add Scheduler");
    }
  });
}
if (wwfDownloadBtn && wwfUrlInput) {
  wwfDownloadBtn.addEventListener("click", async () => {
    const pageUrl = wwfUrlInput.value.trim();
    if (!pageUrl) {
      if (wwfResult) wwfResult.textContent = "Enter an episode URL.";
      return;
    }
    const progressToken = createProgressToken("wwf-quick");
    const detach = attachDownloadProgress(progressToken, (p) => {
      if (wwfResult) wwfResult.textContent = formatProgressText(p, "Downloading...");
    });
    setButtonBusy(wwfDownloadBtn, true, "Download", "Downloading...");
    if (wwfResult) wwfResult.textContent = "Starting...";
    try {
      const data = await window.rteDownloader.downloadFromWwfUrl(pageUrl, progressToken, { forceDownload: false });
      if (wwfResult) wwfResult.textContent = `Saved: ${data.outputDir}\\${data.fileName}`;
    } catch (error) {
      if (wwfResult) wwfResult.textContent = error.message;
    } finally {
      detach();
      setButtonBusy(wwfDownloadBtn, false, "Download");
    }
  });
}

if (ntsLoadProgramBtn) {
  ntsLoadProgramBtn.addEventListener("click", () => {
    const urlOrSlug = (ntsProgramUrlInput && ntsProgramUrlInput.value.trim()) || "";
    setButtonBusy(ntsLoadProgramBtn, true, "Load Episodes");
    loadNtsProgram(urlOrSlug || "the-breakfast-show-flo", 1)
      .catch((error) => {
        const msg = (error?.message || "").trim();
        if (ntsProgramMeta) {
          ntsProgramMeta.textContent = msg.includes("503") || msg.includes("Service Unavailable")
            ? "NTS is temporarily unavailable (503). Try again in a few minutes or open nts.live in your browser."
            : msg || "Failed to load show.";
        }
        if (ntsEpisodesResult) ntsEpisodesResult.innerHTML = "<div class=\"item muted\">Load failed. Try again later.</div>";
      })
      .finally(() => setButtonBusy(ntsLoadProgramBtn, false, "Load Episodes"));
  });
}
async function runNtsProgramSearch(query) {
  if (!window.rteDownloader?.searchNtsPrograms) return;
  if (ntsProgramSearchResult) ntsProgramSearchResult.classList.remove("hidden");
  if (!ntsProgramSearchResult) return;
  const q = String(query || "").trim();
  if (!q) {
    ntsProgramSearchResult.innerHTML = "<div class=\"item muted\">Type to search NTS shows, or load by URL/slug below.</div>";
    return;
  }
  const sortEl = document.getElementById("ntsSearchSort");
  const sort = sortEl ? sortEl.value : "recent";
  ntsProgramSearchResult.innerHTML = "<div class=\"item\">Searching...</div>";
  try {
    const data = await window.rteDownloader.searchNtsPrograms(q, { sort });
    const results = Array.isArray(data) ? data : (data?.results || []);
    const searchError = !Array.isArray(data) && data?.error ? data.error : null;
    if (searchError) {
      ntsProgramSearchResult.innerHTML = `<div class="item"><span class="muted">${escapeHtml(searchError)}</span><br>Try again later or load by URL/slug below.</div>`;
      return;
    }
    if (!results.length) {
      ntsProgramSearchResult.innerHTML = "<div class=\"item\">No shows found. Try a different search or load by URL/slug below.</div>";
      return;
    }
    ntsProgramSearchResult.innerHTML = results.map((r) => {
      const genresHtml = (r.genres && r.genres.length) ? `<div class="genre-pills">${r.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>` : "";
      const scheduleHtml = r.runSchedule ? `<div class="item-meta">🕐 ${escapeHtml(toLocalSchedule(r.runSchedule))}</div>` : "";
      const cadenceBadge = r.cadence && r.cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(r.cadence)}</span>` : "";
      const locationBadge = r.location ? ` <span class="genre-pill">📍 ${escapeHtml(r.location)}</span>` : "";
      return `
      <div class="item clickable" data-nts-pick-program="${escapeHtml(r.programUrl || r.title || "")}">
        <div class="search-card">
          <div>${r.image ? `<img src="${escapeHtml(r.image)}" alt="" class="episode-thumb" loading="lazy" />` : "<img alt=\"\" class=\"episode-thumb\" loading=\"lazy\" />"}</div>
          <div>
            <div class="item-title">${escapeHtml(r.title || "Show")}${cadenceBadge}${locationBadge}</div>
            ${scheduleHtml}
            ${r.description ? `<div class="item-meta">${escapeHtml(r.description.slice(0, 200))}${r.description.length > 200 ? "…" : ""}</div>` : ""}
            ${genresHtml}
          </div>
        </div>
      </div>
    `;}).join("");
  } catch (e) {
    ntsProgramSearchResult.innerHTML = `<div class="item">${escapeHtml(e.message)}</div>`;
  }
}
if (ntsProgramSearchBtn && ntsProgramSearchInput) {
  ntsProgramSearchBtn.addEventListener("click", () => runNtsProgramSearch(ntsProgramSearchInput.value.trim()));
}
if (ntsProgramSearchInput) {
  ntsProgramSearchInput.addEventListener("input", () => {
    if (ntsSearchDebounceTimer) clearTimeout(ntsSearchDebounceTimer);
    const q = ntsProgramSearchInput.value.trim();
    ntsSearchDebounceTimer = setTimeout(() => runNtsProgramSearch(q), 280);
  });
  ntsProgramSearchInput.addEventListener("focus", () => {
    const q = ntsProgramSearchInput.value.trim();
    if (q) runNtsProgramSearch(q);
    else {
      if (ntsProgramSearchResult && !ntsProgramSearchResult.classList.contains("hidden")) {
        ntsProgramSearchResult.innerHTML = "<div class=\"item muted\">Type to search NTS shows, or load by URL/slug below.</div>";
      }
    }
  });
}
const ntsSearchSortEl = document.getElementById("ntsSearchSort");
if (ntsSearchSortEl) {
  ntsSearchSortEl.addEventListener("change", () => {
    const q = ntsProgramSearchInput ? ntsProgramSearchInput.value.trim() : "";
    if (q) runNtsProgramSearch(q);
  });
}
if (ntsProgramSearchResult) {
  ntsProgramSearchResult.addEventListener("click", (event) => {
    const row = event.target.closest("[data-nts-pick-program]");
    if (!row) return;
    const programUrl = row.getAttribute("data-nts-pick-program") || "";
    if (ntsProgramUrlInput) ntsProgramUrlInput.value = programUrl;
    loadNtsProgram(programUrl, 1).catch(() => {});
    ntsProgramSearchResult.classList.add("hidden");
  });
}
if (ntsPrevPageBtn) {
  ntsPrevPageBtn.addEventListener("click", () => {
    const page = Math.max(1, (state.ntsProgramPage || 1) - 1);
    loadNtsProgram(state.ntsProgramUrl, page).catch(() => {});
  });
}
if (ntsNextPageBtn) {
  ntsNextPageBtn.addEventListener("click", () => {
    const page = Math.min(state.ntsProgramMaxPages || 1, (state.ntsProgramPage || 1) + 1);
    loadNtsProgram(state.ntsProgramUrl, page).catch(() => {});
  });
}
if (ntsAddScheduleBtn) {
  ntsAddScheduleBtn.addEventListener("click", async () => {
    const programUrl = (ntsProgramUrlInput && ntsProgramUrlInput.value.trim()) || state.ntsProgramUrl;
    if (!programUrl) {
      if (ntsProgramMeta) ntsProgramMeta.textContent = "Enter or load a show URL/slug first.";
      return;
    }
    const backfillCount = (ntsScheduleBackfillMode && ntsScheduleBackfillMode.value === "backfill")
      ? Math.max(1, Math.floor(Number(ntsScheduleBackfillCount && ntsScheduleBackfillCount.value || 1)))
      : 0;
    setButtonBusy(ntsAddScheduleBtn, true, "Add Scheduler", "Adding...");
    try {
      await window.rteDownloader.addNtsSchedule(programUrl, { backfillCount });
      await renderNtsScheduleList();
    } catch (error) {
      if (ntsProgramMeta) ntsProgramMeta.textContent = error.message;
    } finally {
      setButtonBusy(ntsAddScheduleBtn, false, "Add Scheduler");
    }
  });
}
if (ntsDownloadBtn && ntsUrlInput) {
  ntsDownloadBtn.addEventListener("click", async () => {
    const pageUrl = ntsUrlInput.value.trim();
    if (!pageUrl) {
      if (ntsResult) ntsResult.textContent = "Enter an episode URL.";
      return;
    }
    const progressToken = createProgressToken("nts-quick");
    const detach = attachDownloadProgress(progressToken, (p) => {
      if (ntsResult) ntsResult.textContent = formatProgressText(p, "Downloading...");
    });
    setButtonBusy(ntsDownloadBtn, true, "Download", "Downloading...");
    if (ntsResult) ntsResult.textContent = "Starting...";
    try {
      const data = await window.rteDownloader.downloadFromNtsUrl(pageUrl, progressToken, { forceDownload: false });
      if (ntsResult) ntsResult.textContent = `Saved: ${data.outputDir}\\${data.fileName}`;
    } catch (error) {
      if (ntsResult) ntsResult.textContent = error.message;
    } finally {
      detach();
      setButtonBusy(ntsDownloadBtn, false, "Download");
    }
  });
}

episodesResult.addEventListener("click", async (event) => {
  const playLocalBtn = event.target.closest("button[data-play-local-clip]");
  if (playLocalBtn) {
    const clipId = playLocalBtn.getAttribute("data-play-local-clip") || "";
    const playTitle = playLocalBtn.getAttribute("data-play-local-title") || "";
    const playProgramTitle = playLocalBtn.getAttribute("data-play-local-program-title") || "";
    const playSubtitle = playLocalBtn.getAttribute("data-play-local-subtitle") || "";
    const playImage = playLocalBtn.getAttribute("data-play-local-image") || "";
    const playDurationText = playLocalBtn.getAttribute("data-play-local-duration") || "";
    const playEpisodeUrl = playLocalBtn.getAttribute("data-play-local-episode-url") || "";
    const saved = state.rteDownloadedAudioByClip[String(clipId)];
    if (!saved?.outputDir || !saved?.fileName) {
      setEpisodeStatus(clipId, "Download this episode first, then use Play Local.", true);
      return;
    }
    setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
    try {
      await playEpisodeWithBackgroundCue({
        sourceType: "rte",
        cacheKey: clipId,
        sourceLabel: "RTE Local",
        title: playTitle || saved.fileName,
        programTitle: playProgramTitle || saved.programTitle || "",
        subtitle: playSubtitle,
        image: playImage,
        episodeUrl: playEpisodeUrl,
        clipId,
        durationSeconds: parseRteDurationSeconds(playDurationText),
        outputDir: saved.outputDir,
        fileName: saved.fileName,
        playbackKey: `rte:local:${clipId}`,
        statusUpdater: (text, isError = false) => setEpisodeStatus(clipId, text, isError)
      });
    } catch (error) {
      setEpisodeStatus(clipId, `Play Local failed: ${error.message}`, true);
    } finally {
      setButtonBusy(playLocalBtn, false, "Play Local");
    }
    return;
  }

  const playBtn = event.target.closest("button[data-play-clip]");
  if (playBtn) {
    const playClipId = playBtn.getAttribute("data-play-clip") || "";
    const playTitle = playBtn.getAttribute("data-play-title") || "";
    const playProgramTitle = playBtn.getAttribute("data-play-program-title") || "";
    const playSubtitle = playBtn.getAttribute("data-play-subtitle") || "";
    const playImage = playBtn.getAttribute("data-play-image") || "";
    const playDurationText = playBtn.getAttribute("data-play-duration") || "";
    if (!playClipId) {
      return;
    }
    setButtonBusy(playBtn, true, "Play", "Loading...");
    try {
      const stream = await window.rteDownloader.getRteEpisodeStream(playClipId);
      await playEpisodeWithBackgroundCue({
        sourceType: "rte",
        cacheKey: playClipId,
        sourceLabel: "RTE",
        title: playTitle || `clip ${playClipId}`,
        programTitle: playProgramTitle || "",
        subtitle: playSubtitle,
        image: playImage,
        episodeUrl: playBtn.getAttribute("data-play-episode-url") || "",
        clipId: playClipId,
        durationSeconds: parseRteDurationSeconds(playDurationText),
        streamUrl: stream?.streamUrl || "",
        playbackKey: `rte:remote:${playClipId}`,
        statusUpdater: (text, isError = false) => setEpisodeStatus(playClipId, text, isError)
      });
    } catch (error) {
      setEpisodeStatus(playClipId, `Play failed: ${error.message}`, true);
    } finally {
      setButtonBusy(playBtn, false, "Play");
    }
    return;
  }

  const downloadBtn = event.target.closest("button[data-download-clip]");
  if (!downloadBtn) {
    const cueBtn = event.target.closest("button[data-generate-cue-clip]");
    if (!cueBtn) {
      return;
    }
    const clipIdCue = cueBtn.getAttribute("data-generate-cue-clip") || "";
    const titleCue = cueBtn.getAttribute("data-generate-cue-title") || "rte-episode";
    const programTitleCue = cueBtn.getAttribute("data-generate-cue-program-title") || "";
    const episodeUrlCue = cueBtn.getAttribute("data-generate-cue-url") || "";
    const saved = state.rteDownloadedAudioByClip[clipIdCue];
    if (!saved) {
      setEpisodeStatus(clipIdCue, "Download episode first, then generate CUE.", true);
      return;
    }
    setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
    setEpisodeStatus(clipIdCue, "Generating CUE/chapters...");
    clearCueDebugLog("rte", clipIdCue);
    const cueProgressToken = createProgressToken(`cue-${clipIdCue}`);
    const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
      if (progress?.kind === "cue" && progress?.message) {
        appendCueDebugLog("rte", clipIdCue, progress.message);
      }
      setEpisodeStatus(clipIdCue, formatProgressText(progress, "Generating CUE/chapters..."));
    });
    try {
      const cue = await window.rteDownloader.generateCue({
        sourceType: "rte",
        episodeUrl: episodeUrlCue,
        title: titleCue,
        programTitle: programTitleCue,
        outputDir: saved.outputDir,
        fileName: saved.fileName,
        progressToken: cueProgressToken
      });
      setEpisodeChapters(clipIdCue, cue.chapters || []);
      setEpisodeStatus(clipIdCue, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
    } catch (error) {
      setEpisodeStatus(clipIdCue, `CUE failed: ${error.message}`, true);
    } finally {
      detachCueProgress();
      setButtonBusy(cueBtn, false, "Generate CUE");
    }
    return;
  }

  const clipId = downloadBtn.getAttribute("data-download-clip");
  const title = downloadBtn.getAttribute("data-download-title") || "rte-episode";
  const programTitle = downloadBtn.getAttribute("data-download-program-title") || "";
  const episodeUrl = downloadBtn.getAttribute("data-download-url") || "";
  const publishedTime = downloadBtn.getAttribute("data-download-published") || "";
  const artworkUrl = downloadBtn.getAttribute("data-download-image") || "";

  if (!clipId) {
    return;
  }

  const forceDownload = downloadBtn.dataset.forceNext === "1";
  if (forceDownload) {
    delete downloadBtn.dataset.forceNext;
  }
  setEpisodeStatus(clipId, forceDownload ? "Forcing re-download..." : "Starting download...");
  setButtonBusy(downloadBtn, true, "Download", "Downloading...");
  const progressToken = createProgressToken(`episode-${clipId}`);
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setEpisodeStatus(clipId, formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadEpisode({ clipId, title, programTitle, episodeUrl, publishedTime, artworkUrl, progressToken, forceDownload });
    state.rteDownloadedAudioByClip[String(clipId)] = {
      outputDir: data.outputDir,
      fileName: data.fileName,
      episodeUrl,
      title,
      programTitle
    };
    if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
      setEpisodeChapters(clipId, data.cue.chapters);
    }
    const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Downloaded";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setEpisodeStatus(clipId, `${statusPrefix}: ${data.fileName}${cueText}${hintText}`);
    if (data?.existing) {
      downloadBtn.dataset.forceNext = "1";
    } else {
      delete downloadBtn.dataset.forceNext;
    }
  } catch (error) {
    if (shouldArmForceRetry(error?.message)) {
      downloadBtn.dataset.forceNext = "1";
    }
    setEpisodeStatus(clipId, `Download failed: ${error.message}`, true);
  } finally {
    detachProgress();
    setButtonBusy(downloadBtn, false, "Download");
  }
});

bbcEpisodesResult.addEventListener("click", async (event) => {
  const bbcPlayLocalBtn = event.target.closest("button[data-bbc-play-local-url]");
  if (bbcPlayLocalBtn) {
    const episodeUrl = bbcPlayLocalBtn.getAttribute("data-bbc-play-local-url") || "";
    const playTitle = bbcPlayLocalBtn.getAttribute("data-bbc-play-local-title") || "";
    const playProgramTitle = bbcPlayLocalBtn.getAttribute("data-bbc-play-local-program-title") || "";
    const playSubtitle = bbcPlayLocalBtn.getAttribute("data-bbc-play-local-subtitle") || "";
    const playImage = bbcPlayLocalBtn.getAttribute("data-bbc-play-local-image") || "";
    const playDurationSeconds = Number(bbcPlayLocalBtn.getAttribute("data-bbc-play-local-duration") || 0) || 0;
    const saved = state.bbcDownloadedAudioByEpisode[episodeUrl];
    if (!saved?.outputDir || !saved?.fileName) {
      setBbcEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
      return;
    }
    setButtonBusy(bbcPlayLocalBtn, true, "Play Local", "Loading...");
    try {
      await playEpisodeWithBackgroundCue({
        sourceType: "bbc",
        cacheKey: episodeUrl,
        sourceLabel: "BBC Local",
        title: playTitle || saved.fileName,
        programTitle: playProgramTitle || saved.programTitle || "",
        subtitle: playSubtitle,
        image: playImage,
        episodeUrl,
        durationSeconds: playDurationSeconds,
        outputDir: saved.outputDir,
        fileName: saved.fileName,
        playbackKey: `bbc:local:${episodeUrl}`,
        statusUpdater: (text, isError = false) => setBbcEpisodeStatus(episodeUrl, text, isError)
      });
    } catch (error) {
      setBbcEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
    } finally {
      setButtonBusy(bbcPlayLocalBtn, false, "Play Local");
    }
    return;
  }

  const bbcPlayBtn = event.target.closest("button[data-bbc-play-url]");
  if (bbcPlayBtn) {
    const playUrl = bbcPlayBtn.getAttribute("data-bbc-play-url") || "";
    const playTitle = bbcPlayBtn.getAttribute("data-bbc-play-title") || "";
    const playProgramTitle = bbcPlayBtn.getAttribute("data-bbc-play-program-title") || "";
    const playSubtitle = bbcPlayBtn.getAttribute("data-bbc-play-subtitle") || "";
    const playImage = bbcPlayBtn.getAttribute("data-bbc-play-image") || "";
    const playDurationSeconds = Number(bbcPlayBtn.getAttribute("data-bbc-play-duration") || 0) || 0;
    setButtonBusy(bbcPlayBtn, true, "Play", "Loading...");
    try {
      const stream = await window.rteDownloader.getBbcEpisodeStream(playUrl);
      await playEpisodeWithBackgroundCue({
        sourceType: "bbc",
        cacheKey: playUrl,
        sourceLabel: "BBC",
        title: playTitle || stream?.title || "Episode",
        programTitle: playProgramTitle || "",
        subtitle: playSubtitle,
        image: playImage || stream?.image || "",
        episodeUrl: playUrl,
        durationSeconds: playDurationSeconds,
        streamUrl: stream?.streamUrl || "",
        playbackKey: `bbc:remote:${playUrl}`,
        statusUpdater: (text, isError = false) => setBbcEpisodeStatus(playUrl, text, isError)
      });
    } catch (error) {
      setBbcEpisodeStatus(playUrl, `Play failed: ${error.message}`, true);
    } finally {
      setButtonBusy(bbcPlayBtn, false, "Play");
    }
    return;
  }

  const downloadBtn = event.target.closest("button[data-bbc-episode-url]");
  if (!downloadBtn) {
    const cueBtn = event.target.closest("button[data-bbc-generate-cue-url]");
    if (!cueBtn) {
      return;
    }
    const episodeUrlCue = cueBtn.getAttribute("data-bbc-generate-cue-url") || "";
    const titleCue = cueBtn.getAttribute("data-bbc-generate-cue-title") || "bbc-episode";
    const programTitleCue = cueBtn.getAttribute("data-bbc-generate-cue-program-title") || "BBC";
    const saved = state.bbcDownloadedAudioByEpisode[episodeUrlCue];
    if (!saved) {
      setBbcEpisodeStatus(episodeUrlCue, "Download episode first, then generate CUE.", true);
      return;
    }
    setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
    setBbcEpisodeStatus(episodeUrlCue, "Generating CUE/chapters...");
    clearCueDebugLog("bbc", episodeUrlCue);
    const cueProgressToken = createProgressToken(`bbc-cue-${Date.now()}`);
    const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
      if (progress?.kind === "cue" && progress?.message) {
        appendCueDebugLog("bbc", episodeUrlCue, progress.message);
      }
      setBbcEpisodeStatus(episodeUrlCue, formatProgressText(progress, "Generating CUE/chapters..."));
    });
    try {
      const cue = await window.rteDownloader.generateCue({
        sourceType: "bbc",
        episodeUrl: episodeUrlCue,
        title: titleCue,
        programTitle: programTitleCue,
        outputDir: saved.outputDir,
        fileName: saved.fileName,
        progressToken: cueProgressToken
      });
      setBbcEpisodeChapters(episodeUrlCue, cue.chapters || []);
      setBbcEpisodeStatus(episodeUrlCue, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
    } catch (error) {
      setBbcEpisodeStatus(episodeUrlCue, `CUE failed: ${error.message}`, true);
    } finally {
      detachCueProgress();
      setButtonBusy(cueBtn, false, "Generate CUE");
    }
    return;
  }

  const episodeUrl = downloadBtn.getAttribute("data-bbc-episode-url") || "";
  const downloadUrl = downloadBtn.getAttribute("data-bbc-download-url") || episodeUrl;
  const title = downloadBtn.getAttribute("data-bbc-episode-title") || "bbc-episode";
  const programTitle = downloadBtn.getAttribute("data-bbc-program-title") || "BBC";
  const publishedTime = downloadBtn.getAttribute("data-bbc-published") || "";
  const image = downloadBtn.getAttribute("data-bbc-image") || "";
  if (!episodeUrl) {
    return;
  }

  const forceDownload = downloadBtn.dataset.forceNext === "1";
  if (forceDownload) {
    delete downloadBtn.dataset.forceNext;
  }
  setBbcEpisodeStatus(episodeUrl, forceDownload ? "Forcing re-download..." : "Starting download...");
  setButtonBusy(downloadBtn, true, "Download", "Downloading...");
  const progressToken = createProgressToken("bbc-episode");
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setBbcEpisodeStatus(episodeUrl, formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadFromBbcUrl(downloadUrl, progressToken, { title, programTitle, publishedTime, image, forceDownload });
    state.bbcDownloadedAudioByEpisode[episodeUrl] = {
      outputDir: data.outputDir,
      fileName: data.fileName,
      episodeUrl,
      title,
      programTitle
    };
    if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
      setBbcEpisodeChapters(episodeUrl, data.cue.chapters);
    }
    const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Downloaded";
    const panelPrefix = data?.existing ? "Already downloaded" : "Saved";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setBbcEpisodeStatus(episodeUrl, `${statusPrefix}: ${data.fileName}${cueText}${hintText}`);
    setBbcStatus(`${panelPrefix}: ${data.outputDir}\\${data.fileName}${cueText}`);
    if (data?.existing) {
      downloadBtn.dataset.forceNext = "1";
    } else {
      delete downloadBtn.dataset.forceNext;
    }
  } catch (error) {
    if (shouldArmForceRetry(error?.message)) {
      downloadBtn.dataset.forceNext = "1";
    }
    setBbcEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
  } finally {
    detachProgress();
    setButtonBusy(downloadBtn, false, "Download");
  }
});

if (wwfEpisodesResult) {
  wwfEpisodesResult.addEventListener("click", async (event) => {
    const playLocalBtn = event.target.closest("button[data-wwf-play-local-url]");
    if (playLocalBtn) {
      const episodeUrl = playLocalBtn.getAttribute("data-wwf-play-local-url") || "";
      const playTitle = playLocalBtn.getAttribute("data-wwf-play-local-title") || "";
      const playProgramTitle = playLocalBtn.getAttribute("data-wwf-play-local-program-title") || "";
      const playImage = playLocalBtn.getAttribute("data-wwf-play-local-image") || "";
      const saved = state.wwfDownloadedAudioByEpisode[episodeUrl];
      if (!saved?.outputDir || !saved?.fileName) {
        setWwfEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
        return;
      }
      setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
      try {
        await playEpisodeWithBackgroundCue({
          sourceType: "wwf",
          cacheKey: episodeUrl,
          sourceLabel: "Worldwide FM Local",
          title: playTitle || saved.fileName,
          programTitle: playProgramTitle || "",
          subtitle: "",
          image: playImage,
          episodeUrl,
          durationSeconds: 0,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          playbackKey: `wwf:local:${episodeUrl}`,
          statusUpdater: (text, isError = false) => setWwfEpisodeStatus(episodeUrl, text, isError)
        });
      } catch (error) {
        setWwfEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
      } finally {
        setButtonBusy(playLocalBtn, false, "Play Local");
      }
      return;
    }
    const playBtn = event.target.closest("button[data-wwf-play-url]");
    if (playBtn) {
      const playUrl = playBtn.getAttribute("data-wwf-play-url") || "";
      const playTitle = playBtn.getAttribute("data-wwf-play-title") || "";
      const playProgramTitle = playBtn.getAttribute("data-wwf-play-program-title") || "";
      const playImage = playBtn.getAttribute("data-wwf-play-image") || "";
      setButtonBusy(playBtn, true, "Play", "Loading...");
      try {
        const stream = await window.rteDownloader.getWwfEpisodeStream(playUrl);
        const streamUrl = stream?.streamUrl ? String(stream.streamUrl).trim() : "";
        if (!streamUrl) {
          setWwfEpisodeStatus(playUrl, "No stream URL. Download the episode, then use Play Local.", true);
          return;
        }
        setWwfEpisodeStatus(playUrl, "Buffering Mixcloud stream — audio will start in ~5–10s...");
        await playEpisodeWithBackgroundCue({
          sourceType: "wwf",
          cacheKey: playUrl,
          sourceLabel: "Worldwide FM",
          title: playTitle || stream?.title || "Episode",
          programTitle: playProgramTitle || "",
          subtitle: "",
          image: playImage || stream?.image || "",
          episodeUrl: playUrl,
          durationSeconds: 0,
          streamUrl,
          playbackKey: `wwf:remote:${playUrl}`,
          statusUpdater: (text, isError = false) => setWwfEpisodeStatus(playUrl, text, isError)
        });
        setWwfEpisodeStatus(playUrl, "Buffering — audio will start shortly. If silent after 10s, try Play Local.");
      } catch (error) {
        setWwfEpisodeStatus(playUrl, `Play failed: ${error.message}. Try Download then Play Local.`, true);
      } finally {
        setButtonBusy(playBtn, false, "Play");
      }
      return;
    }
    const downloadBtn = event.target.closest("button[data-wwf-download-url]");
    if (downloadBtn) {
      const episodeUrl = downloadBtn.getAttribute("data-wwf-download-url") || "";
      const title = downloadBtn.getAttribute("data-wwf-episode-title") || "wwf-episode";
      const programTitle = downloadBtn.getAttribute("data-wwf-program-title") || "Worldwide FM";
      const publishedTime = downloadBtn.getAttribute("data-wwf-published") || "";
      const image = downloadBtn.getAttribute("data-wwf-image") || "";
      setWwfEpisodeStatus(episodeUrl, "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("wwf-episode");
      const detach = attachDownloadProgress(progressToken, (p) => setWwfEpisodeStatus(episodeUrl, formatProgressText(p, "Downloading...")));
      try {
        const data = await window.rteDownloader.downloadFromWwfUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image });
        state.wwfDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
        if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
          state.wwfChaptersByEpisode[String(episodeUrl || "")] = data.cue.chapters;
        }
        const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
        setWwfEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}${cueText}`);
      } catch (error) {
        setWwfEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
      } finally {
        detach();
        setButtonBusy(downloadBtn, false, "Download");
      }
      return;
    }

    const cueBtn = event.target.closest("button[data-wwf-generate-cue-url]");
    if (cueBtn) {
      const episodeUrl = cueBtn.getAttribute("data-wwf-generate-cue-url") || "";
      const title = cueBtn.getAttribute("data-wwf-generate-cue-title") || "wwf-episode";
      const programTitle = cueBtn.getAttribute("data-wwf-generate-cue-program-title") || "Worldwide FM";
      const saved = state.wwfDownloadedAudioByEpisode[episodeUrl];
      if (!saved) {
        setWwfEpisodeStatus(episodeUrl, "Download episode first, then generate CUE.", true);
        return;
      }
      setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
      setWwfEpisodeStatus(episodeUrl, "Generating CUE/chapters...");
      clearCueDebugLog("wwf", episodeUrl);
      const cueProgressToken = createProgressToken(`wwf-cue-${Date.now()}`);
      const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
        if (progress?.kind === "cue" && progress?.message) {
          appendCueDebugLog("wwf", episodeUrl, progress.message);
        }
        setWwfEpisodeStatus(episodeUrl, formatProgressText(progress, "Generating CUE/chapters..."));
      });
      try {
        const cue = await window.rteDownloader.generateCue({
          sourceType: "wwf",
          episodeUrl,
          title,
          programTitle,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          progressToken: cueProgressToken
        });
        state.wwfChaptersByEpisode[String(episodeUrl || "")] = cue.chapters || [];
        setWwfEpisodeStatus(episodeUrl, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
      } catch (error) {
        setWwfEpisodeStatus(episodeUrl, `CUE failed: ${error.message}`, true);
      } finally {
        detachCueProgress();
        setButtonBusy(cueBtn, false, "Generate CUE");
      }
    }
  });
}

if (ntsEpisodesResult) {
  ntsEpisodesResult.addEventListener("click", async (event) => {
    const playLocalBtn = event.target.closest("button[data-nts-play-local-url]");
    if (playLocalBtn) {
      const episodeUrl = playLocalBtn.getAttribute("data-nts-play-local-url") || "";
      const playTitle = playLocalBtn.getAttribute("data-nts-play-local-title") || "";
      const playProgramTitle = playLocalBtn.getAttribute("data-nts-play-local-program-title") || "";
      const playImage = playLocalBtn.getAttribute("data-nts-play-local-image") || "";
      const saved = state.ntsDownloadedAudioByEpisode[episodeUrl];
      if (!saved?.outputDir || !saved?.fileName) {
        setNtsEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
        return;
      }
      setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
      try {
        await playEpisodeWithBackgroundCue({
          sourceType: "nts",
          cacheKey: episodeUrl,
          sourceLabel: "NTS Local",
          title: playTitle || saved.fileName,
          programTitle: playProgramTitle || "",
          subtitle: "",
          image: playImage,
          episodeUrl,
          durationSeconds: 0,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          playbackKey: `nts:local:${episodeUrl}`,
          statusUpdater: (text, isError = false) => setNtsEpisodeStatus(episodeUrl, text, isError)
        });
      } catch (error) {
        setNtsEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
      } finally {
        setButtonBusy(playLocalBtn, false, "Play Local");
      }
      return;
    }
    const playBtn = event.target.closest("button[data-nts-play-url]");
    if (playBtn) {
      const playUrl = playBtn.getAttribute("data-nts-play-url") || "";
      const playTitle = playBtn.getAttribute("data-nts-play-title") || "";
      const playProgramTitle = playBtn.getAttribute("data-nts-play-program-title") || "";
      const playImage = playBtn.getAttribute("data-nts-play-image") || "";
      setButtonBusy(playBtn, true, "Play", "Loading...");
      try {
        const stream = await window.rteDownloader.getNtsEpisodeStream(playUrl);
        await playEpisodeWithBackgroundCue({
          sourceType: "nts",
          cacheKey: playUrl,
          sourceLabel: "NTS",
          title: playTitle || stream?.title || "Episode",
          programTitle: playProgramTitle || "",
          subtitle: "",
          image: playImage || stream?.image || "",
          episodeUrl: playUrl,
          durationSeconds: 0,
          streamUrl: stream?.streamUrl || "",
          playbackKey: `nts:remote:${playUrl}`,
          statusUpdater: (text, isError = false) => setNtsEpisodeStatus(playUrl, text, isError)
        });
      } catch (error) {
        setNtsEpisodeStatus(playUrl, `Play failed: ${error.message}`, true);
      } finally {
        setButtonBusy(playBtn, false, "Play");
      }
      return;
    }
    const cueBtn = event.target.closest("button[data-nts-generate-cue-url]");
    if (cueBtn) {
      const episodeUrlCue = cueBtn.getAttribute("data-nts-generate-cue-url") || "";
      const titleCue = cueBtn.getAttribute("data-nts-generate-cue-title") || "nts-episode";
      const programTitleCue = cueBtn.getAttribute("data-nts-generate-cue-program-title") || "NTS";
      const saved = state.ntsDownloadedAudioByEpisode[episodeUrlCue];
      if (!saved) {
        setNtsEpisodeStatus(episodeUrlCue, "Download episode first, then generate CUE.", true);
        return;
      }
      setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
      setNtsEpisodeStatus(episodeUrlCue, "Generating CUE/chapters...");
      clearCueDebugLog("nts", episodeUrlCue);
      const cueProgressToken = createProgressToken(`nts-cue-${Date.now()}`);
      const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
        if (progress?.kind === "cue" && progress?.message) {
          appendCueDebugLog("nts", episodeUrlCue, progress.message);
        }
        setNtsEpisodeStatus(episodeUrlCue, formatProgressText(progress, "Generating CUE/chapters..."));
      });
      try {
        const cue = await window.rteDownloader.generateCue({
          sourceType: "nts",
          episodeUrl: episodeUrlCue,
          title: titleCue,
          programTitle: programTitleCue,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          progressToken: cueProgressToken
        });
        setCachedChapters("nts", episodeUrlCue, cue.chapters || []);
        setNtsEpisodeStatus(episodeUrlCue, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
      } catch (error) {
        setNtsEpisodeStatus(episodeUrlCue, `CUE failed: ${error.message}`, true);
      } finally {
        detachCueProgress();
        setButtonBusy(cueBtn, false, "Generate CUE");
      }
      return;
    }
    const downloadBtn = event.target.closest("button[data-nts-download-url]");
    if (downloadBtn) {
      const episodeUrl = downloadBtn.getAttribute("data-nts-download-url") || "";
      const title = downloadBtn.getAttribute("data-nts-episode-title") || "nts-episode";
      const programTitle = downloadBtn.getAttribute("data-nts-program-title") || "NTS";
      const publishedTime = downloadBtn.getAttribute("data-nts-published") || "";
      const image = downloadBtn.getAttribute("data-nts-image") || "";
      setNtsEpisodeStatus(episodeUrl, "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("nts-episode");
      const detach = attachDownloadProgress(progressToken, (p) => setNtsEpisodeStatus(episodeUrl, formatProgressText(p, "Downloading...")));
      try {
        const data = await window.rteDownloader.downloadFromNtsUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image });
        state.ntsDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
        setNtsEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}`);
      } catch (error) {
        setNtsEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
      } finally {
        detach();
        setButtonBusy(downloadBtn, false, "Download");
      }
    }
  });
}

// ── FIP event handlers ────────────────────────────────────────────────────────

if (fipLiveNow) {
  fipLiveNow.addEventListener("click", (e) => {
    const playBtn = e.target.closest(".nts-live-play-overlay");
    if (!playBtn || !fipStationSelect || !fipLiveAudio) return;
    const opt = fipStationSelect.options[fipStationSelect.selectedIndex];
    const streamUrl = (opt && opt.getAttribute("data-stream-url")) || "";
    if (!streamUrl) return;
    fipLiveAudio.src = streamUrl;
    fipLiveAudio.play().catch(() => {});
    playBtn.classList.add("hidden");
    const fipSection = fipLiveNow.closest(".nts-live-section-wrap");
    const audioWrap = fipSection ? fipSection.querySelector(".nts-live-audio-wrap") : fipLiveAudioWrap;
    if (audioWrap) {
      audioWrap.classList.remove("nts-live-audio-hidden");
      audioWrap.classList.add("nts-live-audio-at-bottom");
    }
  });
}

if (fipStationSelect) {
  fipStationSelect.addEventListener("change", () => {
    const opt = fipStationSelect.options[fipStationSelect.selectedIndex];
    const streamUrl = (opt && opt.getAttribute("data-stream-url")) || "";
    if (fipLiveAudio && !fipLiveAudio.paused) {
      // Only auto-switch if already playing
      fipLiveAudio.src = streamUrl;
      if (streamUrl) fipLiveAudio.play().catch(() => {});
    }
    refreshFipLiveNow().catch(() => {});
  });
}

if (fipRefreshLiveBtn) {
  fipRefreshLiveBtn.addEventListener("click", () => {
    refreshFipLiveNow().catch(() => {});
  });
}

if (fipProgramSearchBtn) {
  fipProgramSearchBtn.addEventListener("click", async () => {
    const q = fipProgramSearchInput ? fipProgramSearchInput.value.trim() : "";
    if (!q || !window.rteDownloader?.searchFipPrograms || !fipProgramSearchResult) return;
    fipProgramSearchResult.innerHTML = `<div class="item muted">Searching...</div>`;
    fipProgramSearchResult.classList.remove("hidden");
    try {
      const data = await window.rteDownloader.searchFipPrograms(q);
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) {
        fipProgramSearchResult.innerHTML = `<div class="item muted">No results found.</div>`;
        return;
      }
      fipProgramSearchResult.innerHTML = results.map((r) => renderFipShowCard(r)).join("");
    } catch (err) {
      fipProgramSearchResult.innerHTML = `<div class="item muted error">Search failed: ${escapeHtml(err.message)}</div>`;
    }
  });
}

if (fipProgramSearchInput) {
  fipProgramSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); fipProgramSearchBtn?.click(); }
  });
  fipProgramSearchInput.addEventListener("input", () => {
    clearTimeout(fipSearchDebounceTimer);
    fipSearchDebounceTimer = setTimeout(() => fipProgramSearchBtn?.click(), 400);
  });
}

if (fipProgramSearchResult) {
  fipProgramSearchResult.addEventListener("click", (event) => {
    const item = event.target.closest("[data-fip-program-url]");
    if (!item) return;
    const url = item.getAttribute("data-fip-program-url") || "";
    if (url && fipProgramUrlInput) fipProgramUrlInput.value = url;
    fipProgramSearchResult.classList.add("hidden");
    if (url) {
      setButtonBusy(fipLoadProgramBtn, true, "Load Episodes");
      loadFipProgram(url, 1)
        .catch(() => { if (fipProgramMeta) fipProgramMeta.textContent = "Error loading show."; })
        .finally(() => setButtonBusy(fipLoadProgramBtn, false, "Load Episodes"));
    }
  });
}

if (fipLoadProgramBtn) {
  fipLoadProgramBtn.addEventListener("click", () => {
    const url = fipProgramUrlInput ? fipProgramUrlInput.value.trim() : "";
    if (!url) return;
    setButtonBusy(fipLoadProgramBtn, true, "Load Episodes");
    loadFipProgram(url, 1)
      .catch(() => { if (fipProgramMeta) fipProgramMeta.textContent = "Error loading show."; })
      .finally(() => setButtonBusy(fipLoadProgramBtn, false, "Load Episodes"));
  });
}

if (fipPrevPageBtn) {
  fipPrevPageBtn.addEventListener("click", () => {
    if (state.fipProgramPage <= 1 || !state.fipProgramUrl) return;
    loadFipProgram(state.fipProgramUrl, state.fipProgramPage - 1).catch(() => {});
  });
}

if (fipNextPageBtn) {
  fipNextPageBtn.addEventListener("click", () => {
    if (state.fipProgramPage >= state.fipProgramMaxPages || !state.fipProgramUrl) return;
    loadFipProgram(state.fipProgramUrl, state.fipProgramPage + 1).catch(() => {});
  });
}

if (fipAddScheduleBtn) {
  fipAddScheduleBtn.addEventListener("click", async () => {
    const programUrl = fipProgramUrlInput ? fipProgramUrlInput.value.trim() : "";
    if (!programUrl || !window.rteDownloader?.addFipSchedule) return;
    const backfillMode = fipScheduleBackfillMode ? fipScheduleBackfillMode.value : "new-only";
    const backfillCount = backfillMode === "backfill"
      ? Math.max(1, Math.min(100, Number(fipScheduleBackfillCount?.value || 5)))
      : 0;
    setButtonBusy(fipAddScheduleBtn, true, "Add Scheduler", "Adding...");
    try {
      await window.rteDownloader.addFipSchedule(programUrl, { backfillCount });
      await renderFipScheduleList();
    } catch (err) {
      if (fipProgramMeta) fipProgramMeta.textContent = `Scheduler error: ${err.message}`;
    } finally {
      setButtonBusy(fipAddScheduleBtn, false, "Add Scheduler");
    }
  });
}

if (fipDiscoverBtn && fipDiscoveryResult) {
  fipDiscoverBtn.addEventListener("click", async () => {
    if (!window.rteDownloader?.getFipDiscovery) return;
    setButtonBusy(fipDiscoverBtn, true, "Discover Shows", "Loading...");
    fipDiscoveryResult.innerHTML = `<div class="item muted">Fetching random shows…</div>`;
    try {
      const data = await window.rteDownloader.getFipDiscovery(getDiscoveryCount());
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) {
        fipDiscoveryResult.innerHTML = `<div class="item muted">No shows found.</div>`;
        return;
      }
      fipDiscoveryResult.innerHTML = results.map((r) => renderFipShowCard(r, { showScheduleBtn: true })).join("");
    } catch (err) {
      fipDiscoveryResult.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      setButtonBusy(fipDiscoverBtn, false, "Discover Shows");
    }
  });

  // Click card → load in explorer; click "+ Scheduler" button → schedule directly
  fipDiscoveryResult.addEventListener("click", async (event) => {
    const schedBtn = event.target.closest(".fip-quick-schedule-btn");
    if (schedBtn) {
      event.stopPropagation();
      const url = schedBtn.getAttribute("data-fip-schedule-url") || "";
      if (!url || !window.rteDownloader?.addFipSchedule) return;
      schedBtn.textContent = "Adding…";
      schedBtn.disabled = true;
      try {
        const backfillMode = fipScheduleBackfillMode ? fipScheduleBackfillMode.value : "new-only";
        const backfillCount = backfillMode === "backfill"
          ? Math.max(1, Math.min(100, Number(fipScheduleBackfillCount?.value || 5)))
          : 0;
        await window.rteDownloader.addFipSchedule(url, { backfillCount });
        schedBtn.textContent = "✓ Scheduled";
        await renderFipScheduleList();
      } catch (_) {
        schedBtn.textContent = "Error";
        schedBtn.disabled = false;
      }
      return;
    }
    const item = event.target.closest("[data-fip-program-url]");
    if (!item) return;
    const url = item.getAttribute("data-fip-program-url") || "";
    if (url && fipProgramUrlInput) fipProgramUrlInput.value = url;
    if (url) {
      setButtonBusy(fipLoadProgramBtn, true, "Load Episodes");
      loadFipProgram(url, 1)
        .catch(() => { if (fipProgramMeta) fipProgramMeta.textContent = "Error loading show."; })
        .finally(() => setButtonBusy(fipLoadProgramBtn, false, "Load Episodes"));
      document.getElementById("fipProgramMeta")?.scrollIntoView({ behavior: "smooth" });
    }
  });
}

// Generic discovery card renderer for RTE, BBC, WWF, NTS
function renderDiscoveryCard(r, source, { showScheduleBtn = false } = {}) {
  const genresHtml = (r.genres && r.genres.length)
    ? `<div class="genre-pills">${r.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const cadenceLabel = r.cadence && r.cadence !== "irregular" ? r.cadence.charAt(0).toUpperCase() + r.cadence.slice(1) : "";
  const metaParts = [cadenceLabel].filter(Boolean).join(" · ");
  const desc = (r.description || "").trim();
  const url = r.programUrl || r.url || "";
  const schedBtn = showScheduleBtn
    ? `<button class="secondary discovery-quick-schedule-btn" data-source="${escapeHtml(source)}" data-schedule-url="${escapeHtml(url)}" style="margin-top:0.4rem;font-size:0.8em;">+ Scheduler</button>`
    : "";
  return `
  <div class="item clickable" data-source="${escapeHtml(source)}" data-discovery-program-url="${escapeHtml(url)}">
    <div class="search-card">
      <div>${r.image ? `<img src="${escapeHtml(r.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
      <div>
        <div class="item-title">${escapeHtml(r.title || "Show")}</div>
        ${metaParts ? `<div class="item-meta"><strong>${escapeHtml(metaParts)}</strong></div>` : ""}
        ${r.airtime || r.timeSlot ? `<div class="item-meta">🕐 ${escapeHtml(r.airtime || r.timeSlot)}</div>` : ""}
        ${r.location ? `<div class="item-meta">📍 ${escapeHtml(r.location)}</div>` : ""}
        ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "…" : ""}</div>` : ""}
        ${genresHtml}
        ${schedBtn}
      </div>
    </div>
  </div>`;
}

function setupDiscovery(btn, resultEl, source, apiFn, loadFn, scheduleFn, refreshSchedulesFn) {
  if (!btn || !resultEl) return;
  btn.addEventListener("click", async () => {
    if (!window.rteDownloader?.[apiFn]) return;
    setButtonBusy(btn, true, "Discover Shows", "Loading...");
    resultEl.innerHTML = `<div class="item muted">Fetching random shows…</div>`;
    try {
      const data = await window.rteDownloader[apiFn](getDiscoveryCount());
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) {
        resultEl.innerHTML = `<div class="item muted">No shows found.</div>`;
        return;
      }
      resultEl.innerHTML = results.map((r) => renderDiscoveryCard(r, source, { showScheduleBtn: true })).join("");
    } catch (err) {
      resultEl.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      setButtonBusy(btn, false, "Discover Shows");
    }
  });

  resultEl.addEventListener("click", async (event) => {
    const schedBtn = event.target.closest(".discovery-quick-schedule-btn");
    if (schedBtn && schedBtn.getAttribute("data-source") === source) {
      event.stopPropagation();
      const url = schedBtn.getAttribute("data-schedule-url") || "";
      if (!url || !window.rteDownloader?.[scheduleFn]) return;
      schedBtn.textContent = "Adding…";
      schedBtn.disabled = true;
      try {
        await window.rteDownloader[scheduleFn](url, { backfillCount: 1 });
        schedBtn.textContent = "✓ Scheduled";
        if (refreshSchedulesFn) refreshSchedulesFn().catch(() => {});
      } catch {
        schedBtn.textContent = "Error";
        schedBtn.disabled = false;
      }
      return;
    }
    const item = event.target.closest(`[data-discovery-program-url][data-source="${source}"]`);
    if (!item) return;
    const url = item.getAttribute("data-discovery-program-url") || "";
    if (url && loadFn) loadFn(url);
  });
}

setupDiscovery(
  rteDiscoverBtn, rteDiscoveryResult, "rte",
  "getRteDiscovery",
  (url) => {
    if (programUrlInput) programUrlInput.value = url;
    setButtonBusy(loadProgramBtn, true, "Load Episodes");
    loadProgram(url, 1)
      .catch(() => {})
      .finally(() => setButtonBusy(loadProgramBtn, false, "Load Episodes"));
    document.getElementById("programMeta")?.scrollIntoView({ behavior: "smooth" });
  },
  "addSchedule",
  () => refreshSchedules()
);

setupDiscovery(
  bbcDiscoverBtn, bbcDiscoveryResult, "bbc",
  "getBbcDiscovery",
  (url) => {
    if (bbcProgramUrlInput) bbcProgramUrlInput.value = url;
    setButtonBusy(bbcLoadProgramBtn, true, "Load Episodes");
    loadBbcProgram(url, 1)
      .catch(() => {})
      .finally(() => setButtonBusy(bbcLoadProgramBtn, false, "Load Episodes"));
    document.getElementById("bbcProgramMeta")?.scrollIntoView({ behavior: "smooth" });
  },
  "addBbcSchedule",
  () => refreshBbcSchedules()
);

setupDiscovery(
  wwfDiscoverBtn, wwfDiscoveryResult, "wwf",
  "getWwfDiscovery",
  (url) => {
    // Pass the full /hosts/ URL directly — getWwfProgramEpisodes handles it natively
    if (wwfProgramUrlInput) wwfProgramUrlInput.value = url;
    setButtonBusy(wwfLoadProgramBtn, true, "Load Episodes");
    loadWwfProgram(url, 1)
      .catch(() => {})
      .finally(() => setButtonBusy(wwfLoadProgramBtn, false, "Load Episodes"));
    document.getElementById("wwfProgramMeta")?.scrollIntoView({ behavior: "smooth" });
  },
  "addWwfSchedule",
  () => renderWwfScheduleList()
);

setupDiscovery(
  ntsDiscoverBtn, ntsDiscoveryResult, "nts",
  "getNtsDiscovery",
  (url) => {
    if (ntsProgramUrlInput) ntsProgramUrlInput.value = url;
    setButtonBusy(ntsLoadProgramBtn, true, "Load Episodes");
    loadNtsProgram(url, 1)
      .catch(() => {})
      .finally(() => setButtonBusy(ntsLoadProgramBtn, false, "Load Episodes"));
    document.getElementById("ntsProgramMeta")?.scrollIntoView({ behavior: "smooth" });
  },
  "addNtsSchedule",
  () => renderNtsScheduleList()
);

if (fipDownloadBtn && fipUrlInput) {
  fipDownloadBtn.addEventListener("click", async () => {
    const pageUrl = fipUrlInput.value.trim();
    if (!pageUrl) {
      if (fipResult) fipResult.textContent = "Enter an episode URL.";
      return;
    }
    const progressToken = createProgressToken("fip-quick");
    const detach = attachDownloadProgress(progressToken, (p) => {
      if (fipResult) fipResult.textContent = formatProgressText(p, "Downloading...");
    });
    setButtonBusy(fipDownloadBtn, true, "Download", "Downloading...");
    if (fipResult) fipResult.textContent = "Starting...";
    try {
      const data = await window.rteDownloader.downloadFromFipUrl(pageUrl, progressToken, { forceDownload: false });
      if (fipResult) fipResult.textContent = `Saved: ${data.outputDir}\\${data.fileName}`;
    } catch (error) {
      if (fipResult) fipResult.textContent = error.message;
    } finally {
      detach();
      setButtonBusy(fipDownloadBtn, false, "Download");
    }
  });
}

if (fipEpisodesResult) {
  fipEpisodesResult.addEventListener("click", async (event) => {
    const playBtn = event.target.closest("button[data-fip-play-url]");
    if (playBtn) {
      const episodeUrl = playBtn.getAttribute("data-fip-play-url") || "";
      const title = playBtn.getAttribute("data-fip-play-title") || "";
      const programTitle = playBtn.getAttribute("data-fip-play-program-title") || "FIP";
      const image = playBtn.getAttribute("data-fip-play-image") || "";
      if (!episodeUrl) return;
      setButtonBusy(playBtn, true, "Play", "Loading...");
      try {
        const stream = await window.rteDownloader.getFipEpisodeStream(episodeUrl);
        await playEpisodeWithBackgroundCue({
          sourceType: "fip",
          cacheKey: episodeUrl,
          sourceLabel: "FIP",
          title: title || episodeUrl,
          programTitle,
          image,
          episodeUrl,
          streamUrl: stream?.streamUrl || "",
          playbackKey: `fip:remote:${episodeUrl}`,
          statusUpdater: (text, isErr = false) => setFipEpisodeStatus(episodeUrl, text, isErr)
        });
      } catch (error) {
        setFipEpisodeStatus(episodeUrl, `Play failed: ${error.message}`, true);
      } finally {
        setButtonBusy(playBtn, false, "Play");
      }
      return;
    }

    const playLocalBtn = event.target.closest("button[data-fip-play-local-url]");
    if (playLocalBtn) {
      const episodeUrl = playLocalBtn.getAttribute("data-fip-play-local-url") || "";
      const playTitle = playLocalBtn.getAttribute("data-fip-play-local-title") || "";
      const playProgramTitle = playLocalBtn.getAttribute("data-fip-play-local-program-title") || "FIP";
      const playImage = playLocalBtn.getAttribute("data-fip-play-local-image") || "";
      const saved = state.fipDownloadedAudioByEpisode[episodeUrl];
      if (!saved?.outputDir || !saved?.fileName) {
        setFipEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
        return;
      }
      setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
      try {
        await playEpisodeWithBackgroundCue({
          sourceType: "fip",
          cacheKey: episodeUrl,
          sourceLabel: "FIP Local",
          title: playTitle || saved.fileName,
          programTitle: playProgramTitle || saved.programTitle || "",
          image: playImage,
          episodeUrl,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          playbackKey: `fip:local:${episodeUrl}`,
          statusUpdater: (text, isError = false) => setFipEpisodeStatus(episodeUrl, text, isError)
        });
      } catch (error) {
        setFipEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
      } finally {
        setButtonBusy(playLocalBtn, false, "Play Local");
      }
      return;
    }

    const downloadBtn = event.target.closest("button[data-fip-download-url]");
    if (downloadBtn) {
      const episodeUrl = downloadBtn.getAttribute("data-fip-download-url") || "";
      const title = downloadBtn.getAttribute("data-fip-episode-title") || "fip-episode";
      const programTitle = downloadBtn.getAttribute("data-fip-program-title") || "FIP";
      const publishedTime = downloadBtn.getAttribute("data-fip-published") || "";
      const image = downloadBtn.getAttribute("data-fip-image") || "";
      setFipEpisodeStatus(episodeUrl, "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("fip-episode");
      const detach = attachDownloadProgress(progressToken, (p) => setFipEpisodeStatus(episodeUrl, formatProgressText(p, "Downloading...")));
      try {
        const data = await window.rteDownloader.downloadFromFipUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image });
        state.fipDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
        if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
          setFipEpisodeChapters(episodeUrl, data.cue.chapters);
        }
        const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
        setFipEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}${cueText}`);
      } catch (error) {
        setFipEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
      } finally {
        detach();
        setButtonBusy(downloadBtn, false, "Download");
      }
      return;
    }

    const cueBtn = event.target.closest("button[data-fip-generate-cue-url]");
    if (cueBtn) {
      const episodeUrl = cueBtn.getAttribute("data-fip-generate-cue-url") || "";
      const title = cueBtn.getAttribute("data-fip-generate-cue-title") || "fip-episode";
      const programTitle = cueBtn.getAttribute("data-fip-generate-cue-program-title") || "FIP";
      const saved = state.fipDownloadedAudioByEpisode[episodeUrl];
      if (!saved) {
        setFipEpisodeStatus(episodeUrl, "Download episode first, then generate CUE.", true);
        return;
      }
      setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
      setFipEpisodeStatus(episodeUrl, "Generating CUE/chapters...");
      clearCueDebugLog("fip", episodeUrl);
      const cueProgressToken = createProgressToken(`fip-cue-${Date.now()}`);
      const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
        if (progress?.kind === "cue" && progress?.message) {
          appendCueDebugLog("fip", episodeUrl, progress.message);
        }
        setFipEpisodeStatus(episodeUrl, formatProgressText(progress, "Generating CUE/chapters..."));
      });
      try {
        const cue = await window.rteDownloader.generateCue({
          sourceType: "fip",
          episodeUrl,
          title,
          programTitle,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          progressToken: cueProgressToken
        });
        setFipEpisodeChapters(episodeUrl, cue.chapters || []);
        setFipEpisodeStatus(episodeUrl, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
      } catch (error) {
        setFipEpisodeStatus(episodeUrl, `CUE failed: ${error.message}`, true);
      } finally {
        detachCueProgress();
        setButtonBusy(cueBtn, false, "Generate CUE");
      }
    }
  });
}

if (fipScheduleList) {
  fipScheduleList.addEventListener("click", async (event) => {
    const playLatestBtn = event.target.closest("button[data-fip-schedule-play-output]");
    if (playLatestBtn) {
      try {
        await playFromDownloadedFile({
          outputDir: playLatestBtn.getAttribute("data-fip-schedule-play-output"),
          fileName: playLatestBtn.getAttribute("data-fip-schedule-play-file"),
          title: playLatestBtn.getAttribute("data-fip-schedule-play-title") || "",
          source: "FIP Local",
          subtitle: "Latest scheduled download",
          image: playLatestBtn.getAttribute("data-fip-schedule-play-image") || "",
          episodeUrl: playLatestBtn.getAttribute("data-fip-schedule-play-episode-url") || "",
          sourceType: playLatestBtn.getAttribute("data-fip-schedule-play-source-type") || "fip"
        });
      } catch (error) {
        setFipEpisodeStatus("", `Play failed: ${error.message}`, true);
      }
      return;
    }
    const toggleBtn = event.target.closest("button[data-fip-schedule-toggle]");
    if (toggleBtn) {
      const id = toggleBtn.getAttribute("data-fip-schedule-toggle");
      const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
      await window.rteDownloader.setFipScheduleEnabled(id, enabled);
      await renderFipScheduleList();
      return;
    }
    const runBtn = event.target.closest("button[data-fip-schedule-run]");
    if (runBtn) {
      const id = runBtn.getAttribute("data-fip-schedule-run");
      setButtonBusy(runBtn, true, "Run Now", "Running...");
      try {
        await window.rteDownloader.runFipScheduleNow(id);
        await renderFipScheduleList();
      } catch (error) {
        if (fipProgramMeta) fipProgramMeta.textContent = `Run failed: ${error.message}`;
      } finally {
        setButtonBusy(runBtn, false, "Run Now");
      }
      return;
    }
    const removeBtn = event.target.closest("button[data-fip-schedule-remove]");
    if (removeBtn) {
      const id = removeBtn.getAttribute("data-fip-schedule-remove");
      await window.rteDownloader.removeFipSchedule(id);
      await renderFipScheduleList();
    }
  });
}

// ── KEXP event listeners ──────────────────────────────────────────────────────



if (kexpLiveNow) {
  kexpLiveNow.addEventListener("click", (event) => {
    const overlayBtn = event.target.closest(".live-overlay-btn");
    if (overlayBtn && kexpLiveAudio) {
      if (!kexpLiveAudio.src) kexpLiveAudio.src = KEXP_STREAM_URL;
      kexpLiveAudio.play().catch(() => {});
      if (kexpLiveAudioWrap) {
        kexpLiveAudioWrap.classList.remove("nts-live-audio-hidden");
        kexpLiveAudioWrap.classList.add("nts-live-audio-at-bottom");
      }
      overlayBtn.classList.add("hidden");
    }
  });
}

if (kexpDownloadBtn && kexpUrlInput) {
  kexpDownloadBtn.addEventListener("click", async () => {
    const pageUrl = kexpUrlInput.value.trim();
    if (!pageUrl) {
      if (kexpResult) kexpResult.textContent = "Enter a show URL.";
      return;
    }
    const progressToken = createProgressToken("kexp-quick");
    const detach = attachDownloadProgress(progressToken, (p) => {
      if (kexpResult) kexpResult.textContent = formatProgressText(p, "Downloading...");
    });
    setButtonBusy(kexpDownloadBtn, true, "Download", "Downloading...");
    if (kexpResult) kexpResult.textContent = "Starting...";
    try {
      const data = await window.rteDownloader.downloadFromKexpUrl(pageUrl, progressToken, { forceDownload: false });
      if (kexpResult) kexpResult.textContent = `Saved: ${data.outputDir}\\${data.fileName}`;
    } catch (error) {
      if (kexpResult) kexpResult.textContent = error.message;
    } finally {
      detach();
      setButtonBusy(kexpDownloadBtn, false, "Download");
    }
  });
}

if (kexpProgramSearchBtn) {
  kexpProgramSearchBtn.addEventListener("click", async () => {
    const q = kexpProgramSearchInput ? kexpProgramSearchInput.value.trim() : "";
    if (!window.rteDownloader?.searchKexpPrograms || !kexpProgramSearchResult) return;
    kexpProgramSearchResult.innerHTML = `<div class="item muted">Searching…</div>`;
    kexpProgramSearchResult.classList.remove("hidden");
    try {
      const results = await window.rteDownloader.searchKexpPrograms(q);
      const rows = Array.isArray(results?.results) ? results.results : Array.isArray(results) ? results : [];
      if (!rows.length) {
        kexpProgramSearchResult.innerHTML = `<div class="item muted">No results found.</div>`;
        return;
      }
      kexpProgramSearchResult.innerHTML = rows.map((r) => renderKexpShowCard(r)).join("");
    } catch (err) {
      kexpProgramSearchResult.innerHTML = `<div class="item muted error">Search failed: ${escapeHtml(err.message)}</div>`;
    }
  });
}

if (kexpProgramSearchInput) {
  kexpProgramSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); kexpProgramSearchBtn?.click(); }
  });
  kexpProgramSearchInput.addEventListener("input", () => {
    clearTimeout(kexpSearchDebounceTimer);
    kexpSearchDebounceTimer = setTimeout(() => kexpProgramSearchBtn?.click(), 400);
  });
}

if (kexpProgramSearchResult) {
  kexpProgramSearchResult.addEventListener("click", (event) => {
    const item = event.target.closest("[data-kexp-program-url]");
    if (!item) return;
    const url = item.getAttribute("data-kexp-program-url") || "";
    if (url && kexpProgramUrlInput) kexpProgramUrlInput.value = url;
    kexpProgramSearchResult.classList.add("hidden");
    if (url) {
      setButtonBusy(kexpLoadProgramBtn, true, "Load Shows");
      loadKexpProgram(url, 1)
        .catch(() => { if (kexpProgramMeta) kexpProgramMeta.textContent = "Error loading program."; })
        .finally(() => setButtonBusy(kexpLoadProgramBtn, false, "Load Shows"));
    }
  });
}

if (kexpLoadProgramBtn) {
  kexpLoadProgramBtn.addEventListener("click", () => {
    const url = kexpProgramUrlInput ? kexpProgramUrlInput.value.trim() : "";
    if (!url) return;
    setButtonBusy(kexpLoadProgramBtn, true, "Load Shows");
    loadKexpProgram(url, 1)
      .catch(() => { if (kexpProgramMeta) kexpProgramMeta.textContent = "Error loading program."; })
      .finally(() => setButtonBusy(kexpLoadProgramBtn, false, "Load Shows"));
  });
}

if (kexpPrevPageBtn) {
  kexpPrevPageBtn.addEventListener("click", () => {
    if (state.kexpProgramPage <= 1 || !state.kexpProgramUrl) return;
    loadKexpProgram(state.kexpProgramUrl, state.kexpProgramPage - 1).catch(() => {});
  });
}

if (kexpNextPageBtn) {
  kexpNextPageBtn.addEventListener("click", () => {
    if (state.kexpProgramPage >= state.kexpProgramMaxPages || !state.kexpProgramUrl) return;
    loadKexpProgram(state.kexpProgramUrl, state.kexpProgramPage + 1).catch(() => {});
  });
}

if (kexpAddScheduleBtn) {
  kexpAddScheduleBtn.addEventListener("click", async () => {
    const programUrl = kexpProgramUrlInput ? kexpProgramUrlInput.value.trim() : "";
    if (!programUrl || !window.rteDownloader?.addKexpSchedule) return;
    const backfillMode = kexpScheduleBackfillMode ? kexpScheduleBackfillMode.value : "new-only";
    const backfillCount = backfillMode === "backfill"
      ? Math.max(1, Math.min(100, Number(kexpScheduleBackfillCount?.value || 5)))
      : 0;
    setButtonBusy(kexpAddScheduleBtn, true, "Add Scheduler", "Adding...");
    try {
      await window.rteDownloader.addKexpSchedule(programUrl, { backfillCount });
      await renderKexpScheduleList();
    } catch (err) {
      if (kexpProgramMeta) kexpProgramMeta.textContent = `Scheduler error: ${err.message}`;
    } finally {
      setButtonBusy(kexpAddScheduleBtn, false, "Add Scheduler");
    }
  });
}

if (kexpDiscoverBtn && kexpDiscoveryResult) {
  kexpDiscoverBtn.addEventListener("click", async () => {
    if (!window.rteDownloader?.getKexpDiscovery) return;
    setButtonBusy(kexpDiscoverBtn, true, "Discover Shows", "Loading...");
    kexpDiscoveryResult.innerHTML = `<div class="item muted">Fetching random shows…</div>`;
    try {
      const results = await window.rteDownloader.getKexpDiscovery(getDiscoveryCount());
      const rows = Array.isArray(results) ? results : [];
      if (!rows.length) {
        kexpDiscoveryResult.innerHTML = `<div class="item muted">No shows found.</div>`;
        return;
      }
      kexpDiscoveryResult.innerHTML = rows.map((r) => renderKexpShowCard(r, { showScheduleBtn: true })).join("");
    } catch (err) {
      kexpDiscoveryResult.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      setButtonBusy(kexpDiscoverBtn, false, "Discover Shows");
    }
  });

  kexpDiscoveryResult.addEventListener("click", async (event) => {
    const schedBtn = event.target.closest(".kexp-quick-schedule-btn");
    if (schedBtn) {
      event.stopPropagation();
      const url = schedBtn.getAttribute("data-kexp-schedule-url") || "";
      if (!url || !window.rteDownloader?.addKexpSchedule) return;
      schedBtn.textContent = "Adding…";
      schedBtn.disabled = true;
      try {
        await window.rteDownloader.addKexpSchedule(url, { backfillCount: 1 });
        schedBtn.textContent = "✓ Scheduled";
        await renderKexpScheduleList();
      } catch (_) {
        schedBtn.textContent = "Error";
        schedBtn.disabled = false;
      }
      return;
    }
    const item = event.target.closest("[data-kexp-program-url]");
    if (!item) return;
    const url = item.getAttribute("data-kexp-program-url") || "";
    if (url && kexpProgramUrlInput) kexpProgramUrlInput.value = url;
    if (url) {
      setButtonBusy(kexpLoadProgramBtn, true, "Load Shows");
      loadKexpProgram(url, 1)
        .catch(() => { if (kexpProgramMeta) kexpProgramMeta.textContent = "Error loading program."; })
        .finally(() => setButtonBusy(kexpLoadProgramBtn, false, "Load Shows"));
      kexpProgramMeta?.scrollIntoView({ behavior: "smooth" });
    }
  });
}

if (kexpEpisodesResult) {
  kexpEpisodesResult.addEventListener("click", async (event) => {
    const playLocalBtn = event.target.closest("button[data-kexp-play-local-url]");
    if (playLocalBtn) {
      const episodeUrl = playLocalBtn.getAttribute("data-kexp-play-local-url") || "";
      const playTitle = playLocalBtn.getAttribute("data-kexp-play-local-title") || "";
      const playProgramTitle = playLocalBtn.getAttribute("data-kexp-play-local-program-title") || "";
      const playImage = playLocalBtn.getAttribute("data-kexp-play-local-image") || "";
      const saved = state.kexpDownloadedAudioByEpisode[episodeUrl];
      if (!saved?.outputDir || !saved?.fileName) {
        setKexpEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
        return;
      }
      setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
      try {
        await playEpisodeWithBackgroundCue({
          sourceType: "kexp",
          cacheKey: episodeUrl,
          sourceLabel: "KEXP",
          title: playTitle,
          programTitle: playProgramTitle,
          image: playImage,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          useLocalFile: true,
          playbackKey: `kexp:local:${episodeUrl}`,
          statusUpdater: (text, isError = false) => setKexpEpisodeStatus(episodeUrl, text, isError)
        });
      } catch (error) {
        setKexpEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
      } finally {
        setButtonBusy(playLocalBtn, false, "Play Local");
      }
      return;
    }
    const playBtn = event.target.closest("button[data-kexp-play-url]");
    if (playBtn) {
      const playUrl = playBtn.getAttribute("data-kexp-play-url") || "";
      const playTitle = playBtn.getAttribute("data-kexp-play-title") || "";
      const playProgramTitle = playBtn.getAttribute("data-kexp-play-program-title") || "";
      const playImage = playBtn.getAttribute("data-kexp-play-image") || "";
      setButtonBusy(playBtn, true, "Play", "Loading...");
      try {
        const playPublished = playBtn.getAttribute("data-kexp-play-published") || "";
        const stream = await window.rteDownloader.getKexpEpisodeStream(playUrl, playPublished);
        await playEpisodeWithBackgroundCue({
          sourceType: "kexp",
          cacheKey: playUrl,
          episodeUrl: playUrl,
          sourceLabel: "KEXP",
          title: playTitle,
          programTitle: playProgramTitle,
          image: playImage,
          streamUrl: stream.streamUrl || stream,
          startOffset: Number(stream.startOffset) || 0,
          playbackKey: `kexp:remote:${playUrl}`,
          statusUpdater: (text, isError = false) => setKexpEpisodeStatus(playUrl, text, isError)
        });
      } catch (error) {
        setKexpEpisodeStatus(playUrl, `Play failed: ${error.message}`, true);
      } finally {
        setButtonBusy(playBtn, false, "Play");
      }
      return;
    }
    const cueBtn = event.target.closest("button[data-kexp-generate-cue-url]");
    if (cueBtn) {
      const episodeUrlCue = cueBtn.getAttribute("data-kexp-generate-cue-url") || "";
      const titleCue = cueBtn.getAttribute("data-kexp-generate-cue-title") || "kexp-episode";
      const programTitleCue = cueBtn.getAttribute("data-kexp-generate-cue-program-title") || "KEXP";
      const saved = state.kexpDownloadedAudioByEpisode[episodeUrlCue];
      if (!saved) {
        setKexpEpisodeStatus(episodeUrlCue, "Download episode first, then generate CUE.", true);
        return;
      }
      setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
      setKexpEpisodeStatus(episodeUrlCue, "Generating CUE/chapters...");
      clearCueDebugLog("kexp", episodeUrlCue);
      const cueProgressToken = createProgressToken(`kexp-cue-${Date.now()}`);
      const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
        if (progress?.kind === "cue" && progress?.message) {
          appendCueDebugLog("kexp", episodeUrlCue, progress.message);
        }
        setKexpEpisodeStatus(episodeUrlCue, formatProgressText(progress, "Generating CUE/chapters..."));
      });
      try {
        const cue = await window.rteDownloader.generateCue({
          sourceType: "kexp",
          episodeUrl: episodeUrlCue,
          title: titleCue,
          programTitle: programTitleCue,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          progressToken: cueProgressToken
        });
        setCachedChapters("kexp", episodeUrlCue, cue.chapters || []);
        setKexpEpisodeStatus(episodeUrlCue, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
      } catch (error) {
        setKexpEpisodeStatus(episodeUrlCue, `CUE failed: ${error.message}`, true);
      } finally {
        detachCueProgress();
        setButtonBusy(cueBtn, false, "Generate CUE");
      }
      return;
    }
    const downloadBtn = event.target.closest("button[data-kexp-download-url]");
    if (downloadBtn) {
      const episodeUrl = downloadBtn.getAttribute("data-kexp-download-url") || "";
      const title = downloadBtn.getAttribute("data-kexp-episode-title") || "kexp-episode";
      const programTitle = downloadBtn.getAttribute("data-kexp-program-title") || "KEXP";
      const publishedTime = downloadBtn.getAttribute("data-kexp-published") || "";
      const image = downloadBtn.getAttribute("data-kexp-image") || "";
      setKexpEpisodeStatus(episodeUrl, "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("kexp-episode");
      const detach = attachDownloadProgress(progressToken, (p) => setKexpEpisodeStatus(episodeUrl, formatProgressText(p, "Downloading...")));
      try {
        const data = await window.rteDownloader.downloadFromKexpUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image });
        state.kexpDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
        setKexpEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}`);
      } catch (error) {
        setKexpEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
      } finally {
        detach();
        setButtonBusy(downloadBtn, false, "Download");
      }
    }
  });
}

// ── KEXP Extended Archive event handlers ─────────────────────────────────────

function setKexpExtEpisodeStatus(episodeUrl, text, isError = false) {
  const key = encodeURIComponent(episodeUrl);
  const el = kexpExtEpisodesResult?.querySelector(`[data-kexp-ext-episode-status="${key}"]`);
  if (!el) return;
  el.textContent = text;
  el.style.display = text ? "block" : "none";
  el.classList.toggle("error", isError);
}

if (kexpExtSearchBtn && kexpExtSearchResult) {
  kexpExtSearchBtn.addEventListener("click", async () => {
    if (!window.rteDownloader?.searchKexpExtendedPrograms) return;
    const query = kexpExtSearchInput ? kexpExtSearchInput.value.trim() : "";
    setButtonBusy(kexpExtSearchBtn, true, "Search", "Searching...");
    kexpExtSearchResult.innerHTML = `<div class="item muted">Searching…</div>`;
    kexpExtSearchResult.classList.remove("hidden");
    try {
      const data = await window.rteDownloader.searchKexpExtendedPrograms(query);
      const rows = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      kexpExtSearchResult.innerHTML = rows.length
        ? rows.map((r) => renderKexpShowCard(r)).join("")
        : `<div class="item muted">No results found.</div>`;
    } catch (err) {
      kexpExtSearchResult.innerHTML = `<div class="item muted error">Search failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      setButtonBusy(kexpExtSearchBtn, false, "Search");
    }
  });
  kexpExtSearchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") kexpExtSearchBtn.click(); });
}

if (kexpExtDiscoverBtn) {
  kexpExtDiscoverBtn.addEventListener("click", async () => {
    if (!window.rteDownloader?.getKexpExtendedDiscovery) return;
    setButtonBusy(kexpExtDiscoverBtn, true, "Discover", "Loading...");
    if (kexpExtSearchResult) {
      kexpExtSearchResult.innerHTML = `<div class="item muted">Fetching shows…</div>`;
      kexpExtSearchResult.classList.remove("hidden");
    }
    try {
      const data = await window.rteDownloader.getKexpExtendedDiscovery();
      const rows = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      if (kexpExtSearchResult) {
        kexpExtSearchResult.innerHTML = rows.length
          ? rows.map((r) => renderKexpShowCard(r)).join("")
          : `<div class="item muted">No shows found.</div>`;
      }
    } catch (err) {
      if (kexpExtSearchResult) kexpExtSearchResult.innerHTML = `<div class="item muted error">Failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      setButtonBusy(kexpExtDiscoverBtn, false, "Discover");
    }
  });
}

if (kexpExtSearchResult) {
  kexpExtSearchResult.addEventListener("click", (event) => {
    const item = event.target.closest("[data-kexp-program-url]");
    if (!item) return;
    const url = item.getAttribute("data-kexp-program-url") || "";
    kexpExtSearchResult.classList.add("hidden");
    if (url) loadKexpExtendedProgram(url, 1).catch(() => {
      if (kexpExtProgramMeta) { kexpExtProgramMeta.style.display = "block"; kexpExtProgramMeta.textContent = "Error loading program."; }
    });
  });
}

if (kexpExtPrevPageBtn) {
  kexpExtPrevPageBtn.addEventListener("click", () => {
    if (state.kexpExtProgramPage <= 1 || !state.kexpExtProgramUrl) return;
    loadKexpExtendedProgram(state.kexpExtProgramUrl, state.kexpExtProgramPage - 1).catch(() => {});
  });
}

if (kexpExtNextPageBtn) {
  kexpExtNextPageBtn.addEventListener("click", () => {
    if (state.kexpExtProgramPage >= state.kexpExtProgramMaxPages || !state.kexpExtProgramUrl) return;
    loadKexpExtendedProgram(state.kexpExtProgramUrl, state.kexpExtProgramPage + 1).catch(() => {});
  });
}

if (kexpExtEpisodesResult) {
  kexpExtEpisodesResult.addEventListener("click", async (event) => {
    // Play button
    const playBtn = event.target.closest("button[data-kexp-ext-play-url]");
    if (playBtn) {
      const episodeUrl = playBtn.getAttribute("data-kexp-ext-play-url") || "";
      const playTitle = playBtn.getAttribute("data-kexp-ext-play-title") || "";
      const playProgramTitle = playBtn.getAttribute("data-kexp-ext-play-program-title") || "";
      const playImage = playBtn.getAttribute("data-kexp-ext-play-image") || "";
      setButtonBusy(playBtn, true, "Play", "Loading...");
      try {
        const stream = await window.rteDownloader.getKexpExtendedEpisodeStream(episodeUrl);
        await playEpisodeWithBackgroundCue({
          sourceType: "kexp",
          cacheKey: episodeUrl,
          sourceLabel: "KEXP Extended",
          title: playTitle,
          programTitle: playProgramTitle,
          image: playImage,
          streamUrl: stream.streamUrl,
          playbackKey: `kexp-ext:remote:${episodeUrl}`,
          statusUpdater: (text, isError = false) => setKexpExtEpisodeStatus(episodeUrl, text, isError)
        });
      } catch (err) {
        setKexpExtEpisodeStatus(episodeUrl, `Play failed: ${err.message}`, true);
      } finally {
        setButtonBusy(playBtn, false, "Play");
      }
      return;
    }
    // Play Local button
    const playLocalBtn = event.target.closest("button[data-kexp-ext-play-local-url]");
    if (playLocalBtn) {
      const episodeUrl = playLocalBtn.getAttribute("data-kexp-ext-play-local-url") || "";
      const playTitle = playLocalBtn.getAttribute("data-kexp-ext-play-local-title") || "";
      const playProgramTitle = playLocalBtn.getAttribute("data-kexp-ext-play-local-program-title") || "";
      const playImage = playLocalBtn.getAttribute("data-kexp-ext-play-local-image") || "";
      const saved = state.kexpExtDownloadedAudioByEpisode[episodeUrl];
      if (!saved?.outputDir || !saved?.fileName) {
        setKexpExtEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
        return;
      }
      setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
      try {
        await playEpisodeWithBackgroundCue({
          sourceType: "kexp",
          cacheKey: episodeUrl,
          sourceLabel: "KEXP Extended",
          title: playTitle,
          programTitle: playProgramTitle,
          image: playImage,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          useLocalFile: true,
          playbackKey: `kexp-ext:local:${episodeUrl}`,
          statusUpdater: (text, isError = false) => setKexpExtEpisodeStatus(episodeUrl, text, isError)
        });
      } catch (err) {
        setKexpExtEpisodeStatus(episodeUrl, `Play Local failed: ${err.message}`, true);
      } finally {
        setButtonBusy(playLocalBtn, false, "Play Local");
      }
      return;
    }
    // Download button
    const downloadBtn = event.target.closest("button[data-kexp-ext-download-url]");
    if (downloadBtn) {
      const episodeUrl = downloadBtn.getAttribute("data-kexp-ext-download-url") || "";
      const title = downloadBtn.getAttribute("data-kexp-ext-episode-title") || "kexp-episode";
      const programTitle = downloadBtn.getAttribute("data-kexp-ext-program-title") || "KEXP";
      const publishedTime = downloadBtn.getAttribute("data-kexp-ext-published") || "";
      const image = downloadBtn.getAttribute("data-kexp-ext-image") || "";
      setKexpExtEpisodeStatus(episodeUrl, "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("kexp-ext-episode");
      const detach = attachDownloadProgress(progressToken, (p) => setKexpExtEpisodeStatus(episodeUrl, formatProgressText(p, "Downloading...")));
      try {
        const data = await window.rteDownloader.downloadFromUrl("kexp-extended", episodeUrl, progressToken, { title, programTitle, publishedTime, image });
        state.kexpExtDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
        setKexpExtEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}`);
        renderKexpExtEpisodes({ episodes: Array.from(kexpExtEpisodesResult.querySelectorAll(".item")).map(() => null).filter(Boolean) }, programTitle);
      } catch (err) {
        setKexpExtEpisodeStatus(episodeUrl, `Download failed: ${err.message}`, true);
      } finally {
        detach();
        setButtonBusy(downloadBtn, false, "Download");
      }
      return;
    }
    // Generate CUE button
    const cueBtn = event.target.closest("button[data-kexp-ext-generate-cue-url]");
    if (cueBtn) {
      const episodeUrl = cueBtn.getAttribute("data-kexp-ext-generate-cue-url") || "";
      const titleCue = cueBtn.getAttribute("data-kexp-ext-generate-cue-title") || "kexp-episode";
      const programTitleCue = cueBtn.getAttribute("data-kexp-ext-generate-cue-program-title") || "KEXP";
      const saved = state.kexpExtDownloadedAudioByEpisode[episodeUrl];
      if (!saved) {
        setKexpExtEpisodeStatus(episodeUrl, "Download episode first, then generate CUE.", true);
        return;
      }
      setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
      setKexpExtEpisodeStatus(episodeUrl, "Generating CUE/chapters...");
      const cueProgressToken = createProgressToken(`kexp-ext-cue-${Date.now()}`);
      const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
        setKexpExtEpisodeStatus(episodeUrl, formatProgressText(progress, "Generating CUE/chapters..."));
      });
      try {
        const cue = await window.rteDownloader.generateCue({
          sourceType: "kexp",
          episodeUrl,
          title: titleCue,
          programTitle: programTitleCue,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          progressToken: cueProgressToken
        });
        setCachedChapters("kexp", episodeUrl, cue.chapters || []);
        setKexpExtEpisodeStatus(episodeUrl, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
      } catch (err) {
        setKexpExtEpisodeStatus(episodeUrl, `CUE failed: ${err.message}`, true);
      } finally {
        detachCueProgress();
        setButtonBusy(cueBtn, false, "Generate CUE");
      }
    }
  });
}

if (kexpScheduleList) {
  kexpScheduleList.addEventListener("click", async (event) => {
    const playLatestBtn = event.target.closest("button[data-kexp-schedule-play-output]");
    if (playLatestBtn) {
      try {
        await playFromDownloadedFile({
          outputDir: playLatestBtn.getAttribute("data-kexp-schedule-play-output"),
          fileName: playLatestBtn.getAttribute("data-kexp-schedule-play-file"),
          title: playLatestBtn.getAttribute("data-kexp-schedule-play-title") || "",
          source: "KEXP Local",
          subtitle: "Latest scheduled download",
          image: playLatestBtn.getAttribute("data-kexp-schedule-play-image") || "",
          episodeUrl: playLatestBtn.getAttribute("data-kexp-schedule-play-episode-url") || "",
          sourceType: playLatestBtn.getAttribute("data-kexp-schedule-play-source-type") || "kexp"
        });
      } catch (error) {
        setKexpEpisodeStatus("", `Play failed: ${error.message}`, true);
      }
      return;
    }
    const toggleBtn = event.target.closest("button[data-kexp-schedule-toggle]");
    if (toggleBtn) {
      const id = toggleBtn.getAttribute("data-kexp-schedule-toggle");
      const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
      await window.rteDownloader.setKexpScheduleEnabled(id, enabled);
      await renderKexpScheduleList();
      return;
    }
    const runBtn = event.target.closest("button[data-kexp-schedule-run]");
    if (runBtn) {
      const id = runBtn.getAttribute("data-kexp-schedule-run");
      setButtonBusy(runBtn, true, "Run Now", "Running...");
      try {
        await window.rteDownloader.runKexpScheduleNow(id);
        await renderKexpScheduleList();
      } catch (error) {
        if (kexpProgramMeta) kexpProgramMeta.textContent = `Run failed: ${error.message}`;
      } finally {
        setButtonBusy(runBtn, false, "Run Now");
      }
      return;
    }
    const removeBtn = event.target.closest("button[data-kexp-schedule-remove]");
    if (removeBtn) {
      const id = removeBtn.getAttribute("data-kexp-schedule-remove");
      await window.rteDownloader.removeKexpSchedule(id);
      await renderKexpScheduleList();
    }
  });
}

nowPlayingCloseBtn.addEventListener("click", () => {
  clearGlobalNowPlaying();
});

if (nowPlayingResumeBtn) {
  nowPlayingResumeBtn.addEventListener("click", () => {
    const pos = loadResumePosition(activeNowPlaying?.playbackKey);
    if (pos) nowPlayingAudio.currentTime = pos;
  });
}

if (nowPlayingPrevChapterBtn) {
  nowPlayingPrevChapterBtn.addEventListener("click", () => {
    jumpToAdjacentChapter(-1);
  });
}

if (nowPlayingNextChapterBtn) {
  nowPlayingNextChapterBtn.addEventListener("click", () => {
    jumpToAdjacentChapter(1);
  });
}

nowPlayingImage.addEventListener("error", () => {
  if (nowPlayingImage.src.startsWith("data:image/svg+xml")) {
    return;
  }
  nowPlayingImage.src = DEFAULT_NOW_PLAYING_ART;
});

nowPlayingAudio.addEventListener("timeupdate", () => {
  refreshNowPlayingTrackLabel();
  if (activeNowPlaying?.playbackKey && !activeNowPlaying.playbackKey.startsWith("wwf:remote:")) {
    if (!resumeSaveTimer) {
      resumeSaveTimer = setTimeout(() => {
        resumeSaveTimer = null;
        const pos = nowPlayingAudio.currentTime;
        if (pos > 5) saveResumePosition(activeNowPlaying.playbackKey, pos);
      }, 5000);
    }
  }
});

nowPlayingAudio.addEventListener("seeking", () => {
  refreshNowPlayingTrackLabel();
});

nowPlayingAudio.addEventListener("seeked", () => {
  refreshNowPlayingTrackLabel();
});

nowPlayingAudio.addEventListener("loadedmetadata", () => {
  refreshNowPlayingTrackLabel();
  const key = activeNowPlaying?.playbackKey;
  if (key && !key.startsWith("wwf:remote:")) {
    const savedPos = loadResumePosition(key);
    const dur = nowPlayingAudio.duration;
    if (savedPos && savedPos > 5 && (!isFinite(dur) || savedPos < dur - 30)) {
      nowPlayingAudio.currentTime = savedPos;
    }
  }
  updateResumeBadge();
});

nowPlayingAudio.addEventListener("durationchange", () => {
  refreshNowPlayingTrackLabel();
});

nowPlayingAudio.addEventListener("playing", () => {
  if (pendingNowPlayingVisible) {
    nowPlayingBar.classList.remove("hidden");
    pendingNowPlayingVisible = false;
  }
  // Clear the "Buffering..." card message once audio actually starts
  const pk = activeNowPlaying?.playbackKey || "";
  if (pk.startsWith("wwf:remote:")) {
    const episodeUrl = pk.slice("wwf:remote:".length);
    if (episodeUrl) setWwfEpisodeStatus(episodeUrl, "");
  }
});

nowPlayingAudio.addEventListener("ended", () => {
  clearResumePosition(activeNowPlaying?.playbackKey);
  clearGlobalNowPlaying();
});

scheduleList.addEventListener("click", async (event) => {
  const playLatestBtn = event.target.closest("button[data-schedule-play-output]");
  if (playLatestBtn) {
    try {
      await playFromDownloadedFile({
        outputDir: playLatestBtn.getAttribute("data-schedule-play-output"),
        fileName: playLatestBtn.getAttribute("data-schedule-play-file"),
        title: playLatestBtn.getAttribute("data-schedule-play-title") || "",
        source: "RTE Local",
        subtitle: "Latest scheduled download",
        image: playLatestBtn.getAttribute("data-schedule-play-image") || "",
        episodeUrl: playLatestBtn.getAttribute("data-schedule-play-episode-url") || "",
        sourceType: playLatestBtn.getAttribute("data-schedule-play-source-type") || "rte"
      });
    } catch (error) {
      setSettingsStatus(`Scheduler play failed: ${error.message}`, true);
    }
    return;
  }
  const toggleBtn = event.target.closest("button[data-schedule-toggle]");
  if (toggleBtn) {
    const id = toggleBtn.getAttribute("data-schedule-toggle");
    const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
    await window.rteDownloader.setScheduleEnabled(id, enabled);
    await refreshSchedules();
    return;
  }

  const runBtn = event.target.closest("button[data-schedule-run]");
  if (runBtn) {
    const id = runBtn.getAttribute("data-schedule-run");
    setButtonBusy(runBtn, true, "Run Now", "Running...");
    setScheduleStatus(id, "Running scheduler now...");
    try {
      const result = await window.rteDownloader.runScheduleNow(id);
      await refreshSchedules();
      setScheduleStatus(id, formatRunNowResult(result));
    } catch (error) {
      setScheduleStatus(id, `Run Now failed: ${error.message}`, true);
    } finally {
      setButtonBusy(runBtn, false, "Run Now");
    }
    return;
  }

  const removeBtn = event.target.closest("button[data-schedule-remove]");
  if (removeBtn) {
    const id = removeBtn.getAttribute("data-schedule-remove");
    await window.rteDownloader.removeSchedule(id);
    await refreshSchedules();
  }
});

bbcScheduleList.addEventListener("click", async (event) => {
  const playLatestBtn = event.target.closest("button[data-bbc-schedule-play-output]");
  if (playLatestBtn) {
    try {
      await playFromDownloadedFile({
        outputDir: playLatestBtn.getAttribute("data-bbc-schedule-play-output"),
        fileName: playLatestBtn.getAttribute("data-bbc-schedule-play-file"),
        title: playLatestBtn.getAttribute("data-bbc-schedule-play-title") || "",
        source: "BBC Local",
        subtitle: "Latest scheduled download",
        image: playLatestBtn.getAttribute("data-bbc-schedule-play-image") || "",
        episodeUrl: playLatestBtn.getAttribute("data-bbc-schedule-play-episode-url") || "",
        sourceType: playLatestBtn.getAttribute("data-bbc-schedule-play-source-type") || "bbc"
      });
    } catch (error) {
      setSettingsStatus(`Scheduler play failed: ${error.message}`, true);
    }
    return;
  }
  const toggleBtn = event.target.closest("button[data-bbc-schedule-toggle]");
  if (toggleBtn) {
    const id = toggleBtn.getAttribute("data-bbc-schedule-toggle");
    const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
    await window.rteDownloader.setBbcScheduleEnabled(id, enabled);
    await refreshBbcSchedules();
    return;
  }

  const runBtn = event.target.closest("button[data-bbc-schedule-run]");
  if (runBtn) {
    const id = runBtn.getAttribute("data-bbc-schedule-run");
    setButtonBusy(runBtn, true, "Run Now", "Running...");
    setBbcScheduleStatus(id, "Running scheduler now...");
    try {
      const result = await window.rteDownloader.runBbcScheduleNow(id);
      await refreshBbcSchedules();
      setBbcScheduleStatus(id, formatRunNowResult(result));
    } catch (error) {
      setBbcScheduleStatus(id, `Run Now failed: ${error.message}`, true);
    } finally {
      setButtonBusy(runBtn, false, "Run Now");
    }
    return;
  }

  const removeBtn = event.target.closest("button[data-bbc-schedule-remove]");
  if (removeBtn) {
    const id = removeBtn.getAttribute("data-bbc-schedule-remove");
    await window.rteDownloader.removeBbcSchedule(id);
    await refreshBbcSchedules();
  }
});

if (wwfScheduleList) {
  wwfScheduleList.addEventListener("click", async (event) => {
    const playLatestBtn = event.target.closest("button[data-wwf-schedule-play-output]");
    if (playLatestBtn) {
      try {
        await playFromDownloadedFile({
          outputDir: playLatestBtn.getAttribute("data-wwf-schedule-play-output"),
          fileName: playLatestBtn.getAttribute("data-wwf-schedule-play-file"),
          title: playLatestBtn.getAttribute("data-wwf-schedule-play-title") || "",
          source: "Worldwide FM Local",
          subtitle: "Latest scheduled download",
          image: playLatestBtn.getAttribute("data-wwf-schedule-play-image") || "",
          episodeUrl: playLatestBtn.getAttribute("data-wwf-schedule-play-episode-url") || "",
          sourceType: playLatestBtn.getAttribute("data-wwf-schedule-play-source-type") || "wwf"
        });
      } catch (error) {
        setWwfEpisodeStatus("", `Play failed: ${error.message}`, true);
      }
      return;
    }
    const toggleBtn = event.target.closest("button[data-wwf-schedule-toggle]");
    if (toggleBtn) {
      const id = toggleBtn.getAttribute("data-wwf-schedule-toggle");
      const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
      await window.rteDownloader.setWwfScheduleEnabled(id, enabled);
      await renderWwfScheduleList();
      return;
    }
    const runBtn = event.target.closest("button[data-wwf-schedule-run]");
    if (runBtn) {
      const id = runBtn.getAttribute("data-wwf-schedule-run");
      const statusEl = wwfScheduleList.querySelector(`[data-wwf-schedule-status="${id}"]`);
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "Running...";
      }
      try {
        await window.rteDownloader.runWwfScheduleNow(id);
        await renderWwfScheduleList();
      } catch (error) {
        if (statusEl) statusEl.textContent = `Error: ${error.message}`;
      }
      return;
    }
    const removeBtn = event.target.closest("button[data-wwf-schedule-remove]");
    if (removeBtn) {
      const id = removeBtn.getAttribute("data-wwf-schedule-remove");
      await window.rteDownloader.removeWwfSchedule(id);
      await renderWwfScheduleList();
    }
  });
}

if (ntsScheduleList) {
  ntsScheduleList.addEventListener("click", async (event) => {
    const playLatestBtn = event.target.closest("button[data-nts-schedule-play-output]");
    if (playLatestBtn) {
      try {
        await playFromDownloadedFile({
          outputDir: playLatestBtn.getAttribute("data-nts-schedule-play-output"),
          fileName: playLatestBtn.getAttribute("data-nts-schedule-play-file"),
          title: playLatestBtn.getAttribute("data-nts-schedule-play-title") || "",
          source: "NTS Local",
          subtitle: "Latest scheduled download",
          image: playLatestBtn.getAttribute("data-nts-schedule-play-image") || "",
          episodeUrl: playLatestBtn.getAttribute("data-nts-schedule-play-episode-url") || "",
          sourceType: playLatestBtn.getAttribute("data-nts-schedule-play-source-type") || "nts"
        });
      } catch (error) {
        setNtsEpisodeStatus("", `Play failed: ${error.message}`, true);
      }
      return;
    }
    const toggleBtn = event.target.closest("button[data-nts-schedule-toggle]");
    if (toggleBtn) {
      const id = toggleBtn.getAttribute("data-nts-schedule-toggle");
      const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
      await window.rteDownloader.setNtsScheduleEnabled(id, enabled);
      await renderNtsScheduleList();
      return;
    }
    const runBtn = event.target.closest("button[data-nts-schedule-run]");
    if (runBtn) {
      const id = runBtn.getAttribute("data-nts-schedule-run");
      const statusEl = ntsScheduleList.querySelector(`[data-nts-schedule-status="${id}"]`);
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "Running...";
      }
      try {
        await window.rteDownloader.runNtsScheduleNow(id);
        await renderNtsScheduleList();
      } catch (error) {
        if (statusEl) statusEl.textContent = `Error: ${error.message}`;
      }
      return;
    }
    const removeBtn = event.target.closest("button[data-nts-schedule-remove]");
    if (removeBtn) {
      const id = removeBtn.getAttribute("data-nts-schedule-remove");
      await window.rteDownloader.removeNtsSchedule(id);
      await renderNtsScheduleList();
    }
  });
}

// Combined Schedules tab — delegates to per-source APIs based on data attributes
if (allSchedulesList) {
  allSchedulesList.addEventListener("click", async (event) => {
    // Determine which source this card belongs to by checking which attribute is present
    const btn = event.target.closest("button");
    if (!btn) return;

    // Helper: find the status element relative to the clicked button's card
    const card = btn.closest(".scheduler-card");
    const getStatusEl = (attr) => card?.querySelector(`[${attr}]`);

    // Play latest
    for (const src of ["", "bbc-", "wwf-", "nts-", "fip-"]) {
      const attr = `data-${src}schedule-play-output`;
      const playBtn = btn.matches(`[${attr}]`) ? btn : null;
      if (playBtn) {
        try {
          await playFromDownloadedFile({
            outputDir: playBtn.getAttribute(attr),
            fileName: playBtn.getAttribute(`data-${src}schedule-play-file`),
            title: playBtn.getAttribute(`data-${src}schedule-play-title`) || "",
            source: "Local",
            subtitle: "Latest scheduled download",
            image: playBtn.getAttribute(`data-${src}schedule-play-image`) || "",
            episodeUrl: playBtn.getAttribute(`data-${src}schedule-play-episode-url`) || "",
            sourceType: playBtn.getAttribute(`data-${src}schedule-play-source-type`) || src.replace("-", "") || "rte"
          });
        } catch {}
        return;
      }
    }

    // Toggle / Run / Remove — map source prefix to API methods
    const srcMap = {
      "":     { toggle: "setScheduleEnabled",    run: "runScheduleNow",    remove: "removeSchedule" },
      "bbc-": { toggle: "setBbcScheduleEnabled", run: "runBbcScheduleNow", remove: "removeBbcSchedule" },
      "wwf-": { toggle: "setWwfScheduleEnabled", run: "runWwfScheduleNow", remove: "removeWwfSchedule" },
      "nts-": { toggle: "setNtsScheduleEnabled", run: "runNtsScheduleNow", remove: "removeNtsSchedule" },
      "fip-": { toggle: "setFipScheduleEnabled", run: "runFipScheduleNow", remove: "removeFipSchedule" }
    };
    for (const [src, methods] of Object.entries(srcMap)) {
      const toggleBtn = btn.matches(`[data-${src}schedule-toggle]`) ? btn : null;
      if (toggleBtn) {
        const id = toggleBtn.getAttribute(`data-${src}schedule-toggle`);
        const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
        await window.rteDownloader[methods.toggle](id, enabled);
        await renderAllSchedules();
        return;
      }
      const runBtn = btn.matches(`[data-${src}schedule-run]`) ? btn : null;
      if (runBtn) {
        const id = runBtn.getAttribute(`data-${src}schedule-run`);
        const statusEl = getStatusEl(`data-${src}schedule-status`);
        if (statusEl) { statusEl.style.display = "block"; statusEl.textContent = "Running..."; }
        try {
          await window.rteDownloader[methods.run](id);
          await renderAllSchedules();
        } catch (error) {
          if (statusEl) statusEl.textContent = `Error: ${error.message}`;
        }
        return;
      }
      const removeBtn = btn.matches(`[data-${src}schedule-remove]`) ? btn : null;
      if (removeBtn) {
        const id = removeBtn.getAttribute(`data-${src}schedule-remove`);
        await window.rteDownloader[methods.remove](id);
        await renderAllSchedules();
        return;
      }
    }
  });
}

if (queuePauseBtn) {
  queuePauseBtn.addEventListener("click", async () => {
    try {
      await window.rteDownloader.pauseDownloadQueue();
      await refreshDownloadQueueSnapshot();
    } catch {}
  });
}

if (queueResumeBtn) {
  queueResumeBtn.addEventListener("click", async () => {
    try {
      await window.rteDownloader.resumeDownloadQueue();
      await refreshDownloadQueueSnapshot();
    } catch {}
  });
}

if (queueClearBtn) {
  queueClearBtn.addEventListener("click", async () => {
    try {
      await window.rteDownloader.clearPendingDownloadQueue();
      await refreshDownloadQueueSnapshot();
    } catch {}
  });
}

if (downloadQueueActive) {
  downloadQueueActive.addEventListener("click", async (event) => {
    const playBtn = event.target.closest("button[data-queue-play]");
    if (playBtn) {
      try {
        await playFromDownloadedFile({
          outputDir: playBtn.getAttribute("data-queue-play"),
          fileName: playBtn.getAttribute("data-queue-file"),
          title: playBtn.getAttribute("data-queue-title") || "",
          source: playBtn.getAttribute("data-queue-source") || "Local",
          subtitle: "From Queue",
          image: playBtn.getAttribute("data-queue-image") || ""
        });
      } catch (error) {
        setSettingsStatus(`Queue play failed: ${error.message}`, true);
      }
      return;
    }
    const cancelBtn = event.target.closest("button[data-queue-cancel]");
    if (!cancelBtn) {
      return;
    }
    const taskId = cancelBtn.getAttribute("data-queue-cancel") || "";
    if (!taskId) {
      return;
    }
    try {
      await window.rteDownloader.cancelDownloadQueueTask(taskId);
      await refreshDownloadQueueSnapshot();
    } catch {}
  });
}

if (downloadQueuePending) {
  downloadQueuePending.addEventListener("click", async (event) => {
    const playBtn = event.target.closest("button[data-queue-play]");
    if (playBtn) {
      try {
        await playFromDownloadedFile({
          outputDir: playBtn.getAttribute("data-queue-play"),
          fileName: playBtn.getAttribute("data-queue-file"),
          title: playBtn.getAttribute("data-queue-title") || "",
          source: playBtn.getAttribute("data-queue-source") || "Local",
          subtitle: "From Queue",
          image: playBtn.getAttribute("data-queue-image") || ""
        });
      } catch (error) {
        setSettingsStatus(`Queue play failed: ${error.message}`, true);
      }
      return;
    }
    const cancelBtn = event.target.closest("button[data-queue-cancel]");
    if (!cancelBtn) {
      return;
    }
    const taskId = cancelBtn.getAttribute("data-queue-cancel") || "";
    if (!taskId) {
      return;
    }
    try {
      await window.rteDownloader.cancelDownloadQueueTask(taskId);
      await refreshDownloadQueueSnapshot();
    } catch {}
  });
}

if (downloadQueueRecent) {
  downloadQueueRecent.addEventListener("click", async (event) => {
    const playBtn = event.target.closest("button[data-queue-play]");
    if (!playBtn) {
      return;
    }
    try {
      await playFromDownloadedFile({
        outputDir: playBtn.getAttribute("data-queue-play"),
        fileName: playBtn.getAttribute("data-queue-file"),
        title: playBtn.getAttribute("data-queue-title") || "",
        source: playBtn.getAttribute("data-queue-source") || "Local",
        subtitle: "From Queue",
        image: playBtn.getAttribute("data-queue-image") || ""
      });
    } catch (error) {
      setSettingsStatus(`Queue play failed: ${error.message}`, true);
    }
  });
}

// ── Download History ──────────────────────────────────────────────────────────
let historyAllEntries = [];

async function loadHistory() {
  try {
    const result = await window.rteDownloader.listDownloadHistory();
    historyAllEntries = result?.history || result || [];
  } catch { historyAllEntries = []; }
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");
  const filter = document.getElementById("historySourceFilter")?.value || "";
  const search = (document.getElementById("historySearchInput")?.value || "").toLowerCase();
  if (!list) return;
  let entries = historyAllEntries;
  if (filter) entries = entries.filter(e => e.sourceType === filter);
  if (search) entries = entries.filter(e =>
    (e.episodeTitle || "").toLowerCase().includes(search) ||
    (e.programTitle || "").toLowerCase().includes(search)
  );
  if (!entries.length) {
    list.innerHTML = `<div style="color:var(--muted);padding:0.6rem 0;">No history entries.</div>`;
    return;
  }
  list.innerHTML = entries.map(e => {
    const src = String(e.sourceType || "").toUpperCase();
    const date = e.savedAt ? new Date(e.savedAt).toLocaleDateString() : "";
    const pathShort = e.fileName || "";
    return `<div class="history-entry">
      <div class="history-entry-date">${escapeHtml(date)}</div>
      <div class="history-entry-meta">
        <div class="history-entry-title">${escapeHtml(e.episodeTitle || "Unknown episode")}</div>
        <div class="history-entry-program">${escapeHtml(e.programTitle || "")} · ${escapeHtml(src)}</div>
        ${pathShort ? `<div class="history-entry-path">${escapeHtml(pathShort)}</div>` : ""}
      </div>
    </div>`;
  }).join("");
}

document.getElementById("historySourceFilter")?.addEventListener("change", renderHistory);
document.getElementById("historySearchInput")?.addEventListener("input", renderHistory);
document.getElementById("historyClearBtn")?.addEventListener("click", async () => {
  if (!confirm("Clear all download history?")) return;
  await window.rteDownloader.clearDownloadHistory();
  historyAllEntries = [];
  renderHistory();
});

(async function bootstrap() {
  try {
    const savedTheme = localStorage.getItem("kimble_theme") || "dark";
    applyTheme(savedTheme);
    clearGlobalNowPlaying();
    try {
      state.canPickDownloadDirectory = Boolean(await window.rteDownloader.canPickDownloadDirectory());
    } catch {
      state.canPickDownloadDirectory = false;
    }
    updateDownloadDirPickerUi();
    setActiveTab("rte");
    scheduleBackfillCount.disabled = true;
    bbcScheduleBackfillCount.disabled = true;
    await loadSettings();
    if (typeof window.rteDownloader?.connectGlobalEvents === "function") {
      if ("Notification" in window) Notification.requestPermission().catch(() => {});
      window.rteDownloader.connectGlobalEvents((payload) => {
        if (payload?.type === "episode.downloaded" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`New episode: ${payload.title || ""}`, {
              body: payload.episodeTitle || `${(payload.source || "").toUpperCase()} download complete`
            });
          } catch {}
        }
      });
    }
    await Promise.all([loadLiveStations(), loadBbcLiveStations(), refreshSchedules(), refreshBbcSchedules()]);
    await refreshDownloadQueueSnapshot();
    if (queueRefreshTimer) {
      clearInterval(queueRefreshTimer);
    }
    queueRefreshTimer = setInterval(() => {
      refreshDownloadQueueSnapshot().catch(() => {});
    }, 1500);
    if (scheduleRefreshTimer) {
      clearInterval(scheduleRefreshTimer);
    }
    scheduleRefreshTimer = setInterval(() => {
      Promise.all([refreshSchedules(), refreshBbcSchedules()]).catch(() => {});
    }, 5000);
    setSettingsStatus("Loaded.");
    setQuickStatus("Ready");
    setBbcStatus("Ready");
  } catch (error) {
    setQuickStatus(error.message, true);
    setBbcStatus(error.message, true);
    setSettingsStatus(error.message, true);
  }
})();
