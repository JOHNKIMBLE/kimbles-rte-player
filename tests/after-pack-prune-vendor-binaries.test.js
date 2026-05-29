const fs = require("fs");
const os = require("os");
const path = require("path");
const afterPack = require("../scripts/after-pack-prune-vendor-binaries");

function makeDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  fs.writeFileSync(path.join(targetPath, "keep.txt"), "ok");
}

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

describe("after-pack-prune-vendor-binaries", () => {
  test("getPlatformPrefix maps supported platforms", () => {
    expect(afterPack.getPlatformPrefix("win32")).toBe("win32-");
    expect(afterPack.getPlatformPrefix("darwin")).toBe("darwin-");
    expect(afterPack.getPlatformPrefix("linux")).toBe("linux-");
    expect(afterPack.getPlatformPrefix("freebsd")).toBe("linux-");
  });

  test("prunePlatformBins removes non-matching platform directories", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-bins-"));
    const binRoot = path.join(tempDir, "bin");
    makeDir(path.join(binRoot, "win32-x64"));
    makeDir(path.join(binRoot, "darwin-arm64"));
    makeDir(path.join(binRoot, "linux-x64"));

    afterPack.prunePlatformBins(binRoot, "win32-");

    expect(exists(path.join(binRoot, "win32-x64"))).toBe(true);
    expect(exists(path.join(binRoot, "darwin-arm64"))).toBe(false);
    expect(exists(path.join(binRoot, "linux-x64"))).toBe(false);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("pruneVendorPlatformBins prunes all vendor bin roots", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prune-vendor-"));
    const vendorRoot = path.join(tempDir, "vendor");
    const vendorNames = ["yt-dlp", "ffmpeg", "songrec", "chromaprint", "atomicparsley"];

    for (const vendorName of vendorNames) {
      makeDir(path.join(vendorRoot, vendorName, "bin", "win32-x64"));
      makeDir(path.join(vendorRoot, vendorName, "bin", "darwin-arm64"));
      makeDir(path.join(vendorRoot, vendorName, "bin", "linux-x64"));
    }

    afterPack.pruneVendorPlatformBins(vendorRoot, "darwin-");

    for (const vendorName of vendorNames) {
      const binRoot = path.join(vendorRoot, vendorName, "bin");
      expect(exists(path.join(binRoot, "darwin-arm64"))).toBe(true);
      expect(exists(path.join(binRoot, "win32-x64"))).toBe(false);
      expect(exists(path.join(binRoot, "linux-x64"))).toBe(false);
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("afterPack prunes the unpacked vendor directory for the target platform", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "after-pack-"));
    const unpackedVendorRoot = path.join(tempDir, "resources", "app.asar.unpacked", "vendor");
    const vendorNames = ["yt-dlp", "ffmpeg", "songrec", "chromaprint", "atomicparsley"];

    for (const vendorName of vendorNames) {
      makeDir(path.join(unpackedVendorRoot, vendorName, "bin", "win32-x64"));
      makeDir(path.join(unpackedVendorRoot, vendorName, "bin", "darwin-arm64"));
    }

    await afterPack({
      electronPlatformName: "win32",
      appOutDir: tempDir
    });

    for (const vendorName of vendorNames) {
      const binRoot = path.join(unpackedVendorRoot, vendorName, "bin");
      expect(exists(path.join(binRoot, "win32-x64"))).toBe(true);
      expect(exists(path.join(binRoot, "darwin-arm64"))).toBe(false);
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
