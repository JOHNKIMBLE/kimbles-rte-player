(function initKimbleWwfScreen() {
  function createWwfScreen(deps) {
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
        episode?.showTime,
        ...hosts,
        ...genres
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
    }

    function buildProgramCardSearchText(result) {
      const hosts = normalizeMetadataList(result?.hosts);
      const genres = Array.isArray(result?.genres) ? result.genres : [];
      return [
        result?.title,
        result?.description,
        result?.location,
        result?.cadence,
        result?.runSchedule,
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

    function renderProgramCards(rows, options = {}) {
      const selectedProgram = String(options.selectedProgram || "").trim();
      return rows.map((result) => {
        const programKey = String(result.programUrl || result.title || "").trim();
        const cadenceBadge = result.cadence && result.cadence !== "irregular"
          ? ` <span class="genre-pill">${escapeHtml(result.cadence)}</span>`
          : "";
        const locationBadge = result.location
          ? ` <span class="genre-pill">${escapeHtml(result.location)}</span>`
          : "";
        const genresHtml = Array.isArray(result.genres) && result.genres.length
          ? `<div class="genre-pills">${result.genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
          : "";
        const scheduleHtml = result.runSchedule
          ? `<div class="item-meta">${escapeHtml(toLocalSchedule(result.runSchedule))}</div>`
          : "";
        const description = String(result.description || "").trim();
        const hosts = normalizeMetadataList(result.hosts);
        const selectedClass = selectedProgram && selectedProgram === programKey ? " item-selected" : "";
        return `
          <div class="item clickable${selectedClass}" data-wwf-pick-program="${escapeHtml(programKey)}" data-wwf-program-title="${escapeHtml(result.title || programKey || "Worldwide FM Show")}">
            <div class="search-card">
              <div>${result.image ? `<img src="${escapeHtml(result.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
              <div>
                <div class="item-title">${escapeHtml(result.title || programKey || "Worldwide FM Show")}${cadenceBadge}${locationBadge}</div>
                ${scheduleHtml}
                ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
                ${description ? `<div class="item-meta">${escapeHtml(description.slice(0, 180))}${description.length > 180 ? "..." : ""}</div>` : ""}
                ${genresHtml}
              </div>
            </div>
          </div>
        `;
      }).join("");
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
      dom.discoveryResult.innerHTML = `${noteHtml}${renderProgramCards(list, { selectedProgram: selectedDiscoveryProgram })}`;
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
      const node = dom.episodesResult?.querySelector(`[data-wwf-episode-status="${key}"]`);
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

    async function autoLoadPlaylists(episodes) {
      if (!window.rteDownloader?.getWwfEpisodePlaylist) {
        return;
      }
      const queue = (episodes || []).filter((episode) => episode.episodeUrl);
      const concurrency = 2;
      let index = 0;

      async function worker() {
        while (index < queue.length) {
          const episode = queue[index];
          index += 1;
          const statusKey = encodeURIComponent(String(episode.episodeUrl || ""));
          const node = dom.episodesResult?.querySelector(`[data-wwf-episode-playlist="${statusKey}"]`);
          if (!node) {
            continue;
          }
          try {
            const data = await window.rteDownloader.getWwfEpisodePlaylist(episode.episodeUrl);
            const tracks = data?.tracks || [];
            state.wwfTracksByEpisode[String(episode.episodeUrl || "")] = tracks;
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
        const programTitle = String(payload?.title || episode.showName || "Worldwide FM").trim();
        const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
        const episodeGenres = Array.isArray(episode.genres) ? episode.genres : [];
        const genresHtml = episodeGenres.length
          ? `<div class="genre-pills">${episodeGenres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
          : "";
        const programTitleLower = String(payload?.title || "").toLowerCase();
        const episodeHosts = Array.isArray(episode.hosts) ? episode.hosts : [];
        const hostsRedundant = episodeHosts.length
          ? episodeHosts.every((host) => host.toLowerCase() === programTitleLower)
          : true;
        const hostsHtml = episodeHosts.length && !hostsRedundant
          ? `<div class="item-meta">Host: ${episodeHosts.map((host) => escapeHtml(host)).join(", ")}</div>`
          : "";
        const description = String(episode.description || "").trim();
        const descHtml = description
          ? `<div class="item-meta muted" style="max-width:600px;">${escapeHtml(description.slice(0, 200))}${description.length > 200 ? "..." : ""}</div>`
          : "";
        const durationHtml = episode.durationMinutes
          ? ` · ${episode.durationMinutes >= 60 ? `${Math.floor(episode.durationMinutes / 60)}h` : ""}${episode.durationMinutes % 60 ? `${episode.durationMinutes % 60}m` : ""}`
          : "";
        const runScheduleHtml = episode.runSchedule
          ? `<div class="item-meta"><strong>${escapeHtml(toLocalSchedule(episode.runSchedule))}</strong></div>`
          : episode.showTime
            ? `<div class="item-meta">${escapeHtml(episode.showTime)}${durationHtml}</div>`
            : "";
        const locationHtml = episode.location ? `<div class="item-meta">${escapeHtml(episode.location)}</div>` : "";
        return `
          <div class="item">
            ${img}
            <div class="item-title">${escapeHtml(fullTitle)}</div>
            <div class="item-meta">${published ? escapeHtml(published) : "Date unknown"}${!episode.runSchedule && !episode.showTime && durationHtml ? durationHtml : ""}</div>
            ${hostsHtml}
            ${runScheduleHtml}
            ${locationHtml}
            ${descHtml}
            ${genresHtml}
            <div class="item-actions">
              <button class="secondary" data-wwf-play-url="${escapeHtml(episode.playerUrl || episode.downloadUrl || episodeUrl)}" data-wwf-play-title="${escapeHtml(fullTitle)}" data-wwf-play-program-title="${escapeHtml(programTitle)}" data-wwf-play-image="${escapeHtml(episode.image || "")}">Play</button>
              <button class="secondary" data-wwf-play-local-url="${escapeHtml(episodeUrl)}" data-wwf-play-local-title="${escapeHtml(fullTitle)}" data-wwf-play-local-program-title="${escapeHtml(programTitle)}" data-wwf-play-local-image="${escapeHtml(episode.image || "")}">Play Local</button>
              <button data-wwf-download-url="${escapeHtml(episodeUrl)}" data-wwf-episode-title="${escapeHtml(fullTitle)}" data-wwf-program-title="${escapeHtml(programTitle)}" data-wwf-published="${escapeHtml(published)}" data-wwf-image="${escapeHtml(episode.image || "")}" data-wwf-description="${escapeHtml(description)}" data-wwf-location="${escapeHtml(String(episode.location || ""))}" data-wwf-hosts="${escapeHtml(JSON.stringify(episodeHosts))}" data-wwf-genres="${escapeHtml(JSON.stringify(episodeGenres))}">Download</button>
              <button class="secondary" data-wwf-generate-cue-url="${escapeHtml(episodeUrl)}" data-wwf-generate-cue-title="${escapeHtml(fullTitle)}" data-wwf-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>
            </div>
            <div class="item-meta episode-status" data-wwf-episode-status="${statusKey}" style="display:none;"></div>
            <div class="cue-debug-log" data-wwf-episode-cue-debug="${statusKey}" style="display:none;"></div>
            <div class="episode-inline-playlist" data-wwf-episode-playlist="${statusKey}">
              <div class="playlist-note">Loading tracklist...</div>
            </div>
          </div>
        `;
      }).join("");

      autoLoadPlaylists(filteredRows).catch(() => {});
    }

    async function loadProgram(programNameOrUrl, page = 1) {
      if (!window.rteDownloader?.getWwfProgramEpisodes) {
        return;
      }
      const perPage = getEpisodesPerPage();
      const serverPage = Math.max(1, Math.ceil((((Number(page) || 1) - 1) * perPage + 1) / 20));
      const payload = await window.rteDownloader.getWwfProgramEpisodes(programNameOrUrl, serverPage);
      const totalItems = Number(payload?.totalItems || 0);
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
      const clientOffset = ((targetPage - 1) * perPage) % 20;
      if (payload.episodes) {
        payload.episodes = payload.episodes.slice(clientOffset, clientOffset + perPage);
      }
      state.wwfProgramUrl = payload.programUrl || programNameOrUrl;
      state.wwfProgramPage = targetPage;
      state.wwfProgramMaxPages = totalPages;
      state.wwfEpisodesPayload = payload;

      if (dom.programUrlInput) {
        dom.programUrlInput.value = state.wwfProgramUrl;
      }
      if (dom.programMeta) {
        const img = (payload.image || "").trim();
        const genres = Array.isArray(payload.genres) ? payload.genres : [];
        const hosts = normalizeMetadataList(payload.hosts);
        const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
        const cadence = String(payload.cadence || "").trim();
        const cadenceBadge = cadence && cadence !== "irregular" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
        const locationBadge = payload.location ? ` <span class="genre-pill">${escapeHtml(payload.location)}</span>` : "";
        dom.programMeta.innerHTML = `
          ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
          <strong>${escapeHtml(payload.title || "Worldwide FM")}</strong>${cadenceBadge}${locationBadge}<br>
          ${hosts.length ? `<span class="muted">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</span><br>` : ""}
          ${payload.runSchedule ? `<span class="muted">Airs: ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
          ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` - ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
          ${payload.description ? `<span class="muted">${escapeHtml(payload.description.slice(0, 300))}${payload.description.length > 300 ? "..." : ""}</span><br>` : ""}
          ${genresHtml}
          Page ${state.wwfProgramPage} of ${state.wwfProgramMaxPages} - ${Number(payload?.totalItems || 0)} episodes
        `;
      }
      renderEpisodes(payload);
      focusProgramExplorer(page);
    }

    async function refreshSchedules() {
      if (!dom.scheduleList || !window.rteDownloader?.listWwfSchedules) {
        return;
      }
      const schedules = await window.rteDownloader.listWwfSchedules();
      dom.scheduleList.innerHTML = schedules.length
        ? schedules.map((schedule) => renderSchedulerCard(schedule, "wwf")).join("")
        : `<div class="item">No Worldwide FM schedules yet.</div>`;
    }

    async function refreshLiveNow() {
      if (!dom.liveNow) {
        return;
      }
      if (!window.rteDownloader?.getWwfLiveNow) {
        dom.liveNow.innerHTML = `<div class="nts-live-header status muted"><strong>Worldwide FM</strong> - Live<br><span class="muted">Listen at <a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer">worldwidefm.net</a></span></div><div class="nts-live-hero nts-live-hero-placeholder"><a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">worldwidefm.net</a></div>`;
        return;
      }
      try {
        const info = await window.rteDownloader.getWwfLiveNow();
        const timeSlotLocal = formatNtsTimeSlotLocal(info.startTimestamp, info.endTimestamp);
        const timeSlotDisplay = timeSlotLocal || String(info.timeSlot || "").trim();
        const upNextLabel = info.isUpcoming ? "Up Next: " : "";
        const line1Parts = [`<strong>${escapeHtml(info.stationName || "Worldwide FM")}</strong> - ${upNextLabel}${escapeHtml(info.programmeName || "Live")}`];
        if (timeSlotDisplay) {
          line1Parts.push(` (${escapeHtml(timeSlotDisplay)})`);
        }
        const line2 = String(info.description || "").trim();
        const parts = [];
        parts.push(`<div class="nts-live-header status">${line1Parts.join("")}`);
        if (line2) {
          parts.push(`<br><span class="muted">${escapeHtml(line2)}</span>`);
        }
        parts.push("</div>");
        const img = String(info.image || "").trim();
        const location = String(info.location || "").trim();
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
          parts.push('<a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">worldwidefm.net</a>');
          parts.push("</div>");
        }
        dom.liveNow.innerHTML = parts.join("");
      } catch {
        dom.liveNow.innerHTML = `<div class="nts-live-header status muted"><strong>Worldwide FM</strong> - Live<br><span class="muted">Could not load schedule. <a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer">worldwidefm.net</a></span></div><div class="nts-live-hero nts-live-hero-placeholder"><a href="https://www.worldwidefm.net/" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">worldwidefm.net</a></div>`;
      }
    }

    async function runProgramSearch(query) {
      if (!window.rteDownloader?.searchWwfPrograms || !dom.programSearchResult) {
        return;
      }
      dom.programSearchResult.classList.remove("hidden");
      dom.programSearchResult.innerHTML = `<div class="item">Searching...</div>`;
      try {
        const results = await window.rteDownloader.searchWwfPrograms(query || "");
        lastSearchRows = normalizeProgramRows(results);
        const rows = filterProgramRows(lastSearchRows);
        if (!rows.length) {
          dom.programSearchResult.innerHTML = `<div class="item">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No shows found. Try a different search or load by name below."}</div>`;
          return;
        }
        dom.programSearchResult.innerHTML = renderProgramCards(rows);
      } catch (error) {
        dom.programSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
      }
    }

    async function runDiscovery() {
      if (!window.rteDownloader?.getWwfDiscovery || !dom.discoveryResult || !dom.discoverBtn) {
        return;
      }
      setButtonBusy(dom.discoverBtn, true, "Discover Shows", "Loading...");
      dom.discoveryResult.innerHTML = `<div class="item muted">Fetching random shows...</div>`;
      try {
        const results = await window.rteDownloader.getWwfDiscovery(getDiscoveryCount());
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
          dom.discoveryResult.innerHTML = `<div class="item muted error">${escapeHtml(error.message)}</div>`;
        }
      } finally {
        setButtonBusy(dom.discoverBtn, false, "Discover Shows");
      }
    }

    async function handleQuickDownload() {
      const pageUrl = String(dom.urlInput?.value || "").trim();
      if (!pageUrl) {
        setStatus("Enter a Worldwide FM episode URL.", true);
        return;
      }
      const forceDownload = dom.downloadBtn?.dataset.forceNext === "1";
      if (forceDownload && dom.downloadBtn) {
        delete dom.downloadBtn.dataset.forceNext;
      }
      setButtonBusy(dom.downloadBtn, true, "Download");
      setStatus(forceDownload ? "Forcing re-download..." : "Resolving stream...");
      const progressToken = createProgressToken("wwf");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setStatus(formatProgressText(progress, "Downloading..."));
      });
      try {
        const data = await window.rteDownloader.downloadFromWwfUrl(pageUrl, progressToken, { forceDownload });
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
      const playLocalBtn = event.target.closest("button[data-wwf-play-local-url]");
      if (playLocalBtn) {
        const episodeUrl = playLocalBtn.getAttribute("data-wwf-play-local-url") || "";
        const playTitle = playLocalBtn.getAttribute("data-wwf-play-local-title") || "";
        const playProgramTitle = playLocalBtn.getAttribute("data-wwf-play-local-program-title") || "";
        const playImage = playLocalBtn.getAttribute("data-wwf-play-local-image") || "";
        const saved = state.wwfDownloadedAudioByEpisode[episodeUrl];
        if (!saved?.outputDir || !saved?.fileName) {
          setEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
          return;
        }
        setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
        try {
          await playEpisodeWithBackgroundCue({
            sourceType: "wwf",
            cacheKey: episodeUrl,
            sourceLabel: "Worldwide FM Local",
            title: playTitle || saved.fileName,
            programTitle: playProgramTitle || "",
            subtitle: "",
            image: playImage,
            episodeUrl,
            durationSeconds: 0,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            playbackKey: `wwf:local:${episodeUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(episodeUrl, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playLocalBtn, false, "Play Local");
        }
        return;
      }

      const playBtn = event.target.closest("button[data-wwf-play-url]");
      if (playBtn) {
        const playUrl = playBtn.getAttribute("data-wwf-play-url") || "";
        const playTitle = playBtn.getAttribute("data-wwf-play-title") || "";
        const playProgramTitle = playBtn.getAttribute("data-wwf-play-program-title") || "";
        const playImage = playBtn.getAttribute("data-wwf-play-image") || "";
        setButtonBusy(playBtn, true, "Play", "Loading...");
        try {
          const stream = await window.rteDownloader.getWwfEpisodeStream(playUrl);
          const streamUrl = stream?.streamUrl ? String(stream.streamUrl).trim() : "";
          if (!streamUrl) {
            setEpisodeStatus(playUrl, "No stream URL. Download the episode, then use Play Local.", true);
            return;
          }
          setEpisodeStatus(playUrl, "Buffering Mixcloud stream - audio will start in ~5-10s...");
          await playEpisodeWithBackgroundCue({
            sourceType: "wwf",
            cacheKey: playUrl,
            sourceLabel: "Worldwide FM",
            title: playTitle || stream?.title || "Episode",
            programTitle: playProgramTitle || "",
            subtitle: "",
            image: playImage || stream?.image || "",
            episodeUrl: playUrl,
            durationSeconds: 0,
            streamUrl,
            playbackKey: `wwf:remote:${playUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(playUrl, text, isError)
          });
          setEpisodeStatus(playUrl, "Buffering - audio will start shortly. If silent after 10s, try Play Local.");
        } catch (error) {
          setEpisodeStatus(playUrl, `Play failed: ${error.message}. Try Download then Play Local.`, true);
        } finally {
          setButtonBusy(playBtn, false, "Play");
        }
        return;
      }

      const downloadBtn = event.target.closest("button[data-wwf-download-url]");
      if (downloadBtn) {
        const episodeUrl = downloadBtn.getAttribute("data-wwf-download-url") || "";
        const title = downloadBtn.getAttribute("data-wwf-episode-title") || "wwf-episode";
        const programTitle = downloadBtn.getAttribute("data-wwf-program-title") || "Worldwide FM";
        const publishedTime = downloadBtn.getAttribute("data-wwf-published") || "";
        const image = downloadBtn.getAttribute("data-wwf-image") || "";
        const description = downloadBtn.getAttribute("data-wwf-description") || "";
        const location = downloadBtn.getAttribute("data-wwf-location") || "";
        const hosts = parseMetadataAttr(downloadBtn.getAttribute("data-wwf-hosts"));
        const genres = parseMetadataAttr(downloadBtn.getAttribute("data-wwf-genres"));
        setEpisodeStatus(episodeUrl, "Starting download...");
        setButtonBusy(downloadBtn, true, "Download", "Downloading...");
        const progressToken = createProgressToken("wwf-episode");
        const detach = attachDownloadProgress(progressToken, (progress) => setEpisodeStatus(episodeUrl, formatProgressText(progress, "Downloading...")));
        try {
          const data = await window.rteDownloader.downloadFromWwfUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image, description, location, hosts, genres });
          state.wwfDownloadedAudioByEpisode[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
          if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
            state.wwfChaptersByEpisode[String(episodeUrl || "")] = data.cue.chapters;
          }
          const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
          setEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}${cueText}`);
        } catch (error) {
          setEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
        } finally {
          detach();
          setButtonBusy(downloadBtn, false, "Download");
        }
        return;
      }

      const cueBtn = event.target.closest("button[data-wwf-generate-cue-url]");
      if (!cueBtn) {
        return;
      }
      const episodeUrl = cueBtn.getAttribute("data-wwf-generate-cue-url") || "";
      const title = cueBtn.getAttribute("data-wwf-generate-cue-title") || "wwf-episode";
      const programTitle = cueBtn.getAttribute("data-wwf-generate-cue-program-title") || "Worldwide FM";
      const saved = state.wwfDownloadedAudioByEpisode[episodeUrl];
      if (!saved) {
        setEpisodeStatus(episodeUrl, "Download episode first, then generate CUE.", true);
        return;
      }
      setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
      setEpisodeStatus(episodeUrl, "Generating CUE/chapters...");
      clearCueDebugLog("wwf", episodeUrl);
      const cueProgressToken = createProgressToken(`wwf-cue-${Date.now()}`);
      const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
        if (progress?.kind === "cue" && progress?.message) {
          appendCueDebugLog("wwf", episodeUrl, progress.message);
        }
        setEpisodeStatus(episodeUrl, formatProgressText(progress, "Generating CUE/chapters..."));
      });
      try {
        const cue = await window.rteDownloader.generateCue({
          sourceType: "wwf",
          episodeUrl,
          title,
          programTitle,
          outputDir: saved.outputDir,
          fileName: saved.fileName,
          progressToken: cueProgressToken
        });
        state.wwfChaptersByEpisode[String(episodeUrl || "")] = cue.chapters || [];
        setEpisodeStatus(episodeUrl, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
      } catch (error) {
        setEpisodeStatus(episodeUrl, `CUE failed: ${error.message}`, true);
      } finally {
        detachCueProgress();
        setButtonBusy(cueBtn, false, "Generate CUE");
      }
    }

    async function handleScheduleClick(event) {
      const playLatestBtn = event.target.closest("button[data-wwf-schedule-play-output]");
      if (playLatestBtn) {
        try {
          await playFromDownloadedFile({
            outputDir: playLatestBtn.getAttribute("data-wwf-schedule-play-output"),
            fileName: playLatestBtn.getAttribute("data-wwf-schedule-play-file"),
            title: playLatestBtn.getAttribute("data-wwf-schedule-play-title") || "",
            source: "Worldwide FM Local",
            subtitle: "Latest scheduled download",
            image: playLatestBtn.getAttribute("data-wwf-schedule-play-image") || "",
            episodeUrl: playLatestBtn.getAttribute("data-wwf-schedule-play-episode-url") || "",
            sourceType: playLatestBtn.getAttribute("data-wwf-schedule-play-source-type") || "wwf"
          });
        } catch (error) {
          setEpisodeStatus("", `Play failed: ${error.message}`, true);
        }
        return;
      }

      const toggleBtn = event.target.closest("button[data-wwf-schedule-toggle]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-wwf-schedule-toggle");
        const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
        await window.rteDownloader.setWwfScheduleEnabled(id, enabled);
        await refreshSchedules();
        return;
      }

      const runBtn = event.target.closest("button[data-wwf-schedule-run]");
      if (runBtn) {
        const id = runBtn.getAttribute("data-wwf-schedule-run");
        const statusEl = dom.scheduleList?.querySelector(`[data-wwf-schedule-status="${id}"]`);
        if (statusEl) {
          statusEl.style.display = "block";
          statusEl.textContent = "Running...";
        }
        try {
          await window.rteDownloader.runWwfScheduleNow(id);
          await refreshSchedules();
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = `Error: ${error.message}`;
          }
        }
        return;
      }

      const removeBtn = event.target.closest("button[data-wwf-schedule-remove]");
      if (removeBtn) {
        const id = removeBtn.getAttribute("data-wwf-schedule-remove");
        await window.rteDownloader.removeWwfSchedule(id);
        await refreshSchedules();
      }
    }

    function bindEvents() {
      dom.liveNow?.addEventListener("click", (event) => {
        const playBtn = event.target.closest(".nts-live-play-overlay");
        if (!playBtn) {
          return;
        }
        const streamUrl = (state.wwfLiveStations && state.wwfLiveStations[0]?.streamUrl) || "https://worldwide-fm.radiocult.fm/stream";
        if (dom.liveAudio) {
          dom.liveAudio.src = streamUrl;
          dom.liveAudio.play().catch(() => {});
        }
        if (dom.liveAudioWrap) {
          dom.liveAudioWrap.classList.remove("nts-live-audio-hidden");
          dom.liveAudioWrap.classList.add("nts-live-audio-at-bottom");
        }
        playBtn.classList.add("hidden");
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

      dom.loadProgramBtn?.addEventListener("click", () => {
        const programName = String(dom.programUrlInput?.value || "").trim() || "Worldwide FM";
        setButtonBusy(dom.loadProgramBtn, true, "Load Episodes");
        loadProgram(programName, 1)
          .catch((error) => {
            if (dom.programMeta) {
              dom.programMeta.textContent = error.message;
            }
          })
          .finally(() => setButtonBusy(dom.loadProgramBtn, false, "Load Episodes"));
      });

      dom.programSearchBtn?.addEventListener("click", () => {
        runProgramSearch(dom.programSearchInput?.value.trim() || "").catch(() => {});
      });

      dom.programSearchInput?.addEventListener("input", () => {
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
        }
        const query = dom.programSearchInput.value.trim();
        searchDebounceTimer = setTimeout(() => {
          runProgramSearch(query).catch(() => {});
        }, 280);
      });

      dom.programSearchInput?.addEventListener("focus", () => {
        const query = dom.programSearchInput.value.trim();
        if (query) {
          runProgramSearch(query).catch(() => {});
        } else if (dom.programSearchResult && !dom.programSearchResult.classList.contains("hidden")) {
          runProgramSearch("").catch(() => {});
        }
      });

      dom.programResultFilterInput?.addEventListener("input", () => {
        if (dom.programSearchResult && !dom.programSearchResult.classList.contains("hidden")) {
          const rows = filterProgramRows(lastSearchRows);
          dom.programSearchResult.innerHTML = rows.length
            ? renderProgramCards(rows)
            : `<div class="item">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No shows found. Try a different search or load by name below."}</div>`;
        }
        renderDiscoveryResults(lastDiscoveryRows, selectedDiscoveryProgram ? "Discovery results stay here so you can browse more hosts." : "");
      });

      dom.programSearchResult?.addEventListener("click", (event) => {
        const row = event.target.closest("[data-wwf-pick-program]");
        if (!row) {
          return;
        }
        const programName = row.getAttribute("data-wwf-pick-program") || "";
        if (dom.programUrlInput) {
          dom.programUrlInput.value = programName;
        }
        loadProgram(programName, 1).catch(() => {});
        dom.programSearchResult.classList.add("hidden");
      });

      dom.discoverBtn?.addEventListener("click", () => {
        runDiscovery().catch(() => {});
      });

      dom.discoveryResult?.addEventListener("click", (event) => {
        const row = event.target.closest("[data-wwf-pick-program]");
        if (!row) {
          return;
        }
        const programName = row.getAttribute("data-wwf-pick-program") || "";
        const programTitle = row.getAttribute("data-wwf-program-title") || programName;
        if (dom.programUrlInput) {
          dom.programUrlInput.value = programName;
        }
        selectedDiscoveryProgram = programName;
        renderDiscoveryResults(lastDiscoveryRows, `Loaded ${programTitle}. Discovery results stay here so you can browse more hosts.`);
        loadProgram(programName, 1).catch(() => {});
      });

      dom.prevPageBtn?.addEventListener("click", () => {
        const page = Math.max(1, (state.wwfProgramPage || 1) - 1);
        loadProgram(state.wwfProgramUrl, page).catch(() => {});
      });

      dom.nextPageBtn?.addEventListener("click", () => {
        const page = Math.min(state.wwfProgramMaxPages || 1, (state.wwfProgramPage || 1) + 1);
        loadProgram(state.wwfProgramUrl, page).catch(() => {});
      });

      dom.episodeFilterInput?.addEventListener("input", () => {
        renderEpisodes(state.wwfEpisodesPayload || { episodes: [] });
      });

      dom.addScheduleBtn?.addEventListener("click", async () => {
        const programName = String(dom.programUrlInput?.value || "").trim() || state.wwfProgramUrl;
        if (!programName) {
          if (dom.programMeta) {
            dom.programMeta.textContent = "Enter or load a program name first.";
          }
          return;
        }
        const backfillCount = dom.scheduleBackfillMode?.value === "backfill"
          ? Math.max(1, Math.floor(Number(dom.scheduleBackfillCount?.value || 1)))
          : 0;
        setButtonBusy(dom.addScheduleBtn, true, "Add Scheduler", "Adding...");
        try {
          await window.rteDownloader.addWwfSchedule(programName, { backfillCount });
          await refreshSchedules();
        } catch (error) {
          if (dom.programMeta) {
            dom.programMeta.textContent = error.message;
          }
        } finally {
          setButtonBusy(dom.addScheduleBtn, false, "Add Scheduler");
        }
      });

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
      refreshSchedules,
      refreshLiveNow,
      runProgramSearch,
      runDiscovery,
      setEpisodeStatus
    };
  }

  window.KimbleWwfScreen = {
    create: createWwfScreen
  };
})();
