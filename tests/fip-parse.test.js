/**
 * Unit tests for pure parsing functions in src/lib/fip.js
 */
const {
  normalizeFipProgramUrl,
  parseFipAirtime,
  parseFipFrenchPublishedDate,
  LIVE_STATIONS,
  searchFipPrograms,
  getFipEpisodeStream
} = require("../src/lib/fip");

// ── LIVE_STATIONS ─────────────────────────────────────────────────────────────

describe("LIVE_STATIONS", () => {
  test("contains at least 10 FIP stations", () => {
    expect(LIVE_STATIONS.length).toBeGreaterThanOrEqual(10);
  });

  test("each station has id, name, streamUrl, liveUrl", () => {
    for (const s of LIVE_STATIONS) {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("name");
      expect(s).toHaveProperty("streamUrl");
      expect(s).toHaveProperty("liveUrl");
    }
  });

  test("main FIP station has id 'fip'", () => {
    expect(LIVE_STATIONS.find((s) => s.id === "fip")).toBeDefined();
  });

  test("all streamUrls are https://", () => {
    for (const s of LIVE_STATIONS) {
      expect(s.streamUrl).toMatch(/^https:\/\//);
    }
  });
});

// ── parseFipFrenchPublishedDate ───────────────────────────────────────────────

describe("parseFipFrenchPublishedDate", () => {
  test("parses weekday + French month + year", () => {
    const ts = parseFipFrenchPublishedDate("Vendredi 20 mars 2026");
    expect(ts).toBeGreaterThan(0);
    expect(new Date(ts * 1000).toISOString().slice(0, 10)).toBe("2026-03-20");
  });

  test("returns 0 for empty or invalid", () => {
    expect(parseFipFrenchPublishedDate("")).toBe(0);
    expect(parseFipFrenchPublishedDate("nope")).toBe(0);
  });
});

// ── normalizeFipProgramUrl ────────────────────────────────────────────────────

describe("normalizeFipProgramUrl", () => {
  const BASE = "https://www.radiofrance.fr";

  test("normalizes full radiofrance.fr podcast URL", () => {
    const result = normalizeFipProgramUrl("https://www.radiofrance.fr/fip/podcasts/certains-laiment-fip");
    expect(result).toBe(`${BASE}/fip/podcasts/certains-laiment-fip`);
  });

  test("slug-only input is prepended with base URL", () => {
    const result = normalizeFipProgramUrl("certains-laiment-fip");
    expect(result).toBe(`${BASE}/fip/podcasts/certains-laiment-fip`);
  });

  test("leading slash is stripped before adding base URL", () => {
    const result = normalizeFipProgramUrl("/certains-laiment-fip");
    expect(result).toBe(`${BASE}/fip/podcasts/certains-laiment-fip`);
  });

  test("fip/podcasts/ prefix in slug is not duplicated", () => {
    const result = normalizeFipProgramUrl("fip/podcasts/certains-laiment-fip");
    expect(result).toBe(`${BASE}/fip/podcasts/certains-laiment-fip`);
  });

  test("empty input returns empty string", () => {
    expect(normalizeFipProgramUrl("")).toBe("");
  });

  test("non-radiofrance URL is returned unchanged", () => {
    const url = "https://example.com/some-show";
    expect(normalizeFipProgramUrl(url)).toBe(url);
  });
});

// ── parseFipAirtime ───────────────────────────────────────────────────────────

describe("parseFipAirtime", () => {
  test("empty/null input returns irregular with no schedule", () => {
    expect(parseFipAirtime("")).toEqual({ english: "", cadence: "irregular", runSchedule: "", schedulerRunSchedule: "" });
    expect(parseFipAirtime(null)).toEqual({ english: "", cadence: "irregular", runSchedule: "", schedulerRunSchedule: "" });
  });

  test("'Tous les jours à 19h' returns daily cadence", () => {
    const result = parseFipAirtime("Tous les jours à 19h");
    expect(result.cadence).toBe("daily");
    expect(result.english).toContain("Every day");
    expect(result.english).toContain("7 PM");
  });

  test("'Du lundi au vendredi à 14h' returns weekday cadence", () => {
    const result = parseFipAirtime("Du lundi au vendredi à 14h");
    expect(result.cadence).toBe("weekday");
    expect(result.english).toContain("Mon–Fri");
  });

  test("'Le lundi à 21h' returns weekly cadence with Mondays label", () => {
    const result = parseFipAirtime("lundi à 21h");
    expect(result.cadence).toBe("weekly");
    expect(result.english).toContain("Mondays");
  });

  test("'Le samedi à 10h' returns weekly cadence with Saturdays", () => {
    const result = parseFipAirtime("samedi à 10h");
    expect(result.cadence).toBe("weekly");
    expect(result.english).toContain("Saturdays");
  });

  test("weekly day + hour yields schedulerRunSchedule with bullet for scheduler windows", () => {
    const result = parseFipAirtime("vendredi à 19h");
    expect(result.schedulerRunSchedule).toMatch(/^Fri • \d{2}:\d{2} - \d{2}:\d{2}$/);
  });

  test("runSchedule is in HH:MM format when hour is present", () => {
    const result = parseFipAirtime("Tous les jours à 19h");
    expect(result.runSchedule).toMatch(/^\d{2}:\d{2}$/);
  });

  test("runSchedule with minutes: à 14h30 includes :30", () => {
    const result = parseFipAirtime("Du lundi au vendredi à 14h30");
    const [, mm] = result.runSchedule.split(":");
    expect(mm).toBe("30");
  });

  test("unrecognized input returns original as english with irregular cadence", () => {
    const result = parseFipAirtime("Some unrecognized schedule text");
    expect(result.cadence).toBe("irregular");
    expect(result.english).toBe("Some unrecognized schedule text");
    expect(result.runSchedule).toBe("");
    expect(result.schedulerRunSchedule).toBe("");
  });
});

describe("searchFipPrograms", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("ranks FIP programs using host and genre metadata", async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href === "https://www.radiofrance.fr/fip/podcasts") {
        return {
          ok: true,
          text: async () => `
            <a href="/fip/podcasts/morning-smoke">Morning Smoke</a>
            <a href="/fip/podcasts/benji-pop">Benji Pop</a>
          `
        };
      }
      if (href.includes("/fip/podcasts/morning-smoke/__data.json")) {
        return {
          ok: true,
          json: async () => ({
            nodes: [{
              data: [
                null,
                {
                  model: "Concept",
                  id: "concept-1",
                title: "Morning Smoke",
                standFirst: "Deep electronic selections.",
                visual_400x400: { src: "https://example.com/morning.jpg" },
                authors: [{ title: "Benji B" }],
                taxonomies: [{ title: "Electronic" }],
                airtime: "Tous les jours à 19h"
              },
                { items: [], next: null, prev: null }
              ]
            }]
          })
        };
      }
      if (href.includes("/fip/podcasts/benji-pop/__data.json")) {
        return {
          ok: true,
          json: async () => ({
            nodes: [{
              data: [
                null,
                {
                  model: "Concept",
                  id: "concept-2",
                title: "Benji Pop",
                standFirst: "Pop selections.",
                visual_400x400: { src: "https://example.com/pop.jpg" },
                authors: [{ title: "Alex Pop" }],
                taxonomies: [{ title: "Pop" }]
              },
                { items: [], next: null, prev: null }
              ]
            }]
          })
        };
      }
      if (href.startsWith("https://api.mymemory.translated.net/get?")) {
        return {
          ok: true,
          json: async () => ({
            responseData: {
              translatedText: "x"
            }
          })
        };
      }
      throw new Error(`Unexpected URL ${href}`);
    });

    const results = await searchFipPrograms("benji b");
    expect(results[0].title).toBe("Morning Smoke");
    expect(results[0].hosts).toEqual(["Benji B"]);
    expect(results[0].genres).toContain("Electronic");
  });
});

describe("getFipEpisodeStream", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("resolves current indexed ManifestationAudio records", async () => {
    const episodeUrl = "https://www.radiofrance.fr/fip/podcasts/transe-fip-express/transe-fip-express-143-5480426";
    const streamUrl = "https://media.radiofrance-podcast.net/podcast09/trance-fip-express-143.m4a";
    global.fetch = jest.fn(async (url) => {
      expect(String(url)).toBe(`${episodeUrl}/__data.json`);
      return {
        ok: true,
        json: async () => ({
          nodes: [{
            data: [
              "ManifestationAudio",
              "audio-143",
              streamUrl,
              10705,
              { __typename: 0, id: 1, url: 2, duration: 3 }
            ]
          }]
        })
      };
    });

    await expect(getFipEpisodeStream(episodeUrl)).resolves.toMatchObject({
      episodeUrl,
      streamUrl
    });
  });
});
