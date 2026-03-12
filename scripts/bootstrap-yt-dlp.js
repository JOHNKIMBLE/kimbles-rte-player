const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { spawnSync } = require("node:child_process");

const repoDir = path.join(__dirname, "..", "vendor", "yt-dlp");
const ffmpegDir = path.join(__dirname, "..", "vendor", "ffmpeg");
const chromaprintDir = path.join(__dirname, "..", "vendor", "chromaprint");
const atomicParsleyDir = path.join(__dirname, "..", "vendor", "atomicparsley");
const baseReleaseUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const ffmpegReleaseUrl = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1";
const chromaprintVersion = "1.6.0";
const chromaprintReleaseUrl = `https://github.com/acoustid/chromaprint/releases/download/v${chromaprintVersion}`;
const atomicParsleyReleaseApiUrl = "https://api.github.com/repos/wez/atomicparsley/releases/latest";

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

const chromaprintTargets = [
  {
    id: "win32-x64",
    outPath: path.join(chromaprintDir, "bin", "win32-x64", "fpcalc.exe"),
    archiveType: "zip",
    assets: [`chromaprint-fpcalc-${chromaprintVersion}-windows-x86_64.zip`],
    archiveFileName: `chromaprint-fpcalc-${chromaprintVersion}-windows-x86_64.zip`,
    expectedBinaryName: "fpcalc.exe"
  },
  {
    id: "win32-arm64",
    outPath: path.join(chromaprintDir, "bin", "win32-arm64", "fpcalc.exe"),
    archiveType: "zip",
    assets: [`chromaprint-fpcalc-${chromaprintVersion}-windows-x86_64.zip`],
    archiveFileName: `chromaprint-fpcalc-${chromaprintVersion}-windows-x86_64.zip`,
    expectedBinaryName: "fpcalc.exe"
  },
  {
    id: "darwin-x64",
    outPath: path.join(chromaprintDir, "bin", "darwin-x64", "fpcalc"),
    archiveType: "tar.gz",
    assets: [`chromaprint-fpcalc-${chromaprintVersion}-macos-x86_64.tar.gz`],
    archiveFileName: `chromaprint-fpcalc-${chromaprintVersion}-macos-x86_64.tar.gz`,
    expectedBinaryName: "fpcalc"
  },
  {
    id: "darwin-arm64",
    outPath: path.join(chromaprintDir, "bin", "darwin-arm64", "fpcalc"),
    archiveType: "tar.gz",
    assets: [`chromaprint-fpcalc-${chromaprintVersion}-macos-arm64.tar.gz`],
    archiveFileName: `chromaprint-fpcalc-${chromaprintVersion}-macos-arm64.tar.gz`,
    expectedBinaryName: "fpcalc"
  },
  {
    id: "linux-x64",
    outPath: path.join(chromaprintDir, "bin", "linux-x64", "fpcalc"),
    archiveType: "tar.gz",
    assets: [`chromaprint-fpcalc-${chromaprintVersion}-linux-x86_64.tar.gz`],
    archiveFileName: `chromaprint-fpcalc-${chromaprintVersion}-linux-x86_64.tar.gz`,
    expectedBinaryName: "fpcalc"
  },
  {
    id: "linux-arm64",
    outPath: path.join(chromaprintDir, "bin", "linux-arm64", "fpcalc"),
    archiveType: "tar.gz",
    assets: [`chromaprint-fpcalc-${chromaprintVersion}-linux-arm64.tar.gz`],
    archiveFileName: `chromaprint-fpcalc-${chromaprintVersion}-linux-arm64.tar.gz`,
    expectedBinaryName: "fpcalc"
  }
];

const atomicParsleyTargets = [
  {
    id: "win32-x64",
    outPath: path.join(atomicParsleyDir, "bin", "win32-x64", "AtomicParsley.exe"),
    assetName: "AtomicParsleyWindows.zip",
    expectedBinaryName: "AtomicParsley.exe"
  },
  {
    id: "win32-arm64",
    outPath: path.join(atomicParsleyDir, "bin", "win32-arm64", "AtomicParsley.exe"),
    assetName: "AtomicParsleyWindows.zip",
    expectedBinaryName: "AtomicParsley.exe"
  },
  {
    id: "darwin-x64",
    outPath: path.join(atomicParsleyDir, "bin", "darwin-x64", "AtomicParsley"),
    assetName: "AtomicParsleyMacOS.zip",
    expectedBinaryName: "AtomicParsley"
  },
  {
    id: "darwin-arm64",
    outPath: path.join(atomicParsleyDir, "bin", "darwin-arm64", "AtomicParsley"),
    assetName: "AtomicParsleyMacOS.zip",
    expectedBinaryName: "AtomicParsley"
  },
  {
    id: "linux-x64",
    outPath: path.join(atomicParsleyDir, "bin", "linux-x64", "AtomicParsley"),
    assetName: "AtomicParsleyLinux.zip",
    expectedBinaryName: "AtomicParsley"
  },
  {
    id: "linux-arm64",
    outPath: path.join(atomicParsleyDir, "bin", "linux-arm64", "AtomicParsley"),
    assetName: "AtomicParsleyLinux.zip",
    expectedBinaryName: "AtomicParsley"
  }
];

function filterTargetsForCurrentPlatform(targets) {
  const allTargets = String(process.env.BOOTSTRAP_ALL_VENDOR_BINARIES || "").trim().toLowerCase();
  if (allTargets === "1" || allTargets === "true" || allTargets === "yes") {
    return targets.slice();
  }
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

function findFileRecursive(dir, expectedName) {
  if (!fs.existsSync(dir)) {
    return null;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === expectedName.toLowerCase()) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const nested = findFileRecursive(fullPath, expectedName);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function extractArchive(archivePath, destDir, archiveType) {
  fs.mkdirSync(destDir, { recursive: true });
  if (archiveType === "zip") {
    if (process.platform === "win32") {
      const result = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
        ],
        { stdio: "pipe", encoding: "utf8", shell: false }
      );
      if (result.status !== 0) {
        throw new Error(`zip extract failed: ${result.stderr || result.stdout || "unknown error"}`);
      }
      return;
    }

    const unzip = spawnSync("unzip", ["-o", archivePath, "-d", destDir], {
      stdio: "pipe",
      encoding: "utf8",
      shell: false
    });
    if (unzip.status === 0) {
      return;
    }

    const tarZip = spawnSync("tar", ["-xf", archivePath, "-C", destDir], {
      stdio: "pipe",
      encoding: "utf8",
      shell: false
    });
    if (tarZip.status !== 0) {
      throw new Error(`zip extract failed: ${unzip.stderr || unzip.stdout || tarZip.stderr || tarZip.stdout || "unknown error"}`);
    }
    return;
  }

  const result = spawnSync("tar", ["-xzf", archivePath, "-C", destDir], {
    stdio: "pipe",
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`tar extract failed: ${result.stderr || result.stdout || "unknown error"}`);
  }
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "User-Agent": "Kimble-RTE-Player/1.0",
        "Accept": "application/octet-stream,application/json"
      }
    }, (response) => {
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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "User-Agent": "Kimble-RTE-Player/1.0",
        "Accept": "application/vnd.github+json"
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        fetchJson(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
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

async function ensureChromaprintTarget(target) {
  if (fs.existsSync(target.outPath)) {
    return "exists";
  }

  const tempRoot = path.join(chromaprintDir, ".tmp", target.id);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(tempRoot, { recursive: true });

  let lastError = null;
  for (const asset of target.assets) {
    const archivePath = path.join(tempRoot, target.archiveFileName);
    try {
      console.log(`[bootstrap] downloading ${target.id} fpcalc from ${asset} ...`);
      await downloadFile(`${chromaprintReleaseUrl}/${asset}`, archivePath);
      const extractDir = path.join(tempRoot, "extract");
      extractArchive(archivePath, extractDir, target.archiveType);
      const binaryPath = findFileRecursive(extractDir, target.expectedBinaryName);
      if (!binaryPath) {
        throw new Error(`fpcalc binary not found in ${asset}`);
      }
      fs.mkdirSync(path.dirname(target.outPath), { recursive: true });
      fs.copyFileSync(binaryPath, target.outPath);
      if (!/\.exe$/i.test(target.outPath)) {
        fs.chmodSync(target.outPath, 0o755);
      }
      console.log(`[bootstrap] downloaded ${target.id} fpcalc`);
      fs.rmSync(tempRoot, { recursive: true, force: true });
      return "downloaded";
    } catch (error) {
      lastError = error;
    }
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
  throw new Error(`failed for ${target.id} fpcalc: ${lastError ? lastError.message : "unknown error"}`);
}

async function resolveAtomicParsleyAssetMap() {
  const release = await fetchJson(atomicParsleyReleaseApiUrl);
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const byName = new Map(assets.map((asset) => [String(asset?.name || ""), String(asset?.browser_download_url || "")]));
  return byName;
}

async function ensureAtomicParsleyTarget(target, assetMap) {
  if (fs.existsSync(target.outPath)) {
    return "exists";
  }

  const downloadUrl = assetMap.get(target.assetName);
  if (!downloadUrl) {
    throw new Error(`AtomicParsley asset missing: ${target.assetName}`);
  }

  const tempRoot = path.join(atomicParsleyDir, ".tmp", target.id);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(tempRoot, { recursive: true });
  const archivePath = path.join(tempRoot, path.basename(new URL(downloadUrl).pathname) || target.assetName);

  try {
    console.log(`[bootstrap] downloading ${target.id} AtomicParsley from ${target.assetName} ...`);
    await downloadFile(downloadUrl, archivePath);
    const extractDir = path.join(tempRoot, "extract");
    extractArchive(archivePath, extractDir, "zip");
    const binaryPath = findFileRecursive(extractDir, target.expectedBinaryName);
    if (!binaryPath) {
      throw new Error(`AtomicParsley binary not found in ${target.assetName}`);
    }
    fs.mkdirSync(path.dirname(target.outPath), { recursive: true });
    fs.copyFileSync(binaryPath, target.outPath);
    if (!/\.exe$/i.test(target.outPath)) {
      fs.chmodSync(target.outPath, 0o755);
    }
    console.log(`[bootstrap] downloaded ${target.id} AtomicParsley`);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    return "downloaded";
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`failed for ${target.id} AtomicParsley: ${error.message}`);
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

async function ensureAllChromaprintBinaries() {
  const selectedTargets = filterTargetsForCurrentPlatform(chromaprintTargets);
  const failures = [];
  for (const target of selectedTargets) {
    try {
      await ensureChromaprintTarget(target);
    } catch (error) {
      failures.push(error.message);
      console.warn(`[bootstrap] ${error.message}`);
    }
  }

  if (selectedTargets.length > 0 && failures.length === selectedTargets.length) {
    throw new Error("no chromaprint binaries could be downloaded");
  }
}

async function ensureAllAtomicParsleyBinaries() {
  const selectedTargets = filterTargetsForCurrentPlatform(atomicParsleyTargets);
  if (!selectedTargets.length) {
    return;
  }

  const assetMap = await resolveAtomicParsleyAssetMap();
  const failures = [];
  for (const target of selectedTargets) {
    try {
      await ensureAtomicParsleyTarget(target, assetMap);
    } catch (error) {
      failures.push(error.message);
      console.warn(`[bootstrap] ${error.message}`);
    }
  }

  if (selectedTargets.length > 0 && failures.length === selectedTargets.length) {
    throw new Error("no AtomicParsley binaries could be downloaded");
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

  try {
    await ensureAllChromaprintBinaries();
  } catch (error) {
    console.warn(`[bootstrap] chromaprint binaries download failed: ${error.message}`);
  }

  try {
    await ensureAllAtomicParsleyBinaries();
  } catch (error) {
    console.warn(`[bootstrap] AtomicParsley binaries download failed: ${error.message}`);
  }
}

main().catch((error) => {
  console.warn(`[bootstrap] failed: ${error.message}`);
});
