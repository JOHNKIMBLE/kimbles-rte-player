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
const BBC_DISCOVERY_BOOTSTRAP_TERMS = ["music", "arts", "jazz", "soul", "world", "electronic", "dance", "classical", "comedy", "culture", "documentary"];
const bbcDiscoveryTermsCache = {
  fetchedAt: 0,
  terms: []
};
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const { decodeHtml, cleanText, stripHtml, inferCadence } = require("./utils");
const { fetchWithHostAllowlist } = require("./outbound-http");

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
  const response = await fetchWithHostAllowlist(url, ["bbc.co.uk", "bbc.com"], "BBC", {
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
  const response = await fetchWithHostAllowlist(url, ["bbc.co.uk", "bbc.com"], "BBC", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load BBC JSON: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

const stripTags = (input) => cleanText(stripHtml(input));

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

const BBC_HOST_DENYLIST = new Set([
  "us",
  "uk",
  "gb",
  "eu",
  "en",
  "bbc",
  "news",
  "sounds",
  "help",
  "contact",
  "cookies",
  "privacy"
]);

function isLikelyBbcHostName(value, programTitle = "") {
  const text = cleanText(stripHtml(value || ""));
  if (!text || text.length < 2 || text.length > 80) {
    return false;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(text)) {
    return false;
  }
  if (text.split(/\s+/).length > 8) {
    return false;
  }
  const lower = text.toLowerCase();
  if (BBC_HOST_DENYLIST.has(lower)) {
    return false;
  }
  if (/^[a-z]{2}$/.test(lower)) {
    return false;
  }
  if (/^bbc\b/i.test(text)) {
    return false;
  }
  if (/parent page|breadcrumb|cookie|copyright|javascript|share this|listen back|read more|skip to/i.test(text)) {
    return false;
  }
  const prog = cleanText(programTitle || "");
  if (prog && prog.toLowerCase() === lower) {
    const looksLikeCompoundShowTitle = /\b(bbc|radio\s*\d|sounds)\b/i.test(prog) || /\s-\s/.test(prog);
    if (looksLikeCompoundShowTitle) {
      return false;
    }
    const words = prog.split(/\s+/).filter(Boolean);
    const lastWord = words[words.length - 1] || "";
    const lastLooksShowy = /^(beats|mix|shows?|hours?|sessions?|club|live|night|morning|drive|breakfast|best|top|countdown|chart|selections?|picks?|anthems?|underground)s?$/i.test(lastWord);
    if (words.length >= 2 && lastLooksShowy) {
      return false;
    }
  }
  return true;
}

function inferBbcHostsFromProgramTitle(title = "") {
  const text = cleanText(title || "");
  if (!text) {
    return [];
  }
  const onBbc = text.match(/^(.+?)\s+on\s+BBC/i);
  if (onBbc?.[1]) {
    const h = cleanText(onBbc[1]);
    if (isLikelyBbcHostName(h, text)) {
      return [h];
    }
  }
  const segments = text.split(/\s*-\s*/).map((s) => cleanText(s)).filter(Boolean);
  const bbcish = (s) => /\b(bbc|radio\s*\d|sounds|podcast)\b/i.test(s);
  const candidates = segments.filter((s) => !bbcish(s) && isLikelyBbcHostName(s, text));
  if (candidates.length) {
    return uniqueCleanList(candidates).slice(0, 6);
  }
  const withMatch = text.match(/(?:with|w\/|hosted by|presented by)\s+(.+)$/i);
  if (withMatch?.[1]) {
    return uniqueCleanList(
      withMatch[1]
        .split(/\s*(?:,|&| and )\s*/gi)
        .map((x) => cleanText(x))
        .filter((h) => isLikelyBbcHostName(h, text))
    ).slice(0, 6);
  }
  return [];
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

function buildBbcProgramSearchText(item) {
  return [
    item.title,
    item.description,
    item.runSchedule,
    item.nextBroadcastTitle,
    item.programUrl,
    ...(item.hosts || []),
    ...(item.genres || [])
  ]
    .map((value) => cleanText(value || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function scoreBbcProgramResult(item, query) {
  if (!query) {
    return 0;
  }

  let score = 0;
  score += scoreTextMatch(item.title, query, 240, 185, 135);
  score += scoreTextMatch(item.description, query, 95, 0, 60);
  score += scoreTextMatch(item.runSchedule, query, 20, 15, 10);
  score += scoreTextMatch(item.nextBroadcastTitle, query, 40, 30, 20);
  score += scoreTextMatch(item.programUrl, query, 30, 20, 15);
  score += scoreListMatch(item.hosts, query, 230, 190, 150);
  score += scoreListMatch(item.genres, query, 170, 145, 115);

  const tokens = query.split(/\s+/g).filter(Boolean);
  if (tokens.length > 1) {
    const searchText = buildBbcProgramSearchText(item);
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
    item.runSchedule ? 2 : 0,
    item.nextBroadcastAt ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function normalizeDiscoveryTerm(value) {
  const text = cleanText(value || "");
  if (!text || text.length < 3 || /^\d+$/.test(text)) {
    return "";
  }
  return text.slice(0, 60);
}

function getCachedDiscoveryTerms() {
  const stale = Date.now() - bbcDiscoveryTermsCache.fetchedAt > 1000 * 60 * 60 * 6;
  if (stale) {
    return [];
  }
  return bbcDiscoveryTermsCache.terms.slice();
}

function rememberBbcDiscoveryTerms(items) {
  const weights = new Map(
    getCachedDiscoveryTerms().map((entry) => [String(entry.term || ""), Number(entry.weight || 0)])
  );

  for (const item of items || []) {
    for (const host of item.hosts || []) {
      const term = normalizeDiscoveryTerm(host);
      if (term) {
        weights.set(term, (weights.get(term) || 0) + 4);
      }
    }
    for (const genre of item.genres || []) {
      const term = normalizeDiscoveryTerm(genre);
      if (term) {
        weights.set(term, (weights.get(term) || 0) + 3);
      }
    }
    const title = normalizeDiscoveryTerm(item.title);
    if (title) {
      weights.set(title, (weights.get(title) || 0) + 1);
    }
  }

  bbcDiscoveryTermsCache.fetchedAt = Date.now();
  bbcDiscoveryTermsCache.terms = [...weights.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return a.term.localeCompare(b.term, "en");
    })
    .slice(0, 32);
}

function pickDiscoveryTerms(count, exclude = []) {
  const excluded = new Set((exclude || []).map((value) => String(value || "").toLowerCase()));
  const cached = getCachedDiscoveryTerms()
    .map((entry) => entry.term)
    .filter((term) => term && !excluded.has(term.toLowerCase()));

  const pool = cached.length
    ? cached
    : BBC_DISCOVERY_BOOTSTRAP_TERMS.filter((term) => !excluded.has(term.toLowerCase()));

  const randomized = pool
    .map((term, index) => ({
      term,
      score: pool.length - index + Math.random()
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.term);

  return randomized.slice(0, count);
}

function scoreDiscoveryNovelty(item, selected) {
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
  const title = cleanText(item.title || "").toLowerCase();
  if (title && !seenTitles.has(title)) {
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

function pickDiscoveryResults(pool, count) {
  const ranked = (pool || [])
    .map((item) => ({
      item,
      richness: getMetadataRichnessScore(item) + Math.random()
    }))
    .sort((a, b) => b.richness - a.richness)
    .map((entry) => entry.item);

  const selected = [];
  const remaining = ranked.slice();
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

function collectBbcPeople(value, bucket) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectBbcPeople(entry, bucket));
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
    for (const key of ["author", "creator", "contributor", "actor", "performer", "host"]) {
      if (value[key]) {
        collectBbcPeople(value[key], bucket);
      }
    }
  }
}

function extractBbcHostsFromHtml(html, programTitle = "") {
  const hosts = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        collectBbcPeople(item?.author, hosts);
        collectBbcPeople(item?.creator, hosts);
        collectBbcPeople(item?.contributor, hosts);
        collectBbcPeople(item?.actor, hosts);
        collectBbcPeople(item?.performer, hosts);
        collectBbcPeople(item?.host, hosts);
      }
    } catch {}
  }

  const metaHosts = [
    html.match(/<meta\s+name=["']parsely-author["']\s+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i)?.[1]
  ].map((value) => cleanText(value || "")).filter(Boolean);
  hosts.push(...metaHosts);

  if (!hosts.length) {
    const presentedBy = html.match(/(?:Presented by|presented by|with)\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i)
      || html.match(/(?:Presented by|presented by)\s+([^<.,|]{2,80})/i);
    if (presentedBy?.[1]) {
      hosts.push(cleanText(presentedBy[1]));
    }
  }

  const filtered = uniqueCleanList(hosts)
    .filter((host) => isLikelyBbcHostName(host, programTitle))
    .slice(0, 6);
  if (filtered.length) {
    return filtered;
  }
  return inferBbcHostsFromProgramTitle(programTitle);
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

function toUtcDayAndTime(date) {
  const dayIndex = date.getUTCDay();
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return {
    dayIndex,
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

function formatUtcDateTime(iso) {
  const date = toDublinDate(iso);
  if (!date) {
    return "";
  }
  return date.toISOString();
}

function hhmmToMinutes(hhmm) {
  const p = String(hhmm || "").split(":");
  const h = Number(p[0]);
  const m = Number(p[1]);
  return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null;
}

function buildBroadcastSlotGroups(broadcasts) {
  const groups = new Map();

  for (const item of broadcasts) {
    const start = toDublinDate(item.startDate);
    const end = toDublinDate(item.endDate);
    if (!start || !end) {
      continue;
    }

    const startInfo = toUtcDayAndTime(start);
    const endInfo = toUtcDayAndTime(end);
    const startMin = hhmmToMinutes(startInfo.hhmm);
    const endMin = hhmmToMinutes(endInfo.hhmm);
    if (startMin == null || endMin == null) {
      continue;
    }

    const key = `${startInfo.dayIndex}|${startInfo.hhmm}-${endInfo.hhmm}`;
    if (!groups.has(key)) {
      groups.set(key, {
        dayIndex: startInfo.dayIndex,
        start: startInfo.hhmm,
        end: endInfo.hhmm,
        startMin,
        endMin,
        count: 0,
        firstSeenAt: Number.isFinite(Date.parse(item.startDate)) ? Date.parse(item.startDate) : Number.MAX_SAFE_INTEGER
      });
    }
    groups.get(key).count += 1;
  }

  return Array.from(groups.values())
    .sort((a, b) => {
      if (a.firstSeenAt !== b.firstSeenAt) {
        return a.firstSeenAt - b.firstSeenAt;
      }
      if (a.dayIndex !== b.dayIndex) {
        return a.dayIndex - b.dayIndex;
      }
      return a.startMin - b.startMin;
    });
}

function mergeDstSlotGroups(slotGroups) {
  const used = new Set();
  const merged = [];

  for (let i = 0; i < slotGroups.length; i += 1) {
    if (used.has(i)) {
      continue;
    }

    const base = { ...slotGroups[i] };
    for (let j = i + 1; j < slotGroups.length; j += 1) {
      if (used.has(j)) {
        continue;
      }
      const candidate = slotGroups[j];
      if (base.dayIndex !== candidate.dayIndex) {
        continue;
      }
      if (Math.abs(base.startMin - candidate.startMin) !== 60) {
        continue;
      }
      if (Math.abs(base.endMin - candidate.endMin) !== 60) {
        continue;
      }

      base.count += candidate.count;
      used.add(j);
    }

    used.add(i);
    merged.push(base);
  }

  return merged;
}

function filterRecurringSlotGroups(slotGroups) {
  if (slotGroups.length <= 1) {
    return slotGroups;
  }

  const maxCount = Math.max(...slotGroups.map((group) => group.count || 0));
  if (maxCount < 3) {
    return slotGroups;
  }

  const threshold = Math.max(2, Math.ceil(maxCount / 2));
  const filtered = slotGroups.filter((group) => group.count >= threshold);
  return filtered.length ? filtered : slotGroups;
}

function buildRunScheduleFromSlotGroups(slotGroups) {
  const groups = new Map();

  for (const slot of slotGroups) {
    const key = `${slot.start}-${slot.end}`;
    if (!groups.has(key)) {
      groups.set(key, { start: slot.start, end: slot.end, days: [] });
    }
    groups.get(key).days.push(slot.dayIndex);
  }

  return Array.from(groups.values())
    .sort((a, b) => {
      const aDay = Math.min(...a.days);
      const bDay = Math.min(...b.days);
      if (aDay !== bDay) {
        return aDay - bDay;
      }
      return hhmmToMinutes(a.start) - hhmmToMinutes(b.start);
    })
    .map((group) => {
      const dayExpr = formatDayGroup(group.days);
      if (!dayExpr) {
        return "";
      }
      return `${dayExpr} \u2022 ${group.start} - ${group.end}`;
    })
    .filter(Boolean)
    .join(", ");
}

/** Identical to buildRunScheduleFromBroadcasts but merges groups whose times differ by
 *  exactly 60 minutes and cover the same weekdays — caused by DST transitions (UK GMT/BST). */
function buildRunScheduleFromBroadcastsDst(broadcasts) {
  const slotGroups = buildBroadcastSlotGroups(broadcasts);
  if (!slotGroups.length) {
    return "";
  }

  const mergedDstGroups = mergeDstSlotGroups(slotGroups);
  const recurringGroups = filterRecurringSlotGroups(mergedDstGroups);
  return buildRunScheduleFromSlotGroups(recurringGroups);
}

function _buildRunScheduleFromBroadcasts(broadcasts) {
  const groups = new Map();

  for (const item of broadcasts) {
    const start = toDublinDate(item.startDate);
    const end = toDublinDate(item.endDate);
    if (!start || !end) {
      continue;
    }

    const startInfo = toUtcDayAndTime(start);
    const endInfo = toUtcDayAndTime(end);
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
  let html;

  try {
    html = await fetchText(upcomingUrl);
  } catch {
    return {
      runSchedule: "",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    };
  }

  let broadcasts = extractUpcomingBroadcastsFromJsonLd(html);
  if (!broadcasts.length) {
    return {
      runSchedule: "",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    };
  }

  // Limit to the next 8 weeks to avoid DST-crossover duplicates and cross-programme contamination
  const eightWeeksMs = 8 * 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() + eightWeeksMs;
  const nearTerm = broadcasts.filter((b) => {
    const ts = Date.parse(b.startDate);
    return Number.isFinite(ts) && ts <= cutoff;
  });
  if (nearTerm.length) broadcasts = nearTerm;

  const runSchedule = buildRunScheduleFromBroadcastsDst(broadcasts);
  const now = Date.now();
  const next = broadcasts.find((item) => {
    const ts = Date.parse(item.startDate);
    return Number.isFinite(ts) && ts >= now - 1000 * 60 * 60;
  }) || broadcasts[0];

  return {
    runSchedule,
    nextBroadcastAt: formatUtcDateTime(next?.startDate || ""),
    nextBroadcastTitle: cleanText(next?.title || "")
  };
}

async function getBbcProgramSummary(programUrl, runYtDlpJson, options = {}) {
  const includeSchedule = options.includeSchedule !== false;
  const normalizedUrl = normalizeBbcProgramUrl(programUrl);
  let title;
  let description;
  let image;
  let genres = [];
  let hosts = [];

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
    hosts = extractBbcHostsFromHtml(html, title || "");
    // Try to extract genres from JSON-LD schema.org markup
    for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const data = JSON.parse(m[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item.genre) {
            const g = Array.isArray(item.genre) ? item.genre : [item.genre];
            genres.push(...g.map((x) => cleanText(String(x))).filter(Boolean));
          }
        }
      } catch {}
    }
    // Fallback: keywords meta tag
    if (!genres.length) {
      const kwMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
      if (kwMatch) {
        genres = kwMatch[1].split(",").map((k) => k.trim()).filter(Boolean).slice(0, 5);
      }
    }
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

  if (!hosts.length) {
    const t = cleanText(title || "");
    if (t) {
      const inferred = inferBbcHostsFromProgramTitle(t);
      if (inferred.length) {
        hosts = inferred;
      }
    }
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
    hosts,
    genres: [...new Set(genres)].slice(0, 6),
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

  const normalizedQuery = q.toLowerCase();
  const results = summaries
    .map((item) => ({ ...item, _score: scoreBbcProgramResult(item, normalizedQuery) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) {
        return b._score - a._score;
      }
      return String(a.title).localeCompare(String(b.title), "en");
    })
    .map((item) => {
      const copy = { ...item };
      delete copy._score;
      return copy;
    });
  rememberBbcDiscoveryTerms(results);
  return results;
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
  mapped = mapped.map((episode) => ({
    ...episode,
    description: episode.description || summary.description || "",
    image: episode.image || summary.image || "",
    hosts: Array.isArray(episode.hosts) && episode.hosts.length ? episode.hosts : (summary.hosts || []),
    genres: Array.isArray(episode.genres) && episode.genres.length ? episode.genres : (summary.genres || [])
  }));
  const safePage = Math.max(1, Number(page) || 1);
  // Program image: prefer summary, fall back to first episode's image
  const programImage = summary.image || mapped.find((e) => e.image)?.image || "";
  return {
    source: "bbc",
    programUrl: normalizedProgramUrl,
    title: summary.title || cleanText(payload?.title || "BBC Program"),
    description: summary.description || cleanText(payload?.description || ""),
    image: programImage,
    hosts: summary.hosts || [],
    genres: summary.genres || [],
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

async function getBbcDiscovery(count = 5) {
  const desiredCount = Math.max(1, Number(count) || 5);
  const termBudget = Math.min(12, Math.max(6, desiredCount * 2));
  const terms = pickDiscoveryTerms(termBudget);
  const seen = new Set();
  const pool = [];
  const searchedTerms = [];

  for (let index = 0; index < terms.length; index += 2) {
    const batch = terms.slice(index, index + 2);
    if (!batch.length) {
      break;
    }
    searchedTerms.push(...batch);
    const settled = await Promise.allSettled(batch.map((term) => searchBbcPrograms(term)));
    const results = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    rememberBbcDiscoveryTerms(results);
    for (const row of results) {
      const key = row.programUrl || row.url || row.title;
      if (key && !seen.has(key)) {
        seen.add(key);
        pool.push(row);
      }
    }
    if (pool.length >= Math.max(desiredCount * 2, desiredCount + 2)) {
      break;
    }
  }

  if (pool.length < desiredCount) {
    const fallbackTerms = pickDiscoveryTerms(termBudget, searchedTerms);
    for (let index = 0; index < fallbackTerms.length; index += 2) {
      const batch = fallbackTerms.slice(index, index + 2);
      const settled = await Promise.allSettled(batch.map((term) => searchBbcPrograms(term)));
      const results = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
      rememberBbcDiscoveryTerms(results);
      for (const row of results) {
        const key = row.programUrl || row.url || row.title;
        if (key && !seen.has(key)) {
          seen.add(key);
          pool.push(row);
        }
      }
      if (pool.length >= desiredCount) {
        break;
      }
    }
  }

  return pickDiscoveryResults(pool, desiredCount);
}

module.exports = {
  getBbcDiscovery,
  getBbcEpisodePlaylist,
  getBbcLiveStations,
  getBbcProgramEpisodes,
  getBbcProgramSummary,
  normalizeBbcProgramUrl,
  normalizeBbcUrl,
  searchBbcPrograms
};
