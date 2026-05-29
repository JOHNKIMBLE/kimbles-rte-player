const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSchedulerStore } = require("../src/lib/scheduler");

describe("scheduler workflow", () => {
  test("supports add, patch, and run lifecycle", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scheduler-"));
    const refreshed = [];
    const completed = [];
    const errors = [];
    let episodesCallCount = 0;

    const store = createSchedulerStore({
      dataDir: tempDir,
      getProgramSummary: async (programUrl) => ({
        programUrl,
        title: "Night Tracks",
        description: "Scheduler workflow test",
        image: "https://example.com/show.jpg",
        runSchedule: "Mon • 20:00 - 22:00",
        genres: ["Ambient", "Electronic"],
        hosts: ["Maya Jane"],
        location: "Dublin"
      }),
      getProgramEpisodes: async () => {
        episodesCallCount += 1;
        if (episodesCallCount === 1) {
          return {
            title: "Night Tracks",
            cadence: "weekly",
            description: "Latest metadata from episode feed",
            episodes: [
              {
                clipId: "clip-1",
                title: "Episode 1",
                episodeUrl: "https://example.com/episode-1",
                publishedTime: "2026-03-16",
                image: "https://example.com/ep.jpg",
                description: "Episode one description",
                hosts: ["Maya Jane"],
                genres: ["Ambient"],
                location: "Dublin"
              }
            ]
          };
        }

        return {
          title: "Night Tracks",
          cadence: "weekly",
          genres: ["Ambient", "Downtempo"],
          episodes: [
            {
              clipId: "clip-2",
              title: "Episode 2",
              episodeUrl: "https://example.com/episode-2",
              publishedTime: "2026-03-23",
              image: "https://example.com/ep-2.jpg",
              description: "Episode two description",
              hosts: ["Maya Jane", "Guest X"],
              genres: ["Ambient", "Downtempo"],
              location: "London"
            },
            {
              clipId: "clip-1",
              title: "Episode 1",
              episodeUrl: "https://example.com/episode-1",
              publishedTime: "2026-03-16",
              image: "https://example.com/ep.jpg",
              description: "Episode one description",
              hosts: ["Maya Jane"],
              genres: ["Ambient"],
              location: "Dublin"
            }
          ]
        };
      },
      runEpisodeDownload: async (episode) => ({
        outputDir: "/downloads",
        fileName: `${episode.clipId}.mp3`
      }),
      onScheduleRefreshed: async (schedule, latest) => refreshed.push({ schedule, latest }),
      onScheduleRunComplete: async (schedule, downloaded) => completed.push({ schedule, downloaded }),
      onScheduleRunError: async (schedule, error) => errors.push({ schedule, error })
    });

    const added = await store.add("https://example.com/program/night-tracks", { backfillCount: 0 });
    expect(added.title).toBe("Night Tracks");
    expect(added.genres).toEqual(["Ambient", "Electronic"]);
    expect(added.hosts).toEqual(["Maya Jane"]);
    expect(added.location).toBe("Dublin");
    expect(added.latestEpisodeDescription).toBe("Episode one description");
    expect(added.latestEpisodeHosts).toEqual(["Maya Jane"]);
    expect(store.list()).toHaveLength(1);

    const paused = store.setEnabled(added.id, false);
    expect(paused.enabled).toBe(false);
    expect(paused.lastStatus).toBe("Paused");

    const reenabled = store.setEnabled(added.id, true);
    expect(reenabled.enabled).toBe(true);

    const result = await store.checkOne(added.id);
    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]).toMatchObject({
      clipId: "clip-2",
      fileName: "clip-2.mp3"
    });
    expect(refreshed).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(errors).toHaveLength(0);

    const latest = store.list()[0];
    expect(latest.lastDownloaded).toMatchObject({
      clipId: "clip-2",
      fileName: "clip-2.mp3"
    });
    expect(latest.lastStatus).toContain("Downloaded");
    expect(latest.latestEpisodeDescription).toBe("Episode two description");
    expect(latest.latestEpisodeHosts).toEqual(["Maya Jane", "Guest X"]);
    expect(latest.latestEpisodeGenres).toEqual(["Ambient", "Downtempo"]);
    expect(latest.latestEpisodeLocation).toBe("London");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("keeps latest hosts first in host history for rotating shows", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scheduler-host-history-"));
    let episodesCallCount = 0;

    const store = createSchedulerStore({
      dataDir: tempDir,
      getProgramSummary: async (programUrl) => ({
        programUrl,
        title: "The Afternoon Show",
        hosts: ["Larry Mizell, Jr."],
        runSchedule: "Mon â€¢ 15:00 - 18:00"
      }),
      getProgramEpisodes: async () => {
        episodesCallCount += 1;
        if (episodesCallCount === 1) {
          return {
            episodes: [{
              clipId: "ep-1",
              title: "In for Larry today!",
              episodeUrl: "https://example.com/ep-1",
              publishedTime: "2026-03-17",
              hosts: ["Prometheus Brown"]
            }]
          };
        }
        return {
          episodes: [{
            clipId: "ep-2",
            title: "Back on the mic",
            episodeUrl: "https://example.com/ep-2",
            publishedTime: "2026-03-24",
            hosts: ["Larry Mizell, Jr."]
          }]
        };
      },
      runEpisodeDownload: async (episode) => ({
        outputDir: "/downloads",
        fileName: `${episode.clipId}.mp3`
      })
    });

    const added = await store.add("https://example.com/program/afternoon-show");
    expect(added.hostHistory).toEqual(["Prometheus Brown", "Larry Mizell, Jr."]);

    await store.checkOne(added.id);
    const updated = store.list()[0];
    expect(updated.hostHistory).toEqual(["Larry Mizell, Jr.", "Prometheus Brown"]);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
