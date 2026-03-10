const fs = require("node:fs");
const path = require("node:path");

function cueTimeToSeconds(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return 0;
  }
  const mm = Number(match[1]);
  const ss = Number(match[2]);
  const ff = Number(match[3]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || !Number.isFinite(ff)) {
    return 0;
  }
  return Math.max(0, mm * 60 + ss + ff / 75);
}

function secondsToClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  if (hh > 0) {
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function extractQuoted(text) {
  const match = String(text || "").match(/"([^"]*)"/);
  return match ? String(match[1] || "").trim() : "";
}

function readCueChaptersForAudio(outputDir, fileName) {
  const dir = path.resolve(String(outputDir || "").trim());
  const name = String(fileName || "").trim();
  if (!dir || !name) {
    return [];
  }

  const cuePath = path.resolve(dir, `${name}.cue`);
  if (!fs.existsSync(cuePath)) {
    return [];
  }

  const text = fs.readFileSync(cuePath, "utf8");
  const lines = text.split(/\r?\n/);
  const chapters = [];
  let current = null;

  function commitCurrent() {
    if (!current || !current.title) {
      return;
    }
    chapters.push({
      startSeconds: Math.max(0, Number(current.startSeconds || 0)),
      start: secondsToClock(current.startSeconds || 0),
      title: String(current.title || "").trim(),
      artist: String(current.artist || "").trim()
    });
  }

  for (const raw of lines) {
    const line = String(raw || "").trim();
    if (!line) {
      continue;
    }
    if (/^TRACK\s+\d+\s+AUDIO/i.test(line)) {
      commitCurrent();
      current = { title: "", artist: "", startSeconds: 0 };
      continue;
    }
    if (!current) {
      continue;
    }
    if (/^TITLE\s+/i.test(line)) {
      current.title = extractQuoted(line);
      continue;
    }
    if (/^PERFORMER\s+/i.test(line)) {
      current.artist = extractQuoted(line);
      continue;
    }
    const indexMatch = line.match(/^INDEX\s+01\s+(\d{1,2}:\d{2}:\d{2})/i);
    if (indexMatch) {
      current.startSeconds = cueTimeToSeconds(indexMatch[1]);
    }
  }
  commitCurrent();

  return chapters
    .sort((a, b) => Number(a.startSeconds || 0) - Number(b.startSeconds || 0))
    .filter((row) => row.title);
}

module.exports = {
  readCueChaptersForAudio
};

