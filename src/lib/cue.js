const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveBundledFfmpegDir } = require("./downloader");

function cleanText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function sanitizeCueText(input) {
  return cleanText(input).replace(/"/g, "'");
}

function parseDurationToSeconds(input) {
  const match = String(input || "").match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }
  const hh = Number(match[1] || 0);
  const mm = Number(match[2] || 0);
  const ss = Number(match[3] || 0);
  return hh * 3600 + mm * 60 + ss;
}

function getAudioDurationSeconds(audioPath) {
  const ffmpegDir = resolveBundledFfmpegDir();
  const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const command = ffmpegDir ? path.join(ffmpegDir, ffmpegExe) : ffmpegExe;
  const result = spawnSync(command, ["-i", audioPath], {
    cwd: ffmpegDir || process.cwd(),
    encoding: "utf8",
    shell: false
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const durationMatch = text.match(/Duration:\s*([0-9:.]+)/i);
  return parseDurationToSeconds(durationMatch?.[1] || "") || null;
}

function detectSilenceBoundariesSeconds(audioPath) {
  const ffmpegDir = resolveBundledFfmpegDir();
  const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const command = ffmpegDir ? path.join(ffmpegDir, ffmpegExe) : ffmpegExe;
  const result = spawnSync(command, [
    "-i", audioPath,
    "-af", "silencedetect=noise=-30dB:d=1",
    "-f", "null",
    "-"
  ], {
    cwd: ffmpegDir || process.cwd(),
    encoding: "utf8",
    shell: false
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const raw = Array.from(text.matchAll(/silence_start:\s*([0-9.]+)/gi))
    .map((m) => Math.max(0, Math.floor(Number(m[1]))))
    .filter((n) => Number.isFinite(n));
  const out = [];
  for (const sec of raw) {
    if (!out.length || sec - out[out.length - 1] >= 45) {
      out.push(sec);
    }
  }
  return out;
}

function parseTimeTokenToSeconds(token) {
  const text = String(token || "").trim();
  if (!text) {
    return null;
  }
  const hhmmss = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (hhmmss) {
    return Number(hhmmss[1]) * 3600 + Number(hhmmss[2]) * 60 + Number(hhmmss[3]);
  }
  const mmss = text.match(/^(\d{1,3}):(\d{2})$/);
  if (mmss) {
    return Number(mmss[1]) * 60 + Number(mmss[2]);
  }
  return null;
}

function parseTrackLinesWithTimes(lines) {
  const tracks = [];
  for (const raw of lines) {
    const line = cleanText(raw);
    if (!line) {
      continue;
    }
    const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|–|—|\)|\.)\s*(.+)$/);
    if (!match) {
      continue;
    }
    const start = parseTimeTokenToSeconds(match[1]);
    const title = cleanText(match[2]);
    if (!title) {
      continue;
    }
    tracks.push({
      title,
      artist: "",
      startSeconds: Number.isFinite(start) ? start : null
    });
  }
  return tracks;
}

function normalizeTrack(input, index) {
  const title = cleanText(input?.title || input?.name || `Track ${index + 1}`);
  const artist = cleanText(input?.artist || input?.performer || "");
  const explicitStart = parseTimeTokenToSeconds(input?.time || "") ?? Number(input?.startSeconds);
  return {
    title,
    artist,
    startSeconds: Number.isFinite(explicitStart) ? Math.max(0, Math.floor(explicitStart)) : null
  };
}

function estimateOffsets(tracks, totalDurationSeconds, silenceBoundaries = []) {
  const normalized = (tracks || []).map((track, index) => normalizeTrack(track, index));
  if (!normalized.length) {
    return [];
  }

  const known = normalized
    .map((track, index) => ({ index, startSeconds: track.startSeconds }))
    .filter((item) => Number.isFinite(item.startSeconds))
    .sort((a, b) => a.index - b.index);

  if (!known.length) {
    if (silenceBoundaries.length >= normalized.length - 1) {
      return normalized.map((track, index) => ({
        ...track,
        startSeconds: index === 0 ? 0 : silenceBoundaries[index - 1]
      }));
    }
    const duration = Math.max(1, Number(totalDurationSeconds) || normalized.length * 180);
    const step = Math.max(1, Math.floor(duration / normalized.length));
    return normalized.map((track, index) => ({
      ...track,
      startSeconds: index * step
    }));
  }

  const out = normalized.map((track) => ({ ...track }));
  for (let i = 0; i < out.length; i += 1) {
    if (Number.isFinite(out[i].startSeconds)) {
      continue;
    }
    const prev = [...known].reverse().find((item) => item.index < i) || null;
    const next = known.find((item) => item.index > i) || null;
    if (prev && next && next.index > prev.index) {
      const span = next.index - prev.index;
      const delta = (next.startSeconds - prev.startSeconds) / span;
      out[i].startSeconds = Math.max(0, Math.floor(prev.startSeconds + delta * (i - prev.index)));
      continue;
    }
    if (prev) {
      out[i].startSeconds = Math.max(0, Math.floor(prev.startSeconds + 180 * (i - prev.index)));
      continue;
    }
    if (next) {
      out[i].startSeconds = Math.max(0, Math.floor(next.startSeconds - 180 * (next.index - i)));
      continue;
    }
    out[i].startSeconds = i * 180;
  }

  return out;
}

function secondsToCueTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}:00`;
}

function secondsToDisplay(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  if (hh > 0) {
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function parseExternalTracklistHtml(html) {
  const lines = String(html || "").split(/\r?\n/g);
  return parseTrackLinesWithTimes(lines);
}

async function tryExternalTracklist(tracklistUrl) {
  const url = cleanText(tracklistUrl);
  if (!url) {
    return [];
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
  if (!response.ok) {
    throw new Error(`Tracklist URL fetch failed: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  return parseExternalTracklistHtml(html);
}

async function searchCommonTracklistSites(query) {
  const q = cleanText(query);
  if (!q) {
    return [];
  }
  const candidates = [
    `https://www.1001tracklists.com/search/result.php?q=${encodeURIComponent(q)}`,
    `https://www.mixesdb.com/w/index.php?search=${encodeURIComponent(q)}`
  ];

  for (const searchUrl of candidates) {
    try {
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      if (!response.ok) {
        continue;
      }
      const html = await response.text();
      const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
        .map((m) => String(m[1] || "").trim())
        .filter(Boolean);
      const first = hrefs.find((href) => /1001tracklists\.com\/tracklist\/|mixesdb\.com\/w\//i.test(href));
      if (!first) {
        continue;
      }
      const url = first.startsWith("http")
        ? first
        : (first.startsWith("/") ? new URL(first, searchUrl).toString() : "");
      if (!url) {
        continue;
      }
      const tracks = await tryExternalTracklist(url);
      if (tracks.length) {
        return tracks;
      }
    } catch {}
  }

  return [];
}

async function generateCueForAudio({
  audioPath,
  episodeTitle,
  programTitle,
  sourceType = "rte",
  episodeUrl = "",
  tracklistUrl = "",
  getRteTracks,
  getBbcTracks
}) {
  const resolvedPath = path.resolve(String(audioPath || ""));
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error("Audio file was not found for CUE generation.");
  }

  let source = "none";
  let tracks = [];

  if (tracklistUrl) {
    try {
      tracks = await tryExternalTracklist(tracklistUrl);
      if (tracks.length) {
        source = "external-tracklist";
      }
    } catch {}
  }

  if (!tracks.length && sourceType === "rte" && typeof getRteTracks === "function" && episodeUrl) {
    try {
      const payload = await getRteTracks(episodeUrl);
      tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
      if (tracks.length) {
        source = "rte-episode-playlist";
      }
    } catch {}
  }

  if (!tracks.length && sourceType === "bbc" && typeof getBbcTracks === "function" && episodeUrl) {
    try {
      const payload = await getBbcTracks(episodeUrl);
      tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
      if (tracks.length) {
        source = "bbc-music-played";
      }
    } catch {}
  }

  if (!tracks.length) {
    tracks = await searchCommonTracklistSites(`${programTitle || ""} ${episodeTitle || ""}`);
    if (tracks.length) {
      source = "common-tracklist-sites";
    }
  }

  if (!tracks.length) {
    throw new Error("No tracklist could be found for this episode.");
  }

  const duration = getAudioDurationSeconds(resolvedPath);
  const silenceBoundaries = detectSilenceBoundariesSeconds(resolvedPath);
  const withOffsets = estimateOffsets(tracks, duration, silenceBoundaries);
  const chapters = withOffsets.map((track, index) => ({
    index: index + 1,
    title: track.title,
    artist: track.artist,
    startSeconds: Math.max(0, Math.floor(track.startSeconds || 0)),
    start: secondsToDisplay(track.startSeconds || 0)
  }));

  const cueLines = [];
  cueLines.push(`PERFORMER "${sanitizeCueText(programTitle || "Unknown Program")}"`);
  cueLines.push(`TITLE "${sanitizeCueText(episodeTitle || path.basename(resolvedPath, path.extname(resolvedPath)))}"`);
  cueLines.push(`FILE "${sanitizeCueText(path.basename(resolvedPath))}" MP3`);
  for (const chapter of chapters) {
    cueLines.push(`  TRACK ${String(chapter.index).padStart(2, "0")} AUDIO`);
    cueLines.push(`    TITLE "${sanitizeCueText(chapter.title)}"`);
    if (chapter.artist) {
      cueLines.push(`    PERFORMER "${sanitizeCueText(chapter.artist)}"`);
    }
    cueLines.push(`    INDEX 01 ${secondsToCueTime(chapter.startSeconds)}`);
  }
  cueLines.push("");

  const cuePath = `${resolvedPath}.cue`;
  fs.writeFileSync(cuePath, cueLines.join("\n"), "utf8");

  return {
    cuePath,
    source,
    durationSeconds: duration,
    chapters
  };
}

module.exports = {
  generateCueForAudio
};
