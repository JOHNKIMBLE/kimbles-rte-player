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
    cache.unshift({ id: crypto.randomBytes(4).toString("hex"), savedAt: new Date().toISOString(), ...entry });
    if (cache.length > maxEntries) cache = cache.slice(0, maxEntries);
    save();
  }

  function list() { return load(); }

  function clear() { cache = []; save(); }

  return { append, list, clear };
}

module.exports = { createDownloadHistory };
