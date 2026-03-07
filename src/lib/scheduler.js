const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DUBLIN_TZ = "Europe/Dublin";
const RELEASE_LAG_WINDOW_MINUTES = 6 * 60;
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

function getDublinNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBLIN_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const weekdayText = parts.find((p) => p.type === "weekday")?.value || "";
  const hourText = parts.find((p) => p.type === "hour")?.value || "0";
  const minuteText = parts.find((p) => p.type === "minute")?.value || "0";

  const day = parseDayToken(weekdayText);
  const minuteOfDay = Number(hourText) * 60 + Number(minuteText);

  return {
    day: day == null ? 0 : day,
    minuteOfDay: Number.isFinite(minuteOfDay) ? minuteOfDay : 0
  };
}

function shouldRunInScheduleWindow(schedule, now = new Date()) {
  const windows = parseRunScheduleWindows(schedule.runSchedule || "");
  if (!windows.length) {
    return { shouldRun: null, reason: "No schedule window parsed" };
  }

  const dublinNow = getDublinNowParts(now);
  const currentSlot = windows.find((window) => {
    if (window.dueDay !== dublinNow.day) {
      return false;
    }
    const delta = dublinNow.minuteOfDay - window.dueMinute;
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

function createSchedulerStore({ app, dataDir, getProgramSummary, getProgramEpisodes, runEpisodeDownload }) {
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

  function setLatestEpisodeFields(schedule, latest) {
    const episodes = Array.isArray(latest?.episodes) ? latest.episodes : [];
    const top = episodes.find((episode) => episode && (episode.title || episode.clipId));
    if (!top) {
      return;
    }
    schedule.latestEpisodeTitle = String(top.fullTitle || top.title || "");
    schedule.latestEpisodePublishedTime = String(top.publishedTime || top.publishedTimeFormatted || "");
    schedule.latestEpisodeImage = String(top.image || "");
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
    const downloadedNow = [];

    if (backfillCount > 0) {
      const toBackfill = latest.episodes
        .filter((episode) => episode.clipId)
        .slice(0, backfillCount)
        .reverse();

      for (const episode of toBackfill) {
        const result = await runEpisodeDownload({
          ...episode,
          title: String(episode.fullTitle || episode.title || ""),
          programTitle: summary.title
        });
        downloadedNow.push({
          clipId: episode.clipId,
          title: episode.title,
          fileName: result.fileName
        });
        known.add(String(episode.clipId));
      }
    } else if (latest.episodes[0]?.clipId) {
      known.add(String(latest.episodes[0].clipId));
    }

    const schedule = {
      id: makeId(),
      programUrl: summary.programUrl,
      title: summary.title,
      description: summary.description,
      image: summary.image || "",
      runSchedule: summary.runSchedule || "",
      nextBroadcastAt: summary.nextBroadcastAt || "",
      nextBroadcastTitle: summary.nextBroadcastTitle || "",
      enabled: true,
      cadence: latest.cadence,
      averageDaysBetween: latest.averageDaysBetween,
      latestEpisodeTitle: "",
      latestEpisodePublishedTime: "",
      latestEpisodeImage: "",
      downloadedClipIds: Array.from(known),
      initialBackfillCount: backfillCount,
      lastCheckedAt: null,
      lastRunAt: downloadedNow.length ? new Date().toISOString() : null,
      lastStatus: downloadedNow.length
        ? `Created and backfilled ${downloadedNow.length} episode(s)`
        : "Created (new episodes only)"
    };
    setLatestEpisodeFields(schedule, latest);

    schedules.push(schedule);
    writeStore();
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
        const minHoursBetweenChecks = cadence === "daily" ? 6 : cadence === "weekly" ? 24 : 12;
        const elapsedMs = now - Date.parse(schedule.lastCheckedAt);
        if (elapsedMs < minHoursBetweenChecks * 60 * 60 * 1000) {
          return { scheduleId: schedule.id, status: "Skipped (too soon)", downloaded: [] };
        }
      }
    }

    const latest = await getProgramEpisodes(schedule.programUrl, 1);

    schedule.cadence = latest.cadence;
    schedule.averageDaysBetween = latest.averageDaysBetween;
    if (typeof latest.runSchedule === "string") {
      schedule.runSchedule = latest.runSchedule;
    }
    if (typeof latest.nextBroadcastAt === "string") {
      schedule.nextBroadcastAt = latest.nextBroadcastAt;
    }
    if (typeof latest.nextBroadcastTitle === "string") {
      schedule.nextBroadcastTitle = latest.nextBroadcastTitle;
    }
    schedule.lastCheckedAt = new Date().toISOString();
    setLatestEpisodeFields(schedule, latest);

    const known = new Set((schedule.downloadedClipIds || []).map((id) => String(id)));
    const unseen = [];

    for (const episode of latest.episodes.slice(0, 10)) {
      if (!episode.clipId) {
        continue;
      }
      if (known.has(String(episode.clipId))) {
        break;
      }
      unseen.push(episode);
    }

    if (unseen.length === 0) {
      schedule.lastStatus = "No new episodes";
      writeStore();
      return { scheduleId: schedule.id, status: schedule.lastStatus, downloaded: [] };
    }

    const toDownload = unseen.reverse();
    const downloaded = [];

    for (const episode of toDownload) {
      const result = await runEpisodeDownload({
        ...episode,
        title: String(episode.fullTitle || episode.title || ""),
        programTitle: schedule.title
      });
      downloaded.push({
        clipId: episode.clipId,
        title: episode.title,
        fileName: result.fileName
      });
      known.add(String(episode.clipId));
    }

    schedule.downloadedClipIds = Array.from(known).slice(-400);
    schedule.lastRunAt = new Date().toISOString();
    schedule.lastStatus = `Downloaded ${downloaded.length} new episode(s)`;

    writeStore();
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




