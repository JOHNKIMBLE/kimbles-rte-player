const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rteDownloader", {
  downloadFromPageUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-rte-url", { pageUrl, progressToken, ...(options || {}) }),
  downloadFromBbcUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-bbc-url", { pageUrl, progressToken, ...(options || {}) }),
  downloadFromWwfUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-wwf-url", { pageUrl, progressToken, ...(options || {}) }),
  downloadFromNtsUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-nts-url", { pageUrl, progressToken, ...(options || {}) }),
  downloadEpisode: (payload) => ipcRenderer.invoke("download-rte-episode", payload),
  onDownloadProgress: (handler) => {
    const listener = (_event, payload) => {
      handler(payload);
    };
    ipcRenderer.on("download-progress", listener);
    return () => ipcRenderer.removeListener("download-progress", listener);
  },
  connectGlobalEvents: (handler) => {
    const listener = (_event, payload) => {
      handler(payload);
    };
    ipcRenderer.on("global-event", listener);
    return () => ipcRenderer.removeListener("global-event", listener);
  },

  getLiveStations: () => ipcRenderer.invoke("rte-live-stations"),
  getLiveNow: (channelId) => ipcRenderer.invoke("rte-live-now", { channelId }),

  getProgramSummary: (programUrl) => ipcRenderer.invoke("rte-program-summary", { programUrl }),
  getProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("rte-program-episodes", { programUrl, page }),
  searchPrograms: (query) => ipcRenderer.invoke("rte-program-search", { query }),
  getRteDiscovery: (count) => ipcRenderer.invoke("rte-discovery", { count }),
  getBbcLiveStations: () => ipcRenderer.invoke("bbc-live-stations"),
  searchBbcPrograms: (query) => ipcRenderer.invoke("bbc-program-search", { query }),
  getBbcDiscovery: (count) => ipcRenderer.invoke("bbc-discovery", { count }),
  getBbcProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("bbc-program-episodes", { programUrl, page }),
  getBbcEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("bbc-episode-playlist", { episodeUrl }),
  getBbcEpisodeStream: (episodeUrl) => ipcRenderer.invoke("bbc-episode-stream", { episodeUrl }),
  getWwfLiveStations: () => ipcRenderer.invoke("wwf-live-stations"),
  getWwfLiveNow: () => ipcRenderer.invoke("wwf-live-now"),
  searchWwfPrograms: (query) => ipcRenderer.invoke("wwf-program-search", { query }),
  getWwfDiscovery: (count) => ipcRenderer.invoke("wwf-discovery", { count }),
  getWwfProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("wwf-program-episodes", { programUrl, page }),
  getWwfProgramSummary: (programUrl) => ipcRenderer.invoke("wwf-program-summary", { programUrl }),
  getWwfEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("wwf-episode-playlist", { episodeUrl }),
  getWwfEpisodeStream: (episodeUrl) => ipcRenderer.invoke("wwf-episode-stream", { episodeUrl }),
  getNtsLiveStations: () => ipcRenderer.invoke("nts-live-stations"),
  getNtsLiveNow: (channelId) => ipcRenderer.invoke("nts-live-now", { channelId }),
  searchNtsPrograms: (query, options) => ipcRenderer.invoke("nts-program-search", { query, options }),
  getNtsDiscovery: (count) => ipcRenderer.invoke("nts-discovery", { count }),
  getNtsProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("nts-program-episodes", { programUrl, page }),
  getNtsProgramSummary: (programUrl) => ipcRenderer.invoke("nts-program-summary", { programUrl }),
  getNtsEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("nts-episode-playlist", { episodeUrl }),
  getNtsEpisodeStream: (episodeUrl) => ipcRenderer.invoke("nts-episode-stream", { episodeUrl }),
  getEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("rte-episode-playlist", { episodeUrl }),
  getRteEpisodeStream: (clipId) => ipcRenderer.invoke("rte-episode-stream", { clipId }),
  getLocalPlaybackUrl: (outputDir, fileName) => ipcRenderer.invoke("local-playback-url", { outputDir, fileName }),
  getLocalCueChapters: (outputDir, fileName) => ipcRenderer.invoke("local-cue-chapters", { outputDir, fileName }),

  listSchedules: () => ipcRenderer.invoke("scheduler-list"),
  addSchedule: (programUrl, options = {}) => ipcRenderer.invoke("scheduler-add", { programUrl, options }),
  removeSchedule: (scheduleId) => ipcRenderer.invoke("scheduler-remove", { scheduleId }),
  setScheduleEnabled: (scheduleId, enabled) =>
    ipcRenderer.invoke("scheduler-set-enabled", { scheduleId, enabled }),
  runScheduleNow: (scheduleId) => ipcRenderer.invoke("scheduler-check-one", { scheduleId }),
  listBbcSchedules: () => ipcRenderer.invoke("bbc-scheduler-list"),
  addBbcSchedule: (programUrl, options = {}) => ipcRenderer.invoke("bbc-scheduler-add", { programUrl, options }),
  removeBbcSchedule: (scheduleId) => ipcRenderer.invoke("bbc-scheduler-remove", { scheduleId }),
  setBbcScheduleEnabled: (scheduleId, enabled) =>
    ipcRenderer.invoke("bbc-scheduler-set-enabled", { scheduleId, enabled }),
  runBbcScheduleNow: (scheduleId) => ipcRenderer.invoke("bbc-scheduler-check-one", { scheduleId }),
  listWwfSchedules: () => ipcRenderer.invoke("wwf-scheduler-list"),
  addWwfSchedule: (programUrl, options = {}) => ipcRenderer.invoke("wwf-scheduler-add", { programUrl, options }),
  removeWwfSchedule: (scheduleId) => ipcRenderer.invoke("wwf-scheduler-remove", { scheduleId }),
  setWwfScheduleEnabled: (scheduleId, enabled) =>
    ipcRenderer.invoke("wwf-scheduler-set-enabled", { scheduleId, enabled }),
  runWwfScheduleNow: (scheduleId) => ipcRenderer.invoke("wwf-scheduler-check-one", { scheduleId }),
  listNtsSchedules: () => ipcRenderer.invoke("nts-scheduler-list"),
  addNtsSchedule: (programUrl, options = {}) => ipcRenderer.invoke("nts-scheduler-add", { programUrl, options }),
  removeNtsSchedule: (scheduleId) => ipcRenderer.invoke("nts-scheduler-remove", { scheduleId }),
  setNtsScheduleEnabled: (scheduleId, enabled) =>
    ipcRenderer.invoke("nts-scheduler-set-enabled", { scheduleId, enabled }),
  runNtsScheduleNow: (scheduleId) => ipcRenderer.invoke("nts-scheduler-check-one", { scheduleId }),
  downloadFromFipUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-fip-url", { pageUrl, progressToken, ...(options || {}) }),
  getFipLiveStations: () => ipcRenderer.invoke("fip-live-stations"),
  getFipNowPlaying: (stationId) => ipcRenderer.invoke("fip-live-now", { stationId }),
  searchFipPrograms: (query) => ipcRenderer.invoke("fip-program-search", { query }),
  getFipDiscovery: (count) => ipcRenderer.invoke("fip-discovery", { count }),
  getFipProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("fip-program-episodes", { programUrl, page }),
  getFipProgramSummary: (programUrl) => ipcRenderer.invoke("fip-program-summary", { programUrl }),
  getFipEpisodeStream: (episodeUrl) => ipcRenderer.invoke("fip-episode-stream", { episodeUrl }),
  getFipEpisodeTracklist: (episodeUrl, startTsOrOptions, durationSecs) => {
    const options = startTsOrOptions && typeof startTsOrOptions === "object"
      ? startTsOrOptions
      : { startTs: startTsOrOptions, durationSecs };
    return ipcRenderer.invoke("fip-episode-tracklist", {
      episodeUrl,
      startTs: options.startTs,
      durationSecs: options.durationSecs
    });
  },
  listFipSchedules: () => ipcRenderer.invoke("fip-scheduler-list"),
  addFipSchedule: (programUrl, options = {}) => ipcRenderer.invoke("fip-scheduler-add", { programUrl, options }),
  removeFipSchedule: (scheduleId) => ipcRenderer.invoke("fip-scheduler-remove", { scheduleId }),
  setFipScheduleEnabled: (scheduleId, enabled) =>
    ipcRenderer.invoke("fip-scheduler-set-enabled", { scheduleId, enabled }),
  runFipScheduleNow: (scheduleId) => ipcRenderer.invoke("fip-scheduler-check-one", { scheduleId }),
  downloadFromKexpUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-kexp-url", { pageUrl, progressToken, ...(options || {}) }),
  downloadFromKexpExtendedUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-kexp-extended-url", { pageUrl, progressToken, ...(options || {}) }),
  downloadFromUrl: (source, pageUrl, progressToken, options = {}) => {
    if (source === "kexp-extended") return ipcRenderer.invoke("download-kexp-extended-url", { pageUrl, progressToken, ...(options || {}) });
    return ipcRenderer.invoke(`download-${source}-url`, { pageUrl, progressToken, ...(options || {}) });
  },
  getKexpLiveStations: () => ipcRenderer.invoke("kexp-live-stations"),
  getKexpNowPlaying: () => ipcRenderer.invoke("kexp-live-now"),
  searchKexpPrograms: (query) => ipcRenderer.invoke("kexp-program-search", { query }),
  getKexpDiscovery: (count) => ipcRenderer.invoke("kexp-discovery", { count }),
  getKexpProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("kexp-program-episodes", { programUrl, page }),
  getKexpProgramSummary: (programUrl) => ipcRenderer.invoke("kexp-program-summary", { programUrl }),
  getKexpEpisodeTracklist: (episodeUrl) => ipcRenderer.invoke("kexp-episode-tracklist", { episodeUrl }),
  getKexpEpisodeStream: (episodeUrl, startTime) => ipcRenderer.invoke("kexp-episode-stream", { episodeUrl, startTime }),
  getKexpSchedule: () => ipcRenderer.invoke("kexp-schedule"),
  // Extended archive (Splixer)
  searchKexpExtendedPrograms: (query) => ipcRenderer.invoke("kexp-extended-program-search", { query }),
  getKexpExtendedDiscovery: () => ipcRenderer.invoke("kexp-extended-discovery"),
  getKexpExtendedProgramSummary: (programUrl) => ipcRenderer.invoke("kexp-extended-program-summary", { programUrl }),
  getKexpExtendedProgramEpisodes: (programUrl, page = 1) => ipcRenderer.invoke("kexp-extended-program-episodes", { programUrl, page }),
  getKexpExtendedEpisodeStream: (episodeUrl) => ipcRenderer.invoke("kexp-extended-episode-stream", { episodeUrl }),
  getKexpExtendedEpisodeTracklist: (episodeUrl) => ipcRenderer.invoke("kexp-extended-episode-tracklist", { episodeUrl }),
  listKexpSchedules: () => ipcRenderer.invoke("kexp-scheduler-list"),
  addKexpSchedule: (programUrl, options = {}) => ipcRenderer.invoke("kexp-scheduler-add", { programUrl, options }),
  removeKexpSchedule: (scheduleId) => ipcRenderer.invoke("kexp-scheduler-remove", { scheduleId }),
  setKexpScheduleEnabled: (scheduleId, enabled) =>
    ipcRenderer.invoke("kexp-scheduler-set-enabled", { scheduleId, enabled }),
  runKexpScheduleNow: (scheduleId) => ipcRenderer.invoke("kexp-scheduler-check-one", { scheduleId }),
  listDownloadHistory: () => ipcRenderer.invoke("download-history-list"),
  clearDownloadHistory: () => ipcRenderer.invoke("download-history-clear"),
  listProgramFeeds: () => ipcRenderer.invoke("program-feeds-list"),
  searchMetadataIndex: (payload = {}) => ipcRenderer.invoke("metadata-search", payload || {}),
  searchEntityGraph: (payload = {}) => ipcRenderer.invoke("entity-graph-search", payload || {}),
  getEntityGraphEntity: (payload = {}) => ipcRenderer.invoke("entity-graph-detail", payload || {}),
  discoverMetadataIndex: (payload = {}) => ipcRenderer.invoke("metadata-discover", payload || {}),
  refreshMetadataHarvest: () => ipcRenderer.invoke("metadata-harvest-refresh"),
  refreshMetadataHarvestSource: (sourceType, options = {}) => ipcRenderer.invoke("metadata-harvest-refresh-source", {
    sourceType,
    deeper: Boolean(options?.deeper)
  }),
  listCollections: () => ipcRenderer.invoke("collections-list"),
  createCollection: (name) => ipcRenderer.invoke("collections-create", { name }),
  deleteCollection: (collectionId) => ipcRenderer.invoke("collections-delete", { collectionId }),
  addCollectionEntry: (collectionId, entry = {}) => ipcRenderer.invoke("collections-add-entry", { collectionId, entry }),
  addCollectionEntries: (collectionId, entries = []) => ipcRenderer.invoke("collections-add-entries", { collectionId, entries }),
  removeCollectionEntry: (collectionId, entryId) => ipcRenderer.invoke("collections-remove-entry", { collectionId, entryId }),
  getCollectionRecommendations: (payload = {}) => ipcRenderer.invoke("collections-recommendations", payload || {}),
  postprocessHistoryEntry: (payload = {}) => ipcRenderer.invoke("history-postprocess", payload || {}),
  getDiagnostics: () => ipcRenderer.invoke("diagnostics-get"),
  repairBinaries: () => ipcRenderer.invoke("diagnostics-repair"),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  generateCue: (payload) => ipcRenderer.invoke("cue-generate", payload || {}),
  previewCue: (payload) => ipcRenderer.invoke("cue-preview", payload || {}),
  getDownloadQueueStats: () => ipcRenderer.invoke("download-queue-stats"),
  getDownloadQueueSnapshot: () => ipcRenderer.invoke("download-queue-snapshot"),
  pauseDownloadQueue: () => ipcRenderer.invoke("download-queue-pause"),
  resumeDownloadQueue: () => ipcRenderer.invoke("download-queue-resume"),
  cancelDownloadQueueTask: (taskId) => ipcRenderer.invoke("download-queue-cancel", { taskId }),
  rerunDownloadQueueTask: (taskId, mode = "exact") => ipcRenderer.invoke("download-queue-rerun", { taskId, mode }),
  clearPendingDownloadQueue: () => ipcRenderer.invoke("download-queue-clear-pending"),
  getSettings: () => ipcRenderer.invoke("settings-get"),
  saveSettings: (payload) => ipcRenderer.invoke("settings-save", payload || {}),
  pickDownloadDirectory: (sourceType = "rte") => ipcRenderer.invoke("settings-pick-download-dir", { sourceType }),
  canPickDownloadDirectory: async () => true
});
