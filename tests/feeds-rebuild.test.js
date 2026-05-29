const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { rebuildProgramFeedsFromSchedules, listProgramFeedFiles } = require("../src/lib/feeds");

describe("rebuildProgramFeedsFromSchedules", () => {
  test("returns guidance when feed export disabled", async () => {
    const result = await rebuildProgramFeedsFromSchedules({
      feedExportEnabled: false,
      getDataDir: () => os.tmpdir(),
      sources: []
    });
    expect(result.ok).toBe(false);
    expect(result.rebuilt).toBe(0);
    expect(result.message).toMatch(/feed export/i);
  });

  test("writes feed files for each subscription", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kimble-feeds-"));
    const result = await rebuildProgramFeedsFromSchedules({
      feedExportEnabled: true,
      getDataDir: () => root,
      sources: [
        {
          sourceType: "rte",
          listSchedules: () => [
            {
              id: "s1",
              programUrl: "https://example.com/p1",
              title: "Smoke Program",
              description: "Desc",
              image: "",
              hosts: [],
              genres: [],
              runSchedule: "",
              nextBroadcastAt: "",
              nextBroadcastTitle: ""
            }
          ],
          getEpisodes: async () => ({
            episodes: [
              {
                clipId: "c1",
                title: "Ep 1",
                fullTitle: "Ep 1",
                description: "",
                publishedTime: "2026-01-01",
                episodeUrl: "https://example.com/e1",
                image: ""
              }
            ]
          })
        }
      ]
    });
    expect(result.ok).toBe(true);
    expect(result.rebuilt).toBe(1);
    const listed = listProgramFeedFiles({ dataDir: root, sourceType: "rte" });
    expect(listed.length).toBe(1);
    expect(listed[0].episodeCount).toBeGreaterThan(0);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
