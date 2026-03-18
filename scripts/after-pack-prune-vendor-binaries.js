const fs = require("node:fs");
const path = require("node:path");

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function prunePlatformBins(binRoot, platformPrefix) {
  const entries = safeReadDir(binRoot).filter((entry) => entry.isDirectory());
  for (const entry of entries) {
    if (!entry.name.startsWith(platformPrefix)) {
      removePath(path.join(binRoot, entry.name));
    }
  }
}

function getPlatformPrefix(platform) {
  return platform === "win32"
    ? "win32-"
    : platform === "darwin"
      ? "darwin-"
      : "linux-";
}

function pruneVendorPlatformBins(unpackedVendorRoot, platformPrefix) {
  const ytBinRoot = path.join(unpackedVendorRoot, "yt-dlp", "bin");
  const ffmpegBinRoot = path.join(unpackedVendorRoot, "ffmpeg", "bin");
  const songrecBinRoot = path.join(unpackedVendorRoot, "songrec", "bin");
  const chromaprintBinRoot = path.join(unpackedVendorRoot, "chromaprint", "bin");
  const atomicParsleyBinRoot = path.join(unpackedVendorRoot, "atomicparsley", "bin");

  prunePlatformBins(ytBinRoot, platformPrefix);
  prunePlatformBins(ffmpegBinRoot, platformPrefix);
  prunePlatformBins(songrecBinRoot, platformPrefix);
  prunePlatformBins(chromaprintBinRoot, platformPrefix);
  prunePlatformBins(atomicParsleyBinRoot, platformPrefix);
}

async function afterPack(context) {
  const platformPrefix = getPlatformPrefix(context.electronPlatformName);

  const unpackedVendorRoot = path.join(context.appOutDir, "resources", "app.asar.unpacked", "vendor");
  pruneVendorPlatformBins(unpackedVendorRoot, platformPrefix);
}

module.exports = afterPack;
module.exports.getPlatformPrefix = getPlatformPrefix;
module.exports.prunePlatformBins = prunePlatformBins;
module.exports.pruneVendorPlatformBins = pruneVendorPlatformBins;
