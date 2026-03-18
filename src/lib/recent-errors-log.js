const fs = require("fs");
const crypto = require("crypto");

function createRecentErrorsLog(filePath, maxEntries = 50) {
  let cache = null;

  function load() {
    if (cache !== null) return cache;
    try {
      cache = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      cache = [];
    }
    return cache;
  }

  function save() {
    const tmp = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf8");
      fs.renameSync(tmp, filePath);
    } catch {}
  }

  function append(entry) {
    load();
    cache.unshift({
      id: crypto.randomBytes(4).toString("hex"),
      savedAt: new Date().toISOString(),
      ...(entry || {})
    });
    if (cache.length > maxEntries) {
      cache = cache.slice(0, maxEntries);
    }
    save();
  }

  function list() {
    return load();
  }

  return { append, list };
}

module.exports = {
  createRecentErrorsLog
};
