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
    outputFormat: "m4a",
    outputQuality: "128K",
    normalizeLoudness: true,
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
    ffmpegCueSpectralDetect: true
  };

  function normalizeOutputFormat(value) {
    return String(value || defaultSettings.outputFormat).trim().toLowerCase() === "mp3" ? "mp3" : "m4a";
  }

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
        outputFormat: normalizeOutputFormat(parsed.outputFormat),
        outputQuality: typeof parsed.outputQuality === "string" && parsed.outputQuality.trim()
          ? parsed.outputQuality.trim()
          : defaultSettings.outputQuality,
        normalizeLoudness: parsed.normalizeLoudness == null ? defaultSettings.normalizeLoudness : Boolean(parsed.normalizeLoudness),
        dedupeMode: typeof parsed.dedupeMode === "string" && parsed.dedupeMode.trim()
          ? parsed.dedupeMode.trim().toLowerCase()
          : defaultSettings.dedupeMode,
        id3Tagging: parsed.id3Tagging == null ? defaultSettings.id3Tagging : Boolean(parsed.id3Tagging),
        feedExportEnabled: parsed.feedExportEnabled == null ? defaultSettings.feedExportEnabled : Boolean(parsed.feedExportEnabled),
        webhookUrl: typeof parsed.webhookUrl === "string" ? parsed.webhookUrl.trim() : defaultSettings.webhookUrl,
        auddTrackMatching: parsed.auddTrackMatching == null ? defaultSettings.auddTrackMatching : Boolean(parsed.auddTrackMatching),
        auddApiToken: typeof parsed.auddApiToken === "string" ? parsed.auddApiToken.trim() : defaultSettings.auddApiToken,
        fingerprintTrackMatching: parsed.fingerprintTrackMatching == null ? defaultSettings.fingerprintTrackMatching : Boolean(parsed.fingerprintTrackMatching),
        acoustidApiKey: typeof parsed.acoustidApiKey === "string" ? parsed.acoustidApiKey.trim() : defaultSettings.acoustidApiKey,
        songrecTrackMatching: parsed.songrecTrackMatching == null ? defaultSettings.songrecTrackMatching : Boolean(parsed.songrecTrackMatching),
        songrecSampleSeconds: Math.max(8, Math.min(45, Math.floor(Number(parsed.songrecSampleSeconds || defaultSettings.songrecSampleSeconds)))),
        ffmpegCueSilenceDetect: parsed.ffmpegCueSilenceDetect == null ? defaultSettings.ffmpegCueSilenceDetect : Boolean(parsed.ffmpegCueSilenceDetect),
        ffmpegCueLoudnessDetect: parsed.ffmpegCueLoudnessDetect == null ? defaultSettings.ffmpegCueLoudnessDetect : Boolean(parsed.ffmpegCueLoudnessDetect),
        ffmpegCueSpectralDetect: parsed.ffmpegCueSpectralDetect == null ? defaultSettings.ffmpegCueSpectralDetect : Boolean(parsed.ffmpegCueSpectralDetect)
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
      outputFormat: normalizeOutputFormat(next.outputFormat),
      outputQuality: typeof next.outputQuality === "string" && next.outputQuality.trim()
        ? next.outputQuality.trim()
        : defaultSettings.outputQuality,
      normalizeLoudness: next.normalizeLoudness == null ? defaultSettings.normalizeLoudness : Boolean(next.normalizeLoudness),
      dedupeMode: typeof next.dedupeMode === "string" && next.dedupeMode.trim()
        ? next.dedupeMode.trim().toLowerCase()
        : defaultSettings.dedupeMode,
      id3Tagging: next.id3Tagging == null ? defaultSettings.id3Tagging : Boolean(next.id3Tagging),
      feedExportEnabled: next.feedExportEnabled == null ? defaultSettings.feedExportEnabled : Boolean(next.feedExportEnabled),
      webhookUrl: typeof next.webhookUrl === "string" ? next.webhookUrl.trim() : defaultSettings.webhookUrl,
      auddTrackMatching: next.auddTrackMatching == null ? defaultSettings.auddTrackMatching : Boolean(next.auddTrackMatching),
      auddApiToken: typeof next.auddApiToken === "string" ? next.auddApiToken.trim() : defaultSettings.auddApiToken,
      fingerprintTrackMatching: next.fingerprintTrackMatching == null ? defaultSettings.fingerprintTrackMatching : Boolean(next.fingerprintTrackMatching),
      acoustidApiKey: typeof next.acoustidApiKey === "string" ? next.acoustidApiKey.trim() : defaultSettings.acoustidApiKey,
      songrecTrackMatching: next.songrecTrackMatching == null ? defaultSettings.songrecTrackMatching : Boolean(next.songrecTrackMatching),
      songrecSampleSeconds: Math.max(8, Math.min(45, Math.floor(Number(next.songrecSampleSeconds || defaultSettings.songrecSampleSeconds)))),
      ffmpegCueSilenceDetect: next.ffmpegCueSilenceDetect == null ? defaultSettings.ffmpegCueSilenceDetect : Boolean(next.ffmpegCueSilenceDetect),
      ffmpegCueLoudnessDetect: next.ffmpegCueLoudnessDetect == null ? defaultSettings.ffmpegCueLoudnessDetect : Boolean(next.ffmpegCueLoudnessDetect),
      ffmpegCueSpectralDetect: next.ffmpegCueSpectralDetect == null ? defaultSettings.ffmpegCueSpectralDetect : Boolean(next.ffmpegCueSpectralDetect)
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
    downloadFromWwfUrl: async (pageUrl, progressToken, options = {}) => {
      if (progressToken) {
        openProgressStream(progressToken);
      }
      try {
        return await API.sendJson("/api/download/wwf/url", "POST", { pageUrl, progressToken, ...(options || {}) });
      } finally {
        if (progressToken) {
          setTimeout(() => closeProgressStream(progressToken), 1500);
        }
      }
    },
    downloadFromNtsUrl: async (pageUrl, progressToken, options = {}) => {
      if (progressToken) {
        openProgressStream(progressToken);
      }
      try {
        return await API.sendJson("/api/download/nts/url", "POST", { pageUrl, progressToken, ...(options || {}) });
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
    getWwfLiveStations: () => API.getJson("/api/wwf/live/stations"),
    getWwfLiveNow: () => API.getJson("/api/wwf/live/now"),
    searchWwfPrograms: (query) => API.getJson(`/api/wwf/program/search?q=${encodeURIComponent(query || "")}`),
    getWwfProgramEpisodes: (programUrl, page = 1) =>
      API.getJson(`/api/wwf/program/episodes?url=${encodeURIComponent(programUrl)}&page=${encodeURIComponent(page)}`),
    getWwfProgramSummary: (programUrl) =>
      API.getJson(`/api/wwf/program/summary?url=${encodeURIComponent(programUrl)}`),
    getWwfEpisodePlaylist: (episodeUrl) =>
      API.getJson(`/api/wwf/episode/playlist?url=${encodeURIComponent(episodeUrl)}`),
    getWwfEpisodeStream: (episodeUrl) =>
      API.getJson(`/api/wwf/episode/stream?url=${encodeURIComponent(episodeUrl)}`),
    getNtsLiveStations: () => API.getJson("/api/nts/live/stations"),
    getNtsLiveNow: (channelId) => API.getJson(`/api/nts/live/now/${encodeURIComponent(channelId || "")}`),
    searchNtsPrograms: (query, options) => API.getJson(`/api/nts/program/search?q=${encodeURIComponent(query || "")}&sort=${encodeURIComponent((options?.sort) || "recent")}`),
    getNtsProgramEpisodes: (programUrl, page = 1) =>
      API.getJson(`/api/nts/program/episodes?url=${encodeURIComponent(programUrl)}&page=${encodeURIComponent(page)}`),
    getNtsProgramSummary: (programUrl) =>
      API.getJson(`/api/nts/program/summary?url=${encodeURIComponent(programUrl)}`),
    getNtsEpisodePlaylist: (episodeUrl) =>
      API.getJson(`/api/nts/episode/playlist?url=${encodeURIComponent(episodeUrl)}`),
    getNtsEpisodeStream: (episodeUrl) =>
      API.getJson(`/api/nts/episode/stream?url=${encodeURIComponent(episodeUrl)}`),
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
    listWwfSchedules: () => API.getJson("/api/wwf/scheduler"),
    addWwfSchedule: (programUrl, options = {}) =>
      API.sendJson("/api/wwf/scheduler", "POST", { programUrl, backfillCount: Number(options.backfillCount || 0) }),
    removeWwfSchedule: (scheduleId) => API.sendJson(`/api/wwf/scheduler/${encodeURIComponent(scheduleId)}`, "DELETE", {}),
    setWwfScheduleEnabled: (scheduleId, enabled) =>
      API.sendJson(`/api/wwf/scheduler/${encodeURIComponent(scheduleId)}`, "PATCH", { enabled }),
    runWwfScheduleNow: (scheduleId) => API.sendJson(`/api/wwf/scheduler/${encodeURIComponent(scheduleId)}/run`, "POST", {}),
    listNtsSchedules: () => API.getJson("/api/nts/scheduler"),
    addNtsSchedule: (programUrl, options = {}) =>
      API.sendJson("/api/nts/scheduler", "POST", { programUrl, backfillCount: Number(options.backfillCount || 0) }),
    removeNtsSchedule: (scheduleId) => API.sendJson(`/api/nts/scheduler/${encodeURIComponent(scheduleId)}`, "DELETE", {}),
    setNtsScheduleEnabled: (scheduleId, enabled) =>
      API.sendJson(`/api/nts/scheduler/${encodeURIComponent(scheduleId)}`, "PATCH", { enabled }),
    runNtsScheduleNow: (scheduleId) => API.sendJson(`/api/nts/scheduler/${encodeURIComponent(scheduleId)}/run`, "POST", {}),
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
    generateCue: async (payload) => {
      const token = String(payload?.progressToken || "");
      if (token) {
        openProgressStream(token);
      }
      try {
        return await API.sendJson("/api/cue/generate", "POST", payload || {});
      } finally {
        if (token) {
          setTimeout(() => closeProgressStream(token), 1500);
        }
      }
    },
    previewCue: async (payload) => {
      const token = String(payload?.progressToken || "");
      if (token) {
        openProgressStream(token);
      }
      try {
        return await API.sendJson("/api/cue/preview", "POST", payload || {});
      } finally {
        if (token) {
          setTimeout(() => closeProgressStream(token), 1500);
        }
      }
    },
    pickDownloadDirectory: async () => "",
    canPickDownloadDirectory: async () => false
  };
})();
