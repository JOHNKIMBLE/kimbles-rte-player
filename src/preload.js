const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rteDownloader", {
  downloadFromPageUrl: (pageUrl, progressToken) => ipcRenderer.invoke("download-rte-url", { pageUrl, progressToken }),
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
  getEpisodePlaylist: (episodeUrl) => ipcRenderer.invoke("rte-episode-playlist", { episodeUrl }),

  listSchedules: () => ipcRenderer.invoke("scheduler-list"),
  addSchedule: (programUrl, options = {}) => ipcRenderer.invoke("scheduler-add", { programUrl, options }),
  removeSchedule: (scheduleId) => ipcRenderer.invoke("scheduler-remove", { scheduleId }),
  setScheduleEnabled: (scheduleId, enabled) =>
    ipcRenderer.invoke("scheduler-set-enabled", { scheduleId, enabled }),
  runScheduleNow: (scheduleId) => ipcRenderer.invoke("scheduler-check-one", { scheduleId }),
  getSettings: () => ipcRenderer.invoke("settings-get"),
  saveSettings: (payload) => ipcRenderer.invoke("settings-save", payload || {}),
  pickDownloadDirectory: () => ipcRenderer.invoke("settings-pick-download-dir")
});
