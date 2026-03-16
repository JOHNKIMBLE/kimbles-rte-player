const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function createDiskCache(cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });

  function filePath(key) {
    const hash = crypto.createHash("sha256").update(String(key)).digest("hex");
    return path.join(cacheDir, `${hash}.json`);
  }

  function get(key, ttlMs = 0) {
    try {
      const raw = fs.readFileSync(filePath(key), "utf8");
      const obj = JSON.parse(raw);
      if (ttlMs > 0 && Date.now() - new Date(obj.savedAt).getTime() > ttlMs) return null;
      return obj.value;
    } catch { return null; }
  }

  function set(key, value) {
    const tmp = filePath(key) + ".tmp";
    try {
      fs.writeFileSync(tmp, JSON.stringify({ key, savedAt: new Date().toISOString(), value }));
      fs.renameSync(tmp, filePath(key));
    } catch {}
  }

  function del(key) {
    try { fs.unlinkSync(filePath(key)); } catch {}
  }

  return { get, set, delete: del };
}

module.exports = { createDiskCache };
