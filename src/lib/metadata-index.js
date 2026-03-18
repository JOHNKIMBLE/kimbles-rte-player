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

function buildSearchText(parts) {
  return (Array.isArray(parts) ? parts : [])
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueStrings(values) {
  return normalizeMetadataList(values);
}

function matchesOptionalFilter(value, expected) {
  const actual = normalizeText(value).toLowerCase();
  const wanted = normalizeText(expected).toLowerCase();
  if (!wanted) {
    return true;
  }
  return actual === wanted;
}

function matchesListFilter(values, expected) {
  const wanted = normalizeText(expected).toLowerCase();
  if (!wanted) {
    return true;
  }
  return normalizeMetadataList(values).some((value) => normalizeText(value).toLowerCase() === wanted);
}

function applyMetadataRepairRules(index, repairRules = []) {
  const docs = Array.isArray(index) ? index : [];
  const rules = (Array.isArray(repairRules) ? repairRules : [])
    .map((rule) => ({
      field: normalizeText(rule?.field).toLowerCase(),
      sourceType: normalizeText(rule?.sourceType).toLowerCase(),
      from: normalizeText(rule?.from),
      to: normalizeText(rule?.to)
    }))
    .filter((rule) => rule.field && rule.from && rule.to);

  if (!rules.length) {
    return docs.slice();
  }

  function replaceText(value, rule) {
    const text = normalizeText(value);
    return text && text.toLowerCase() === rule.from.toLowerCase() ? rule.to : text;
  }

  function applyList(values, rule) {
    return uniqueStrings((Array.isArray(values) ? values : []).map((value) => replaceText(value, rule)));
  }

  return docs.map((doc) => {
    const sourceType = normalizeText(doc?.sourceType).toLowerCase();
    const matchingRules = rules.filter((rule) => !rule.sourceType || rule.sourceType === sourceType);
    if (!matchingRules.length) {
      return { ...doc };
    }
    const next = { ...doc };
    for (const rule of matchingRules) {
      if (rule.field === "program") {
        next.title = replaceText(next.title, rule);
        next.programTitle = replaceText(next.programTitle, rule);
        next.subtitle = replaceText(next.subtitle, rule);
      } else if (rule.field === "episode") {
        next.title = replaceText(next.title, rule);
        next.episodeTitle = replaceText(next.episodeTitle, rule);
        next.latestEpisodeTitle = replaceText(next.latestEpisodeTitle, rule);
      } else if (rule.field === "location") {
        next.location = replaceText(next.location, rule);
        next.latestEpisodeLocation = replaceText(next.latestEpisodeLocation, rule);
      } else if (rule.field === "host") {
        next.hosts = applyList(next.hosts, rule);
        next.latestEpisodeHosts = applyList(next.latestEpisodeHosts, rule);
      } else if (rule.field === "genre") {
        next.genres = applyList(next.genres, rule);
        next.latestEpisodeGenres = applyList(next.latestEpisodeGenres, rule);
      }
    }
    next.searchText = buildSearchText([
      next.title,
      next.subtitle,
      next.programTitle,
      next.episodeTitle,
      next.description,
      next.location,
      next.cadence,
      next.runSchedule,
      next.nextBroadcastAt,
      next.nextBroadcastTitle,
      next.latestEpisodeTitle,
      next.latestEpisodeDescription,
      next.latestEpisodeLocation,
      ...uniqueStrings(next.hosts),
      ...uniqueStrings(next.genres),
      ...uniqueStrings(next.latestEpisodeHosts),
      ...uniqueStrings(next.latestEpisodeGenres)
    ]);
    return next;
  });
}

function toKindLabel(kind) {
  const safe = normalizeText(kind).toLowerCase();
  if (safe === "subscription") return "Subscription";
  if (safe === "feed") return "Feed";
  if (safe === "history") return "History";
  if (safe === "discovery") return "Discovery";
  if (safe === "host") return "Host";
  if (safe === "episode") return "Episode";
  return "Item";
}

function mapHarvestKind(kind) {
  const safe = normalizeText(kind).toLowerCase();
  if (safe === "host") return "host";
  if (safe === "episode") return "episode";
  return "discovery";
}

function scoreField(text, tokens, weight) {
  const haystack = normalizeText(text).toLowerCase();
  if (!haystack) {
    return 0;
  }
  let score = 0;
  for (const token of tokens) {
    if (!token) {
      continue;
    }
    if (haystack === token) {
      score += weight * 6;
    } else if (haystack.startsWith(token)) {
      score += weight * 4;
    } else if (haystack.includes(token)) {
      score += weight * 2;
    }
  }
  return score;
}

function computeScore(doc, tokens) {
  if (!tokens.length) {
    return 0;
  }
  const hosts = normalizeMetadataList(doc.hosts);
  const genres = normalizeMetadataList(doc.genres);
  const latestHosts = normalizeMetadataList(doc.latestEpisodeHosts);
  const latestGenres = normalizeMetadataList(doc.latestEpisodeGenres);
  const parts = [
    [doc.title, 8],
    [doc.programTitle, 7],
    [doc.episodeTitle, 7],
    [doc.subtitle, 5],
    [doc.description, 3],
    [doc.location, 3],
    [doc.cadence, 3],
    [doc.runSchedule, 2],
    [doc.nextBroadcastTitle, 2],
    [doc.latestEpisodeTitle, 3],
    [doc.latestEpisodeDescription, 2],
    [doc.latestEpisodeLocation, 2]
  ];
  let score = 0;
  for (const [text, weight] of parts) {
    score += scoreField(text, tokens, weight);
  }
  for (const host of hosts) {
    score += scoreField(host, tokens, 5);
  }
  for (const genre of genres) {
    score += scoreField(genre, tokens, 4);
  }
  for (const host of latestHosts) {
    score += scoreField(host, tokens, 3);
  }
  for (const genre of latestGenres) {
    score += scoreField(genre, tokens, 2);
  }
  return score;
}

function metadataRichness(doc) {
  return (
    uniqueStrings(doc.hosts).length * 4
    + uniqueStrings(doc.genres).length * 3
    + (normalizeText(doc.location) ? 3 : 0)
    + (normalizeText(doc.description) ? 2 : 0)
    + (normalizeText(doc.cadence) ? 2 : 0)
    + (normalizeText(doc.latestEpisodeTitle) ? 2 : 0)
    + (normalizeText(doc.runSchedule) ? 2 : 0)
    + (normalizeText(doc.nextBroadcastAt) ? 1 : 0)
  );
}

function getDocumentTimestamp(doc) {
  const raw = normalizeText(doc.updatedAt || doc.savedAt || doc.nextBroadcastAt);
  const value = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(value) ? value : 0;
}

function buildFacets(rows, limit = 8) {
  const docs = Array.isArray(rows) ? rows : [];
  const groups = {
    hosts: new Map(),
    genres: new Map(),
    locations: new Map()
  };

  function addFacet(groupName, value) {
    const text = normalizeText(value);
    if (!text) {
      return;
    }
    const key = text.toLowerCase();
    const current = groups[groupName].get(key) || { value: text, count: 0 };
    current.count += 1;
    groups[groupName].set(key, current);
  }

  for (const doc of docs) {
    for (const host of uniqueStrings([...uniqueStrings(doc.hosts), ...uniqueStrings(doc.latestEpisodeHosts)])) {
      addFacet("hosts", host);
    }
    for (const genre of uniqueStrings([...uniqueStrings(doc.genres), ...uniqueStrings(doc.latestEpisodeGenres)])) {
      addFacet("genres", genre);
    }
    addFacet("locations", doc.location);
    addFacet("locations", doc.latestEpisodeLocation);
  }

  return {
    hosts: Array.from(groups.hosts.values()).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, limit),
    genres: Array.from(groups.genres.values()).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, limit),
    locations: Array.from(groups.locations.values()).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, limit)
  };
}

function dedupeDiscoveryDocs(rows) {
  const seen = new Set();
  const out = [];
  for (const doc of Array.isArray(rows) ? rows : []) {
    const key = [
      normalizeText(doc.kind).toLowerCase(),
      normalizeText(doc.sourceType).toLowerCase(),
      normalizeText(doc.programUrl),
      normalizeText(doc.episodeUrl),
      normalizeText(doc.title).toLowerCase(),
      normalizeText(doc.programTitle).toLowerCase()
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(doc);
  }
  return out;
}

function discoverMetadataIndex(index, options = {}) {
  const docs = Array.isArray(index) ? index : buildMetadataIndex(index);
  const sourceType = normalizeText(options.sourceType).toLowerCase();
  const kind = normalizeText(options.kind).toLowerCase();
  const query = normalizeText(options.query).toLowerCase();
  const limit = Math.max(1, Math.min(50, Number(options.limit || 12) || 12));
  const tokens = query.split(/\s+/g).map((token) => token.trim()).filter(Boolean);

  let rows = docs.filter((doc) => doc.kind !== "history");
  if (sourceType) {
    rows = rows.filter((doc) => doc.sourceType === sourceType);
  }
  if (kind) {
    rows = rows.filter((doc) => doc.kind === kind);
  }
  rows = dedupeDiscoveryDocs(rows)
    .map((doc) => ({
      ...doc,
      discoverScore: metadataRichness(doc) + (tokens.length ? computeScore(doc, tokens) : 0),
      discoverTime: getDocumentTimestamp(doc)
    }))
    .filter((doc) => doc.discoverScore > 0 || !tokens.length)
    .sort((a, b) => {
      if (b.discoverScore !== a.discoverScore) {
        return b.discoverScore - a.discoverScore;
      }
      return b.discoverTime - a.discoverTime;
    });

  const picked = [];
  const seenHosts = new Set();
  const seenGenres = new Set();
  const seenSources = new Set();

  for (const doc of rows) {
    const hosts = uniqueStrings(doc.hosts.length ? doc.hosts : doc.latestEpisodeHosts);
    const genres = uniqueStrings(doc.genres.length ? doc.genres : doc.latestEpisodeGenres);
    const source = normalizeText(doc.sourceType).toLowerCase();
    const hostNovelty = hosts.some((host) => !seenHosts.has(host.toLowerCase()));
    const genreNovelty = genres.some((genre) => !seenGenres.has(genre.toLowerCase()));
    const sourceNovelty = source && !seenSources.has(source);
    if (picked.length < limit / 2 || hostNovelty || genreNovelty || sourceNovelty) {
      picked.push(doc);
      for (const host of hosts) seenHosts.add(host.toLowerCase());
      for (const genre of genres) seenGenres.add(genre.toLowerCase());
      if (source) seenSources.add(source);
    }
    if (picked.length >= limit) {
      break;
    }
  }

  const results = picked.slice(0, limit);
  return {
    query,
    sourceType,
    kind,
    totalCandidates: rows.length,
    results,
    facets: buildFacets(rows)
  };
}

function buildCollectionRecommendationTerms(collection) {
  const entries = Array.isArray(collection?.entries) ? collection.entries : [];
  const weights = new Map();

  function addTerms(values, weight) {
    for (const value of Array.isArray(values) ? values : []) {
      const text = normalizeText(value);
      if (!text) {
        continue;
      }
      const key = text.toLowerCase();
      const current = weights.get(key) || { value: text, weight: 0 };
      current.weight += weight;
      weights.set(key, current);
    }
  }

  for (const entry of entries) {
    addTerms(normalizeMetadataList(entry.hosts), 7);
    addTerms(normalizeMetadataList(entry.genres), 6);
    addTerms([entry.location], 5);
    addTerms([entry.cadence, entry.runSchedule], 5);
    addTerms([entry.title, entry.value, entry.programTitle, entry.episodeTitle], 4);
    addTerms([entry.subtitle, entry.description], 2);
  }

  return Array.from(weights.values())
    .sort((a, b) => b.weight - a.weight || a.value.localeCompare(b.value))
    .map((row) => row.value);
}

function buildCollectionRecommendations(index, collection, options = {}) {
  const docs = Array.isArray(index) ? index : buildMetadataIndex(index);
  const entries = Array.isArray(collection?.entries) ? collection.entries : [];
  const sourceType = normalizeText(options.sourceType).toLowerCase();
  const limit = Math.max(1, Math.min(50, Number(options.limit || 12) || 12));
  const queryOverride = normalizeText(options.query);
  const terms = buildCollectionRecommendationTerms(collection);
  const query = queryOverride || terms.slice(0, 6).join(" ");
  const savedKeys = new Set(entries.map((entry) => [
    normalizeText(entry.sourceType).toLowerCase(),
    normalizeText(entry.programUrl),
    normalizeText(entry.episodeUrl),
    normalizeText(entry.title).toLowerCase(),
    normalizeText(entry.value).toLowerCase()
  ].join("|")));
  const savedTitleKeys = new Set(entries.flatMap((entry) => {
    const source = normalizeText(entry.sourceType).toLowerCase();
    const values = [entry.title, entry.value, entry.programTitle];
    return values
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean)
      .map((value) => `${source}|${value}`);
  }));

  const discovery = discoverMetadataIndex(docs, {
    sourceType,
    query,
    limit: Math.max(limit * 3, 18)
  });
  const search = searchMetadataIndex(docs, {
    sourceType,
    query,
    limit: Math.max(limit * 3, 18)
  });

  const merged = [];
  const seen = new Set();
  const queryTokens = query.toLowerCase().split(/\s+/g).map((token) => token.trim()).filter(Boolean);

  function getRecommendationKindBoost(kind) {
    const safe = normalizeText(kind).toLowerCase();
    if (safe === "host") return 20;
    if (safe === "episode") return 18;
    if (safe === "discovery") return 12;
    if (safe === "feed") return 8;
    if (safe === "subscription") return 6;
    return 4;
  }

  function computeRecommendationScore(row) {
    const hostOverlap = normalizeMetadataList(row.hosts).filter((host) => terms.some((term) => normalizeText(term).toLowerCase() === normalizeText(host).toLowerCase())).length;
    const genreOverlap = normalizeMetadataList(row.genres).filter((genre) => terms.some((term) => normalizeText(term).toLowerCase() === normalizeText(genre).toLowerCase())).length;
    const queryScore = queryTokens.length ? computeScore(row, queryTokens) : 0;
    return metadataRichness(row) + getRecommendationKindBoost(row.kind) + queryScore + (hostOverlap * 10) + (genreOverlap * 8);
  }

  function pushRows(rows) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const rowKey = [
        normalizeText(row.sourceType).toLowerCase(),
        normalizeText(row.programUrl),
        normalizeText(row.episodeUrl),
        normalizeText(row.title).toLowerCase(),
        normalizeText(row.programTitle).toLowerCase()
      ].join("|");
      const titleKey = `${normalizeText(row.sourceType).toLowerCase()}|${normalizeText(row.title || row.programTitle).toLowerCase()}`;
      if (savedKeys.has(rowKey) || savedTitleKeys.has(titleKey) || seen.has(rowKey)) {
        continue;
      }
      seen.add(rowKey);
      merged.push({
        ...row,
        recommendationScore: computeRecommendationScore(row)
      });
    }
  }

  pushRows(discovery.results);
  pushRows(search.results);

  const results = merged
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return getDocumentTimestamp(b) - getDocumentTimestamp(a);
    })
    .slice(0, limit);
  return {
    collectionId: normalizeText(collection?.id),
    collectionName: normalizeText(collection?.name),
    query,
    sourceType,
    terms: terms.slice(0, 16),
    totalCandidates: merged.length,
    results,
    facets: buildFacets(merged)
  };
}

function createMetadataDocCollector() {
  const docs = [];
  const seen = new Set();

  function pushDoc(input) {
    const doc = {
      id: normalizeText(input.id),
      kind: normalizeText(input.kind).toLowerCase(),
      kindLabel: toKindLabel(input.kind),
      sourceType: normalizeText(input.sourceType).toLowerCase(),
      title: normalizeText(input.title),
      subtitle: normalizeText(input.subtitle),
      programTitle: normalizeText(input.programTitle),
      episodeTitle: normalizeText(input.episodeTitle),
      description: normalizeText(input.description),
      location: normalizeText(input.location),
      cadence: normalizeText(input.cadence),
      hosts: normalizeMetadataList(input.hosts),
      genres: normalizeMetadataList(input.genres),
      runSchedule: normalizeText(input.runSchedule),
      nextBroadcastAt: normalizeText(input.nextBroadcastAt),
      nextBroadcastTitle: normalizeText(input.nextBroadcastTitle),
      latestEpisodeTitle: normalizeText(input.latestEpisodeTitle),
      latestEpisodeDescription: normalizeText(input.latestEpisodeDescription),
      latestEpisodeLocation: normalizeText(input.latestEpisodeLocation),
      latestEpisodeHosts: normalizeMetadataList(input.latestEpisodeHosts),
      latestEpisodeGenres: normalizeMetadataList(input.latestEpisodeGenres),
      programUrl: normalizeText(input.programUrl),
      episodeUrl: normalizeText(input.episodeUrl),
      filePath: normalizeText(input.filePath),
      outputDir: normalizeText(input.outputDir),
      fileName: normalizeText(input.fileName),
      updatedAt: normalizeText(input.updatedAt),
      savedAt: normalizeText(input.savedAt),
      status: normalizeText(input.status)
    };
    const key = [
      doc.kind,
      doc.sourceType,
      doc.programUrl,
      doc.episodeUrl,
      doc.filePath,
      doc.id,
      doc.title
    ].join("|");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    doc.searchText = buildSearchText([
      doc.title,
      doc.subtitle,
      doc.programTitle,
      doc.episodeTitle,
      doc.description,
      doc.location,
      doc.cadence,
      doc.runSchedule,
      doc.nextBroadcastAt,
      doc.nextBroadcastTitle,
      doc.latestEpisodeTitle,
      doc.latestEpisodeDescription,
      doc.latestEpisodeLocation,
      ...doc.hosts,
      ...doc.genres,
      ...doc.latestEpisodeHosts,
      ...doc.latestEpisodeGenres
    ]);
    docs.push(doc);
  }

  return {
    docs,
    pushDoc
  };
}

function buildScheduleMetadataDocs(schedulesBySource = {}) {
  const { docs, pushDoc } = createMetadataDocCollector();
  for (const [sourceType, rows] of Object.entries(schedulesBySource || {})) {
    for (const row of Array.isArray(rows) ? rows : []) {
      pushDoc({
        id: row.id,
        kind: "subscription",
        sourceType,
        title: row.title,
        subtitle: row.lastStatus,
        programTitle: row.title,
        description: row.description,
        location: row.location,
        cadence: row.cadence,
        hosts: row.hosts,
        genres: row.genres,
        runSchedule: row.runSchedule,
        nextBroadcastAt: row.nextBroadcastAt,
        nextBroadcastTitle: row.nextBroadcastTitle,
        latestEpisodeTitle: row.latestEpisodeTitle,
        latestEpisodeDescription: row.latestEpisodeDescription,
        latestEpisodeLocation: row.latestEpisodeLocation,
        latestEpisodeHosts: row.latestEpisodeHosts,
        latestEpisodeGenres: row.latestEpisodeGenres,
        programUrl: row.programUrl,
        updatedAt: row.lastCheckedAt || row.lastRunAt || ""
      });
    }
  }
  return docs;
}

function buildFeedMetadataDocs(feeds = []) {
  const { docs, pushDoc } = createMetadataDocCollector();
  for (const feed of Array.isArray(feeds) ? feeds : []) {
    pushDoc({
      id: feed.slug,
      kind: "feed",
      sourceType: feed.sourceType,
      title: feed.title,
      subtitle: feed.slug,
      programTitle: feed.title,
      description: feed.description,
      location: feed.location,
      cadence: feed.cadence,
      hosts: feed.hosts,
      genres: feed.genres,
      runSchedule: feed.runSchedule,
      nextBroadcastAt: feed.nextBroadcastAt,
      nextBroadcastTitle: feed.nextBroadcastTitle,
      latestEpisodeTitle: feed.latestEpisodeTitle,
      latestEpisodeDescription: feed.latestEpisodeDescription,
      latestEpisodeLocation: feed.latestEpisodeLocation,
      latestEpisodeHosts: feed.latestEpisodeHosts,
      latestEpisodeGenres: feed.latestEpisodeGenres,
      programUrl: feed.programUrl,
      updatedAt: feed.updatedAt
    });
  }
  return docs;
}

function buildHistoryMetadataDocs(history = []) {
  const { docs, pushDoc } = createMetadataDocCollector();
  for (const entry of Array.isArray(history) ? history : []) {
    pushDoc({
      id: entry.id,
      kind: "history",
      sourceType: entry.sourceType,
      title: entry.episodeTitle || entry.fileName,
      subtitle: entry.programTitle,
      programTitle: entry.programTitle,
      episodeTitle: entry.episodeTitle,
      description: entry.description,
      location: entry.location,
      cadence: entry.cadence,
      hosts: entry.hosts,
      genres: entry.genres,
      episodeUrl: entry.episodeUrl,
      filePath: entry.filePath,
      outputDir: entry.outputDir,
      fileName: entry.fileName,
      savedAt: entry.savedAt,
      status: entry.status
    });
  }
  return docs;
}

function buildHarvestMetadataDocs(harvested = []) {
  const { docs, pushDoc } = createMetadataDocCollector();
  for (const entry of Array.isArray(harvested) ? harvested : []) {
    pushDoc({
      id: entry.id || entry.programUrl || entry.title,
      kind: mapHarvestKind(entry.harvestKind),
      sourceType: entry.sourceType,
      title: entry.title,
      subtitle: entry.subtitle || entry.runSchedule || entry.programTitle || "",
      programTitle: entry.programTitle || entry.title,
      episodeTitle: entry.episodeTitle,
      description: entry.description,
      location: entry.location,
      cadence: entry.cadence,
      hosts: entry.hosts,
      genres: entry.genres,
      programUrl: entry.programUrl,
      episodeUrl: entry.episodeUrl,
      runSchedule: entry.runSchedule,
      nextBroadcastAt: entry.nextBroadcastAt,
      nextBroadcastTitle: entry.nextBroadcastTitle,
      latestEpisodeTitle: entry.latestEpisodeTitle,
      latestEpisodeDescription: entry.latestEpisodeDescription,
      latestEpisodeLocation: entry.latestEpisodeLocation,
      latestEpisodeHosts: entry.latestEpisodeHosts,
      latestEpisodeGenres: entry.latestEpisodeGenres,
      updatedAt: entry.harvestedAt || entry.updatedAt || ""
    });
  }
  return docs;
}

function sortMetadataDocs(rows) {
  return (Array.isArray(rows) ? rows.slice() : [])
    .sort((a, b) => String(b.updatedAt || b.savedAt || "").localeCompare(String(a.updatedAt || a.savedAt || "")));
}

function buildMetadataIndex({ schedulesBySource = {}, feeds = [], history = [], harvested = [] } = {}) {
  const docs = [];

  docs.push(...buildScheduleMetadataDocs(schedulesBySource));
  docs.push(...buildFeedMetadataDocs(feeds));
  docs.push(...buildHistoryMetadataDocs(history));
  docs.push(...buildHarvestMetadataDocs(harvested));

  return sortMetadataDocs(docs);
}

function searchMetadataIndex(index, options = {}) {
  const docs = Array.isArray(index) ? index : buildMetadataIndex(index);
  const query = normalizeText(options.query).toLowerCase();
  const sourceType = normalizeText(options.sourceType).toLowerCase();
  const kind = normalizeText(options.kind).toLowerCase();
  const host = normalizeText(options.host);
  const genre = normalizeText(options.genre);
  const location = normalizeText(options.location);
  const limit = Math.max(1, Math.min(200, Number(options.limit || 50) || 50));
  const tokens = query.split(/\s+/g).map((token) => token.trim()).filter(Boolean);

  let rows = docs.slice();
  if (sourceType) {
    rows = rows.filter((doc) => doc.sourceType === sourceType);
  }
  if (kind) {
    rows = rows.filter((doc) => doc.kind === kind);
  }
  if (host) {
    rows = rows.filter((doc) => matchesListFilter([...uniqueStrings(doc.hosts), ...uniqueStrings(doc.latestEpisodeHosts)], host));
  }
  if (genre) {
    rows = rows.filter((doc) => matchesListFilter([...uniqueStrings(doc.genres), ...uniqueStrings(doc.latestEpisodeGenres)], genre));
  }
  if (location) {
    rows = rows.filter((doc) => matchesOptionalFilter(doc.location, location) || matchesOptionalFilter(doc.latestEpisodeLocation, location));
  }

  if (tokens.length) {
    rows = rows
      .map((doc) => ({ ...doc, score: computeScore(doc, tokens) }))
      .filter((doc) => doc.score > 0 || tokens.every((token) => doc.searchText.includes(token)))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return String(b.updatedAt || b.savedAt || "").localeCompare(String(a.updatedAt || a.savedAt || ""));
      });
  }

  const total = rows.length;
  const results = rows.slice(0, limit);
  const metrics = {
    total,
    sourceCount: new Set(rows.map((row) => row.sourceType).filter(Boolean)).size,
    hostCount: new Set(rows.flatMap((row) => normalizeMetadataList(row.hosts))).size,
    genreCount: new Set(rows.flatMap((row) => normalizeMetadataList(row.genres))).size
  };
  return {
    query,
    sourceType,
    kind,
    host,
    genre,
    location,
    total,
    results,
    metrics,
    facets: buildFacets(rows)
  };
}

module.exports = {
  buildMetadataIndex,
  buildScheduleMetadataDocs,
  buildFeedMetadataDocs,
  buildHistoryMetadataDocs,
  buildHarvestMetadataDocs,
  sortMetadataDocs,
  applyMetadataRepairRules,
  searchMetadataIndex,
  discoverMetadataIndex,
  buildCollectionRecommendations
};
