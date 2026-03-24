// Shared utilities used across all source lib files (rte, bbc, nts, worldwidefm, fip).

/**
 * Decode HTML entities. Numeric references run before named entities so nested forms
 * resolve in one pass (shared across libs to avoid duplicate decode chains).
 */
function decodeHtml(input) {
  return String(input || "")
    .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
        return match;
      }
      return String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (match, num) => {
      const code = Number(num);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
        return match;
      }
      return String.fromCodePoint(code);
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&hellip;/g, "\u2026");
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

module.exports = { decodeHtml, cleanText, stripHtml, inferCadence };
