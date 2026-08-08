const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 6;

function normalizeError(error) {
  return String(error?.message || error || "Unknown error").replace(/\s+/g, " ").trim();
}

function getProgramUrl(program) {
  return String(program?.programUrl || program?.url || program?.link || "").trim();
}

function getEpisodeUrl(episode) {
  return String(episode?.episodeUrl || episode?.url || episode?.link || "").trim();
}

async function runCapability(key, action) {
  const startedAt = Date.now();
  try {
    const value = await action();
    return {
      key,
      ok: true,
      detail: "Ready",
      durationMs: Date.now() - startedAt,
      value
    };
  } catch (error) {
    return {
      key,
      ok: false,
      detail: normalizeError(error),
      durationMs: Date.now() - startedAt,
      value: null
    };
  }
}

function publicCapability(result) {
  return {
    key: result.key,
    ok: result.ok,
    detail: result.detail,
    durationMs: result.durationMs
  };
}

async function runSourceCanary(provider, now = new Date()) {
  const sourceType = String(provider?.sourceType || "").trim().toLowerCase();
  if (!sourceType || typeof provider?.getDiscovery !== "function") {
    throw new Error("A source canary requires a source type and discovery function.");
  }

  const discovery = await runCapability("discovery", () => provider.getDiscovery());
  const program = Array.isArray(discovery.value) ? discovery.value[0] : null;
  const programUrl = getProgramUrl(program);
  const capabilities = [publicCapability(discovery)];
  let summary = null;
  let episodes = [];

  if (programUrl && typeof provider.getProgramSummary === "function") {
    const result = await runCapability("program", () => provider.getProgramSummary(programUrl));
    capabilities.push(publicCapability(result));
    summary = result.value;
  } else {
    capabilities.push({
      key: "program",
      ok: false,
      detail: programUrl ? "Program check is unavailable" : "Discovery returned no program URL",
      durationMs: 0
    });
  }

  if (programUrl && typeof provider.getProgramEpisodes === "function") {
    const result = await runCapability("episodes", () => provider.getProgramEpisodes(programUrl));
    capabilities.push(publicCapability(result));
    episodes = Array.isArray(result.value)
      ? result.value
      : (Array.isArray(result.value?.episodes) ? result.value.episodes : []);
  } else {
    capabilities.push({
      key: "episodes",
      ok: false,
      detail: programUrl ? "Episode check is unavailable" : "Discovery returned no program URL",
      durationMs: 0
    });
  }

  const episode = episodes[0] || null;
  const episodeUrl = getEpisodeUrl(episode);
  if (episodeUrl && typeof provider.getEpisodePlaylist === "function") {
    const result = await runCapability("tracklist", () => provider.getEpisodePlaylist(episode));
    const trackCount = Array.isArray(result.value)
      ? result.value.length
      : (Array.isArray(result.value?.tracks) ? result.value.tracks.length : 0);
    capabilities.push({
      ...publicCapability(result),
      detail: result.ok ? (trackCount ? `${trackCount} track(s) published` : "No tracklist published for this episode") : result.detail
    });
  } else {
    capabilities.push({
      key: "tracklist",
      ok: false,
      detail: episodeUrl ? "Tracklist check is unavailable" : "No episode returned by provider",
      durationMs: 0
    });
  }

  if (typeof provider.getLive === "function") {
    const result = await runCapability("live", () => provider.getLive());
    capabilities.push(publicCapability(result));
  }

  const failures = capabilities.filter((capability) => !capability.ok);
  return {
    sourceType,
    checkedAt: now.toISOString(),
    status: failures.length ? (failures.length === capabilities.length ? "failed" : "degraded") : "healthy",
    programTitle: String(summary?.title || program?.title || program?.name || "").trim(),
    programUrl,
    episodeTitle: String(episode?.title || episode?.fullTitle || "").trim(),
    episodeUrl,
    capabilities,
    failureCount: failures.length
  };
}

async function runSourceCanaries(providers = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const rows = [];
  for (const provider of providers) {
    try {
      rows.push(await runSourceCanary(provider, now));
    } catch (error) {
      rows.push({
        sourceType: String(provider?.sourceType || "unknown").trim().toLowerCase() || "unknown",
        checkedAt: now.toISOString(),
        status: "failed",
        programTitle: "",
        programUrl: "",
        episodeTitle: "",
        episodeUrl: "",
        capabilities: [{ key: "discovery", ok: false, detail: normalizeError(error), durationMs: 0 }],
        failureCount: 1
      });
    }
  }
  return rows;
}

function shouldRunSourceCanaries(results = [], options = {}) {
  const maxAgeMs = Number(options.maxAgeMs || DEFAULT_MAX_AGE_MS);
  const requiredSources = Array.isArray(options.requiredSources) ? options.requiredSources : [];
  const bySource = new Map((Array.isArray(results) ? results : []).map((row) => [String(row?.sourceType || ""), row]));
  const nowMs = Number(options.nowMs || Date.now());
  return requiredSources.some((sourceType) => {
    const row = bySource.get(String(sourceType || "").trim().toLowerCase());
    const checkedAtMs = Date.parse(String(row?.checkedAt || ""));
    return !row || !Number.isFinite(checkedAtMs) || nowMs - checkedAtMs >= maxAgeMs;
  });
}

module.exports = {
  DEFAULT_MAX_AGE_MS,
  runSourceCanary,
  runSourceCanaries,
  shouldRunSourceCanaries
};
