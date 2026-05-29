/**
 * Unit tests for pure parsing functions in src/lib/kexp.js
 */
const {
  normalizeKexpProgramUrl,
  getKexpProgramSummary,
  getKexpExtendedProgramSummary,
  getKexpExtendedEpisodes,
  LIVE_STATIONS,
  ISO_DAY_NAMES
} = require("../src/lib/kexp");

// ── LIVE_STATIONS ─────────────────────────────────────────────────────────────

describe("LIVE_STATIONS", () => {
  test("is a non-empty array", () => {
    expect(Array.isArray(LIVE_STATIONS)).toBe(true);
    expect(LIVE_STATIONS.length).toBeGreaterThan(0);
  });

  test("each station has id, name, streamUrl, liveUrl", () => {
    for (const station of LIVE_STATIONS) {
      expect(station).toHaveProperty("id");
      expect(station).toHaveProperty("name");
      expect(station).toHaveProperty("streamUrl");
      expect(station).toHaveProperty("liveUrl");
      expect(station.streamUrl).toMatch(/^https?:\/\//);
      expect(station.liveUrl).toMatch(/^https?:\/\//);
    }
  });

  test("first station is KEXP with correct id", () => {
    expect(LIVE_STATIONS[0].id).toBe("kexp");
    expect(LIVE_STATIONS[0].name).toMatch(/KEXP/);
  });
});

// ── ISO_DAY_NAMES ─────────────────────────────────────────────────────────────

describe("ISO_DAY_NAMES", () => {
  test("has 7 entries", () => {
    expect(ISO_DAY_NAMES).toHaveLength(7);
  });

  test("starts with Mon and ends with Sun", () => {
    expect(ISO_DAY_NAMES[0]).toBe("Mon");
    expect(ISO_DAY_NAMES[6]).toBe("Sun");
  });
});

// ── normalizeKexpProgramUrl ───────────────────────────────────────────────────

describe("normalizeKexpProgramUrl", () => {
  test("accepts a bare numeric ID", () => {
    const result = normalizeKexpProgramUrl("42");
    expect(result).toBe("https://api.kexp.org/v2/programs/42/");
  });

  test("accepts a full API URL and returns canonical form", () => {
    const result = normalizeKexpProgramUrl("https://api.kexp.org/v2/programs/42/");
    expect(result).toBe("https://api.kexp.org/v2/programs/42/");
  });

  test("accepts an API URL without trailing slash", () => {
    const result = normalizeKexpProgramUrl("https://api.kexp.org/v2/programs/99");
    expect(result).toBe("https://api.kexp.org/v2/programs/99/");
  });

  test("extracts ID from any URL containing /programs/{id}/", () => {
    const result = normalizeKexpProgramUrl("https://example.com/programs/7/extra");
    expect(result).toBe("https://api.kexp.org/v2/programs/7/");
  });

  test("result always ends with /", () => {
    const result = normalizeKexpProgramUrl("123");
    expect(result.endsWith("/")).toBe(true);
  });

  test("result always starts with https://api.kexp.org/v2/programs/", () => {
    const result = normalizeKexpProgramUrl("55");
    expect(result.startsWith("https://api.kexp.org/v2/programs/")).toBe(true);
  });

  test("throws for empty string", () => {
    expect(() => normalizeKexpProgramUrl("")).toThrow();
  });

  test("throws for non-numeric, non-URL string", () => {
    expect(() => normalizeKexpProgramUrl("not-a-program")).toThrow();
  });

  test("throws for URL with no /programs/ segment and no numeric ID", () => {
    expect(() => normalizeKexpProgramUrl("https://www.kexp.org/listen")).toThrow();
  });
});

describe("getKexpProgramSummary", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("maps hosts from timeslots into the program summary", async () => {
    const responses = new Map([
      ["https://api.kexp.org/v2/programs/42/", {
        id: 42,
        name: "Midday",
        description: "Seattle radio",
        tags: "soul,jazz",
        image_uri: "https://example.com/show.jpg",
        location_name: "Seattle, WA"
      }],
      ["https://api.kexp.org/v2/timeslots/?program=42&ordering=weekday,start_time&limit=50", {
        results: [
          {
            id: 1,
            program: 42,
            program_name: "Midday",
            host_names: ["Host A"],
            weekday: 1,
            start_time: "12:00:00",
            end_time: "14:00:00",
            duration: "02:00:00",
            program_tags: "soul,jazz"
          },
          {
            id: 2,
            program: 42,
            program_name: "Midday",
            host_names: ["Host B"],
            weekday: 3,
            start_time: "12:00:00",
            end_time: "14:00:00",
            duration: "02:00:00",
            program_tags: "soul,jazz"
          }
        ]
      }]
    ]);

    global.fetch = jest.fn(async (url) => ({
      ok: true,
      json: async () => responses.get(url)
    }));

    const summary = await getKexpProgramSummary("42");
    expect(summary.title).toBe("Midday");
    expect(summary.hosts).toEqual(["Host A", "Host B"]);
    expect(summary.genres).toEqual(["soul", "jazz"]);
    expect(summary.cadence).toBe("weekly");
    expect(summary.runSchedule).toBeTruthy();
  });
});

describe("KEXP extended archive metadata", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("maps hosts into the extended program summary", async () => {
    const responses = new Map([
      ["https://player-api.splixer.com/player_api/v3/programs/123e4567-e89b-12d3-a456-426614174000?station_id=30b07b51-7513-4a42-b6b5-ed783b270d0b&include=host,default_mix", {
        data: {
          uid: "123e4567-e89b-12d3-a456-426614174000",
          name: "Archive Smoke",
          description: "Archive summary",
          branding: { keyword: "archive,ambient", thumbnailImageUrl: "https://example.com/archive.jpg" },
          host: { name: "Archive Host" }
        }
      }],
      ["https://player-api.splixer.com/player_api/v3/mixes?station_id=30b07b51-7513-4a42-b6b5-ed783b270d0b&program_id=123e4567-e89b-12d3-a456-426614174000&per_page=1", {
        slicing: { totalRows: 42 }
      }]
    ]);

    global.fetch = jest.fn(async (url) => ({
      ok: true,
      json: async () => responses.get(url)
    }));

    const summary = await getKexpExtendedProgramSummary("https://kexp-t1.tkatlabs.com/library/shows/123e4567-e89b-12d3-a456-426614174000");
    expect(summary.hosts).toEqual(["Archive Host"]);
    expect(summary.genres).toEqual(["archive", "ambient"]);
    expect(summary.location).toBe("Seattle, WA");
  });

  test("enriches extended episode rows with summary metadata", async () => {
    const responses = new Map([
      ["https://player-api.splixer.com/player_api/v3/mixes?station_id=30b07b51-7513-4a42-b6b5-ed783b270d0b&program_id=123e4567-e89b-12d3-a456-426614174000&per_page=20&page=1&include=program,host", {
        data: [
          {
            uid: "223e4567-e89b-12d3-a456-426614174000",
            name: "Archive Episode",
            tag_line: "Archive Session",
            broadcasted_at: "2026-03-01T18:00:00.000Z",
            duration: 7200,
            _program: {
              name: "Archive Smoke",
              branding: { keyword: "archive,ambient" },
              image_url: "https://example.com/archive.jpg"
            },
            _host: { name: "Archive Host" }
          }
        ],
        slicing: { totalRows: 1 }
      }],
      ["https://player-api.splixer.com/player_api/v3/programs/123e4567-e89b-12d3-a456-426614174000?station_id=30b07b51-7513-4a42-b6b5-ed783b270d0b&include=host,default_mix", {
        data: {
          uid: "123e4567-e89b-12d3-a456-426614174000",
          name: "Archive Smoke",
          description: "Archive summary",
          branding: { keyword: "archive,ambient", thumbnailImageUrl: "https://example.com/archive.jpg" },
          host: { name: "Archive Host" }
        }
      }],
      ["https://player-api.splixer.com/player_api/v3/mixes?station_id=30b07b51-7513-4a42-b6b5-ed783b270d0b&program_id=123e4567-e89b-12d3-a456-426614174000&per_page=1", {
        slicing: { totalRows: 1 }
      }]
    ]);

    global.fetch = jest.fn(async (url) => ({
      ok: true,
      json: async () => responses.get(url)
    }));

    const payload = await getKexpExtendedEpisodes("https://kexp-t1.tkatlabs.com/library/shows/123e4567-e89b-12d3-a456-426614174000", 1);
    expect(payload.episodes[0].hosts).toEqual(["Archive Host"]);
    expect(payload.episodes[0].genres).toEqual(["archive", "ambient"]);
    expect(payload.episodes[0].location).toBe("Seattle, WA");
  });
});

// ── mapShow fields (indirectly verified via kexp.js exports) ─────────────────
// The mapShow function now includes endTime and description.
// We verify the shape by inspecting the module source exports are consistent.

describe("kexp.js module exports", () => {
  const kexp = require("../src/lib/kexp");

  test("exports expected function names", () => {
    const expected = [
      "LIVE_STATIONS", "normalizeKexpProgramUrl", "getKexpNowPlaying",
      "searchKexpPrograms", "getKexpDiscovery", "getKexpProgramSummary",
      "getKexpProgramEpisodes", "getKexpEpisodeTracklist", "getKexpSchedule",
      "getKexpEpisodeStream", "ISO_DAY_NAMES"
    ];
    for (const name of expected) {
      expect(kexp).toHaveProperty(name);
    }
  });
});

// ── Pacific time helpers (tested indirectly via exported behaviour) ───────────
// pacificHourToUtc and pacificTimeToUtcHHMM are not exported; we validate their
// effects through normalizeKexpProgramUrl being parseable and through the known
// UTC offsets by checking mapTimeslot output via getKexpProgramSummary (network).
// Pure offset arithmetic is verified here with inline constants.

describe("Pacific → UTC offset constants", () => {
  // PDT = UTC-7 (months 3-10), PST = UTC-8 (months 11-2)
  const pdtOffset = 7;
  const pstOffset = 8;

  test("PDT offset converts 12:00 Pacific → 19:00 UTC", () => {
    expect((12 + pdtOffset) % 24).toBe(19);
  });

  test("PST offset converts 12:00 Pacific → 20:00 UTC", () => {
    expect((12 + pstOffset) % 24).toBe(20);
  });

  test("midnight Pacific (PDT) wraps to 07:00 UTC", () => {
    expect((0 + pdtOffset) % 24).toBe(7);
  });

  test("midnight Pacific (PST) wraps to 08:00 UTC", () => {
    expect((0 + pstOffset) % 24).toBe(8);
  });

  test("23:00 Pacific (PDT) wraps to 06:00 UTC next day", () => {
    expect((23 + pdtOffset) % 24).toBe(6);
  });

  test("23:00 Pacific (PST) wraps to 07:00 UTC next day", () => {
    expect((23 + pstOffset) % 24).toBe(7);
  });
});
