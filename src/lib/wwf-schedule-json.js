"use strict";

/**
 * Parse the Worldwide FM schedule JSON array embedded in HTML (backslash-escaped quotes).
 * Uses iterative JSON.parse attempts so unescaping is not chained in one expression.
 */
function parseWwfScheduleJsonSlice(slice) {
  const raw = String(slice || "");
  if (!raw.length) {
    return [];
  }
  let candidate = raw;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const v = JSON.parse(candidate);
      return Array.isArray(v) ? v : [];
    } catch {
      const next = candidate.replace(/\\"/g, '"');
      if (next !== candidate) {
        candidate = next;
        continue;
      }
      const nextBs = candidate.replace(/\\\\/g, "\\");
      if (nextBs !== candidate) {
        candidate = nextBs;
        continue;
      }
      break;
    }
  }
  return [];
}

module.exports = { parseWwfScheduleJsonSlice };
