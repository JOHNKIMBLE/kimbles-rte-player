const {
  runSourceCanary,
  runSourceCanaries,
  shouldRunSourceCanaries
} = require("../src/lib/source-canary");

describe("source canaries", () => {
  const provider = {
    sourceType: "test",
    getDiscovery: async () => [{ title: "Test Show", programUrl: "https://example.test/show" }],
    getProgramSummary: async () => ({ title: "Test Show" }),
    getProgramEpisodes: async () => [{ title: "Episode", episodeUrl: "https://example.test/episode" }],
    getEpisodePlaylist: async () => [{ title: "Track" }],
    getLive: async () => ({ title: "Live" })
  };

  test("checks discovery, programme, episode, tracklist, and live capabilities", async () => {
    const result = await runSourceCanary(provider, new Date("2026-08-08T12:00:00.000Z"));
    expect(result.status).toBe("healthy");
    expect(result.programTitle).toBe("Test Show");
    expect(result.capabilities.map((entry) => entry.key)).toEqual(["discovery", "program", "episodes", "tracklist", "live"]);
    expect(result.capabilities.find((entry) => entry.key === "tracklist").detail).toBe("1 track(s) published");
  });

  test("reports a missing published tracklist without treating it as a provider failure", async () => {
    const result = await runSourceCanary({ ...provider, getEpisodePlaylist: async () => [] });
    expect(result.status).toBe("healthy");
    expect(result.capabilities.find((entry) => entry.key === "tracklist").detail).toBe("No tracklist published for this episode");
  });

  test("isolates provider failures and identifies stale results", async () => {
    const result = await runSourceCanaries([{ sourceType: "broken", getDiscovery: async () => { throw new Error("network unavailable"); } }]);
    expect(result[0].status).toBe("failed");
    expect(result[0].capabilities[0].detail).toBe("network unavailable");
    expect(shouldRunSourceCanaries(result, { requiredSources: ["broken", "missing"], nowMs: Date.now() })).toBe(true);
  });
});
