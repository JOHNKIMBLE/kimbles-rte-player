/**
 * KEXP 90.3 FM (Seattle) integration.
 * Public REST API at https://api.kexp.org/v2/ — no auth required.
 * Live stream via Icecast (AAC 160K).
 *
 * Extended Archive via Splixer API (kexp-t1.tkatlabs.com):
 * - Programs: GET /player_api/v3/programs?station_id={sid}&per_page=100
 * - Mixes:    GET /player_api/v3/mixes?station_id={sid}&program_id={uid}&per_page=N
 * - Stream:   https://d2tp7idim4nvvu.cloudfront.net/segments/{date}/{date}_{time}.m4a
 *             constructed from mix.broadcasted_at (UTC ISO timestamp)
 */

const API_BASE = "https://api.kexp.org/v2";
const KEXP_BASE = "https://www.kexp.org";

// ── Splixer / Extended Archive constants ──────────────────────────────────────

const SPLIXER_BASE = "https://player-api.splixer.com/player_api/v3";
const SPLIXER_STATION_ID = "30b07b51-7513-4a42-b6b5-ed783b270d0b";
const SPLIXER_SITE = "https://kexp-t1.tkatlabs.com";
const CLOUDFRONT_CDN = "https://d2tp7idim4nvvu.cloudfront.net/segments";

// ── Station ───────────────────────────────────────────────────────────────────

const LIVE_STATIONS = [
  {
    id: "kexp",
    name: "KEXP 90.3 FM",
    streamUrl: "https://kexp.streamguys1.com/kexp160.aac",
    liveUrl: `${KEXP_BASE}/listen`
  }
];

// ── Pacific time helpers ───────────────────────────────────────────────────────

/**
 * Convert Pacific local hour to UTC hour.
 * PDT (UTC-7): months 3–10, PST (UTC-8): months 11–2.
 */
function pacificHourToUtc(hour, month) {
  const offset = (month >= 3 && month <= 10) ? 7 : 8;
  return (hour + offset) % 24;
}

/** Format a HH:MM:SS Pacific time string to a UTC "HH:MM" string. */
function pacificTimeToUtcHHMM(pacificHHMMSS, month) {
  const parts = String(pacificHHMMSS || "00:00:00").split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  const utcH = pacificHourToUtc(h, month);
  return `${String(utcH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; KexpPlayer/1.0)",
  "Accept": "application/json"
};

async function fetchJson(url) {
  if (typeof fetch !== "undefined") {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`KEXP API ${res.status} for ${url}`);
    return res.json();
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? require("node:https") : require("node:http");
    const req = mod.get(url, { headers: FETCH_HEADERS }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`KEXP API ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

// ── Splixer fetch helper ──────────────────────────────────────────────────────

async function fetchSplixer(path) {
  const url = `${SPLIXER_BASE}${path}`;
  return fetchJson(url);
}

/** Build CloudFront stream URL from an ISO UTC timestamp (broadcasted_at). */
function cloudfrontUrlFromTs(isoTs) {
  if (!isoTs) return null;
  const d = new Date(isoTs);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
  return `${CLOUDFRONT_CDN}/${date}/${date}_${time}.m4a`;
}

/** Encode a Splixer mix as an episode URL usable throughout the app. */
function splixerMixUrl(mixUid) {
  return `${SPLIXER_SITE}/mixes/${mixUid}`;
}

/** Extract Splixer mix UID from an episode URL. */
function extractMixUid(url) {
  const m = String(url || "").match(/\/mixes\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

/** Extract Splixer program UID from a program URL. */
function extractSplixerProgramUid(url) {
  const raw = String(url || "").trim();
  // Accept bare UID or URL ending in /{uid}
  const m = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1] : null;
}

function mapSplixerProgram(p) {
  const keywords = String((p.branding && p.branding.keyword) || p.tag_line || "");
  const genres = keywords ? keywords.split(",").map((g) => g.trim()).filter(Boolean) : [];
  const image = String(
    (p.branding && p.branding.thumbnailImageUrl) || p.image_url || ""
  );
  return {
    id: String(p.uid || ""),
    programUrl: `${SPLIXER_SITE}/library/shows/${p.uid}`,
    title: String(p.name || ""),
    description: String(p.description || p.tag_line || ""),
    genres,
    image: image.includes("__") ? image.replace(/__.*$/, "") : image,
    isActive: Number(p.status || 0) === 100,
    location: "Seattle, WA",
    source: "kexp-extended"
  };
}

function mapSplixerMix(m) {
  const broadcastedAt = String(m.broadcasted_at || "");
  const date = broadcastedAt.slice(0, 10); // YYYY-MM-DD
  const streamUrl = cloudfrontUrlFromTs(broadcastedAt);
  const hostName = String(m.host_name || (m._host && m._host.name) || "");
  const programTitle = String((m._program && m._program.name) || m.name || "");
  const title = String(m.name || "");
  const tagLine = String(m.tag_line || "");
  const image = String(
    (m._program && m._program.image_url) || ""
  );
  return {
    episodeUrl: splixerMixUrl(m.uid),
    mixUid: String(m.uid || ""),
    clipId: String(m.uid || ""),
    title: tagLine || title,
    fullTitle: programTitle + (tagLine ? ` – ${tagLine}` : ""),
    programTitle,
    hosts: hostName,
    publishedTime: broadcastedAt,
    duration: Number(m.duration || 0),
    image,
    streamUrl,
    genres: [],
    source: "kexp-extended"
  };
}

// ── Mappers ───────────────────────────────────────────────────────────────────

const ISO_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseGenres(tags) {
  if (!tags) return [];
  return String(tags).split(",").map((t) => t.trim()).filter(Boolean);
}

function mapProgram(p) {
  return {
    id: String(p.id),
    programUrl: `${API_BASE}/programs/${p.id}/`,
    title: String(p.name || ""),
    description: String(p.description || ""),
    genres: parseGenres(p.tags),
    image: String(p.image_uri || ""),
    isActive: Boolean(p.is_active),
    location: String(p.location_name || "")
  };
}

function mapShow(s) {
  const title = String(s.tagline || "").trim();
  const programTitle = String(s.program_name || "");
  return {
    episodeUrl: `${KEXP_BASE}/shows/${s.id}/`,
    showId: String(s.id),
    clipId: String(s.id),
    title: title || programTitle,
    fullTitle: programTitle + (title ? ` – ${title}` : ""),
    programTitle,
    publishedTime: String(s.start_time || ""),
    endTime: String(s.end_time || ""),
    description: String(s.description || ""),
    image: String(s.image_uri || ""),
    hosts: Array.isArray(s.host_names) ? s.host_names.join(", ") : String(s.host_names || ""),
    genres: parseGenres(s.program_tags)
  };
}

function mapPlay(p) {
  return {
    artist: String(p.artist || ""),
    title: String(p.song || p.title || ""),
    album: String(p.album || ""),
    releaseDate: String(p.release_date || ""),
    airdate: String(p.airdate || ""),
    image: String(p.image_uri || ""),
    rotationStatus: String(p.rotation_status || ""),
    isLocal: Boolean(p.is_local),
    isRequest: Boolean(p.is_request),
    comment: String(p.comment || ""),
    playType: String(p.play_type || "")
  };
}

function mapTimeslot(t, month) {
  const m = month || (new Date().getMonth() + 1);
  const startUtc = pacificTimeToUtcHHMM(t.start_time, m);
  const endUtc = pacificTimeToUtcHHMM(t.end_time, m);
  const weekdayIdx = Number(t.weekday || 1) - 1; // 1=Mon → 0
  return {
    id: String(t.id),
    programId: String(t.program),
    programName: String(t.program_name || ""),
    hosts: Array.isArray(t.host_names) ? t.host_names.join(", ") : String(t.host_names || ""),
    weekday: Number(t.weekday || 1),
    weekdayName: ISO_DAY_NAMES[weekdayIdx] || "Mon",
    startTimePacific: String(t.start_time || "").slice(0, 5),
    endTimePacific: String(t.end_time || "").slice(0, 5),
    startTimeUtc: startUtc,
    endTimeUtc: endUtc,
    runSchedule: startUtc,
    duration: String(t.duration || ""),
    genres: parseGenres(t.program_tags)
  };
}

// ── Program URL helpers ───────────────────────────────────────────────────────

/** Extract numeric program ID from various input forms. */
function extractProgramId(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw;
  const m = raw.match(/\/programs\/(\d+)/);
  if (m) return m[1];
  return "";
}

function normalizeKexpProgramUrl(inputUrl) {
  const id = extractProgramId(inputUrl);
  if (!id) throw new Error(`KEXP: cannot parse program ID from: ${inputUrl}`);
  return `${API_BASE}/programs/${id}/`;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

let programsCache = [];
let programsCacheTime = 0;
const PROGRAMS_TTL_MS = 30 * 60 * 1000;

let scheduleCache = null;
let scheduleCacheTime = 0;
const SCHEDULE_TTL_MS = 60 * 60 * 1000;

const liveNowCache = { data: null, fetchedAt: 0 };
const LIVE_NOW_TTL = 30 * 1000;

// Per-program episode scan cache (keyed by numeric program ID)
// KEXP /v2/shows/ has NO server-side filtering, so we scan all shows client-side
const _episodeScanCache = new Map();
const EPISODE_SCAN_TTL = 10 * 60 * 1000; // 10 minutes

// Splixer extended archive cache
let splixerProgramsCache = [];
let splixerProgramsCacheTime = 0;
const SPLIXER_PROGRAMS_TTL = 30 * 60 * 1000;

// Per-program Splixer mixes cache (keyed by program UID)
const _splixerMixesCache = new Map();
const SPLIXER_MIXES_TTL = 10 * 60 * 1000;

// ── Live ──────────────────────────────────────────────────────────────────────

/**
 * Get the currently-playing track and show from KEXP.
 * Combines latest play from /v2/plays/ and latest show from /v2/shows/.
 */
async function getKexpNowPlaying() {
  if (liveNowCache.data && Date.now() - liveNowCache.fetchedAt < LIVE_NOW_TTL) {
    return liveNowCache.data;
  }
  try {
    const [playsRes, showsRes] = await Promise.all([
      fetchJson(`${API_BASE}/plays/?limit=1&ordering=-airdate`),
      fetchJson(`${API_BASE}/shows/?limit=1&ordering=-start_time`)
    ]);
    const play = (playsRes.results || [])[0] || null;
    const show = (showsRes.results || [])[0] || null;
    const data = {
      stationId: "kexp",
      stationName: "KEXP 90.3 FM",
      streamUrl: LIVE_STATIONS[0].streamUrl,
      liveUrl: LIVE_STATIONS[0].liveUrl,
      play: play ? mapPlay(play) : null,
      show: show ? mapShow(show) : null
    };
    liveNowCache.data = data;
    liveNowCache.fetchedAt = Date.now();
    return data;
  } catch {
    const fallback = {
      stationId: "kexp",
      stationName: "KEXP 90.3 FM",
      streamUrl: LIVE_STATIONS[0].streamUrl,
      liveUrl: LIVE_STATIONS[0].liveUrl,
      play: null,
      show: null
    };
    liveNowCache.data = fallback;
    liveNowCache.fetchedAt = Date.now() - LIVE_NOW_TTL + 10000;
    return fallback;
  }
}

// ── Programs (search / discovery) ─────────────────────────────────────────────

async function getAllPrograms() {
  if (programsCache.length && Date.now() - programsCacheTime < PROGRAMS_TTL_MS) {
    return programsCache;
  }
  // All 41 programs fit in one page
  const data = await fetchJson(`${API_BASE}/programs/?limit=100&ordering=name`);
  programsCache = (data.results || []).map(mapProgram);
  programsCacheTime = Date.now();
  return programsCache;
}

async function searchKexpPrograms(query) {
  const all = await getAllPrograms();
  const q = String(query || "").toLowerCase().trim();
  if (!q) return all.slice(0, 20).map((p) => ({ ...p, programUrl: p.programUrl }));
  return all.filter((p) =>
    p.title.toLowerCase().includes(q) ||
    p.genres.some((g) => g.toLowerCase().includes(q)) ||
    p.description.toLowerCase().includes(q)
  );
}

async function getKexpDiscovery(count = 12) {
  const all = await getAllPrograms();
  const active = all.filter((p) => p.isActive);
  const shuffled = active.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ── Program metadata ──────────────────────────────────────────────────────────

async function getKexpProgramSummary(programUrl) {
  const id = extractProgramId(programUrl);
  if (!id) throw new Error("KEXP: invalid program URL");
  const [program, slotsRes] = await Promise.all([
    fetchJson(`${API_BASE}/programs/${id}/`),
    fetchJson(`${API_BASE}/timeslots/?program=${id}&ordering=weekday,start_time&limit=50`)
  ]);
  const mapped = mapProgram(program);
  const month = new Date().getMonth() + 1;
  const timeslots = (slotsRes.results || []).map((t) => mapTimeslot(t, month));

  // Derive cadence from unique weekdays
  const uniqueDays = new Set(timeslots.map((t) => t.weekday));
  let cadence = "irregular";
  if (uniqueDays.size >= 5) cadence = "daily";
  else if (uniqueDays.size > 0) cadence = "weekly";
  const runSchedule = timeslots[0]?.runSchedule || "";

  return {
    source: "kexp",
    programUrl: `${API_BASE}/programs/${id}/`,
    title: mapped.title,
    description: mapped.description,
    image: mapped.image,
    genres: mapped.genres,
    location: mapped.location,
    cadence,
    runSchedule,
    timeslots
  };
}

// ── Episodes ──────────────────────────────────────────────────────────────────

/** Compute the next upcoming UTC ISO datetime for a set of KEXP timeslots. */
function computeKexpNextBroadcast(timeslots) {
  if (!timeslots.length) return "";
  const now = new Date();
  const nowDayJs = now.getUTCDay(); // 0=Sun…6=Sat
  let soonest = null;
  for (const slot of timeslots) {
    const parts = String(slot.startTimeUtc || "").split(":");
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    // timeslot.weekday: 1=Mon…7=Sun → JS day: Mon=1…Sun=0
    const slotJsDay = slot.weekday === 7 ? 0 : slot.weekday;
    let daysUntil = (slotJsDay - nowDayJs + 7) % 7;
    const candidate = new Date(now);
    candidate.setUTCDate(candidate.getUTCDate() + daysUntil);
    candidate.setUTCHours(h, m, 0, 0);
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 7);
    if (!soonest || candidate < soonest) soonest = candidate;
  }
  return soonest ? soonest.toISOString() : "";
}

async function getKexpProgramEpisodes(programUrl, page = 1) {
  const id = extractProgramId(programUrl);
  if (!id) throw new Error("KEXP: invalid program URL");

  const perPage = 20;
  const pageNum = Math.max(1, Number(page));
  const neededCount = pageNum * perPage;
  const now = Date.now();

  // Check / initialise per-program cache
  let cache = _episodeScanCache.get(id);
  if (cache && now - cache.fetchedAt > EPISODE_SCAN_TTL) {
    _episodeScanCache.delete(id);
    cache = null;
  }
  if (!cache) {
    cache = { episodes: [], scanOffset: 0, exhausted: false, fetchedAt: now, timeslots: null };
    _episodeScanCache.set(id, cache);
  }

  // Fetch timeslots once per cache lifetime (for cadence + next broadcast)
  if (!cache.timeslots) {
    try {
      const month = new Date().getMonth() + 1;
      const slotsRes = await fetchJson(`${API_BASE}/timeslots/?program=${id}&ordering=weekday,start_time&limit=50`);
      cache.timeslots = (slotsRes.results || []).map((t) => mapTimeslot(t, month));
    } catch {
      cache.timeslots = [];
    }
  }

  // Scan batches until we have enough episodes for this page (or hit limit)
  const BATCH = 200;
  const MAX_SCAN = 3000;
  while (cache.episodes.length < neededCount && !cache.exhausted && cache.scanOffset < MAX_SCAN) {
    const data = await fetchJson(
      `${API_BASE}/shows/?ordering=-start_time&limit=${BATCH}&offset=${cache.scanOffset}`
    );
    const batch = data.results || [];
    for (const show of batch) {
      if (Number(show.program) === Number(id)) {
        cache.episodes.push(mapShow(show));
      }
    }
    cache.scanOffset += batch.length;
    cache.exhausted = !data.next || batch.length < BATCH;
    if (!batch.length) break;
  }

  const timeslots = cache.timeslots || [];
  const uniqueDays = new Set(timeslots.map((t) => t.weekday));
  const cadence = uniqueDays.size >= 5 ? "daily" : uniqueDays.size > 0 ? "weekly" : "irregular";
  const runSchedule = timeslots[0]?.runSchedule || "";
  const nextBroadcastAt = computeKexpNextBroadcast(timeslots);

  const start = (pageNum - 1) * perPage;
  return {
    episodes: cache.episodes.slice(start, start + perPage),
    total: cache.exhausted ? cache.episodes.length : 0,
    page: pageNum,
    hasMore: cache.episodes.length > start + perPage || !cache.exhausted,
    cadence,
    runSchedule,
    nextBroadcastAt
  };
}

// ── Episode tracklist ─────────────────────────────────────────────────────────

async function getKexpEpisodeTracklist(episodeUrl) {
  const m = String(episodeUrl || "").match(/\/shows\/(\d+)/);
  const showId = m ? m[1] : "";
  if (!showId) return [];
  // Fetch show metadata first so we can use its time window to precisely filter plays
  const show = await fetchJson(`${API_BASE}/shows/${showId}/`).catch(() => ({}));
  const showStartMs = show.start_time ? new Date(show.start_time).getTime() : null;
  const showEndMs = show.end_time ? new Date(show.end_time).getTime() : null;

  // Use both show ID and time-range params so the API filters tightly even if one is unreliable
  let playsUrl = `${API_BASE}/plays/?show=${showId}&ordering=airdate&limit=200`;
  if (show.start_time) playsUrl += `&airdate_after=${encodeURIComponent(show.start_time)}`;
  if (show.end_time)   playsUrl += `&airdate_before=${encodeURIComponent(show.end_time)}`;

  const data = await fetchJson(playsUrl);
  return (data.results || [])
    .filter((p) => {
      if (p.play_type !== "trackplay") return false;
      // Client-side time-range guard: drop any plays that fall outside this show's window
      if (showStartMs !== null && showEndMs !== null && p.airdate) {
        const ms = new Date(p.airdate).getTime();
        if (!isNaN(ms) && (ms < showStartMs || ms > showEndMs)) return false;
      }
      return true;
    })
    .map((p) => {
      const track = mapPlay(p);
      if (showStartMs !== null && track.airdate) {
        const trackMs = new Date(track.airdate).getTime();
        if (!isNaN(trackMs) && trackMs >= showStartMs) {
          track.startSeconds = Math.floor((trackMs - showStartMs) / 1000);
        }
      }
      return track;
    });
}

// ── Schedule ──────────────────────────────────────────────────────────────────

/**
 * Returns timeslots grouped by weekday number (1=Mon … 7=Sun).
 * Each group is sorted by start_time (Pacific).
 */
async function getKexpSchedule() {
  if (scheduleCache && Date.now() - scheduleCacheTime < SCHEDULE_TTL_MS) {
    return scheduleCache;
  }
  const data = await fetchJson(
    `${API_BASE}/timeslots/?ordering=weekday,start_time&limit=200`
  );
  const month = new Date().getMonth() + 1;
  const slots = (data.results || []).map((t) => mapTimeslot(t, month));
  const byDay = {};
  for (const slot of slots) {
    const d = slot.weekday;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(slot);
  }
  scheduleCache = byDay;
  scheduleCacheTime = Date.now();
  return byDay;
}

// ── Episode stream ────────────────────────────────────────────────────────────

const KEXP_STREAMING_API = "https://api.kexp.org/get_streaming_url/";

/**
 * Resolve a KEXP archive recording URL via the get_streaming_url API.
 * The API accepts the show's start_time and returns a direct StreamGuys MP3 URL
 * (sg-url) plus an offset in seconds (sg-offset) for where the show begins
 * within that file.
 *
 * startTime should be an ISO 8601 string (e.g. "2026-03-13T23:03:43Z").
 * If not provided, it is fetched from the KEXP shows API using the episodeUrl.
 */
async function getKexpEpisodeStream(episodeUrl, _runYtDlpJson, startTime) {
  const url = String(episodeUrl || "").trim();
  if (!url) throw new Error("KEXP: episodeUrl is required");

  let resolvedStartTime = String(startTime || "").trim();
  if (!resolvedStartTime) {
    const m = url.match(/\/shows\/(\d+)/);
    const showId = m ? m[1] : "";
    if (!showId) throw new Error("KEXP: could not extract show ID from URL");
    const show = await fetchJson(`${API_BASE}/shows/${showId}/`);
    resolvedStartTime = String(show.start_time || "").trim();
  }
  if (!resolvedStartTime) throw new Error("KEXP: no start_time available for this show");

  const streamData = await fetchJson(
    `${KEXP_STREAMING_API}?bitrate=256&timestamp=${encodeURIComponent(resolvedStartTime)}&location=3`
  );
  const sgUrl = String(streamData["sg-url"] || "").trim();
  if (!sgUrl) {
    // Fallback: try KEXP Extended Archive (CloudFront CDN) using the broadcast timestamp.
    // Use a GET range probe — more reliable than HEAD (some CDNs block HEAD requests).
    const cfUrl = cloudfrontUrlFromTs(resolvedStartTime);
    if (cfUrl) {
      try {
        const probe = await fetch(cfUrl, {
          method: "GET",
          headers: { Range: "bytes=0-0" }
        }).catch(() => null);
        if (probe && (probe.ok || probe.status === 206)) {
          await probe.body?.cancel().catch(() => {});
          return { streamUrl: cfUrl, startOffset: 0, title: "", duration: null };
        }
      } catch {}
    }
    throw new Error("KEXP: no archive recording available for this show.");
  }

  return {
    streamUrl: sgUrl,
    startOffset: Number(streamData["sg-offset"] || 0),
    title: "",
    duration: null
  };
}

// ── Splixer Extended Archive ───────────────────────────────────────────────────

async function getAllSplixerPrograms() {
  if (splixerProgramsCache.length && Date.now() - splixerProgramsCacheTime < SPLIXER_PROGRAMS_TTL) {
    return splixerProgramsCache;
  }
  const data = await fetchSplixer(
    `/programs?station_id=${SPLIXER_STATION_ID}&per_page=100&include=host`
  );
  splixerProgramsCache = (data.data || []).map(mapSplixerProgram);
  splixerProgramsCacheTime = Date.now();
  return splixerProgramsCache;
}

async function searchKexpExtendedPrograms(query) {
  const all = await getAllSplixerPrograms();
  const q = String(query || "").toLowerCase().trim();
  if (!q) return all.slice(0, 20);
  return all.filter((p) =>
    p.title.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.genres.some((g) => g.toLowerCase().includes(q))
  );
}

async function getKexpExtendedDiscovery(count = 12) {
  const all = await getAllSplixerPrograms();
  const active = all.filter((p) => p.isActive);
  return active.slice().sort(() => Math.random() - 0.5).slice(0, count);
}

async function getKexpExtendedProgramSummary(programUrl) {
  const uid = extractSplixerProgramUid(programUrl);
  if (!uid) throw new Error("KEXP Extended: invalid program URL");
  const data = await fetchSplixer(
    `/programs/${uid}?station_id=${SPLIXER_STATION_ID}&include=host,default_mix`
  );
  const p = data.data || {};
  const mapped = mapSplixerProgram(p);
  // Get mix count from the mixes endpoint
  const mixData = await fetchSplixer(
    `/mixes?station_id=${SPLIXER_STATION_ID}&program_id=${uid}&per_page=1`
  ).catch(() => ({ slicing: {} }));
  const totalMixes = (mixData.slicing && mixData.slicing.totalRows) || 0;
  return {
    source: "kexp-extended",
    programUrl: `${SPLIXER_SITE}/library/shows/${uid}`,
    title: mapped.title,
    description: mapped.description,
    image: mapped.image,
    genres: mapped.genres,
    location: mapped.location,
    cadence: totalMixes >= 200 ? "daily" : totalMixes >= 50 ? "weekly" : "irregular",
    runSchedule: "",
    totalEpisodes: totalMixes
  };
}

async function getKexpExtendedEpisodes(programUrl, page = 1) {
  const uid = extractSplixerProgramUid(programUrl);
  if (!uid) throw new Error("KEXP Extended: invalid program URL");

  const perPage = 20;
  const pageNum = Math.max(1, Number(page));
  const now = Date.now();

  let cache = _splixerMixesCache.get(uid);
  if (cache && now - cache.fetchedAt > SPLIXER_MIXES_TTL) {
    _splixerMixesCache.delete(uid);
    cache = null;
  }
  if (!cache) {
    cache = { episodes: [], total: 0, fetchedAt: now };
    _splixerMixesCache.set(uid, cache);
  }

  // Fetch page from Splixer directly (server-side pagination)
  const data = await fetchSplixer(
    `/mixes?station_id=${SPLIXER_STATION_ID}&program_id=${uid}&per_page=${perPage}&page=${pageNum}&include=program,host`
  );
  const mixes = (data.data || []).map(mapSplixerMix);
  const total = (data.slicing && data.slicing.totalRows) || 0;

  return {
    episodes: mixes,
    total,
    page: pageNum,
    hasMore: pageNum * perPage < total
  };
}

async function getKexpExtendedEpisodeStream(episodeUrl) {
  const mixUid = extractMixUid(episodeUrl);
  if (!mixUid) throw new Error("KEXP Extended: invalid episode URL");

  const data = await fetchSplixer(
    `/mixes/${mixUid}?station_id=${SPLIXER_STATION_ID}`
  );
  const mix = data.data || {};
  const broadcastedAt = String(mix.broadcasted_at || "").trim();
  if (!broadcastedAt) throw new Error("KEXP Extended: no broadcasted_at for this mix");

  const streamUrl = cloudfrontUrlFromTs(broadcastedAt);
  if (!streamUrl) throw new Error("KEXP Extended: could not construct stream URL");

  // Verify the file exists (HEAD request) and provide helpful error if not
  const programTitle = String((mix._program && mix._program.name) || mix.name || "");
  const image = String((mix._program && mix._program.image_url) || "");

  return {
    episodeUrl,
    streamUrl,
    title: String(mix.tag_line || mix.name || ""),
    programTitle,
    image,
    broadcastedAt,
    duration: Number(mix.duration || 0)
  };
}

async function getKexpExtendedEpisodeTracklist(episodeUrl) {
  const mixUid = extractMixUid(episodeUrl);
  if (!mixUid) return [];

  // Fetch mix to get broadcasted_at
  const data = await fetchSplixer(
    `/mixes/${mixUid}?station_id=${SPLIXER_STATION_ID}`
  );
  const mix = data.data || {};
  const broadcastedAt = String(mix.broadcasted_at || "");
  if (!broadcastedAt) return [];

  // Find the KEXP show matching this broadcast time via plays API
  // Fetch plays around the broadcast time window
  const startMs = new Date(broadcastedAt).getTime();
  const durationSec = Number(mix.duration || 10800); // default 3h
  const endMs = startMs + durationSec * 1000;
  const endIso = new Date(endMs).toISOString();

  // Use KEXP plays API with airdate range
  const playsData = await fetchJson(
    `${API_BASE}/plays/?ordering=airdate&limit=200` +
    `&airdate_after=${encodeURIComponent(broadcastedAt)}` +
    `&airdate_before=${encodeURIComponent(endIso)}`
  ).catch(() => ({ results: [] }));

  const showStartMs = startMs;
  return (playsData.results || [])
    .filter((p) => p.play_type === "trackplay")
    .map((p) => {
      const track = mapPlay(p);
      if (track.airdate) {
        const trackMs = new Date(track.airdate).getTime();
        if (!isNaN(trackMs) && trackMs >= showStartMs) {
          track.startSeconds = Math.floor((trackMs - showStartMs) / 1000);
        }
      }
      return track;
    });
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  LIVE_STATIONS,
  normalizeKexpProgramUrl,
  getKexpNowPlaying,
  searchKexpPrograms,
  getKexpDiscovery,
  getKexpProgramSummary,
  getKexpProgramEpisodes,
  getKexpEpisodeTracklist,
  getKexpSchedule,
  getKexpEpisodeStream,
  // Extended archive (Splixer / kexp-t1.tkatlabs.com)
  searchKexpExtendedPrograms,
  getKexpExtendedDiscovery,
  getKexpExtendedProgramSummary,
  getKexpExtendedEpisodes,
  getKexpExtendedEpisodeStream,
  getKexpExtendedEpisodeTracklist,
  ISO_DAY_NAMES
};
