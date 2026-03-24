const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveBundledFfmpegDir } = require("./downloader");
const { fetchWithOutboundAssert } = require("./url-safety");
const { decodeHtml } = require("./utils");

function clean(input) {
  return decodeHtml(String(input || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDecoratedTitle(title, programTitle) {
  const safeTitle = clean(title);
  const safeProgramTitle = clean(programTitle);
  if (!safeTitle) {
    return "";
  }
  if (!safeProgramTitle) {
    return safeTitle;
  }

  const escapedProgram = safeProgramTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const duplicatePrefixPattern = new RegExp(`^(?:${escapedProgram}\\s*[-:|]\\s*)+`, "i");
  const stripped = safeTitle.replace(duplicatePrefixPattern, "").trim();
  if (!stripped) {
    return safeTitle;
  }

  if (stripped.toLowerCase() === safeProgramTitle.toLowerCase()) {
    return safeProgramTitle;
  }
  return stripped;
}

function normalizeTagField(input, options = {}) {
  const cleaned = clean(input);
  if (!cleaned) {
    return "";
  }
  if (options.smartCleanup === false) {
    return cleaned;
  }
  return normalizeDecoratedTitle(cleaned, options.programTitle || "");
}

function cleanTagList(values) {
  const out = [];
  const seen = new Set();
  for (const value of cleanList(values)) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

function cleanList(values) {
  if (Array.isArray(values)) {
    return values.map((value) => clean(value)).filter(Boolean);
  }
  return String(values || "")
    .split(/,\s*/g)
    .map((value) => clean(value))
    .filter(Boolean);
}

function escapeFfmetadataValue(input) {
  return String(input || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\\n")
    .replace(/;/g, "\\;")
    .replace(/#/g, "\\#")
    .replace(/=/g, "\\=");
}

function buildEmbeddedTracklistText(chapters) {
  if (!Array.isArray(chapters) || !chapters.length) {
    return "";
  }
  return chapters
    .map((chapter, index) => {
      const title = clean(chapter?.title || `Track ${index + 1}`);
      const artist = clean(chapter?.artist || "");
      return artist ? `${index + 1}. ${artist} - ${title}` : `${index + 1}. ${title}`;
    })
    .join("\n");
}

function buildChapterDisplayTitle(chapter, index, options = {}) {
  const title = clean(chapter?.title || `Track ${index + 1}`);
  const artist = clean(chapter?.artist || "");
  if (options.includeArtistInTitle && artist) {
    return `${artist} - ${title}`;
  }
  return title;
}

function writeTagMetadataFile({ tempDir, metadata = {}, chapters = [], durationSeconds = 0, includeArtistInChapterTitle = false }) {
  const metadataEntries = Object.entries(metadata)
    .map(([key, value]) => [clean(key), clean(value)])
    .filter(([key, value]) => key && value);

  const normalized = Array.isArray(chapters)
    ? chapters
      .map((chapter, index) => ({
        index: index + 1,
        title: buildChapterDisplayTitle(chapter, index, { includeArtistInTitle: includeArtistInChapterTitle }),
        artist: clean(chapter?.artist || ""),
        startSeconds: Math.max(0, Number(chapter?.startSeconds || 0))
      }))
      .sort((a, b) => a.startSeconds - b.startSeconds)
    : [];

  if (!metadataEntries.length && !normalized.length) {
    return null;
  }

  const totalDurationMs = Math.max(0, Math.round(Number(durationSeconds || 0) * 1000));
  const lines = [";FFMETADATA1"];
  for (const [key, value] of metadataEntries) {
    lines.push(`${key}=${escapeFfmetadataValue(value)}`);
  }
  if (metadataEntries.length && normalized.length) {
    lines.push("");
  }
  for (let index = 0; index < normalized.length; index += 1) {
    const chapter = normalized[index];
    const next = normalized[index + 1];
    const startMs = Math.max(0, Math.round(chapter.startSeconds * 1000));
    let endMs = next ? Math.max(startMs + 1, Math.round(next.startSeconds * 1000) - 1) : Math.max(startMs + 1000, totalDurationMs || startMs + 1000);
    if (endMs <= startMs) {
      endMs = startMs + 1000;
    }
    lines.push("[CHAPTER]");
    lines.push("TIMEBASE=1/1000");
    lines.push(`START=${startMs}`);
    lines.push(`END=${endMs}`);
    lines.push(`title=${escapeFfmetadataValue(chapter.title)}`);
    if (chapter.artist) {
      lines.push(`artist=${escapeFfmetadataValue(chapter.artist)}`);
    }
  }

  const metadataPath = path.join(tempDir, "tags.ffmeta");
  fs.writeFileSync(metadataPath, `${lines.join("\n")}\n`, "utf8");
  return metadataPath;
}

function encodeSyncsafeInt(value) {
  const safeValue = Math.max(0, Number(value) || 0);
  return Buffer.from([
    (safeValue >> 21) & 0x7f,
    (safeValue >> 14) & 0x7f,
    (safeValue >> 7) & 0x7f,
    safeValue & 0x7f
  ]);
}

function decodeSyncsafeInt(buffer, offset) {
  return (
    ((buffer[offset] || 0) << 21)
    | ((buffer[offset + 1] || 0) << 14)
    | ((buffer[offset + 2] || 0) << 7)
    | (buffer[offset + 3] || 0)
  );
}

function encodeUInt32BE(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(Math.max(0, Number(value) || 0), 0);
  return out;
}

function buildId3Frame(frameId, payload, majorVersion = 3) {
  const frameHeader = Buffer.alloc(10);
  frameHeader.write(String(frameId || "").slice(0, 4), 0, "ascii");
  if (majorVersion >= 4) {
    encodeSyncsafeInt(payload.length).copy(frameHeader, 4);
  } else {
    frameHeader.writeUInt32BE(payload.length, 4);
  }
  return Buffer.concat([frameHeader, payload]);
}

function encodeId3TextPayload(text) {
  const value = clean(text);
  if (!value) {
    return null;
  }
  return Buffer.concat([
    Buffer.from([1]),
    Buffer.from(`\ufeff${value}`, "utf16le")
  ]);
}

function buildId3TextFrame(frameId, text, majorVersion = 3) {
  const payload = encodeId3TextPayload(text);
  if (!payload) {
    return null;
  }
  return buildId3Frame(frameId, payload, majorVersion);
}

function normalizeChaptersForEmbedding(chapters, durationSeconds = 0) {
  const totalDurationMs = Math.max(0, Math.round(Number(durationSeconds || 0) * 1000));
  return (Array.isArray(chapters) ? chapters : [])
    .map((chapter, index) => ({
      index: index + 1,
      title: clean(chapter?.title || `Track ${index + 1}`),
      artist: clean(chapter?.artist || ""),
      startMs: Math.max(0, Math.round(Number(chapter?.startSeconds || 0) * 1000))
    }))
    .filter((chapter) => chapter.title)
    .sort((a, b) => a.startMs - b.startMs)
    .map((chapter, index, rows) => {
      const next = rows[index + 1];
      let endMs = next ? Math.max(chapter.startMs + 1, next.startMs - 1) : Math.max(chapter.startMs + 1000, totalDurationMs || chapter.startMs + 1000);
      if (endMs <= chapter.startMs) {
        endMs = chapter.startMs + 1000;
      }
      return {
        ...chapter,
        endMs
      };
    });
}

function buildMp3ChapterFrames(chapters, durationSeconds = 0, majorVersion = 3) {
  const normalized = normalizeChaptersForEmbedding(chapters, durationSeconds);
  if (!normalized.length) {
    return [];
  }

  const chapterFrames = [];
  const childIds = [];
  for (const chapter of normalized) {
    const childId = `chp${String(chapter.index).padStart(4, "0")}`;
    childIds.push(childId);
    const subframes = [];
    const titleFrame = buildId3TextFrame("TIT2", chapter.title, majorVersion);
    if (titleFrame) {
      subframes.push(titleFrame);
    }
    const artistFrame = buildId3TextFrame("TPE1", chapter.artist, majorVersion);
    if (artistFrame) {
      subframes.push(artistFrame);
    }
    const chapterPayload = Buffer.concat([
      Buffer.from(`${childId}\0`, "latin1"),
      encodeUInt32BE(chapter.startMs),
      encodeUInt32BE(chapter.endMs),
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      Buffer.from([0xff, 0xff, 0xff, 0xff]),
      ...subframes
    ]);
    chapterFrames.push(buildId3Frame("CHAP", chapterPayload, majorVersion));
  }

  const tocChildren = childIds.map((childId) => Buffer.from(`${childId}\0`, "latin1"));
  const tocTitleFrame = buildId3TextFrame("TIT2", "Tracklist", majorVersion);
  const tocPayload = Buffer.concat([
    Buffer.from("toc\0", "latin1"),
    Buffer.from([0x03, childIds.length & 0xff]),
    ...tocChildren,
    ...(tocTitleFrame ? [tocTitleFrame] : [])
  ]);

  return [buildId3Frame("CTOC", tocPayload, majorVersion), ...chapterFrames];
}

function parseId3Tag(fileBuffer) {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length < 10 || fileBuffer.subarray(0, 3).toString("ascii") !== "ID3") {
    return {
      majorVersion: 3,
      frames: [],
      audioStart: 0,
      supported: true
    };
  }

  const majorVersion = Number(fileBuffer[3] || 3);
  const flags = Number(fileBuffer[5] || 0);
  if (flags & 0x40 || flags & 0x80) {
    return {
      majorVersion,
      frames: [],
      audioStart: 0,
      supported: false
    };
  }

  const tagSize = decodeSyncsafeInt(fileBuffer, 6);
  const tagEnd = Math.min(fileBuffer.length, 10 + tagSize);
  const frames = [];
  let offset = 10;
  while (offset + 10 <= tagEnd) {
    const frameId = fileBuffer.subarray(offset, offset + 4).toString("ascii");
    if (!frameId || /^\x00+$/.test(frameId)) {
      break;
    }
    if (!/^[A-Z0-9]{4}$/.test(frameId)) {
      break;
    }
    const frameSize = majorVersion >= 4
      ? decodeSyncsafeInt(fileBuffer, offset + 4)
      : fileBuffer.readUInt32BE(offset + 4);
    if (!frameSize || offset + 10 + frameSize > tagEnd) {
      break;
    }
    frames.push({
      id: frameId,
      bytes: fileBuffer.subarray(offset, offset + 10 + frameSize)
    });
    offset += 10 + frameSize;
  }

  return {
    majorVersion: majorVersion >= 4 ? 4 : 3,
    frames,
    audioStart: tagEnd,
    supported: true
  };
}

function injectMp3ChapterFrames(audioPath, chapters, durationSeconds = 0) {
  const inputPath = String(audioPath || "").trim();
  if (!inputPath || !fs.existsSync(inputPath)) {
    return { ok: false, reason: "Audio file missing for MP3 chapter injection" };
  }

  if (!normalizeChaptersForEmbedding(chapters, durationSeconds).length) {
    return { ok: true, injected: false };
  }

  const fileBuffer = fs.readFileSync(inputPath);
  const parsed = parseId3Tag(fileBuffer);
  if (!parsed.supported) {
    return { ok: false, reason: "Unsupported ID3 tag structure for MP3 chapter injection" };
  }

  const chapterFrames = buildMp3ChapterFrames(chapters, durationSeconds, parsed.majorVersion);
  const retainedFrames = parsed.frames.filter((frame) => frame.id !== "CHAP" && frame.id !== "CTOC");
  const body = Buffer.concat([
    ...retainedFrames.map((frame) => frame.bytes),
    ...chapterFrames
  ]);
  const header = Buffer.alloc(10);
  header.write("ID3", 0, "ascii");
  header[3] = parsed.majorVersion >= 4 ? 4 : 3;
  header[4] = 0;
  header[5] = 0;
  encodeSyncsafeInt(body.length).copy(header, 6);

  const rebuilt = Buffer.concat([
    header,
    body,
    fileBuffer.subarray(parsed.audioStart)
  ]);
  fs.writeFileSync(inputPath, rebuilt);
  return { ok: true, injected: true };
}

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

function cmdOk(command, args = ["-v"], options = {}) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    shell: false,
    ...options
  });
  return !result.error && result.status === 0;
}

function getBundledAtomicParsleyCandidates(vendorRoot) {
  const exeName = process.platform === "win32" ? "AtomicParsley.exe" : "AtomicParsley";
  const binRoot = path.join(vendorRoot, "atomicparsley", "bin");
  const candidates = [
    path.join(binRoot, `${process.platform}-${process.arch}`, exeName)
  ];

  if (process.platform === "win32") {
    candidates.push(path.join(binRoot, "win32-x64", exeName));
  } else if (process.platform === "darwin") {
    candidates.push(path.join(binRoot, "darwin-x64", exeName));
    candidates.push(path.join(binRoot, "darwin-arm64", exeName));
  } else {
    candidates.push(path.join(binRoot, "linux-x64", exeName));
    candidates.push(path.join(binRoot, "linux-arm64", exeName));
  }

  return Array.from(new Set(candidates));
}

function resolveBundledAtomicParsleyBinary() {
  for (const vendorRoot of getVendorRootCandidates()) {
    for (const candidate of getBundledAtomicParsleyCandidates(vendorRoot)) {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      if (cmdOk(candidate, ["-v"], { cwd: path.dirname(candidate) })) {
        return candidate;
      }
    }
  }
  return null;
}

async function downloadCoverToTemp(url, tempDir) {
  const input = String(url || "").trim();
  if (!input) {
    return null;
  }
  try {
    const response = await fetchWithOutboundAssert(input, "Cover art URL", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) {
      return null;
    }
    const coverPath = path.join(tempDir, "cover.jpg");
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(coverPath, bytes);
    if (fs.existsSync(coverPath)) {
      return coverPath;
    }
  } catch {}
  return null;
}

function resolveLocalCoverPath(inputPath, tempDir) {
  const sourcePath = String(inputPath || "").trim();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return null;
  }
  try {
    const ext = path.extname(sourcePath) || ".jpg";
    const targetPath = path.join(tempDir, `cover${ext}`);
    fs.copyFileSync(sourcePath, targetPath);
    if (fs.existsSync(targetPath)) {
      return targetPath;
    }
  } catch {}
  return null;
}

function applyMp4ArtworkWithAtomicParsley(audioPath, coverPath) {
  const atomicParsley = resolveBundledAtomicParsleyBinary() || (process.platform === "win32" ? "AtomicParsley.exe" : "AtomicParsley");
  const result = spawnSync(atomicParsley, [audioPath, "--artwork", coverPath, "--overWrite"], {
    cwd: path.dirname(audioPath),
    encoding: "utf8",
    shell: false
  });
  if (result.error || result.status !== 0) {
    const detail = clean(result.error?.message || result.stderr || result.stdout || "") || "AtomicParsley artwork embed failed";
    return { ok: false, reason: detail };
  }

  const verify = spawnSync(atomicParsley, [audioPath, "-t"], {
    cwd: path.dirname(audioPath),
    encoding: "utf8",
    shell: false
  });
  const verifyText = clean(`${verify.stdout || ""} ${verify.stderr || ""}`);
  if (verify.error || verify.status !== 0 || !/\bcovr\b/i.test(verifyText)) {
    const detail = clean(verify.error?.message || verify.stderr || verify.stdout || "") || "AtomicParsley artwork verification failed";
    return { ok: false, reason: detail };
  }

  return { ok: true };
}

async function applyId3Tags({
  audioPath,
  title,
  programTitle,
  sourceType,
  publishedTime,
  sourceUrl,
  artworkUrl,
  artworkPath = "",
  episodeUrl = "",
  clipId = "",
  description = "",
  location = "",
  hosts = [],
  genres = [],
  chapters = [],
  durationSeconds = 0,
  cleanupOptions = {}
}) {
  const inputPath = String(audioPath || "").trim();
  if (!inputPath || !fs.existsSync(inputPath)) {
    return { ok: false, reason: "Audio file missing" };
  }

  const ffmpegDir = resolveBundledFfmpegDir();
  const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const ffmpeg = ffmpegDir ? path.join(ffmpegDir, ffmpegExe) : ffmpegExe;
  const tmpDir = path.join(path.dirname(inputPath), `.tagtmp-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const taggedPath = path.join(tmpDir, path.basename(inputPath));
  const ext = String(path.extname(inputPath) || "").toLowerCase();
  const isMp3 = ext === ".mp3";
  const isMp4Family = new Set([".m4a", ".mp4", ".m4b", ".m4p", ".m4r"]).has(ext);

  const smartCleanupEnabled = cleanupOptions?.smartCleanup !== false;
  const tagAlbum = normalizeTagField(programTitle, {
    smartCleanup: smartCleanupEnabled
  });
  const tagTitle = normalizeTagField(title, {
    smartCleanup: smartCleanupEnabled,
    programTitle: tagAlbum
  });
  const defaultArtist = sourceType === "bbc" ? "BBC Radio" : sourceType === "wwf" ? "Worldwide FM" : sourceType === "nts" ? "NTS Radio" : sourceType === "fip" ? "FIP Radio" : sourceType === "kexp" ? "KEXP" : "RTE Radio";
  const tagHosts = cleanTagList(hosts);
  const tagGenres = cleanTagList(genres);
  const tagLocation = normalizeTagField(location, {
    smartCleanup: smartCleanupEnabled
  });
  const tagArtist = clean(tagHosts.join(", ")) || defaultArtist;
  const tagDate = normalizeTagField(publishedTime, {
    smartCleanup: false
  });
  const tagComment = normalizeTagField(sourceUrl || episodeUrl, {
    smartCleanup: false
  });
  const tagGenre = clean([
    sourceType === "bbc" ? "Radio;BBC" : sourceType === "wwf" ? "Radio;Worldwide FM" : sourceType === "nts" ? "Radio;NTS" : sourceType === "fip" ? "Radio;FIP" : sourceType === "kexp" ? "Radio;KEXP" : "Radio;RTE",
    ...tagGenres
  ].filter(Boolean).join(";"));
  const tagPublisher = sourceType === "bbc" ? "BBC Sounds" : sourceType === "wwf" ? "Worldwide FM" : sourceType === "nts" ? "NTS" : sourceType === "fip" ? "Radio France / FIP" : sourceType === "kexp" ? "KEXP" : "RTE Radio";
  const tagYearMatch = tagDate.match(/\b(\d{4})\b/);
  const tagYear = tagYearMatch?.[1] || "";
  const tagDescription = normalizeTagField(description, {
    smartCleanup: smartCleanupEnabled
  });
  const sourceId = normalizeTagField(clipId, {
    smartCleanup: false
  });
  const tracklistText = buildEmbeddedTracklistText(chapters);
  const embeddedMetadata = {
    title: tagTitle,
    album: tagAlbum,
    artist: tagArtist,
    album_artist: tagPublisher,
    genre: tagGenre,
    publisher: tagPublisher,
    date: tagDate,
    comment: tagComment,
    show: tagAlbum,
    source_url: tagComment,
    episode_url: normalizeTagField(episodeUrl, { smartCleanup: false }),
    hosts: tagHosts.join(", "),
    location: tagLocation,
    tracklist: tracklistText,
    encoded_by: "Kimble RTE/BBC Downloader",
    year: tagYear,
    description: tagDescription,
    synopsis: sourceId ? `Source ID: ${sourceId}` : "",
    lyrics: tracklistText,
    grouping: tagHosts.length ? tagHosts.join(", ") : "",
    purl: tagComment
  };
  const tagMetadataPath = writeTagMetadataFile({
    tempDir: tmpDir,
    metadata: embeddedMetadata,
    chapters,
    durationSeconds,
    includeArtistInChapterTitle: isMp4Family
  });

  const coverPath = resolveLocalCoverPath(artworkPath, tmpDir) || await downloadCoverToTemp(artworkUrl, tmpDir);
  const args = ["-y", "-i", inputPath];
  let coverInputIndex = null;
  if (coverPath && isMp3) {
    args.push("-i", coverPath);
    coverInputIndex = 1;
  }
  if (tagMetadataPath) {
    args.push("-f", "ffmetadata", "-i", tagMetadataPath);
  }
  const metadataInputIndex = tagMetadataPath ? (coverInputIndex == null ? 1 : 2) : null;

  args.push(
    "-map", "0:a:0",
    "-c:a", "copy",
    "-metadata", `title=${tagTitle}`,
    "-metadata", `album=${tagAlbum}`,
    "-metadata", `artist=${tagArtist}`,
    "-metadata", `album_artist=${tagPublisher}`,
    "-metadata", `genre=${tagGenre}`,
    "-metadata", `publisher=${tagPublisher}`,
    "-metadata", `date=${tagDate}`,
    "-metadata", `comment=${tagComment}`,
    "-metadata", `show=${tagAlbum}`,
    "-metadata", `source_url=${tagComment}`,
    "-metadata", `episode_url=${normalizeTagField(episodeUrl, { smartCleanup: false })}`,
    "-metadata", `hosts=${tagHosts.join(", ")}`,
    "-metadata", `location=${tagLocation}`,
    "-metadata", `tracklist=${tracklistText}`,
    "-metadata", "encoded_by=Kimble RTE/BBC Downloader"
  );
  if (isMp3) {
    args.push("-id3v2_version", "3");
  }
  if (tagYear) {
    args.push("-metadata", `year=${tagYear}`);
  }
  if (tagDescription) {
    args.push("-metadata", `description=${tagDescription}`);
  }
  if (sourceId) {
    args.push("-metadata", `synopsis=Source ID: ${sourceId}`);
  }
  if (tracklistText) {
    args.push("-metadata", `lyrics=${tracklistText}`);
  }
  if (tagLocation) {
    args.push("-metadata", `location=${tagLocation}`);
  }
  if (tagHosts.length) {
    args.push("-metadata", `grouping=${tagHosts.join(", ")}`);
  }
  if (tagComment) {
    args.push("-metadata", `purl=${tagComment}`);
  }
  if (metadataInputIndex != null) {
    args.push("-map_metadata", String(metadataInputIndex));
    args.push("-map_chapters", String(metadataInputIndex));
  }

  if (coverPath && isMp3) {
    const coverExt = String(path.extname(coverPath) || "").toLowerCase();
    const coverCodec = coverExt === ".png" ? "png" : "mjpeg";
    args.push(
      "-map", `${coverInputIndex}:v:0`,
      "-c:v", coverCodec,
      "-disposition:v:0", "attached_pic",
      "-metadata:s:v", "title=Album cover",
      "-metadata:s:v", "comment=Cover (front)"
    );
  }

  args.push(taggedPath);

  const result = spawnSync(ffmpeg, args, {
    cwd: ffmpegDir || process.cwd(),
    encoding: "utf8",
    shell: false
  });

  if (result.status !== 0 || !fs.existsSync(taggedPath)) {
    const reason = clean(`${result.stderr || result.stdout || ""}`).slice(0, 500) || "ffmpeg tagging failed";
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { ok: false, reason };
  }

  if (coverPath && isMp4Family) {
    const embedResult = applyMp4ArtworkWithAtomicParsley(taggedPath, coverPath);
    if (!embedResult.ok) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return embedResult;
    }
  }

  let mp3ChaptersEmbedded = false;
  if (isMp3 && Array.isArray(chapters) && chapters.length) {
    const chapterInjectResult = injectMp3ChapterFrames(taggedPath, chapters, durationSeconds);
    if (!chapterInjectResult.ok) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return chapterInjectResult;
    }
    mp3ChaptersEmbedded = Boolean(chapterInjectResult.injected);
  }

  try {
    fs.unlinkSync(inputPath);
  } catch {}
  fs.renameSync(taggedPath, inputPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return {
    ok: true,
    artworkEmbedded: Boolean(coverPath && (isMp3 || isMp4Family)),
    chaptersEmbedded: Boolean((isMp3 && mp3ChaptersEmbedded) || (tagMetadataPath && Array.isArray(chapters) && chapters.length)),
    metadataEmbedded: true,
    tracklistEmbedded: Boolean(tracklistText)
  };
}

module.exports = {
  applyId3Tags,
  resolveBundledAtomicParsleyBinary
};
