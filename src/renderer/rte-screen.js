(function initKimbleRteScreen() {
  function createRteScreen(deps) {
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
    const parseRteDurationSeconds = deps.parseRteDurationSeconds;
    const clearCueDebugLog = deps.clearCueDebugLog;
    const appendCueDebugLog = deps.appendCueDebugLog;
    const formatCueSource = deps.formatCueSource;
    const formatCueAlignment = deps.formatCueAlignment;
    const shouldArmForceRetry = deps.shouldArmForceRetry;
    const renderSchedulerCard = deps.renderSchedulerCard;
    const playFromDownloadedFile = deps.playFromDownloadedFile;
    const formatRunNowResult = deps.formatRunNowResult;
    const setEpisodeChapters = deps.setEpisodeChapters;
    const setSettingsStatus = deps.setSettingsStatus;

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
        episode?.publishedTimeFormatted,
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

    function renderProgramCards(items) {
      return items.map((item) => {
        const genresHtml = (item.genres && item.genres.length)
          ? `<div class="genre-pills">${item.genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
          : "";
        const desc = String(item.description || "").trim();
        const hosts = normalizeMetadataList(item.hosts);
        const location = String(item.location || "").trim();
        return `
          <div class="item clickable" data-load-program-url="${escapeHtml(item.programUrl)}">
            <div class="search-card">
              <div>${item.image ? `<img src="${escapeHtml(item.image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
              <div>
                <div class="item-title">${escapeHtml(item.title)}</div>
                ${item.runSchedule ? `<div class="item-meta">Airs: ${escapeHtml(toLocalSchedule(item.runSchedule))}</div>` : ""}
                ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
                ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
                ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "..." : ""}</div>` : ""}
                ${genresHtml}
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    function setEpisodeStatus(clipId, text, isError = false) {
      const statusNode = document.querySelector(`[data-episode-status="${String(clipId || "")}"]`);
      if (!statusNode) {
        return;
      }
      const safeText = String(text || "");
      statusNode.textContent = safeText;
      statusNode.style.display = safeText ? "block" : "none";
      statusNode.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
    }

    function setScheduleStatus(scheduleId, text, isError = false) {
      const node = document.querySelector(`[data-schedule-status="${String(scheduleId || "")}"]`);
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

    function renderSearchPrograms(items) {
      dom.programSearchResult?.classList.remove("hidden");
      if (!dom.programSearchResult) {
        return;
      }
      const rows = filterProgramRows(items);
      if (!rows.length) {
        dom.programSearchResult.innerHTML = `<div class="item">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No programs found."}</div>`;
        return;
      }
      dom.programSearchResult.innerHTML = renderProgramCards(rows);
    }

    function renderDiscoveryPrograms(items) {
      if (!dom.discoveryResult) {
        return;
      }
      const rows = filterProgramRows(items);
      dom.discoveryResult.innerHTML = rows.length
        ? renderProgramCards(rows)
        : `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No programs found."}</div>`;
    }

    function hideSearchDropdown() {
      dom.programSearchResult?.classList.add("hidden");
    }

    async function runProgramSearch(query) {
      if (!dom.programSearchBtn || !dom.programSearchResult) {
        return;
      }
      setButtonBusy(dom.programSearchBtn, true, "Search");
      dom.programSearchResult.classList.remove("hidden");
      dom.programSearchResult.innerHTML = `<div class="item">Searching...</div>`;
      try {
        const items = await window.rteDownloader.searchPrograms(query);
        lastSearchRows = Array.isArray(items) ? items : [];
        renderSearchPrograms(items);
      } catch (error) {
        dom.programSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
      } finally {
        setButtonBusy(dom.programSearchBtn, false, "Search");
      }
    }

    async function runDiscovery() {
      if (!window.rteDownloader?.getRteDiscovery || !dom.discoveryResult || !dom.discoverBtn) {
        return;
      }
      setButtonBusy(dom.discoverBtn, true, "Discover Shows", "Loading...");
      dom.discoveryResult.innerHTML = `<div class="item muted">Fetching random programs...</div>`;
      try {
        const results = await window.rteDownloader.getRteDiscovery(getDiscoveryCount());
        lastDiscoveryRows = Array.isArray(results?.results) ? results.results : Array.isArray(results) ? results : [];
        renderDiscoveryPrograms(lastDiscoveryRows);
      } catch (error) {
        dom.discoveryResult.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(error.message)}</div>`;
      } finally {
        setButtonBusy(dom.discoverBtn, false, "Discover Shows");
      }
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
      const currentPage = Math.max(1, Math.min(totalPages, Number(state.currentProgramPage || 1)));
      const start = (currentPage - 1) * getEpisodesPerPage();
      const visibleRows = filteredRows.slice(start, start + getEpisodesPerPage());
      state.currentProgramPage = currentPage;
      state.currentMaxPages = totalPages;

      if (!filteredRows.length) {
        dom.episodesResult.innerHTML = `<div class="item">${query ? "No matching loaded episodes found." : "No episodes returned for this page."}</div>`;
        return;
      }

      dom.episodesResult.innerHTML = visibleRows.map((episode) => {
        const clipId = String(episode.clipId || "");
        const img = episode.image ? `<img src="${escapeHtml(episode.image)}" alt="" class="episode-thumb" loading="lazy" />` : "";
        const desc = String(episode.description || "").trim();
        const hosts = normalizeMetadataList(episode.hosts);
        const location = String(episode.location || "").trim();
        const genres = Array.isArray(episode.genres) ? episode.genres : [];
        const descHtml = desc ? `<div class="item-meta muted" style="max-width:600px;">${escapeHtml(desc.slice(0, 200))}${desc.length > 200 ? "..." : ""}</div>` : "";
        const genresHtml = genres.length ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : "";
        const published = escapeHtml(episode.publishedTimeFormatted || episode.publishedTime || "");
        const duration = episode.durationString ? ` &middot; ${escapeHtml(episode.durationString)}` : "";
        const subtitle = `${payload.title || "RTE Program"}${episode.publishedTimeFormatted ? ` - ${episode.publishedTimeFormatted}` : ""}`;
        return `
          <div class="item">
            ${img}
            <div class="item-title">${escapeHtml(episode.title)}</div>
            <div class="item-meta">${published}${duration}</div>
            ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
            ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
            ${descHtml}
            ${genresHtml}
            <div class="item-actions">
              <button
                class="secondary"
                data-play-clip="${escapeHtml(clipId)}"
                data-play-title="${escapeHtml(episode.fullTitle || episode.title)}"
                data-play-program-title="${escapeHtml(payload.title || "")}"
                data-play-subtitle="${escapeHtml(subtitle)}"
                data-play-image="${escapeHtml(episode.image || "")}"
                data-play-duration="${escapeHtml(episode.durationString || "")}"
                data-play-episode-url="${escapeHtml(episode.episodeUrl || "")}"
              >Play</button>
              <button
                class="secondary"
                data-play-local-clip="${escapeHtml(clipId)}"
                data-play-local-title="${escapeHtml(episode.fullTitle || episode.title)}"
                data-play-local-program-title="${escapeHtml(payload.title || "")}"
                data-play-local-subtitle="${escapeHtml(subtitle)}"
                data-play-local-image="${escapeHtml(episode.image || "")}"
                data-play-local-duration="${escapeHtml(episode.durationString || "")}"
                data-play-local-episode-url="${escapeHtml(episode.episodeUrl || "")}"
              >Play Local</button>
              <button data-download-clip="${escapeHtml(clipId)}" data-download-title="${escapeHtml(episode.fullTitle || episode.title)}" data-download-program-title="${escapeHtml(payload.title || "")}" data-download-url="${escapeHtml(episode.episodeUrl || "")}" data-download-published="${escapeHtml(episode.publishedTime || episode.publishedTimeFormatted || "")}" data-download-image="${escapeHtml(episode.image || payload.image || "")}" data-download-description="${escapeHtml(desc)}" data-download-location="${escapeHtml(location)}" data-download-hosts="${escapeHtml(JSON.stringify(hosts))}" data-download-genres="${escapeHtml(JSON.stringify(genres))}">Download</button>
              <button class="secondary" data-generate-cue-clip="${escapeHtml(clipId)}" data-generate-cue-title="${escapeHtml(episode.fullTitle || episode.title)}" data-generate-cue-program-title="${escapeHtml(payload.title || "")}" data-generate-cue-url="${escapeHtml(episode.episodeUrl || "")}">Generate CUE</button>
            </div>
            <div class="item-meta episode-status" data-episode-status="${escapeHtml(clipId)}" style="display:none;"></div>
            <div class="cue-debug-log" data-episode-cue-debug="${escapeHtml(clipId)}" style="display:none;"></div>
            <div class="episode-inline-playlist" data-episode-chapters="${escapeHtml(clipId)}"></div>
            <div class="episode-inline-playlist" data-episode-playlist="${escapeHtml(clipId)}">
              <div class="playlist-note">Queued playlist load...</div>
            </div>
          </div>
        `;
      }).join("");

      deps.autoLoadVisiblePlaylists(visibleRows).catch(() => {});
    }

    async function loadProgram(programUrl, page = 1) {
      const payload = await window.rteDownloader.getProgramEpisodes(programUrl, 1);
      const totalRows = Number(payload?.episodes?.length || 0);
      const totalPages = Math.max(1, Math.ceil(totalRows / getEpisodesPerPage()));
      const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));

      state.currentProgramUrl = payload.programUrl;
      state.currentProgramPage = targetPage;
      state.currentMaxPages = totalPages;
      state.currentEpisodes = payload;

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
          <strong>${escapeHtml(payload.title)}</strong>${cadenceBadge}<br>
          ${hosts.length ? `<span class="muted">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</span><br>` : ""}
          ${location ? `<span class="muted">${escapeHtml(location)}</span><br>` : ""}
          ${payload.runSchedule ? `<span class="muted">Airs: ${escapeHtml(toLocalSchedule(payload.runSchedule))}</span><br>` : ""}
          ${payload.nextBroadcastAt ? `Next: ${escapeHtml(localizeNextBroadcast(payload.nextBroadcastAt))}${payload.nextBroadcastTitle ? ` - ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
          ${desc ? `<span class="muted">${escapeHtml(desc.slice(0, 300))}${desc.length > 300 ? "..." : ""}</span><br>` : ""}
          ${genresHtml}
          Page ${state.currentProgramPage} of ${state.currentMaxPages} - ${totalRows} episodes
        `;
      }

      renderEpisodes(payload);
      focusProgramExplorer(page);
    }

    async function refreshSchedules() {
      if (!dom.scheduleList) {
        return;
      }
      const schedules = await window.rteDownloader.listSchedules();
      if (!schedules.length) {
        dom.scheduleList.innerHTML = `<div class="item">No schedules yet.</div>`;
        return;
      }
      dom.scheduleList.innerHTML = schedules.map((schedule) => renderSchedulerCard(schedule, "rte")).join("");
    }

    async function handleEpisodeClick(event) {
      const playLocalBtn = event.target.closest("button[data-play-local-clip]");
      if (playLocalBtn) {
        const clipId = playLocalBtn.getAttribute("data-play-local-clip") || "";
        const playTitle = playLocalBtn.getAttribute("data-play-local-title") || "";
        const playProgramTitle = playLocalBtn.getAttribute("data-play-local-program-title") || "";
        const playSubtitle = playLocalBtn.getAttribute("data-play-local-subtitle") || "";
        const playImage = playLocalBtn.getAttribute("data-play-local-image") || "";
        const playDurationText = playLocalBtn.getAttribute("data-play-local-duration") || "";
        const playEpisodeUrl = playLocalBtn.getAttribute("data-play-local-episode-url") || "";
        const saved = state.rteDownloadedAudioByClip[String(clipId)];
        if (!saved?.outputDir || !saved?.fileName) {
          setEpisodeStatus(clipId, "Download this episode first, then use Play Local.", true);
          return;
        }
        setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
        try {
          await playEpisodeWithBackgroundCue({
            sourceType: "rte",
            cacheKey: clipId,
            sourceLabel: "RTE Local",
            title: playTitle || saved.fileName,
            programTitle: playProgramTitle || saved.programTitle || "",
            subtitle: playSubtitle,
            image: playImage,
            episodeUrl: playEpisodeUrl,
            clipId,
            durationSeconds: parseRteDurationSeconds(playDurationText),
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            playbackKey: `rte:local:${clipId}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(clipId, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(clipId, `Play Local failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playLocalBtn, false, "Play Local");
        }
        return;
      }

      const playBtn = event.target.closest("button[data-play-clip]");
      if (playBtn) {
        const playClipId = playBtn.getAttribute("data-play-clip") || "";
        const playTitle = playBtn.getAttribute("data-play-title") || "";
        const playProgramTitle = playBtn.getAttribute("data-play-program-title") || "";
        const playSubtitle = playBtn.getAttribute("data-play-subtitle") || "";
        const playImage = playBtn.getAttribute("data-play-image") || "";
        const playDurationText = playBtn.getAttribute("data-play-duration") || "";
        if (!playClipId) {
          return;
        }
        setButtonBusy(playBtn, true, "Play", "Loading...");
        try {
          const stream = await window.rteDownloader.getRteEpisodeStream(playClipId);
          await playEpisodeWithBackgroundCue({
            sourceType: "rte",
            cacheKey: playClipId,
            sourceLabel: "RTE",
            title: playTitle || `clip ${playClipId}`,
            programTitle: playProgramTitle || "",
            subtitle: playSubtitle,
            image: playImage,
            episodeUrl: playBtn.getAttribute("data-play-episode-url") || "",
            clipId: playClipId,
            durationSeconds: parseRteDurationSeconds(playDurationText),
            streamUrl: stream?.streamUrl || "",
            playbackKey: `rte:remote:${playClipId}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(playClipId, text, isError)
          });
        } catch (error) {
          setEpisodeStatus(playClipId, `Play failed: ${error.message}`, true);
        } finally {
          setButtonBusy(playBtn, false, "Play");
        }
        return;
      }

      const downloadBtn = event.target.closest("button[data-download-clip]");
      if (!downloadBtn) {
        const cueBtn = event.target.closest("button[data-generate-cue-clip]");
        if (!cueBtn) {
          return;
        }
        const clipIdCue = cueBtn.getAttribute("data-generate-cue-clip") || "";
        const titleCue = cueBtn.getAttribute("data-generate-cue-title") || "rte-episode";
        const programTitleCue = cueBtn.getAttribute("data-generate-cue-program-title") || "";
        const episodeUrlCue = cueBtn.getAttribute("data-generate-cue-url") || "";
        const saved = state.rteDownloadedAudioByClip[clipIdCue];
        if (!saved) {
          setEpisodeStatus(clipIdCue, "Download episode first, then generate CUE.", true);
          return;
        }
        setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
        setEpisodeStatus(clipIdCue, "Generating CUE/chapters...");
        clearCueDebugLog("rte", clipIdCue);
        const cueProgressToken = createProgressToken(`cue-${clipIdCue}`);
        const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
          if (progress?.kind === "cue" && progress?.message) {
            appendCueDebugLog("rte", clipIdCue, progress.message);
          }
          setEpisodeStatus(clipIdCue, formatProgressText(progress, "Generating CUE/chapters..."));
        });
        try {
          const cue = await window.rteDownloader.generateCue({
            sourceType: "rte",
            episodeUrl: episodeUrlCue,
            title: titleCue,
            programTitle: programTitleCue,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            progressToken: cueProgressToken
          });
          setEpisodeChapters(clipIdCue, cue.chapters || []);
          setEpisodeStatus(clipIdCue, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`);
        } catch (error) {
          setEpisodeStatus(clipIdCue, `CUE failed: ${error.message}`, true);
        } finally {
          detachCueProgress();
          setButtonBusy(cueBtn, false, "Generate CUE");
        }
        return;
      }

      const clipId = downloadBtn.getAttribute("data-download-clip");
      const title = downloadBtn.getAttribute("data-download-title") || "rte-episode";
      const programTitle = downloadBtn.getAttribute("data-download-program-title") || "";
      const episodeUrl = downloadBtn.getAttribute("data-download-url") || "";
      const publishedTime = downloadBtn.getAttribute("data-download-published") || "";
      const artworkUrl = downloadBtn.getAttribute("data-download-image") || "";
      const description = downloadBtn.getAttribute("data-download-description") || "";
      const location = downloadBtn.getAttribute("data-download-location") || "";
      const hosts = parseMetadataAttr(downloadBtn.getAttribute("data-download-hosts"));
      const genres = parseMetadataAttr(downloadBtn.getAttribute("data-download-genres"));

      if (!clipId) {
        return;
      }

      const forceDownload = downloadBtn.dataset.forceNext === "1";
      if (forceDownload) {
        delete downloadBtn.dataset.forceNext;
      }
      setEpisodeStatus(clipId, forceDownload ? "Forcing re-download..." : "Starting download...");
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken(`episode-${clipId}`);
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setEpisodeStatus(clipId, formatProgressText(progress, "Downloading..."));
      });

      try {
        const data = await window.rteDownloader.downloadEpisode({ clipId, title, programTitle, episodeUrl, publishedTime, artworkUrl, description, location, hosts, genres, progressToken, forceDownload });
        state.rteDownloadedAudioByClip[String(clipId)] = {
          outputDir: data.outputDir,
          fileName: data.fileName,
          episodeUrl,
          title,
          programTitle
        };
        if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
          setEpisodeChapters(clipId, data.cue.chapters);
        }
        const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
        const statusPrefix = data?.existing ? "Already downloaded" : "Downloaded";
        const hintText = data?.existing ? " (click Download again to force re-download)" : "";
        setEpisodeStatus(clipId, `${statusPrefix}: ${data.fileName}${cueText}${hintText}`);
        if (data?.existing) {
          downloadBtn.dataset.forceNext = "1";
        } else {
          delete downloadBtn.dataset.forceNext;
        }
      } catch (error) {
        if (shouldArmForceRetry(error?.message)) {
          downloadBtn.dataset.forceNext = "1";
        }
        setEpisodeStatus(clipId, `Download failed: ${error.message}`, true);
      } finally {
        detachProgress();
        setButtonBusy(downloadBtn, false, "Download");
      }
    }

    async function handleScheduleClick(event) {
      const playLatestBtn = event.target.closest("button[data-schedule-play-output]");
      if (playLatestBtn) {
        try {
          await playFromDownloadedFile({
            outputDir: playLatestBtn.getAttribute("data-schedule-play-output"),
            fileName: playLatestBtn.getAttribute("data-schedule-play-file"),
            title: playLatestBtn.getAttribute("data-schedule-play-title") || "",
            source: "RTE Local",
            subtitle: "Latest scheduled download",
            image: playLatestBtn.getAttribute("data-schedule-play-image") || "",
            episodeUrl: playLatestBtn.getAttribute("data-schedule-play-episode-url") || "",
            sourceType: playLatestBtn.getAttribute("data-schedule-play-source-type") || "rte"
          });
        } catch (error) {
          setSettingsStatus(`Scheduler play failed: ${error.message}`, true);
        }
        return;
      }
      const toggleBtn = event.target.closest("button[data-schedule-toggle]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-schedule-toggle");
        const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
        await window.rteDownloader.setScheduleEnabled(id, enabled);
        await refreshSchedules();
        return;
      }

      const runBtn = event.target.closest("button[data-schedule-run]");
      if (runBtn) {
        const id = runBtn.getAttribute("data-schedule-run");
        setButtonBusy(runBtn, true, "Run Now", "Running...");
        setScheduleStatus(id, "Running scheduler now...");
        try {
          const result = await window.rteDownloader.runScheduleNow(id);
          await refreshSchedules();
          setScheduleStatus(id, formatRunNowResult(result));
        } catch (error) {
          setScheduleStatus(id, `Run Now failed: ${error.message}`, true);
        } finally {
          setButtonBusy(runBtn, false, "Run Now");
        }
        return;
      }

      const removeBtn = event.target.closest("button[data-schedule-remove]");
      if (removeBtn) {
        const id = removeBtn.getAttribute("data-schedule-remove");
        await window.rteDownloader.removeSchedule(id);
        await refreshSchedules();
      }
    }

    function bindEvents() {
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

      dom.programSearchInput?.addEventListener("focus", async () => {
        if (state.hasLoadedProgramCatalog) {
          dom.programSearchResult?.classList.remove("hidden");
          return;
        }
        await runProgramSearch("");
        state.hasLoadedProgramCatalog = true;
      });

      dom.programSearchInput?.addEventListener("input", async () => {
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
        }
        const query = dom.programSearchInput.value.trim();
        searchDebounceTimer = setTimeout(async () => {
          if (!query) {
            await runProgramSearch("");
            state.hasLoadedProgramCatalog = true;
            return;
          }
          await runProgramSearch(query);
        }, 220);
      });

      dom.programResultFilterInput?.addEventListener("input", () => {
        renderSearchPrograms(lastSearchRows);
        renderDiscoveryPrograms(lastDiscoveryRows);
      });

      dom.programSearchResult?.addEventListener("click", (event) => {
        const item = event.target.closest(".item[data-load-program-url]");
        if (!item) {
          return;
        }
        const url = item.getAttribute("data-load-program-url");
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

      dom.discoveryResult?.addEventListener("click", (event) => {
        const item = event.target.closest(".item[data-load-program-url]");
        if (!item) {
          return;
        }
        const url = item.getAttribute("data-load-program-url");
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

      dom.prevPageBtn?.addEventListener("click", () => {
        if (!state.currentProgramUrl || state.currentProgramPage <= 1) {
          return;
        }
        state.currentProgramPage -= 1;
        loadProgram(state.currentProgramUrl, state.currentProgramPage).catch((error) => {
          if (dom.programMeta) {
            dom.programMeta.textContent = error.message;
          }
        });
      });

      dom.nextPageBtn?.addEventListener("click", () => {
        if (!state.currentProgramUrl || !state.currentEpisodes) {
          return;
        }
        if (state.currentProgramPage >= state.currentMaxPages) {
          return;
        }
        state.currentProgramPage += 1;
        loadProgram(state.currentProgramUrl, state.currentProgramPage).catch((error) => {
          if (dom.programMeta) {
            dom.programMeta.textContent = error.message;
          }
        });
      });

      dom.episodeFilterInput?.addEventListener("input", () => {
        state.currentProgramPage = 1;
        renderEpisodes(state.currentEpisodes || { episodes: [] });
      });

      dom.addScheduleBtn?.addEventListener("click", async () => {
        if (!state.currentProgramUrl) {
          if (dom.programMeta) {
            dom.programMeta.textContent = "Load a program first.";
          }
          return;
        }
        const backfillCount = dom.scheduleBackfillMode?.value === "backfill"
          ? Math.max(1, Math.floor(Number(dom.scheduleBackfillCount?.value || 1)))
          : 0;
        setButtonBusy(dom.addScheduleBtn, true, "Add Scheduler", "Adding...");
        try {
          const added = await window.rteDownloader.addSchedule(state.currentProgramUrl, { backfillCount });
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
      loadProgram,
      refreshSchedules,
      runProgramSearch,
      runDiscovery,
      hideSearchDropdown
    };
  }

  window.KimbleRteScreen = {
    create: createRteScreen
  };
})();
