/**
 * Unit tests for pure parsing functions in src/lib/fip.js
 */
const { normalizeFipProgramUrl, parseFipAirtime, LIVE_STATIONS } = require("../src/lib/fip");

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
    expect(parseFipAirtime("")).toEqual({ english: "", cadence: "irregular", runSchedule: "" });
    expect(parseFipAirtime(null)).toEqual({ english: "", cadence: "irregular", runSchedule: "" });
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
  });
});
