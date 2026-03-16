const { createDownloadQueue } = require("../src/lib/download-queue");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createDownloadQueue", () => {
  test("returns queue API", () => {
    const queue = createDownloadQueue(() => 2);
    expect(queue).toHaveProperty("run");
    expect(queue).toHaveProperty("pause");
    expect(queue).toHaveProperty("resume");
    expect(queue).toHaveProperty("cancel");
    expect(queue).toHaveProperty("clearPending");
    expect(queue).toHaveProperty("snapshot");
    expect(queue).toHaveProperty("onChange");
    expect(queue).toHaveProperty("stats");
  });

  test("runs a task and resolves", async () => {
    const queue = createDownloadQueue(() => 1);
    const result = await queue.run(
      () => ({ outputDir: "/out", fileName: "test.mp3", log: "ok" }),
      { label: "Test Download", sourceType: "rte" }
    );
    expect(result.outputDir).toBe("/out");
    expect(result.fileName).toBe("test.mp3");
  });

  test("task appears in recent after completion", async () => {
    const queue = createDownloadQueue(() => 1);
    await queue.run(() => ({ outputDir: "/out", fileName: "test.mp3" }), { label: "Test" });
    // .finally() runs asynchronously — wait a tick for history to populate
    await new Promise((r) => setTimeout(r, 10));
    const snap = queue.snapshot();
    expect(snap.recent.length).toBeGreaterThanOrEqual(1);
    expect(snap.recent[0].label).toBe("Test");
    expect(snap.recent[0].status).toBe("done");
  });

  test("stats reports correct counts", async () => {
    const queue = createDownloadQueue(() => 1);
    const stats = queue.stats();
    expect(stats.active).toBe(0);
    expect(stats.queued).toBe(0);
    expect(stats.maxConcurrent).toBe(1);
    expect(stats.paused).toBe(false);
  });

  test("respects concurrency limit", async () => {
    const queue = createDownloadQueue(() => 1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = () => new Promise((resolve) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      setTimeout(() => { concurrent--; resolve({}); }, 20);
    });

    await Promise.all([
      queue.run(task, { label: "A" }),
      queue.run(task, { label: "B" }),
      queue.run(task, { label: "C" })
    ]);

    expect(maxConcurrent).toBe(1);
  });

  test("allows higher concurrency", async () => {
    const queue = createDownloadQueue(() => 3);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = () => new Promise((resolve) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      setTimeout(() => { concurrent--; resolve({}); }, 30);
    });

    await Promise.all([
      queue.run(task, { label: "A" }),
      queue.run(task, { label: "B" }),
      queue.run(task, { label: "C" })
    ]);

    expect(maxConcurrent).toBeGreaterThan(1);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  test("clamps concurrency between 1 and 8", () => {
    const queueLow = createDownloadQueue(() => -5);
    expect(queueLow.stats().maxConcurrent).toBe(1);

    const queueHigh = createDownloadQueue(() => 100);
    expect(queueHigh.stats().maxConcurrent).toBe(8);
  });

  test("handles NaN concurrency as 1", () => {
    const queue = createDownloadQueue(() => NaN);
    expect(queue.stats().maxConcurrent).toBe(1);
  });

  test("pause stops new tasks from starting", async () => {
    const queue = createDownloadQueue(() => 1);
    let started = false;

    queue.pause();
    const promise = queue.run(() => { started = true; return {}; }, { label: "Paused" });

    await delay(50);
    expect(started).toBe(false);
    expect(queue.stats().paused).toBe(true);

    queue.resume();
    await promise;
    expect(started).toBe(true);
  });

  test("cancel removes pending task", async () => {
    const queue = createDownloadQueue(() => 1);
    queue.pause();

    const promise = queue.run(() => ({}), { label: "Will Cancel" });
    const snap = queue.snapshot();
    expect(snap.queuedCount).toBe(1);

    const taskId = snap.queued[0].id;
    const cancelled = queue.cancel(taskId);
    expect(cancelled).toBe(true);

    await expect(promise).rejects.toThrow("Cancelled");
    expect(queue.snapshot().queuedCount).toBe(0);
  });

  test("cancel returns false for unknown id", () => {
    const queue = createDownloadQueue(() => 1);
    expect(queue.cancel("nonexistent")).toBe(false);
    expect(queue.cancel("")).toBe(false);
  });

  test("clearPending cancels all queued tasks", async () => {
    const queue = createDownloadQueue(() => 1);
    queue.pause();

    const promises = [
      queue.run(() => ({}), { label: "A" }),
      queue.run(() => ({}), { label: "B" }),
      queue.run(() => ({}), { label: "C" })
    ];

    expect(queue.snapshot().queuedCount).toBe(3);
    queue.clearPending();
    expect(queue.snapshot().queuedCount).toBe(0);

    for (const p of promises) {
      await expect(p).rejects.toThrow("Cancelled");
    }
  });

  test("onChange fires on task events", async () => {
    const queue = createDownloadQueue(() => 1);
    const snapshots = [];
    const unsub = queue.onChange((snap) => snapshots.push(snap));

    // Initial snapshot from onChange registration
    expect(snapshots.length).toBe(1);

    await queue.run(() => ({}), { label: "Test" });

    // Should have received multiple snapshots (queued, running, done)
    expect(snapshots.length).toBeGreaterThan(1);

    unsub();
    const countBefore = snapshots.length;
    await queue.run(() => ({}), { label: "After unsub" });
    // No more snapshots after unsubscribe
    expect(snapshots.length).toBe(countBefore);
  });

  test("failed task appears in recent with failed status", async () => {
    const queue = createDownloadQueue(() => 1);
    await expect(
      queue.run(() => { throw new Error("oops"); }, { label: "Fail" })
    ).rejects.toThrow("oops");

    const snap = queue.snapshot();
    expect(snap.recent[0].status).toBe("failed");
    expect(snap.recent[0].message).toBe("oops");
  });

  test("history capped at 40 items", async () => {
    const queue = createDownloadQueue(() => 8);
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(queue.run(() => ({}), { label: `Task ${i}` }));
    }
    await Promise.all(promises);

    const snap = queue.snapshot();
    // snapshot.recent is capped at 20, history internally at 40
    expect(snap.recent.length).toBeLessThanOrEqual(20);
  });
});
