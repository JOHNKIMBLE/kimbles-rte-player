const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { spawnSync } = require("node:child_process");

const repoDir = path.join(__dirname, "..", "vendor", "yt-dlp");
const ffmpegDir = path.join(__dirname, "..", "vendor", "ffmpeg");
const baseReleaseUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const ffmpegReleaseUrl = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1";

const binaryTargets = [
  {
    id: "win32-x64",
    outPath: path.join(repoDir, "bin", "win32-x64", "yt-dlp.exe"),
    assets: ["yt-dlp.exe"]
  },
  {
    id: "win32-arm64",
    outPath: path.join(repoDir, "bin", "win32-arm64", "yt-dlp.exe"),
    assets: ["yt-dlp.exe"]
  },
  {
    id: "darwin-x64",
    outPath: path.join(repoDir, "bin", "darwin-x64", "yt-dlp"),
    assets: ["yt-dlp_macos", "yt-dlp"]
  },
  {
    id: "darwin-arm64",
    outPath: path.join(repoDir, "bin", "darwin-arm64", "yt-dlp"),
    assets: ["yt-dlp_macos", "yt-dlp"]
  },
  {
    id: "linux-x64",
    outPath: path.join(repoDir, "bin", "linux-x64", "yt-dlp"),
    assets: ["yt-dlp_linux", "yt-dlp"]
  },
  {
    id: "linux-arm64",
    outPath: path.join(repoDir, "bin", "linux-arm64", "yt-dlp"),
    assets: ["yt-dlp_linux_aarch64", "yt-dlp_linux_arm64", "yt-dlp_linux", "yt-dlp"]
  }
];

const ffmpegTargets = [
  {
    id: "win32-x64",
    ffmpegOutPath: path.join(ffmpegDir, "bin", "win32-x64", "ffmpeg.exe"),
    ffmpegAssets: ["ffmpeg-win32-x64"]
  },
  {
    id: "win32-arm64",
    ffmpegOutPath: path.join(ffmpegDir, "bin", "win32-arm64", "ffmpeg.exe"),
    ffmpegAssets: ["ffmpeg-win32-x64"]
  },
  {
    id: "darwin-x64",
    ffmpegOutPath: path.join(ffmpegDir, "bin", "darwin-x64", "ffmpeg"),
    ffmpegAssets: ["ffmpeg-darwin-x64"]
  },
  {
    id: "darwin-arm64",
    ffmpegOutPath: path.join(ffmpegDir, "bin", "darwin-arm64", "ffmpeg"),
    ffmpegAssets: ["ffmpeg-darwin-arm64"]
  },
  {
    id: "linux-x64",
    ffmpegOutPath: path.join(ffmpegDir, "bin", "linux-x64", "ffmpeg"),
    ffmpegAssets: ["ffmpeg-linux-x64"]
  },
  {
    id: "linux-arm64",
    ffmpegOutPath: path.join(ffmpegDir, "bin", "linux-arm64", "ffmpeg"),
    ffmpegAssets: ["ffmpeg-linux-arm64", "ffmpeg-linux-arm"]
  }
];

function filterTargetsForCurrentPlatform(targets) {
  const exactId = `${process.platform}-${process.arch}`;
  const exact = targets.filter((target) => target.id === exactId);
  if (exact.length > 0) {
    return exact;
  }

  const prefix = `${process.platform}-`;
  return targets.filter((target) => target.id.startsWith(prefix));
}

function commandExists(cmd, args = ["--version"]) {
  const result = spawnSync(cmd, args, { stdio: "ignore", shell: false });
  return result.status === 0;
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadFile(response.headers.location, outPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const file = fs.createWriteStream(outPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve());
      });
      file.on("error", (error) => {
        file.close(() => reject(error));
      });
    });

    request.on("error", reject);
  });
}

async function ensureBinaryTarget(target) {
  if (fs.existsSync(target.outPath)) {
    return "exists";
  }

  let lastError = null;
  for (const asset of target.assets) {
    const url = `${baseReleaseUrl}/${asset}`;
    try {
      console.log(`[bootstrap] downloading ${target.id} from ${asset} ...`);
      await downloadFile(url, target.outPath);
      if (!/\.exe$/i.test(target.outPath)) {
        fs.chmodSync(target.outPath, 0o755);
      }
      console.log(`[bootstrap] downloaded ${target.id}`);
      return "downloaded";
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`failed for ${target.id}: ${lastError ? lastError.message : "unknown error"}`);
}

async function ensureOneFfmpegAsset(target, outPath, assets, label) {
  if (fs.existsSync(outPath)) {
    return;
  }

  let lastError = null;
  for (const asset of assets) {
    const url = `${ffmpegReleaseUrl}/${asset}`;
    try {
      console.log(`[bootstrap] downloading ${target.id} ${label} from ${asset} ...`);
      await downloadFile(url, outPath);
      if (!/\.exe$/i.test(outPath)) {
        fs.chmodSync(outPath, 0o755);
      }
      console.log(`[bootstrap] downloaded ${target.id} ${label}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`failed for ${target.id} ${label}: ${lastError ? lastError.message : "unknown error"}`);
}

async function ensureFfmpegTarget(target) {
  await ensureOneFfmpegAsset(target, target.ffmpegOutPath, target.ffmpegAssets, "ffmpeg");
}

function removeLegacyFfprobeFiles() {
  const root = path.join(ffmpegDir, "bin");
  if (!fs.existsSync(root)) {
    return;
  }

  for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const dir = path.join(root, dirent.name);
    const probeNames = ["ffprobe", "ffprobe.exe"];
    for (const name of probeNames) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { force: true });
      }
    }
  }
}

async function ensureAllStandaloneBinaries() {
  const selectedTargets = filterTargetsForCurrentPlatform(binaryTargets);
  const failures = [];
  for (const target of selectedTargets) {
    try {
      await ensureBinaryTarget(target);
    } catch (error) {
      failures.push(error.message);
      console.warn(`[bootstrap] ${error.message}`);
    }
  }

  if (selectedTargets.length > 0 && failures.length === selectedTargets.length) {
    throw new Error("no yt-dlp binaries could be downloaded");
  }
}

async function ensureAllFfmpegBinaries() {
  const selectedTargets = filterTargetsForCurrentPlatform(ffmpegTargets);
  const failures = [];
  for (const target of selectedTargets) {
    try {
      await ensureFfmpegTarget(target);
    } catch (error) {
      failures.push(error.message);
      console.warn(`[bootstrap] ${error.message}`);
    }
  }

  if (selectedTargets.length > 0 && failures.length === selectedTargets.length) {
    throw new Error("no ffmpeg binaries could be downloaded");
  }
}

function ensureRepoClone() {
  if (fs.existsSync(path.join(repoDir, "yt_dlp", "__init__.py"))) {
    return;
  }

  if (!commandExists("git")) {
    console.warn("[bootstrap] git not found, skipping yt-dlp clone");
    return;
  }

  console.log("[bootstrap] cloning yt-dlp into vendor/yt-dlp ...");
  const clone = spawnSync(
    "git",
    ["clone", "--depth", "1", "https://github.com/yt-dlp/yt-dlp", repoDir],
    { stdio: "inherit", shell: false }
  );

  if (clone.status !== 0) {
    console.warn("[bootstrap] clone failed. App can still use yt-dlp from PATH if available.");
  }
}

async function main() {
  ensureRepoClone();
  removeLegacyFfprobeFiles();

  try {
    await ensureAllStandaloneBinaries();
  } catch (error) {
    console.warn(`[bootstrap] standalone binaries download failed: ${error.message}`);
  }

  try {
    await ensureAllFfmpegBinaries();
  } catch (error) {
    console.warn(`[bootstrap] ffmpeg binaries download failed: ${error.message}`);
  }
}

main().catch((error) => {
  console.warn(`[bootstrap] failed: ${error.message}`);
});
