const fs = require("fs");
const crypto = require("crypto");

function createDownloadHistory(historyFilePath, maxEntries = 500) {
  let cache = null;

  function load() {
    if (cache !== null) return cache;
    try { cache = JSON.parse(fs.readFileSync(historyFilePath, "utf8")); }
    catch { cache = []; }
    return cache;
  }

  function save() {
    const tmp = historyFilePath + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
      fs.renameSync(tmp, historyFilePath);
    } catch {}
  }

  function append(entry) {
    load();
    cache.unshift({
      id: crypto.randomBytes(4).toString("hex"),
      savedAt: new Date().toISOString(),
      status: "downloaded",
      ...(entry || {})
    });
    if (cache.length > maxEntries) cache = cache.slice(0, maxEntries);
    save();
  }

  function list() { return load(); }

  function update(entryId, patch = {}) {
    load();
    const targetId = String(entryId || "").trim();
    if (!targetId) {
      return null;
    }
    const index = cache.findIndex((entry) => String(entry?.id || "") === targetId);
    if (index < 0) {
      return null;
    }
    cache[index] = {
      ...cache[index],
      ...(patch && typeof patch === "object" ? patch : {})
    };
    save();
    return cache[index];
  }

  function clear() { cache = []; save(); }

  return { append, list, update, clear };
}

module.exports = { createDownloadHistory };
