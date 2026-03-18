const fs = require("node:fs");
const crypto = require("node:crypto");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeRepairRule(input = {}) {
  return {
    id: normalizeText(input.id) || crypto.randomBytes(6).toString("hex"),
    field: ["host", "genre", "location", "program", "episode"].includes(normalizeText(input.field).toLowerCase())
      ? normalizeText(input.field).toLowerCase()
      : "host",
    sourceType: normalizeText(input.sourceType).toLowerCase(),
    from: normalizeText(input.from),
    to: normalizeText(input.to),
    createdAt: normalizeText(input.createdAt) || new Date().toISOString()
  };
}

function createMetadataRepairStore(filePath) {
  let cache = null;

  function load() {
    if (cache !== null) {
      return cache;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      cache = {
        rules: Array.isArray(parsed?.rules) ? parsed.rules.map((rule) => normalizeRepairRule(rule)) : []
      };
    } catch {
      cache = { rules: [] };
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
    return JSON.parse(JSON.stringify(load().rules));
  }

  function add(input = {}) {
    const rule = normalizeRepairRule(input);
    if (!rule.from || !rule.to) {
      throw new Error("Repair rule must include both From and To values.");
    }
    const current = load();
    const duplicate = current.rules.find((item) =>
      item.field === rule.field
      && item.sourceType === rule.sourceType
      && item.from.toLowerCase() === rule.from.toLowerCase()
      && item.to.toLowerCase() === rule.to.toLowerCase()
    );
    if (duplicate) {
      return JSON.parse(JSON.stringify(duplicate));
    }
    current.rules.unshift(rule);
    save();
    return JSON.parse(JSON.stringify(rule));
  }

  function remove(ruleId) {
    const current = load();
    const before = current.rules.length;
    current.rules = current.rules.filter((rule) => rule.id !== normalizeText(ruleId));
    if (current.rules.length === before) {
      return false;
    }
    save();
    return true;
  }

  return {
    list,
    add,
    remove
  };
}

module.exports = {
  createMetadataRepairStore
};
