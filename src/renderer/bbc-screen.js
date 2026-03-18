(function initKimbleBbcScreen() {
  function createBbcScreen(deps) {
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
    const shouldArmForceRetry = deps.shouldArmForceRetry;
    const renderSchedulerCard = deps.renderSchedulerCard;
    const renderBbcShowCard = deps.renderBbcShowCard;
    const renderPlaylistTracks = deps.renderPlaylistTracks;
    const renderChapters = deps.renderChapters;
    const formatDurationFromSeconds = deps.formatDurationFromSeconds;
    const playFromDownloadedFile = deps.playFromDownloadedFile;
    const formatRunNowResult = deps.formatRunNowResult;
    const setSettingsStatus = deps.setSettingsStatus;
    const setBbcStatus = deps.setBbcStatus;
    const setLiveOverlayTarget = deps.setLiveOverlayTarget;
    const buildBbcAutoplayCandidates = deps.buildBbcAutoplayCandidates;
    const setUrlParam = deps.setUrlParam;

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

    function parseMetadataAttr(value) {
      try {
        return normalizeMetadataList(JSON.parse(String(value || "[]")));
      } catch {
        return normalizeMetadataList(value);
      }
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
        episode?.durationString,
        ...hosts,
        ...genres
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
    }

    function buildProgramCardSearchText(item) {
      const hosts = normalizeMetadataList(item?.hosts);
      const genres = Array.isArray(item?.genres) ? item.genres : [];
      return [
        item?.title,
        item?.description,
        item?.location,
        item?.runSchedule,
        item?.nextBroadcastTitle,
        item?.cadence,
        ...hosts,
        ...genres
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
    }

    function filterProgramRows(items) {
      const query = getProgramResultFilterQuery();
      if (!query) {
        return Array.isArray(items) ? items : [];
      }
      return (Array.isArray(items) ? items : []).filter((item) => buildProgramCardSearchText(item).includes(query));
    }

    function renderProgramRows(target, items, options = {}) {
      if (!target) {
        return;
      }
      const rows = filterProgramRows(items);
      const emptyText = options.emptyText || "No programs found.";
      target.innerHTML = rows.length
        ? rows.map((item) => renderBbcShowCard(item, { showScheduleBtn: true })).join("")
        : `<div class="item">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : emptyText}</div>`;
    }

    function setEpisodeStatus(episodeUrl, text, isError = false) {
      const key = encodeURIComponent(String(episodeUrl || ""));
      const statusNode = document.querySelector(`[data-bbc-episode-status="${key}"]`);
      if (!statusNode) {
        return;
      }
      const safeText = String(text || "");
      statusNode.textContent = safeText;
      statusNode.style.display = safeText ? "block" : "none";
      statusNode.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
    }

    function setScheduleStatus(scheduleId, text, isError = false) {
      const node = document.querySelector(`[data-bbc-schedule-status="${String(scheduleId || "")}"]`);
      if (!node) {
        return;
      }
      const safeText = String(text || "");
      node.textContent = safeText;
      node.style.display = safeText ? "block" : "none";
      node.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
    }

    function focusProgramExplorer(page = 1) {
      if (Number(page) !== 1) {
        return;
      }
      dom.programMeta?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function setEpisodeChapters(episodeUrl, chapters) {
      state.bbcChaptersByEpisode[String(episodeUrl || "")] = Array.isArray(chapters) ? chapters : [];
      const key = encodeURIComponent(String(episodeUrl || ""));
      const node = document.querySelector(`[data-bbc-episode-chapters="${key}"]`);
      if (!node) {
        return;
      }
      node.innerHTML = renderChapters(chapters);
    }

    function hideSearchDropdown() {
      dom.programSearchResult?.classList.add("hidden");
    }

    async function refreshLivePanel() {
      const selectedId = String(dom.stationSelect?.value || "").trim();
      if (!selectedId) {
        if (dom.liveNow) {
          dom.liveNow.textContent = "No BBC station selected.";
        }
        if (dom.livePlayerFrame) {
          dom.livePlayerFrame.src = "";
        }
        setLiveOverlayTarget(dom.liveOverlayPlayBtn, "");
        return;
      }

      const station = (state.bbcLiveStations || []).find((item) => String(item.id) === selectedId);
      if (!station) {
        if (dom.liveNow) {
          dom.liveNow.textContent = "Station not found.";
        }
        if (dom.livePlayerFrame) {
          dom.livePlayerFrame.src = "";
        }
        setLiveOverlayTarget(dom.liveOverlayPlayBtn, "");
        return;
      }

      if (dom.liveNow) {
        dom.liveNow.innerHTML = `<strong>${escapeHtml(station.name)}</strong>`;
      }
      const baseSrc = `${setUrlParam(setUrlParam(setUrlParam(station.liveUrl, "autoplay", "0"), "autostart", "false"), "play", "1")}#play`;
      const autoplaySrc = buildBbcAutoplayCandidates(station.liveUrl)[0] || "";
      if (dom.livePlayerFrame) {
        dom.livePlayerFrame.src = baseSrc;
      }
      if (dom.liveOverlayPlayBtn) {
        dom.liveOverlayPlayBtn.dataset.stationUrl = station.liveUrl;
      }
      setLiveOverlayTarget(dom.liveOverlayPlayBtn, autoplaySrc);
    }

    async function loadLiveStations() {
      state.bbcLiveStations = await window.rteDownloader.getBbcLiveStations();
      if (dom.stationSelect) {
        dom.stationSelect.innerHTML = state.bbcLiveStations
          .map((station) => `<option value="${escapeHtml(station.id)}">${escapeHtml(station.name)}</option>`)
          .join("");
      }
      await refreshLivePanel();
    }

    async function runProgramSearch(query) {
      if (!dom.programSearchBtn || !dom.programSearchResult) {
        return;
      }
      const trimmed = String(query || "").trim();
      if (trimmed.length < 2) {
        dom.programSearchResult.classList.remove("hidden");
        dom.programSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
        return;
      }

      setButtonBusy(dom.programSearchBtn, true, "Search");
      dom.programSearchResult.classList.remove("hidden");
      dom.programSearchResult.innerHTML = `<div class="item">Searching...</div>`;
      try {
        const items = await window.rteDownloader.searchBbcPrograms(trimmed);
        lastSearchRows = Array.isArray(items) ? items : [];
        renderProgramRows(dom.programSearchResult, lastSearchRows, { emptyText: "No BBC programs found." });
      } catch (error) {
        dom.programSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
      } finally {
        setButtonBusy(dom.programSearchBtn, false, "Search");
      }
    }

    async function runDiscovery() {
      if (!window.rteDownloader?.getBbcDiscovery || !dom.discoveryResult || !dom.discoverBtn) {
        return;
      }
      setButtonBusy(dom.discoverBtn, true, "Discover Shows", "Loading...");
      dom.discoveryResult.innerHTML = `<div class="item muted">Fetching random programs...</div>`;
      try {
        const results = await window.rteDownloader.getBbcDiscovery(getDiscoveryCount());
        lastDiscoveryRows = Array.isArray(results?.results) ? results.results : Array.isArray(results) ? results : [];
        renderProgramRows(dom.discoveryResult, lastDiscoveryRows, { emptyText: "No BBC programs found." });
      } catch (error) {
        dom.discoveryResult.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(error.message)}</div>`;
      } finally {
        setButtonBusy(dom.discoverBtn, false, "Discover Shows");
      }
    }

    async function loadEpisodePlaylistInto(episodeUrl) {
      const key = encodeURIComponent(String(episodeUrl || ""));
      const container = document.querySelector(`[data-bbc-episode-playlist="${key}"]`);
      if (!container) {
        return;
      }
      if (!episodeUrl) {
        container.innerHTML = `<div class="playlist-note">No episode URL for music lookup.</div>`;
        return;
      }
      container.innerHTML = `<div class="playlist-note">Loading music played...</div>`;
      try {
        const payload = await window.rteDownloader.getBbcEpisodePlaylist(episodeUrl);
        state.bbcTracksByEpisode[String(episodeUrl || "")] = Array.isArray(payload?.tracks) ? payload.tracks : [];
        container.innerHTML = renderPlaylistTracks(payload.tracks || []);
      } catch (error) {
        container.innerHTML = `<div class="playlist-note">Music load failed: ${escapeHtml(error.message)}</div>`;
      }
    }

    async function autoLoadVisiblePlaylists(episodes) {
      const queue = (episodes || []).filter((episode) => episode.episodeUrl);
      const concurrency = 2;
      let index = 0;

      async function worker() {
        while (index < queue.length) {
          const next = queue[index];
          index += 1;
          await loadEpisodePlaylistInto(next.episodeUrl);
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
      const totalPages = Math.max(1, Math.ceil(filteredRows.length / getEpisodesPerPage()));
      const currentPage = Math.max(1, Math.min(totalPages, Number(state.bbcProgramPage || 1)));
      const start = (currentPage - 1) * getEpisodesPerPage();
      const visibleRows = filteredRows.slice(start, start + getEpisodesPerPage());
      state.bbcProgramPage = currentPage;
      state.bbcProgramMaxPages = totalPages;

      if (!filteredRows.length) {
        dom.episodesResult.innerHTML = `<div class="item">${query ? "No matching loaded episodes found." : "No episodes found."}</div>`;
        return;
      }

      dom.episodesResult.innerHTML = visibleRows.map((episode) => {
        const episodeUrl = String(episode.episodeUrl || "").trim();
        const downloadUrl = String(episode.downloadUrl || episodeUrl).trim();
        const episodeStatusKey = encodeURIComponent(episodeUrl);
        const duration = formatDurationFromSeconds(episode.durationSeconds);
        const published = String(episode.publishedTime || "").trim();
        const description = String(episode.description || "").trim();
        const hosts = normalizeMetadataList(episode.hosts);
        const location = String(episode.location || "").trim();
        const genres = Array.isArray(episode.genres) ? episode.genres : [];
        const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
        const descHtml = description ? `<div class="item-meta muted" style="max-width:600px;">${escapeHtml(description.slice(0, 200))}${description.length > 200 ? "..." : ""}</div>` : "";
        const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
        const subtitle = `${payload.title || "BBC Program"}${published ? ` - ${published}` : ""}`;
        return `
          <div class="item">
            ${img}
            <div class="item-title">${escapeHtml(episode.title)}</div>
            <div class="item-meta">
              ${published ? escapeHtml(published) : "Date unknown"}
              ${duration ? ` - ${escapeHtml(duration)}` : ""}
            </div>
            ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
            ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
            ${descHtml}
            ${genresHtml}
            <div class="item-actions">
              <button
                class="secondary"
                data-bbc-play-url="${escapeHtml(episodeUrl)}"
                data-bbc-play-title="${escapeHtml(episode.title)}"
                data-bbc-play-program-title="${escapeHtml(payload.title || "BBC")}"
                data-bbc-play-subtitle="${escapeHtml(subtitle)}"
                data-bbc-play-image="${escapeHtml(episode.image || "")}"
                data-bbc-play-duration="${escapeHtml(String(episode.durationSeconds || 0))}"
              >Play</button>
              <button
                class="secondary"
                data-bbc-play-local-url="${escapeHtml(episodeUrl)}"
                data-bbc-play-local-title="${escapeHtml(episode.title)}"
                data-bbc-play-local-program-title="${escapeHtml(payload.title || "BBC")}"
                data-bbc-play-local-subtitle="${escapeHtml(subtitle)}"
                data-bbc-play-local-image="${escapeHtml(episode.image || "")}"
                data-bbc-play-local-duration="${escapeHtml(String(episode.durationSeconds || 0))}"
              >Play Local</button>
              <button data-bbc-episode-url="${escapeHtml(episodeUrl)}" data-bbc-download-url="${escapeHtml(downloadUrl)}" data-bbc-episode-title="${escapeHtml(episode.title)}" data-bbc-program-title="${escapeHtml(payload.title || "BBC")}" data-bbc-published="${escapeHtml(published)}" data-bbc-image="${escapeHtml(episode.image || payload.image || "")}" data-bbc-description="${escapeHtml(description)}" data-bbc-location="${escapeHtml(location)}" data-bbc-hosts="${escapeHtml(JSON.stringify(hosts))}" data-bbc-genres="${escapeHtml(JSON.stringify(genres))}">Download</button>
              <button class="secondary" data-bbc-generate-cue-url="${escapeHtml(episodeUrl)}" data-bbc-generate-cue-title="${escapeHtml(episode.title)}" data-bbc-generate-cue-program-title="${escapeHtml(payload.title || "BBC")}">Generate CUE</button>
            </div>
            <div class="item-meta episode-status" data-bbc-episode-status="${episodeStatusKey}" style="display:none;"></div>
            <div class="cue-debug-log" data-bbc-episode-cue-debug="${episodeStatusKey}" style="display:none;"></div>
            <div class="episode-inline-playlist" data-bbc-episode-chapters="${episodeStatusKey}"></div>
            <div class="episode-inline-playlist" data-bbc-episode-playlist="${episodeStatusKey}">
              <div class="playlist-note">Music Played: loading...</div>
            </div>
          </div>
        `;
      }).join("");

      autoLoadVisiblePlaylists(visibleRows).catch(() => {});
    }

    async function loadProgram(programUrl, page = 1) {
      const payload = await window.rteDownloader.getBbcProgramEpisodes(programUrl, 1);
      const totalRows = Number(payload?.episodes?.length || 0);
      const totalPages = Math.max(1, Math.ceil(totalRows / getEpisodesPerPage()));
      const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));

      state.bbcProgramUrl = payload.programUrl;
      state.bbcProgramPage = targetPage;
      state.bbcProgramMaxPages = totalPages;
      state.bbcEpisodesPayload = payload;

      if (dom.programUrlInput) {
        dom.programUrlInput.value = payload.programUrl;
      }
      if (dom.programMeta) {
        const img = String(payload.image || "").trim();
        const desc = String(payload.description || "").trim();
        const cadence = String(payload.cadence || "").trim();
        const hosts = normalizeMetadataList(payload.hosts);
        const location = String(payload.location || "").trim();
        const cadenceBadge = cadence && cadence !== "irregular" && cadence !== "unknown" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
        const genres = Array.isArray(payload.genres) ? payload.genres : [];
        const genresHtml = genres.length ? `<div class="genre-pills" style="margin-top:0.3rem;">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
        dom.programMeta.innerHTML = `
          ${img ? `<img src="${escapeHtml(img)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
          <strong>${escapeHtml(payload.title || "BBC Program")}</strong>${cadenceBadge}<br>
          ${hosts.length ? `<span class="muted">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</span><br>` : ""}
          ${location ? `<span class="muted">${escapeHtml(location)}</span><br>` : ""}
          ${payload.runSchedule ? `<span class="muted">Airs: ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
          ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` - ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
          ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 300))}${desc.length > 300 ? "..." : ""}</span><br>` : ""}
          ${genresHtml}
          Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
        `;
      }

      renderEpisodes(payload);
      focusProgramExplorer(page);
    }

    async function refreshSchedules() {
      if (!dom.scheduleList) {
        return;
      }
      const schedules = await window.rteDownloader.listBbcSchedules();
      if (!schedules.length) {
        dom.scheduleList.innerHTML = `<div class="item">No BBC schedules yet.</div>`;
        return;
      }
      dom.scheduleList.innerHTML = schedules.map((schedule) => renderSchedulerCard(schedule, "bbc")).join("");
    }

    async function handleQuickDownload() {
      const pageUrl = String(dom.urlInput?.value || "").trim();
      if (!pageUrl) {
        setBbcStatus("Enter a BBC URL.", true);
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
      setBbcStatus(forceDownload ? "Forcing re-download..." : "Resolving stream...");
      const progressToken = createProgressToken("bbc");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setBbcStatus(formatProgressText(progress, "Downloading..."));
      });

      try {
        const data = await window.rteDownloader.downloadFromBbcUrl(pageUrl, progressToken, { forceDownload });
        const cueText = data?.cue?.cuePath ? ` + CUE/chapters generated${formatCueAlignment(data.cue)}` : "";
        const statusPrefix = data?.existing ? "Already downloaded" : "Saved";
        const hintText = data?.existing ? " (click Download again to force re-download)" : "";
        setBbcStatus(`${statusPrefix}: ${data.outputDir}\\${data.fileName}${cueText}${hintText}`);
        if (dom.downloadBtn) {
          if (data?.existing) {
            dom.downloadBtn.dataset.forceNext = "1";
          } else {
            delete dom.downloadBtn.dataset.forceNext;
          }
        }
        if (dom.log) {
          dom.log.textContent = data.log || "Done.";
        }
      } catch (error) {
        if (dom.downloadBtn && shouldArmForceRetry(error?.message)) {
          dom.downloadBtn.dataset.forceNext = "1";
        }
        setBbcStatus(error.message, true);
      } finally {
        detachProgress();
        setButtonBusy(dom.downloadBtn, false, "Download");
      }
    }

    async function handleEpisodeClick(event) {
      const playLocalBtn = event.target.closest("button[data-bbc-play-local-url]");
      if (playLocalBtn) {
        const episodeUrl = playLocalBtn.getAttribute("data-bbc-play-local-url") || "";
        const playTitle = playLocalBtn.getAttribute("data-bbc-play-local-title") || "";
        const playProgramTitle = playLocalBtn.getAttribute("data-bbc-play-local-program-title") || "";
        const playSubtitle = playLocalBtn.getAttribute("data-bbc-play-local-subtitle") || "";
        const playImage = playLocalBtn.getAttribute("data-bbc-play-local-image") || "";
        const playDurationSeconds = Number(playLocalBtn.getAttribute("data-bbc-play-local-duration") || 0) || 0;
        const saved = state.bbcDownloadedAudioByEpisode[episodeUrl];
        if (!saved?.outputDir || !saved?.fileName) {
          setEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true);
          return;
        }
        setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
        try {
          await playEpisodeWithBackgroundCue({
            sourceType: "bbc",
            cacheKey: episodeUrl,
            sourceLabel: "BBC Local",
            title: playTitle || saved.fileName,
            programTitle: playProgramTitle || saved.programTitle || "",
            subtitle: playSubtitle,
            image: playImage,
            episodeUrl,
            durationSeconds: playDurationSeconds,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            playbackKey: `bbc:local:${episodeUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(episodeUrl, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playLocalBtn, false, "Play Local");
        }
        return;
      }

      const playBtn = event.target.closest("button[data-bbc-play-url]");
      if (playBtn) {
        const playUrl = playBtn.getAttribute("data-bbc-play-url") || "";
        const playTitle = playBtn.getAttribute("data-bbc-play-title") || "";
        const playProgramTitle = playBtn.getAttribute("data-bbc-play-program-title") || "";
        const playSubtitle = playBtn.getAttribute("data-bbc-play-subtitle") || "";
        const playImage = playBtn.getAttribute("data-bbc-play-image") || "";
        const playDurationSeconds = Number(playBtn.getAttribute("data-bbc-play-duration") || 0) || 0;
        setButtonBusy(playBtn, true, "Play", "Loading...");
        try {
          const stream = await window.rteDownloader.getBbcEpisodeStream(playUrl);
          await playEpisodeWithBackgroundCue({
            sourceType: "bbc",
            cacheKey: playUrl,
            sourceLabel: "BBC",
            title: playTitle || stream?.title || "Episode",
            programTitle: playProgramTitle || "",
            subtitle: playSubtitle,
            image: playImage || stream?.image || "",
            episodeUrl: playUrl,
            durationSeconds: playDurationSeconds,
            streamUrl: stream?.streamUrl || "",
            playbackKey: `bbc:remote:${playUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(playUrl, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(playUrl, `Play failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playBtn, false, "Play");
        }
        return;
      }

      const downloadBtn = event.target.closest("button[data-bbc-episode-url]");
      if (!downloadBtn) {
        const cueBtn = event.target.closest("button[data-bbc-generate-cue-url]");
        if (!cueBtn) {
          return;
        }
        const episodeUrlCue = cueBtn.getAttribute("data-bbc-generate-cue-url") || "";
        const titleCue = cueBtn.getAttribute("data-bbc-generate-cue-title") || "bbc-episode";
        const programTitleCue = cueBtn.getAttribute("data-bbc-generate-cue-program-title") || "BBC";
        const saved = state.bbcDownloadedAudioByEpisode[episodeUrlCue];
        if (!saved) {
          setEpisodeStatus(episodeUrlCue, "Download episode first, then generate CUE.", true);
          return;
        }
        setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
        setEpisodeStatus(episodeUrlCue, "Generating CUE/chapters...");
        clearCueDebugLog("bbc", episodeUrlCue);
        const cueProgressToken = createProgressToken(`bbc-cue-${Date.now()}`);
        const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
          if (progress?.kind === "cue" && progress?.message) {
            appendCueDebugLog("bbc", episodeUrlCue, progress.message);
          }
          setEpisodeStatus(episodeUrlCue, formatProgressText(progress, "Generating CUE/chapters..."));
        });
        try {
          const cue = await window.rteDownloader.generateCue({
            sourceType: "bbc",
            episodeUrl: episodeUrlCue,
            title: titleCue,
            programTitle: programTitleCue,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            progressToken: cueProgressToken
          });
          setEpisodeChapters(episodeUrlCue, cue.chapters || []);
          setEpisodeStatus(episodeUrlCue, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
        } catch (error) {
          setEpisodeStatus(episodeUrlCue, `CUE failed: ${error.message}`, true);
        } finally {
          detachCueProgress();
          setButtonBusy(cueBtn, false, "Generate CUE");
        }
        return;
      }

      const episodeUrl = downloadBtn.getAttribute("data-bbc-episode-url") || "";
      const downloadUrl = downloadBtn.getAttribute("data-bbc-download-url") || episodeUrl;
      const title = downloadBtn.getAttribute("data-bbc-episode-title") || "bbc-episode";
      const programTitle = downloadBtn.getAttribute("data-bbc-program-title") || "BBC";
      const publishedTime = downloadBtn.getAttribute("data-bbc-published") || "";
      const image = downloadBtn.getAttribute("data-bbc-image") || "";
      const description = downloadBtn.getAttribute("data-bbc-description") || "";
      const location = downloadBtn.getAttribute("data-bbc-location") || "";
      const hosts = parseMetadataAttr(downloadBtn.getAttribute("data-bbc-hosts"));
      const genres = parseMetadataAttr(downloadBtn.getAttribute("data-bbc-genres"));
      if (!episodeUrl) {
        return;
      }

      const forceDownload = downloadBtn.dataset.forceNext === "1";
      if (forceDownload) {
        delete downloadBtn.dataset.forceNext;
      }
      setEpisodeStatus(episodeUrl, forceDownload ? "Forcing re-download..." : "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken("bbc-episode");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setEpisodeStatus(episodeUrl, formatProgressText(progress, "Downloading..."));
      });

      try {
        const data = await window.rteDownloader.downloadFromBbcUrl(downloadUrl, progressToken, {
          title,
          programTitle,
          publishedTime,
          image,
          description,
          location,
          hosts,
          genres,
          forceDownload
        });
        state.bbcDownloadedAudioByEpisode[episodeUrl] = {
          outputDir: data.outputDir,
          fileName: data.fileName,
          episodeUrl,
          title,
          programTitle
        };
        if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
          setEpisodeChapters(episodeUrl, data.cue.chapters);
        }
        const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
        const statusPrefix = data?.existing ? "Already downloaded" : "Downloaded";
        const panelPrefix = data?.existing ? "Already downloaded" : "Saved";
        const hintText = data?.existing ? " (click Download again to force re-download)" : "";
        setEpisodeStatus(episodeUrl, `${statusPrefix}: ${data.fileName}${cueText}${hintText}`);
        setBbcStatus(`${panelPrefix}: ${data.outputDir}\\${data.fileName}${cueText}`);
        if (data?.existing) {
          downloadBtn.dataset.forceNext = "1";
        } else {
          delete downloadBtn.dataset.forceNext;
        }
      } catch (error) {
        if (shouldArmForceRetry(error?.message)) {
          downloadBtn.dataset.forceNext = "1";
        }
        setEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
      } finally {
        detachProgress();
        setButtonBusy(downloadBtn, false, "Download");
      }
    }

    async function handleScheduleClick(event) {
      const playLatestBtn = event.target.closest("button[data-bbc-schedule-play-output]");
      if (playLatestBtn) {
        try {
          await playFromDownloadedFile({
            outputDir: playLatestBtn.getAttribute("data-bbc-schedule-play-output"),
            fileName: playLatestBtn.getAttribute("data-bbc-schedule-play-file"),
            title: playLatestBtn.getAttribute("data-bbc-schedule-play-title") || "",
            source: "BBC Local",
            subtitle: "Latest scheduled download",
            image: playLatestBtn.getAttribute("data-bbc-schedule-play-image") || "",
            episodeUrl: playLatestBtn.getAttribute("data-bbc-schedule-play-episode-url") || "",
            sourceType: playLatestBtn.getAttribute("data-bbc-schedule-play-source-type") || "bbc"
          });
        } catch (error) {
          setSettingsStatus(`Scheduler play failed: ${error.message}`, true);
        }
        return;
      }
      const toggleBtn = event.target.closest("button[data-bbc-schedule-toggle]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-bbc-schedule-toggle");
        const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
        await window.rteDownloader.setBbcScheduleEnabled(id, enabled);
        await refreshSchedules();
        return;
      }
      const runBtn = event.target.closest("button[data-bbc-schedule-run]");
      if (runBtn) {
        const id = runBtn.getAttribute("data-bbc-schedule-run");
        setButtonBusy(runBtn, true, "Run Now", "Running...");
        setScheduleStatus(id, "Running scheduler now...");
        try {
          const result = await window.rteDownloader.runBbcScheduleNow(id);
          await refreshSchedules();
          setScheduleStatus(id, formatRunNowResult(result));
        } catch (error) {
          setScheduleStatus(id, `Run Now failed: ${error.message}`, true);
        } finally {
          setButtonBusy(runBtn, false, "Run Now");
        }
        return;
      }
      const removeBtn = event.target.closest("button[data-bbc-schedule-remove]");
      if (removeBtn) {
        const id = removeBtn.getAttribute("data-bbc-schedule-remove");
        await window.rteDownloader.removeBbcSchedule(id);
        await refreshSchedules();
      }
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
        if (!dom.downloadBtn?.disabled) {
          dom.downloadBtn.click();
        }
      });
      dom.stationSelect?.addEventListener("change", () => {
        refreshLivePanel().catch((error) => {
          if (dom.liveNow) {
            dom.liveNow.textContent = error.message;
          }
        });
      });
      dom.refreshLiveBtn?.addEventListener("click", () => {
        setButtonBusy(dom.refreshLiveBtn, true, "Refresh");
        loadLiveStations()
          .catch((error) => {
            if (dom.liveNow) {
              dom.liveNow.textContent = error.message;
            }
          })
          .finally(() => {
            setButtonBusy(dom.refreshLiveBtn, false, "Refresh");
          });
      });
      dom.liveOverlayPlayBtn?.addEventListener("click", () => {
        const stationUrl = dom.liveOverlayPlayBtn.dataset.stationUrl || "";
        const candidates = buildBbcAutoplayCandidates(stationUrl);
        if (!candidates.length || !dom.livePlayerFrame) {
          return;
        }
        const ts = String(Date.now());
        dom.livePlayerFrame.src = setUrlParam(candidates[0], "_ts", ts);
        if (candidates[1]) {
          setTimeout(() => {
            dom.livePlayerFrame.src = setUrlParam(candidates[1], "_ts", String(Date.now()));
          }, 450);
        }
        if (candidates[2]) {
          setTimeout(() => {
            dom.livePlayerFrame.src = setUrlParam(candidates[2], "_ts", String(Date.now()));
          }, 1000);
        }
        dom.liveOverlayPlayBtn.classList.add("hidden");
      });
      dom.programSearchResult?.addEventListener("click", async (event) => {
        const schedBtn = event.target.closest(".bbc-quick-schedule-btn");
        if (schedBtn) {
          event.stopPropagation();
          const url = schedBtn.getAttribute("data-bbc-schedule-url") || "";
          if (!url || !window.rteDownloader?.addBbcSchedule) {
            return;
          }
          schedBtn.textContent = "Adding...";
          schedBtn.disabled = true;
          try {
            await window.rteDownloader.addBbcSchedule(url, { backfillCount: 1 });
            schedBtn.textContent = "Scheduled";
            await refreshSchedules();
          } catch {
            schedBtn.textContent = "Error";
            schedBtn.disabled = false;
          }
          return;
        }
        const item = event.target.closest(".item[data-load-bbc-program-url]");
        if (!item) {
          return;
        }
        const url = item.getAttribute("data-load-bbc-program-url");
        if (url) {
          hideSearchDropdown();
          loadProgram(url, 1).catch((error) => {
            if (dom.programMeta) {
              dom.programMeta.textContent = error.message;
            }
          });
        }
      });
      dom.discoverBtn?.addEventListener("click", () => {
        runDiscovery().catch(() => {});
      });
      dom.discoveryResult?.addEventListener("click", async (event) => {
        const schedBtn = event.target.closest(".bbc-quick-schedule-btn");
        if (schedBtn) {
          event.stopPropagation();
          const url = schedBtn.getAttribute("data-bbc-schedule-url") || "";
          if (!url || !window.rteDownloader?.addBbcSchedule) {
            return;
          }
          schedBtn.textContent = "Adding...";
          schedBtn.disabled = true;
          try {
            await window.rteDownloader.addBbcSchedule(url, { backfillCount: 1 });
            schedBtn.textContent = "Scheduled";
            await refreshSchedules();
          } catch {
            schedBtn.textContent = "Error";
            schedBtn.disabled = false;
          }
          return;
        }
        const item = event.target.closest(".item[data-load-bbc-program-url]");
        if (!item) {
          return;
        }
        const url = item.getAttribute("data-load-bbc-program-url");
        if (url) {
          loadProgram(url, 1).catch((error) => {
            if (dom.programMeta) {
              dom.programMeta.textContent = error.message;
            }
          });
        }
      });
      dom.loadProgramBtn?.addEventListener("click", () => {
        const url = String(dom.programUrlInput?.value || "").trim();
        if (!url) {
          if (dom.programMeta) {
            dom.programMeta.textContent = "Enter a BBC program URL first.";
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
          .finally(() => {
            setButtonBusy(dom.loadProgramBtn, false, "Load Episodes");
          });
      });
      dom.programSearchBtn?.addEventListener("click", async () => {
        await runProgramSearch(dom.programSearchInput?.value.trim() || "");
      });
      dom.programSearchInput?.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        await runProgramSearch(dom.programSearchInput.value.trim());
      });
      dom.programSearchInput?.addEventListener("focus", () => {
        if (state.hasLoadedBbcProgramCatalog) {
          dom.programSearchResult?.classList.remove("hidden");
          return;
        }
        dom.programSearchResult?.classList.remove("hidden");
        if (dom.programSearchResult) {
          dom.programSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
        }
        state.hasLoadedBbcProgramCatalog = true;
      });
      dom.programSearchInput?.addEventListener("input", () => {
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
        }
        const query = dom.programSearchInput.value.trim();
        searchDebounceTimer = setTimeout(() => {
          if (query.length < 2) {
            dom.programSearchResult?.classList.remove("hidden");
            if (dom.programSearchResult) {
              dom.programSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
            }
            return;
          }
          runProgramSearch(query).catch(() => {});
        }, 220);
      });
      dom.programResultFilterInput?.addEventListener("input", () => {
        renderProgramRows(dom.programSearchResult, lastSearchRows, { emptyText: "No BBC programs found." });
        renderProgramRows(dom.discoveryResult, lastDiscoveryRows, { emptyText: "No BBC programs found." });
      });
      dom.programUrlInput?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        if (!dom.loadProgramBtn?.disabled) {
          dom.loadProgramBtn.click();
        }
      });
      dom.episodeFilterInput?.addEventListener("input", () => {
        state.bbcProgramPage = 1;
        renderEpisodes(state.bbcEpisodesPayload || { episodes: [] });
      });
      dom.prevPageBtn?.addEventListener("click", () => {
        if (!state.bbcProgramUrl || state.bbcProgramPage <= 1) {
          return;
        }
        state.bbcProgramPage -= 1;
        renderEpisodes(state.bbcEpisodesPayload || { episodes: [] });
        if (dom.programMeta) {
          const p = state.bbcEpisodesPayload || {};
          const totalRows = Number(p?.episodes?.length || 0);
          const cadence = String(p.cadence || "").trim();
          const cadenceBadge = cadence && cadence !== "irregular" && cadence !== "unknown" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
          const genres = Array.isArray(p.genres) ? p.genres : [];
          const genresHtml = genres.length ? `<div class="genre-pills" style="margin-top:0.3rem;">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
          dom.programMeta.innerHTML = `
            <strong>${escapeHtml(p.title || "BBC Program")}</strong>${cadenceBadge}<br>
            ${p.runSchedule ? `<span class="muted">Airs: ${escapeHtml(toLocalSchedule(p.runSchedule))}</span><br>` : ""}
            ${p.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(p.nextBroadcastAt))}${p.nextBroadcastTitle ? ` - ${escapeHtml(p.nextBroadcastTitle)}` : ""}<br>` : ""}
            ${p.description ? `<span class="muted">${escapeHtml(String(p.description).slice(0, 300))}${String(p.description).length > 300 ? "..." : ""}</span><br>` : ""}
            ${genresHtml}
            Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
          `;
        }
      });
      dom.nextPageBtn?.addEventListener("click", () => {
        if (!state.bbcProgramUrl || !state.bbcEpisodesPayload) {
          return;
        }
        if (state.bbcProgramPage >= state.bbcProgramMaxPages) {
          return;
        }
        state.bbcProgramPage += 1;
        renderEpisodes(state.bbcEpisodesPayload || { episodes: [] });
        if (dom.programMeta) {
          const p = state.bbcEpisodesPayload || {};
          const totalRows = Number(p?.episodes?.length || 0);
          const cadence = String(p.cadence || "").trim();
          const cadenceBadge = cadence && cadence !== "irregular" && cadence !== "unknown" ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>` : "";
          const genres = Array.isArray(p.genres) ? p.genres : [];
          const genresHtml = genres.length ? `<div class="genre-pills" style="margin-top:0.3rem;">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
          dom.programMeta.innerHTML = `
            <strong>${escapeHtml(p.title || "BBC Program")}</strong>${cadenceBadge}<br>
            ${p.runSchedule ? `<span class="muted">Airs: ${escapeHtml(toLocalSchedule(p.runSchedule))}</span><br>` : ""}
            ${p.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(p.nextBroadcastAt))}${p.nextBroadcastTitle ? ` - ${escapeHtml(p.nextBroadcastTitle)}` : ""}<br>` : ""}
            ${p.description ? `<span class="muted">${escapeHtml(String(p.description).slice(0, 300))}${String(p.description).length > 300 ? "..." : ""}</span><br>` : ""}
            ${genresHtml}
            Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
          `;
        }
      });
      dom.scheduleBackfillMode?.addEventListener("change", () => {
        const isBackfill = dom.scheduleBackfillMode.value === "backfill";
        if (dom.scheduleBackfillCount) {
          dom.scheduleBackfillCount.disabled = !isBackfill;
        }
      });
      dom.addScheduleBtn?.addEventListener("click", async () => {
        if (!state.bbcProgramUrl) {
          if (dom.programMeta) {
            dom.programMeta.textContent = "Load a BBC program first.";
          }
          return;
        }
        const backfillCount = dom.scheduleBackfillMode?.value === "backfill"
          ? Math.max(1, Math.floor(Number(dom.scheduleBackfillCount?.value || 1)))
          : 0;
        setButtonBusy(dom.addScheduleBtn, true, "Add Scheduler", "Adding...");
        try {
          const added = await window.rteDownloader.addBbcSchedule(state.bbcProgramUrl, { backfillCount });
          await refreshSchedules();
          if (added?.id && backfillCount > 0) {
            setScheduleStatus(added.id, `Backfill queued: 0/${backfillCount}`);
          }
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
      refreshLivePanel,
      loadLiveStations,
      loadProgram,
      refreshSchedules,
      runProgramSearch,
      runDiscovery,
      hideSearchDropdown
    };
  }

  window.KimbleBbcScreen = {
    create: createBbcScreen
  };
})();
