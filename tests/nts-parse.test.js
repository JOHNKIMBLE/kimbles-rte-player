/**
 * Unit tests for pure parsing functions in src/lib/nts.js
 */
const {
  normalizeShowUrl,
  normalizeEpisodeUrl,
  normalizeNtsProgramUrl,
  parseDateNts,
  generateSlugGuesses,
  parseNtsTimeslot,
  parseTracklistFromEpisodeHtml
} = require("../src/lib/nts");

// ── normalizeShowUrl ──────────────────────────────────────────────────────────

describe("normalizeShowUrl", () => {
  test("full NTS URL returns https://www.nts.live/shows/<slug>", () => {
    expect(normalizeShowUrl("https://www.nts.live/shows/breakfast-show"))
      .toBe("https://www.nts.live/shows/breakfast-show");
  });

  test("strips /episodes/... suffix", () => {
    expect(normalizeShowUrl("https://www.nts.live/shows/breakfast-show/episodes/ep-1"))
      .toBe("https://www.nts.live/shows/breakfast-show");
  });

  test("slug-only input gets prefixed with base URL", () => {
    expect(normalizeShowUrl("breakfast-show"))
      .toBe("https://www.nts.live/shows/breakfast-show");
  });

  test("/shows/... relative path works", () => {
    expect(normalizeShowUrl("/shows/breakfast-show"))
      .toBe("https://www.nts.live/shows/breakfast-show");
  });

  test("empty string returns empty string", () => {
    expect(normalizeShowUrl("")).toBe("");
  });
});

// ── normalizeNtsProgramUrl ────────────────────────────────────────────────────

describe("normalizeNtsProgramUrl", () => {
  test("full NTS show URL is normalized", () => {
    const result = normalizeNtsProgramUrl("https://www.nts.live/shows/breakfast");
    expect(result).toContain("/shows/breakfast");
  });

  test("slug only gets base URL prepended", () => {
    const result = normalizeNtsProgramUrl("breakfast");
    expect(result).toBe("https://www.nts.live/shows/breakfast");
  });

  test("throws on empty input", () => {
    expect(() => normalizeNtsProgramUrl("")).toThrow();
  });
});

// ── normalizeEpisodeUrl ───────────────────────────────────────────────────────

describe("normalizeEpisodeUrl", () => {
  test("full episode URL is preserved and stripped of trailing slash", () => {
    const url = "https://www.nts.live/shows/breakfast-show/episodes/2026-03-01";
    expect(normalizeEpisodeUrl(url)).toBe(url);
  });

  test("URL with trailing slash is stripped", () => {
    const result = normalizeEpisodeUrl("https://www.nts.live/shows/breakfast-show/episodes/ep-1/");
    expect(result.endsWith("/")).toBe(false);
  });

  test("non-NTS URL is returned unchanged", () => {
    const url = "https://example.com/some/path";
    expect(normalizeEpisodeUrl(url)).toBe(url);
  });

  test("empty input returns empty string", () => {
    expect(normalizeEpisodeUrl("")).toBe("");
  });
});

// ── parseDateNts ──────────────────────────────────────────────────────────────

describe("parseDateNts", () => {
  test("parses DD MMM YYYY format", () => {
    expect(parseDateNts("10 Mar 2026")).toBe("2026-03-10");
  });

  test("parses single-digit day", () => {
    expect(parseDateNts("5 Jan 2024")).toBe("2024-01-05");
  });

  test("parses December correctly (month 12)", () => {
    expect(parseDateNts("31 Dec 2023")).toBe("2023-12-31");
  });

  test("handles mixed case month", () => {
    expect(parseDateNts("15 APR 2025")).toBe("2025-04-15");
  });

  test("returns empty string for unrecognized month", () => {
    expect(parseDateNts("10 Xxx 2026")).toBe("");
  });

  test("returns empty string for empty input", () => {
    expect(parseDateNts("")).toBe("");
  });

  test("extracts date from longer string", () => {
    expect(parseDateNts("Broadcast: 10 Mar 2026 on NTS")).toBe("2026-03-10");
  });
});

// ── generateSlugGuesses ───────────────────────────────────────────────────────

describe("generateSlugGuesses", () => {
  test("returns an array", () => {
    expect(Array.isArray(generateSlugGuesses("breakfast show"))).toBe(true);
  });

  test("includes the basic slug", () => {
    expect(generateSlugGuesses("breakfast show")).toContain("breakfast-show");
  });

  test("includes the-prefixed slug", () => {
    expect(generateSlugGuesses("breakfast show")).toContain("the-breakfast-show");
  });

  test("includes individual words as slugs", () => {
    const guesses = generateSlugGuesses("breakfast show");
    expect(guesses).toContain("breakfast");
    expect(guesses).toContain("show");
  });

  test("includes w- and with- variants for multi-word queries", () => {
    const guesses = generateSlugGuesses("breakfast show flo");
    expect(guesses.some((g) => g.includes("-w-"))).toBe(true);
    expect(guesses.some((g) => g.includes("-with-"))).toBe(true);
  });

  test("generates dropout variants for 3+ word queries", () => {
    const guesses = generateSlugGuesses("the breakfast show flo");
    // Should include versions with one word dropped
    expect(guesses.length).toBeGreaterThan(5);
  });

  test("no duplicates in results", () => {
    const guesses = generateSlugGuesses("morning show");
    const set = new Set(guesses);
    expect(set.size).toBe(guesses.length);
  });

  test("single word returns meaningful guesses", () => {
    const guesses = generateSlugGuesses("breakfast");
    expect(guesses).toContain("breakfast");
    expect(guesses).toContain("the-breakfast");
  });
});

// ── parseNtsTimeslot ──────────────────────────────────────────────────────────

describe("parseNtsTimeslot", () => {
  test("returns null for ARCHIVE SHOW", () => {
    expect(parseNtsTimeslot("ARCHIVE SHOW")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseNtsTimeslot("")).toBeNull();
  });

  test("parses day range with frequency", () => {
    const result = parseNtsTimeslot("MONDAY - WEDNESDAY / WEEKLY");
    expect(result).not.toBeNull();
    expect(result.days).toEqual(["Mon", "Tue", "Wed"]);
    expect(result.frequency).toBe("weekly");
  });

  test("parses single day with time range", () => {
    const result = parseNtsTimeslot("TUESDAY / 4PM - 5PM / MONTHLY");
    expect(result).not.toBeNull();
    expect(result.days).toEqual(["Tue"]);
    expect(result.startHour).toBe(16);
    expect(result.endHour).toBe(17);
    expect(result.frequency).toBe("monthly");
  });

  test("strips timezone abbreviation from time", () => {
    const result = parseNtsTimeslot("TUESDAY / 4PM - 5PM CGN / MONTHLY");
    expect(result).not.toBeNull();
    expect(result.startHour).toBe(16);
    expect(result.endHour).toBe(17);
  });

  test("parses MON-FRI range", () => {
    const result = parseNtsTimeslot("MONDAY - FRIDAY / 10AM - 1PM / WEEKLY");
    expect(result.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    expect(result.startHour).toBe(10);
    expect(result.endHour).toBe(13);
  });

  test("parses AM correctly (12 AM = 0)", () => {
    const result = parseNtsTimeslot("MONDAY / 12AM - 1AM / WEEKLY");
    expect(result.startHour).toBe(0);
    expect(result.endHour).toBe(1);
  });

  test("parses PM correctly (12 PM = 12)", () => {
    const result = parseNtsTimeslot("FRIDAY / 12PM - 1PM / WEEKLY");
    expect(result.startHour).toBe(12);
    expect(result.endHour).toBe(13);
  });

  test("defaults frequency to weekly when not specified", () => {
    const result = parseNtsTimeslot("MONDAY / 10AM - 11AM");
    expect(result.frequency).toBe("weekly");
  });
});

// ── parseTracklistFromEpisodeHtml ─────────────────────────────────────────────

describe("parseTracklistFromEpisodeHtml", () => {
  test("returns empty array for empty HTML", () => {
    expect(parseTracklistFromEpisodeHtml("")).toEqual([]);
  });

  test("returns empty array for HTML with no tracklist", () => {
    expect(parseTracklistFromEpisodeHtml("<html><body><p>No music here</p></body></html>")).toEqual([]);
  });
});
