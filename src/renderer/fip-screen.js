(function initKimbleFipScreen() {
  function createFipScreen(deps) {
    const state = deps.state;
    const dom = deps.dom || {};
    const escapeHtml = deps.escapeHtml;
    const setButtonBusy = deps.setButtonBusy;
    const getEpisodesPerPage = deps.getEpisodesPerPage;
    const getDiscoveryCount = deps.getDiscoveryCount;
    const createProgressToken = deps.createProgressToken;
    const attachDownloadProgress = deps.attachDownloadProgress;
    const formatProgressText = deps.formatProgressText;
    const playEpisodeWithBackgroundCue = deps.playEpisodeWithBackgroundCue;
    const clearCueDebugLog = deps.clearCueDebugLog;
    const appendCueDebugLog = deps.appendCueDebugLog;
    const formatCueSource = deps.formatCueSource;
    const formatCueAlignment = deps.formatCueAlignment;
    const renderSchedulerCard = deps.renderSchedulerCard;
    const renderPlaylistTracks = deps.renderPlaylistTracks;
    const playFromDownloadedFile = deps.playFromDownloadedFile;
    const shouldArmForceRetry = deps.shouldArmForceRetry;

    let searchDebounceTimer = null;
    let lastSearchRows = [];
    let lastDiscoveryRows = [];

    function normalizeMetadataList(value) {
      if (Array.isArray(value)) {
        return value.map((entry) => String(entry || "").trim()).filter(Boolean);
      }
      return String(value || "")
        .split(/,\s*/g)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    function getEpisodeFilterQuery() {
      return String(dom.episodeFilterInput?.value || "").trim().toLowerCase();
    }

    function getProgramResultFilterQuery() {
      return String(dom.programResultFilterInput?.value || "").trim().toLowerCase();
    }

    function buildEpisodeSearchText(episode, payload) {
      const hosts = normalizeMetadataList(episode?.hosts);
      const genres = Array.isArray(episode?.genres) ? episode.genres : [];
      return [
        payload?.title,
        episode?.title,
        episode?.fullTitle,
        episode?.description,
        episode?.location,
        episode?.publishedTime,
        ...hosts,
        ...genres
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
    }

    function buildProgramCardSearchText(show) {
      const hosts = normalizeMetadataList(show?.hosts);
      const genres = Array.isArray(show?.genres) ? show.genres : [];
      return [
        show?.title,
        show?.description,
        show?.location,
        show?.cadence,
        show?.airtime,
        ...hosts,
        ...genres
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
    }

    function filterProgramRows(rows) {
      const query = getProgramResultFilterQuery();
      if (!query) {
        return Array.isArray(rows) ? rows : [];
      }
      return (Array.isArray(rows) ? rows : []).filter((row) => buildProgramCardSearchText(row).includes(query));
    }

    function parseMetadataAttr(value) {
      try {
        return normalizeMetadataList(JSON.parse(String(value || "[]")));
      } catch {
        return normalizeMetadataList(value);
      }
    }

    function setStatus(text, isError = false) {
      if (!dom.result) {
        return;
      }
      dom.result.textContent = text || "";
      dom.result.className = `status ${isError ? "error" : "muted"}`;
    }

    function setEpisodeStatus(episodeUrl, text, isError = false) {
      const key = encodeURIComponent(String(episodeUrl || ""));
      const node = dom.episodesResult?.querySelector(`[data-fip-episode-status="${key}"]`);
      if (!node) {
        return;
      }
      const safeText = String(text || "");
      node.textContent = safeText;
      node.style.display = safeText ? "block" : "none";
      node.className = `item-meta episode-status ${isError ? "error" : ""}`;
    }

    function setEpisodeChapters(episodeUrl, chapters) {
      state.fipChaptersByEpisode[String(episodeUrl || "")] = Array.isArray(chapters) ? chapters : [];
      const key = encodeURIComponent(String(episodeUrl || ""));
      const debugEl = dom.episodesResult?.querySelector(`[data-fip-episode-cue-debug="${key}"]`);
      if (debugEl && Array.isArray(chapters) && chapters.length) {
        debugEl.style.display = "";
      }
    }

    function focusProgramExplorer(page = 1) {
      if (Number(page) !== 1) {
        return;
      }
      dom.programMeta?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function episodeHasTracklist(episode) {
      const ts = Number(episode?.broadcastStartTs || 0);
      return ts > 0 && ts < (Date.now() / 1000) + 300;
    }

    function renderShowCard(show, { showScheduleBtn = false } = {}) {
      const hosts = normalizeMetadataList(show.hosts);
      const genresHtml = Array.isArray(show.genres) && show.genres.length
        ? `<div class="genre-pills">${show.genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      const cadenceLabel = show.cadence && show.cadence !== "irregular"
        ? `${show.cadence.charAt(0).toUpperCase()}${show.cadence.slice(1)}`
        : "";
      const metaParts = [cadenceLabel].filter(Boolean).join(" · ");
      const desc = String(show.description || "").trim();
      const schedBtn = showScheduleBtn
        ? `<button class="secondary fip-quick-schedule-btn" data-fip-schedule-url="${escapeHtml(show.programUrl)}" style="margin-top:0.4rem;font-size:0.8em;">+ Scheduler</button>`
        : "";
      return `
        <div class="item clickable" data-fip-program-url="${escapeHtml(show.programUrl)}">
          <div class="search-card">
            <div>${show.image ? `<img src="${escapeHtml(show.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
            <div>
              <div class="item-title">${escapeHtml(show.title || "Show")}</div>
              ${metaParts ? `<div class="item-meta"><strong>${escapeHtml(metaParts)}</strong></div>` : ""}
              ${show.airtime ? `<div class="item-meta">${escapeHtml(show.airtime)}</div>` : ""}
              ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
              ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "..." : ""}</div>` : ""}
              ${genresHtml}
              ${schedBtn}
            </div>
          </div>
        </div>
      `;
    }

    function renderEpisodes(payload) {
      if (!dom.episodesResult) {
        return;
      }
      const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];
      const query = getEpisodeFilterQuery();
      const filteredRows = query
        ? rows.filter((episode) => buildEpisodeSearchText(episode, payload).includes(query))
        : rows;
      if (!filteredRows.length) {
        dom.episodesResult.innerHTML = `<div class="item">${query ? "No matching loaded episodes found on this page." : "No episodes found."}</div>`;
        return;
      }
      dom.episodesResult.innerHTML = filteredRows.map((episode) => {
        const episodeUrl = String(episode.episodeUrl || "").trim();
        const statusKey = encodeURIComponent(episodeUrl);
        const published = String(episode.publishedTime || "").trim();
        const fullTitle = String(episode.fullTitle || episode.title || "").trim();
        const desc = String(episode.description || "").trim();
        const programTitle = String(payload?.title || "FIP").trim();
        const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
        const hosts = normalizeMetadataList(episode.hosts);
        const episodeGenres = Array.isArray(episode.genres) ? episode.genres : [];
        const genresHtml = episodeGenres.length
          ? `<div class="genre-pills">${episodeGenres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
          : "";
        const location = String(episode.location || "").trim();
        const hasTracklist = episodeHasTracklist(episode);
        const startTs = Number(episode.broadcastStartTs || 0);
        const durSecs = episode.duration ? String(episode.duration) : "";
        const playlistHtml = hasTracklist
          ? `<div class="episode-inline-playlist" data-fip-episode-playlist="${statusKey}" data-fip-start-ts="${startTs}" data-fip-duration="${escapeHtml(durSecs)}"><div class="playlist-note">Loading tracklist...</div></div>`
          : `<div class="playlist-note">No broadcast timestamp available - tracklist cannot be loaded.</div>`;
        return `
          <div class="item">
            ${img}
            <div class="item-title">${escapeHtml(fullTitle)}</div>
            <div class="item-meta">${published ? escapeHtml(published) : "Date unknown"}</div>
            ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
            ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
            ${desc ? `<div class="item-meta muted">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "..." : ""}</div>` : ""}
            ${genresHtml}
            <div class="item-actions">
              <button class="secondary" data-fip-play-url="${escapeHtml(episodeUrl)}" data-fip-play-title="${escapeHtml(fullTitle)}" data-fip-play-program-title="${escapeHtml(programTitle)}" data-fip-play-image="${escapeHtml(episode.image || "")}" data-fip-track-start-ts="${escapeHtml(String(startTs || 0))}" data-fip-track-duration="${escapeHtml(durSecs)}">Play</button>
              <button class="secondary" data-fip-play-local-url="${escapeHtml(episodeUrl)}" data-fip-play-local-title="${escapeHtml(fullTitle)}" data-fip-play-local-program-title="${escapeHtml(programTitle)}" data-fip-play-local-image="${escapeHtml(episode.image || "")}" data-fip-track-start-ts="${escapeHtml(String(startTs || 0))}" data-fip-track-duration="${escapeHtml(durSecs)}">Play Local</button>
              <button data-fip-download-url="${escapeHtml(episodeUrl)}" data-fip-episode-title="${escapeHtml(fullTitle)}" data-fip-program-title="${escapeHtml(programTitle)}" data-fip-published="${escapeHtml(published)}" data-fip-image="${escapeHtml(episode.image || "")}" data-fip-description="${escapeHtml(desc)}" data-fip-location="${escapeHtml(location)}" data-fip-hosts="${escapeHtml(JSON.stringify(hosts))}" data-fip-genres="${escapeHtml(JSON.stringify(episodeGenres))}">Download</button>
              <button class="secondary" data-fip-generate-cue-url="${escapeHtml(episodeUrl)}" data-fip-generate-cue-title="${escapeHtml(fullTitle)}" data-fip-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>
            </div>
            <div class="item-meta episode-status" data-fip-episode-status="${statusKey}" style="display:none;"></div>
            <div class="cue-debug-log" data-fip-episode-cue-debug="${statusKey}" style="display:none;"></div>
            ${playlistHtml}
          </div>
        `;
      }).join("");

      autoLoadPlaylists(filteredRows).catch(() => {});
    }

    async function autoLoadPlaylists(episodes) {
      if (!window.rteDownloader?.getFipEpisodeTracklist) {
        return;
      }
      const queue = (episodes || []).filter((episode) => episode.episodeUrl && episodeHasTracklist(episode));
      if (!queue.length) {
        return;
      }
      const concurrency = 3;
      let index = 0;

      async function worker() {
        while (index < queue.length) {
          const episode = queue[index];
          index += 1;
          const statusKey = encodeURIComponent(String(episode.episodeUrl || ""));
          const node = dom.episodesResult?.querySelector(`[data-fip-episode-playlist="${statusKey}"]`);
          if (!node) {
            continue;
          }
          const startTs = Number(node.getAttribute("data-fip-start-ts") || 0);
          const durationSecs = Number(node.getAttribute("data-fip-duration") || 0);
          try {
            const data = await window.rteDownloader.getFipEpisodeTracklist(episode.episodeUrl, {
              startTs: startTs || undefined,
              durationSecs: durationSecs || undefined
            });
            const tracks = Array.isArray(data) ? data : (data?.tracks || []);
            state.fipTracksByEpisode[String(episode.episodeUrl || "")] = tracks;
            node.innerHTML = tracks.length
              ? renderPlaylistTracks(tracks)
              : `<div class="playlist-note">No song data found for this episode.</div>`;
          } catch {
            node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
    }

    async function refreshLiveNow() {
      if (!dom.liveNow || !dom.stationSelect) {
        return;
      }
      const stationId = dom.stationSelect.value || "fip";
      const stationName = dom.stationSelect.options[dom.stationSelect.selectedIndex]?.text || "FIP";
      const section = dom.liveNow.closest(".nts-live-section-wrap");
      const audioWrap = section ? section.querySelector(".nts-live-audio-wrap") : dom.liveAudioWrap;
      const isPlaying = dom.liveAudio && !dom.liveAudio.paused;
      if (audioWrap && !isPlaying) {
        audioWrap.classList.add("nts-live-audio-hidden");
        audioWrap.classList.remove("nts-live-audio-at-bottom");
      }
      if (!window.rteDownloader?.getFipNowPlaying) {
        dom.liveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationName)}</strong> - Live</div><div class="nts-live-hero nts-live-hero-placeholder"><button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button></div>`;
        return;
      }
      try {
        const info = await window.rteDownloader.getFipNowPlaying(stationId);
        const title = String(info?.title || "").trim();
        const artist = String(info?.artist || "").trim();
        const coverUrl = String(info?.coverUrl || "").trim();
        const song = info?.currentSong;
        let songLine = "";
        if (song?.title) {
          songLine = `Song: ${escapeHtml(song.title)}${song.artist ? ` - ${escapeHtml(song.artist)}` : ""}`;
        } else if (title || artist) {
          songLine = artist
            ? `Song: ${escapeHtml(artist)}${title ? ` - ${escapeHtml(title)}` : ""}`
            : `Song: ${escapeHtml(title)}`;
        }
        const playBtnClass = isPlaying ? "nts-live-play-overlay live-overlay-btn hidden" : "nts-live-play-overlay live-overlay-btn";
        const parts = [];
        parts.push(`<div class="nts-live-header status"><strong>${escapeHtml(stationName)}</strong>`);
        if (songLine) {
          parts.push(`<br><span class="muted" style="font-size:0.85em">${songLine}</span>`);
        }
        parts.push("</div>");
        if (coverUrl) {
          parts.push('<div class="nts-live-hero">');
          parts.push(`<img src="${escapeHtml(coverUrl)}" alt="" class="nts-live-hero-img" loading="lazy" />`);
          parts.push(`<button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button>`);
          parts.push("</div>");
        } else {
          parts.push('<div class="nts-live-hero nts-live-hero-placeholder">');
          parts.push(`<button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button>`);
          parts.push('<a href="https://www.radiofrance.fr/fip" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">radiofrance.fr/fip</a>');
          parts.push("</div>");
        }
        dom.liveNow.innerHTML = parts.join("");
      } catch {
        const playBtnClass = isPlaying ? "nts-live-play-overlay live-overlay-btn hidden" : "nts-live-play-overlay live-overlay-btn";
        dom.liveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationName)}</strong> - Live</div><div class="nts-live-hero nts-live-hero-placeholder"><button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button></div>`;
      }
    }

    async function loadProgram(programUrlOrSlug, page = 1) {
      if (!window.rteDownloader?.getFipProgramEpisodes) {
        return;
      }
      const perPage = getEpisodesPerPage();
      const serverPage = Math.max(1, Math.ceil((((Number(page) || 1) - 1) * perPage + 1) / 20));
      const payload = await window.rteDownloader.getFipProgramEpisodes(programUrlOrSlug, serverPage);
      const totalItems = Number(payload?.totalItems || 0);
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage) || payload?.numPages || 1);
      const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
      const clientOffset = ((targetPage - 1) * perPage) % 20;
      if (payload.episodes) {
        payload.episodes = payload.episodes.slice(clientOffset, clientOffset + perPage);
      }
      state.fipProgramUrl = payload.programUrl || programUrlOrSlug;
      state.fipProgramPage = targetPage;
      state.fipProgramMaxPages = totalPages;
      state.fipEpisodesPayload = payload;
      if (dom.programUrlInput) {
        dom.programUrlInput.value = state.fipProgramUrl;
      }
      if (dom.programMeta) {
        const desc = String(payload.description || "").trim();
        const img = String(payload.image || "").trim();
        const hosts = normalizeMetadataList(payload.hosts);
        const genres = Array.isArray(payload.genres) ? payload.genres : [];
        const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
        const airtime = String(payload.airtime || "").trim();
        const cadence = String(payload.cadence || "").trim();
        const cadenceBadge = cadence && cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
        dom.programMeta.innerHTML = `
          ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
          <strong>${escapeHtml(payload.title || "FIP")}</strong>${cadenceBadge}<br>
          ${airtime ? `<span class="muted">${escapeHtml(airtime)}</span><br>` : ""}
          ${hosts.length ? `<span class="muted">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</span><br>` : ""}
          ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 300))}${desc.length > 300 ? "..." : ""}</span><br>` : ""}
          ${genresHtml}
          Page ${state.fipProgramPage} of ${state.fipProgramMaxPages}${totalItems ? ` - ${totalItems} episodes` : ""}
        `;
      }
      renderEpisodes(payload);
      focusProgramExplorer(page);
    }

    async function refreshSchedules() {
      if (!dom.scheduleList || !window.rteDownloader?.listFipSchedules) {
        return;
      }
      const schedules = await window.rteDownloader.listFipSchedules();
      dom.scheduleList.innerHTML = schedules.length
        ? schedules.map((schedule) => renderSchedulerCard(schedule, "fip")).join("")
        : `<div class="item">No FIP schedules yet.</div>`;
    }

    async function runProgramSearch(query) {
      if (!window.rteDownloader?.searchFipPrograms || !dom.programSearchResult) {
        return;
      }
      const safeQuery = String(query || "").trim();
      if (!safeQuery) {
        dom.programSearchResult.innerHTML = `<div class="item muted">Enter a search term.</div>`;
        dom.programSearchResult.classList.remove("hidden");
        return;
      }
      dom.programSearchResult.innerHTML = `<div class="item muted">Searching...</div>`;
      dom.programSearchResult.classList.remove("hidden");
      try {
        const data = await window.rteDownloader.searchFipPrograms(safeQuery);
        lastSearchRows = Array.isArray(data?.results) ? data.results : [];
        const results = filterProgramRows(lastSearchRows);
        dom.programSearchResult.innerHTML = results.length
          ? results.map((result) => renderShowCard(result)).join("")
          : `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No results found."}</div>`;
      } catch (error) {
        dom.programSearchResult.innerHTML = `<div class="item muted error">Search failed: ${escapeHtml(error.message)}</div>`;
      }
    }

    async function runDiscovery() {
      if (!window.rteDownloader?.getFipDiscovery || !dom.discoveryResult || !dom.discoverBtn) {
        return;
      }
      setButtonBusy(dom.discoverBtn, true, "Discover Shows", "Loading...");
      dom.discoveryResult.innerHTML = `<div class="item muted">Fetching random shows...</div>`;
      try {
        const data = await window.rteDownloader.getFipDiscovery(getDiscoveryCount());
        lastDiscoveryRows = Array.isArray(data?.results) ? data.results : [];
        const results = filterProgramRows(lastDiscoveryRows);
        dom.discoveryResult.innerHTML = results.length
          ? results.map((result) => renderShowCard(result, { showScheduleBtn: true })).join("")
          : `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No shows found."}</div>`;
      } catch (error) {
        dom.discoveryResult.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(error.message)}</div>`;
      } finally {
        setButtonBusy(dom.discoverBtn, false, "Discover Shows");
      }
    }

    async function handleQuickDownload() {
      const pageUrl = String(dom.urlInput?.value || "").trim();
      if (!pageUrl) {
        setStatus("Enter a FIP URL.", true);
        return;
      }
      const forceDownload = dom.downloadBtn?.dataset.forceNext === "1";
      if (forceDownload && dom.downloadBtn) {
        delete dom.downloadBtn.dataset.forceNext;
      }
      setButtonBusy(dom.downloadBtn, true, "Download");
      setStatus(forceDownload ? "Forcing re-download..." : "Resolving stream...");
      if (dom.log) {
        dom.log.textContent = "";
      }
      const progressToken = createProgressToken("fip");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setStatus(formatProgressText(progress, "Downloading..."));
      });
      try {
        const data = await window.rteDownloader.downloadFromFipUrl(pageUrl, progressToken, { forceDownload });
        const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
        const statusPrefix = data?.existing ? "Already downloaded" : "Saved";
        const hintText = data?.existing ? " (click Download again to force re-download)" : "";
        setStatus(`${statusPrefix}: ${data.outputDir}\\${data.fileName}${cueText}${hintText}`);
        if (dom.downloadBtn) {
          if (data?.existing) {
            dom.downloadBtn.dataset.forceNext = "1";
          } else {
            delete dom.downloadBtn.dataset.forceNext;
          }
        }
      } catch (error) {
        if (dom.downloadBtn && shouldArmForceRetry(error?.message)) {
          dom.downloadBtn.dataset.forceNext = "1";
        }
        setStatus(error.message, true);
      } finally {
        detachProgress();
        setButtonBusy(dom.downloadBtn, false, "Download");
      }
    }

    async function handleEpisodeClick(event) {
      const playLocalBtn = event.target.closest("button[data-fip-play-local-url]");
      if (playLocalBtn) {
        const episodeUrl = playLocalBtn.getAttribute("data-fip-play-local-url") || "";
        const playTitle = playLocalBtn.getAttribute("data-fip-play-local-title") || "";
        const playProgramTitle = playLocalBtn.getAttribute("data-fip-play-local-program-title") || "";
        const playImage = playLocalBtn.getAttribute("data-fip-play-local-image") || "";
        const trackStartTs = Number(playLocalBtn.getAttribute("data-fip-track-start-ts") || 0);
        const trackDuration = Number(playLocalBtn.getAttribute("data-fip-track-duration") || 0);
        const saved = state.fipDownloadedAudioByEpisode[episodeUrl];
        if (!saved?.outputDir || !saved?.fileName) {
          setEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
          return;
        }
        setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
        try {
          await playEpisodeWithBackgroundCue({
            sourceType: "fip",
            cacheKey: episodeUrl,
            sourceLabel: "FIP Local",
            title: playTitle || saved.fileName,
            programTitle: playProgramTitle || "",
            subtitle: "",
            image: playImage,
            episodeUrl,
            durationSeconds: 0,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            playbackKey: `fip:local:${episodeUrl}`,
            trackFetchOptions: {
              startTs: trackStartTs || undefined,
              durationSecs: trackDuration || undefined
            },
            statusUpdater: (text, isError = false) => setEpisodeStatus(episodeUrl, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playLocalBtn, false, "Play Local");
        }
        return;
      }

      const playBtn = event.target.closest("button[data-fip-play-url]");
      if (playBtn) {
        const playUrl = playBtn.getAttribute("data-fip-play-url") || "";
        const playTitle = playBtn.getAttribute("data-fip-play-title") || "";
        const playProgramTitle = playBtn.getAttribute("data-fip-play-program-title") || "";
        const playImage = playBtn.getAttribute("data-fip-play-image") || "";
        const trackStartTs = Number(playBtn.getAttribute("data-fip-track-start-ts") || 0);
        const trackDuration = Number(playBtn.getAttribute("data-fip-track-duration") || 0);
        setButtonBusy(playBtn, true, "Play", "Loading...");
        try {
          const stream = await window.rteDownloader.getFipEpisodeStream(playUrl);
          await playEpisodeWithBackgroundCue({
            sourceType: "fip",
            cacheKey: playUrl,
            sourceLabel: "FIP",
            title: playTitle || stream?.title || "Episode",
            programTitle: playProgramTitle || "",
            subtitle: "",
            image: playImage || stream?.image || "",
            episodeUrl: playUrl,
            durationSeconds: 0,
            streamUrl: stream?.streamUrl || "",
            playbackKey: `fip:remote:${playUrl}`,
            trackFetchOptions: {
              startTs: trackStartTs || undefined,
              durationSecs: trackDuration || undefined
            },
            statusUpdater: (text, isError = false) => setEpisodeStatus(playUrl, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(playUrl, `Play failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playBtn, false, "Play");
        }
        return;
      }

      const cueBtn = event.target.closest("button[data-fip-generate-cue-url]");
      if (cueBtn) {
        const episodeUrl = cueBtn.getAttribute("data-fip-generate-cue-url") || "";
        const title = cueBtn.getAttribute("data-fip-generate-cue-title") || "fip-episode";
        const programTitle = cueBtn.getAttribute("data-fip-generate-cue-program-title") || "FIP";
        const saved = state.fipDownloadedAudioByEpisode[episodeUrl];
        if (!saved) {
          setEpisodeStatus(episodeUrl, "Download episode first, then generate CUE.", true);
          return;
        }
        setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
        setEpisodeStatus(episodeUrl, "Generating CUE/chapters...");
        clearCueDebugLog("fip", episodeUrl);
        const cueProgressToken = createProgressToken(`fip-cue-${Date.now()}`);
        const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
          if (progress?.kind === "cue" && progress?.message) {
            appendCueDebugLog("fip", episodeUrl, progress.message);
          }
          setEpisodeStatus(episodeUrl, formatProgressText(progress, "Generating CUE/chapters..."));
        });
        try {
          const cue = await window.rteDownloader.generateCue({
            sourceType: "fip",
            episodeUrl,
            title,
            programTitle,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            progressToken: cueProgressToken
          });
          setEpisodeChapters(episodeUrl, cue.chapters || []);
          setEpisodeStatus(episodeUrl, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
        } catch (error) {
          setEpisodeStatus(episodeUrl, `CUE failed: ${error.message}`, true);
        } finally {
          detachCueProgress();
          setButtonBusy(cueBtn, false, "Generate CUE");
        }
        return;
      }

      const downloadBtn = event.target.closest("button[data-fip-download-url]");
      if (!downloadBtn) {
        return;
      }
      const episodeUrl = downloadBtn.getAttribute("data-fip-download-url") || "";
      const title = downloadBtn.getAttribute("data-fip-episode-title") || "fip-episode";
      const programTitle = downloadBtn.getAttribute("data-fip-program-title") || "FIP";
      const publishedTime = downloadBtn.getAttribute("data-fip-published") || "";
      const image = downloadBtn.getAttribute("data-fip-image") || "";
      const description = downloadBtn.getAttribute("data-fip-description") || "";
      const location = downloadBtn.getAttribute("data-fip-location") || "";
      const hosts = parseMetadataAttr(downloadBtn.getAttribute("data-fip-hosts"));
      const genres = parseMetadataAttr(downloadBtn.getAttribute("data-fip-genres"));
      setEpisodeStatus(episodeUrl, "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("fip-episode");
      const detach = attachDownloadProgress(progressToken, (progress) => setEpisodeStatus(episodeUrl, formatProgressText(progress, "Downloading...")));
      try {
        const data = await window.rteDownloader.downloadFromFipUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image, description, location, hosts, genres });
        state.fipDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
        if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
          setEpisodeChapters(episodeUrl, data.cue.chapters);
        }
        const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
        setEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}${cueText}`);
      } catch (error) {
        setEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
      } finally {
        detach();
        setButtonBusy(downloadBtn, false, "Download");
      }
    }

    async function handleScheduleClick(event) {
      const playLatestBtn = event.target.closest("button[data-fip-schedule-play-output]");
      if (playLatestBtn) {
        try {
          await playFromDownloadedFile({
            outputDir: playLatestBtn.getAttribute("data-fip-schedule-play-output"),
            fileName: playLatestBtn.getAttribute("data-fip-schedule-play-file"),
            title: playLatestBtn.getAttribute("data-fip-schedule-play-title") || "",
            source: "FIP Local",
            subtitle: "Latest scheduled download",
            image: playLatestBtn.getAttribute("data-fip-schedule-play-image") || "",
            episodeUrl: playLatestBtn.getAttribute("data-fip-schedule-play-episode-url") || "",
            sourceType: playLatestBtn.getAttribute("data-fip-schedule-play-source-type") || "fip"
          });
        } catch (error) {
          setEpisodeStatus("", `Play failed: ${error.message}`, true);
        }
        return;
      }

      const toggleBtn = event.target.closest("button[data-fip-schedule-toggle]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-fip-schedule-toggle");
        const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
        await window.rteDownloader.setFipScheduleEnabled(id, enabled);
        await refreshSchedules();
        return;
      }

      const runBtn = event.target.closest("button[data-fip-schedule-run]");
      if (runBtn) {
        const id = runBtn.getAttribute("data-fip-schedule-run");
        const statusEl = dom.scheduleList?.querySelector(`[data-fip-schedule-status="${id}"]`);
        if (statusEl) {
          statusEl.style.display = "block";
          statusEl.textContent = "Running...";
        }
        try {
          await window.rteDownloader.runFipScheduleNow(id);
          await refreshSchedules();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = `Error: ${error.message}`;
          }
        }
        return;
      }

      const removeBtn = event.target.closest("button[data-fip-schedule-remove]");
      if (removeBtn) {
        const id = removeBtn.getAttribute("data-fip-schedule-remove");
        await window.rteDownloader.removeFipSchedule(id);
        await refreshSchedules();
      }
    }

    function bindSearchResultClick(listEl) {
      listEl?.addEventListener("click", async (event) => {
        const schedBtn = event.target.closest(".fip-quick-schedule-btn");
        if (schedBtn) {
          event.stopPropagation();
          const url = schedBtn.getAttribute("data-fip-schedule-url") || "";
          if (!url || !window.rteDownloader?.addFipSchedule) {
            return;
          }
          schedBtn.textContent = "Adding...";
          schedBtn.disabled = true;
          try {
            const backfillMode = dom.scheduleBackfillMode ? dom.scheduleBackfillMode.value : "new-only";
            const backfillCount = backfillMode === "backfill"
              ? Math.max(1, Math.min(100, Number(dom.scheduleBackfillCount?.value || 5)))
              : 0;
            await window.rteDownloader.addFipSchedule(url, { backfillCount });
            schedBtn.textContent = "Scheduled";
            await refreshSchedules();
          } catch {
            schedBtn.textContent = "Error";
            schedBtn.disabled = false;
          }
          return;
        }
        const item = event.target.closest("[data-fip-program-url]");
        if (!item) {
          return;
        }
        const url = item.getAttribute("data-fip-program-url") || "";
        if (url && dom.programUrlInput) {
          dom.programUrlInput.value = url;
        }
        listEl.classList.add("hidden");
        if (url) {
          setButtonBusy(dom.loadProgramBtn, true, "Load Episodes");
          loadProgram(url, 1)
            .catch(() => {
              if (dom.programMeta) {
                dom.programMeta.textContent = "Error loading show.";
              }
            })
            .finally(() => setButtonBusy(dom.loadProgramBtn, false, "Load Episodes"));
        }
      });
    }

    function bindEvents() {
      dom.liveNow?.addEventListener("click", (event) => {
        const playBtn = event.target.closest(".nts-live-play-overlay");
        if (!playBtn || !dom.stationSelect || !dom.liveAudio) {
          return;
        }
        const option = dom.stationSelect.options[dom.stationSelect.selectedIndex];
        const streamUrl = (option && option.getAttribute("data-stream-url")) || "";
        if (!streamUrl) {
          return;
        }
        dom.liveAudio.src = streamUrl;
        dom.liveAudio.play().catch(() => {});
        playBtn.classList.add("hidden");
        const section = dom.liveNow.closest(".nts-live-section-wrap");
        const audioWrap = section ? section.querySelector(".nts-live-audio-wrap") : dom.liveAudioWrap;
        if (audioWrap) {
          audioWrap.classList.remove("nts-live-audio-hidden");
          audioWrap.classList.add("nts-live-audio-at-bottom");
        }
      });

      dom.stationSelect?.addEventListener("change", () => {
        const option = dom.stationSelect.options[dom.stationSelect.selectedIndex];
        const streamUrl = (option && option.getAttribute("data-stream-url")) || "";
        if (dom.liveAudio && !dom.liveAudio.paused) {
          dom.liveAudio.src = streamUrl;
          if (streamUrl) {
            dom.liveAudio.play().catch(() => {});
          }
        }
        refreshLiveNow().catch(() => {});
      });

      dom.refreshLiveBtn?.addEventListener("click", () => {
        refreshLiveNow().catch(() => {});
      });

      dom.downloadBtn?.addEventListener("click", () => {
        handleQuickDownload().catch(() => {});
      });
      dom.urlInput?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        dom.downloadBtn?.click();
      });

      dom.programSearchBtn?.addEventListener("click", () => {
        runProgramSearch(dom.programSearchInput?.value || "").catch(() => {});
      });
      dom.programSearchInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          dom.programSearchBtn?.click();
        }
      });
      dom.programSearchInput?.addEventListener("input", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => dom.programSearchBtn?.click(), 400);
      });

      dom.programResultFilterInput?.addEventListener("input", () => {
        if (dom.programSearchResult && !dom.programSearchResult.classList.contains("hidden")) {
          const results = filterProgramRows(lastSearchRows);
          dom.programSearchResult.innerHTML = results.length
            ? results.map((result) => renderShowCard(result)).join("")
            : `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No results found."}</div>`;
        }
        if (dom.discoveryResult) {
          const results = filterProgramRows(lastDiscoveryRows);
          dom.discoveryResult.innerHTML = results.length
            ? results.map((result) => renderShowCard(result, { showScheduleBtn: true })).join("")
            : `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No shows found."}</div>`;
        }
      });

      dom.loadProgramBtn?.addEventListener("click", () => {
        const url = dom.programUrlInput ? dom.programUrlInput.value.trim() : "";
        if (!url) {
          return;
        }
        setButtonBusy(dom.loadProgramBtn, true, "Load Episodes");
        loadProgram(url, 1)
          .catch(() => {
            if (dom.programMeta) {
              dom.programMeta.textContent = "Error loading show.";
            }
          })
          .finally(() => setButtonBusy(dom.loadProgramBtn, false, "Load Episodes"));
      });

      dom.prevPageBtn?.addEventListener("click", () => {
        if (state.fipProgramPage <= 1 || !state.fipProgramUrl) {
          return;
        }
        loadProgram(state.fipProgramUrl, state.fipProgramPage - 1).catch(() => {});
      });
      dom.nextPageBtn?.addEventListener("click", () => {
        if (state.fipProgramPage >= state.fipProgramMaxPages || !state.fipProgramUrl) {
          return;
        }
        loadProgram(state.fipProgramUrl, state.fipProgramPage + 1).catch(() => {});
      });

      dom.episodeFilterInput?.addEventListener("input", () => {
        renderEpisodes(state.fipEpisodesPayload || { episodes: [] });
      });

      dom.addScheduleBtn?.addEventListener("click", async () => {
        const programUrl = dom.programUrlInput ? dom.programUrlInput.value.trim() : "";
        if (!programUrl || !window.rteDownloader?.addFipSchedule) {
          return;
        }
        const backfillMode = dom.scheduleBackfillMode ? dom.scheduleBackfillMode.value : "new-only";
        const backfillCount = backfillMode === "backfill"
          ? Math.max(1, Math.min(100, Number(dom.scheduleBackfillCount?.value || 5)))
          : 0;
        setButtonBusy(dom.addScheduleBtn, true, "Add Scheduler", "Adding...");
        try {
          await window.rteDownloader.addFipSchedule(programUrl, { backfillCount });
          await refreshSchedules();
        } catch (error) {
          if (dom.programMeta) {
            dom.programMeta.textContent = `Scheduler error: ${error.message}`;
          }
        } finally {
          setButtonBusy(dom.addScheduleBtn, false, "Add Scheduler");
        }
      });

      dom.discoverBtn?.addEventListener("click", () => {
        runDiscovery().catch(() => {});
      });

      bindSearchResultClick(dom.programSearchResult);
      bindSearchResultClick(dom.discoveryResult);

      dom.episodesResult?.addEventListener("click", (event) => {
        handleEpisodeClick(event).catch(() => {});
      });
      dom.scheduleList?.addEventListener("click", (event) => {
        handleScheduleClick(event).catch(() => {});
      });
    }

    bindEvents();

    return {
      refreshLiveNow,
      setEpisodeStatus,
      setEpisodeChapters,
      loadProgram,
      refreshSchedules,
      runProgramSearch,
      runDiscovery
    };
  }

  window.KimbleFipScreen = {
    create: createFipScreen
  };
})();
