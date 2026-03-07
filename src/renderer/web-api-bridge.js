(function initWebApiBridge() {
  if (window.rteDownloader) {
    return;
  }

  const progressListeners = new Set();
  const progressStreams = new Map();

  function emitProgress(payload) {
    for (const listener of progressListeners) {
      try {
        listener(payload);
      } catch {}
    }
  }

  function openProgressStream(token) {
    if (!token || progressStreams.has(token)) {
      return;
    }

    const source = new EventSource(`/api/progress/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        emitProgress(payload);
      } catch {}
    };
    source.onerror = () => {
      source.close();
      progressStreams.delete(token);
    };
    progressStreams.set(token, source);
  }

  function closeProgressStream(token) {
    const source = progressStreams.get(token);
    if (!source) {
      return;
    }
    source.close();
    progressStreams.delete(token);
  }

  const API = {
    async getJson(path) {
      const response = await fetch(path, { headers: { Accept: "application/json" } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Request failed: ${response.status}`);
      }
      return body;
    },

    async sendJson(path, method, payload) {
      const response = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload || {})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Request failed: ${response.status}`);
      }
      return body;
    }
  };

  const defaultSettings = {
    timeFormat: "24h",
    rteDownloadDir: "/downloads/RTE",
    bbcDownloadDir: "/downloads/BBC",
    episodeNameMode: "date-only"
  };

  function loadWebSettings() {
    try {
      const raw = localStorage.getItem("rte_web_settings");
      if (!raw) {
        return { ...defaultSettings };
      }
      const parsed = JSON.parse(raw);
      return {
        timeFormat: parsed.timeFormat === "12h" ? "12h" : "24h",
        rteDownloadDir: typeof parsed.rteDownloadDir === "string" && parsed.rteDownloadDir.trim()
          ? parsed.rteDownloadDir.trim()
          : (typeof parsed.downloadDir === "string" && parsed.downloadDir.trim()
            ? parsed.downloadDir.trim()
            : defaultSettings.rteDownloadDir),
        bbcDownloadDir: typeof parsed.bbcDownloadDir === "string" && parsed.bbcDownloadDir.trim()
          ? parsed.bbcDownloadDir.trim()
          : defaultSettings.bbcDownloadDir,
        episodeNameMode: parsed.episodeNameMode === "full-title" ? "full-title" : "date-only"
      };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveWebSettings(input) {
    const current = loadWebSettings();
    const next = {
      ...current,
      ...(input || {})
    };
    const normalized = {
      timeFormat: next.timeFormat === "12h" ? "12h" : "24h",
      rteDownloadDir: typeof next.rteDownloadDir === "string" && next.rteDownloadDir.trim()
        ? next.rteDownloadDir.trim()
        : defaultSettings.rteDownloadDir,
      bbcDownloadDir: typeof next.bbcDownloadDir === "string" && next.bbcDownloadDir.trim()
        ? next.bbcDownloadDir.trim()
        : defaultSettings.bbcDownloadDir,
      episodeNameMode: next.episodeNameMode === "full-title" ? "full-title" : "date-only"
    };
    localStorage.setItem("rte_web_settings", JSON.stringify(normalized));
    return normalized;
  }

  window.rteDownloader = {
    downloadFromPageUrl: async (pageUrl, progressToken) => {
      if (progressToken) {
        openProgressStream(progressToken);
      }
      try {
        return await API.sendJson("/api/download/url", "POST", { pageUrl, progressToken });
      } finally {
        if (progressToken) {
          setTimeout(() => closeProgressStream(progressToken), 1500);
        }
      }
    },
    downloadEpisode: async (payload) => {
      const token = String(payload?.progressToken || "");
      if (token) {
        openProgressStream(token);
      }
      try {
        return await API.sendJson("/api/download/episode", "POST", payload || {});
      } finally {
        if (token) {
          setTimeout(() => closeProgressStream(token), 1500);
        }
      }
    },
    downloadFromBbcUrl: async (pageUrl, progressToken, options = {}) => {
      if (progressToken) {
        openProgressStream(progressToken);
      }
      try {
        return await API.sendJson("/api/download/bbc/url", "POST", { pageUrl, progressToken, ...(options || {}) });
      } finally {
        if (progressToken) {
          setTimeout(() => closeProgressStream(progressToken), 1500);
        }
      }
    },
    onDownloadProgress: (handler) => {
      if (typeof handler !== "function") {
        return () => {};
      }
      progressListeners.add(handler);
      return () => {
        progressListeners.delete(handler);
      };
    },

    getLiveStations: () => API.getJson("/api/live/stations"),
    getLiveNow: (channelId) => API.getJson(`/api/live/now/${encodeURIComponent(channelId)}`),
    getBbcLiveStations: () => API.getJson("/api/bbc/live/stations"),

    getProgramSummary: (programUrl) => API.getJson(`/api/program/summary?url=${encodeURIComponent(programUrl)}`),
    getProgramEpisodes: (programUrl, page = 1) =>
      API.getJson(`/api/program/episodes?url=${encodeURIComponent(programUrl)}&page=${encodeURIComponent(page)}`),
    searchPrograms: (query) => API.getJson(`/api/program/search?q=${encodeURIComponent(query || "")}`),
    searchBbcPrograms: (query) => API.getJson(`/api/bbc/program/search?q=${encodeURIComponent(query || "")}`),
    getBbcProgramEpisodes: (programUrl, page = 1) =>
      API.getJson(`/api/bbc/program/episodes?url=${encodeURIComponent(programUrl)}&page=${encodeURIComponent(page)}`),
    getBbcEpisodePlaylist: (episodeUrl) =>
      API.getJson(`/api/bbc/episode/playlist?url=${encodeURIComponent(episodeUrl)}`),
    getEpisodePlaylist: (episodeUrl) => API.getJson(`/api/episode/playlist?url=${encodeURIComponent(episodeUrl)}`),

    listSchedules: () => API.getJson("/api/scheduler"),
    addSchedule: (programUrl, options = {}) =>
      API.sendJson("/api/scheduler", "POST", {
        programUrl,
        backfillCount: Number(options.backfillCount || 0)
      }),
    removeSchedule: (scheduleId) => API.sendJson(`/api/scheduler/${encodeURIComponent(scheduleId)}`, "DELETE", {}),
    setScheduleEnabled: (scheduleId, enabled) =>
      API.sendJson(`/api/scheduler/${encodeURIComponent(scheduleId)}`, "PATCH", { enabled }),
    runScheduleNow: (scheduleId) => API.sendJson(`/api/scheduler/${encodeURIComponent(scheduleId)}/run`, "POST", {}),
    listBbcSchedules: () => API.getJson("/api/bbc/scheduler"),
    addBbcSchedule: (programUrl, options = {}) =>
      API.sendJson("/api/bbc/scheduler", "POST", {
        programUrl,
        backfillCount: Number(options.backfillCount || 0)
      }),
    removeBbcSchedule: (scheduleId) => API.sendJson(`/api/bbc/scheduler/${encodeURIComponent(scheduleId)}`, "DELETE", {}),
    setBbcScheduleEnabled: (scheduleId, enabled) =>
      API.sendJson(`/api/bbc/scheduler/${encodeURIComponent(scheduleId)}`, "PATCH", { enabled }),
    runBbcScheduleNow: (scheduleId) => API.sendJson(`/api/bbc/scheduler/${encodeURIComponent(scheduleId)}/run`, "POST", {}),

    getSettings: async () => loadWebSettings(),
    saveSettings: async (payload) => saveWebSettings(payload),
    pickDownloadDirectory: async () => ""
  };
})();
