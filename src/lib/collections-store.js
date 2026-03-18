const fs = require("node:fs");
const crypto = require("node:crypto");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeList(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[;,|]+/g)
      : [];
  const out = [];
  const seen = new Set();
  for (const entry of raw) {
    const text = normalizeText(entry);
    if (!text) {
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(text);
  }
  return out;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeEntry(input = {}) {
  const now = new Date().toISOString();
  return {
    id: normalizeText(input.id) || crypto.randomBytes(6).toString("hex"),
    type: normalizeText(input.type).toLowerCase() || "program",
    sourceType: normalizeText(input.sourceType).toLowerCase(),
    title: normalizeText(input.title),
    value: normalizeText(input.value),
    subtitle: normalizeText(input.subtitle),
    programTitle: normalizeText(input.programTitle),
    episodeTitle: normalizeText(input.episodeTitle),
    programUrl: normalizeText(input.programUrl),
    episodeUrl: normalizeText(input.episodeUrl),
    description: normalizeText(input.description),
    location: normalizeText(input.location),
    hosts: normalizeList(input.hosts),
    genres: normalizeList(input.genres),
    createdAt: normalizeText(input.createdAt) || now
  };
}

function normalizeCollection(input = {}) {
  const now = new Date().toISOString();
  return {
    id: normalizeText(input.id) || crypto.randomBytes(6).toString("hex"),
    name: normalizeText(input.name) || "Untitled Collection",
    createdAt: normalizeText(input.createdAt) || now,
    updatedAt: normalizeText(input.updatedAt) || now,
    entries: Array.isArray(input.entries) ? input.entries.map((entry) => normalizeEntry(entry)) : []
  };
}

function createCollectionsStore(filePath) {
  let cache = null;

  function load() {
    if (cache !== null) {
      return cache;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      cache = {
        collections: Array.isArray(parsed?.collections)
          ? parsed.collections.map((collection) => normalizeCollection(collection))
          : []
      };
    } catch {
      cache = { collections: [] };
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
    return cloneValue(load().collections);
  }

  function create(name) {
    const text = normalizeText(name);
    if (!text) {
      throw new Error("Collection name is required.");
    }
    const current = load();
    const duplicate = current.collections.find((collection) => collection.name.toLowerCase() === text.toLowerCase());
    if (duplicate) {
      return cloneValue(duplicate);
    }
    const collection = normalizeCollection({ name: text });
    current.collections.unshift(collection);
    save();
    return cloneValue(collection);
  }

  function remove(collectionId) {
    const current = load();
    const before = current.collections.length;
    current.collections = current.collections.filter((collection) => collection.id !== String(collectionId || ""));
    if (current.collections.length === before) {
      return false;
    }
    save();
    return true;
  }

  function addEntry(collectionId, entryInput = {}) {
    const current = load();
    const collection = current.collections.find((item) => item.id === String(collectionId || ""));
    if (!collection) {
      throw new Error("Collection not found.");
    }
    const entry = normalizeEntry(entryInput);
    const duplicateKey = [
      entry.type,
      entry.sourceType,
      entry.programUrl,
      entry.episodeUrl,
      entry.title.toLowerCase(),
      entry.value.toLowerCase()
    ].join("|");
    const existing = collection.entries.find((item) => [
      item.type,
      item.sourceType,
      item.programUrl,
      item.episodeUrl,
      String(item.title || "").toLowerCase(),
      String(item.value || "").toLowerCase()
    ].join("|") === duplicateKey);
    if (existing) {
      return cloneValue(existing);
    }
    collection.entries.unshift(entry);
    collection.updatedAt = new Date().toISOString();
    save();
    return cloneValue(entry);
  }

  function addEntries(collectionId, entriesInput = []) {
    const current = load();
    const collection = current.collections.find((item) => item.id === String(collectionId || ""));
    if (!collection) {
      throw new Error("Collection not found.");
    }
    const entries = Array.isArray(entriesInput) ? entriesInput : [];
    let addedCount = 0;
    for (const rawEntry of entries) {
      const entry = normalizeEntry(rawEntry);
      const duplicateKey = [
        entry.type,
        entry.sourceType,
        entry.programUrl,
        entry.episodeUrl,
        entry.title.toLowerCase(),
        entry.value.toLowerCase()
      ].join("|");
      const existing = collection.entries.find((item) => [
        item.type,
        item.sourceType,
        item.programUrl,
        item.episodeUrl,
        String(item.title || "").toLowerCase(),
        String(item.value || "").toLowerCase()
      ].join("|") === duplicateKey);
      if (existing) {
        continue;
      }
      collection.entries.unshift(entry);
      addedCount += 1;
    }
    if (addedCount > 0) {
      collection.updatedAt = new Date().toISOString();
      save();
    }
    return { addedCount, collection: cloneValue(collection) };
  }

  function removeEntry(collectionId, entryId) {
    const current = load();
    const collection = current.collections.find((item) => item.id === String(collectionId || ""));
    if (!collection) {
      return false;
    }
    const before = collection.entries.length;
    collection.entries = collection.entries.filter((entry) => entry.id !== String(entryId || ""));
    if (collection.entries.length === before) {
      return false;
    }
    collection.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  return {
    list,
    create,
    remove,
    addEntry,
    addEntries,
    removeEntry
  };
}

module.exports = {
  createCollectionsStore
};
