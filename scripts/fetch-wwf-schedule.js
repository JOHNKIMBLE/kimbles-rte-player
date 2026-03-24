const https = require("https");
const { parseWwfScheduleJsonSlice } = require("../src/lib/wwf-schedule-json");
const opts = { headers: { "User-Agent": "Mozilla/5.0" } };
https.get("https://www.worldwidefm.net/schedule", opts, (r) => {
  let b = "";
  r.on("data", (c) => (b += c));
  r.on("end", () => {
    const html = b.toString();
    const startIdx = html.indexOf("[{\\\"show_key\\\"");
    const endIdx = html.indexOf("}]", startIdx);
    if (startIdx >= 0 && endIdx > startIdx) {
      const raw = html.slice(startIdx, endIdx + 2);
      const arr = parseWwfScheduleJsonSlice(raw);
      if (arr.length) {
        console.log("Parsed array length:", arr.length);
        console.log("First item:", JSON.stringify(arr[0], null, 2).slice(0, 500));
      } else {
        console.log("Parse err: empty or invalid schedule JSON slice");
      }
    }
    const re = /\\"show_time\\":\\"(\d{2}:\d{2})\\"[^}]*\\"date\\":\\"(\d{4}-\d{2}-\d{2})\\"[^}]*\\"name\\":\\"((?:[^"\\]|\\.)*)\\"[^}]*\\"url\\":\\"([^"]+)\\"[^}]*\\"picture\\":\\"([^"]+)\\"/g;
    const slots = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      slots.push({
        startTime: m[1],
        date: m[2],
        name: m[3].replace(/\\u0026/g, "&"),
        url: m[4].replace(/\\\//g, "/"),
        picture: m[5].replace(/\\\//g, "/")
      });
    }
    console.log("Slots found:", slots.length);
    console.log("First 2:", JSON.stringify(slots.slice(0, 2), null, 2));
  });
});
