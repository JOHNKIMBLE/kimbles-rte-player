const {
  buildEntityGraph,
  searchEntityGraph,
  getEntityGraphEntity
} = require("../src/lib/entity-graph");

describe("entity graph", () => {
  test("normalizes entities and builds cross-document relationships", () => {
    const graph = buildEntityGraph([
      {
        kind: "discovery",
        sourceType: "rte",
        title: "2FM Greene Room with Jenny Greene",
        programTitle: "2FM Greene Room with Jenny Greene",
        hosts: ["Jenny Greene"],
        genres: ["Electronic"],
        location: "Dublin",
        programUrl: "https://rte.test/jenny-greene",
        latestEpisodeTitle: "Monday Mix"
      },
      {
        kind: "episode",
        sourceType: "rte",
        title: "Monday Mix",
        programTitle: "2FM Greene Room with Jenny Greene",
        episodeTitle: "Monday Mix",
        hosts: ["Jenny Greene", "Kola"],
        genres: ["Electronic", "Dance"],
        location: "Dublin",
        programUrl: "https://rte.test/jenny-greene",
        episodeUrl: "https://rte.test/jenny-greene/monday-mix"
      },
      {
        kind: "host",
        sourceType: "bbc",
        title: "Shy One",
        programTitle: "Benji B",
        hosts: ["Shy One"],
        genres: ["Soul"],
        location: "London",
        programUrl: "https://bbc.test/benji-b"
      }
    ]);

    expect(graph.metrics.entityCount).toBeGreaterThan(0);
    expect(graph.metrics.relationCount).toBeGreaterThan(0);

    const hostResult = searchEntityGraph(graph, { type: "host", query: "jenny dublin", limit: 10 });
    expect(hostResult.total).toBeGreaterThan(0);
    expect(hostResult.results[0]).toEqual(expect.objectContaining({
      type: "host",
      name: "Jenny Greene"
    }));
    expect(hostResult.results[0].topPrograms.some((item) => item.name === "2FM Greene Room with Jenny Greene")).toBe(true);

    const programResult = searchEntityGraph(graph, { type: "program", query: "greene room", limit: 10 });
    expect(programResult.results[0]).toEqual(expect.objectContaining({
      type: "program",
      name: "2FM Greene Room with Jenny Greene"
    }));
    expect(programResult.results[0].topHosts.some((item) => item.name === "Jenny Greene")).toBe(true);
  });

  test("returns entity detail for related graph nodes", () => {
    const graph = buildEntityGraph([
      {
        kind: "program",
        sourceType: "rte",
        title: "Late Night Groove",
        programTitle: "Late Night Groove",
        hosts: ["Host A"],
        genres: ["Ambient"],
        location: "London",
        programUrl: "https://rte.test/late-night-groove"
      },
      {
        kind: "episode",
        sourceType: "nts",
        title: "Ambient Show w/ Host A",
        programTitle: "Ambient Show",
        episodeTitle: "Ambient Show w/ Host A",
        hosts: ["Host A"],
        genres: ["Ambient"],
        location: "London",
        programUrl: "https://nts.test/ambient-show",
        episodeUrl: "https://nts.test/ambient-show/latest"
      }
    ]);

    const host = searchEntityGraph(graph, { type: "host", query: "host a", limit: 10 }).results[0];
    const detail = getEntityGraphEntity(graph, { entityId: host.id });
    expect(detail.entity).toEqual(expect.objectContaining({
      id: host.id,
      name: "Host A"
    }));
    expect(detail.entity.topPrograms.some((item) => item.name === "Ambient Show")).toBe(true);
    expect(detail.entity.topEpisodes.some((item) => item.name === "Ambient Show w/ Host A")).toBe(true);

    const program = searchEntityGraph(graph, { type: "program", query: "ambient show", limit: 10 }).results[0];
    const programDetail = getEntityGraphEntity(graph, { entityId: program.id });
    expect(programDetail.entity.recommendedPrograms.some((item) => item.name === "Late Night Groove")).toBe(true);
  });
});
