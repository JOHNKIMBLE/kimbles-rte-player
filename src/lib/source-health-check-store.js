const fs = require("node:fs");
const path = require("node:path");

function createSourceHealthCheckStore(filePath) {
  let cache = null;

  function load() {
    if (cache) {
      return cache;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      cache = Array.isArray(parsed?.checks) ? { checks: parsed.checks } : { checks: [] };
    } catch {
      cache = { checks: [] };
    }
    return cache;
  }

  function save() {
    const directory = path.dirname(filePath);
    const temporaryPath = `${filePath}.tmp`;
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temporaryPath, JSON.stringify(load(), null, 2), "utf8");
    fs.renameSync(temporaryPath, filePath);
  }

  function list() {
    return [...load().checks].sort((a, b) => String(a?.sourceType || "").localeCompare(String(b?.sourceType || "")));
  }

  function replace(checks) {
    cache = { checks: Array.isArray(checks) ? checks : [] };
    save();
    return list();
  }

  return { list, replace };
}

module.exports = { createSourceHealthCheckStore };
