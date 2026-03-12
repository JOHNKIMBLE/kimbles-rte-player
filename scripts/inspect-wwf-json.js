/**
 * Inspect WWF pages for embedded JSON (Cosmic-style) to design show/episode parsers.
 * Run: node scripts/inspect-wwf-json.js
 */
const https = require("https");
const BASE = "https://www.worldwidefm.net";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
      let b = "";
      r.on("data", (c) => (b += c));
      r.on("end", () => resolve(b.toString()));
      r.on("error", reject);
    }).on("error", reject);
  });
}

function findJsonPatterns(html, label) {
  console.log("\n=== " + label + " ===");
  console.log("Length:", html.length);
  const patterns = [
    { name: "show_key", re: /"show_key"\s*:/ },
    { name: "slug", re: /"slug"\s*:\s*"[^"]*episode/ },
    { name: "object_type", re: /"object_type"\s*:/ },
    { name: "metadata", re: /"metadata"\s*:/ },
    { name: "title", re: /"title"\s*:\s*"/ },
    { name: "picture", re: /"picture"\s*:\s*"https/ },
    { name: "cosmicjs", re: /cosmicjs\.com/ },
    { name: "episode", re: /"url"\s*:\s*"\/episode\// },
    { name: "array of objects", re: /\[\s*\{\s*"[^"]+"\s*:/ }
  ];
  for (const p of patterns) {
    const m = html.match(p.re);
    console.log(p.name + ":", m ? "yes" : "no");
  }
  const arrStart = html.indexOf("[{\"");
  const arrStartEsc = html.indexOf("[{\\\"");
  console.log("Array start [{\":", arrStart);
  console.log("Array start [{\\\":", arrStartEsc);
  if (arrStart >= 0 || arrStartEsc >= 0) {
    const snippet = html.slice(Math.max(0, (arrStart >= 0 ? arrStart : arrStartEsc) - 20), (arrStart >= 0 ? arrStart : arrStartEsc) + 200);
    console.log("Snippet:", snippet.slice(0, 300));
  }
  const episodeUrlMatch = html.match(/\\"url\\":\\"(\/episode\/[^"]+)\\"/);
  if (episodeUrlMatch) console.log("First episode url in JSON:", episodeUrlMatch[1]);
}

function extractAllEscapedArrays(html) {
  const results = [];
  const re = /\[(\{\\\"[^"]+\\\":[^\]]+)\]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1];
    if (inner.length > 100 && (inner.includes("episode") || inner.includes("picture") || inner.includes("slug"))) {
      results.push({ index: m.index, length: m[0].length, preview: inner.slice(0, 150) });
    }
  }
  return results;
}

async function main() {
  const showsHtml = await fetch(BASE + "/shows");
  findJsonPatterns(showsHtml, "SHOWS PAGE");
  const idx = showsHtml.indexOf("/episode/");
  if (idx >= 0) {
    const slice = showsHtml.slice(Math.max(0, idx - 300), idx + 150);
    console.log("\nShows page context around /episode/:", slice);
  }
  const episodesLabel = showsHtml.indexOf("episodes");
  if (episodesLabel >= 0) {
    const slice = showsHtml.slice(episodesLabel - 50, episodesLabel + 300);
    console.log("\nShows around 'episodes':", slice.slice(0, 400));
  }
  const pictureThenEpisode = showsHtml.indexOf("picture");
  let count = 0;
  let pos = 0;
  while ((pos = showsHtml.indexOf("\\\"url\\\":\\\"\\/episode\\/", pos)) !== -1 && count < 3) {
    const chunk = showsHtml.slice(Math.max(0, pos - 400), pos + 120);
    console.log("\nEscaped episode url at", pos, "context:", chunk.slice(0, 350));
    pos += 1;
    count++;
  }
  const possibleEpisodeArray = showsHtml.indexOf("episodes\":[");
  const possibleEpisodeArrayEsc = showsHtml.indexOf("episodes\\\":[");
  console.log("\nepisodes\":[ at", possibleEpisodeArray, "episodes\\\\\":[ at", possibleEpisodeArrayEsc);
  if (possibleEpisodeArrayEsc >= 0) {
    const after = showsHtml.slice(possibleEpisodeArrayEsc, possibleEpisodeArrayEsc + 500);
    console.log("After episodes\\\":[ ", after);
  }

  const episodeHtml = await fetch(BASE + "/episode/new-voices-giovanna-boffa-w-ugn-uma-10-03-2026");
  findJsonPatterns(episodeHtml, "EPISODE PAGE");
  const metaDesc = episodeHtml.match(/<meta[^>]+og:description[^>]+content=["']([^"']+)["']/i);
  if (metaDesc) console.log("\nEpisode og:description (first 120):", metaDesc[1].slice(0, 120));

  const scheduleHtml = await fetch(BASE + "/schedule");
  const scheduleStart = scheduleHtml.indexOf("[{\\\"show_key\\\"");
  if (scheduleStart >= 0) {
    const end = scheduleHtml.indexOf("}]", scheduleStart);
    const raw = scheduleHtml.slice(scheduleStart, end + 2);
    const unescaped = raw.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
    const arr = JSON.parse(unescaped);
    console.log("\n=== SCHEDULE first object keys ===");
    console.log(Object.keys(arr[0] || {}));
  }
}

main().catch(console.error);
