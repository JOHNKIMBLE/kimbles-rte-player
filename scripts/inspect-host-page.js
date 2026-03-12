// Inspect WWF host page RSC data to understand episode format
const https = require("node:https");

const url = "https://www.worldwidefm.net/hosts/valentine-comar";
https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const html = Buffer.concat(chunks).toString();

    // 1. Look for Cosmic "type":"episode" objects
    const typeIdx = html.indexOf('"type":"episode"');
    console.log("=== type:episode found:", typeIdx > 0, "===");
    if (typeIdx > 0) {
      console.log(html.slice(Math.max(0, typeIdx - 300), typeIdx + 200).slice(0, 500));
    }

    // 2. Count slug references
    const slugMatches = html.match(/"slug":"worldwide-breakfast/g) || [];
    console.log("\n=== slug:worldwide-breakfast count:", slugMatches.length, "===");

    // 3. Look for imgix URLs near episode links
    const epPattern = /\/episode\/worldwide-breakfast[^"'\s\\]*/g;
    let m;
    let count = 0;
    while ((m = epPattern.exec(html)) !== null && count < 3) {
      const start = Math.max(0, m.index - 400);
      const end = Math.min(html.length, m.index + m[0].length + 200);
      const context = html.slice(start, end);
      const hasImg = context.includes("imgix");
      const dateMatch = context.match(/\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}/);
      console.log(`\n=== Episode ${count + 1}: ${m[0].slice(0, 60)} ===`);
      console.log("hasImg:", hasImg, "| date:", dateMatch ? dateMatch[0] : "none");
      if (hasImg) {
        const imgMatch = context.match(/imgix\.cosmicjs\.com[^"'\s\\]*/);
        if (imgMatch) console.log("img:", imgMatch[0].slice(0, 80));
      }
      count++;
    }

    // 4. Look for RSC payloads with episode metadata
    const rscPattern = /self\.__next_f\.push\(\[1,"([^]*)"\]\)/g;
    let rscM;
    let rscCount = 0;
    while ((rscM = rscPattern.exec(html)) !== null) {
      const payload = rscM[1];
      if (payload.includes("metadata") && payload.includes("broadcast_date")) {
        console.log("\n=== RSC payload with metadata+broadcast_date (sample) ===");
        const metaIdx = payload.indexOf("broadcast_date");
        console.log(payload.slice(Math.max(0, metaIdx - 100), metaIdx + 200).slice(0, 300));
        rscCount++;
        if (rscCount >= 2) break;
      }
    }
    if (rscCount === 0) {
      console.log("\n=== No RSC payloads with metadata+broadcast_date ===");
    }

    // 5. Check OG description for schedule info
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    console.log("\n=== OG Description ===");
    console.log(ogDesc ? ogDesc[1] : "none");
  });
});
