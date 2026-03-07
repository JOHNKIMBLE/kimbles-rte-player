const BBC_LIVE_STATIONS_FALLBACK = [
  { id: "bbc_radio_one", name: "BBC Radio 1", liveUrl: "https://www.bbc.co.uk/sounds/play/live:bbc_radio_one" },
  { id: "bbc_radio_two", name: "BBC Radio 2", liveUrl: "https://www.bbc.co.uk/sounds/play/live:bbc_radio_two" },
  { id: "bbc_radio_three", name: "BBC Radio 3", liveUrl: "https://www.bbc.co.uk/sounds/play/live:bbc_radio_three" },
  { id: "bbc_radio_five_live", name: "BBC Radio 5 Live", liveUrl: "https://www.bbc.co.uk/sounds/play/live:bbc_radio_five_live" },
  { id: "bbc_6music", name: "BBC Radio 6 Music", liveUrl: "https://www.bbc.co.uk/sounds/play/live:bbc_6music" },
  { id: "bbc_1xtra", name: "BBC Radio 1Xtra", liveUrl: "https://www.bbc.co.uk/sounds/play/live:bbc_1xtra" },
  { id: "bbc_asian_network", name: "BBC Asian Network", liveUrl: "https://www.bbc.co.uk/sounds/play/live:bbc_asian_network" }
];
const DISABLED_BBC_STATION_IDS = new Set(["bbc_5live_sportsextra", "bbc_radio_fourfm", "bbc_world_service"]);
const bbcEpisodeDateCache = new Map();
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function decodeHtml(input) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(input) {
  return decodeHtml(String(input || "")).replace(/\s+/g, " ").trim();
}

function normalizeBbcUrl(inputUrl) {
  const parsed = new URL(String(inputUrl || "").trim());
  if (!/bbc\./i.test(parsed.hostname)) {
    throw new Error("Expected a BBC URL.");
  }
  parsed.hash = "";
  return parsed.toString();
}

function normalizeBbcProgramUrl(inputUrl) {
  const parsed = new URL(String(inputUrl || "").trim());
  if (!/bbc\./i.test(parsed.hostname)) {
    throw new Error("Expected a BBC program URL.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] === "programmes" && parts[1]) {
    return `https://www.bbc.co.uk/programmes/${parts[1]}`;
  }
  if (parts[0] === "sounds" && parts[1] === "brand" && parts[2]) {
    return `https://www.bbc.co.uk/programmes/${parts[2]}`;
  }

  throw new Error("Expected a BBC programme URL like /programmes/<pid> or /sounds/brand/<id>.");
}

function toProgramEpisodesUrl(programUrl) {
  if (/\/programmes\/[a-z0-9]+$/i.test(programUrl)) {
    return `${programUrl}/episodes/player`;
  }
  return programUrl;
}

function pickEpisodeUrl(entry) {
  const direct = String(entry?.webpage_url || entry?.url || "").trim();
  if (!direct) {
    return "";
  }
  if (/^https?:\/\//i.test(direct)) {
    return direct;
  }
  if (entry?.id) {
    return `https://www.bbc.co.uk/sounds/play/${entry.id}`;
  }
  return "";
}

function inferCadence(episodes) {
  const times = episodes
    .map((item) => new Date(item.publishedTime || "").getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);

  if (times.length < 3) {
    return {
      cadence: "unknown",
      averageDaysBetween: null
    };
  }

  const dayDiffs = [];
  for (let i = 0; i < Math.min(times.length - 1, 8); i += 1) {
    const diffDays = Math.abs(times[i] - times[i + 1]) / (1000 * 60 * 60 * 24);
    dayDiffs.push(diffDays);
  }

  const average = dayDiffs.reduce((sum, value) => sum + value, 0) / dayDiffs.length;
  if (average <= 2) {
    return { cadence: "daily", averageDaysBetween: Number(average.toFixed(2)) };
  }
  if (average <= 9) {
    return { cadence: "weekly", averageDaysBetween: Number(average.toFixed(2)) };
  }
  return { cadence: "irregular", averageDaysBetween: Number(average.toFixed(2)) };
}

function mapEpisode(entry, index) {
  const episodeUrl = pickEpisodeUrl(entry);
  const canonicalEpisodeUrl = entry?.id ? `https://www.bbc.co.uk/programmes/${entry.id}` : episodeUrl;
  const title = cleanText(entry?.title || entry?.track || entry?.id || `Episode ${index + 1}`);
  const uploadDate = String(entry?.upload_date || "").trim();
  const published = uploadDate.match(/^\d{8}$/)
    ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`
    : "";
  const durationSeconds = Number(entry?.duration || 0) || null;
  const clipId = String(entry?.id || `${index}`).trim();

  return {
    clipId,
    id: clipId,
    title,
    description: cleanText(entry?.description || entry?.alt_title || ""),
    episodeUrl: canonicalEpisodeUrl,
    downloadUrl: canonicalEpisodeUrl,
    publishedTime: published,
    durationSeconds,
    image: normalizeImageUrl(cleanText(entry?.thumbnail || entry?.thumbnails?.[0]?.url || ""))
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load BBC page: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load BBC JSON: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function stripTags(input) {
  return cleanText(decodeHtml(String(input || "").replace(/<[^>]+>/g, " ")));
}

function parsePublishedDateIso(input) {
  const text = cleanText(input || "");
  if (!text) {
    return "";
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch?.[1]) {
    return isoMatch[1];
  }

  const wordsMatch = text.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/);
  if (wordsMatch?.[1]) {
    const parsed = new Date(`${wordsMatch[1]} 00:00:00 UTC`);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  return "";
}

function toIsoDateFromUnknown(input) {
  const iso = parsePublishedDateIso(input);
  return iso || "";
}

async function fetchBbcEpisodeFirstBroadcastDate(pid) {
  const key = String(pid || "").trim().toLowerCase();
  if (!key) {
    return "";
  }
  if (bbcEpisodeDateCache.has(key)) {
    return bbcEpisodeDateCache.get(key);
  }

  try {
    const payload = await fetchJson(`https://www.bbc.co.uk/programmes/${encodeURIComponent(key)}.json`);
    const first = String(payload?.programme?.first_broadcast_date || "");
    const iso = /^\d{4}-\d{2}-\d{2}/.test(first)
      ? first.slice(0, 10)
      : toIsoDateFromUnknown(first);
    bbcEpisodeDateCache.set(key, iso);
    return iso;
  } catch {
    bbcEpisodeDateCache.set(key, "");
    return "";
  }
}

async function enrichEpisodeDates(episodes) {
  const work = (episodes || [])
    .map((episode) => ({ ...episode }))
    .filter((episode) => episode.clipId);

  if (!work.length) {
    return work;
  }

  const queue = work.slice();
  const out = [];
  const concurrency = 4;

  async function worker() {
    while (queue.length) {
      const episode = queue.shift();
      if (!episode) {
        continue;
      }
      const iso = await fetchBbcEpisodeFirstBroadcastDate(episode.clipId);
      if (!iso) {
        out.push(episode);
        continue;
      }
      out.push({
        ...episode,
        publishedTime: iso
      });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  return out;
}

function parseEpisodesFromPlayerHtml(html) {
  const seen = new Set();
  const episodes = [];
  const startPattern = /<div class="programme programme--radio programme--episode[^>]*data-pid=["'][a-z0-9]{8}["'][^>]*>/gi;
  const starts = Array.from(html.matchAll(startPattern)).map((match) => match.index).filter((idx) => Number.isInteger(idx));

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : html.length;
    const card = String(html.slice(start, end));
    const idMatch = card.match(/data-pid=["']([a-z0-9]{8})["']/i)
      || card.match(/href=["']https?:\/\/www\.bbc\.co\.uk\/programmes\/([a-z0-9]{8})["']/i)
      || card.match(/href=["']\/programmes\/([a-z0-9]{8})["']/i);
    if (!idMatch?.[1]) {
      continue;
    }

    const id = String(idMatch[1]).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);

    const titleMatch = card.match(/<span class="programme__title[^"]*">\s*<span>([\s\S]*?)<\/span>\s*<\/span>/i);
    const synopsisMatch = card.match(/<p class="programme__synopsis[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    const imageMatch = card.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
    const ctaHrefMatch = card.match(/<div class="cta cta__overlay">[\s\S]*?href=["'](https?:\/\/www\.bbc\.co\.uk\/sounds\/play\/[a-z0-9]+)["']/i);
    const ctaTitleMatch = card.match(/<div class="cta cta__overlay">[\s\S]*?title=["']([^"']+)["']/i);
    const ariaLabelMatch = card.match(/aria-label=["']([^"']+)["']/i);
    const contentDateMatch = card.match(/content=["'](\d{4}-\d{2}-\d{2})T/i);
    const dateTitleAttrMatch = card.match(/<div class="broadcast-event__time[^>]*title=["']([^"']+)["']/i);
    const title = stripTags(titleMatch?.[1] || "");
    const description = stripTags(synopsisMatch?.[1] || "");
    const ctaTitle = stripTags(ctaTitleMatch?.[1] || "");
    const ariaLabel = stripTags(ariaLabelMatch?.[1] || "");
    const dateTitle = stripTags(dateTitleAttrMatch?.[1] || "");
    const publishedTime = parsePublishedDateIso(contentDateMatch?.[1] || "")
      || parsePublishedDateIso(ctaTitle)
      || parsePublishedDateIso(ariaLabel)
      || parsePublishedDateIso(dateTitle);

    episodes.push({
      clipId: id,
      id,
      title: title || `Episode ${episodes.length + 1}`,
      description,
      episodeUrl: `https://www.bbc.co.uk/programmes/${id}`,
      downloadUrl: `https://www.bbc.co.uk/programmes/${id}`,
      publishedTime,
      durationSeconds: null,
      hasPlayableAudio: Boolean(ctaHrefMatch?.[1]),
      image: normalizeImageUrl(imageMatch?.[1] || "")
    });
  }

  const playable = episodes.filter((episode) => episode.hasPlayableAudio);
  const selected = playable.length ? playable : episodes;
  return selected.map((episode) => {
    const copy = { ...episode };
    delete copy.hasPlayableAudio;
    return copy;
  });
}

function parseBbcMusicTracksFromEpisodeHtml(html) {
  const tracks = [];
  const listPattern = /<li class="segments-list__item[\s\S]*?<\/li>/gi;

  for (const match of html.matchAll(listPattern)) {
    const block = String(match[0] || "");
    const artistMatches = Array.from(block.matchAll(/<span class="artist">([\s\S]*?)<\/span>/gi));
    const artists = artistMatches.map((item) => stripTags(item[1])).filter(Boolean);
    const titleMatch = block.match(/<div class="segment__track">[\s\S]*?<p class="no-margin">[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    const imageMatch = block.match(/data-src="([^"]+)"/i) || block.match(/src="([^"]+)"/i);

    const title = stripTags(titleMatch?.[1] || "");
    if (!title && !artists.length) {
      continue;
    }

    tracks.push({
      title: title || "Unknown track",
      artist: artists.join(", "),
      image: imageMatch?.[1] || ""
    });
  }

  return tracks;
}

function parseMetaContent(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return cleanText(decodeHtml(match[1]));
    }
  }
  return "";
}

function normalizeImageUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `https://www.bbc.co.uk${raw}`;
  }
  return raw;
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const pattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = String(match[1] || "").trim();
    if (!raw) {
      continue;
    }
    try {
      blocks.push(JSON.parse(raw));
    } catch {}
  }
  return blocks;
}

function toDublinDate(value) {
  const source = String(value || "").trim();
  if (!source) {
    return null;
  }
  const date = new Date(source);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date;
}

function toDublinDayAndTime(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const dayName = String(parts.find((item) => item.type === "weekday")?.value || "").slice(0, 3);
  const hour = parts.find((item) => item.type === "hour")?.value || "00";
  const minute = parts.find((item) => item.type === "minute")?.value || "00";
  const dayIndex = DAY_NAMES_SHORT.findIndex((entry) => entry.toLowerCase() === dayName.toLowerCase());
  return {
    dayIndex: dayIndex >= 0 ? dayIndex : 0,
    hhmm: `${hour}:${minute}`
  };
}

function formatDayGroup(days) {
  const uniqueSorted = Array.from(new Set(days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort((a, b) => a - b);
  if (!uniqueSorted.length) {
    return "";
  }
  if (uniqueSorted.length === 1) {
    return DAY_NAMES_SHORT[uniqueSorted[0]];
  }
  let isContiguous = true;
  for (let i = 1; i < uniqueSorted.length; i += 1) {
    if (uniqueSorted[i] !== uniqueSorted[i - 1] + 1) {
      isContiguous = false;
      break;
    }
  }
  if (isContiguous && uniqueSorted.length >= 2) {
    return `${DAY_NAMES_SHORT[uniqueSorted[0]]} - ${DAY_NAMES_SHORT[uniqueSorted[uniqueSorted.length - 1]]}`;
  }
  return uniqueSorted.map((day) => DAY_NAMES_SHORT[day]).join(", ");
}

function formatDublinDateTime(iso) {
  const date = toDublinDate(iso);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function buildRunScheduleFromBroadcasts(broadcasts) {
  const groups = new Map();

  for (const item of broadcasts) {
    const start = toDublinDate(item.startDate);
    const end = toDublinDate(item.endDate);
    if (!start || !end) {
      continue;
    }

    const startInfo = toDublinDayAndTime(start);
    const endInfo = toDublinDayAndTime(end);
    const key = `${startInfo.hhmm}-${endInfo.hhmm}`;
    if (!groups.has(key)) {
      groups.set(key, { start: startInfo.hhmm, end: endInfo.hhmm, days: [] });
    }
    groups.get(key).days.push(startInfo.dayIndex);
  }

  const segments = Array.from(groups.values())
    .map((group) => {
      const dayExpr = formatDayGroup(group.days);
      if (!dayExpr) {
        return "";
      }
      return `${dayExpr} • ${group.start} - ${group.end}`;
    })
    .filter(Boolean);

  return segments.join(", ");
}

function extractUpcomingBroadcastsFromJsonLd(html) {
  const blocks = extractJsonLdBlocks(html);
  const broadcasts = [];

  for (const block of blocks) {
    const root = Array.isArray(block) ? block : [block];
    for (const entry of root) {
      const episodes = Array.isArray(entry?.episode) ? entry.episode : [];
      for (const episode of episodes) {
        const publication = episode?.publication || {};
        const startDate = String(publication?.startDate || "").trim();
        const endDate = String(publication?.endDate || "").trim();
        if (!startDate || !endDate) {
          continue;
        }
        broadcasts.push({
          pid: String(episode?.identifier || "").trim(),
          title: cleanText(episode?.name || ""),
          startDate,
          endDate,
          datePublished: String(episode?.datePublished || "").trim(),
          url: String(episode?.url || "").trim()
        });
      }
    }
  }

  return broadcasts
    .filter((item) => item.startDate && item.endDate)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

async function getBbcUpcomingSchedule(programUrl) {
  const normalizedUrl = normalizeBbcProgramUrl(programUrl);
  const upcomingUrl = `${normalizedUrl}/broadcasts/upcoming`;
  let html = "";

  try {
    html = await fetchText(upcomingUrl);
  } catch {
    return {
      runSchedule: "",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    };
  }

  const broadcasts = extractUpcomingBroadcastsFromJsonLd(html);
  if (!broadcasts.length) {
    return {
      runSchedule: "",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    };
  }

  const runSchedule = buildRunScheduleFromBroadcasts(broadcasts);
  const now = Date.now();
  const next = broadcasts.find((item) => {
    const ts = Date.parse(item.startDate);
    return Number.isFinite(ts) && ts >= now - 1000 * 60 * 60;
  }) || broadcasts[0];

  return {
    runSchedule,
    nextBroadcastAt: formatDublinDateTime(next?.startDate || ""),
    nextBroadcastTitle: cleanText(next?.title || "")
  };
}

async function getBbcProgramSummary(programUrl, runYtDlpJson, options = {}) {
  const includeSchedule = options.includeSchedule !== false;
  const normalizedUrl = normalizeBbcProgramUrl(programUrl);
  let title = "";
  let description = "";
  let image = "";

  try {
    const html = await fetchText(normalizedUrl);
    title = parseMetaContent(html, [
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i,
      /<title>([^<]+)<\/title>/i
    ]);
    description = parseMetaContent(html, [
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    ]);
    image = parseMetaContent(html, [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i
    ]);
  } catch {
    title = "";
    description = "";
    image = "";
  }

  if ((!title || !description || !image) && typeof runYtDlpJson === "function") {
    try {
      const json = await runYtDlpJson({
        url: toProgramEpisodesUrl(normalizedUrl),
        args: ["--flat-playlist", "--dump-single-json", "--no-warnings"]
      });
      if (!title) {
        title = cleanText(json?.title || "");
      }
      if (!description) {
        description = cleanText(json?.description || "");
      }
      if (!image) {
        image = cleanText(json?.thumbnail || "");
      }
    } catch {}
  }

  const schedule = includeSchedule
    ? await getBbcUpcomingSchedule(normalizedUrl)
    : { runSchedule: "", nextBroadcastAt: "", nextBroadcastTitle: "" };

  return {
    source: "bbc",
    programUrl: normalizedUrl,
    title: title || "BBC Program",
    description: description || "",
    image: normalizeImageUrl(image),
    runSchedule: schedule.runSchedule || "",
    nextBroadcastAt: schedule.nextBroadcastAt || "",
    nextBroadcastTitle: schedule.nextBroadcastTitle || ""
  };
}

function normalizeStationName(entry) {
  return cleanText(entry?.title || entry?.channel || entry?.id || "");
}

function toStationId(entry) {
  const liveUrl = String(entry?.webpage_url || entry?.url || "").trim();
  const byUrl = liveUrl.match(/live:([a-z0-9_]+)/i)?.[1] || "";
  if (byUrl) {
    return byUrl;
  }
  return String(entry?.id || "").trim();
}

function toStationUrl(entry, stationId) {
  const direct = String(entry?.webpage_url || entry?.url || "").trim();
  if (direct && /^https?:\/\//i.test(direct)) {
    return direct;
  }
  if (stationId) {
    return `https://www.bbc.co.uk/sounds/play/live:${stationId}`;
  }
  return "";
}

async function getBbcLiveStations(runYtDlpJson) {
  if (typeof runYtDlpJson !== "function") {
    return BBC_LIVE_STATIONS_FALLBACK;
  }

  try {
    const payload = await runYtDlpJson({
      url: "https://www.bbc.co.uk/sounds/play/live",
      args: ["--flat-playlist", "--dump-single-json", "--no-warnings"]
    });

    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    const stations = entries
      .map((entry) => {
        const id = toStationId(entry);
        return {
          id,
          name: normalizeStationName(entry),
          liveUrl: toStationUrl(entry, id)
        };
      })
      .filter((item) => item.id && item.name && item.liveUrl)
      .filter((item) => !DISABLED_BBC_STATION_IDS.has(item.id))
      .sort((a, b) => a.name.localeCompare(b.name, "en"))
      .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);

    return stations.length ? stations : BBC_LIVE_STATIONS_FALLBACK;
  } catch {
    return BBC_LIVE_STATIONS_FALLBACK;
  }
}

async function searchBbcPrograms(query, runYtDlpJson) {
  const q = cleanText(query || "");
  if (q.length < 2) {
    return [];
  }

  const searchUrl = `https://www.bbc.co.uk/search?q=${encodeURIComponent(q)}`;
  const html = await fetchText(searchUrl);
  const seen = new Set();
  const urls = [];
  const pattern = /href=["'](\/programmes\/[a-z0-9]{8}(?:\/episodes\/player)?|\/sounds\/brand\/[a-z0-9]+|https?:\/\/www\.bbc\.co\.uk\/programmes\/[a-z0-9]{8}(?:\/episodes\/player)?|https?:\/\/www\.bbc\.co\.uk\/sounds\/brand\/[a-z0-9]+)["']/gi;

  for (const match of html.matchAll(pattern)) {
    const href = String(match[1] || "").trim();
    if (!href) {
      continue;
    }
    const absolute = href.startsWith("http") ? href : `https://www.bbc.co.uk${href}`;
    let normalized;
    try {
      normalized = normalizeBbcProgramUrl(absolute);
    } catch {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    urls.push(normalized);
    if (urls.length >= 25) {
      break;
    }
  }

  const summaries = await Promise.all(urls.map(async (programUrl) => {
    try {
      return await getBbcProgramSummary(programUrl, runYtDlpJson, { includeSchedule: false });
    } catch {
      return {
        source: "bbc",
        programUrl,
        title: programUrl.split("/").pop() || "BBC Program",
        description: "",
        image: "",
        runSchedule: "",
        nextBroadcastAt: "",
        nextBroadcastTitle: ""
      };
    }
  }));

  return summaries.sort((a, b) => String(a.title).localeCompare(String(b.title), "en"));
}

async function getBbcProgramEpisodes(programUrl, runYtDlpJson, page = 1) {
  const normalizedProgramUrl = normalizeBbcProgramUrl(programUrl);
  const listUrl = toProgramEpisodesUrl(normalizedProgramUrl);
  let payload = {};
  let mapped = [];

  if (/\/programmes\/[a-z0-9]+\/episodes\/player$/i.test(listUrl)) {
    const html = await fetchText(listUrl);
    mapped = parseEpisodesFromPlayerHtml(html);
  }

  if (!mapped.length) {
    try {
      payload = await runYtDlpJson({
        url: listUrl,
        args: ["--dump-single-json", "--no-warnings"]
      });

      const rawEntries = Array.isArray(payload?.entries) ? payload.entries : [];
      mapped = rawEntries
        .map((entry, index) => mapEpisode(entry, index))
        .filter((item) => item.episodeUrl && item.clipId);
    } catch {
      payload = {};
    }
  }

  if (!mapped.length) {
    const html = await fetchText(listUrl);
    mapped = parseEpisodesFromPlayerHtml(html);
  }

  if (!mapped.length) {
    throw new Error("No BBC episodes were found for this program.");
  }

  mapped = await enrichEpisodeDates(mapped);
  const todayIso = new Date().toISOString().slice(0, 10);
  const nonFuture = mapped.filter((episode) => {
    const published = String(episode.publishedTime || "").trim();
    return !published || published <= todayIso;
  });
  if (nonFuture.length) {
    mapped = nonFuture;
  }
  mapped = mapped
    .map((episode, index) => ({ ...episode, _idx: index }))
    .sort((a, b) => {
      const aDate = String(a.publishedTime || "");
      const bDate = String(b.publishedTime || "");
      if (aDate && bDate && aDate !== bDate) {
        return aDate > bDate ? -1 : 1;
      }
      if (aDate && !bDate) {
        return -1;
      }
      if (!aDate && bDate) {
        return 1;
      }
      return a._idx - b._idx;
    })
    .map((episode) => {
      const copy = { ...episode };
      delete copy._idx;
      return copy;
    });

  const cadenceInfo = inferCadence(mapped);
  const summary = await getBbcProgramSummary(normalizedProgramUrl, runYtDlpJson);
  const safePage = Math.max(1, Number(page) || 1);
  return {
    source: "bbc",
    programUrl: normalizedProgramUrl,
    title: summary.title || cleanText(payload?.title || "BBC Program"),
    description: summary.description || cleanText(payload?.description || ""),
    episodes: mapped,
    totalItems: mapped.length,
    page: safePage,
    numPages: 1,
    cadence: cadenceInfo.cadence,
    averageDaysBetween: cadenceInfo.averageDaysBetween,
    runSchedule: summary.runSchedule || "",
    nextBroadcastAt: summary.nextBroadcastAt || "",
    nextBroadcastTitle: summary.nextBroadcastTitle || ""
  };
}

async function getBbcEpisodePlaylist(episodeUrl) {
  const normalized = normalizeBbcUrl(episodeUrl);
  const html = await fetchText(normalized);
  const tracks = parseBbcMusicTracksFromEpisodeHtml(html);
  return {
    episodeUrl: normalized,
    tracks
  };
}

module.exports = {
  getBbcEpisodePlaylist,
  getBbcLiveStations,
  getBbcProgramEpisodes,
  getBbcProgramSummary,
  normalizeBbcProgramUrl,
  normalizeBbcUrl,
  searchBbcPrograms
};
