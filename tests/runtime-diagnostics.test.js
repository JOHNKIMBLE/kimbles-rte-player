jest.mock("../src/lib/downloader", () => ({
  getVendorRootCandidates: jest.fn(() => []),
  resolveBundledFfmpegDir: jest.fn(() => null),
  resolveYtDlpCommand: jest.fn(() => null)
}));

jest.mock("../src/lib/tags", () => ({
  resolveBundledAtomicParsleyBinary: jest.fn(() => null)
}));

jest.mock("../src/lib/cue", () => ({
  resolveSongrecBinary: jest.fn(() => null),
  resolveFpcalcBinary: jest.fn(() => null)
}));

jest.mock("../src/lib/vendor-bootstrap", () => ({
  getBootstrapScriptPath: jest.fn(() => "C:\\fake-bootstrap.js")
}));

const { collectRuntimeDiagnostics } = require("../src/lib/runtime-diagnostics");
const { clearParserWarnings, recordParserWarning } = require("../src/lib/parser-diagnostics");

describe("runtime diagnostics", () => {
  afterEach(() => {
    clearParserWarnings();
  });

  test("marks songrec as optional when disabled in settings", () => {
    const diagnostics = collectRuntimeDiagnostics({
      dataDir: "C:\\Data",
      downloadDir: "C:\\Downloads",
      projectRoot: "C:\\Project",
      settings: {
        songrecTrackMatching: false,
        fingerprintTrackMatching: false
      }
    });

    const songrec = diagnostics.binaries.find((entry) => entry.label === "songrec");
    expect(songrec).toEqual(expect.objectContaining({
      ok: false,
      optional: true,
      detail: "Optional: disabled in settings"
    }));
  });

  test("surfaces thin-source reasons when coverage is weak", () => {
    const diagnostics = collectRuntimeDiagnostics({
      dataDir: "C:\\Data",
      downloadDir: "C:\\Downloads",
      projectRoot: "C:\\Project",
      nowMs: Date.parse("2026-03-18T09:00:00.000Z"),
      settings: {
        songrecTrackMatching: false,
        fingerprintTrackMatching: false
      },
      schedulesBySource: {
        bbc: [{
          id: "bbc-1",
          title: "BBC Mix",
          enabled: true,
          lastRunAt: "2026-03-18T08:05:00.000Z",
          retryQueue: [{
            clipId: "bbc-retry-1",
            title: "Retry Episode",
            attempts: 2,
            nextRetryAt: "2026-03-18T09:30:00.000Z",
            lastError: "Temporary failure"
          }]
        }]
      },
      queueSnapshot: {
        recent: [{
          id: "queue-1",
          sourceType: "bbc",
          status: "failed",
          label: "Queue Failure",
          message: "Download failed",
          endedAt: "2026-03-18T08:45:00.000Z"
        }]
      },
      recentErrors: [{
        sourceType: "bbc",
        title: "BBC Mix",
        error: "Manifest error",
        savedAt: "2026-03-18T08:50:00.000Z"
      }],
      harvestState: {
        sources: {
          bbc: {
            lastRunAt: "2026-03-18T08:00:00.000Z",
            nextDueAt: "2026-03-18T12:00:00.000Z"
          },
          nts: {
            lastRunAt: "2026-03-18T08:30:00.000Z",
            nextDueAt: "2026-03-18T12:30:00.000Z"
          }
        }
      },
      harvestedItems: [
        {
          sourceType: "bbc",
          harvestKind: "program",
          title: "BBC Mix",
          hosts: ["Presenter"],
          genres: [],
          description: "Show description",
          location: ""
        },
        {
          sourceType: "nts",
          harvestKind: "program",
          title: "NTS Show",
          hosts: [],
          genres: ["Ambient"],
          description: "Show description",
          location: "London"
        }
      ]
    });

    const bbc = diagnostics.metadataHarvest.sourceStats.find((entry) => entry.sourceType === "bbc");
    const nts = diagnostics.metadataHarvest.sourceStats.find((entry) => entry.sourceType === "nts");

    expect(diagnostics.metadataHarvest.thinSourceCount).toBe(2);
    expect(diagnostics.metadataHarvest.thinDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: "bbc",
        missingFields: expect.arrayContaining(["genres", "location"])
      })
    ]));
    expect(bbc).toEqual(expect.objectContaining({
      isThinSource: true,
      thinReasons: expect.arrayContaining(["genres 0% coverage"])
    }));
    expect(nts).toEqual(expect.objectContaining({
      isThinSource: true,
      thinReasons: expect.arrayContaining(["hosts 0% coverage"])
    }));
    expect(diagnostics.sourceHealth).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: "bbc",
        retryPending: 1,
        recentFailureCount: 2
      })
    ]));
    expect(diagnostics.retryHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: "bbc",
        clipId: "bbc-retry-1",
        attempts: 2
      })
    ]));
  });

  test("counts latest-episode metadata toward source coverage", () => {
    const diagnostics = collectRuntimeDiagnostics({
      dataDir: "C:\\Data",
      downloadDir: "C:\\Downloads",
      projectRoot: "C:\\Project",
      settings: {
        songrecTrackMatching: false,
        fingerprintTrackMatching: false
      },
      harvestState: {
        sources: {
          wwf: {
            lastRunAt: "2026-03-18T08:00:00.000Z",
            nextDueAt: "2026-03-18T12:00:00.000Z"
          }
        }
      },
      harvestedItems: [
        {
          sourceType: "wwf",
          harvestKind: "program",
          title: "Ambient Flo",
          hosts: [],
          genres: [],
          latestEpisodeHosts: ["Auntie Flo"],
          latestEpisodeGenres: ["Ambient"],
          latestEpisodeDescription: "Worldwide FM description",
          latestEpisodeLocation: "London"
        }
      ]
    });

    const wwf = diagnostics.metadataHarvest.sourceStats.find((entry) => entry.sourceType === "wwf");

    expect(wwf).toEqual(expect.objectContaining({
      hostCoverage: 100,
      genreCoverage: 100
    }));
    expect(wwf.thinReasons).not.toEqual(expect.arrayContaining(["hosts 0% coverage", "genres 0% coverage"]));
    expect(diagnostics.metadataHarvest.thinDocs).toEqual([]);
  });

  test("includes recent parser warnings", () => {
    recordParserWarning({
      sourceType: "bbc",
      code: "program_summary_incomplete",
      message: "BBC program summary metadata was incomplete.",
      url: "https://www.bbc.co.uk/programmes/example",
      detail: "image"
    });

    const diagnostics = collectRuntimeDiagnostics({
      dataDir: "C:\\Data",
      downloadDir: "C:\\Downloads",
      projectRoot: "C:\\Project",
      settings: {
        songrecTrackMatching: false,
        fingerprintTrackMatching: false
      }
    });

    expect(diagnostics.parserWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: "bbc",
        code: "program_summary_incomplete",
        detail: "image"
      })
    ]));
  });
});
