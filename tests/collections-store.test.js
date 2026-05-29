const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createCollectionsStore } = require("../src/lib/collections-store");

describe("collections store", () => {
  test("adds entries in batch and skips duplicates", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "collections-store-"));
    const filePath = path.join(tempDir, "collections.json");
    const store = createCollectionsStore(filePath);
    const collection = store.create("Batch Save");

    const result = store.addEntries(collection.id, [
      {
        type: "host",
        sourceType: "wwf",
        title: "Stefania Vos",
        value: "Stefania Vos",
        programUrl: "https://wwf.test/stefania-vos"
      },
      {
        type: "episode",
        sourceType: "nts",
        title: "Ambient Show w/ Host A",
        value: "Ambient Show",
        episodeUrl: "https://nts.test/ambient-show/latest"
      },
      {
        type: "host",
        sourceType: "wwf",
        title: "Stefania Vos",
        value: "Stefania Vos",
        programUrl: "https://wwf.test/stefania-vos"
      }
    ]);

    expect(result.addedCount).toBe(2);
    const savedCollection = store.list().find((item) => item.id === collection.id);
    expect(savedCollection.entries).toHaveLength(2);
    expect(savedCollection.entries.some((entry) => entry.type === "host" && entry.title === "Stefania Vos")).toBe(true);
    expect(savedCollection.entries.some((entry) => entry.type === "episode" && entry.title === "Ambient Show w/ Host A")).toBe(true);
  });

  test("creates and updates smart collections", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "collections-store-"));
    const filePath = path.join(tempDir, "collections.json");
    const store = createCollectionsStore(filePath);

    const collection = store.create({
      name: "London Hosts",
      mode: "smart",
      autoUpdate: true,
      smartCriteria: {
        query: "london",
        sourceType: "nts",
        kind: "host",
        host: "Flo Dill",
        limit: 15
      }
    });

    expect(collection.mode).toBe("smart");
    expect(collection.autoUpdate).toBe(true);
    expect(collection.smartCriteria).toEqual(expect.objectContaining({
      query: "london",
      sourceType: "nts",
      kind: "host",
      host: "Flo Dill",
      limit: 15
    }));

    store.update(collection.id, {
      autoUpdate: false,
      smartCriteria: {
        query: "breakfast",
        sourceType: "nts",
        kind: "episode",
        location: "London",
        limit: 20
      }
    });

    const savedCollection = store.list().find((item) => item.id === collection.id);
    expect(savedCollection.autoUpdate).toBe(false);
    expect(savedCollection.smartCriteria).toEqual(expect.objectContaining({
      query: "breakfast",
      sourceType: "nts",
      kind: "episode",
      location: "London",
      limit: 20
    }));
  });
});
