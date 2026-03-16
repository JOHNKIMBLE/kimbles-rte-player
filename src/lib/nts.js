/**
 * NTS Radio (nts.live) integration.
 * Show: /shows/{show-slug}, Episode: /shows/{show-slug}/episodes/{episode-slug}
 * Episodes have tracklists with timestamps for cue/chapters.
 */

const BASE_URL = "https://www.nts.live";
const NTS_API_BASE = `${BASE_URL}/api/v2`;
const STREAM_BASE = "https://stream-relay-geo.ntslive.net";

const LIVE_STATIONS = [
  { id: "nts1", name: "NTS 1", liveUrl: `${BASE_URL}/`, streamUrl: `${STREAM_BASE}/stream?client=direct` },
  { id: "nts2", name: "NTS 2", liveUrl: `${BASE_URL}/`, streamUrl: `${STREAM_BASE}/stream2?client=direct` }
];

const showCache = new Map();
const latestCache = { fetchedAt: 0, episodes: [], TTL_MS: 1000 * 60 * 15 };
const allShowsCache = { shows: [], fetchedAt: 0, TTL_MS: 1000 * 60 * 30 };
let _diskCache = null;
function configure({ diskCache } = {}) { _diskCache = diskCache || null; }

const { cleanText, stripHtml } = require("./utils");

function normalizeShowUrl(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw, BASE_URL);
      if (!/nts\.live/i.test(parsed.hostname)) return raw;
      const match = parsed.pathname.match(/^\/shows\/([^/]+)(?:\/episodes\/.*)?$/i);
      if (match) return `${parsed.origin}/shows/${match[1]}`;
    } catch {}
    return raw;
  }
  return `${BASE_URL}/shows/${raw.replace(/^\//, "").replace(/^shows\//, "")}`;
}

function normalizeEpisodeUrl(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, BASE_URL);
    if (!/nts\.live/i.test(parsed.hostname)) return raw;
    if (/\/shows\/[^/]+\/episodes\/[^/]+/.test(parsed.pathname)) {
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    }
  } catch {}
  return raw;
}

/** Extract show_alias from show URL or slug (for API calls). */
function getShowAliasFromUrl(showUrl) {
  const url = normalizeShowUrl(showUrl);
  if (!url) return "";
  const m = url.match(/\/shows\/([^/?#]+)/);
  return m ? m[1] : "";
}

/** Parse "DD MMM YYYY" to YYYY-MM-DD */
function parseDateNts(text) {
  const match = String(text || "").match(/\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/);
  if (!match) return "";
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mi = months.indexOf(String(match[2]).toLowerCase().slice(0, 3));
  if (mi < 0) return "";
  return `${match[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9"
};

async function fetchText(url) {
  if (typeof fetch !== "undefined") {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) throw new Error(`Failed to load NTS: ${response.status} ${response.statusText}`);
    return response.text();
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? require("node:https") : require("node:http");
    const req = mod.get(url, { headers: FETCH_HEADERS }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to load NTS: ${res.statusCode} ${res.statusMessage}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function fetchJson(url) {
  if (typeof fetch !== "undefined") {
    const response = await fetch(url, { headers: { ...FETCH_HEADERS, Accept: "application/json" } });
    if (!response.ok) throw new Error(`Failed to load NTS: ${response.status} ${response.statusText}`);
    return response.json();
  }
  const text = await fetchText(url);
  return JSON.parse(text);
}

/** GET /api/v2/shows?offset=&limit= — paginated list of shows. */
async function fetchNtsShowsFromApi(offset = 0, limit = 50) {
  const url = `${NTS_API_BASE}/shows?offset=${Number(offset)}&limit=${Number(limit)}`;
  const data = await fetchJson(url);
  const results = Array.isArray(data?.results) ? data.results : [];
  const total = data?.metadata?.resultset?.count ?? results.length;
  return { results, totalCount: total };
}

/** GET /api/v2/shows/{show_alias} — single show. */
async function fetchNtsShowFromApi(showAlias) {
  if (!showAlias) return null;
  const url = `${NTS_API_BASE}/shows/${encodeURIComponent(showAlias)}`;
  try {
    return await fetchJson(url);
  } catch {
    return null;
  }
}

/** GET /api/v2/shows/{show_alias}/episodes?offset=&limit= — episodes for a show. */
async function fetchNtsEpisodesFromApi(showAlias, offset = 0, limit = 20) {
  if (!showAlias) return { results: [], totalCount: 0 };
  const url = `${NTS_API_BASE}/shows/${encodeURIComponent(showAlias)}/episodes?offset=${Number(offset)}&limit=${Number(limit)}`;
  try {
    const data = await fetchJson(url);
    const results = Array.isArray(data?.results) ? data.results : [];
    const total = data?.metadata?.resultset?.count ?? results.length;
    return { results, totalCount: total };
  } catch {
    return { results: [], totalCount: 0 };
  }
}

/**
 * Parse NTS timeslot string into scheduler-compatible runSchedule.
 * Formats: "MONDAY - WEDNESDAY / WEEKLY", "MONDAY / 2PM - 3PM / MONTHLY",
 *          "TUESDAY / 4PM - 5PM CGN / MONTHLY", "ARCHIVE SHOW", "MONTHLY"
 * Returns { days: string[], startHour, endHour, frequency } where hours are UTC (24h).
 */
function parseNtsTimeslot(timeslot) {
  const raw = String(timeslot || "").toUpperCase().trim();
  if (!raw || raw === "ARCHIVE SHOW") return null;

  const parts = raw.split(/\s*\/\s*/).filter(Boolean);
  let dayStr = "";
  let timeStr = "";
  let frequency = "";

  for (const part of parts) {
    const p = part.trim();
    if (/^(WEEKLY|MONTHLY|BIMONTHLY|FORTNIGHTLY|DAILY)$/.test(p)) {
      frequency = p.toLowerCase();
    } else if (/\d/.test(p) && /[AP]M|\d{1,2}:\d{2}/.test(p)) {
      timeStr = p;
    } else if (/MON|TUE|WED|THU|FRI|SAT|SUN/.test(p)) {
      dayStr = p;
      // Also might contain frequency at end: "MONDAY - MONTHLY"
      if (/MONTHLY|WEEKLY|DAILY|BIMONTHLY|FORTNIGHTLY/.test(p)) {
        frequency = (p.match(/(MONTHLY|WEEKLY|DAILY|BIMONTHLY|FORTNIGHTLY)/i) || [])[1]?.toLowerCase() || "";
        dayStr = p.replace(/(MONTHLY|WEEKLY|DAILY|BIMONTHLY|FORTNIGHTLY)/gi, "").replace(/-\s*$/, "").trim();
      }
    }
  }

  // Parse days
  const DAY_MAP = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun" };
  const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const days = [];
  const rangeMatch = dayStr.match(/(\w{3})\w*\s*-\s*(\w{3})\w*/);
  if (rangeMatch) {
    const startIdx = DAY_ORDER.indexOf(rangeMatch[1].slice(0, 3));
    const endIdx = DAY_ORDER.indexOf(rangeMatch[2].slice(0, 3));
    if (startIdx >= 0 && endIdx >= 0) {
      let i = startIdx;
      while (true) {
        days.push(DAY_MAP[DAY_ORDER[i]] || DAY_ORDER[i]);
        if (i === endIdx) break;
        i = (i + 1) % 7;
        if (days.length > 7) break;
      }
    }
  } else {
    // Individual days
    for (const d of DAY_ORDER) {
      if (dayStr.includes(d)) days.push(DAY_MAP[d]);
    }
  }

  // Parse time range: "2PM - 3PM", "MIDNIGHT-1AM", "4PM - 5PM CGN"
  let startHour = null;
  let endHour = null;
  if (timeStr) {
    const timeRange = timeStr.replace(/\s*(UTC|GMT|BST|CGN|CET|PST|EST|CST)\s*/gi, "").trim();
    const convertTo24 = (h, ampm) => {
      let hour = parseInt(h, 10);
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return hour;
    };
    if (/MIDNIGHT/i.test(timeRange)) startHour = 0;
    const hmMatch = timeRange.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (hmMatch) {
      startHour = convertTo24(hmMatch[1], hmMatch[3].toUpperCase());
      endHour = convertTo24(hmMatch[4], hmMatch[6].toUpperCase());
    }
    const h24Match = timeRange.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (h24Match) {
      startHour = parseInt(h24Match[1], 10);
      endHour = parseInt(h24Match[3], 10);
    }
  }

  if (!days.length && !frequency) return null;
  return { days, startHour, endHour, frequency: frequency || "weekly" };
}

/**
 * Build scheduler-compatible runSchedule from NTS show data + episode broadcasts.
 * Returns { runSchedule, cadence, nextBroadcastAt }.
 */
function buildNtsScheduleInfo(apiShow, episodes) {
  const parsed = parseNtsTimeslot(apiShow?.timeslot);
  if (!parsed) return { runSchedule: "", cadence: "irregular", nextBroadcastAt: "" };

  // Infer broadcast time from recent episodes if not in timeslot
  let startHour = parsed.startHour;
  let endHour = parsed.endHour;
  if (startHour == null && Array.isArray(episodes) && episodes.length) {
    for (const ep of episodes) {
      const broadcast = ep?.broadcast || "";
      if (broadcast) {
        const d = new Date(broadcast);
        if (!Number.isNaN(d.getTime())) {
          startHour = d.getUTCHours();
          // Assume 2-hour show if no end time
          endHour = endHour != null ? endHour : (startHour + 2) % 24;
          break;
        }
      }
    }
  }

  // Store schedule times in UTC. The scheduler compares against UTC,
  // and the renderer converts UTC → user's local timezone for display.

  // Build runSchedule string in UTC: "Mon-Wed • 09:00 - 11:00"
  let dayPart = "";
  if (parsed.days.length >= 2) {
    dayPart = parsed.days[0] + "-" + parsed.days[parsed.days.length - 1];
  } else if (parsed.days.length === 1) {
    dayPart = parsed.days[0];
  }

  let runSchedule = "";
  if (dayPart && startHour != null && endHour != null) {
    const fmt = (h) => String(h).padStart(2, "0") + ":00";
    runSchedule = `${dayPart} • ${fmt(startHour)} - ${fmt(endHour)}`;
  } else if (dayPart) {
    // No time info — use a wide window (the scheduler will check every N hours instead)
    runSchedule = "";
  }

  // Cadence
  let cadence = "irregular";
  if (parsed.frequency === "daily") cadence = "daily";
  else if (parsed.frequency === "weekly") cadence = "weekly";
  else if (parsed.frequency === "fortnightly" || parsed.frequency === "bimonthly") cadence = "weekly";

  // Calculate nextBroadcastAt from the most recent episode broadcast + cadence
  let nextBroadcastAt = "";
  if (Array.isArray(episodes) && episodes.length && parsed.days.length) {
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayIndices = parsed.days.map((d) => DAY_NAMES.indexOf(d)).filter((i) => i >= 0);
    if (dayIndices.length && startHour != null) {
      const now = new Date();
      // Find the next occurrence of one of the broadcast days
      for (let offset = 0; offset <= 7; offset++) {
        const candidate = new Date(now);
        candidate.setUTCDate(candidate.getUTCDate() + offset);
        candidate.setUTCHours(startHour, 0, 0, 0);
        if (dayIndices.includes(candidate.getUTCDay()) && candidate > now) {
          nextBroadcastAt = candidate.toISOString();
          break;
        }
      }
    }
  }

  return { runSchedule, cadence, nextBroadcastAt };
}

/** Map API show object to program summary shape. */
function mapApiShowToSummary(apiShow, episodes) {
  const showAlias = apiShow?.show_alias || "";
  const programUrl = showAlias ? `${BASE_URL}/shows/${showAlias}` : "";
  const title = cleanText(apiShow?.name || "").slice(0, 300) || showAlias.replace(/-/g, " ") || "NTS Show";
  const description = cleanText(stripHtml(apiShow?.description || apiShow?.description_html || ""));
  const media = apiShow?.media || {};
  const image = media.picture_medium || media.picture_large || media.background_medium || media.background_large || "";
  const genres = Array.isArray(apiShow?.genres) ? apiShow.genres.map((g) => g?.value || "").filter(Boolean) : [];
  const location = cleanText(apiShow?.location_short || apiShow?.location_long || "")
    || (Array.isArray(episodes) && episodes.length ? cleanText(episodes[0]?.location_short || episodes[0]?.location_long || "") : "");

  // Build scheduler-friendly schedule info
  const schedInfo = buildNtsScheduleInfo(apiShow, episodes);
  // Keep original timeslot + frequency as display fallback
  const displayParts = [apiShow?.timeslot, apiShow?.frequency].filter(Boolean);
  const displaySchedule = displayParts.join(" ").trim();

  return {
    source: "nts",
    programUrl,
    title,
    description,
    image,
    runSchedule: schedInfo.runSchedule || displaySchedule || "",
    nextBroadcastAt: schedInfo.nextBroadcastAt || "",
    nextBroadcastTitle: "",
    cadence: schedInfo.cadence || "irregular",
    genres: genres.length ? genres : undefined,
    location: location || undefined
  };
}

/** Map API episode object to explorer episode shape. */
function mapApiEpisodeToExplorer(apiEpisode, showAlias) {
  const episodeAlias = apiEpisode?.episode_alias || "";
  const alias = showAlias || apiEpisode?.show_alias || "";
  const episodeUrl = alias && episodeAlias ? `${BASE_URL}/shows/${alias}/episodes/${episodeAlias}` : "";
  const title = cleanText(apiEpisode?.name || "").slice(0, 300) || episodeAlias || "Episode";
  const media = apiEpisode?.media || {};
  const image = media.picture_medium || media.picture_small || media.picture_large || "";
  const broadcast = apiEpisode?.broadcast || "";
  let publishedTime = "";
  if (broadcast) {
    const d = new Date(broadcast);
    if (!Number.isNaN(d.getTime())) publishedTime = d.toISOString().slice(0, 10);
  }
  const location = cleanText(apiEpisode?.location_short || apiEpisode?.location_long || "");
  const genres = Array.isArray(apiEpisode?.genres) ? apiEpisode.genres.map((g) => g?.value || "").filter(Boolean) : [];
  return {
    clipId: episodeAlias || episodeUrl,
    id: episodeAlias || episodeUrl,
    title,
    fullTitle: title,
    episodeUrl,
    downloadUrl: episodeUrl,
    publishedTime,
    image,
    location,
    genres: genres.length ? genres : undefined
  };
}

/** Resolve relative episode path to full URL */
function resolveEpisodeUrl(href, showUrl) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return normalizeEpisodeUrl(raw);
  if (raw.startsWith("/")) return normalizeEpisodeUrl(BASE_URL + raw);
  try {
    const base = showUrl ? new URL(showUrl) : new URL(BASE_URL);
    return normalizeEpisodeUrl(new URL(raw, base.origin).href);
  } catch {}
  return "";
}

/** Parse episode links from show page HTML. Supports full URLs, relative paths, and __NEXT_DATA__. */
function parseEpisodesFromShowHtml(html, showUrl) {
  const episodes = [];
  const seen = new Set();

  function addEpisode(url, linkText) {
    const resolved = resolveEpisodeUrl(url, showUrl);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    const raw = stripHtml(linkText || "");
    const linkTextClean = cleanText(raw);
    const dateMatch = linkTextClean.match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);
    const publishedTime = dateMatch ? parseDateNts(dateMatch[1]) : "";
    let title = linkTextClean;
    if (dateMatch) title = linkTextClean.slice(dateMatch[1].length).replace(/^(London|New York|Glasgow|Bamako|Los Angeles|San Francisco|Mumbai|Tokyo|[\w\s]+)·?\s*/i, "").trim();
    if (!title) title = resolved.split("/episodes/")[1] || "Episode";
    const slug = (resolved.match(/\/episodes\/([^/?#]+)/) || [])[1] || "";
    episodes.push({
      clipId: slug || resolved,
      id: slug || resolved,
      title,
      fullTitle: title,
      episodeUrl: resolved,
      downloadUrl: resolved,
      publishedTime,
      image: "",
      location: ""
    });
  }

  const fullUrlPattern = /href=["'](https?:\/\/[^"']*nts\.live\/shows\/[^/]+\/episodes\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = fullUrlPattern.exec(html)) !== null) {
    addEpisode(m[1], m[2]);
  }

  const relativePattern = /href=["'](\/shows\/[^/]+\/episodes\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = relativePattern.exec(html)) !== null) {
    addEpisode(m[1], m[2]);
  }

  if (episodes.length === 0) {
    try {
      const nextDataMatch = html.match(/<script\s+id=["']__NEXT_DATA__["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
      if (nextDataMatch && nextDataMatch[1]) {
        const data = JSON.parse(nextDataMatch[1]);
        const props = data?.props?.pageProps || {};
        const show = props?.show || props?.data?.show;
        const list = show?.episodes || props?.episodes || [];
        if (Array.isArray(list)) {
          for (const ep of list) {
            const slug = ep?.slug || ep?.episodeSlug;
            const path = ep?.path || (slug && show?.slug ? `/shows/${show.slug}/episodes/${slug}` : "");
            const url = path ? (path.startsWith("http") ? path : BASE_URL + path) : "";
            const title = ep?.title || ep?.name || slug || "Episode";
            const published = ep?.publishedAt || ep?.date || ep?.broadcastDate || "";
            let img = ep?.image || ep?.artwork || "";
            if (img && !img.startsWith("http")) img = img.startsWith("//") ? "https:" + img : BASE_URL + (img.startsWith("/") ? img : "/" + img);
            if (url && !seen.has(url)) {
              seen.add(url);
              episodes.push({
                clipId: slug || url,
                id: slug || url,
                title,
                fullTitle: title,
                episodeUrl: url,
                downloadUrl: url,
                publishedTime: published,
                image: img,
                location: ""
              });
            }
          }
        }
      }
    } catch {}
  }

  return episodes;
}

/** Parse tracklist from episode page. Format: "0:00:10 Artist Title" or "Artist - Title" (no timestamp = supporter only). */
function parseTracklistFromEpisodeHtml(html) {
  const tracks = [];
  const block = html.replace(/<[^>]+>/g, "\n");
  const regex = /(\d{1,2}):(\d{2}):(\d{2})\s*\n+([\s\S]*?)(?=\n\s*\d{1,2}:\d{2}:\d{2}\s*\n|\n\n####|$)/g;
  let m;
  while ((m = regex.exec(block)) !== null) {
    const startSeconds = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    const raw = String(m[4] || "").trim();
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let artist = "";
    let title = "";
    if (lines.length >= 2) {
      artist = lines[0].replace(/(\S+)\s+\1/, "$1").trim();
      title = lines.slice(1).join(" ").trim();
    } else if (lines.length === 1) {
      const line = lines[0];
      const dashMatch = line.match(/\s+[-–—]\s+/);
      if (dashMatch) {
        const idx = line.indexOf(dashMatch[0]);
        artist = line.slice(0, idx).trim();
        title = line.slice(idx + dashMatch[0].length).trim();
      } else {
        title = line;
      }
    }
    if (title || artist) {
      tracks.push({
        startSeconds,
        title: title || "Unknown",
        artist,
        image: ""
      });
    }
  }
  return tracks;
}

/** Map tracklist to cue-style tracks (title, artist, optional start for chapters) */
function tracklistToPlaylistTracks(tracklist) {
  return tracklist.map((t) => ({
    title: t.title,
    artist: t.artist,
    image: t.image || "",
    startSeconds: t.startSeconds
  }));
}

async function getNtsEpisodeInfo(episodeUrl) {
  const url = normalizeEpisodeUrl(episodeUrl);
  if (!url) throw new Error("Invalid NTS episode URL.");
  const html = await fetchText(url);
  const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || html.match(/<title>([^<]+)<\/title>/i);
  const title = cleanText(titleMatch?.[1] || "");
  const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const description = cleanText(descMatch?.[1] || "");
  const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const image = cleanText(imgMatch?.[1] || "");
  const slug = (url.match(/\/episodes\/([^/?#]+)/) || [])[1] || "";
  const tracklist = parseTracklistFromEpisodeHtml(html);
  return {
    episodeUrl: url,
    title: title || slug,
    description,
    image,
    clipId: slug || url,
    tracklist
  };
}

async function getNtsProgramSummary(showUrl) {
  const url = normalizeShowUrl(showUrl);
  if (!url) {
    return { source: "nts", programUrl: "", title: "NTS", description: "", image: "", runSchedule: "", nextBroadcastAt: "", nextBroadcastTitle: "" };
  }
  if (showCache.has(url)) return showCache.get(url);

  const showAlias = getShowAliasFromUrl(url);
  if (showAlias) {
    try {
      const [apiShow, episodesData] = await Promise.all([
        fetchNtsShowFromApi(showAlias),
        fetchNtsEpisodesFromApi(showAlias, 0, 5).catch(() => ({ results: [] }))
      ]);
      if (apiShow && (apiShow.show_alias || apiShow.name)) {
        const summary = mapApiShowToSummary(apiShow, episodesData.results);
        showCache.set(url, summary);
        return summary;
      }
    } catch (_) {}
  }

  const html = await fetchText(url);
  const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = cleanText(titleMatch?.[1] || "").replace(/<[^>]+>/g, "") || url.split("/shows/")[1] || "NTS Show";
  const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const description = cleanText(descMatch?.[1] || "");
  const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const image = cleanText(imgMatch?.[1] || "");
  const summary = {
    source: "nts",
    programUrl: url,
    title,
    description,
    image,
    runSchedule: "",
    nextBroadcastAt: "",
    nextBroadcastTitle: ""
  };
  showCache.set(url, summary);
  return summary;
}

async function getNtsProgramEpisodes(showUrl, page = 1) {
  const url = normalizeShowUrl(showUrl);
  if (!url) throw new Error("Invalid NTS show URL.");
  const showAlias = getShowAliasFromUrl(url);
  const perPage = 20;
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * perPage;

  if (showAlias) {
    try {
      const [showData, episodesData] = await Promise.all([
        fetchNtsShowFromApi(showAlias),
        fetchNtsEpisodesFromApi(showAlias, offset, perPage)
      ]);
      if (showData && (showData.show_alias || showData.name) && Array.isArray(episodesData.results)) {
        const summary = mapApiShowToSummary(showData, episodesData.results);
        const totalCount = episodesData.totalCount || 0;
        const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
        const pageEpisodes = (episodesData.results || []).map((ep) => mapApiEpisodeToExplorer(ep, showAlias));
        return {
          source: "nts",
          programUrl: url,
          title: summary.title,
          description: summary.description,
          image: summary.image || "",
          episodes: pageEpisodes,
          totalItems: totalCount,
          page: safePage,
          numPages: totalPages,
          cadence: summary.cadence || "irregular",
          averageDaysBetween: null,
          runSchedule: summary.runSchedule || "",
          nextBroadcastAt: summary.nextBroadcastAt || "",
          nextBroadcastTitle: summary.nextBroadcastTitle || "",
          genres: summary.genres || undefined
        };
      }
    } catch (_) {}
  }

  const html = await fetchText(url);
  const episodes = parseEpisodesFromShowHtml(html, url);
  const summary = await getNtsProgramSummary(url);
  const totalPages = Math.max(1, Math.ceil(episodes.length / perPage));
  const start = (safePage - 1) * perPage;
  const pageEpisodes = episodes.slice(start, start + perPage);
  return {
    source: "nts",
    programUrl: url,
    title: summary.title,
    description: summary.description,
    episodes: pageEpisodes,
    totalItems: episodes.length,
    page: safePage,
    numPages: totalPages,
    cadence: "irregular",
    averageDaysBetween: null,
    runSchedule: summary.runSchedule || "",
    nextBroadcastAt: summary.nextBroadcastAt || "",
    nextBroadcastTitle: summary.nextBroadcastTitle || ""
  };
}

/** Fetch /latest and parse episode links for search/discovery */
async function fetchLatestEpisodes(useCache = true) {
  const now = Date.now();
  if (useCache && latestCache.episodes.length && now - latestCache.fetchedAt < latestCache.TTL_MS) {
    return latestCache.episodes;
  }
  const html = await fetchText(`${BASE_URL}/latest`);
  const episodes = [];
  const seen = new Set();

  function addLatest(href, linkText) {
    const episodeUrl = resolveEpisodeUrl(href, BASE_URL);
    if (!episodeUrl || seen.has(episodeUrl)) return;
    seen.add(episodeUrl);
    const showMatch = episodeUrl.match(/\/shows\/([^/]+)\//);
    const showSlug = showMatch ? showMatch[1] : "";
    const showUrl = showSlug ? `${BASE_URL}/shows/${showSlug}` : "";
    const raw = stripHtml(linkText || "");
    const linkTextClean = cleanText(raw);
    const dateMatch = linkTextClean.match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);
    const publishedTime = dateMatch ? parseDateNts(dateMatch[1]) : "";
    let title = linkTextClean;
    if (dateMatch) title = linkTextClean.slice(dateMatch[1].length).replace(/^(London|New York|Glasgow|Bamako|Los Angeles|San Francisco|Mumbai|Tokyo|[\w\s]+)·?\s*/i, "").trim();
    if (!title) title = episodeUrl.split("/episodes/")[1] || "Episode";
    const slug = (episodeUrl.match(/\/episodes\/([^/?#]+)/) || [])[1] || "";
    episodes.push({
      clipId: slug || episodeUrl,
      id: slug || episodeUrl,
      title,
      fullTitle: title,
      episodeUrl,
      downloadUrl: episodeUrl,
      publishedTime,
      image: "",
      location: "",
      showUrl,
      showSlug
    });
  }

  let m;
  const fullPattern = /href=["'](https?:\/\/[^"']*nts\.live\/shows\/[^/]+\/episodes\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = fullPattern.exec(html)) !== null) addLatest(m[1], m[2]);
  const relPattern = /href=["'](\/shows\/[^/]+\/episodes\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = relPattern.exec(html)) !== null) addLatest(m[1], m[2]);
  latestCache.fetchedAt = now;
  latestCache.episodes = episodes;
  return episodes;
}

const showsPageCache = { shows: [], fetchedAt: 0, TTL_MS: 1000 * 60 * 15 };

/** Fetch /shows page and parse all show links (residents etc.) for search. */
async function fetchNtsShowsFromShowsPage(useCache = true) {
  const now = Date.now();
  if (useCache && showsPageCache.shows.length && now - showsPageCache.fetchedAt < showsPageCache.TTL_MS) {
    return showsPageCache.shows;
  }
  const shows = [];
  const seen = new Set();
  try {
    const html = await fetchText(`${BASE_URL}/shows`);
    const fullPattern = /href=["'](https?:\/\/[^"']*nts\.live\/shows\/([^/]+)(?:\/episodes)?\/?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const relPattern = /href=["'](\/shows\/([^/]+)(?:\/episodes)?\/?)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    function addShow(url, slug, linkText) {
      const showUrl = url.startsWith("http") ? url.replace(/\/episodes.*$/i, "").replace(/\/+$/, "") : BASE_URL + url.replace(/\/episodes.*$/i, "").replace(/\/+$/, "");
      if (!showUrl || !/\/shows\/[^/]+$/.test(showUrl) || seen.has(showUrl)) return;
      seen.add(showUrl);
      const title = cleanText(stripHtml(linkText || "")).slice(0, 200) || slug.replace(/-/g, " ");
      shows.push({ showUrl, slug, title });
    }
    let m;
    while ((m = fullPattern.exec(html)) !== null) addShow(m[1], m[2], m[3]);
    while ((m = relPattern.exec(html)) !== null) addShow(m[1], m[2], m[3]);
    showsPageCache.shows = shows;
    showsPageCache.fetchedAt = now;
  } catch {}
  return shows;
}

/**
 * Fetch all shows from the paginated NTS API (12 per page, batched).
 * Caches for 30 minutes. Returns array of { alias, name, desc }.
 */
async function fetchAllNtsShows(useCache = true) {
  const now = Date.now();
  const DISK_KEY = "nts:allShows";
  const DISK_TTL = 6 * 60 * 60 * 1000;
  if (useCache && !allShowsCache.shows.length && _diskCache) {
    const cached = _diskCache.get(DISK_KEY, DISK_TTL);
    if (cached) { allShowsCache.shows = cached; allShowsCache.fetchedAt = Date.now(); }
  }
  if (useCache && allShowsCache.shows.length && now - allShowsCache.fetchedAt < allShowsCache.TTL_MS) {
    return allShowsCache.shows;
  }
  const shows = [];
  const seen = new Set();
  try {
    // First request to learn total count
    const first = await fetchNtsShowsFromApi(0, 12);
    const total = first.totalCount || 0;
    for (const s of (first.results || [])) {
      const alias = s?.show_alias || "";
      if (alias && !seen.has(alias)) {
        seen.add(alias);
        shows.push({ alias, name: (s?.name || "").toLowerCase(), desc: (s?.description || "").toLowerCase() });
      }
    }
    // Fetch remaining pages in parallel batches of 10
    const offsets = [];
    for (let off = 12; off < Math.min(total, 2000); off += 12) offsets.push(off);
    const batchSize = 10;
    for (let i = 0; i < offsets.length; i += batchSize) {
      const batch = offsets.slice(i, i + batchSize);
      const pages = await Promise.all(batch.map((off) => fetchNtsShowsFromApi(off, 12).catch(() => ({ results: [] }))));
      for (const page of pages) {
        for (const s of (page.results || [])) {
          const alias = s?.show_alias || "";
          if (alias && !seen.has(alias)) {
            seen.add(alias);
            shows.push({ alias, name: (s?.name || "").toLowerCase(), desc: (s?.description || "").toLowerCase() });
          }
        }
      }
    }
  } catch {}
  // Also merge shows discovered from /latest and /shows page
  try {
    const [latestEpisodes, pageShows] = await Promise.all([
      fetchLatestEpisodes(true).catch(() => []),
      fetchNtsShowsFromShowsPage(true).catch(() => [])
    ]);
    for (const ep of latestEpisodes) {
      const slug = ep.showSlug || (ep.showUrl || "").split("/shows/")[1] || "";
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        shows.push({ alias: slug, name: (ep.title || slug.replace(/-/g, " ")).toLowerCase(), desc: "" });
      }
    }
    for (const { slug, title } of pageShows) {
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        shows.push({ alias: slug, name: (title || slug.replace(/-/g, " ")).toLowerCase(), desc: "" });
      }
    }
  } catch {}
  allShowsCache.shows = shows;
  allShowsCache.fetchedAt = Date.now();
  if (_diskCache) _diskCache.set(DISK_KEY, shows);
  return shows;
}

/**
 * Generate slug guesses for direct API lookups.
 * NTS aliases follow patterns like "the-breakfast-show-flo", "morning-show-w-xxx", etc.
 */
function generateSlugGuesses(q) {
  const words = q.split(/\s+/).filter(Boolean);
  const slug = q.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const guesses = new Set();
  if (slug) guesses.add(slug);
  if (slug) guesses.add(`the-${slug}`);
  // Each word as a standalone slug (e.g. "breakfast" from "breakfast show flo")
  for (const w of words) {
    const ws = w.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (ws.length >= 3) guesses.add(ws);
  }
  if (words.length >= 2) {
    // Consecutive pairs/triples
    for (let i = 0; i < words.length - 1; i++) {
      guesses.add(words.slice(i, i + 2).join("-"));
      guesses.add("the-" + words.slice(i, i + 2).join("-"));
      if (i < words.length - 2) {
        guesses.add(words.slice(i, i + 3).join("-"));
        guesses.add("the-" + words.slice(i, i + 3).join("-"));
      }
    }
    guesses.add("the-" + words.join("-"));
    // NTS often uses "w/" in names → "w-" in slugs (e.g. "the-breakfast-show-w-flo")
    if (words.length >= 2) {
      const last = words[words.length - 1];
      const rest = words.slice(0, -1).join("-");
      guesses.add(`${rest}-w-${last}`);
      guesses.add(`the-${rest}-w-${last}`);
      // Also try "with" variant
      guesses.add(`${rest}-with-${last}`);
      guesses.add(`the-${rest}-with-${last}`);
    }
    // Drop each word and try the rest (handles extra words in query)
    if (words.length >= 3) {
      for (let i = 0; i < words.length; i++) {
        const without = words.filter((_, j) => j !== i).join("-");
        guesses.add(without);
        guesses.add("the-" + without);
      }
    }
  }
  return [...guesses].filter(Boolean);
}

/**
 * Search NTS programs.
 * @param {string} query - search text
 * @param {{ sort?: "recent" | "az" | "za" }} [options]
 *   sort "recent" (default) = shows with most recent episodes first (via /latest order + API).
 *   sort "az" / "za" = alphabetical.
 */
async function searchNtsPrograms(query, options) {
  const q = cleanText(query || "").toLowerCase();
  const sort = (options?.sort || "recent").toLowerCase();

  // Parallel: start slug guessing early alongside the index build.
  // The NTS API only returns ~1008 of ~1700 shows per paginated listing,
  // so many valid shows won't be in the index. Direct alias lookups fill the gap.
  const slugGuessPromise = q
    ? (async () => {
        const guesses = generateSlugGuesses(q);
        const results = await Promise.all(guesses.map((g) => fetchNtsShowFromApi(g).catch(() => null)));
        return results.filter((s) => s && s.show_alias);
      })()
    : Promise.resolve([]);

  // Build a unified index: full API catalogue + /latest episode discovery
  const [allShows, latestEpisodes, directHits] = await Promise.all([
    fetchAllNtsShows(true),
    fetchLatestEpisodes(true).then((e) => e.length ? e : fetchLatestEpisodes(false)).catch(() => []),
    slugGuessPromise
  ]);

  // Build a map with recency ranking from /latest
  const byAlias = new Map();
  // Seed direct hits first (most relevant)
  for (const show of directHits) {
    const alias = show.show_alias;
    if (alias && !byAlias.has(alias)) {
      byAlias.set(alias, {
        alias,
        name: (show.name || "").toLowerCase(),
        desc: (show.description || "").toLowerCase(),
        recentRank: -1 // prioritise direct hits
      });
    }
  }
  // Seed with /latest order (most recent first → lowest rank number = most recent)
  let rank = 0;
  for (const ep of latestEpisodes) {
    const slug = ep.showSlug || (ep.showUrl || "").split("/shows/")[1] || "";
    if (!slug) continue;
    if (!byAlias.has(slug)) {
      byAlias.set(slug, {
        alias: slug,
        name: (ep.title || slug.replace(/-/g, " ")).toLowerCase(),
        desc: "",
        recentRank: rank++
      });
    }
  }
  // Merge in full API shows (those not in /latest get a high rank = less recent)
  for (const s of allShows) {
    if (!byAlias.has(s.alias)) {
      byAlias.set(s.alias, { ...s, recentRank: 99999 });
    } else {
      // Enrich name/desc from API if richer
      const existing = byAlias.get(s.alias);
      if (!existing.desc && s.desc) existing.desc = s.desc;
      if (existing.name.length < s.name.length) existing.name = s.name;
    }
  }

  let matched = [...byAlias.values()];

  // Filter by query — all query words must appear in the combined text
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    matched = matched.filter((s) => {
      const combined = [s.alias.replace(/-/g, " "), s.name, s.desc].join(" ");
      return words.every((w) => combined.includes(w));
    });
  }

  // Sort
  if (sort === "az") {
    matched.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "za") {
    matched.sort((a, b) => b.name.localeCompare(a.name));
  } else {
    // "recent" — direct hits first, then shows with recent episodes, then alphabetical
    matched.sort((a, b) => a.recentRank - b.recentRank || a.name.localeCompare(b.name));
  }

  if (!matched.length) return [];

  const results = await Promise.all(
    matched.slice(0, 30).map((s) => getNtsProgramSummary(`${BASE_URL}/shows/${s.alias}`))
  );
  return results;
}

/** Fetch tracklist from NTS API (preferred) with HTML fallback. */
async function getNtsEpisodePlaylist(episodeUrl) {
  const url = normalizeEpisodeUrl(episodeUrl);
  if (!url) return { episodeUrl: "", tracks: [] };
  // Try API tracklist first: /api/v2/shows/{show}/episodes/{episode}/tracklist
  const pathMatch = url.match(/\/shows\/([^/]+)\/episodes\/([^/?#]+)/);
  if (pathMatch) {
    try {
      const apiUrl = `${NTS_API_BASE}/shows/${encodeURIComponent(pathMatch[1])}/episodes/${encodeURIComponent(pathMatch[2])}/tracklist`;
      const data = await fetchJson(apiUrl);
      const apiTracks = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      if (apiTracks.length > 0) {
        const tracks = apiTracks.map((t) => ({
          title: cleanText(t.title || "Unknown"),
          artist: cleanText(t.artist || ""),
          image: "",
          startSeconds: t.offset != null ? Number(t.offset) : (t.offset_estimate != null ? Number(t.offset_estimate) : undefined)
        }));
        return { episodeUrl: url, tracks };
      }
    } catch {}
  }
  // Fallback to HTML scraping
  const html = await fetchText(url);
  const tracklist = parseTracklistFromEpisodeHtml(html);
  const tracks = tracklistToPlaylistTracks(tracklist);
  return { episodeUrl: url, tracks };
}

function normalizeNtsProgramUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Show URL or slug is required.");
  if (/nts\.live\/shows\//i.test(raw)) return normalizeShowUrl(raw);
  if (!raw.startsWith("http")) return `${BASE_URL}/shows/${raw.replace(/^\//, "")}`;
  return raw;
}

const liveNowCache = { nts1: null, nts2: null, fetchedAt: 0, TTL_MS: 1000 * 60 * 2 };

/** Get current show info for NTS 1 or NTS 2 (artwork + title + description), like RTE getLiveStationNow. */
async function getNtsLiveNow(channelId) {
  const id = String(channelId || "").toLowerCase();
  const channelIndex = id === "nts2" ? 1 : 0;
  const station = LIVE_STATIONS[channelIndex];
  const stationName = station ? station.name : id === "nts2" ? "NTS 2" : "NTS 1";

  const now = Date.now();
  if (liveNowCache.fetchedAt && now - liveNowCache.fetchedAt < liveNowCache.TTL_MS) {
    const cached = liveNowCache[id === "nts2" ? "nts2" : "nts1"];
    if (cached) return cached;
  }

  let programmeName = "Live";
  let description = "";
  let image = "";
  let location = "";
  let timeSlot = "";
  let startTimestamp = null;
  let endTimestamp = null;

  try {
    const apiUrl = `${BASE_URL}/api/v2/live`;
    try {
      const api = await fetchJson(apiUrl);
      const results = Array.isArray(api?.results) ? api.results : [];
      const channelData = results[channelIndex] || results.find((r) => String(r?.channel_name || "") === (channelIndex === 0 ? "1" : "2"));
      const now = channelData?.now;
      const details = now?.embeds?.details;
      if (now) {
        programmeName = cleanText(now.broadcast_title || details?.name || programmeName);
        if (details) {
          description = cleanText(details.description || description);
          location = cleanText(details.location_long || details.location_short || "") || location;
          const media = details.media;
          if (media && (media.picture_medium || media.picture_large || media.background_medium)) {
            image = media.picture_medium || media.picture_large || media.background_medium || image;
          }
        }
        if (now.start_timestamp && now.end_timestamp) {
          startTimestamp = now.start_timestamp;
          endTimestamp = now.end_timestamp;
          const start = new Date(now.start_timestamp);
          const end = new Date(now.end_timestamp);
          const fmt = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
          timeSlot = `${fmt(start)} – ${fmt(end)}`;
        }
      }
    } catch (_) {}

    let html = "";
    if (!image || !programmeName || programmeName === "Live") {
      try {
        html = await fetchText(BASE_URL + "/");
      } catch (_) {}
    }
    const tryNextData = (pageHtml) => {
      const nextDataMatch = pageHtml.match(/<script\s+id=["']__NEXT_DATA__["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
      if (!nextDataMatch || !nextDataMatch[1]) return false;
      try {
        const data = JSON.parse(nextDataMatch[1]);
        const props = data?.props?.pageProps || {};
        let live = props?.live || props?.liveChannels || props?.channels;
        if (!live && props?.dehydratedState?.queries) {
          const queries = props.dehydratedState.queries;
          const liveQuery = Array.isArray(queries) && queries.find((q) => (q?.queryKey?.[0] === "live" || (q?.queryKey && String(q.queryKey[0]).toLowerCase().includes("live"))) && q?.state?.data);
          if (liveQuery?.state?.data) live = Array.isArray(liveQuery.state.data) ? liveQuery.state.data : liveQuery.state.data.channels || liveQuery.state.data;
        }
        const list = Array.isArray(live) ? live : (live && live.channels ? live.channels : live ? [live] : []);
        const channel = list[channelIndex] || list.find((c) => (c.channel || c.id || "").toString() === id || (channelIndex === 0 && !c.channel));
        if (channel) {
          programmeName = cleanText(channel.title || channel.programmeName || channel.name || programmeName);
          description = cleanText(channel.description || channel.subtitle || description);
          image = channel.image || channel.artwork || channel.coverImage || channel.thumbnail || image;
          if (image && !image.startsWith("http")) image = image.startsWith("//") ? "https:" + image : BASE_URL + (image.startsWith("/") ? image : "/" + image);
          location = cleanText(channel.location || channel.city || channel.venue || "") || location;
          timeSlot = cleanText(channel.timeSlot || channel.schedule || channel.time || "") || timeSlot;
          return true;
        }
      } catch {}
      return false;
    };
    tryNextData(html);
    if ((!programmeName || programmeName === "Live" || !image) && html) {
      try {
        const radioHtml = await fetchText(BASE_URL + "/radio");
        if (radioHtml) tryNextData(radioHtml);
      } catch {}
    }

    if (!image) {
      const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogImage && ogImage[1]) {
        const src = cleanText(ogImage[1]);
        if (src) image = src.startsWith("http") ? src : (src.startsWith("//") ? "https:" + src : BASE_URL + (src.startsWith("/") ? src : "/" + src));
      }
    }
    if (!programmeName || programmeName === "Live") {
      const sectionPattern = channelIndex === 0
        ? /(?:live\s+now|channel\s+1)[\s\S]{0,800}?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
        : /(?:channel\s+2|nts\s+2)[\s\S]{0,800}?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      const sectionMatch = sectionPattern.exec(html);
      if (sectionMatch && sectionMatch[2]) {
        const rawTitle = cleanText(stripHtml(sectionMatch[2])).slice(0, 200);
        if (rawTitle && !/^(next on|schedule|follow|listen|\d+)$/i.test(rawTitle)) {
          programmeName = rawTitle;
        }
      }
      const imgPattern = /<img[^>]+src=["']([^"']+(?:artwork|cover|show|episode)[^"']*)["']/gi;
      let imgMatch;
      const imgMatches = [];
      while ((imgMatch = imgPattern.exec(html)) !== null) imgMatches.push(imgMatch[1]);
      if (!image && imgMatches[channelIndex]) {
        const src = imgMatches[channelIndex];
        image = src.startsWith("http") ? src : (src.startsWith("//") ? "https:" + src : BASE_URL + (src.startsWith("/") ? src : "/" + src));
      }
    }
    if (!image) {
      const firstImg = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
      if (firstImg && firstImg[1] && !/avatar|logo|icon|favicon/i.test(firstImg[1])) {
        image = firstImg[1];
      }
    }

    const result = {
      channelId: id,
      stationName,
      programmeName: programmeName || "Live",
      description: description || "",
      image: image || "",
      location: location || "",
      timeSlot: timeSlot || "",
      startTimestamp: startTimestamp || undefined,
      endTimestamp: endTimestamp || undefined
    };
    liveNowCache[id === "nts2" ? "nts2" : "nts1"] = result;
    liveNowCache.fetchedAt = now;
    return result;
  } catch (_e) {
    return {
      channelId: id,
      stationName,
      programmeName: "Live",
      description: "",
      image: "",
      location: "",
      timeSlot: "",
      startTimestamp: undefined,
      endTimestamp: undefined
    };
  }
}

async function getNtsDiscovery(count = 5) {
  const shows = await fetchAllNtsShows(true).catch(() => []);
  const shuffled = [...shows].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, Math.min(count * 2, shuffled.length));
  const results = [];
  const concurrency = 4;
  let idx = 0;
  async function worker() {
    while (idx < sample.length && results.length < count) {
      const s = sample[idx++];
      const url = `${BASE_URL}/shows/${s.alias}`;
      try {
        const meta = await getNtsProgramSummary(url);
        if (meta && meta.title) results.push(meta);
      } catch { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sample.length) }, () => worker()));
  return results.slice(0, count);
}

module.exports = {
  BASE_URL,
  LIVE_STATIONS,
  getNtsEpisodeInfo,
  getNtsProgramSummary,
  getNtsProgramEpisodes,
  searchNtsPrograms,
  getNtsEpisodePlaylist,
  getNtsLiveNow,
  getNtsDiscovery,
  normalizeNtsProgramUrl,
  normalizeShowUrl,
  normalizeEpisodeUrl,
  parseTracklistFromEpisodeHtml,
  parseDateNts,
  generateSlugGuesses,
  parseNtsTimeslot,
  configure
};
