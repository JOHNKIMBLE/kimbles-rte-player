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

module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName;
  const platformPrefix = platform === "win32"
    ? "win32-"
    : platform === "darwin"
      ? "darwin-"
      : "linux-";

  const unpackedVendorRoot = path.join(context.appOutDir, "resources", "app.asar.unpacked", "vendor");
  const ytBinRoot = path.join(unpackedVendorRoot, "yt-dlp", "bin");
  const ffmpegBinRoot = path.join(unpackedVendorRoot, "ffmpeg", "bin");

  prunePlatformBins(ytBinRoot, platformPrefix);
  prunePlatformBins(ffmpegBinRoot, platformPrefix);
};
