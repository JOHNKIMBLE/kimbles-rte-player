/**
 * Unit tests for pure parsing functions in src/lib/rte.js
 */
const { normalizeProgramUrl, LIVE_STATIONS } = require("../src/lib/rte");

describe("LIVE_STATIONS", () => {
  test("is a non-empty array", () => {
    expect(Array.isArray(LIVE_STATIONS)).toBe(true);
    expect(LIVE_STATIONS.length).toBeGreaterThan(0);
  });

  test("each station has id, name, stationUrl", () => {
    for (const station of LIVE_STATIONS) {
      expect(station).toHaveProperty("id");
      expect(station).toHaveProperty("name");
      expect(station).toHaveProperty("stationUrl");
      expect(station.stationUrl).toMatch(/^https?:\/\//);
    }
  });
});

describe("normalizeProgramUrl", () => {
  test("normalizes full URL with extra path segments to /radio/station/program/", () => {
    const result = normalizeProgramUrl("https://www.rte.ie/radio/radio1/the-today-show/extra");
    expect(result).toBe("https://www.rte.ie/radio/radio1/the-today-show/");
  });

  test("normalizes URL without trailing slash", () => {
    const result = normalizeProgramUrl("https://www.rte.ie/radio/radio1/the-today-show");
    expect(result).toBe("https://www.rte.ie/radio/radio1/the-today-show/");
  });

  test("accepts relative path and resolves against rte.ie", () => {
    const result = normalizeProgramUrl("/radio/2fm/the-ray-darcy-show");
    expect(result).toBe("https://www.rte.ie/radio/2fm/the-ray-darcy-show/");
  });

  test("throws for non-radio URL", () => {
    expect(() => normalizeProgramUrl("https://www.rte.ie/news/ireland/")).toThrow();
  });

  test("throws for URL with only /radio/ and no program", () => {
    expect(() => normalizeProgramUrl("https://www.rte.ie/radio/")).toThrow();
  });

  test("normalizes a URL from any domain with /radio/<station>/<program>/ path", () => {
    // normalizeProgramUrl extracts station/program from path, always returns rte.ie URL
    const result = normalizeProgramUrl("https://example.com/radio/foo/bar");
    expect(result).toBe("https://www.rte.ie/radio/foo/bar/");
  });

  test("result always ends with /", () => {
    const result = normalizeProgramUrl("https://www.rte.ie/radio/lyricfm/lyric-feature");
    expect(result.endsWith("/")).toBe(true);
  });

  test("result always starts with https://www.rte.ie/radio/", () => {
    const result = normalizeProgramUrl("https://www.rte.ie/radio/lyricfm/lyric-feature");
    expect(result.startsWith("https://www.rte.ie/radio/")).toBe(true);
  });
});
