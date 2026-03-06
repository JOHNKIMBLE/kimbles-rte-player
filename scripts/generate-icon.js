const fs = require("node:fs");
const path = require("node:path");
const pngToIco = require("png-to-ico");
const sharp = require("sharp");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const pngPath = path.join(projectRoot, "build", "icon.png");
  const icoPath = path.join(projectRoot, "build", "icon.ico");

  if (!fs.existsSync(pngPath)) {
    throw new Error(`Missing source icon PNG: ${pngPath}`);
  }

  const source = sharp(pngPath, { failOn: "none" });
  const metadata = await source.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  if (!width || !height) {
    throw new Error(`Unreadable PNG dimensions for: ${pngPath}`);
  }

  const maxSide = Math.max(width, height);
  const squaredPng = await source
    .resize({
      width: maxSide,
      height: maxSide,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  const sizes = [256, 128, 64, 48, 32, 24, 16];
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(squaredPng)
        .resize(size, size, { fit: "cover" })
        .png()
        .toBuffer()
    )
  );

  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(icoPath, icoBuffer);
  process.stdout.write(`Generated ${icoPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
