(function initKimbleCueManager() {
  function createCueManager(deps) {
    const state = deps.state;
    const windowRef = deps.windowRef || window;
    const documentRef = deps.documentRef || document;
    const playbackController = deps.playbackController;
    const normalizeTracks = deps.normalizeTracks;
    const normalizeChapters = deps.normalizeChapters;
    const estimateChaptersFromTracks = deps.estimateChaptersFromTracks;
    const renderChapters = deps.renderChapters;
    const createProgressToken = deps.createProgressToken;
    const attachDownloadProgress = deps.attachDownloadProgress;
    const formatProgressText = deps.formatProgressText;
    const clearCueDebugLog = deps.clearCueDebugLog;
    const appendCueDebugLog = deps.appendCueDebugLog;
    const formatCueSource = deps.formatCueSource;
    const formatCueAlignment = deps.formatCueAlignment;
    const setRteEpisodeChapters = deps.setRteEpisodeChapters;
    const setFipEpisodeChapters = deps.setFipEpisodeChapters;

    const cuePreviewInflight = new Map();

    function getTracksCache(sourceType) {
      if (sourceType === "bbc") return state.bbcTracksByEpisode;
      if (sourceType === "wwf") return state.wwfTracksByEpisode;
      if (sourceType === "nts") return state.ntsTracksByEpisode;
      if (sourceType === "kexp") return state.kexpTracksByEpisode;
      if (sourceType === "fip") return state.fipTracksByEpisode;
      return state.rteTracksByClip;
    }

    function getChaptersCache(sourceType) {
      if (sourceType === "bbc") return state.bbcChaptersByEpisode;
      if (sourceType === "wwf") return state.wwfChaptersByEpisode;
      if (sourceType === "nts") return state.ntsChaptersByEpisode;
      if (sourceType === "kexp") return state.kexpChaptersByEpisode;
      if (sourceType === "fip") return state.fipChaptersByEpisode;
      return state.rteChaptersByClip;
    }

    function setCachedTracks(sourceType, cacheKey, tracks) {
      getTracksCache(sourceType)[String(cacheKey || "")] = Array.isArray(tracks) ? tracks : [];
    }

    function getCachedTracks(sourceType, cacheKey) {
      const tracks = getTracksCache(sourceType)[String(cacheKey || "")];
      return Array.isArray(tracks) ? tracks : [];
    }

    function getCachedChapters(sourceType, cacheKey) {
      return normalizeChapters(getChaptersCache(sourceType)[String(cacheKey || "")] || []);
    }

    function setCachedChapters(sourceType, cacheKey, chapters) {
      const safeKey = String(cacheKey || "");
      const safeChapters = Array.isArray(chapters) ? chapters : [];
      if (sourceType === "bbc") {
        state.bbcChaptersByEpisode[safeKey] = safeChapters;
        const encodedKey = encodeURIComponent(safeKey);
        const node = documentRef.querySelector(`[data-bbc-episode-chapters="${encodedKey}"]`);
        if (node) {
          node.innerHTML = renderChapters(safeChapters);
        }
        return;
      }
      if (sourceType === "wwf") {
        state.wwfChaptersByEpisode[safeKey] = safeChapters;
        return;
      }
      if (sourceType === "nts") {
        state.ntsChaptersByEpisode[safeKey] = safeChapters;
        return;
      }
      if (sourceType === "kexp") {
        state.kexpChaptersByEpisode[safeKey] = safeChapters;
        return;
      }
      if (sourceType === "fip") {
        setFipEpisodeChapters(safeKey, safeChapters);
        return;
      }
      setRteEpisodeChapters(safeKey, safeChapters);
    }

    async function ensureEpisodeTracks(sourceType, cacheKey, episodeUrl, trackFetchOptions = null) {
      const cached = normalizeTracks(getCachedTracks(sourceType, cacheKey));
      if (cached.length || !episodeUrl) {
        return cached;
      }
      try {
        let payload;
        if (sourceType === "bbc") {
          payload = await windowRef.rteDownloader.getBbcEpisodePlaylist(episodeUrl);
        } else if (sourceType === "wwf") {
          payload = await windowRef.rteDownloader.getWwfEpisodePlaylist(episodeUrl);
        } else if (sourceType === "nts") {
          payload = await windowRef.rteDownloader.getNtsEpisodePlaylist(episodeUrl);
        } else if (sourceType === "kexp") {
          const data = await windowRef.rteDownloader.getKexpEpisodeTracklist(episodeUrl);
          payload = { tracks: Array.isArray(data) ? data : (data?.tracks || []) };
        } else if (sourceType === "fip") {
          const data = await windowRef.rteDownloader.getFipEpisodeTracklist(episodeUrl, trackFetchOptions || {});
          payload = { tracks: Array.isArray(data) ? data : (data?.tracks || []) };
        } else {
          payload = await windowRef.rteDownloader.getEpisodePlaylist(episodeUrl);
        }
        const tracks = normalizeTracks(payload?.tracks || []);
        setCachedTracks(sourceType, cacheKey, tracks);
        return tracks;
      } catch {
        return [];
      }
    }

    async function getLocalCueChaptersSafe(outputDir, fileName) {
      if (!windowRef.rteDownloader?.getLocalCueChapters) {
        return [];
      }
      try {
        const chapters = await windowRef.rteDownloader.getLocalCueChapters(outputDir, fileName);
        return normalizeChapters(chapters || []);
      } catch {
        return [];
      }
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
          const cue = await windowRef.rteDownloader.previewCue({
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
            playbackController.updateActiveNowPlayingChapters(playbackKey, cue.chapters);
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
      trackFetchOptions = null,
      statusUpdater = null
    }) {
      const raw = String(sourceType || "").toLowerCase();
      const safeSourceType = raw === "bbc" ? "bbc" : raw === "wwf" ? "wwf" : raw === "nts" ? "nts" : raw === "fip" ? "fip" : raw === "kexp" ? "kexp" : "rte";
      const safeCacheKey = String(cacheKey || "").trim();
      const safePlaybackKey = String(playbackKey || `${safeSourceType}:${safeCacheKey}`).trim();
      const safeEpisodeUrl = String(episodeUrl || "").trim();
      const safeOutputDir = String(outputDir || "").trim();
      const safeFileName = String(fileName || "").trim();
      const tracks = getCachedTracks(safeSourceType, safeCacheKey);
      let chapters = getCachedChapters(safeSourceType, safeCacheKey);
      let chaptersFromTracks = false;
      let resolvedStreamUrl = String(streamUrl || "").trim();
      let hasResolvedCue = chapters.length > 0;

      if (safeOutputDir && safeFileName) {
        resolvedStreamUrl = await windowRef.rteDownloader.getLocalPlaybackUrl(safeOutputDir, safeFileName);
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

      const safeStartOffset = Number(startOffset) || 0;
      if (safeStartOffset > 0 && chaptersFromTracks && chapters.length) {
        chapters = chapters.map((chapter) => ({ ...chapter, startSec: (chapter.startSec || 0) + safeStartOffset }));
      }

      await playbackController.startGlobalNowPlaying({
        source: sourceLabel,
        title,
        subtitle,
        image,
        streamUrl: resolvedStreamUrl,
        chapters,
        tracks,
        chaptersFromTracks,
        playbackKey: safePlaybackKey,
        startOffset: safeStartOffset
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
          fileStartOffset: safeStartOffset,
          statusUpdater
        }).catch(() => {});
      }

      if (!tracks.length && safeEpisodeUrl) {
        ensureEpisodeTracks(safeSourceType, safeCacheKey, safeEpisodeUrl, trackFetchOptions)
          .then((fetchedTracks) => {
            if (Array.isArray(fetchedTracks) && fetchedTracks.length) {
              playbackController.updateActiveNowPlayingTracks?.(safePlaybackKey, fetchedTracks);
            }
          })
          .catch(() => {});
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

      const url = await windowRef.rteDownloader.getLocalPlaybackUrl(safeOutputDir, safeFileName);
      const cueChapters = await getLocalCueChaptersSafe(safeOutputDir, safeFileName);
      await playbackController.startGlobalNowPlaying({
        source,
        title: title || safeFileName,
        subtitle,
        image,
        streamUrl: url,
        chapters: cueChapters,
        tracks: []
      });
    }

    return {
      playEpisodeWithBackgroundCue,
      playFromDownloadedFile,
      setCachedChapters
    };
  }

  window.KimbleCueManager = {
    create: createCueManager
  };
})();
