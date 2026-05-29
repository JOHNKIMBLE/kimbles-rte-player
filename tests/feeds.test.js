const fs = require("fs");
const os = require("os");
const path = require("path");
const { writeProgramFeedFiles, listProgramFeedFiles } = require("../src/lib/feeds");

describe("feeds workflow", () => {
  test("writes and lists program feed files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "feeds-"));
    const schedule = {
      id: "sched-1",
      title: "Late Night Tales",
      description: "A test program",
      programUrl: "https://example.com/program/late-night-tales",
      location: "London",
      hosts: ["DJ Smoke"],
      genres: ["Electronic", "Soul"],
      runSchedule: "Tue • 23:00 - 01:00",
      nextBroadcastAt: "2026-03-18T23:00:00.000Z",
      nextBroadcastTitle: "Late Night Tales",
      latestEpisodeTitle: "Episode 1",
      latestEpisodePublishedTime: "2026-03-16",
      latestEpisodeDescription: "First episode",
      latestEpisodeLocation: "London",
      latestEpisodeHosts: ["DJ Smoke"],
      latestEpisodeGenres: ["Electronic"]
    };
    const latest = {
      episodes: [
        {
          clipId: "ep-1",
          title: "Episode 1",
          description: "First episode",
          publishedTime: "2026-03-16",
          episodeUrl: "https://example.com/program/late-night-tales/ep-1",
          image: "https://example.com/image.jpg",
          location: "London",
          hosts: ["DJ Smoke"],
          genres: ["Electronic"]
        }
      ]
    };

    const written = writeProgramFeedFiles({
      dataDir: tempDir,
      schedule,
      latest
    });

    expect(fs.existsSync(written.jsonPath)).toBe(true);
    expect(fs.existsSync(written.rssPath)).toBe(true);

    const payload = JSON.parse(fs.readFileSync(written.jsonPath, "utf8"));
    expect(payload.location).toBe("London");
    expect(payload.hosts).toEqual(["DJ Smoke"]);
    expect(payload.genres).toEqual(["Electronic", "Soul"]);
    expect(payload.runSchedule).toBe("Tue • 23:00 - 01:00");
    expect(payload.latestEpisodeHosts).toEqual(["DJ Smoke"]);
    expect(payload.episodes[0].location).toBe("London");
    expect(payload.episodes[0].hosts).toEqual(["DJ Smoke"]);
    expect(payload.episodes[0].genres).toEqual(["Electronic"]);

    const feeds = listProgramFeedFiles({
      dataDir: tempDir,
      sourceType: "rte",
      publicBasePath: "/feeds/rte"
    });

    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({
      slug: "late-night-tales",
      sourceType: "rte",
      title: "Late Night Tales",
      episodeCount: 1,
      jsonUrl: "/feeds/rte/late-night-tales.json",
      rssUrl: "/feeds/rte/late-night-tales.rss.xml",
      location: "London",
      runSchedule: "Tue • 23:00 - 01:00",
      latestEpisodeTitle: "Episode 1"
    });
    expect(feeds[0].hosts).toEqual(["DJ Smoke"]);
    expect(feeds[0].genres).toEqual(["Electronic", "Soul"]);
    expect(feeds[0].latestEpisodeHosts).toEqual(["DJ Smoke"]);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
