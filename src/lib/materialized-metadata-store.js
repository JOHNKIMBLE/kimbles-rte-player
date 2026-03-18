const fs = require("node:fs");

const MATERIALIZED_METADATA_SCHEMA_VERSION = 1;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSnapshot(input) {
  const snapshot = input && typeof input === "object" ? input : {};
  const graph = snapshot.graph && typeof snapshot.graph === "object" ? snapshot.graph : {};
  return {
    schemaVersion: Number(snapshot.schemaVersion || 0) || 0,
    updatedAt: String(snapshot.updatedAt || ""),
    index: Array.isArray(snapshot.index) ? snapshot.index : [],
    graph: {
      entities: Array.isArray(graph.entities) ? graph.entities : [],
      relations: Array.isArray(graph.relations) ? graph.relations : [],
      metrics: graph.metrics && typeof graph.metrics === "object" ? graph.metrics : {}
    }
  };
}

function createMaterializedMetadataStore(filePath) {
  let cache = null;

  function load() {
    if (cache !== null) {
      return cache;
    }
    try {
      cache = normalizeSnapshot(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch {
      cache = normalizeSnapshot({});
    }
    return cache;
  }

  function save() {
    const current = load();
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(current, null, 2), "utf8");
    fs.renameSync(tmpPath, filePath);
  }

  function get() {
    return cloneValue(load());
  }

  function replace(snapshot) {
    cache = normalizeSnapshot(snapshot);
    save();
    return get();
  }

  function isCompatible(snapshot = null) {
    const current = snapshot ? normalizeSnapshot(snapshot) : load();
    return Number(current.schemaVersion || 0) === MATERIALIZED_METADATA_SCHEMA_VERSION;
  }

  return {
    get,
    replace,
    isCompatible
  };
}

module.exports = {
  MATERIALIZED_METADATA_SCHEMA_VERSION,
  createMaterializedMetadataStore
};
