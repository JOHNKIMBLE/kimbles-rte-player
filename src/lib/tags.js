const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveBundledFfmpegDir } = require("./downloader");

function clean(input) {
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
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
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
  const isMp3 = ext === ".mp3";
  const isMp4Family = new Set([".m4a", ".mp4", ".m4b", ".m4p", ".m4r"]).has(ext);

  const tagTitle = clean(title);
  const tagAlbum = clean(programTitle);
  const tagArtist = sourceType === "bbc" ? "BBC Radio" : sourceType === "wwf" ? "Worldwide FM" : sourceType === "nts" ? "NTS Radio" : sourceType === "fip" ? "FIP Radio" : sourceType === "kexp" ? "KEXP" : "RTE Radio";
  const tagDate = clean(publishedTime);
  const tagComment = clean(sourceUrl || episodeUrl);
  const tagGenre = sourceType === "bbc" ? "Radio;BBC" : sourceType === "wwf" ? "Radio;Worldwide FM" : sourceType === "nts" ? "Radio;NTS" : sourceType === "fip" ? "Radio;FIP" : sourceType === "kexp" ? "Radio;KEXP" : "Radio;RTE";
  const tagPublisher = sourceType === "bbc" ? "BBC Sounds" : sourceType === "wwf" ? "Worldwide FM" : sourceType === "nts" ? "NTS" : sourceType === "fip" ? "Radio France / FIP" : sourceType === "kexp" ? "KEXP" : "RTE Radio";
  const tagYearMatch = tagDate.match(/\b(\d{4})\b/);
  const tagYear = tagYearMatch?.[1] || "";
  const tagDescription = clean(description);
  const sourceId = clean(clipId);

  const coverPath = resolveLocalCoverPath(artworkPath, tmpDir) || await downloadCoverToTemp(artworkUrl, tmpDir);
  const args = ["-y", "-i", inputPath];
  if (coverPath && isMp3) {
    args.push("-i", coverPath);
  }

  args.push(
    "-map", "0:a:0",
    "-c:a", "copy",
    "-metadata", `title=${tagTitle}`,
    "-metadata", `album=${tagAlbum}`,
    "-metadata", `artist=${tagArtist}`,
    "-metadata", `album_artist=${tagArtist}`,
    "-metadata", `genre=${tagGenre}`,
    "-metadata", `publisher=${tagPublisher}`,
    "-metadata", `date=${tagDate}`,
    "-metadata", `comment=${tagComment}`,
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
  if (tagComment) {
    args.push("-metadata", `purl=${tagComment}`);
  }

  if (coverPath && isMp3) {
    const coverExt = String(path.extname(coverPath) || "").toLowerCase();
    const coverCodec = coverExt === ".png" ? "png" : "mjpeg";
    args.push(
      "-map", "1:v:0",
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

  try {
    fs.unlinkSync(inputPath);
  } catch {}
  fs.renameSync(taggedPath, inputPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { ok: true, artworkEmbedded: Boolean(coverPath && (isMp3 || isMp4Family)) };
}

module.exports = {
  applyId3Tags
};
