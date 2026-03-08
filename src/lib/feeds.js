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

function writeProgramFeedFiles({ dataDir, schedule, latest }) {
  const episodes = Array.isArray(latest?.episodes) ? latest.episodes : [];
  const slug = sanitizeName(schedule?.title || schedule?.id || "program") || "program";
  const feedDir = ensureFeedDir(dataDir);
  const jsonPath = path.join(feedDir, `${slug}.json`);
  const rssPath = path.join(feedDir, `${slug}.rss.xml`);

  const jsonPayload = {
    id: schedule?.id || "",
    title: schedule?.title || "",
    description: schedule?.description || "",
    programUrl: schedule?.programUrl || "",
    updatedAt: new Date().toISOString(),
    episodes: episodes.slice(0, 100).map((episode) => ({
      clipId: episode.clipId || "",
      title: episode.fullTitle || episode.title || "",
      description: episode.description || "",
      publishedTime: episode.publishedTime || "",
      episodeUrl: episode.episodeUrl || "",
      image: episode.image || ""
    }))
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

module.exports = {
  writeProgramFeedFiles
};

