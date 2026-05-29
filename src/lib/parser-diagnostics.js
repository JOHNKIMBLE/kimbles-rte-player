const MAX_WARNINGS = 120;
const warnings = [];

function clean(value) {
  return String(value || "").trim();
}

function recordParserWarning(input = {}) {
  const sourceType = clean(input.sourceType).toLowerCase();
  const code = clean(input.code);
  if (!sourceType || !code) {
    return null;
  }

  const warning = {
    id: `${Date.now().toString(36)}-${warnings.length.toString(36)}`,
    sourceType,
    code,
    message: clean(input.message) || code,
    url: clean(input.url),
    detail: clean(input.detail),
    savedAt: new Date().toISOString()
  };
  warnings.unshift(warning);
  if (warnings.length > MAX_WARNINGS) {
    warnings.length = MAX_WARNINGS;
  }
  return { ...warning };
}

function listParserWarnings(limit = MAX_WARNINGS) {
  const safeLimit = Math.max(1, Math.min(MAX_WARNINGS, Number(limit || MAX_WARNINGS) || MAX_WARNINGS));
  return warnings.slice(0, safeLimit).map((warning) => ({ ...warning }));
}

function clearParserWarnings() {
  warnings.length = 0;
}

module.exports = {
  recordParserWarning,
  listParserWarnings,
  clearParserWarnings
};
