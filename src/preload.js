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

  getLiveStations: () => ipcRenderer.invoke("rte-live-stations"),
  getLiveNow: (channelId) => ipcRenderer.invoke("rte-live-now", { channelId }),

  getProgramSummary: (programUrl) => ipcRenderer.invoke("rte-program-summary", { programUrl }),
  getProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("rte-program-episodes", { programUrl, page }),
  searchPrograms: (query) => ipcRenderer.invoke("rte-program-search", { query }),
  getBbcLiveStations: () => ipcRenderer.invoke("bbc-live-stations"),
  searchBbcPrograms: (query) => ipcRenderer.invoke("bbc-program-search", { query }),
  getBbcProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("bbc-program-episodes", { programUrl, page }),
  getBbcEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("bbc-episode-playlist", { episodeUrl }),
  getBbcEpisodeStream: (episodeUrl) => ipcRenderer.invoke("bbc-episode-stream", { episodeUrl }),
  getWwfLiveStations: () => ipcRenderer.invoke("wwf-live-stations"),
  getWwfLiveNow: () => ipcRenderer.invoke("wwf-live-now"),
  searchWwfPrograms: (query) => ipcRenderer.invoke("wwf-program-search", { query }),
  getWwfProgramEpisodes: (programUrl, page = 1) =>
    ipcRenderer.invoke("wwf-program-episodes", { programUrl, page }),
  getWwfProgramSummary: (programUrl) => ipcRenderer.invoke("wwf-program-summary", { programUrl }),
  getWwfEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("wwf-episode-playlist", { episodeUrl }),
  getWwfEpisodeStream: (episodeUrl) => ipcRenderer.invoke("wwf-episode-stream", { episodeUrl }),
  getNtsLiveStations: () => ipcRenderer.invoke("nts-live-stations"),
  getNtsLiveNow: (channelId) => ipcRenderer.invoke("nts-live-now", { channelId }),
  searchNtsPrograms: (query, options) => ipcRenderer.invoke("nts-program-search", { query, options }),
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
  generateCue: (payload) => ipcRenderer.invoke("cue-generate", payload || {}),
  previewCue: (payload) => ipcRenderer.invoke("cue-preview", payload || {}),
  getDownloadQueueStats: () => ipcRenderer.invoke("download-queue-stats"),
  getDownloadQueueSnapshot: () => ipcRenderer.invoke("download-queue-snapshot"),
  pauseDownloadQueue: () => ipcRenderer.invoke("download-queue-pause"),
  resumeDownloadQueue: () => ipcRenderer.invoke("download-queue-resume"),
  cancelDownloadQueueTask: (taskId) => ipcRenderer.invoke("download-queue-cancel", { taskId }),
  clearPendingDownloadQueue: () => ipcRenderer.invoke("download-queue-clear-pending"),
  getSettings: () => ipcRenderer.invoke("settings-get"),
  saveSettings: (payload) => ipcRenderer.invoke("settings-save", payload || {}),
  pickDownloadDirectory: (sourceType = "rte") => ipcRenderer.invoke("settings-pick-download-dir", { sourceType }),
  canPickDownloadDirectory: async () => true
});
