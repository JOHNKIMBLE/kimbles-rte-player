const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { resolveBundledFfmpegDir } = require("./downloader");

function getVendorRootCandidates() {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const isAsarRoot = path.basename(projectRoot).toLowerCase() === "app.asar";
  const candidates = isAsarRoot
    ? [path.join(path.dirname(projectRoot), "app.asar.unpacked", "vendor")]
    : [path.join(projectRoot, "vendor")];
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "app.asar.unpacked", "vendor"));
    candidates.push(path.join(process.resourcesPath, "vendor"));
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

function cleanText(input) {
  return decodeHtmlEntities(String(input || "")).replace(/\s+/g, " ").trim();
}

function emitProgress(callback, payload = {}) {
  if (typeof callback !== "function") {
    return;
  }
  try {
    callback({
      kind: "cue",
      ...payload
    });
  } catch {}
}

function decodeHtmlEntities(input) {
  return String(input || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&#([0-9]+);/g, (_match, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function sanitizeCueText(input) {
  return cleanText(decodeHtmlEntities(input)).replace(/"/g, "'");
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

function runFfmpeg(args = [], _audioPath) {
  const ffmpegDir = resolveBundledFfmpegDir();
  const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const command = ffmpegDir ? path.join(ffmpegDir, ffmpegExe) : ffmpegExe;
  return spawnSync(command, args, {
    cwd: ffmpegDir || process.cwd(),
    encoding: "utf8",
    shell: false
  });
}

function runCommand(command, args = [], options = {}) {
  try {
    return spawnSync(command, args, {
      encoding: "utf8",
      shell: false,
      timeout: Number(options.timeoutMs || 30000)
    });
  } catch (error) {
    return {
      status: 1,
      stdout: "",
      stderr: String(error?.message || error || "")
    };
  }
}

function getAudioDurationSeconds(audioPath) {
  const result = runFfmpeg(["-i", audioPath], audioPath);
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const durationMatch = text.match(/Duration:\s*([0-9:.]+)/i);
  return parseDurationToSeconds(durationMatch?.[1] || "") || null;
}

function uniqSortedIntegers(values, minGapSeconds = 20) {
  const sorted = (Array.isArray(values) ? values : [])
    .map((value) => Math.max(0, Math.floor(Number(value))))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const out = [];
  for (const value of sorted) {
    if (!out.length || value - out[out.length - 1] >= minGapSeconds) {
      out.push(value);
    }
  }
  return out;
}

function detectSilenceBoundariesSeconds(audioPath) {
  const passA = runFfmpeg([
    "-i", audioPath,
    "-af", "silencedetect=noise=-30dB:d=0.9",
    "-f", "null",
    "-"
  ], audioPath);
  const passB = runFfmpeg([
    "-i", audioPath,
    "-af", "silencedetect=noise=-26dB:d=0.5",
    "-f", "null",
    "-"
  ], audioPath);
  const text = `${passA.stdout || ""}\n${passA.stderr || ""}\n${passB.stdout || ""}\n${passB.stderr || ""}`;
  const starts = Array.from(text.matchAll(/silence_start:\s*([0-9.]+)/gi))
    .map((match) => Number(match[1]));
  const ends = Array.from(text.matchAll(/silence_end:\s*([0-9.]+)/gi))
    .map((match) => Number(match[1]));
  const boundaries = []
    .concat(starts, ends)
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, Math.floor(value)));
  return uniqSortedIntegers(boundaries, 20);
}

function parseFilterMetricSamples(text, patterns = []) {
  const lines = String(text || "").split(/\r?\n/);
  const samples = [];
  let pendingTime = null;
  for (const line of lines) {
    const timeMatch = line.match(/pts_time:([0-9.]+)/i);
    if (timeMatch) {
      pendingTime = Number(timeMatch[1]);
      continue;
    }
    if (!Number.isFinite(pendingTime)) {
      continue;
    }
    for (const pattern of patterns) {
      const metricMatch = line.match(pattern);
      if (!metricMatch) {
        continue;
      }
      const value = Number(metricMatch[1]);
      if (Number.isFinite(value)) {
        samples.push({ t: pendingTime, value });
      }
      break;
    }
  }
  return samples;
}

function averageWindow(samples = [], startIndex = 0, endIndex = 0) {
  const start = Math.max(0, Math.floor(startIndex));
  const end = Math.min(samples.length - 1, Math.floor(endIndex));
  if (!samples.length || end < start) {
    return null;
  }
  let total = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    const value = Number(samples[i]?.value);
    if (!Number.isFinite(value)) {
      continue;
    }
    total += value;
    count += 1;
  }
  return count ? total / count : null;
}

function detectLoudnessBoundariesSeconds(audioPath) {
  const result = runFfmpeg([
    "-i", audioPath,
    "-af", "ebur128=metadata=1,ametadata=mode=print:file=-",
    "-f", "null",
    "-"
  ], audioPath);
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const samples = parseFilterMetricSamples(text, [
    /lavfi\.r128\.M=([-0-9.]+)/i,
    /\bM=([-0-9.]+)/i
  ]);
  if (samples.length < 16) {
    return [];
  }
  const boundaries = [];
  let lastAccepted = -9999;
  for (let i = 8; i < samples.length; i += 1) {
    const prevAvg = averageWindow(samples, i - 8, i - 4);
    const currAvg = averageWindow(samples, i - 3, i);
    const currentTime = Number(samples[i]?.t || 0);
    if (!Number.isFinite(prevAvg) || !Number.isFinite(currAvg) || !Number.isFinite(currentTime)) {
      continue;
    }
    const delta = Math.abs(currAvg - prevAvg);
    if (delta >= 4.5 && currentTime - lastAccepted >= 18) {
      boundaries.push(currentTime);
      lastAccepted = currentTime;
    }
  }
  return uniqSortedIntegers(boundaries, 18);
}

function detectSpectralFluxBoundariesSeconds(audioPath) {
  const result = runFfmpeg([
    "-i", audioPath,
    "-af", "aspectralstats=measure=flux:win_size=2048:overlap=0.75,ametadata=mode=print:file=-",
    "-f", "null",
    "-"
  ], audioPath);
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  const samples = parseFilterMetricSamples(text, [
    /(?:^|[.=])flux=([0-9.+\-eE]+)/i
  ]);
  if (samples.length < 20) {
    return [];
  }
  const values = samples
    .map((sample) => Number(sample.value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!values.length) {
    return [];
  }
  const median = values[Math.floor(values.length * 0.5)] || 0;
  const p90 = values[Math.max(0, Math.min(values.length - 1, Math.floor(values.length * 0.9)))] || 0;
  const threshold = Math.max(p90, median * 2.5, 0.05);
  const boundaries = [];
  let lastAccepted = -9999;
  for (let i = 1; i < samples.length - 1; i += 1) {
    const prev = Number(samples[i - 1]?.value || 0);
    const curr = Number(samples[i]?.value || 0);
    const next = Number(samples[i + 1]?.value || 0);
    const currentTime = Number(samples[i]?.t || 0);
    if (!Number.isFinite(curr) || !Number.isFinite(currentTime)) {
      continue;
    }
    if (curr >= prev && curr >= next && curr >= threshold && currentTime - lastAccepted >= 18) {
      boundaries.push(currentTime);
      lastAccepted = currentTime;
    }
  }
  return uniqSortedIntegers(boundaries, 18);
}

function parseTimeTokenToSeconds(token) {
  const text = cleanText(token);
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
  const hmsWords = text.match(/^(?:(\d{1,2})h)?\s*(?:(\d{1,2})m)?\s*(?:(\d{1,2})s)?$/i);
  if (hmsWords && (hmsWords[1] || hmsWords[2] || hmsWords[3])) {
    return Number(hmsWords[1] || 0) * 3600 + Number(hmsWords[2] || 0) * 60 + Number(hmsWords[3] || 0);
  }
  return null;
}

function splitArtistTitle(rawTitle) {
  const text = cleanText(rawTitle);
  const pair = text.match(/^(.+?)\s[-\u2013\u2014]\s(.+)$/);
  if (!pair) {
    return { title: text, artist: "" };
  }
  return {
    artist: cleanText(pair[1]),
    title: cleanText(pair[2])
  };
}

function parseTrackLinesWithTimes(lines) {
  const tracks = [];
  for (const raw of Array.isArray(lines) ? lines : []) {
    const line = cleanText(raw);
    if (!line) {
      continue;
    }
    const matchA = line.match(/^(?:#?\d{1,3}\s*[.)-]?\s*)?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:-|–|—|\||\)|\.)?\s*(.+)$/);
    const matchB = line.match(/^(.+?)\s*(?:-|–|—|\|)\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?$/);
    let stamp;
    let rest;
    if (matchA) {
      stamp = matchA[1];
      rest = matchA[2];
    } else if (matchB) {
      stamp = matchB[2];
      rest = matchB[1];
    } else {
      continue;
    }
    const start = parseTimeTokenToSeconds(stamp);
    if (!Number.isFinite(start)) {
      continue;
    }
    const split = splitArtistTitle(rest);
    if (!split.title) {
      continue;
    }
    tracks.push({
      title: split.title,
      artist: split.artist,
      startSeconds: Math.max(0, Math.floor(start))
    });
  }
  return tracks;
}

function htmlToCandidateLines(html) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<\/(?:li|tr|p|div|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(text)
    .split(/\r?\n/g)
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function parseTrackRowsFromHtmlByRegex(html) {
  const tracks = [];
  const rowPattern = /(?:^|>)(?:\s*#?\d{1,3}\s*[.)-]?\s*)?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:-|–|—|\||\)|\.)\s*([^<\n\r]{4,220})/gi;
  for (const match of String(html || "").matchAll(rowPattern)) {
    const start = parseTimeTokenToSeconds(match[1]);
    const split = splitArtistTitle(match[2]);
    if (!Number.isFinite(start) || !split.title) {
      continue;
    }
    tracks.push({
      title: split.title,
      artist: split.artist,
      startSeconds: Math.max(0, Math.floor(start))
    });
  }
  return tracks;
}

function isTrackMetadataNoise(title, artist = "") {
  const text = `${cleanText(title)} ${cleanText(artist)}`.toLowerCase();
  if (!text) {
    return true;
  }
  const blockedSnippets = [
    "trackid.net",
    "tracklist integration",
    "diff history",
    "talk contribs",
    "created new page",
    "uploaded file",
    " file:",
    "http://",
    "https://"
  ];
  if (blockedSnippets.some((snippet) => text.includes(snippet))) {
    return true;
  }
  if (/\.(jpg|jpeg|png|webp|gif)\b/i.test(text)) {
    return true;
  }
  if (cleanText(title).length > 140) {
    return true;
  }
  return false;
}

function dedupeTracksWithTimes(tracks) {
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(tracks) ? tracks : []) {
    const key = `${Math.floor(Number(row?.startSeconds || 0))}|${cleanText(row?.title).toLowerCase()}`;
    if (!row?.title || seen.has(key) || isTrackMetadataNoise(row?.title, row?.artist)) {
      continue;
    }
    seen.add(key);
    out.push({
      title: cleanText(row.title),
      artist: cleanText(row.artist),
      startSeconds: Math.max(0, Math.floor(Number(row.startSeconds || 0)))
    });
  }
  return out.sort((a, b) => a.startSeconds - b.startSeconds);
}

function parseExternalTracklistHtml(url, html) {
  const host = String(new URL(url).hostname || "").toLowerCase();
  if (host.includes("trackid.net")) {
    return [];
  }
  const lines = htmlToCandidateLines(html);
  const byLines = parseTrackLinesWithTimes(lines);
  const byRegex = parseTrackRowsFromHtmlByRegex(html);
  const merged = dedupeTracksWithTimes(byLines.concat(byRegex));
  if (merged.length) {
    return merged;
  }
  // Host-specific extra pass can be extended later if needed.
  if (host.includes("mixesdb") || host.includes("1001tracklists")) {
    return dedupeTracksWithTimes(parseTrackLinesWithTimes(lines));
  }
  return [];
}

async function tryExternalTracklist(tracklistUrl) {
  const url = cleanText(tracklistUrl);
  if (!url) {
    return [];
  }
  try {
    const host = String(new URL(url).hostname || "").toLowerCase();
    if (host.includes("trackid.net")) {
      return [];
    }
  } catch {}
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
  if (!response.ok) {
    throw new Error(`Tracklist URL fetch failed: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  return parseExternalTracklistHtml(url, html);
}

function normalizeLink(href, baseUrl) {
  const raw = cleanText(href);
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeTrackKey(value) {
  return cleanText(decodeHtmlEntities(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseFpcalcOutput(text) {
  const raw = String(text || "");
  const duration = Number(raw.match(/(?:^|\n)DURATION=([0-9.]+)/i)?.[1] || 0);
  const fingerprint = String(raw.match(/(?:^|\n)FINGERPRINT=([A-Za-z0-9,+=/_-]+)/i)?.[1] || "").trim();
  if (!fingerprint) {
    return null;
  }
  return {
    duration: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : null,
    fingerprint
  };
}

function tryFfmpegChromaprint(audioPath) {
  const result = runFfmpeg([
    "-i", audioPath,
    "-map", "0:a:0",
    "-ac", "1",
    "-ar", "11025",
    "-f", "chromaprint",
    "-"
  ], audioPath);
  const parsed = parseFpcalcOutput(`${result.stdout || ""}\n${result.stderr || ""}`);
  if (parsed?.fingerprint) {
    return parsed;
  }
  const stderr = cleanText(result.stderr || result.stdout || "");
  if (stderr) {
    return {
      fingerprint: "",
      duration: null,
      debugMessage: `ffmpeg chromaprint unavailable: ${stderr.slice(0, 180)}`
    };
  }
  return null;
}

function tryFpcalcBinary(audioPath) {
  const fpcalcPath = resolveFpcalcBinary();
  try {
    const result = spawnSync(fpcalcPath, ["-json", "-ignore-errors", audioPath], {
      encoding: "utf8",
      shell: false,
      cwd: path.isAbsolute(fpcalcPath) ? path.dirname(fpcalcPath) : process.cwd(),
      timeout: 30000,
      windowsHide: true
    });
    if (result.error) {
      return {
        fingerprint: "",
        duration: null,
        debugMessage: `fpcalc spawn failed (${fpcalcPath}): ${cleanText(result.error.message || "")}`
      };
    }
    const text = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    if (!text) {
      return {
        fingerprint: "",
        duration: null,
        debugMessage: `fpcalc returned no output (${fpcalcPath}, status ${Number(result.status)})`
      };
    }
    try {
      const payload = JSON.parse(text);
      const fp = String(payload?.fingerprint || "").trim();
      const duration = Number(payload?.duration || 0);
      if (!fp) {
        return {
          fingerprint: "",
          duration: null,
          debugMessage: `fpcalc returned no fingerprint (${fpcalcPath}, status ${Number(result.status)})`
        };
      }
      return {
        fingerprint: fp,
        duration: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : null
      };
    } catch {
      const parsed = parseFpcalcOutput(text);
      if (parsed?.fingerprint) {
        return parsed;
      }
      return {
        fingerprint: "",
        duration: null,
        debugMessage: `fpcalc output parse failed (${fpcalcPath}, status ${Number(result.status)}): ${cleanText(text).slice(0, 180)}`
      };
    }
  } catch (error) {
    return {
      fingerprint: "",
      duration: null,
      debugMessage: `fpcalc execution threw (${fpcalcPath}): ${cleanText(error?.message || error || "")}`
    };
  }
}

function getAudioFingerprint(audioPath) {
  const viaFfmpeg = tryFfmpegChromaprint(audioPath);
  if (viaFfmpeg?.fingerprint) {
    return viaFfmpeg;
  }
  const viaFpcalc = tryFpcalcBinary(audioPath);
  if (viaFpcalc?.fingerprint) {
    return viaFpcalc;
  }
  return {
    fingerprint: "",
    duration: null,
    debugMessage: viaFpcalc?.debugMessage || viaFfmpeg?.debugMessage || "No fingerprint provider succeeded"
  };
}

async function lookupAcoustId({ apiKey, fingerprint, duration }) {
  const client = cleanText(apiKey);
  const fp = cleanText(fingerprint);
  if (!client || !fp || !Number.isFinite(Number(duration)) || Number(duration) <= 0) {
    return null;
  }
  const params = new URLSearchParams();
  params.set("client", client);
  params.set("meta", "recordings+releasegroups+tracks+compress");
  params.set("duration", String(Math.max(1, Math.floor(Number(duration)))));
  params.set("fingerprint", fp);
  params.set("format", "json");

  const response = await fetch(`https://api.acoustid.org/v2/lookup?${params.toString()}`, {
    headers: {
      "User-Agent": "Kimble-RTE-BBC-Downloader/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`AcoustID lookup failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const top = results
    .map((result) => ({
      score: Number(result?.score || 0),
      recording: Array.isArray(result?.recordings) ? result.recordings[0] : null
    }))
    .filter((row) => row.recording)
    .sort((a, b) => b.score - a.score)[0];
  if (!top?.recording) {
    return null;
  }
  const title = cleanText(top.recording?.title || "");
  const artist = cleanText((Array.isArray(top.recording?.artists) ? top.recording.artists.map((a) => a?.name).filter(Boolean).join(", ") : ""));
  if (!title && !artist) {
    return null;
  }
  return {
    score: Number.isFinite(top.score) ? Number(top.score.toFixed(3)) : 0,
    title,
    artist,
    recordingId: cleanText(top.recording?.id || "")
  };
}

async function lookupAuddFromFile({ apiToken, filePath }) {
  const token = cleanText(apiToken);
  const sourceFile = cleanText(filePath);
  if (!token || !sourceFile || !fs.existsSync(sourceFile)) {
    return null;
  }

  const audioBuffer = fs.readFileSync(sourceFile);
  if (!audioBuffer.length) {
    return null;
  }

  const form = new FormData();
  form.set("api_token", token);
  form.set("return", "apple_music,spotify");
  form.set("file", new Blob([audioBuffer], { type: "audio/wav" }), path.basename(sourceFile));

  const response = await fetch("https://api.audd.io/", {
    method: "POST",
    body: form,
    headers: {
      "User-Agent": "Kimble-RTE-BBC-Downloader/1.0"
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`AudD lookup failed: ${response.status} ${response.statusText}`);
  }
  if (String(payload?.status || "").toLowerCase() === "error") {
    const detail = cleanText(
      payload?.error?.error_message ||
      payload?.error?.message ||
      payload?.error?.error_code ||
      ""
    );
    throw new Error(detail ? `AudD error: ${detail}` : "AudD returned an error");
  }

  const result = payload?.result;
  const first = Array.isArray(result) ? result[0] : result;
  const title = cleanText(first?.title || "");
  const artist = cleanText(first?.artist || "");
  if (!title && !artist) {
    return null;
  }
  const score = Number(first?.score || 0);
  return {
    title,
    artist,
    album: cleanText(first?.album || ""),
    releaseDate: cleanText(first?.release_date || ""),
    timecode: cleanText(first?.timecode || ""),
    songLink: cleanText(first?.song_link || ""),
    score: Number.isFinite(score) ? Number(score) : 0
  };
}

function extractSongrecPayloadText(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return "";
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return text.slice(first, last + 1);
  }
  return text;
}

function parseSongrecResult(raw) {
  try {
    const json = JSON.parse(extractSongrecPayloadText(raw));
    const track = json?.track || json?.result || json;
    const title = cleanText(track?.title || track?.name || "");
    const artist = cleanText(track?.subtitle || track?.artist || "");
    if (!title) {
      return null;
    }
    return {
      title,
      artist
    };
  } catch {
    return null;
  }
}

function resolveSongrecBinary() {
  const envBin = cleanText(process.env.SONGREC_BIN || "");
  if (envBin) {
    return envBin;
  }

  const exe = process.platform === "win32" ? "songrec.exe" : "songrec";
  const platformId = process.platform === "win32"
    ? (process.arch === "arm64" ? "win32-arm64" : "win32-x64")
    : process.platform === "darwin"
      ? (process.arch === "arm64" ? "darwin-arm64" : "darwin-x64")
      : (process.arch === "arm64" ? "linux-arm64" : "linux-x64");

  for (const vendorRoot of getVendorRootCandidates()) {
    const candidates = [
      path.join(vendorRoot, "songrec", "bin", platformId, exe),
      path.join(vendorRoot, "songrec", "bin", exe),
      path.join(vendorRoot, "songrec", exe)
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return "songrec";
}

function resolveFpcalcBinary() {
  const envBin = cleanText(process.env.FPCALC_BIN || process.env.FPCALC || "");
  if (envBin) {
    return envBin;
  }

  const exe = process.platform === "win32" ? "fpcalc.exe" : "fpcalc";
  const platformId = process.platform === "win32"
    ? (process.arch === "arm64" ? "win32-arm64" : "win32-x64")
    : process.platform === "darwin"
      ? (process.arch === "arm64" ? "darwin-arm64" : "darwin-x64")
      : (process.arch === "arm64" ? "linux-arm64" : "linux-x64");

  for (const vendorRoot of getVendorRootCandidates()) {
    const candidates = [
      path.join(vendorRoot, "chromaprint", "bin", platformId, exe),
      path.join(vendorRoot, "chromaprint", "bin", exe),
      path.join(vendorRoot, "chromaprint", exe)
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const execDir = process.execPath ? path.dirname(process.execPath) : "";
  if (execDir) {
    const execCandidates = [
      path.join(execDir, "resources", "app.asar.unpacked", "vendor", "chromaprint", "bin", platformId, exe),
      path.join(execDir, "resources", "vendor", "chromaprint", "bin", platformId, exe)
    ];
    for (const candidate of execCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return "fpcalc";
}

function extractAudioSnippetToWav(audioPath, startSeconds, durationSeconds, outFile) {
  const safeStart = String(Math.max(0, Number(startSeconds || 0)));
  const safeDuration = String(Math.max(5, Number(durationSeconds || 20)));
  const isRemote = isRemoteInputSource(audioPath);
  let remoteRequestArgs = [];
  if (isRemote) {
    try {
      const remoteUrl = new URL(String(audioPath || ""));
      const host = String(remoteUrl.hostname || "").toLowerCase();
      if (host.includes("rasset.ie") || host.includes("rte.ie")) {
        remoteRequestArgs = [
          "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "-headers", "Referer: https://www.rte.ie/\r\nOrigin: https://www.rte.ie\r\n"
        ];
      } else if (host.includes("bbc.co.uk") || host.includes("bbc.com")) {
        remoteRequestArgs = [
          "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "-headers", "Referer: https://www.bbc.co.uk/\r\nOrigin: https://www.bbc.co.uk\r\n"
        ];
      }
    } catch {}
  }
  const sharedArgs = [
    "-y",
    "-vn",
    "-ac", "1",
    "-ar", "44100",
    "-f", "wav",
    outFile
  ];

  const attempts = isRemote
    ? [
        [
          "-rw_timeout", "15000000",
          "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
          ...remoteRequestArgs,
          "-i", audioPath,
          "-ss", safeStart,
          "-t", safeDuration,
          ...sharedArgs
        ],
        [
          "-rw_timeout", "15000000",
          "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
          ...remoteRequestArgs,
          "-ss", safeStart,
          "-t", safeDuration,
          "-i", audioPath,
          ...sharedArgs
        ]
      ]
    : [[
        "-y",
        "-ss", safeStart,
        "-t", safeDuration,
        "-i", audioPath,
        "-vn",
        "-ac", "1",
        "-ar", "44100",
        "-f", "wav",
        outFile
      ]];

  for (const args of attempts) {
    const result = runFfmpeg(args, audioPath);
    if (result.status === 0 && fs.existsSync(outFile)) {
      return true;
    }
    try {
      if (fs.existsSync(outFile)) {
        fs.rmSync(outFile, { force: true });
      }
    } catch {}
  }
  return false;
}

function pickSongrecOffsets(durationSeconds, maxSamples = 8, sampleSeconds = 20) {
  const total = Math.max(0, Math.floor(Number(durationSeconds || 0)));
  const count = Math.max(1, Math.min(20, Math.floor(Number(maxSamples || 8))));
  const sample = Math.max(8, Math.floor(Number(sampleSeconds || 20)));
  if (total <= sample + 2) {
    return [0];
  }
  const room = Math.max(1, total - sample);
  if (count === 1) {
    return [Math.floor(room / 2)];
  }
  const step = room / (count - 1);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(Math.max(0, Math.min(room, Math.floor(i * step))));
  }
  return uniqSortedIntegers(out, Math.max(6, Math.floor(sample * 0.5)));
}

function computeSongrecAutoSampleCount(durationSeconds, targetTrackCount, sampleSeconds = 20) {
  const duration = Math.max(0, Math.floor(Number(durationSeconds || 0)));
  const tracks = Math.max(0, Math.floor(Number(targetTrackCount || 0)));
  const sample = Math.max(8, Math.floor(Number(sampleSeconds || 20)));
  const hardCap = 48;
  const durationCap = Math.max(8, Math.min(hardCap, Math.ceil(duration / 120)));
  const desired = tracks > 0
    ? Math.ceil(tracks * 1.5)
    : Math.ceil(duration / Math.max(360, sample * 18));
  return Math.max(6, Math.min(durationCap, desired || 8));
}

function computeRecognitionSampleCount(audioPath, durationSeconds, targetTrackCount, sampleSeconds = 20) {
  const duration = Math.max(0, Math.floor(Number(durationSeconds || 0)));
  const tracks = Math.max(0, Math.floor(Number(targetTrackCount || 0)));
  const base = computeSongrecAutoSampleCount(duration, tracks, sampleSeconds);
  const isRemote = isRemoteInputSource(audioPath);
  const looksLikeHls = /\.m3u8(?:$|[?#])/i.test(String(audioPath || ""));
  if (!isRemote) {
    return base;
  }
  const remoteFloor = tracks > 0
    ? Math.max(Math.ceil(tracks * 2.5), Math.ceil(duration / 180))
    : Math.ceil(duration / 120);
  const cap = looksLikeHls ? 96 : 48;
  return Math.max(base, Math.min(cap, Math.max(10, remoteFloor || 10)));
}

const HLS_MANIFEST_CACHE = new Map();

function parseM3u8Manifest(text, manifestUrl) {
  const lines = String(text || "").split(/\r?\n/);
  const segments = [];
  const variants = [];
  let pendingDuration = null;
  let pendingVariant = false;
  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) {
      continue;
    }
    if (/^#EXT-X-STREAM-INF:/i.test(line)) {
      pendingVariant = true;
      continue;
    }
    if (/^#EXTINF:/i.test(line)) {
      const durationMatch = line.match(/^#EXTINF:([0-9.]+)/i);
      pendingDuration = Number(durationMatch?.[1] || 0);
      continue;
    }
    if (line.startsWith("#")) {
      continue;
    }
    const absoluteUrl = normalizeLink(line, manifestUrl);
    if (!absoluteUrl) {
      pendingVariant = false;
      pendingDuration = null;
      continue;
    }
    if (pendingVariant) {
      variants.push(absoluteUrl);
      pendingVariant = false;
      continue;
    }
    if (Number.isFinite(pendingDuration) && pendingDuration > 0) {
      segments.push({
        url: absoluteUrl,
        duration: pendingDuration
      });
    }
    pendingDuration = null;
  }
  return {
    segments,
    variants
  };
}

async function fetchHlsManifestInfo(manifestUrl, depth = 0) {
  const url = cleanText(manifestUrl);
  if (!url) {
    return null;
  }
  const cacheKey = `${depth}:${url}`;
  if (HLS_MANIFEST_CACHE.has(cacheKey)) {
    return HLS_MANIFEST_CACHE.get(cacheKey);
  }
  const promise = (async () => {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`HLS manifest fetch failed: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const parsed = parseM3u8Manifest(text, url);
    if (parsed.segments.length) {
      const segmentStarts = [];
      let running = 0;
      for (const segment of parsed.segments) {
        segmentStarts.push(Math.max(0, Math.floor(running)));
        running += Number(segment.duration || 0);
      }
      return {
        manifestUrl: url,
        segmentCount: parsed.segments.length,
        durationSeconds: Math.max(0, Math.floor(running)),
        segmentStarts
      };
    }
    if (depth >= 2 || !parsed.variants.length) {
      return null;
    }
    const preferredVariants = parsed.variants.slice(-2).reverse().concat(parsed.variants.slice(0, -2));
    for (const variantUrl of preferredVariants) {
      try {
        const variantInfo = await fetchHlsManifestInfo(variantUrl, depth + 1);
        if (variantInfo?.segmentCount) {
          return variantInfo;
        }
      } catch {}
    }
    return null;
  })();
  HLS_MANIFEST_CACHE.set(cacheKey, promise);
  try {
    return await promise;
  } catch (error) {
    HLS_MANIFEST_CACHE.delete(cacheKey);
    throw error;
  }
}

function pickHlsSegmentOffsets(manifestInfo, maxSamples = 8, sampleSeconds = 20) {
  const segmentStarts = Array.isArray(manifestInfo?.segmentStarts) ? manifestInfo.segmentStarts : [];
  const segmentCount = Math.max(0, Math.floor(Number(manifestInfo?.segmentCount || segmentStarts.length || 0)));
  const duration = Math.max(0, Math.floor(Number(manifestInfo?.durationSeconds || 0)));
  const count = Math.max(1, Math.min(Math.floor(Number(maxSamples || 8)), segmentCount || 1));
  const safeDuration = Math.max(8, Math.floor(Number(sampleSeconds || 20)));
  if (!segmentStarts.length || !segmentCount) {
    return pickSongrecOffsets(duration, count, safeDuration);
  }
  const usableDuration = Math.max(0, duration - safeDuration);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const ratio = count === 1 ? 0.5 : (i + 1) / (count + 1);
    const segmentIndex = Math.max(0, Math.min(segmentCount - 1, Math.round(ratio * (segmentCount - 1))));
    const start = Math.max(0, Math.min(usableDuration, Math.floor(Number(segmentStarts[segmentIndex] || 0))));
    out.push(start);
  }
  return uniqSortedIntegers(out, Math.max(6, Math.floor(safeDuration * 0.5)));
}

async function getRecognitionOffsets({
  audioPath,
  durationSeconds,
  targetTrackCount = 0,
  sampleSeconds = 20,
  maxSamples = 0,
  onProgress = null
}) {
  const duration = Math.max(0, Math.floor(Number(durationSeconds || 0)));
  const explicitMaxSamples = Math.max(0, Math.floor(Number(maxSamples || 0)));
  const initialSampleCount = explicitMaxSamples > 0
    ? explicitMaxSamples
    : computeRecognitionSampleCount(audioPath, duration, targetTrackCount, sampleSeconds);
  const looksLikeHls = isRemoteInputSource(audioPath) && /\.m3u8(?:$|[?#])/i.test(String(audioPath || ""));
  if (looksLikeHls) {
    try {
      emitProgress(onProgress, {
        stage: "sampling-plan",
        message: "Cue: Reading HLS manifest for sample planning..."
      });
      const manifestInfo = await fetchHlsManifestInfo(audioPath);
      if (manifestInfo?.segmentCount) {
        const manifestDuration = Math.max(0, Math.floor(Number(manifestInfo.durationSeconds || duration || 0)));
        const plannedSampleCount = explicitMaxSamples > 0
          ? explicitMaxSamples
          : computeRecognitionSampleCount(audioPath, manifestDuration, targetTrackCount, sampleSeconds);
        const offsets = pickHlsSegmentOffsets(manifestInfo, plannedSampleCount, sampleSeconds);
        emitProgress(onProgress, {
          stage: "sampling-plan",
          message: `Cue: Planned ${offsets.length} HLS sample windows across ${manifestInfo.segmentCount} chunks`
        });
        return {
          offsets,
          samplesUsed: offsets.length,
          plan: "hls-segments",
          segmentCount: manifestInfo.segmentCount,
          durationSeconds: manifestInfo.durationSeconds || duration
        };
      }
    } catch {
      emitProgress(onProgress, {
        stage: "sampling-plan",
        message: "Cue: HLS manifest planning failed, falling back to time-spaced samples..."
      });
    }
  }
  const offsets = pickSongrecOffsets(duration, initialSampleCount, sampleSeconds);
  emitProgress(onProgress, {
    stage: "sampling-plan",
    message: `Cue: Planned ${offsets.length} time-spaced sample windows`
  });
  return {
    offsets,
    samplesUsed: offsets.length,
    plan: "time-grid",
    segmentCount: 0,
    durationSeconds: duration
  };
}

function mergeDetectionTracks(...groups) {
  const combined = [];
  for (const group of groups) {
    combined.push(...(Array.isArray(group) ? group : []));
  }
  return dedupeSongrecDetections(
    combined.sort((a, b) => Number(a?.startSeconds || 0) - Number(b?.startSeconds || 0))
  );
}

function dedupeSongrecDetections(rows) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.title) {
      continue;
    }
    const key = `${normalizeTrackKey(row.artist)}|${normalizeTrackKey(row.title)}`;
    const prev = out[out.length - 1];
    if (prev && prev._key === key && Math.abs(Number(row.startSeconds || 0) - Number(prev.startSeconds || 0)) < 30) {
      continue;
    }
    out.push({
      _key: key,
      title: cleanText(row.title),
      artist: cleanText(row.artist),
      startSeconds: Math.max(0, Math.floor(Number(row.startSeconds || 0))),
      inferred: true,
      inferredSource: cleanText(row.inferredSource || row.matchSource || "")
    });
  }
  return out.map(({ _key, ...rest }) => rest);
}

function mergeRecognitionAnchorsIntoTracks(baseTracks, recognitionTracks = []) {
  const rows = (Array.isArray(baseTracks) ? baseTracks : []).map((track, index) => normalizeTrack(track, index));
  const anchors = Array.isArray(recognitionTracks) ? recognitionTracks : [];
  if (!rows.length || !anchors.length) {
    return {
      tracks: rows,
      matched: 0
    };
  }
  const anchorMap = new Map();
  for (const row of anchors) {
    const key = normalizeTrackKey(`${row.artist || ""} ${row.title || ""}`);
    if (!key) {
      continue;
    }
    const existing = anchorMap.get(key);
    const start = Math.max(0, Math.floor(Number(row.startSeconds || 0)));
    if (existing == null || start < existing) {
      anchorMap.set(key, start);
    }
  }
  let matched = 0;
  for (const row of rows) {
    if (Number.isFinite(row.startSeconds)) {
      continue;
    }
    const key = normalizeTrackKey(`${row.artist || ""} ${row.title || ""}`);
    if (!key) {
      continue;
    }
    if (anchorMap.has(key)) {
      row.startSeconds = anchorMap.get(key);
      matched += 1;
    }
  }
  return { tracks: rows, matched };
}

function insertRecognitionTracksIntoPlaylist(baseTracks, recognitionTracks = [], durationSeconds = 0) {
  const rows = (Array.isArray(baseTracks) ? baseTracks : []).map((track, index) => normalizeTrack(track, index));
  const detections = Array.isArray(recognitionTracks) ? recognitionTracks : [];
  if (!rows.length || !detections.length) {
    return {
      tracks: rows,
      inserted: 0
    };
  }

  const existingKeys = new Set(
    rows
      .map((row) => normalizeTrackKey(`${row.artist || ""} ${row.title || ""}`))
      .filter(Boolean)
  );

  const extras = detections
    .filter((row) => {
      const key = normalizeTrackKey(`${row.artist || ""} ${row.title || ""}`);
      return key && !existingKeys.has(key);
    })
    .sort((a, b) => Number(a?.startSeconds || 0) - Number(b?.startSeconds || 0));

  if (!extras.length) {
    return {
      tracks: rows,
      inserted: 0
    };
  }

  const provisional = estimateOffsets(rows, durationSeconds || rows.length * 180, [], [], {
    preferUniformSpacing: true
  }).tracks;
  const working = rows.slice();
  let inserted = 0;

  for (const extra of extras) {
    const startSeconds = Math.max(0, Math.floor(Number(extra?.startSeconds || 0)));
    const insertAfter = provisional.reduce((best, row, index) => {
      const value = Number(row?.startSeconds);
      if (Number.isFinite(value) && value <= startSeconds) {
        return index;
      }
      return best;
    }, -1);
    const targetIndex = Math.max(0, Math.min(working.length, insertAfter + 1 + inserted));
    working.splice(targetIndex, 0, {
      title: cleanText(extra.title),
      artist: cleanText(extra.artist),
      startSeconds,
      inferred: true,
      inferredSource: cleanText(extra.inferredSource || extra.matchSource || "")
    });
    inserted += 1;
  }

  return {
    tracks: working,
    inserted
  };
}

async function recognizeWithSongrecWindows({
  audioPath,
  durationSeconds,
  targetTrackCount = 0,
  sampleSeconds = 20,
  maxSamples = 0,
  onProgress = null
}) {
  const duration = Math.max(0, Math.floor(Number(durationSeconds || 0)));
  if (!duration) {
    return { tracks: [], samplesUsed: 0 };
  }
  const bin = resolveSongrecBinary();
  const samplingPlan = await getRecognitionOffsets({
    audioPath,
    durationSeconds: duration,
    targetTrackCount,
    sampleSeconds,
    maxSamples,
    onProgress
  });
  const offsets = Array.isArray(samplingPlan?.offsets) ? samplingPlan.offsets : [];
  if (!offsets.length) {
    return { tracks: [], samplesUsed: 0 };
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kimble-songrec-"));
  try {
    const detections = [];
    let extractedSamples = 0;
    for (let i = 0; i < offsets.length; i += 1) {
      const start = offsets[i];
      emitProgress(onProgress, {
        stage: "songrec",
        current: i + 1,
        total: offsets.length,
        message: `Cue: Songrec sample ${i + 1}/${offsets.length}`
      });
      const snippetPath = path.join(tmpDir, `sample-${String(i + 1).padStart(2, "0")}.wav`);
      const ok = extractAudioSnippetToWav(audioPath, start, sampleSeconds, snippetPath);
      if (!ok) {
        emitProgress(onProgress, {
          stage: "songrec",
          current: i + 1,
          total: offsets.length,
          message: `Cue: Songrec sample ${i + 1}/${offsets.length} could not extract audio`
        });
        continue;
      }
      extractedSamples += 1;
      const rec = runCommand(bin, ["audio-file-to-recognized-song", snippetPath], { timeoutMs: 45000 });
      if (rec.status !== 0) {
        emitProgress(onProgress, {
          stage: "songrec",
          current: i + 1,
          total: offsets.length,
          message: `Cue: Songrec sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} returned no result`
        });
        continue;
      }
      const parsed = parseSongrecResult(`${rec.stdout || ""}\n${rec.stderr || ""}`);
      if (!parsed?.title) {
        emitProgress(onProgress, {
          stage: "songrec",
          current: i + 1,
          total: offsets.length,
          message: `Cue: Songrec sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} no match`
        });
        continue;
      }
      emitProgress(onProgress, {
        stage: "songrec",
        current: i + 1,
        total: offsets.length,
        message: `Cue: Songrec sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} matched ${parsed.artist ? `${parsed.artist} - ` : ""}${parsed.title}`
      });
      detections.push({
        title: parsed.title,
        artist: parsed.artist,
        startSeconds: start
      });
    }
    const deduped = dedupeSongrecDetections(detections);
    emitProgress(onProgress, {
      stage: "songrec",
      message: `Cue: Songrec matched ${deduped.length} songs from ${extractedSamples}/${offsets.length} samples`
    });
    return {
      tracks: deduped,
      samplesUsed: offsets.length
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

async function recognizeWithAcoustidWindows({
  audioPath,
  durationSeconds,
  apiKey = "",
  targetTrackCount = 0,
  sampleSeconds = 20,
  maxSamples = 0,
  onProgress = null
}) {
  const duration = Math.max(0, Math.floor(Number(durationSeconds || 0)));
  const clientKey = cleanText(apiKey);
  if (!duration || !clientKey) {
    return { tracks: [], samplesUsed: 0 };
  }

  const samplingPlan = await getRecognitionOffsets({
    audioPath,
    durationSeconds: duration,
    targetTrackCount,
    sampleSeconds,
    maxSamples,
    onProgress
  });
  const offsets = Array.isArray(samplingPlan?.offsets) ? samplingPlan.offsets : [];
  if (!offsets.length) {
    return { tracks: [], samplesUsed: 0 };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kimble-acoustid-"));
  try {
    const detections = [];
    let extractedSamples = 0;
    for (let i = 0; i < offsets.length; i += 1) {
      const start = offsets[i];
      emitProgress(onProgress, {
        stage: "acoustid",
        current: i + 1,
        total: offsets.length,
        message: `Cue: AcoustID sample ${i + 1}/${offsets.length}`
      });
      const snippetPath = path.join(tmpDir, `sample-${String(i + 1).padStart(2, "0")}.wav`);
      const ok = extractAudioSnippetToWav(audioPath, start, sampleSeconds, snippetPath);
      if (!ok) {
        emitProgress(onProgress, {
          stage: "acoustid",
          current: i + 1,
          total: offsets.length,
          message: `Cue: AcoustID sample ${i + 1}/${offsets.length} could not extract audio`
        });
        continue;
      }
      extractedSamples += 1;
      const fp = getAudioFingerprint(snippetPath);
      if (!fp?.fingerprint) {
        emitProgress(onProgress, {
          stage: "acoustid",
          current: i + 1,
          total: offsets.length,
          message: `Cue: AcoustID sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} fingerprint failed${fp?.debugMessage ? ` (${fp.debugMessage})` : ""}`
        });
        continue;
      }
      try {
        const hit = await lookupAcoustId({
          apiKey: clientKey,
          fingerprint: fp.fingerprint,
          duration: Number(fp.duration || sampleSeconds || 20)
        });
        if (!hit?.title) {
          emitProgress(onProgress, {
            stage: "acoustid",
            current: i + 1,
            total: offsets.length,
            message: `Cue: AcoustID sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} no match`
          });
          continue;
        }
        emitProgress(onProgress, {
          stage: "acoustid",
          current: i + 1,
          total: offsets.length,
          message: `Cue: AcoustID sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} matched ${hit.artist ? `${hit.artist} - ` : ""}${hit.title}`
        });
        detections.push({
          title: hit.title,
          artist: hit.artist,
          startSeconds: start
        });
      } catch {
        emitProgress(onProgress, {
          stage: "acoustid",
          current: i + 1,
          total: offsets.length,
          message: `Cue: AcoustID sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} lookup failed`
        });
      }
    }
    const deduped = dedupeSongrecDetections(detections);
    emitProgress(onProgress, {
      stage: "acoustid",
      message: `Cue: AcoustID matched ${deduped.length} songs from ${extractedSamples}/${offsets.length} samples`
    });
    return {
      tracks: deduped,
      samplesUsed: offsets.length
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

async function recognizeWithAuddWindows({
  audioPath,
  durationSeconds,
  apiToken = "",
  targetTrackCount = 0,
  sampleSeconds = 20,
  maxSamples = 0,
  onProgress = null
}) {
  const duration = Math.max(0, Math.floor(Number(durationSeconds || 0)));
  const token = cleanText(apiToken);
  if (!duration || !token) {
    return { tracks: [], samplesUsed: 0 };
  }

  const boundedSampleSeconds = Math.max(8, Math.min(12, Math.floor(Number(sampleSeconds || 20))));
  const samplingPlan = await getRecognitionOffsets({
    audioPath,
    durationSeconds: duration,
    targetTrackCount,
    sampleSeconds: boundedSampleSeconds,
    maxSamples,
    onProgress
  });
  const offsets = Array.isArray(samplingPlan?.offsets) ? samplingPlan.offsets : [];
  if (!offsets.length) {
    return { tracks: [], samplesUsed: 0 };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kimble-audd-"));
  try {
    const detections = [];
    let extractedSamples = 0;
    for (let i = 0; i < offsets.length; i += 1) {
      const start = offsets[i];
      emitProgress(onProgress, {
        stage: "audd",
        current: i + 1,
        total: offsets.length,
        message: `Cue: AudD sample ${i + 1}/${offsets.length}`
      });
      const snippetPath = path.join(tmpDir, `sample-${String(i + 1).padStart(2, "0")}.wav`);
      const ok = extractAudioSnippetToWav(audioPath, start, boundedSampleSeconds, snippetPath);
      if (!ok) {
        emitProgress(onProgress, {
          stage: "audd",
          current: i + 1,
          total: offsets.length,
          message: `Cue: AudD sample ${i + 1}/${offsets.length} could not extract audio`
        });
        continue;
      }
      extractedSamples += 1;
      try {
        const hit = await lookupAuddFromFile({
          apiToken: token,
          filePath: snippetPath
        });
        if (!hit?.title) {
          emitProgress(onProgress, {
            stage: "audd",
            current: i + 1,
            total: offsets.length,
            message: `Cue: AudD sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} no match`
          });
          continue;
        }
        emitProgress(onProgress, {
          stage: "audd",
          current: i + 1,
          total: offsets.length,
          message: `Cue: AudD sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} matched ${hit.artist ? `${hit.artist} - ` : ""}${hit.title}`
        });
        detections.push({
          title: hit.title,
          artist: hit.artist,
          startSeconds: start
        });
      } catch (error) {
        emitProgress(onProgress, {
          stage: "audd",
          current: i + 1,
          total: offsets.length,
          message: `Cue: AudD sample ${i + 1}/${offsets.length} @ ${formatSampleOffset(start)} lookup failed${cleanText(error?.message || "") ? ` (${cleanText(error.message).slice(0, 160)})` : ""}`
        });
      }
    }
    const deduped = dedupeSongrecDetections(detections);
    emitProgress(onProgress, {
      stage: "audd",
      message: `Cue: AudD matched ${deduped.length} songs from ${extractedSamples}/${offsets.length} samples`
    });
    return {
      tracks: deduped,
      samplesUsed: offsets.length
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

async function searchCommonTracklistSites(query, extraQueries = []) {
  const q = cleanText(query);
  const additional = (Array.isArray(extraQueries) ? extraQueries : [])
    .map((item) => cleanText(item))
    .filter(Boolean);
  const queries = Array.from(new Set([q, ...additional].filter(Boolean)));
  if (!queries.length) {
    return [];
  }
  const candidates = [];
  for (const queryText of queries) {
    candidates.push(`https://www.1001tracklists.com/search/result.php?q=${encodeURIComponent(queryText)}`);
    candidates.push(`https://www.mixesdb.com/w/index.php?search=${encodeURIComponent(queryText)}`);
  }

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
        .map((match) => normalizeLink(match[1], searchUrl))
        .filter((href) => /1001tracklists\.com\/tracklist\/|mixesdb\.com\/w\//i.test(href));
      const uniq = Array.from(new Set(hrefs)).slice(0, 8);
      for (const url of uniq) {
        try {
          const tracks = await tryExternalTracklist(url);
          if (tracks.length >= 3) {
            return tracks;
          }
        } catch {}
      }
    } catch {}
  }

  return [];
}

function normalizeTrack(input, index) {
  const title = cleanText(input?.title || input?.name || `Track ${index + 1}`);
  const artist = cleanText(input?.artist || input?.performer || "");
  const explicitStart = parseTimeTokenToSeconds(input?.time || "") ?? Number(input?.startSeconds);
  return {
    title,
    artist,
    startSeconds: Number.isFinite(explicitStart) ? Math.max(0, Math.floor(explicitStart)) : null,
    inferred: Boolean(input?.inferred),
    inferredSource: cleanText(input?.inferredSource || input?.matchSource || "")
  };
}

function snapToLandmark(seconds, landmarks = [], maxSnapSeconds = 18) {
  if (!Array.isArray(landmarks) || !landmarks.length) {
    return seconds;
  }
  let best = seconds;
  let bestDelta = Infinity;
  for (const mark of landmarks) {
    const delta = Math.abs(mark - seconds);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = mark;
    }
  }
  return bestDelta <= maxSnapSeconds ? best : seconds;
}

function enforceAscendingStarts(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const current = { ...rows[i] };
    const prevStart = i > 0 ? Number(out[i - 1].startSeconds || 0) : 0;
    let nextStart = Math.max(0, Math.floor(Number(current.startSeconds || 0)));
    if (i > 0 && nextStart <= prevStart) {
      nextStart = prevStart + 1;
    }
    current.startSeconds = nextStart;
    out.push(current);
  }
  return out;
}

function getLandmarkCoverage(landmarks = [], durationSeconds = 0) {
  const rows = Array.isArray(landmarks) ? landmarks : [];
  if (!rows.length) {
    return {
      max: 0,
      min: 0,
      span: 0,
      coverage: 0
    };
  }
  const min = Number(rows[0] || 0);
  const max = Number(rows[rows.length - 1] || 0);
  const span = Math.max(0, max - min);
  const duration = Math.max(0, Number(durationSeconds || 0));
  const coverage = duration > 0 ? span / duration : 0;
  return { max, min, span, coverage };
}

function shouldTrustDenseLandmarks(landmarks = [], durationSeconds = 0, trackCount = 0) {
  const duration = Math.max(0, Number(durationSeconds || 0));
  if (duration <= 0) {
    return false;
  }
  const coverage = getLandmarkCoverage(landmarks, duration);
  if (coverage.max < duration * 0.55) {
    return false;
  }
  if (coverage.coverage < 0.5) {
    return false;
  }
  const minUsefulMarks = Math.max(4, Math.min(12, Number(trackCount || 0) - 1));
  return (Array.isArray(landmarks) ? landmarks.length : 0) >= minUsefulMarks;
}

function rescaleShortExplicitStarts(rows = [], durationSeconds = 0) {
  const duration = Math.max(0, Number(durationSeconds || 0));
  if (!duration || !Array.isArray(rows) || !rows.length) {
    return rows;
  }
  const starts = rows
    .map((row) => Number(row?.startSeconds))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!starts.length) {
    return rows;
  }
  const maxStart = starts[starts.length - 1];
  if (!(maxStart > 0 && maxStart < duration * 0.45 && rows.length >= 4 && duration >= 15 * 60)) {
    return rows;
  }
  const targetMax = Math.max(1, Math.floor(duration * 0.96));
  const scale = targetMax / maxStart;
  return rows.map((row) => ({
    ...row,
    startSeconds: Number.isFinite(Number(row?.startSeconds))
      ? Math.max(0, Math.floor(Number(row.startSeconds) * scale))
      : row.startSeconds
  }));
}

function selectDistributedLandmarks(landmarks = [], desiredCount = 0) {
  const rows = uniqSortedIntegers(landmarks, 18);
  const count = Math.max(0, Math.floor(Number(desiredCount || 0)));
  if (!rows.length || count <= 0) {
    return [];
  }
  if (rows.length <= count) {
    return rows.slice(0, count);
  }
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const ratio = count === 1 ? 0 : i / (count - 1);
    const index = Math.max(0, Math.min(rows.length - 1, Math.round(ratio * (rows.length - 1))));
    out.push(rows[index]);
  }
  return uniqSortedIntegers(out, 18).slice(0, count);
}

function summarizeLandmarks(silenceBoundaries = [], loudnessBoundaries = [], spectralBoundaries = []) {
  const silenceCount = Array.isArray(silenceBoundaries) ? silenceBoundaries.length : 0;
  const loudnessCount = Array.isArray(loudnessBoundaries) ? loudnessBoundaries.length : 0;
  const spectralCount = Array.isArray(spectralBoundaries) ? spectralBoundaries.length : 0;
  const mergedCount = uniqSortedIntegers([].concat(silenceBoundaries, loudnessBoundaries, spectralBoundaries), 18).length;
  return {
    silenceCount,
    loudnessCount,
    spectralCount,
    mergedCount
  };
}

function buildAlignmentReason(method, landmarkSummary = {}, explicitCount = 0, trackCount = 0, preferUniformSpacing = false) {
  const silenceCount = Number(landmarkSummary.silenceCount || 0);
  const loudnessCount = Number(landmarkSummary.loudnessCount || 0);
  const spectralCount = Number(landmarkSummary.spectralCount || 0);
  const mergedCount = Number(landmarkSummary.mergedCount || 0);
  switch (String(method || "")) {
    case "explicit-source-timestamps":
      return mergedCount > 0
        ? "Used explicit source timestamps and snapped them to nearby merged FFmpeg landmarks."
        : "Used explicit source timestamps directly.";
    case "explicit-source-timestamps-rescaled":
      return "Source timestamps covered too little of the episode, so they were rescaled across the full duration and snapped to nearby landmarks.";
    case "anchored-interpolation":
      return `Interpolated missing timestamps between ${explicitCount} known source anchors${mergedCount > 0 ? " and snapped them to nearby landmarks" : ""}.`;
    case "silence-boundaries":
      return `Placed chapters directly from silence landmarks because ${silenceCount} silence breaks covered the episode well enough for ${trackCount} tracks.`;
    case "audio-filter-landmarks":
      return `Merged FFmpeg landmarks into one cue map${silenceCount || loudnessCount || spectralCount ? ` (silence ${silenceCount}, loudness ${loudnessCount}, spectral ${spectralCount}, merged ${mergedCount})` : ""} and distributed chapters across the full duration.`;
    case "uniform-spacing-fallback":
      if (preferUniformSpacing) {
        return "Used full-duration uniform spacing because source timing confidence was too weak and uniform spacing fallback was preferred.";
      }
      return mergedCount > 0
        ? `Merged landmarks (${mergedCount}) were too sparse or noisy to trust directly, so uniform spacing was used and lightly snapped toward nearby landmarks.`
        : "No reliable source timestamps or FFmpeg landmarks were available, so uniform spacing was used.";
    case "no-tracklist-no-matches":
      return "No usable tracklist or recognition matches were available, so no converged cue could be built.";
    default:
      return "";
  }
}

function estimateOffsets(tracks, totalDurationSeconds, silenceBoundaries = [], loudnessBoundaries = [], spectralBoundaries = [], options = {}) {
  const normalized = (tracks || []).map((track, index) => normalizeTrack(track, index));
  const landmarkSummary = summarizeLandmarks(silenceBoundaries, loudnessBoundaries, spectralBoundaries);
  if (!normalized.length) {
    return {
      tracks: [],
      method: "none",
      confidence: 0,
      landmarks: landmarkSummary,
      reason: ""
    };
  }

  const explicit = normalized
    .map((track, index) => ({ index, startSeconds: track.startSeconds }))
    .filter((item) => Number.isFinite(item.startSeconds))
    .sort((a, b) => a.index - b.index);
  const explicitCount = explicit.length;
  const trackCount = normalized.length;
  const duration = Math.max(1, Number(totalDurationSeconds) || trackCount * 180);
  const landmarks = uniqSortedIntegers([].concat(silenceBoundaries, loudnessBoundaries, spectralBoundaries), 18);
  const preferUniformSpacing = Boolean(options.preferUniformSpacing);

  if (explicitCount === trackCount) {
    const rescaled = rescaleShortExplicitStarts(normalized, duration);
    const rows = enforceAscendingStarts(rescaled).map((row) => ({
      ...row,
      startSeconds: snapToLandmark(Number(row.startSeconds || 0), landmarks, 8)
    }));
    return {
      tracks: enforceAscendingStarts(rows),
      method: rescaled === normalized ? "explicit-source-timestamps" : "explicit-source-timestamps-rescaled",
      confidence: rescaled === normalized ? 0.98 : 0.84,
      landmarks: landmarkSummary,
      reason: buildAlignmentReason(
        rescaled === normalized ? "explicit-source-timestamps" : "explicit-source-timestamps-rescaled",
        landmarkSummary,
        explicitCount,
        trackCount,
        preferUniformSpacing
      )
    };
  }

  const out = normalized.map((track) => ({ ...track }));
  if (explicitCount > 0) {
    for (let i = 0; i < out.length; i += 1) {
      if (Number.isFinite(out[i].startSeconds)) {
        continue;
      }
      const prev = [...explicit].reverse().find((item) => item.index < i) || null;
      const next = explicit.find((item) => item.index > i) || null;
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
    const rows = enforceAscendingStarts(out).map((row) => ({
      ...row,
      startSeconds: snapToLandmark(Number(row.startSeconds || 0), landmarks, 14)
    }));
    return {
      tracks: enforceAscendingStarts(rows),
      method: "anchored-interpolation",
      confidence: 0.82,
      landmarks: landmarkSummary,
      reason: buildAlignmentReason("anchored-interpolation", landmarkSummary, explicitCount, trackCount, preferUniformSpacing)
    };
  }

  if (silenceBoundaries.length >= trackCount - 1 && shouldTrustDenseLandmarks(silenceBoundaries, duration, trackCount)) {
    const selected = selectDistributedLandmarks(silenceBoundaries, trackCount - 1);
    const rows = out.map((track, index) => ({
      ...track,
      startSeconds: index === 0 ? 0 : selected[index - 1]
    }));
    return {
      tracks: enforceAscendingStarts(rows),
      method: "silence-boundaries",
      confidence: 0.68,
      landmarks: landmarkSummary,
      reason: buildAlignmentReason("silence-boundaries", landmarkSummary, explicitCount, trackCount, preferUniformSpacing)
    };
  }

  if (!preferUniformSpacing && landmarks.length >= trackCount - 1 && shouldTrustDenseLandmarks(landmarks, duration, trackCount)) {
    const selected = selectDistributedLandmarks(landmarks, trackCount - 1);
    const rows = out.map((track, index) => ({
      ...track,
      startSeconds: index === 0 ? 0 : selected[index - 1]
    }));
    return {
      tracks: enforceAscendingStarts(rows),
      method: "audio-filter-landmarks",
      confidence: 0.62,
      landmarks: landmarkSummary,
      reason: buildAlignmentReason("audio-filter-landmarks", landmarkSummary, explicitCount, trackCount, preferUniformSpacing)
    };
  }

  const step = Math.max(1, Math.floor(duration / trackCount));
  const rows = out.map((track, index) => ({
    ...track,
    startSeconds: preferUniformSpacing ? index * step : snapToLandmark(index * step, landmarks, 20)
  }));
  return {
    tracks: enforceAscendingStarts(rows),
    method: "uniform-spacing-fallback",
    confidence: landmarks.length ? 0.55 : 0.45,
    landmarks: landmarkSummary,
    reason: buildAlignmentReason("uniform-spacing-fallback", landmarkSummary, explicitCount, trackCount, preferUniformSpacing)
  };
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

function formatSampleOffset(seconds) {
  return secondsToDisplay(seconds);
}

function classifyTrackSource(sourceLabel, tracks = []) {
  const explicitCount = (tracks || []).filter((track) => Number.isFinite(Number(track?.startSeconds))).length;
  if (explicitCount > 0) {
    return {
      sourceLabel,
      timestampSource: "explicit",
      explicitCount
    };
  }
  return {
    sourceLabel,
    timestampSource: "none",
    explicitCount: 0
  };
}

function buildWindowRecognitionSource(auddTracks = [], acoustidTracks = [], songrecTracks = []) {
  const providers = [];
  if (Array.isArray(auddTracks) && auddTracks.length) {
    providers.push("audd");
  }
  if (Array.isArray(acoustidTracks) && acoustidTracks.length) {
    providers.push("acoustid");
  }
  if (Array.isArray(songrecTracks) && songrecTracks.length) {
    providers.push("songrec");
  }
  if (!providers.length) {
    return "none";
  }
  return `window-recognition-${providers.join("+")}`;
}

function isRemoteInputSource(input) {
  return /^https?:\/\//i.test(cleanText(input));
}

function resolveCueInputSource({ audioPath = "", streamUrl = "", inputSource = "" }) {
  const preferred = cleanText(inputSource || audioPath || streamUrl || "");
  if (!preferred) {
    throw new Error("No audio input was provided for chapter generation.");
  }
  if (isRemoteInputSource(preferred)) {
    return {
      inputSource: preferred,
      localAudioPath: ""
    };
  }
  const resolvedPath = path.resolve(preferred);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error("Audio file was not found for chapter generation.");
  }
  return {
    inputSource: resolvedPath,
    localAudioPath: resolvedPath
  };
}

async function buildCueForInput({
  audioPath = "",
  streamUrl = "",
  inputSource = "",
  episodeTitle,
  programTitle,
  sourceType = "rte",
  episodeUrl = "",
  tracklistUrl = "",
  durationSecondsHint = 0,
  writeCueFile = false,
  auddTrackMatching = false,
  auddApiToken = "",
  fingerprintTrackMatching = false,
  acoustidApiKey = "",
  songrecTrackMatching = false,
  songrecSampleSeconds = 20,
  ffmpegCueSilenceDetect = true,
  ffmpegCueLoudnessDetect = true,
  ffmpegCueSpectralDetect = true,
  fileStartOffset = 0,
  prefetchedTracks = [],
  onProgress = null,
  getRteTracks,
  getBbcTracks,
  getKexpTracks,
  getFipTracks
}) {
  const resolvedInput = resolveCueInputSource({ audioPath, streamUrl, inputSource });
  const resolvedSource = resolvedInput.inputSource;
  const localAudioPath = resolvedInput.localAudioPath;

  let source = "none";
  let tracks = Array.isArray(prefetchedTracks) ? prefetchedTracks.filter((track) => track && cleanText(track.title || track.artist || "")) : [];
  let acoustid = null;
  let auddWindowTracks = [];
  let auddWindowSamplesUsed = 0;
  let duration = Number(durationSecondsHint || 0) > 0
    ? Math.max(1, Math.floor(Number(durationSecondsHint || 0)))
    : null;
  let songrecTracks = [];
  let songrecMatched = 0;
  let songrecSamplesUsed = 0;
  let acoustidWindowTracks = [];
  let acoustidWindowSamplesUsed = 0;
  let recoveredFromWindows = false;
  let recognitionMatched = 0;
  let inferredInserted = 0;
  const auddEnabled = Boolean(auddTrackMatching);
  const auddApiTokenConfigured = Boolean(cleanText(auddApiToken));
  const useAuddMatching = Boolean(auddTrackMatching && cleanText(auddApiToken));
  const acoustidEnabled = Boolean(fingerprintTrackMatching);
  const acoustidApiKeyConfigured = Boolean(cleanText(acoustidApiKey));
  const useAcoustidMatching = Boolean(fingerprintTrackMatching && cleanText(acoustidApiKey));
  const useSongrecMatching = Boolean(songrecTrackMatching);

  emitProgress(onProgress, {
    stage: "start",
    message: "Cue: Preparing chapter alignment..."
  });

  if (auddEnabled && !auddApiTokenConfigured) {
    emitProgress(onProgress, {
      stage: "audd",
      message: "Cue: AudD matching is enabled, but no API token is configured. Skipping AudD."
    });
  } else if (!useAuddMatching) {
    emitProgress(onProgress, {
      stage: "audd",
      message: "Cue: AudD matching is disabled in settings. Skipping AudD."
    });
  }

  if (acoustidEnabled && !acoustidApiKeyConfigured) {
    emitProgress(onProgress, {
      stage: "acoustid",
      message: "Cue: AcoustID matching is enabled, but no API key is configured. Skipping AcoustID."
    });
  }

  if (!useSongrecMatching) {
    emitProgress(onProgress, {
      stage: "songrec",
      message: "Cue: Songrec matching is disabled in settings. Skipping Songrec."
    });
  }

  if (tracklistUrl) {
    emitProgress(onProgress, {
      stage: "tracklist",
      message: "Cue: Checking external tracklist..."
    });
    try {
      tracks = await tryExternalTracklist(tracklistUrl);
      if (tracks.length) {
        source = "external-tracklist";
      }
    } catch {}
  }

  if (tracks.length) {
    source = "prefetched-tracklist";
  }

  if (!tracks.length && sourceType === "rte" && typeof getRteTracks === "function" && episodeUrl) {
    emitProgress(onProgress, {
      stage: "tracklist",
      message: "Cue: Loading RTÉ episode playlist..."
    });
    try {
      const payload = await getRteTracks(episodeUrl);
      tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
      if (tracks.length) {
        source = "rte-episode-playlist";
      }
    } catch {}
  }

  if (!tracks.length && sourceType === "bbc" && typeof getBbcTracks === "function" && episodeUrl) {
    emitProgress(onProgress, {
      stage: "tracklist",
      message: "Cue: Loading BBC music played..."
    });
    try {
      const payload = await getBbcTracks(episodeUrl);
      tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
      if (tracks.length) {
        source = "bbc-music-played";
      }
    } catch {}
  }

  if (!tracks.length && sourceType === "kexp" && typeof getKexpTracks === "function" && episodeUrl) {
    emitProgress(onProgress, {
      stage: "tracklist",
      message: "Cue: Loading KEXP episode tracklist..."
    });
    try {
      const payload = await getKexpTracks(episodeUrl);
      tracks = Array.isArray(payload) ? payload : [];
      if (tracks.length) {
        // KEXP tracks have startSeconds relative to show start.
        // fileStartOffset (sg-offset) shifts them to be relative to the audio file start
        // so they align with the ffmpeg boundary timestamps.
        const offset = Number(fileStartOffset) || 0;
        if (offset > 0) {
          tracks = tracks.map((t) =>
            t.startSeconds != null
              ? { ...t, startSeconds: t.startSeconds + offset }
              : t
          );
        }
        source = "kexp-episode-tracklist";
      }
    } catch {}
  }

  if (!tracks.length && sourceType === "fip" && typeof getFipTracks === "function" && episodeUrl) {
    emitProgress(onProgress, {
      stage: "tracklist",
      message: "Cue: Loading FIP song history..."
    });
    try {
      const payload = await getFipTracks(episodeUrl);
      tracks = Array.isArray(payload) ? payload : [];
      if (tracks.length) {
        source = "fip-song-history";
      }
    } catch {}
  }

  if (!tracks.length) {
    const extraQueries = [];
    if (useAcoustidMatching && localAudioPath) {
      emitProgress(onProgress, {
        stage: "acoustid",
        message: "Cue: Fingerprinting full file with AcoustID..."
      });
      try {
        const fp = getAudioFingerprint(localAudioPath);
        if (fp?.fingerprint) {
          duration = duration || fp.duration || getAudioDurationSeconds(localAudioPath);
          acoustid = await lookupAcoustId({
            apiKey: acoustidApiKey,
            fingerprint: fp.fingerprint,
            duration: duration || 0
          });
        }
      } catch {}
      if (acoustid?.title || acoustid?.artist) {
        extraQueries.push(`${acoustid.artist || ""} ${acoustid.title || ""}`.trim());
      }
    }
    emitProgress(onProgress, {
      stage: "tracklist-search",
      message: "Cue: Searching external tracklist sites..."
    });
    tracks = await searchCommonTracklistSites(`${programTitle || ""} ${episodeTitle || ""}`, extraQueries);
    if (tracks.length) {
      source = extraQueries.length ? "common-tracklist-sites+acoustid" : "common-tracklist-sites";
    }
  }

  duration = duration || getAudioDurationSeconds(resolvedSource);
  emitProgress(onProgress, {
    stage: "analyze",
    message: "Cue: Inspecting audio duration..."
  });

  if (!tracks.length) {
    if (useAuddMatching) {
      emitProgress(onProgress, {
        stage: "audd",
        message: "Cue: Scanning windows with AudD..."
      });
      try {
        const auddResult = await recognizeWithAuddWindows({
          audioPath: resolvedSource,
          durationSeconds: duration || 0,
          apiToken: auddApiToken,
          targetTrackCount: 0,
          sampleSeconds: songrecSampleSeconds,
          maxSamples: 0,
          onProgress
        });
        auddWindowTracks = Array.isArray(auddResult?.tracks) ? auddResult.tracks : [];
        auddWindowSamplesUsed = Number(auddResult?.samplesUsed || 0);
      } catch {}
    }

    if (useAcoustidMatching) {
      emitProgress(onProgress, {
        stage: "acoustid",
        message: "Cue: Scanning windows with AcoustID..."
      });
      try {
        const acoustidResult = await recognizeWithAcoustidWindows({
          audioPath: resolvedSource,
          durationSeconds: duration || 0,
          apiKey: acoustidApiKey,
          targetTrackCount: 0,
          sampleSeconds: songrecSampleSeconds,
          maxSamples: 0,
          onProgress
        });
        acoustidWindowTracks = Array.isArray(acoustidResult?.tracks) ? acoustidResult.tracks : [];
        acoustidWindowSamplesUsed = Number(acoustidResult?.samplesUsed || 0);
      } catch {}
    }

    if (useSongrecMatching) {
      emitProgress(onProgress, {
        stage: "songrec",
        message: "Cue: Scanning windows with Songrec..."
      });
      try {
        const songrecResult = await recognizeWithSongrecWindows({
          audioPath: resolvedSource,
          durationSeconds: duration || 0,
          targetTrackCount: 0,
          sampleSeconds: songrecSampleSeconds,
          maxSamples: 0,
          onProgress
        });
        songrecTracks = Array.isArray(songrecResult?.tracks) ? songrecResult.tracks : [];
        songrecSamplesUsed = Number(songrecResult?.samplesUsed || 0);
      } catch {}
    }

    const recoveredTracks = mergeDetectionTracks(auddWindowTracks, acoustidWindowTracks, songrecTracks);
    if (recoveredTracks.length) {
      tracks = recoveredTracks;
      recoveredFromWindows = true;
      source = buildWindowRecognitionSource(auddWindowTracks, acoustidWindowTracks, songrecTracks);
    }
  }

  if (!tracks.length) {
    if (!writeCueFile) {
      return {
        cuePath: "",
        source: "none",
        durationSeconds: duration || 0,
        chapters: [],
        alignment: {
          method: "no-tracklist-no-matches",
          confidence: 0,
          reason: buildAlignmentReason("no-tracklist-no-matches", summarizeLandmarks([], [], []), 0, 0, false),
          explicitTimestampCount: 0,
          trackCount: 0,
          timestampSource: "none",
          silenceBoundaryCount: 0,
          loudnessBoundaryCount: 0,
          spectralBoundaryCount: 0,
          landmarks: summarizeLandmarks([], [], []),
          acoustid: acoustid || null,
          auddWindows: {
            samplesUsed: auddWindowSamplesUsed,
            detections: auddWindowTracks.length
          },
          acoustidWindows: {
            samplesUsed: acoustidWindowSamplesUsed,
            detections: acoustidWindowTracks.length
          },
          songrec: {
            samplesUsed: songrecSamplesUsed,
            detections: songrecTracks.length,
            matched: 0
          }
        },
        acoustid: acoustid || null
      };
    }
    throw new Error("No usable tracklist was found for this episode, and fallback recognition did not produce enough matches.");
  }

  if (!recoveredFromWindows) {
    if (useAuddMatching) {
      emitProgress(onProgress, {
        stage: "audd",
        message: "Cue: Aligning tracklist with AudD..."
      });
      try {
        const auddResult = await recognizeWithAuddWindows({
          audioPath: resolvedSource,
          durationSeconds: duration || 0,
          apiToken: auddApiToken,
          targetTrackCount: Array.isArray(tracks) ? tracks.length : 0,
          sampleSeconds: songrecSampleSeconds,
          maxSamples: 0,
          onProgress
        });
        auddWindowTracks = mergeDetectionTracks(auddWindowTracks, auddResult?.tracks || []);
        auddWindowSamplesUsed = Math.max(auddWindowSamplesUsed, Number(auddResult?.samplesUsed || 0));
      } catch {}
    }

    if (useAcoustidMatching) {
      emitProgress(onProgress, {
        stage: "acoustid",
        message: "Cue: Aligning tracklist with AcoustID..."
      });
      try {
        const acoustidResult = await recognizeWithAcoustidWindows({
          audioPath: resolvedSource,
          durationSeconds: duration || 0,
          apiKey: acoustidApiKey,
          targetTrackCount: Array.isArray(tracks) ? tracks.length : 0,
          sampleSeconds: songrecSampleSeconds,
          maxSamples: 0,
          onProgress
        });
        acoustidWindowTracks = mergeDetectionTracks(acoustidWindowTracks, acoustidResult?.tracks || []);
        acoustidWindowSamplesUsed = Math.max(acoustidWindowSamplesUsed, Number(acoustidResult?.samplesUsed || 0));
      } catch {}
    }

    if (useSongrecMatching) {
      emitProgress(onProgress, {
        stage: "songrec",
        message: "Cue: Aligning tracklist with Songrec..."
      });
      try {
        const songrecResult = await recognizeWithSongrecWindows({
          audioPath: resolvedSource,
          durationSeconds: duration || 0,
          targetTrackCount: Array.isArray(tracks) ? tracks.length : 0,
          sampleSeconds: songrecSampleSeconds,
          maxSamples: 0,
          onProgress
        });
        songrecTracks = mergeDetectionTracks(songrecTracks, songrecResult?.tracks || []);
        songrecSamplesUsed = Math.max(songrecSamplesUsed, Number(songrecResult?.samplesUsed || 0));
      } catch {}
    }
  }

  if (!recoveredFromWindows && tracks.length) {
    const mergedRecognitionTracks = mergeDetectionTracks(auddWindowTracks, acoustidWindowTracks, songrecTracks);
    if (mergedRecognitionTracks.length) {
      const merged = mergeRecognitionAnchorsIntoTracks(tracks, mergedRecognitionTracks);
      tracks = merged.tracks;
      songrecMatched = merged.matched;
      recognitionMatched = merged.matched;
      const augmented = insertRecognitionTracksIntoPlaylist(tracks, mergedRecognitionTracks, duration || 0);
      tracks = augmented.tracks;
      inferredInserted = augmented.inserted;
    }
  }

  const sourceInfo = classifyTrackSource(source, tracks);
  const preferUniformSpacing = sourceInfo.timestampSource === "none" && recognitionMatched === 0;
  emitProgress(onProgress, {
    stage: "boundaries",
    message: "Cue: Analyzing audio boundaries..."
  });
  const activeBoundaryFilters = [];
  const useSilenceFilter = ffmpegCueSilenceDetect !== false;
  const useLoudnessFilter = ffmpegCueLoudnessDetect !== false;
  const useSpectralFilter = ffmpegCueSpectralDetect !== false;
  if (useSilenceFilter) {
    activeBoundaryFilters.push("silencedetect");
  }
  if (useLoudnessFilter) {
    activeBoundaryFilters.push("ebur128");
  }
  if (useSpectralFilter) {
    activeBoundaryFilters.push("aspectralstats");
  }
  emitProgress(onProgress, {
    stage: "boundaries",
    message: activeBoundaryFilters.length
      ? `Cue: Using FFmpeg landmark filters: ${activeBoundaryFilters.join(", ")}`
      : "Cue: No FFmpeg landmark filters enabled. Using source timings and spacing fallback only."
  });
  const silenceBoundaries = useSilenceFilter ? detectSilenceBoundariesSeconds(resolvedSource) : [];
  const loudnessBoundaries = useLoudnessFilter ? detectLoudnessBoundariesSeconds(resolvedSource) : [];
  const spectralBoundaries = useSpectralFilter ? detectSpectralFluxBoundariesSeconds(resolvedSource) : [];
  const estimated = estimateOffsets(tracks, duration, silenceBoundaries, loudnessBoundaries, spectralBoundaries, {
    preferUniformSpacing
  });
  const convergenceLandmarks = estimated.landmarks || summarizeLandmarks(silenceBoundaries, loudnessBoundaries, spectralBoundaries);
  const convergenceParts = [];
  if (Number(convergenceLandmarks.silenceCount || 0) > 0) {
    convergenceParts.push(`silence ${convergenceLandmarks.silenceCount}`);
  }
  if (Number(convergenceLandmarks.loudnessCount || 0) > 0) {
    convergenceParts.push(`loudness ${convergenceLandmarks.loudnessCount}`);
  }
  if (Number(convergenceLandmarks.spectralCount || 0) > 0) {
    convergenceParts.push(`spectral ${convergenceLandmarks.spectralCount}`);
  }
  if (Number(convergenceLandmarks.mergedCount || 0) > 0) {
    convergenceParts.push(`merged ${convergenceLandmarks.mergedCount}`);
  }
  emitProgress(onProgress, {
    stage: "converged",
    message: `Cue: Final convergence -> ${estimated.reason || "Built cue chapters from available timings."}${convergenceParts.length ? ` (${convergenceParts.join(", ")})` : ""}`
  });
  const withOffsets = estimated.tracks;
  const chapters = withOffsets.map((track, index) => ({
    index: index + 1,
    title: track.title,
    artist: track.artist,
    startSeconds: Math.max(0, Math.floor(track.startSeconds || 0)),
    start: secondsToDisplay(track.startSeconds || 0),
    inferred: Boolean(track.inferred),
    inferredSource: cleanText(track.inferredSource || "")
  }));

  let cuePath = "";
  if (writeCueFile) {
    if (!localAudioPath) {
      throw new Error("Writing a CUE file requires a local downloaded audio file.");
    }
    emitProgress(onProgress, {
      stage: "write",
      message: "Cue: Writing .cue file..."
    });
    const cueLines = [];
    cueLines.push(`PERFORMER "${sanitizeCueText(programTitle || "Unknown Program")}"`);
    cueLines.push(`TITLE "${sanitizeCueText(episodeTitle || path.basename(localAudioPath, path.extname(localAudioPath)))}"`);
    cueLines.push(`FILE "${sanitizeCueText(path.basename(localAudioPath))}" MP3`);
    for (const chapter of chapters) {
      cueLines.push(`  TRACK ${String(chapter.index).padStart(2, "0")} AUDIO`);
      cueLines.push(`    TITLE "${sanitizeCueText(chapter.title)}"`);
      if (chapter.artist) {
        cueLines.push(`    PERFORMER "${sanitizeCueText(chapter.artist)}"`);
      }
      cueLines.push(`    INDEX 01 ${secondsToCueTime(chapter.startSeconds)}`);
    }
    cueLines.push("");
    cuePath = `${localAudioPath}.cue`;
    fs.writeFileSync(cuePath, cueLines.join("\n"), "utf8");
  }

  return {
    cuePath,
    source,
    durationSeconds: duration,
    chapters,
    alignment: {
      method: estimated.method,
      confidence: Number((estimated.confidence || 0).toFixed(2)),
      reason: cleanText(estimated.reason || ""),
      explicitTimestampCount: sourceInfo.explicitCount,
      trackCount: chapters.length,
      timestampSource: sourceInfo.timestampSource,
      silenceBoundaryCount: silenceBoundaries.length,
      loudnessBoundaryCount: loudnessBoundaries.length,
      spectralBoundaryCount: spectralBoundaries.length,
      landmarks: convergenceLandmarks,
      acoustid: acoustid || null,
      auddWindows: {
        samplesUsed: auddWindowSamplesUsed,
        detections: auddWindowTracks.length
      },
      acoustidWindows: {
        samplesUsed: acoustidWindowSamplesUsed,
        detections: acoustidWindowTracks.length
      },
      songrec: {
        samplesUsed: songrecSamplesUsed,
        detections: songrecTracks.length,
        matched: songrecMatched
      },
      insertedRecognitionTracks: inferredInserted
    },
    acoustid: acoustid || null
  };
}

async function generateCueForAudio(options = {}) {
  return buildCueForInput({
    ...(options || {}),
    writeCueFile: true,
    inputSource: String(options?.audioPath || "")
  });
}

async function generateCuePreview(options = {}) {
  return buildCueForInput({
    ...(options || {}),
    writeCueFile: false,
    inputSource: String(options?.inputSource || options?.audioPath || options?.streamUrl || "")
  });
}

module.exports = {
  generateCueForAudio,
  generateCuePreview,
  resolveFpcalcBinary,
  resolveSongrecBinary
};
