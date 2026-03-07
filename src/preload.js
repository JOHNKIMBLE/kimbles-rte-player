const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rteDownloader", {
  downloadFromPageUrl: (pageUrl, progressToken) => ipcRenderer.invoke("download-rte-url", { pageUrl, progressToken }),
  downloadFromBbcUrl: (pageUrl, progressToken, options = {}) =>
    ipcRenderer.invoke("download-bbc-url", { pageUrl, progressToken, ...(options || {}) }),
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
  getEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("rte-episode-playlist", { episodeUrl }),

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
  getSettings: () => ipcRenderer.invoke("settings-get"),
  saveSettings: (payload) => ipcRenderer.invoke("settings-save", payload || {}),
  pickDownloadDirectory: (sourceType = "rte") => ipcRenderer.invoke("settings-pick-download-dir", { sourceType })
});
