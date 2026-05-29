(function initKimbleStatsScreen() {
  function createStatsScreen(deps) {
    const dom = deps.dom || {};
    const escapeHtml = deps.escapeHtml;
    const sourceLabels = deps.sourceLabels || {};
    const formatLocalDateTime = deps.formatLocalDateTime || ((value) => String(value || ""));
    const sourceKeys = ["rte", "bbc", "wwf", "nts", "fip", "kexp"];
    let loadingPromise = null;

    function getSourceLabel(sourceKey) {
      const key = String(sourceKey || "").trim().toLowerCase();
      return sourceLabels[key] || key.toUpperCase() || "MEDIA";
    }

    function normalizeList(payload, key) {
      if (Array.isArray(payload)) {
        return payload;
      }
      if (Array.isArray(payload?.[key])) {
        return payload[key];
      }
      return [];
    }

    function toTimestamp(value) {
      const ts = Date.parse(String(value || ""));
      return Number.isFinite(ts) ? ts : 0;
    }

    function getStatusTone(status) {
      const text = String(status || "").toLowerCase();
      if (text === "ok" || text === "loaded" || text === "healthy") {
        return "ok";
      }
      if (text === "timeout" || text === "degraded" || text.includes("warn")) {
        return "warn";
      }
      if (text.includes("fail") || text.includes("error")) {
        return "danger";
      }
      return "neutral";
    }

    function timeoutAfter(ms, fallback) {
      return new Promise((resolve) => setTimeout(() => resolve(fallback), ms));
    }

    async function withTimeout(fn, fallback, ms = 3500) {
      if (typeof fn !== "function") {
        return fallback;
      }
      try {
        return await Promise.race([
          Promise.resolve().then(fn),
          timeoutAfter(ms, fallback)
        ]);
      } catch {
        return fallback;
      }
    }

    function renderLoading() {
      if (dom.summary) {
        dom.summary.textContent = "Loading stats...";
      }
      if (dom.metrics) {
        dom.metrics.innerHTML = sourceKeys.slice(0, 4).map(() => `
          <div class="library-metric-card stats-skeleton-card">
            <div class="stats-skeleton-line short"></div>
            <div class="stats-skeleton-line large"></div>
            <div class="stats-skeleton-line"></div>
          </div>
        `).join("");
      }
      if (dom.sourceStatus) {
        dom.sourceStatus.innerHTML = sourceKeys.map((key) => `
          <span class="status-chip status-chip-neutral stats-source-chip">
            <span class="stats-chip-dot"></span>${escapeHtml(getSourceLabel(key))}
          </span>
        `).join("");
      }
      if (dom.sourceChart) {
        dom.sourceChart.innerHTML = `<div class="item muted">Loading source mix...</div>`;
      }
      if (dom.sourceTable) {
        dom.sourceTable.innerHTML = `<div class="item muted">Loading table...</div>`;
      }
      if (dom.recentDownloads) {
        dom.recentDownloads.innerHTML = `<div class="item muted">Loading recent downloads...</div>`;
      }
      if (dom.systemSignals) {
        dom.systemSignals.innerHTML = `<div class="item muted">Loading signals...</div>`;
      }
    }

    async function loadScheduleResult(sourceKey) {
      const methodBySource = {
        rte: "listSchedules",
        bbc: "listBbcSchedules",
        wwf: "listWwfSchedules",
        nts: "listNtsSchedules",
        fip: "listFipSchedules",
        kexp: "listKexpSchedules"
      };
      const methodName = methodBySource[sourceKey];
      const fallback = { sourceKey, rows: [], status: "timeout" };
      const result = await withTimeout(async () => {
        const rows = await window.rteDownloader?.[methodName]?.();
        return {
          sourceKey,
          rows: Array.isArray(rows) ? rows : [],
          status: Array.isArray(rows) ? "ok" : "degraded"
        };
      }, fallback, 2500);
      return result || fallback;
    }

    async function collectStatsData() {
      const [historyPayload, feedPayload, queuePayload, diagnostics, scheduleResults] = await Promise.all([
        withTimeout(() => window.rteDownloader?.listDownloadHistory?.(), { history: [] }, 3500),
        withTimeout(() => window.rteDownloader?.listProgramFeeds?.(), { feeds: [] }, 3500),
        withTimeout(() => window.rteDownloader?.getDownloadQueueSnapshot?.(), {}, 3500),
        withTimeout(() => window.rteDownloader?.getDiagnostics?.(), {}, 3500),
        Promise.all(sourceKeys.map((sourceKey) => loadScheduleResult(sourceKey)))
      ]);
      return {
        history: normalizeList(historyPayload, "history"),
        feeds: normalizeList(feedPayload, "feeds"),
        queue: queuePayload || {},
        diagnostics: diagnostics || {},
        scheduleResults
      };
    }

    function countBySource(rows) {
      const counts = Object.fromEntries(sourceKeys.map((key) => [key, 0]));
      for (const row of rows) {
        const sourceKey = String(row?.sourceType || row?._source || "").trim().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(counts, sourceKey)) {
          counts[sourceKey] += 1;
        }
      }
      return counts;
    }

    function buildSourceRows(data) {
      const historyCounts = countBySource(data.history);
      const feedCounts = countBySource(data.feeds);
      const scheduleBySource = new Map((data.scheduleResults || []).map((entry) => [entry.sourceKey, entry]));
      return sourceKeys.map((sourceKey) => {
        const scheduleResult = scheduleBySource.get(sourceKey) || { rows: [], status: "degraded" };
        const schedules = Array.isArray(scheduleResult.rows) ? scheduleResult.rows : [];
        const failures = schedules.filter((schedule) => /fail|error/i.test(String(schedule?.lastStatus || ""))).length;
        return {
          sourceKey,
          label: getSourceLabel(sourceKey),
          downloads: historyCounts[sourceKey] || 0,
          schedules: schedules.length,
          feeds: feedCounts[sourceKey] || 0,
          failures,
          status: scheduleResult.status || "degraded"
        };
      });
    }

    function renderMetrics(data, sourceRows) {
      if (!dom.metrics) {
        return;
      }
      const active = Array.isArray(data.queue?.active) ? data.queue.active.length : 0;
      const pending = Array.isArray(data.queue?.pending) ? data.queue.pending.length : 0;
      const parserWarnings = Array.isArray(data.diagnostics?.parserWarnings) ? data.diagnostics.parserWarnings.length : 0;
      const subscriptions = sourceRows.reduce((sum, row) => sum + row.schedules, 0);
      const metrics = [
        { label: "Downloads", value: data.history.length, detail: "History entries", tone: "neutral" },
        { label: "Subscriptions", value: subscriptions, detail: "Across all sources", tone: subscriptions ? "ok" : "neutral" },
        { label: "Queue", value: active + pending, detail: `${active} active, ${pending} pending`, tone: active || pending ? "warn" : "neutral" },
        { label: "Parser Warnings", value: parserWarnings, detail: "Current session", tone: parserWarnings ? "warn" : "ok" }
      ];
      dom.metrics.innerHTML = metrics.map((metric) => `
        <div class="library-metric-card library-metric-${escapeHtml(metric.tone)}">
          <div class="library-metric-label">${escapeHtml(metric.label)}</div>
          <div class="library-metric-value">${escapeHtml(String(metric.value))}</div>
          <div class="library-metric-detail">${escapeHtml(metric.detail)}</div>
        </div>
      `).join("");
    }

    function renderSourceStatus(sourceRows) {
      if (!dom.sourceStatus) {
        return;
      }
      dom.sourceStatus.innerHTML = sourceRows.map((row) => {
        const tone = getStatusTone(row.status);
        return `<span class="status-chip status-chip-${escapeHtml(tone)} stats-source-chip">
          ${escapeHtml(row.label)} ${escapeHtml(row.status)}
        </span>`;
      }).join("");
    }

    function renderSourceChart(sourceRows) {
      if (!dom.sourceChart) {
        return;
      }
      const maxDownloads = Math.max(1, ...sourceRows.map((row) => row.downloads));
      dom.sourceChart.innerHTML = sourceRows.map((row) => {
        const pct = Math.max(4, Math.round((row.downloads / maxDownloads) * 100));
        return `<div class="stats-bar-row">
          <div class="stats-bar-label"><span class="source-badge source-badge-${escapeHtml(row.sourceKey)}">${escapeHtml(row.label)}</span></div>
          <div class="stats-bar-track"><div class="stats-bar-fill stats-bar-${escapeHtml(row.sourceKey)}" style="width:${escapeHtml(String(pct))}%;"></div></div>
          <div class="stats-bar-value">${escapeHtml(String(row.downloads))}</div>
        </div>`;
      }).join("");
    }

    function renderSourceTable(sourceRows) {
      if (!dom.sourceTable) {
        return;
      }
      dom.sourceTable.innerHTML = `
        <table class="stats-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Downloads</th>
              <th>Subscriptions</th>
              <th>Feeds</th>
              <th>Failures</th>
            </tr>
          </thead>
          <tbody>
            ${sourceRows.map((row) => `
              <tr>
                <td><span class="source-badge source-badge-${escapeHtml(row.sourceKey)}">${escapeHtml(row.label)}</span></td>
                <td>${escapeHtml(String(row.downloads))}</td>
                <td>${escapeHtml(String(row.schedules))}</td>
                <td>${escapeHtml(String(row.feeds))}</td>
                <td>${escapeHtml(String(row.failures))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    function renderRecentDownloads(history) {
      if (!dom.recentDownloads) {
        return;
      }
      const rows = [...history].sort((a, b) => toTimestamp(b.completedAt || b.timestamp || b.createdAt) - toTimestamp(a.completedAt || a.timestamp || a.createdAt)).slice(0, 8);
      if (!rows.length) {
        dom.recentDownloads.innerHTML = `<div class="item muted">No downloads yet.</div>`;
        return;
      }
      dom.recentDownloads.innerHTML = rows.map((entry) => {
        const sourceKey = String(entry.sourceType || "").trim().toLowerCase();
        const title = entry.episodeTitle || entry.title || entry.fileName || "Download";
        const program = entry.programTitle || entry.showName || "";
        const when = formatLocalDateTime(entry.completedAt || entry.timestamp || entry.createdAt || "");
        return `<div class="item">
          <div class="item-title"><span class="source-badge source-badge-${escapeHtml(sourceKey)}">${escapeHtml(getSourceLabel(sourceKey))}</span> ${escapeHtml(title)}</div>
          ${program ? `<div class="item-meta">${escapeHtml(program)}</div>` : ""}
          ${when ? `<div class="item-meta">${escapeHtml(when)}</div>` : ""}
        </div>`;
      }).join("");
    }

    function renderSystemSignals(data, sourceRows) {
      if (!dom.systemSignals) {
        return;
      }
      const parserWarnings = Array.isArray(data.diagnostics?.parserWarnings) ? data.diagnostics.parserWarnings : [];
      const degradedSources = sourceRows.filter((row) => row.status !== "ok");
      const recentErrors = Array.isArray(data.diagnostics?.recentErrors) ? data.diagnostics.recentErrors : [];
      const rows = [
        { label: "Schedule loaders", value: degradedSources.length ? `${degradedSources.length} degraded` : "Healthy", tone: degradedSources.length ? "warn" : "ok" },
        { label: "Parser fallbacks", value: parserWarnings.length ? `${parserWarnings.length} warning${parserWarnings.length === 1 ? "" : "s"}` : "None", tone: parserWarnings.length ? "warn" : "ok" },
        { label: "Recent errors", value: recentErrors.length ? String(recentErrors.length) : "None", tone: recentErrors.length ? "danger" : "ok" }
      ];
      dom.systemSignals.innerHTML = rows.map((row) => `
        <div class="item">
          <div class="item-title">${escapeHtml(row.label)} <span class="status-chip status-chip-${escapeHtml(row.tone)}">${escapeHtml(row.value)}</span></div>
        </div>
      `).join("");
    }

    async function loadStats({ force = false } = {}) {
      if (loadingPromise && !force) {
        return loadingPromise;
      }
      renderLoading();
      loadingPromise = collectStatsData()
        .then((data) => {
          const sourceRows = buildSourceRows(data);
          const loadedSources = sourceRows.filter((row) => row.status === "ok").length;
          if (dom.summary) {
            dom.summary.textContent = `${data.history.length} downloads, ${sourceRows.reduce((sum, row) => sum + row.schedules, 0)} subscriptions, ${loadedSources} of ${sourceKeys.length} sources loaded.`;
          }
          renderMetrics(data, sourceRows);
          renderSourceStatus(sourceRows);
          renderSourceChart(sourceRows);
          renderSourceTable(sourceRows);
          renderRecentDownloads(data.history);
          renderSystemSignals(data, sourceRows);
        })
        .catch((error) => {
          if (dom.summary) {
            dom.summary.textContent = "Stats load failed.";
          }
          if (dom.sourceChart) {
            dom.sourceChart.innerHTML = `<div class="item error">${escapeHtml(String(error?.message || error || "Unknown error"))}</div>`;
          }
        })
        .finally(() => {
          loadingPromise = null;
        });
      return loadingPromise;
    }

    function bindEvents() {
      dom.refreshBtn?.addEventListener("click", () => {
        loadStats({ force: true }).catch(() => {});
      });
    }

    bindEvents();

    return { loadStats };
  }

  window.KimbleStatsScreen = {
    create: createStatsScreen
  };
})();
