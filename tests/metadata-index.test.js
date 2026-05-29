const {
  buildMetadataIndex,
  buildScheduleMetadataDocs,
  buildFeedMetadataDocs,
  buildHistoryMetadataDocs,
  searchMetadataIndex,
  discoverMetadataIndex,
  buildCollectionRecommendations,
  buildSubscriptionDiscoveryRecommendations,
  buildForYouRecommendations,
  applyMetadataRepairRules
} = require("../src/lib/metadata-index");

describe("metadata index", () => {
  test("indexes subscriptions, feeds, and history with metadata-aware search", () => {
    const index = buildMetadataIndex({
      schedulesBySource: {
        rte: [{
          id: "sched-1",
          title: "Jenny Greene",
          description: "Dance and electronic selections.",
          hosts: ["Jenny Greene"],
          genres: ["Electronic"],
          location: "Dublin",
          runSchedule: "Mon • 22:00 - 00:00",
          latestEpisodeTitle: "Monday 16 March 2026"
        }]
      },
      feeds: [{
        slug: "ambient-show",
        sourceType: "nts",
        title: "Ambient Show",
        description: "Deep ambient and drone",
        hosts: ["Host A"],
        genres: ["Ambient"],
        location: "London"
      }],
      history: [{
        id: "hist-1",
        sourceType: "wwf",
        programTitle: "Worldwide Breakfast",
        episodeTitle: "Valentine Comar",
        hosts: ["Valentine Comar"],
        genres: ["Jazz"],
        location: "Paris",
        filePath: "C:\\Downloads\\episode.mp3"
      }]
    });

    expect(index).toHaveLength(3);

    const hostSearch = searchMetadataIndex(index, { query: "Jenny", limit: 10 });
    expect(hostSearch.total).toBe(1);
    expect(hostSearch.results[0]).toEqual(expect.objectContaining({
      kind: "subscription",
      sourceType: "rte",
      title: "Jenny Greene"
    }));

    const genreSearch = searchMetadataIndex(index, { query: "ambient london", limit: 10 });
    expect(genreSearch.total).toBe(1);
    expect(genreSearch.results[0]).toEqual(expect.objectContaining({
      kind: "feed",
      sourceType: "nts"
    }));

    const filtered = searchMetadataIndex(index, { query: "Valentine", kind: "history", sourceType: "wwf", limit: 10 });
    expect(filtered.total).toBe(1);
    expect(filtered.results[0]).toEqual(expect.objectContaining({
      kind: "history",
      sourceType: "wwf",
      episodeTitle: "Valentine Comar"
    }));
  });

  test("builds curated discovery picks and facets from harvested metadata", () => {
    const index = buildMetadataIndex({
      harvested: [
        {
          harvestKind: "program",
          sourceType: "bbc",
          title: "Benji B",
          hosts: ["Benji B"],
          genres: ["Electronic", "Soul"],
          location: "London",
          programUrl: "https://bbc.test/benji-b",
          latestEpisodeTitle: "Shy One",
          latestEpisodeHosts: ["Benji B"],
          latestEpisodeGenres: ["Soul"],
          harvestedAt: "2026-03-17T12:00:00.000Z"
        },
        {
          harvestKind: "host",
          sourceType: "bbc",
          title: "Shy One",
          programTitle: "Benji B",
          subtitle: "Benji B",
          hosts: ["Shy One"],
          genres: ["Soul"],
          location: "London",
          programUrl: "https://bbc.test/benji-b",
          episodeUrl: "https://bbc.test/benji-b/shy-one",
          harvestedAt: "2026-03-17T12:05:00.000Z"
        },
        {
          harvestKind: "episode",
          sourceType: "bbc",
          title: "Shy One enters Album Mode",
          programTitle: "Benji B",
          episodeTitle: "Shy One enters Album Mode",
          hosts: ["Benji B", "Shy One"],
          genres: ["Electronic", "Soul"],
          location: "London",
          programUrl: "https://bbc.test/benji-b",
          episodeUrl: "https://bbc.test/benji-b/shy-one-episode",
          harvestedAt: "2026-03-17T12:10:00.000Z"
        },
        {
          harvestKind: "program",
          sourceType: "nts",
          title: "Ambient Show",
          hosts: ["Host A"],
          genres: ["Ambient"],
          location: "London",
          programUrl: "https://nts.test/ambient-show",
          harvestedAt: "2026-03-17T13:00:00.000Z"
        }
      ]
    });

    const discovery = discoverMetadataIndex(index, { query: "london", limit: 10 });
    expect(discovery.results.length).toBeGreaterThan(0);
    expect(discovery.facets.hosts[0]).toEqual(expect.objectContaining({ value: expect.any(String), count: expect.any(Number) }));
    expect(discovery.facets.genres.some((item) => item.value === "Ambient")).toBe(true);
    expect(discovery.results.some((row) => row.latestEpisodeTitle === "Shy One")).toBe(true);
    expect(index.some((row) => row.kind === "host" && row.title === "Shy One")).toBe(true);
    expect(index.some((row) => row.kind === "episode" && row.title === "Shy One enters Album Mode")).toBe(true);
  });

  test("builds subscription-based discovery excluding subscribed program URLs", () => {
    const index = buildMetadataIndex({
      schedulesBySource: {
        rte: [{
          id: "s1",
          title: "Jenny Greene",
          hosts: ["Jenny Greene"],
          genres: ["Electronic"],
          location: "Dublin",
          programUrl: "https://rte.test/jenny",
          latestEpisodeTitle: "Monday show"
        }]
      },
      harvested: [
        {
          harvestKind: "program",
          sourceType: "bbc",
          title: "Other Electronic Show",
          hosts: ["DJ X"],
          genres: ["Electronic"],
          location: "London",
          programUrl: "https://bbc.test/other",
          harvestedAt: "2026-03-17T12:00:00.000Z"
        },
        {
          harvestKind: "program",
          sourceType: "rte",
          title: "Jenny Greene (same URL)",
          hosts: ["Jenny Greene"],
          genres: ["Electronic"],
          programUrl: "https://rte.test/jenny",
          harvestedAt: "2026-03-17T13:00:00.000Z"
        }
      ]
    });
    const rec = buildSubscriptionDiscoveryRecommendations(index, { limit: 12 });
    expect(rec.subscriptionCount).toBe(1);
    expect(rec.results.some((row) => row.programUrl === "https://bbc.test/other")).toBe(true);
    expect(rec.results.some((row) => row.programUrl === "https://rte.test/jenny")).toBe(false);
    expect(rec.results.every((row) => row.kind !== "subscription")).toBe(true);
  });

  test("subscription discovery drops rows whose title is a presenter but programTitle is a subscribed show", () => {
    const index = buildMetadataIndex({
      schedulesBySource: {
        rte: [{
          id: "s1",
          title: "Electric Disco",
          hosts: ["Jenny Greene"],
          genres: ["Electronic"],
          programUrl: "https://www.rte.ie/radio/radio1/electric-disco/",
          latestEpisodeTitle: "Monday show"
        }]
      },
      harvested: [
        {
          harvestKind: "program",
          sourceType: "rte",
          title: "Jenny Greene",
          programTitle: "Electric Disco",
          hosts: ["Jenny Greene"],
          genres: ["Electronic"],
          programUrl: "https://www.rte.ie/radio/radio1/electric-disco",
          harvestedAt: "2026-03-17T12:00:00.000Z"
        },
        {
          harvestKind: "program",
          sourceType: "rte",
          title: "Ambient Night",
          programTitle: "Ambient Night",
          hosts: ["DJ X"],
          programUrl: "https://www.rte.ie/radio/radio1/ambient-night/",
          harvestedAt: "2026-03-17T13:00:00.000Z"
        }
      ]
    });
    const rec = buildSubscriptionDiscoveryRecommendations(index, { limit: 12, sourceType: "", query: "" });
    expect(rec.results.some((row) => String(row.programUrl || "").includes("electric-disco"))).toBe(false);
    expect(rec.results.some((row) => String(row.programUrl || "").includes("ambient-night"))).toBe(true);
  });

  test("buildForYouRecommendations mixes sources when the scored pool is dominated by one network", () => {
    const harvested = [];
    for (let i = 0; i < 10; i += 1) {
      harvested.push({
        harvestKind: "program",
        sourceType: "bbc",
        title: `BBC Show ${i}`,
        hosts: [`Host ${i}`],
        genres: ["Electronic"],
        location: "London",
        programUrl: `https://bbc.test/show-${i}`,
        harvestedAt: `2026-03-17T12:${String(i).padStart(2, "0")}:00.000Z`
      });
    }
    harvested.push({
      harvestKind: "program",
      sourceType: "nts",
      title: "NTS Deep Cuts",
      hosts: ["NTS Host"],
      genres: ["Electronic"],
      location: "London",
      programUrl: "https://nts.test/deep",
      harvestedAt: "2026-03-17T20:00:00.000Z"
    });
    harvested.push({
      harvestKind: "program",
      sourceType: "fip",
      title: "FIP Night",
      hosts: ["FIP Host"],
      genres: ["Jazz"],
      location: "Paris",
      programUrl: "https://fip.test/night",
      harvestedAt: "2026-03-17T21:00:00.000Z"
    });
    const index = buildMetadataIndex({
      schedulesBySource: {
        rte: [{
          id: "s1",
          title: "Jenny Greene",
          hosts: ["Jenny Greene"],
          genres: ["Electronic"],
          programUrl: "https://rte.test/jenny",
          latestEpisodeTitle: "Show"
        }]
      },
      harvested
    });
    const forYou = buildForYouRecommendations(index, { limit: 8 });
    expect(forYou.forYou).toBe(true);
    expect(forYou.results.length).toBeLessThanOrEqual(8);
    const forYouSources = new Set(forYou.results.map((r) => r.sourceType));
    expect(forYouSources.size).toBeGreaterThanOrEqual(2);
    expect(forYou.diversifiedSourceCount).toBeGreaterThanOrEqual(2);
  });

  test("builds collection recommendations from saved metadata terms", () => {
    const index = buildMetadataIndex({
      harvested: [
        {
          harvestKind: "program",
          sourceType: "bbc",
          title: "Benji B",
          hosts: ["Benji B"],
          genres: ["Electronic", "Soul"],
          location: "London",
          programUrl: "https://bbc.test/benji-b",
          harvestedAt: "2026-03-17T12:00:00.000Z"
        },
        {
          harvestKind: "episode",
          sourceType: "nts",
          title: "Ambient Show w/ Host A",
          programTitle: "Ambient Show",
          episodeTitle: "Ambient Show w/ Host A",
          hosts: ["Host A"],
          genres: ["Ambient"],
          location: "London",
          programUrl: "https://nts.test/ambient-show",
          episodeUrl: "https://nts.test/ambient-show/latest",
          harvestedAt: "2026-03-17T13:00:00.000Z"
        },
        {
          harvestKind: "host",
          sourceType: "fip",
          title: "Host B",
          programTitle: "Cosmic Grooves",
          hosts: ["Host B"],
          genres: ["Electronic"],
          location: "Paris",
          programUrl: "https://fip.test/cosmic-grooves",
          harvestedAt: "2026-03-17T14:00:00.000Z"
        }
      ]
    });

    const recommendations = buildCollectionRecommendations(index, {
      id: "col-1",
      name: "Late Night Electronic",
      entries: [
        {
          sourceType: "rte",
          title: "Jenny Greene",
          hosts: ["Jenny Greene"],
          genres: ["Electronic"],
          location: "Dublin"
        },
        {
          sourceType: "bbc",
          title: "Benji B",
          hosts: ["Benji B"],
          genres: ["Soul"]
        }
      ]
    });

    expect(recommendations.terms).toEqual(expect.arrayContaining(["Electronic", "Benji B"]));
    expect(recommendations.results.some((row) => row.title === "Benji B")).toBe(false);
    expect(recommendations.results[0]).toEqual(expect.objectContaining({
      title: expect.any(String)
    }));
    expect(["host", "episode"]).toContain(recommendations.results[0].kind);
  });

  test("searches harvested host and episode docs as first-class kinds", () => {
    const index = buildMetadataIndex({
      harvested: [
        {
          harvestKind: "host",
          sourceType: "wwf",
          title: "Stefania Vos",
          programTitle: "Stefania Vos",
          hosts: ["Stefania Vos"],
          genres: ["Electronic"],
          location: "Turin",
          programUrl: "https://wwf.test/stefania-vos",
          harvestedAt: "2026-03-17T15:00:00.000Z"
        },
        {
          harvestKind: "episode",
          sourceType: "wwf",
          title: "First Light: Rohan Rakhit",
          programTitle: "WW Eireann",
          episodeTitle: "First Light: Rohan Rakhit",
          hosts: ["Rohan Rakhit"],
          genres: ["Alternative"],
          location: "London",
          programUrl: "https://wwf.test/ww-eireann",
          episodeUrl: "https://wwf.test/episode/rohan-rakhit",
          harvestedAt: "2026-03-17T16:00:00.000Z"
        }
      ]
    });

    const hostSearch = searchMetadataIndex(index, { kind: "host", query: "stefania turin", limit: 10 });
    expect(hostSearch.total).toBe(1);
    expect(hostSearch.results[0]).toEqual(expect.objectContaining({
      kind: "host",
      title: "Stefania Vos"
    }));

    const episodeSearch = searchMetadataIndex(index, { kind: "episode", query: "rohan alternative", limit: 10 });
    expect(episodeSearch.total).toBe(1);
    expect(episodeSearch.results[0]).toEqual(expect.objectContaining({
      kind: "episode",
      episodeTitle: "First Light: Rohan Rakhit"
    }));
  });

  test("supports metadata facet filters and repair rules", () => {
    const index = buildMetadataIndex({
      harvested: [
        {
          harvestKind: "episode",
          sourceType: "nts",
          title: "Breakfast Show w/ FLO",
          programTitle: "The Breakfast Show",
          episodeTitle: "Breakfast Show w/ FLO",
          hosts: ["FLO DILL"],
          genres: ["Soul"],
          location: "London",
          programUrl: "https://nts.test/breakfast",
          episodeUrl: "https://nts.test/breakfast/latest",
          harvestedAt: "2026-03-17T16:00:00.000Z"
        }
      ]
    });

    const repaired = applyMetadataRepairRules(index, [{
      field: "host",
      sourceType: "nts",
      from: "FLO DILL",
      to: "Flo Dill"
    }]);

    const filtered = searchMetadataIndex(repaired, {
      sourceType: "nts",
      host: "Flo Dill",
      genre: "Soul",
      location: "London",
      limit: 10
    });

    expect(filtered.total).toBe(1);
    expect(filtered.results[0]).toEqual(expect.objectContaining({
      title: "Breakfast Show w/ FLO",
      hosts: expect.arrayContaining(["Flo Dill"])
    }));
  });

  test("builds section docs independently for incremental snapshot patching", () => {
    const subscriptionDocs = buildScheduleMetadataDocs({
      rte: [{
        id: "sched-1",
        title: "Jenny Greene",
        hosts: ["Jenny Greene"],
        genres: ["Electronic"],
        location: "Dublin",
        programUrl: "https://rte.test/jenny"
      }]
    });
    const feedDocs = buildFeedMetadataDocs([{
      slug: "ambient-show",
      sourceType: "nts",
      title: "Ambient Show",
      genres: ["Ambient"],
      programUrl: "https://nts.test/ambient-show"
    }]);
    const historyDocs = buildHistoryMetadataDocs([{
      id: "hist-1",
      sourceType: "bbc",
      programTitle: "Benji B",
      episodeTitle: "Shy One enters Album Mode",
      filePath: "C:\\Downloads\\benji-b.mp3"
    }]);

    expect(subscriptionDocs[0]).toEqual(expect.objectContaining({
      kind: "subscription",
      sourceType: "rte",
      title: "Jenny Greene"
    }));
    expect(feedDocs[0]).toEqual(expect.objectContaining({
      kind: "feed",
      sourceType: "nts",
      title: "Ambient Show"
    }));
    expect(historyDocs[0]).toEqual(expect.objectContaining({
      kind: "history",
      sourceType: "bbc",
      title: "Shy One enters Album Mode"
    }));
  });
});
