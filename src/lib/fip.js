/**
 * FIP Radio France integration.
 * Live streams via Icecast (12 stations), podcasts via SvelteKit /__data.json.
 * No API key required. All endpoints are public.
 */

const BASE_URL = "https://www.radiofrance.fr";
const ICECAST_BASE = "https://icecast.radiofrance.fr";

// ── Translation ───────────────────────────────────────────────────────────────
const translationCache = new Map();
let _diskCache = null;
function configure({ diskCache } = {}) { _diskCache = diskCache || null; }
async function translateFr(text) {
  let minLength = 10;
  let value = text;
  if (text && typeof text === "object") {
    minLength = Number(text.minLength || 10);
    value = text.text;
  }
  if (!value || String(value).length < minLength) return value;
  const key = String(value).slice(0, 450);
  if (!translationCache.has(key) && _diskCache) {
    const cached = _diskCache.get("fip:trans:" + key, 0); // permanent
    if (cached != null) translationCache.set(key, cached);
  }
  if (translationCache.has(key)) return translationCache.get(key);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(key)}&langpair=fr|en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    const translated = (json?.responseData?.translatedText || "").trim();
    // Reject if translation looks like an error message or is too short
    const result = (translated.length > 2 && !translated.toLowerCase().includes("mymemory")) ? translated : value;
    translationCache.set(key, result);
    if (_diskCache) _diskCache.set("fip:trans:" + key, result);
    return result;
  } catch {
    return value;
  }
}

async function translateMetadataList(values, minLength = 2) {
  const translated = await Promise.all((Array.isArray(values) ? values : []).map((value) => translateFr({ text: value, minLength })));
  const out = [];
  const seen = new Set();
  for (const value of translated) {
    const text = cleanText(value || "");
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(text);
  }
  return out;
}

const LIVE_STATIONS = [
  { id: "fip",              name: "FIP",                streamUrl: `${ICECAST_BASE}/fip-hifi.aac`,              liveUrl: `${BASE_URL}/fip` },
  { id: "fiprock",          name: "FIP Rock",           streamUrl: `${ICECAST_BASE}/fiprock-hifi.aac`,          liveUrl: `${BASE_URL}/fip/radio-rock` },
  { id: "fipjazz",          name: "FIP Jazz",           streamUrl: `${ICECAST_BASE}/fipjazz-hifi.aac`,          liveUrl: `${BASE_URL}/fip/radio-jazz` },
  { id: "fipgroove",        name: "FIP Groove",         streamUrl: `${ICECAST_BASE}/fipgroove-hifi.aac`,        liveUrl: `${BASE_URL}/fip/radio-groove` },
  { id: "fipworld",         name: "FIP World",          streamUrl: `${ICECAST_BASE}/fipworld-hifi.aac`,         liveUrl: `${BASE_URL}/fip/radio-monde` },
  { id: "fipreggae",        name: "FIP Reggae",         streamUrl: `${ICECAST_BASE}/fipreggae-hifi.aac`,        liveUrl: `${BASE_URL}/fip/radio-reggae` },
  { id: "fipelectro",       name: "FIP Electro",        streamUrl: `${ICECAST_BASE}/fipelectro-hifi.aac`,       liveUrl: `${BASE_URL}/fip/radio-electro` },
  { id: "fiphiphop",        name: "FIP Hip-Hop",        streamUrl: `${ICECAST_BASE}/fiphiphop-hifi.aac`,        liveUrl: `${BASE_URL}/fip/radio-hip-hop` },
  { id: "fippop",           name: "FIP Pop",            streamUrl: `${ICECAST_BASE}/fippop-hifi.aac`,           liveUrl: `${BASE_URL}/fip/radio-pop` },
  { id: "fipmetal",         name: "FIP Metal",          streamUrl: `${ICECAST_BASE}/fipmetal-hifi.aac`,         liveUrl: `${BASE_URL}/fip/radio-metal` },
  { id: "fipnouveautes",    name: "FIP Nouveautés",     streamUrl: `${ICECAST_BASE}/fipnouveautes-hifi.aac`,    liveUrl: `${BASE_URL}/fip/radio-nouveautes` },
  { id: "fipsacrefrancais", name: "FIP Sacré Français", streamUrl: `${ICECAST_BASE}/fipsacrefrancais-hifi.aac`, liveUrl: `${BASE_URL}/fip/radio-sacre-francais` },
  { id: "fipcultes",        name: "FIP Cultes",         streamUrl: `${ICECAST_BASE}/fipcultes-hifi.aac`,        liveUrl: `${BASE_URL}/fip/radio-cultes` }
];

// Map station IDs to their live-API slug (for show/programme info)
// Note: /fip/radio-X/api/live returns 404 for all sub-stations.
// Correct URL: /fip/api/live?webradio=fip_X  (confirmed from Radio France app source)
const STATION_LIVE_API_SLUG = {
  fip:              "fip",
  fiprock:          "fip",
  fipjazz:          "fip",
  fipgroove:        "fip",
  fipworld:         "fip",
  fipreggae:        "fip",
  fipelectro:       "fip",
  fiphiphop:        "fip",
  fippop:           "fip",
  fipmetal:         "fip",
  fipnouveautes:    "fip",
  fipsacrefrancais: "fip",
  fipcultes:        "fip"
};

// Map station IDs to their current/live song-history slug: /fip/{slug}/api/songs
// Used for live now-playing context; for episode tracklists use STATION_SONGS_API_ID + /api/songs instead.
const _STATION_SONGS_SLUG = {
  fip:              "fip",
  fiprock:          "radio-rock",
  fipjazz:          "radio-jazz",
  fipgroove:        "radio-groove",
  fipworld:         "radio-monde",
  fipreggae:        "radio-reggae",
  fipelectro:       "radio-electro",
  fiphiphop:        "radio-hip-hop",
  fippop:           "radio-pop",
  fipmetal:         "radio-metal",
  fipnouveautes:    "radio-nouveautes",
  fipsacrefrancais: "radio-sacre-francais",
  fipcultes:        "radio-cultes"
};

// Webradio query param for fip/api/live?webradio=X  (null = main FIP, no param needed)
const STATION_WEBRADIO_SLUG = {
  fip:              null,
  fiprock:          "fip_rock",
  fipjazz:          "fip_jazz",
  fipgroove:        "fip_groove",
  fipworld:         "fip_world",
  fipreggae:        "fip_reggae",
  fipelectro:       "fip_electro",
  fiphiphop:        "fip_hiphop",
  fippop:           "fip_pop",
  fipmetal:         "fip_metal",
  fipnouveautes:    "fip_nouveautes",
  fipsacrefrancais: "fip_sacre_francais",
  fipcultes:        "fip_cultes"
};

// Map station IDs to livemeta stationId (api.radiofrance.fr/livemeta/pull/{id})
const STATION_LIVEMETA_ID = {
  fip:              7,
  fiprock:          64,
  fipjazz:          65,
  fipgroove:        66,
  fipworld:         69,
  fipnouveautes:    70,
  fipreggae:        71,  // corrected: 71 = Reggae (was wrongly mapped to Hip-Hop)
  fipelectro:       74,
  fipmetal:         77,
  fippop:           78,
  fiphiphop:        95,
  fipsacrefrancais: 96,
  fipcultes:        709
};

// TTL caches
const showsCache = { shows: [], fetchedAt: 0, TTL_MS: 1000 * 60 * 30 };
const summaryCache = new Map();
const liveNowCache = new Map();
const LIVE_NOW_TTL = 1000 * 30; // 30s — matches renderer poll interval

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "fr,en;q=0.9"
};

const { cleanText, stripHtml } = require("./utils");

/**
 * Parse a duration value (ISO 8601 or plain seconds) to an integer seconds count.
 */
function parseDurationSeconds(str) {
  if (!str && str !== 0) return 0;
  const n = Number(str);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  // ISO 8601: PT1H30M or PT1H30M0S
  const m = String(str).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (m) return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Math.round(Number(m[3] || 0));
  return 0;
}

async function fetchJson(url, extraHeaders = {}) {
  const headers = { ...FETCH_HEADERS, Accept: "application/json", ...extraHeaders };
  if (typeof fetch !== "undefined") {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`FIP API ${res.status} for ${url}`);
    return res.json();
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? require("node:https") : require("node:http");
    const req = mod.get(url, { headers }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`FIP API ${res.statusCode} for ${url}`));
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

async function fetchText(url) {
  if (typeof fetch !== "undefined") {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`FIP fetch ${res.status} for ${url}`);
    return res.text();
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? require("node:https") : require("node:http");
    const req = mod.get(url, { headers: FETCH_HEADERS }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`FIP fetch ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

/**
 * Parse a French airtime string (e.g. "Tous les jours à 19h") into
 * English display text, cadence, and UTC runSchedule ("HH:MM").
 */
function parseFipAirtime(airtime) {
  if (!airtime) return { english: "", cadence: "irregular", runSchedule: "" };
  const s = String(airtime).toLowerCase().trim();

  // Extract hour/minute from "à Xh" or "à Xhxx"
  const hourMatch = s.match(/à\s*(\d{1,2})h(\d{2})?/);
  const localHour = hourMatch ? parseInt(hourMatch[1], 10) : null;
  const localMin  = hourMatch && hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;

  // Paris → UTC offset: rough DST (UTC+2 Apr-Oct, UTC+1 otherwise)
  let runSchedule = "";
  if (localHour !== null) {
    const mo = new Date().getMonth() + 1;
    const parisOff = (mo >= 4 && mo <= 10) ? 2 : 1;
    const utcH = (localHour - parisOff + 24) % 24;
    runSchedule = `${String(utcH).padStart(2, "0")}:${String(localMin).padStart(2, "0")}`;
  }

  // Cadence and English day
  let cadence = "irregular";
  let engDay = "";
  const dayMap = [
    [["tous les jours", "chaque jour", "quotidien"], "daily",   "Every day"],
    [["du lundi au vendredi", "lundi au vendredi"],  "weekday", "Mon–Fri"],
    [["du lundi au jeudi",    "lundi au jeudi"],     "weekday", "Mon–Thu"],
    [["du lundi au mercredi", "lundi au mercredi"],  "weekday", "Mon–Wed"],
    [["du mardi au vendredi", "mardi au vendredi"],  "weekday", "Tue–Fri"],
    [["week-end", "weekend"],                        "weekly",  "Weekends"],
    [["lundi"],                                      "weekly",  "Mondays"],
    [["mardi"],                                      "weekly",  "Tuesdays"],
    [["mercredi"],                                   "weekly",  "Wednesdays"],
    [["jeudi"],                                      "weekly",  "Thursdays"],
    [["vendredi"],                                   "weekly",  "Fridays"],
    [["samedi"],                                     "weekly",  "Saturdays"],
    [["dimanche"],                                   "weekly",  "Sundays"],
  ];
  for (const [patterns, cad, label] of dayMap) {
    if (patterns.some((p) => s.includes(p))) { cadence = cad; engDay = label; break; }
  }

  // English time (12h)
  let engTime = "";
  if (localHour !== null) {
    const h12 = localHour === 0 ? 12 : localHour > 12 ? localHour - 12 : localHour;
    const ampm = localHour < 12 ? "AM" : "PM";
    engTime = localMin ? ` at ${h12}:${String(localMin).padStart(2, "0")} ${ampm}` : ` at ${h12} ${ampm}`;
  }

  const english = engDay ? `${engDay}${engTime}` : (engTime ? engTime.trim() : airtime);
  return { english, cadence, runSchedule };
}

/** Normalize a FIP podcast show URL to canonical form. */
function normalizeFipProgramUrl(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const m = parsed.pathname.match(/^\/fip\/podcasts\/([^/?#]+)/i);
      if (m) return `${BASE_URL}/fip/podcasts/${m[1]}`;
    } catch {}
    return raw;
  }
  const stripped = raw.replace(/^\//, "").replace(/^fip\/podcasts\//, "");
  return `${BASE_URL}/fip/podcasts/${stripped}`;
}

function getSlugFromUrl(url) {
  const m = String(url || "").match(/\/fip\/podcasts\/([^/?#]+)/i);
  return m ? m[1] : "";
}

function resolveImageUrl(src, preset) {
  if (!src) return "";
  const s = String(src).trim();
  let url;
  if (s.startsWith("http")) url = s;
  else if (s.startsWith("//")) url = "https:" + s;
  else if (s.startsWith("/")) url = BASE_URL + s;
  else url = s;
  // Radio France pikapi images need a preset suffix (/raw, /400x400, etc.)
  if (url.includes("/pikapi/images/") && !url.match(/\/[a-z0-9x]+$/)) {
    url = url.replace(/\/$/, "") + "/" + (preset || "raw");
  }
  return url;
}

/**
 * Dereference SvelteKit compressed data array.
 * Values that are integers in the range [0, arr.length) are treated as indices.
 */
function deref(v, arr, depth = 0) {
  if (depth > 8) return v;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < arr.length) {
    return deref(arr[v], arr, depth + 1);
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = deref(v[k], arr, depth + 1);
    return out;
  }
  if (Array.isArray(v)) return v.map((x) => deref(x, arr, depth + 1));
  return v;
}

/**
 * Fetch and parse the SvelteKit /__data.json for a FIP podcast page.
 * Returns { concept, items, nextCursor, prevCursor } where concept has show metadata
 * and items is the array of episode objects.
 */
async function fetchPageData(slug, cursor = null) {
  let url = `${BASE_URL}/fip/podcasts/${encodeURIComponent(slug)}/__data.json`;
  if (cursor) url += `?pageCursor=${encodeURIComponent(cursor)}`;

  const json = await fetchJson(url);
  const nodes = Array.isArray(json?.nodes) ? json.nodes : [];

  // Find the largest data node (the main page data)
  let arr = [];
  for (const node of nodes) {
    const nd = node?.data;
    if (Array.isArray(nd) && nd.length > arr.length) arr = nd;
  }
  if (!arr.length) return { concept: null, items: [], nextCursor: null, prevCursor: null };

  // Find the pagination object { items, next, prev }
  let paginationObj = null;
  for (const v of arr) {
    if (v && typeof v === "object" && !Array.isArray(v) &&
        "items" in v && "next" in v && "prev" in v) {
      paginationObj = deref(v, arr);
      break;
    }
  }

  // Find the Concept (show) object - model may be a string or an integer index
  let conceptObj = null;
  for (const v of arr) {
    if (v && typeof v === "object" && !Array.isArray(v) && "standFirst" in v && "visual_400x400" in v) {
      const modelVal = typeof v.model === "number" ? arr[v.model] : v.model;
      if (modelVal === "Concept") {
        conceptObj = deref(v, arr);
        break;
      }
    }
  }

  // Map pagination items to episode shape
  const rawItems = Array.isArray(paginationObj?.items) ? paginationObj.items : [];
  const items = rawItems.map((item) => mapPageItem(item, slug));

  const concept = conceptObj ? {
    id: String(conceptObj.id || "").trim(),
    title: cleanText(conceptObj.title || slug.replace(/-/g, " ")),
    description: cleanText(stripHtml(conceptObj.standFirst || conceptObj.description || "")),
    image: resolveImageUrl(conceptObj.visual_400x400?.src || conceptObj.visual?.src || ""),
    genres: extractGenres(conceptObj),
    hosts: extractHosts(conceptObj),
    airtime: String(conceptObj.airtime || "").trim()
  } : null;

  return {
    concept,
    items,
    nextCursor: paginationObj?.next || null,
    prevCursor: paginationObj?.prev || null
  };
}

// Generic FIP-wide category labels to suppress from genre pills
const GENRE_BLOCKLIST = new Set([
  "musiques – actualité musicale",
  "musiques - actualite musicale",
  "actualité musicale",
  "actualite musicale",
  "musiques",
]);

function extractGenres(obj) {
  if (!obj) return [];
  const genres = [];
  for (const field of ["taxonomies", "tags", "themes", "tagsAndPersonalities"]) {
    const taxo = obj[field];
    if (!Array.isArray(taxo)) continue;
    for (const t of taxo) {
      const label = cleanText(t?.path?.taxonomy?.label || t?.label || t?.title || t?.name || "");
      if (label && !genres.includes(label) && !GENRE_BLOCKLIST.has(label.toLowerCase())) genres.push(label);
    }
  }
  return genres;
}

function uniqueCleanList(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const text = cleanText(value || "");
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

function collectFipPeople(value, bucket) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectFipPeople(entry, bucket));
    return;
  }
  if (typeof value === "string") {
    const text = cleanText(value);
    if (text) {
      bucket.push(text);
    }
    return;
  }
  if (typeof value === "object") {
    const directName = cleanText(
      value.name
      || value.title
      || value.label
      || [value.firstName, value.lastName].filter(Boolean).join(" ")
      || value?.path?.taxonomy?.label
    );
    if (directName) {
      bucket.push(directName);
    }
  }
}

function extractHosts(obj) {
  if (!obj || typeof obj !== "object") {
    return [];
  }
  const hosts = [];
  for (const field of ["authors", "author", "hosts", "host", "personalities", "personality", "presenters", "presenter", "contributors", "contributor", "guests", "guest", "tagsAndPersonalities"]) {
    if (obj[field]) {
      collectFipPeople(obj[field], hosts);
    }
  }
  return uniqueCleanList(hosts).slice(0, 6);
}

function mapPageItem(item, showSlug) {
  if (!item || typeof item !== "object") return null;

  const title = cleanText(item.title || "");
  const description = cleanText(stripHtml(item.description || item.standFirst || ""));
  const image = resolveImageUrl(item.visual?.src || "");

  // Episode URL from link field (e.g. "/fip/podcasts/live-a-fip/gildaa-...")
  const linkPath = String(item.link || "").trim();
  const episodeUrl = linkPath
    ? (linkPath.startsWith("http") ? linkPath : `${BASE_URL}${linkPath.startsWith("/") ? "" : "/"}${linkPath}`)
    : "";

  // Direct audio URL from manifestations
  const manifestations = Array.isArray(item.manifestations) ? item.manifestations : [];
  const audioManifest = manifestations.find((m) => m?.model === "ManifestationAudio") || manifestations[0];
  const downloadUrl = String(audioManifest?.url || "").trim();

  // Published date from playerInfo.publishedDate (unix seconds)
  const publishedTs = Number(item.playerInfo?.publishedDate || item.playerInfo?.startDate || 0);
  const publishedDate = publishedTs ? new Date(publishedTs * 1000).toISOString().slice(0, 10) : "";

  // Duration (seconds or ISO 8601)
  const durationRaw = item.playerInfo?.duration || item.duration;
  const duration = String(durationRaw || "").trim();

  // Genres from conceptId + item taxonomies (none usually at item level)
  const genres = extractGenres(item);
  const hosts = extractHosts(item);

  // id: prefer item.id, fall back to last path segment
  const id = String(item.id || linkPath.split("/").filter(Boolean).pop() || "").trim();

  if (!title && !episodeUrl) return null;

  return {
    clipId: id,
    id,
    title,
    fullTitle: title,
    description,
    episodeUrl,
    downloadUrl,
    publishedTime: publishedDate,
    broadcastStartTs: publishedTs || 0,
    image,
    duration,
    genres: genres.length ? genres : undefined,
    hosts: hosts.length ? hosts : undefined,
    programUrl: `${BASE_URL}/fip/podcasts/${showSlug}`
  };
}

// ── Live ─────────────────────────────────────────────────────────────────────

function getFipLiveStations() {
  return LIVE_STATIONS;
}

/** Fetch the currently-playing song from livemeta. Returns null if unavailable. */
async function getFipCurrentSong(stationId) {
  const liveMetaId = STATION_LIVEMETA_ID[stationId];
  if (!liveMetaId) return null;
  try {
    const noCacheHeaders = { "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" };
    const ts = Date.now();
    const json = await fetchJson(`https://api.radiofrance.fr/livemeta/pull/${liveMetaId}?_=${ts}`, noCacheHeaders);
    const steps = Object.values(json?.steps || {});
    const nowSec = ts / 1000;
    // Find the step that is currently playing
    const current = steps.find((s) => s.embedType === "song" && s.start <= nowSec && s.end > nowSec)
      // Fallback: most recently ended song, but only if it ended within the last 3 minutes
      || steps.filter((s) => s.embedType === "song" && s.end <= nowSec && nowSec - s.end < 180)
          .sort((a, b) => b.end - a.end)[0];
    if (!current) return null;
    // livemeta step `visual` is a plain URL string, not an object
    const coverSrc = (typeof current.visual === "string" ? current.visual : "") || current.visuals?.card?.src || current.cover || "";
    return {
      title: cleanText(current.title || ""),
      artist: cleanText((current.highlightedArtists || []).join(", ") || current.authors || ""),
      coverUrl: coverSrc || ""
    };
  } catch {
    return null;
  }
}

async function getFipNowPlaying(stationId) {
  const sid = String(stationId || "fip").toLowerCase().trim();
  const station = LIVE_STATIONS.find((s) => s.id === sid) || LIVE_STATIONS[0];

  const cached = liveNowCache.get(sid);
  if (cached && Date.now() - cached.fetchedAt < LIVE_NOW_TTL) return cached.data;

  const apiSlug = STATION_LIVE_API_SLUG[sid] || "fip";
  const webradioSlug = STATION_WEBRADIO_SLUG[sid];
  const ts = Date.now();
  // Sub-stations: use /fip/api/live?webradio=fip_X (not /fip/radio-X/api/live which is 404)
  const apiUrl = webradioSlug
    ? `${BASE_URL}/${apiSlug}/api/live?webradio=${webradioSlug}&_=${ts}`
    : `${BASE_URL}/${apiSlug}/api/live?_=${ts}`;
  const noCacheHeaders = { "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" };

  try {
    const [json, currentSong] = await Promise.allSettled([
      fetchJson(apiUrl, noCacheHeaders),
      getFipCurrentSong(sid)
    ]).then((r) => r.map((p) => (p.status === "fulfilled" ? p.value : null)));

    const now = json?.now || json?.data?.now || {};
    const firstLine = cleanText(now?.firstLine?.title || now?.song?.title || "");
    const secondLine = cleanText(now?.secondLine?.title || now?.song?.interpreters?.[0] || "");
    // Visual: prefer broadcast visuals (card/player), fall back to livemeta song cover
    const cardVisual = now?.visuals?.card || now?.visuals?.player || {};
    const cover = resolveImageUrl(
      cardVisual.src || json?.visual?.src || now?.visual?.src || now?.cover || currentSong?.coverUrl || "",
      cardVisual.preset
    );
    const showPath = now?.firstLine?.path || "";
    const showId = now?.firstLine?.id || "";
    // Sub-stations: live API returns 404 → firstLine/secondLine empty → fall back to livemeta currentSong
    const title = firstLine || cleanText(currentSong?.title || "");
    const artist = secondLine || cleanText(currentSong?.artist || "");
    const data = {
      stationId: sid,
      stationName: station.name,
      streamUrl: station.streamUrl,
      liveUrl: station.liveUrl,
      title,
      artist,
      coverUrl: cover,
      showPath,
      showId,
      currentSong: currentSong || null
    };
    liveNowCache.set(sid, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    const data = { stationId: sid, stationName: station.name, streamUrl: station.streamUrl, liveUrl: station.liveUrl, title: "", artist: "", coverUrl: "", showPath: "", showId: "", currentSong: null };
    liveNowCache.set(sid, { data, fetchedAt: Date.now() - LIVE_NOW_TTL + 10000 });
    return data;
  }
}

// ── Podcast shows listing ─────────────────────────────────────────────────────

async function fetchFipShowList(useCache = true) {
  const now = Date.now();
  if (useCache && showsCache.shows.length && now - showsCache.fetchedAt < showsCache.TTL_MS) {
    return showsCache.shows;
  }

  const shows = [];
  const seen = new Set();

  try {
    const html = await fetchText(`${BASE_URL}/fip/podcasts`);
    const pattern = /href=["']\/fip\/podcasts\/([a-z0-9][a-z0-9-]{1,80})["'][^>]*>([\s\S]*?)<\//gi;
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const slug = m[1];
      if (seen.has(slug) || /^\d+$/.test(slug) || slug === "page") continue;
      seen.add(slug);
      const rawTitle = stripHtml(m[2] || "").trim();
      shows.push({ slug, title: cleanText(rawTitle) || slug.replace(/-/g, " ") });
    }
  } catch {}

  // Seed list of known FIP podcasts (fallback if scraping fails)
  const seeds = [
    { slug: "certains-laiment-fip",       title: "certains l'aiment fip" },
    { slug: "live-a-fip",                 title: "live à fip" },
    { slug: "fip-tape",                   title: "fip tape" },
    { slug: "speciales-fip",              title: "spéciales fip" },
    { slug: "club-jazzafip",              title: "club jazzafip" },
    { slug: "fip-360",                    title: "fip 360" },
    { slug: "transe-fip-express",         title: "transe fip express" },
    { slug: "la-bibliotheque-de-fip",     title: "la bibliothèque de fip" },
    { slug: "fip-myd-les-amis-a-table",   title: "fip, myd, les amis... a table !" },
    { slug: "fip-en-concert",             title: "fip en concert" },
    { slug: "open-jazz",                  title: "open jazz" },
    { slug: "elles-jouent",               title: "elles jouent" }
  ];
  for (const s of seeds) {
    if (!seen.has(s.slug)) { seen.add(s.slug); shows.push(s); }
  }

  if (shows.length) { showsCache.shows = shows; showsCache.fetchedAt = now; }
  return shows;
}

// ── Program metadata ─────────────────────────────────────────────────────────

/**
 * Fetch show metadata via /__data.json page parse.
 * Returns { uuid, title, description, image, genres }.
 */
async function fetchShowMeta(slug) {
  if (summaryCache.has(slug)) return summaryCache.get(slug);
  try {
    const { concept } = await fetchPageData(slug);
    if (concept && concept.title) {
      const { english: airtimeEn, cadence, runSchedule } = parseFipAirtime(concept.airtime);
      const [titleEn, descEn, genresEn] = await Promise.all([
        translateFr(concept.title || ""),
        translateFr((concept.description || "").slice(0, 450)),
        translateMetadataList(concept.genres || [], 2)
      ]);
      const meta = {
        uuid: concept.id,
        title: titleEn || concept.title,
        description: descEn || concept.description,
        image: concept.image,
        genres: genresEn.length ? genresEn : (concept.genres || []),
        hosts: concept.hosts || [],
        airtime: concept.airtime || "",
        airtimeEn,
        cadence,
        runSchedule
      };
      summaryCache.set(slug, meta);
      return meta;
    }
  } catch {}
  const fallback = { uuid: "", title: slug.replace(/-/g, " "), description: "", image: "", genres: [], hosts: [], airtime: "", airtimeEn: "", cadence: "irregular", runSchedule: "" };
  return fallback;
}

async function getFipProgramSummary(showUrl) {
  const url = normalizeFipProgramUrl(showUrl);
  if (!url) return { source: "fip", programUrl: "", title: "FIP", description: "", image: "", runSchedule: "", cadence: "irregular", genres: [], hosts: [] };

  const slug = getSlugFromUrl(url);
  try {
    const meta = await fetchShowMeta(slug);
    return {
      source: "fip",
      programUrl: url,
      title: meta.title || slug.replace(/-/g, " "),
      description: meta.description,
      image: meta.image,
      uuid: meta.uuid,
      runSchedule: meta.runSchedule || "",
      cadence: meta.cadence || "irregular",
      nextBroadcastAt: "",
      genres: meta.genres,
      hosts: meta.hosts || [],
      airtime: meta.airtimeEn || meta.airtime || ""
    };
  } catch {
    return { source: "fip", programUrl: url, title: slug.replace(/-/g, " "), description: "", image: "", uuid: "", runSchedule: "", cadence: "irregular", nextBroadcastAt: "", genres: [], hosts: [] };
  }
}

// ── Episodes ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20; // Radio France returns 20 per page
// cursor cache: slug → [null, cursor_after_p1, cursor_after_p2, ...]
const cursorCache = new Map();

async function getFipProgramEpisodes(showUrl, page = 1) {
  const url = normalizeFipProgramUrl(showUrl);
  if (!url) throw new Error("Invalid FIP show URL.");

  const slug = getSlugFromUrl(url);
  const safePage = Math.max(1, Number(page) || 1);

  // Build / walk cursor cache
  const cursors = cursorCache.get(slug) || [null];

  // Walk forward to reach the cursor for safePage
  while (cursors.length < safePage) {
    const prevCursor = cursors[cursors.length - 1];
    if (prevCursor === undefined) break; // no more pages
    try {
      const { concept, nextCursor } = await fetchPageData(slug, prevCursor);
      // Cache the concept from first page fetch
      if (concept && !summaryCache.has(slug)) {
        summaryCache.set(slug, { uuid: concept.id, title: concept.title, description: concept.description, image: concept.image, genres: concept.genres || [], hosts: concept.hosts || [] });
      }
      cursors.push(nextCursor !== null ? nextCursor : undefined);
      cursorCache.set(slug, cursors);
      if (!nextCursor) break;
    } catch {
      cursors.push(undefined);
      cursorCache.set(slug, cursors);
      break;
    }
  }

  const cursor = cursors[safePage - 1];
  let episodes = [];
  let nextCursor = null;
  let concept = null;

  if (cursor !== undefined) {
    try {
      const result = await fetchPageData(slug, cursor);
      concept = result.concept;
      episodes = result.items.filter(Boolean);
      nextCursor = result.nextCursor;
      if (nextCursor !== null && !cursors[safePage]) {
        cursors[safePage] = nextCursor;
        cursorCache.set(slug, cursors);
      }
    } catch {}
  }

  // Get show meta (may already be cached) — always use fetchShowMeta so airtime/cadence are populated
  const cachedMeta = summaryCache.get(slug);
  const meta = (cachedMeta && cachedMeta.cadence) ? cachedMeta : await fetchShowMeta(slug).catch(() =>
    cachedMeta || (concept ? { uuid: concept.id, title: concept.title, description: concept.description, image: concept.image, genres: concept.genres || [], hosts: concept.hosts || [], cadence: "irregular", runSchedule: "", airtime: "", airtimeEn: "" } : null)
  );

  // Translate episode descriptions in parallel (cached, so no re-fetch on same text)
  await Promise.all(episodes.map(async (ep) => {
    if (!ep) {
      return;
    }
    const [titleEn, fullTitleEn, descEn, genresEn] = await Promise.all([
      ep.title ? translateFr({ text: ep.title, minLength: 4 }) : "",
      ep.fullTitle ? translateFr({ text: ep.fullTitle, minLength: 4 }) : "",
      ep.description ? translateFr({ text: ep.description.slice(0, 450), minLength: 8 }) : "",
      translateMetadataList(ep.genres || [], 2)
    ]);
    if (titleEn) ep.title = titleEn;
    if (fullTitleEn) ep.fullTitle = fullTitleEn;
    if (descEn) ep.description = descEn;
    if (genresEn.length) ep.genres = genresEn;
  }));

  const numPages = nextCursor ? safePage + 1 : safePage;
  const totalItems = numPages * PAGE_SIZE; // approximate

  // Aggregate genres from episodes
  const genreCount = new Map();
  for (const ep of episodes) {
    if (ep?.genres) for (const g of ep.genres) genreCount.set(g, (genreCount.get(g) || 0) + 1);
  }
  const topGenres = (meta?.genres?.length)
    ? meta.genres
    : [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);
  const hostCount = new Map();
  for (const ep of episodes) {
    if (ep?.hosts) {
      for (const host of ep.hosts) {
        hostCount.set(host, (hostCount.get(host) || 0) + 1);
      }
    }
  }
  const topHosts = (meta?.hosts?.length)
    ? meta.hosts
    : [...hostCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([host]) => host);
  const enrichedEpisodes = episodes.map((ep) => ({
    ...ep,
    description: ep?.description || meta?.description || "",
    image: ep?.image || meta?.image || "",
    genres: ep?.genres?.length ? ep.genres : topGenres,
    hosts: ep?.hosts?.length ? ep.hosts : topHosts
  }));

  return {
    source: "fip",
    programUrl: url,
    title: meta?.title || slug.replace(/-/g, " "),
    description: meta?.description || "",
    image: meta?.image || "",
    episodes: enrichedEpisodes,
    totalItems,
    page: safePage,
    numPages,
    cadence: meta?.cadence || "irregular",
    averageDaysBetween: null,
    runSchedule: meta?.runSchedule || "",
    airtime: meta?.airtimeEn || meta?.airtime || "",
    nextBroadcastAt: "",
    genres: topGenres.length ? topGenres : undefined,
    hosts: topHosts.length ? topHosts : undefined
  };
}

// ── Search ───────────────────────────────────────────────────────────────────

function scoreTextMatch(value, query, exactWeight, prefixWeight, includesWeight) {
  const text = cleanText(value || "").toLowerCase();
  if (!text || !query) {
    return 0;
  }
  if (text === query) {
    return exactWeight;
  }
  if (text.startsWith(query)) {
    return prefixWeight;
  }
  if (text.includes(query)) {
    return includesWeight;
  }
  return 0;
}

function scoreListMatch(values, query, exactWeight, prefixWeight, includesWeight) {
  let best = 0;
  for (const value of values || []) {
    best = Math.max(best, scoreTextMatch(value, query, exactWeight, prefixWeight, includesWeight));
  }
  return best;
}

function buildFipSearchText(item) {
  return [
    item.title,
    item.description,
    item.cadence,
    item.airtime,
    item.runSchedule,
    ...(item.hosts || []),
    ...(item.genres || [])
  ]
    .map((value) => cleanText(value || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function scoreFipProgramResult(item, query) {
  if (!query) {
    return 0;
  }

  let score = 0;
  score += scoreTextMatch(item.title, query, 240, 190, 140);
  score += scoreTextMatch(item.description, query, 95, 0, 60);
  score += scoreTextMatch(item.airtime, query, 80, 65, 45);
  score += scoreTextMatch(item.runSchedule, query, 35, 25, 15);
  score += scoreTextMatch(item.cadence, query, 30, 20, 15);
  score += scoreListMatch(item.hosts, query, 230, 190, 150);
  score += scoreListMatch(item.genres, query, 170, 145, 115);

  const tokens = query.split(/\s+/g).filter(Boolean);
  if (tokens.length > 1) {
    const searchText = buildFipSearchText(item);
    if (tokens.every((token) => searchText.includes(token))) {
      score += 70;
    }
  }

  return score;
}

async function searchFipPrograms(query) {
  const q = cleanText(query || "").toLowerCase();
  const shows = await fetchFipShowList(true).catch(() => []);

  const matched = q
    ? shows
    : shows.slice(0, 20);

  // Enrich matched shows with metadata (parallel, limited concurrency)
  const concurrency = 4;
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < matched.length) {
      const s = matched[idx++];
      const showUrl = `${BASE_URL}/fip/podcasts/${s.slug}`;
      try {
        const meta = await fetchShowMeta(s.slug);
        results.push({
          source: "fip",
          programUrl: showUrl,
          title: meta.title || s.title,
          description: meta.description,
          image: meta.image,
          genres: meta.genres,
          hosts: meta.hosts || [],
          cadence: meta.cadence || "irregular",
          airtime: meta.airtimeEn || meta.airtime || "",
          runSchedule: meta.runSchedule || ""
        });
      } catch {
        const titleEn = await translateFr(s.title || "").catch(() => "");
        results.push({ source: "fip", programUrl: showUrl, title: titleEn || s.title, description: "", image: "", genres: [], hosts: [], cadence: "irregular", airtime: "", runSchedule: "" });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, matched.length)) }, () => worker()));
  if (!q) {
    return results;
  }
  return results
    .map((item) => ({ ...item, _score: scoreFipProgramResult(item, q) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) {
        return b._score - a._score;
      }
      return String(a.title || "").localeCompare(String(b.title || ""), "en");
    })
    .map((item) => {
      const copy = { ...item };
      delete copy._score;
      return copy;
    });
}

// ── Episode stream (for playback / CUE preview) ───────────────────────────────

/**
 * Resolve a playable stream URL for an episode.
 * Tries direct URL from manifestations first, falls back to yt-dlp.
 */
async function getFipEpisodeStream(episodeUrl, runYtDlpJson) {
  const url = String(episodeUrl || "").trim();
  if (!url) throw new Error("episodeUrl is required.");

  // Try yt-dlp if available
  if (runYtDlpJson) {
    try {
      const json = await runYtDlpJson({ url, args: ["-J", "--no-playlist", "--playlist-items", "1"] });
      const direct = String(json?.url || json?.requested_downloads?.[0]?.url || "").trim();
      if (direct) return { episodeUrl: url, streamUrl: direct, title: String(json?.title || "").trim(), image: String(json?.thumbnail || "").trim() };
    } catch {}
  }

  // Try fetching /__data.json to get direct audio URL
  const slugMatch = url.match(/\/fip\/podcasts\/([^/?#]+)\/([^/?#]+)/);
  if (slugMatch) {
    const [, showSlug, episodeSlug] = slugMatch;
    try {
      const episodePageUrl = `${BASE_URL}/fip/podcasts/${showSlug}/${episodeSlug}/__data.json`;
      const json = await fetchJson(episodePageUrl);
      const nodes = Array.isArray(json?.nodes) ? json.nodes : [];
      for (const node of nodes) {
        const arr = Array.isArray(node?.data) ? node.data : [];
        for (const v of arr) {
          if (v && typeof v === "object" && Array.isArray(v.manifestations)) {
            const mf = v.manifestations.map((m) => (typeof m === "number" ? arr[m] : m));
            const audio = mf.find((m) => m?.model === "ManifestationAudio") || mf[0];
            if (audio?.url) return { episodeUrl: url, streamUrl: String(audio.url), title: "", image: "" };
          }
        }
      }
    } catch {}
  }

  throw new Error("Could not resolve FIP stream URL.");
}

// ── Episode tracklist (song history) ──────────────────────────────────────────

// Map station IDs to the `station` query param used by the historical songs API.
// Matches STATION_WEBRADIO_SLUG format (underscores), with null → "fip" for main station.
const STATION_SONGS_API_ID = {
  fip:              "fip",
  fiprock:          "fip_rock",
  fipjazz:          "fip_jazz",
  fipgroove:        "fip_groove",
  fipworld:         "fip_world",
  fipreggae:        "fip_reggae",
  fipelectro:       "fip_electro",
  fiphiphop:        "fip_hiphop",
  fippop:           "fip_pop",
  fipmetal:         "fip_metal",
  fipnouveautes:    "fip_nouveautes",
  fipsacrefrancais: "fip_sacre_francais",
  fipcultes:        "fip_cultes"
};

/**
 * Fetch the song tracklist for a FIP podcast episode.
 *
 * Uses the public `GET /api/songs?station=fip&start=X&stop=Y` endpoint (no auth
 * required). Supports episodes up to ~30 days old — far beyond the 12h live
 * window of /fip/fip/api/songs. The start/stop parameters filter results to the
 * exact broadcast window so pagination is bounded by episode length, not history depth.
 *
 * @param {string} episodeUrl  Full URL of the episode page
 * @param {object} [opts]      Optional timing override: { startTs, durationSecs }
 * @returns {Array}  Track objects { title, artist, album, year, image, links, startSeconds }
 */
async function getFipEpisodeTracklist(episodeUrl, opts = {}) {
  const url = String(episodeUrl || "").trim();
  if (!url) return [];

  // ── 1. Get episode broadcast timing ───────────────────────────────────────
  let startTs      = Number(opts.startTs      || 0);
  let durationSecs = Number(opts.durationSecs || 0);

  if (!startTs) {
    // Fetch episode /__data.json to extract playerInfo timing
    try {
      const cleanUrl = url.replace(/[?#].*$/, "");
      const dataUrl  = cleanUrl.endsWith("/__data.json") ? cleanUrl : `${cleanUrl}/__data.json`;
      const json     = await fetchJson(dataUrl);
      const nodes    = Array.isArray(json?.nodes) ? json.nodes : [];

      outer: for (const node of nodes) {
        const arr = Array.isArray(node?.data) ? node.data : [];
        for (const v of arr) {
          if (!v || typeof v !== "object" || Array.isArray(v)) continue;
          const piRaw = v.playerInfo;
          if (piRaw == null) continue;
          const pi = deref(piRaw, arr);
          if (!pi || typeof pi !== "object") continue;
          const ts = Number(pi.publishedDate || pi.startDate || 0);
          if (ts > 1_000_000) {
            startTs = ts;
            if (!durationSecs) {
              const durRaw = pi.duration || v.duration;
              if (durRaw != null) durationSecs = parseDurationSeconds(String(durRaw));
            }
            break outer;
          }
        }
      }
    } catch {}
  }

  if (!startTs) return [];
  if (!durationSecs) durationSecs = 7200; // 2h default

  const endTs  = startTs + durationSecs;
  const nowSec = Date.now() / 1000;

  // The Radio France songs API has no documented date limit and works for episodes
  // many months in the past (confirmed via live network inspection). Skip only if
  // the episode hasn't aired yet.
  if (startTs > nowSec + 300) return []; // episode is in the future (>5 min ahead)

  // ── 2. Fetch from historical songs API ────────────────────────────────────
  // All FIP podcast shows air on the main FIP channel ("fip").
  // Sub-station IDs (fiprock, fipjazz…) are handled for completeness.
  const stationId = STATION_SONGS_API_ID.fip; // always "fip" for podcasts
  const songsBase = `${BASE_URL}/api/songs?station=${stationId}&start=${startTs}&stop=${endTs}`;

  const tracks = [];
  let cursor   = null;
  const MAX_PAGES = 50; // 10 songs/page × 50 = 500 songs max (covers multi-hour shows)

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = cursor
      ? `${songsBase}&pageCursor=${encodeURIComponent(cursor)}`
      : songsBase;

    let data;
    try {
      data = await fetchJson(pageUrl);
    } catch {
      break;
    }

    const songs = Array.isArray(data?.songs) ? data.songs : [];

    for (const song of songs) {
      const songStart = Number(song?.start || 0);
      // The API already filters by start/stop, but guard defensively
      if (songStart >= startTs && songStart < endTs) {
        tracks.push({
          title:        String(song?.secondLine || "").trim(),
          artist:       String(song?.firstLine  || "").trim(),
          album:        String(song?.release?.title || "").trim(),
          year:         song?.release?.year || song?.thirdLine || null,
          image:        String(song?.visual?.src || "").trim(),
          links:        Array.isArray(song?.links) ? song.links : [],
          startSeconds: songStart - startTs
        });
      }
    }

    cursor = data?.next || null;
    if (!cursor || !songs.length) break;
  }

  // Sort ascending by startSeconds (API may return newest-first)
  tracks.sort((a, b) => a.startSeconds - b.startSeconds);
  return tracks;
}

function getFipMetadataRichnessScore(item) {
  return [
    item.image ? 1 : 0,
    item.description ? 2 : 0,
    Array.isArray(item.hosts) ? Math.min(item.hosts.length, 3) * 2 : 0,
    Array.isArray(item.genres) ? Math.min(item.genres.length, 3) : 0,
    item.runSchedule ? 2 : 0,
    item.airtime ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function scoreFipDiscoveryNovelty(item, selected) {
  const seenHosts = new Set();
  const seenGenres = new Set();
  const seenTitles = new Set();

  for (const entry of selected || []) {
    for (const host of entry.hosts || []) {
      seenHosts.add(cleanText(host || "").toLowerCase());
    }
    for (const genre of entry.genres || []) {
      seenGenres.add(cleanText(genre || "").toLowerCase());
    }
    seenTitles.add(cleanText(entry.title || "").toLowerCase());
  }

  let score = 0;
  const titleKey = cleanText(item.title || "").toLowerCase();
  if (titleKey && !seenTitles.has(titleKey)) {
    score += 2;
  }
  for (const host of item.hosts || []) {
    const key = cleanText(host || "").toLowerCase();
    if (key && !seenHosts.has(key)) {
      score += 5;
    }
  }
  for (const genre of item.genres || []) {
    const key = cleanText(genre || "").toLowerCase();
    if (key && !seenGenres.has(key)) {
      score += 3;
    }
  }
  return score;
}

function pickFipDiscoveryResults(items, count) {
  const remaining = (items || [])
    .map((item) => ({
      item,
      richness: getFipMetadataRichnessScore(item) + Math.random()
    }))
    .sort((a, b) => b.richness - a.richness)
    .map((entry) => entry.item);

  const selected = [];
  while (remaining.length && selected.length < count) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const score = getFipMetadataRichnessScore(item) + scoreFipDiscoveryNovelty(item, selected) + Math.random();
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

async function getFipDiscovery(count = 12) {
  const shows = await fetchFipShowList(true).catch(() => []);
  // Sample more than needed to account for failures and dedup
  const shuffled = [...shows].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, Math.min(count * 3, shuffled.length));

  const results = [];
  const seenTitles = new Set();
  const concurrency = 4;
  let idx = 0;
  async function worker() {
    while (idx < sample.length) {
      const s = sample[idx++];
      const showUrl = `${BASE_URL}/fip/podcasts/${s.slug}`;
      try {
        const meta = await fetchShowMeta(s.slug);
        // Skip stubs with no image and no description
        if (!meta.image && !meta.description) continue;
        const normalTitle = (meta.title || s.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenTitles.has(normalTitle)) continue;
        seenTitles.add(normalTitle);
        const descEn = await translateFr((meta.description || "").slice(0, 450));
        results.push({
          source: "fip",
          programUrl: showUrl,
          title: meta.title || s.title,
          description: descEn || meta.description,
          image: meta.image,
          genres: meta.genres,
          hosts: meta.hosts || [],
          cadence: meta.cadence || "irregular",
          airtime: meta.airtimeEn || meta.airtime || "",
          runSchedule: meta.runSchedule || ""
        });
      } catch { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, sample.length)) }, () => worker()));
  return pickFipDiscoveryResults(results, count);
}

module.exports = {
  LIVE_STATIONS,
  getFipLiveStations,
  getFipNowPlaying,
  searchFipPrograms,
  getFipDiscovery,
  getFipProgramSummary,
  getFipProgramEpisodes,
  getFipEpisodeStream,
  getFipEpisodeTracklist,
  normalizeFipProgramUrl,
  parseFipAirtime,
  configure
};
