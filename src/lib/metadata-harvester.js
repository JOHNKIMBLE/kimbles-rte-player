function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMetadataList(value) {
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

function normalizeRows(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (Array.isArray(value?.results)) {
    return value.results;
  }
  if (Array.isArray(value?.items)) {
    return value.items;
  }
  if (Array.isArray(value?.episodes)) {
    return value.episodes;
  }
  return [];
}

const DEFAULT_TERMS = ["ambient", "jazz", "electronic", "house", "dub", "experimental", "soul", "disco"];

const SOURCE_SEED_TERMS = {
  rte: ["irish", "dance", "electronic", "hip hop", "chill"],
  bbc: ["radio 1", "radio 6", "jazz", "electronic", "soul"],
  wwf: ["worldwide breakfast", "global", "jazz", "latin", "ambient"],
  nts: ["ambient", "experimental", "dub", "jazz", "drone"],
  fip: ["trance", "groove", "electro", "jazz", "soul"],
  kexp: ["indie", "electronic", "jazz", "world", "live session"]
};

const DEFAULT_SOURCE_HARVEST_CADENCE_MS = 1000 * 60 * 60 * 6;
const DEFAULT_MAX_EPISODE_PAGES = 3;
/** Retained harvest docs per `sourceType` after merge (richest + newest win). Not a global snapshot cap—the materialized index also includes subscriptions, feeds, and history. */
const DEFAULT_MAX_HARVEST_DOCS_PER_SOURCE = 400;

function tokenizePhrase(value) {
  return normalizeText(value)
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCandidate(map, value, weight) {
  const text = tokenizePhrase(value);
  if (!text || text.length < 3 || text.length > 48) {
    return;
  }
  const words = text.split(/\s+/g);
  if (words.length > 5) {
    return;
  }
  if (/^[\d\W]+$/.test(text)) {
    return;
  }
  const key = text.toLowerCase();
  map.set(key, {
    value: text,
    score: Number((map.get(key)?.score || 0) + weight)
  });
}

function deriveHarvestSearchTerms(indexDocs = [], limit = 24) {
  const scored = new Map();
  for (const doc of Array.isArray(indexDocs) ? indexDocs : []) {
    scoreCandidate(scored, doc?.title, 4);
    scoreCandidate(scored, doc?.programTitle, 4);
    scoreCandidate(scored, doc?.episodeTitle, 2);
    scoreCandidate(scored, doc?.location, 2);
    for (const host of normalizeMetadataList(doc?.hosts)) {
      scoreCandidate(scored, host, 6);
    }
    for (const host of normalizeMetadataList(doc?.latestEpisodeHosts)) {
      scoreCandidate(scored, host, 4);
    }
    for (const genre of normalizeMetadataList(doc?.genres)) {
      scoreCandidate(scored, genre, 5);
    }
    for (const genre of normalizeMetadataList(doc?.latestEpisodeGenres)) {
      scoreCandidate(scored, genre, 3);
    }
    scoreCandidate(scored, doc?.latestEpisodeTitle, 2);
    scoreCandidate(scored, doc?.latestEpisodeLocation, 2);
  }
  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map((item) => item.value);
}

function toHarvestDoc(sourceType, row, harvestedAt) {
  return {
    id: normalizeText(row?.id || row?.slug || row?.programUrl || row?.title),
    harvestKind: "program",
    sourceType: normalizeText(sourceType).toLowerCase(),
    title: normalizeText(row?.title),
    programTitle: normalizeText(row?.title),
    subtitle: normalizeText(row?.subtitle || row?.cadence || row?.runSchedule),
    description: normalizeText(row?.description),
    location: normalizeText(row?.location),
    cadence: normalizeText(row?.cadence),
    hosts: normalizeMetadataList(row?.hosts),
    genres: normalizeMetadataList(row?.genres),
    programUrl: normalizeText(row?.programUrl),
    image: normalizeText(row?.image),
    runSchedule: normalizeText(row?.runSchedule),
    nextBroadcastAt: normalizeText(row?.nextBroadcastAt),
    nextBroadcastTitle: normalizeText(row?.nextBroadcastTitle),
    latestEpisodeTitle: normalizeText(row?.latestEpisodeTitle),
    latestEpisodeDescription: normalizeText(row?.latestEpisodeDescription),
    latestEpisodeLocation: normalizeText(row?.latestEpisodeLocation),
    latestEpisodeHosts: normalizeMetadataList(row?.latestEpisodeHosts),
    latestEpisodeGenres: normalizeMetadataList(row?.latestEpisodeGenres),
    episodes: normalizeRows(row?.episodes),
    harvestedAt
  };
}

function metadataRichness(row) {
  return (
    normalizeMetadataList(row?.hosts).length * 4
    + normalizeMetadataList(row?.genres).length * 3
    + (normalizeText(row?.description) ? 2 : 0)
    + (normalizeText(row?.location) ? 2 : 0)
    + (normalizeText(row?.runSchedule) ? 1 : 0)
    + (normalizeText(row?.latestEpisodeTitle) ? 2 : 0)
    + normalizeMetadataList(row?.latestEpisodeHosts).length * 2
    + normalizeMetadataList(row?.latestEpisodeGenres).length
  );
}

function pickPreferredDoc(a, b) {
  const aRich = metadataRichness(a);
  const bRich = metadataRichness(b);
  if (bRich !== aRich) {
    return bRich > aRich ? b : a;
  }
  const aTime = Date.parse(String(a?.harvestedAt || "")) || 0;
  const bTime = Date.parse(String(b?.harvestedAt || "")) || 0;
  return bTime >= aTime ? b : a;
}

function mergeHarvestDocs(existingDocs = [], incomingDocs = [], maxPerSource = DEFAULT_MAX_HARVEST_DOCS_PER_SOURCE) {
  const mergedByKey = new Map();
  for (const doc of [...(Array.isArray(existingDocs) ? existingDocs : []), ...(Array.isArray(incomingDocs) ? incomingDocs : [])]) {
    const key = [
      normalizeText(doc?.harvestKind || "program").toLowerCase(),
      normalizeText(doc?.sourceType).toLowerCase(),
      normalizeText(doc?.programUrl),
      normalizeText(doc?.episodeUrl),
      normalizeText(doc?.title).toLowerCase()
    ].join("|");
    if (!normalizeText(doc?.title)) {
      continue;
    }
    const current = mergedByKey.get(key);
    mergedByKey.set(key, current ? pickPreferredDoc(current, doc) : doc);
  }

  const grouped = new Map();
  for (const doc of mergedByKey.values()) {
    const sourceType = normalizeText(doc?.sourceType).toLowerCase();
    const list = grouped.get(sourceType) || [];
    list.push(doc);
    grouped.set(sourceType, list);
  }

  const output = [];
  for (const list of grouped.values()) {
    list
      .sort((a, b) => {
        const richDiff = metadataRichness(b) - metadataRichness(a);
        if (richDiff !== 0) {
          return richDiff;
        }
        return (Date.parse(String(b?.harvestedAt || "")) || 0) - (Date.parse(String(a?.harvestedAt || "")) || 0);
      })
      .slice(0, maxPerSource)
      .forEach((doc) => output.push(doc));
  }
  return output;
}

function mapEpisodeMetadata(row) {
  return {
    latestEpisodeTitle: normalizeText(row?.title || row?.fullTitle),
    latestEpisodeDescription: normalizeText(row?.description),
    latestEpisodeLocation: normalizeText(row?.location),
    latestEpisodeHosts: normalizeMetadataList(row?.hosts),
    latestEpisodeGenres: normalizeMetadataList(row?.genres)
  };
}

function buildEpisodeDoc(sourceType, programDoc, episodeRow, harvestedAt) {
  const episodeTitle = normalizeText(episodeRow?.title || episodeRow?.fullTitle);
  const programTitle = normalizeText(programDoc?.title || programDoc?.programTitle);
  if (!episodeTitle || !programTitle) {
    return null;
  }
  const episodeHosts = normalizeMetadataList(episodeRow?.hosts);
  const episodeGenres = normalizeMetadataList(episodeRow?.genres);
  return {
    id: normalizeText(episodeRow?.id || episodeRow?.episodeUrl || `${programDoc?.programUrl}::${episodeTitle}`),
    harvestKind: "episode",
    sourceType,
    title: episodeTitle,
    subtitle: programTitle,
    programTitle,
    episodeTitle,
    description: normalizeText(episodeRow?.description || programDoc?.description),
    location: normalizeText(episodeRow?.location || programDoc?.location),
    cadence: normalizeText(programDoc?.cadence),
    hosts: episodeHosts.length ? episodeHosts : normalizeMetadataList(programDoc?.hosts || programDoc?.latestEpisodeHosts),
    genres: episodeGenres.length ? episodeGenres : normalizeMetadataList(programDoc?.genres || programDoc?.latestEpisodeGenres),
    programUrl: normalizeText(programDoc?.programUrl),
    episodeUrl: normalizeText(episodeRow?.episodeUrl || episodeRow?.url),
    image: normalizeText(episodeRow?.image || programDoc?.image),
    publishedTime: normalizeText(episodeRow?.publishedTime || episodeRow?.releaseDate || episodeRow?.date),
    harvestedAt
  };
}

function buildHostDocs(sourceType, programDoc, episodeRows, harvestedAt) {
  const programTitle = normalizeText(programDoc?.title || programDoc?.programTitle);
  if (!programTitle) {
    return [];
  }
  const hostMap = new Map();
  const programGenres = normalizeMetadataList(programDoc?.genres);
  const baseHosts = normalizeMetadataList([...normalizeMetadataList(programDoc?.hosts), ...normalizeMetadataList(programDoc?.latestEpisodeHosts)]);
  for (const hostName of baseHosts) {
    hostMap.set(hostName.toLowerCase(), {
      id: `${normalizeText(programDoc?.programUrl) || programTitle}::host::${hostName.toLowerCase()}`,
      harvestKind: "host",
      sourceType,
      title: hostName,
      subtitle: programTitle,
      programTitle,
      description: normalizeText(programDoc?.description || programDoc?.latestEpisodeDescription),
      location: normalizeText(programDoc?.location || programDoc?.latestEpisodeLocation),
      cadence: normalizeText(programDoc?.cadence),
      hosts: [hostName],
      genres: programGenres.slice(),
      programUrl: normalizeText(programDoc?.programUrl),
      episodeUrl: "",
      image: normalizeText(programDoc?.image),
      latestEpisodeTitle: normalizeText(programDoc?.latestEpisodeTitle),
      latestEpisodeDescription: normalizeText(programDoc?.latestEpisodeDescription),
      latestEpisodeLocation: normalizeText(programDoc?.latestEpisodeLocation),
      latestEpisodeHosts: normalizeMetadataList(programDoc?.latestEpisodeHosts),
      latestEpisodeGenres: normalizeMetadataList(programDoc?.latestEpisodeGenres),
      harvestedAt
    });
  }

  for (const row of Array.isArray(episodeRows) ? episodeRows : []) {
    const episodeHosts = normalizeMetadataList(row?.hosts);
    const episodeGenres = normalizeMetadataList(row?.genres);
    for (const hostName of episodeHosts) {
      const key = hostName.toLowerCase();
      const current = hostMap.get(key) || {
        id: `${normalizeText(programDoc?.programUrl) || programTitle}::host::${key}`,
        harvestKind: "host",
        sourceType,
        title: hostName,
        subtitle: programTitle,
        programTitle,
        description: "",
        location: "",
        cadence: normalizeText(programDoc?.cadence),
        hosts: [hostName],
        genres: [],
        programUrl: normalizeText(programDoc?.programUrl),
        episodeUrl: "",
        image: normalizeText(programDoc?.image),
        latestEpisodeTitle: "",
        latestEpisodeDescription: "",
        latestEpisodeLocation: "",
        latestEpisodeHosts: [hostName],
        latestEpisodeGenres: [],
        harvestedAt
      };
      current.description = normalizeText(current.description || row?.description || programDoc?.description);
      current.location = normalizeText(current.location || row?.location || programDoc?.location);
      current.genres = normalizeMetadataList([...normalizeMetadataList(current.genres), ...episodeGenres, ...programGenres]);
      current.image = normalizeText(current.image || row?.image || programDoc?.image);
      if (!current.latestEpisodeTitle) {
        current.latestEpisodeTitle = normalizeText(row?.title || row?.fullTitle);
        current.latestEpisodeDescription = normalizeText(row?.description);
        current.latestEpisodeLocation = normalizeText(row?.location);
        current.latestEpisodeHosts = episodeHosts.length ? episodeHosts : current.latestEpisodeHosts;
        current.latestEpisodeGenres = episodeGenres.length ? episodeGenres : current.latestEpisodeGenres;
        current.episodeUrl = normalizeText(row?.episodeUrl || row?.url);
      }
      hostMap.set(key, current);
    }
  }

  return Array.from(hostMap.values()).filter((doc) => normalizeText(doc.title));
}

function expandHarvestDocs(programDocs) {
  const docs = [];
  for (const programDoc of Array.isArray(programDocs) ? programDocs : []) {
    const episodeRows = normalizeRows(programDoc?.episodes);
    docs.push({
      ...programDoc,
      harvestKind: "program",
      programTitle: normalizeText(programDoc?.title || programDoc?.programTitle)
    });
    for (const hostDoc of buildHostDocs(programDoc.sourceType, programDoc, episodeRows, programDoc.harvestedAt)) {
      docs.push(hostDoc);
    }
    for (const episodeRow of episodeRows) {
      const episodeDoc = buildEpisodeDoc(programDoc.sourceType, programDoc, episodeRow, programDoc.harvestedAt);
      if (episodeDoc) {
        docs.push(episodeDoc);
      }
    }
  }
  return docs;
}

function mergeEpisodeRows(existingRows, incomingRows) {
  const rows = [...(Array.isArray(existingRows) ? existingRows : []), ...(Array.isArray(incomingRows) ? incomingRows : [])];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const key = [
      normalizeText(row?.episodeUrl || row?.url),
      normalizeText(row?.id),
      normalizeText(row?.title || row?.fullTitle).toLowerCase()
    ].join("|");
    if (!key.replace(/\|/g, "")) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function fetchEpisodeRows(episodeFetcher, programUrl, episodePages = 1) {
  if (typeof episodeFetcher !== "function") {
    return [];
  }
  const safePages = Math.max(1, Number(episodePages || 1) || 1);
  let merged = [];
  for (let page = 1; page <= safePages; page += 1) {
    try {
      const rows = normalizeRows(await episodeFetcher(programUrl, page));
      if (!rows.length) {
        break;
      }
      merged = mergeEpisodeRows(merged, rows);
    } catch {
      if (page === 1) {
        break;
      }
    }
  }
  return merged;
}

async function enrichDocs(docs, summaryFetcher, episodeFetcher, limit = 8, episodePages = 1) {
  if (typeof summaryFetcher !== "function" && typeof episodeFetcher !== "function") {
    return docs;
  }
  const rows = Array.isArray(docs) ? docs.slice() : [];
  const targets = rows
    .map((doc, index) => ({ doc, index }))
    .filter(({ doc }) => doc.programUrl)
    .sort((a, b) => metadataRichness(a.doc) - metadataRichness(b.doc))
    .slice(0, limit);

  for (const { doc, index } of targets) {
    try {
      const summary = typeof summaryFetcher === "function"
        ? await summaryFetcher(doc.programUrl)
        : null;
      let latestEpisode = null;
      const episodeRows = await fetchEpisodeRows(episodeFetcher, doc.programUrl, episodePages);
      latestEpisode = episodeRows[0] || null;
      rows[index] = {
        ...doc,
        title: normalizeText(summary?.title || doc.title),
        programTitle: normalizeText(summary?.title || doc.programTitle || doc.title),
        description: normalizeText(summary?.description || doc.description),
        location: normalizeText(summary?.location || doc.location),
        cadence: normalizeText(summary?.cadence || doc.cadence),
        hosts: normalizeMetadataList((summary?.hosts && summary.hosts.length) ? summary.hosts : doc.hosts),
        genres: normalizeMetadataList((summary?.genres && summary.genres.length) ? summary.genres : doc.genres),
        image: normalizeText(summary?.image || doc.image),
        runSchedule: normalizeText(summary?.runSchedule || doc.runSchedule),
        nextBroadcastAt: normalizeText(summary?.nextBroadcastAt || doc.nextBroadcastAt),
        nextBroadcastTitle: normalizeText(summary?.nextBroadcastTitle || doc.nextBroadcastTitle),
        episodes: episodeRows.length ? episodeRows : normalizeRows(doc?.episodes),
        ...mapEpisodeMetadata(latestEpisode || doc)
      };
    } catch {}
  }

  return rows;
}

function planMetadataHarvest(sources = [], priorState = {}, force = false, now = Date.now()) {
  const nextState = {
    sources: { ...(priorState?.sources && typeof priorState.sources === "object" ? priorState.sources : {}) }
  };
  const plannedSources = [];
  const dueSources = [];

  for (const source of Array.isArray(sources) ? sources : []) {
    const sourceType = normalizeText(source?.sourceType).toLowerCase();
    if (!sourceType) {
      continue;
    }
    const current = nextState.sources[sourceType] && typeof nextState.sources[sourceType] === "object"
      ? { ...nextState.sources[sourceType] }
      : {};
    const cadenceMs = Math.max(1000 * 60 * 15, Number(source?.harvestCadenceMs || current.harvestCadenceMs || DEFAULT_SOURCE_HARVEST_CADENCE_MS) || DEFAULT_SOURCE_HARVEST_CADENCE_MS);
    const maxEpisodePages = Math.max(1, Number(source?.maxEpisodePages || current.maxEpisodePages || DEFAULT_MAX_EPISODE_PAGES) || DEFAULT_MAX_EPISODE_PAGES);
    const lastRunMs = current.lastRunAt ? Date.parse(String(current.lastRunAt)) : NaN;
    const due = force || !Number.isFinite(lastRunMs) || (now - lastRunMs) >= cadenceMs;
    const nextEpisodePages = Math.max(1, Math.min(maxEpisodePages, Number(current.nextEpisodePages || 1) || 1));

    if (due) {
      const episodePages = force ? maxEpisodePages : nextEpisodePages;
      plannedSources.push({
        ...source,
        episodePages
      });
      dueSources.push(sourceType);
      nextState.sources[sourceType] = {
        ...current,
        lastRunAt: new Date(now).toISOString(),
        nextEpisodePages: episodePages >= maxEpisodePages ? 1 : episodePages + 1,
        lastEpisodePages: episodePages,
        harvestCadenceMs: cadenceMs,
        maxEpisodePages,
        nextDueAt: new Date(now + cadenceMs).toISOString()
      };
    } else {
      nextState.sources[sourceType] = {
        ...current,
        harvestCadenceMs: cadenceMs,
        maxEpisodePages,
        nextDueAt: new Date((lastRunMs || now) + cadenceMs).toISOString()
      };
    }
  }

  return {
    plannedSources,
    nextState,
    dueSources
  };
}

async function harvestMetadataDocs({ sources = [], searchTerms = [] } = {}) {
  const harvestedAt = new Date().toISOString();
  const allDocs = [];
  const baseTerms = Array.isArray(searchTerms) && searchTerms.length ? searchTerms : [];

  for (const source of Array.isArray(sources) ? sources : []) {
    const sourceType = normalizeText(source?.sourceType).toLowerCase();
    if (!sourceType) {
      continue;
    }
    const rows = [];
    if (typeof source.getDiscovery === "function") {
      const discoveryPasses = Math.max(1, Math.min(4, Number(source.discoveryPasses || 2) || 2));
      for (let index = 0; index < discoveryPasses; index += 1) {
        try {
          rows.push(...normalizeRows(await source.getDiscovery()).map((row) => toHarvestDoc(sourceType, row, harvestedAt)));
        } catch {}
      }
    }
    if (typeof source.search === "function") {
      const termSet = new Set([
        ...DEFAULT_TERMS,
        ...(Array.isArray(SOURCE_SEED_TERMS[sourceType]) ? SOURCE_SEED_TERMS[sourceType] : []),
        ...baseTerms
      ].map((term) => tokenizePhrase(term)).filter(Boolean));
      for (const term of termSet) {
        try {
          const results = normalizeRows(await source.search(term))
            .slice(0, Number(source.perSearchLimit || 6))
            .map((row) => toHarvestDoc(sourceType, row, harvestedAt));
          rows.push(...results);
        } catch {}
      }
    }
    const deduped = [];
    const seen = new Set();
    for (const row of rows) {
      const key = [row.sourceType, row.programUrl, row.title.toLowerCase()].join("|");
      if (!row.title || seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(row);
    }
    const enriched = await enrichDocs(
      deduped,
      source.getSummary,
      source.getEpisodes,
      Number(source.summaryLimit || 8),
      Number(source.episodePages || 1)
    );
    allDocs.push(...expandHarvestDocs(enriched));
  }

  return allDocs;
}

module.exports = {
  DEFAULT_TERMS,
  DEFAULT_SOURCE_HARVEST_CADENCE_MS,
  DEFAULT_MAX_HARVEST_DOCS_PER_SOURCE,
  deriveHarvestSearchTerms,
  harvestMetadataDocs,
  mergeHarvestDocs,
  planMetadataHarvest
};
