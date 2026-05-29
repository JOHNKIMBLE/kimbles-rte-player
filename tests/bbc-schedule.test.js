const { getBbcProgramSummary } = require("../src/lib/bbc");

function makeProgramHtml(title = "BBC Radio 1 - Benji B") {
  return `
    <html>
      <head>
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="Upcoming episodes">
        <meta property="og:image" content="https://example.com/show.jpg">
      </head>
      <body></body>
    </html>
  `;
}

function makeUpcomingHtml(episodes) {
  return `
    <html>
      <head></head>
      <body>
        <script type="application/ld+json">${JSON.stringify({
          "@type": "RadioSeries",
          episode: episodes
        })}</script>
      </body>
    </html>
  `;
}

describe("BBC upcoming schedule shaping", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("drops low-frequency outlier slots from recurring weekly schedule", async () => {
    jest.useFakeTimers({ now: new Date("2026-03-17T12:00:00.000Z") });
    const programUrl = "https://www.bbc.co.uk/programmes/b00v4tv3";
    const responses = new Map([
      [programUrl, makeProgramHtml()],
      [`${programUrl}/broadcasts/upcoming`, makeUpcomingHtml([
        {
          "@type": "RadioEpisode",
          identifier: "m002sbxc",
          name: "18/03/2026",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-03-18T23:00:00+00:00",
            endDate: "2026-03-19T01:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "m002snvb",
          name: "25/03/2026",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-03-25T23:00:00+00:00",
            endDate: "2026-03-26T01:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "m002t1yr",
          name: "01/04/2026",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-04-01T22:00:00+00:00",
            endDate: "2026-04-02T00:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "m002tdwh",
          name: "06/04/2026",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-04-06T17:00:00+00:00",
            endDate: "2026-04-06T19:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "m002tf2b",
          name: "08/04/2026",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-04-08T22:00:00+00:00",
            endDate: "2026-04-09T00:00:00+00:00"
          }
        }
      ])]
    ]);

    global.fetch = jest.fn(async (url) => ({
      ok: true,
      text: async () => responses.get(String(url)) || "",
      json: async () => ({})
    }));

    const summary = await getBbcProgramSummary(programUrl, null, { includeSchedule: true });
    expect(summary.runSchedule).toBe("Wed • 23:00 - 01:00");
    expect(summary.nextBroadcastAt).toBe("2026-03-18T23:00:00.000Z");
  });

  test("keeps genuinely recurring multi-slot schedules", async () => {
    const programUrl = "https://www.bbc.co.uk/programmes/b00multi1";
    const responses = new Map([
      [programUrl, makeProgramHtml("BBC Radio 6 Music - Multi Slot")],
      [`${programUrl}/broadcasts/upcoming`, makeUpcomingHtml([
        {
          "@type": "RadioEpisode",
          identifier: "a1",
          name: "Tue 1",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-03-17T20:00:00+00:00",
            endDate: "2026-03-17T22:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "a2",
          name: "Thu 1",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-03-19T20:00:00+00:00",
            endDate: "2026-03-19T22:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "a3",
          name: "Tue 2",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-03-24T20:00:00+00:00",
            endDate: "2026-03-24T22:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "a4",
          name: "Thu 2",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-03-26T20:00:00+00:00",
            endDate: "2026-03-26T22:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "a5",
          name: "Tue 3",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-03-31T19:00:00+00:00",
            endDate: "2026-03-31T21:00:00+00:00"
          }
        },
        {
          "@type": "RadioEpisode",
          identifier: "a6",
          name: "Thu 3",
          publication: {
            "@type": "BroadcastEvent",
            startDate: "2026-04-02T19:00:00+00:00",
            endDate: "2026-04-02T21:00:00+00:00"
          }
        }
      ])]
    ]);

    global.fetch = jest.fn(async (url) => ({
      ok: true,
      text: async () => responses.get(String(url)) || "",
      json: async () => ({})
    }));

    const summary = await getBbcProgramSummary(programUrl, null, { includeSchedule: true });
    expect(summary.runSchedule).toBe("Tue, Thu • 20:00 - 22:00");
  });
});
