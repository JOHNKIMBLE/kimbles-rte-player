const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createSchedulerStore } = require("../src/lib/scheduler");

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scheduler-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createStore(overrides = {}) {
  return createSchedulerStore({
    dataDir: tmpDir,
    getProgramSummary: async (url) => ({
      programUrl: url,
      title: "Test Show",
      description: "A test show",
      image: "",
      runSchedule: "Monday • 10:00-12:00",
      nextBroadcastAt: "",
      nextBroadcastTitle: ""
    }),
    getProgramEpisodes: async () => ({
      episodes: [
        { clipId: "ep1", title: "Episode 1", fullTitle: "Test Show - Episode 1", publishedTime: "2024-03-14", image: "" },
        { clipId: "ep2", title: "Episode 2", fullTitle: "Test Show - Episode 2", publishedTime: "2024-03-07", image: "" }
      ],
      cadence: "weekly",
      averageDaysBetween: 7
    }),
    runEpisodeDownload: async (payload) => ({
      outputDir: "/downloads/test",
      fileName: `${payload.clipId}.mp3`,
      log: "ok"
    }),
    ...overrides
  });
}

describe("createSchedulerStore", () => {
  test("starts with empty list", () => {
    const store = createStore();
    expect(store.list()).toEqual([]);
  });

  test("add creates a schedule", async () => {
    const store = createStore();
    const schedule = await store.add("https://example.com/show");

    expect(schedule.id).toBeTruthy();
    expect(schedule.title).toBe("Test Show");
    expect(schedule.enabled).toBe(true);
    expect(schedule.cadence).toBe("weekly");

    expect(store.list()).toHaveLength(1);
  });

  test("add is idempotent for same URL", async () => {
    const store = createStore();
    await store.add("https://example.com/show");
    await store.add("https://example.com/show");

    expect(store.list()).toHaveLength(1);
  });

  test("persists to disk", async () => {
    const store = createStore();
    await store.add("https://example.com/show");

    const filePath = path.join(tmpDir, "schedules.json");
    expect(fs.existsSync(filePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Test Show");
  });

  test("loads persisted schedules on creation", async () => {
    const store1 = createStore();
    await store1.add("https://example.com/show");

    const store2 = createStore();
    expect(store2.list()).toHaveLength(1);
    expect(store2.list()[0].title).toBe("Test Show");
  });

  test("remove deletes a schedule", async () => {
    const store = createStore();
    const schedule = await store.add("https://example.com/show");
    store.remove(schedule.id);

    expect(store.list()).toHaveLength(0);
  });

  test("setEnabled toggles enabled state", async () => {
    const store = createStore();
    const schedule = await store.add("https://example.com/show");

    store.setEnabled(schedule.id, false);
    expect(store.list()[0].enabled).toBe(false);

    store.setEnabled(schedule.id, true);
    expect(store.list()[0].enabled).toBe(true);
  });

  test("setEnabled throws for unknown id", () => {
    const store = createStore();
    expect(() => store.setEnabled("nonexistent", false)).toThrow("Schedule not found");
  });

  test("checkOne throws for unknown id", async () => {
    const store = createStore();
    await expect(store.checkOne("nonexistent")).rejects.toThrow("Schedule not found");
  });

  test("checkOne force-runs a schedule and downloads new episodes", async () => {
    let downloadCalled = false;
    let episodeCallCount = 0;
    const store = createStore({
      getProgramEpisodes: async () => {
        episodeCallCount++;
        // First call (during add) returns ep1; second call (during checkOne) returns ep-new + ep1
        if (episodeCallCount === 1) {
          return {
            episodes: [{ clipId: "ep1", title: "Episode 1", publishedTime: "2024-03-14" }],
            cadence: "weekly",
            averageDaysBetween: 7
          };
        }
        return {
          episodes: [
            { clipId: "ep-new", title: "New Episode", publishedTime: "2024-03-21" },
            { clipId: "ep1", title: "Episode 1", publishedTime: "2024-03-14" }
          ],
          cadence: "weekly",
          averageDaysBetween: 7
        };
      },
      runEpisodeDownload: async (payload) => {
        downloadCalled = true;
        return { outputDir: "/out", fileName: `${payload.clipId}.mp3` };
      }
    });

    const schedule = await store.add("https://example.com/show");
    const result = await store.checkOne(schedule.id);

    expect(downloadCalled).toBe(true);
    expect(result.scheduleId).toBe(schedule.id);
  });

  test("add with backfill downloads episodes immediately", async () => {
    const downloaded = [];
    const store = createStore({
      runEpisodeDownload: async (payload) => {
        downloaded.push(payload.clipId);
        return { outputDir: "/out", fileName: `${payload.clipId}.mp3` };
      }
    });

    await store.add("https://example.com/show", { backfillCount: 2 });

    // Backfill runs async, give it time
    await new Promise((r) => setTimeout(r, 200));
    expect(downloaded.length).toBeGreaterThanOrEqual(1);
  });

  test("start and stop manage interval", () => {
    const store = createStore();
    store.start();
    // Calling start again should be safe
    store.start();
    store.stop();
    // Calling stop again should be safe
    store.stop();
  });

  test("list returns sorted by title", async () => {
    const titles = ["Zebra Show", "Alpha Show", "Middle Show"];
    let callCount = 0;
    const store = createStore({
      getProgramSummary: async (url) => ({
        programUrl: url,
        title: titles[callCount++],
        description: "",
        image: "",
        runSchedule: "",
        nextBroadcastAt: "",
        nextBroadcastTitle: ""
      })
    });

    await store.add("https://example.com/zebra");
    await store.add("https://example.com/alpha");
    await store.add("https://example.com/middle");

    const list = store.list();
    expect(list[0].title).toBe("Alpha Show");
    expect(list[1].title).toBe("Middle Show");
    expect(list[2].title).toBe("Zebra Show");
  });
});
