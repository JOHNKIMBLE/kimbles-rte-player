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
const programSummaryCache = new Map();

function decodeHtml(input) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(input) {
  return decodeHtml(String(input || "")).replace(/\s+/g, " ").trim();
}

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
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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

  return {
    pageUrl,
    title,
    clipId: String(clipId),
    playlistApiUrl: playlist.apiUrl,
    m3u8Url: playlist.m3u8Url
  };
}

function inferCadence(episodes) {
  const times = episodes
    .map((item) => new Date(item.publishedTime).getTime())
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

function mapEpisodeItem(item) {
  const clipId = String(item.clip_id || item.item_id || "").trim();
  const episodeUrl = item.url ? toAbsoluteRteUrl(item.url) : null;

  return {
    title: cleanTitle(item.title || item.show_title || "Untitled"),
    subtitle: cleanText(item.subtitle || ""),
    publishedTime: item.published_time || item.broadcast_date || "",
    publishedTimeFormatted: cleanText(item.published_time_formatted || ""),
    durationString: cleanText(item.duration_string || ""),
    clipId,
    episodeUrl
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

  return {
    programUrl: normalizedProgramUrl,
    episodesJsonUrl,
    page: Number(payload?.page || page),
    totalItems: Number(payload?.total_items || episodes.length),
    numPages: Number(payload?.num_pages || 1),
    episodes,
    cadence: cadenceInfo.cadence,
    averageDaysBetween: cadenceInfo.averageDaysBetween
  };
}

async function getProgramSummary(programUrl) {
  const normalizedProgramUrl = normalizeProgramUrl(programUrl);
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

  const summary = {
    programUrl: normalizedProgramUrl,
    title: cleanTitle(title),
    description: cleanText(description),
    image: image ? toAbsoluteRteUrl(image) : "",
    runSchedule: cleanText(runSchedule)
  };

  programSummaryCache.set(normalizedProgramUrl, summary);
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

  const matched = (q
    ? programs.filter((item) => item.title.toLowerCase().includes(q) || item.programUrl.toLowerCase().includes(q))
    : programs.slice().sort((a, b) => a.title.localeCompare(b.title))
  ).slice(0, q ? 25 : 40);

  const enriched = await Promise.all(
    matched.map(async (item) => {
      try {
        const summary = await getProgramSummary(item.programUrl);
        return {
          ...item,
          title: summary.title || item.title,
          description: summary.description,
          image: summary.image,
          runSchedule: summary.runSchedule
        };
      } catch {
        return {
          ...item,
          description: "",
          image: "",
          runSchedule: ""
        };
      }
    })
  );

  return enriched;
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
  searchPrograms
};
