const { extractRteInfo } = require("../src/lib/rte");

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node scripts/test-extract.js <rte-url>");
    process.exit(1);
  }

  const info = await extractRteInfo(url);
  console.log(JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
