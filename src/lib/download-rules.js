const fs = require("node:fs");
const path = require("node:path");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function buildEpisodeRuleText(entry = {}) {
  return [
    entry?.title,
    entry?.fullTitle,
    entry?.episodeTitle,
    entry?.programTitle,
    entry?.description
  ].map(normalizeText).filter(Boolean).join(" ").toLowerCase();
}

function isLikelyRerun(entry = {}) {
  const text = buildEpisodeRuleText(entry);
  if (!text) {
    return false;
  }
  return /\b(rerun|re-run|repeat|rebroadcast|re-broadcast|encore|classic replay|from the archive|archive show|archive edition)\b/i.test(text);
}

function toHistoryRows(downloadHistory) {
  if (!downloadHistory || typeof downloadHistory.list !== "function") {
    return [];
  }
  return Array.isArray(downloadHistory.list()) ? downloadHistory.list() : [];
}

function removeFileIfPresent(filePath) {
  const targetPath = normalizeText(filePath);
  if (!targetPath || !fs.existsSync(targetPath)) {
    return false;
  }
  try {
    fs.rmSync(targetPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function buildHistoryFilePath(entry = {}) {
  const explicit = normalizeText(entry.filePath);
  if (explicit) {
    return explicit;
  }
  const outputDir = normalizeText(entry.outputDir);
  const fileName = normalizeText(entry.fileName);
  return outputDir && fileName ? path.join(outputDir, fileName) : "";
}

function shouldRetainByAge(entry, deleteOlderDays, nowMs) {
  if (!Number(deleteOlderDays)) {
    return true;
  }
  const savedAtMs = Date.parse(String(entry?.savedAt || ""));
  if (!Number.isFinite(savedAtMs)) {
    return true;
  }
  return (nowMs - savedAtMs) < (Number(deleteOlderDays) * 24 * 60 * 60 * 1000);
}

function enforceDownloadRules({
  downloadHistory,
  settings = {},
  sourceType = "",
  programTitle = "",
  nowMs = Date.now()
} = {}) {
  if (!downloadHistory || typeof downloadHistory.update !== "function") {
    return { prunedCount: 0, deletedFileCount: 0, skipped: true };
  }

  const keepLatest = Math.max(0, Number(settings?.downloadKeepLatest || 0) || 0);
  const deleteOlderDays = Math.max(0, Number(settings?.downloadDeleteOlderDays || 0) || 0);
  if (!keepLatest && !deleteOlderDays) {
    return { prunedCount: 0, deletedFileCount: 0, skipped: true };
  }

  const sourceKey = normalizeKey(sourceType);
  const programKey = normalizeKey(programTitle);
  if (!sourceKey || !programKey) {
    return { prunedCount: 0, deletedFileCount: 0, skipped: true };
  }

  const candidates = toHistoryRows(downloadHistory)
    .filter((entry) => normalizeKey(entry?.sourceType) === sourceKey)
    .filter((entry) => normalizeKey(entry?.programTitle) === programKey)
    .filter((entry) => {
      const status = normalizeKey(entry?.status || "downloaded");
      return status === "downloaded" || status === "done";
    })
    .sort((a, b) => (Date.parse(String(b?.savedAt || "")) || 0) - (Date.parse(String(a?.savedAt || "")) || 0));

  let prunedCount = 0;
  let deletedFileCount = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const entry = candidates[index];
    const retainByPosition = !keepLatest || index < keepLatest;
    const retainByAge = shouldRetainByAge(entry, deleteOlderDays, nowMs);
    if (retainByPosition && retainByAge) {
      continue;
    }
    const filePath = buildHistoryFilePath(entry);
    if (removeFileIfPresent(filePath)) {
      deletedFileCount += 1;
    }
    const existingMessage = normalizeText(entry?.message);
    downloadHistory.update(entry.id, {
      status: "pruned",
      outputDir: "",
      fileName: "",
      filePath: "",
      message: existingMessage
        ? `${existingMessage} | Pruned by download rules`
        : "Pruned by download rules"
    });
    prunedCount += 1;
  }

  return {
    prunedCount,
    deletedFileCount,
    skipped: false
  };
}

module.exports = {
  enforceDownloadRules,
  isLikelyRerun
};
