/**
 * Unit tests for pure parsing functions in src/lib/bbc.js
 */
const { normalizeBbcUrl, normalizeBbcProgramUrl, getBbcProgramSummary, getBbcProgramEpisodes, searchBbcPrograms } = require("../src/lib/bbc");

describe("normalizeBbcUrl", () => {
  test("accepts a valid BBC URL", () => {
    const result = normalizeBbcUrl("https://www.bbc.co.uk/sounds/play/live:bbc_radio_one");
    expect(result).toContain("bbc.co.uk");
  });

  test("strips hash fragment", () => {
    const result = normalizeBbcUrl("https://www.bbc.co.uk/sounds/play/live:bbc_6music#section");
    expect(result).not.toContain("#");
  });

  test("throws for non-BBC URL", () => {
    expect(() => normalizeBbcUrl("https://example.com/path")).toThrow("BBC");
  });

  test("throws for invalid URL string", () => {
    expect(() => normalizeBbcUrl("not a url")).toThrow();
  });

  test("preserves path and query", () => {
    const result = normalizeBbcUrl("https://www.bbc.co.uk/programmes/b01cqx2b?page=2");
    expect(result).toContain("b01cqx2b");
    expect(result).toContain("page=2");
  });
});

describe("normalizeBbcProgramUrl", () => {
  test("normalizes /programmes/<pid> URL", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/programmes/b01cqx2b");
    expect(result).toBe("https://www.bbc.co.uk/programmes/b01cqx2b");
  });

  test("normalizes /programmes/<pid>/episodes URL (strips extra path)", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/programmes/b01cqx2b/episodes/player");
    expect(result).toBe("https://www.bbc.co.uk/programmes/b01cqx2b");
  });

  test("normalizes /sounds/brand/<id> URL to /programmes/<id>", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/sounds/brand/b01cqx2b");
    expect(result).toBe("https://www.bbc.co.uk/programmes/b01cqx2b");
  });

  test("throws for non-BBC domain", () => {
    expect(() => normalizeBbcProgramUrl("https://example.com/programmes/b01cqx2b")).toThrow();
  });

  test("throws for BBC URL without /programmes/ or /sounds/brand/", () => {
    expect(() => normalizeBbcProgramUrl("https://www.bbc.co.uk/news/uk")).toThrow();
  });

  test("result is always https://www.bbc.co.uk/programmes/<id>", () => {
    const result = normalizeBbcProgramUrl("https://www.bbc.co.uk/programmes/b09abcde");
    expect(result).toMatch(/^https:\/\/www\.bbc\.co\.uk\/programmes\/[a-z0-9]+$/);
  });
});

describe("getBbcProgramSummary", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("extracts host from br-masthead__title when og:title is station-only", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="BBC Radio 1 Dance" />
            <meta property="og:description" content="Dance music from Radio 1." />
            <meta property="og:image" content="https://example.com/r1dance.jpg" />
          </head>
          <body>
            <div class="br-masthead__title">
              <a href="/programmes/p0h6fm6m">Martha</a>
            </div>
          </body>
        </html>
      `
    }));

    const summary = await getBbcProgramSummary("https://www.bbc.co.uk/programmes/p0h6fm6m", null, { includeSchedule: false });
    expect(summary.title).toBe("BBC Radio 1 Dance");
    expect(summary.hosts).toEqual(["Martha"]);
  });

  test("extracts hosts from BBC programme HTML metadata", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="Benji B" />
            <meta property="og:description" content="Late night radio." />
            <meta property="og:image" content="https://example.com/benji.jpg" />
            <meta name="parsely-author" content="Benji B" />
            <script type="application/ld+json">
              {"@type":"RadioSeries","author":{"@type":"Person","name":"Benji B"},"genre":["Electronic","House"]}
            </script>
          </head>
        </html>
      `
    }));

    const summary = await getBbcProgramSummary("https://www.bbc.co.uk/programmes/b09abcde", null, { includeSchedule: false });
    expect(summary.title).toBe("Benji B");
    expect(summary.hosts).toEqual(["Benji B"]);
    expect(summary.genres).toEqual(["Electronic", "House"]);
  });

  test("enriches BBC episode rows with summary metadata when episode rows are thin", async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes("/episodes/player")) {
        return {
          ok: true,
          text: async () => `
            <div class="programme programme--radio programme--episode" data-pid="p0abcd12">
              <span class="programme__title"><span>Night Session</span></span>
              <p class="programme__synopsis"><span>Episode-specific summary.</span></p>
              <div class="broadcast-event__time" title="16 Mar 2026"></div>
              <img src="https://example.com/episode.jpg" />
            </div>
          `
        };
      }
      return {
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:title" content="Benji B" />
              <meta property="og:description" content="Late night radio." />
              <meta property="og:image" content="https://example.com/benji.jpg" />
              <meta name="parsely-author" content="Benji B" />
              <script type="application/ld+json">
                {"@type":"RadioSeries","author":{"@type":"Person","name":"Benji B"},"genre":["Electronic","House"]}
              </script>
            </head>
          </html>
        `
      };
    });

    const payload = await getBbcProgramEpisodes("https://www.bbc.co.uk/programmes/b09abcde", null, 1);
    expect(payload.episodes[0].hosts).toEqual(["Benji B"]);
    expect(payload.episodes[0].genres).toEqual(["Electronic", "House"]);
    expect(payload.episodes[0].description).toBe("Episode-specific summary.");
    expect(payload.episodes[0].image).toBe("https://example.com/episode.jpg");
  });
});

describe("searchBbcPrograms", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("ranks BBC results using host and genre metadata, not just titles", async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href.includes("https://www.bbc.co.uk/search?q=")) {
        return {
          ok: true,
          text: async () => `
            <a href="/programmes/b0000001"></a>
            <a href="/programmes/b0000002"></a>
          `
        };
      }
      if (href === "https://www.bbc.co.uk/programmes/b0000001") {
        return {
          ok: true,
          text: async () => `
            <html>
              <head>
                <meta property="og:title" content="Night Shift" />
                <meta property="og:description" content="Late-night electronic music." />
                <meta property="og:image" content="https://example.com/nightshift.jpg" />
                <meta name="parsely-author" content="Benji B" />
                <script type="application/ld+json">
                  {"@type":"RadioSeries","author":{"@type":"Person","name":"Benji B"},"genre":["Electronic","House"]}
                </script>
              </head>
            </html>
          `
        };
      }
      if (href === "https://www.bbc.co.uk/programmes/b0000002") {
        return {
          ok: true,
          text: async () => `
            <html>
              <head>
                <meta property="og:title" content="Benji Beats" />
                <meta property="og:description" content="Pop selections." />
                <meta property="og:image" content="https://example.com/benjibeats.jpg" />
              </head>
            </html>
          `
        };
      }
      throw new Error(`Unexpected URL ${href}`);
    });

    const results = await searchBbcPrograms("benji b");
    expect(results[0].title).toBe("Night Shift");
    expect(results[0].hosts).toEqual(["Benji B"]);
    expect(results[0].genres).toContain("Electronic");
  });
});

describe("getBbcDiscovery", () => {
  const originalFetch = global.fetch;
  const originalRandom = Math.random;

  afterEach(() => {
    global.fetch = originalFetch;
    Math.random = originalRandom;
  });

  test("expands beyond the first bootstrap terms during discovery searches", async () => {
    Math.random = () => 0;
    const searchQueries = [];

    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href.includes("https://www.bbc.co.uk/search?q=")) {
        const query = decodeURIComponent(href.split("q=")[1] || "");
        searchQueries.push(query);
        return {
          ok: true,
          text: async () => `<a href="/programmes/b0000001"></a>`
        };
      }
      if (href === "https://www.bbc.co.uk/programmes/b0000001") {
        return {
          ok: true,
          text: async () => `
            <html>
              <head>
                <meta property="og:title" content="Night Shift" />
                <meta property="og:description" content="Late-night electronic music." />
                <meta property="og:image" content="https://example.com/nightshift.jpg" />
                <meta name="parsely-author" content="Benji B" />
                <script type="application/ld+json">
                  {"@type":"RadioSeries","author":{"@type":"Person","name":"Benji B"},"genre":["Electronic","House"]}
                </script>
              </head>
            </html>
          `
        };
      }
      throw new Error(`Unexpected URL ${href}`);
    });

    let freshGetBbcDiscovery;
    jest.isolateModules(() => {
      ({ getBbcDiscovery: freshGetBbcDiscovery } = require("../src/lib/bbc"));
    });

    const results = await freshGetBbcDiscovery(1);
    expect(results).toHaveLength(1);
    expect(searchQueries.slice(0, 2)).toEqual(["music", "arts"]);
    expect(searchQueries.length).toBeGreaterThan(2);
    expect(searchQueries).toContain("electronic");
  });

  test("keeps searching across more discovery terms until it can fill a larger result set", async () => {
    Math.random = () => 0;

    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href.includes("https://www.bbc.co.uk/search?q=")) {
        const query = decodeURIComponent(href.split("q=")[1] || "").replace(/\+/g, " ");
        const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) || "smoke";
        return {
          ok: true,
          text: async () => `
            <a href="/programmes/${slug}1"></a>
            <a href="/programmes/${slug}2"></a>
            <a href="/programmes/${slug}3"></a>
            <a href="/programmes/${slug}4"></a>
            <a href="/programmes/${slug}5"></a>
          `
        };
      }
      if (/https:\/\/www\.bbc\.co\.uk\/programmes\/[a-z0-9]+/i.test(href)) {
        const pid = href.split("/").pop();
        return {
          ok: true,
          text: async () => `
            <html>
              <head>
                <meta property="og:title" content="Show ${pid}" />
                <meta property="og:description" content="Discovery description ${pid}." />
                <meta property="og:image" content="https://example.com/${pid}.jpg" />
                <meta name="parsely-author" content="Host ${pid}" />
                <script type="application/ld+json">
                  {"@type":"RadioSeries","author":{"@type":"Person","name":"Host ${pid}"},"genre":["Genre ${pid}"]}
                </script>
              </head>
            </html>
          `
        };
      }
      throw new Error(`Unexpected URL ${href}`);
    });

    let freshGetBbcDiscovery;
    jest.isolateModules(() => {
      ({ getBbcDiscovery: freshGetBbcDiscovery } = require("../src/lib/bbc"));
    });

    const results = await freshGetBbcDiscovery(5);
    expect(results).toHaveLength(5);
  });
});
