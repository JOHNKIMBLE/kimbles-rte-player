(function initKimbleRendererSharedUtils() {
  function createRendererSharedUtils(deps) {
    const state = deps.state;
    const documentRef = deps.documentRef || document;
    const escapeHtml = deps.escapeHtml;
    const setUrlParam = deps.setUrlParam;
    const cueDebugState = new Map();

    function formatNtsTimeSlotLocal(startTimestamp, endTimestamp) {
      if (!startTimestamp || !endTimestamp) {
        return "";
      }
      const start = new Date(startTimestamp);
      const end = new Date(endTimestamp);
      const options = { hour: "2-digit", minute: "2-digit", hour12: false };
      return `${start.toLocaleTimeString(undefined, options)} - ${end.toLocaleTimeString(undefined, options)}`;
    }

    function formatLocalDateTime(input) {
      const text = String(input || "").trim();
      if (!text) {
        return "";
      }
      const dt = new Date(text);
      if (!Number.isFinite(dt.getTime())) {
        return text;
      }
      return dt.toLocaleString();
    }

    function formatLocalDate(input) {
      const text = String(input || "").trim();
      if (!text) {
        return "";
      }
      const dt = new Date(text);
      if (!Number.isFinite(dt.getTime())) {
        return text;
      }
      return dt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }

    function parseDatePartsFromText(input) {
      const text = String(input || "");
      const monthMap = new Map([
        ["jan", 1], ["january", 1],
        ["feb", 2], ["february", 2],
        ["mar", 3], ["march", 3],
        ["apr", 4], ["april", 4],
        ["may", 5],
        ["jun", 6], ["june", 6],
        ["jul", 7], ["july", 7],
        ["aug", 8], ["august", 8],
        ["sep", 9], ["sept", 9], ["september", 9],
        ["oct", 10], ["october", 10],
        ["nov", 11], ["november", 11],
        ["dec", 12], ["december", 12]
      ]);

      const dmyWord = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,10})\s+(\d{4})\b/);
      if (dmyWord) {
        const day = Number(dmyWord[1]);
        const month = monthMap.get(String(dmyWord[2] || "").toLowerCase()) || 0;
        const year = Number(dmyWord[3]);
        if (day > 0 && month > 0 && year > 0) {
          return { year, month, day };
        }
      }

      const dmySlash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
      if (dmySlash) {
        const day = Number(dmySlash[1]);
        const month = Number(dmySlash[2]);
        const year = Number(dmySlash[3]);
        if (day > 0 && month > 0 && year > 0) {
          return { year, month, day };
        }
      }

      const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
      if (iso) {
        const year = Number(iso[1]);
        const month = Number(iso[2]);
        const day = Number(iso[3]);
        if (day > 0 && month > 0 && year > 0) {
          return { year, month, day };
        }
      }

      return null;
    }

    function utcDateTimeToLocalString({ year, month, day, hour, minute }) {
      const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute);
      const localDate = new Date(utcTimestamp);
      if (!Number.isFinite(localDate.getTime())) {
        return "";
      }
      return localDate.toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: state.timeFormat === "12h"
      });
    }

    function localizeNextBroadcast(nextBroadcastAt) {
      const text = String(nextBroadcastAt || "").trim();
      if (!text) {
        return "";
      }
      const isoDate = new Date(text);
      if (Number.isFinite(isoDate.getTime())) {
        return isoDate.toLocaleString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: state.timeFormat === "12h"
        });
      }
      const dateParts = parseDatePartsFromText(text);
      const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
      if (!dateParts || !timeMatch) {
        return "";
      }
      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        return "";
      }
      return utcDateTimeToLocalString({ ...dateParts, hour, minute }) || "";
    }

    function hhmmToMinutes(hhmm) {
      const match = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
      if (!match) {
        return null;
      }
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }
      return hours * 60 + minutes;
    }

    function minutesToHhMm(totalMinutes) {
      const minutesInDay = 24 * 60;
      let value = Number(totalMinutes || 0);
      while (value < 0) {
        value += minutesInDay;
      }
      value %= minutesInDay;
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function utcTimeToLocal(hhmm) {
      const match = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
      if (!match) {
        return hhmm;
      }
      const now = new Date();
      const utcTimestamp = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(match[1]), Number(match[2]));
      const localDate = new Date(utcTimestamp);
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: state.timeFormat === "12h"
      }).format(localDate);
    }

    function toLocalSchedule(runScheduleText) {
      const text = String(runScheduleText || "").trim();
      if (!text) {
        return "";
      }
      return text.replace(/(\d{1,2}:\d{2})/g, (match) => utcTimeToLocal(match));
    }

    function formatSchedulerCheckWindowLocal(runScheduleText) {
      const text = String(runScheduleText || "").trim();
      if (!text) {
        return "";
      }
      const segments = text.split(/\s*,\s*/g);
      const windows = [];
      for (const segment of segments) {
        const match = segment.match(/^(.*?)\s*[•]\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
        if (!match) {
          continue;
        }
        const dayText = String(match[1] || "").trim();
        const endMin = hhmmToMinutes(match[3]);
        if (endMin == null) {
          continue;
        }
        const checkStart = minutesToHhMm(endMin + 30);
        const checkEnd = minutesToHhMm(endMin + 6 * 60);
        windows.push(`${dayText} • ${utcTimeToLocal(checkStart)} - ${utcTimeToLocal(checkEnd)}`);
      }
      return windows.join(", ");
    }

    function looksLikeDateOnlyText(input) {
      const text = String(input || "").trim();
      if (!text) {
        return false;
      }
      return (
        /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text) ||
        /^\d{4}-\d{2}-\d{2}$/.test(text) ||
        /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/i.test(text)
      );
    }

    function makeCueDebugStateKey(sourceType, key) {
      return `${sourceType}:${String(key || "")}`;
    }

    function getCueDebugNode(sourceType, key) {
      const safeKey = encodeURIComponent(String(key || ""));
      switch (sourceType) {
        case "bbc":
          return documentRef.querySelector(`[data-bbc-episode-cue-debug="${safeKey}"]`);
        case "wwf":
          return documentRef.querySelector(`[data-wwf-episode-cue-debug="${safeKey}"]`);
        case "nts":
          return documentRef.querySelector(`[data-nts-episode-cue-debug="${safeKey}"]`);
        default:
          return documentRef.querySelector(`[data-episode-cue-debug="${safeKey}"]`);
      }
    }

    function clearCueDebugLog(sourceType, key) {
      cueDebugState.delete(makeCueDebugStateKey(sourceType, key));
      const node = getCueDebugNode(sourceType, key);
      if (!node) {
        return;
      }
      node.innerHTML = "";
      node.style.display = "none";
    }

    function appendCueDebugLog(sourceType, key, message) {
      const text = String(message || "").trim();
      if (!text) {
        return;
      }
      const stateKey = makeCueDebugStateKey(sourceType, key);
      const rows = cueDebugState.get(stateKey) || [];
      if (rows[rows.length - 1] === text) {
        return;
      }
      rows.push(text);
      const trimmed = rows.slice(-8);
      cueDebugState.set(stateKey, trimmed);
      const node = getCueDebugNode(sourceType, key);
      if (!node) {
        return;
      }
      node.innerHTML = trimmed.map((row) => `<div class="cue-debug-line">${escapeHtml(row)}</div>`).join("");
      node.style.display = trimmed.length ? "block" : "none";
    }

    function formatRunNowResult(result) {
      const downloaded = Array.isArray(result?.downloaded) ? result.downloaded : [];
      if (downloaded.length) {
        const names = downloaded
          .slice(0, 3)
          .map((row) => row.fileName || row.title || "")
          .filter(Boolean)
          .join(", ");
        const more = downloaded.length > 3 ? ` +${downloaded.length - 3} more` : "";
        return `Run Now: Downloaded ${downloaded.length} episode(s)${names ? ` (${names}${more})` : ""}`;
      }
      return `Run Now: ${String(result?.status || "No new episodes")}`;
    }

    function formatDurationFromSeconds(seconds) {
      const total = Math.max(0, Number(seconds) || 0);
      if (!total) {
        return "";
      }
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const secs = total % 60;
      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    function parseRteDurationSeconds(input) {
      const text = String(input || "").trim().toLowerCase();
      if (!text) {
        return 0;
      }
      const hours = Number(text.match(/(\d+)\s*h/)?.[1] || 0);
      const minutes = Number(text.match(/(\d+)\s*m/)?.[1] || 0);
      const seconds = Number(text.match(/(\d+)\s*s/)?.[1] || 0);
      return Math.max(0, hours * 3600 + minutes * 60 + seconds);
    }

    function setLiveOverlayTarget(button, src) {
      if (!button) {
        return;
      }
      button.dataset.autoplaySrc = String(src || "");
      button.classList.toggle("hidden", !src);
    }

    function buildBbcAutoplayCandidates(stationUrl) {
      const base = String(stationUrl || "").trim();
      if (!base) {
        return [];
      }
      const variants = [
        `${setUrlParam(setUrlParam(setUrlParam(base, "autoplay", "1"), "autostart", "true"), "play", "1")}#play`,
        `${setUrlParam(setUrlParam(setUrlParam(base, "autoplay", "true"), "autostart", "true"), "play", "true")}#play`,
        `${setUrlParam(setUrlParam(base, "play", "1"), "autostart", "true")}#play`
      ];
      return Array.from(new Set(variants));
    }

    function formatBackfillSummary(schedule) {
      const total = Number(schedule?.backfillTotal || 0);
      const completed = Number(schedule?.backfillCompleted || 0);
      const failed = Number(schedule?.backfillFailed || 0);
      if (!schedule?.backfillInProgress && total <= 0) {
        return "";
      }
      const text = `${completed}/${total > 0 ? total : completed}`;
      return failed > 0 ? `${text} (${failed} failed)` : text;
    }

    function formatSchedulerNextShowLocal(schedule) {
      const local = localizeNextBroadcast(schedule?.nextBroadcastAt || "");
      if (!local) {
        return "";
      }
      const title = String(schedule?.nextBroadcastTitle || "").trim();
      if (!title || looksLikeDateOnlyText(title)) {
        return local;
      }
      return `${local} - ${title}`;
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

    function renderSchedulerCard(schedule, sourceType = "rte") {
      const isBbc = sourceType === "bbc";
      const isWwf = sourceType === "wwf";
      const isNts = sourceType === "nts";
      const isFip = sourceType === "fip";
      const isKexp = sourceType === "kexp";
      const hosts = [];
      const hostHistory = normalizeMetadataList(schedule?.hostHistory || schedule?.hosts);
      const genres = normalizeMetadataList(schedule?.genres);
      const location = String(schedule?.location || "").trim();
      const description = String(schedule?.description || "").trim();
      const latestEpisodeHosts = normalizeMetadataList(schedule?.latestEpisodeHosts);
      const latestEpisodeGenres = normalizeMetadataList(schedule?.latestEpisodeGenres);
      const latestEpisodeLocation = String(schedule?.latestEpisodeLocation || "").trim();
      const latestEpisodeDescription = String(schedule?.latestEpisodeDescription || "").trim();
      const latestImage = schedule?.latestEpisodeImage || schedule?.image || "";
      const latestPublished = formatLocalDate(schedule?.latestEpisodePublishedTime || "");
      const runLocal = toLocalSchedule(schedule?.runSchedule || "");
      const checkWindowLocal = formatSchedulerCheckWindowLocal(schedule?.runSchedule || "");
      const nextShowLocal = formatSchedulerNextShowLocal(schedule);
      const retryPending = Array.isArray(schedule?.retryQueue) ? schedule.retryQueue.length : 0;
      const cadence = String(schedule?.cadence || "unknown");
      const backfillSummary = formatBackfillSummary(schedule);
      const checked = formatLocalDateTime(schedule?.lastCheckedAt || "never");
      const ran = formatLocalDateTime(schedule?.lastRunAt || "never");
      const latestFileTime = schedule?.lastDownloaded?.at ? formatLocalDateTime(schedule.lastDownloaded.at) : "";
      const latestFilePath = String(schedule?.lastDownloaded?.filePath || "").trim();
      const status = String(schedule?.lastStatus || "Idle");
      const toggleAttr = isKexp ? "data-kexp-schedule-toggle" : isFip ? "data-fip-schedule-toggle" : isNts ? "data-nts-schedule-toggle" : isWwf ? "data-wwf-schedule-toggle" : isBbc ? "data-bbc-schedule-toggle" : "data-schedule-toggle";
      const runAttr = isKexp ? "data-kexp-schedule-run" : isFip ? "data-fip-schedule-run" : isNts ? "data-nts-schedule-run" : isWwf ? "data-wwf-schedule-run" : isBbc ? "data-bbc-schedule-run" : "data-schedule-run";
      const removeAttr = isKexp ? "data-kexp-schedule-remove" : isFip ? "data-fip-schedule-remove" : isNts ? "data-nts-schedule-remove" : isWwf ? "data-wwf-schedule-remove" : isBbc ? "data-bbc-schedule-remove" : "data-schedule-remove";
      const playOutputAttr = isKexp ? "data-kexp-schedule-play-output" : isFip ? "data-fip-schedule-play-output" : isNts ? "data-nts-schedule-play-output" : isWwf ? "data-wwf-schedule-play-output" : isBbc ? "data-bbc-schedule-play-output" : "data-schedule-play-output";
      const playFileAttr = isKexp ? "data-kexp-schedule-play-file" : isFip ? "data-fip-schedule-play-file" : isNts ? "data-nts-schedule-play-file" : isWwf ? "data-wwf-schedule-play-file" : isBbc ? "data-bbc-schedule-play-file" : "data-schedule-play-file";
      const playTitleAttr = isKexp ? "data-kexp-schedule-play-title" : isFip ? "data-fip-schedule-play-title" : isNts ? "data-nts-schedule-play-title" : isWwf ? "data-wwf-schedule-play-title" : isBbc ? "data-bbc-schedule-play-title" : "data-schedule-play-title";
      const playImageAttr = isKexp ? "data-kexp-schedule-play-image" : isFip ? "data-fip-schedule-play-image" : isNts ? "data-nts-schedule-play-image" : isWwf ? "data-wwf-schedule-play-image" : isBbc ? "data-bbc-schedule-play-image" : "data-schedule-play-image";
      const playEpisodeUrlAttr = isKexp ? "data-kexp-schedule-play-episode-url" : isFip ? "data-fip-schedule-play-episode-url" : isNts ? "data-nts-schedule-play-episode-url" : isWwf ? "data-wwf-schedule-play-episode-url" : isBbc ? "data-bbc-schedule-play-episode-url" : "data-schedule-play-episode-url";
      const playSourceTypeAttr = isKexp ? "data-kexp-schedule-play-source-type" : isFip ? "data-fip-schedule-play-source-type" : isNts ? "data-nts-schedule-play-source-type" : isWwf ? "data-wwf-schedule-play-source-type" : isBbc ? "data-bbc-schedule-play-source-type" : "data-schedule-play-source-type";
      const statusAttr = isKexp ? "data-kexp-schedule-status" : isFip ? "data-fip-schedule-status" : isNts ? "data-nts-schedule-status" : isWwf ? "data-wwf-schedule-status" : isBbc ? "data-bbc-schedule-status" : "data-schedule-status";
      const openExplorerAttr = isKexp ? "data-kexp-schedule-open-explorer" : isFip ? "data-fip-schedule-open-explorer" : isNts ? "data-nts-schedule-open-explorer" : isWwf ? "data-wwf-schedule-open-explorer" : isBbc ? "data-bbc-schedule-open-explorer" : "data-schedule-open-explorer";
      const playSourceTypeValue = isKexp ? "kexp" : isFip ? "fip" : isNts ? "nts" : isWwf ? "wwf" : isBbc ? "bbc" : "rte";
      const metadataLine = [
        hosts.length ? `Host${hosts.length === 1 ? "" : "s"}: ${escapeHtml(hosts.join(", "))}` : "",
        location ? escapeHtml(location) : ""
      ].filter(Boolean).join(" • ");
      const hostsHtml = hostHistory.length
        ? `<div class="item-meta">Hosts:</div><div class="genre-pills">${hostHistory.map((host) => `<span class="genre-pill">${escapeHtml(host)}</span>`).join("")}</div>`
        : "";
      const genresHtml = genres.length
        ? `<div class="genre-pills">${genres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      const descriptionHtml = description
        ? `<div class="item-meta">${escapeHtml(description.slice(0, 220))}${description.length > 220 ? "..." : ""}</div>`
        : "";
      const latestMetadataLine = [
        latestEpisodeHosts.length ? `Host${latestEpisodeHosts.length === 1 ? "" : "s"}: ${escapeHtml(latestEpisodeHosts.join(", "))}` : "",
        latestEpisodeLocation ? escapeHtml(latestEpisodeLocation) : ""
      ].filter(Boolean).join(" • ");
      const latestGenresHtml = latestEpisodeGenres.length
        ? `<div class="genre-pills scheduler-latest-genres">${latestEpisodeGenres.map((genre) => `<span class="genre-pill">${escapeHtml(genre)}</span>`).join("")}</div>`
        : "";
      const latestDescriptionHtml = latestEpisodeDescription
        ? `<span class="scheduler-v scheduler-v-muted">${escapeHtml(latestEpisodeDescription.slice(0, 180))}${latestEpisodeDescription.length > 180 ? "..." : ""}</span>`
        : "";

      return `
        <div class="item scheduler-card">
          <div class="scheduler-head">
            ${latestImage ? `<img class="scheduler-thumb" src="${escapeHtml(latestImage)}" alt="${escapeHtml(schedule?.latestEpisodeTitle || schedule?.title || "Program")}" loading="lazy" />` : `<div class="scheduler-thumb scheduler-thumb-placeholder"></div>`}
            <div class="scheduler-head-main">
              <div class="item-title">${escapeHtml(schedule?.title || "Program")}</div>
              <div class="scheduler-badges">
                <span class="scheduler-badge">${escapeHtml(cadence)}</span>
                <span class="scheduler-badge scheduler-badge-status">${escapeHtml(status)}</span>
                ${backfillSummary ? `<span class="scheduler-badge scheduler-badge-progress">Backfill ${escapeHtml(backfillSummary)}</span>` : ""}
              </div>
              ${metadataLine ? `<div class="item-meta">${metadataLine}</div>` : ""}
              ${hostsHtml}
              ${descriptionHtml}
              ${genresHtml}
            </div>
          </div>
          <div class="scheduler-grid">
            ${schedule?.latestEpisodeTitle ? `<div class="scheduler-cell scheduler-cell-latest"><span class="scheduler-k">Latest</span><span class="scheduler-v">${escapeHtml(schedule.latestEpisodeTitle)}${latestPublished ? ` • ${escapeHtml(latestPublished)}` : ""}</span></div>` : ""}
            ${(latestMetadataLine || latestEpisodeDescription || latestEpisodeGenres.length) ? `<div class="scheduler-cell scheduler-cell-latest-meta"><span class="scheduler-k">Latest Metadata</span>${latestMetadataLine ? `<span class="scheduler-v scheduler-v-muted">${latestMetadataLine}</span>` : ""}${latestDescriptionHtml}${latestGenresHtml}</div>` : ""}
            ${runLocal ? `<div class="scheduler-cell scheduler-cell-airs"><span class="scheduler-k">Airs (Local)</span><span class="scheduler-v">${escapeHtml(runLocal)}</span></div>` : ""}
            ${checkWindowLocal ? `<div class="scheduler-cell scheduler-cell-check-window"><span class="scheduler-k">Check Window (Local)</span><span class="scheduler-v">${escapeHtml(checkWindowLocal)}</span></div>` : ""}
            ${nextShowLocal ? `<div class="scheduler-cell scheduler-cell-next-broadcast"><span class="scheduler-k">Next Broadcast (Local)</span><span class="scheduler-v">${escapeHtml(nextShowLocal)}</span></div>` : ""}
            <div class="scheduler-cell scheduler-cell-retry"><span class="scheduler-k">Retry Queue</span><span class="scheduler-v">${escapeHtml(String(retryPending))} pending</span></div>
            ${latestFilePath ? `<div class="scheduler-cell scheduler-cell-latest-file"><span class="scheduler-k">Latest File</span><span class="scheduler-v scheduler-path">${escapeHtml(latestFilePath)}</span></div>` : ""}
            ${latestFileTime ? `<div class="scheduler-cell scheduler-cell-saved"><span class="scheduler-k">Saved</span><span class="scheduler-v">${escapeHtml(latestFileTime)}</span></div>` : ""}
            <div class="scheduler-cell scheduler-cell-last-checked"><span class="scheduler-k">Last Checked</span><span class="scheduler-v">${escapeHtml(checked)}</span></div>
            <div class="scheduler-cell scheduler-cell-last-run"><span class="scheduler-k">Last Run</span><span class="scheduler-v">${escapeHtml(ran)}</span></div>
          </div>
          <div class="item-actions">
            <button class="secondary" ${toggleAttr}="${escapeHtml(schedule.id)}" data-enabled="${schedule.enabled ? "1" : "0"}">${schedule.enabled ? "Pause" : "Enable"}</button>
            <button class="secondary" ${runAttr}="${escapeHtml(schedule.id)}">Run Now</button>
            ${schedule?.programUrl ? `<button class="secondary" ${openExplorerAttr}="${escapeHtml(schedule.programUrl)}">Open Explorer</button>` : ""}
            ${schedule?.lastDownloaded?.outputDir && schedule?.lastDownloaded?.fileName ? `<button class="secondary" ${playOutputAttr}="${escapeHtml(schedule.lastDownloaded.outputDir)}" ${playFileAttr}="${escapeHtml(schedule.lastDownloaded.fileName)}" ${playTitleAttr}="${escapeHtml(schedule.lastDownloaded.title || schedule.title)}" ${playImageAttr}="${escapeHtml(schedule.lastDownloaded.image || schedule.latestEpisodeImage || schedule.image || "")}" ${playEpisodeUrlAttr}="${escapeHtml(schedule.lastDownloaded.episodeUrl || "")}" ${playSourceTypeAttr}="${escapeHtml(playSourceTypeValue)}">Play Latest</button>` : ""}
            <button class="secondary" ${removeAttr}="${escapeHtml(schedule.id)}">Remove</button>
          </div>
          <div class="item-meta episode-status" ${statusAttr}="${escapeHtml(schedule.id)}" style="display:none;"></div>
        </div>
      `;
    }

    return {
      formatNtsTimeSlotLocal,
      formatLocalDateTime,
      formatLocalDate,
      localizeNextBroadcast,
      toLocalSchedule,
      setLiveOverlayTarget,
      buildBbcAutoplayCandidates,
      clearCueDebugLog,
      appendCueDebugLog,
      formatRunNowResult,
      formatDurationFromSeconds,
      parseRteDurationSeconds,
      renderSchedulerCard
    };
  }

  window.KimbleRendererSharedUtils = {
    create: createRendererSharedUtils
  };
})();
