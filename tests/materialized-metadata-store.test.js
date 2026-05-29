const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  MATERIALIZED_METADATA_SCHEMA_VERSION,
  createMaterializedMetadataStore
} = require("../src/lib/materialized-metadata-store");

describe("materialized metadata store", () => {
  let tempDir;
  let filePath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kimble-materialized-"));
    filePath = path.join(tempDir, "materialized-metadata.json");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns an empty compatible snapshot by default", () => {
    const store = createMaterializedMetadataStore(filePath);
    expect(store.get()).toEqual({
      schemaVersion: 0,
      updatedAt: "",
      index: [],
      graph: {
        entities: [],
        relations: [],
        metrics: {}
      }
    });
    expect(store.isCompatible()).toBe(false);
  });

  test("persists and reloads a materialized snapshot", () => {
    const store = createMaterializedMetadataStore(filePath);
    const snapshot = {
      schemaVersion: MATERIALIZED_METADATA_SCHEMA_VERSION,
      updatedAt: "2026-03-17T12:00:00.000Z",
      index: [{ id: "doc-1", title: "Jenny Greene" }],
      graph: {
        entities: [{ id: "host:jenny-greene", name: "Jenny Greene" }],
        relations: [{ id: "rel-1", fromId: "host:jenny-greene", toId: "program:2fm" }],
        metrics: { entityCount: 1, relationCount: 1, sourceCount: 1 }
      }
    };

    store.replace(snapshot);

    const reloaded = createMaterializedMetadataStore(filePath);
    expect(reloaded.get()).toEqual(snapshot);
    expect(reloaded.isCompatible()).toBe(true);
  });
});
