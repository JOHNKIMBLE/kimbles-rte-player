const { decodeHtml, cleanText, stripHtml, inferCadence } = require("../src/lib/utils");

describe("decodeHtml", () => {
  test("decodes common named entities", () => {
    expect(decodeHtml("&amp;")).toBe("&");
    expect(decodeHtml("&quot;")).toBe('"');
    expect(decodeHtml("&lt;foo&gt;")).toBe("<foo>");
    expect(decodeHtml("&#39;")).toBe("'");
    expect(decodeHtml("&#039;")).toBe("'");
    expect(decodeHtml("&apos;")).toBe("'");
  });

  test("decodes typographic entities (WWF content)", () => {
    expect(decodeHtml("&ndash;")).toBe("\u2013");
    expect(decodeHtml("&mdash;")).toBe("\u2014");
    expect(decodeHtml("&rsquo;")).toBe("\u2019");
    expect(decodeHtml("&lsquo;")).toBe("\u2018");
    expect(decodeHtml("&hellip;")).toBe("\u2026");
  });

  test("decodes numeric decimal entities", () => {
    expect(decodeHtml("&#233;")).toBe("\u00e9"); // é
    expect(decodeHtml("&#169;")).toBe("\u00a9"); // ©
  });

  test("handles null/undefined", () => {
    expect(decodeHtml(null)).toBe("");
    expect(decodeHtml(undefined)).toBe("");
  });
});

describe("cleanText", () => {
  test("decodes entities and collapses whitespace", () => {
    expect(cleanText("  Rock &amp; Roll  ")).toBe("Rock & Roll");
    expect(cleanText("hello   world")).toBe("hello world");
    expect(cleanText("  ")).toBe("");
  });

  test("handles null/undefined", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
});

describe("stripHtml", () => {
  test("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
    expect(stripHtml("<br/>line")).toBe("line");
  });

  test("collapses whitespace after stripping", () => {
    expect(stripHtml("<p>  foo  </p>  <p>bar</p>")).toBe("foo bar");
  });

  test("handles null/undefined", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
  });
});

describe("inferCadence", () => {
  function makeEps(days) {
    // days = array of days-ago values
    const now = Date.now();
    return days.map((d) => ({ publishedTime: new Date(now - d * 86400000).toISOString() }));
  }

  test("returns unknown for fewer than 3 episodes", () => {
    expect(inferCadence([]).cadence).toBe("unknown");
    expect(inferCadence(makeEps([0, 7])).cadence).toBe("unknown");
  });

  test("detects daily cadence (avg <= 2 days)", () => {
    const result = inferCadence(makeEps([0, 1, 2, 3, 4]));
    expect(result.cadence).toBe("daily");
    expect(result.averageDaysBetween).toBeLessThanOrEqual(2);
  });

  test("detects weekly cadence (avg <= 9 days)", () => {
    const result = inferCadence(makeEps([0, 7, 14, 21, 28]));
    expect(result.cadence).toBe("weekly");
    expect(result.averageDaysBetween).toBeCloseTo(7, 0);
  });

  test("detects irregular cadence (avg > 9 days)", () => {
    const result = inferCadence(makeEps([0, 15, 30, 50, 80]));
    expect(result.cadence).toBe("irregular");
  });

  test("handles invalid/missing publishedTime gracefully", () => {
    const eps = [
      { publishedTime: "not-a-date" },
      { publishedTime: "" },
      { publishedTime: null }
    ];
    expect(inferCadence(eps).cadence).toBe("unknown");
  });
});
