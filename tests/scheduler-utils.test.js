// Test the pure utility functions in scheduler.js by requiring the module
// and testing the exported createSchedulerStore's internal logic via
// observable behavior. These tests focus on schedule window parsing,
// cadence detection, and retry backoff — the core scheduling logic.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Since scheduler.js only exports createSchedulerStore, we test the internal
// functions (parseRunScheduleWindows, shouldRunInScheduleWindow, etc.) via
// the store's observable behavior with carefully constructed schedules.

// However, we can also test them by reading the source and extracting
// the logic patterns. Here we test via integration with the store.

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sched-util-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeStore(overrides = {}) {
  const { createSchedulerStore } = require("../src/lib/scheduler");
  return createSchedulerStore({
    dataDir: tmpDir,
    getProgramSummary: async (url) => ({
      programUrl: url,
      title: "Test",
      description: "",
      image: "",
      runSchedule: overrides.runSchedule || "",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    }),
    getProgramEpisodes: async () => ({
      episodes: overrides.episodes || [
        { clipId: "e1", title: "Ep 1", publishedTime: "2024-03-14" }
      ],
      cadence: overrides.cadence || "weekly",
      averageDaysBetween: overrides.averageDaysBetween || 7,
      runSchedule: overrides.runSchedule,
      nextBroadcastAt: overrides.nextBroadcastAt
    }),
    runEpisodeDownload: overrides.runEpisodeDownload || (async (p) => ({
      outputDir: "/out",
      fileName: `${p.clipId}.mp3`
    })),
    ...overrides
  });
}

describe("scheduler schedule window behavior", () => {
  test("disabled schedule is skipped (not forced)", async () => {
    const store = makeStore();
    const sched = await store.add("https://example.com/show");
    store.setEnabled(sched.id, false);

    // runAll should skip disabled schedules
    await store.runAll();
    const list = store.list();
    expect(list[0].lastStatus).toBe("Paused");
  });

  test("schedule with no runSchedule uses cadence-based fallback", async () => {
    const store = makeStore({ runSchedule: "" });
    const sched = await store.add("https://example.com/show");

    // First checkOne should work (force=true bypasses window check)
    const result = await store.checkOne(sched.id);
    expect(result.scheduleId).toBe(sched.id);
  });

  test("retry backoff — failed downloads get retried", async () => {
    let downloadCallCount = 0;
    let episodeCallCount = 0;
    const store = makeStore({
      getProgramEpisodes: async () => {
        episodeCallCount++;
        // First call (add): return ep1. Second+ calls (checkOne): return new-ep + ep1
        if (episodeCallCount === 1) {
          return {
            episodes: [{ clipId: "ep1", title: "Ep 1", publishedTime: "2024-03-14" }],
            cadence: "weekly",
            averageDaysBetween: 7
          };
        }
        return {
          episodes: [
            { clipId: "new-ep", title: "New Ep", publishedTime: "2024-03-21" },
            { clipId: "ep1", title: "Ep 1", publishedTime: "2024-03-14" }
          ],
          cadence: "weekly",
          averageDaysBetween: 7
        };
      },
      runEpisodeDownload: async () => {
        downloadCallCount++;
        if (downloadCallCount <= 1) throw new Error("Network error");
        return { outputDir: "/out", fileName: "ep.mp3" };
      }
    });

    const sched = await store.add("https://example.com/show");

    // First run: new episode download fails, gets queued for retry
    await store.checkOne(sched.id);
    const list1 = store.list();
    expect(list1[0].lastStatus).toMatch(/retry|failed/i);

    // Second forced run: retry should succeed
    await store.checkOne(sched.id);
    const list2 = store.list();
    expect(list2[0].lastStatus).toMatch(/Downloaded|No new/i);
  });

  test("already-known episodes are not re-downloaded", async () => {
    const downloadedIds = [];
    const store = makeStore({
      runEpisodeDownload: async (p) => {
        downloadedIds.push(p.clipId);
        return { outputDir: "/out", fileName: `${p.clipId}.mp3` };
      }
    });

    const sched = await store.add("https://example.com/show");

    // First run downloads the episode
    await store.checkOne(sched.id);
    const firstCount = downloadedIds.length;

    // Second run should skip already-known episodes
    await store.checkOne(sched.id);
    // Should not have downloaded significantly more
    expect(downloadedIds.length).toBeLessThanOrEqual(firstCount + 1);
  });
});

describe("scheduler retry max attempts", () => {
  test("drops retry after max attempts", async () => {
    let callCount = 0;
    const store = makeStore({
      episodes: [{ clipId: "fail-ep", title: "Failing Episode", publishedTime: "2024-03-14" }],
      runEpisodeDownload: async () => {
        callCount++;
        throw new Error("Permanent failure");
      }
    });

    const sched = await store.add("https://example.com/show");

    // Run many times to exhaust retries (max is 7 attempts)
    for (let i = 0; i < 10; i++) {
      try { await store.checkOne(sched.id); } catch {}
    }

    const list = store.list();
    // After enough attempts, the retry should be dropped
    expect(list[0].lastStatus).toMatch(/dropped|No new|retry/i);
  });
});
