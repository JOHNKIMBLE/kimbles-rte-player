const LIVE_STATIONS = [
  { id: 1, slug: "2fm", name: "RTÉ 2FM", stationUrl: "https://www.rte.ie/radio/2fm/" },
  { id: 9, slug: "radio1", name: "RTÉ Radio 1", stationUrl: "https://www.rte.ie/radio/radio1/" },
  { id: 16, slug: "lyricfm", name: "RTÉ lyric fm", stationUrl: "https://www.rte.ie/radio/lyricfm/" },
  { id: 17, slug: "rnag", name: "RTÉ Raidió na Gaeltachta", stationUrl: "https://www.rte.ie/radio/rnag/" },
  { id: 18, slug: "2xm", name: "RTÉ 2XM", stationUrl: "https://www.rte.ie/radio/2xm/" },
  { id: 20, slug: "rtejrradio", name: "RTÉ Jr Radio", stationUrl: "https://www.rte.ie/radio/rtejrradio/" },
  { id: 22, slug: "gold", name: "RTÉ Gold", stationUrl: "https://www.rte.ie/radio/gold/" },
  { id: 23, slug: "pulse", name: "RTÉ Pulse", stationUrl: "https://www.rte.ie/radio/pulse/" },
  { id: 24, slug: "rte-radio-1-extra", name: "RTÉ Radio 1 Extra", stationUrl: "https://www.rte.ie/radio/rte-radio-1-extra/" }
];

const PROGRAM_SEARCH_STATIONS = ["2fm", "radio1", "lyricfm", "rnag"];

const programCache = {
  fetchedAt: 0,
  programs: []
};
const STATION_NAME_BY_SLUG = new Map(LIVE_STATIONS.map((station) => [station.slug, station.name]));
const programSummaryCache = new Map();
let _diskCache = null;
function configure({ diskCache } = {}) {
  _diskCache = diskCache || null;
}

const { cleanText, stripHtml, inferCadence } = require("./utils");
const { assertUrlHostSuffixes } = require("./url-safety");

function cleanTitle(title) {
  return cleanText(title).replace(/\s+-\s+[^-]+$/, "").trim();
}

function toAbsoluteRteUrl(inputUrl) {
  return new URL(inputUrl, "https://www.rte.ie").toString();
}

function findFirstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return cleanText(match[1]);
    }
  }
  return null;
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

function isLikelyRteHostName(value, programTitle = "") {
  const text = cleanText(stripHtml(value || ""));
  if (!text || text.length < 2 || text.length > 80) {
    return false;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(text)) {
    return false;
  }
  if (text.split(/\s+/g).length > 8) {
    return false;
  }
  if (/parent page|breadcrumb|cookie|privacy|javascript|share this|listen back|read more|skip to/i.test(text)) {
    return false;
  }
  if (/\bif\s*\(location\b/i.test(text) || /\blocation\b/i.test(text) && /\bhost\b/i.test(text)) {
    return false;
  }
  if (/^(rte|rté)\b/i.test(text)) {
    return false;
  }
  if (programTitle && cleanText(programTitle).toLowerCase() === text.toLowerCase()) {
    return false;
  }
  return true;
}

function inferRteHostsFromProgramTitle(title = "") {
  const text = cleanText(title || "");
  if (!text) {
    return [];
  }
  const match = text.match(/(?:with|w\/|hosted by|presented by)\s+(.+)$/i);
  if (!match?.[1]) {
    return [];
  }
  return uniqueCleanList(
    match[1]
      .split(/\s*(?:,|&| and )\s*/gi)
      .map((value) => cleanText(value))
      .filter((value) => isLikelyRteHostName(value, text))
  ).slice(0, 6);
}

function collectRtePeople(value, bucket) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRtePeople(entry, bucket));
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
      || value.alternateName
      || value.title
      || value.label
      || [value.givenName, value.familyName].filter(Boolean).join(" ")
    );
    if (directName) {
      bucket.push(directName);
      return;
    }
    for (const key of ["author", "creator", "contributor", "host", "presenter"]) {
      if (value[key]) {
        collectRtePeople(value[key], bucket);
      }
    }
  }
}

function extractRteHostsFromHtml(html, programTitle = "") {
  const hosts = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        collectRtePeople(item?.author, hosts);
        collectRtePeople(item?.creator, hosts);
        collectRtePeople(item?.contributor, hosts);
        collectRtePeople(item?.host, hosts);
      }
    } catch {}
  }

  const metaHosts = [
    findFirstMatch(html, [/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i]),
    findFirstMatch(html, [/<meta\s+name=["']DC\.creator["']\s+content=["']([^"']+)["']/i])
  ].filter(Boolean);
  hosts.push(...metaHosts);

  if (!hosts.length) {
    const labelMatch = html.match(/(?:Presented by|presented by|with)\s*<\/[^>]+>\s*<[^>]+>([^<]+)<\/[^>]+>/i)
      || html.match(/(?:Presented by|presented by|with)\s+([^<.,|]{2,80})/i);
    if (labelMatch?.[1]) {
      hosts.push(cleanText(labelMatch[1]));
    }
  }

  const filtered = uniqueCleanList(hosts)
    .filter((host) => isLikelyRteHostName(host, programTitle))
    .slice(0, 6);
  if (filtered.length) {
    return filtered;
  }
  return inferRteHostsFromProgramTitle(programTitle);
}

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

function buildProgramSearchText(item) {
  return [
    item.title,
    item.stationName,
    item.stationSlug,
    item.description,
    item.location,
    item.runSchedule,
    item.programUrl,
    ...(item.hosts || []),
    ...(item.genres || [])
  ]
    .map((value) => cleanText(value || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function scoreRteProgramResult(item, query) {
  if (!query) {
    return 0;
  }

  let score = 0;
  score += scoreTextMatch(item.title, query, 240, 185, 135);
  score += scoreTextMatch(item.stationName, query, 130, 95, 70);
  score += scoreTextMatch(item.stationSlug, query, 100, 80, 55);
  score += scoreTextMatch(item.location, query, 180, 145, 115);
  score += scoreTextMatch(item.description, query, 90, 0, 55);
  score += scoreTextMatch(item.programUrl, query, 30, 20, 15);
  score += scoreTextMatch(item.runSchedule, query, 25, 15, 10);
  score += scoreListMatch(item.hosts, query, 230, 190, 150);
  score += scoreListMatch(item.genres, query, 170, 140, 115);

  const tokens = query.split(/\s+/g).filter(Boolean);
  if (tokens.length > 1) {
    const searchText = buildProgramSearchText(item);
    if (tokens.every((token) => searchText.includes(token))) {
      score += 70;
    }
  }

  return score;
}

function getMetadataRichnessScore(item) {
  return [
    item.image ? 1 : 0,
    item.description ? 2 : 0,
    Array.isArray(item.hosts) ? Math.min(item.hosts.length, 3) * 2 : 0,
    Array.isArray(item.genres) ? Math.min(item.genres.length, 3) : 0,
    item.location ? 2 : 0,
    item.runSchedule ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function scoreDiscoveryNovelty(item, selected) {
  const seenHosts = new Set();
  const seenGenres = new Set();
  const seenStations = new Set();
  const seenLocations = new Set();

  for (const entry of selected || []) {
    for (const host of entry.hosts || []) {
      seenHosts.add(cleanText(host || "").toLowerCase());
    }
    for (const genre of entry.genres || []) {
      seenGenres.add(cleanText(genre || "").toLowerCase());
    }
    seenStations.add(cleanText(entry.stationSlug || entry.stationName || "").toLowerCase());
    seenLocations.add(cleanText(entry.location || "").toLowerCase());
  }

  let score = 0;
  const stationKey = cleanText(item.stationSlug || item.stationName || "").toLowerCase();
  const locationKey = cleanText(item.location || "").toLowerCase();
  if (stationKey && !seenStations.has(stationKey)) {
    score += 3;
  }
  if (locationKey && !seenLocations.has(locationKey)) {
    score += 3;
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

function pickDiscoveryResults(items, count) {
  const remaining = (items || [])
    .map((item) => ({
      item,
      richness: getMetadataRichnessScore(item) + Math.random()
    }))
    .sort((a, b) => b.richness - a.richness)
    .map((entry) => entry.item);

  const selected = [];
  while (remaining.length && selected.length < count) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const score = getMetadataRichnessScore(item) + scoreDiscoveryNovelty(item, selected) + Math.random();
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

function normalizeProgramUrl(inputUrl) {
  const parsed = new URL(inputUrl, "https://www.rte.ie");
  const parts = parsed.pathname.split("/").filter(Boolean);

  if (parts[0] !== "radio" || parts.length < 3) {
    throw new Error("Expected an RTÉ radio program URL under /radio/<station>/<program>/.");
  }

  return `https://www.rte.ie/radio/${parts[1]}/${parts[2]}/`;
}

function getEpisodesJsonUrl(programUrl, page = 1) {
  const root = normalizeProgramUrl(programUrl).replace(/\/+$/, "");
  return `${root}/episodes/json/?page=${encodeURIComponent(page)}`;
}

async function fetchText(url) {
  const safe = assertUrlHostSuffixes(url, ["rte.ie", "rasset.ie"], "RTÉ");
  const response = await fetch(safe, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load URL: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const safe = assertUrlHostSuffixes(url, ["rte.ie", "rasset.ie"], "RTÉ");
  const response = await fetch(safe, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getPlaylist(clipId) {
  const apiUrl = `https://www.rte.ie/rteavgen/getplaylist/?format=json&id=${encodeURIComponent(clipId)}`;
  const payload = await fetchJson(apiUrl);
  const show = payload?.shows?.[0];
  const mediaGroup = show?.["media:group"]?.[0];

  if (!mediaGroup?.hls_server || !mediaGroup?.hls_url) {
    throw new Error("Could not find HLS stream details in RTÉ playlist response.");
  }

  const server = String(mediaGroup.hls_server).replace(/\/+$/, "");
  const streamPath = String(mediaGroup.hls_url).replace(/^\/+/, "");

  return {
    apiUrl,
    m3u8Url: `${server}/${streamPath}`
  };
}

async function getEpisodePlaylist(episodeUrl) {
  const absoluteEpisodeUrl = toAbsoluteRteUrl(episodeUrl);
  const html = await fetchText(absoluteEpisodeUrl);
  const tracks = [];
  const articlePattern = /<article\s+class=["']playlist["'][\s\S]*?<\/article>/gi;

  for (const match of html.matchAll(articlePattern)) {
    const block = match[0];
    const title = findFirstMatch(block, [/<h3>([\s\S]*?)<\/h3>/i]) || "";
    const artist = findFirstMatch(block, [/<p\s+class=['"]artist['"]>([\s\S]*?)<\/p>/i]) || "";
    const image = findFirstMatch(block, [/<img[^>]+src=["']([^"']+)["']/i]) || "";

    if (!title) {
      continue;
    }

    tracks.push({
      title: cleanText(title),
      artist: cleanText(artist),
      image: image ? toAbsoluteRteUrl(image) : ""
    });
  }

  return {
    episodeUrl: absoluteEpisodeUrl,
    tracks
  };
}

async function extractRteInfo(pageUrl) {
  const html = await fetchText(pageUrl);

  const titleRaw =
    findFirstMatch(html, [
      /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i,
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
      /<title>([^<]+)<\/title>/i
    ]) || "rte-audio";

  const title = cleanTitle(titleRaw);

  const clipId = findFirstMatch(html, [
    /<meta\s+name=["']clip_id["']\s+content=["'](\d+)["']/i,
    /[?&]clipid=(\d+)/i
  ]);

  if (!clipId) {
    throw new Error("Could not find clip ID on the RTÉ page.");
  }

  const playlist = await getPlaylist(clipId);
  const image =
    findFirstMatch(html, [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i
    ]) || "";

  return {
    pageUrl,
    title,
    clipId: String(clipId),
    playlistApiUrl: playlist.apiUrl,
    m3u8Url: playlist.m3u8Url,
    image: image ? toAbsoluteRteUrl(image) : ""
  };
}


function mapEpisodeItem(item) {
  const clipId = String(item.clip_id || item.item_id || "").trim();
  const episodeUrl = item.url ? toAbsoluteRteUrl(item.url) : null;
  const image = item?.image || item?.thumbnail || item?.thumb || "";
  const fullTitle = cleanText(item.title || item.show_title || "Untitled");
  const description = cleanText(item.description || item.summary || item.standfirst || item.synopsis || item.subtitle || "");

  return {
    title: cleanTitle(item.title || item.show_title || "Untitled"),
    fullTitle,
    subtitle: cleanText(item.subtitle || ""),
    description,
    publishedTime: item.published_time || item.broadcast_date || "",
    publishedTimeFormatted: cleanText(item.published_time_formatted || ""),
    durationString: cleanText(item.duration_string || ""),
    clipId,
    episodeUrl,
    image: image ? toAbsoluteRteUrl(image) : ""
  };
}

async function getProgramEpisodes(programUrl, page = 1) {
  const normalizedProgramUrl = normalizeProgramUrl(programUrl);
  const episodesJsonUrl = getEpisodesJsonUrl(normalizedProgramUrl, page);

  const payload = await fetchJson(episodesJsonUrl);
  const episodes = Array.isArray(payload?.programmes)
    ? payload.programmes.map(mapEpisodeItem).filter((item) => item.clipId)
    : [];

  const cadenceInfo = inferCadence(episodes);
  const summary = await getProgramSummary(normalizedProgramUrl);
  const enrichedEpisodes = episodes.map((episode) => ({
    ...episode,
    description: episode.description || summary.description || "",
    image: episode.image || summary.image || "",
    hosts: summary.hosts || [],
    genres: summary.genres || [],
    location: summary.location || ""
  }));

  return {
    programUrl: normalizedProgramUrl,
    episodesJsonUrl,
    page: Number(payload?.page || page),
    totalItems: Number(payload?.total_items || episodes.length),
    numPages: Number(payload?.num_pages || 1),
    title: summary.title,
    description: summary.description,
    image: summary.image || episodes.find((episode) => episode.image)?.image || "",
    hosts: summary.hosts || [],
    genres: summary.genres || [],
    episodes: enrichedEpisodes,
    cadence: cadenceInfo.cadence,
    averageDaysBetween: cadenceInfo.averageDaysBetween,
    runSchedule: summary.runSchedule || ""
  };
}

function dublinScheduleToUtc(scheduleText) {
  if (!scheduleText) return "";
  // Get Dublin→UTC offset (0 in winter, -1 in summer when Dublin is UTC+1)
  const now = new Date();
  const dublinStr = now.toLocaleString("en-GB", { timeZone: "Europe/Dublin", hour12: false });
  const utcStr = now.toLocaleString("en-GB", { timeZone: "UTC", hour12: false });
  const dublinH = parseInt(dublinStr.split(",")[1]?.trim().split(":")[0] || "0", 10);
  const utcH = parseInt(utcStr.split(",")[1]?.trim().split(":")[0] || "0", 10);
  const offset = ((dublinH - utcH) + 24) % 24; // 0 or 1
  if (offset === 0) return scheduleText; // Dublin == UTC, no conversion needed
  // Shift all HH:MM times back by the offset to convert Dublin→UTC
  return scheduleText.replace(/(\d{1,2}):(\d{2})/g, (match, hh, mm) => {
    const h = ((parseInt(hh, 10) - offset) + 24) % 24;
    return String(h).padStart(2, "0") + ":" + mm;
  });
}

async function getProgramSummary(programUrl) {
  const normalizedProgramUrl = normalizeProgramUrl(programUrl);
  const SUMMARY_TTL = 24 * 60 * 60 * 1000;
  const diskKey = "rte:summary:" + normalizedProgramUrl;
  if (!programSummaryCache.has(normalizedProgramUrl) && _diskCache) {
    const cached = _diskCache.get(diskKey, SUMMARY_TTL);
    if (cached) programSummaryCache.set(normalizedProgramUrl, cached);
  }
  if (programSummaryCache.has(normalizedProgramUrl)) {
    return programSummaryCache.get(normalizedProgramUrl);
  }

  const html = await fetchText(normalizedProgramUrl);
  const title =
    findFirstMatch(html, [
      /<meta\s+name=["']programme["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']DC\.title["']\s+[^>]*content=["']([^"']+)["']/i,
      /<title>([^<]+)<\/title>/i
    ]) || "RTÉ Program";

  const description =
    findFirstMatch(html, [
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i
    ]) || "";

  const image =
    findFirstMatch(html, [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i
    ]) || "";

  const runSchedule =
    findFirstMatch(html, [
      /<span[^>]+id=["']datetimePlayer["'][^>]*>([^<]+)<\/span>/i
    ]) || "";
  const hosts = extractRteHostsFromHtml(html, cleanTitle(title));

  // Extract genres from JSON-LD, Dublin Core subject, or keywords meta
  let genres = [];
  let location = "";
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.genre) {
          const g = Array.isArray(item.genre) ? item.genre : [item.genre];
          genres.push(...g.map((x) => cleanText(String(x))).filter(Boolean));
        }
        if (!location) {
          location = cleanText(
            item.contentLocation?.name
            || item.locationCreated?.name
            || item.spatialCoverage?.name
            || item.areaServed?.name
            || item.location?.name
            || item.location
            || ""
          );
        }
      }
    } catch {}
  }
  if (!genres.length) {
    const dcSubject = findFirstMatch(html, [
      /<meta\s+name=["']DC\.subject["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']dc\.subject["']\s+content=["']([^"']+)["']/i
    ]);
    if (dcSubject) {
      genres = dcSubject.split(/[,;]/).map((k) => k.trim()).filter(Boolean).slice(0, 6);
    }
  }
  if (!genres.length) {
    const kwMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
    if (kwMatch) {
      genres = kwMatch[1].split(",").map((k) => k.trim()).filter(Boolean).slice(0, 5);
    }
  }
  if (!location) {
    location = findFirstMatch(html, [
      /<meta\s+name=["']DC\.coverage["']\s+content=["']([^"']+)["']/i,
      /<meta\s+name=["']dc\.coverage["']\s+content=["']([^"']+)["']/i
    ]) || "";
  }

  const summary = {
    programUrl: normalizedProgramUrl,
    title: cleanTitle(title),
    description: cleanText(description),
    image: image ? toAbsoluteRteUrl(image) : "",
    hosts,
    location,
    runSchedule: dublinScheduleToUtc(cleanText(runSchedule)),
    genres: [...new Set(genres)].slice(0, 6)
  };

  programSummaryCache.set(normalizedProgramUrl, summary);
  if (_diskCache) _diskCache.set(diskKey, summary);
  return summary;
}

async function getLiveStationNow(channelId) {
  const id = Number(channelId);
  if (!Number.isFinite(id)) {
    throw new Error("Invalid channel ID.");
  }

  const url = `https://www.rte.ie/livelistings/playlist/?source=rte.ie&platform=webradio&channelid=${id}`;
  const payload = await fetchJson(url);
  const now = Array.isArray(payload) ? payload[0] : null;

  if (!now) {
    throw new Error("No live data returned for that station.");
  }

  return {
    channelId: id,
    stationName: cleanText(now.channel || "RTÉ Radio"),
    programmeName: cleanText(now.progName || "Live"),
    description: cleanText(now.description || ""),
    nowStart: now.progDate || "",
    nowEnd: now.endDate || "",
    streamUrl: now?.stream?.ios || now?.fullUrl || "",
    image: now.thumbnail || ""
  };
}

function uniqueByProgramUrl(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    if (seen.has(item.programUrl)) {
      continue;
    }
    seen.add(item.programUrl);
    out.push(item);
  }

  return out;
}

function parseProgramsFromStationHtml(html, stationSlug) {
  const pattern = new RegExp(`href=["'](/radio/${stationSlug}/[^"'#?]+/)["']`, "gi");
  const programs = [];
  const disallowed = ["/news/", "/shows/", "/clips/", "/podcasts/", "/schedule/"];

  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (!href) {
      continue;
    }

    if (disallowed.some((token) => href.includes(token))) {
      continue;
    }

    const parts = href.split("/").filter(Boolean);
    if (parts.length !== 3) {
      continue;
    }

    const slug = parts[2];
    const title = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .trim();

    programs.push({
      stationSlug,
      stationName: STATION_NAME_BY_SLUG.get(stationSlug) || stationSlug,
      title,
      programUrl: toAbsoluteRteUrl(href)
    });
  }

  return uniqueByProgramUrl(programs);
}

async function buildProgramCache() {
  const sources = await Promise.all(
    PROGRAM_SEARCH_STATIONS.map(async (stationSlug) => {
      const stationUrl = `https://www.rte.ie/radio/${stationSlug}/`;
      try {
        const html = await fetchText(stationUrl);
        return parseProgramsFromStationHtml(html, stationSlug);
      } catch {
        return [];
      }
    })
  );

  const merged = uniqueByProgramUrl(sources.flat());
  programCache.fetchedAt = Date.now();
  programCache.programs = merged;

  return merged;
}

async function searchPrograms(query) {
  const q = cleanText(query).toLowerCase();

  const stale = Date.now() - programCache.fetchedAt > 1000 * 60 * 30;
  const programs = stale || programCache.programs.length === 0
    ? await buildProgramCache()
    : programCache.programs;

  const baseItems = q
    ? programs
    : programs.slice().sort((a, b) => a.title.localeCompare(b.title));

  const enriched = await Promise.all(
    baseItems.map(async (item) => {
      try {
        const summary = await getProgramSummary(item.programUrl);
        return {
          ...item,
          title: summary.title || item.title,
          description: summary.description,
          image: summary.image,
          runSchedule: summary.runSchedule,
          hosts: summary.hosts || [],
          genres: summary.genres || [],
          location: summary.location || ""
        };
      } catch {
        return {
          ...item,
          description: "",
          image: "",
          runSchedule: "",
          hosts: [],
          genres: [],
          location: ""
        };
      }
    })
  );

  if (!q) {
    return enriched.slice(0, 40);
  }

  return enriched
    .map((item) => ({ ...item, _score: scoreRteProgramResult(item, q) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) {
        return b._score - a._score;
      }
      return String(a.title || "").localeCompare(String(b.title || ""), "en");
    })
    .slice(0, 25)
    .map((item) => {
      const copy = { ...item };
      delete copy._score;
      return copy;
    });
}

async function getRteDiscovery(count = 5) {
  try {
    // Empty query returns up to 40 programs alphabetically; pick a metadata-rich, diverse subset.
    const results = await searchPrograms("");
    return pickDiscoveryResults(results, count);
  } catch { return []; }
}

module.exports = {
  LIVE_STATIONS,
  extractRteInfo,
  getEpisodePlaylist,
  getPlaylist,
  getProgramEpisodes,
  getProgramSummary,
  getLiveStationNow,
  normalizeProgramUrl,
  getRteDiscovery,
  searchPrograms,
  configure
};
