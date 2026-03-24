const fs = require("node:fs");
const path = require("node:path");

function xmlEscape(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeName(input) {
  return String(input || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureFeedDir(baseDataDir) {
  const feedDir = path.join(baseDataDir, "feeds");
  fs.mkdirSync(feedDir, { recursive: true });
  return feedDir;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function toFeedUrl(basePath, slug, ext) {
  const safeBase = String(basePath || "").replace(/\/+$/, "");
  if (!safeBase) {
    return "";
  }
  return `${safeBase}/${encodeURIComponent(slug)}${ext}`;
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

function buildFeedEpisode(episode) {
  return {
    clipId: episode.clipId || "",
    title: episode.fullTitle || episode.title || "",
    description: episode.description || "",
    publishedTime: episode.publishedTime || "",
    episodeUrl: episode.episodeUrl || "",
    image: episode.image || "",
    location: String(episode.location || "").trim(),
    hosts: normalizeMetadataList(episode.hosts),
    genres: normalizeMetadataList(episode.genres)
  };
}

function writeProgramFeedFiles({ dataDir, schedule, latest }) {
  const episodes = Array.isArray(latest?.episodes) ? latest.episodes : [];
  const slug = sanitizeName(schedule?.title || schedule?.id || "program") || "program";
  const feedDir = ensureFeedDir(dataDir);
  const jsonPath = path.join(feedDir, `${slug}.json`);
  const rssPath = path.join(feedDir, `${slug}.rss.xml`);
  const topEpisode = episodes.find((episode) => episode && (episode.clipId || episode.title)) || null;

  const jsonPayload = {
    id: schedule?.id || "",
    title: schedule?.title || "",
    description: schedule?.description || "",
    programUrl: schedule?.programUrl || "",
    image: schedule?.image || "",
    location: String(schedule?.location || "").trim(),
    hosts: normalizeMetadataList(schedule?.hosts),
    genres: normalizeMetadataList(schedule?.genres),
    runSchedule: String(schedule?.runSchedule || latest?.runSchedule || "").trim(),
    nextBroadcastAt: String(schedule?.nextBroadcastAt || latest?.nextBroadcastAt || "").trim(),
    nextBroadcastTitle: String(schedule?.nextBroadcastTitle || latest?.nextBroadcastTitle || "").trim(),
    latestEpisodeTitle: String(schedule?.latestEpisodeTitle || topEpisode?.fullTitle || topEpisode?.title || "").trim(),
    latestEpisodePublishedTime: String(schedule?.latestEpisodePublishedTime || topEpisode?.publishedTime || "").trim(),
    latestEpisodeDescription: String(schedule?.latestEpisodeDescription || topEpisode?.description || "").trim(),
    latestEpisodeLocation: String(schedule?.latestEpisodeLocation || topEpisode?.location || "").trim(),
    latestEpisodeHosts: normalizeMetadataList(schedule?.latestEpisodeHosts || topEpisode?.hosts),
    latestEpisodeGenres: normalizeMetadataList(schedule?.latestEpisodeGenres || topEpisode?.genres),
    updatedAt: new Date().toISOString(),
    episodes: episodes.slice(0, 100).map(buildFeedEpisode)
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), "utf8");

  const itemsXml = jsonPayload.episodes
    .map((episode) => {
      const pubDate = episode.publishedTime ? new Date(`${episode.publishedTime}T00:00:00Z`).toUTCString() : "";
      return [
        "<item>",
        `<title>${xmlEscape(episode.title)}</title>`,
        episode.episodeUrl ? `<link>${xmlEscape(episode.episodeUrl)}</link>` : "",
        episode.description ? `<description>${xmlEscape(episode.description)}</description>` : "",
        episode.hosts.length ? `<author>${xmlEscape(episode.hosts.join(", "))}</author>` : "",
        episode.location ? `<location>${xmlEscape(episode.location)}</location>` : "",
        ...episode.genres.map((genre) => `<category>${xmlEscape(genre)}</category>`),
        pubDate ? `<pubDate>${xmlEscape(pubDate)}</pubDate>` : "",
        "</item>"
      ].filter(Boolean).join("");
    })
    .join("");

  const rss = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"><channel>',
    `<title>${xmlEscape(jsonPayload.title)}</title>`,
    jsonPayload.programUrl ? `<link>${xmlEscape(jsonPayload.programUrl)}</link>` : "",
    jsonPayload.description ? `<description>${xmlEscape(jsonPayload.description)}</description>` : "",
    jsonPayload.hosts.length ? `<managingEditor>${xmlEscape(jsonPayload.hosts.join(", "))}</managingEditor>` : "",
    jsonPayload.location ? `<location>${xmlEscape(jsonPayload.location)}</location>` : "",
    ...jsonPayload.genres.map((genre) => `<category>${xmlEscape(genre)}</category>`),
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    itemsXml,
    "</channel></rss>"
  ].join("");
  fs.writeFileSync(rssPath, rss, "utf8");

  return {
    jsonPath,
    rssPath,
    slug
  };
}

function listProgramFeedFiles({ dataDir, sourceType = "", publicBasePath = "" }) {
  const feedDir = ensureFeedDir(dataDir);
  const entries = fs.readdirSync(feedDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
    .map((entry) => {
      const jsonPath = path.join(feedDir, entry.name);
      const slug = entry.name.replace(/\.json$/i, "");
      const rssPath = path.join(feedDir, `${slug}.rss.xml`);
      const payload = safeReadJson(jsonPath) || {};
      const jsonStat = fs.statSync(jsonPath);
      return {
        slug,
        sourceType,
        title: String(payload.title || slug),
        description: String(payload.description || ""),
        programUrl: String(payload.programUrl || ""),
        image: String(payload.image || ""),
        location: String(payload.location || ""),
        hosts: normalizeMetadataList(payload.hosts),
        genres: normalizeMetadataList(payload.genres),
        runSchedule: String(payload.runSchedule || ""),
        nextBroadcastAt: String(payload.nextBroadcastAt || ""),
        nextBroadcastTitle: String(payload.nextBroadcastTitle || ""),
        latestEpisodeTitle: String(payload.latestEpisodeTitle || ""),
        latestEpisodePublishedTime: String(payload.latestEpisodePublishedTime || ""),
        latestEpisodeDescription: String(payload.latestEpisodeDescription || ""),
        latestEpisodeLocation: String(payload.latestEpisodeLocation || ""),
        latestEpisodeHosts: normalizeMetadataList(payload.latestEpisodeHosts),
        latestEpisodeGenres: normalizeMetadataList(payload.latestEpisodeGenres),
        updatedAt: String(payload.updatedAt || jsonStat.mtime.toISOString()),
        episodeCount: Array.isArray(payload.episodes) ? payload.episodes.length : 0,
        jsonPath,
        rssPath,
        jsonUrl: toFeedUrl(publicBasePath, slug, ".json"),
        rssUrl: fs.existsSync(rssPath) ? toFeedUrl(publicBasePath, slug, ".rss.xml") : ""
      };
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return entries;
}

/**
 * Re-write JSON/RSS feed files by re-fetching the latest episode page for each subscription.
 * @param {{ feedExportEnabled: boolean, getDataDir: (sourceType: string) => string, sources: Array<{ sourceType: string, listSchedules: () => unknown[], getEpisodes: (programUrl: string, page?: number) => Promise<unknown> }> }} options
 */
async function rebuildProgramFeedsFromSchedules({ feedExportEnabled, getDataDir, sources, concurrency = 4 }) {
  if (!feedExportEnabled) {
    return {
      ok: false,
      rebuilt: 0,
      errors: [],
      message: "Turn on feed export in Settings to rebuild RSS/JSON feeds from subscriptions."
    };
  }

  const errors = [];
  let rebuilt = 0;
  const jobs = [];
  for (const row of sources || []) {
    const sourceType = String(row?.sourceType || "").trim();
    const listFn = row?.listSchedules;
    const getEpisodes = row?.getEpisodes;
    if (!sourceType || typeof listFn !== "function" || typeof getEpisodes !== "function") {
      continue;
    }
    const dataDir = getDataDir(sourceType);
    const schedules = listFn() || [];
    for (const schedule of schedules) {
      const programUrl = String(schedule?.programUrl || "").trim();
      if (!programUrl) {
        continue;
      }
      jobs.push({ sourceType, dataDir, schedule, getEpisodes });
    }
  }

  const limit = Math.max(1, Math.min(12, Math.floor(Number(concurrency) || 4) || 4));
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < jobs.length) {
      const i = nextIndex;
      nextIndex += 1;
      const { sourceType, dataDir, schedule, getEpisodes } = jobs[i];
      const programUrl = String(schedule?.programUrl || "").trim();
      try {
        const latest = await getEpisodes(programUrl, 1);
        writeProgramFeedFiles({ dataDir, schedule, latest });
        rebuilt += 1;
      } catch (error) {
        errors.push({
          sourceType,
          title: String(schedule?.title || ""),
          message: String(error?.message || error || "Unknown error")
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) || 1 }, () => worker()));

  let message;
  if (errors.length) {
    message = `Rebuilt ${rebuilt} feed file(s); ${errors.length} subscription(s) could not be refreshed.`;
  } else if (rebuilt > 0) {
    message = `Rebuilt ${rebuilt} feed file(s) from current subscriptions.`;
  } else {
    message = "No subscriptions with a program URL to export.";
  }

  return { ok: true, rebuilt, errors, message };
}

module.exports = {
  ensureFeedDir,
  listProgramFeedFiles,
  writeProgramFeedFiles,
  rebuildProgramFeedsFromSchedules
};
