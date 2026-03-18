(function initKimbleNtsScreen() {
  function createNtsScreen(deps) {
    const state = deps.state;
    const dom = deps.dom || {};
    const escapeHtml = deps.escapeHtml;
    const setButtonBusy = deps.setButtonBusy;
    const toLocalSchedule = deps.toLocalSchedule;
    const localizeNextBroadcast = deps.localizeNextBroadcast;
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
    const formatNtsTimeSlotLocal = deps.formatNtsTimeSlotLocal;
    const setCachedChapters = deps.setCachedChapters;
    const shouldArmForceRetry = deps.shouldArmForceRetry;

    let searchDebounceTimer = null;
    let lastSearchRows = [];
    let lastDiscoveryRows = [];
    let selectedDiscoveryProgram = "";

    function normalizeProgramRows(payload) {
      if (Array.isArray(payload?.results)) {
        return payload.results;
      }
      return Array.isArray(payload) ? payload : [];
    }

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
        episode?.showName,
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
        show?.runSchedule,
        show?.nextBroadcastTitle,
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

    function renderDiscoveryResults(rows, note = "") {
      if (!dom.discoveryResult) {
        return;
      }
      const list = filterProgramRows(normalizeProgramRows(rows));
      if (!list.length) {
        dom.discoveryResult.innerHTML = `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No shows found."}</div>`;
        return;
      }
      const noteHtml = note
        ? `<div class="item muted">${escapeHtml(note)}</div>`
        : `<div class="item muted">Select a host to load episodes. Discovery results stay here so you can keep browsing.</div>`;
      dom.discoveryResult.classList.remove("hidden");
      dom.discoveryResult.innerHTML = `${noteHtml}${list.map((show) => renderShowCard(show, { showScheduleBtn: true, selectedProgramUrl: selectedDiscoveryProgram })).join("")}`;
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
      const node = dom.episodesResult?.querySelector(`[data-nts-episode-status="${key}"]`);
      if (!node) {
        return;
      }
      const safeText = String(text || "");
      node.textContent = safeText;
      node.style.display = safeText ? "block" : "none";
      node.className = `item-meta episode-status ${isError ? "error" : ""}`;
    }

    function focusProgramExplorer(page = 1) {
      if (Number(page) !== 1) {
        return;
      }
      dom.programMeta?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderShowCard(show, options = {}) {
      const showScheduleBtn = Boolean(options.showScheduleBtn);
      const selectedProgramUrl = String(options.selectedProgramUrl || "").trim();
      const programUrl = String(show.programUrl || "").trim();
      const title = String(show.title || programUrl || "NTS Show").trim();
      const description = String(show.description || "").trim();
      const cadence = String(show.cadence || "").trim();
      const location = String(show.location || "").trim();
      const hosts = normalizeMetadataList(show.hosts);
      const genres = Array.isArray(show.genres) ? show.genres : [];
      const image = String(show.image || "").trim();
      const nextBroadcast = show.nextBroadcastAt
        ? `${escapeHtml(localizeNextBroadcast(show.nextBroadcastAt))}${show.nextBroadcastTitle ? ` - ${escapeHtml(show.nextBroadcastTitle)}` : ""}`
        : "";
      const scheduleHtml = show.runSchedule
        ? `<div class="item-meta">${escapeHtml(toLocalSchedule(show.runSchedule))}</div>`
        : nextBroadcast
          ? `<div class="item-meta">${nextBroadcast}</div>`
          : "";
      const genresHtml = genres.length
        ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      const cadenceBadge = cadence && cadence !== "irregular"
        ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>`
        : "";
      const locationBadge = location ? ` <span class="genre-pill">${escapeHtml(location)}</span>` : "";
      const selectedClass = selectedProgramUrl && selectedProgramUrl === programUrl ? " item-selected" : "";
      return `
        <div class="item clickable${selectedClass}" data-nts-program-url="${escapeHtml(programUrl)}" data-nts-program-title="${escapeHtml(title)}">
          <div class="search-card">
            <div>${image ? `<img src="${escapeHtml(image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
            <div>
              <div class="item-title">${escapeHtml(title)}${cadenceBadge}${locationBadge}</div>
              ${scheduleHtml}
              ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
              ${description ? `<div class="item-meta">${escapeHtml(description.slice(0, 180))}${description.length > 180 ? "..." : ""}</div>` : ""}
              ${genresHtml}
              ${showScheduleBtn ? `<div class="item-actions" style="margin-top:0.5rem;"><button class="secondary nts-quick-schedule-btn" data-nts-schedule-url="${escapeHtml(programUrl)}">Quick Schedule</button></div>` : ""}
            </div>
          </div>
        </div>
      `;
    }

    async function autoLoadPlaylists(episodes) {
      if (!window.rteDownloader?.getNtsEpisodePlaylist) {
        return;
      }
      const queue = (episodes || []).filter((episode) => episode.episodeUrl);
      const concurrency = 3;
      let index = 0;

      async function worker() {
        while (index < queue.length) {
          const episode = queue[index];
          index += 1;
          const statusKey = encodeURIComponent(String(episode.episodeUrl || ""));
          const node = dom.episodesResult?.querySelector(`[data-nts-episode-playlist="${statusKey}"]`);
          if (!node) {
            continue;
          }
          try {
            const data = await window.rteDownloader.getNtsEpisodePlaylist(episode.episodeUrl);
            const tracks = data?.tracks || [];
            state.ntsTracksByEpisode[String(episode.episodeUrl || "")] = tracks;
            node.innerHTML = tracks.length
              ? renderPlaylistTracks(tracks)
              : `<div class="playlist-note">No tracklist available.</div>`;
          } catch {
            node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
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
        const programTitle = String(payload?.title || episode.showName || "NTS").trim();
        const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
        const hosts = normalizeMetadataList(episode.hosts);
        const episodeGenres = Array.isArray(episode.genres) ? episode.genres : [];
        const genresHtml = episodeGenres.length
          ? `<div class="genre-pills">${episodeGenres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
          : "";
        const location = String(episode.location || "").trim();
        const description = String(episode.description || "").trim();
        const locationHtml = location ? `<div class="item-meta">${escapeHtml(location)}</div>` : "";
        return `
          <div class="item">
            ${img}
            <div class="item-title">${escapeHtml(fullTitle)}</div>
            <div class="item-meta">${published ? escapeHtml(published) : "Date unknown"}</div>
            ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
            ${locationHtml}
            ${genresHtml}
            <div class="item-actions">
              <button class="secondary" data-nts-play-url="${escapeHtml(episodeUrl)}" data-nts-play-title="${escapeHtml(fullTitle)}" data-nts-play-program-title="${escapeHtml(programTitle)}" data-nts-play-image="${escapeHtml(episode.image || "")}">Play</button>
              <button class="secondary" data-nts-play-local-url="${escapeHtml(episodeUrl)}" data-nts-play-local-title="${escapeHtml(fullTitle)}" data-nts-play-local-program-title="${escapeHtml(programTitle)}" data-nts-play-local-image="${escapeHtml(episode.image || "")}">Play Local</button>
              <button data-nts-download-url="${escapeHtml(episodeUrl)}" data-nts-episode-title="${escapeHtml(fullTitle)}" data-nts-program-title="${escapeHtml(programTitle)}" data-nts-published="${escapeHtml(published)}" data-nts-image="${escapeHtml(episode.image || "")}" data-nts-description="${escapeHtml(description)}" data-nts-location="${escapeHtml(location)}" data-nts-hosts="${escapeHtml(JSON.stringify(hosts))}" data-nts-genres="${escapeHtml(JSON.stringify(episodeGenres))}">Download</button>
              <button class="secondary" data-nts-generate-cue-url="${escapeHtml(episodeUrl)}" data-nts-generate-cue-title="${escapeHtml(fullTitle)}" data-nts-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>
            </div>
            <div class="item-meta episode-status" data-nts-episode-status="${statusKey}" style="display:none;"></div>
            <div class="cue-debug-log" data-nts-episode-cue-debug="${statusKey}" style="display:none;"></div>
            <div class="episode-inline-playlist" data-nts-episode-playlist="${statusKey}">
              <div class="playlist-note">Loading tracklist...</div>
            </div>
          </div>
        `;
      }).join("");

      autoLoadPlaylists(filteredRows).catch(() => {});
    }

    async function loadProgram(programUrlOrSlug, page = 1) {
      if (!window.rteDownloader?.getNtsProgramEpisodes) {
        return;
      }
      const perPage = getEpisodesPerPage();
      const serverPage = Math.max(1, Math.ceil((((Number(page) || 1) - 1) * perPage + 1) / 20));
      const payload = await window.rteDownloader.getNtsProgramEpisodes(programUrlOrSlug, serverPage);
      const totalItems = Number(payload?.totalItems || 0);
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
      const clientOffset = ((targetPage - 1) * perPage) % 20;
      if (payload.episodes) {
        payload.episodes = payload.episodes.slice(clientOffset, clientOffset + perPage);
      }
      state.ntsProgramUrl = payload.programUrl || programUrlOrSlug;
      state.ntsProgramPage = targetPage;
      state.ntsProgramMaxPages = totalPages;
      state.ntsEpisodesPayload = payload;
      if (dom.programUrlInput) {
        dom.programUrlInput.value = state.ntsProgramUrl;
      }
      if (dom.programMeta) {
        const desc = String(payload.description || "").trim();
        const img = String(payload.image || "").trim();
        const hosts = normalizeMetadataList(payload.hosts);
        const genres = Array.isArray(payload.genres) ? payload.genres : [];
        const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
        const cadence = String(payload.cadence || "").trim();
        const cadenceBadge = cadence && cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
        const locationBadge = payload.location ? ` <span class="genre-pill">${escapeHtml(payload.location)}</span>` : "";
        dom.programMeta.innerHTML = `
          ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
          <strong>${escapeHtml(payload.title || "NTS")}</strong>${cadenceBadge}${locationBadge}<br>
          ${hosts.length ? `<span class="muted">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</span><br>` : ""}
          ${payload.runSchedule ? `<span class="muted">Airs: ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
          ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` - ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
          ${desc ? `<span class="muted">${escapeHtml(desc)}</span><br>` : ""}
          ${genresHtml}
          Page ${state.ntsProgramPage} of ${state.ntsProgramMaxPages} - ${Number(payload?.totalItems || 0)} episodes
        `;
      }
      renderEpisodes(payload);
      focusProgramExplorer(page);
    }

    async function refreshSchedules() {
      if (!dom.scheduleList || !window.rteDownloader?.listNtsSchedules) {
        return;
      }
      const schedules = await window.rteDownloader.listNtsSchedules();
      dom.scheduleList.innerHTML = schedules.length
        ? schedules.map((schedule) => renderSchedulerCard(schedule, "nts")).join("")
        : `<div class="item">No NTS schedules yet.</div>`;
    }

    async function ensureLiveStationsLoaded() {
      if (!dom.stationSelect || state.ntsLiveStations.length > 0 || !window.rteDownloader?.getNtsLiveStations) {
        return;
      }
      const stations = await window.rteDownloader.getNtsLiveStations();
      state.ntsLiveStations = stations || [];
      dom.stationSelect.innerHTML = state.ntsLiveStations.map((station) => {
        const streamUrl = String(station.streamUrl || "").trim();
        return `<option value="${escapeHtml(station.id)}"${streamUrl ? ` data-stream-url="${escapeHtml(streamUrl)}"` : ""}>${escapeHtml(station.name)}</option>`;
      }).join("");
      const firstWithStream = state.ntsLiveStations.find((station) => String(station.streamUrl || "").trim());
      if (firstWithStream && dom.liveAudio) {
        dom.liveAudio.src = firstWithStream.streamUrl || "";
      }
    }

    async function refreshLiveNow() {
      if (!dom.liveNow || !dom.stationSelect) {
        return;
      }
      const channelId = dom.stationSelect.value || "nts1";
      const stationLabel = (state.ntsLiveStations || []).find((station) => String(station.id) === channelId)?.name || (channelId === "nts2" ? "NTS 2" : "NTS 1");
      const ntsSection = dom.liveNow.closest(".nts-live-section-wrap");
      const audioWrap = ntsSection ? ntsSection.querySelector(".nts-live-audio-wrap") : dom.liveAudio?.parentElement;
      if (audioWrap) {
        audioWrap.classList.add("nts-live-audio-hidden");
        audioWrap.classList.remove("nts-live-audio-at-bottom");
      }
      if (!window.rteDownloader?.getNtsLiveNow) {
        dom.liveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationLabel)}</strong> - Live<br><span class="muted">Select a station to stream.</span></div><div class="nts-live-hero nts-live-hero-placeholder"><span class="nts-live-location-overlay"></span><a href="https://www.nts.live/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">nts.live</a></div>`;
        return;
      }
      try {
        const info = await window.rteDownloader.getNtsLiveNow(channelId);
        const img = String(info.image || "").trim();
        const programmeName = info.programmeName || "Live";
        const description = String(info.description || "").trim();
        const location = String(info.location || "").trim();
        const timeSlotLocal = formatNtsTimeSlotLocal(info.startTimestamp, info.endTimestamp);
        const timeSlotDisplay = timeSlotLocal || String(info.timeSlot || "").trim();
        const line1Parts = [`<strong>${escapeHtml(info.stationName || stationLabel)}</strong> - ${escapeHtml(programmeName)}`];
        if (timeSlotDisplay) {
          line1Parts.push(` (${escapeHtml(timeSlotDisplay)})`);
        }
        const parts = [];
        parts.push(`<div class="nts-live-header status">${line1Parts.join("")}`);
        if (description) {
          parts.push(`<br><span class="muted">${escapeHtml(description)}</span>`);
        }
        parts.push("</div>");
        if (img) {
          parts.push('<div class="nts-live-hero">');
          parts.push(`<img src="${escapeHtml(img)}" alt="" class="nts-live-hero-img" loading="lazy" />`);
          if (location) {
            parts.push(`<span class="nts-live-location-overlay">${escapeHtml(location)}</span>`);
          }
          parts.push('<button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button>');
          parts.push("</div>");
        } else {
          parts.push('<div class="nts-live-hero nts-live-hero-placeholder">');
          if (location) {
            parts.push(`<span class="nts-live-location-overlay">${escapeHtml(location)}</span>`);
          }
          parts.push('<button type="button" class="nts-live-play-overlay live-overlay-btn" aria-label="Play Live">Play Live</button>');
          parts.push('<a href="https://www.nts.live/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">nts.live</a>');
          parts.push("</div>");
        }
        dom.liveNow.innerHTML = parts.join("");
      } catch {
        dom.liveNow.innerHTML = `<div class="nts-live-header status muted"><strong>${escapeHtml(stationLabel)}</strong> - Live<br><span class="muted">Stream loading. Click Refresh to fetch current show.</span></div><div class="nts-live-hero nts-live-hero-placeholder"><a href="https://www.nts.live/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">nts.live</a></div>`;
      }
    }

    async function runProgramSearch(query) {
      if (!window.rteDownloader?.searchNtsPrograms || !dom.programSearchResult) {
        return;
      }
      dom.programSearchResult.classList.remove("hidden");
      dom.programSearchResult.innerHTML = `<div class="item">Searching...</div>`;
      try {
        const results = await window.rteDownloader.searchNtsPrograms(query || "", { sort: "recent" });
        lastSearchRows = normalizeProgramRows(results);
        const rows = filterProgramRows(lastSearchRows);
        if (!rows.length) {
          dom.programSearchResult.innerHTML = `<div class="item">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No NTS shows found."}</div>`;
          return;
        }
        dom.programSearchResult.innerHTML = rows.map((show) => renderShowCard(show, { showScheduleBtn: true })).join("");
      } catch (error) {
        dom.programSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
      }
    }

    async function runDiscovery() {
      if (!window.rteDownloader?.getNtsDiscovery || !dom.discoveryResult || !dom.discoverBtn) {
        return;
      }
      setButtonBusy(dom.discoverBtn, true, "Discover Shows", "Loading...");
      dom.discoveryResult.innerHTML = `<div class="item muted">Fetching random shows...</div>`;
      try {
        const results = await window.rteDownloader.getNtsDiscovery(getDiscoveryCount());
        const rows = normalizeProgramRows(results);
        if (!rows.length) {
          if (lastDiscoveryRows.length) {
            renderDiscoveryResults(lastDiscoveryRows, "No new shows found. Keeping your last discovery set.");
          } else {
            dom.discoveryResult.innerHTML = `<div class="item muted">No shows found.</div>`;
          }
          return;
        }
        lastDiscoveryRows = rows;
        selectedDiscoveryProgram = "";
        renderDiscoveryResults(rows);
      } catch (error) {
        if (lastDiscoveryRows.length) {
          renderDiscoveryResults(lastDiscoveryRows, `Discovery refresh failed: ${error.message}. Keeping your last discovery set.`);
        } else {
          dom.discoveryResult.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(error.message)}</div>`;
        }
      } finally {
        setButtonBusy(dom.discoverBtn, false, "Discover Shows");
      }
    }

    async function handleQuickDownload() {
      const pageUrl = String(dom.urlInput?.value || "").trim();
      if (!pageUrl) {
        setStatus("Enter an NTS episode URL.", true);
        return;
      }
      const forceDownload = dom.downloadBtn?.dataset.forceNext === "1";
      if (forceDownload && dom.downloadBtn) {
        delete dom.downloadBtn.dataset.forceNext;
      }
      setButtonBusy(dom.downloadBtn, true, "Download");
      if (dom.log) {
        dom.log.textContent = "";
      }
      setStatus(forceDownload ? "Forcing re-download..." : "Resolving stream...");
      const progressToken = createProgressToken("nts");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setStatus(formatProgressText(progress, "Downloading..."));
      });
      try {
        const data = await window.rteDownloader.downloadFromNtsUrl(pageUrl, progressToken, { forceDownload });
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

    async function handlePickProgram(url, scheduleBackfillCount = null) {
      if (!url) {
        return;
      }
      if (dom.programUrlInput) {
        dom.programUrlInput.value = url;
      }
      if (typeof scheduleBackfillCount === "number") {
        await window.rteDownloader.addNtsSchedule(url, { backfillCount: scheduleBackfillCount });
        await refreshSchedules();
        return;
      }
      await loadProgram(url, 1);
    }

    async function handleEpisodeClick(event) {
      const playLocalBtn = event.target.closest("button[data-nts-play-local-url]");
      if (playLocalBtn) {
        const episodeUrl = playLocalBtn.getAttribute("data-nts-play-local-url") || "";
        const playTitle = playLocalBtn.getAttribute("data-nts-play-local-title") || "";
        const playProgramTitle = playLocalBtn.getAttribute("data-nts-play-local-program-title") || "";
        const playImage = playLocalBtn.getAttribute("data-nts-play-local-image") || "";
        const saved = state.ntsDownloadedAudioByEpisode[episodeUrl];
        if (!saved?.outputDir || !saved?.fileName) {
          setEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
          return;
        }
        setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
        try {
          await playEpisodeWithBackgroundCue({
            sourceType: "nts",
            cacheKey: episodeUrl,
            sourceLabel: "NTS Local",
            title: playTitle || saved.fileName,
            programTitle: playProgramTitle || "",
            subtitle: "",
            image: playImage,
            episodeUrl,
            durationSeconds: 0,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            playbackKey: `nts:local:${episodeUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(episodeUrl, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playLocalBtn, false, "Play Local");
        }
        return;
      }

      const playBtn = event.target.closest("button[data-nts-play-url]");
      if (playBtn) {
        const playUrl = playBtn.getAttribute("data-nts-play-url") || "";
        const playTitle = playBtn.getAttribute("data-nts-play-title") || "";
        const playProgramTitle = playBtn.getAttribute("data-nts-play-program-title") || "";
        const playImage = playBtn.getAttribute("data-nts-play-image") || "";
        setButtonBusy(playBtn, true, "Play", "Loading...");
        try {
          const stream = await window.rteDownloader.getNtsEpisodeStream(playUrl);
          await playEpisodeWithBackgroundCue({
            sourceType: "nts",
            cacheKey: playUrl,
            sourceLabel: "NTS",
            title: playTitle || stream?.title || "Episode",
            programTitle: playProgramTitle || "",
            subtitle: "",
            image: playImage || stream?.image || "",
            episodeUrl: playUrl,
            durationSeconds: 0,
            streamUrl: stream?.streamUrl || "",
            playbackKey: `nts:remote:${playUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(playUrl, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(playUrl, `Play failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playBtn, false, "Play");
        }
        return;
      }

      const cueBtn = event.target.closest("button[data-nts-generate-cue-url]");
      if (cueBtn) {
        const episodeUrl = cueBtn.getAttribute("data-nts-generate-cue-url") || "";
        const title = cueBtn.getAttribute("data-nts-generate-cue-title") || "nts-episode";
        const programTitle = cueBtn.getAttribute("data-nts-generate-cue-program-title") || "NTS";
        const saved = state.ntsDownloadedAudioByEpisode[episodeUrl];
        if (!saved) {
          setEpisodeStatus(episodeUrl, "Download episode first, then generate CUE.", true);
          return;
        }
        setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
        setEpisodeStatus(episodeUrl, "Generating CUE/chapters...");
        clearCueDebugLog("nts", episodeUrl);
        const cueProgressToken = createProgressToken(`nts-cue-${Date.now()}`);
        const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
          if (progress?.kind === "cue" && progress?.message) {
            appendCueDebugLog("nts", episodeUrl, progress.message);
          }
          setEpisodeStatus(episodeUrl, formatProgressText(progress, "Generating CUE/chapters..."));
        });
        try {
          const cue = await window.rteDownloader.generateCue({
            sourceType: "nts",
            episodeUrl,
            title,
            programTitle,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            progressToken: cueProgressToken
          });
          setCachedChapters("nts", episodeUrl, cue.chapters || []);
          setEpisodeStatus(episodeUrl, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
        } catch (error) {
          setEpisodeStatus(episodeUrl, `CUE failed: ${error.message}`, true);
        } finally {
          detachCueProgress();
          setButtonBusy(cueBtn, false, "Generate CUE");
        }
        return;
      }

      const downloadBtn = event.target.closest("button[data-nts-download-url]");
      if (!downloadBtn) {
        return;
      }
      const episodeUrl = downloadBtn.getAttribute("data-nts-download-url") || "";
        const title = downloadBtn.getAttribute("data-nts-episode-title") || "nts-episode";
        const programTitle = downloadBtn.getAttribute("data-nts-program-title") || "NTS";
        const publishedTime = downloadBtn.getAttribute("data-nts-published") || "";
        const image = downloadBtn.getAttribute("data-nts-image") || "";
        const description = downloadBtn.getAttribute("data-nts-description") || "";
        const location = downloadBtn.getAttribute("data-nts-location") || "";
        const hosts = parseMetadataAttr(downloadBtn.getAttribute("data-nts-hosts"));
        const genres = parseMetadataAttr(downloadBtn.getAttribute("data-nts-genres"));
        setEpisodeStatus(episodeUrl, "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("nts-episode");
      const detach = attachDownloadProgress(progressToken, (progress) => setEpisodeStatus(episodeUrl, formatProgressText(progress, "Downloading...")));
      try {
        const data = await window.rteDownloader.downloadFromNtsUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image, description, location, hosts, genres });
        state.ntsDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
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
      const playLatestBtn = event.target.closest("button[data-nts-schedule-play-output]");
      if (playLatestBtn) {
        try {
          await playFromDownloadedFile({
            outputDir: playLatestBtn.getAttribute("data-nts-schedule-play-output"),
            fileName: playLatestBtn.getAttribute("data-nts-schedule-play-file"),
            title: playLatestBtn.getAttribute("data-nts-schedule-play-title") || "",
            source: "NTS Local",
            subtitle: "Latest scheduled download",
            image: playLatestBtn.getAttribute("data-nts-schedule-play-image") || "",
            episodeUrl: playLatestBtn.getAttribute("data-nts-schedule-play-episode-url") || "",
            sourceType: playLatestBtn.getAttribute("data-nts-schedule-play-source-type") || "nts"
          });
        } catch (error) {
          setEpisodeStatus("", `Play failed: ${error.message}`, true);
        }
        return;
      }

      const toggleBtn = event.target.closest("button[data-nts-schedule-toggle]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-nts-schedule-toggle");
        const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
        await window.rteDownloader.setNtsScheduleEnabled(id, enabled);
        await refreshSchedules();
        return;
      }

      const runBtn = event.target.closest("button[data-nts-schedule-run]");
      if (runBtn) {
        const id = runBtn.getAttribute("data-nts-schedule-run");
        const statusEl = dom.scheduleList?.querySelector(`[data-nts-schedule-status="${id}"]`);
        if (statusEl) {
          statusEl.style.display = "block";
          statusEl.textContent = "Running...";
        }
        try {
          await window.rteDownloader.runNtsScheduleNow(id);
          await refreshSchedules();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = `Error: ${error.message}`;
          }
        }
        return;
      }

      const removeBtn = event.target.closest("button[data-nts-schedule-remove]");
      if (removeBtn) {
        const id = removeBtn.getAttribute("data-nts-schedule-remove");
        await window.rteDownloader.removeNtsSchedule(id);
        await refreshSchedules();
      }
    }

    function bindSearchResultClick(listEl, options = {}) {
      const hideOnPick = Boolean(options.hideOnPick);
      const preserveDiscoveryList = Boolean(options.preserveDiscoveryList);
      listEl?.addEventListener("click", (event) => {
        const schedBtn = event.target.closest(".nts-quick-schedule-btn");
        if (schedBtn) {
          event.stopPropagation();
          const url = schedBtn.getAttribute("data-nts-schedule-url") || "";
          schedBtn.textContent = "Adding...";
          schedBtn.disabled = true;
          handlePickProgram(url, 1)
            .then(() => {
              schedBtn.textContent = "Scheduled";
            })
            .catch(() => {
              schedBtn.textContent = "Error";
              schedBtn.disabled = false;
            });
          return;
        }
        const item = event.target.closest("[data-nts-program-url]");
        if (!item) {
          return;
        }
        const url = item.getAttribute("data-nts-program-url") || "";
        const title = item.getAttribute("data-nts-program-title") || url;
        if (preserveDiscoveryList) {
          selectedDiscoveryProgram = url;
          renderDiscoveryResults(lastDiscoveryRows, `Loaded ${title}. Discovery results stay here so you can browse more hosts.`);
        }
        handlePickProgram(url).catch(() => {});
        if (hideOnPick) {
          listEl.classList.add("hidden");
        }
      });
    }

    function bindEvents() {
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
        const ntsSection = dom.liveNow.closest(".nts-live-section-wrap");
        const audioWrap = ntsSection ? ntsSection.querySelector(".nts-live-audio-wrap") : dom.liveAudio.parentElement;
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
        ensureLiveStationsLoaded()
          .then(() => refreshLiveNow())
          .catch(() => {});
      });

      dom.programSearchBtn?.addEventListener("click", () => {
        runProgramSearch(dom.programSearchInput?.value.trim() || "").catch(() => {});
      });

      dom.programSearchInput?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        runProgramSearch(dom.programSearchInput.value.trim()).catch(() => {});
      });

      dom.programSearchInput?.addEventListener("input", () => {
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
        }
        const query = dom.programSearchInput.value.trim();
        searchDebounceTimer = setTimeout(() => {
          if (query.length < 2) {
            if (dom.programSearchResult) {
              dom.programSearchResult.classList.remove("hidden");
              dom.programSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search NTS shows.</div>`;
            }
            return;
          }
          runProgramSearch(query).catch(() => {});
        }, 280);
      });

      dom.programSearchInput?.addEventListener("focus", () => {
        if (dom.programSearchResult) {
          dom.programSearchResult.classList.remove("hidden");
          if (!dom.programSearchInput.value.trim()) {
            dom.programSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search NTS shows.</div>`;
          }
        }
      });

      dom.programResultFilterInput?.addEventListener("input", () => {
        if (dom.programSearchResult && !dom.programSearchResult.classList.contains("hidden")) {
          const rows = filterProgramRows(lastSearchRows);
          dom.programSearchResult.innerHTML = rows.length
            ? rows.map((show) => renderShowCard(show, { showScheduleBtn: true })).join("")
            : `<div class="item">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No NTS shows found."}</div>`;
        }
        renderDiscoveryResults(lastDiscoveryRows, selectedDiscoveryProgram ? "Discovery results stay here so you can browse more hosts." : "");
      });

      dom.loadProgramBtn?.addEventListener("click", () => {
        const url = String(dom.programUrlInput?.value || "").trim();
        if (!url) {
          if (dom.programMeta) {
            dom.programMeta.textContent = "Enter an NTS show URL or slug first.";
          }
          return;
        }
        setButtonBusy(dom.loadProgramBtn, true, "Load Episodes");
        loadProgram(url, 1)
          .catch((error) => {
            if (dom.programMeta) {
              dom.programMeta.textContent = error.message;
            }
          })
          .finally(() => setButtonBusy(dom.loadProgramBtn, false, "Load Episodes"));
      });

      dom.prevPageBtn?.addEventListener("click", () => {
        if (state.ntsProgramPage <= 1 || !state.ntsProgramUrl) {
          return;
        }
        loadProgram(state.ntsProgramUrl, state.ntsProgramPage - 1).catch(() => {});
      });

      dom.nextPageBtn?.addEventListener("click", () => {
        if (state.ntsProgramPage >= state.ntsProgramMaxPages || !state.ntsProgramUrl) {
          return;
        }
        loadProgram(state.ntsProgramUrl, state.ntsProgramPage + 1).catch(() => {});
      });

      dom.episodeFilterInput?.addEventListener("input", () => {
        renderEpisodes(state.ntsEpisodesPayload || { episodes: [] });
      });

      dom.scheduleBackfillMode?.addEventListener("change", () => {
        if (dom.scheduleBackfillCount) {
          dom.scheduleBackfillCount.disabled = dom.scheduleBackfillMode.value !== "backfill";
        }
      });

      dom.addScheduleBtn?.addEventListener("click", async () => {
        const programUrl = String(dom.programUrlInput?.value || "").trim() || state.ntsProgramUrl;
        if (!programUrl) {
          if (dom.programMeta) {
            dom.programMeta.textContent = "Enter or load a show first.";
          }
          return;
        }
        const backfillCount = dom.scheduleBackfillMode?.value === "backfill"
          ? Math.max(1, Math.min(100, Number(dom.scheduleBackfillCount?.value || 5)))
          : 0;
        setButtonBusy(dom.addScheduleBtn, true, "Add Scheduler", "Adding...");
        try {
          await window.rteDownloader.addNtsSchedule(programUrl, { backfillCount });
          await refreshSchedules();
        } catch (error) {
          if (dom.programMeta) {
            dom.programMeta.textContent = error.message;
          }
        } finally {
          setButtonBusy(dom.addScheduleBtn, false, "Add Scheduler");
        }
      });

      dom.discoverBtn?.addEventListener("click", () => {
        runDiscovery().catch(() => {});
      });

      bindSearchResultClick(dom.programSearchResult, { hideOnPick: true });
      bindSearchResultClick(dom.discoveryResult, { preserveDiscoveryList: true });

      dom.episodesResult?.addEventListener("click", (event) => {
        handleEpisodeClick(event).catch(() => {});
      });

      dom.scheduleList?.addEventListener("click", (event) => {
        handleScheduleClick(event).catch(() => {});
      });
    }

    bindEvents();

    return {
      loadProgram,
      setEpisodeStatus,
      refreshSchedules,
      refreshLiveNow,
      ensureLiveStationsLoaded
    };
  }

  window.KimbleNtsScreen = {
    create: createNtsScreen
  };
})();
