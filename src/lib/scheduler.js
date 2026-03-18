const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Schedule windows are stored in UTC. The scheduler compares current UTC time
// against these windows. Display layers convert UTC → user's local timezone.
const RELEASE_LAG_WINDOW_MINUTES = 6 * 60;
const RETRY_BACKOFF_MINUTES = [15, 60, 180, 720, 1440, 2880];
const RETRY_MAX_ATTEMPTS = RETRY_BACKOFF_MINUTES.length + 1;
const DAY_TO_INDEX = new Map([
  ["sun", 0], ["sunday", 0], ["sundays", 0],
  ["mon", 1], ["monday", 1], ["mondays", 1],
  ["tue", 2], ["tues", 2], ["tuesday", 2], ["tuesdays", 2],
  ["wed", 3], ["wednesday", 3], ["wednesdays", 3],
  ["thu", 4], ["thur", 4], ["thurs", 4], ["thursday", 4], ["thursdays", 4],
  ["fri", 5], ["friday", 5], ["fridays", 5],
  ["sat", 6], ["saturday", 6], ["saturdays", 6]
]);

function parseHhMm(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }

  return hh * 60 + mm;
}

function parseDayToken(token) {
  return DAY_TO_INDEX.get(String(token || "").trim().toLowerCase()) ?? null;
}

function expandDayRange(startDay, endDay) {
  const out = [];
  if (startDay == null || endDay == null) {
    return out;
  }

  let current = startDay;
  out.push(current);
  while (current !== endDay) {
    current = (current + 1) % 7;
    out.push(current);
    if (out.length > 8) {
      break;
    }
  }
  return out;
}

function parseDaysExpression(input) {
  const text = String(input || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .trim();

  if (!text) {
    return [];
  }

  const rangeMatch = text.match(/\b([a-z]+)\s*-\s*([a-z]+)\b/);
  if (rangeMatch) {
    const start = parseDayToken(rangeMatch[1]);
    const end = parseDayToken(rangeMatch[2]);
    const expanded = expandDayRange(start, end);
    if (expanded.length) {
      return expanded;
    }
  }

  const tokens = text.split(/[^a-z]+/g).filter(Boolean);
  const days = [];
  for (const token of tokens) {
    const day = parseDayToken(token);
    if (day != null && !days.includes(day)) {
      days.push(day);
    }
  }
  return days;
}

function parseRunScheduleWindows(runScheduleText) {
  const raw = String(runScheduleText || "").trim();
  if (!raw) {
    return [];
  }

  const segments = raw.split(/\s*,\s*/g);
  const windows = [];

  for (const segment of segments) {
    const match = segment.match(/^(.*?)\s*[•]\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
    if (!match) {
      continue;
    }

    const days = parseDaysExpression(match[1]);
    const startMin = parseHhMm(match[2]);
    const endMin = parseHhMm(match[3]);
    if (!days.length || startMin == null || endMin == null) {
      continue;
    }

    const crossesMidnight = endMin <= startMin;

    for (const day of days) {
      let dueDay = (day + (crossesMidnight ? 1 : 0)) % 7;
      let dueMinute = endMin + 30;
      if (dueMinute >= 24 * 60) {
        dueMinute -= 24 * 60;
        dueDay = (dueDay + 1) % 7;
      }

      windows.push({ dueDay, dueMinute });
    }
  }

  return windows;
}

function getUtcNowParts(date = new Date()) {
  const day = date.getUTCDay();
  const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();

  return {
    day,
    minuteOfDay: Number.isFinite(minuteOfDay) ? minuteOfDay : 0
  };
}

function shouldRunInScheduleWindow(schedule, now = new Date()) {
  const windows = parseRunScheduleWindows(schedule.runSchedule || "");
  if (!windows.length) {
    return { shouldRun: null, reason: "No schedule window parsed" };
  }

  const utcNow = getUtcNowParts(now);
  const currentSlot = windows.find((window) => {
    if (window.dueDay !== utcNow.day) {
      return false;
    }
    const delta = utcNow.minuteOfDay - window.dueMinute;
    return delta >= 0 && delta < RELEASE_LAG_WINDOW_MINUTES;
  });

  if (!currentSlot) {
    return { shouldRun: false, reason: "Waiting for end+30m to +6h window" };
  }

  if (schedule.lastCheckedAt) {
    const elapsedMs = Date.now() - Date.parse(schedule.lastCheckedAt);
    if (elapsedMs < 1000 * 60 * 20) {
      return { shouldRun: false, reason: "Skipped (already checked this window)" };
    }
  }

  return { shouldRun: true, reason: "Due window reached" };
}

function toIsoAfterMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getRetryBackoffMinutes(attempts) {
  const idx = Math.max(0, Math.min(RETRY_BACKOFF_MINUTES.length - 1, Number(attempts || 1) - 1));
  return RETRY_BACKOFF_MINUTES[idx];
}

function toRetryItem(episode, error, attempts = 1) {
  const clipId = String(episode?.clipId || "").trim();
  const publishedTime = String(episode?.publishedTime || episode?.publishedTimeFormatted || "").trim();
  const title = String(episode?.fullTitle || episode?.title || "").trim();
  const backoffMinutes = getRetryBackoffMinutes(attempts);

  return {
    clipId,
    title,
    episodeUrl: String(episode?.episodeUrl || "").trim(),
    publishedTime,
    attempts,
    lastError: String(error?.message || error || "Download failed"),
    nextRetryAt: toIsoAfterMinutes(backoffMinutes)
  };
}

function shouldAutoForceRedownload(error) {
  const text = String(error?.message || error || "");
  return /Archive says already downloaded, but matching file was not found in this target folder/i.test(text);
}

function createSchedulerStore({
  app,
  dataDir,
  getProgramSummary,
  getProgramEpisodes,
  runEpisodeDownload,
  onScheduleRefreshed,
  onScheduleRunComplete,
  onScheduleRunError
}) {
  const rootDir = dataDir || (app ? app.getPath("userData") : path.join(process.cwd(), "data"));
  const storagePath = path.join(rootDir, "schedules.json");

  let schedules = [];
  let running = false;
  let timer = null;

  function readStore() {
    try {
      if (!fs.existsSync(storagePath)) {
        schedules = [];
        return;
      }
      const parsed = JSON.parse(fs.readFileSync(storagePath, "utf8"));
      schedules = Array.isArray(parsed) ? parsed : [];
      schedules.forEach((schedule) => {
        normalizeScheduleMetadata(schedule);
        normalizeRetryQueue(schedule);
      });
    } catch {
      schedules = [];
    }
  }

  function writeStore() {
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, JSON.stringify(schedules, null, 2), "utf8");
  }

  function list() {
    return schedules
      .slice()
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }

  function makeId() {
    return crypto.randomBytes(8).toString("hex");
  }

  function findSchedule(scheduleId) {
    return schedules.find((item) => item.id === scheduleId);
  }

  function normalizeMetadataList(value) {
    const raw = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[;,|]+/g)
        : [];
    const out = [];
    const seen = new Set();
    for (const entry of raw) {
      const text = String(entry || "").trim();
      if (!text) {
        continue;
      }
      const key = text.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(text);
    }
    return out;
  }

  function normalizeScheduleMetadata(schedule) {
    schedule.description = String(schedule?.description || "").trim();
    schedule.image = String(schedule?.image || "").trim();
    schedule.location = String(schedule?.location || "").trim();
    schedule.genres = normalizeMetadataList(schedule?.genres);
    schedule.hosts = normalizeMetadataList(schedule?.hosts);
    schedule.latestEpisodeDescription = String(schedule?.latestEpisodeDescription || "").trim();
    schedule.latestEpisodeLocation = String(schedule?.latestEpisodeLocation || "").trim();
    schedule.latestEpisodeGenres = normalizeMetadataList(schedule?.latestEpisodeGenres);
    schedule.latestEpisodeHosts = normalizeMetadataList(schedule?.latestEpisodeHosts);
  }

  function applyProgramMetadata(schedule, metadata) {
    if (!schedule || !metadata) {
      return;
    }
    const description = String(metadata.description || "").trim();
    const image = String(metadata.image || "").trim();
    const location = String(metadata.location || "").trim();
    const genres = normalizeMetadataList(metadata.genres);
    const hosts = normalizeMetadataList(metadata.hosts);

    if (description) {
      schedule.description = description;
    }
    if (image) {
      schedule.image = image;
    }
    if (location) {
      schedule.location = location;
    }
    if (genres.length) {
      schedule.genres = genres;
    }
    if (hosts.length) {
      schedule.hosts = hosts;
    }

    normalizeScheduleMetadata(schedule);
  }

  function setLatestEpisodeFields(schedule, latest) {
    applyProgramMetadata(schedule, latest);
    const episodes = Array.isArray(latest?.episodes) ? latest.episodes : [];
    const top = episodes.find((episode) => episode && (episode.title || episode.clipId));
    if (!top) {
      return;
    }
    schedule.latestEpisodeTitle = String(top.fullTitle || top.title || "");
    schedule.latestEpisodePublishedTime = String(top.publishedTime || top.publishedTimeFormatted || "");
    schedule.latestEpisodeImage = String(top.image || "");
    schedule.latestEpisodeDescription = String(top.description || "").trim();
    schedule.latestEpisodeLocation = String(top.location || "").trim();
    schedule.latestEpisodeGenres = normalizeMetadataList(top.genres);
    schedule.latestEpisodeHosts = normalizeMetadataList(top.hosts);
    if (!schedule.location && schedule.latestEpisodeLocation) {
      schedule.location = schedule.latestEpisodeLocation;
    }
    if (!schedule.genres.length && schedule.latestEpisodeGenres.length) {
      schedule.genres = schedule.latestEpisodeGenres.slice();
    }
    if (!schedule.hosts.length && schedule.latestEpisodeHosts.length) {
      schedule.hosts = schedule.latestEpisodeHosts.slice();
    }
    normalizeScheduleMetadata(schedule);
  }

  function normalizeRetryQueue(schedule) {
    const raw = Array.isArray(schedule.retryQueue) ? schedule.retryQueue : [];
    schedule.retryQueue = raw
      .map((item) => ({
        clipId: String(item?.clipId || "").trim(),
        title: String(item?.title || "").trim(),
        episodeUrl: String(item?.episodeUrl || "").trim(),
        publishedTime: String(item?.publishedTime || "").trim(),
        attempts: Math.max(1, Number(item?.attempts || 1)),
        lastError: String(item?.lastError || ""),
        nextRetryAt: String(item?.nextRetryAt || "")
      }))
      .filter((item) => item.clipId);
  }

  function setLastDownloaded(schedule, payload = {}) {
    const outputDir = String(payload.outputDir || "").trim();
    const fileName = String(payload.fileName || "").trim();
    if (!outputDir || !fileName) {
      return;
    }
    schedule.lastDownloaded = {
      title: String(payload.title || "").trim(),
      clipId: String(payload.clipId || "").trim(),
      episodeUrl: String(payload.episodeUrl || "").trim(),
      image: String(payload.image || "").trim(),
      outputDir,
      fileName,
      filePath: path.join(outputDir, fileName),
      at: new Date().toISOString()
    };
  }

  function upsertRetry(schedule, episode, error) {
    normalizeRetryQueue(schedule);
    const clipId = String(episode?.clipId || "").trim();
    if (!clipId) {
      return null;
    }

    const existing = schedule.retryQueue.find((item) => item.clipId === clipId);
    const attempts = Math.max(1, Number(existing?.attempts || 0) + 1);
    const next = toRetryItem({ ...episode, clipId }, error, attempts);

    if (attempts > RETRY_MAX_ATTEMPTS) {
      schedule.retryQueue = schedule.retryQueue.filter((item) => item.clipId !== clipId);
      return {
        dropped: true,
        clipId,
        error: next.lastError
      };
    }

    if (existing) {
      Object.assign(existing, next);
    } else {
      schedule.retryQueue.push(next);
    }
    return {
      dropped: false,
      clipId,
      attempts
    };
  }

  function removeRetry(schedule, clipId) {
    normalizeRetryQueue(schedule);
    schedule.retryQueue = schedule.retryQueue.filter((item) => item.clipId !== String(clipId || "").trim());
  }

  async function runEpisodeDownloadWithRecovery(payload = {}) {
    try {
      return await runEpisodeDownload(payload);
    } catch (error) {
      if (!shouldAutoForceRedownload(error)) {
        throw error;
      }
      return runEpisodeDownload({
        ...(payload || {}),
        forceDownload: true
      });
    }
  }

  async function runInitialBackfill(schedule, summary, latest, episodes) {
    const rows = Array.isArray(episodes) ? episodes.filter((episode) => episode?.clipId) : [];
    if (!rows.length) {
      return;
    }
    const known = new Set((schedule.downloadedClipIds || []).map((id) => String(id)));
    let completed = 0;
    let failed = 0;
    const downloaded = [];
    schedule.backfillInProgress = true;
    schedule.backfillTotal = rows.length;
    schedule.backfillCompleted = 0;
    schedule.backfillFailed = 0;
    schedule.lastStatus = `Backfill queued 0/${rows.length}`;
    writeStore();

    for (let index = 0; index < rows.length; index += 1) {
      const episode = rows[index];
      const current = index + 1;
      schedule.lastStatus = `Backfill ${current}/${rows.length}: Downloading ${episode.title || episode.clipId}`;
      writeStore();
      try {
        const result = await runEpisodeDownloadWithRecovery({
          ...episode,
          title: String(episode.fullTitle || episode.title || ""),
          programTitle: summary.title
        });
        completed += 1;
        known.add(String(episode.clipId));
        downloaded.push({
          clipId: episode.clipId,
          title: episode.title,
          fileName: result.fileName,
          outputDir: result.outputDir
        });
        setLastDownloaded(schedule, {
          title: episode.title,
          clipId: episode.clipId,
          episodeUrl: episode.episodeUrl,
          image: episode.image || latest?.episodes?.[0]?.image || schedule.latestEpisodeImage || schedule.image || "",
          outputDir: result.outputDir,
          fileName: result.fileName
        });
        removeRetry(schedule, episode.clipId);
        schedule.backfillCompleted = completed;
        schedule.lastRunAt = new Date().toISOString();
        schedule.lastStatus = `Backfill ${completed}/${rows.length}: Downloaded ${result.fileName}`;
      } catch (error) {
        failed += 1;
        const meta = upsertRetry(schedule, episode, error);
        if (meta?.dropped) {
          schedule.lastStatus = `Backfill ${current}/${rows.length}: Failed (max retries) - ${episode.title || episode.clipId}`;
        } else {
          schedule.lastStatus = `Backfill ${current}/${rows.length}: Failed (queued retry) - ${episode.title || episode.clipId}`;
        }
        schedule.backfillFailed = failed;
      }
      writeStore();
    }

    schedule.downloadedClipIds = Array.from(known).slice(-400);
    schedule.backfillInProgress = false;
    schedule.backfillCompleted = completed;
    schedule.backfillFailed = failed;
    const retryPending = Array.isArray(schedule.retryQueue) ? schedule.retryQueue.length : 0;
    if (completed > 0) {
      schedule.lastStatus = `Created and backfilled ${completed}/${rows.length} episode(s)`;
    } else {
      schedule.lastStatus = `Backfill finished with no completed downloads (0/${rows.length})`;
    }
    if (failed > 0) {
      schedule.lastStatus += ` • ${failed} failed`;
    }
    if (retryPending > 0) {
      schedule.lastStatus += ` • ${retryPending} retry pending`;
    }
    writeStore();
    if (downloaded.length > 0 && typeof onScheduleRunComplete === "function") {
      await onScheduleRunComplete(schedule, downloaded);
    }
  }

  async function add(programUrl, options = {}) {
    const existing = schedules.find((item) => item.programUrl === programUrl);
    if (existing) {
      return existing;
    }

    const summary = await getProgramSummary(programUrl);
    const latest = await getProgramEpisodes(programUrl, 1);
    const backfillCount = Math.max(0, Math.floor(Number(options.backfillCount || 0)));
    const known = new Set();
    if (latest.episodes[0]?.clipId) {
      known.add(String(latest.episodes[0].clipId));
    }

    const schedule = {
      id: makeId(),
      programUrl: summary.programUrl,
      title: summary.title,
      description: summary.description,
      image: summary.image || "",
      genres: normalizeMetadataList(summary.genres),
      hosts: normalizeMetadataList(summary.hosts),
      location: String(summary.location || "").trim(),
      runSchedule: summary.runSchedule || "",
      nextBroadcastAt: summary.nextBroadcastAt || "",
      nextBroadcastTitle: summary.nextBroadcastTitle || "",
      enabled: true,
      cadence: latest.cadence,
      averageDaysBetween: latest.averageDaysBetween,
      latestEpisodeTitle: "",
      latestEpisodePublishedTime: "",
      latestEpisodeImage: "",
      latestEpisodeDescription: "",
      latestEpisodeLocation: "",
      latestEpisodeGenres: [],
      latestEpisodeHosts: [],
      lastDownloaded: null,
      downloadedClipIds: Array.from(known),
      retryQueue: [],
      initialBackfillCount: backfillCount,
      backfillInProgress: false,
      backfillTotal: 0,
      backfillCompleted: 0,
      backfillFailed: 0,
      lastCheckedAt: null,
      lastRunAt: null,
      lastStatus: backfillCount > 0
        ? `Created (backfill queued: 0/${backfillCount})`
        : "Created (new episodes only)"
    };
    applyProgramMetadata(schedule, summary);
    setLatestEpisodeFields(schedule, latest);

    schedules.push(schedule);
    writeStore();

    if (backfillCount > 0) {
      const toBackfill = latest.episodes
        .filter((episode) => episode.clipId)
        .slice(0, backfillCount)
        .reverse();
      Promise.resolve()
        .then(() => runInitialBackfill(schedule, summary, latest, toBackfill))
        .catch((error) => {
          schedule.backfillInProgress = false;
          schedule.lastStatus = `Backfill error: ${error.message}`;
          writeStore();
        });
    }

    return schedule;
  }

  function remove(scheduleId) {
    schedules = schedules.filter((item) => item.id !== scheduleId);
    writeStore();
  }

  function setEnabled(scheduleId, enabled) {
    const schedule = findSchedule(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found.");
    }

    schedule.enabled = Boolean(enabled);
    schedule.lastStatus = schedule.enabled ? "Enabled" : "Paused";
    writeStore();
    return schedule;
  }

  async function checkOne(scheduleId) {
    const schedule = findSchedule(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found.");
    }

    return runSchedule(schedule, { force: true });
  }

  async function runSchedule(schedule, { force = false } = {}) {
    if (schedule.backfillInProgress) {
      return {
        scheduleId: schedule.id,
        status: schedule.lastStatus || "Backfill in progress",
        downloaded: []
      };
    }
    if (!schedule.enabled && !force) {
      return { scheduleId: schedule.id, status: "Skipped (paused)", downloaded: [] };
    }

    if (!force) {
      const due = shouldRunInScheduleWindow(schedule);
      if (due.shouldRun === false) {
        return { scheduleId: schedule.id, status: due.reason, downloaded: [] };
      }

      if (due.shouldRun == null && schedule.lastCheckedAt) {
        const now = Date.now();
        const cadence = schedule.cadence || "unknown";
        const minHoursBetweenChecks = cadence === "daily" ? 6 : cadence === "weekly" ? 24 : cadence === "biweekly" ? 48 : cadence === "monthly" ? 72 : 12;
        const elapsedMs = now - Date.parse(schedule.lastCheckedAt);
        if (elapsedMs < minHoursBetweenChecks * 60 * 60 * 1000) {
          return { scheduleId: schedule.id, status: "Skipped (too soon)", downloaded: [] };
        }
      }
    }

    const latest = await getProgramEpisodes(schedule.programUrl, 1);
    if (typeof onScheduleRefreshed === "function") {
      await onScheduleRefreshed(schedule, latest);
    }

    // Only overwrite existing values if the episode list actually returned new ones
    if (latest.cadence != null) schedule.cadence = latest.cadence;
    if (latest.averageDaysBetween != null) schedule.averageDaysBetween = latest.averageDaysBetween;
    if (typeof latest.runSchedule === "string" && latest.runSchedule) {
      schedule.runSchedule = latest.runSchedule;
    }
    if (typeof latest.nextBroadcastAt === "string" && latest.nextBroadcastAt) {
      schedule.nextBroadcastAt = latest.nextBroadcastAt;
    }
    if (typeof latest.nextBroadcastTitle === "string" && latest.nextBroadcastTitle) {
      schedule.nextBroadcastTitle = latest.nextBroadcastTitle;
    }
    schedule.lastCheckedAt = new Date().toISOString();
    setLatestEpisodeFields(schedule, latest);

    const known = new Set((schedule.downloadedClipIds || []).map((id) => String(id)));
    normalizeRetryQueue(schedule);
    const nowMs = Date.now();
    const dueRetries = schedule.retryQueue
      .filter((item) => force || !item.nextRetryAt || Date.parse(item.nextRetryAt) <= nowMs)
      .slice(0, 10);
    const downloaded = [];
    const unseen = [];
    let failedRetries = 0;
    let droppedRetries = 0;

    for (const retry of dueRetries) {
      try {
        const result = await runEpisodeDownloadWithRecovery({
          clipId: retry.clipId,
          title: retry.title,
          episodeUrl: retry.episodeUrl,
          publishedTime: retry.publishedTime,
          programTitle: schedule.title
        });
        downloaded.push({
          clipId: retry.clipId,
          title: retry.title,
          fileName: result.fileName,
          outputDir: result.outputDir
        });
        setLastDownloaded(schedule, {
          title: retry.title,
          clipId: retry.clipId,
          episodeUrl: retry.episodeUrl,
          image: schedule.latestEpisodeImage || schedule.image || "",
          outputDir: result.outputDir,
          fileName: result.fileName
        });
        known.add(String(retry.clipId));
        removeRetry(schedule, retry.clipId);
      } catch (error) {
        failedRetries += 1;
        const meta = upsertRetry(schedule, retry, error);
        if (meta?.dropped) {
          droppedRetries += 1;
        }
      }
    }

    for (const episode of latest.episodes.slice(0, 10)) {
      if (!episode.clipId) {
        continue;
      }
      if (known.has(String(episode.clipId))) {
        break;
      }
      unseen.push(episode);
    }

    const toDownload = unseen.reverse();

    for (const episode of toDownload) {
      try {
        const result = await runEpisodeDownloadWithRecovery({
          ...episode,
          title: String(episode.fullTitle || episode.title || ""),
          programTitle: schedule.title
        });
        downloaded.push({
          clipId: episode.clipId,
          title: episode.title,
          fileName: result.fileName,
          outputDir: result.outputDir
        });
        setLastDownloaded(schedule, {
          title: episode.title,
          clipId: episode.clipId,
          episodeUrl: episode.episodeUrl,
          image: episode.image || schedule.latestEpisodeImage || schedule.image || "",
          outputDir: result.outputDir,
          fileName: result.fileName
        });
        known.add(String(episode.clipId));
        removeRetry(schedule, episode.clipId);
      } catch (error) {
        const meta = upsertRetry(schedule, episode, error);
        if (meta?.dropped) {
          droppedRetries += 1;
        } else {
          failedRetries += 1;
        }
      }
    }

    schedule.downloadedClipIds = Array.from(known).slice(-400);
    if (downloaded.length > 0 || failedRetries > 0 || droppedRetries > 0 || dueRetries.length > 0) {
      schedule.lastRunAt = new Date().toISOString();
    }
    const retryPending = Array.isArray(schedule.retryQueue) ? schedule.retryQueue.length : 0;
    if (downloaded.length > 0) {
      schedule.lastStatus = `Downloaded ${downloaded.length} episode(s)`;
    } else if (unseen.length === 0 && dueRetries.length === 0) {
      schedule.lastStatus = "No new episodes";
    } else {
      schedule.lastStatus = "No completed downloads";
    }
    if (failedRetries > 0) {
      schedule.lastStatus += ` • ${failedRetries} failed (queued retry)`;
    }
    if (droppedRetries > 0) {
      schedule.lastStatus += ` • ${droppedRetries} dropped (max retries)`;
    }
    if (retryPending > 0) {
      schedule.lastStatus += ` • ${retryPending} retry pending`;
    }

    writeStore();
    if (downloaded.length > 0 && typeof onScheduleRunComplete === "function") {
      await onScheduleRunComplete(schedule, downloaded);
    }
    return {
      scheduleId: schedule.id,
      status: schedule.lastStatus,
      downloaded
    };
  }

  async function runAll() {
    if (running) {
      return;
    }

    running = true;
    try {
      for (const schedule of schedules) {
        try {
          await runSchedule(schedule);
        } catch (error) {
          schedule.lastCheckedAt = new Date().toISOString();
          schedule.lastStatus = `Error: ${error.message}`;
          writeStore();
          if (typeof onScheduleRunError === "function") {
            await onScheduleRunError(schedule, error);
          }
        }
      }
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) {
      return;
    }

    timer = setInterval(() => {
      runAll().catch(() => {});
    }, 1000 * 60 * 30);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  readStore();

  return {
    list,
    add,
    remove,
    setEnabled,
    checkOne,
    runAll,
    start,
    stop
  };
}

module.exports = {
  createSchedulerStore
};
