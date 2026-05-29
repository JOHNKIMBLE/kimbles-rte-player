/**
 * Unit tests for pure parsing functions in src/lib/worldwidefm.js
 */
const {
  parseTitleParts,
  normalizeEpisodeUrl,
  BASE_URL,
  buildHostIdentityNames,
  episodeMatchesHostIdentity,
  isWwfEpisodeReleased
} = require("../src/lib/worldwidefm");

// ── parseTitleParts ───────────────────────────────────────────────────────────

describe("parseTitleParts", () => {
  test("splits 'Show : Episode' into showName and episodeName", () => {
    const result = parseTitleParts("Show Name : Episode Name");
    expect(result.showName).toBe("Show Name");
    expect(result.episodeName).toBe("Episode Name");
  });

  test("trims whitespace around the colon", () => {
    const result = parseTitleParts("  Show  :  Episode  ");
    expect(result.showName).toBe("Show");
    expect(result.episodeName).toBe("Episode");
  });

  test("no colon returns showName = full title, episodeName = ''", () => {
    const result = parseTitleParts("Just A Title");
    expect(result.showName).toBe("Just A Title");
    expect(result.episodeName).toBe("");
  });

  test("colon at start means showName is empty, whole title is episodeName", () => {
    // colonIndex === 0, so condition colonIndex > 0 is false → showName = title
    const result = parseTitleParts(": Episode Only");
    expect(result.episodeName).toBe("");
    expect(result.showName).toBe(": Episode Only");
  });

  test("multiple colons: splits on first colon only", () => {
    const result = parseTitleParts("Show: Part 1: Part 2");
    expect(result.showName).toBe("Show");
    expect(result.episodeName).toBe("Part 1: Part 2");
  });

  test("empty string returns empty showName and episodeName", () => {
    const result = parseTitleParts("");
    expect(result.showName).toBe("");
    expect(result.episodeName).toBe("");
  });

  test("decodes HTML entities in title", () => {
    const result = parseTitleParts("Show &amp; More : Episode");
    expect(result.showName).toBe("Show & More");
  });
});

// ── normalizeEpisodeUrl (WWF) ─────────────────────────────────────────────────

describe("normalizeEpisodeUrl", () => {
  test("full WWF episode URL is returned without trailing slash", () => {
    const url = `${BASE_URL}/episode/my-episode-slug`;
    expect(normalizeEpisodeUrl(url)).toBe(url);
  });

  test("trailing slash is stripped from WWF episode URL", () => {
    const result = normalizeEpisodeUrl(`${BASE_URL}/episode/my-episode-slug/`);
    expect(result.endsWith("/")).toBe(false);
  });

  test("non-WWF URL is returned unchanged", () => {
    const url = "https://mixcloud.com/worldwidefm/some-mix";
    expect(normalizeEpisodeUrl(url)).toBe(url);
  });

  test("empty input returns empty string", () => {
    expect(normalizeEpisodeUrl("")).toBe("");
  });

  test("WWF URL without /episode/ path is returned as-is", () => {
    // No /episode/ in path → returns the raw value
    const url = `${BASE_URL}/shows/some-show`;
    expect(normalizeEpisodeUrl(url)).toBe(url);
  });
});

describe("episodeMatchesHostIdentity", () => {
  test("matches rotating-host episodes by hosts field", () => {
    const hostIdentityNames = buildHostIdentityNames("valentine-comar", "Valentine Comar");
    const episode = {
      fullTitle: "Worldwide Breakfast: Valentine Comar w/ Shoko Yoshida",
      episodeName: "Valentine Comar w/ Shoko Yoshida",
      hosts: ["Valentine Comar"]
    };
    expect(episodeMatchesHostIdentity(episode, hostIdentityNames)).toBe(true);
  });

  test("rejects same-show episodes from a different host", () => {
    const hostIdentityNames = buildHostIdentityNames("valentine-comar", "Valentine Comar");
    const episode = {
      fullTitle: "Worldwide Breakfast: Magdalena Moursy",
      episodeName: "Magdalena Moursy",
      hosts: ["Magdalena Moursy"]
    };
    expect(episodeMatchesHostIdentity(episode, hostIdentityNames)).toBe(false);
  });
});

describe("isWwfEpisodeReleased", () => {
  test("filters out future schedule episodes", () => {
    const now = new Date("2026-03-16T18:00:00.000Z").getTime();
    expect(isWwfEpisodeReleased({ startTimestamp: new Date("2026-03-18T03:00:00.000Z").getTime() }, now)).toBe(false);
  });

  test("keeps past archive episodes", () => {
    const now = new Date("2026-03-16T18:00:00.000Z").getTime();
    expect(isWwfEpisodeReleased({ publishedTime: "2026-03-11" }, now)).toBe(true);
  });
});
