const path = require("node:path");

function sanitizePathSegment(input) {
  const decoded = String(input || "")
    .replace(/&#(\d+);/g, (_m, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return decoded
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function slugify(input) {
  return sanitizePathSegment(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toEpisodeShort(input) {
  const text = String(input || "").trim();
  if (!text) {
    return "";
  }
  const split = text.split(/[-:|]/).map((s) => s.trim()).filter(Boolean);
  const best = split[0] || text;
  return best.slice(0, 80).trim();
}

function monthIndex(name) {
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  return months.indexOf(String(name || "").toLowerCase());
}

function extractReleaseDate(input) {
  const text = String(input || "").trim();
  if (!text) {
    return "";
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const dmy = text.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (dmy) {
    const idx = monthIndex(dmy[2]);
    if (idx >= 0) {
      return `${dmy[3]}-${String(idx + 1).padStart(2, "0")}-${String(Number(dmy[1])).padStart(2, "0")}`;
    }
  }

  const mdy = text.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (mdy) {
    const idx = monthIndex(mdy[1]);
    if (idx >= 0) {
      return `${mdy[3]}-${String(idx + 1).padStart(2, "0")}-${String(Number(mdy[2])).padStart(2, "0")}`;
    }
  }

  return "";
}

function renderTemplate(template, tokens) {
  const input = String(template || "").trim();
  if (!input) {
    return "";
  }
  return input.replace(/\{([a-z_]+)\}/gi, (_m, key) => {
    const value = tokens[String(key || "").toLowerCase()];
    return value == null ? "" : String(value);
  });
}

function pickSourceId({ clipId, episodeUrl }) {
  const fromClip = String(clipId || "").trim();
  if (fromClip) {
    return fromClip;
  }

  const url = String(episodeUrl || "").trim();
  if (!url) {
    return "";
  }

  const match = url.match(/\/(?:programmes|sounds\/play)\/([a-z0-9]{8,})/i);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  return "";
}

function buildDownloadTarget({
  baseDownloadDir,
  pathFormat,
  sourceType,
  programTitle,
  episodeTitle,
  publishedTime,
  clipId,
  episodeUrl
}) {
  const radio = sourceType === "bbc" ? "BBC" : "RTE";
  const releaseDate = extractReleaseDate(publishedTime) || extractReleaseDate(episodeTitle);
  const [year = "", month = "", day = ""] = String(releaseDate).split("-");
  const sourceId = pickSourceId({ clipId, episodeUrl });
  const program = sanitizePathSegment(programTitle) || "misc";
  const episode = sanitizePathSegment(episodeTitle) || "episode";
  const episodeShort = sanitizePathSegment(toEpisodeShort(episodeTitle)) || "episode";
  const tokens = {
    radio,
    program,
    program_slug: slugify(program) || "misc",
    episode,
    episode_slug: slugify(episode) || "episode",
    episode_short: episodeShort,
    release_date: sanitizePathSegment(releaseDate || "")
    ,year: sanitizePathSegment(year)
    ,month: sanitizePathSegment(month)
    ,day: sanitizePathSegment(day)
    ,date_compact: sanitizePathSegment(`${year}${month}${day}`)
    ,source_id: sanitizePathSegment(sourceId)
  };

  const rendered = renderTemplate(pathFormat, tokens).trim();
  const relativeRaw = rendered || "{radio}/{program}/{episode_short} {release_date}";
  const relativeResolved = renderTemplate(relativeRaw, tokens)
    .replace(/^[/\\]+/, "")
    .replace(/\.\.+/g, "")
    .replace(/[\\/]+/g, "/");

  const parts = relativeResolved.split("/").map(sanitizePathSegment).filter(Boolean);
  const filePart = parts.length ? parts[parts.length - 1] : `${tokens.episode_short} ${tokens.release_date}`.trim();
  const stem = sanitizePathSegment(filePart.replace(/\.mp3$/i, "")) || "episode";
  const dirParts = parts.slice(0, -1);
  const outputDir = path.join(baseDownloadDir, ...dirParts);

  return {
    outputDir,
    fileStem: stem,
    tokens
  };
}

module.exports = {
  buildDownloadTarget,
  extractReleaseDate,
  sanitizePathSegment
};
