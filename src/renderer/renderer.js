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
const bbcEpisodeFilterInput = document.getElementById("bbcEpisodeFilterInput");
const bbcPrevPageBtn = document.getElementById("bbcPrevPageBtn");
const bbcNextPageBtn = document.getElementById("bbcNextPageBtn");
const bbcEpisodesResult = document.getElementById("bbcEpisodesResult");
const bbcProgramSearchInput = document.getElementById("bbcProgramSearchInput");
const bbcProgramSearchBtn = document.getElementById("bbcProgramSearchBtn");
const bbcProgramSearchResult = document.getElementById("bbcProgramSearchResult");
const bbcProgramResultFilterInput = document.getElementById("bbcProgramResultFilterInput");
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
const wwfEpisodeFilterInput = document.getElementById("wwfEpisodeFilterInput");
const wwfPrevPageBtn = document.getElementById("wwfPrevPageBtn");
const wwfNextPageBtn = document.getElementById("wwfNextPageBtn");
const wwfEpisodesResult = document.getElementById("wwfEpisodesResult");
const wwfProgramSearchInput = document.getElementById("wwfProgramSearchInput");
const wwfProgramSearchBtn = document.getElementById("wwfProgramSearchBtn");
const wwfProgramSearchResult = document.getElementById("wwfProgramSearchResult");
const wwfProgramResultFilterInput = document.getElementById("wwfProgramResultFilterInput");
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
const fipEpisodeFilterInput = document.getElementById("fipEpisodeFilterInput");
const fipPrevPageBtn = document.getElementById("fipPrevPageBtn");
const fipNextPageBtn = document.getElementById("fipNextPageBtn");
const fipEpisodesResult = document.getElementById("fipEpisodesResult");
const fipProgramSearchInput = document.getElementById("fipProgramSearchInput");
const fipProgramSearchBtn = document.getElementById("fipProgramSearchBtn");
const fipProgramSearchResult = document.getElementById("fipProgramSearchResult");
const fipProgramResultFilterInput = document.getElementById("fipProgramResultFilterInput");
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
const kexpEpisodeFilterInput = document.getElementById("kexpEpisodeFilterInput");
const kexpPrevPageBtn = document.getElementById("kexpPrevPageBtn");
const kexpNextPageBtn = document.getElementById("kexpNextPageBtn");
const kexpEpisodesResult = document.getElementById("kexpEpisodesResult");
const kexpProgramSearchInput = document.getElementById("kexpProgramSearchInput");
const kexpProgramSearchBtn = document.getElementById("kexpProgramSearchBtn");
const kexpProgramSearchResult = document.getElementById("kexpProgramSearchResult");
const kexpProgramResultFilterInput = document.getElementById("kexpProgramResultFilterInput");
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
const ntsEpisodeFilterInput = document.getElementById("ntsEpisodeFilterInput");
const ntsPrevPageBtn = document.getElementById("ntsPrevPageBtn");
const ntsNextPageBtn = document.getElementById("ntsNextPageBtn");
const ntsEpisodesResult = document.getElementById("ntsEpisodesResult");
const ntsProgramSearchInput = document.getElementById("ntsProgramSearchInput");
const ntsProgramSearchBtn = document.getElementById("ntsProgramSearchBtn");
const ntsProgramSearchResult = document.getElementById("ntsProgramSearchResult");
const ntsProgramResultFilterInput = document.getElementById("ntsProgramResultFilterInput");
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
const programResultFilterInput = document.getElementById("programResultFilterInput");
const programUrlInput = document.getElementById("programUrlInput");
const loadProgramBtn = document.getElementById("loadProgramBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const addScheduleBtn = document.getElementById("addScheduleBtn");
const scheduleBackfillMode = document.getElementById("scheduleBackfillMode");
const scheduleBackfillCount = document.getElementById("scheduleBackfillCount");
const programMeta = document.getElementById("programMeta");
const episodeFilterInput = document.getElementById("episodeFilterInput");
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
const discordWebhookUrlInput = document.getElementById("discordWebhookUrlInput");
const ntfyTopicUrlInput = document.getElementById("ntfyTopicUrlInput");
const auddTrackMatchingCheckbox = document.getElementById("auddTrackMatchingCheckbox");
const auddApiTokenInput = document.getElementById("auddApiTokenInput");
const fingerprintTrackMatchingCheckbox = document.getElementById("fingerprintTrackMatchingCheckbox");
const acoustidApiKeyInput = document.getElementById("acoustidApiKeyInput");
const songrecTrackMatchingCheckbox = document.getElementById("songrecTrackMatchingCheckbox");
const songrecSampleSecondsInput = document.getElementById("songrecSampleSecondsInput");
const ffmpegCueSilenceCheckbox = document.getElementById("ffmpegCueSilenceCheckbox");
const ffmpegCueLoudnessCheckbox = document.getElementById("ffmpegCueLoudnessCheckbox");
const ffmpegCueSpectralCheckbox = document.getElementById("ffmpegCueSpectralCheckbox");
const downloadKeepLatestInput = document.getElementById("downloadKeepLatestInput");
const downloadDeleteOlderDaysInput = document.getElementById("downloadDeleteOlderDaysInput");
const skipRerunsCheckbox = document.getElementById("skipRerunsCheckbox");
const smartTagCleanupCheckbox = document.getElementById("smartTagCleanupCheckbox");
const programRuleSourceTypeInput = document.getElementById("programRuleSourceTypeInput");
const programRuleProgramTitleInput = document.getElementById("programRuleProgramTitleInput");
const programRuleProgramUrlInput = document.getElementById("programRuleProgramUrlInput");
const programRuleOutputDirInput = document.getElementById("programRuleOutputDirInput");
const programRulePathFormatInput = document.getElementById("programRulePathFormatInput");
const programRuleKeepLatestInput = document.getElementById("programRuleKeepLatestInput");
const programRuleDeleteOlderDaysInput = document.getElementById("programRuleDeleteOlderDaysInput");
const programRuleSkipRerunsCheckbox = document.getElementById("programRuleSkipRerunsCheckbox");
const programRuleEnabledCheckbox = document.getElementById("programRuleEnabledCheckbox");
const addProgramRuleBtn = document.getElementById("addProgramRuleBtn");
const resetProgramRuleBtn = document.getElementById("resetProgramRuleBtn");
const programRuleList = document.getElementById("programRuleList");
const downloadQueueStatus = document.getElementById("downloadQueueStatus");
const downloadQueueActive = document.getElementById("downloadQueueActive");
const downloadQueuePending = document.getElementById("downloadQueuePending");
const downloadQueueRecent = document.getElementById("downloadQueueRecent");
const queueMetrics = document.getElementById("queueMetrics");
const queueRecentSummary = document.getElementById("queueRecentSummary");
const queueRecentSourceFilter = document.getElementById("queueRecentSourceFilter");
const queueRecentStatusFilter = document.getElementById("queueRecentStatusFilter");
const queueRecentSearchInput = document.getElementById("queueRecentSearchInput");
const queueRecentPageSizeSelect = document.getElementById("queueRecentPageSizeSelect");
const queueRecentShowMoreBtn = document.getElementById("queueRecentShowMoreBtn");
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
const allSchedulesSummary = document.getElementById("allSchedulesSummary");
const allSchedulesMetrics = document.getElementById("allSchedulesMetrics");
const allSchedulesSearchInput = document.getElementById("allSchedulesSearchInput");
const allSchedulesViewMode = document.getElementById("allSchedulesViewMode");
const allSchedulesSourceFilter = document.getElementById("allSchedulesSourceFilter");
const allSchedulesStatusFilter = document.getElementById("allSchedulesStatusFilter");
const allSchedulesSort = document.getElementById("allSchedulesSort");
const refreshAllSchedulesBtn = document.getElementById("refreshAllSchedulesBtn");
const collectionsSummary = document.getElementById("collectionsSummary");
const collectionsMetrics = document.getElementById("collectionsMetrics");
const collectionsSelect = document.getElementById("collectionsSelect");
const collectionModeInput = document.getElementById("collectionModeInput");
const collectionNameInput = document.getElementById("collectionNameInput");
const collectionSmartQueryInput = document.getElementById("collectionSmartQueryInput");
const collectionSmartSourceFilter = document.getElementById("collectionSmartSourceFilter");
const collectionSmartKindFilter = document.getElementById("collectionSmartKindFilter");
const collectionSmartHostInput = document.getElementById("collectionSmartHostInput");
const collectionSmartGenreInput = document.getElementById("collectionSmartGenreInput");
const collectionSmartLocationInput = document.getElementById("collectionSmartLocationInput");
const collectionSmartLimitInput = document.getElementById("collectionSmartLimitInput");
const collectionAutoUpdateCheckbox = document.getElementById("collectionAutoUpdateCheckbox");
const createCollectionBtn = document.getElementById("createCollectionBtn");
const saveCollectionConfigBtn = document.getElementById("saveCollectionConfigBtn");
const refreshCollectionBtn = document.getElementById("refreshCollectionBtn");
const deleteCollectionBtn = document.getElementById("deleteCollectionBtn");
const collectionsList = document.getElementById("collectionsList");
const collectionsRecommendationsSummary = document.getElementById("collectionsRecommendationsSummary");
const collectionsRecommendationsMetrics = document.getElementById("collectionsRecommendationsMetrics");
const collectionsRecommendationsRefreshBtn = document.getElementById("collectionsRecommendationsRefreshBtn");
const collectionsRecommendationsList = document.getElementById("collectionsRecommendationsList");
const metadataIndexSaveAllBtn = document.getElementById("metadataIndexSaveAllBtn");
const metadataIndexSaveHostsBtn = document.getElementById("metadataIndexSaveHostsBtn");
const metadataIndexSaveEpisodesBtn = document.getElementById("metadataIndexSaveEpisodesBtn");
const metadataDiscoverySaveAllBtn = document.getElementById("metadataDiscoverySaveAllBtn");
const metadataDiscoverySaveHostsBtn = document.getElementById("metadataDiscoverySaveHostsBtn");
const metadataDiscoverySaveEpisodesBtn = document.getElementById("metadataDiscoverySaveEpisodesBtn");
const metadataRepairSummary = document.getElementById("metadataRepairSummary");
const metadataRepairFieldInput = document.getElementById("metadataRepairFieldInput");
const metadataRepairSourceTypeInput = document.getElementById("metadataRepairSourceTypeInput");
const metadataRepairFromInput = document.getElementById("metadataRepairFromInput");
const metadataRepairToInput = document.getElementById("metadataRepairToInput");
const metadataRepairAddBtn = document.getElementById("metadataRepairAddBtn");
const metadataRepairList = document.getElementById("metadataRepairList");
const entityGraphSummary = document.getElementById("entityGraphSummary");
const entityGraphMetrics = document.getElementById("entityGraphMetrics");
const entityGraphSourceFilter = document.getElementById("entityGraphSourceFilter");
const entityGraphTypeFilter = document.getElementById("entityGraphTypeFilter");
const entityGraphSearchInput = document.getElementById("entityGraphSearchInput");
const entityGraphRefreshBtn = document.getElementById("entityGraphRefreshBtn");
const entityGraphList = document.getElementById("entityGraphList");
const entityProfileSummary = document.getElementById("entityProfileSummary");
const entityProfileMetrics = document.getElementById("entityProfileMetrics");
const entityProfileCard = document.getElementById("entityProfileCard");
const entityProfileRecommendations = document.getElementById("entityProfileRecommendations");
const feedsList = document.getElementById("feedsList");
const feedsRefreshBtn = document.getElementById("feedsRefreshBtn");
const feedsOpenDirBtn = document.getElementById("feedsOpenDirBtn");
const feedsSummary = document.getElementById("feedsSummary");
const feedsMetrics = document.getElementById("feedsMetrics");
const feedsSourceFilter = document.getElementById("feedsSourceFilter");
const feedsSearchInput = document.getElementById("feedsSearchInput");
const historyList = document.getElementById("historyList");
const historySourceFilter = document.getElementById("historySourceFilter");
const historyProgramFilter = document.getElementById("historyProgramFilter");
const historyStatusFilter = document.getElementById("historyStatusFilter");
const historySearchInput = document.getElementById("historySearchInput");
const historySummary = document.getElementById("historySummary");
const historyMetrics = document.getElementById("historyMetrics");
const historyPageSizeSelect = document.getElementById("historyPageSizeSelect");
const historyShowMoreBtn = document.getElementById("historyShowMoreBtn");
const historyClearBtn = document.getElementById("historyClearBtn");
const metadataIndexHostFilter = document.getElementById("metadataIndexHostFilter");
const metadataIndexGenreFilter = document.getElementById("metadataIndexGenreFilter");
const metadataIndexLocationFilter = document.getElementById("metadataIndexLocationFilter");
const diagnosticsRefreshBtn = document.getElementById("diagnosticsRefreshBtn");
const diagnosticsRepairBtn = document.getElementById("diagnosticsRepairBtn");
const diagnosticsOpenDownloadDirBtn = document.getElementById("diagnosticsOpenDownloadDirBtn");
const diagnosticsOpenDataDirBtn = document.getElementById("diagnosticsOpenDataDirBtn");
const diagnosticsStatus = document.getElementById("diagnosticsStatus");
const diagnosticsHarvestSummary = document.getElementById("diagnosticsHarvestSummary");
const diagnosticsHarvestMetrics = document.getElementById("diagnosticsHarvestMetrics");
const diagnosticsHarvestSources = document.getElementById("diagnosticsHarvestSources");
const diagnosticsSourceHealth = document.getElementById("diagnosticsSourceHealth");
const diagnosticsRetryHistory = document.getElementById("diagnosticsRetryHistory");
const diagnosticsThinDocs = document.getElementById("diagnosticsThinDocs");
const diagnosticsThinDocDetails = document.getElementById("diagnosticsThinDocDetails");
const diagnosticsRuntime = document.getElementById("diagnosticsRuntime");
const diagnosticsBinaries = document.getElementById("diagnosticsBinaries");
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
const nowPlayingQueueSummary = document.getElementById("nowPlayingQueueSummary");
const nowPlayingAutoplayCheckbox = document.getElementById("nowPlayingAutoplayCheckbox");
const nowPlayingQueueClearBtn = document.getElementById("nowPlayingQueueClearBtn");
const nowPlayingQueueList = document.getElementById("nowPlayingQueueList");

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
  discordWebhookUrl: "",
  ntfyTopicUrl: "",
  auddTrackMatching: false,
  auddApiToken: "",
  fingerprintTrackMatching: false,
  acoustidApiKey: "",
  songrecTrackMatching: false,
  songrecSampleSeconds: 20,
  ffmpegCueSilenceDetect: true,
  ffmpegCueLoudnessDetect: true,
  ffmpegCueSpectralDetect: true,
  downloadKeepLatest: 0,
  downloadDeleteOlderDays: 0,
  skipReruns: false,
  smartTagCleanup: true,
  perProgramRules: [],
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
  libraryFeeds: [],
  diagnostics: null,
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
let playbackController = null;
let cueManager = null;
let appShell = null;
const coreHelpers = window.KimbleRendererCoreHelpers.create({
  dom: {
    quickResult,
    bbcResult,
    settingsStatus
  },
  documentRef: document
});
const {
  handleDownloadProgress,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  decodeHtmlEntities,
  escapeHtml,
  normalizeOutputFormatValue,
  setQuickStatus,
  setBbcStatus,
  setButtonBusy,
  setSettingsStatus,
  shouldArmForceRetry,
  formatCueAlignment,
  formatCueSource
} = coreHelpers;

window.rteDownloader.onDownloadProgress((payload) => {
  handleDownloadProgress(payload);
});


function setCachedChapters(sourceType, cacheKey, chapters) {
  return cueManager?.setCachedChapters(sourceType, cacheKey, chapters);
}

async function playEpisodeWithBackgroundCue({
  ...options
}) {
  return cueManager?.playEpisodeWithBackgroundCue(options);
}

async function playFromDownloadedFile({
  ...options
}) {
  return cueManager?.playFromDownloadedFile(options);
}

function clearGlobalNowPlaying() {
  return playbackController?.clearGlobalNowPlaying();
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
const sharedRendererUtils = window.KimbleRendererSharedUtils.create({
  state,
  documentRef: document,
  escapeHtml,
  setUrlParam
});
const {
  formatNtsTimeSlotLocal,
  formatLocalDateTime,
  localizeNextBroadcast,
  toLocalSchedule,
  setLiveOverlayTarget,
  buildBbcAutoplayCandidates,
  clearCueDebugLog,
  appendCueDebugLog,
  formatRunNowResult,
  formatDurationFromSeconds,
  parseRteDurationSeconds,
  renderSchedulerCard
} = sharedRendererUtils;

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

function setEpisodeChapters(clipId, chapters) {
  state.rteChaptersByClip[String(clipId || "")] = Array.isArray(chapters) ? chapters : [];
  const node = document.querySelector(`[data-episode-chapters="${clipId}"]`);
  if (!node) {
    return;
  }
  node.innerHTML = renderChapters(chapters);
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


const SOURCE_LABELS = { rte: "RTE", bbc: "BBC", wwf: "WWF", nts: "NTS", fip: "FIP", kexp: "KEXP" };
const libraryScreen = window.KimbleLibraryScreen.create({
  state,
  dom: {
    downloadQueueStatus,
    downloadQueueActive,
    downloadQueuePending,
    downloadQueueRecent,
    queueMetrics,
    queueRecentSummary,
    queueRecentSourceFilter,
    queueRecentStatusFilter,
    queueRecentSearchInput,
    queueRecentPageSizeSelect,
    queueRecentShowMoreBtn,
    queuePauseBtn,
    queueResumeBtn,
    queueClearBtn,
    collectionsSummary,
    collectionsMetrics,
    collectionsSelect,
    collectionModeInput,
    collectionNameInput,
    collectionSmartQueryInput,
    collectionSmartSourceFilter,
    collectionSmartKindFilter,
    collectionSmartHostInput,
    collectionSmartGenreInput,
    collectionSmartLocationInput,
    collectionSmartLimitInput,
    collectionAutoUpdateCheckbox,
    createCollectionBtn,
    saveCollectionConfigBtn,
    refreshCollectionBtn,
    deleteCollectionBtn,
    collectionsList,
    collectionsRecommendationsSummary,
    collectionsRecommendationsMetrics,
    collectionsRecommendationsRefreshBtn,
    collectionsRecommendationsList,
    feedsList,
    feedsRefreshBtn,
    feedsOpenDirBtn,
    feedsSummary,
    feedsMetrics,
    feedsSourceFilter,
    feedsSearchInput,
    metadataIndexList: document.getElementById("metadataIndexList"),
    metadataIndexSummary: document.getElementById("metadataIndexSummary"),
    metadataIndexMetrics: document.getElementById("metadataIndexMetrics"),
    metadataIndexSourceFilter: document.getElementById("metadataIndexSourceFilter"),
    metadataIndexKindFilter: document.getElementById("metadataIndexKindFilter"),
    metadataIndexSearchInput: document.getElementById("metadataIndexSearchInput"),
    metadataIndexHostFilter,
    metadataIndexGenreFilter,
    metadataIndexLocationFilter,
    metadataIndexSaveAllBtn,
    metadataIndexSaveHostsBtn,
    metadataIndexSaveEpisodesBtn,
    metadataHarvestRefreshBtn: document.getElementById("metadataHarvestRefreshBtn"),
    subscriptionDiscoveryRefreshBtn: document.getElementById("subscriptionDiscoveryRefreshBtn"),
    subscriptionDiscoverySummary: document.getElementById("subscriptionDiscoverySummary"),
    subscriptionDiscoveryList: document.getElementById("subscriptionDiscoveryList"),
    metadataDiscoveryRefreshBtn: document.getElementById("metadataDiscoveryRefreshBtn"),
    metadataDiscoverySaveAllBtn,
    metadataDiscoverySaveHostsBtn,
    metadataDiscoverySaveEpisodesBtn,
    metadataDiscoverySummary: document.getElementById("metadataDiscoverySummary"),
    metadataDiscoveryMetrics: document.getElementById("metadataDiscoveryMetrics"),
    metadataDiscoveryHosts: document.getElementById("metadataDiscoveryHosts"),
    metadataDiscoveryGenres: document.getElementById("metadataDiscoveryGenres"),
    metadataDiscoveryLocations: document.getElementById("metadataDiscoveryLocations"),
    metadataDiscoveryList: document.getElementById("metadataDiscoveryList"),
    metadataRepairSummary,
    metadataRepairFieldInput,
    metadataRepairSourceTypeInput,
    metadataRepairFromInput,
    metadataRepairToInput,
    metadataRepairAddBtn,
    metadataRepairList,
    entityGraphSummary,
    entityGraphMetrics,
    entityGraphSourceFilter,
    entityGraphTypeFilter,
    entityGraphSearchInput,
    entityGraphRefreshBtn,
    entityGraphList,
    entityProfileSummary,
    entityProfileMetrics,
    entityProfileCard,
    entityProfileRecommendations,
    historyList,
    historySourceFilter,
    historyProgramFilter,
    historyStatusFilter,
    historySearchInput,
    historySummary,
    historyMetrics,
    historyPageSizeSelect,
    historyShowMoreBtn,
    historyClearBtn,
    diagnosticsRefreshBtn,
    diagnosticsRepairBtn,
    diagnosticsOpenDownloadDirBtn,
    diagnosticsOpenDataDirBtn,
    diagnosticsStatus,
    diagnosticsHarvestSummary,
    diagnosticsHarvestMetrics,
    diagnosticsHarvestSources,
    diagnosticsSourceHealth,
    diagnosticsRetryHistory,
    diagnosticsThinDocs,
    diagnosticsThinDocDetails,
    diagnosticsRuntime,
    diagnosticsBinaries
  },
  escapeHtml,
  formatLocalDateTime,
  createProgressToken,
  setSettingsStatus,
  setButtonBusy,
  playFromDownloadedFile,
  queueDownloadedFile: (item) => playbackController?.enqueueQueueItem?.(item),
  sourceLabels: SOURCE_LABELS,
  openProgramExplorer: (target) => appShell?.openProgramExplorer?.(target),
  activateLibraryView: (sectionId = "") => {
    appShell?.setActiveTab?.("schedules");
    window.requestAnimationFrame(() => {
      if (sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
});
const schedulesScreen = window.KimbleSchedulesScreen.create({
  dom: {
    healthGrid: document.getElementById("healthGrid"),
    allSchedulesList,
    allSchedulesSummary,
    allSchedulesMetrics,
    allSchedulesSearchInput,
    allSchedulesViewMode,
    allSchedulesSourceFilter,
    allSchedulesStatusFilter,
    allSchedulesSort,
    refreshAllSchedulesBtn
  },
  escapeHtml,
  renderSchedulerCard,
  playFromDownloadedFile,
  sourceLabels: SOURCE_LABELS,
  openProgramExplorer: (target) => appShell?.openProgramExplorer?.(target),
  onHealthSourceNavigate: (sourceKey) => {
    if (allSchedulesSourceFilter) {
      allSchedulesSourceFilter.value = sourceKey;
    }
    appShell?.setActiveTab?.("schedules");
    window.requestAnimationFrame(() => {
      document.getElementById("subscriptionsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
});
const settingsScreen = window.KimbleSettingsScreen.create({
  state,
  dom: {
    timeFormatSelect,
    downloadDirInput,
    pathFormatInput,
    pathFormatPreview,
    pathFormatPresetsRow,
    cueAutoGenerateCheckbox,
    outputFormatSelect,
    outputQualitySelect,
    normalizeLoudnessCheckbox,
    maxConcurrentInput,
    dedupeModeSelect,
    id3TaggingCheckbox,
    feedExportCheckbox,
    webhookUrlInput,
    discordWebhookUrlInput,
    ntfyTopicUrlInput,
    auddTrackMatchingCheckbox,
    auddApiTokenInput,
    fingerprintTrackMatchingCheckbox,
    acoustidApiKeyInput,
    songrecTrackMatchingCheckbox,
    songrecSampleSecondsInput,
    ffmpegCueSilenceCheckbox,
    ffmpegCueLoudnessCheckbox,
    ffmpegCueSpectralCheckbox,
    downloadKeepLatestInput,
    downloadDeleteOlderDaysInput,
    skipRerunsCheckbox,
    smartTagCleanupCheckbox,
    programRuleSourceTypeInput,
    programRuleProgramTitleInput,
    programRuleProgramUrlInput,
    programRuleOutputDirInput,
    programRulePathFormatInput,
    programRuleKeepLatestInput,
    programRuleDeleteOlderDaysInput,
    programRuleSkipRerunsCheckbox,
    programRuleEnabledCheckbox,
    addProgramRuleBtn,
    resetProgramRuleBtn,
    programRuleList,
    chooseDownloadDirBtn,
    saveSettingsBtn,
    episodesPerPageInput,
    discoveryCountInput
  },
  normalizeOutputFormatValue,
  setButtonBusy,
  setSettingsStatus,
  getActiveDownloadDir,
  setActiveDownloadDir,
  parseReleaseDate,
  refreshTimeBasedUi: () => appShell?.refreshTimeBasedUi?.(),
  defaultEpisodesPerPage: DEFAULT_EPISODES_PER_PAGE,
  defaultDiscoveryCount: DEFAULT_DISCOVERY_COUNT
});
const rteScreen = window.KimbleRteScreen.create({
  state,
  dom: {
    programSearchBtn,
    programSearchInput,
    programSearchResult,
    programResultFilterInput,
    discoverBtn: rteDiscoverBtn,
    discoveryResult: rteDiscoveryResult,
    programUrlInput,
    loadProgramBtn,
    prevPageBtn,
    nextPageBtn,
    addScheduleBtn,
    scheduleBackfillMode,
    scheduleBackfillCount,
    programMeta,
    episodeFilterInput,
    episodesResult,
    scheduleList
  },
  escapeHtml,
  setButtonBusy,
  toLocalSchedule,
  localizeNextBroadcast,
  getEpisodesPerPage,
  getDiscoveryCount,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  playEpisodeWithBackgroundCue,
  parseRteDurationSeconds,
  clearCueDebugLog,
  appendCueDebugLog,
  formatCueSource,
  formatCueAlignment,
  shouldArmForceRetry,
  renderSchedulerCard,
  playFromDownloadedFile,
  formatRunNowResult,
  setEpisodeChapters,
  setSettingsStatus,
  autoLoadVisiblePlaylists
});
const bbcScreen = window.KimbleBbcScreen.create({
  state,
  dom: {
    urlInput: bbcUrlInput,
    downloadBtn: bbcDownloadBtn,
    log: bbcLog,
    programSearchBtn: bbcProgramSearchBtn,
    programSearchInput: bbcProgramSearchInput,
    programSearchResult: bbcProgramSearchResult,
    programResultFilterInput: bbcProgramResultFilterInput,
    discoverBtn: bbcDiscoverBtn,
    discoveryResult: bbcDiscoveryResult,
    programUrlInput: bbcProgramUrlInput,
    loadProgramBtn: bbcLoadProgramBtn,
    prevPageBtn: bbcPrevPageBtn,
    nextPageBtn: bbcNextPageBtn,
    addScheduleBtn: bbcAddScheduleBtn,
    scheduleBackfillMode: bbcScheduleBackfillMode,
    scheduleBackfillCount: bbcScheduleBackfillCount,
    programMeta: bbcProgramMeta,
    episodeFilterInput: bbcEpisodeFilterInput,
    episodesResult: bbcEpisodesResult,
    scheduleList: bbcScheduleList,
    stationSelect: bbcStationSelect,
    refreshLiveBtn: bbcRefreshLiveBtn,
    liveNow: bbcLiveNow,
    livePlayerFrame: bbcLivePlayerFrame,
    liveOverlayPlayBtn: bbcLiveOverlayPlayBtn
  },
  escapeHtml,
  setButtonBusy,
  toLocalSchedule,
  localizeNextBroadcast,
  getEpisodesPerPage,
  getDiscoveryCount,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  playEpisodeWithBackgroundCue,
  clearCueDebugLog,
  appendCueDebugLog,
  formatCueSource,
  formatCueAlignment,
  shouldArmForceRetry,
  renderSchedulerCard,
  renderBbcShowCard,
  renderPlaylistTracks,
  renderChapters,
  formatDurationFromSeconds,
  playFromDownloadedFile,
  formatRunNowResult,
  setSettingsStatus,
  setBbcStatus,
  setLiveOverlayTarget,
  buildBbcAutoplayCandidates,
  setUrlParam
});
const wwfScreen = window.KimbleWwfScreen.create({
  state,
  dom: {
    stationSelect: wwfStationSelect,
    refreshLiveBtn: wwfRefreshLiveBtn,
    liveNow: wwfLiveNow,
    liveAudio: document.getElementById("wwfLiveAudio"),
    liveAudioWrap: document.querySelector(".wwf-live-audio-wrap"),
    urlInput: wwfUrlInput,
    downloadBtn: wwfDownloadBtn,
    result: wwfResult,
    programUrlInput: wwfProgramUrlInput,
    loadProgramBtn: wwfLoadProgramBtn,
    programMeta: wwfProgramMeta,
    episodeFilterInput: wwfEpisodeFilterInput,
    prevPageBtn: wwfPrevPageBtn,
    nextPageBtn: wwfNextPageBtn,
    episodesResult: wwfEpisodesResult,
    programSearchInput: wwfProgramSearchInput,
    programSearchBtn: wwfProgramSearchBtn,
    programSearchResult: wwfProgramSearchResult,
    programResultFilterInput: wwfProgramResultFilterInput,
    addScheduleBtn: wwfAddScheduleBtn,
    scheduleBackfillMode: wwfScheduleBackfillMode,
    scheduleBackfillCount: wwfScheduleBackfillCount,
    discoverBtn: wwfDiscoverBtn,
    discoveryResult: wwfDiscoveryResult,
    scheduleList: wwfScheduleList
  },
  escapeHtml,
  setButtonBusy,
  toLocalSchedule,
  localizeNextBroadcast,
  getEpisodesPerPage,
  getDiscoveryCount,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  playEpisodeWithBackgroundCue,
  clearCueDebugLog,
  appendCueDebugLog,
  formatCueSource,
  formatCueAlignment,
  renderSchedulerCard,
  renderPlaylistTracks,
  playFromDownloadedFile,
  formatNtsTimeSlotLocal,
  shouldArmForceRetry
});
const ntsScreen = window.KimbleNtsScreen.create({
  state,
  dom: {
    stationSelect: ntsStationSelect,
    refreshLiveBtn: ntsRefreshLiveBtn,
    liveNow: ntsLiveNow,
    liveAudio: ntsLiveAudio,
    urlInput: ntsUrlInput,
    downloadBtn: ntsDownloadBtn,
    result: ntsResult,
    log: document.getElementById("ntsLog"),
    programUrlInput: ntsProgramUrlInput,
    loadProgramBtn: ntsLoadProgramBtn,
    programMeta: ntsProgramMeta,
    episodeFilterInput: ntsEpisodeFilterInput,
    prevPageBtn: ntsPrevPageBtn,
    nextPageBtn: ntsNextPageBtn,
    episodesResult: ntsEpisodesResult,
    programSearchInput: ntsProgramSearchInput,
    programSearchBtn: ntsProgramSearchBtn,
    programSearchResult: ntsProgramSearchResult,
    programResultFilterInput: ntsProgramResultFilterInput,
    addScheduleBtn: ntsAddScheduleBtn,
    scheduleBackfillMode: ntsScheduleBackfillMode,
    scheduleBackfillCount: ntsScheduleBackfillCount,
    discoverBtn: ntsDiscoverBtn,
    discoveryResult: ntsDiscoveryResult,
    scheduleList: ntsScheduleList
  },
  escapeHtml,
  setButtonBusy,
  toLocalSchedule,
  localizeNextBroadcast,
  getEpisodesPerPage,
  getDiscoveryCount,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  playEpisodeWithBackgroundCue,
  clearCueDebugLog,
  appendCueDebugLog,
  formatCueSource,
  formatCueAlignment,
  renderSchedulerCard,
  renderPlaylistTracks,
  playFromDownloadedFile,
  formatNtsTimeSlotLocal,
  setCachedChapters,
  shouldArmForceRetry
});
const fipScreen = window.KimbleFipScreen.create({
  state,
  dom: {
    stationSelect: fipStationSelect,
    refreshLiveBtn: fipRefreshLiveBtn,
    liveNow: fipLiveNow,
    liveAudio: fipLiveAudio,
    liveAudioWrap: fipLiveAudioWrap,
    urlInput: fipUrlInput,
    downloadBtn: fipDownloadBtn,
    result: fipResult,
    log: document.createElement("pre"),
    programUrlInput: fipProgramUrlInput,
    loadProgramBtn: fipLoadProgramBtn,
    programMeta: fipProgramMeta,
    episodeFilterInput: fipEpisodeFilterInput,
    prevPageBtn: fipPrevPageBtn,
    nextPageBtn: fipNextPageBtn,
    episodesResult: fipEpisodesResult,
    programSearchInput: fipProgramSearchInput,
    programSearchBtn: fipProgramSearchBtn,
    programSearchResult: fipProgramSearchResult,
    programResultFilterInput: fipProgramResultFilterInput,
    addScheduleBtn: fipAddScheduleBtn,
    scheduleBackfillMode: fipScheduleBackfillMode,
    scheduleBackfillCount: fipScheduleBackfillCount,
    discoverBtn: fipDiscoverBtn,
    discoveryResult: fipDiscoveryResult,
    scheduleList: fipScheduleList
  },
  escapeHtml,
  setButtonBusy,
  getEpisodesPerPage,
  getDiscoveryCount,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  playEpisodeWithBackgroundCue,
  clearCueDebugLog,
  appendCueDebugLog,
  formatCueSource,
  formatCueAlignment,
  renderSchedulerCard,
  renderPlaylistTracks,
  playFromDownloadedFile,
  shouldArmForceRetry
});
const kexpScreen = window.KimbleKexpScreen.create({
  state,
  dom: {
    liveNow: kexpLiveNow,
    liveInfo: kexpLiveInfo,
    liveAudio: kexpLiveAudio,
    liveAudioWrap: kexpLiveAudioWrap,
    urlInput: kexpUrlInput,
    downloadBtn: kexpDownloadBtn,
    result: kexpResult,
    programUrlInput: kexpProgramUrlInput,
    loadProgramBtn: kexpLoadProgramBtn,
    programMeta: kexpProgramMeta,
    episodeFilterInput: kexpEpisodeFilterInput,
    prevPageBtn: kexpPrevPageBtn,
    nextPageBtn: kexpNextPageBtn,
    episodesResult: kexpEpisodesResult,
    programSearchInput: kexpProgramSearchInput,
    programSearchBtn: kexpProgramSearchBtn,
    programSearchResult: kexpProgramSearchResult,
    programResultFilterInput: kexpProgramResultFilterInput,
    addScheduleBtn: kexpAddScheduleBtn,
    scheduleBackfillMode: kexpScheduleBackfillMode,
    scheduleBackfillCount: kexpScheduleBackfillCount,
    discoverBtn: kexpDiscoverBtn,
    discoveryResult: kexpDiscoveryResult,
    scheduleList: kexpScheduleList,
    extSearchInput: kexpExtSearchInput,
    extSearchBtn: kexpExtSearchBtn,
    extDiscoverBtn: kexpExtDiscoverBtn,
    extSearchResult: kexpExtSearchResult,
    extProgramMeta: kexpExtProgramMeta,
    extPaginationRow: kexpExtPaginationRow,
    extPrevPageBtn: kexpExtPrevPageBtn,
    extNextPageBtn: kexpExtNextPageBtn,
    extEpisodesResult: kexpExtEpisodesResult
  },
  escapeHtml,
  setButtonBusy,
  getEpisodesPerPage,
  getDiscoveryCount,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  playEpisodeWithBackgroundCue,
  clearCueDebugLog,
  appendCueDebugLog,
  formatCueSource,
  formatCueAlignment,
  renderSchedulerCard,
  renderPlaylistTracks,
  playFromDownloadedFile,
  formatDurationFromSeconds,
  setCachedChapters,
  shouldArmForceRetry
});
playbackController = window.KimblePlaybackController.create({
  dom: {
    bar: nowPlayingBar,
    title: nowPlayingTitle,
    meta: nowPlayingMeta,
    track: nowPlayingTrack,
    image: nowPlayingImage,
    audio: nowPlayingAudio,
    closeBtn: nowPlayingCloseBtn,
    chapterControls: nowPlayingChapterControls,
    prevChapterBtn: nowPlayingPrevChapterBtn,
    nextChapterBtn: nowPlayingNextChapterBtn,
    resumeBtn: nowPlayingResumeBtn,
    queueSummary: nowPlayingQueueSummary,
    autoplayCheckbox: nowPlayingAutoplayCheckbox,
    queueClearBtn: nowPlayingQueueClearBtn,
    queueList: nowPlayingQueueList
  },
  normalizeChapters,
  normalizeTracks,
  estimateChaptersFromTracks,
  formatDurationFromSeconds,
  setSettingsStatus,
  playQueuedItem: async (item) => {
    if (String(item?.mode || "local").trim().toLowerCase() === "episode") {
      return playEpisodeWithBackgroundCue({
        sourceType: item.sourceType || "",
        cacheKey: item.cacheKey || item.episodeUrl || item.streamUrl || "",
        sourceLabel: item.sourceLabel || item.source || "Queue",
        title: item.title || "Episode",
        programTitle: item.programTitle || "",
        subtitle: item.subtitle || "",
        image: item.image || "",
        episodeUrl: item.episodeUrl || "",
        durationSeconds: Number(item.durationSeconds || 0) || 0,
        streamUrl: item.streamUrl || "",
        playbackKey: item.playbackKey || `${item.sourceType || "episode"}:queued:${item.episodeUrl || item.streamUrl || ""}`
      });
    }
    return playFromDownloadedFile({
      outputDir: item.outputDir,
      fileName: item.fileName,
      title: item.title || item.fileName || "",
      source: item.source || "Queue",
      subtitle: item.subtitle || "",
      image: item.image || "",
      episodeUrl: item.episodeUrl || "",
      sourceType: item.sourceType || ""
    });
  },
  onPlaybackStarted: (playbackKey) => {
    const key = String(playbackKey || "");
    if (key.startsWith("wwf:remote:")) {
      const episodeUrl = key.slice("wwf:remote:".length);
      if (episodeUrl) {
        setWwfEpisodeStatus(episodeUrl, "");
      }
    }
  },
  onListenProgress: (payload) => {
    if (typeof window.rteDownloader?.reportListenProgress !== "function") {
      return;
    }
    return window.rteDownloader.reportListenProgress(payload);
  }
});
cueManager = window.KimbleCueManager.create({
  state,
  windowRef: window,
  documentRef: document,
  playbackController,
  normalizeTracks,
  normalizeChapters,
  estimateChaptersFromTracks,
  renderChapters,
  createProgressToken,
  attachDownloadProgress,
  formatProgressText,
  clearCueDebugLog,
  appendCueDebugLog,
  formatCueSource,
  formatCueAlignment,
  setSettingsStatus,
  setRteEpisodeChapters: setEpisodeChapters,
  setFipEpisodeChapters: (episodeUrl, chapters) => fipScreen.setEpisodeChapters(episodeUrl, chapters)
});

function setWwfEpisodeStatus(episodeUrl, text, isError = false) {
  return wwfScreen.setEpisodeStatus(episodeUrl, text, isError);
}

function renderBbcShowCard(r, { showScheduleBtn = false } = {}) {
  const hosts = Array.isArray(r.hosts)
    ? r.hosts.map((host) => String(host || "").trim()).filter(Boolean)
    : String(r.hosts || "").split(/,\s*/g).map((host) => host.trim()).filter(Boolean);
  const location = String(r.location || "").trim();
  const genresHtml = Array.isArray(r.genres) && r.genres.length
    ? `<div class="genre-pills">${r.genres.map((g) => `<span class="genre-pill">${escapeHtml(g)}</span>`).join("")}</div>`
    : "";
  const cadenceLabel = r.cadence && r.cadence !== "irregular" && r.cadence !== "unknown"
    ? `${r.cadence.charAt(0).toUpperCase()}${r.cadence.slice(1)}`
    : "";
  const desc = String(r.description || "").trim();
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
        ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
        ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
        ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "..." : ""}</div>` : ""}
        ${genresHtml}
        ${schedBtn}
      </div>
    </div>
  </div>`;
}
appShell = window.KimbleAppShell.create({
  state,
  dom: {
    quickUrlInput,
    quickDownloadBtn,
    quickLog,
    stationSelect,
    refreshLiveBtn,
    liveNow,
    livePlayerFrame,
    liveOverlayPlayBtn,
    tabRteBtn,
    tabBbcBtn,
    tabWwfBtn,
    tabNtsBtn,
    tabFipBtn,
    tabKexpBtn,
    tabSchedulesBtn,
    tabSettingsBtn,
    themeToggleBtn,
    scheduleBackfillMode,
    scheduleBackfillCount,
    bbcScheduleBackfillCount,
    downloadDirInput,
    rteTabContent,
    bbcTabContent,
    wwfTabContent,
    ntsTabContent,
    fipTabContent,
    kexpTabContent,
    schedulesTabContent,
    settingsTabContent,
    wwfStationSelect,
    ntsStationSelect,
    ntsLiveAudio,
    fipStationSelect
  },
  escapeHtml,
  setButtonBusy,
  setQuickStatus,
  setBbcStatus,
  setSettingsStatus,
  shouldArmForceRetry,
  formatCueAlignment,
  formatProgressText,
  createProgressToken,
  attachDownloadProgress,
  setUrlParam,
  applyTheme,
  getActiveDownloadDir,
  renderPathFormatPreview: () => settingsScreen.renderPathFormatPreview(),
  updateDownloadDirPickerUi: () => settingsScreen.updateDownloadDirPickerUi(),
  clearGlobalNowPlaying,
  documentRef: document,
  windowRef: window,
  localStorageRef: localStorage,
  actions: {
    loadFeeds: () => libraryScreen.loadFeeds(),
    loadDiagnostics: () => libraryScreen.loadDiagnostics(),
    refreshLibraryData: () => libraryScreen.refreshLibraryData(),
    loadHistory: () => libraryScreen.loadHistory(),
    renderAllSchedules: () => schedulesScreen.renderAllSchedules(),
    loadSettings: () => settingsScreen.loadSettings(),
    refreshDownloadQueueSnapshot: () => libraryScreen.refreshDownloadQueueSnapshot(),
    hideSearchDropdown: () => rteScreen.hideSearchDropdown(),
    hideBbcSearchDropdown: () => bbcScreen.hideSearchDropdown(),
    loadProgram: (programUrl, page = 1) => rteScreen.loadProgram(programUrl, page),
    loadBbcProgram: (programUrl, page = 1) => bbcScreen.loadProgram(programUrl, page),
    loadWwfProgram: (programUrl, page = 1) => wwfScreen.loadProgram(programUrl, page),
    loadNtsProgram: (programUrl, page = 1) => ntsScreen.loadProgram(programUrl, page),
    loadFipProgram: (programUrl, page = 1) => fipScreen.loadProgram(programUrl, page),
    loadKexpProgram: (programUrl, page = 1) => kexpScreen.loadProgram(programUrl, page),
    loadKexpExtendedProgram: (programUrl, page = 1) => kexpScreen.loadExtendedProgram(programUrl, page),
    refreshSchedules: () => rteScreen.refreshSchedules(),
    refreshBbcSchedules: () => bbcScreen.refreshSchedules(),
    loadBbcLiveStations: () => bbcScreen.loadLiveStations(),
    refreshWwfLiveNow: () => wwfScreen.refreshLiveNow(),
    renderWwfScheduleList: () => wwfScreen.refreshSchedules(),
    refreshNtsLiveNow: () => ntsScreen.refreshLiveNow(),
    renderNtsScheduleList: () => ntsScreen.refreshSchedules(),
    refreshFipLiveNow: () => fipScreen.refreshLiveNow(),
    renderFipScheduleList: () => fipScreen.refreshSchedules(),
    refreshKexpLiveNow: () => kexpScreen.refreshLiveNow(),
    renderKexpScheduleList: () => kexpScreen.refreshSchedules()
  }
});
appShell.bindEvents();
appShell.bootstrap().catch(() => {});
