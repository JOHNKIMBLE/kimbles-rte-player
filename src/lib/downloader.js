const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..", "..");
const isPackagedApp = path.basename(projectRoot).toLowerCase() === "app.asar";

function getVendorRootCandidates() {
  const candidates = [path.join(projectRoot, "vendor")];

  if (path.basename(projectRoot).toLowerCase() === "app.asar") {
    candidates.push(path.join(path.dirname(projectRoot), "app.asar.unpacked", "vendor"));
  }

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "app.asar.unpacked", "vendor"));
    candidates.push(path.join(process.resourcesPath, "vendor"));
  }

  return Array.from(new Set(candidates));
}

function getRepoCandidates() {
  return getVendorRootCandidates().map((vendorRoot) => path.join(vendorRoot, "yt-dlp"));
}

function hasYtDlpRepo(dir) {
  return fs.existsSync(path.join(dir, "yt_dlp", "__init__.py"));
}

function resolveRepoDir() {
  return getRepoCandidates().find((candidate) => hasYtDlpRepo(candidate)) || null;
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }
  return out;
}

function pickFinalMediaFile(tempDir) {
  const mediaExts = new Set([".mp3", ".m4a", ".aac", ".opus", ".ogg", ".mp4", ".webm", ".ts"]);
  const files = walkFiles(tempDir)
    .filter((filePath) => mediaExts.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => ({ filePath, size: fs.statSync(filePath).size }))
    .sort((a, b) => b.size - a.size);

  return files[0]?.filePath || null;
}

function pickThumbnailFile(tempDir) {
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const files = walkFiles(tempDir)
    .filter((filePath) => imageExts.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => ({ filePath, size: fs.statSync(filePath).size }))
    .sort((a, b) => b.size - a.size);
  return files[0]?.filePath || null;
}

function pickExistingExact(outputDir, preferredBaseName, ext) {
  const candidate = path.join(outputDir, `${preferredBaseName}${ext}`);
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return null;
}

function makeUniquePath(baseDir, baseName, ext) {
  let index = 0;
  while (true) {
    const suffix = index === 0 ? "" : ` (${index})`;
    const candidate = path.join(baseDir, `${baseName}${suffix}${ext}`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

function ensureWorldWritablePath(targetPath, isDirectory = false) {
  if (!targetPath || process.platform === "win32") {
    return;
  }
  try {
    fs.chmodSync(targetPath, isDirectory ? 0o777 : 0o666);
  } catch {}
}

function usesShellOnWindows(command) {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

function cmdOk(command, args = ["--version"], options = {}) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    shell: usesShellOnWindows(command),
    ...options
  });
  return !result.error && result.status === 0;
}

function getBundledBinaryCandidates(repoDir) {
  const candidates = [];

  if (process.platform === "win32") {
    if (process.arch === "arm64") {
      candidates.push(path.join(repoDir, "bin", "win32-arm64", "yt-dlp.exe"));
      candidates.push(path.join(repoDir, "bin", "win32-x64", "yt-dlp.exe"));
    } else {
      candidates.push(path.join(repoDir, "bin", "win32-x64", "yt-dlp.exe"));
      candidates.push(path.join(repoDir, "bin", "win32-arm64", "yt-dlp.exe"));
    }
    candidates.push(path.join(repoDir, "yt-dlp.exe"));
    return candidates;
  }

  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      candidates.push(path.join(repoDir, "bin", "darwin-arm64", "yt-dlp"));
      candidates.push(path.join(repoDir, "bin", "darwin-x64", "yt-dlp"));
    } else {
      candidates.push(path.join(repoDir, "bin", "darwin-x64", "yt-dlp"));
      candidates.push(path.join(repoDir, "bin", "darwin-arm64", "yt-dlp"));
    }
    candidates.push(path.join(repoDir, "yt-dlp"));
    return candidates;
  }

  if (process.arch === "arm64") {
    candidates.push(path.join(repoDir, "bin", "linux-arm64", "yt-dlp"));
    candidates.push(path.join(repoDir, "bin", "linux-x64", "yt-dlp"));
  } else {
    candidates.push(path.join(repoDir, "bin", "linux-x64", "yt-dlp"));
    candidates.push(path.join(repoDir, "bin", "linux-arm64", "yt-dlp"));
  }
  candidates.push(path.join(repoDir, "yt-dlp"));
  return candidates;
}

function getBundledFfmpegDirCandidates(vendorRoot) {
  const ffmpegRoot = path.join(vendorRoot, "ffmpeg");
  const candidates = [];

  if (process.platform === "win32") {
    if (process.arch === "arm64") {
      candidates.push(path.join(ffmpegRoot, "bin", "win32-arm64"));
      candidates.push(path.join(ffmpegRoot, "bin", "win32-x64"));
    } else {
      candidates.push(path.join(ffmpegRoot, "bin", "win32-x64"));
      candidates.push(path.join(ffmpegRoot, "bin", "win32-arm64"));
    }
    return candidates;
  }

  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      candidates.push(path.join(ffmpegRoot, "bin", "darwin-arm64"));
      candidates.push(path.join(ffmpegRoot, "bin", "darwin-x64"));
    } else {
      candidates.push(path.join(ffmpegRoot, "bin", "darwin-x64"));
      candidates.push(path.join(ffmpegRoot, "bin", "darwin-arm64"));
    }
    return candidates;
  }

  if (process.arch === "arm64") {
    candidates.push(path.join(ffmpegRoot, "bin", "linux-arm64"));
    candidates.push(path.join(ffmpegRoot, "bin", "linux-x64"));
  } else {
    candidates.push(path.join(ffmpegRoot, "bin", "linux-x64"));
    candidates.push(path.join(ffmpegRoot, "bin", "linux-arm64"));
  }
  return candidates;
}

function resolveBundledFfmpegDir() {
  const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  for (const vendorRoot of getVendorRootCandidates()) {
    for (const dir of getBundledFfmpegDirCandidates(vendorRoot)) {
      const ffmpegPath = path.join(dir, ffmpegName);
      if (fs.existsSync(ffmpegPath) && cmdOk(ffmpegPath, ["-version"], { cwd: dir })) {
        return dir;
      }
    }
  }
  return null;
}

function resolveBundledYtDlpBinary() {
  for (const repoDir of getRepoCandidates()) {
    for (const candidate of getBundledBinaryCandidates(repoDir)) {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      if (cmdOk(candidate, ["--version"], { cwd: repoDir })) {
        return {
          command: candidate,
          baseArgs: [],
          cwd: repoDir,
          shell: usesShellOnWindows(candidate)
        };
      }
    }
  }

  return null;
}

function resolveGlobalYtDlpPath() {
  if (process.platform === "win32") {
    const result = spawnSync("where", ["yt-dlp"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8"
    });
    if (result.status === 0 && !result.error) {
      const first = String(result.stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      if (first && fs.existsSync(first)) {
        if (/\.cmd$/i.test(first)) {
          const exeCandidate = first.replace(/\.cmd$/i, ".exe");
          if (fs.existsSync(exeCandidate)) {
            return exeCandidate;
          }
        }
        return first;
      }
    }
    return null;
  }

  return cmdOk("yt-dlp") ? "yt-dlp" : null;
}

function tryCloneYtDlp() {
  const existing = resolveRepoDir();
  if (existing) {
    return;
  }

  if (!cmdOk("git")) {
    return;
  }

  const ytDlpRepoDir = path.join(projectRoot, "vendor", "yt-dlp");
  fs.mkdirSync(path.dirname(ytDlpRepoDir), { recursive: true });
  spawnSync(
    "git",
    ["clone", "--depth", "1", "https://github.com/yt-dlp/yt-dlp", ytDlpRepoDir],
    {
      stdio: "ignore",
      shell: false
    }
  );
}

function resolveYtDlpCommand() {
  const attempted = [];

  tryCloneYtDlp();

  const bundledBinary = resolveBundledYtDlpBinary();
  if (bundledBinary) {
    attempted.push(`bundled:${bundledBinary.command}`);
    return bundledBinary;
  }

  const repoDir = resolveRepoDir();
  if (repoDir) {
    const pythonOptions = [
      { command: "py", baseArgs: ["-3", "-m", "yt_dlp"] },
      { command: "python", baseArgs: ["-m", "yt_dlp"] },
      { command: "python3", baseArgs: ["-m", "yt_dlp"] }
    ];

    for (const option of pythonOptions) {
      attempted.push(`${option.command} ${option.baseArgs.join(" ")} (cwd=${repoDir})`);
      if (cmdOk(option.command, [...option.baseArgs, "--version"], { cwd: repoDir })) {
        return {
          ...option,
          cwd: repoDir
        };
      }
    }
  }

  if (process.env.YTDLP_CMD) {
    const envCmd = String(process.env.YTDLP_CMD).trim();
    if (envCmd) {
      attempted.push(`env:YTDLP_CMD=${envCmd}`);
      if (cmdOk(envCmd, ["--version"], { cwd: projectRoot })) {
        return {
          command: envCmd,
          baseArgs: [],
          cwd: projectRoot,
          shell: usesShellOnWindows(envCmd)
        };
      }
      attempted.push(`env-invalid:${envCmd}`);
    }
  }

  const globalPythonOptions = [
    { command: "py", baseArgs: ["-3", "-m", "yt_dlp"] },
    { command: "python", baseArgs: ["-m", "yt_dlp"] },
    { command: "python3", baseArgs: ["-m", "yt_dlp"] }
  ];

  for (const option of globalPythonOptions) {
    if (isPackagedApp) {
      attempted.push(`skip-global-python:${option.command}`);
      continue;
    }
    attempted.push(`${option.command} ${option.baseArgs.join(" ")} (global)`);
    if (cmdOk(option.command, [...option.baseArgs, "--version"], { cwd: projectRoot })) {
      return {
        ...option,
        cwd: projectRoot
      };
    }
  }

  const globalYtDlp = resolveGlobalYtDlpPath();
  if (isPackagedApp) {
    attempted.push("skip-global-yt-dlp:packaged");
    throw new Error(
      `yt-dlp was not found in bundled vendor files. Tried: ${attempted.join(" | ")}.`
    );
  }
  attempted.push(`global:${globalYtDlp || "not-found"}`);
  if (globalYtDlp) {
    return {
      command: globalYtDlp,
      baseArgs: [],
      cwd: projectRoot,
      shell: usesShellOnWindows(globalYtDlp)
    };
  }

  throw new Error(
    `yt-dlp was not found. Tried: ${attempted.join(" | ")}. Install Python + yt-dlp, include vendor/yt-dlp, or set YTDLP_CMD.`
  );
}

function emitProgress(onProgress, payload) {
  if (typeof onProgress !== "function") {
    return;
  }

  onProgress(payload);
}

function parseProgressLine(line) {
  const text = String(line || "").replace(/\x1B\[[0-9;]*m/g, "").trim();
  if (!text) {
    return null;
  }

  const progressMatch = text.match(/\[download\]\s+(\d{1,3}(?:\.\d+)?)%/i);
  const fragmentMatch = text.match(/\(frag\s+(\d+)\/(\d+)\)/i);
  if (progressMatch) {
    return {
      kind: "download",
      message: text,
      percent: Number(progressMatch[1]),
      fragmentCurrent: fragmentMatch ? Number(fragmentMatch[1]) : null,
      fragmentTotal: fragmentMatch ? Number(fragmentMatch[2]) : null
    };
  }

  const stageMatch = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (stageMatch) {
    return {
      kind: stageMatch[1].toLowerCase(),
      message: stageMatch[2] || text
    };
  }

  return {
    kind: "log",
    message: text
  };
}

function normalizeRequestedAudioFormat(audioFormat) {
  const value = String(audioFormat || "m4a")
    .toLowerCase()
    .replace(/^\./, "")
    .trim();
  return value === "mp3" ? "mp3" : "m4a";
}

function normalizeAudioBitrate(audioQuality, fallback = "128K") {
  const raw = String(audioQuality || fallback || "").trim();
  const match = raw.match(/^(\d+)(?:\s*[kK])?$/);
  if (match) {
    return `${match[1]}k`;
  }
  return raw || "128k";
}

function runFfmpegAudioPostprocess({
  inputPath,
  outputPath,
  audioFormat,
  audioQuality,
  normalizeLoudness = true,
  onProgress
}) {
  const ffmpegDir = resolveBundledFfmpegDir();
  if (!ffmpegDir) {
    throw new Error("Bundled ffmpeg was not found under vendor/ffmpeg/bin for this platform.");
  }

  const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const ffmpegPath = path.join(ffmpegDir, ffmpegExe);
  const safeFormat = normalizeRequestedAudioFormat(audioFormat);
  const targetBitrate = normalizeAudioBitrate(audioQuality);
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:a:0",
    "-vn"
  ];

  if (normalizeLoudness) {
    args.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11");
  }

  if (safeFormat === "mp3") {
    args.push("-c:a", "libmp3lame", "-b:a", targetBitrate);
  } else {
    args.push("-c:a", "aac", "-b:a", targetBitrate, "-f", "ipod");
  }

  args.push(outputPath);

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      cwd: ffmpegDir,
      shell: false
    });
    let log = "";

    emitProgress(onProgress, {
      kind: "postprocess",
      message: normalizeLoudness
        ? `Converting to ${safeFormat.toUpperCase()} and normalizing loudness...`
        : `Converting to ${safeFormat.toUpperCase()}...`
    });

    child.stdout.on("data", (chunk) => {
      log += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      log += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start ffmpeg post-processing: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outputPath)) {
        reject(new Error(`ffmpeg audio post-processing failed\n${log}`));
        return;
      }
      resolve({ log: log.trim() });
    });
  });
}

function runYtDlpDownload({
  manifestUrl,
  sourceUrl,
  title,
  outputDir,
  archivePath = "",
  registerCancel = null,
  onProgress,
  forceDownload = false,
  audioFormat = "m4a",
  audioQuality = "",
  dedupeMode = "source-id",
  normalizeLoudness = true,
  fetchThumbnail = false
}) {
  const inputUrl = String(sourceUrl || manifestUrl || "").trim();
  if (!inputUrl) {
    throw new Error("No source URL provided to yt-dlp download.");
  }

  const safeTitle = sanitizeFilename(title) || "rte-audio";
  const safeFormat = normalizeRequestedAudioFormat(audioFormat);
  const outputExt = safeFormat.startsWith(".") ? safeFormat : `.${safeFormat}`;
  const skipByTitle = dedupeMode === "title-date";
  const skipBySource = dedupeMode === "source-id";
  const existingTarget = path.join(outputDir, `${safeTitle}${outputExt}`);
  if (!forceDownload && (skipByTitle || skipBySource) && fs.existsSync(existingTarget)) {
    ensureWorldWritablePath(outputDir, true);
    ensureWorldWritablePath(existingTarget, false);
    return Promise.resolve({
      fileName: path.basename(existingTarget),
      existing: true,
      log: `Skipped download; file already exists: ${existingTarget}`
    });
  }
  const tempDir = path.join(outputDir, `.ytmp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  ensureWorldWritablePath(outputDir, true);
  ensureWorldWritablePath(tempDir, true);
  const outputTemplate = path.join(tempDir, "%(title).180B.%(ext)s");
  const normalizedArchivePath = String(archivePath || "").trim() || path.join(outputDir, ".yt-dlp-archive.txt");
  fs.mkdirSync(path.dirname(normalizedArchivePath), { recursive: true });
  const targetAudioQuality = String(audioQuality || process.env.RTE_AUDIO_QUALITY || "128K");

  const runner = resolveYtDlpCommand();
  const ffmpegLocation = resolveBundledFfmpegDir();
  if (!ffmpegLocation) {
    throw new Error("Bundled ffmpeg was not found under vendor/ffmpeg/bin for this platform.");
  }
  const shellSafeOutputTemplate = runner.shell
    ? outputTemplate.replace(/%/g, "%%")
    : outputTemplate;
  const args = [
    ...runner.baseArgs,
    "--ignore-config",
    "--no-playlist",
    "--playlist-items",
    "1",
    "-f",
    "bestaudio/best",
    "--ffmpeg-location",
    ffmpegLocation,
    "--no-part",
    "-o",
    shellSafeOutputTemplate,
    inputUrl
  ];
  if (fetchThumbnail) {
    args.splice(args.indexOf("-o"), 0, "--write-thumbnail", "--convert-thumbnails", "jpg");
  }
  if (/\.m3u8(?:$|[?#])/i.test(inputUrl)) {
    args.splice(args.indexOf("--no-part"), 0, "--hls-use-mpegts");
  }
  if (!forceDownload && skipBySource) {
    args.splice(args.indexOf("--ffmpeg-location"), 0, "--download-archive", normalizedArchivePath);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(runner.command, args, {
      cwd: runner.cwd,
      shell: Boolean(runner.shell)
    });
    let cancelled = false;
    if (typeof registerCancel === "function") {
      registerCancel(() => {
        cancelled = true;
        try {
          child.kill("SIGTERM");
        } catch {}
        setTimeout(() => {
          if (!child.killed) {
            try {
              child.kill("SIGKILL");
            } catch {}
          }
        }, 2000);
      });
    }

    let log = "";
    let stdoutRemainder = "";
    let stderrRemainder = "";

    function handleChunk(chunk, source) {
      const text = chunk.toString();
      log += text;

      const currentRemainder = source === "stdout" ? stdoutRemainder : stderrRemainder;
      const combined = currentRemainder + text;
      const segments = combined.split(/\r?\n|\r/g);
      const nextRemainder = segments.pop() || "";
      if (source === "stdout") {
        stdoutRemainder = nextRemainder;
      } else {
        stderrRemainder = nextRemainder;
      }

      for (const segment of segments) {
        const parsed = parseProgressLine(segment);
        if (parsed) {
          emitProgress(onProgress, parsed);
        }
      }
    }

    child.stdout.on("data", (chunk) => {
      handleChunk(chunk, "stdout");
    });

    child.stderr.on("data", (chunk) => {
      handleChunk(chunk, "stderr");
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to start yt-dlp command "${runner.command}" (cwd: ${runner.cwd}): ${error.message}`
        )
      );
    });

    child.on("close", (code) => {
      const finish = async () => {
      if (cancelled) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        reject(new Error("Download cancelled."));
        return;
      }
      const trailing = [stdoutRemainder, stderrRemainder]
        .map((item) => item.trim())
        .filter(Boolean);
      for (const line of trailing) {
        const parsed = parseProgressLine(line);
        if (parsed) {
          emitProgress(onProgress, parsed);
        }
      }

      const downloadedFile = pickFinalMediaFile(tempDir);
      const maxDownloadsExit = code === 101 && /Maximum number of downloads reached/i.test(log);
      if (code !== 0 && !(maxDownloadsExit && downloadedFile)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        reject(new Error(`yt-dlp exited with code ${code}\n${log}`));
        return;
      }

      if (!downloadedFile) {
        const archiveSkip = /has already been recorded in the archive/i.test(log);
        if (!forceDownload && skipBySource && archiveSkip) {
          const existingFile = pickExistingExact(outputDir, safeTitle, outputExt);
          if (!existingFile) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            reject(new Error("Archive says already downloaded, but matching file was not found in this target folder. Click Download again to force."));
            return;
          }
          fs.rmSync(tempDir, { recursive: true, force: true });
          ensureWorldWritablePath(outputDir, true);
          ensureWorldWritablePath(existingFile, false);
          resolve({
            fileName: existingFile ? path.basename(existingFile) : `${safeTitle}${outputExt}`,
            existing: true,
            log: log.trim() || `Skipped download; URL already in archive: ${inputUrl}`
          });
          return;
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
        reject(new Error("yt-dlp finished but no output media file was found."));
        return;
      }

      const processedPath = path.join(tempDir, `processed${outputExt}`);
      const postprocess = await runFfmpegAudioPostprocess({
        inputPath: downloadedFile,
        outputPath: processedPath,
        audioFormat: safeFormat,
        audioQuality: targetAudioQuality,
        normalizeLoudness,
        onProgress
      });

      const finalPath = makeUniquePath(outputDir, safeTitle, outputExt);
      let stagedArtworkPath = "";
      const thumbnailFile = fetchThumbnail ? pickThumbnailFile(tempDir) : null;
      if (thumbnailFile && fs.existsSync(thumbnailFile)) {
        const artworkExt = path.extname(thumbnailFile).toLowerCase() || ".jpg";
        stagedArtworkPath = path.join(outputDir, `.cover-${Date.now()}-${Math.random().toString(16).slice(2, 8)}${artworkExt}`);
        try {
          fs.copyFileSync(thumbnailFile, stagedArtworkPath);
          ensureWorldWritablePath(stagedArtworkPath, false);
        } catch {
          stagedArtworkPath = "";
        }
      }
      fs.renameSync(processedPath, finalPath);
      fs.rmSync(tempDir, { recursive: true, force: true });
      ensureWorldWritablePath(outputDir, true);
      ensureWorldWritablePath(finalPath, false);

      resolve({
        fileName: path.basename(finalPath),
        artworkPath: stagedArtworkPath,
        log: [log.trim(), postprocess.log].filter(Boolean).join("\n")
      });
      };

      finish().catch((error) => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        reject(error);
      });
    });
  });
}

/**
 * Run yt-dlp with --get-url -f bestaudio and return the first URL line.
 * More reliable than -J for extractors that have changed their format API
 * (e.g. Mixcloud). Throws if no URL is returned or yt-dlp exits non-zero.
 */
function runYtDlpGetUrl({ url, format = "bestaudio", extraArgs = [] }) {
  const inputUrl = String(url || "").trim();
  if (!inputUrl) throw new Error("No URL provided.");

  const runner = resolveYtDlpCommand();
  const cmdArgs = [
    ...runner.baseArgs,
    "--ignore-config",
    "-f", format,
    "--get-url",
    "--no-playlist",
    "--playlist-items", "1",
    ...extraArgs,
    inputUrl
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(runner.command, cmdArgs, {
      cwd: runner.cwd,
      shell: Boolean(runner.shell)
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("error", (error) => {
      reject(new Error(`Failed to start yt-dlp: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}\n${stderr || stdout}`));
        return;
      }
      const firstLine = String(stdout || "").trim().split(/\r?\n/)[0].trim();
      if (!firstLine || !firstLine.startsWith("http")) {
        reject(new Error("yt-dlp --get-url returned no URL."));
        return;
      }
      resolve(firstLine);
    });
  });
}

function runYtDlpJson({ url, args = [] }) {
  const inputUrl = String(url || "").trim();
  if (!inputUrl) {
    throw new Error("No URL provided.");
  }

  const runner = resolveYtDlpCommand();
  const cmdArgs = [
    ...runner.baseArgs,
    "--ignore-config",
    ...args,
    inputUrl
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(runner.command, cmdArgs, {
      cwd: runner.cwd,
      shell: Boolean(runner.shell)
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to start yt-dlp command "${runner.command}" (cwd: ${runner.cwd}): ${error.message}`
        )
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}\n${stderr || stdout}`));
        return;
      }

      try {
        const parsed = JSON.parse(String(stdout || "").trim() || "{}");
        resolve(parsed);
      } catch (error) {
        reject(new Error(`yt-dlp returned invalid JSON: ${error.message}`));
      }
    });
  });
}

/**
 * Spawn yt-dlp to extract and decode audio from a URL, piping output to stdout.
 * Returns the spawned child process — caller should pipe child.stdout to a response.
 * Use for sources where direct URL extraction won't work (e.g. AES-encrypted HLS).
 */
function spawnYtDlpPipe(url, extraArgs = []) {
  const runner = resolveYtDlpCommand();
  const args = [
    ...runner.baseArgs,
    "--ignore-config",
    "--no-playlist",
    "--playlist-items", "1",
    "-o", "-",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    ...extraArgs,
    String(url)
  ];
  return spawn(runner.command, args, { cwd: runner.cwd, shell: Boolean(runner.shell) });
}

module.exports = {
  resolveBundledFfmpegDir,
  runYtDlpDownload,
  runYtDlpGetUrl,
  runYtDlpJson,
  spawnYtDlpPipe
};
