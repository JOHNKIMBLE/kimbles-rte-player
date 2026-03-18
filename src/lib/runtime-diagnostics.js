const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  getVendorRootCandidates,
  resolveBundledFfmpegDir,
  resolveYtDlpCommand
} = require("./downloader");
const { resolveBundledAtomicParsleyBinary } = require("./tags");
const { resolveSongrecBinary, resolveFpcalcBinary } = require("./cue");
const { getBootstrapScriptPath } = require("./vendor-bootstrap");

function runVersion(command, args = [], options = {}) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      shell: Boolean(options.shell),
      cwd: options.cwd || process.cwd(),
      timeout: Number(options.timeoutMs || 15000)
    });
    const output = String(result.stdout || result.stderr || "").trim();
    return {
      ok: !result.error && result.status === 0,
      status: Number(result.status ?? 1),
      output: output.split(/\r?\n/).find(Boolean) || ""
    };
  } catch (error) {
    return {
      ok: false,
      status: 1,
      output: String(error?.message || error || "")
    };
  }
}

function inspectBinary(label, resolver, args = ["--version"], options = {}) {
  try {
    const resolved = resolver();
    if (!resolved) {
      return {
        label,
        ok: false,
        path: "",
        version: "",
        detail: String(options.unavailableDetail || "Unavailable"),
        optional: Boolean(options.optional)
      };
    }
    if (typeof resolved === "object" && resolved.command) {
      const version = runVersion(resolved.command, [...(resolved.baseArgs || []), ...args], resolved);
      return {
        label,
        ok: version.ok,
        path: resolved.command,
        version: version.output,
        detail: version.ok ? "Ready" : version.output,
        optional: Boolean(options.optional)
      };
    }
    const version = runVersion(resolved, args, {
      cwd: path.dirname(String(resolved || "")),
      shell: /\.(cmd|bat)$/i.test(String(resolved || ""))
    });
    return {
      label,
      ok: version.ok,
      path: String(resolved || ""),
      version: version.output,
      detail: version.ok ? "Ready" : version.output,
      optional: Boolean(options.optional)
    };
  } catch (error) {
    return {
      label,
      ok: false,
      path: "",
      version: "",
      detail: String(error?.message || error || "Unavailable"),
      optional: Boolean(options.optional)
    };
  }
}

function inspectFfmpeg() {
  const ffmpegDir = resolveBundledFfmpegDir();
  const ffmpegExe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const command = ffmpegDir ? path.join(ffmpegDir, ffmpegExe) : ffmpegExe;
  const version = runVersion(command, ["-version"], {
    cwd: ffmpegDir || process.cwd()
  });
  return {
    label: "ffmpeg",
    ok: version.ok,
    path: command,
    version: version.output,
    detail: version.ok ? "Ready" : version.output
  };
}

function inspectWritablePath(label, targetPath) {
  const value = String(targetPath || "").trim();
  if (!value) {
    return { label, ok: false, path: "", detail: "Not configured" };
  }
  try {
    fs.mkdirSync(value, { recursive: true });
    const probePath = path.join(value, `.kimble-write-test-${process.pid}`);
    fs.writeFileSync(probePath, "ok", "utf8");
    fs.rmSync(probePath, { force: true });
    return { label, ok: true, path: value, detail: "Writable" };
  } catch (error) {
    return { label, ok: false, path: value, detail: String(error?.message || error || "Not writable") };
  }
}

function buildMetadataHarvestDiagnostics(options = {}) {
  const harvestedItems = Array.isArray(options.harvestedItems) ? options.harvestedItems : [];
  const harvestState = options.harvestState && typeof options.harvestState === "object" ? options.harvestState : { sources: {} };
  const harvestSources = harvestState.sources && typeof harvestState.sources === "object" ? harvestState.sources : {};
  const metadataIndex = Array.isArray(options.metadataIndex) ? options.metadataIndex : [];
  const entityGraph = options.entityGraph && typeof options.entityGraph === "object" ? options.entityGraph : { metrics: {} };
  const nowMs = Number(options.nowMs || Date.now());

  const sourceBuckets = new Map();
  for (const item of harvestedItems) {
    const sourceType = String(item?.sourceType || "").trim().toLowerCase();
    if (!sourceType) {
      continue;
    }
    const bucket = sourceBuckets.get(sourceType) || [];
    bucket.push(item);
    sourceBuckets.set(sourceType, bucket);
  }

  function countKind(rows, kind) {
    return rows.filter((row) => String(row?.harvestKind || "program").trim().toLowerCase() === kind).length;
  }

  function coverageRatio(rows, predicate) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
      return 0;
    }
    const hits = safeRows.filter((row) => predicate(row)).length;
    return Math.round((hits / safeRows.length) * 100);
  }

  const sourceStats = Array.from(new Set([
    ...Object.keys(harvestSources),
    ...sourceBuckets.keys()
  ])).sort().map((sourceType) => {
    const rows = sourceBuckets.get(sourceType) || [];
    const programs = rows.filter((row) => String(row?.harvestKind || "program").trim().toLowerCase() === "program");
    const current = harvestSources[sourceType] && typeof harvestSources[sourceType] === "object" ? harvestSources[sourceType] : {};
    const nextDueMs = current.nextDueAt ? Date.parse(String(current.nextDueAt)) : NaN;
    const lastRunMs = current.lastRunAt ? Date.parse(String(current.lastRunAt)) : NaN;
    const hostCoverage = coverageRatio(programs, (row) => Array.isArray(row?.hosts) && row.hosts.length);
    const genreCoverage = coverageRatio(programs, (row) => Array.isArray(row?.genres) && row.genres.length);
    const descriptionCoverage = coverageRatio(rows, (row) => String(row?.description || row?.latestEpisodeDescription || "").trim());
    const locationCoverage = coverageRatio(rows, (row) => String(row?.location || row?.latestEpisodeLocation || "").trim());
    const thinCount = rows.filter((row) => {
      const hasHosts = Array.isArray(row?.hosts) && row.hosts.length;
      const hasGenres = Array.isArray(row?.genres) && row.genres.length;
      const hasDescription = String(row?.description || row?.latestEpisodeDescription || "").trim();
      const hasLocation = String(row?.location || row?.latestEpisodeLocation || "").trim();
      return !hasHosts && !hasGenres && !hasDescription && !hasLocation;
    }).length;
    const due = Number.isFinite(nextDueMs) ? nextDueMs <= nowMs : !Number.isFinite(lastRunMs);
    return {
      sourceType,
      harvestedCount: rows.length,
      programCount: countKind(rows, "program"),
      hostCount: countKind(rows, "host"),
      episodeCount: countKind(rows, "episode"),
      thinCount,
      hostCoverage,
      genreCoverage,
      descriptionCoverage,
      locationCoverage,
      lastRunAt: String(current.lastRunAt || ""),
      nextDueAt: String(current.nextDueAt || ""),
      lastEpisodePages: Number(current.lastEpisodePages || 0),
      nextEpisodePages: Number(current.nextEpisodePages || 0),
      harvestCadenceMs: Number(current.harvestCadenceMs || 0),
      due
    };
  });

  return {
    updatedAt: String(options.harvestUpdatedAt || ""),
    harvestedCount: harvestedItems.length,
    metadataIndexCount: metadataIndex.length,
    graphMetrics: {
      entityCount: Number(entityGraph?.metrics?.entityCount || 0),
      relationCount: Number(entityGraph?.metrics?.relationCount || 0),
      sourceCount: Number(entityGraph?.metrics?.sourceCount || 0)
    },
    sourceStats,
    sourceCount: sourceStats.length,
    harvestedProgramCount: countKind(harvestedItems, "program"),
    harvestedHostCount: countKind(harvestedItems, "host"),
    harvestedEpisodeCount: countKind(harvestedItems, "episode"),
    thinSourceCount: sourceStats.filter((row) => row.thinCount > 0 || row.hostCoverage < 40 || row.genreCoverage < 40).length
  };
}

function collectRuntimeDiagnostics(options = {}) {
  const dataDir = String(options.dataDir || "");
  const downloadDir = String(options.downloadDir || "");
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, "..", ".."));
  const bootstrapScriptPath = getBootstrapScriptPath(projectRoot);
  const vendorRoots = getVendorRootCandidates();
  const recentErrors = Array.isArray(options.recentErrors) ? options.recentErrors.slice(0, 10) : [];

  const settings = options.settings || {};
  const songrecEnabled = Boolean(settings.songrecTrackMatching);
  const fpcalcEnabled = Boolean(settings.fingerprintTrackMatching);

  return {
    runtime: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
      projectRoot,
      dataDir,
      downloadDir
    },
    vendor: {
      roots: vendorRoots,
      bootstrapScriptPath,
      bootstrapScriptExists: fs.existsSync(bootstrapScriptPath)
    },
    writablePaths: [
      inspectWritablePath("Data Dir", dataDir),
      inspectWritablePath("Download Dir", downloadDir)
    ],
    binaries: [
      inspectBinary("yt-dlp", resolveYtDlpCommand),
      inspectFfmpeg(),
      inspectBinary("AtomicParsley", resolveBundledAtomicParsleyBinary, ["-v"]),
      inspectBinary("songrec", resolveSongrecBinary, ["--version"], {
        optional: !songrecEnabled,
        unavailableDetail: songrecEnabled ? "Unavailable" : "Optional: disabled in settings"
      }),
      inspectBinary("fpcalc", resolveFpcalcBinary, ["-version"], {
        optional: !fpcalcEnabled,
        unavailableDetail: fpcalcEnabled ? "Unavailable" : "Optional: disabled in settings"
      })
    ],
    recentErrors,
    metadataHarvest: buildMetadataHarvestDiagnostics(options)
  };
}

module.exports = {
  collectRuntimeDiagnostics
};
