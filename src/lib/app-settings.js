const path = require("node:path");

const DEFAULT_PATH_FORMAT = "{radio}/{program}/{episode_short} {release_date}";

function normalizeText(value) {
  return String(value || "").trim();
}

function clampBoolean(value, fallback = false) {
  return value == null ? Boolean(fallback) : Boolean(value);
}

function normalizeRuleText(value) {
  return normalizeText(value).slice(0, 300);
}

function normalizePerProgramRules(input) {
  const rows = Array.isArray(input) ? input : [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const rule = {
      id: normalizeRuleText(row.id) || "",
      sourceType: normalizeRuleText(row.sourceType).toLowerCase(),
      programTitle: normalizeRuleText(row.programTitle),
      programUrl: normalizeRuleText(row.programUrl),
      outputDir: normalizeText(row.outputDir),
      pathFormat: normalizeText(row.pathFormat),
      downloadKeepLatest: clampInteger(row.downloadKeepLatest, 0, 500, 0),
      downloadDeleteOlderDays: clampInteger(row.downloadDeleteOlderDays, 0, 3650, 0),
      skipReruns: clampBoolean(row.skipReruns, false),
      enabled: clampBoolean(row.enabled, true)
    };
    if (!rule.sourceType && !rule.programTitle && !rule.programUrl) {
      continue;
    }
    const key = [
      rule.sourceType,
      rule.programUrl.toLowerCase(),
      rule.programTitle.toLowerCase(),
      rule.outputDir.toLowerCase(),
      rule.pathFormat.toLowerCase()
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!rule.id) {
      rule.id = `${Date.now().toString(36)}-${out.length.toString(36)}`;
    }
    out.push(rule);
  }
  return out.slice(0, 250);
}

function clampInteger(value, min, max, fallback) {
  const normalized = Math.floor(Number(value));
  if (!Number.isFinite(normalized)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, normalized));
}

function createDefaultSettings(defaultDownloadDir) {
  return {
    timeFormat: "24h",
    downloadDir: defaultDownloadDir || "",
    pathFormat: DEFAULT_PATH_FORMAT,
    cueAutoGenerate: false,
    maxConcurrentDownloads: 2,
    outputFormat: "m4a",
    outputQuality: "128K",
    normalizeLoudness: true,
    dedupeMode: "source-id",
    id3Tagging: true,
    feedExportEnabled: true,
    webhookUrl: "",
    discordWebhookUrl: "",
    ntfyTopicUrl: "",
    auddTrackMatching: false,
    auddApiToken: "",
    fingerprintTrackMatching: false,
    acoustidApiKey: "",
    songrecTrackMatching: false,
    songrecSampleSeconds: 20,
    ffmpegCueSilenceDetect: true,
    ffmpegCueLoudnessDetect: true,
    ffmpegCueSpectralDetect: true,
    downloadKeepLatest: 0,
    downloadDeleteOlderDays: 0,
    skipReruns: false,
    smartTagCleanup: true,
    perProgramRules: [],
    episodesPerPage: 5,
    discoveryCount: 5
  };
}

function shouldWriteCueSidecar(settings, options = {}) {
  if (options.force) {
    return true;
  }
  return Boolean(settings?.cueAutoGenerate);
}

function shouldGenerateEmbeddedChapters(settings, options = {}) {
  if (options.force) {
    return true;
  }
  return Boolean(settings?.id3Tagging);
}

function normalizeSettings(input, options = {}) {
  const defaults = createDefaultSettings(options.defaultDownloadDir || "");
  const raw = input && typeof input === "object" ? input : {};
  const legacyRte = typeof raw.rteDownloadDir === "string" && raw.rteDownloadDir.trim()
    ? raw.rteDownloadDir.trim()
    : "";
  const legacyBbc = typeof raw.bbcDownloadDir === "string" && raw.bbcDownloadDir.trim()
    ? raw.bbcDownloadDir.trim()
    : "";
  let downloadDir = typeof raw.downloadDir === "string" && raw.downloadDir.trim()
    ? raw.downloadDir.trim()
    : "";
  if (!downloadDir) {
    const legacyDir = legacyRte || legacyBbc;
    if (legacyDir) {
      downloadDir = path.dirname(legacyDir);
    }
  }
  if (!downloadDir) {
    downloadDir = defaults.downloadDir;
  }

  const dedupeModeRaw = String(raw.dedupeMode || defaults.dedupeMode).trim().toLowerCase();
  return {
    timeFormat: raw.timeFormat === "12h" ? "12h" : "24h",
    downloadDir,
    pathFormat: typeof raw.pathFormat === "string" && raw.pathFormat.trim()
      ? raw.pathFormat.trim()
      : defaults.pathFormat,
    cueAutoGenerate: Boolean(raw.cueAutoGenerate),
    maxConcurrentDownloads: clampInteger(raw.maxConcurrentDownloads, 1, 8, defaults.maxConcurrentDownloads),
    outputFormat: String(raw.outputFormat || defaults.outputFormat).trim().toLowerCase() === "mp3" ? "mp3" : "m4a",
    outputQuality: String(raw.outputQuality || defaults.outputQuality).trim() || defaults.outputQuality,
    normalizeLoudness: raw.normalizeLoudness == null ? defaults.normalizeLoudness : Boolean(raw.normalizeLoudness),
    dedupeMode: ["source-id", "title-date", "none"].includes(dedupeModeRaw) ? dedupeModeRaw : defaults.dedupeMode,
    id3Tagging: raw.id3Tagging == null ? defaults.id3Tagging : Boolean(raw.id3Tagging),
    feedExportEnabled: raw.feedExportEnabled == null ? defaults.feedExportEnabled : Boolean(raw.feedExportEnabled),
    webhookUrl: typeof raw.webhookUrl === "string" ? raw.webhookUrl.trim() : "",
    discordWebhookUrl: typeof raw.discordWebhookUrl === "string" ? raw.discordWebhookUrl.trim() : "",
    ntfyTopicUrl: typeof raw.ntfyTopicUrl === "string" ? raw.ntfyTopicUrl.trim() : "",
    auddTrackMatching: raw.auddTrackMatching == null ? defaults.auddTrackMatching : Boolean(raw.auddTrackMatching),
    auddApiToken: typeof raw.auddApiToken === "string" ? raw.auddApiToken.trim() : "",
    fingerprintTrackMatching: raw.fingerprintTrackMatching == null
      ? defaults.fingerprintTrackMatching
      : Boolean(raw.fingerprintTrackMatching),
    acoustidApiKey: typeof raw.acoustidApiKey === "string" ? raw.acoustidApiKey.trim() : "",
    songrecTrackMatching: raw.songrecTrackMatching == null ? defaults.songrecTrackMatching : Boolean(raw.songrecTrackMatching),
    songrecSampleSeconds: clampInteger(raw.songrecSampleSeconds, 8, 45, defaults.songrecSampleSeconds),
    ffmpegCueSilenceDetect: raw.ffmpegCueSilenceDetect == null ? defaults.ffmpegCueSilenceDetect : Boolean(raw.ffmpegCueSilenceDetect),
    ffmpegCueLoudnessDetect: raw.ffmpegCueLoudnessDetect == null ? defaults.ffmpegCueLoudnessDetect : Boolean(raw.ffmpegCueLoudnessDetect),
    ffmpegCueSpectralDetect: raw.ffmpegCueSpectralDetect == null ? defaults.ffmpegCueSpectralDetect : Boolean(raw.ffmpegCueSpectralDetect),
    downloadKeepLatest: clampInteger(raw.downloadKeepLatest, 0, 500, defaults.downloadKeepLatest),
    downloadDeleteOlderDays: clampInteger(raw.downloadDeleteOlderDays, 0, 3650, defaults.downloadDeleteOlderDays),
    skipReruns: raw.skipReruns == null ? defaults.skipReruns : Boolean(raw.skipReruns),
    smartTagCleanup: raw.smartTagCleanup == null ? defaults.smartTagCleanup : Boolean(raw.smartTagCleanup),
    perProgramRules: normalizePerProgramRules(raw.perProgramRules),
    episodesPerPage: clampInteger(raw.episodesPerPage, 1, 50, defaults.episodesPerPage),
    discoveryCount: clampInteger(raw.discoveryCount, 1, 24, defaults.discoveryCount)
  };
}

module.exports = {
  DEFAULT_PATH_FORMAT,
  createDefaultSettings,
  normalizeSettings,
  shouldGenerateEmbeddedChapters,
  shouldWriteCueSidecar
};
