const { buildDownloadTarget, extractReleaseDate, sanitizePathSegment } = require("../src/lib/path-format");

// ── sanitizePathSegment ─────────────────────────────────────────────────────

describe("sanitizePathSegment", () => {
  test("strips illegal path characters", () => {
    expect(sanitizePathSegment('foo<bar>baz:"qux')).toBe("foobarbazqux");
  });

  test("decodes HTML entities", () => {
    expect(sanitizePathSegment("Rock &amp; Roll")).toBe("Rock & Roll");
    expect(sanitizePathSegment("It&#39;s Fine")).toBe("It's Fine");
    expect(sanitizePathSegment("&lt;title&gt;")).toBe("title");
  });

  test("decodes numeric HTML entities", () => {
    expect(sanitizePathSegment("&#233;")).toBe("\u00e9"); // é
    expect(sanitizePathSegment("&#x00E9;")).toBe("\u00e9");
  });

  test("collapses whitespace", () => {
    expect(sanitizePathSegment("  hello   world  ")).toBe("hello world");
  });

  test("truncates to 120 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizePathSegment(long).length).toBe(120);
  });

  test("handles null/undefined", () => {
    expect(sanitizePathSegment(null)).toBe("");
    expect(sanitizePathSegment(undefined)).toBe("");
    expect(sanitizePathSegment("")).toBe("");
  });
});

// ── extractReleaseDate ──────────────────────────────────────────────────────

describe("extractReleaseDate", () => {
  test("parses ISO date", () => {
    expect(extractReleaseDate("2024-03-15")).toBe("2024-03-15");
  });

  test("parses ISO date embedded in text", () => {
    expect(extractReleaseDate("Episode from 2024-01-05 broadcast")).toBe("2024-01-05");
  });

  test("parses day month year format", () => {
    expect(extractReleaseDate("15 March 2024")).toBe("2024-03-15");
    expect(extractReleaseDate("1 January 2023")).toBe("2023-01-01");
  });

  test("parses month day year format", () => {
    expect(extractReleaseDate("March 15, 2024")).toBe("2024-03-15");
    expect(extractReleaseDate("January 1 2023")).toBe("2023-01-01");
  });

  test("returns empty for unparseable input", () => {
    expect(extractReleaseDate("no date here")).toBe("");
    expect(extractReleaseDate("")).toBe("");
    expect(extractReleaseDate(null)).toBe("");
  });
});

// ── buildDownloadTarget ─────────────────────────────────────────────────────

describe("buildDownloadTarget", () => {
  const baseArgs = {
    baseDownloadDir: "/downloads",
    pathFormat: "{radio}/{program}/{episode_short} {release_date}",
    sourceType: "rte",
    programTitle: "The Late Debate",
    episodeTitle: "The Late Debate - 14 March 2024",
    publishedTime: "2024-03-14",
    clipId: "abc123",
    episodeUrl: ""
  };

  test("produces correct output dir and file stem", () => {
    const result = buildDownloadTarget(baseArgs);
    expect(result.outputDir).toMatch(/RTE/);
    expect(result.outputDir).toMatch(/The Late Debate/);
    expect(result.fileStem).toBeTruthy();
  });

  test("maps source types to radio names", () => {
    expect(buildDownloadTarget({ ...baseArgs, sourceType: "bbc" }).tokens.radio).toBe("BBC");
    expect(buildDownloadTarget({ ...baseArgs, sourceType: "wwf" }).tokens.radio).toBe("Worldwide FM");
    expect(buildDownloadTarget({ ...baseArgs, sourceType: "nts" }).tokens.radio).toBe("NTS");
    expect(buildDownloadTarget({ ...baseArgs, sourceType: "rte" }).tokens.radio).toBe("RTE");
  });

  test("extracts release date into tokens", () => {
    const result = buildDownloadTarget(baseArgs);
    expect(result.tokens.release_date).toBe("2024-03-14");
    expect(result.tokens.year).toBe("2024");
    expect(result.tokens.month).toBe("03");
    expect(result.tokens.day).toBe("14");
    expect(result.tokens.date_compact).toBe("20240314");
  });

  test("picks source_id from clipId", () => {
    const result = buildDownloadTarget(baseArgs);
    expect(result.tokens.source_id).toBe("abc123");
  });

  test("picks source_id from BBC episode URL", () => {
    const result = buildDownloadTarget({
      ...baseArgs,
      clipId: "",
      episodeUrl: "https://www.bbc.co.uk/sounds/play/m001abcde"
    });
    expect(result.tokens.source_id).toBe("m001abcde");
  });

  test("picks source_id from NTS episode URL", () => {
    const result = buildDownloadTarget({
      ...baseArgs,
      clipId: "",
      episodeUrl: "https://www.nts.live/shows/my-show/episodes/my-episode-2024"
    });
    expect(result.tokens.source_id).toBe("my-episode-2024");
  });

  test("uses custom path format", () => {
    const result = buildDownloadTarget({
      ...baseArgs,
      pathFormat: "{radio}/{year}/{program_slug}/{episode_slug}"
    });
    expect(result.tokens.program_slug).toBe("the-late-debate");
    expect(result.outputDir).toMatch(/2024/);
  });

  test("handles missing episode title gracefully", () => {
    const result = buildDownloadTarget({
      ...baseArgs,
      episodeTitle: ""
    });
    expect(result.fileStem).toBeTruthy();
    expect(result.tokens.episode).toBe("episode");
  });

  test("prevents path traversal", () => {
    const result = buildDownloadTarget({
      ...baseArgs,
      programTitle: "../../etc/passwd"
    });
    expect(result.outputDir).not.toMatch(/\.\./);
  });
});
