/**
 * Unit tests for pure parsing functions in src/lib/rte.js
 */
const { normalizeProgramUrl, LIVE_STATIONS, extractRteInfo, getProgramSummary, getProgramEpisodes, searchPrograms } = require("../src/lib/rte");

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

describe("getProgramSummary", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("extracts hosts from RTE programme HTML metadata", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-15T12:00:00Z"));
    try {
      global.fetch = jest.fn(async () => ({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="programme" content="Morning Mix" />
              <meta name="description" content="Music and conversation." />
              <meta property="og:image" content="https://example.com/morning.jpg" />
              <meta name="DC.creator" content="Aoife Nic Canna" />
              <script type="application/ld+json">
                {"@type":"RadioSeries","author":{"@type":"Person","name":"Aoife Nic Canna"},"genre":["Soul","Jazz"]}
              </script>
            </head>
            <body>
              <span id="datetimePlayer">Mon 09:00 - 11:00</span>
            </body>
          </html>
        `
      }));

      const summary = await getProgramSummary("https://www.rte.ie/radio/radio1/morning-mix/");
      expect(summary.title).toBe("Morning Mix");
      expect(summary.hosts).toEqual(["Aoife Nic Canna"]);
      expect(summary.genres).toEqual(["Soul", "Jazz"]);
      expect(summary.runSchedule).toContain("09:00");
    } finally {
      jest.useRealTimers();
    }
  });

  test("drops bogus RTÉ host metadata and falls back to title-derived host", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => `
        <html>
          <head>
            <meta name="programme" content="2FM Greene Room with Jenny Greene" />
            <meta name="DC.creator" content="the parent page if (location • host" />
            <script type="application/ld+json">
              {"@type":"RadioSeries","author":"the parent page if (location • host","genre":["Electronic"]}
            </script>
          </head>
          <body></body>
        </html>
      `
    }));

    const summary = await getProgramSummary("https://www.rte.ie/radio/2fm/2fm-greene-room-with-jenny-greene/");
    expect(summary.hosts).toEqual(["Jenny Greene"]);
  });

  test("enriches RTE episode rows with summary metadata", async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes("/episodes/json/")) {
        return {
          ok: true,
          json: async () => ({
            page: 1,
            total_items: 1,
            num_pages: 1,
            programmes: [
              {
                clip_id: "12345",
                url: "/radio/radio1/clips/12345/",
                title: "Morning Mix - Episode One",
                subtitle: "Episode subtitle",
                published_time: "2026-03-16",
                image: "/images/ep.jpg"
              }
            ]
          })
        };
      }
      return {
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="programme" content="Morning Mix" />
              <meta name="description" content="Music and conversation." />
              <meta property="og:image" content="https://example.com/morning.jpg" />
              <meta name="DC.creator" content="Aoife Nic Canna" />
              <meta name="DC.coverage" content="Dublin" />
              <script type="application/ld+json">
                {"@type":"RadioSeries","author":{"@type":"Person","name":"Aoife Nic Canna"},"genre":["Soul","Jazz"],"contentLocation":{"name":"Dublin"}}
              </script>
            </head>
            <body>
              <span id="datetimePlayer">Mon 09:00 - 11:00</span>
            </body>
          </html>
        `
      };
    });

    const payload = await getProgramEpisodes("https://www.rte.ie/radio/radio1/morning-mix-location/", 1);
    expect(payload.episodes[0].description).toBe("Episode subtitle");
    expect(payload.episodes[0].hosts).toEqual(["Aoife Nic Canna"]);
    expect(payload.episodes[0].genres).toEqual(["Soul", "Jazz"]);
    expect(payload.episodes[0].location).toBe("Dublin");
  });

  test("uses RTÉ published fallback date when published_time is absent", async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes("/episodes/json/")) {
        return {
          ok: true,
          json: async () => ({
            page: 1,
            total_items: 1,
            num_pages: 1,
            programmes: [
              {
                clip_id: "11800521",
                url: "/radio/2fm/2fm-greene-room-with-jenny-greene/episodes/11800521/",
                title: "2FM Greene Room with Jenny Greene",
                subtitle: "Episode • 2 Hr 0 Mins • 07 JUN • 2FM Greene Room with Jenny Greene",
                published: "2026-06-07T21:00:00Z",
                published_time_formatted: "07 JUN"
              }
            ]
          })
        };
      }
      return {
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="programme" content="2FM Greene Room with Jenny Greene" />
            </head>
            <body></body>
          </html>
        `
      };
    });

    const payload = await getProgramEpisodes("https://www.rte.ie/radio/2fm/2fm-greene-room-with-jenny-greene/", 1);
    expect(payload.episodes[0].publishedTime).toBe("2026-06-07T21:00:00Z");
  });
});

describe("extractRteInfo", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("resolves current UUID episode URLs without a legacy clip_id meta tag", async () => {
    const episodeUrl = "https://www.rte.ie/radio/2fm/greene-room/episodes/d11c16d5-4d7e-4fae-acff-b49e016ea0f0/";
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href === episodeUrl) {
        return {
          ok: true,
          text: async () => `
            <html><head>
              <meta property="og:title" content="Greene Room - Current Episode" />
              <meta property="og:image" content="https://example.com/greene.jpg" />
            </head></html>
          `
        };
      }
      if (href.includes("/rteavgen/getplaylist/")) {
        return {
          ok: true,
          json: async () => ({
            shows: [{ url: "https://cdn.example.test/greene.mp3", medium: "audio" }]
          })
        };
      }
      throw new Error(`Unexpected URL ${href}`);
    });

    const info = await extractRteInfo(episodeUrl);
    expect(info).toMatchObject({
      clipId: "d11c16d5-4d7e-4fae-acff-b49e016ea0f0",
      m3u8Url: "https://cdn.example.test/greene.mp3",
      image: "https://example.com/greene.jpg"
    });
  });
});

describe("searchPrograms", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("matches and ranks RTÉ programs by host, genre, and location metadata", async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href === "https://www.rte.ie/radio/2fm/") {
        return {
          ok: true,
          text: async () => `
            <a href="/radio/2fm/dawn-beats/"></a>
            <a href="/radio/2fm/newsline-night/"></a>
          `
        };
      }
      if (href === "https://www.rte.ie/radio/radio1/" || href === "https://www.rte.ie/radio/lyricfm/" || href === "https://www.rte.ie/radio/rnag/") {
        return {
          ok: true,
          text: async () => `<html></html>`
        };
      }
      if (href === "https://www.rte.ie/radio/2fm/dawn-beats/") {
        return {
          ok: true,
          text: async () => `
            <html>
              <head>
                <meta name="programme" content="Dawn Beats" />
                <meta name="description" content="Deep electronic selections." />
                <meta property="og:image" content="https://example.com/dawn.jpg" />
                <meta name="DC.creator" content="Aoife Pulse" />
                <meta name="DC.coverage" content="Dublin" />
                <script type="application/ld+json">
                  {"@type":"RadioSeries","author":{"@type":"Person","name":"Aoife Pulse"},"genre":["Electronic","Ambient"],"contentLocation":{"name":"Dublin"}}
                </script>
              </head>
              <body>
                <span id="datetimePlayer">Tue 01:00 - 03:00</span>
              </body>
            </html>
          `
        };
      }
      if (href === "https://www.rte.ie/radio/2fm/newsline-night/") {
        return {
          ok: true,
          text: async () => `
            <html>
              <head>
                <meta name="programme" content="Newsline Night" />
                <meta name="description" content="Late night current affairs." />
                <meta property="og:image" content="https://example.com/newsline.jpg" />
                <meta name="DC.creator" content="Pat Reporter" />
                <meta name="DC.coverage" content="Cork" />
                <script type="application/ld+json">
                  {"@type":"RadioSeries","author":{"@type":"Person","name":"Pat Reporter"},"genre":["News"],"contentLocation":{"name":"Cork"}}
                </script>
              </head>
            </html>
          `
        };
      }
      throw new Error(`Unexpected URL ${href}`);
    });

    const byHost = await searchPrograms("aoife pulse");
    expect(byHost[0].title).toBe("Dawn Beats");
    expect(byHost[0].hosts).toEqual(["Aoife Pulse"]);

    const byGenre = await searchPrograms("electronic");
    expect(byGenre[0].title).toBe("Dawn Beats");
    expect(byGenre[0].genres).toContain("Electronic");

    const byLocation = await searchPrograms("dublin");
    expect(byLocation[0].title).toBe("Dawn Beats");
    expect(byLocation[0].location).toBe("Dublin");
  });
});

describe("getRteDiscovery", () => {
  const originalFetch = global.fetch;
  const originalRandom = Math.random;

  afterEach(() => {
    global.fetch = originalFetch;
    Math.random = originalRandom;
  });

  test("prefers metadata-rich and diverse RTÉ discovery results", async () => {
    Math.random = () => 0;
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href === "https://www.rte.ie/radio/2fm/") {
        return {
          ok: true,
          text: async () => `
            <a href="/radio/2fm/dawn-beats/"></a>
            <a href="/radio/2fm/city-jazz/"></a>
          `
        };
      }
      if (href === "https://www.rte.ie/radio/radio1/") {
        return {
          ok: true,
          text: async () => `
            <a href="/radio/radio1/newsline-night/"></a>
          `
        };
      }
      if (href === "https://www.rte.ie/radio/lyricfm/" || href === "https://www.rte.ie/radio/rnag/") {
        return {
          ok: true,
          text: async () => `<html></html>`
        };
      }
      const pages = {
        "https://www.rte.ie/radio/2fm/dawn-beats/": `
          <html><head>
            <meta name="programme" content="Dawn Beats" />
            <meta name="description" content="Deep electronic selections." />
            <meta property="og:image" content="https://example.com/dawn.jpg" />
            <meta name="DC.creator" content="Aoife Pulse" />
            <meta name="DC.coverage" content="Dublin" />
            <script type="application/ld+json">
              {"@type":"RadioSeries","author":{"@type":"Person","name":"Aoife Pulse"},"genre":["Electronic"],"contentLocation":{"name":"Dublin"}}
            </script>
          </head><body><span id="datetimePlayer">Tue 01:00 - 03:00</span></body></html>
        `,
        "https://www.rte.ie/radio/2fm/city-jazz/": `
          <html><head>
            <meta name="programme" content="City Jazz" />
            <meta name="description" content="Late-night jazz." />
            <meta property="og:image" content="https://example.com/jazz.jpg" />
            <meta name="DC.creator" content="Maya Blue" />
            <meta name="DC.coverage" content="Galway" />
            <script type="application/ld+json">
              {"@type":"RadioSeries","author":{"@type":"Person","name":"Maya Blue"},"genre":["Jazz"],"contentLocation":{"name":"Galway"}}
            </script>
          </head><body><span id="datetimePlayer">Wed 22:00 - 00:00</span></body></html>
        `,
        "https://www.rte.ie/radio/radio1/newsline-night/": `
          <html><head>
            <meta name="programme" content="Newsline Night" />
            <meta name="description" content="" />
            <meta name="DC.creator" content="" />
          </head></html>
        `
      };
      if (pages[href]) {
        return {
          ok: true,
          text: async () => pages[href]
        };
      }
      throw new Error(`Unexpected URL ${href}`);
    });

    let freshGetRteDiscovery;
    jest.isolateModules(() => {
      ({ getRteDiscovery: freshGetRteDiscovery } = require("../src/lib/rte"));
    });

    const results = await freshGetRteDiscovery(2);
    expect(results).toHaveLength(2);
    expect(results.map((item) => item.title)).toEqual(expect.arrayContaining(["Dawn Beats", "City Jazz"]));
    expect(results.map((item) => item.hosts[0])).toEqual(expect.arrayContaining(["Aoife Pulse", "Maya Blue"]));
  });
});
