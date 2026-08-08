const fs = require("fs");
const path = require("path");

const { getProgramEpisodes: getRteProgramEpisodes } = require("../src/lib/rte");
const { getBbcProgramEpisodes } = require("../src/lib/bbc");
const { getWwfEpisodeInfo, getWwfEpisodePlaylist } = require("../src/lib/worldwidefm");
const { getNtsEpisodeInfo } = require("../src/lib/nts");
const { getFipProgramSummary, getFipEpisodeStream } = require("../src/lib/fip");
const { getKexpProgramSummary } = require("../src/lib/kexp");

const FIXTURES_DIR = path.join(__dirname, "fixtures", "sources");

function fixtureText(...parts) {
  return fs.readFileSync(path.join(FIXTURES_DIR, ...parts), "utf8");
}

function fixtureJson(...parts) {
  return JSON.parse(fixtureText(...parts));
}

function textResponse(text) {
  return { ok: true, status: 200, statusText: "OK", text: async () => text };
}

function jsonResponse(json) {
  return { ok: true, status: 200, statusText: "OK", json: async () => json };
}

function installFetchRouter(routes) {
  global.fetch = jest.fn(async (url) => {
    const href = String(url);
    for (const route of routes) {
      if (route.match(href)) {
        return route.response(href);
      }
    }
    throw new Error(`Unexpected fixture URL: ${href}`);
  });
}

describe("source golden fixtures", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test("RTÉ program and episode fixture keeps expected metadata shape", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-15T12:00:00Z"));
    installFetchRouter([
      {
        match: (href) => href.includes("/episodes/json/"),
        response: () => jsonResponse(fixtureJson("rte", "episodes.json"))
      },
      {
        match: (href) => href === "https://www.rte.ie/radio/radio1/golden-rte-show/",
        response: () => textResponse(fixtureText("rte", "program.html"))
      }
    ]);

    const payload = await getRteProgramEpisodes("https://www.rte.ie/radio/radio1/golden-rte-show/", 1);

    expect(payload.title).toBe("Golden RTÉ Show");
    expect(payload.hosts).toEqual(["Golden Host"]);
    expect(payload.genres).toEqual(["Talk", "Culture"]);
    expect(payload.runSchedule).toContain("09:00");
    expect(payload.episodes).toHaveLength(1);
    expect(payload.episodes[0]).toEqual(expect.objectContaining({
      clipId: "rte-golden-1",
      title: "Golden RTÉ Show",
      fullTitle: "Golden RTÉ Show - First Fixture",
      description: "Episode fixture summary.",
      hosts: ["Golden Host"],
      location: "Dublin"
    }));
  });

  test("BBC program and episode fixture keeps expected metadata shape", async () => {
    installFetchRouter([
      {
        match: (href) => href.endsWith("/episodes/player"),
        response: () => textResponse(fixtureText("bbc", "episodes.html"))
      },
      {
        match: (href) => href === "https://www.bbc.co.uk/programmes/bbcgold1",
        response: () => textResponse(fixtureText("bbc", "program.html"))
      }
    ]);

    const payload = await getBbcProgramEpisodes("https://www.bbc.co.uk/programmes/bbcgold1", null, 1);

    expect(payload.title).toBe("Golden BBC Show");
    expect(payload.hosts).toEqual(["Golden Presenter"]);
    expect(payload.genres).toEqual(["Electronic", "Jazz"]);
    expect(payload.episodes).toHaveLength(1);
    expect(payload.episodes[0]).toEqual(expect.objectContaining({
      clipId: "bbcgold1",
      title: "Golden BBC Episode",
      description: "BBC episode fixture summary.",
      image: "https://example.com/bbc-episode.jpg"
    }));
  });

  test("Worldwide FM episode fixture keeps expected metadata shape", async () => {
    installFetchRouter([
      {
        match: (href) => href === "https://www.worldwidefm.net/episode/golden-worldwide-morning-fixture",
        response: () => textResponse(fixtureText("wwf", "episode.html"))
      }
    ]);

    const info = await getWwfEpisodeInfo("https://www.worldwidefm.net/episode/golden-worldwide-morning-fixture");

    expect(info.title).toBe("Golden Worldwide : Morning Fixture");
    expect(info.showName).toBe("Golden Worldwide");
    expect(info.episodeName).toBe("Morning Fixture");
    expect(info.description).toBe("Worldwide FM fixture summary.");
    expect(info.image).toBe("https://example.com/wwf-golden.jpg");
    expect(info.mixcloudUrl).toBe("https://www.mixcloud.com/worldwidefm/golden-worldwide-morning-fixture/");
  });

  test("Worldwide FM trims escaped characters from an embedded Mixcloud URL", async () => {
    installFetchRouter([
      {
        match: (href) => href === "https://www.worldwidefm.net/episode/golden-mixcloud",
        response: () => textResponse(`
          <meta property="og:title" content="Golden Worldwide : Mixcloud Fixture">
          <script>const player_url = "https://www.mixcloud.com/worldwidefm/golden-mixcloud/\\\\";</script>
        `)
      }
    ]);

    const info = await getWwfEpisodeInfo("https://www.worldwidefm.net/episode/golden-mixcloud");

    expect(info.mixcloudUrl).toBe("https://www.mixcloud.com/worldwidefm/golden-mixcloud/");
  });

  test("Worldwide FM parses a tracklist streamed as a standalone RSC payload", async () => {
    installFetchRouter([
      {
        match: (href) => href === "https://www.worldwidefm.net/episode/golden-rsc-tracklist",
        response: () => textResponse('self.__next_f.push([1,"\\u003cp\\u003eGolden Artist - Golden Song\\u003c/p\\u003e\\u003cp\\u003eSecond Artist - Second Song\\u003c/p\\u003e"])')
      }
    ]);

    const playlist = await getWwfEpisodePlaylist("https://www.worldwidefm.net/episode/golden-rsc-tracklist");

    expect(playlist.tracks).toEqual([
      { artist: "Golden Artist", title: "Golden Song", image: "" },
      { artist: "Second Artist", title: "Second Song", image: "" }
    ]);
  });

  test("NTS episode fixture keeps expected metadata shape", async () => {
    installFetchRouter([
      {
        match: (href) => href === "https://www.nts.live/shows/golden/episodes/golden-episode",
        response: () => textResponse(fixtureText("nts", "episode.html"))
      }
    ]);

    const info = await getNtsEpisodeInfo("https://www.nts.live/shows/golden/episodes/golden-episode");

    expect(info.title).toBe("Golden NTS Episode");
    expect(info.description).toBe("NTS fixture summary.");
    expect(info.image).toBe("https://example.com/nts-golden.jpg");
    expect(info.clipId).toBe("golden-episode");
    expect(Array.isArray(info.tracklist)).toBe(true);
  });

  test("FIP program fixture keeps expected metadata shape", async () => {
    installFetchRouter([
      {
        match: (href) => href.startsWith("https://www.radiofrance.fr/fip/podcasts/golden-fip-show/__data.json"),
        response: () => jsonResponse(fixtureJson("fip", "program-data.json"))
      },
      {
        match: (href) => href.startsWith("https://translate.googleapis.com/"),
        response: () => jsonResponse([[["", "", null, null]]])
      }
    ]);

    const summary = await getFipProgramSummary("golden-fip-show");

    expect(summary.title).toBe("Golden FIP Show");
    expect(summary.description).toBe("FIP fixture description.");
    expect(summary.image).toBe("https://example.com/fip-golden.jpg");
    expect(summary.hosts).toEqual(["FIP Host"]);
    expect(summary.genres).toEqual(["Jazz"]);
    expect(summary.cadence).toBe("daily");
  });

  test("FIP episode stream resolves the current standalone ManifestationAudio record", async () => {
    installFetchRouter([
      {
        match: (href) => href === "https://www.radiofrance.fr/fip/podcasts/golden-fip-show/golden-episode/__data.json",
        response: () => jsonResponse({
          nodes: [
            {
              data: [
                "ManifestationAudio",
                "https://media.radiofrance-podcast.net/golden-episode.m4a",
                { __typename: 0, url: 1, duration: 3600 }
              ]
            }
          ]
        })
      }
    ]);

    await expect(getFipEpisodeStream("https://www.radiofrance.fr/fip/podcasts/golden-fip-show/golden-episode"))
      .resolves.toEqual(expect.objectContaining({
        streamUrl: "https://media.radiofrance-podcast.net/golden-episode.m4a"
      }));
  });

  test("KEXP program fixture keeps expected metadata shape", async () => {
    installFetchRouter([
      {
        match: (href) => href === "https://api.kexp.org/v2/programs/42/",
        response: () => jsonResponse(fixtureJson("kexp", "program.json"))
      },
      {
        match: (href) => href === "https://api.kexp.org/v2/timeslots/?program=42&ordering=weekday,start_time&limit=50",
        response: () => jsonResponse(fixtureJson("kexp", "timeslots.json"))
      }
    ]);

    const summary = await getKexpProgramSummary("42");

    expect(summary.title).toBe("Golden KEXP Show");
    expect(summary.description).toBe("KEXP fixture description.");
    expect(summary.image).toBe("https://example.com/kexp-golden.jpg");
    expect(summary.hosts).toEqual(["KEXP Host"]);
    expect(summary.genres).toEqual(["soul", "jazz"]);
    expect(summary.location).toBe("Seattle, WA");
    expect(summary.runSchedule).toBeTruthy();
  });
});
