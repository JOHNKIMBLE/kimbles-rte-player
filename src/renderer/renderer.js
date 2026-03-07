const quickUrlInput = document.getElementById("quickUrlInput");
const quickDownloadBtn = document.getElementById("quickDownloadBtn");
const quickResult = document.getElementById("quickResult");
const quickLog = document.getElementById("quickLog");
const bbcUrlInput = document.getElementById("bbcUrlInput");
const bbcDownloadBtn = document.getElementById("bbcDownloadBtn");
const bbcResult = document.getElementById("bbcResult");
const bbcLog = document.getElementById("bbcLog");
const bbcProgramUrlInput = document.getElementById("bbcProgramUrlInput");
const bbcLoadProgramBtn = document.getElementById("bbcLoadProgramBtn");
const bbcProgramMeta = document.getElementById("bbcProgramMeta");
const bbcPrevPageBtn = document.getElementById("bbcPrevPageBtn");
const bbcNextPageBtn = document.getElementById("bbcNextPageBtn");
const bbcEpisodesResult = document.getElementById("bbcEpisodesResult");
const bbcProgramSearchInput = document.getElementById("bbcProgramSearchInput");
const bbcProgramSearchBtn = document.getElementById("bbcProgramSearchBtn");
const bbcProgramSearchResult = document.getElementById("bbcProgramSearchResult");
const bbcAddScheduleBtn = document.getElementById("bbcAddScheduleBtn");
const bbcScheduleBackfillMode = document.getElementById("bbcScheduleBackfillMode");
const bbcScheduleBackfillCount = document.getElementById("bbcScheduleBackfillCount");
const bbcScheduleList = document.getElementById("bbcScheduleList");
const bbcStationSelect = document.getElementById("bbcStationSelect");
const bbcRefreshLiveBtn = document.getElementById("bbcRefreshLiveBtn");
const bbcLiveNow = document.getElementById("bbcLiveNow");
const bbcLivePlayerFrame = document.getElementById("bbcLivePlayerFrame");
const bbcLiveOverlayPlayBtn = document.getElementById("bbcLiveOverlayPlayBtn");

const stationSelect = document.getElementById("stationSelect");
const refreshLiveBtn = document.getElementById("refreshLiveBtn");
const liveNow = document.getElementById("liveNow");
const livePlayerFrame = document.getElementById("livePlayerFrame");
const liveOverlayPlayBtn = document.getElementById("liveOverlayPlayBtn");

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
const cueAutoGenerateCheckbox = document.getElementById("cueAutoGenerateCheckbox");
const chooseDownloadDirBtn = document.getElementById("chooseDownloadDirBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");
const downloadDirSourceLabel = document.getElementById("downloadDirSourceLabel");
const tabRteBtn = document.getElementById("tabRteBtn");
const tabBbcBtn = document.getElementById("tabBbcBtn");
const tabSettingsBtn = document.getElementById("tabSettingsBtn");
const rteTabContent = document.getElementById("rteTabContent");
const bbcTabContent = document.getElementById("bbcTabContent");
const settingsTabContent = document.getElementById("settingsTabContent");

const state = {
  liveStations: [],
  bbcLiveStations: [],
  currentProgramUrl: "",
  currentProgramPage: 1,
  currentMaxPages: 1,
  currentEpisodes: null,
  bbcProgramUrl: "",
  bbcProgramPage: 1,
  bbcProgramMaxPages: 1,
  bbcEpisodesPayload: null,
  hasLoadedBbcProgramCatalog: false,
  theme: "dark",
  hasLoadedProgramCatalog: false,
  timeFormat: "24h",
  rteDownloadDir: "",
  bbcDownloadDir: "",
  episodeNameMode: "date-only",
  cueAutoGenerate: false,
  activeTab: "rte",
  lastSourceTab: "rte",
  rteDownloadedAudioByClip: {},
  bbcDownloadedAudioByEpisode: {}
};
const PROGRAM_EPISODES_PER_PAGE = 10;
const BBC_EPISODES_PER_PAGE = 10;
let searchDebounceTimer = null;
let bbcSearchDebounceTimer = null;
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

function setBbcStatus(text, isError = false) {
  bbcResult.className = `status ${isError ? "" : "muted"}`;
  bbcResult.textContent = text;
}

function setButtonBusy(button, busy, normalLabel, busyLabel = "Working...") {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : normalLabel;
}

function setSettingsStatus(text, isError = false) {
  settingsStatus.className = `status ${isError ? "" : "muted"}`;
  settingsStatus.textContent = text;
}

function getActiveSourceType() {
  if (state.activeTab === "bbc") {
    return "bbc";
  }
  if (state.activeTab === "rte") {
    return "rte";
  }
  return state.lastSourceTab === "bbc" ? "bbc" : "rte";
}

function getActiveDownloadDir() {
  return getActiveSourceType() === "bbc" ? state.bbcDownloadDir : state.rteDownloadDir;
}

function updateDownloadDirSourceLabel() {
  if (!downloadDirSourceLabel) {
    return;
  }
  const source = getActiveSourceType() === "bbc" ? "BBC" : "RTE";
  downloadDirSourceLabel.textContent = `Editing folder for: ${source}`;
}

function setActiveDownloadDir(dir) {
  if (getActiveSourceType() === "bbc") {
    state.bbcDownloadDir = dir;
    return;
  }
  state.rteDownloadDir = dir;
}

function setActiveTab(tabName) {
  state.activeTab = tabName === "bbc" || tabName === "settings" ? tabName : "rte";
  if (state.activeTab === "rte" || state.activeTab === "bbc") {
    state.lastSourceTab = state.activeTab;
  }
  const isRte = state.activeTab === "rte";
  const isBbc = state.activeTab === "bbc";
  const isSettings = state.activeTab === "settings";
  rteTabContent.classList.toggle("hidden", !isRte);
  bbcTabContent.classList.toggle("hidden", !isBbc);
  settingsTabContent.classList.toggle("hidden", !isSettings);
  tabRteBtn.classList.toggle("active-tab", isRte);
  tabBbcBtn.classList.toggle("active-tab", isBbc);
  tabSettingsBtn.classList.toggle("active-tab", isSettings);
  downloadDirInput.value = getActiveDownloadDir();
  updateDownloadDirSourceLabel();
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

function setUrlParam(inputUrl, key, value) {
  try {
    const url = new URL(inputUrl);
    url.searchParams.set(key, value);
    return url.toString();
  } catch {
    const glue = String(inputUrl).includes("?") ? "&" : "?";
    return `${inputUrl}${glue}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
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

async function refreshLivePanel() {
  const selectedId = Number(stationSelect.value);
  if (!Number.isFinite(selectedId)) {
    return;
  }

  const info = await window.rteDownloader.getLiveNow(selectedId);
  liveNow.innerHTML = `<strong>${escapeHtml(info.stationName)}</strong> - ${escapeHtml(info.programmeName)}<br>${escapeHtml(info.description)}`;
  const baseSrc = `https://www.rte.ie/bosco/components/player/iframe.html?radioUI=true&autostart=false&app_name=rnn&clipid=${selectedId}`;
  livePlayerFrame.src = baseSrc;
  setLiveOverlayTarget(liveOverlayPlayBtn, setUrlParam(baseSrc, "autostart", "true"));
}

async function loadLiveStations() {
  state.liveStations = await window.rteDownloader.getLiveStations();
  stationSelect.innerHTML = state.liveStations
    .map((station) => `<option value="${station.id}">${escapeHtml(station.name)}</option>`)
    .join("");

  await refreshLivePanel();
}

async function refreshBbcLivePanel() {
  const selectedId = String(bbcStationSelect.value || "").trim();
  if (!selectedId) {
    bbcLiveNow.textContent = "No BBC station selected.";
    bbcLivePlayerFrame.src = "";
    setLiveOverlayTarget(bbcLiveOverlayPlayBtn, "");
    return;
  }

  const station = (state.bbcLiveStations || []).find((item) => String(item.id) === selectedId);
  if (!station) {
    bbcLiveNow.textContent = "Station not found.";
    bbcLivePlayerFrame.src = "";
    setLiveOverlayTarget(bbcLiveOverlayPlayBtn, "");
    return;
  }

  bbcLiveNow.innerHTML = `<strong>${escapeHtml(station.name)}</strong> - <a href="${escapeHtml(station.liveUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(station.liveUrl)}</a>`;
  const baseSrc = `${setUrlParam(setUrlParam(setUrlParam(station.liveUrl, "autoplay", "0"), "autostart", "false"), "play", "1")}#play`;
  const autoplaySrc = buildBbcAutoplayCandidates(station.liveUrl)[0] || "";
  bbcLivePlayerFrame.src = baseSrc;
  bbcLiveOverlayPlayBtn.dataset.stationUrl = station.liveUrl;
  setLiveOverlayTarget(bbcLiveOverlayPlayBtn, autoplaySrc);
}

async function loadBbcLiveStations() {
  state.bbcLiveStations = await window.rteDownloader.getBbcLiveStations();
  bbcStationSelect.innerHTML = state.bbcLiveStations
    .map((station) => `<option value="${escapeHtml(station.id)}">${escapeHtml(station.name)}</option>`)
    .join("");
  await refreshBbcLivePanel();
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

function hideBbcSearchDropdown() {
  bbcProgramSearchResult.classList.add("hidden");
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

async function runBbcProgramSearch(query) {
  const q = String(query || "").trim();
  if (q.length < 2) {
    bbcProgramSearchResult.classList.remove("hidden");
    bbcProgramSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
    return;
  }

  setButtonBusy(bbcProgramSearchBtn, true, "Search");
  bbcProgramSearchResult.classList.remove("hidden");
  bbcProgramSearchResult.innerHTML = `<div class="item">Searching...</div>`;

  try {
    const items = await window.rteDownloader.searchBbcPrograms(q);
    if (!items.length) {
      bbcProgramSearchResult.innerHTML = `<div class="item">No BBC programs found.</div>`;
      return;
    }

    bbcProgramSearchResult.innerHTML = items
      .map((item) => {
        const imageHtml = item.image
          ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || "BBC Program")}" loading="lazy" />`
          : `<img alt="No artwork" loading="lazy" />`;

        return `
        <div class="item clickable" data-load-bbc-program-url="${escapeHtml(item.programUrl)}">
          <div class="search-card">
            <div>${imageHtml}</div>
            <div>
              <div class="item-title">${escapeHtml(item.title || "BBC Program")}</div>
              ${item.description ? `<div class="item-meta">${escapeHtml(item.description)}</div>` : ""}
              <div class="item-meta">${escapeHtml(item.programUrl)}</div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (error) {
    bbcProgramSearchResult.innerHTML = `<div class="item">${escapeHtml(error.message)}</div>`;
  } finally {
    setButtonBusy(bbcProgramSearchBtn, false, "Search");
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

function renderChapters(chapters) {
  const rows = Array.isArray(chapters) ? chapters : [];
  if (!rows.length) {
    return `<div class="playlist-note">No chapters generated.</div>`;
  }
  return `
    <div class="playlist-grid compact-playlist-grid">
      ${rows
        .map((chapter) => `
          <div class="playlist-track">
            <div>${escapeHtml(chapter.start || "00:00")}</div>
            <div>
              <div class="item-title">${escapeHtml(chapter.title || "")}</div>
              <div class="item-meta">${escapeHtml(chapter.artist || "")}</div>
            </div>
          </div>
        `)
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

function setBbcEpisodeStatus(episodeUrl, text, isError = false) {
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

function setEpisodeChapters(clipId, chapters) {
  const node = document.querySelector(`[data-episode-chapters="${clipId}"]`);
  if (!node) {
    return;
  }
  node.innerHTML = renderChapters(chapters);
}

function setBbcEpisodeChapters(episodeUrl, chapters) {
  const key = encodeURIComponent(String(episodeUrl || ""));
  const node = document.querySelector(`[data-bbc-episode-chapters="${key}"]`);
  if (!node) {
    return;
  }
  node.innerHTML = renderChapters(chapters);
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

async function loadBbcEpisodePlaylistInto(episodeUrl) {
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
    container.innerHTML = renderPlaylistTracks(payload.tracks || []);
  } catch (error) {
    container.innerHTML = `<div class="playlist-note">Music load failed: ${escapeHtml(error.message)}</div>`;
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

async function autoLoadVisibleBbcPlaylists(episodes) {
  const queue = (episodes || []).filter((episode) => episode.episodeUrl);
  const concurrency = 2;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const next = queue[index];
      index += 1;
      await loadBbcEpisodePlaylistInto(next.episodeUrl);
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
            <button class="secondary" data-generate-cue-clip="${escapeHtml(clipId)}" data-generate-cue-title="${escapeHtml(episode.title)}" data-generate-cue-program-title="${escapeHtml(payload.title || "")}" data-generate-cue-url="${escapeHtml(episode.episodeUrl || "")}">Generate CUE</button>
          </div>
          <div class="item-meta episode-status" data-episode-status="${escapeHtml(clipId)}" style="display:none;"></div>
          <div class="episode-inline-playlist" data-episode-chapters="${escapeHtml(clipId)}"></div>
          <div class="episode-inline-playlist" data-episode-playlist="${escapeHtml(clipId)}">
            <div class="playlist-note">Queued playlist load...</div>
          </div>
        </div>
      `;
    })
    .join("");

  autoLoadVisiblePlaylists(visibleRows).catch(() => {});
}

function renderBbcEpisodes(payload) {
  const rows = Array.isArray(payload?.episodes) ? payload.episodes : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / BBC_EPISODES_PER_PAGE));
  const currentPage = Math.max(1, Math.min(totalPages, Number(state.bbcProgramPage || 1)));
  const start = (currentPage - 1) * BBC_EPISODES_PER_PAGE;
  const visibleRows = rows.slice(start, start + BBC_EPISODES_PER_PAGE);

  if (!rows.length) {
    bbcEpisodesResult.innerHTML = `<div class="item">No episodes found.</div>`;
    return;
  }

  bbcEpisodesResult.innerHTML = visibleRows
    .map((episode) => {
      const episodeUrl = String(episode.episodeUrl || "").trim();
      const downloadUrl = String(episode.downloadUrl || episodeUrl).trim();
      const episodeStatusKey = encodeURIComponent(episodeUrl);
      const duration = formatDurationFromSeconds(episode.durationSeconds);
      const published = String(episode.publishedTime || "").trim();
      const description = String(episode.description || "").trim();

      return `
        <div class="item">
          <div class="item-title">${escapeHtml(episode.title)}</div>
          <div class="item-meta">
            ${published ? escapeHtml(published) : "Date unknown"}
            ${duration ? ` - ${escapeHtml(duration)}` : ""}
          </div>
          ${description ? `<div class="item-meta">${escapeHtml(description)}</div>` : ""}
          <div class="item-actions">
            <button data-bbc-episode-url="${escapeHtml(episodeUrl)}" data-bbc-download-url="${escapeHtml(downloadUrl)}" data-bbc-episode-title="${escapeHtml(episode.title)}" data-bbc-program-title="${escapeHtml(payload.title || "BBC")}">Download</button>
            <button class="secondary" data-bbc-generate-cue-url="${escapeHtml(episodeUrl)}" data-bbc-generate-cue-title="${escapeHtml(episode.title)}" data-bbc-generate-cue-program-title="${escapeHtml(payload.title || "BBC")}">Generate CUE</button>
          </div>
          <div class="item-meta episode-status" data-bbc-episode-status="${episodeStatusKey}" style="display:none;"></div>
          <div class="episode-inline-playlist" data-bbc-episode-chapters="${episodeStatusKey}"></div>
          <div class="episode-inline-playlist" data-bbc-episode-playlist="${episodeStatusKey}">
            <div class="playlist-note">Music Played: loading...</div>
          </div>
        </div>
      `;
    })
    .join("");

  autoLoadVisibleBbcPlaylists(visibleRows).catch(() => {});
}

async function loadBbcProgram(programUrl, page = 1) {
  const payload = await window.rteDownloader.getBbcProgramEpisodes(programUrl, 1);
  const totalRows = Number(payload?.episodes?.length || 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / BBC_EPISODES_PER_PAGE));
  const targetPage = Math.max(1, Math.min(totalPages, Number(page) || 1));

  state.bbcProgramUrl = payload.programUrl;
  state.bbcProgramPage = targetPage;
  state.bbcProgramMaxPages = totalPages;
  state.bbcEpisodesPayload = payload;

  bbcProgramUrlInput.value = payload.programUrl;
  bbcProgramMeta.innerHTML = `
    <strong>${escapeHtml(payload.title || "BBC Program")}</strong><br>
    ${escapeHtml(payload.description || "")}<br>
    ${payload.runSchedule ? `${escapeHtml(addLocalTimeHint(payload.runSchedule))}<br>` : ""}
    ${payload.nextBroadcastAt ? `Next show: ${escapeHtml(payload.nextBroadcastAt)}${payload.nextBroadcastTitle ? ` - ${escapeHtml(payload.nextBroadcastTitle)}` : ""}<br>` : ""}
    Cadence guess: <strong>${escapeHtml(payload.cadence || "unknown")}</strong>
    ${payload.averageDaysBetween ? ` (${escapeHtml(payload.averageDaysBetween)} day average)` : ""}<br>
    Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
  `;

  renderBbcEpisodes(payload);
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

async function refreshBbcSchedules() {
  const schedules = await window.rteDownloader.listBbcSchedules();
  if (!schedules.length) {
    bbcScheduleList.innerHTML = `<div class="item">No BBC schedules yet.</div>`;
    return;
  }

  bbcScheduleList.innerHTML = schedules
    .map(
      (s) => `
        <div class="item">
          <div class="item-title">${escapeHtml(s.title)}</div>
          <div class="item-meta">
            ${s.runSchedule ? `Runs: ${escapeHtml(addLocalTimeHint(s.runSchedule))}<br>` : ""}
            ${s.nextBroadcastAt ? `Next show: ${escapeHtml(s.nextBroadcastAt)}${s.nextBroadcastTitle ? ` - ${escapeHtml(s.nextBroadcastTitle)}` : ""}<br>` : ""}
            Status: ${escapeHtml(s.lastStatus || "Idle")} - Cadence: ${escapeHtml(s.cadence || "unknown")}<br>
            Backfill setting: ${s.initialBackfillCount ? `latest ${escapeHtml(s.initialBackfillCount)} on create` : "new episodes only"}<br>
            Last checked: ${escapeHtml(s.lastCheckedAt || "never")} - Last run: ${escapeHtml(s.lastRunAt || "never")}
          </div>
          <div class="item-actions">
            <button class="secondary" data-bbc-schedule-toggle="${escapeHtml(s.id)}" data-enabled="${s.enabled ? "1" : "0"}">${s.enabled ? "Pause" : "Enable"}</button>
            <button class="secondary" data-bbc-schedule-run="${escapeHtml(s.id)}">Run Now</button>
            <button class="secondary" data-bbc-schedule-remove="${escapeHtml(s.id)}">Remove</button>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadSettings() {
  const settings = await window.rteDownloader.getSettings();
  state.timeFormat = settings?.timeFormat === "12h" ? "12h" : "24h";
  state.rteDownloadDir = String(settings?.rteDownloadDir || settings?.downloadDir || "");
  state.bbcDownloadDir = String(settings?.bbcDownloadDir || "");
  state.episodeNameMode = settings?.episodeNameMode === "full-title" ? "full-title" : "date-only";
  state.cueAutoGenerate = Boolean(settings?.cueAutoGenerate);
  timeFormatSelect.value = state.timeFormat;
  downloadDirInput.value = getActiveDownloadDir();
  episodeNameModeSelect.value = state.episodeNameMode;
  cueAutoGenerateCheckbox.checked = state.cueAutoGenerate;
  updateDownloadDirSourceLabel();
}

async function refreshTimeBasedUi() {
  await refreshSchedules();
  await refreshBbcSchedules();
  if (state.currentProgramUrl) {
    await loadProgram(state.currentProgramUrl, state.currentProgramPage);
  }
  if (state.bbcProgramUrl) {
    await loadBbcProgram(state.bbcProgramUrl, state.bbcProgramPage);
  }
}

quickDownloadBtn.addEventListener("click", async () => {
  const pageUrl = quickUrlInput.value.trim();
  if (!pageUrl) {
    setQuickStatus("Enter an RTE episode URL.", true);
    return;
  }

  const forceDownload = quickDownloadBtn.dataset.forceNext === "1";
  if (forceDownload) {
    delete quickDownloadBtn.dataset.forceNext;
  }
  setButtonBusy(quickDownloadBtn, true, "Download");
  quickLog.textContent = "";
  setQuickStatus(forceDownload ? "Forcing re-download..." : "Resolving title and stream...");
  const progressToken = createProgressToken("quick");
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setQuickStatus(formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadFromPageUrl(pageUrl, progressToken, { forceDownload });
    const cueText = data?.cue?.cuePath ? " + CUE/chapters generated" : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Saved";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setQuickStatus(`${statusPrefix}: ${data.outputDir}\\${data.fileName}${cueText}${hintText}`);
    if (data?.existing) {
      quickDownloadBtn.dataset.forceNext = "1";
    } else {
      delete quickDownloadBtn.dataset.forceNext;
    }
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

bbcDownloadBtn.addEventListener("click", async () => {
  const pageUrl = bbcUrlInput.value.trim();
  if (!pageUrl) {
    setBbcStatus("Enter a BBC URL.", true);
    return;
  }

  const forceDownload = bbcDownloadBtn.dataset.forceNext === "1";
  if (forceDownload) {
    delete bbcDownloadBtn.dataset.forceNext;
  }
  setButtonBusy(bbcDownloadBtn, true, "Download");
  bbcLog.textContent = "";
  setBbcStatus(forceDownload ? "Forcing re-download..." : "Resolving stream...");
  const progressToken = createProgressToken("bbc");
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setBbcStatus(formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadFromBbcUrl(pageUrl, progressToken, { forceDownload });
    const cueText = data?.cue?.cuePath ? " + CUE/chapters generated" : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Saved";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setBbcStatus(`${statusPrefix}: ${data.outputDir}\\${data.fileName}${cueText}${hintText}`);
    if (data?.existing) {
      bbcDownloadBtn.dataset.forceNext = "1";
    } else {
      delete bbcDownloadBtn.dataset.forceNext;
    }
    bbcLog.textContent = data.log || "Done.";
  } catch (error) {
    setBbcStatus(error.message, true);
  } finally {
    detachProgress();
    setButtonBusy(bbcDownloadBtn, false, "Download");
  }
});

bbcUrlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  if (!bbcDownloadBtn.disabled) {
    bbcDownloadBtn.click();
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

bbcStationSelect.addEventListener("change", () => {
  refreshBbcLivePanel().catch((error) => {
    bbcLiveNow.textContent = error.message;
  });
});

bbcRefreshLiveBtn.addEventListener("click", () => {
  setButtonBusy(bbcRefreshLiveBtn, true, "Refresh");
  loadBbcLiveStations()
    .catch((error) => {
      bbcLiveNow.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(bbcRefreshLiveBtn, false, "Refresh");
    });
});

liveOverlayPlayBtn.addEventListener("click", () => {
  const rawSrc = liveOverlayPlayBtn.dataset.autoplaySrc || "";
  if (!rawSrc) {
    return;
  }
  const autoplaySrc = setUrlParam(rawSrc, "_ts", String(Date.now()));
  livePlayerFrame.src = autoplaySrc;
  liveOverlayPlayBtn.classList.add("hidden");
});

bbcLiveOverlayPlayBtn.addEventListener("click", () => {
  const stationUrl = bbcLiveOverlayPlayBtn.dataset.stationUrl || "";
  const candidates = buildBbcAutoplayCandidates(stationUrl);
  if (!candidates.length) {
    return;
  }
  const ts = String(Date.now());
  bbcLivePlayerFrame.src = setUrlParam(candidates[0], "_ts", ts);
  if (candidates[1]) {
    setTimeout(() => {
      bbcLivePlayerFrame.src = setUrlParam(candidates[1], "_ts", String(Date.now()));
    }, 450);
  }
  if (candidates[2]) {
    setTimeout(() => {
      bbcLivePlayerFrame.src = setUrlParam(candidates[2], "_ts", String(Date.now()));
    }, 1000);
  }
  bbcLiveOverlayPlayBtn.classList.add("hidden");
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

bbcProgramSearchResult.addEventListener("click", (event) => {
  const item = event.target.closest(".item[data-load-bbc-program-url]");
  if (!item) {
    return;
  }

  const url = item.getAttribute("data-load-bbc-program-url");
  if (url) {
    hideBbcSearchDropdown();
    loadBbcProgram(url, 1).catch((error) => {
      bbcProgramMeta.textContent = error.message;
    });
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".search-box")) {
    return;
  }
  hideSearchDropdown();
  hideBbcSearchDropdown();
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

bbcLoadProgramBtn.addEventListener("click", () => {
  const url = bbcProgramUrlInput.value.trim();
  if (!url) {
    bbcProgramMeta.textContent = "Enter a BBC program URL first.";
    return;
  }

  setButtonBusy(bbcLoadProgramBtn, true, "Load Episodes");
  loadBbcProgram(url, 1)
    .catch((error) => {
      bbcProgramMeta.textContent = error.message;
    })
    .finally(() => {
      setButtonBusy(bbcLoadProgramBtn, false, "Load Episodes");
    });
});

bbcProgramSearchBtn.addEventListener("click", async () => {
  await runBbcProgramSearch(bbcProgramSearchInput.value.trim());
});

bbcProgramSearchInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  await runBbcProgramSearch(bbcProgramSearchInput.value.trim());
});

bbcProgramSearchInput.addEventListener("focus", async () => {
  if (state.hasLoadedBbcProgramCatalog) {
    bbcProgramSearchResult.classList.remove("hidden");
    return;
  }
  bbcProgramSearchResult.classList.remove("hidden");
  bbcProgramSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
  state.hasLoadedBbcProgramCatalog = true;
});

bbcProgramSearchInput.addEventListener("input", async () => {
  if (bbcSearchDebounceTimer) {
    clearTimeout(bbcSearchDebounceTimer);
  }

  const query = bbcProgramSearchInput.value.trim();
  bbcSearchDebounceTimer = setTimeout(async () => {
    if (query.length < 2) {
      bbcProgramSearchResult.classList.remove("hidden");
      bbcProgramSearchResult.innerHTML = `<div class="item">Type at least 2 characters to search BBC programs.</div>`;
      return;
    }

    await runBbcProgramSearch(query);
  }, 220);
});

bbcProgramUrlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  if (!bbcLoadProgramBtn.disabled) {
    bbcLoadProgramBtn.click();
  }
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

bbcPrevPageBtn.addEventListener("click", () => {
  if (!state.bbcProgramUrl || state.bbcProgramPage <= 1) {
    return;
  }

  state.bbcProgramPage -= 1;
  renderBbcEpisodes(state.bbcEpisodesPayload || { episodes: [] });
  const totalRows = Number(state.bbcEpisodesPayload?.episodes?.length || 0);
  bbcProgramMeta.innerHTML = `
    <strong>${escapeHtml(state.bbcEpisodesPayload?.title || "BBC Program")}</strong><br>
    ${escapeHtml(state.bbcEpisodesPayload?.description || "")}<br>
    ${state.bbcEpisodesPayload?.runSchedule ? `${escapeHtml(addLocalTimeHint(state.bbcEpisodesPayload.runSchedule))}<br>` : ""}
    ${state.bbcEpisodesPayload?.nextBroadcastAt ? `Next show: ${escapeHtml(state.bbcEpisodesPayload.nextBroadcastAt)}${state.bbcEpisodesPayload?.nextBroadcastTitle ? ` - ${escapeHtml(state.bbcEpisodesPayload.nextBroadcastTitle)}` : ""}<br>` : ""}
    Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
  `;
});

bbcNextPageBtn.addEventListener("click", () => {
  if (!state.bbcProgramUrl || !state.bbcEpisodesPayload) {
    return;
  }

  if (state.bbcProgramPage >= state.bbcProgramMaxPages) {
    return;
  }

  state.bbcProgramPage += 1;
  renderBbcEpisodes(state.bbcEpisodesPayload || { episodes: [] });
  const totalRows = Number(state.bbcEpisodesPayload?.episodes?.length || 0);
  bbcProgramMeta.innerHTML = `
    <strong>${escapeHtml(state.bbcEpisodesPayload?.title || "BBC Program")}</strong><br>
    ${escapeHtml(state.bbcEpisodesPayload?.description || "")}<br>
    ${state.bbcEpisodesPayload?.runSchedule ? `${escapeHtml(addLocalTimeHint(state.bbcEpisodesPayload.runSchedule))}<br>` : ""}
    ${state.bbcEpisodesPayload?.nextBroadcastAt ? `Next show: ${escapeHtml(state.bbcEpisodesPayload.nextBroadcastAt)}${state.bbcEpisodesPayload?.nextBroadcastTitle ? ` - ${escapeHtml(state.bbcEpisodesPayload.nextBroadcastTitle)}` : ""}<br>` : ""}
    Page ${state.bbcProgramPage} of ${state.bbcProgramMaxPages} - ${totalRows} episodes
  `;
});

tabRteBtn.addEventListener("click", () => {
  setActiveTab("rte");
});

tabBbcBtn.addEventListener("click", () => {
  setActiveTab("bbc");
});

tabSettingsBtn.addEventListener("click", () => {
  setActiveTab("settings");
});

themeToggleBtn.addEventListener("click", () => {
  applyTheme(state.theme === "dark" ? "light" : "dark");
});

scheduleBackfillMode.addEventListener("change", () => {
  const isBackfill = scheduleBackfillMode.value === "backfill";
  scheduleBackfillCount.disabled = !isBackfill;
});

bbcScheduleBackfillMode.addEventListener("change", () => {
  const isBackfill = bbcScheduleBackfillMode.value === "backfill";
  bbcScheduleBackfillCount.disabled = !isBackfill;
});

chooseDownloadDirBtn.addEventListener("click", async () => {
  setButtonBusy(chooseDownloadDirBtn, true, "Choose Folder", "Opening...");
  try {
    const chosen = await window.rteDownloader.pickDownloadDirectory(getActiveSourceType());
    if (chosen) {
      downloadDirInput.value = chosen;
      setActiveDownloadDir(chosen);
      setSettingsStatus("Folder selected. Click Save Settings to apply.");
    }
  } catch (error) {
    setSettingsStatus(error.message, true);
  } finally {
    setButtonBusy(chooseDownloadDirBtn, false, "Choose Folder");
  }
});

saveSettingsBtn.addEventListener("click", async () => {
  const activeDownloadDir = downloadDirInput.value.trim();
  const timeFormat = timeFormatSelect.value === "12h" ? "12h" : "24h";
  const episodeNameMode = episodeNameModeSelect.value === "full-title" ? "full-title" : "date-only";
  const cueAutoGenerate = Boolean(cueAutoGenerateCheckbox.checked);

  if (!activeDownloadDir) {
    setSettingsStatus("Choose a download directory first.", true);
    return;
  }

  setButtonBusy(saveSettingsBtn, true, "Save Settings", "Saving...");
  try {
    setActiveDownloadDir(activeDownloadDir);
    const saved = await window.rteDownloader.saveSettings({
      timeFormat,
      rteDownloadDir: state.rteDownloadDir,
      bbcDownloadDir: state.bbcDownloadDir,
      episodeNameMode,
      cueAutoGenerate
    });
    state.timeFormat = saved.timeFormat === "12h" ? "12h" : "24h";
    state.rteDownloadDir = String(saved.rteDownloadDir || saved.downloadDir || "");
    state.bbcDownloadDir = String(saved.bbcDownloadDir || "");
    state.episodeNameMode = saved.episodeNameMode === "full-title" ? "full-title" : "date-only";
    state.cueAutoGenerate = Boolean(saved.cueAutoGenerate);
    timeFormatSelect.value = state.timeFormat;
    downloadDirInput.value = getActiveDownloadDir();
    episodeNameModeSelect.value = state.episodeNameMode;
    cueAutoGenerateCheckbox.checked = state.cueAutoGenerate;
    updateDownloadDirSourceLabel();
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

bbcAddScheduleBtn.addEventListener("click", async () => {
  if (!state.bbcProgramUrl) {
    bbcProgramMeta.textContent = "Load a BBC program first.";
    return;
  }

  const backfillCount = bbcScheduleBackfillMode.value === "backfill"
    ? Math.max(1, Math.floor(Number(bbcScheduleBackfillCount.value || 1)))
    : 0;

  setButtonBusy(bbcAddScheduleBtn, true, "Add Scheduler", "Adding...");

  try {
    await window.rteDownloader.addBbcSchedule(state.bbcProgramUrl, { backfillCount });
    await refreshBbcSchedules();
  } catch (error) {
    bbcProgramMeta.textContent = error.message;
  } finally {
    setButtonBusy(bbcAddScheduleBtn, false, "Add Scheduler");
  }
});

episodesResult.addEventListener("click", async (event) => {
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
    try {
      const cue = await window.rteDownloader.generateCue({
        sourceType: "rte",
        episodeUrl: episodeUrlCue,
        title: titleCue,
        programTitle: programTitleCue,
        outputDir: saved.outputDir,
        fileName: saved.fileName
      });
      setEpisodeChapters(clipIdCue, cue.chapters || []);
      setEpisodeStatus(clipIdCue, `CUE ready: ${cue.cuePath}`);
    } catch (error) {
      setEpisodeStatus(clipIdCue, `CUE failed: ${error.message}`, true);
    } finally {
      setButtonBusy(cueBtn, false, "Generate CUE");
    }
    return;
  }

  const clipId = downloadBtn.getAttribute("data-download-clip");
  const title = downloadBtn.getAttribute("data-download-title") || "rte-episode";
  const programTitle = downloadBtn.getAttribute("data-download-program-title") || "";
  const episodeUrl = downloadBtn.getAttribute("data-download-url") || "";

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
    const data = await window.rteDownloader.downloadEpisode({ clipId, title, programTitle, episodeUrl, progressToken, forceDownload });
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
    const cueText = data?.cue?.cuePath ? " + CUE ready" : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Downloaded";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setEpisodeStatus(clipId, `${statusPrefix}: ${data.fileName}${cueText}${hintText}`);
    if (data?.existing) {
      downloadBtn.dataset.forceNext = "1";
    } else {
      delete downloadBtn.dataset.forceNext;
    }
  } catch (error) {
    setEpisodeStatus(clipId, `Download failed: ${error.message}`, true);
  } finally {
    detachProgress();
    setButtonBusy(downloadBtn, false, "Download");
  }
});

bbcEpisodesResult.addEventListener("click", async (event) => {
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
      setBbcEpisodeStatus(episodeUrlCue, "Download episode first, then generate CUE.", true);
      return;
    }
    setButtonBusy(cueBtn, true, "Generate CUE", "Generating...");
    setBbcEpisodeStatus(episodeUrlCue, "Generating CUE/chapters...");
    try {
      const cue = await window.rteDownloader.generateCue({
        sourceType: "bbc",
        episodeUrl: episodeUrlCue,
        title: titleCue,
        programTitle: programTitleCue,
        outputDir: saved.outputDir,
        fileName: saved.fileName
      });
      setBbcEpisodeChapters(episodeUrlCue, cue.chapters || []);
      setBbcEpisodeStatus(episodeUrlCue, `CUE ready: ${cue.cuePath}`);
    } catch (error) {
      setBbcEpisodeStatus(episodeUrlCue, `CUE failed: ${error.message}`, true);
    } finally {
      setButtonBusy(cueBtn, false, "Generate CUE");
    }
    return;
  }

  const episodeUrl = downloadBtn.getAttribute("data-bbc-episode-url") || "";
  const downloadUrl = downloadBtn.getAttribute("data-bbc-download-url") || episodeUrl;
  const title = downloadBtn.getAttribute("data-bbc-episode-title") || "bbc-episode";
  const programTitle = downloadBtn.getAttribute("data-bbc-program-title") || "BBC";
  if (!episodeUrl) {
    return;
  }

  const forceDownload = downloadBtn.dataset.forceNext === "1";
  if (forceDownload) {
    delete downloadBtn.dataset.forceNext;
  }
  setBbcEpisodeStatus(episodeUrl, forceDownload ? "Forcing re-download..." : "Starting download...");
  setButtonBusy(downloadBtn, true, "Download", "Downloading...");
  const progressToken = createProgressToken("bbc-episode");
  const detachProgress = attachDownloadProgress(progressToken, (progress) => {
    setBbcEpisodeStatus(episodeUrl, formatProgressText(progress, "Downloading..."));
  });

  try {
    const data = await window.rteDownloader.downloadFromBbcUrl(downloadUrl, progressToken, { title, programTitle, forceDownload });
    state.bbcDownloadedAudioByEpisode[episodeUrl] = {
      outputDir: data.outputDir,
      fileName: data.fileName,
      episodeUrl,
      title,
      programTitle
    };
    if (Array.isArray(data?.cue?.chapters) && data.cue.chapters.length) {
      setBbcEpisodeChapters(episodeUrl, data.cue.chapters);
    }
    const cueText = data?.cue?.cuePath ? " + CUE ready" : "";
    const statusPrefix = data?.existing ? "Already downloaded" : "Downloaded";
    const panelPrefix = data?.existing ? "Already downloaded" : "Saved";
    const hintText = data?.existing ? " (click Download again to force re-download)" : "";
    setBbcEpisodeStatus(episodeUrl, `${statusPrefix}: ${data.fileName}${cueText}${hintText}`);
    setBbcStatus(`${panelPrefix}: ${data.outputDir}\\${data.fileName}${cueText}`);
    if (data?.existing) {
      downloadBtn.dataset.forceNext = "1";
    } else {
      delete downloadBtn.dataset.forceNext;
    }
  } catch (error) {
    setBbcEpisodeStatus(episodeUrl, `Download failed: ${error.message}`, true);
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

bbcScheduleList.addEventListener("click", async (event) => {
  const toggleBtn = event.target.closest("button[data-bbc-schedule-toggle]");
  if (toggleBtn) {
    const id = toggleBtn.getAttribute("data-bbc-schedule-toggle");
    const enabled = toggleBtn.getAttribute("data-enabled") !== "1";
    await window.rteDownloader.setBbcScheduleEnabled(id, enabled);
    await refreshBbcSchedules();
    return;
  }

  const runBtn = event.target.closest("button[data-bbc-schedule-run]");
  if (runBtn) {
    const id = runBtn.getAttribute("data-bbc-schedule-run");
    setButtonBusy(runBtn, true, "Run Now", "Running...");
    try {
      await window.rteDownloader.runBbcScheduleNow(id);
      await refreshBbcSchedules();
    } finally {
      setButtonBusy(runBtn, false, "Run Now");
    }
    return;
  }

  const removeBtn = event.target.closest("button[data-bbc-schedule-remove]");
  if (removeBtn) {
    const id = removeBtn.getAttribute("data-bbc-schedule-remove");
    await window.rteDownloader.removeBbcSchedule(id);
    await refreshBbcSchedules();
  }
});

(async function bootstrap() {
  try {
    const savedTheme = localStorage.getItem("kimble_theme") || "dark";
    applyTheme(savedTheme);
    setActiveTab("rte");
    scheduleBackfillCount.disabled = true;
    bbcScheduleBackfillCount.disabled = true;
    await loadSettings();
    await Promise.all([loadLiveStations(), loadBbcLiveStations(), refreshSchedules(), refreshBbcSchedules()]);
    setSettingsStatus("Loaded.");
    setQuickStatus("Ready");
    setBbcStatus("Ready");
  } catch (error) {
    setQuickStatus(error.message, true);
    setBbcStatus(error.message, true);
    setSettingsStatus(error.message, true);
  }
})();
