(function initKimblePlaybackController() {
  function createPlaybackController(deps) {
    const dom = deps.dom || {};
    const normalizeChapters = deps.normalizeChapters;
    const normalizeTracks = deps.normalizeTracks;
    const estimateChaptersFromTracks = deps.estimateChaptersFromTracks;
    const formatDurationFromSeconds = deps.formatDurationFromSeconds;
    const setSettingsStatus = deps.setSettingsStatus;
    const onPlaybackStarted = deps.onPlaybackStarted;

    const DEFAULT_NOW_PLAYING_ART = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'%3E%3Crect width='56' height='56' rx='8' fill='%231f2a3a'/%3E%3Ccircle cx='28' cy='28' r='17' fill='%2335445a'/%3E%3Cpath d='M21 20h4v16h-4zM31 20l10 8-10 8z' fill='%23c9d6e8'/%3E%3C/svg%3E";
    const RESUME_KEY_PREFIX = "resume:";
    const PLAYBACK_QUEUE_KEY = "kimble-playback-queue";
    const AUTOPLAY_QUEUE_KEY = "kimble-playback-autoplay";

    let activeNowPlaying = null;
    let activeHls = null;
    let pendingNowPlayingVisible = false;
    let resumeSaveTimer = null;
    let playbackQueue = [];
    let autoplayNext = true;
    const queueListeners = new Set();

    function saveResumePosition(key, pos) {
      if (!key || pos < 5) {
        return;
      }
      try {
        localStorage.setItem(RESUME_KEY_PREFIX + key, String(pos));
      } catch {}
    }

    function loadResumePosition(key) {
      if (!key) {
        return null;
      }
      try {
        const value = localStorage.getItem(RESUME_KEY_PREFIX + key);
        return value ? parseFloat(value) || null : null;
      } catch {
        return null;
      }
    }

    function clearResumePosition(key) {
      if (!key) {
        return;
      }
      try {
        localStorage.removeItem(RESUME_KEY_PREFIX + key);
      } catch {}
    }

    function normalizeQueueItem(item = {}) {
      const outputDir = String(item.outputDir || "").trim();
      const fileName = String(item.fileName || "").trim();
      if (!outputDir || !fileName) {
        return null;
      }
      return {
        id: String(item.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`).trim(),
        outputDir,
        fileName,
        title: String(item.title || fileName).trim() || fileName,
        source: String(item.source || "Queue").trim() || "Queue",
        subtitle: String(item.subtitle || "").trim(),
        image: String(item.image || "").trim(),
        episodeUrl: String(item.episodeUrl || "").trim(),
        sourceType: String(item.sourceType || "").trim().toLowerCase()
      };
    }

    function savePlaybackQueue() {
      try {
        localStorage.setItem(PLAYBACK_QUEUE_KEY, JSON.stringify(playbackQueue));
      } catch {}
    }

    function loadPlaybackQueue() {
      try {
        const raw = localStorage.getItem(PLAYBACK_QUEUE_KEY);
        if (!raw) {
          return [];
        }
        const parsed = JSON.parse(raw);
        return (Array.isArray(parsed) ? parsed : []).map(normalizeQueueItem).filter(Boolean);
      } catch {
        return [];
      }
    }

    function saveAutoplayPreference() {
      try {
        localStorage.setItem(AUTOPLAY_QUEUE_KEY, autoplayNext ? "1" : "0");
      } catch {}
    }

    function loadAutoplayPreference() {
      try {
        const raw = localStorage.getItem(AUTOPLAY_QUEUE_KEY);
        return raw == null ? true : raw === "1";
      } catch {
        return true;
      }
    }

    function renderQueue() {
      if (dom.autoplayCheckbox) {
        dom.autoplayCheckbox.checked = autoplayNext;
      }
      if (dom.queueSummary) {
        dom.queueSummary.textContent = playbackQueue.length
          ? `${playbackQueue.length} queued â€¢ next ${playbackQueue[0].title}`
          : "Queue empty";
      }
      if (dom.queueClearBtn) {
        dom.queueClearBtn.disabled = playbackQueue.length === 0;
      }
      if (!dom.queueList) {
        return;
      }
      dom.queueList.innerHTML = playbackQueue.length
        ? playbackQueue.map((item, index) => `
          <div class="now-playing-queue-item">
            <div class="now-playing-queue-main">
              <div class="now-playing-queue-title">${index === 0 ? "Up Next: " : ""}${item.title}</div>
              <div class="now-playing-queue-meta">${item.source}${item.subtitle ? ` â€¢ ${item.subtitle}` : ""}</div>
            </div>
            <div class="now-playing-queue-actions">
              <button class="secondary" type="button" data-queue-play-now="${item.id}">Play</button>
              <button class="secondary" type="button" data-queue-remove="${item.id}">Remove</button>
            </div>
          </div>
        `).join("")
        : `<div class="now-playing-queue-empty">Queue the next local episode from History or Queue.</div>`;
    }

    function notifyQueueChange() {
      savePlaybackQueue();
      renderQueue();
      const snapshot = {
        items: playbackQueue.slice(),
        autoplayNext
      };
      for (const listener of queueListeners) {
        try {
          listener(snapshot);
        } catch {}
      }
    }

    function setAutoplayEnabled(enabled) {
      autoplayNext = Boolean(enabled);
      saveAutoplayPreference();
      renderQueue();
    }

    async function playQueueItem(item) {
      const safeItem = normalizeQueueItem(item);
      if (!safeItem) {
        throw new Error("Queued item is missing a local file.");
      }
      if (typeof deps.playQueuedItem !== "function") {
        throw new Error("Queued playback is not available.");
      }
      await deps.playQueuedItem(safeItem);
    }

    async function playQueuedItemNow(itemId) {
      const id = String(itemId || "").trim();
      if (!id) {
        return;
      }
      const index = playbackQueue.findIndex((item) => item.id === id);
      if (index < 0) {
        return;
      }
      const [nextItem] = playbackQueue.splice(index, 1);
      notifyQueueChange();
      await playQueueItem(nextItem);
    }

    async function playNextQueueItem() {
      if (!autoplayNext || !playbackQueue.length) {
        return false;
      }
      const nextItem = playbackQueue.shift();
      notifyQueueChange();
      try {
        await playQueueItem(nextItem);
        return true;
      } catch (error) {
        setSettingsStatus?.(`Queue playback failed: ${error.message}`, true);
        return false;
      }
    }

    function enqueueQueueItem(item, options = {}) {
      const normalized = normalizeQueueItem(item);
      if (!normalized) {
        throw new Error("A downloaded file is required to queue playback.");
      }
      if (!playbackQueue.some((entry) => entry.outputDir === normalized.outputDir && entry.fileName === normalized.fileName)) {
        if (options.prepend) {
          playbackQueue.unshift(normalized);
        } else {
          playbackQueue.push(normalized);
        }
        notifyQueueChange();
      } else {
        renderQueue();
      }
      if (options.playNow) {
        playQueuedItemNow(normalized.id).catch((error) => {
          setSettingsStatus?.(`Queue playback failed: ${error.message}`, true);
        });
      }
      return normalized;
    }

    function removeQueueItem(itemId) {
      const id = String(itemId || "").trim();
      if (!id) {
        return;
      }
      playbackQueue = playbackQueue.filter((item) => item.id !== id);
      notifyQueueChange();
    }

    function clearQueue() {
      playbackQueue = [];
      notifyQueueChange();
    }

    function updateResumeBadge() {
      if (!dom.resumeBtn) {
        return;
      }
      const key = activeNowPlaying?.playbackKey;
      if (!key) {
        dom.resumeBtn.style.display = "none";
        return;
      }
      const pos = loadResumePosition(key);
      if (!pos || pos < 5) {
        dom.resumeBtn.style.display = "none";
        return;
      }
      dom.resumeBtn.textContent = `Resume from ${formatDurationFromSeconds(Math.floor(pos))}`;
      dom.resumeBtn.style.display = "";
    }

    function stopHlsPlayback() {
      if (activeHls && typeof activeHls.destroy === "function") {
        try {
          activeHls.destroy();
        } catch {}
      }
      activeHls = null;
    }

    function findChapterAtTime(chapters, seconds) {
      const rows = Array.isArray(chapters) ? chapters : [];
      if (!rows.length) {
        return null;
      }
      if (rows.length > 1 && rows.every((row) => row.startSec === rows[0].startSec)) {
        return rows[0];
      }
      const currentTime = Math.max(0, Number(seconds || 0));
      let current = rows[0];
      for (const row of rows) {
        if (row.startSec <= currentTime) {
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
      if (dom.chapterControls) {
        dom.chapterControls.classList.toggle("hidden", !hasChapters);
      }
      if (dom.prevChapterBtn) {
        dom.prevChapterBtn.disabled = !hasChapters;
      }
      if (dom.nextChapterBtn) {
        dom.nextChapterBtn.disabled = !hasChapters;
      }
    }

    function refreshNowPlayingTrackLabel() {
      if (!dom.track) {
        return;
      }
      if (!activeNowPlaying) {
        dom.track.textContent = "";
        updateNowPlayingChapterControls();
        return;
      }
      const currentDuration = Number(dom.audio?.duration || 0);
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
        dom.track.textContent = "";
        updateNowPlayingChapterControls();
        return;
      }
      const row = findChapterAtTime(activeNowPlaying.chapters, dom.audio?.currentTime || 0);
      if (!row) {
        dom.track.textContent = "";
        updateNowPlayingChapterControls();
        return;
      }
      const trackText = row.artist ? `Track: ${row.title} - ${row.artist}` : `Track: ${row.title}`;
      const inferredText = row.inferred
        ? ` (Inferred${row.inferredSource ? ` via ${row.inferredSource}` : ""})`
        : "";
      dom.track.textContent = `${trackText}${inferredText}`;
      updateNowPlayingChapterControls();
    }

    function jumpToAdjacentChapter(direction) {
      if (!activeNowPlaying || !Array.isArray(activeNowPlaying.chapters) || !activeNowPlaying.chapters.length || !dom.audio) {
        return;
      }
      const rows = activeNowPlaying.chapters;
      const currentTime = Number(dom.audio.currentTime || 0);
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
      dom.audio.currentTime = Math.max(0, Number(target.startSec || 0));
      refreshNowPlayingTrackLabel();
    }

    function clearGlobalNowPlaying() {
      stopHlsPlayback();
      try {
        dom.audio?.pause();
      } catch {}
      pendingNowPlayingVisible = false;
      if (dom.audio) {
        dom.audio.removeAttribute("src");
        dom.audio.load();
      }
      if (dom.image) {
        dom.image.src = DEFAULT_NOW_PLAYING_ART;
        dom.image.style.display = "";
      }
      if (dom.title) {
        dom.title.textContent = "Now Playing";
      }
      if (dom.meta) {
        dom.meta.textContent = "";
      }
      if (dom.track) {
        dom.track.textContent = "";
      }
      if (dom.chapterControls) {
        dom.chapterControls.classList.add("hidden");
      }
      dom.bar?.classList.add("hidden");
      activeNowPlaying = null;
      updateResumeBadge();
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

      if (dom.title) {
        dom.title.textContent = `${activeNowPlaying.source || "Audio"}: ${activeNowPlaying.title || "Now Playing"}`;
      }
      if (dom.meta) {
        dom.meta.textContent = String(subtitle || "").trim();
      }
      refreshNowPlayingTrackLabel();
      updateNowPlayingChapterControls();

      const imageUrl = String(image || "").trim();
      if (dom.image) {
        dom.image.src = imageUrl || DEFAULT_NOW_PLAYING_ART;
        dom.image.style.display = "";
      }
      pendingNowPlayingVisible = false;
      dom.bar?.classList.remove("hidden");

      const revealPendingPlayer = () => {
        if (pendingNowPlayingVisible) {
          dom.bar?.classList.remove("hidden");
          pendingNowPlayingVisible = false;
        }
        if (dom.meta && !String(dom.meta.textContent || "").trim()) {
          dom.meta.textContent = "Press Play to start";
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
        activeHls.attachMedia(dom.audio);
        activeHls.on(hlsCtor.Events.MANIFEST_PARSED, () => {
          dom.audio?.play().catch(() => {
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
          const seek = () => {
            audio.currentTime = safeOffset;
            audio.removeEventListener("loadedmetadata", seek);
          };
          audio.addEventListener("loadedmetadata", seek);
        }
      };

      if (!looksLikeHls) {
        if (dom.audio) {
          dom.audio.src = url;
          applyOffset(dom.audio);
          dom.audio.play().catch(() => {
            revealPendingPlayer();
          });
        }
        return;
      }

      if (dom.audio?.canPlayType("application/vnd.apple.mpegurl")) {
        dom.audio.src = url;
        applyOffset(dom.audio);
        dom.audio.play().catch(() => {
          revealPendingPlayer();
        });
        return;
      }

      pendingNowPlayingVisible = false;
      throw new Error("HLS playback is not supported in this browser build.");
    }

    function updateActiveNowPlayingChapters(playbackKey, chapters) {
      if (!activeNowPlaying || activeNowPlaying.playbackKey !== String(playbackKey || "")) {
        return;
      }
      activeNowPlaying.chapters = normalizeChapters(chapters || []);
      activeNowPlaying.chaptersFromTracks = false;
      refreshNowPlayingTrackLabel();
    }

    function updateActiveNowPlayingTracks(playbackKey, tracks) {
      if (!activeNowPlaying || activeNowPlaying.playbackKey !== String(playbackKey || "")) {
        return;
      }
      activeNowPlaying.tracks = normalizeTracks(tracks || []);
      if (!activeNowPlaying.chapters?.length || activeNowPlaying.chaptersFromTracks) {
        activeNowPlaying.chapters = estimateChaptersFromTracks(activeNowPlaying.tracks, Number(dom.audio?.duration || 0));
        activeNowPlaying.chaptersFromTracks = true;
      }
      refreshNowPlayingTrackLabel();
      updateNowPlayingChapterControls();
    }

    function bindEvents() {
      dom.closeBtn?.addEventListener("click", () => {
        clearGlobalNowPlaying();
      });

      dom.resumeBtn?.addEventListener("click", () => {
        const pos = loadResumePosition(activeNowPlaying?.playbackKey);
        if (pos && dom.audio) {
          dom.audio.currentTime = pos;
        }
      });

      dom.prevChapterBtn?.addEventListener("click", () => {
        jumpToAdjacentChapter(-1);
      });

      dom.nextChapterBtn?.addEventListener("click", () => {
        jumpToAdjacentChapter(1);
      });

      dom.autoplayCheckbox?.addEventListener("change", () => {
        setAutoplayEnabled(Boolean(dom.autoplayCheckbox.checked));
      });

      dom.queueClearBtn?.addEventListener("click", () => {
        clearQueue();
      });

      dom.queueList?.addEventListener("click", (event) => {
        const playBtn = event.target.closest("[data-queue-play-now]");
        if (playBtn) {
          playQueuedItemNow(playBtn.getAttribute("data-queue-play-now") || "").catch((error) => {
            setSettingsStatus?.(`Queue playback failed: ${error.message}`, true);
          });
          return;
        }
        const removeBtn = event.target.closest("[data-queue-remove]");
        if (removeBtn) {
          removeQueueItem(removeBtn.getAttribute("data-queue-remove") || "");
        }
      });

      dom.image?.addEventListener("error", () => {
        if (String(dom.image.src || "").startsWith("data:image/svg+xml")) {
          return;
        }
        dom.image.src = DEFAULT_NOW_PLAYING_ART;
      });

      dom.audio?.addEventListener("timeupdate", () => {
        refreshNowPlayingTrackLabel();
        if (activeNowPlaying?.playbackKey && !activeNowPlaying.playbackKey.startsWith("wwf:remote:")) {
          if (!resumeSaveTimer) {
            resumeSaveTimer = setTimeout(() => {
              resumeSaveTimer = null;
              const pos = dom.audio.currentTime;
              if (pos > 5) {
                saveResumePosition(activeNowPlaying.playbackKey, pos);
              }
            }, 5000);
          }
        }
      });

      dom.audio?.addEventListener("seeking", () => {
        refreshNowPlayingTrackLabel();
      });

      dom.audio?.addEventListener("seeked", () => {
        refreshNowPlayingTrackLabel();
      });

      dom.audio?.addEventListener("loadedmetadata", () => {
        refreshNowPlayingTrackLabel();
        const key = activeNowPlaying?.playbackKey;
        if (key && !key.startsWith("wwf:remote:")) {
          const savedPos = loadResumePosition(key);
          const duration = dom.audio.duration;
          if (savedPos && savedPos > 5 && (!isFinite(duration) || savedPos < duration - 30)) {
            dom.audio.currentTime = savedPos;
          }
        }
        updateResumeBadge();
      });

      dom.audio?.addEventListener("durationchange", () => {
        refreshNowPlayingTrackLabel();
      });

      dom.audio?.addEventListener("playing", () => {
        if (pendingNowPlayingVisible) {
          dom.bar?.classList.remove("hidden");
          pendingNowPlayingVisible = false;
        }
        if (typeof onPlaybackStarted === "function") {
          onPlaybackStarted(activeNowPlaying?.playbackKey || "");
        }
      });

      dom.audio?.addEventListener("ended", () => {
        clearResumePosition(activeNowPlaying?.playbackKey);
        playNextQueueItem().then((playedNext) => {
          if (!playedNext) {
            clearGlobalNowPlaying();
          }
        }).catch(() => {
          clearGlobalNowPlaying();
        });
      });
    }

    autoplayNext = loadAutoplayPreference();
    playbackQueue = loadPlaybackQueue();
    bindEvents();
    renderQueue();

    return {
      clearGlobalNowPlaying,
      startGlobalNowPlaying,
      updateActiveNowPlayingChapters,
      updateActiveNowPlayingTracks,
      enqueueQueueItem,
      removeQueueItem,
      clearQueue,
      setAutoplayEnabled,
      onQueueChange(listener) {
        if (typeof listener !== "function") {
          return () => {};
        }
        queueListeners.add(listener);
        try {
          listener({ items: playbackQueue.slice(), autoplayNext });
        } catch {}
        return () => queueListeners.delete(listener);
      }
    };
  }

  window.KimblePlaybackController = {
    create: createPlaybackController
  };
})();
