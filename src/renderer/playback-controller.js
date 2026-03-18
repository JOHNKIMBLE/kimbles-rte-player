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

    let activeNowPlaying = null;
    let activeHls = null;
    let pendingNowPlayingVisible = false;
    let resumeSaveTimer = null;

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
        clearGlobalNowPlaying();
      });
    }

    bindEvents();

    return {
      clearGlobalNowPlaying,
      startGlobalNowPlaying,
      updateActiveNowPlayingChapters,
      updateActiveNowPlayingTracks
    };
  }

  window.KimblePlaybackController = {
    create: createPlaybackController
  };
})();
