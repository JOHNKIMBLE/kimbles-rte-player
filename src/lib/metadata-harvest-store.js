const fs = require("node:fs");

function createMetadataHarvestStore(filePath) {
  let cache = null;

  function load() {
    if (cache !== null) {
      return cache;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      cache = parsed && typeof parsed === "object"
        ? {
          updatedAt: String(parsed.updatedAt || ""),
          items: Array.isArray(parsed.items) ? parsed.items : [],
          state: parsed.state && typeof parsed.state === "object" ? parsed.state : { sources: {} }
        }
        : { updatedAt: "", items: [], state: { sources: {} } };
    } catch {
      cache = { updatedAt: "", items: [], state: { sources: {} } };
    }
    return cache;
  }

  function save() {
    const current = load();
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(current, null, 2), "utf8");
    fs.renameSync(tmpPath, filePath);
  }

  function list() {
    return load().items.slice();
  }

  function getUpdatedAt() {
    return String(load().updatedAt || "");
  }

  function getState() {
    const state = load().state;
    return state && typeof state === "object"
      ? JSON.parse(JSON.stringify(state))
      : { sources: {} };
  }

  function replace(items, updatedAt = new Date().toISOString(), state = null) {
    cache = {
      updatedAt: String(updatedAt || new Date().toISOString()),
      items: Array.isArray(items) ? items : [],
      state: state && typeof state === "object" ? state : getState()
    };
    save();
    return cache;
  }

  function patchItems(patcher) {
    const current = load();
    if (typeof patcher !== "function") {
      return 0;
    }
    let updatedCount = 0;
    current.items = (Array.isArray(current.items) ? current.items : []).map((item) => {
      const next = patcher(item);
      if (!next || typeof next !== "object") {
        return item;
      }
      updatedCount += 1;
      return {
        ...item,
        ...next
      };
    });
    if (updatedCount > 0) {
      current.updatedAt = new Date().toISOString();
      save();
    }
    return updatedCount;
  }

  return {
    list,
    getUpdatedAt,
    getState,
    replace,
    patchItems
  };
}

module.exports = {
  createMetadataHarvestStore
};
