(function initKimbleSchedulesScreen() {
  function createSchedulesScreen(deps) {
    const dom = deps.dom || {};
    const escapeHtml = deps.escapeHtml;
    const renderSchedulerCard = deps.renderSchedulerCard;
    const playFromDownloadedFile = deps.playFromDownloadedFile;
    const sourceLabels = deps.sourceLabels || {};
    const openProgramExplorer = deps.openProgramExplorer;
    const onHealthSourceNavigate = deps.onHealthSourceNavigate;
    let latestTaggedSchedules = [];
    let searchTimer = null;

    function getSourceLabel(sourceKey) {
      const key = String(sourceKey || "").trim().toLowerCase();
      return sourceLabels[key] || key.toUpperCase() || "MEDIA";
    }

    function scheduleNeedsAttention(schedule) {
      const retryPending = Array.isArray(schedule?.retryQueue) ? schedule.retryQueue.length : 0;
      if (retryPending > 0) {
        return true;
      }
      const status = String(schedule?.lastStatus || "").toLowerCase();
      return status.includes("failed") || status.includes("error");
    }

    function toTimestamp(value) {
      const time = Date.parse(String(value || ""));
      return Number.isFinite(time) ? time : 0;
    }

    function buildSchedulesSummary(rows, visibleRows) {
      const total = rows.length;
      const visible = visibleRows.length;
      const enabledCount = rows.filter((schedule) => schedule.enabled !== false).length;
      const pausedCount = rows.filter((schedule) => schedule.enabled === false).length;
      const attentionCount = rows.filter((schedule) => scheduleNeedsAttention(schedule)).length;
      const segments = [
        `${visible} of ${total} subscription${total === 1 ? "" : "s"}`
      ];
      if (enabledCount > 0) {
        segments.push(`${enabledCount} enabled`);
      }
      if (pausedCount > 0) {
        segments.push(`${pausedCount} paused`);
      }
      if (attentionCount > 0) {
        segments.push(`${attentionCount} need attention`);
      }
      return segments.join(" • ");
    }

    function countDueSoon(rows, hours = 24) {
      const now = Date.now();
      const horizon = now + (hours * 60 * 60 * 1000);
      return rows.filter((schedule) => {
        const ts = toTimestamp(schedule?.nextBroadcastAt);
        return ts > now && ts <= horizon;
      }).length;
    }

    function countFailedRecently(rows, days = 7) {
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      return rows.filter((schedule) => {
        const status = String(schedule?.lastStatus || "").toLowerCase();
        const failed = status.includes("failed") || status.includes("error");
        return failed && toTimestamp(schedule?.lastRunAt || schedule?.lastCheckedAt) >= cutoff;
      }).length;
    }

    function renderSchedulesMetrics(rows) {
      if (!dom.allSchedulesMetrics) {
        return;
      }
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        dom.allSchedulesMetrics.innerHTML = "";
        return;
      }
      const paused = list.filter((schedule) => schedule.enabled === false).length;
      const dueSoon = countDueSoon(list, 24);
      const failedRecently = countFailedRecently(list, 7);
      const metrics = [
        { label: "Due Soon", value: dueSoon, tone: dueSoon > 0 ? "warn" : "neutral", detail: "Next 24h" },
        { label: "Failed Recently", value: failedRecently, tone: failedRecently > 0 ? "danger" : "neutral", detail: "Last 7 days" },
        { label: "Paused", value: paused, tone: paused > 0 ? "warn" : "neutral", detail: "Visible set" }
      ];
      dom.allSchedulesMetrics.innerHTML = metrics.map((metric) => `
        <div class="library-metric-card library-metric-${escapeHtml(metric.tone)}">
          <div class="library-metric-label">${escapeHtml(metric.label)}</div>
          <div class="library-metric-value">${escapeHtml(String(metric.value))}</div>
          <div class="library-metric-detail">${escapeHtml(metric.detail)}</div>
        </div>
      `).join("");
    }

    function buildScheduleSearchText(schedule) {
      return [
        schedule?.title,
        schedule?.latestEpisodeTitle,
        schedule?.latestEpisodeDescription,
        schedule?.latestEpisodeLocation,
        Array.isArray(schedule?.latestEpisodeGenres) ? schedule.latestEpisodeGenres.join(" ") : "",
        Array.isArray(schedule?.latestEpisodeHosts) ? schedule.latestEpisodeHosts.join(" ") : "",
        schedule?.lastStatus,
        schedule?.nextBroadcastTitle,
        schedule?._source,
        schedule?.description,
        schedule?.location,
        Array.isArray(schedule?.genres) ? schedule.genres.join(" ") : "",
        Array.isArray(schedule?.hosts) ? schedule.hosts.join(" ") : "",
        Array.isArray(schedule?.hostHistory) ? schedule.hostHistory.join(" ") : ""
      ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean).join(" ");
    }

    function getVisibleSchedules() {
      const search = String(dom.allSchedulesSearchInput?.value || "").trim().toLowerCase();
      const sourceFilter = String(dom.allSchedulesSourceFilter?.value || "").trim().toLowerCase();
      const statusFilter = String(dom.allSchedulesStatusFilter?.value || "").trim().toLowerCase();
      const sortBy = String(dom.allSchedulesSort?.value || "next-broadcast").trim().toLowerCase();
      let rows = Array.isArray(latestTaggedSchedules) ? [...latestTaggedSchedules] : [];

      if (search) {
        rows = rows.filter((schedule) => buildScheduleSearchText(schedule).includes(search));
      }

      if (sourceFilter) {
        rows = rows.filter((schedule) => String(schedule._source || "").trim().toLowerCase() === sourceFilter);
      }

      if (statusFilter === "enabled") {
        rows = rows.filter((schedule) => schedule.enabled !== false);
      } else if (statusFilter === "paused") {
        rows = rows.filter((schedule) => schedule.enabled === false);
      } else if (statusFilter === "attention") {
        rows = rows.filter((schedule) => scheduleNeedsAttention(schedule));
      }

      rows.sort((a, b) => {
        if (sortBy === "title") {
          return String(a.title || "").localeCompare(String(b.title || ""));
        }
        if (sortBy === "last-run") {
          return toTimestamp(b.lastRunAt) - toTimestamp(a.lastRunAt) || String(a.title || "").localeCompare(String(b.title || ""));
        }
        const aNext = toTimestamp(a.nextBroadcastAt);
        const bNext = toTimestamp(b.nextBroadcastAt);
        if (aNext && bNext) {
          return aNext - bNext || String(a.title || "").localeCompare(String(b.title || ""));
        }
        if (aNext) {
          return -1;
        }
        if (bNext) {
          return 1;
        }
        return String(a.title || "").localeCompare(String(b.title || ""));
      });

      return rows;
    }

    function renderVisibleSchedules() {
      if (!dom.allSchedulesList) {
        return;
      }
      const compactMode = String(dom.allSchedulesViewMode?.value || "full") === "compact";
      dom.allSchedulesList.classList.toggle("subscriptions-compact", compactMode);
      const visibleRows = getVisibleSchedules();
      renderSchedulesMetrics(visibleRows);
      if (dom.allSchedulesSummary) {
        const totalRows = Array.isArray(latestTaggedSchedules) ? latestTaggedSchedules : [];
        dom.allSchedulesSummary.textContent = totalRows.length
          ? buildSchedulesSummary(totalRows, visibleRows)
          : "No subscriptions yet across any source.";
      }
      if (!visibleRows.length) {
        dom.allSchedulesList.innerHTML = `<div class="item">No subscriptions match the current filters.</div>`;
        return;
      }
      dom.allSchedulesList.innerHTML = visibleRows.map((schedule) => {
        const sourceKey = schedule._source;
        const card = renderSchedulerCard(schedule, sourceKey);
        return card.replace(
          `<div class="item-title">${escapeHtml(schedule.title || "Program")}`,
          `<div class="item-title"><span class="source-badge source-badge-${escapeHtml(sourceKey)}">${escapeHtml(getSourceLabel(sourceKey))}</span> ${escapeHtml(schedule.title || "Program")}`
        );
      }).join("");
    }

    function renderHealthDashboard(schedulesMap) {
      if (!dom.healthGrid) {
        return;
      }
      const sources = [
        { key: "rte", name: getSourceLabel("rte") },
        { key: "bbc", name: getSourceLabel("bbc") },
        { key: "wwf", name: "Worldwide FM" },
        { key: "nts", name: getSourceLabel("nts") },
        { key: "fip", name: getSourceLabel("fip") },
        { key: "kexp", name: getSourceLabel("kexp") }
      ];
      dom.healthGrid.innerHTML = sources.map(({ key, name }) => {
        const schedules = schedulesMap[key] || [];
        const count = schedules.length;
        const retries = schedules.reduce((sum, schedule) => sum + (schedule.retryQueue?.length || 0), 0);
        const lastRun = schedules.map((schedule) => schedule.lastRunAt).filter(Boolean).sort().pop();
        let dotClass = "health-dot-grey";
        if (count > 0) {
          dotClass = retries > 0 ? "health-dot-yellow" : "health-dot-green";
        }
        const lastRunStr = lastRun ? new Date(lastRun).toLocaleDateString() : "Never";
        return `<div class="health-card health-card-interactive" role="button" tabindex="0" data-health-source="${escapeHtml(key)}" title="Open Subscriptions filtered to ${escapeHtml(name)}">
          <div class="health-card-name"><span class="health-dot ${dotClass}"></span>${escapeHtml(name)}</div>
          <div class="health-card-meta">${count} schedule${count !== 1 ? "s" : ""}</div>
          <div class="health-card-meta">Last run: ${escapeHtml(lastRunStr)}</div>
          ${retries > 0 ? `<div class="health-card-meta" style="color:#f1c40f;">${retries} retry${retries !== 1 ? "s" : ""} pending</div>` : ""}
        </div>`;
      }).join("");
    }

    async function renderAllSchedules() {
      if (!dom.allSchedulesList) {
        return;
      }
      dom.allSchedulesList.innerHTML = `<div class="item muted">Loading...</div>`;
      try {
        const [rte, bbc, wwf, nts, fip, kexp] = await Promise.all([
          window.rteDownloader?.listSchedules?.().catch(() => []),
          window.rteDownloader?.listBbcSchedules?.().catch(() => []),
          window.rteDownloader?.listWwfSchedules?.().catch(() => []),
          window.rteDownloader?.listNtsSchedules?.().catch(() => []),
          window.rteDownloader?.listFipSchedules?.().catch(() => []),
          window.rteDownloader?.listKexpSchedules?.().catch(() => [])
        ]);
        renderHealthDashboard({ rte: rte || [], bbc: bbc || [], wwf: wwf || [], nts: nts || [], fip: fip || [], kexp: kexp || [] });
        const tagged = [
          ...(rte || []).map((schedule) => ({ ...schedule, _source: "rte" })),
          ...(bbc || []).map((schedule) => ({ ...schedule, _source: "bbc" })),
          ...(wwf || []).map((schedule) => ({ ...schedule, _source: "wwf" })),
          ...(nts || []).map((schedule) => ({ ...schedule, _source: "nts" })),
          ...(fip || []).map((schedule) => ({ ...schedule, _source: "fip" })),
          ...(kexp || []).map((schedule) => ({ ...schedule, _source: "kexp" }))
        ];
        latestTaggedSchedules = tagged;
        if (!tagged.length) {
          if (dom.allSchedulesSummary) {
            dom.allSchedulesSummary.textContent = "No subscriptions yet across any source.";
          }
          dom.allSchedulesList.innerHTML = `<div class="item">No schedules yet across any source.</div>`;
          return;
        }
        renderVisibleSchedules();
      } catch (error) {
        latestTaggedSchedules = [];
        if (dom.allSchedulesSummary) {
          dom.allSchedulesSummary.textContent = "Subscription load failed.";
        }
        dom.allSchedulesList.innerHTML = `<div class="item error">${escapeHtml(String(error?.message || error || "Unknown error"))}</div>`;
      }
    }

    function bindEvents() {
      dom.refreshAllSchedulesBtn?.addEventListener("click", () => {
        renderAllSchedules().catch(() => {});
      });

      dom.allSchedulesSearchInput?.addEventListener("input", () => {
        if (searchTimer) {
          clearTimeout(searchTimer);
        }
        searchTimer = setTimeout(() => {
          searchTimer = null;
          renderVisibleSchedules();
        }, 120);
      });
      dom.allSchedulesViewMode?.addEventListener("change", renderVisibleSchedules);
      dom.allSchedulesSourceFilter?.addEventListener("change", renderVisibleSchedules);
      dom.allSchedulesStatusFilter?.addEventListener("change", renderVisibleSchedules);
      dom.allSchedulesSort?.addEventListener("change", renderVisibleSchedules);

      function activateHealthSource(sourceKey) {
        const key = String(sourceKey || "").trim().toLowerCase();
        if (!key || typeof onHealthSourceNavigate !== "function") {
          return;
        }
        onHealthSourceNavigate(key);
      }

      dom.healthGrid?.addEventListener("click", (event) => {
        const card = event.target.closest("[data-health-source]");
        if (!card) {
          return;
        }
        activateHealthSource(card.getAttribute("data-health-source"));
      });
      dom.healthGrid?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        const card = event.target.closest("[data-health-source]");
        if (!card) {
          return;
        }
        event.preventDefault();
        activateHealthSource(card.getAttribute("data-health-source"));
      });

      dom.allSchedulesList?.addEventListener("click", async (event) => {
        const openProgramBtn = event.target.closest("[data-schedule-open-program]");
        if (openProgramBtn) {
          const url = String(openProgramBtn.getAttribute("data-schedule-open-program") || "").trim();
          if (url && typeof window.rteDownloader?.openExternalUrl === "function") {
            try {
              await window.rteDownloader.openExternalUrl(url);
            } catch (error) {
              window.console?.error?.(error);
            }
          }
          return;
        }

        const button = event.target.closest("button");
        if (!button) {
          return;
        }

        const card = button.closest(".scheduler-card");
        const getStatusEl = (attr) => card?.querySelector(`[${attr}]`);
        const sourcePrefixes = ["", "bbc-", "wwf-", "nts-", "fip-", "kexp-"];

        for (const prefix of sourcePrefixes) {
          const openAttr = `data-${prefix}schedule-open-explorer`;
          const openBtn = button.matches(`[${openAttr}]`) ? button : null;
          if (openBtn) {
            try {
              await openProgramExplorer?.({
                sourceType: prefix.replace("-", "") || "rte",
                programUrl: openBtn.getAttribute(openAttr) || ""
              });
            } catch {}
            return;
          }

          const playAttr = `data-${prefix}schedule-play-output`;
          const playBtn = button.matches(`[${playAttr}]`) ? button : null;
          if (!playBtn) {
            continue;
          }
          try {
            await playFromDownloadedFile({
              outputDir: playBtn.getAttribute(playAttr),
              fileName: playBtn.getAttribute(`data-${prefix}schedule-play-file`),
              title: playBtn.getAttribute(`data-${prefix}schedule-play-title`) || "",
              source: "Local",
              subtitle: "Latest scheduled download",
              image: playBtn.getAttribute(`data-${prefix}schedule-play-image`) || "",
              episodeUrl: playBtn.getAttribute(`data-${prefix}schedule-play-episode-url`) || "",
              sourceType: playBtn.getAttribute(`data-${prefix}schedule-play-source-type`) || prefix.replace("-", "") || "rte"
            });
          } catch {}
          return;
        }

        const sourceMap = {
          "": { toggle: "setScheduleEnabled", run: "runScheduleNow", remove: "removeSchedule" },
          "bbc-": { toggle: "setBbcScheduleEnabled", run: "runBbcScheduleNow", remove: "removeBbcSchedule" },
          "wwf-": { toggle: "setWwfScheduleEnabled", run: "runWwfScheduleNow", remove: "removeWwfSchedule" },
          "nts-": { toggle: "setNtsScheduleEnabled", run: "runNtsScheduleNow", remove: "removeNtsSchedule" },
          "fip-": { toggle: "setFipScheduleEnabled", run: "runFipScheduleNow", remove: "removeFipSchedule" },
          "kexp-": { toggle: "setKexpScheduleEnabled", run: "runKexpScheduleNow", remove: "removeKexpSchedule" }
        };

        for (const [prefix, methods] of Object.entries(sourceMap)) {
          const toggleBtn = button.matches(`[data-${prefix}schedule-toggle]`) ? button : null;
          if (toggleBtn) {
            const id = toggleBtn.getAttribute(`data-${prefix}schedule-toggle`);
            const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
            await window.rteDownloader[methods.toggle](id, enabled);
            await renderAllSchedules();
            return;
          }

          const runBtn = button.matches(`[data-${prefix}schedule-run]`) ? button : null;
          if (runBtn) {
            const id = runBtn.getAttribute(`data-${prefix}schedule-run`);
            const statusEl = getStatusEl(`data-${prefix}schedule-status`);
            if (statusEl) {
              statusEl.style.display = "block";
              statusEl.textContent = "Running...";
            }
            try {
              await window.rteDownloader[methods.run](id);
              await renderAllSchedules();
            } catch (error) {
              if (statusEl) {
                statusEl.textContent = `Error: ${error.message}`;
              }
            }
            return;
          }

          const removeBtn = button.matches(`[data-${prefix}schedule-remove]`) ? button : null;
          if (removeBtn) {
            const id = removeBtn.getAttribute(`data-${prefix}schedule-remove`);
            await window.rteDownloader[methods.remove](id);
            await renderAllSchedules();
            return;
          }
        }
      });
    }

    bindEvents();

    return {
      renderAllSchedules
    };
  }

  window.KimbleSchedulesScreen = {
    create: createSchedulesScreen
  };
})();
