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
  parseTracklistFromEpisodeHtml,
  extractNtsHostsFromHtml,
  normalizeNtsDisplayText,
  getNtsEpisodeInfo,
  getNtsProgramSummary,
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

describe("extractNtsHostsFromHtml", () => {
  test("uses linked NTS artist names from a With heading", () => {
    const html = `
      <section>
        <h1>THE NTS BREAKFAST SHOW W/ FLO</h1>
        <h2>With <a href="/artists/113934-flo-dill">FLO DILL</a></h2>
      </section>
    `;

    expect(extractNtsHostsFromHtml(html)).toEqual(["FLO DILL"]);
  });
});

describe("normalizeNtsDisplayText", () => {
  test("cleans common mojibake separators", () => {
    expect(normalizeNtsDisplayText("2 schedule(s) â€¢ 2 enabled â€¢ 0 retry pending")).toBe("2 schedule(s) | 2 enabled | 0 retry pending");
  });
});

describe("NTS host fallbacks", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("getNtsEpisodeInfo reads hosts from the episode HTML artist link", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="The NTS Breakfast Show w/ Flo" />
            <meta property="og:description" content="Breakfast in Flo motion." />
            <meta property="og:image" content="https://images.example/flo.jpg" />
          </head>
          <body>
            <h2>With <a href="/artists/113934-flo-dill">Flo Dill</a></h2>
          </body>
        </html>
      `
    }));

    const info = await getNtsEpisodeInfo("https://www.nts.live/shows/the-breakfast-show-flo/episodes/the-breakfast-show-flo-10th-march-2026");
    expect(info.hosts).toEqual(["Flo Dill"]);
  });

  test("getNtsProgramSummary falls back to HTML hosts when the API leaves them empty", async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href === "https://www.nts.live/api/v2/shows/the-breakfast-show-flo") {
        return {
          ok: true,
          json: async () => ({
            show_alias: "the-breakfast-show-flo",
            name: "The NTS Breakfast Show w/ Flo",
            description: "Breakfast in Flo motion.",
            timeslot: "MONDAY / 9AM - 11AM / WEEKLY",
            genres: [{ value: "Soul Jazz" }]
          })
        };
      }
      if (href === "https://www.nts.live/api/v2/shows/the-breakfast-show-flo/episodes?offset=0&limit=5") {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                episode_alias: "the-breakfast-show-flo-10th-march-2026",
                show_alias: "the-breakfast-show-flo",
                name: "The NTS Breakfast Show w/ Flo",
                broadcast: "2026-03-10T09:00:00.000Z"
              }
            ],
            metadata: { resultset: { count: 1 } }
          })
        };
      }
      if (href === "https://www.nts.live/shows/the-breakfast-show-flo") {
        return {
          ok: true,
          text: async () => `
            <html>
              <body>
                <h2>With <a href="/artists/113934-flo-dill">Flo Dill</a></h2>
              </body>
            </html>
          `
        };
      }
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "",
        json: async () => ({})
      };
    });

    const summary = await getNtsProgramSummary("https://www.nts.live/shows/the-breakfast-show-flo");
    expect(summary.hosts).toEqual(["Flo Dill"]);
    expect(summary.runSchedule).toContain("|");
  });
});

describe("searchNtsPrograms", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("ranks NTS programs using host metadata ahead of loose title matches", async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href === "https://www.nts.live/latest") {
        return { ok: true, text: async () => "<html></html>" };
      }
      if (href === "https://www.nts.live/api/v2/shows?offset=0&limit=12") {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                show_alias: "night-smoke",
                name: "Night Smoke",
                description: "Deep electronic selections",
                hosts: [{ name: "Benji B" }]
              },
              {
                show_alias: "benji-beats",
                name: "Benji Beats",
                description: "Pop selections",
                hosts: [{ name: "Alex Pop" }]
              }
            ],
            metadata: { resultset: { count: 2 } }
          })
        };
      }
      if (href === "https://www.nts.live/api/v2/shows/night-smoke") {
        return {
          ok: true,
          json: async () => ({
            show_alias: "night-smoke",
            name: "Night Smoke",
            description: "Deep electronic selections",
            genres: [{ value: "Electronic" }],
            hosts: [{ name: "Benji B" }],
            location_short: "London"
          })
        };
      }
      if (href === "https://www.nts.live/api/v2/shows/benji-beats") {
        return {
          ok: true,
          json: async () => ({
            show_alias: "benji-beats",
            name: "Benji Beats",
            description: "Pop selections",
            genres: [{ value: "Pop" }],
            hosts: [{ name: "Alex Pop" }]
          })
        };
      }
      if (href.includes("/api/v2/shows/night-smoke/episodes")) {
        return { ok: true, json: async () => ({ results: [], metadata: { resultset: { count: 0 } } }) };
      }
      if (href.includes("/api/v2/shows/benji-beats/episodes")) {
        return { ok: true, json: async () => ({ results: [], metadata: { resultset: { count: 0 } } }) };
      }
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({})
      };
    });

    let freshSearchNtsPrograms;
    jest.isolateModules(() => {
      ({ searchNtsPrograms: freshSearchNtsPrograms } = require("../src/lib/nts"));
    });

    const results = await freshSearchNtsPrograms("benji b");
    expect(results[0].title).toBe("Night Smoke");
    expect(results[0].hosts).toEqual(["Benji B"]);
    expect(results[0].genres).toContain("Electronic");
  });
});
