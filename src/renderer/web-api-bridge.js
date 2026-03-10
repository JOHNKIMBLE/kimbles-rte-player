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
    downloadDir: "/downloads",
    pathFormat: "{radio}/{program}/{episode_short} {release_date}",
    cueAutoGenerate: false,
    maxConcurrentDownloads: 2,
    outputFormat: "mp3",
    outputQuality: "128K",
    normalizeLoudness: true,
    dedupeMode: "source-id",
    id3Tagging: true,
    feedExportEnabled: true,
    webhookUrl: ""
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
        downloadDir: typeof parsed.downloadDir === "string" && parsed.downloadDir.trim()
          ? parsed.downloadDir.trim()
          : (typeof parsed.rteDownloadDir === "string" && parsed.rteDownloadDir.trim()
            ? parsed.rteDownloadDir.trim()
            : defaultSettings.downloadDir),
        pathFormat: typeof parsed.pathFormat === "string" && parsed.pathFormat.trim()
          ? parsed.pathFormat.trim()
          : defaultSettings.pathFormat,
        cueAutoGenerate: Boolean(parsed.cueAutoGenerate),
        maxConcurrentDownloads: Math.max(1, Math.min(8, Math.floor(Number(parsed.maxConcurrentDownloads || defaultSettings.maxConcurrentDownloads)))),
        outputFormat: typeof parsed.outputFormat === "string" && parsed.outputFormat.trim()
          ? parsed.outputFormat.trim().toLowerCase()
          : defaultSettings.outputFormat,
        outputQuality: typeof parsed.outputQuality === "string" && parsed.outputQuality.trim()
          ? parsed.outputQuality.trim()
          : defaultSettings.outputQuality,
        normalizeLoudness: parsed.normalizeLoudness == null ? defaultSettings.normalizeLoudness : Boolean(parsed.normalizeLoudness),
        dedupeMode: typeof parsed.dedupeMode === "string" && parsed.dedupeMode.trim()
          ? parsed.dedupeMode.trim().toLowerCase()
          : defaultSettings.dedupeMode,
        id3Tagging: parsed.id3Tagging == null ? defaultSettings.id3Tagging : Boolean(parsed.id3Tagging),
        feedExportEnabled: parsed.feedExportEnabled == null ? defaultSettings.feedExportEnabled : Boolean(parsed.feedExportEnabled),
        webhookUrl: typeof parsed.webhookUrl === "string" ? parsed.webhookUrl.trim() : defaultSettings.webhookUrl
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
      downloadDir: typeof next.downloadDir === "string" && next.downloadDir.trim()
        ? next.downloadDir.trim()
        : defaultSettings.downloadDir,
      pathFormat: typeof next.pathFormat === "string" && next.pathFormat.trim()
        ? next.pathFormat.trim()
        : defaultSettings.pathFormat,
      cueAutoGenerate: Boolean(next.cueAutoGenerate),
      maxConcurrentDownloads: Math.max(1, Math.min(8, Math.floor(Number(next.maxConcurrentDownloads || defaultSettings.maxConcurrentDownloads)))),
      outputFormat: typeof next.outputFormat === "string" && next.outputFormat.trim()
        ? next.outputFormat.trim().toLowerCase()
        : defaultSettings.outputFormat,
      outputQuality: typeof next.outputQuality === "string" && next.outputQuality.trim()
        ? next.outputQuality.trim()
        : defaultSettings.outputQuality,
      normalizeLoudness: next.normalizeLoudness == null ? defaultSettings.normalizeLoudness : Boolean(next.normalizeLoudness),
      dedupeMode: typeof next.dedupeMode === "string" && next.dedupeMode.trim()
        ? next.dedupeMode.trim().toLowerCase()
        : defaultSettings.dedupeMode,
      id3Tagging: next.id3Tagging == null ? defaultSettings.id3Tagging : Boolean(next.id3Tagging),
      feedExportEnabled: next.feedExportEnabled == null ? defaultSettings.feedExportEnabled : Boolean(next.feedExportEnabled),
      webhookUrl: typeof next.webhookUrl === "string" ? next.webhookUrl.trim() : defaultSettings.webhookUrl
    };
    localStorage.setItem("rte_web_settings", JSON.stringify(normalized));
    return normalized;
  }

  window.rteDownloader = {
    downloadFromPageUrl: async (pageUrl, progressToken, options = {}) => {
      if (progressToken) {
        openProgressStream(progressToken);
      }
      try {
        return await API.sendJson("/api/download/url", "POST", { pageUrl, progressToken, ...(options || {}) });
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
    getBbcEpisodeStream: (episodeUrl) =>
      API.getJson(`/api/bbc/episode/stream?url=${encodeURIComponent(episodeUrl)}`),
    getEpisodePlaylist: (episodeUrl) => API.getJson(`/api/episode/playlist?url=${encodeURIComponent(episodeUrl)}`),
    getRteEpisodeStream: (clipId) => API.getJson(`/api/rte/episode/stream?clipId=${encodeURIComponent(clipId)}`),
    getLocalPlaybackUrl: async (outputDir, fileName) => {
      const payload = await API.sendJson("/api/local-playback-url", "POST", { outputDir, fileName });
      return String(payload?.url || "");
    },
    getLocalCueChapters: async (outputDir, fileName) => {
      const payload = await API.sendJson("/api/local-cue-chapters", "POST", { outputDir, fileName });
      return Array.isArray(payload?.chapters) ? payload.chapters : [];
    },

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
    getDownloadQueueStats: () => API.getJson("/api/download-queue/stats"),
    getDownloadQueueSnapshot: () => API.getJson("/api/download-queue"),
    pauseDownloadQueue: () => API.sendJson("/api/download-queue/pause", "POST", {}),
    resumeDownloadQueue: () => API.sendJson("/api/download-queue/resume", "POST", {}),
    cancelDownloadQueueTask: (taskId) => API.sendJson("/api/download-queue/cancel", "POST", { taskId }),
    clearPendingDownloadQueue: () => API.sendJson("/api/download-queue/clear-pending", "POST", {}),

    getSettings: async () => {
      try {
        const remote = await API.getJson("/api/settings");
        const merged = saveWebSettings(remote);
        return merged;
      } catch {
        return loadWebSettings();
      }
    },
    saveSettings: async (payload) => {
      const local = saveWebSettings(payload);
      try {
        return await API.sendJson("/api/settings", "POST", local);
      } catch {
        return local;
      }
    },
    generateCue: async (payload) => API.sendJson("/api/cue/generate", "POST", payload || {}),
    pickDownloadDirectory: async () => "",
    canPickDownloadDirectory: async () => false
  };
})();
