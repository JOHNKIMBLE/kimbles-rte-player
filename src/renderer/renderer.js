const quickUrlInput = document.getElementById("quickUrlInput");
const quickDownloadBtn = document.getElementById("quickDownloadBtn");
const quickResult = document.getElementById("quickResult");
const quickLog = document.getElementById("quickLog");

const stationSelect = document.getElementById("stationSelect");
const refreshLiveBtn = document.getElementById("refreshLiveBtn");
const liveNow = document.getElementById("liveNow");
const livePlayerFrame = document.getElementById("livePlayerFrame");

const programSearchInput = document.getElementById("programSearchInput");
const programSearchBtn = document.getElementById("programSearchBtn");
const programSearchResult = document.getElementById("programSearchResult");
const programUrlInput = document.getElementById("programUrlInput");
const loadProgramBtn = document.getElementById("loadProgramBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const addScheduleBtn = document.getElementById("addScheduleBtn");
const scheduleBackfillMode = document.getElementById("scheduleBackfillMode");
const scheduleBackfillCount = document.getElementById("scheduleBackfillCount");
const programMeta = document.getElementById("programMeta");
const episodesResult = document.getElementById("episodesResult");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const scheduleList = document.getElementById("scheduleList");
const timeFormatSelect = document.getElementById("timeFormatSelect");
const downloadDirInput = document.getElementById("downloadDirInput");
const episodeNameModeSelect = document.getElementById("episodeNameModeSelect");
const chooseDownloadDirBtn = document.getElementById("chooseDownloadDirBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");

const state = {
  liveStations: [],
  currentProgramUrl: "",
  currentProgramPage: 1,
  currentMaxPages: 1,
  currentEpisodes: null,
  theme: "dark",
  hasLoadedProgramCatalog: false,
  timeFormat: "24h",
  downloadDir: "",
  episodeNameMode: "date-only"
};
const PROGRAM_EPISODES_PER_PAGE = 10;
let searchDebounceTimer = null;
const downloadProgressHandlers = new Map();

window.rteDownloader.onDownloadProgress((payload) => {
  const token = payload?.token;
  if (!token || !downloadProgressHandlers.has(token)) {
    return;
  }

  const handler = downloadProgressHandlers.get(token);
  if (typeof handler === "function") {
    handler(payload);
  }
});

function createProgressToken(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function attachDownloadProgress(token, handler) {
  downloadProgressHandlers.set(token, handler);
  return () => {
    downloadProgressHandlers.delete(token);
  };
}

function formatProgressText(progress, fallbackText) {
  if (!progress) {
    return fallbackText;
  }

  if (progress.kind === "download") {
    const percent = Number.isFinite(progress.percent) ? `${progress.percent.toFixed(1)}%` : "";
    const frag = progress.fragmentCurrent && progress.fragmentTotal
      ? ` (frag ${progress.fragmentCurrent}/${progress.fragmentTotal})`
      : "";
    return `Downloading... ${percent}${frag}`.trim();
  }

  if (progress.kind === "extractaudio") {
    return "Converting to MP3...";
  }

  if (progress.kind === "fixupm3u8") {
    return "Finalizing stream container...";
  }

  if (progress.kind === "generic" || progress.kind === "info" || progress.kind === "hlsnative") {
    return progress.message || fallbackText;
  }

  return progress.message || fallbackText;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setQuickStatus(text, isError = false) {
  quickResult.className = `status ${isError ? "" : "muted"}`;
  quickResult.textContent = text;
}

function setButtonBusy(button, busy, normalLabel, busyLabel = "Working...") {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : normalLabel;
}

function setSettingsStatus(text, isError = false) {
  settingsStatus.className = `status ${isError ? "" : "muted"}`;
  settingsStatus.textContent = text;
}

function parseOffsetToMinutes(offsetText) {
  const match = String(offsetText || "").match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const mins = Number(match[3] || 0);
  return sign * (hours * 60 + mins);
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "shortOffset"
  }).formatToParts(date);
  const tzName = parts.find((part) => part.type === "timeZoneName")?.value || "GMT+0";
  return parseOffsetToMinutes(tzName);
}

function dublinTimeToLocal(hhmm) {
  const match = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return hhmm;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const utcGuess = Date.UTC(year, month, day, hour, minute);
  const dublinOffset = getTimeZoneOffsetMinutes("Europe/Dublin", new Date(utcGuess));
  const utcTimestamp = utcGuess - dublinOffset * 60 * 1000;
  const localDate = new Date(utcTimestamp);

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: state.timeFormat === "12h"
  }).format(localDate);
}

function addLocalTimeHint(runScheduleText) {
  if (!runScheduleText) {
    return "";
  }

  const ranges = Array.from(runScheduleText.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g));
  if (!ranges.length) {
    return runScheduleText;
  }

  const localRanges = ranges.map((entry) => `${dublinTimeToLocal(entry[1])}-${dublinTimeToLocal(entry[2])}`);
  return `${runScheduleText} (Local: ${localRanges.join(", ")})`;
}

function applyTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.body.classList.toggle("light-mode", state.theme === "light");
  themeToggleBtn.textContent = state.theme === "light" ? "Dark Mode" : "Light Mode";
  localStorage.setItem("kimble_theme", state.theme);
}

async function refreshLivePanel() {
  const selectedId = Number(stationSelect.value);
  if (!Number.isFinite(selectedId)) {
    return;
  }

  const info = await window.rteDownloader.getLiveNow(selectedId);
  liveNow.innerHTML = `<strong>${escapeHtml(info.stationName)}</strong> - ${escapeHtml(info.programmeName)}<br>${escapeHtml(info.description)}`;
  livePlayerFrame.src = `https://www.rte.ie/bosco/components/player/iframe.html?radioUI=true&autostart=true&app_name=rnn&clipid=${selectedId}`;
}

async function loadLiveStations() {
  state.liveStations = await window.rteDownloader.getLiveStations();
  stationSelect.innerHTML = state.liveStations
    .map((station) => `<option value="${station.id}">${escapeHtml(station.name)}</option>`)
    .join("");

  await refreshLivePanel();
}

function renderSearchPrograms(items) {
  programSearchResult.classList.remove("hidden");

  if (!items.length) {
    programSearchResult.innerHTML = `<div class="item">No programs found.</div>`;
    return;
  }

  programSearchResult.innerHTML = items
    .map((item) => {
      const imageHtml = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
        : `<img alt="No artwork" loading="lazy" />`;

      return `
        <div class="item clickable" data-load-program-url="${escapeHtml(item.programUrl)}">
          <div class="search-card">
            <div>${imageHtml}</div>
            <div>
              <div class="item-title">${escapeHtml(item.title)}</div>
              ${item.runSchedule ? `<div class="item-meta"><strong>${escapeHtml(addLocalTimeHint(item.runSchedule))}</strong></div>` : ""}
              ${item.description ? `<div class="item-meta">${escapeHtml(item.description)}</div>` : ""}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function hideSearchDropdown() {
  programSearchResult.classList.add("hidden");
}

async function runProgramSearch(query) {
  setButtonBusy(programSearchBtn, true, "Search");
  programSearchResult.classList.remove("hidden");
  programSearchResult.innerHTML = `<div class="item">Searching...</div>`;

  try {
    const items = await window.rteDownloader.searchPrograms(query);
    renderSearchPrograms(items);
  } catch (error) {
    programSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
  } finally {
    setButtonBusy(programSearchBtn, false, "Search");
  }
}

function renderPlaylistTracks(tracks) {
  if (!tracks.length) {
    return `<div class="playlist-note">No tracks found.</div>`;
  }

  return `
    <div class="playlist-grid compact-playlist-grid">
      ${tracks
        .map(
          (track) => `
            <div class="playlist-track">
              <div>${track.image ? `<img src="${escapeHtml(track.image)}" alt="${escapeHtml(track.title)}" width="24" height="24" />` : "*"}</div>
              <div>
                <div class="item-title">${escapeHtml(track.title)}</div>
                <div class="item-meta">${escapeHtml(track.artist)}</div>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function setEpisodeStatus(clipId, text, isError = false) {
  const statusNode = document.querySelector(`[data-episode-status="${clipId}"]`);
  if (!statusNode) {
    return;
  }

  const safeText = String(text || "");
  statusNode.textContent = safeText;
  statusNode.style.display = safeText ? "block" : "none";
  statusNode.className = `item-meta episode-status ${isError ? "episode-status-error" : ""}`;
}

async function loadEpisodePlaylistInto(episodeUrl, clipId) {
  const container = document.querySelector(`[data-episode-playlist="${clipId}"]`);
  if (!container) {
    return;
  }

  if (!episodeUrl) {
    container.innerHTML = `<div class="playlist-note">No episode URL for playlist lookup.</div>`;
    return;
  }

  container.innerHTML = `<div class="playlist-note">Loading playlist...</div>`;

  try {
    const payload = await window.rteDownloader.getEpisodePlaylist(episodeUrl);
    container.innerHTML = renderPlaylistTracks(payload.tracks || []);
  } catch (error) {
    container.innerHTML = `<div class="playlist-note">Playlist load failed: ${escapeHtml(error.message)}</div>`;
  }
}

async function autoLoadVisiblePlaylists(episodes) {
  const queue = (episodes || []).filter((episode) => episode.clipId && episode.episodeUrl);
  const concurrency = 3;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const next = queue[index];
      index += 1;
      await loadEpisodePlaylistInto(next.episodeUrl, String(next.clipId));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
}

function renderEpisodes(payload) {
  const rows = payload.episodes || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PROGRAM_EPISODES_PER_PAGE));
  const currentPage = Math.max(1, Math.min(totalPages, Number(state.currentProgramPage || 1)));
  const start = (currentPage - 1) * PROGRAM_EPISODES_PER_PAGE;
  const visibleRows = rows.slice(start, start + PROGRAM_EPISODES_PER_PAGE);

  if (!rows.length) {
    episodesResult.innerHTML = `<div class="item">No episodes returned for this page.</div>`;
    return;
  }

  episodesResult.innerHTML = visibleRows
    .map((episode) => {
      const clipId = String(episode.clipId || "");

      return `
        <div class="item">
          <div class="item-title">${escapeHtml(episode.title)}</div>
          <div class="item-meta">
            ${escapeHtml(episode.publishedTimeFormatted || episode.publishedTime)}
            ${episode.durationString ? ` - ${escapeHtml(episode.durationString)}` : ""}
            - clip ${escapeHtml(clipId)}
          </div>
          <div class="item-actions">
            <button data-download-clip="${escapeHtml(clipId)}" data-download-title="${escapeHtml(episode.title)}" data-download-program-title="${escapeHtml(payload.title || "")}" data-download-url="${escapeHtml(episode.episodeUrl || "")}">Download</button>
          </div>
          <div class="item-meta episode-status" data-episode-status="${escapeHtml(clipId)}" style="display:none;"></div>
          <div class="episode-inline-playlist" data-episode-playlist="${escapeHtml(clipId)}">
            <div class="playlist-note">Queued playlist load...</div>
          </div>
        </div>
      `;
    })
    .join("");

  autoLoadVisiblePlaylists(visibleRows).catch(() => {});
}

async function loadProgram(programUrl, page = 1) {
  const payload = await window.rteDownloader.getProgramEpisodes(programUrl, 1);
  const totalRows = Number(payload.episodes?.length || 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / PROGRAM_EPISODES_PER_PAGE));
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));

  state.currentProgramUrl = payload.programUrl;
  state.currentProgramPage = targetPage;
  state.currentMaxPages = totalPages;
  state.currentEpisodes = payload;

  programUrlInput.value = payload.programUrl;
  programMeta.innerHTML = `
    <strong>${escapeHtml(payload.title)}</strong><br>
    ${payload.runSchedule ? `${escapeHtml(addLocalTimeHint(payload.runSchedule))}<br>` : ""}
    ${escapeHtml(payload.description || "")}<br>
    Cadence guess: <strong>${escapeHtml(payload.cadence || "unknown")}</strong>
    ${payload.averageDaysBetween ? ` (${escapeHtml(payload.averageDaysBetween)} day average)` : ""}<br>
    Page ${state.currentProgramPage} of ${state.currentMaxPages} - ${totalRows} episodes
  `;

  renderEpisodes(payload);
}

async function refreshSchedules() {
  const schedules = await window.rteDownloader.listSchedules();
  if (!schedules.length) {
    scheduleList.innerHTML = `<div class="item">No schedules yet.</div>`;
    return;
  }

  scheduleList.innerHTML = schedules
    .map(
      (s) => `
        <div class="item">
          <div class="item-title">${escapeHtml(s.title)}</div>
          <div class="item-meta">
            ${s.runSchedule ? `Runs: ${escapeHtml(addLocalTimeHint(s.runSchedule))}<br>` : ""}
            Status: ${escapeHtml(s.lastStatus || "Idle")} - Cadence: ${escapeHtml(s.cadence || "unknown")}<br>
            Backfill setting: ${s.initialBackfillCount ? `latest ${escapeHtml(s.initialBackfillCount)} on create` : "new episodes only"}<br>
            Last checked: ${escapeHtml(s.lastCheckedAt || "never")} - Last run: ${escapeHtml(s.lastRunAt || "never")}
          </div>
          <div class="item-actions">
            <button class="secondary" data-schedule-toggle="${escapeHtml(s.id)}" data-enabled="${s.enabled ? "1" : "0"}">${s.enabled ? "Pause" : "Enable"}</button>
            <button class="secondary" data-schedule-run="${escapeHtml(s.id)}">Run Now</button>
            <button class="secondary" data-schedule-remove="${escapeHtml(s.id)}">Remove</button>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadSettings() {
  const settings = await window.rteDownloader.getSettings();
  state.timeFormat = settings?.timeFormat === "12h" ? "12h" : "24h";
  state.downloadDir = String(settings?.downloadDir || "");
  state.episodeNameMode = settings?.episodeNameMode === "full-title" ? "full-title" : "date-only";
  timeFormatSelect.value = state.timeFormat;
  downloadDirInput.value = state.downloadDir;
  episodeNameModeSelect.value = state.episodeNameMode;
}

async function refreshTimeBasedUi() {
  await refreshSchedules();
  if (state.currentProgramUrl) {
    await loadProgram(state.currentProgramUrl, state.currentProgramPage);
  }
}

quickDownloadBtn.addEventListener("click", async () => {
  const pageUrl = quickUrlInput.value.trim();
  if (!pageUrl) {
    setQuickStatus("Enter an RTE episode URL.", true);
    return;
  }

  setButtonBusy(quickDownloadBtn, true, "Download");
  quickLog.textContent = "";
  setQuickStatus("Resolving title and stream...");
  const progressToken = createProgressToken("quick");
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setQuickStatus(formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadFromPageUrl(pageUrl, progressToken);
    setQuickStatus(`Saved: ${data.outputDir}\\${data.fileName}`);
    quickLog.textContent = data.log || "Done.";
  } catch (error) {
    setQuickStatus(error.message, true);
  } finally {
    detachProgress();
    setButtonBusy(quickDownloadBtn, false, "Download");
  }
});

quickUrlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  if (!quickDownloadBtn.disabled) {
    quickDownloadBtn.click();
  }
});

stationSelect.addEventListener("change", () => {
  refreshLivePanel().catch((error) => {
    liveNow.textContent = error.message;
  });
});

refreshLiveBtn.addEventListener("click", () => {
  setButtonBusy(refreshLiveBtn, true, "Refresh");
  refreshLivePanel()
    .catch((error) => {
      liveNow.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(refreshLiveBtn, false, "Refresh");
    });
});

programSearchBtn.addEventListener("click", async () => {
  await runProgramSearch(programSearchInput.value.trim());
});

programSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  await runProgramSearch(programSearchInput.value.trim());
});

programSearchInput.addEventListener("focus", async () => {
  if (state.hasLoadedProgramCatalog) {
    programSearchResult.classList.remove("hidden");
    return;
  }

  await runProgramSearch("");
  state.hasLoadedProgramCatalog = true;
});

programSearchInput.addEventListener("input", async () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  const query = programSearchInput.value.trim();
  searchDebounceTimer = setTimeout(async () => {
    if (!query) {
      await runProgramSearch("");
      state.hasLoadedProgramCatalog = true;
      return;
    }

    await runProgramSearch(query);
  }, 220);
});

programSearchResult.addEventListener("click", (event) => {
  const item = event.target.closest(".item[data-load-program-url]");
  if (!item) {
    return;
  }

  const url = item.getAttribute("data-load-program-url");
  if (url) {
    hideSearchDropdown();
    loadProgram(url, 1).catch((error) => {
      programMeta.textContent = error.message;
    });
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".search-box")) {
    return;
  }
  hideSearchDropdown();
});

loadProgramBtn.addEventListener("click", () => {
  const url = programUrlInput.value.trim();
  if (!url) {
    return;
  }

  setButtonBusy(loadProgramBtn, true, "Load Episodes");
  loadProgram(url, 1)
    .catch((error) => {
      programMeta.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(loadProgramBtn, false, "Load Episodes");
    });
});

prevPageBtn.addEventListener("click", () => {
  if (!state.currentProgramUrl || state.currentProgramPage <= 1) {
    return;
  }

  state.currentProgramPage -= 1;
  loadProgram(state.currentProgramUrl, state.currentProgramPage).catch((error) => {
    programMeta.textContent = error.message;
  });
});

nextPageBtn.addEventListener("click", () => {
  if (!state.currentProgramUrl || !state.currentEpisodes) {
    return;
  }

  if (state.currentProgramPage >= state.currentMaxPages) {
    return;
  }

  state.currentProgramPage += 1;
  loadProgram(state.currentProgramUrl, state.currentProgramPage).catch((error) => {
    programMeta.textContent = error.message;
  });
});

themeToggleBtn.addEventListener("click", () => {
  applyTheme(state.theme === "dark" ? "light" : "dark");
});

scheduleBackfillMode.addEventListener("change", () => {
  const isBackfill = scheduleBackfillMode.value === "backfill";
  scheduleBackfillCount.disabled = !isBackfill;
});

chooseDownloadDirBtn.addEventListener("click", async () => {
  setButtonBusy(chooseDownloadDirBtn, true, "Choose Folder", "Opening...");
  try {
    const chosen = await window.rteDownloader.pickDownloadDirectory();
    if (chosen) {
      downloadDirInput.value = chosen;
      setSettingsStatus("Folder selected. Click Save Settings to apply.");
    }
  } catch (error) {
    setSettingsStatus(error.message, true);
  } finally {
    setButtonBusy(chooseDownloadDirBtn, false, "Choose Folder");
  }
});

saveSettingsBtn.addEventListener("click", async () => {
  const downloadDir = downloadDirInput.value.trim();
  const timeFormat = timeFormatSelect.value === "12h" ? "12h" : "24h";
  const episodeNameMode = episodeNameModeSelect.value === "full-title" ? "full-title" : "date-only";

  if (!downloadDir) {
    setSettingsStatus("Choose a download directory first.", true);
    return;
  }

  setButtonBusy(saveSettingsBtn, true, "Save Settings", "Saving...");
  try {
    const saved = await window.rteDownloader.saveSettings({ timeFormat, downloadDir, episodeNameMode });
    state.timeFormat = saved.timeFormat === "12h" ? "12h" : "24h";
    state.downloadDir = String(saved.downloadDir || "");
    state.episodeNameMode = saved.episodeNameMode === "full-title" ? "full-title" : "date-only";
    timeFormatSelect.value = state.timeFormat;
    downloadDirInput.value = state.downloadDir;
    episodeNameModeSelect.value = state.episodeNameMode;
    setSettingsStatus("Settings saved.");
    await refreshTimeBasedUi();
  } catch (error) {
    setSettingsStatus(error.message, true);
  } finally {
    setButtonBusy(saveSettingsBtn, false, "Save Settings");
  }
});

addScheduleBtn.addEventListener("click", async () => {
  if (!state.currentProgramUrl) {
    programMeta.textContent = "Load a program first.";
    return;
  }

  const backfillCount = scheduleBackfillMode.value === "backfill"
    ? Math.max(1, Math.floor(Number(scheduleBackfillCount.value || 1)))
    : 0;

  setButtonBusy(addScheduleBtn, true, "Add Scheduler", "Adding...");

  try {
    await window.rteDownloader.addSchedule(state.currentProgramUrl, { backfillCount });
    await refreshSchedules();
  } catch (error) {
    programMeta.textContent = error.message;
  } finally {
    setButtonBusy(addScheduleBtn, false, "Add Scheduler");
  }
});

episodesResult.addEventListener("click", async (event) => {
  const downloadBtn = event.target.closest("button[data-download-clip]");
  if (!downloadBtn) {
    return;
  }

  const clipId = downloadBtn.getAttribute("data-download-clip");
  const title = downloadBtn.getAttribute("data-download-title") || "rte-episode";
  const programTitle = downloadBtn.getAttribute("data-download-program-title") || "";
  const episodeUrl = downloadBtn.getAttribute("data-download-url") || "";

  if (!clipId) {
    return;
  }

  setEpisodeStatus(clipId, "Starting download...");
  setButtonBusy(downloadBtn, true, "Download", "Downloading...");
  const progressToken = createProgressToken(`episode-${clipId}`);
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setEpisodeStatus(clipId, formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadEpisode({ clipId, title, programTitle, episodeUrl, progressToken });
    setEpisodeStatus(clipId, `Downloaded: ${data.fileName}`);
  } catch (error) {
    setEpisodeStatus(clipId, `Download failed: ${error.message}`, true);
  } finally {
    detachProgress();
    setButtonBusy(downloadBtn, false, "Download");
  }
});

scheduleList.addEventListener("click", async (event) => {
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
    try {
      await window.rteDownloader.runScheduleNow(id);
      await refreshSchedules();
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
});

(async function bootstrap() {
  try {
    const savedTheme = localStorage.getItem("kimble_theme") || "dark";
    applyTheme(savedTheme);
    scheduleBackfillCount.disabled = true;
    await loadSettings();
    await Promise.all([loadLiveStations(), refreshSchedules()]);
    setSettingsStatus("Loaded.");
    setQuickStatus("Ready");
  } catch (error) {
    setQuickStatus(error.message, true);
    setSettingsStatus(error.message, true);
  }
})();
