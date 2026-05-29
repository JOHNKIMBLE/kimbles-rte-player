const {
  deriveHarvestSearchTerms,
  harvestMetadataDocs,
  mergeHarvestDocs,
  planMetadataHarvest
} = require("../src/lib/metadata-harvester");

describe("metadata harvester", () => {
  test("derives high-value search terms from local metadata docs", () => {
    const terms = deriveHarvestSearchTerms([
      {
        title: "Jenny Greene",
        hosts: ["Jenny Greene"],
        genres: ["Electronic", "Dance"],
        location: "Dublin"
      },
      {
        programTitle: "Worldwide Breakfast",
        hosts: ["Valentine Comar"],
        genres: ["Jazz"],
        location: "Paris"
      }
    ]);

    expect(terms).toEqual(expect.arrayContaining([
      "Jenny Greene",
      "Electronic",
      "Worldwide Breakfast",
      "Valentine Comar"
    ]));
  });

  test("harvests across multiple discovery passes and merges with previous cache", async () => {
    let discoveryCalls = 0;
    let episodeCalls = 0;
    const docs = await harvestMetadataDocs({
      sources: [
        {
          sourceType: "bbc",
          discoveryPasses: 2,
          getDiscovery: async () => {
            discoveryCalls += 1;
            return discoveryCalls === 1
              ? [{ title: "Benji B", programUrl: "https://bbc.test/benji-b", hosts: ["Benji B"] }]
              : [{ title: "Gilles Peterson", programUrl: "https://bbc.test/gilles", hosts: ["Gilles Peterson"] }];
          },
          search: async (term) => [{ title: `${term} Show`, programUrl: `https://bbc.test/${encodeURIComponent(term)}`, genres: ["Electronic"] }],
          getEpisodes: async (programUrl) => {
            episodeCalls += 1;
            return {
              episodes: [{
                id: `${programUrl}-episode-1`,
                title: `${programUrl.split("/").pop()} Latest`,
                episodeUrl: `${programUrl}/latest`,
                hosts: ["Episode Host"],
                genres: ["Soul"],
                location: "London",
                description: "Episode metadata"
              }]
            };
          },
          perSearchLimit: 1,
          summaryLimit: 0
        }
      ],
      searchTerms: ["jazz"]
    });

    expect(discoveryCalls).toBe(2);
    expect(episodeCalls).toBeGreaterThan(0);
    expect(docs.some((doc) => doc.title === "Benji B")).toBe(true);
    expect(docs.some((doc) => doc.title === "Gilles Peterson")).toBe(true);
    expect(docs.some((doc) => doc.title === "jazz Show")).toBe(true);
    expect(docs.some((doc) => doc.latestEpisodeTitle && doc.latestEpisodeHosts?.includes("Episode Host"))).toBe(true);
    expect(docs.some((doc) => doc.harvestKind === "host" && doc.title === "Episode Host")).toBe(true);
    expect(docs.some((doc) => doc.harvestKind === "episode" && doc.episodeTitle?.includes("Latest"))).toBe(true);

    const merged = mergeHarvestDocs(
      [{ sourceType: "bbc", title: "Legacy Show", programUrl: "https://bbc.test/legacy", genres: ["Soul"] }],
      docs,
      50
    );
    expect(merged.some((doc) => doc.title === "Legacy Show")).toBe(true);
    expect(merged.some((doc) => doc.title === "Benji B")).toBe(true);
  });

  test("plans per-source harvest cadence and rotates episode depth", () => {
    const now = Date.parse("2026-03-17T12:00:00.000Z");
    const sources = [
      { sourceType: "rte", harvestCadenceMs: 1000 * 60 * 60, maxEpisodePages: 3 },
      { sourceType: "bbc", harvestCadenceMs: 1000 * 60 * 60 * 4, maxEpisodePages: 2 }
    ];
    const priorState = {
      sources: {
        rte: {
          lastRunAt: "2026-03-17T10:00:00.000Z",
          nextEpisodePages: 2,
          harvestCadenceMs: 1000 * 60 * 60,
          maxEpisodePages: 3
        },
        bbc: {
          lastRunAt: "2026-03-17T11:30:00.000Z",
          nextEpisodePages: 2,
          harvestCadenceMs: 1000 * 60 * 60 * 4,
          maxEpisodePages: 2
        }
      }
    };

    const plan = planMetadataHarvest(sources, priorState, false, now);

    expect(plan.plannedSources).toHaveLength(1);
    expect(plan.plannedSources[0]).toMatchObject({
      sourceType: "rte",
      episodePages: 2
    });
    expect(plan.nextState.sources.rte.lastEpisodePages).toBe(2);
    expect(plan.nextState.sources.rte.nextEpisodePages).toBe(3);
    expect(plan.nextState.sources.bbc.nextDueAt).toBeTruthy();
  });

  test("force refresh harvests max episode depth for every source", () => {
    const now = Date.parse("2026-03-17T12:00:00.000Z");
    const plan = planMetadataHarvest(
      [
        { sourceType: "nts", harvestCadenceMs: 1000 * 60 * 60, maxEpisodePages: 4 },
        { sourceType: "wwf", harvestCadenceMs: 1000 * 60 * 60, maxEpisodePages: 3 }
      ],
      { sources: {} },
      true,
      now
    );

    expect(plan.plannedSources).toHaveLength(2);
    expect(plan.plannedSources.map((source) => source.episodePages)).toEqual([4, 3]);
    expect(plan.nextState.sources.nts.lastEpisodePages).toBe(4);
    expect(plan.nextState.sources.nts.nextEpisodePages).toBe(1);
  });

  test("harvest fetches multiple episode pages when configured", async () => {
    const pageCalls = [];
    const docs = await harvestMetadataDocs({
      sources: [
        {
          sourceType: "nts",
          search: async () => [{ title: "Deep Space", programUrl: "https://nts.test/deep-space", hosts: ["Host A"] }],
          getEpisodes: async (programUrl, page = 1) => {
            pageCalls.push([programUrl, page]);
            return {
              episodes: [{
                id: `${programUrl}-episode-${page}`,
                title: `Episode ${page}`,
                episodeUrl: `${programUrl}/episodes/${page}`,
                hosts: [`Host ${page}`],
                genres: ["Ambient"]
              }]
            };
          },
          perSearchLimit: 1,
          summaryLimit: 0,
          episodePages: 2
        }
      ],
      searchTerms: ["ambient"]
    });

    expect(pageCalls).toEqual(
      expect.arrayContaining([
        ["https://nts.test/deep-space", 1],
        ["https://nts.test/deep-space", 2]
      ])
    );
    expect(docs.filter((doc) => doc.harvestKind === "episode")).toHaveLength(2);
  });
});
