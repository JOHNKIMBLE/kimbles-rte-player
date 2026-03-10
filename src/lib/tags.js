const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveBundledFfmpegDir } = require("./downloader");

function clean(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

async function downloadCoverToTemp(url, tempDir) {
  const input = String(url || "").trim();
  if (!input) {
    return null;
  }
  try {
    const response = await fetch(input, {
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

async function applyId3Tags({
  audioPath,
  title,
  programTitle,
  sourceType,
  publishedTime,
  sourceUrl,
  artworkUrl,
  episodeUrl = "",
  clipId = "",
  description = ""
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

  const tagTitle = clean(title);
  const tagAlbum = clean(programTitle);
  const tagArtist = sourceType === "bbc" ? "BBC Radio" : "RTE Radio";
  const tagDate = clean(publishedTime);
  const tagComment = clean(sourceUrl || episodeUrl);
  const tagGenre = sourceType === "bbc" ? "Radio;BBC" : "Radio;RTE";
  const tagPublisher = sourceType === "bbc" ? "BBC Sounds" : "RTÉ Radio";
  const tagYearMatch = tagDate.match(/\b(\d{4})\b/);
  const tagYear = tagYearMatch?.[1] || "";
  const tagDescription = clean(description);
  const sourceId = clean(clipId);

  const args = [
    "-y",
    "-i", inputPath,
    "-map", "0:a",
    "-c:a", "copy",
    "-metadata", `title=${tagTitle}`,
    "-metadata", `album=${tagAlbum}`,
    "-metadata", `artist=${tagArtist}`,
    "-metadata", `album_artist=${tagArtist}`,
    "-metadata", `genre=${tagGenre}`,
    "-metadata", `publisher=${tagPublisher}`,
    "-metadata", `date=${tagDate}`,
    "-metadata", `comment=${tagComment}`,
    "-metadata", `encoded_by=Kimble RTE/BBC Downloader`
  ];
  if (ext === ".mp3") {
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
  if (tagComment) {
    args.push("-metadata", `purl=${tagComment}`);
  }

  const coverPath = await downloadCoverToTemp(artworkUrl, tmpDir);
  if (coverPath) {
    args.push(
      "-i", coverPath,
      "-map", "1:v",
      "-c:v", "mjpeg",
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
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { ok: false, reason: "ffmpeg tagging failed" };
  }

  try {
    fs.unlinkSync(inputPath);
  } catch {}
  fs.renameSync(taggedPath, inputPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { ok: true };
}

module.exports = {
  applyId3Tags
};

