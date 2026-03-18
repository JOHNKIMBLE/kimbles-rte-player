(function initKimbleLibraryScreen() {
  function createLibraryScreen(deps) {
    const state = deps.state;
    const dom = deps.dom || {};
    const escapeHtml = deps.escapeHtml;
    const formatLocalDateTime = deps.formatLocalDateTime;
    const createProgressToken = deps.createProgressToken;
    const setSettingsStatus = deps.setSettingsStatus;
    const playFromDownloadedFile = deps.playFromDownloadedFile;
    const sourceLabels = deps.sourceLabels || {};
    const openProgramExplorer = deps.openProgramExplorer;
    const activateLibraryView = deps.activateLibraryView;

    let historyAllEntries = [];
    let historyLoadPromise = null;
    let historySearchTimer = null;
    let historyVisibleCount = 50;
    let queueSearchTimer = null;
    let queueRecentVisibleCount = 10;
    let latestQueueSnapshot = null;
    let feedSearchTimer = null;
    let metadataSearchTimer = null;
    let metadataSearchState = { total: 0, results: [], metrics: { total: 0, sourceCount: 0, hostCount: 0, genreCount: 0 } };
    let metadataDiscoveryState = { totalCandidates: 0, results: [], facets: { hosts: [], genres: [], locations: [] } };
    let entityGraphSearchTimer = null;
    let entityGraphState = { total: 0, results: [], metrics: { entityCount: 0, relationCount: 0, sourceCount: 0 } };
    let entityProfileState = { entity: null, metrics: { entityCount: 0, relationCount: 0, sourceCount: 0 } };
    let collectionsState = [];
    let collectionRecommendationsState = { totalCandidates: 0, results: [], terms: [], facets: { hosts: [], genres: [], locations: [] } };
    let heavyLibraryViewsLoaded = false;
    let heavyLibraryViewsLoadingPromise = null;
    let heavyLibraryViewsTimer = null;

    function getSourceLabel(sourceKey) {
      const key = String(sourceKey || "").trim().toLowerCase();
      return sourceLabels[key] || key.toUpperCase() || "MEDIA";
    }

    function normalizeStatus(status, fallback = "unknown") {
      return String(status || fallback).trim().toLowerCase() || fallback;
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

    function buildMetadataSearchText(entry) {
      return [
        entry?.label,
        entry?.episodeTitle,
        entry?.programTitle,
        entry?.fileName,
        entry?.message,
        entry?.status,
        entry?.description,
        entry?.location,
        ...normalizeMetadataList(entry?.hosts),
        ...normalizeMetadataList(entry?.genres)
      ].join(" ").toLowerCase();
    }

    function buildFeedSearchText(feed) {
      return [
        feed?.title,
        feed?.slug,
        feed?.description,
        feed?.sourceType,
        feed?.location,
        feed?.runSchedule,
        feed?.nextBroadcastTitle,
        feed?.latestEpisodeTitle,
        feed?.latestEpisodeDescription,
        feed?.latestEpisodeLocation,
        ...normalizeMetadataList(feed?.hosts),
        ...normalizeMetadataList(feed?.genres),
        ...normalizeMetadataList(feed?.latestEpisodeHosts),
        ...normalizeMetadataList(feed?.latestEpisodeGenres)
      ].join(" ").toLowerCase();
    }

    function encodeDataPayload(payload) {
      return escapeHtml(encodeURIComponent(JSON.stringify(payload || {})));
    }

    function decodeDataPayload(raw) {
      try {
        return JSON.parse(decodeURIComponent(String(raw || "")));
      } catch {
        return null;
      }
    }

    function normalizeKey(value) {
      return String(value || "").trim().toLowerCase();
    }

    function normalizeEntityKey(value) {
      return String(value || "")
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, "-");
    }

    function inferEntityType(entry, fallbackType = "program") {
      const explicitType = String(entry?.type || "").trim().toLowerCase();
      if (["host", "program", "episode", "genre", "location"].includes(explicitType)) {
        return explicitType;
      }
      const kind = String(entry?.kind || "").trim().toLowerCase();
      if (kind === "host" || kind === "genre" || kind === "location") {
        return kind;
      }
      if (kind === "episode" || entry?.episodeUrl || entry?.episodeTitle) {
        return "episode";
      }
      return String(fallbackType || "program").trim().toLowerCase() || "program";
    }

    function getEntityName(entry, entityType) {
      const type = String(entityType || "").trim().toLowerCase();
      if (type === "host" || type === "genre" || type === "location") {
        return String(entry?.title || entry?.value || "").trim();
      }
      if (type === "episode") {
        return String(entry?.episodeTitle || entry?.title || "").trim();
      }
      return String(entry?.programTitle || entry?.title || entry?.value || "").trim();
    }

    function buildEntityProfilePayload(entry, fallbackType = "program") {
      const entityType = inferEntityType(entry, fallbackType);
      const entityName = getEntityName(entry, entityType);
      const key = normalizeEntityKey(entityName);
      if (!entityType || !key) {
        return null;
      }
      return {
        entityId: `${entityType}:${key}`
      };
    }

    function buildExplorerPayload(entry, overrides = {}) {
      return {
        sourceType: String(overrides.sourceType || entry?.sourceType || "").trim().toLowerCase(),
        programUrl: String(overrides.programUrl || entry?.programUrl || "").trim(),
        programTitle: String(overrides.programTitle || entry?.programTitle || entry?.title || "").trim(),
        title: String(overrides.title || entry?.title || entry?.episodeTitle || "").trim(),
        useExtended: Boolean(overrides.useExtended || entry?.useExtended)
      };
    }

    function buildCollectionEntryPayload(entry, overrides = {}) {
      const latestHosts = normalizeMetadataList(entry?.latestEpisodeHosts);
      const latestGenres = normalizeMetadataList(entry?.latestEpisodeGenres);
      const entryType = String(overrides.type || entry?.type || entry?.kind || (entry?.episodeUrl ? "episode" : "program")).trim().toLowerCase() || "program";
      const entityTitle = String(overrides.title || entry?.title || entry?.episodeTitle || entry?.programTitle || "Untitled").trim();
      const hosts = normalizeMetadataList(
        overrides.hosts
        || entry?.hosts
        || (entryType === "host" ? [entityTitle] : latestHosts)
      );
      const genres = normalizeMetadataList(
        overrides.genres
        || entry?.genres
        || (entryType === "genre" ? [entityTitle] : latestGenres)
      );
      return {
        type: entryType,
        sourceType: String(overrides.sourceType || entry?.sourceType || "").trim().toLowerCase(),
        title: entityTitle,
        value: String(overrides.value || entry?.programTitle || entry?.title || entry?.episodeTitle || entityTitle).trim(),
        subtitle: String(overrides.subtitle || entry?.subtitle || "").trim(),
        programTitle: String(overrides.programTitle || entry?.programTitle || (entryType === "program" ? entityTitle : "") || entry?.title || "").trim(),
        episodeTitle: String(overrides.episodeTitle || entry?.episodeTitle || entry?.latestEpisodeTitle || "").trim(),
        programUrl: String(overrides.programUrl || entry?.programUrl || "").trim(),
        episodeUrl: String(overrides.episodeUrl || entry?.episodeUrl || "").trim(),
        description: String(overrides.description || entry?.description || entry?.latestEpisodeDescription || "").trim(),
        location: String(overrides.location || entry?.location || (entryType === "location" ? entityTitle : "") || entry?.latestEpisodeLocation || "").trim(),
        hosts,
        genres
      };
    }

    async function resolveExplorerPayload(payload) {
      const target = payload && typeof payload === "object" ? { ...payload } : {};
      if (target.programUrl && target.sourceType) {
        return target;
      }
      const sourceType = String(target.sourceType || "").trim().toLowerCase();
      const query = String(target.programTitle || target.title || "").trim();
      if (!sourceType || !query || typeof window.rteDownloader?.searchMetadataIndex !== "function") {
        return null;
      }
      const result = await window.rteDownloader.searchMetadataIndex({
        sourceType,
        query,
        limit: 25
      });
      const rows = Array.isArray(result?.results) ? result.results : [];
      const queryKey = normalizeKey(query);
      const exact = rows.find((row) =>
        String(row.programUrl || "").trim()
        && (
          normalizeKey(row.title) === queryKey
          || normalizeKey(row.programTitle) === queryKey
          || normalizeKey(row.subtitle) === queryKey
        )
      );
      const fallback = rows.find((row) => String(row.programUrl || "").trim());
      if (!exact && !fallback) {
        return null;
      }
      const match = exact || fallback;
      return {
        sourceType,
        programUrl: String(match.programUrl || "").trim(),
        programTitle: String(match.programTitle || match.title || query).trim(),
        title: String(match.title || query).trim(),
        useExtended: Boolean(match.useExtended)
      };
    }

    async function openExplorerForPayload(payload) {
      const target = await resolveExplorerPayload(payload);
      if (!target?.programUrl) {
        throw new Error("No matching program explorer target was found.");
      }
      await openProgramExplorer?.(target);
    }

    function focusLibrarySection(sectionId) {
      if (typeof activateLibraryView === "function") {
        activateLibraryView(sectionId);
        return;
      }
      if (sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }

    function renderMetadataDetails(entry) {
      const hosts = normalizeMetadataList(entry?.hosts);
      const genres = normalizeMetadataList(entry?.genres);
      const location = String(entry?.location || "").trim();
      const description = String(entry?.description || "").trim();
      const explorerPayload = buildExplorerPayload(entry);
      const hostHtml = hosts.length
        ? `<div class="item-meta">Host${hosts.length === 1 ? "" : "s"}: ${hosts.map((host) => {
          if (!explorerPayload.sourceType || (!explorerPayload.programUrl && !explorerPayload.programTitle && !explorerPayload.title)) {
            return escapeHtml(host);
          }
          return `<button class="secondary" style="font-size:0.75em;padding:0.18rem 0.45rem;" data-open-explorer="${encodeDataPayload({ ...explorerPayload, title: host })}">${escapeHtml(host)}</button>`;
        }).join(", ")}</div>`
        : "";
      return `
        ${hostHtml}
        ${location ? `<div class="item-meta">${escapeHtml(location)}</div>` : ""}
        ${description ? `<div class="item-meta muted">${escapeHtml(description.slice(0, 180))}${description.length > 180 ? "..." : ""}</div>` : ""}
        ${genres.length ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>` : ""}
      `;
    }

    function getStatusTone(status) {
      const value = normalizeStatus(status);
      if (value === "failed" || value === "error") {
        return "danger";
      }
      if (value === "cancelled" || value === "cancelling") {
        return "warn";
      }
      if (value === "done" || value === "downloaded") {
        return "ok";
      }
      return "neutral";
    }

    function renderMetricCards(container, metrics) {
      if (!container) {
        return;
      }
      const list = Array.isArray(metrics) ? metrics.filter(Boolean) : [];
      container.innerHTML = list.map((metric) => `
        <div class="library-metric-card library-metric-${escapeHtml(String(metric.tone || "neutral"))}">
          <div class="library-metric-label">${escapeHtml(String(metric.label || ""))}</div>
          <div class="library-metric-value">${escapeHtml(String(metric.value ?? ""))}</div>
          ${metric.detail ? `<div class="library-metric-detail">${escapeHtml(String(metric.detail))}</div>` : ""}
        </div>
      `).join("");
    }

    function buildFeedMetrics(entries) {
      const list = Array.isArray(entries) ? entries : [];
      const sourceCount = new Set(list.map((feed) => String(feed.sourceType || "").trim().toLowerCase()).filter(Boolean)).size;
      const rssCount = list.filter((feed) => Boolean(String(feed.rssUrl || "").trim())).length;
      const scheduledCount = list.filter((feed) => Boolean(String(feed.runSchedule || "").trim())).length;
      const nextBroadcastCount = list.filter((feed) => Boolean(String(feed.nextBroadcastAt || "").trim())).length;
      return [
        { label: "Feeds", value: list.length, detail: "Visible set", tone: "neutral" },
        { label: "Sources", value: sourceCount, detail: "Visible mix", tone: "neutral" },
        { label: "RSS Ready", value: rssCount, detail: "With RSS link", tone: rssCount > 0 ? "ok" : "neutral" },
        { label: "Scheduled", value: scheduledCount + nextBroadcastCount, detail: "Airs/next metadata", tone: (scheduledCount + nextBroadcastCount) > 0 ? "ok" : "neutral" }
      ];
    }

    function buildQueueMetrics(entries) {
      const list = Array.isArray(entries) ? entries : [];
      const failedCount = list.filter((row) => normalizeStatus(row.status) === "failed").length;
      const cancelledCount = list.filter((row) => normalizeStatus(row.status) === "cancelled").length;
      const rerunnableCount = list.filter((row) => Boolean(row.rerunnable)).length;
      const sourceCount = new Set(list.map((row) => String(row.sourceType || "").trim().toLowerCase()).filter(Boolean)).size;
      return [
        { label: "Failed", value: failedCount, detail: "Recent queue", tone: failedCount > 0 ? "danger" : "neutral" },
        { label: "Cancelled", value: cancelledCount, detail: "Recent queue", tone: cancelledCount > 0 ? "warn" : "neutral" },
        { label: "Retry Ready", value: rerunnableCount, detail: "Rerunnable jobs", tone: rerunnableCount > 0 ? "ok" : "neutral" },
        { label: "Sources", value: sourceCount, detail: "Visible mix", tone: "neutral" }
      ];
    }

    function buildHistoryMetrics(entries) {
      const list = Array.isArray(entries) ? entries : [];
      const programCount = new Set(list.map((entry) => getHistoryProgramName(entry)).filter(Boolean)).size;
      const sourceCount = new Set(list.map((entry) => String(entry.sourceType || "").trim().toLowerCase()).filter(Boolean)).size;
      const redownloadableCount = list.filter((entry) => Boolean(entry.episodeUrl)).length;
      const issueCount = list.filter((entry) => {
        const status = normalizeStatus(entry.status, "downloaded");
        return status !== "downloaded" && status !== "done";
      }).length;
      return [
        { label: "Programs", value: programCount, detail: "Visible set", tone: "neutral" },
        { label: "Sources", value: sourceCount, detail: "Visible set", tone: "neutral" },
        { label: "Re-download", value: redownloadableCount, detail: "Source URL saved", tone: redownloadableCount > 0 ? "ok" : "neutral" },
        { label: "Status Issues", value: issueCount, detail: "Non-downloaded", tone: issueCount > 0 ? "danger" : "neutral" }
      ];
    }

    function buildMetadataMetrics(result) {
      const metrics = result?.metrics || {};
      return [
        { label: "Matches", value: Number(result?.total || 0), detail: "Visible results", tone: "neutral" },
        { label: "Sources", value: Number(metrics.sourceCount || 0), detail: "Across local library", tone: "neutral" },
        { label: "Hosts", value: Number(metrics.hostCount || 0), detail: "Matched host values", tone: Number(metrics.hostCount || 0) > 0 ? "ok" : "neutral" },
        { label: "Genres", value: Number(metrics.genreCount || 0), detail: "Matched genre values", tone: Number(metrics.genreCount || 0) > 0 ? "ok" : "neutral" }
      ];
    }

    function buildMetadataDiscoveryMetrics(result) {
      const facets = result?.facets || {};
      return [
        { label: "Curated Picks", value: Array.isArray(result?.results) ? result.results.length : 0, detail: "Visible now", tone: "ok" },
        { label: "Candidates", value: Number(result?.totalCandidates || 0), detail: "Harvested pool", tone: "neutral" },
        { label: "Hosts", value: Array.isArray(facets.hosts) ? facets.hosts.length : 0, detail: "Quick chips", tone: "neutral" },
        { label: "Genres", value: Array.isArray(facets.genres) ? facets.genres.length : 0, detail: "Quick chips", tone: "neutral" }
      ];
    }

    function buildEntityGraphMetrics(result) {
      const metrics = result?.metrics || {};
      return [
        { label: "Matches", value: Number(result?.total || 0), detail: "Visible entities", tone: "neutral" },
        { label: "Entities", value: Number(metrics.entityCount || 0), detail: "Graph size", tone: "ok" },
        { label: "Relations", value: Number(metrics.relationCount || 0), detail: "Weighted edges", tone: "neutral" },
        { label: "Sources", value: Number(metrics.sourceCount || 0), detail: "Cross-source coverage", tone: "neutral" }
      ];
    }

    function getSelectedCollectionId() {
      return String(dom.collectionsSelect?.value || "").trim();
    }

    function getSelectedCollection() {
      const id = getSelectedCollectionId();
      return collectionsState.find((collection) => String(collection.id || "") === id) || null;
    }

    function buildCollectionsMetrics() {
      const collections = Array.isArray(collectionsState) ? collectionsState : [];
      const selected = getSelectedCollection();
      const entries = Array.isArray(selected?.entries) ? selected.entries : [];
      return [
        { label: "Collections", value: collections.length, detail: "Saved sets", tone: collections.length ? "ok" : "neutral" },
        { label: "Entries", value: entries.length, detail: selected ? `In ${selected.name}` : "Select one", tone: entries.length ? "ok" : "neutral" },
        { label: "Sources", value: new Set(entries.map((entry) => normalizeKey(entry.sourceType)).filter(Boolean)).size, detail: "Selected collection", tone: "neutral" },
        { label: "Hosts/Genres", value: new Set(entries.flatMap((entry) => [...normalizeMetadataList(entry.hosts), ...normalizeMetadataList(entry.genres)])).size, detail: "Saved metadata terms", tone: "neutral" }
      ];
    }

    function buildCollectionRecommendationMetrics(result) {
      const facets = result?.facets || {};
      return [
        { label: "Matches", value: Array.isArray(result?.results) ? result.results.length : 0, detail: "Visible recommendations", tone: "ok" },
        { label: "Candidates", value: Number(result?.totalCandidates || 0), detail: "Ranked pool", tone: "neutral" },
        { label: "Hosts", value: Array.isArray(facets.hosts) ? facets.hosts.length : 0, detail: "Facet values", tone: "neutral" },
        { label: "Genres", value: Array.isArray(facets.genres) ? facets.genres.length : 0, detail: "Facet values", tone: "neutral" }
      ];
    }

    function buildEntityProfileMetrics(result) {
      const entity = result?.entity || null;
      const recommendationCount = entity
        ? [
          ...(Array.isArray(entity.recommendedPrograms) ? entity.recommendedPrograms : []),
          ...(Array.isArray(entity.recommendedHosts) ? entity.recommendedHosts : []),
          ...(Array.isArray(entity.recommendedGenres) ? entity.recommendedGenres : []),
          ...(Array.isArray(entity.recommendedLocations) ? entity.recommendedLocations : []),
          ...(Array.isArray(entity.recommendedEpisodes) ? entity.recommendedEpisodes : [])
        ].length
        : 0;
      return [
        { label: "Relationships", value: Number(entity?.relatedCount || 0), detail: "Direct graph edges", tone: "neutral" },
        { label: "Documents", value: Number(entity?.documentCount || 0), detail: "Indexed matches", tone: "neutral" },
        { label: "Sources", value: Array.isArray(entity?.sourceTypes) ? entity.sourceTypes.length : 0, detail: "Entity coverage", tone: "neutral" },
        { label: "Recommendations", value: recommendationCount, detail: "Second-order graph links", tone: recommendationCount ? "ok" : "neutral" }
      ];
    }

    function buildHarvestDiagnosticsMetrics(harvest) {
      const graphMetrics = harvest?.graphMetrics || {};
      return [
        { label: "Entities", value: Number(graphMetrics.entityCount || 0), detail: "Graph size", tone: Number(graphMetrics.entityCount || 0) > 0 ? "ok" : "neutral" },
        { label: "Relations", value: Number(graphMetrics.relationCount || 0), detail: "Graph edges", tone: "neutral" },
        { label: "Programs", value: Number(harvest?.harvestedProgramCount || 0), detail: "Harvested", tone: "neutral" },
        { label: "Hosts", value: Number(harvest?.harvestedHostCount || 0), detail: "Harvested", tone: "neutral" },
        { label: "Episodes", value: Number(harvest?.harvestedEpisodeCount || 0), detail: "Harvested", tone: "neutral" },
        { label: "Thin Sources", value: Number(harvest?.thinSourceCount || 0), detail: "Need better metadata", tone: Number(harvest?.thinSourceCount || 0) > 0 ? "warn" : "ok" }
      ];
    }

    function getHistoryEntry(entryId) {
      return historyAllEntries.find((entry) => String(entry.id || "") === String(entryId || ""));
    }

    function getHistoryProgramName(entry) {
      return String(entry?.programTitle || "").trim();
    }

    function getHistoryPageSize() {
      const parsed = Number.parseInt(String(dom.historyPageSizeSelect?.value || "50"), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return 50;
      }
      return parsed;
    }

    function resetHistoryVisibleCount() {
      historyVisibleCount = getHistoryPageSize();
    }

    function getQueueRecentPageSize() {
      const parsed = Number.parseInt(String(dom.queueRecentPageSizeSelect?.value || "10"), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return 10;
      }
      return parsed;
    }

    function resetQueueRecentVisibleCount() {
      queueRecentVisibleCount = getQueueRecentPageSize();
    }

    function getPathDirectory(targetPath) {
      const value = String(targetPath || "").trim();
      if (!value) {
        return "";
      }
      const normalized = value.replace(/[\\/]+$/, "");
      return normalized.replace(/[\\/][^\\/]+$/, "");
    }

    async function copyTextToClipboard(text) {
      const value = String(text || "").trim();
      if (!value || !navigator?.clipboard?.writeText) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    }

    async function openTargetPath(targetPath, emptyMessage = "Nothing to open.") {
      const value = String(targetPath || "").trim();
      if (!value) {
        throw new Error(emptyMessage);
      }
      const result = await window.rteDownloader.openPath(value);
      if (result?.ok) {
        return;
      }
      throw new Error(result?.error || "Open path failed.");
    }

    function setDiagnosticsStatus(text, isError = false) {
      if (!dom.diagnosticsStatus) {
        return;
      }
      dom.diagnosticsStatus.textContent = text || "";
      dom.diagnosticsStatus.style.color = isError ? "#e74c3c" : "var(--muted)";
    }

    async function loadCollections() {
      if (typeof window.rteDownloader?.listCollections !== "function") {
        collectionsState = [];
        collectionRecommendationsState = { totalCandidates: 0, results: [], terms: [], facets: { hosts: [], genres: [], locations: [] } };
        renderCollections();
        return;
      }
      collectionsState = await window.rteDownloader.listCollections();
      const selectedId = getSelectedCollectionId();
      if (selectedId && collectionsState.some((collection) => String(collection.id || "") === selectedId)) {
        renderCollections();
      } else if (dom.collectionsSelect) {
        dom.collectionsSelect.value = collectionsState[0]?.id || "";
        renderCollections();
      } else {
        renderCollections();
      }
      await loadCollectionRecommendations();
    }

    async function loadCollectionRecommendations(options = {}) {
      const collectionId = getSelectedCollectionId();
      if (!collectionId || typeof window.rteDownloader?.getCollectionRecommendations !== "function") {
        collectionRecommendationsState = { totalCandidates: 0, results: [], terms: [], facets: { hosts: [], genres: [], locations: [] } };
        renderCollections();
        return;
      }
      collectionRecommendationsState = await window.rteDownloader.getCollectionRecommendations({
        collectionId,
        limit: 12,
        forceRefresh: Boolean(options.forceRefresh)
      });
      renderCollections();
    }

    function renderCollections() {
      if (dom.collectionsSelect) {
        const selectedId = getSelectedCollectionId();
        const options = Array.isArray(collectionsState) ? collectionsState : [];
        dom.collectionsSelect.innerHTML = [`<option value="">Select collection</option>`]
          .concat(options.map((collection) => `<option value="${escapeHtml(String(collection.id || ""))}"${selectedId === String(collection.id || "") ? " selected" : ""}>${escapeHtml(String(collection.name || "Collection"))}</option>`))
          .join("");
      }

      const selected = getSelectedCollection();
      if (dom.collectionsSummary) {
        const entryCount = Array.isArray(selected?.entries) ? selected.entries.length : 0;
        dom.collectionsSummary.textContent = selected
          ? `${entryCount} saved entr${entryCount === 1 ? "y" : "ies"} in ${selected.name}.`
          : ((collectionsState || []).length ? "Select a collection to view entries and recommendations." : "No collections yet. Create one from the Library.");
      }
      renderMetricCards(dom.collectionsMetrics, buildCollectionsMetrics());

      if (dom.collectionsList) {
        const entries = Array.isArray(selected?.entries) ? selected.entries : [];
        if (!entries.length) {
          dom.collectionsList.innerHTML = `<div class="item"><div class="item-meta">${selected ? "No saved entries in this collection yet." : "Create or select a collection first."}</div></div>`;
        } else {
          const groups = new Map();
          for (const entry of entries) {
            const type = inferEntityType(entry, "program");
            const list = groups.get(type) || [];
            list.push(entry);
            groups.set(type, list);
          }
          const groupLabels = {
            host: "Hosts",
            program: "Programs",
            episode: "Episodes",
            genre: "Genres",
            location: "Locations"
          };
          dom.collectionsList.innerHTML = Array.from(groups.entries()).map(([type, rows]) => `
            <div class="library-group">
              <div class="library-group-title">${escapeHtml(groupLabels[type] || "Items")} (${rows.length})</div>
              ${rows.map((entry) => `
                <div class="item">
                  <div class="item-title">${escapeHtml(String(entry.title || "Saved Item"))}</div>
                  <div class="item-meta">
                    <span class="source-badge source-badge-${escapeHtml(String(entry.sourceType || ""))}">${escapeHtml(getSourceLabel(entry.sourceType || ""))}</span>
                    <span class="status-chip status-chip-neutral">${escapeHtml(String(entry.type || "item"))}</span>
                    ${escapeHtml(String(entry.value || entry.programTitle || ""))}
                  </div>
                  ${renderMetadataDetails(entry)}
                  <div class="item-actions">
                    <button class="secondary" data-entity-profile="${encodeDataPayload(buildEntityProfilePayload(entry, type))}">View Profile</button>
                    <button class="secondary" data-open-explorer="${encodeDataPayload(buildExplorerPayload(entry))}">Open Explorer</button>
                    <button class="secondary" data-collection-entry-remove="${escapeHtml(String(entry.id || ""))}">Remove</button>
                  </div>
                </div>
              `).join("")}
            </div>
          `).join("");
        }
      }

      if (dom.collectionsRecommendationsSummary) {
        const terms = Array.isArray(collectionRecommendationsState?.terms) ? collectionRecommendationsState.terms.slice(0, 5) : [];
        dom.collectionsRecommendationsSummary.textContent = selected
          ? (collectionRecommendationsState?.results?.length
            ? `Showing ${collectionRecommendationsState.results.length} recommendation${collectionRecommendationsState.results.length === 1 ? "" : "s"} from ${Number(collectionRecommendationsState.totalCandidates || 0)} ranked candidates.${terms.length ? ` Based on ${terms.join(", ")}.` : ""}`
            : "No recommendations yet for this collection.")
          : "Select a collection to load recommendations.";
      }
      renderMetricCards(dom.collectionsRecommendationsMetrics, buildCollectionRecommendationMetrics(collectionRecommendationsState));

      if (dom.collectionsRecommendationsList) {
        const rows = Array.isArray(collectionRecommendationsState?.results) ? collectionRecommendationsState.results : [];
        dom.collectionsRecommendationsList.innerHTML = rows.length
          ? rows.map((entry) => `
            <div class="item feed-entry">
              <div class="feed-entry-main">
                <div class="item-title"><span class="source-badge source-badge-${escapeHtml(String(entry.sourceType || ""))}">${escapeHtml(getSourceLabel(entry.sourceType || ""))}</span> ${escapeHtml(String(entry.title || "Recommendation"))}</div>
                <div class="item-meta">${escapeHtml(String(entry.kindLabel || "Discovery"))}${entry.runSchedule ? ` â€¢ ${escapeHtml(String(entry.runSchedule || ""))}` : ""}</div>
                ${renderMetadataDetails(entry)}
              </div>
              <div class="feed-actions">
                <button class="secondary" data-entity-profile="${encodeDataPayload(buildEntityProfilePayload(entry, inferEntityType(entry, "program")))}">View Profile</button>
                <button class="secondary" data-open-explorer="${encodeDataPayload(buildExplorerPayload(entry))}">Open Explorer</button>
                <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(entry))}">Save</button>
              </div>
            </div>
          `).join("")
          : `<div class="item"><div class="item-meta">${selected ? "No recommendations yet for this collection." : "Select a collection to see smart discovery."}</div></div>`;
      }
    }

    async function saveEntryToCollection(entryPayload) {
      const collectionId = getSelectedCollectionId();
      if (!collectionId) {
        throw new Error("Select a collection first.");
      }
      if (typeof window.rteDownloader?.addCollectionEntry !== "function") {
        throw new Error("Collections are not available in this mode.");
      }
      collectionsState = await window.rteDownloader.addCollectionEntry(collectionId, entryPayload || {});
      renderCollections();
      await loadCollectionRecommendations();
    }

    async function saveEntriesToCollection(entryPayloads) {
      const collectionId = getSelectedCollectionId();
      if (!collectionId) {
        throw new Error("Select a collection first.");
      }
      const entries = (Array.isArray(entryPayloads) ? entryPayloads : []).filter(Boolean);
      if (!entries.length) {
        throw new Error("No visible entries match that batch action.");
      }
      if (typeof window.rteDownloader?.addCollectionEntries === "function") {
        const result = await window.rteDownloader.addCollectionEntries(collectionId, entries);
        collectionsState = Array.isArray(result?.collections) ? result.collections : [];
        renderCollections();
        await loadCollectionRecommendations();
        return Number(result?.addedCount || 0);
      }
      let addedCount = 0;
      for (const entry of entries) {
        collectionsState = await window.rteDownloader.addCollectionEntry(collectionId, entry);
        addedCount += 1;
      }
      renderCollections();
      await loadCollectionRecommendations();
      return addedCount;
    }

    function dedupeCollectionPayloads(entries) {
      const out = [];
      const seen = new Set();
      for (const entry of Array.isArray(entries) ? entries : []) {
        if (!entry) {
          continue;
        }
        const key = [
          normalizeKey(entry.type),
          normalizeKey(entry.sourceType),
          normalizeKey(entry.programUrl),
          normalizeKey(entry.episodeUrl),
          normalizeKey(entry.title),
          normalizeKey(entry.value)
        ].join("|");
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        out.push(entry);
      }
      return out;
    }

    function buildEntityCollectionPayload(item) {
      if (!item) {
        return null;
      }
      return buildCollectionEntryPayload(item, {
        type: item.type,
        title: item.name || item.title || item.programTitle,
        value: item.name || item.title || item.programTitle,
        sourceType: item?.sourceTypes?.[0] || item?.sourceType || "",
        programUrl: item.programUrl || "",
        episodeUrl: item.episodeUrl || ""
      });
    }

    function getEntityProfilePrograms(entity) {
      return dedupeCollectionPayloads(
        [
          ...(Array.isArray(entity?.topPrograms) ? entity.topPrograms : []),
          ...(Array.isArray(entity?.recommendedPrograms) ? entity.recommendedPrograms : [])
        ].map((item) => buildEntityCollectionPayload({ ...item, type: "program" }))
      );
    }

    function getEntityProfileHosts(entity) {
      return dedupeCollectionPayloads(
        [
          ...(Array.isArray(entity?.topHosts) ? entity.topHosts : []),
          ...(Array.isArray(entity?.recommendedHosts) ? entity.recommendedHosts : [])
        ].map((item) => buildEntityCollectionPayload({ ...item, type: "host" }))
      );
    }

    function getEntityProfileCollectionEntries(entity) {
      const selfEntry = buildCollectionEntryPayload(entity, {
        type: entity?.type,
        title: entity?.name,
        value: entity?.name,
        sourceType: entity?.sourceTypes?.[0] || "",
        programUrl: entity?.programUrls?.[0] || "",
        episodeUrl: entity?.episodeUrls?.[0] || ""
      });
      const genreEntries = [
        ...(Array.isArray(entity?.topGenres) ? entity.topGenres : []),
        ...(Array.isArray(entity?.recommendedGenres) ? entity.recommendedGenres : [])
      ].map((item) => buildEntityCollectionPayload({ ...item, type: "genre" }));
      const locationEntries = [
        ...(Array.isArray(entity?.topLocations) ? entity.topLocations : []),
        ...(Array.isArray(entity?.recommendedLocations) ? entity.recommendedLocations : [])
      ].map((item) => buildEntityCollectionPayload({ ...item, type: "location" }));
      const episodeEntries = [
        ...(Array.isArray(entity?.topEpisodes) ? entity.topEpisodes : []),
        ...(Array.isArray(entity?.recommendedEpisodes) ? entity.recommendedEpisodes : [])
      ].map((item) => buildEntityCollectionPayload({ ...item, type: "episode" }));
      return dedupeCollectionPayloads([
        selfEntry,
        ...getEntityProfilePrograms(entity),
        ...getEntityProfileHosts(entity),
        ...genreEntries,
        ...locationEntries,
        ...episodeEntries
      ]);
    }

    async function createCollectionFromEntity(entity) {
      const baseName = String(entity?.name || entity?.title || "Entity").trim();
      if (!baseName) {
        throw new Error("No entity is selected.");
      }
      if (typeof window.rteDownloader?.createCollection !== "function") {
        throw new Error("Collections are not available in this mode.");
      }
      const existingNames = new Set((Array.isArray(collectionsState) ? collectionsState : []).map((collection) => String(collection?.name || "").trim().toLowerCase()).filter(Boolean));
      let name = `${baseName} Graph`;
      let suffix = 2;
      while (existingNames.has(name.toLowerCase())) {
        name = `${baseName} Graph ${suffix}`;
        suffix += 1;
      }
      collectionsState = await window.rteDownloader.createCollection(name);
      const created = Array.isArray(collectionsState)
        ? collectionsState.find((collection) => String(collection?.name || "").trim() === name)
        : null;
      const collectionId = String(created?.id || collectionsState?.[0]?.id || "").trim();
      if (!collectionId) {
        throw new Error("Collection could not be created.");
      }
      if (dom.collectionsSelect) {
        dom.collectionsSelect.value = collectionId;
      }
      const entries = getEntityProfileCollectionEntries(entity);
      if (entries.length) {
        const result = await window.rteDownloader.addCollectionEntries(collectionId, entries);
        collectionsState = Array.isArray(result?.collections) ? result.collections : collectionsState;
      }
      renderCollections();
      await loadCollectionRecommendations();
      return {
        name,
        count: entries.length
      };
    }

    function getVisibleMetadataIndexEntries(kind = "") {
      const rows = Array.isArray(metadataSearchState?.results) ? metadataSearchState.results : [];
      const targetKind = String(kind || "").trim().toLowerCase();
      return targetKind ? rows.filter((entry) => String(entry?.kind || "").trim().toLowerCase() === targetKind) : rows;
    }

    function getVisibleMetadataDiscoveryEntries(kind = "") {
      const rows = Array.isArray(metadataDiscoveryState?.results) ? metadataDiscoveryState.results : [];
      const targetKind = String(kind || "").trim().toLowerCase();
      return targetKind ? rows.filter((entry) => String(entry?.kind || "").trim().toLowerCase() === targetKind) : rows;
    }

    async function handleBatchSave(entries, options = {}) {
      const payloads = (Array.isArray(entries) ? entries : []).map((entry) => buildCollectionEntryPayload(entry)).filter(Boolean);
      const addedCount = await saveEntriesToCollection(payloads);
      const attempted = payloads.length;
      const label = String(options.label || "items");
      if (attempted === 0) {
        throw new Error("No visible entries match that batch action.");
      }
      return {
        addedCount,
        attempted,
        label
      };
    }

    async function handleOpenExplorerButton(button) {
      const payload = decodeDataPayload(button?.getAttribute("data-open-explorer"));
      if (!payload) {
        throw new Error("No program explorer target is available.");
      }
      await openExplorerForPayload(payload);
    }

    async function handleSaveCollectionButton(button) {
      const payload = decodeDataPayload(button?.getAttribute("data-save-collection"));
      if (!payload) {
        throw new Error("Nothing to save.");
      }
      await saveEntryToCollection(payload);
    }

    async function loadMetadataIndex() {
      if (typeof window.rteDownloader?.searchMetadataIndex !== "function") {
        metadataSearchState = { total: 0, results: [], metrics: { total: 0, sourceCount: 0, hostCount: 0, genreCount: 0 } };
        renderMetadataIndex();
        return;
      }
      metadataSearchState = await window.rteDownloader.searchMetadataIndex({
        query: String(dom.metadataIndexSearchInput?.value || "").trim(),
        sourceType: String(dom.metadataIndexSourceFilter?.value || "").trim(),
        kind: String(dom.metadataIndexKindFilter?.value || "").trim(),
        limit: 50
      });
      renderMetadataIndex();
    }

    async function loadMetadataDiscovery(options = {}) {
      if (typeof window.rteDownloader?.discoverMetadataIndex !== "function") {
        metadataDiscoveryState = { totalCandidates: 0, results: [], facets: { hosts: [], genres: [], locations: [] } };
        renderMetadataDiscovery();
        return;
      }
      metadataDiscoveryState = await window.rteDownloader.discoverMetadataIndex({
        query: String(dom.metadataIndexSearchInput?.value || "").trim(),
        sourceType: String(dom.metadataIndexSourceFilter?.value || "").trim(),
        kind: String(dom.metadataIndexKindFilter?.value || "").trim(),
        limit: 12,
        forceRefresh: Boolean(options.forceRefresh)
      });
      renderMetadataDiscovery();
    }

    async function loadEntityGraph(options = {}) {
      if (typeof window.rteDownloader?.searchEntityGraph !== "function") {
        entityGraphState = { total: 0, results: [], metrics: { entityCount: 0, relationCount: 0, sourceCount: 0 } };
        renderEntityGraph();
        return;
      }
      entityGraphState = await window.rteDownloader.searchEntityGraph({
        query: String(dom.entityGraphSearchInput?.value || "").trim(),
        sourceType: String(dom.entityGraphSourceFilter?.value || "").trim(),
        type: String(dom.entityGraphTypeFilter?.value || "").trim(),
        limit: 24,
        forceRefresh: Boolean(options.forceRefresh)
      });
      renderEntityGraph();
    }

    async function loadEntityProfile(payload, options = {}) {
      const target = payload && typeof payload === "object"
        ? payload
        : { entityId: String(payload || "").trim() };
      const entityId = String(target?.entityId || "").trim();
      if (!entityId || typeof window.rteDownloader?.getEntityGraphEntity !== "function") {
        entityProfileState = { entity: null, metrics: entityGraphState?.metrics || {} };
        renderEntityProfile();
        return;
      }
      entityProfileState = await window.rteDownloader.getEntityGraphEntity({
        entityId,
        forceRefresh: Boolean(options.forceRefresh)
      });
      renderEntityProfile();
      if (!options.skipFocus) {
        focusLibrarySection("entityProfileSection");
      }
    }

    async function loadHeavyLibraryViews(options = {}) {
      const forceRefresh = Boolean(options.forceRefresh);
      if (heavyLibraryViewsLoadingPromise && !forceRefresh) {
        return heavyLibraryViewsLoadingPromise;
      }
      if (heavyLibraryViewsTimer) {
        clearTimeout(heavyLibraryViewsTimer);
        heavyLibraryViewsTimer = null;
      }
      heavyLibraryViewsLoadingPromise = Promise.all([
        loadMetadataIndex(),
        loadMetadataDiscovery({ forceRefresh }),
        loadEntityGraph({ forceRefresh })
      ]).then(async () => {
        if (entityProfileState?.entity?.id) {
          await loadEntityProfile({
            entityId: entityProfileState.entity.id
          }, { forceRefresh, skipFocus: true }).catch(() => {});
        } else {
          renderEntityProfile();
        }
        heavyLibraryViewsLoaded = true;
      }).finally(() => {
        heavyLibraryViewsLoadingPromise = null;
      });
      return heavyLibraryViewsLoadingPromise;
    }

    function scheduleHeavyLibraryViewsLoad(options = {}) {
      const delayMs = Math.max(0, Number(options.delayMs || 120) || 120);
      if (heavyLibraryViewsTimer) {
        clearTimeout(heavyLibraryViewsTimer);
      }
      heavyLibraryViewsTimer = setTimeout(() => {
        heavyLibraryViewsTimer = null;
        loadHeavyLibraryViews(options).catch(() => {});
      }, delayMs);
    }

    function renderMetadataIndex() {
      if (!dom.metadataIndexList) {
        return;
      }
      const result = metadataSearchState || { total: 0, results: [], metrics: {} };
      const results = Array.isArray(result.results) ? result.results : [];
      const query = String(dom.metadataIndexSearchInput?.value || "").trim();
      if (dom.metadataIndexSummary) {
        dom.metadataIndexSummary.textContent = result.total
          ? `${result.total} metadata matches${query ? ` for "${query}"` : ""}.`
          : (query ? `No metadata matches for "${query}".` : "Search hosts, genres, locations, programs, and episodes across your local library.");
      }
      renderMetricCards(dom.metadataIndexMetrics, buildMetadataMetrics(result));
      if (!results.length) {
        dom.metadataIndexList.innerHTML = `<div class="item"><div class="item-meta">${query ? "No matching metadata found." : "Type a search to explore your local metadata index."}</div></div>`;
        return;
      }
      dom.metadataIndexList.innerHTML = results.map((entry) => {
        const sourceKey = String(entry.sourceType || "");
        const sourceLabel = getSourceLabel(sourceKey);
        const kindLabel = String(entry.kindLabel || "Item");
        const canOpenFile = Boolean(entry.filePath);
        const canOpenFolder = Boolean(entry.outputDir);
        const canCopyUrl = Boolean(entry.programUrl || entry.episodeUrl);
        const targetUrl = entry.programUrl || entry.episodeUrl || "";
        const explorerPayload = buildExplorerPayload(entry);
        return `<div class="item feed-entry">
          <div style="flex:1;">
            <div class="item-title">${escapeHtml(entry.title || "Untitled")}</div>
            <div class="item-meta">
              <span class="source-badge source-badge-${escapeHtml(sourceKey)}">${escapeHtml(sourceLabel)}</span>
              <span class="status-chip status-chip-neutral">${escapeHtml(kindLabel)}</span>
              ${escapeHtml(entry.subtitle || entry.programTitle || "")}
            </div>
            ${renderMetadataDetails(entry)}
            ${entry.runSchedule ? `<div class="item-meta">Airs: ${escapeHtml(entry.runSchedule)}</div>` : ""}
            ${entry.nextBroadcastAt ? `<div class="item-meta">Next: ${escapeHtml(formatLocalDateTime(entry.nextBroadcastAt) || entry.nextBroadcastAt)}</div>` : ""}
            ${entry.latestEpisodeTitle ? `<div class="item-meta">Latest: ${escapeHtml(entry.latestEpisodeTitle)}</div>` : ""}
          </div>
          <div class="feed-actions">
            <button class="secondary" data-open-explorer="${encodeDataPayload(explorerPayload)}">Open Explorer</button>
            <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(entry))}">Save</button>
            ${canOpenFile ? `<button class="secondary" data-metadata-open-file="${escapeHtml(entry.filePath)}">Open File</button>` : ""}
            ${canOpenFolder ? `<button class="secondary" data-metadata-open-folder="${escapeHtml(entry.outputDir)}">Open Folder</button>` : ""}
            ${canCopyUrl ? `<button class="secondary" data-metadata-copy-url="${escapeHtml(targetUrl)}">Copy URL</button>` : ""}
          </div>
        </div>`;
      }).join("");
    }

    function renderFacetButtons(container, rows, type) {
      if (!container) {
        return;
      }
      const items = Array.isArray(rows) ? rows : [];
      if (!items.length) {
        container.innerHTML = `<span class="item-meta">None yet</span>`;
        return;
      }
      container.innerHTML = items.map((row) => `
        <button class="secondary" data-metadata-facet="${escapeHtml(String(row.value || ""))}" data-metadata-facet-type="${escapeHtml(type)}" style="font-size:0.8em;">
          ${escapeHtml(String(row.value || ""))} (${escapeHtml(String(row.count || 0))})
        </button>
      `).join("");
    }

    function renderMetadataDiscovery() {
      if (!dom.metadataDiscoveryList) {
        return;
      }
      const result = metadataDiscoveryState || { totalCandidates: 0, results: [], facets: {} };
      const rows = Array.isArray(result.results) ? result.results : [];
      if (dom.metadataDiscoverySummary) {
        dom.metadataDiscoverySummary.textContent = rows.length
          ? `Showing ${rows.length} curated metadata picks from ${Number(result.totalCandidates || 0)} harvested candidates.`
          : "No curated picks yet. Refresh the discovery cache to harvest more source metadata.";
      }
      renderMetricCards(dom.metadataDiscoveryMetrics, buildMetadataDiscoveryMetrics(result));
      renderFacetButtons(dom.metadataDiscoveryHosts, result?.facets?.hosts, "host");
      renderFacetButtons(dom.metadataDiscoveryGenres, result?.facets?.genres, "genre");
      renderFacetButtons(dom.metadataDiscoveryLocations, result?.facets?.locations, "location");
      if (!rows.length) {
        dom.metadataDiscoveryList.innerHTML = `<div class="item"><div class="item-meta">No curated discovery results yet.</div></div>`;
        return;
      }
      dom.metadataDiscoveryList.innerHTML = rows.map((entry) => {
        const sourceKey = String(entry.sourceType || "");
        const sourceLabel = getSourceLabel(sourceKey);
        const canCopyUrl = Boolean(entry.programUrl || entry.episodeUrl);
        const targetUrl = entry.programUrl || entry.episodeUrl || "";
        const explorerPayload = buildExplorerPayload(entry);
        return `<div class="item feed-entry">
          <div class="feed-entry-main">
            <div class="item-title"><span class="source-badge source-badge-${escapeHtml(sourceKey)}">${escapeHtml(sourceLabel)}</span> ${escapeHtml(entry.title || "Untitled")}</div>
            <div class="item-meta">${escapeHtml(entry.kindLabel || "Discovery")} ${entry.runSchedule ? `• ${escapeHtml(entry.runSchedule)}` : ""}</div>
            ${renderMetadataDetails(entry)}
            ${entry.nextBroadcastAt ? `<div class="item-meta">Next: ${escapeHtml(formatLocalDateTime(entry.nextBroadcastAt) || entry.nextBroadcastAt)}</div>` : ""}
          </div>
          <div class="feed-actions">
            <button class="secondary" data-open-explorer="${encodeDataPayload(explorerPayload)}">Open Explorer</button>
            <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(entry))}">Save</button>
            <button class="secondary" data-metadata-use-query="${escapeHtml(String(entry.title || ""))}">Find Similar</button>
            ${canCopyUrl ? `<button class="secondary" data-metadata-copy-url="${escapeHtml(targetUrl)}">Copy URL</button>` : ""}
          </div>
        </div>`;
      }).join("");
    }

    function renderEntityGraphList(items) {
      return (Array.isArray(items) ? items : []).map((item) => `
        <button class="secondary" data-entity-profile="${encodeDataPayload({ entityId: String(item.id || "") })}" style="font-size:0.8em;padding:0.18rem 0.45rem;">
          ${escapeHtml(String(item.name || ""))} (${escapeHtml(String(item.weight || 0))})
        </button>
      `).join("");
    }

    function renderEntityRecommendationSection(title, rows, emptyMessage = "") {
      const items = Array.isArray(rows) ? rows : [];
      return `
        <div class="library-group">
          <div class="library-group-title">${escapeHtml(title)}</div>
          ${items.length
            ? items.map((item) => `
              <div class="item feed-entry">
                <div class="feed-entry-main">
                  <div class="item-title">${escapeHtml(String(item.name || "Entity"))}</div>
                  <div class="item-meta">
                    <span class="status-chip status-chip-neutral">${escapeHtml(String(item.type || "entity"))}</span>
                    ${(Array.isArray(item.sourceTypes) ? item.sourceTypes : []).map((sourceType) => `<span class="source-badge source-badge-${escapeHtml(String(sourceType || ""))}">${escapeHtml(getSourceLabel(sourceType || ""))}</span>`).join(" ")}
                    Score ${escapeHtml(String(item.weight || 0))}
                  </div>
                </div>
                <div class="feed-actions">
                  <button class="secondary" data-entity-profile="${encodeDataPayload({ entityId: String(item.id || "") })}">View Profile</button>
                  ${item.programUrl ? `<button class="secondary" data-open-explorer="${encodeDataPayload({ sourceType: item?.sourceTypes?.[0] || "", programUrl: item.programUrl, programTitle: item.name, title: item.name })}">Open Explorer</button>` : ""}
                  <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(item, { type: item.type, title: item.name, value: item.name, sourceType: item?.sourceTypes?.[0] || "" }))}">Save</button>
                </div>
              </div>
            `).join("")
            : `<div class="item"><div class="item-meta">${escapeHtml(emptyMessage || "No graph recommendations yet.")}</div></div>`}
        </div>
      `;
    }

    function renderEntityGraph() {
      if (!dom.entityGraphList) {
        return;
      }
      const result = entityGraphState || { total: 0, results: [], metrics: {} };
      const rows = Array.isArray(result.results) ? result.results : [];
      const query = String(dom.entityGraphSearchInput?.value || "").trim();
      if (dom.entityGraphSummary) {
        dom.entityGraphSummary.textContent = rows.length
          ? `${result.total} entity graph match${result.total === 1 ? "" : "es"}${query ? ` for "${query}"` : ""}.`
          : (query ? `No entity graph matches for "${query}".` : "Search normalized hosts, programs, episodes, genres, and locations.");
      }
      renderMetricCards(dom.entityGraphMetrics, buildEntityGraphMetrics(result));
      if (!rows.length) {
        dom.entityGraphList.innerHTML = `<div class="item"><div class="item-meta">${query ? "No entity graph matches found." : "Type a query to explore the normalized entity graph."}</div></div>`;
        return;
      }
      dom.entityGraphList.innerHTML = rows.map((entry) => {
        const sourceBadge = Array.isArray(entry.sourceTypes) && entry.sourceTypes.length
          ? entry.sourceTypes.map((sourceType) => `<span class="source-badge source-badge-${escapeHtml(String(sourceType || ""))}">${escapeHtml(getSourceLabel(sourceType || ""))}</span>`).join(" ")
          : "";
        const primaryProgram = Array.isArray(entry.topPrograms) ? entry.topPrograms.find((item) => String(item.programUrl || "").trim()) : null;
        const explorerPayload = primaryProgram
          ? {
            sourceType: primaryProgram?.sourceTypes?.[0] || entry?.sourceTypes?.[0] || "",
            programUrl: primaryProgram.programUrl,
            programTitle: primaryProgram.name,
            title: entry.type === "program" ? entry.name : primaryProgram.name
          }
          : buildExplorerPayload({
            sourceType: entry?.sourceTypes?.[0] || "",
            programUrl: entry?.programUrls?.[0] || "",
            programTitle: entry.type === "program" ? entry.name : (primaryProgram?.name || ""),
            title: entry.name
          });
        return `<div class="item feed-entry">
          <div class="feed-entry-main">
            <div class="item-title">${escapeHtml(String(entry.name || "Entity"))}</div>
            <div class="item-meta">
              <span class="status-chip status-chip-neutral">${escapeHtml(String(entry.type || "entity"))}</span>
              ${sourceBadge}
              ${escapeHtml(String(entry.relatedCount || 0))} relationships
            </div>
            ${entry.aliases?.length > 1 ? `<div class="item-meta muted">Aliases: ${escapeHtml(entry.aliases.slice(0, 4).join(", "))}</div>` : ""}
            ${entry.topPrograms?.length ? `<div class="item-meta"><span class="feed-label">Programs</span></div><div class="genre-pills">${renderEntityGraphList(entry.topPrograms)}</div>` : ""}
            ${entry.topHosts?.length ? `<div class="item-meta"><span class="feed-label">Hosts</span></div><div class="genre-pills">${renderEntityGraphList(entry.topHosts)}</div>` : ""}
            ${entry.topGenres?.length ? `<div class="item-meta"><span class="feed-label">Genres</span></div><div class="genre-pills">${renderEntityGraphList(entry.topGenres)}</div>` : ""}
            ${entry.topLocations?.length ? `<div class="item-meta"><span class="feed-label">Locations</span></div><div class="genre-pills">${renderEntityGraphList(entry.topLocations)}</div>` : ""}
            ${entry.topEpisodes?.length ? `<div class="item-meta"><span class="feed-label">Episodes</span></div><div class="genre-pills">${renderEntityGraphList(entry.topEpisodes)}</div>` : ""}
          </div>
          <div class="feed-actions">
            <button class="secondary" data-entity-profile="${encodeDataPayload({ entityId: String(entry.id || "") })}">View Profile</button>
            <button class="secondary" data-entity-query="${escapeHtml(String(entry.name || ""))}" data-entity-query-type="${escapeHtml(String(entry.type || ""))}">Find in Metadata</button>
            <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(entry, { type: entry.type, title: entry.name, value: entry.name }))}">Save</button>
            ${explorerPayload?.programUrl ? `<button class="secondary" data-open-explorer="${encodeDataPayload(explorerPayload)}">Open Explorer</button>` : ""}
          </div>
        </div>`;
      }).join("");
    }

    function renderEntityProfile() {
      const entity = entityProfileState?.entity || null;
      if (dom.entityProfileSummary) {
        dom.entityProfileSummary.textContent = entity
          ? `${entity.name} • ${entity.type} • ${entity.relatedCount || 0} relationships`
          : "Select an entity from the graph, collections, or recommendations.";
      }
      renderMetricCards(dom.entityProfileMetrics, buildEntityProfileMetrics(entityProfileState));
      if (dom.entityProfileCard) {
        if (!entity) {
          dom.entityProfileCard.innerHTML = `<div class="item"><div class="item-meta">No entity selected yet.</div></div>`;
        } else {
          const explorerPayload = entity.programUrls?.[0]
            ? {
              sourceType: entity?.sourceTypes?.[0] || "",
              programUrl: entity.programUrls[0],
              programTitle: entity.type === "program" ? entity.name : (entity.topPrograms?.[0]?.name || entity.name),
              title: entity.name
            }
            : null;
          dom.entityProfileCard.innerHTML = `
            <div class="item feed-entry">
              <div class="feed-entry-main">
                <div class="item-title">${escapeHtml(String(entity.name || "Entity"))}</div>
                <div class="item-meta">
                  <span class="status-chip status-chip-neutral">${escapeHtml(String(entity.type || "entity"))}</span>
                  ${(Array.isArray(entity.sourceTypes) ? entity.sourceTypes : []).map((sourceType) => `<span class="source-badge source-badge-${escapeHtml(String(sourceType || ""))}">${escapeHtml(getSourceLabel(sourceType || ""))}</span>`).join(" ")}
                </div>
                ${entity.aliases?.length > 1 ? `<div class="item-meta muted">Aliases: ${escapeHtml(entity.aliases.slice(0, 6).join(", "))}</div>` : ""}
                ${entity.topPrograms?.length ? `<div class="item-meta"><span class="feed-label">Direct Programs</span></div><div class="genre-pills">${renderEntityGraphList(entity.topPrograms)}</div>` : ""}
                ${entity.topHosts?.length ? `<div class="item-meta"><span class="feed-label">Direct Hosts</span></div><div class="genre-pills">${renderEntityGraphList(entity.topHosts)}</div>` : ""}
                ${entity.topGenres?.length ? `<div class="item-meta"><span class="feed-label">Direct Genres</span></div><div class="genre-pills">${renderEntityGraphList(entity.topGenres)}</div>` : ""}
                ${entity.topLocations?.length ? `<div class="item-meta"><span class="feed-label">Direct Locations</span></div><div class="genre-pills">${renderEntityGraphList(entity.topLocations)}</div>` : ""}
                ${entity.topEpisodes?.length ? `<div class="item-meta"><span class="feed-label">Direct Episodes</span></div><div class="genre-pills">${renderEntityGraphList(entity.topEpisodes)}</div>` : ""}
              </div>
              <div class="feed-actions">
                <button class="secondary" data-entity-query="${escapeHtml(String(entity.name || ""))}" data-entity-query-type="${escapeHtml(String(entity.type || ""))}">Find in Metadata</button>
                <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(entity, { type: entity.type, title: entity.name, value: entity.name, sourceType: entity?.sourceTypes?.[0] || "" }))}">Save</button>
                <button class="secondary" data-entity-bulk="save-programs">Save Related Programs</button>
                <button class="secondary" data-entity-bulk="save-hosts">Save Recommended Hosts</button>
                <button class="secondary" data-entity-bulk="build-collection">Build Collection</button>
                ${explorerPayload?.programUrl ? `<button class="secondary" data-open-explorer="${encodeDataPayload(explorerPayload)}">Open Explorer</button>` : ""}
              </div>
            </div>
          `;
        }
      }
      if (dom.entityProfileRecommendations) {
        if (!entity) {
          dom.entityProfileRecommendations.innerHTML = "";
          return;
        }
        const programLabel = entity.type === "program" ? "More Like This Show" : "Recommended Programs";
        const hostLabel = entity.type === "host" ? "Related Hosts" : "Recommended Hosts";
        dom.entityProfileRecommendations.innerHTML = [
          renderEntityRecommendationSection(programLabel, entity.recommendedPrograms, "No related programs yet."),
          renderEntityRecommendationSection(hostLabel, entity.recommendedHosts, "No related hosts yet."),
          renderEntityRecommendationSection("Recommended Genres", entity.recommendedGenres, "No related genres yet."),
          renderEntityRecommendationSection("Recommended Locations", entity.recommendedLocations, "No related locations yet."),
          renderEntityRecommendationSection("Recommended Episodes", entity.recommendedEpisodes, "No related episodes yet.")
        ].join("");
      }
    }

    async function rebuildHistoryEntryMetadata(entry) {
      if (!entry || typeof window.rteDownloader?.postprocessHistoryEntry !== "function") {
        throw new Error("Post-processing is not available here.");
      }
      if (!entry.outputDir || !entry.fileName) {
        throw new Error("This history entry does not reference a downloaded file.");
      }
      return window.rteDownloader.postprocessHistoryEntry({
        sourceType: entry.sourceType,
        outputDir: entry.outputDir,
        fileName: entry.fileName,
        episodeUrl: entry.episodeUrl,
        sourceUrl: entry.sourceUrl,
        artworkUrl: entry.artworkUrl,
        clipId: entry.clipId,
        publishedTime: entry.publishedTime,
        episodeTitle: entry.episodeTitle,
        programTitle: entry.programTitle,
        description: entry.description,
        location: entry.location,
        hosts: normalizeMetadataList(entry.hosts),
        genres: normalizeMetadataList(entry.genres),
        tracklistUrl: entry.tracklistUrl,
        fileStartOffset: Number(entry.fileStartOffset || 0)
      });
    }

    function renderQueueItems(container, rows, allowCancel = false, emptyMessage = "None") {
      if (!container) {
        return;
      }
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        container.innerHTML = `<div class="item"><div class="item-meta">${escapeHtml(emptyMessage)}</div></div>`;
        return;
      }
      container.innerHTML = list.map((row) => `
        <div class="item">
          <div class="item-title">${escapeHtml(String(row.label || "Download"))}</div>
          <div class="item-meta queue-entry-meta">
            <span class="source-badge source-badge-${escapeHtml(String(row.sourceType || "").toLowerCase())}">${escapeHtml(getSourceLabel(row.sourceType || ""))}</span>
            <span class="status-chip status-chip-${escapeHtml(getStatusTone(row.status))}">${escapeHtml(String(row.status || ""))}</span>
            ${row.programTitle ? `<span class="queue-entry-program">${escapeHtml(String(row.programTitle || ""))}</span>` : ""}
          </div>
          ${renderMetadataDetails(row)}
          ${row.endedAt ? `<div class="item-meta">Finished: ${escapeHtml(formatLocalDateTime(row.endedAt))}</div>` : ""}
          ${row.filePath ? `<div class="item-meta">Path: ${escapeHtml(row.filePath)}</div>` : ""}
          ${row.message && normalizeStatus(row.status) !== "done" ? `<div class="item-meta queue-entry-issue">${escapeHtml(String(row.message || ""))}</div>` : ""}
          <div class="item-actions">
            ${allowCancel ? `<button class="secondary" data-queue-cancel="${escapeHtml(String(row.id || ""))}">Cancel</button>` : ""}
            <button class="secondary" data-open-explorer="${encodeDataPayload(buildExplorerPayload(row, { programTitle: row.programTitle || row.label }))}">Open Explorer</button>
            <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(row, { title: row.label || row.episodeTitle || row.programTitle, type: row.episodeUrl ? "episode" : "program" }))}">Save</button>
            ${row.outputDir && row.fileName ? `<button class="secondary" data-queue-play="${escapeHtml(String(row.outputDir || ""))}" data-queue-file="${escapeHtml(String(row.fileName || ""))}" data-queue-title="${escapeHtml(String(row.label || row.fileName || "Download"))}" data-queue-source="${escapeHtml(String(row.sourceType || "local").toUpperCase())}" data-queue-image="${escapeHtml(String(row.image || ""))}">Play</button>` : ""}
            ${!allowCancel && row.rerunnable ? `<button class="secondary" data-queue-rerun="${escapeHtml(String(row.id || ""))}" data-queue-rerun-mode="exact">Retry Exact</button>` : ""}
            ${!allowCancel && row.rerunnable ? `<button class="secondary" data-queue-rerun="${escapeHtml(String(row.id || ""))}" data-queue-rerun-mode="current-settings">Use Current Settings</button>` : ""}
          </div>
        </div>
      `).join("");
    }

    function renderRecentQueue(rows) {
      const sourceFilter = String(dom.queueRecentSourceFilter?.value || "").trim().toLowerCase();
      const statusFilter = String(dom.queueRecentStatusFilter?.value || "").trim().toLowerCase();
      const search = String(dom.queueRecentSearchInput?.value || "").trim().toLowerCase();
      let entries = Array.isArray(rows) ? rows : [];

      if (sourceFilter) {
        entries = entries.filter((row) => String(row.sourceType || "").trim().toLowerCase() === sourceFilter);
      }
      if (statusFilter) {
        entries = entries.filter((row) => String(row.status || "").trim().toLowerCase() === statusFilter);
      }
      if (search) {
        entries = entries.filter((row) => buildMetadataSearchText(row).includes(search));
      }

      const totalCount = entries.length;
      const pageSize = getQueueRecentPageSize();
      queueRecentVisibleCount = Math.max(pageSize, queueRecentVisibleCount);
      const visibleCount = Math.min(totalCount, queueRecentVisibleCount);
      const visibleEntries = entries.slice(0, visibleCount);
      const hasActiveFilters = Boolean(sourceFilter || statusFilter || search);

      if (dom.queueRecentSummary) {
        dom.queueRecentSummary.textContent = totalCount
          ? `Showing ${visibleCount} of ${totalCount} recent queue item${totalCount === 1 ? "" : "s"}`
          : (hasActiveFilters ? "No matching recent queue items." : "No recent queue activity.");
      }
      renderMetricCards(dom.queueMetrics, buildQueueMetrics(entries));

      if (dom.queueRecentShowMoreBtn) {
        const remainingCount = Math.max(0, totalCount - visibleCount);
        const hasMore = remainingCount > 0;
        dom.queueRecentShowMoreBtn.classList.toggle("hidden", !hasMore);
        dom.queueRecentShowMoreBtn.disabled = !hasMore;
        dom.queueRecentShowMoreBtn.textContent = hasMore
          ? `Show ${Math.min(pageSize, remainingCount)} More`
          : "Show More";
      }

      renderQueueItems(
        dom.downloadQueueRecent,
        visibleEntries,
        false,
        hasActiveFilters ? "No matching recent queue items." : "No recent queue activity."
      );
    }

    function renderQueueSnapshot(snapshot) {
      const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
      latestQueueSnapshot = snap;
      const activeCount = Number(snap.activeCount || 0);
      const queuedCount = Number(snap.queuedCount || 0);
      const maxConcurrent = Number(snap.maxConcurrent || state.maxConcurrentDownloads || 1);
      const paused = Boolean(snap.paused);
      if (dom.downloadQueueStatus) {
        dom.downloadQueueStatus.textContent = `Active: ${activeCount} • Queued: ${queuedCount} • Max: ${maxConcurrent} • ${paused ? "Paused" : "Running"}`;
      }
      renderQueueItems(dom.downloadQueueActive, snap.active || [], true);
      renderQueueItems(dom.downloadQueuePending, snap.queued || [], true);
      renderRecentQueue(snap.recent || []);
    }

    async function refreshDownloadQueueSnapshot() {
      if (!window.rteDownloader?.getDownloadQueueSnapshot) {
        return;
      }
      try {
        renderQueueSnapshot(await window.rteDownloader.getDownloadQueueSnapshot());
      } catch {}
    }

    async function loadFeeds() {
      if (!window.rteDownloader?.listProgramFeeds) {
        state.libraryFeeds = [];
        renderFeeds();
        return;
      }
      try {
        const result = await window.rteDownloader.listProgramFeeds();
        state.libraryFeeds = result?.feeds || result || [];
      } catch {
        state.libraryFeeds = [];
      }
      renderFeeds();
    }

    function renderFeeds() {
      if (!dom.feedsList) {
        return;
      }
      const formatList = (value) => normalizeMetadataList(value);
      const renderPills = (items) => {
        const values = formatList(items);
        return values.length
          ? `<div class="genre-pills">${values.map((item) => `<span class="genre-pill">${escapeHtml(item)}</span>`).join("")}</div>`
          : "";
      };
      const renderMetaLine = (parts) => {
        const values = parts.map((part) => String(part || "").trim()).filter(Boolean);
        return values.length ? `<div class="item-meta">${values.map((part) => escapeHtml(part)).join(" • ")}</div>` : "";
      };
      const renderExcerpt = (text, limit = 180, className = "item-meta muted") => {
        const value = String(text || "").trim();
        return value
          ? `<div class="${className}">${escapeHtml(value.slice(0, limit))}${value.length > limit ? "..." : ""}</div>`
          : "";
      };
      const allRows = Array.isArray(state.libraryFeeds) ? state.libraryFeeds : [];
      const sourceFilter = String(dom.feedsSourceFilter?.value || "").trim().toLowerCase();
      const search = String(dom.feedsSearchInput?.value || "").trim().toLowerCase();
      let rows = allRows;
      if (sourceFilter) {
        rows = rows.filter((feed) => String(feed.sourceType || "").trim().toLowerCase() === sourceFilter);
      }
      if (search) {
        rows = rows.filter((feed) => buildFeedSearchText(feed).includes(search));
      }
      if (dom.feedsSummary) {
        dom.feedsSummary.textContent = allRows.length
          ? `Showing ${rows.length} of ${allRows.length} feed${allRows.length === 1 ? "" : "s"}`
          : "No feeds exported yet.";
      }
      renderMetricCards(dom.feedsMetrics, buildFeedMetrics(rows));
      if (!allRows.length) {
        dom.feedsList.innerHTML = `<div class="item">No feeds exported yet. Enable feed export and refresh a subscription.</div>`;
        return;
      }
      if (!rows.length) {
        dom.feedsList.innerHTML = `<div class="item">No feeds match the current filters.</div>`;
        return;
      }
      dom.feedsList.innerHTML = rows.map((feed) => {
        const sourceKey = String(feed.sourceType || "");
        const updatedAt = feed.updatedAt ? new Date(feed.updatedAt).toLocaleString() : "";
        const hosts = formatList(feed.hosts);
        const genres = formatList(feed.genres);
        const latestHosts = formatList(feed.latestEpisodeHosts);
        const latestGenres = formatList(feed.latestEpisodeGenres);
        const runSchedule = String(feed.runSchedule || "").trim();
        const nextBroadcast = formatLocalDateTime(feed.nextBroadcastAt || "");
        const latestPublished = formatLocalDateTime(feed.latestEpisodePublishedTime || "");
        const latestMeta = [
          latestHosts.length ? `Host${latestHosts.length === 1 ? "" : "s"}: ${latestHosts.join(", ")}` : "",
          String(feed.latestEpisodeLocation || "").trim()
        ].filter(Boolean);
        const programMeta = [
          hosts.length ? `Host${hosts.length === 1 ? "" : "s"}: ${hosts.join(", ")}` : "",
          String(feed.location || "").trim()
        ].filter(Boolean);
        return `<div class="item feed-entry">
          <div class="feed-entry-main">
            <div class="item-title"><span class="source-badge source-badge-${escapeHtml(sourceKey)}">${escapeHtml(getSourceLabel(sourceKey))}</span> ${escapeHtml(feed.title || feed.slug || "Feed")}</div>
            <div class="item-meta">${escapeHtml(String(feed.episodeCount || 0))} episode(s) exported${updatedAt ? ` • Updated ${escapeHtml(updatedAt)}` : ""}</div>
            ${renderMetaLine(programMeta)}
            ${runSchedule ? `<div class="item-meta"><span class="feed-label">Airs</span> ${escapeHtml(runSchedule)}</div>` : ""}
            ${nextBroadcast ? `<div class="item-meta"><span class="feed-label">Next</span> ${escapeHtml(nextBroadcast)}${feed.nextBroadcastTitle ? ` • ${escapeHtml(String(feed.nextBroadcastTitle || ""))}` : ""}</div>` : ""}
            ${renderExcerpt(feed.description, 220)}
            ${renderPills(genres)}
            ${(feed.latestEpisodeTitle || latestPublished || latestMeta.length || latestGenres.length || feed.latestEpisodeDescription) ? `<div class="feed-latest-block">
              <div class="feed-label">Latest Episode</div>
              ${feed.latestEpisodeTitle ? `<div class="item-meta feed-latest-title">${escapeHtml(String(feed.latestEpisodeTitle || ""))}</div>` : ""}
              ${latestPublished ? `<div class="item-meta">${escapeHtml(latestPublished)}</div>` : ""}
              ${renderMetaLine(latestMeta)}
              ${renderExcerpt(feed.latestEpisodeDescription, 180, "item-meta")}
              ${renderPills(latestGenres)}
            </div>` : ""}
            ${feed.programUrl ? `<div class="item-meta"><a href="${escapeHtml(feed.programUrl)}" target="_blank" rel="noopener noreferrer">Open program</a></div>` : ""}
          </div>
          <div class="item-actions feed-actions">
            <button class="secondary" data-open-explorer="${encodeDataPayload(buildExplorerPayload(feed, { title: feed.title, programTitle: feed.title }))}">Open Explorer</button>
            <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(feed, { type: "program", title: feed.title, value: feed.slug || feed.title }))}">Save</button>
            ${feed.jsonUrl ? `<a class="secondary button-link" href="${escapeHtml(feed.jsonUrl)}" target="_blank" rel="noopener noreferrer">JSON</a>` : ""}
            ${feed.rssUrl ? `<a class="secondary button-link" href="${escapeHtml(feed.rssUrl)}" target="_blank" rel="noopener noreferrer">RSS</a>` : ""}
            ${feed.rssUrl ? `<button class="secondary" data-feed-copy="${escapeHtml(feed.rssUrl)}">Copy RSS</button>` : ""}
            ${feed.jsonPath ? `<button class="secondary" data-feed-open="${escapeHtml(feed.jsonPath)}">Open File</button>` : ""}
          </div>
        </div>`;
      }).join("");
    }

    function renderDiagnostics() {
      if (!dom.diagnosticsRuntime || !dom.diagnosticsBinaries) {
        return;
      }
      const diagnostics = state.diagnostics || {};
      const runtime = diagnostics.runtime || {};
      const vendor = diagnostics.vendor || {};
      const harvest = diagnostics.metadataHarvest || {};
      const binaryRows = Array.isArray(diagnostics.binaries) ? diagnostics.binaries : [];
      const writableRows = Array.isArray(diagnostics.writablePaths) ? diagnostics.writablePaths : [];
      const recentErrors = Array.isArray(diagnostics.recentErrors) ? diagnostics.recentErrors : [];
      const runtimeRows = [
        ["Platform", [runtime.platform, runtime.arch].filter(Boolean).join(" / ") || "Unknown"],
        ["Node", runtime.nodeVersion || "Unknown"],
        ["Project Root", runtime.projectRoot || "Unknown"],
        ["Data Dir", runtime.dataDir || "Unknown"],
        ["Download Dir", runtime.downloadDir || "Unknown"],
        ["Bootstrap Script", vendor.bootstrapScriptExists ? (vendor.bootstrapScriptPath || "Ready") : "Missing"]
      ];

      dom.diagnosticsRuntime.innerHTML = runtimeRows.map(([label, value]) => `
        <div class="item diagnostics-card">
          <div class="item-title">${escapeHtml(label)}</div>
          <div class="item-meta">${escapeHtml(String(value || ""))}</div>
        </div>
      `).join("");

      if (dom.diagnosticsHarvestSummary) {
        const updatedAt = formatLocalDateTime(harvest.updatedAt || "") || String(harvest.updatedAt || "").trim();
        dom.diagnosticsHarvestSummary.textContent = harvest.harvestedCount
          ? `Harvested ${Number(harvest.harvestedCount || 0)} docs across ${Number(harvest.sourceCount || 0)} sources${updatedAt ? ` • Updated ${updatedAt}` : ""}.`
          : "No harvest diagnostics yet. Refresh the discovery cache to start populating the graph.";
      }
      renderMetricCards(dom.diagnosticsHarvestMetrics, buildHarvestDiagnosticsMetrics(harvest));

      if (dom.diagnosticsHarvestSources) {
        const rows = Array.isArray(harvest.sourceStats) ? harvest.sourceStats : [];
        dom.diagnosticsHarvestSources.innerHTML = rows.length
          ? rows.map((row) => {
            const tone = row.due ? "warn" : (row.thinCount > 0 || row.hostCoverage < 40 || row.genreCoverage < 40 ? "danger" : "ok");
            const lastRun = formatLocalDateTime(row.lastRunAt || "") || "Never";
            const nextDue = formatLocalDateTime(row.nextDueAt || "") || "Pending";
            return `
              <div class="item feed-entry diagnostics-entry">
                <div class="feed-entry-main">
                  <div class="item-title">
                    <span class="source-badge source-badge-${escapeHtml(String(row.sourceType || ""))}">${escapeHtml(getSourceLabel(row.sourceType || ""))}</span>
                    Harvest Cadence
                  </div>
                  <div class="item-meta">
                    <span class="status-chip status-chip-${escapeHtml(tone)}">${row.due ? "Due" : "Scheduled"}</span>
                    ${escapeHtml(String(row.harvestedCount || 0))} docs
                    • ${escapeHtml(String(row.programCount || 0))} programs
                    • ${escapeHtml(String(row.hostCount || 0))} hosts
                    • ${escapeHtml(String(row.episodeCount || 0))} episodes
                  </div>
                  <div class="item-meta">Last Run: ${escapeHtml(lastRun)} • Next Due: ${escapeHtml(nextDue)}</div>
                  <div class="item-meta">Depth: last ${escapeHtml(String(row.lastEpisodePages || 0))} page(s) • next ${escapeHtml(String(row.nextEpisodePages || 0))} page(s)</div>
                  <div class="item-meta">Coverage: hosts ${escapeHtml(String(row.hostCoverage || 0))}% • genres ${escapeHtml(String(row.genreCoverage || 0))}% • descriptions ${escapeHtml(String(row.descriptionCoverage || 0))}% • locations ${escapeHtml(String(row.locationCoverage || 0))}%</div>
                  ${row.thinCount ? `<div class="item-meta queue-entry-issue">${escapeHtml(String(row.thinCount || 0))} harvested doc(s) are still metadata-thin for this source.</div>` : ""}
                </div>
              </div>
            `;
          }).join("")
          : `<div class="item"><div class="item-meta">No per-source harvest cadence data yet.</div></div>`;
      }

      const writableHtml = writableRows.length ? `
        <div class="item">
          <div class="item-title">Writable Paths</div>
          <div class="feed-actions">
            ${writableRows.map((entry) => {
              const statusClass = entry.ok ? "health-dot-green" : "health-dot-red";
              return `<div class="diagnostics-card">
                <div class="item-meta"><span class="health-dot ${statusClass}"></span>${escapeHtml(entry.label || "Path")}</div>
                <div class="item-meta diagnostics-path">${escapeHtml(entry.path || "")}</div>
                <div class="item-meta">${escapeHtml(entry.detail || "")}</div>
              </div>`;
            }).join("")}
          </div>
        </div>
      ` : "";

      const binaryHtml = binaryRows.length ? binaryRows.map((binary) => {
        const statusClass = binary.ok ? "health-dot-green" : (binary.optional ? "health-dot-yellow" : "health-dot-red");
        return `<div class="item feed-entry diagnostics-entry">
          <div class="feed-entry-main">
            <div class="item-title"><span class="health-dot ${statusClass}"></span>${escapeHtml(binary.label || "Binary")}</div>
            <div class="item-meta">${escapeHtml(binary.detail || (binary.ok ? "Ready" : "Unavailable"))}</div>
            ${binary.version ? `<div class="item-meta">${escapeHtml(binary.version)}</div>` : ""}
            ${binary.path ? `<div class="item-meta diagnostics-path">${escapeHtml(binary.path)}</div>` : ""}
          </div>
          <div class="item-actions feed-actions">
            ${binary.path ? `<button class="secondary" data-diagnostics-open="${escapeHtml(binary.path)}">Open Path</button>` : ""}
          </div>
        </div>`;
      }).join("") : `<div class="item">No binary diagnostics available.</div>`;

      const recentErrorsHtml = recentErrors.length ? `
        <div class="item">
          <div class="item-title">Recent Failures</div>
          ${recentErrors.slice(0, 5).map((entry) => `
            <div class="item-meta">
              <span class="source-badge source-badge-${escapeHtml(String(entry.sourceType || ""))}">${escapeHtml(getSourceLabel(entry.sourceType || ""))}</span>
              ${escapeHtml(String(entry.title || "Unknown source"))}
            </div>
            <div class="item-meta">${escapeHtml(String(entry.error || ""))}</div>
            <div class="item-meta">${escapeHtml(String(entry.savedAt ? new Date(entry.savedAt).toLocaleString() : ""))}</div>
          `).join("")}
        </div>
      ` : `<div class="item"><div class="item-title">Recent Failures</div><div class="item-meta">No recent extractor failures recorded.</div></div>`;

      dom.diagnosticsBinaries.innerHTML = `${writableHtml}${binaryHtml}${recentErrorsHtml}`;
    }

    async function loadDiagnostics() {
      if (!window.rteDownloader?.getDiagnostics) {
        return;
      }
      setDiagnosticsStatus("Loading diagnostics...");
      try {
        state.diagnostics = await window.rteDownloader.getDiagnostics() || {};
        renderDiagnostics();
        setDiagnosticsStatus("Diagnostics updated.");
      } catch (error) {
        setDiagnosticsStatus(error.message, true);
      }
    }

    async function redownloadHistoryEntry(entry) {
      const sourceType = String(entry?.sourceType || "").trim().toLowerCase();
      const episodeUrl = String(entry?.episodeUrl || "").trim();
      if (!sourceType || !episodeUrl || typeof window.rteDownloader?.downloadFromUrl !== "function") {
        throw new Error("This history entry cannot be downloaded again.");
      }
      const progressToken = createProgressToken(`history-${sourceType}`);
      await window.rteDownloader.downloadFromUrl(sourceType, episodeUrl, progressToken, {
        title: entry.episodeTitle || "",
        programTitle: entry.programTitle || "",
        description: entry.description || "",
        location: entry.location || "",
        hosts: normalizeMetadataList(entry.hosts),
        genres: normalizeMetadataList(entry.genres),
        forceDownload: true
      });
    }

    async function loadHistory() {
      if (historyLoadPromise) {
        return historyLoadPromise;
      }
      historyLoadPromise = (async () => {
        try {
          const result = await window.rteDownloader.listDownloadHistory();
          historyAllEntries = result?.history || result || [];
        } catch {
          historyAllEntries = [];
        }
        resetHistoryVisibleCount();
        renderHistory();
      })();
      try {
        await historyLoadPromise;
      } finally {
        historyLoadPromise = null;
      }
    }

    function syncHistoryProgramFilterOptions(entries) {
      if (!dom.historyProgramFilter) {
        return;
      }

      const currentValue = String(dom.historyProgramFilter.value || "");
      const counts = new Map();
      for (const entry of Array.isArray(entries) ? entries : []) {
        const programName = getHistoryProgramName(entry);
        if (!programName) {
          continue;
        }
        counts.set(programName, (counts.get(programName) || 0) + 1);
      }

      const options = [...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([programName, count]) => ({
          value: programName,
          label: `${programName} (${count})`
        }));

      dom.historyProgramFilter.innerHTML = [
        `<option value="">All Programs</option>`,
        ...options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      ].join("");

      if (currentValue && counts.has(currentValue)) {
        dom.historyProgramFilter.value = currentValue;
      }
    }

    function renderHistory() {
      if (!dom.historyList) {
        return;
      }
      const sourceFilter = dom.historySourceFilter?.value || "";
      const programFilter = dom.historyProgramFilter?.value || "";
      const statusFilter = dom.historyStatusFilter?.value || "";
      const search = String(dom.historySearchInput?.value || "").toLowerCase();
      let entries = historyAllEntries;
      if (sourceFilter) {
        entries = entries.filter((entry) => entry.sourceType === sourceFilter);
      }
      syncHistoryProgramFilterOptions(entries);
      if (programFilter && !entries.some((entry) => getHistoryProgramName(entry) === programFilter)) {
        if (dom.historyProgramFilter) {
          dom.historyProgramFilter.value = "";
        }
      }
      const effectiveProgramFilter = dom.historyProgramFilter?.value || "";
      if (effectiveProgramFilter) {
        entries = entries.filter((entry) => getHistoryProgramName(entry) === effectiveProgramFilter);
      }
      if (statusFilter) {
        entries = entries.filter((entry) => String(entry.status || "downloaded") === statusFilter);
      }
      if (search) {
        entries = entries.filter((entry) => buildMetadataSearchText(entry).includes(search));
      }

      const totalCount = entries.length;
      const pageSize = getHistoryPageSize();
      historyVisibleCount = Math.max(pageSize, historyVisibleCount);
      const visibleCount = Math.min(totalCount, historyVisibleCount);
      const visibleEntries = entries.slice(0, visibleCount);
      const hasActiveFilters = Boolean(sourceFilter || effectiveProgramFilter || statusFilter || search);

      if (dom.historySummary) {
        dom.historySummary.textContent = totalCount
          ? `Showing ${visibleCount} of ${totalCount} matching entr${totalCount === 1 ? "y" : "ies"}`
          : (hasActiveFilters ? "No matching history entries." : "No history entries yet.");
      }
      renderMetricCards(dom.historyMetrics, buildHistoryMetrics(entries));

      if (dom.historyShowMoreBtn) {
        const remainingCount = Math.max(0, totalCount - visibleCount);
        const hasMore = remainingCount > 0;
        dom.historyShowMoreBtn.classList.toggle("hidden", !hasMore);
        dom.historyShowMoreBtn.disabled = !hasMore;
        dom.historyShowMoreBtn.textContent = hasMore
          ? `Show ${Math.min(pageSize, remainingCount)} More`
          : "Show More";
      }

      if (!visibleEntries.length) {
        dom.historyList.innerHTML = `<div style="color:var(--muted);padding:0.6rem 0;">${hasActiveFilters ? "No matching history entries." : "No history entries."}</div>`;
        return;
      }
      dom.historyList.innerHTML = visibleEntries.map((entry) => {
        const sourceKey = String(entry.sourceType || "");
        const savedAt = entry.savedAt ? new Date(entry.savedAt).toLocaleString() : "";
        const pathShort = entry.fileName || entry.filePath || "";
        const sourceLabel = getSourceLabel(sourceKey);
        const entryId = String(entry.id || "");
        const canPlay = Boolean(entry.outputDir && entry.fileName);
        const canOpenFile = Boolean(entry.filePath);
        const canOpenFolder = Boolean(entry.outputDir);
        const canRedownload = Boolean(entry.episodeUrl && typeof window.rteDownloader?.downloadFromUrl === "function");
        const canPostprocess = Boolean(entry.outputDir && entry.fileName && typeof window.rteDownloader?.postprocessHistoryEntry === "function");
        const status = normalizeStatus(entry.status, "downloaded");
        return `<div class="history-entry">
          <div class="history-entry-date">${escapeHtml(savedAt)}</div>
          <div class="history-entry-meta">
            <div class="history-entry-title">${escapeHtml(entry.episodeTitle || "Unknown episode")}</div>
            <div class="history-entry-program">
              <span class="source-badge source-badge-${escapeHtml(sourceKey)}">${escapeHtml(sourceLabel)}</span>
              <span class="status-chip status-chip-${escapeHtml(getStatusTone(status))}">${escapeHtml(status)}</span>
              ${escapeHtml(entry.programTitle || "")}
            </div>
            ${renderMetadataDetails(entry)}
            ${pathShort ? `<div class="history-entry-path">${escapeHtml(pathShort)}</div>` : ""}
            ${entry.message && status !== "downloaded" ? `<div class="item-meta queue-entry-issue">${escapeHtml(String(entry.message || ""))}</div>` : ""}
            <div class="history-actions">
              <button class="secondary" data-open-explorer="${encodeDataPayload(buildExplorerPayload(entry, { programTitle: entry.programTitle, title: entry.programTitle || entry.episodeTitle }))}">Open Explorer</button>
              <button class="secondary" data-save-collection="${encodeDataPayload(buildCollectionEntryPayload(entry, { type: entry.episodeUrl ? "episode" : "program", title: entry.episodeTitle || entry.programTitle }))}">Save</button>
              ${canPlay ? `<button class="secondary" data-history-action="play" data-history-id="${escapeHtml(entryId)}">Play</button>` : ""}
              ${canOpenFolder ? `<button class="secondary" data-history-action="open-folder" data-history-id="${escapeHtml(entryId)}">Open Folder</button>` : ""}
              ${canOpenFile ? `<button class="secondary" data-history-action="open-file" data-history-id="${escapeHtml(entryId)}">Open File</button>` : ""}
              ${canPostprocess ? `<button class="secondary" data-history-action="postprocess" data-history-id="${escapeHtml(entryId)}">Rebuild Tags/Chapters</button>` : ""}
              ${canRedownload ? `<button class="secondary" data-history-action="redownload" data-history-id="${escapeHtml(entryId)}">Re-download</button>` : ""}
            </div>
          </div>
        </div>`;
      }).join("");
    }

    async function refreshLibraryData() {
      await Promise.all([
        loadCollections().catch(() => {}),
        loadFeeds().catch(() => {}),
        loadHistory().catch(() => {}),
        refreshDownloadQueueSnapshot().catch(() => {})
      ]);
      renderEntityProfile();
      if (!heavyLibraryViewsLoaded) {
        scheduleHeavyLibraryViewsLoad();
      } else {
        loadHeavyLibraryViews().catch(() => {});
      }
    }

    function bindQueueActions(container, options = {}) {
      if (!container) {
        return;
      }
      container.addEventListener("click", async (event) => {
        const openExplorerBtn = event.target.closest("[data-open-explorer]");
        if (openExplorerBtn) {
          try {
            await handleOpenExplorerButton(openExplorerBtn);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }

        const saveBtn = event.target.closest("[data-save-collection]");
        if (saveBtn) {
          try {
            await handleSaveCollectionButton(saveBtn);
            setSettingsStatus("Saved to collection.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }

        const playBtn = event.target.closest("button[data-queue-play]");
        if (playBtn) {
          try {
            await playFromDownloadedFile({
              outputDir: playBtn.getAttribute("data-queue-play"),
              fileName: playBtn.getAttribute("data-queue-file"),
              title: playBtn.getAttribute("data-queue-title") || "",
              source: playBtn.getAttribute("data-queue-source") || "Local",
              subtitle: "From Queue",
              image: playBtn.getAttribute("data-queue-image") || ""
            });
          } catch (error) {
            setSettingsStatus(`Queue play failed: ${error.message}`, true);
          }
          return;
        }

        const cancelBtn = event.target.closest("button[data-queue-cancel]");
        if (cancelBtn) {
          const taskId = cancelBtn.getAttribute("data-queue-cancel") || "";
          if (!taskId) {
            return;
          }
          try {
            await window.rteDownloader.cancelDownloadQueueTask(taskId);
            await refreshDownloadQueueSnapshot();
          } catch {}
          return;
        }

        if (!options.allowRerun) {
          return;
        }
        const rerunBtn = event.target.closest("button[data-queue-rerun]");
        if (!rerunBtn) {
          return;
        }
        try {
          const taskId = rerunBtn.getAttribute("data-queue-rerun") || "";
          const mode = rerunBtn.getAttribute("data-queue-rerun-mode") || "exact";
          const result = await window.rteDownloader.rerunDownloadQueueTask(taskId, mode);
          if (!result?.ok) {
            throw new Error(result?.error || "Task cannot be rerun.");
          }
          await refreshDownloadQueueSnapshot();
          setSettingsStatus(mode === "current-settings" ? "Queued again with current settings." : "Queued exact retry.");
        } catch (error) {
          setSettingsStatus(`Queue rerun failed: ${error.message}`, true);
        }
      });
    }

    function bindEvents() {
      dom.createCollectionBtn?.addEventListener("click", async () => {
        try {
          const name = String(dom.collectionNameInput?.value || "").trim();
          if (!name) {
            throw new Error("Collection name is required.");
          }
          collectionsState = await window.rteDownloader.createCollection(name);
          if (dom.collectionNameInput) {
            dom.collectionNameInput.value = "";
          }
          if (dom.collectionsSelect && collectionsState[0]?.id) {
            dom.collectionsSelect.value = collectionsState[0].id;
          }
          renderCollections();
          await loadCollectionRecommendations();
          setSettingsStatus("Collection created.");
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.collectionsSelect?.addEventListener("change", () => {
        renderCollections();
        loadCollectionRecommendations().catch((error) => setSettingsStatus(error.message, true));
      });

      dom.deleteCollectionBtn?.addEventListener("click", async () => {
        const collectionId = getSelectedCollectionId();
        if (!collectionId) {
          setSettingsStatus("Select a collection first.", true);
          return;
        }
        try {
          collectionsState = await window.rteDownloader.deleteCollection(collectionId);
          if (dom.collectionsSelect) {
            dom.collectionsSelect.value = collectionsState[0]?.id || "";
          }
          renderCollections();
          await loadCollectionRecommendations();
          setSettingsStatus("Collection deleted.");
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.collectionsRecommendationsRefreshBtn?.addEventListener("click", () => {
        loadCollectionRecommendations({ forceRefresh: true }).catch((error) => setSettingsStatus(error.message, true));
      });

      dom.queuePauseBtn?.addEventListener("click", async () => {
        try {
          await window.rteDownloader.pauseDownloadQueue();
          await refreshDownloadQueueSnapshot();
        } catch {}
      });

      dom.queueResumeBtn?.addEventListener("click", async () => {
        try {
          await window.rteDownloader.resumeDownloadQueue();
          await refreshDownloadQueueSnapshot();
        } catch {}
      });

      dom.queueClearBtn?.addEventListener("click", async () => {
        try {
          await window.rteDownloader.clearPendingDownloadQueue();
          await refreshDownloadQueueSnapshot();
        } catch {}
      });

      dom.queueRecentSourceFilter?.addEventListener("change", () => {
        resetQueueRecentVisibleCount();
        renderRecentQueue(latestQueueSnapshot?.recent || []);
      });
      dom.queueRecentStatusFilter?.addEventListener("change", () => {
        resetQueueRecentVisibleCount();
        renderRecentQueue(latestQueueSnapshot?.recent || []);
      });
      dom.queueRecentSearchInput?.addEventListener("input", () => {
        if (queueSearchTimer) {
          clearTimeout(queueSearchTimer);
        }
        queueSearchTimer = setTimeout(() => {
          queueSearchTimer = null;
          resetQueueRecentVisibleCount();
          renderRecentQueue(latestQueueSnapshot?.recent || []);
        }, 120);
      });
      dom.queueRecentPageSizeSelect?.addEventListener("change", () => {
        resetQueueRecentVisibleCount();
        renderRecentQueue(latestQueueSnapshot?.recent || []);
      });
      dom.queueRecentShowMoreBtn?.addEventListener("click", () => {
        queueRecentVisibleCount += getQueueRecentPageSize();
        renderRecentQueue(latestQueueSnapshot?.recent || []);
      });

      bindQueueActions(dom.downloadQueueActive);
      bindQueueActions(dom.downloadQueuePending);
      bindQueueActions(dom.downloadQueueRecent, { allowRerun: true });

      dom.historySourceFilter?.addEventListener("change", () => {
        resetHistoryVisibleCount();
        renderHistory();
      });
      dom.historyProgramFilter?.addEventListener("change", () => {
        resetHistoryVisibleCount();
        renderHistory();
      });
      dom.historyStatusFilter?.addEventListener("change", () => {
        resetHistoryVisibleCount();
        renderHistory();
      });
      dom.historySearchInput?.addEventListener("input", () => {
        if (historySearchTimer) {
          clearTimeout(historySearchTimer);
        }
        historySearchTimer = setTimeout(() => {
          historySearchTimer = null;
          resetHistoryVisibleCount();
          renderHistory();
        }, 120);
      });
      dom.historyPageSizeSelect?.addEventListener("change", () => {
        resetHistoryVisibleCount();
        renderHistory();
      });
      dom.historyShowMoreBtn?.addEventListener("click", () => {
        historyVisibleCount += getHistoryPageSize();
        renderHistory();
      });
      dom.historyClearBtn?.addEventListener("click", async () => {
        if (!confirm("Clear all download history?")) {
          return;
        }
        await window.rteDownloader.clearDownloadHistory();
        historyAllEntries = [];
        resetHistoryVisibleCount();
        renderHistory();
      });

      dom.feedsRefreshBtn?.addEventListener("click", () => {
        loadFeeds().catch((error) => setSettingsStatus(error.message, true));
      });

      dom.feedsSourceFilter?.addEventListener("change", () => {
        renderFeeds();
      });

      dom.feedsSearchInput?.addEventListener("input", () => {
        if (feedSearchTimer) {
          clearTimeout(feedSearchTimer);
        }
        feedSearchTimer = setTimeout(() => {
          feedSearchTimer = null;
          renderFeeds();
        }, 120);
      });

      dom.metadataIndexSourceFilter?.addEventListener("change", () => {
        Promise.all([loadMetadataIndex(), loadMetadataDiscovery()]).catch((error) => setSettingsStatus(error.message, true));
      });
      dom.metadataIndexKindFilter?.addEventListener("change", () => {
        Promise.all([loadMetadataIndex(), loadMetadataDiscovery()]).catch((error) => setSettingsStatus(error.message, true));
      });
      dom.metadataIndexSearchInput?.addEventListener("input", () => {
        if (metadataSearchTimer) {
          clearTimeout(metadataSearchTimer);
        }
        metadataSearchTimer = setTimeout(() => {
          metadataSearchTimer = null;
          Promise.all([
            loadMetadataIndex(),
            loadMetadataDiscovery()
          ]).catch((error) => setSettingsStatus(error.message, true));
        }, 120);
      });
      dom.entityGraphSourceFilter?.addEventListener("change", () => {
        loadEntityGraph().catch((error) => setSettingsStatus(error.message, true));
      });
      dom.entityGraphTypeFilter?.addEventListener("change", () => {
        loadEntityGraph().catch((error) => setSettingsStatus(error.message, true));
      });
      dom.entityGraphSearchInput?.addEventListener("input", () => {
        if (entityGraphSearchTimer) {
          clearTimeout(entityGraphSearchTimer);
        }
        entityGraphSearchTimer = setTimeout(() => {
          entityGraphSearchTimer = null;
          loadEntityGraph().catch((error) => setSettingsStatus(error.message, true));
        }, 120);
      });
      dom.entityGraphRefreshBtn?.addEventListener("click", () => {
        loadEntityGraph({ forceRefresh: true }).catch((error) => setSettingsStatus(error.message, true));
      });
      dom.metadataHarvestRefreshBtn?.addEventListener("click", async () => {
        try {
          setSettingsStatus("Refreshing harvested discovery metadata...");
          if (typeof window.rteDownloader?.refreshMetadataHarvest === "function") {
            const result = await window.rteDownloader.refreshMetadataHarvest();
            await Promise.all([loadMetadataIndex(), loadMetadataDiscovery({ forceRefresh: true }), loadEntityGraph({ forceRefresh: true })]);
            setSettingsStatus(`Discovery cache refreshed (${Number(result?.count || 0)} harvested items).`);
          } else {
            await Promise.all([loadMetadataIndex(), loadMetadataDiscovery({ forceRefresh: true }), loadEntityGraph({ forceRefresh: true })]);
            setSettingsStatus("Discovery cache refreshed.");
          }
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });
      dom.metadataDiscoveryRefreshBtn?.addEventListener("click", () => {
        loadMetadataDiscovery({ forceRefresh: true }).catch((error) => setSettingsStatus(error.message, true));
      });
      dom.metadataIndexSaveAllBtn?.addEventListener("click", async () => {
        try {
          const result = await handleBatchSave(getVisibleMetadataIndexEntries(), { label: "visible metadata entries" });
          setSettingsStatus(`Saved ${result.addedCount} of ${result.attempted} ${result.label}.`);
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });
      dom.metadataIndexSaveHostsBtn?.addEventListener("click", async () => {
        try {
          const result = await handleBatchSave(getVisibleMetadataIndexEntries("host"), { label: "visible host entries" });
          setSettingsStatus(`Saved ${result.addedCount} of ${result.attempted} ${result.label}.`);
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });
      dom.metadataIndexSaveEpisodesBtn?.addEventListener("click", async () => {
        try {
          const result = await handleBatchSave(getVisibleMetadataIndexEntries("episode"), { label: "visible episode entries" });
          setSettingsStatus(`Saved ${result.addedCount} of ${result.attempted} ${result.label}.`);
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });
      dom.metadataDiscoverySaveAllBtn?.addEventListener("click", async () => {
        try {
          const result = await handleBatchSave(getVisibleMetadataDiscoveryEntries(), { label: "visible discovery entries" });
          setSettingsStatus(`Saved ${result.addedCount} of ${result.attempted} ${result.label}.`);
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });
      dom.metadataDiscoverySaveHostsBtn?.addEventListener("click", async () => {
        try {
          const result = await handleBatchSave(getVisibleMetadataDiscoveryEntries("host"), { label: "visible discovery hosts" });
          setSettingsStatus(`Saved ${result.addedCount} of ${result.attempted} ${result.label}.`);
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });
      dom.metadataDiscoverySaveEpisodesBtn?.addEventListener("click", async () => {
        try {
          const result = await handleBatchSave(getVisibleMetadataDiscoveryEntries("episode"), { label: "visible discovery episodes" });
          setSettingsStatus(`Saved ${result.addedCount} of ${result.attempted} ${result.label}.`);
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.feedsOpenDirBtn?.addEventListener("click", async () => {
        try {
          const firstFeed = Array.isArray(state.libraryFeeds) ? state.libraryFeeds.find((feed) => feed?.jsonPath) : null;
          const targetDir = getPathDirectory(firstFeed?.jsonPath || "") || state.diagnostics?.runtime?.dataDir || "";
          await openTargetPath(targetDir, "No feed export folder is available yet.");
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.metadataIndexList?.addEventListener("click", async (event) => {
        const explorerButton = event.target.closest("[data-open-explorer]");
        if (explorerButton) {
          try {
            await handleOpenExplorerButton(explorerButton);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const saveButton = event.target.closest("[data-save-collection]");
        if (saveButton) {
          try {
            await handleSaveCollectionButton(saveButton);
            setSettingsStatus("Saved to collection.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const copyButton = event.target.closest("[data-metadata-copy-url]");
        if (copyButton) {
          const url = copyButton.getAttribute("data-metadata-copy-url") || "";
          const ok = await copyTextToClipboard(url);
          setSettingsStatus(ok ? "Metadata URL copied." : "No URL available.", !ok);
          return;
        }
        const openFileButton = event.target.closest("[data-metadata-open-file]");
        if (openFileButton) {
          try {
            await openTargetPath(openFileButton.getAttribute("data-metadata-open-file") || "", "No file available.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const openFolderButton = event.target.closest("[data-metadata-open-folder]");
        if (openFolderButton) {
          try {
            await openTargetPath(openFolderButton.getAttribute("data-metadata-open-folder") || "", "No folder available.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
        }
      });

      dom.metadataDiscoveryList?.addEventListener("click", async (event) => {
        const explorerButton = event.target.closest("[data-open-explorer]");
        if (explorerButton) {
          try {
            await handleOpenExplorerButton(explorerButton);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const saveButton = event.target.closest("[data-save-collection]");
        if (saveButton) {
          try {
            await handleSaveCollectionButton(saveButton);
            setSettingsStatus("Saved to collection.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const queryButton = event.target.closest("[data-metadata-use-query]");
        if (queryButton && dom.metadataIndexSearchInput) {
          dom.metadataIndexSearchInput.value = queryButton.getAttribute("data-metadata-use-query") || "";
          await Promise.all([loadMetadataIndex(), loadMetadataDiscovery(), loadEntityGraph()]);
          return;
        }
        const copyButton = event.target.closest("[data-metadata-copy-url]");
        if (copyButton) {
          const url = copyButton.getAttribute("data-metadata-copy-url") || "";
          const ok = await copyTextToClipboard(url);
          setSettingsStatus(ok ? "Discovery URL copied." : "No URL available.", !ok);
        }
      });

      dom.entityGraphList?.addEventListener("click", async (event) => {
        const profileButton = event.target.closest("[data-entity-profile]");
        if (profileButton) {
          try {
            const payload = decodeDataPayload(profileButton.getAttribute("data-entity-profile"));
            await loadEntityProfile(payload);
            setSettingsStatus("Entity profile loaded.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const explorerButton = event.target.closest("[data-open-explorer]");
        if (explorerButton) {
          try {
            await handleOpenExplorerButton(explorerButton);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const saveButton = event.target.closest("[data-save-collection]");
        if (saveButton) {
          try {
            await handleSaveCollectionButton(saveButton);
            setSettingsStatus("Saved entity to collection.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const queryButton = event.target.closest("[data-entity-query]");
        if (queryButton && dom.metadataIndexSearchInput) {
          dom.metadataIndexSearchInput.value = queryButton.getAttribute("data-entity-query") || "";
          if (dom.metadataIndexKindFilter) {
            const type = String(queryButton.getAttribute("data-entity-query-type") || "").trim().toLowerCase();
            dom.metadataIndexKindFilter.value = ["host", "episode"].includes(type) ? type : "";
          }
          await Promise.all([loadMetadataIndex(), loadMetadataDiscovery(), loadEntityGraph()]);
          focusLibrarySection("metadataExplorerSection");
        }
      });

      for (const container of [dom.entityProfileCard, dom.entityProfileRecommendations]) {
        container?.addEventListener("click", async (event) => {
          const bulkButton = event.target.closest("[data-entity-bulk]");
          if (bulkButton) {
            try {
              const entity = entityProfileState?.entity || null;
              if (!entity) {
                throw new Error("No entity is selected.");
              }
              const action = String(bulkButton.getAttribute("data-entity-bulk") || "").trim();
              if (action === "save-programs") {
                const entries = getEntityProfilePrograms(entity);
                const addedCount = await saveEntriesToCollection(entries);
                setSettingsStatus(`Saved ${addedCount} related program${addedCount === 1 ? "" : "s"} to the selected collection.`);
                return;
              }
              if (action === "save-hosts") {
                const entries = getEntityProfileHosts(entity);
                const addedCount = await saveEntriesToCollection(entries);
                setSettingsStatus(`Saved ${addedCount} recommended host${addedCount === 1 ? "" : "s"} to the selected collection.`);
                return;
              }
              if (action === "build-collection") {
                const result = await createCollectionFromEntity(entity);
                setSettingsStatus(`Built collection "${result.name}" with ${result.count} graph-linked entr${result.count === 1 ? "y" : "ies"}.`);
                return;
              }
            } catch (error) {
              setSettingsStatus(error.message, true);
            }
            return;
          }
          const profileButton = event.target.closest("[data-entity-profile]");
          if (profileButton) {
            try {
              const payload = decodeDataPayload(profileButton.getAttribute("data-entity-profile"));
              await loadEntityProfile(payload);
              setSettingsStatus("Entity profile loaded.");
            } catch (error) {
              setSettingsStatus(error.message, true);
            }
            return;
          }
          const explorerButton = event.target.closest("[data-open-explorer]");
          if (explorerButton) {
            try {
              await handleOpenExplorerButton(explorerButton);
            } catch (error) {
              setSettingsStatus(error.message, true);
            }
            return;
          }
          const saveButton = event.target.closest("[data-save-collection]");
          if (saveButton) {
            try {
              await handleSaveCollectionButton(saveButton);
              setSettingsStatus("Saved to collection.");
            } catch (error) {
              setSettingsStatus(error.message, true);
            }
            return;
          }
          const queryButton = event.target.closest("[data-entity-query]");
          if (queryButton && dom.metadataIndexSearchInput) {
            dom.metadataIndexSearchInput.value = queryButton.getAttribute("data-entity-query") || "";
            if (dom.metadataIndexKindFilter) {
              const type = String(queryButton.getAttribute("data-entity-query-type") || "").trim().toLowerCase();
              dom.metadataIndexKindFilter.value = ["host", "episode"].includes(type) ? type : "";
            }
            await Promise.all([loadMetadataIndex(), loadMetadataDiscovery(), loadEntityGraph()]);
            focusLibrarySection("metadataExplorerSection");
          }
        });
      }

      for (const facetContainer of [dom.metadataDiscoveryHosts, dom.metadataDiscoveryGenres, dom.metadataDiscoveryLocations]) {
        facetContainer?.addEventListener("click", async (event) => {
          const button = event.target.closest("[data-metadata-facet]");
          if (!button || !dom.metadataIndexSearchInput) {
            return;
          }
          dom.metadataIndexSearchInput.value = button.getAttribute("data-metadata-facet") || "";
          await Promise.all([loadMetadataIndex(), loadMetadataDiscovery(), loadEntityGraph()]);
        });
      }

      dom.feedsList?.addEventListener("click", async (event) => {
        const explorerButton = event.target.closest("[data-open-explorer]");
        if (explorerButton) {
          try {
            await handleOpenExplorerButton(explorerButton);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const saveButton = event.target.closest("[data-save-collection]");
        if (saveButton) {
          try {
            await handleSaveCollectionButton(saveButton);
            setSettingsStatus("Saved to collection.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const copyButton = event.target.closest("[data-feed-copy]");
        if (copyButton) {
          const url = copyButton.getAttribute("data-feed-copy") || "";
          await copyTextToClipboard(url);
          setSettingsStatus(url ? "RSS link copied." : "No RSS link available.", !url);
          return;
        }
        const openButton = event.target.closest("[data-feed-open]");
        if (!openButton) {
          return;
        }
        try {
          await openTargetPath(openButton.getAttribute("data-feed-open") || "", "No feed file is available yet.");
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.historyList?.addEventListener("click", async (event) => {
        const explorerButton = event.target.closest("[data-open-explorer]");
        if (explorerButton) {
          try {
            await handleOpenExplorerButton(explorerButton);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const saveButton = event.target.closest("[data-save-collection]");
        if (saveButton) {
          try {
            await handleSaveCollectionButton(saveButton);
            setSettingsStatus("Saved to collection.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const button = event.target.closest("[data-history-action]");
        if (!button) {
          return;
        }
        const entry = getHistoryEntry(button.getAttribute("data-history-id"));
        if (!entry) {
          setSettingsStatus("History entry not found.", true);
          return;
        }
        try {
          const action = button.getAttribute("data-history-action");
          if (action === "play") {
            await playFromDownloadedFile({
              outputDir: entry.outputDir,
              fileName: entry.fileName,
              title: entry.episodeTitle || "",
              source: getSourceLabel(entry.sourceType || ""),
              subtitle: entry.programTitle || "",
              episodeUrl: entry.episodeUrl || "",
              sourceType: entry.sourceType || ""
            });
            return;
          }
          if (action === "open-folder") {
            await openTargetPath(entry.outputDir, "No download folder is available.");
            return;
          }
          if (action === "open-file") {
            await openTargetPath(entry.filePath, "No downloaded file is available.");
            return;
          }
          if (action === "postprocess") {
            setSettingsStatus(`Rebuilding tags/chapters for ${entry.episodeTitle || entry.fileName || "file"}...`);
            const result = await rebuildHistoryEntryMetadata(entry);
            if (Array.isArray(result?.cue?.chapters) && result.cue.chapters.length) {
              setSettingsStatus(`Rebuilt tags and ${result.cue.chapters.length} embedded chapter(s) for ${entry.episodeTitle || entry.fileName || "file"}.`);
            } else {
              setSettingsStatus(`Rebuilt tags for ${entry.episodeTitle || entry.fileName || "file"}.`);
            }
            return;
          }
          if (action === "redownload") {
            await redownloadHistoryEntry(entry);
            setSettingsStatus(`Queued ${entry.episodeTitle || "history entry"} for download.`);
            await refreshDownloadQueueSnapshot();
          }
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.collectionsList?.addEventListener("click", async (event) => {
        const profileButton = event.target.closest("[data-entity-profile]");
        if (profileButton) {
          try {
            const payload = decodeDataPayload(profileButton.getAttribute("data-entity-profile"));
            await loadEntityProfile(payload);
            setSettingsStatus("Entity profile loaded.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const explorerButton = event.target.closest("[data-open-explorer]");
        if (explorerButton) {
          try {
            await handleOpenExplorerButton(explorerButton);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const removeButton = event.target.closest("[data-collection-entry-remove]");
        if (!removeButton) {
          return;
        }
        try {
          collectionsState = await window.rteDownloader.removeCollectionEntry(getSelectedCollectionId(), removeButton.getAttribute("data-collection-entry-remove") || "");
          renderCollections();
          await loadCollectionRecommendations();
          setSettingsStatus("Collection entry removed.");
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.collectionsRecommendationsList?.addEventListener("click", async (event) => {
        const profileButton = event.target.closest("[data-entity-profile]");
        if (profileButton) {
          try {
            const payload = decodeDataPayload(profileButton.getAttribute("data-entity-profile"));
            await loadEntityProfile(payload);
            setSettingsStatus("Entity profile loaded.");
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const explorerButton = event.target.closest("[data-open-explorer]");
        if (explorerButton) {
          try {
            await handleOpenExplorerButton(explorerButton);
          } catch (error) {
            setSettingsStatus(error.message, true);
          }
          return;
        }
        const saveButton = event.target.closest("[data-save-collection]");
        if (!saveButton) {
          return;
        }
        try {
          await handleSaveCollectionButton(saveButton);
          setSettingsStatus("Saved to collection.");
        } catch (error) {
          setSettingsStatus(error.message, true);
        }
      });

      dom.diagnosticsRefreshBtn?.addEventListener("click", () => {
        loadDiagnostics().catch(() => {});
      });

      dom.diagnosticsRepairBtn?.addEventListener("click", async () => {
        if (typeof window.rteDownloader?.repairBinaries !== "function") {
          setDiagnosticsStatus("Binary repair is not available in this mode.", true);
          return;
        }
        setDiagnosticsStatus("Running vendor bootstrap. This can take a minute...");
        dom.diagnosticsRepairBtn.disabled = true;
        try {
          const result = await window.rteDownloader.repairBinaries();
          const output = String(result?.output || "").trim();
          setDiagnosticsStatus(result?.ok ? "Vendor bootstrap completed." : (output || result?.error || "Vendor bootstrap failed."), !result?.ok);
          await loadDiagnostics();
        } catch (error) {
          setDiagnosticsStatus(error.message, true);
        } finally {
          dom.diagnosticsRepairBtn.disabled = false;
        }
      });

      dom.diagnosticsOpenDownloadDirBtn?.addEventListener("click", async () => {
        try {
          await openTargetPath(state.diagnostics?.runtime?.downloadDir || "", "Download directory is not configured.");
        } catch (error) {
          setDiagnosticsStatus(error.message, true);
        }
      });

      dom.diagnosticsOpenDataDirBtn?.addEventListener("click", async () => {
        try {
          await openTargetPath(state.diagnostics?.runtime?.dataDir || "", "Data directory is not available.");
        } catch (error) {
          setDiagnosticsStatus(error.message, true);
        }
      });

      dom.diagnosticsBinaries?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-diagnostics-open]");
        if (!button) {
          return;
        }
        try {
          await openTargetPath(button.getAttribute("data-diagnostics-open") || "", "Binary path is not available.");
        } catch (error) {
          setDiagnosticsStatus(error.message, true);
        }
      });
    }

    bindEvents();

    return {
      loadFeeds,
      renderFeeds,
      loadDiagnostics,
      renderDiagnostics,
      refreshLibraryData,
      loadHistory,
      renderHistory,
      refreshDownloadQueueSnapshot,
      renderQueueSnapshot
    };
  }

  window.KimbleLibraryScreen = {
    create: createLibraryScreen
  };
})();
