// Shared utilities used across all source lib files (rte, bbc, nts, worldwidefm, fip).

/** Semicolon-terminated named refs (no leading &), longest checked first where needed. */
const NAMED_HTML_ENTITIES = new Map(
  Object.entries({
    hellip: "\u2026",
    mdash: "\u2014",
    ndash: "\u2013",
    rsquo: "\u2019",
    lsquo: "\u2018",
    apos: "'",
    quot: '"',
    amp: "&",
    nbsp: " ",
    lt: "<",
    gt: ">"
  })
);

/** One linear pass over `&...;` spans (no chained .replace). */
function decodeHtmlOnce(sIn) {
  const s = String(sIn || "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.charCodeAt(i) !== 38 /* & */) {
      out += s[i];
      i += 1;
      continue;
    }
    const semi = s.indexOf(";", i + 1);
    if (semi < 0 || semi - i > 48) {
      out += "&";
      i += 1;
      continue;
    }
    const inner = s.slice(i + 1, semi);
    let rep = null;

    if (/^#[Xx][0-9a-fA-F]+$/.test(inner)) {
      const code = Number.parseInt(inner.slice(2), 16);
      if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
        rep = String.fromCodePoint(code);
      }
    } else if (/^#[0-9]+$/.test(inner)) {
      const code = Number(inner.slice(1));
      if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
        rep = String.fromCodePoint(code);
      }
    } else {
      rep = NAMED_HTML_ENTITIES.get(inner.toLowerCase()) ?? null;
    }

    if (rep != null) {
      out += rep;
      i = semi + 1;
    } else {
      out += "&";
      i += 1;
    }
  }
  return out;
}

/**
 * Decode HTML entities (bounded passes so nested forms like &amp;#38; still resolve).
 */
function decodeHtml(input) {
  let cur = String(input || "");
  for (let p = 0; p < 12; p += 1) {
    const next = decodeHtmlOnce(cur);
    if (next === cur) {
      return cur;
    }
    cur = next;
  }
  return cur;
}

/** Decode HTML entities and collapse whitespace. */
function cleanText(input) {
  return decodeHtml(String(input || "")).replace(/\s+/g, " ").trim();
}

/** Strip HTML tags and collapse whitespace (linear scan; avoids ReDoS-prone tag regex). */
function stripHtml(input) {
  const s = String(input || "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, lt);
    const gt = s.indexOf(">", lt + 1);
    if (gt < 0) {
      out += s.slice(lt);
      break;
    }
    i = gt + 1;
    out += " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

function parseHtmlTagAttributes(tag) {
  const attrs = {};
  const pattern = /([^\s=/<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of String(tag || "").matchAll(pattern)) {
    const name = String(match[1] || "").trim().toLowerCase();
    if (!name) {
      continue;
    }
    attrs[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function extractMetaContent(html, keys) {
  const wanted = new Set((Array.isArray(keys) ? keys : [keys])
    .map((key) => String(key || "").trim().toLowerCase())
    .filter(Boolean));
  if (!wanted.size) {
    return "";
  }

  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseHtmlTagAttributes(match[0]);
    const identity = [
      attrs.property,
      attrs.name,
      attrs.itemprop,
      attrs["http-equiv"]
    ].map((value) => String(value || "").trim().toLowerCase());
    if (!identity.some((value) => wanted.has(value))) {
      continue;
    }
    const content = cleanText(attrs.content || attrs.value || "");
    if (content) {
      return content;
    }
  }

  return "";
}

/**
 * Infer broadcast cadence from an array of episodes with publishedTime fields.
 * Returns { cadence: "daily"|"weekly"|"irregular"|"unknown", averageDaysBetween: number|null }
 */
function inferCadence(episodes) {
  const times = episodes
    .map((item) => new Date(item.publishedTime || "").getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);

  if (times.length < 3) {
    return { cadence: "unknown", averageDaysBetween: null };
  }

  const dayDiffs = [];
  for (let i = 0; i < Math.min(times.length - 1, 8); i += 1) {
    dayDiffs.push(Math.abs(times[i] - times[i + 1]) / (1000 * 60 * 60 * 24));
  }

  const average = dayDiffs.reduce((sum, v) => sum + v, 0) / dayDiffs.length;

  if (average <= 2) return { cadence: "daily", averageDaysBetween: Number(average.toFixed(2)) };
  if (average <= 9) return { cadence: "weekly", averageDaysBetween: Number(average.toFixed(2)) };
  return { cadence: "irregular", averageDaysBetween: Number(average.toFixed(2)) };
}

module.exports = { decodeHtml, cleanText, stripHtml, extractMetaContent, inferCadence };
