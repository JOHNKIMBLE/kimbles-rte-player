/**
 * Worldwide FM (worldwidefm.net) integration.
 * Episodes are listed at /shows; titles use "Show Name : Episode Name" or just "Host Name".
 */

const BASE_URL = "https://www.worldwidefm.net";

const LIVE_STATIONS = [
  { id: "worldwidefm", name: "Worldwide FM", liveUrl: `${BASE_URL}/`, streamUrl: "https://worldwide-fm.radiocult.fm/stream" }
];

const SCHEDULE_URL = `${BASE_URL}/schedule`;
const liveNowCache = { fetchedAt: 0, data: null, TTL_MS: 1000 * 60 * 2 };

const episodesCache = {
  fetchedAt: 0,
  episodes: [],
  TTL_MS: 1000 * 60 * 15
};

const { decodeHtml, cleanText, stripHtml } = require("./utils");
const { fetchWithHostAllowlist, httpGetWithHostAllowlist } = require("./outbound-http");
const { parseWwfScheduleJsonSlice } = require("./wwf-schedule-json");

const WWF_FETCH_SUFFIXES = ["worldwidefm.net", "mixcloud.com", "cosmicjs.com", "radiocult.fm"];

/**
 * Parse RSC (React Server Components) payloads from Next.js pages.
 * WWF uses Next.js App Router — data is embedded in self.__next_f.push() calls
 * as serialized JSON within the HTML.
 */

/** Extract all self.__next_f.push([1, "..."]) string payloads from HTML. */
function extractRscPayloads(html) {
  const payloads = [];
  const pattern = /self\.__next_f\.push\(\[1,"([^]*?)"\]\)/g;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    payloads.push(m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return payloads;
}

/**
 * Build a map of RSC text references: "$N" → text content.
 * RSC stream rows like "25:T58f,<p>content</p>" define reference $25.
 */
function buildRscRefMap(html) {
  const refs = {};
  const payloads = extractRscPayloads(html);
  const combined = payloads.join("");
  // Match patterns like "25:T58f," which means ref $25, text of 0x58f bytes
  const refPattern = /(\d+):T[0-9a-fA-F]+,/g;
  let rm;
  while ((rm = refPattern.exec(combined)) !== null) {
    const refId = "$" + rm[1];
    const contentStart = rm.index + rm[0].length;
    // The text content runs until the next "N:" row marker or end
    const nextRowMatch = combined.slice(contentStart).match(/\n?\d+:[A-Z["{}]/);
    const contentEnd = nextRowMatch ? contentStart + nextRowMatch.index : combined.length;
    refs[refId] = combined.slice(contentStart, contentEnd);
  }
  return refs;
}

/** Find and extract a balanced JSON object starting at position idx in text. */
function extractJsonObject(text, idx) {
  let depth = 0; const start = idx;
  for (let i = start; i < text.length && i < start + 20000; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/** Map a Cosmic JS episode object from RSC to our unified episode shape. */
function mapCosmicEpisode(obj) {
  const meta = obj.metadata || {};
  const slug = obj.slug || "";
  const title = cleanText(obj.title || slug);
  const { showName, episodeName } = parseTitleParts(title);
  const imgUrl = meta.image?.imgix_url || meta.image?.url || meta.external_image_url || "";
  const image = imgUrl ? imgUrl.split("?")[0] + "?w=600&h=600&fit=crop&auto=format,compress&q=60" : "";
  const date = meta.broadcast_date || "";
  const time = meta.broadcast_time || "";
  const durationStr = String(meta.duration || "");
  const durationParts = durationStr.split(":").map(Number);
  const durationMinutes = durationParts.length === 2
    ? (durationParts[0] || 0) * 60 + (durationParts[1] || 0)
    : (durationParts[0] || 0) * 60;
  const genres = normalizeWwfDisplayList(meta.genres);
  const hosts = normalizeWwfDisplayList(meta.regular_hosts);
  const location = meta.location?.title || "";
  const description = cleanText(stripHtml(meta.description || obj.description || ""));
  const playerUrl = meta.player_url || "";
  const tracklist = meta.tracklist || "";
  const episodeUrl = `${BASE_URL}/episode/${slug}`;

  return {
    clipId: slug || episodeUrl,
    id: obj.id || slug,
    title: episodeName || title,
    fullTitle: title,
    showName: showName || title,
    episodeName: episodeName || title,
    episodeUrl,
    downloadUrl: playerUrl || episodeUrl,
    publishedTime: date,
    image,
    location,
    showTime: time || undefined,
    durationMinutes: durationMinutes || undefined,
    genres: genres.length ? genres : undefined,
    hosts: hosts.length ? hosts : undefined,
    description,
    playerUrl: playerUrl || undefined,
    hasTracklist: !!tracklist,
    source: "rsc"
  };
}

/** Parse episodes from RSC payloads — works on homepage and /shows page. */
function parseRscEpisodes(html) {
  const payloads = extractRscPayloads(html);
  const episodes = [];
  const seen = new Set();

  for (const payload of payloads) {
    // Strategy 1: Look for "initialShows" array (/shows page)
    const initIdx = payload.indexOf('"initialShows":');
    if (initIdx >= 0) {
      const arrStart = payload.indexOf("[", initIdx + 15);
      if (arrStart >= 0) {
        let depth = 0, end = -1;
        for (let i = arrStart; i < payload.length; i++) {
          if (payload[i] === "[") depth++;
          else if (payload[i] === "]") { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end > arrStart) {
          try {
            const arr = JSON.parse(payload.slice(arrStart, end));
            for (const obj of arr) {
              if (obj?.type === "episode" && obj.slug && !seen.has(obj.slug)) {
                seen.add(obj.slug);
                episodes.push(mapCosmicEpisode(obj));
              }
            }
          } catch {}
        }
      }
    }

    // Strategy 2: Find individual "show" props from RSC component calls (homepage)
    // These look like: {"show":{"id":"...","slug":"...","title":"...","type":"episode",...}}
    let searchStart = 0;
    while (searchStart < payload.length) {
      const showIdx = payload.indexOf('"show":{', searchStart);
      if (showIdx < 0) break;
      const objStart = showIdx + 7; // position of the {
      const jsonStr = extractJsonObject(payload, objStart);
      if (jsonStr) {
        try {
          const obj = JSON.parse(jsonStr);
          if (obj?.type === "episode" && obj.slug && !seen.has(obj.slug)) {
            seen.add(obj.slug);
            episodes.push(mapCosmicEpisode(obj));
          }
        } catch {}
        searchStart = objStart + (jsonStr?.length || 1);
      } else {
        searchStart = showIdx + 8;
      }
    }

    // Strategy 3: Find "type":"episode" objects directly (host pages, archive pages).
    // These aren't wrapped in "initialShows" or "show":{} — they appear standalone
    // in the RSC stream with Cosmic metadata.
    if (!episodes.length) {
      let epSearchStart = 0;
      while (epSearchStart < payload.length) {
        const typeIdx = payload.indexOf('"type":"episode"', epSearchStart);
        if (typeIdx < 0) break;
        // Backtrack to find the opening brace of this object
        let objStart = typeIdx;
        let depth = 0;
        for (let i = typeIdx; i >= 0; i--) {
          if (payload[i] === "}") depth++;
          else if (payload[i] === "{") {
            depth--;
            if (depth < 0) { objStart = i; break; }
          }
        }
        const jsonStr = extractJsonObject(payload, objStart);
        if (jsonStr) {
          try {
            const obj = JSON.parse(jsonStr);
            if (obj?.type === "episode" && obj.slug && !seen.has(obj.slug)) {
              seen.add(obj.slug);
              episodes.push(mapCosmicEpisode(obj));
            }
          } catch {}
          epSearchStart = objStart + (jsonStr?.length || 1);
        } else {
          epSearchStart = typeIdx + 16;
        }
      }
    }
  }

  return episodes;
}

/**
 * Parse the episode archive embedded in an episode detail page's RSC data.
 * Episode detail pages contain the host's full show list as a component prop,
 * but episodes use RSC references (e.g. "type":"$undefined") instead of literal
 * "type":"episode", so parseRscEpisodes() misses them.  This function extracts
 * slug + broadcast_date pairs directly from the raw RSC payload text.
 */
function parseRscEpisodeArchive(html) {
  const payloads = extractRscPayloads(html);
  const combined = payloads.join("");
  const datePattern = /"broadcast_date":"(\d{4}-\d{2}-\d{2})"/g;
  const episodes = [];
  const seen = new Set();
  let m;

  while ((m = datePattern.exec(combined)) !== null) {
    const date = m[1];
    const pos = m.index;
    const before = combined.slice(Math.max(0, pos - 500), pos);
    const slugMatch = before.match(/"slug":"([^"]+)"[^}]*$/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    const key = slug + "|" + date;
    if (seen.has(key)) continue;
    seen.add(key);

    const titleMatch = before.match(/"title":"([^"]+)"/);
    const title = titleMatch ? cleanText(titleMatch[1]) : "";
    const after = combined.slice(pos, pos + 2000);
    const imgMatch = after.match(/"image":\{[^}]*"url":"([^"]+)"/) || after.match(/"image":"(https:[^"]+)"/);
    const imgRaw = imgMatch ? imgMatch[1] : "";
    const image = imgRaw ? imgRaw.split("?")[0] + "?w=600&h=600&fit=crop&auto=format,compress&q=60" : "";
    // Try to extract Mixcloud player_url from the surrounding RSC context
    const ctx = combined.slice(Math.max(0, pos - 1000), pos + 2000);
    const playerUrlMatch = ctx.match(/"player_url"\s*:\s*"(https:[^"]*mixcloud[^"]*)"/i);
    const playerUrl = playerUrlMatch ? playerUrlMatch[1].replace(/\\\//g, "/") : "";
    const { showName, episodeName } = parseTitleParts(title);
    const episodeUrl = `${BASE_URL}/episode/${slug}`;

    episodes.push({
      clipId: slug,
      id: slug,
      title: episodeName || title,
      fullTitle: title,
      showName: showName || title,
      episodeName: episodeName || title,
      episodeUrl,
      downloadUrl: playerUrl || episodeUrl,
      playerUrl: playerUrl || undefined,
      publishedTime: date,
      image,
      source: "rsc-archive"
    });
  }

  return episodes;
}

/** Parse a single episode detail from its dedicated RSC page. */
function parseRscEpisodeDetail(html) {
  const payloads = extractRscPayloads(html);
  for (const payload of payloads) {
    const epIdx = payload.indexOf('"type":"episode"');
    if (epIdx < 0) continue;
    // Backtrack to find the opening brace of this object
    let startIdx = epIdx;
    let depth = 0;
    for (let i = epIdx; i >= 0; i--) {
      if (payload[i] === "}") depth++;
      else if (payload[i] === "{") { depth--; if (depth < 0) { startIdx = i; break; } }
    }
    const jsonStr = extractJsonObject(payload, startIdx);
    if (jsonStr) {
      try {
        const obj = JSON.parse(jsonStr);
        if (obj?.type === "episode" && obj.slug) return obj;
      } catch {}
    }
  }
  return null;
}

/** Parse tracklist from Cosmic JS HTML tracklist field: "<p>Artist – Track</p>" */
function parseTracklistHtml(tracklistHtml) {
  if (!tracklistHtml) return [];
  const tracks = [];
  // Split on <p> tags, filter empty/br-only lines
  const lines = tracklistHtml.split(/<\/?p[^>]*>/gi)
    .map((l) => cleanText(stripHtml(l)))
    .filter((l) => l && l.length > 2);
  for (const line of lines) {
    // Try "Artist – Track" or "Artist - Track" split
    const dashMatch = line.match(/^(.+?)\s*[\u2013\u2014–—-]\s+(.+)$/);
    if (dashMatch) {
      tracks.push({ artist: cleanText(dashMatch[1]), title: cleanText(dashMatch[2]), image: "" });
    } else {
      tracks.push({ artist: "", title: cleanText(line), image: "" });
    }
  }
  return tracks;
}

function normalizeEpisodeUrl(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw, BASE_URL);
    if (!/worldwidefm\.net/i.test(parsed.hostname)) {
      return raw;
    }
    if (/\/episode\/[^/]+/.test(parsed.pathname)) {
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    }
  } catch {
    return raw;
  }
  return raw;
}

/** Parse "Show Name : Episode Name" or return { showName: title, episodeName: "" } for host-only. */
function parseTitleParts(title) {
  const t = cleanText(title);
  const colonIndex = t.indexOf(":");
  if (colonIndex > 0) {
    return {
      showName: t.slice(0, colonIndex).trim(),
      episodeName: t.slice(colonIndex + 1).trim()
    };
  }
  return { showName: t, episodeName: "" };
}

function normalizeWwfIdentityText(value) {
  return cleanText(stripHtml(String(value || "")))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getWwfEpisodeSortTimestamp(episode) {
  if (episode?.startTimestamp != null && Number.isFinite(Number(episode.startTimestamp))) {
    return Number(episode.startTimestamp);
  }
  const publishedTime = String(episode?.publishedTime || "").trim();
  if (publishedTime) {
    const ts = new Date(`${publishedTime}T12:00:00Z`).getTime();
    if (Number.isFinite(ts)) {
      return ts;
    }
  }
  return 0;
}

function isWwfEpisodeReleased(episode, now = Date.now()) {
  if (!episode) {
    return false;
  }
  if (episode.startTimestamp != null && Number.isFinite(Number(episode.startTimestamp))) {
    return Number(episode.startTimestamp) <= now;
  }
  const publishedTime = String(episode.publishedTime || "").trim();
  if (publishedTime) {
    const today = new Date(now).toISOString().slice(0, 10);
    return publishedTime <= today;
  }
  return true;
}

function buildHostIdentityNames(hostSlug, displayName) {
  const names = new Set();
  const add = (value) => {
    const normalized = normalizeWwfIdentityText(value);
    if (normalized) {
      names.add(normalized);
    }
  };
  add(hostSlug ? String(hostSlug).replace(/-/g, " ") : "");
  add(displayName || "");
  return [...names];
}

function episodeMatchesHostIdentity(episode, hostIdentityNames) {
  const names = Array.isArray(hostIdentityNames) ? hostIdentityNames.filter(Boolean) : [];
  if (!names.length) {
    return true;
  }
  const hostNames = Array.isArray(episode?.hosts) ? episode.hosts.map((host) => normalizeWwfIdentityText(host)).filter(Boolean) : [];
  if (hostNames.some((host) => names.includes(host))) {
    return true;
  }
  const titleFields = [
    episode?.episodeName,
    episode?.title,
    episode?.fullTitle
  ].map((value) => normalizeWwfIdentityText(value)).filter(Boolean);
  return titleFields.some((field) => names.some((name) => field === name || field.startsWith(`${name} `) || field.includes(` ${name} `)));
}

/** Extract DD MMM YYYY from "10 Mar 2026 | 12:00 [GMT] | Chicago" style. */
function parsePublishedFromMeta(text) {
  const match = String(text || "").match(/\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/);
  if (!match) {
    return "";
  }
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mi = months.indexOf(String(match[2]).toLowerCase().slice(0, 3));
  if (mi < 0) {
    return "";
  }
  const day = String(Number(match[1])).padStart(2, "0");
  const month = String(mi + 1).padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

async function fetchText(url) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9"
  };
  if (typeof fetch !== "undefined") {
    const response = await fetchWithHostAllowlist(url, WWF_FETCH_SUFFIXES, "Worldwide FM", { headers });
    if (!response.ok) {
      throw new Error(`Failed to load Worldwide FM: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
  return httpGetWithHostAllowlist(url, WWF_FETCH_SUFFIXES, "Worldwide FM", headers);
}

/** Return true if value looks like a raw Cosmic CMS MongoDB ObjectID (hex string ≥20 chars). */
function isCosmicId(val) {
  return /^[0-9a-f]{20,}$/i.test(String(val || "").trim());
}

function toWwfDisplayLabel(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const text = cleanText(value);
    return text && !isCosmicId(text) ? text : "";
  }

  if (typeof value === "object") {
    const title = cleanText(value.title || value.name || "");
    if (title && !isCosmicId(title)) {
      return title;
    }
    const slug = cleanText(String(value.slug || "").replace(/-/g, " "));
    if (slug && !isCosmicId(slug)) {
      return slug.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  return "";
}

function normalizeWwfDisplayList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => toWwfDisplayLabel(value))
    .filter(Boolean))];
}

/** Parse schedule array from WWF schedule page HTML (embedded JSON with escaped quotes). Times are GMT. */
function parseWwfScheduleFromHtml(html) {
  const startIdx = html.indexOf("[{\\\"show_key\\\"");
  if (startIdx < 0) return [];
  const endIdx = html.indexOf("}]", startIdx);
  if (endIdx <= startIdx) return [];
  return parseWwfScheduleJsonSlice(html.slice(startIdx, endIdx + 2));
}

const scheduleEpisodesCache = { fetchedAt: 0, episodes: [], TTL_MS: 1000 * 60 * 5 };

/** Map schedule item to unified episode shape (show times, picture, genres, etc.). */
function mapScheduleItemToEpisode(item) {
  const date = String(item.date || "").trim();
  const showTime = String(item.show_time || "00:00").trim();
  const duration = Math.max(0, Number(item.duration) || 120);
  const startDate = new Date(`${date}T${showTime}:00Z`);
  const startTimestamp = startDate.getTime();
  const endTimestamp = startTimestamp + duration * 60 * 1000;
  const endDate = new Date(endTimestamp);
  const fmt = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  const runSchedule = `${fmt(startDate)} - ${fmt(endDate)}`;
  const episodeUrl = resolveWwfEpisodeUrl(item.url || "");
  const name = cleanText(item.name || "");
  const { showName, episodeName } = parseTitleParts(name);
  const picture = String(item.picture || "").trim();
  const image = picture ? picture.replace(/^\/\//, "https://") : "";
  const genres = normalizeWwfDisplayList(item.tags);
  const hostsClean = normalizeWwfDisplayList(item.hosts);
  const publishedTime = date; // YYYY-MM-DD
  return {
    clipId: (episodeUrl.split("/episode/")[1] || episodeUrl) || "",
    id: episodeUrl.split("/episode/")[1] || episodeUrl,
    title: episodeName || name,
    fullTitle: name,
    showName: showName || name,
    episodeName: episodeName || name,
    episodeUrl,
    downloadUrl: episodeUrl,
    publishedTime,
    image,
    location: "",
    showTime,
    runSchedule,
    startTimestamp,
    endTimestamp,
    durationMinutes: duration,
    genres: genres.length ? genres : undefined,
    hosts: hostsClean.length ? hostsClean : undefined,
    source: "schedule"
  };
}

/** Fetch episodes from schedule page (rich: show times, pictures, genres). Cached. */
async function fetchWwfScheduleEpisodes(useCache = true) {
  const now = Date.now();
  if (useCache && scheduleEpisodesCache.episodes.length > 0 && now - scheduleEpisodesCache.fetchedAt < scheduleEpisodesCache.TTL_MS) {
    return scheduleEpisodesCache.episodes;
  }
  try {
    const html = await fetchText(SCHEDULE_URL);
    const schedule = parseWwfScheduleFromHtml(html);
    const episodes = schedule.map(mapScheduleItemToEpisode);
    episodes.sort((a, b) => (b.startTimestamp || 0) - (a.startTimestamp || 0));
    scheduleEpisodesCache.episodes = episodes;
    scheduleEpisodesCache.fetchedAt = now;
    return episodes;
  } catch {
    scheduleEpisodesCache.episodes = [];
    return [];
  }
}

/** Get current live programme from schedule (GMT). Returns NTS-style object for UI. */
async function getWwfLiveNow() {
  const now = Date.now();
  if (liveNowCache.data && liveNowCache.fetchedAt && now - liveNowCache.fetchedAt < liveNowCache.TTL_MS) {
    return liveNowCache.data;
  }
  try {
    const html = await fetchText(SCHEDULE_URL);
    const schedule = parseWwfScheduleFromHtml(html);
    const slots = schedule.map((item) => {
      const date = String(item.date || "").trim();
      const showTime = String(item.show_time || "00:00").trim();
      const duration = Math.max(0, Number(item.duration) || 120);
      const startDate = new Date(`${date}T${showTime}:00Z`);
      const startTimestamp = startDate.getTime();
      const endTimestamp = startTimestamp + duration * 60 * 1000;
      return {
        programmeName: cleanText(item.name || "Live"),
        episodeUrl: resolveWwfEpisodeUrl(item.url || ""),
        image: String(item.picture || "").trim().replace(/^\/\//, "https://"),
        startTimestamp,
        endTimestamp,
        duration
      };
    });
    const current = slots.find((s) => now >= s.startTimestamp && now < s.endTimestamp);
    if (!current) {
      // No live show — find the next upcoming show
      const upcoming = slots.filter((s) => s.startTimestamp > now).sort((a, b) => a.startTimestamp - b.startTimestamp)[0];
      if (upcoming) {
        const start = new Date(upcoming.startTimestamp);
        const end = new Date(upcoming.endTimestamp);
        const fmt = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
        const timeSlot = `${fmt(start)} – ${fmt(end)}`;
        const fallback = {
          stationName: "Worldwide FM",
          programmeName: upcoming.programmeName,
          description: "",
          image: upcoming.image || "",
          location: "",
          timeSlot,
          startTimestamp: upcoming.startTimestamp,
          endTimestamp: upcoming.endTimestamp,
          episodeUrl: upcoming.episodeUrl,
          isUpcoming: true
        };
        liveNowCache.data = fallback;
        liveNowCache.fetchedAt = now;
        return fallback;
      }
      // Fall back to most recently ended show (schedule gap / end of day)
      const past = slots.filter((s) => s.endTimestamp <= now).sort((a, b) => b.endTimestamp - a.endTimestamp)[0];
      const fallback = {
        stationName: "Worldwide FM",
        programmeName: past ? past.programmeName : "Live",
        description: "",
        image: past ? past.image || "" : "",
        location: "",
        timeSlot: "",
        startTimestamp: undefined,
        endTimestamp: undefined,
        episodeUrl: past ? past.episodeUrl : ""
      };
      liveNowCache.data = fallback;
      liveNowCache.fetchedAt = now;
      return fallback;
    }
    const start = new Date(current.startTimestamp);
    const end = new Date(current.endTimestamp);
    const fmt = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const timeSlot = `${fmt(start)} – ${fmt(end)}`;
    let description = "";
    let location = "";
    try {
      const info = await getWwfEpisodeInfo(current.episodeUrl).catch(() => ({}));
      description = info.description || "";
      location = info.location || "";
    } catch {}
    const result = {
      stationName: "Worldwide FM",
      programmeName: current.programmeName,
      description: description || "",
      image: current.image || "",
      location: location || "",
      timeSlot,
      startTimestamp: current.startTimestamp,
      endTimestamp: current.endTimestamp,
      episodeUrl: current.episodeUrl
    };
    liveNowCache.data = result;
    liveNowCache.fetchedAt = now;
    return result;
  } catch (_e) {
    liveNowCache.data = {
      stationName: "Worldwide FM",
      programmeName: "Live",
      description: "",
      image: "",
      location: "",
      timeSlot: "",
      startTimestamp: undefined,
      endTimestamp: undefined,
      episodeUrl: ""
    };
    liveNowCache.fetchedAt = now;
    return liveNowCache.data;
  }
}

/** Resolve episode href to full URL (handles relative and absolute). */
function resolveWwfEpisodeUrl(href) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  const decoded = decodeHtml(raw);
  if (/^https?:\/\//i.test(decoded)) return normalizeEpisodeUrl(decoded);
  if (decoded.startsWith("/")) return normalizeEpisodeUrl(BASE_URL + decoded);
  return normalizeEpisodeUrl(BASE_URL + "/" + decoded.replace(/^\//, ""));
}

/** Parse episode cards from /shows HTML. Supports full URLs, relative /episode/..., and encoded entities. */
function parseEpisodesFromShowsHtml(html) {
  const episodes = [];
  const seen = new Set();

  function addEpisode(href, block) {
    const urlNorm = resolveWwfEpisodeUrl(href);
    if (!urlNorm || seen.has(urlNorm)) return;
    seen.add(urlNorm);
    const slug = urlNorm.split("/episode/")[1] || "";
    const blk = block || html;

    let title = "";
    const titleInLink = blk.match(/\]\s*\(\s*https?:\/\/[^)]+\)\s*\n\s*\[\s*([^\]]+)\s*\]/);
    if (titleInLink && titleInLink[1]) title = cleanText(stripHtml(titleInLink[1]));
    const titleMatch = blk.match(/<a[^>]+href=["'][^"']*episode[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)
      || blk.match(/title=["']([^"']+)["']/i)
      || blk.match(/alt=["']([^"']+)["']/i);
    if (titleMatch && titleMatch[1] && !title) title = cleanText(stripHtml(titleMatch[1]));
    if (!title && slug) title = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (!title) title = `Episode ${episodes.length + 1}`;

    let image = "";
    const imgMatch = blk.match(/imgix\.cosmicjs\.com[^"'\s)&]+/i);
    if (imgMatch) {
      image = "https://" + imgMatch[0].replace(/^\/\//, "").split(/["'\s]|&amp;/)[0];
      if (!image.startsWith("http")) image = "https://" + image;
    }
    const ogImage = blk.match(/og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImage && ogImage[1]) image = cleanText(ogImage[1]);

    let publishedTime = "";
    let showTime = "";
    let location = "";
    let genres = [];
    const dateTimeLocMatch = blk.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*\|\s*(\d{1,2}:\d{2})\s*(?:\[GMT\])?\s*(?:\|\s*([^|<]+?))?(?:\s*$|\s*<)/m);
    if (dateTimeLocMatch) {
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const mi = months.indexOf(String(dateTimeLocMatch[2]).toLowerCase().slice(0, 3));
      if (mi >= 0) publishedTime = `${dateTimeLocMatch[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(dateTimeLocMatch[1])).padStart(2, "0")}`;
      showTime = dateTimeLocMatch[4] || "";
      if (dateTimeLocMatch[5]) location = cleanText(dateTimeLocMatch[5]);
    }
    if (!publishedTime) {
      const dateMatch = blk.match(/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s*\|\s*\d{1,2}:\d{2}/);
      if (dateMatch) publishedTime = parsePublishedFromMeta(dateMatch[0]);
    }
    const genreLineMatch = blk.match(/>\s*([a-z0-9\s&]+?)\s*</g);
    if (genreLineMatch) {
      const line = genreLineMatch.map((s) => s.replace(/^>\s*|\s*<$/g, "")).join(" ");
      const words = line.replace(/&amp;/g, " ").split(/[\s]+/).filter((w) => w.length > 1 && /^[a-z0-9&]+$/i.test(w));
      if (words.length > 0 && words.length <= 15) genres = [...new Set(words)];
    }
    const { showName, episodeName } = parseTitleParts(title);

    episodes.push({
      clipId: slug || urlNorm,
      id: slug || urlNorm,
      title: episodeName || title,
      fullTitle: title,
      showName,
      episodeName: episodeName || title,
      episodeUrl: urlNorm,
      downloadUrl: urlNorm,
      publishedTime,
      image,
      location: location || "",
      showTime: showTime || undefined,
      genres: genres.length ? genres : undefined,
      source: "shows"
    });
  }

  let m;
  const fullPattern = /href=["'](https?:\/\/[^"']*worldwidefm\.net\/episode\/[^"']+)["']/gi;
  while ((m = fullPattern.exec(html)) !== null) {
    const idx = m.index;
    const block = html.slice(Math.max(0, idx - 400), idx + (m[0].length + 1200));
    addEpisode(m[1], block);
  }
  const relativePattern = /href=["'](\/episode\/[^"']+)["']/gi;
  while ((m = relativePattern.exec(html)) !== null) {
    const idx = m.index;
    const block = html.slice(Math.max(0, idx - 400), idx + (m[0].length + 1200));
    addEpisode(m[1], block);
  }

  if (episodes.length === 0) {
    const slugPattern = /(?:worldwidefm\.net|\b)\/episode\/([a-z0-9][a-z0-9\-_]*)(?=["'\s>?&]|$)/gi;
    while ((m = slugPattern.exec(html)) !== null) {
      const slug = m[1];
      const fullUrl = `${BASE_URL}/episode/${slug}`;
      if (!seen.has(fullUrl)) {
        const start = Math.max(0, m.index - 300);
        const end = Math.min(html.length, m.index + 500);
        addEpisode(fullUrl, html.slice(start, end));
      }
    }
  }

  return episodes;
}

/** Alternative: parse from markdown-like list items or hrefs (full and relative). */
function parseEpisodesFromShowsHtmlFallback(html) {
  const episodes = [];
  const fullRegex = /\[([^\]]*)\]\((https?:\/\/[^)]*worldwidefm\.net\/episode\/[^)]+)\)|href=["'](https?:\/\/[^"']*worldwidefm\.net\/episode\/[^"']+)["'][^>]*>([^<]*)/gi;
  const relRegex = /href=["'](\/episode\/[^"']+)["'][^>]*>([^<]*)/gi;
  const seen = new Set();
  let m;
  while ((m = fullRegex.exec(html)) !== null) {
    const url = resolveWwfEpisodeUrl(m[2] || m[3]);
    const titleRaw = cleanText(stripHtml(m[1] || m[4] || ""));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const slug = url.split("/episode/")[1] || "";
    const imgMatch = html.slice(0, m.index).match(/imgix\.cosmicjs\.com[^"'\s)]+/);
    let image = "";
    if (imgMatch) image = "https://" + imgMatch[0].replace(/^\/\//, "").split(/["'\s)]/)[0];
    const block = html.slice(m.index, m.index + 600);
    const dateTimeLocMatch = block.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*\|\s*(\d{1,2}:\d{2})\s*(?:\[GMT\])?\s*(?:\|\s*([^|<]+?))?(?:\s*$|\s*<)/m);
    let publishedTime = "";
    let showTime = "";
    let location = "";
    if (dateTimeLocMatch) {
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const mi = months.indexOf(String(dateTimeLocMatch[2]).toLowerCase().slice(0, 3));
      if (mi >= 0) publishedTime = `${dateTimeLocMatch[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(dateTimeLocMatch[1])).padStart(2, "0")}`;
      showTime = dateTimeLocMatch[4] || "";
      if (dateTimeLocMatch[5]) location = cleanText(dateTimeLocMatch[5]);
    }
    if (!publishedTime) {
      const dateMatch = block.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
      if (dateMatch) {
        const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
        const mi = months.indexOf(String(dateMatch[2]).toLowerCase().slice(0, 3));
        if (mi >= 0) publishedTime = `${dateMatch[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(dateMatch[1])).padStart(2, "0")}`;
      }
    }
    const genreLineMatch = block.match(/>\s*([a-z0-9\s&]+?)\s*</g);
    let genres = [];
    if (genreLineMatch) {
      const line = genreLineMatch.map((s) => s.replace(/^>\s*|\s*<$/g, "")).join(" ");
      const words = line.replace(/&amp;/g, " ").split(/[\s]+/).filter((w) => w.length > 1 && /^[a-z0-9&]+$/i.test(w));
      if (words.length > 0 && words.length <= 15) genres = [...new Set(words)];
    }
    const { showName, episodeName } = parseTitleParts(titleRaw || slug);
    episodes.push({
      clipId: slug || url,
      id: slug || url,
      title: episodeName || titleRaw || slug,
      fullTitle: titleRaw || slug,
      showName,
      episodeName: episodeName || titleRaw || slug,
      episodeUrl: url,
      downloadUrl: url,
      publishedTime,
      image,
      location: location || "",
      showTime: showTime || undefined,
      genres: genres.length ? genres : undefined,
      source: "shows"
    });
  }
  while ((m = relRegex.exec(html)) !== null) {
    const url = resolveWwfEpisodeUrl(m[1]);
    const titleRaw = cleanText(stripHtml(m[2] || ""));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const slug = url.split("/episode/")[1] || "";
    const imgMatch = html.slice(0, m.index).match(/imgix\.cosmicjs\.com[^"'\s)]+/);
    let image = "";
    if (imgMatch) image = "https://" + imgMatch[0].replace(/^\/\//, "").split(/["'\s)]/)[0];
    const block = html.slice(m.index, m.index + 600);
    const dateTimeLocMatch = block.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*\|\s*(\d{1,2}:\d{2})\s*(?:\[GMT\])?\s*(?:\|\s*([^|<]+?))?(?:\s*$|\s*<)/m);
    let publishedTime = "";
    let showTime = "";
    let location = "";
    if (dateTimeLocMatch) {
      const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const mi = months.indexOf(String(dateTimeLocMatch[2]).toLowerCase().slice(0, 3));
      if (mi >= 0) publishedTime = `${dateTimeLocMatch[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(dateTimeLocMatch[1])).padStart(2, "0")}`;
      showTime = dateTimeLocMatch[4] || "";
      if (dateTimeLocMatch[5]) location = cleanText(dateTimeLocMatch[5]);
    }
    if (!publishedTime) {
      const dateMatch = block.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
      if (dateMatch) {
        const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
        const mi = months.indexOf(String(dateMatch[2]).toLowerCase().slice(0, 3));
        if (mi >= 0) publishedTime = `${dateMatch[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(dateMatch[1])).padStart(2, "0")}`;
      }
    }
    const genreLineMatch = block.match(/>\s*([a-z0-9\s&]+?)\s*</g);
    let genres = [];
    if (genreLineMatch) {
      const line = genreLineMatch.map((s) => s.replace(/^>\s*|\s*<$/g, "")).join(" ");
      const words = line.replace(/&amp;/g, " ").split(/[\s]+/).filter((w) => w.length > 1 && /^[a-z0-9&]+$/i.test(w));
      if (words.length > 0 && words.length <= 15) genres = [...new Set(words)];
    }
    const { showName, episodeName } = parseTitleParts(titleRaw || slug);
    episodes.push({
      clipId: slug || url,
      id: slug || url,
      title: episodeName || titleRaw || slug,
      fullTitle: titleRaw || slug,
      showName,
      episodeName: episodeName || titleRaw || slug,
      episodeUrl: url,
      downloadUrl: url,
      publishedTime,
      image,
      location: location || "",
      showTime: showTime || undefined,
      genres: genres.length ? genres : undefined,
      source: "shows"
    });
  }
  return episodes;
}

async function fetchRecentEpisodes(useCache = true) {
  const now = Date.now();
  if (useCache && episodesCache.episodes.length > 0 && now - episodesCache.fetchedAt < episodesCache.TTL_MS) {
    return episodesCache.episodes;
  }
  // Primary: parse RSC payloads from /shows page (rich data: images, genres, hosts, dates)
  const showsHtml = await fetchText(`${BASE_URL}/shows`);
  let episodes = parseRscEpisodes(showsHtml);
  // Also merge episodes from homepage (has additional shows like "This Week", "From the Archive")
  if (episodes.length < 40) {
    try {
      const homeHtml = await fetchText(BASE_URL);
      const homeEpisodes = parseRscEpisodes(homeHtml);
      const seen = new Set(episodes.map((e) => e.clipId));
      for (const ep of homeEpisodes) {
        if (!seen.has(ep.clipId)) { seen.add(ep.clipId); episodes.push(ep); }
      }
    } catch {}
  }
  // Fallback: old HTML parsing if RSC yields nothing
  if (!episodes.length) {
    episodes = parseEpisodesFromShowsHtml(showsHtml);
    if (!episodes.length) episodes = parseEpisodesFromShowsHtmlFallback(showsHtml);
  }
  episodes = episodes.filter((e) => e.episodeUrl);
  episodes.sort((a, b) => (b.publishedTime || "").localeCompare(a.publishedTime || ""));
  episodesCache.fetchedAt = now;
  episodesCache.episodes = episodes;
  return episodes;
}

/** Extract Mixcloud URL from episode page, or build from slug (worldwidefm mirrors to mixcloud.com/worldwidefm/). */
function parseMixcloudUrlFromEpisodeHtml(html, episodeUrl) {
  // Try plain URL match first
  const mixcloudMatch = html.match(/https?:\/\/[^"'\s]*mixcloud\.com\/worldwidefm\/[^"'\s)]+/i);
  if (mixcloudMatch) {
    const raw = mixcloudMatch[0].replace(/&amp;/g, "&").split(/["'\s)]/)[0];
    if (raw) return raw;
  }
  // Try RSC/JSON escaped URL (e.g. "player_url":"https:\/\/www.mixcloud.com\/worldwidefm\/...")
  const escapedMatch = html.match(/"player_url"\s*:\s*"(https:[^"]*mixcloud\.com[^"]*)"/i);
  if (escapedMatch) {
    return escapedMatch[1].replace(/\\\//g, "/");
  }
  const slug = (episodeUrl || "").split("/episode/")[1] || "";
  if (!slug) return "";
  // Use the slug as-is for Mixcloud (don't mangle the year)
  return `https://www.mixcloud.com/worldwidefm/${slug}/`;
}

/** Get Mixcloud URL for a WWF episode (for play/download; yt-dlp supports Mixcloud). */
async function getWwfEpisodeMixcloudUrl(episodeUrl) {
  const url = normalizeEpisodeUrl(episodeUrl);
  if (!url) return "";
  const html = await fetchText(url);
  return parseMixcloudUrlFromEpisodeHtml(html, url).trim() || "";
}

async function getWwfEpisodeInfo(episodeUrl) {
  const url = normalizeEpisodeUrl(episodeUrl);
  if (!url) {
    throw new Error("Invalid Worldwide FM episode URL.");
  }
  const html = await fetchText(url);
  // Primary: parse rich data from RSC payload
  const epDetail = parseRscEpisodeDetail(html);
  if (epDetail) {
    const mapped = mapCosmicEpisode(epDetail);
    const mixcloudUrl = mapped.playerUrl || parseMixcloudUrlFromEpisodeHtml(html, url);
    return {
      episodeUrl: url,
      title: mapped.fullTitle || mapped.title,
      description: mapped.description,
      image: mapped.image,
      showName: mapped.showName,
      episodeName: mapped.episodeName,
      clipId: mapped.clipId,
      publishedTime: mapped.publishedTime || undefined,
      genres: mapped.genres,
      hosts: mapped.hosts,
      mixcloudUrl: mixcloudUrl || undefined,
      location: mapped.location || undefined,
      durationMinutes: mapped.durationMinutes,
      hasTracklist: mapped.hasTracklist
    };
  }
  // Fallback: og: meta tags
  const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
    || html.match(/<title>([^<]+)<\/title>/i);
  const title = cleanText(titleMatch?.[1] || "");
  const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const description = cleanText(descMatch?.[1] || "");
  const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const image = imgMatch ? cleanText(imgMatch[1]) : "";
  const slug = url.split("/episode/")[1] || "";
  const { showName, episodeName } = parseTitleParts(title);
  const mixcloudUrl = parseMixcloudUrlFromEpisodeHtml(html, url);
  return {
    episodeUrl: url,
    title: title || slug,
    description,
    image,
    showName,
    episodeName: episodeName || title,
    clipId: slug || url,
    mixcloudUrl: mixcloudUrl || undefined
  };
}

/**
 * Infer cadence and build scheduler-compatible runSchedule from WWF episode data.
 * Schedule times are stored in UTC. The scheduler compares against UTC.
 */
function inferWwfScheduleInfo(episodes) {
  if (!episodes || !episodes.length) return { cadence: "irregular", runSchedule: "", averageDaysBetween: null };

  // Infer cadence from episode dates (same logic as BBC/RTE)
  const times = episodes
    .map((e) => {
      const t = e.startTimestamp || (e.publishedTime ? new Date(e.publishedTime + "T12:00:00Z").getTime() : 0);
      return t || 0;
    })
    .filter((t) => t > 0)
    .sort((a, b) => b - a);

  let cadence = "irregular";
  let averageDaysBetween = null;
  if (times.length >= 3) {
    // Use only the most recent 4 diffs and take median to resist outlier gaps/hiatuses
    const dayDiffs = [];
    for (let i = 0; i < Math.min(times.length - 1, 4); i++) {
      dayDiffs.push(Math.abs(times[i] - times[i + 1]) / (1000 * 60 * 60 * 24));
    }
    const sorted = [...dayDiffs].sort((a, b) => a - b);
    const median = sorted.length % 2 === 1
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    averageDaysBetween = Math.round(median * 10) / 10;
    if (median <= 2) cadence = "daily";
    else if (median <= 9) cadence = "weekly";
    else if (median <= 21) cadence = "biweekly";
    else if (median <= 35) cadence = "monthly";
  }

  // Build runSchedule from broadcast times (GMT → Dublin time)
  // Find the typical broadcast day and time from recent episodes
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayHits = new Map(); // dayOfWeek → count
  let typicalHour = null;
  let typicalDuration = 120; // default 2 hours

  for (const ep of episodes.slice(0, 10)) {
    const ts = ep.startTimestamp || (ep.publishedTime ? new Date(ep.publishedTime + "T12:00:00Z").getTime() : 0);
    if (!ts) continue;
    const d = new Date(ts);
    const day = d.getUTCDay();
    dayHits.set(day, (dayHits.get(day) || 0) + 1);
    const hour = ep.showTime ? parseInt(ep.showTime.split(":")[0], 10) : d.getUTCHours();
    if (typicalHour == null && Number.isFinite(hour)) typicalHour = hour;
    if (ep.durationMinutes) typicalDuration = ep.durationMinutes;
  }

  // Find the most common broadcast day(s)
  const broadcastDays = [...dayHits.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([day]) => day);

  let runSchedule = "";
  if (broadcastDays.length && typicalHour != null) {
    // Store in UTC — scheduler compares UTC, renderer converts to local
    const utcStart = typicalHour;
    const utcEnd = (typicalHour + Math.round(typicalDuration / 60)) % 24;
    const fmt = (h) => String(h).padStart(2, "0") + ":00";

    const dayNames = broadcastDays.map((d) => DAY_NAMES[d]);
    const dayPart = dayNames.length >= 2
      ? dayNames[0] + "-" + dayNames[dayNames.length - 1]
      : dayNames[0] || "";

    if (dayPart) {
      runSchedule = `${dayPart} • ${fmt(utcStart)} - ${fmt(utcEnd)}`;
    }
  }

  return { cadence, runSchedule, averageDaysBetween };
}

async function getWwfProgramSummary(programNameOrUrl) {
  const name = String(programNameOrUrl || "").trim();
  if (!name) {
    return {
      source: "wwf",
      programUrl: "",
      title: "Worldwide FM",
      description: "",
      image: "",
      runSchedule: "",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    };
  }
  // If it's a host URL, fetch host metadata directly
  const hostMatch = name.match(/worldwidefm\.net\/hosts\/([^/?#]+)/i);
  if (hostMatch) {
    const hostSlug = hostMatch[1];
    const [meta, hostEpisodes] = await Promise.all([
      fetchWwfHostMetadata(hostSlug, true).catch(() => null),
      fetchWwfHostPageEpisodes(hostSlug, true).catch(() => [])
    ]);
    const schedInfo = inferWwfScheduleInfo(hostEpisodes);
    return {
      source: "wwf",
      programUrl: name,
      title: meta?.displayName || hostSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: meta?.description || "",
      image: meta?.image || "",
      hostSlug,
      location: meta?.location || "",
      runSchedule: schedInfo.runSchedule || "",
      cadence: meta?.typeSlug || schedInfo.cadence || "irregular",
      averageDaysBetween: schedInfo.averageDaysBetween,
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    };
  }
  const [scheduleEpisodes, showsEpisodes] = await Promise.all([
    fetchWwfScheduleEpisodes(true),
    fetchRecentEpisodes(true).then((e) => e.length ? e : fetchRecentEpisodes(false))
  ]);
  const all = mergeWwfEpisodeSources(scheduleEpisodes, showsEpisodes);
  const nameLower = name.toLowerCase();
  const isShowsUrl = /worldwidefm\.net\/shows/i.test(name) || name === `${BASE_URL}/shows`;
  const matchEp = (e) => {
    const show = (e.showName || "").toLowerCase();
    const full = (e.fullTitle || "").toLowerCase();
    if (show === nameLower || full === nameLower) return true;
    if (full.startsWith(nameLower + ":") || full.startsWith(nameLower + " ")) return true;
    const terms = nameLower.split(/\s+/).filter(Boolean);
    return terms.length && terms.every((t) => show.includes(t) || full.includes(t));
  };
  let first = all.find((e) => (e.showName || "").toLowerCase() === nameLower || (e.fullTitle || "").toLowerCase() === nameLower || (e.fullTitle || "").toLowerCase().startsWith(nameLower + ":"));
  if (!first) {
    first = all.find(matchEp);
  }
  const displayTitle = first ? (first.showName || first.fullTitle || name) : name;

  // Gather all episodes matching this show for cadence/schedule inference
  const showEpisodes = isShowsUrl ? all : all.filter(matchEp);
  const schedInfo = inferWwfScheduleInfo(showEpisodes);

  let nextBroadcastAt = "";
  let nextBroadcastTitle = "";
  const now = Date.now();
  const futureSlots = scheduleEpisodes.filter((e) => e.startTimestamp != null && e.startTimestamp > now);
  if (futureSlots.length > 0) {
    futureSlots.sort((a, b) => (a.startTimestamp || 0) - (b.startTimestamp || 0));
    const next = futureSlots[0];
    if (isShowsUrl) {
      nextBroadcastAt = next.startTimestamp != null ? new Date(next.startTimestamp).toISOString() : "";
      nextBroadcastTitle = next.fullTitle || next.title || "";
    } else {
      const nextForShow = futureSlots.find(matchEp);
      if (nextForShow) {
        nextBroadcastAt = nextForShow.startTimestamp != null ? new Date(nextForShow.startTimestamp).toISOString() : "";
        nextBroadcastTitle = nextForShow.fullTitle || nextForShow.title || "";
      }
    }
  }
  return {
    source: "wwf",
    programUrl: name.startsWith("http") ? name : `${BASE_URL}/shows`,
    title: displayTitle,
    description: "",
    image: first?.image || "",
    runSchedule: schedInfo.runSchedule || first?.runSchedule || "",
    cadence: schedInfo.cadence || "irregular",
    averageDaysBetween: schedInfo.averageDaysBetween,
    nextBroadcastAt,
    nextBroadcastTitle
  };
}

/** Merge schedule-derived episodes (rich) with shows-page episodes; prefer schedule when same URL. Sort by date/time descending. */
function mergeWwfEpisodeSources(scheduleEpisodes, showsEpisodes) {
  const byUrl = new Map();
  for (const e of scheduleEpisodes) {
    if (e.episodeUrl) byUrl.set(e.episodeUrl, e);
  }
  for (const e of showsEpisodes) {
    if (e.episodeUrl && !byUrl.has(e.episodeUrl)) byUrl.set(e.episodeUrl, e);
  }
  const merged = [...byUrl.values()];
  merged.sort((a, b) => {
    let aTs = getWwfEpisodeSortTimestamp(a);
    let bTs = getWwfEpisodeSortTimestamp(b);
    if (!Number.isFinite(aTs)) aTs = 0;
    if (!Number.isFinite(bTs)) bTs = 0;
    return bTs - aTs;
  });
  return merged;
}

async function getWwfProgramEpisodes(programNameOrUrl, page = 1) {
  const programName = String(programNameOrUrl || "").trim();
  const [scheduleEpisodes, showsEpisodes] = await Promise.all([
    fetchWwfScheduleEpisodes(true),
    fetchRecentEpisodes(true).then((e) => e.length ? e : fetchRecentEpisodes(false))
  ]);
  const all = mergeWwfEpisodeSources(scheduleEpisodes, showsEpisodes);
  const isShowsUrl = /worldwidefm\.net\/shows/i.test(programName) || programName === `${BASE_URL}/shows`;
  const isHostUrl = /worldwidefm\.net\/hosts\//i.test(programName);
  const q = programName.toLowerCase();

  // If the input is a host URL, scrape that host page directly — ONLY return
  // episodes from the host page (enriched with schedule/shows metadata).
  let hostFilteredEpisodes = null;
  let hostSlugFromUrl = "";
  if (isHostUrl) {
    hostSlugFromUrl = (programName.match(/\/hosts\/([^/?#]+)/i) || [])[1] || "";
    if (hostSlugFromUrl) {
      const [hostEpisodes, hostMeta] = await Promise.all([
        fetchWwfHostPageEpisodes(hostSlugFromUrl),
        fetchWwfHostMetadata(hostSlugFromUrl, true).catch(() => null)
      ]);
      if (hostEpisodes.length) {
        const hostIdentityNames = buildHostIdentityNames(hostSlugFromUrl, hostMeta?.displayName);
        const directHostEpisodes = hostEpisodes.filter((episode) => episodeMatchesHostIdentity(episode, hostIdentityNames));
        const matchedHostEpisodes = directHostEpisodes.length ? directHostEpisodes : hostEpisodes;
        // Build lookup of schedule/shows episodes for metadata enrichment
        const schedMap = new Map();
        for (const e of all) { if (e.episodeUrl) schedMap.set(e.episodeUrl, e); }

        // Enrich host page episodes with schedule metadata (times, genres, etc.)
        const byUrl = new Map();
        for (const he of matchedHostEpisodes) {
          const se = schedMap.get(he.episodeUrl);
          byUrl.set(he.episodeUrl, se ? {
            ...he,
            showTime: he.showTime || se.showTime,
            runSchedule: se.runSchedule || he.runSchedule,
            startTimestamp: se.startTimestamp || he.startTimestamp,
            endTimestamp: se.endTimestamp || he.endTimestamp,
            durationMinutes: he.durationMinutes || se.durationMinutes,
            genres: (he.genres && he.genres.length) ? he.genres : se.genres,
            hosts: (he.hosts && he.hosts.length) ? he.hosts : se.hosts,
            location: he.location || se.location,
            image: he.image || se.image,
          } : he);
        }

        // Supplement with schedule/shows episodes that match the host identity.
        // Host pages can lag behind the newest published episodes, but host identity
        // matters more than show-name matches for rotating-host programs.
        for (const e of all) {
          if (e.episodeUrl && !byUrl.has(e.episodeUrl)) {
            if (episodeMatchesHostIdentity(e, hostIdentityNames) && isWwfEpisodeReleased(e)) {
              byUrl.set(e.episodeUrl, e);
            }
          }
        }

        // Supplement with the most recent episode's detail page archive.
        // Episode detail pages embed the full show episode list in their RSC data,
        // including episodes too new for any host page.
        try {
          const sortedSoFar = [...byUrl.values()].sort((a, b) => {
            const aTs = a.startTimestamp != null ? a.startTimestamp : (a.publishedTime ? new Date(a.publishedTime + "T12:00:00Z").getTime() : 0);
            const bTs = b.startTimestamp != null ? b.startTimestamp : (b.publishedTime ? new Date(b.publishedTime + "T12:00:00Z").getTime() : 0);
            return bTs - aTs;
          });
          const newestUrl = sortedSoFar[0]?.episodeUrl;
          if (newestUrl) {
            const epHtml = await fetchText(newestUrl);
            const archiveEps = parseRscEpisodeArchive(epHtml);
            for (const ae of archiveEps) {
              if (ae.episodeUrl && !byUrl.has(ae.episodeUrl)
                && episodeMatchesHostIdentity(ae, hostIdentityNames)
                && isWwfEpisodeReleased(ae)) {
                const schedE = schedMap.get(ae.episodeUrl);
                byUrl.set(ae.episodeUrl, schedE ? {
                  ...ae,
                  showTime: ae.showTime || schedE.showTime,
                  durationMinutes: ae.durationMinutes || schedE.durationMinutes,
                  genres: (ae.genres && ae.genres.length) ? ae.genres : schedE.genres,
                  hosts: (ae.hosts && ae.hosts.length) ? ae.hosts : schedE.hosts,
                  location: ae.location || schedE.location,
                  image: ae.image || schedE.image,
                } : ae);
              }
            }
          }
        } catch {}

        hostFilteredEpisodes = [...byUrl.values()]
          .filter((episode) => isWwfEpisodeReleased(episode))
          .sort((a, b) => getWwfEpisodeSortTimestamp(b) - getWwfEpisodeSortTimestamp(a));
      }
    }
  }

  const filtered = !programName || isShowsUrl
    ? all
    : isHostUrl && hostFilteredEpisodes
      ? hostFilteredEpisodes
      : all.filter((e) => {
          const show = (e.showName || "").toLowerCase();
          const full = (e.fullTitle || "").toLowerCase();
          if (show === q || full === q) return true;
          if (full.startsWith(q + ":") || full.startsWith(q + " ")) return true;
          const terms = q.split(/\s+/).filter(Boolean);
          if (!terms.length) return true;
          return terms.every((t) => show.includes(t) || full.includes(t));
        });

  // For name-based lookups, always try to discover the host page for the full
  // episode archive.  The /shows + /schedule sources only have recent episodes;
  // the host page has the complete list.
  let enrichedFiltered = filtered;
  let discoveredHostSlug = "";
  let discoveredHostMeta = null;
  if (!isShowsUrl && !isHostUrl && programName && filtered.length > 0) {
    try {
      const firstEp = filtered.find((episode) => isWwfEpisodeReleased(episode)) || filtered[0];
      discoveredHostSlug = await discoverHostSlug(firstEp.episodeUrl);
      if (discoveredHostSlug) {
        const [hostEpisodes, hostMeta] = await Promise.all([
          fetchWwfHostPageEpisodes(discoveredHostSlug),
          fetchWwfHostMetadata(discoveredHostSlug, true).catch(() => null)
        ]);
        discoveredHostMeta = hostMeta;
        if (hostEpisodes.length) {
          // Merge host page episodes with existing filtered results
          const byUrl = new Map();
          for (const e of filtered) { if (e.episodeUrl) byUrl.set(e.episodeUrl, e); }
          for (const e of hostEpisodes) { if (e.episodeUrl && !byUrl.has(e.episodeUrl)) byUrl.set(e.episodeUrl, e); }
          enrichedFiltered = [...byUrl.values()].sort((a, b) => getWwfEpisodeSortTimestamp(b) - getWwfEpisodeSortTimestamp(a));
        }
      }
    } catch {}
  }

  // For host URL path, fetch host metadata directly
  let hostUrlMeta = null;
  if (isHostUrl && hostSlugFromUrl) {
    hostUrlMeta = await fetchWwfHostMetadata(hostSlugFromUrl, true).catch(() => null);
  }

  const visibleEpisodes = enrichedFiltered.filter((episode) => isWwfEpisodeReleased(episode));
  const perPage = 20;
  const start = (Math.max(1, Number(page) || 1) - 1) * perPage;
  const episodes = visibleEpisodes.slice(start, start + perPage);

  // Compute cadence/runSchedule from enriched episodes (includes host page data)
  // which is more accurate than the summary (which only uses schedule + shows page)
  const enrichedSchedInfo = enrichedFiltered.length > 5
    ? inferWwfScheduleInfo(enrichedFiltered)
    : null;

  // For host URL or name-based lookup, use host metadata; for /shows, use summary
  const effectiveMeta = hostUrlMeta || discoveredHostMeta || null;
  const summary = (!effectiveMeta || isShowsUrl) ? await getWwfProgramSummary(programName || "Worldwide FM") : null;
  let hostDesc = effectiveMeta?.description || summary?.description || "";
  let hostLoc = effectiveMeta?.location || summary?.location || "";
  const hostImage = effectiveMeta?.image || summary?.image || "";
  const hostTitle = effectiveMeta?.displayName || summary?.title || programName;
  const effectiveHostSlug = hostSlugFromUrl || discoveredHostSlug || summary?.hostSlug || "";
  const hostUrl = effectiveHostSlug ? `${BASE_URL}/hosts/${effectiveHostSlug}` : (summary?.programUrl || programName);

  // Derive missing location/description from episodes when host metadata lacks them
  if (!hostLoc || !hostDesc) {
    for (const ep of enrichedFiltered.slice(0, 10)) {
      if (!hostLoc && ep.location) { hostLoc = ep.location; }
      if (!hostDesc && ep.description) { hostDesc = ep.description; }
      if (hostLoc && hostDesc) break;
    }
  }

  // Compute top weighted genres from episodes (top 4 by frequency)
  const genreCount = new Map();
  for (const ep of visibleEpisodes) {
    if (ep.genres) for (const g of ep.genres) { genreCount.set(g, (genreCount.get(g) || 0) + 1); }
  }
  const topGenres = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([g]) => g);

  return {
    source: "wwf",
    programUrl: hostUrl,
    title: isShowsUrl ? "Worldwide FM – All shows" : hostTitle,
    description: hostDesc,
    image: hostImage,
    location: hostLoc,
    hostSlug: effectiveHostSlug,
    genres: topGenres.length ? topGenres : undefined,
    episodes,
    totalItems: visibleEpisodes.length,
    page: Math.max(1, Number(page) || 1),
    numPages: Math.max(1, Math.ceil(visibleEpisodes.length / perPage)),
    cadence: effectiveMeta?.typeSlug || enrichedSchedInfo?.cadence || summary?.cadence || "irregular",
    averageDaysBetween: enrichedSchedInfo?.averageDaysBetween || summary?.averageDaysBetween || null,
    runSchedule: enrichedSchedInfo?.runSchedule || summary?.runSchedule || "",
    nextBroadcastAt: summary?.nextBroadcastAt || "",
    nextBroadcastTitle: summary?.nextBroadcastTitle || ""
  };
}

async function searchWwfPrograms(query) {
  const q = cleanText(query || "").toLowerCase();

  // Parallel: episode-based search + host slug lookup + direct host slug guesses
  const hostGuesses = q ? generateWwfHostSlugGuesses(q) : [];
  const [scheduleEpisodes, recentEpisodes, knownHosts, ...hostGuessResults] = await Promise.all([
    fetchWwfScheduleEpisodes(true).catch(() => []),
    fetchRecentEpisodes(true).then((e) => e.length ? e : fetchRecentEpisodes(false)).catch(() => []),
    fetchWwfHostSlugs(true).catch(() => []),
    ...hostGuesses.map((slug) => fetchWwfHostMetadata(slug, true).catch(() => null))
  ]);

  const all = mergeWwfEpisodeSources(scheduleEpisodes, recentEpisodes);

  // Collect unique show names from episodes
  const showNames = [...new Set(all.map((e) => e.showName || e.fullTitle).filter(Boolean))];
  let matchedShows = showNames;
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    matchedShows = showNames.filter((name) => {
      const n = name.toLowerCase();
      return terms.every((t) => n.includes(t));
    });
  }

  // Match hosts from known host slugs
  let matchedHosts = [];
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    matchedHosts = knownHosts.filter((h) => {
      const combined = (h.slug.replace(/-/g, " ") + " " + (h.title || "")).toLowerCase();
      return terms.every((t) => combined.includes(t));
    });
  }

  // Direct host slug guess hits
  const directHostHits = hostGuessResults.filter((h) => h && h.displayName);

  // Helper: derive schedule info and location for a host from episodes
  const enrichHostResult = (host, hostSlug) => {
    const hostNameLower = (host.displayName || host.title || "").toLowerCase();
    // Find matching episodes from schedule/shows for broadcast times
    const matchingEps = all.filter((e) => {
      const show = (e.showName || "").toLowerCase();
      const full = (e.fullTitle || "").toLowerCase();
      return show === hostNameLower || full.startsWith(hostNameLower + ":") || full.startsWith(hostNameLower + " ");
    });
    const schedInfo = matchingEps.length >= 2 ? inferWwfScheduleInfo(matchingEps) : null;
    // Derive location from episodes if host metadata lacks it
    let loc = host.location || "";
    let desc = host.description || "";
    if (!loc || !desc) {
      for (const ep of matchingEps.slice(0, 5)) {
        if (!loc && ep.location) loc = ep.location;
        if (!desc && ep.description) desc = ep.description;
        if (loc && desc) break;
      }
    }
    return {
      source: "wwf",
      programUrl: host.hostUrl || `${BASE_URL}/hosts/${hostSlug}`,
      title: host.displayName || host.title || "",
      description: desc,
      image: host.image || "",
      hostSlug: hostSlug || host.hostSlug || "",
      location: loc,
      cadence: host.typeSlug || schedInfo?.cadence || "irregular",
      runSchedule: schedInfo?.runSchedule || "",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    };
  };

  // Build results: hosts first (with rich metadata), then episode-based shows
  const results = [];
  const seenTitles = new Set();

  // Add direct host guess hits first (highest relevance)
  for (const host of directHostHits) {
    const key = host.displayName.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    results.push(enrichHostResult(host, host.hostSlug));
  }

  // Add matched hosts from known slugs (fetch metadata in parallel)
  const hostMetaPromises = matchedHosts
    .filter((h) => !seenTitles.has((h.title || "").toLowerCase()))
    .slice(0, 10)
    .map(async (h) => {
      const meta = await fetchWwfHostMetadata(h.slug, true).catch(() => null);
      return { ...h, meta };
    });
  const hostMetas = await Promise.all(hostMetaPromises);
  for (const h of hostMetas) {
    const meta = h.meta || {};
    const key = (meta.displayName || h.title || "").toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    results.push(enrichHostResult({ ...meta, title: h.title }, h.slug));
  }

  // Add episode-based show matches — but skip any whose name is covered by an
  // existing host result (e.g. skip "Gilles Peterson w/ Lex Blondin" when host
  // "Gilles Peterson" already exists).
  const hostTitlesLower = [...seenTitles];
  const coveredByHost = (name) => {
    const nl = name.toLowerCase();
    return hostTitlesLower.some((ht) => nl === ht || nl.startsWith(ht + " ") || nl.startsWith(ht + ":"));
  };
  const uncoveredShows = matchedShows
    .filter((name) => !seenTitles.has(name.toLowerCase()) && !coveredByHost(name));

  // For uncovered episode matches, try to discover their host slug so we can
  // link to the host page (which loads the full episode archive).
  const showPromises = uncoveredShows
    .slice(0, 10)
    .map(async (name) => {
      // Find one episode for this show to discover the host
      const ep = all.find((e) => (e.showName || "").toLowerCase() === name.toLowerCase()
        || (e.fullTitle || "").toLowerCase().startsWith(name.toLowerCase()));
      let hostSlug = "";
      let hostMeta = null;
      if (ep?.episodeUrl) {
        hostSlug = await discoverHostSlug(ep.episodeUrl).catch(() => "");
        if (hostSlug) hostMeta = await fetchWwfHostMetadata(hostSlug, true).catch(() => null);
      }
      if (hostMeta?.displayName) {
        return {
          source: "wwf",
          programUrl: hostMeta.hostUrl,
          title: hostMeta.displayName,
          description: hostMeta.description || "",
          image: hostMeta.image || "",
          hostSlug,
          location: hostMeta.location || "",
          cadence: hostMeta.typeSlug || "irregular",
          runSchedule: "",
          nextBroadcastAt: "",
          nextBroadcastTitle: ""
        };
      }
      const summary = await getWwfProgramSummary(name);
      // If the summary discovered a host slug, use that
      if (summary.hostSlug) {
        return { ...summary, programUrl: summary.programUrl || `${BASE_URL}/hosts/${summary.hostSlug}`, title: summary.title || name };
      }
      return { ...summary, programUrl: name, title: name };
    });
  const showResults = await Promise.all(showPromises);
  for (const r of showResults) {
    const key = (r.title || "").toLowerCase();
    if (seenTitles.has(key) || coveredByHost(key)) continue;
    seenTitles.add(key);
    results.push(r);
  }

  const baseResults = results.slice(0, 30);
  if (!q) {
    return baseResults.sort((a, b) => {
      const aHost = (a.hostSlug || a.description) ? 0 : 1;
      const bHost = (b.hostSlug || b.description) ? 0 : 1;
      if (aHost !== bHost) return aHost - bHost;
      return a.title.localeCompare(b.title, "en");
    });
  }

  function scoreTextMatch(value, queryText, exactWeight, prefixWeight, includesWeight) {
    const text = normalizeWwfIdentityText(value).toLowerCase();
    if (!text || !queryText) {
      return 0;
    }
    if (text === queryText) {
      return exactWeight;
    }
    if (text.startsWith(queryText)) {
      return prefixWeight;
    }
    if (text.includes(queryText)) {
      return includesWeight;
    }
    return 0;
  }

  function scoreListMatch(values, queryText, exactWeight, prefixWeight, includesWeight) {
    let best = 0;
    for (const value of values || []) {
      best = Math.max(best, scoreTextMatch(value, queryText, exactWeight, prefixWeight, includesWeight));
    }
    return best;
  }

  function buildSearchText(item) {
    return [
      item.title,
      item.description,
      item.location,
      item.cadence,
      item.airtime,
      item.runSchedule,
      ...(item.hosts || []),
      ...(item.genres || [])
    ]
      .map((value) => normalizeWwfIdentityText(value).toLowerCase())
      .filter(Boolean)
      .join(" ");
  }

  function scoreResult(item, queryText) {
    let score = 0;
    score += scoreTextMatch(item.title, queryText, 240, 190, 140);
    score += scoreTextMatch(item.description, queryText, 95, 0, 60);
    score += scoreTextMatch(item.location, queryText, 180, 145, 115);
    score += scoreTextMatch(item.cadence, queryText, 35, 25, 15);
    score += scoreTextMatch(item.airtime, queryText, 70, 55, 35);
    score += scoreTextMatch(item.runSchedule, queryText, 35, 25, 15);
    score += scoreListMatch(item.hosts, queryText, 230, 190, 150);
    score += scoreListMatch(item.genres, queryText, 170, 145, 115);

    const tokens = queryText.split(/\s+/g).filter(Boolean);
    if (tokens.length > 1) {
      const searchText = buildSearchText(item);
      if (tokens.every((token) => searchText.includes(token))) {
        score += 70;
      }
    }
    return score;
  }

  return baseResults
    .map((item) => ({ ...item, _score: scoreResult(item, q) }))
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

async function getWwfEpisodePlaylist(episodeUrl) {
  const url = normalizeEpisodeUrl(episodeUrl);
  if (!url) {
    return { episodeUrl: "", tracks: [] };
  }
  const html = await fetchText(url);
  // Primary: parse tracklist from RSC episode detail
  const epDetail = parseRscEpisodeDetail(html);
  let tracklistHtml = epDetail?.metadata?.tracklist || "";
  // Resolve RSC "$N" references (tracklist stored as separate text chunk)
  if (tracklistHtml && /^\$\d+$/.test(tracklistHtml)) {
    const refMap = buildRscRefMap(html);
    tracklistHtml = refMap[tracklistHtml] || "";
  }
  // Decode JSON-escaped unicode (\u003c → <) from RSC payloads
  if (tracklistHtml) {
    tracklistHtml = tracklistHtml.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  if (tracklistHtml) {
    const tracks = parseTracklistHtml(tracklistHtml);
    if (tracks.length) return { episodeUrl: url, tracks };
  }
  // Fallback: old <li> parsing — only match <li> elements that look like
  // actual tracklist entries (have track/artist classes). Skip generic nav <li>.
  const tracks = [];
  const listItems = html.matchAll(/<li[^>]*>[\s\S]*?<\/li>/gi);
  for (const li of listItems) {
    const block = li[0];
    // Require at least one tracklist-related CSS class to avoid matching nav links
    if (!/class=["'][^"']*(?:track|artist|song|music|playlist)[^"']*["']/i.test(block)) continue;
    const titleMatch = block.match(/class=["'][^"']*track[^"']*["'][^>]*>([^<]+)/i);
    const artistMatch = block.match(/class=["'][^"']*artist[^"']*["'][^>]*>([^<]+)/i);
    if (titleMatch && titleMatch[1]) {
      tracks.push({
        title: cleanText(titleMatch[1]),
        artist: artistMatch && artistMatch[1] ? cleanText(artistMatch[1]) : "",
        image: ""
      });
    }
  }
  return { episodeUrl: url, tracks };
}

const hostEpisodesCache = new Map(); // hostSlug → { fetchedAt, episodes }
const hostMetadataCache = new Map(); // hostSlug → { fetchedAt, data }
const hostSlugsCache = { fetchedAt: 0, slugs: [], TTL_MS: 1000 * 60 * 30 };

/**
 * Extract host metadata from a WWF host page RSC payload.
 * Returns { displayName, description, image, location, typeSlug, hostUrl }.
 */
async function fetchWwfHostMetadata(hostSlug, useCache = true) {
  if (!hostSlug) return null;
  const now = Date.now();
  const cached = hostMetadataCache.get(hostSlug);
  if (useCache && cached && now - cached.fetchedAt < 1000 * 60 * 15) return cached.data;
  try {
    const html = await fetchText(`${BASE_URL}/hosts/${encodeURIComponent(hostSlug)}`);
    // Decode RSC payloads and find the host display chunk
    const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
    let result = null;
    for (const c of chunks) {
      let decoded;
      try { decoded = JSON.parse('"' + c[1] + '"'); } catch { continue; }
      if (!decoded.includes("displayName")) continue;
      const dnMatch = decoded.match(/"displayName":"([^"]+)"/);
      const diMatch = decoded.match(/"displayImage":"([^"]+)"/);

      // Extract the host's own description from the "show" object near displayName.
      // Structure: "displayName":"X",...,"show":{..."metadata":{..."description":VALUE...}}
      // The show.metadata.description is the host's bio; other "description" fields in the
      // payload belong to embedded episode or type objects and must be skipped.
      let description = "";
      const dnIdx = dnMatch ? decoded.indexOf(dnMatch[0]) : -1;
      if (dnIdx >= 0) {
        // Find the "show":{ object after displayName
        const showIdx = decoded.indexOf('"show":{', dnIdx);
        if (showIdx >= 0) {
          // Find "metadata":{ within the show object
          const metaIdx = decoded.indexOf('"metadata":{', showIdx);
          if (metaIdx >= 0 && metaIdx < showIdx + 500) {
            // Extract the description value from this specific metadata block
            const metaSlice = decoded.slice(metaIdx, metaIdx + 3000);
            // Match the first "description" in this metadata context
            const descInMeta = metaSlice.match(/"description":"((?:[^"\\]|\\.)*)"/);
            if (descInMeta) {
              try { description = JSON.parse('"' + descInMeta[1] + '"'); } catch { description = descInMeta[1]; }
            }
          }
        }
      }

      // Type slug (weekly, daily, etc.) — from the show.metadata.type object near displayName
      let typeSlug = "";
      if (dnIdx >= 0) {
        const typeIdx = decoded.indexOf('"type":{', dnIdx);
        if (typeIdx >= 0 && typeIdx < dnIdx + 1000) {
          const typeMatch = decoded.slice(typeIdx, typeIdx + 300).match(/"slug":"([^"]+)"/);
          if (typeMatch) typeSlug = typeMatch[1];
        }
      }

      // Image from host show metadata
      const imgMatch = decoded.match(/"imgix_url":"([^"]+)"/);

      // Location: try RSC metadata location object first, then HTML fallback
      let location = "";
      if (dnIdx >= 0) {
        const showIdx2 = decoded.indexOf('"show":{', dnIdx);
        if (showIdx2 >= 0) {
          const metaIdx2 = decoded.indexOf('"metadata":{', showIdx2);
          if (metaIdx2 >= 0 && metaIdx2 < showIdx2 + 500) {
            const metaSlice2 = decoded.slice(metaIdx2, metaIdx2 + 3000);
            const locInMeta = metaSlice2.match(/"location":\{"[^"]*":"[^"]*","[^"]*":"[^"]*","title":"([^"]+)"/);
            if (locInMeta) location = cleanText(locInMeta[1]);
            if (!location) {
              const locSimple = metaSlice2.match(/"location":\{[^}]*"title":"([^"]+)"/);
              if (locSimple) location = cleanText(locSimple[1]);
            }
          }
        }
      }
      if (!location) {
        const locHtml = html.match(/tracking-wider">\s*([^<]+)\s*<\/span>/);
        if (locHtml) location = cleanText(locHtml[1]);
      }

      // Fallback: extract location and description from episodes in the shows array
      if (!description || !location) {
        const showsIdx = decoded.indexOf('"shows":[', dnIdx >= 0 ? dnIdx : 0);
        if (showsIdx >= 0) {
          const episodeSlice = decoded.slice(showsIdx, showsIdx + 5000);
          if (!location) {
            const epLoc = episodeSlice.match(/"location":\{[^}]*"title":"([^"]+)"/);
            if (epLoc) location = cleanText(epLoc[1]);
          }
          if (!description) {
            const epDesc = episodeSlice.match(/"description":"((?:[^"\\]|\\.)*)"/);
            if (epDesc && epDesc[1]) {
              try { description = JSON.parse('"' + epDesc[1] + '"'); } catch { description = epDesc[1]; }
            }
          }
        }
      }

      result = {
        hostSlug,
        displayName: dnMatch?.[1] || hostSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: cleanText(stripHtml(description)).slice(0, 500),
        image: diMatch?.[1] || imgMatch?.[1] || "",
        location,
        typeSlug,
        hostUrl: `${BASE_URL}/hosts/${hostSlug}`
      };
      break;
    }
    if (result) {
      hostMetadataCache.set(hostSlug, { fetchedAt: now, data: result });
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Discover host slugs from the /shows page and /shows?type=hosts-series page RSC payloads.
 * Parses regular_hosts objects and the hosts-series listing for actual host slugs and titles.
 * Returns array of { slug, title } objects.
 */
async function fetchWwfHostSlugs(useCache = true) {
  const now = Date.now();
  if (useCache && hostSlugsCache.slugs.length && now - hostSlugsCache.fetchedAt < hostSlugsCache.TTL_MS) {
    return hostSlugsCache.slugs;
  }
  const bySlug = new Map();

  /** Parse RSC chunks from an HTML page for host slugs + titles. */
  function extractHostSlugsFromHtml(html) {
    const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
    for (const c of chunks) {
      let decoded;
      try { decoded = JSON.parse('"' + c[1] + '"'); } catch { continue; }
      // Extract host slugs + titles from regular_hosts / show objects
      const rhMatches = [...decoded.matchAll(/"slug":"([a-z0-9][a-z0-9-]+)","title":"([^"]+)"/g)];
      for (const m of rhMatches) {
        const slug = m[1];
        const title = m[2];
        // Filter out dates
        if (slug.match(/\d{2}-\d{2}-\d{4}/) || slug.match(/\d{2}-\d{2}-\d{2}$/)) continue;
        if (!bySlug.has(slug)) bySlug.set(slug, title);
      }
      // Also from /hosts/ links in the page
      const hostLinks = [...decoded.matchAll(/\/hosts\/([a-z0-9][a-z0-9-]+)/g)];
      for (const h of hostLinks) {
        const slug = h[1];
        if (!slug.match(/\d{2}-\d{2}/) && !bySlug.has(slug)) {
          bySlug.set(slug, slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
        }
      }
    }
  }

  try {
    // Fetch both /shows and /shows?type=hosts-series in parallel for maximum host coverage
    const [showsHtml, hostSeriesHtml] = await Promise.all([
      fetchText(`${BASE_URL}/shows`).catch(() => ""),
      fetchText(`${BASE_URL}/shows?type=hosts-series`).catch(() => "")
    ]);
    if (showsHtml) extractHostSlugsFromHtml(showsHtml);
    if (hostSeriesHtml) extractHostSlugsFromHtml(hostSeriesHtml);

    hostSlugsCache.slugs = [...bySlug.entries()].map(([slug, title]) => ({ slug, title }));
    hostSlugsCache.fetchedAt = now;
    return hostSlugsCache.slugs;
  } catch {
    return hostSlugsCache.slugs;
  }
}

/**
 * Generate host slug guesses from a search query (like NTS slug guesser).
 * Returns array of candidate slugs to try against /hosts/{slug}.
 */
function generateWwfHostSlugGuesses(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const guesses = new Set();
  // Full query as slug
  const full = words.join("-");
  guesses.add(full);
  // Each individual word (if 3+ chars) as potential host name
  for (const w of words) {
    const ws = w.replace(/[^a-z0-9-]/g, "");
    if (ws.length >= 3) guesses.add(ws);
  }
  // Pairs of adjacent words
  for (let i = 0; i < words.length - 1; i++) {
    guesses.add(words.slice(i, i + 2).join("-"));
  }
  return [...guesses].filter(Boolean);
}

/** Scrape episode URLs from a WWF host page (/hosts/{slug}). Returns episode objects. */
async function fetchWwfHostPageEpisodes(hostSlug, useCache = true) {
  if (!hostSlug) return [];
  const now = Date.now();
  const cached = hostEpisodesCache.get(hostSlug);
  if (useCache && cached && now - cached.fetchedAt < 1000 * 60 * 15) return cached.episodes;
  try {
    const html = await fetchText(`${BASE_URL}/hosts/${encodeURIComponent(hostSlug)}`);
    // Try RSC episode objects first (same approach as /shows page)
    const episodes = parseRscEpisodes(html);
    // Fallback: extract episode links from HTML/RSC payloads
    if (!episodes.length) {
      const seen = new Set();
      const linkPattern = /\/episode\/([a-z0-9][a-z0-9-]*)/gi;
      let m;
      while ((m = linkPattern.exec(html)) !== null) {
        const slug = m[1];
        const episodeUrl = `${BASE_URL}/episode/${slug}`;
        if (seen.has(episodeUrl)) continue;
        seen.add(episodeUrl);
        const title = slug.replace(/-(\d{2})-(\d{2})-(\d{4})$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const dateMatch = slug.match(/(\d{2})-(\d{2})-(\d{4})$/);
        const publishedTime = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : "";
        const { showName, episodeName } = parseTitleParts(title);
        episodes.push({
          clipId: slug,
          id: slug,
          title: episodeName || title,
          fullTitle: title,
          showName: showName || title,
          episodeName: episodeName || title,
          episodeUrl,
          downloadUrl: episodeUrl,
          publishedTime,
          image: "",
          location: "",
          source: "host"
        });
      }
    }
    episodes.sort((a, b) => (b.publishedTime || "").localeCompare(a.publishedTime || ""));
    hostEpisodesCache.set(hostSlug, { fetchedAt: now, episodes });
    return episodes;
  } catch {
    return [];
  }
}

/** Extract host slug from an episode detail page (looks for /hosts/XXX links). */
async function discoverHostSlug(episodeUrl) {
  if (!episodeUrl) return "";
  try {
    const html = await fetchText(episodeUrl);
    const hostMatch = html.match(/\/hosts\/([a-z0-9][a-z0-9-]*)/i);
    return hostMatch ? hostMatch[1] : "";
  } catch {
    return "";
  }
}

function normalizeWwfProgramUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    throw new Error("Program name or URL is required.");
  }
  if (/worldwidefm\.net/i.test(raw)) {
    const parsed = new URL(raw, BASE_URL);
    const pathMatch = parsed.pathname.match(/\/shows(?:\?|$)/);
    if (pathMatch) {
      return parsed.origin + parsed.pathname;
    }
  }
  return raw;
}

function getWwfMetadataRichnessScore(item) {
  return [
    item.image ? 1 : 0,
    item.description ? 2 : 0,
    Array.isArray(item.hosts) ? Math.min(item.hosts.length, 3) * 2 : 0,
    Array.isArray(item.genres) ? Math.min(item.genres.length, 3) : 0,
    item.location ? 2 : 0,
    item.runSchedule ? 2 : 0,
    item.airtime ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function scoreWwfDiscoveryNovelty(item, selected) {
  const seenHosts = new Set();
  const seenGenres = new Set();
  const seenLocations = new Set();
  const seenTitles = new Set();

  for (const entry of selected || []) {
    for (const host of entry.hosts || []) {
      seenHosts.add(normalizeWwfIdentityText(host).toLowerCase());
    }
    for (const genre of entry.genres || []) {
      seenGenres.add(normalizeWwfIdentityText(genre).toLowerCase());
    }
    seenLocations.add(normalizeWwfIdentityText(entry.location || "").toLowerCase());
    seenTitles.add(normalizeWwfIdentityText(entry.title || "").toLowerCase());
  }

  let score = 0;
  const titleKey = normalizeWwfIdentityText(item.title || "").toLowerCase();
  const locationKey = normalizeWwfIdentityText(item.location || "").toLowerCase();
  if (titleKey && !seenTitles.has(titleKey)) {
    score += 2;
  }
  if (locationKey && !seenLocations.has(locationKey)) {
    score += 3;
  }
  for (const host of item.hosts || []) {
    const key = normalizeWwfIdentityText(host).toLowerCase();
    if (key && !seenHosts.has(key)) {
      score += 5;
    }
  }
  for (const genre of item.genres || []) {
    const key = normalizeWwfIdentityText(genre).toLowerCase();
    if (key && !seenGenres.has(key)) {
      score += 3;
    }
  }
  return score;
}

function pickWwfDiscoveryResults(items, count) {
  const remaining = (items || [])
    .map((item) => ({
      item,
      richness: getWwfMetadataRichnessScore(item) + Math.random()
    }))
    .sort((a, b) => b.richness - a.richness)
    .map((entry) => entry.item);

  const selected = [];
  while (remaining.length && selected.length < count) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const score = getWwfMetadataRichnessScore(item) + scoreWwfDiscoveryNovelty(item, selected) + Math.random();
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

async function getWwfDiscovery(count = 5) {
  const hosts = await fetchWwfHostSlugs(true).catch(() => []);
  const shuffled = [...hosts].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, Math.min(count * 4, shuffled.length));
  const results = [];
  const concurrency = 4;
  let idx = 0;
  async function worker() {
    while (idx < sample.length) {
      const h = sample[idx++];
      // Use /hosts/ URL so getWwfProgramSummary fetches real host metadata
      const hostUrl = `${BASE_URL}/hosts/${h.slug}`;
      try {
        const meta = await getWwfProgramSummary(hostUrl);
        const title = meta?.title || h.title || "";
        // Skip genre/type stubs — real host pages have at least an image or description
        if (meta && title && !title.startsWith("http") && (meta.image || meta.description)) results.push({
          source: "wwf",
          programUrl: hostUrl,
          title,
          description: meta.description || "",
          image: meta.image || "",
          cadence: meta.cadence || "irregular",
          airtime: meta.timeSlot || "",
          runSchedule: meta.runSchedule || "",
          location: meta.location || "",
          genres: meta.genres || [],
          hosts: (meta.hosts && meta.hosts.length) ? meta.hosts : [title]
        });
      } catch { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sample.length) }, () => worker()));
  return pickWwfDiscoveryResults(results, count);
}

module.exports = {
  BASE_URL,
  LIVE_STATIONS,
  getWwfEpisodeInfo,
  getWwfEpisodeMixcloudUrl,
  getWwfProgramSummary,
  getWwfProgramEpisodes,
  searchWwfPrograms,
  getWwfEpisodePlaylist,
  getWwfDiscovery,
  getWwfLiveNow,
  fetchRecentEpisodes,
  fetchWwfScheduleEpisodes,
  fetchWwfHostPageEpisodes,
  fetchWwfHostMetadata,
  fetchWwfHostSlugs,
  discoverHostSlug,
  normalizeWwfProgramUrl,
  normalizeEpisodeUrl,
  parseTitleParts,
  episodeMatchesHostIdentity,
  isWwfEpisodeReleased,
  buildHostIdentityNames,
  normalizeWwfDisplayList,
  toWwfDisplayLabel
};
