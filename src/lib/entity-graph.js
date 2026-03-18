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

function normalizeEntityKey(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function toEntityId(type, key) {
  return `${type}:${key}`;
}

function pickPreferredName(currentName, nextName) {
  const current = normalizeText(currentName);
  const next = normalizeText(nextName);
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }
  if (next.length > current.length) {
    return next;
  }
  return current;
}

function ensureEntity(entitiesById, type, name, extra = {}) {
  const safeName = normalizeText(name);
  if (!safeName) {
    return null;
  }
  const key = normalizeEntityKey(safeName);
  if (!key) {
    return null;
  }
  const id = toEntityId(type, key);
  let entity = entitiesById.get(id);
  if (!entity) {
    entity = {
      id,
      type,
      key,
      name: safeName,
      aliases: [],
      sourceTypes: [],
      programUrls: [],
      episodeUrls: [],
      relatedCount: 0,
      documentCount: 0,
      episodeCount: 0
    };
    entitiesById.set(id, entity);
  }
  entity.name = pickPreferredName(entity.name, safeName);
  if (!entity.aliases.includes(safeName)) {
    entity.aliases.push(safeName);
  }
  const sourceType = normalizeText(extra.sourceType).toLowerCase();
  if (sourceType && !entity.sourceTypes.includes(sourceType)) {
    entity.sourceTypes.push(sourceType);
  }
  const programUrl = normalizeText(extra.programUrl);
  if (programUrl && !entity.programUrls.includes(programUrl)) {
    entity.programUrls.push(programUrl);
  }
  const episodeUrl = normalizeText(extra.episodeUrl);
  if (episodeUrl && !entity.episodeUrls.includes(episodeUrl)) {
    entity.episodeUrls.push(episodeUrl);
  }
  return entity;
}

function addRelation(relationsByPair, left, right, relationType, weight = 1) {
  if (!left?.id || !right?.id || left.id === right.id) {
    return;
  }
  const ids = [left.id, right.id].sort();
  const key = `${ids[0]}|${ids[1]}|${relationType}`;
  const current = relationsByPair.get(key) || {
    id: key,
    relationType,
    fromId: left.id,
    toId: right.id,
    weight: 0
  };
  current.weight += Number(weight || 1);
  relationsByPair.set(key, current);
}

function addDocument(entity) {
  if (entity) {
    entity.documentCount += 1;
  }
}

function buildSecondDegreeRecommendations(entity, entitiesById, relationBuckets) {
  const directRelations = relationBuckets.get(entity.id) || [];
  const directNeighborIds = new Set();
  for (const relation of directRelations) {
    directNeighborIds.add(relation.fromId === entity.id ? relation.toId : relation.fromId);
  }

  const scoresByType = {
    program: new Map(),
    host: new Map(),
    genre: new Map(),
    location: new Map(),
    episode: new Map()
  };

  for (const relation of directRelations) {
    const neighborId = relation.fromId === entity.id ? relation.toId : relation.fromId;
    const neighborRelations = relationBuckets.get(neighborId) || [];
    for (const nextRelation of neighborRelations) {
      const candidateId = nextRelation.fromId === neighborId ? nextRelation.toId : nextRelation.fromId;
      if (!candidateId || candidateId === entity.id || directNeighborIds.has(candidateId)) {
        continue;
      }
      const candidate = entitiesById.get(candidateId);
      if (!candidate || !scoresByType[candidate.type]) {
        continue;
      }
      const current = scoresByType[candidate.type].get(candidateId) || {
        id: candidate.id,
        type: candidate.type,
        name: candidate.name,
        programUrl: candidate.programUrls[0] || "",
        episodeUrl: candidate.episodeUrls[0] || "",
        sourceTypes: candidate.sourceTypes.slice(),
        weight: 0
      };
      current.weight += relation.weight * nextRelation.weight;
      scoresByType[candidate.type].set(candidateId, current);
    }
  }

  function toSortedList(type) {
    return Array.from(scoresByType[type].values())
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
      .slice(0, 6);
  }

  return {
    recommendedPrograms: toSortedList("program"),
    recommendedHosts: toSortedList("host"),
    recommendedGenres: toSortedList("genre"),
    recommendedLocations: toSortedList("location"),
    recommendedEpisodes: toSortedList("episode")
  };
}

function buildEntityGraph(index) {
  const docs = Array.isArray(index) ? index : [];
  const entitiesById = new Map();
  const relationsByPair = new Map();

  for (const doc of docs) {
    const sourceType = normalizeText(doc?.sourceType).toLowerCase();
    const baseProgramName = normalizeText(doc?.programTitle || ((doc?.kind !== "host" && doc?.kind !== "episode") ? doc?.title : ""));
    const episodeName = normalizeText(doc?.episodeTitle || ((doc?.kind === "episode" || doc?.kind === "history") ? doc?.title : ""));
    const locationName = normalizeText(doc?.location || doc?.latestEpisodeLocation);
    const hosts = normalizeList([...normalizeList(doc?.hosts), ...normalizeList(doc?.latestEpisodeHosts)]);
    const genres = normalizeList([...normalizeList(doc?.genres), ...normalizeList(doc?.latestEpisodeGenres)]);

    const programEntity = ensureEntity(entitiesById, "program", baseProgramName, {
      sourceType,
      programUrl: doc?.programUrl
    });
    const episodeEntity = ensureEntity(entitiesById, "episode", episodeName, {
      sourceType,
      programUrl: doc?.programUrl,
      episodeUrl: doc?.episodeUrl
    });
    const locationEntity = ensureEntity(entitiesById, "location", locationName, {
      sourceType
    });
    const hostEntities = hosts.map((name) => ensureEntity(entitiesById, "host", name, {
      sourceType,
      programUrl: doc?.programUrl,
      episodeUrl: doc?.episodeUrl
    })).filter(Boolean);
    const genreEntities = genres.map((name) => ensureEntity(entitiesById, "genre", name, {
      sourceType
    })).filter(Boolean);

    addDocument(programEntity);
    addDocument(episodeEntity);
    addDocument(locationEntity);
    for (const entity of hostEntities) {
      addDocument(entity);
    }
    for (const entity of genreEntities) {
      addDocument(entity);
    }

    if (episodeEntity) {
      episodeEntity.episodeCount += 1;
      addRelation(relationsByPair, episodeEntity, programEntity, "episode-program", 8);
      addRelation(relationsByPair, episodeEntity, locationEntity, "episode-location", 3);
      for (const hostEntity of hostEntities) {
        addRelation(relationsByPair, episodeEntity, hostEntity, "episode-host", 6);
      }
      for (const genreEntity of genreEntities) {
        addRelation(relationsByPair, episodeEntity, genreEntity, "episode-genre", 4);
      }
    }

    if (programEntity) {
      for (const hostEntity of hostEntities) {
        addRelation(relationsByPair, programEntity, hostEntity, "program-host", 7);
      }
      for (const genreEntity of genreEntities) {
        addRelation(relationsByPair, programEntity, genreEntity, "program-genre", 5);
      }
      addRelation(relationsByPair, programEntity, locationEntity, "program-location", 4);
    }

    for (const hostEntity of hostEntities) {
      addRelation(relationsByPair, hostEntity, locationEntity, "host-location", 2);
      for (const genreEntity of genreEntities) {
        addRelation(relationsByPair, hostEntity, genreEntity, "host-genre", 3);
      }
    }

    for (let indexA = 0; indexA < hostEntities.length; indexA += 1) {
      for (let indexB = indexA + 1; indexB < hostEntities.length; indexB += 1) {
        addRelation(relationsByPair, hostEntities[indexA], hostEntities[indexB], "host-host", 2);
      }
    }
  }

  const relations = Array.from(relationsByPair.values());
  const relationBuckets = new Map();
  for (const relation of relations) {
    for (const entityId of [relation.fromId, relation.toId]) {
      const list = relationBuckets.get(entityId) || [];
      list.push(relation);
      relationBuckets.set(entityId, list);
    }
  }

  const entities = Array.from(entitiesById.values()).map((entity) => {
    const related = (relationBuckets.get(entity.id) || []).slice().sort((a, b) => b.weight - a.weight);
    const byType = { program: [], host: [], genre: [], location: [], episode: [] };
    for (const relation of related) {
      const otherId = relation.fromId === entity.id ? relation.toId : relation.fromId;
      const other = entitiesById.get(otherId);
      if (!other) {
        continue;
      }
      const bucket = byType[other.type] || [];
      if (bucket.some((item) => item.id === other.id)) {
        continue;
      }
      bucket.push({
        id: other.id,
        type: other.type,
        name: other.name,
        programUrl: other.programUrls[0] || "",
        episodeUrl: other.episodeUrls[0] || "",
        sourceTypes: other.sourceTypes.slice(),
        weight: relation.weight
      });
    }
    const recommendations = buildSecondDegreeRecommendations(entity, entitiesById, relationBuckets);
    entity.relatedCount = related.length;
    return {
      ...entity,
      sourceTypes: entity.sourceTypes.slice().sort(),
      aliases: entity.aliases.slice().sort((a, b) => a.localeCompare(b)),
      programUrls: entity.programUrls.slice(),
      episodeUrls: entity.episodeUrls.slice(),
      related: related.slice(0, 20).map((relation) => {
        const otherId = relation.fromId === entity.id ? relation.toId : relation.fromId;
        const other = entitiesById.get(otherId);
        return {
          id: other?.id || "",
          type: other?.type || "",
          name: other?.name || "",
          relationType: relation.relationType,
          weight: relation.weight,
          programUrl: other?.programUrls?.[0] || "",
          episodeUrl: other?.episodeUrls?.[0] || ""
        };
      }),
      topPrograms: (byType.program || []).slice(0, 5),
      topHosts: (byType.host || []).slice(0, 5),
      topGenres: (byType.genre || []).slice(0, 5),
      topLocations: (byType.location || []).slice(0, 5),
      topEpisodes: (byType.episode || []).slice(0, 5),
      ...recommendations
    };
  });

  return {
    entities,
    relations,
    metrics: {
      entityCount: entities.length,
      relationCount: relations.length,
      sourceCount: new Set(entities.flatMap((entity) => entity.sourceTypes)).size
    }
  };
}

function scoreEntity(entity, tokens) {
  if (!tokens.length) {
    return entity.relatedCount + entity.documentCount;
  }
  const haystack = [
    entity.name,
    ...(Array.isArray(entity.aliases) ? entity.aliases : []),
    ...(Array.isArray(entity.sourceTypes) ? entity.sourceTypes : []),
    ...(Array.isArray(entity.topPrograms) ? entity.topPrograms.map((item) => item.name) : []),
    ...(Array.isArray(entity.topHosts) ? entity.topHosts.map((item) => item.name) : []),
    ...(Array.isArray(entity.topGenres) ? entity.topGenres.map((item) => item.name) : []),
    ...(Array.isArray(entity.topLocations) ? entity.topLocations.map((item) => item.name) : []),
    ...(Array.isArray(entity.topEpisodes) ? entity.topEpisodes.map((item) => item.name) : [])
  ].join(" ").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!token) {
      continue;
    }
    if (haystack.includes(token)) {
      score += 6;
    }
    if (entity.name.toLowerCase().startsWith(token)) {
      score += 10;
    }
  }
  if (entity.type === "host") {
    score += 2;
  }
  if (entity.type === "program") {
    score += 1;
  }
  return score + entity.relatedCount + entity.documentCount;
}

function searchEntityGraph(index, options = {}) {
  const graph = Array.isArray(index?.entities) ? index : buildEntityGraph(index);
  const query = normalizeText(options.query).toLowerCase();
  const type = normalizeText(options.type).toLowerCase();
  const sourceType = normalizeText(options.sourceType).toLowerCase();
  const limit = Math.max(1, Math.min(100, Number(options.limit || 24) || 24));
  const tokens = query.split(/\s+/g).map((token) => token.trim()).filter(Boolean);
  let rows = Array.isArray(graph.entities) ? graph.entities.slice() : [];
  if (type) {
    rows = rows.filter((entity) => entity.type === type);
  }
  if (sourceType) {
    rows = rows.filter((entity) => Array.isArray(entity.sourceTypes) && entity.sourceTypes.includes(sourceType));
  }
  rows = rows
    .map((entity) => ({ ...entity, score: scoreEntity(entity, tokens) }))
    .filter((entity) => entity.score > 0 || !tokens.length)
    .sort((a, b) => b.score - a.score || b.relatedCount - a.relatedCount || a.name.localeCompare(b.name));
  return {
    query,
    type,
    sourceType,
    total: rows.length,
    results: rows.slice(0, limit),
    metrics: graph.metrics
  };
}

function getEntityGraphEntity(index, options = {}) {
  const graph = Array.isArray(index?.entities) ? index : buildEntityGraph(index);
  const entityId = normalizeText(options.entityId);
  const entity = (Array.isArray(graph.entities) ? graph.entities : []).find((item) => item.id === entityId) || null;
  return {
    entity,
    metrics: graph.metrics
  };
}

module.exports = {
  buildEntityGraph,
  searchEntityGraph,
  getEntityGraphEntity
};
