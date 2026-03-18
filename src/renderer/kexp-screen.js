(function initKimbleKexpScreen() {
  function createKexpScreen(deps) {
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
    const formatDurationFromSeconds = deps.formatDurationFromSeconds;
    const setCachedChapters = deps.setCachedChapters;
    const shouldArmForceRetry = deps.shouldArmForceRetry;

    const KEXP_STREAM_URL = "https://kexp.streamguys1.com/kexp160.aac";
    const KEXP_ARCHIVE_DAYS = 14;

    let searchDebounceTimer = null;
    let extendedSearchDebounceTimer = null;
    let lastSearchRows = [];
    let lastDiscoveryRows = [];
    let selectedDiscoveryProgram = "";

    function normalizeProgramRows(payload) {
      if (Array.isArray(payload?.results)) {
        return payload.results;
      }
      return Array.isArray(payload) ? payload : [];
    }

    function normalizeTitle(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
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
        episode?.title,
        episode?.fullTitle,
        episode?.description,
        episode?.location,
        episode?.publishedTime,
        episode?.endTime,
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
        show?.timeSlot,
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
        : `<div class="item muted">Select a host to load it in Program Explorer. Discovery stays visible so you can keep browsing or hit Discover again for a new random set.</div>`;
      dom.discoveryResult.classList.remove("hidden");
      dom.discoveryResult.innerHTML = `${noteHtml}${list.map((show) => renderShowCard(show, { showScheduleBtn: true, selectedProgramUrl: selectedDiscoveryProgram })).join("")}`;
    }

    function mapExtendedEpisodeToPrimaryShape(episode) {
      const publishedTime = String(episode?.publishedTime || "").trim();
      return {
        ...episode,
        title: String(episode?.title || episode?.fullTitle || "KEXP Episode").trim(),
        fullTitle: String(episode?.fullTitle || episode?.title || "KEXP Episode").trim(),
        publishedTime,
        durationSeconds: Number(episode?.duration || 0) || 0,
        isExtendedArchive: true
      };
    }

    async function findExtendedProgramUrl(title) {
      if (!window.rteDownloader?.searchKexpExtendedPrograms) {
        return "";
      }
      const normalizedTarget = normalizeTitle(title);
      if (!normalizedTarget) {
        return "";
      }
      try {
        const results = await window.rteDownloader.searchKexpExtendedPrograms(title);
        const rows = normalizeProgramRows(results);
        const match = rows.find((show) => {
          const normalizedShowTitle = normalizeTitle(show?.title);
          return normalizedShowTitle === normalizedTarget
            || normalizedShowTitle.includes(normalizedTarget)
            || normalizedTarget.includes(normalizedShowTitle);
        });
        return String(match?.programUrl || "").trim();
      } catch {
        return "";
      }
    }

    function setStatus(text, isError = false) {
      if (!dom.result) {
        return;
      }
      dom.result.textContent = text || "";
      dom.result.className = `status ${isError ? "error" : "muted"}`;
    }

    function setEpisodeStatus(episodeUrl, text, isError = false, options = {}) {
      const extended = Boolean(options.extended);
      const resultRoot = extended ? dom.extEpisodesResult : dom.episodesResult;
      const attrName = extended ? "data-kexp-ext-episode-status" : "data-kexp-episode-status";
      const key = encodeURIComponent(String(episodeUrl || ""));
      const node = resultRoot?.querySelector(`[${attrName}="${key}"]`);
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

    function getBackfillCount() {
      const mode = dom.scheduleBackfillMode?.value || "new-only";
      if (mode !== "backfill") {
        return 0;
      }
      return Math.max(1, Math.min(100, Number(dom.scheduleBackfillCount?.value || 5)));
    }

    function formatEpisodeWindow(start, end) {
      if (!start) {
        return "Date unknown";
      }
      try {
        const startDate = new Date(start);
        if (!Number.isFinite(startDate.getTime())) {
          return start;
        }
        const dateOptions = { month: "short", day: "numeric", year: "numeric" };
        const timeOptions = { hour: "numeric", minute: "2-digit", hour12: state.timeFormat !== "24h" };
        const dateText = startDate.toLocaleDateString(undefined, dateOptions);
        const startText = startDate.toLocaleTimeString(undefined, timeOptions);
        if (end) {
          const endDate = new Date(end);
          if (Number.isFinite(endDate.getTime())) {
            const endText = endDate.toLocaleTimeString(undefined, timeOptions);
            return `${dateText} - ${startText} to ${endText}`;
          }
        }
        return `${dateText} - ${startText}`;
      } catch {
        return start;
      }
    }

    function archiveAvailable(publishedTime) {
      if (!publishedTime) {
        return false;
      }
      const publishedDate = new Date(publishedTime);
      if (!Number.isFinite(publishedDate.getTime())) {
        return false;
      }
      return (Date.now() - publishedDate.getTime()) < KEXP_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
    }

    function renderShowCard(show, options = {}) {
      const showScheduleBtn = Boolean(options.showScheduleBtn);
      const selectedProgramUrl = String(options.selectedProgramUrl || "").trim();
      const programUrl = String(show.programUrl || "").trim();
      const title = String(show.title || programUrl || "KEXP Show").trim();
      const description = String(show.description || "").trim();
      const cadence = String(show.cadence || "").trim();
      const location = String(show.location || "").trim();
      const hosts = normalizeMetadataList(show.hosts);
      const airtime = String(show.airtime || show.timeSlot || "").trim();
      const genres = Array.isArray(show.genres) ? show.genres : [];
      const image = String(show.image || "").trim();
      const genresHtml = genres.length
        ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      const cadenceHtml = cadence && cadence !== "irregular"
        ? `<div class="item-meta"><strong>${escapeHtml(cadence.charAt(0).toUpperCase() + cadence.slice(1))}</strong></div>`
        : "";
      const scheduleBtn = showScheduleBtn
        ? `<button class="secondary kexp-quick-schedule-btn" data-kexp-schedule-url="${escapeHtml(programUrl)}" style="margin-top:0.4rem;font-size:0.8em;">+ Scheduler</button>`
        : "";
      const selectedClass = selectedProgramUrl && selectedProgramUrl === programUrl ? " item-selected" : "";
      return `
        <div class="item clickable${selectedClass}" data-kexp-program-url="${escapeHtml(programUrl)}" data-kexp-program-title="${escapeHtml(title)}">
          <div class="search-card">
            <div>${image ? `<img src="${escapeHtml(image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
            <div>
              <div class="item-title">${escapeHtml(title)}</div>
              ${cadenceHtml}
              ${airtime ? `<div class="item-meta">Airs: ${escapeHtml(airtime)}</div>` : ""}
              ${hosts.length ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</div>` : ""}
              ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
              ${description ? `<div class="item-meta">${escapeHtml(description.slice(0, 200))}${description.length > 200 ? "..." : ""}</div>` : ""}
              ${genresHtml}
              ${scheduleBtn}
            </div>
          </div>
        </div>
      `;
    }

    function renderExtendedShowCard(show) {
      const programUrl = String(show.programUrl || "").trim();
      const title = String(show.title || programUrl || "KEXP Extended Show").trim();
      const description = String(show.description || "").trim();
      const cadence = String(show.cadence || "").trim();
      const location = String(show.location || "").trim();
      const genres = Array.isArray(show.genres) ? show.genres : [];
      const image = String(show.image || "").trim();
      const genresHtml = genres.length
        ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      const cadenceBadge = cadence && cadence !== "irregular"
        ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>`
        : "";
      return `
        <div class="item clickable" data-kexp-ext-program-url="${escapeHtml(programUrl)}">
          <div class="search-card">
            <div>${image ? `<img src="${escapeHtml(image)}" alt="" class="episode-thumb" loading="lazy" />` : `<img alt="" class="episode-thumb" loading="lazy" />`}</div>
            <div>
              <div class="item-title">${escapeHtml(title)}${cadenceBadge}</div>
              ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
              ${description ? `<div class="item-meta">${escapeHtml(description.slice(0, 200))}${description.length > 200 ? "..." : ""}</div>` : ""}
              ${genresHtml}
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
      const programTitle = String(payload?.title || "KEXP").trim();
      dom.episodesResult.innerHTML = filteredRows.map((episode) => {
        const episodeUrl = String(episode.episodeUrl || "").trim();
        const statusKey = encodeURIComponent(episodeUrl);
        const published = String(episode.publishedTime || "").trim();
        const fullTitle = String(episode.fullTitle || episode.title || "").trim();
        const hosts = normalizeMetadataList(episode.hosts);
        const image = String(episode.image || "").trim();
        const genres = Array.isArray(episode.genres) ? episode.genres : [];
        const description = String(episode.description || "").trim();
        const location = String(episode.location || "").trim();
        const extended = Boolean(episode.isExtendedArchive);
        const genresHtml = genres.length
          ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
          : "";
        const timeWindow = extended
          ? formatEpisodeWindow(published, "")
          : formatEpisodeWindow(published, episode.endTime);
        const streamAvailable = extended || archiveAvailable(published);
        const itemClass = streamAvailable ? "item" : "item kexp-unavailable";
        const itemTitle = streamAvailable ? "" : ` title="Archive window has passed; audio may be unavailable"`;
        const archiveMeta = extended ? `<div class="item-meta muted">Extended archive episode</div>` : "";
        const dataExtendedAttr = extended ? ` data-kexp-extended="1"` : "";
        return `
          <div class="${itemClass}"${itemTitle}>
            ${image ? `<img src="${escapeHtml(image)}" alt="" class="episode-thumb" loading="lazy" />` : ""}
            <div class="item-title">${escapeHtml(fullTitle || "KEXP Episode")}</div>
            ${hosts.length ? `<div class="item-meta muted">DJ: ${escapeHtml(hosts.join(", "))}</div>` : ""}
            <div class="item-meta">${escapeHtml(timeWindow)}</div>
            ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
            ${description ? `<div class="item-meta muted">${escapeHtml(description.slice(0, 200))}${description.length > 200 ? "..." : ""}</div>` : ""}
            ${archiveMeta}
            ${genresHtml}
            <div class="item-actions">
              <button class="secondary" data-kexp-play-url="${escapeHtml(episodeUrl)}" data-kexp-play-title="${escapeHtml(fullTitle)}" data-kexp-play-program-title="${escapeHtml(programTitle)}" data-kexp-play-image="${escapeHtml(image)}" data-kexp-play-published="${escapeHtml(published)}"${dataExtendedAttr}>Play</button>
              <button class="secondary" data-kexp-play-local-url="${escapeHtml(episodeUrl)}" data-kexp-play-local-title="${escapeHtml(fullTitle)}" data-kexp-play-local-program-title="${escapeHtml(programTitle)}" data-kexp-play-local-image="${escapeHtml(image)}"${dataExtendedAttr}>Play Local</button>
              <button data-kexp-download-url="${escapeHtml(episodeUrl)}" data-kexp-episode-title="${escapeHtml(fullTitle)}" data-kexp-program-title="${escapeHtml(programTitle)}" data-kexp-published="${escapeHtml(published)}" data-kexp-image="${escapeHtml(image)}" data-kexp-description="${escapeHtml(description)}" data-kexp-location="${escapeHtml(location)}" data-kexp-hosts="${escapeHtml(JSON.stringify(hosts))}" data-kexp-genres="${escapeHtml(JSON.stringify(genres))}"${dataExtendedAttr}>Download</button>
              ${extended ? "" : `<button class="secondary" data-kexp-generate-cue-url="${escapeHtml(episodeUrl)}" data-kexp-generate-cue-title="${escapeHtml(fullTitle)}" data-kexp-generate-cue-program-title="${escapeHtml(programTitle)}">Generate CUE</button>`}
            </div>
            <div class="item-meta episode-status" data-kexp-episode-status="${statusKey}" style="display:none;"></div>
            <div class="cue-debug-log" data-kexp-episode-cue-debug="${statusKey}" style="display:none;"></div>
            <div class="episode-inline-playlist" data-kexp-episode-playlist="${statusKey}">
              <div class="playlist-note">Loading tracklist...</div>
            </div>
          </div>
        `;
      }).join("");
      autoLoadPlaylists(filteredRows).catch(() => {});
    }

    function renderExtendedEpisodes(payload, programTitle) {
      if (!dom.extEpisodesResult) {
        return;
      }
      const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];
      if (!rows.length) {
        dom.extEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
        return;
      }
      const resolvedProgramTitle = String(programTitle || payload?.title || "KEXP Extended").trim();
      dom.extEpisodesResult.innerHTML = rows.map((episode) => {
        const episodeUrl = String(episode.episodeUrl || "").trim();
        const statusKey = encodeURIComponent(episodeUrl);
        const published = String(episode.publishedTime || "").trim();
        const fullTitle = String(episode.fullTitle || episode.title || "").trim();
        const hosts = normalizeMetadataList(episode.hosts);
        const image = String(episode.image || "").trim();
        const genres = Array.isArray(episode.genres) ? episode.genres : [];
        const description = String(episode.description || "").trim();
        const location = String(episode.location || "").trim();
        const durationSeconds = Number(episode.duration || 0);
        const durationLabel = durationSeconds > 0 ? formatDurationFromSeconds(durationSeconds) : "";
        const publishedLabel = published
          ? new Date(published).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })
          : "";
        return `
          <div class="item">
            ${image ? `<img src="${escapeHtml(image)}" alt="" class="episode-thumb" loading="lazy" />` : ""}
            <div class="item-title">${escapeHtml(fullTitle || resolvedProgramTitle)}</div>
            ${hosts.length ? `<div class="item-meta muted">DJ: ${escapeHtml(hosts.join(", "))}</div>` : ""}
            ${publishedLabel ? `<div class="item-meta">${escapeHtml(publishedLabel)}${durationLabel ? ` - ${escapeHtml(durationLabel)}` : ""}</div>` : ""}
            ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
            ${description ? `<div class="item-meta muted">${escapeHtml(description.slice(0, 200))}${description.length > 200 ? "..." : ""}</div>` : ""}
            <div class="item-actions">
              <button class="secondary" data-kexp-ext-play-url="${escapeHtml(episodeUrl)}" data-kexp-ext-play-title="${escapeHtml(fullTitle)}" data-kexp-ext-play-program-title="${escapeHtml(resolvedProgramTitle)}" data-kexp-ext-play-image="${escapeHtml(image)}">Play</button>
              <button class="secondary" data-kexp-ext-play-local-url="${escapeHtml(episodeUrl)}" data-kexp-ext-play-local-title="${escapeHtml(fullTitle)}" data-kexp-ext-play-local-program-title="${escapeHtml(resolvedProgramTitle)}" data-kexp-ext-play-local-image="${escapeHtml(image)}">Play Local</button>
              <button data-kexp-ext-download-url="${escapeHtml(episodeUrl)}" data-kexp-ext-episode-title="${escapeHtml(fullTitle)}" data-kexp-ext-program-title="${escapeHtml(resolvedProgramTitle)}" data-kexp-ext-published="${escapeHtml(published)}" data-kexp-ext-image="${escapeHtml(image)}" data-kexp-ext-description="${escapeHtml(description)}" data-kexp-ext-location="${escapeHtml(location)}" data-kexp-ext-hosts="${escapeHtml(JSON.stringify(hosts))}" data-kexp-ext-genres="${escapeHtml(JSON.stringify(genres))}">Download</button>
              <button class="secondary" data-kexp-ext-generate-cue-url="${escapeHtml(episodeUrl)}">Generate CUE</button>
            </div>
            <div class="item-meta episode-status" data-kexp-ext-episode-status="${statusKey}" style="display:none;"></div>
            <div class="cue-debug-log" data-kexp-ext-episode-cue-debug="${statusKey}" style="display:none;"></div>
            <div class="episode-inline-playlist" data-kexp-ext-episode-playlist="${statusKey}">
              <div class="playlist-note">Loading tracklist...</div>
            </div>
          </div>
        `;
      }).join("");
      autoLoadExtendedPlaylists(rows).catch(() => {});
    }

    async function autoLoadPlaylists(episodes) {
      if (!window.rteDownloader?.getKexpEpisodeTracklist) {
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
          const node = dom.episodesResult?.querySelector(`[data-kexp-episode-playlist="${statusKey}"]`);
          if (!node) {
            continue;
          }
          try {
            const data = episode.isExtendedArchive
              ? await window.rteDownloader.getKexpExtendedEpisodeTracklist?.(episode.episodeUrl)
              : await window.rteDownloader.getKexpEpisodeTracklist(episode.episodeUrl);
            const tracks = Array.isArray(data) ? data : (data?.tracks || []);
            state.kexpTracksByEpisode[String(episode.episodeUrl || "")] = tracks;
            node.innerHTML = tracks.length
              ? renderPlaylistTracks(tracks)
              : `<div class="playlist-note">${episode.isExtendedArchive ? "No tracks logged for this archive show." : "No tracks logged for this show."}</div>`;
          } catch {
            node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
    }

    async function autoLoadExtendedPlaylists(episodes) {
      if (!window.rteDownloader?.getKexpExtendedEpisodeTracklist) {
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
          const node = dom.extEpisodesResult?.querySelector(`[data-kexp-ext-episode-playlist="${statusKey}"]`);
          if (!node) {
            continue;
          }
          try {
            const data = await window.rteDownloader.getKexpExtendedEpisodeTracklist(episode.episodeUrl);
            const tracks = Array.isArray(data) ? data : (data?.tracks || []);
            node.innerHTML = tracks.length
              ? renderPlaylistTracks(tracks)
              : `<div class="playlist-note">No tracks logged for this mix.</div>`;
          } catch {
            node.innerHTML = `<div class="playlist-note">Tracklist unavailable.</div>`;
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
    }

    async function refreshLiveNow() {
      if (!dom.liveNow) {
        return;
      }
      const isPlaying = dom.liveAudio && !dom.liveAudio.paused;
      if (dom.liveAudioWrap && !isPlaying) {
        dom.liveAudioWrap.classList.add("nts-live-audio-hidden");
        dom.liveAudioWrap.classList.remove("nts-live-audio-at-bottom");
      }
      if (!window.rteDownloader?.getKexpNowPlaying) {
        if (dom.liveInfo) {
          dom.liveInfo.innerHTML = `<div class="nts-live-header status muted"><strong>KEXP 90.3 FM</strong> - Live</div>`;
        }
        dom.liveNow.innerHTML = `<div class="nts-live-hero nts-live-hero-placeholder"><button type="button" class="nts-live-play-overlay live-overlay-btn${isPlaying ? " hidden" : ""}" aria-label="Play Live">Play Live</button></div>`;
        return;
      }
      try {
        const info = await window.rteDownloader.getKexpNowPlaying();
        const play = info?.play;
        const show = info?.show;
        const coverUrl = String(play?.image || show?.image || "").trim();
        const infoLines = [];
        infoLines.push(`<div class="nts-live-header status"><strong>KEXP 90.3 FM</strong>`);
        if (play?.artist || play?.title) {
          const trackLine = [play.artist, play.title].filter(Boolean).join(" - ");
          infoLines.push(`<br><span class="muted" style="font-size:0.85em">${escapeHtml(trackLine)}</span>`);
        }
        if (play?.album) {
          infoLines.push(`<br><span class="muted" style="font-size:0.82em">Album: ${escapeHtml(play.album)}</span>`);
        }
        if (show?.hosts) {
          infoLines.push(`<br><span class="muted" style="font-size:0.82em">DJ: ${escapeHtml(show.hosts)}</span>`);
        }
        if (show?.programTitle) {
          infoLines.push(`<br><span class="muted" style="font-size:0.82em">${escapeHtml(show.programTitle)}</span>`);
        }
        if (play?.comment) {
          infoLines.push(`<br><span class="muted" style="font-size:0.8em;font-style:italic;">"${escapeHtml(play.comment)}"</span>`);
        }
        infoLines.push("</div>");
        if (dom.liveInfo) {
          dom.liveInfo.innerHTML = infoLines.join("");
        }
        const playBtnClass = isPlaying ? "nts-live-play-overlay live-overlay-btn hidden" : "nts-live-play-overlay live-overlay-btn";
        if (coverUrl) {
          dom.liveNow.innerHTML = `<div class="nts-live-hero"><img src="${escapeHtml(coverUrl)}" alt="" class="nts-live-hero-img" loading="lazy" /><button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button></div>`;
        } else {
          dom.liveNow.innerHTML = `<div class="nts-live-hero nts-live-hero-placeholder"><button type="button" class="${playBtnClass}" aria-label="Play Live">Play Live</button><a href="https://www.kexp.org/listen" target="_blank" rel="noopener noreferrer" class="nts-live-fallback-link">kexp.org/listen</a></div>`;
        }
      } catch {
        if (dom.liveInfo) {
          dom.liveInfo.innerHTML = `<div class="nts-live-header status muted"><strong>KEXP 90.3 FM</strong> - Live</div>`;
        }
        dom.liveNow.innerHTML = `<div class="nts-live-hero nts-live-hero-placeholder"><button type="button" class="nts-live-play-overlay live-overlay-btn${isPlaying ? " hidden" : ""}" aria-label="Play Live">Play Live</button></div>`;
      }
    }

    async function loadProgram(programUrl, page = 1) {
      if (!window.rteDownloader?.getKexpProgramEpisodes) {
        return;
      }
      const requestedPage = Math.max(1, Number(page) || 1);
      const perPage = getEpisodesPerPage();
      const serverPage = Math.max(1, Math.ceil((((requestedPage) - 1) * perPage + 1) / 20));
      const [payload, summary] = await Promise.all([
        window.rteDownloader.getKexpProgramEpisodes(programUrl, serverPage),
        window.rteDownloader.getKexpProgramSummary?.(programUrl).catch(() => null)
      ]);
      const totalItems = Number(payload?.total || 0);
      const totalPages = totalItems
        ? Math.max(1, Math.ceil(totalItems / perPage))
        : (payload?.hasMore ? requestedPage + 1 : 1);
      const recentTargetPage = Math.max(1, Math.min(totalPages, requestedPage));
      const clientOffset = ((recentTargetPage - 1) * perPage) % 20;
      const recentEpisodes = Array.isArray(payload?.episodes)
        ? payload.episodes.slice(clientOffset, clientOffset + perPage)
        : [];
      const title = summary?.title || "KEXP Program";
      const description = String(summary?.description || "").trim();
      const image = String(summary?.image || "").trim();
      const genres = Array.isArray(summary?.genres) ? summary.genres : [];
      const hosts = normalizeMetadataList(summary?.hosts);
      const cadence = String(summary?.cadence || "").trim();
      const location = String(summary?.location || "").trim();
      let mergedEpisodes = requestedPage <= totalPages ? recentEpisodes : [];
      let extendedTotalItems = 0;
      let extendedProgramUrl = "";

      if (window.rteDownloader?.getKexpExtendedProgramEpisodes && window.rteDownloader?.searchKexpExtendedPrograms) {
        extendedProgramUrl = await findExtendedProgramUrl(title);
        if (extendedProgramUrl) {
          const needsExtendedRows = requestedPage > totalPages || (requestedPage === totalPages && recentEpisodes.length < perPage);
          const overflowOffset = Math.max(0, ((requestedPage - 1) * perPage) - totalItems);
          const extPage = needsExtendedRows ? Math.floor(overflowOffset / perPage) + 1 : 1;
          try {
            const extPayload = await window.rteDownloader.getKexpExtendedProgramEpisodes(extendedProgramUrl, extPage);
            const extRows = normalizeProgramRows(extPayload?.episodes).map((episode) => mapExtendedEpisodeToPrimaryShape(episode));
            extendedTotalItems = Number(extPayload?.total || extRows.length);
            if (needsExtendedRows) {
              const extOffset = requestedPage > totalPages ? (overflowOffset % perPage) : 0;
              const extLimit = Math.max(0, perPage - recentEpisodes.length);
              const extSlice = extRows.slice(extOffset, extOffset + (requestedPage > totalPages ? perPage : extLimit));
              mergedEpisodes = requestedPage > totalPages ? extSlice : recentEpisodes.concat(extSlice);
            }
          } catch {}
        }
      }

      const combinedTotalItems = totalItems + extendedTotalItems;
      const combinedTotalPages = combinedTotalItems
        ? Math.max(1, Math.ceil(combinedTotalItems / perPage))
        : totalPages;
      const targetPage = Math.max(1, Math.min(combinedTotalPages, requestedPage));

      state.kexpProgramUrl = programUrl;
      state.kexpProgramPage = targetPage;
      state.kexpProgramMaxPages = combinedTotalPages;
      state.kexpEpisodesPayload = {
        ...payload,
        title,
        episodes: mergedEpisodes,
        total: combinedTotalItems,
        extendedProgramUrl
      };
      if (dom.programUrlInput) {
        dom.programUrlInput.value = programUrl;
      }
      const genresHtml = genres.length
        ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      const cadenceBadge = cadence && cadence !== "irregular"
        ? ` <span class="genre-pill">${escapeHtml(cadence)}</span>`
        : "";
      if (dom.programMeta) {
        dom.programMeta.innerHTML = `
          ${image ? `<img src="${escapeHtml(image)}" alt="" class="episode-thumb" style="max-width:160px;margin-bottom:0.5rem;" loading="lazy" /><br>` : ""}
          <strong>${escapeHtml(title)}</strong>${cadenceBadge}<br>
          ${hosts.length ? `<span class="muted">Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}</span><br>` : ""}
          ${location ? `<span class="muted">${escapeHtml(location)}</span><br>` : ""}
          ${description ? `<span class="muted">${escapeHtml(description.slice(0, 300))}${description.length > 300 ? "..." : ""}</span><br>` : ""}
          ${genresHtml}
          Page ${state.kexpProgramPage} of ${state.kexpProgramMaxPages}${combinedTotalItems ? ` - ${combinedTotalItems} episodes` : ""}
          ${extendedProgramUrl ? `<br><span class="muted">Older archive episodes are folded into this explorer automatically.</span>` : ""}
        `;
      }
      renderEpisodes({
        ...payload,
        title,
        episodes: mergedEpisodes
      });
      focusProgramExplorer(page);
    }

    async function loadExtendedProgram(programUrl, page = 1) {
      if (!window.rteDownloader?.getKexpExtendedProgramEpisodes) {
        return;
      }
      const pageNumber = Math.max(1, Number(page) || 1);
      const perPage = getEpisodesPerPage();
      if (dom.extProgramMeta) {
        dom.extProgramMeta.style.display = "block";
        dom.extProgramMeta.textContent = "Loading...";
      }
      if (dom.extEpisodesResult) {
        dom.extEpisodesResult.innerHTML = "";
      }
      let summary = null;
      try {
        summary = await window.rteDownloader.getKexpExtendedProgramSummary(programUrl);
      } catch {}
      const payload = await window.rteDownloader.getKexpExtendedProgramEpisodes(programUrl, pageNumber);
      const totalItems = Number(payload?.total || 0);
      const totalPages = totalItems
        ? Math.max(1, Math.ceil(totalItems / perPage))
        : (payload?.hasMore ? pageNumber + 1 : pageNumber);
      const targetPage = Math.max(1, Math.min(totalPages, pageNumber));
      state.kexpExtProgramUrl = programUrl;
      state.kexpExtProgramPage = targetPage;
      state.kexpExtProgramMaxPages = totalPages;
      if (payload.episodes) {
        payload.episodes = payload.episodes.slice(0, perPage);
      }
      const title = summary?.title || "KEXP Extended";
      const description = String(summary?.description || "").trim();
      const image = String(summary?.image || "").trim();
      const genres = Array.isArray(summary?.genres) ? summary.genres : [];
      const genresHtml = genres.length
        ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      if (dom.extProgramMeta) {
        dom.extProgramMeta.style.display = "block";
        dom.extProgramMeta.innerHTML = `
          ${image ? `<img src="${escapeHtml(image)}" alt="" class="episode-thumb" style="max-width:120px;margin-bottom:0.4rem;" loading="lazy" /><br>` : ""}
          <strong>${escapeHtml(title)}</strong><br>
          ${description ? `<span class="muted">${escapeHtml(description.slice(0, 250))}${description.length > 250 ? "..." : ""}</span><br>` : ""}
          ${genresHtml}
          <span class="muted">Page ${targetPage} of ${totalPages}${totalItems ? ` - ${totalItems} episodes` : ""}</span>
        `;
      }
      if (dom.extPaginationRow) {
        dom.extPaginationRow.style.display = "flex";
      }
      renderExtendedEpisodes(payload, title);
    }

    async function refreshSchedules() {
      if (!dom.scheduleList || !window.rteDownloader?.listKexpSchedules) {
        return;
      }
      const schedules = await window.rteDownloader.listKexpSchedules();
      dom.scheduleList.innerHTML = schedules.length
        ? schedules.map((schedule) => renderSchedulerCard(schedule, "kexp")).join("")
        : `<div class="item">No KEXP schedules yet.</div>`;
    }

    async function runProgramSearch(query) {
      if (!window.rteDownloader?.searchKexpPrograms || !dom.programSearchResult) {
        return;
      }
      dom.programSearchResult.classList.remove("hidden");
      dom.programSearchResult.innerHTML = `<div class="item muted">Searching...</div>`;
      try {
        const results = await window.rteDownloader.searchKexpPrograms(query || "");
        lastSearchRows = normalizeProgramRows(results);
        const rows = filterProgramRows(lastSearchRows);
        dom.programSearchResult.innerHTML = rows.length
          ? rows.map((show) => renderShowCard(show)).join("")
          : `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No results found."}</div>`;
      } catch (error) {
        dom.programSearchResult.innerHTML = `<div class="item muted error">Search failed: ${escapeHtml(error.message)}</div>`;
      }
    }

    async function runDiscovery() {
      if (!window.rteDownloader?.getKexpDiscovery || !dom.discoveryResult || !dom.discoverBtn) {
        return;
      }
      setButtonBusy(dom.discoverBtn, true, "Discover Shows", "Loading...");
      dom.discoveryResult.innerHTML = `<div class="item muted">Fetching random shows...</div>`;
      try {
        const results = await window.rteDownloader.getKexpDiscovery(getDiscoveryCount());
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

    async function runExtendedSearch(query) {
      if (!window.rteDownloader?.searchKexpExtendedPrograms || !dom.extSearchResult) {
        return;
      }
      dom.extSearchResult.classList.remove("hidden");
      dom.extSearchResult.innerHTML = `<div class="item muted">Searching...</div>`;
      try {
        const results = await window.rteDownloader.searchKexpExtendedPrograms(query || "");
        const rows = Array.isArray(results?.results) ? results.results : Array.isArray(results) ? results : [];
        dom.extSearchResult.innerHTML = rows.length
          ? rows.map((show) => renderExtendedShowCard(show)).join("")
          : `<div class="item muted">No extended shows found.</div>`;
      } catch (error) {
        dom.extSearchResult.innerHTML = `<div class="item muted error">Search failed: ${escapeHtml(error.message)}</div>`;
      }
    }

    async function runExtendedDiscovery() {
      if (!window.rteDownloader?.getKexpExtendedDiscovery || !dom.extSearchResult || !dom.extDiscoverBtn) {
        return;
      }
      setButtonBusy(dom.extDiscoverBtn, true, "Discover Archive", "Loading...");
      dom.extSearchResult.classList.remove("hidden");
      dom.extSearchResult.innerHTML = `<div class="item muted">Fetching archived shows...</div>`;
      try {
        const results = await window.rteDownloader.getKexpExtendedDiscovery();
        const rows = Array.isArray(results?.results) ? results.results : Array.isArray(results) ? results : [];
        dom.extSearchResult.innerHTML = rows.length
          ? rows.map((show) => renderExtendedShowCard(show)).join("")
          : `<div class="item muted">No extended shows found.</div>`;
      } catch (error) {
        dom.extSearchResult.innerHTML = `<div class="item muted error">Discovery failed: ${escapeHtml(error.message)}</div>`;
      } finally {
        setButtonBusy(dom.extDiscoverBtn, false, "Discover Archive");
      }
    }

    async function handleQuickDownload() {
      const pageUrl = String(dom.urlInput?.value || "").trim();
      if (!pageUrl) {
        setStatus("Enter a KEXP show URL.", true);
        return;
      }
      const forceDownload = dom.downloadBtn?.dataset.forceNext === "1";
      if (forceDownload && dom.downloadBtn) {
        delete dom.downloadBtn.dataset.forceNext;
      }
      setButtonBusy(dom.downloadBtn, true, "Download");
      setStatus(forceDownload ? "Forcing re-download..." : "Resolving stream...");
      const progressToken = createProgressToken("kexp");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setStatus(formatProgressText(progress, "Downloading..."));
      });
      try {
        const data = await window.rteDownloader.downloadFromKexpUrl(pageUrl, progressToken, { forceDownload });
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

    async function handleEpisodeClick(event, options = {}) {
      const getIsExtended = (button) => Boolean(options.extended) || button?.getAttribute("data-kexp-extended") === "1";

      const playLocalBtn = event.target.closest("button[data-kexp-play-local-url], button[data-kexp-ext-play-local-url]");
      if (playLocalBtn) {
        const extended = getIsExtended(playLocalBtn);
        const stateStore = extended ? state.kexpExtDownloadedAudioByEpisode : state.kexpDownloadedAudioByEpisode;
        const prefix = extended && playLocalBtn.hasAttribute("data-kexp-ext-play-local-url") ? "data-kexp-ext" : "data-kexp";
        const episodeUrl = playLocalBtn.getAttribute(`${prefix}-play-local-url`) || "";
        const playTitle = playLocalBtn.getAttribute(`${prefix}-play-local-title`) || "";
        const playProgramTitle = playLocalBtn.getAttribute(`${prefix}-play-local-program-title`) || "";
        const playImage = playLocalBtn.getAttribute(`${prefix}-play-local-image`) || "";
        const saved = stateStore[episodeUrl];
        if (!saved?.outputDir || !saved?.fileName) {
          setEpisodeStatus(episodeUrl, "Download this episode first, then use Play Local.", true, { extended });
          return;
        }
        setButtonBusy(playLocalBtn, true, "Play Local", "Loading...");
        try {
          await playEpisodeWithBackgroundCue({
            sourceType: "kexp",
            cacheKey: episodeUrl,
            sourceLabel: extended ? "KEXP Extended Local" : "KEXP Local",
            title: playTitle || saved.fileName,
            programTitle: playProgramTitle || "",
            subtitle: "",
            image: playImage,
            episodeUrl,
            durationSeconds: 0,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            playbackKey: `${extended ? "kexp-ext" : "kexp"}:local:${episodeUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(episodeUrl, text, isError, { extended })
          });
        } catch (error) {
          setEpisodeStatus(episodeUrl, `Play Local failed: ${error.message}`, true, { extended });
        } finally {
          setButtonBusy(playLocalBtn, false, "Play Local");
        }
        return;
      }

      const playBtn = event.target.closest("button[data-kexp-play-url], button[data-kexp-ext-play-url]");
      if (playBtn) {
        const extended = getIsExtended(playBtn);
        const prefix = extended && playBtn.hasAttribute("data-kexp-ext-play-url") ? "data-kexp-ext" : "data-kexp";
        const playUrl = playBtn.getAttribute(`${prefix}-play-url`) || "";
        const playTitle = playBtn.getAttribute(`${prefix}-play-title`) || "";
        const playProgramTitle = playBtn.getAttribute(`${prefix}-play-program-title`) || "";
        const playImage = playBtn.getAttribute(`${prefix}-play-image`) || "";
        const published = playBtn.getAttribute(`${prefix}-play-published`) || "";
        setButtonBusy(playBtn, true, "Play", "Loading...");
        try {
          const stream = extended
            ? await window.rteDownloader.getKexpExtendedEpisodeStream(playUrl)
            : await window.rteDownloader.getKexpEpisodeStream(playUrl, published || undefined);
          await playEpisodeWithBackgroundCue({
            sourceType: "kexp",
            cacheKey: playUrl,
            sourceLabel: extended ? "KEXP Extended" : "KEXP",
            title: playTitle || stream?.title || "Episode",
            programTitle: playProgramTitle || stream?.programTitle || "",
            subtitle: "",
            image: playImage || stream?.image || "",
            episodeUrl: playUrl,
            durationSeconds: Number(stream?.duration || 0) || 0,
            streamUrl: stream?.streamUrl || "",
            playbackKey: `${extended ? "kexp-ext" : "kexp"}:remote:${playUrl}`,
            statusUpdater: (text, isError = false) => setEpisodeStatus(playUrl, text, isError, { extended })
          });
        } catch (error) {
          setEpisodeStatus(playUrl, `Play failed: ${error.message}`, true, { extended });
        } finally {
          setButtonBusy(playBtn, false, "Play");
        }
        return;
      }

      const cueBtn = event.target.closest("button[data-kexp-generate-cue-url], button[data-kexp-ext-generate-cue-url]");
      if (cueBtn) {
        const extended = getIsExtended(cueBtn);
        const prefix = extended && cueBtn.hasAttribute("data-kexp-ext-generate-cue-url") ? "data-kexp-ext" : "data-kexp";
        const stateStore = extended ? state.kexpExtDownloadedAudioByEpisode : state.kexpDownloadedAudioByEpisode;
        const episodeUrl = cueBtn.getAttribute(`${prefix}-generate-cue-url`) || "";
        if (extended) {
          setEpisodeStatus(episodeUrl, "Generate CUE is not supported for the extended archive yet.", true, { extended: true });
          return;
        }
        const title = cueBtn.getAttribute(`${prefix}-generate-cue-title`) || "kexp-episode";
        const programTitle = cueBtn.getAttribute(`${prefix}-generate-cue-program-title`) || "KEXP";
        const saved = stateStore[episodeUrl];
        if (!saved) {
          setEpisodeStatus(episodeUrl, "Download episode first, then generate CUE.", true, { extended: false });
          return;
        }
        setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
        setEpisodeStatus(episodeUrl, "Generating CUE/chapters...", false, { extended: false });
        clearCueDebugLog("kexp", episodeUrl);
        const cueProgressToken = createProgressToken(`kexp-cue-${Date.now()}`);
        const detachCueProgress = attachDownloadProgress(cueProgressToken, (progress) => {
          if (progress?.kind === "cue" && progress?.message) {
            appendCueDebugLog("kexp", episodeUrl, progress.message);
          }
          setEpisodeStatus(episodeUrl, formatProgressText(progress, "Generating CUE/chapters..."), false, { extended: false });
        });
        try {
          const cue = await window.rteDownloader.generateCue({
            sourceType: "kexp",
            episodeUrl,
            title,
            programTitle,
            outputDir: saved.outputDir,
            fileName: saved.fileName,
            progressToken: cueProgressToken
          });
          setCachedChapters("kexp", episodeUrl, cue.chapters || []);
          setEpisodeStatus(episodeUrl, `CUE ready: ${cue.cuePath}${formatCueSource(cue)}${formatCueAlignment(cue)}`, false, { extended: false });
        } catch (error) {
          setEpisodeStatus(episodeUrl, `CUE failed: ${error.message}`, true, { extended: false });
        } finally {
          detachCueProgress();
          setButtonBusy(cueBtn, false, "Generate CUE");
        }
        return;
      }

      const downloadBtn = event.target.closest("button[data-kexp-download-url], button[data-kexp-ext-download-url]");
      if (!downloadBtn) {
        return;
      }
      const extended = getIsExtended(downloadBtn);
      const stateStore = extended ? state.kexpExtDownloadedAudioByEpisode : state.kexpDownloadedAudioByEpisode;
      const prefix = extended && downloadBtn.hasAttribute("data-kexp-ext-download-url") ? "data-kexp-ext" : "data-kexp";
      const episodeUrl = downloadBtn.getAttribute(`${prefix}-download-url`) || "";
      const title = downloadBtn.getAttribute(`${prefix}-episode-title`) || "kexp-episode";
      const programTitle = downloadBtn.getAttribute(`${prefix}-program-title`) || (extended ? "KEXP Extended" : "KEXP");
      const publishedTime = downloadBtn.getAttribute(`${prefix}-published`) || "";
      const image = downloadBtn.getAttribute(`${prefix}-image`) || "";
      const description = downloadBtn.getAttribute(`${prefix}-description`) || "";
      const location = downloadBtn.getAttribute(`${prefix}-location`) || "";
      const hosts = parseMetadataAttr(downloadBtn.getAttribute(`${prefix}-hosts`));
      const genres = parseMetadataAttr(downloadBtn.getAttribute(`${prefix}-genres`));
      setEpisodeStatus(episodeUrl, "Starting download...", false, { extended });
      setButtonBusy(downloadBtn, true, "Download", "Downloading...");
      const progressToken = createProgressToken(extended ? "kexp-ext-episode" : "kexp-episode");
      const detachProgress = attachDownloadProgress(progressToken, (progress) => {
        setEpisodeStatus(episodeUrl, formatProgressText(progress, "Downloading..."), false, { extended });
      });
      try {
        const data = extended
          ? await window.rteDownloader.downloadFromKexpExtendedUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image, description, location, hosts, genres })
          : await window.rteDownloader.downloadFromKexpUrl(episodeUrl, progressToken, { title, programTitle, publishedTime, image, description, location, hosts, genres });
        stateStore[episodeUrl] = { outputDir: data.outputDir, fileName: data.fileName, episodeUrl, title, programTitle };
        if (!extended && Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
          setCachedChapters("kexp", episodeUrl, data.cue.chapters);
        }
        const cueText = data?.cue?.cuePath ? ` + CUE ready${formatCueSource(data.cue)}${formatCueAlignment(data.cue)}` : "";
        setEpisodeStatus(episodeUrl, `Downloaded: ${data.fileName}${cueText}`, false, { extended });
      } catch (error) {
        setEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true, { extended });
      } finally {
        detachProgress();
        setButtonBusy(downloadBtn, false, "Download");
      }
    }

    async function handleScheduleClick(event) {
      const playLatestBtn = event.target.closest("button[data-kexp-schedule-play-output]");
      if (playLatestBtn) {
        try {
          await playFromDownloadedFile({
            outputDir: playLatestBtn.getAttribute("data-kexp-schedule-play-output"),
            fileName: playLatestBtn.getAttribute("data-kexp-schedule-play-file"),
            title: playLatestBtn.getAttribute("data-kexp-schedule-play-title") || "",
            source: "KEXP Local",
            subtitle: "Latest scheduled download",
            image: playLatestBtn.getAttribute("data-kexp-schedule-play-image") || "",
            episodeUrl: playLatestBtn.getAttribute("data-kexp-schedule-play-episode-url") || "",
            sourceType: playLatestBtn.getAttribute("data-kexp-schedule-play-source-type") || "kexp"
          });
        } catch (error) {
          setStatus(`Play failed: ${error.message}`, true);
        }
        return;
      }

      const toggleBtn = event.target.closest("button[data-kexp-schedule-toggle]");
      if (toggleBtn) {
        const scheduleId = toggleBtn.getAttribute("data-kexp-schedule-toggle");
        const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
        await window.rteDownloader.setKexpScheduleEnabled(scheduleId, enabled);
        await refreshSchedules();
        return;
      }

      const runBtn = event.target.closest("button[data-kexp-schedule-run]");
      if (runBtn) {
        const scheduleId = runBtn.getAttribute("data-kexp-schedule-run");
        const statusNode = dom.scheduleList?.querySelector(`[data-kexp-schedule-status="${scheduleId}"]`);
        if (statusNode) {
          statusNode.style.display = "block";
          statusNode.textContent = "Running...";
        }
        try {
          await window.rteDownloader.runKexpScheduleNow(scheduleId);
          await refreshSchedules();
        } catch (error) {
          if (statusNode) {
            statusNode.textContent = `Error: ${error.message}`;
          }
        }
        return;
      }

      const removeBtn = event.target.closest("button[data-kexp-schedule-remove]");
      if (removeBtn) {
        const scheduleId = removeBtn.getAttribute("data-kexp-schedule-remove");
        await window.rteDownloader.removeKexpSchedule(scheduleId);
        await refreshSchedules();
      }
    }

    function bindProgramCardClicks(listElement, options = {}) {
      const extended = Boolean(options.extended);
      const hideOnPick = Boolean(options.hideOnPick);
      const preserveDiscoveryList = Boolean(options.preserveDiscoveryList);
      listElement?.addEventListener("click", (event) => {
        if (!extended) {
          const scheduleBtn = event.target.closest(".kexp-quick-schedule-btn");
          if (scheduleBtn) {
            event.stopPropagation();
            const url = scheduleBtn.getAttribute("data-kexp-schedule-url") || "";
            if (!url || !window.rteDownloader?.addKexpSchedule) {
              return;
            }
            scheduleBtn.textContent = "Adding...";
            scheduleBtn.disabled = true;
            window.rteDownloader.addKexpSchedule(url, { backfillCount: getBackfillCount() })
              .then(() => {
                scheduleBtn.textContent = "Scheduled";
                return refreshSchedules();
              })
              .catch(() => {
                scheduleBtn.textContent = "Error";
                scheduleBtn.disabled = false;
              });
            return;
          }
        }

        const item = event.target.closest(extended ? "[data-kexp-ext-program-url]" : "[data-kexp-program-url]");
        if (!item) {
          return;
        }
        const url = item.getAttribute(extended ? "data-kexp-ext-program-url" : "data-kexp-program-url") || "";
        if (!url) {
          return;
        }
        const title = item.getAttribute(extended ? "data-kexp-ext-program-title" : "data-kexp-program-title") || url;
        if (preserveDiscoveryList) {
          selectedDiscoveryProgram = url;
          renderDiscoveryResults(lastDiscoveryRows, `Loaded ${title}. Discovery stays visible so you can keep browsing or hit Discover again for a new random set.`);
        }
        if (hideOnPick) {
          listElement.classList.add("hidden");
        }
        if (extended) {
          setButtonBusy(dom.extSearchBtn, true, "Search");
          loadExtendedProgram(url, 1)
            .catch((error) => {
              if (dom.extProgramMeta) {
                dom.extProgramMeta.textContent = error.message;
              }
            })
            .finally(() => setButtonBusy(dom.extSearchBtn, false, "Search"));
          return;
        }
        if (dom.programUrlInput) {
          dom.programUrlInput.value = url;
        }
        setButtonBusy(dom.loadProgramBtn, true, "Load Shows");
        loadProgram(url, 1)
          .catch((error) => {
            if (dom.programMeta) {
              dom.programMeta.textContent = error.message;
            }
          })
          .finally(() => setButtonBusy(dom.loadProgramBtn, false, "Load Shows"));
      });
    }

    function bindEvents() {
      dom.liveNow?.addEventListener("click", (event) => {
        const playBtn = event.target.closest(".nts-live-play-overlay");
        if (!playBtn || !dom.liveAudio) {
          return;
        }
        dom.liveAudio.src = KEXP_STREAM_URL;
        dom.liveAudio.play().catch(() => {});
        playBtn.classList.add("hidden");
        if (dom.liveAudioWrap) {
          dom.liveAudioWrap.classList.remove("nts-live-audio-hidden");
          dom.liveAudioWrap.classList.add("nts-live-audio-at-bottom");
        }
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
        runProgramSearch(dom.programSearchInput?.value.trim() || "").catch(() => {});
      });
      dom.programSearchInput?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        dom.programSearchBtn?.click();
      });
      dom.programSearchInput?.addEventListener("input", () => {
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
        }
        searchDebounceTimer = setTimeout(() => {
          dom.programSearchBtn?.click();
        }, 400);
      });

      dom.programResultFilterInput?.addEventListener("input", () => {
        if (dom.programSearchResult && !dom.programSearchResult.classList.contains("hidden")) {
          const rows = filterProgramRows(lastSearchRows);
          dom.programSearchResult.innerHTML = rows.length
            ? rows.map((show) => renderShowCard(show)).join("")
            : `<div class="item muted">${getProgramResultFilterQuery() ? "No visible matches for the current filter." : "No results found."}</div>`;
        }
        renderDiscoveryResults(lastDiscoveryRows, selectedDiscoveryProgram ? "Discovery stays visible so you can keep browsing or hit Discover again for a new random set." : "");
      });

      dom.loadProgramBtn?.addEventListener("click", () => {
        const url = String(dom.programUrlInput?.value || "").trim();
        if (!url) {
          return;
        }
        setButtonBusy(dom.loadProgramBtn, true, "Load Shows");
        loadProgram(url, 1)
          .catch((error) => {
            if (dom.programMeta) {
              dom.programMeta.textContent = error.message;
            }
          })
          .finally(() => setButtonBusy(dom.loadProgramBtn, false, "Load Shows"));
      });

      dom.prevPageBtn?.addEventListener("click", () => {
        if (state.kexpProgramPage <= 1 || !state.kexpProgramUrl) {
          return;
        }
        loadProgram(state.kexpProgramUrl, state.kexpProgramPage - 1).catch(() => {});
      });
      dom.nextPageBtn?.addEventListener("click", () => {
        if (state.kexpProgramPage >= state.kexpProgramMaxPages || !state.kexpProgramUrl) {
          return;
        }
        loadProgram(state.kexpProgramUrl, state.kexpProgramPage + 1).catch(() => {});
      });

      dom.episodeFilterInput?.addEventListener("input", () => {
        renderEpisodes(state.kexpEpisodesPayload || { episodes: [] });
      });

      dom.scheduleBackfillMode?.addEventListener("change", () => {
        if (dom.scheduleBackfillCount) {
          dom.scheduleBackfillCount.disabled = dom.scheduleBackfillMode.value !== "backfill";
        }
      });
      if (dom.scheduleBackfillCount && dom.scheduleBackfillMode) {
        dom.scheduleBackfillCount.disabled = dom.scheduleBackfillMode.value !== "backfill";
      }

      dom.addScheduleBtn?.addEventListener("click", async () => {
        const programUrl = String(dom.programUrlInput?.value || "").trim() || state.kexpProgramUrl;
        if (!programUrl || !window.rteDownloader?.addKexpSchedule) {
          return;
        }
        setButtonBusy(dom.addScheduleBtn, true, "Add Scheduler", "Adding...");
        try {
          await window.rteDownloader.addKexpSchedule(programUrl, { backfillCount: getBackfillCount() });
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

      dom.extSearchBtn?.addEventListener("click", () => {
        runExtendedSearch(dom.extSearchInput?.value.trim() || "").catch(() => {});
      });
      dom.extSearchInput?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        dom.extSearchBtn?.click();
      });
      dom.extSearchInput?.addEventListener("input", () => {
        if (extendedSearchDebounceTimer) {
          clearTimeout(extendedSearchDebounceTimer);
        }
        extendedSearchDebounceTimer = setTimeout(() => {
          dom.extSearchBtn?.click();
        }, 400);
      });
      dom.extDiscoverBtn?.addEventListener("click", () => {
        runExtendedDiscovery().catch(() => {});
      });
      dom.extPrevPageBtn?.addEventListener("click", () => {
        if (state.kexpExtProgramPage <= 1 || !state.kexpExtProgramUrl) {
          return;
        }
        loadExtendedProgram(state.kexpExtProgramUrl, state.kexpExtProgramPage - 1).catch(() => {});
      });
      dom.extNextPageBtn?.addEventListener("click", () => {
        if (state.kexpExtProgramPage >= state.kexpExtProgramMaxPages || !state.kexpExtProgramUrl) {
          return;
        }
        loadExtendedProgram(state.kexpExtProgramUrl, state.kexpExtProgramPage + 1).catch(() => {});
      });

      bindProgramCardClicks(dom.programSearchResult, { hideOnPick: true });
      bindProgramCardClicks(dom.discoveryResult, { preserveDiscoveryList: true });
      bindProgramCardClicks(dom.extSearchResult, { extended: true });

      dom.episodesResult?.addEventListener("click", (event) => {
        handleEpisodeClick(event).catch(() => {});
      });
      dom.extEpisodesResult?.addEventListener("click", (event) => {
        handleEpisodeClick(event, { extended: true }).catch(() => {});
      });
      dom.scheduleList?.addEventListener("click", (event) => {
        handleScheduleClick(event).catch(() => {});
      });
    }

    bindEvents();

    return {
      refreshLiveNow,
      setEpisodeStatus,
      loadProgram,
      loadExtendedProgram,
      refreshSchedules,
      runProgramSearch,
      runDiscovery,
      runExtendedSearch,
      runExtendedDiscovery
    };
  }

  window.KimbleKexpScreen = {
    create: createKexpScreen
  };
})();
