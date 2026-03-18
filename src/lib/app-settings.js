const path = require("node:path");

const DEFAULT_PATH_FORMAT = "{radio}/{program}/{episode_short} {release_date}";

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
    auddTrackMatching: false,
    auddApiToken: "",
    fingerprintTrackMatching: false,
    acoustidApiKey: "",
    songrecTrackMatching: false,
    songrecSampleSeconds: 20,
    ffmpegCueSilenceDetect: true,
    ffmpegCueLoudnessDetect: true,
    ffmpegCueSpectralDetect: true,
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
