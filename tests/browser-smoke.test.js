const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`Process exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

describe("browser smoke", () => {
  jest.setTimeout(120000);

  test("renders settings, library, source discovery flows, and KEXP flows in a real Chromium window", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rte-browser-smoke-"));
    const downloadDir = path.join(tempDir, "downloads");
    fs.mkdirSync(downloadDir, { recursive: true });

    fs.writeFileSync(path.join(tempDir, "download-history.json"), JSON.stringify([
      {
        id: "hist-1",
        savedAt: new Date("2026-03-16T18:00:00.000Z").toISOString(),
        status: "downloaded",
        sourceType: "rte",
        episodeTitle: "Smoke Episode",
        programTitle: "Smoke Program",
        description: "Metadata-rich smoke history entry",
        location: "Dublin",
        hosts: ["DJ Smoke"],
        genres: ["Talk"],
        outputDir: downloadDir,
        fileName: "smoke.mp3",
        filePath: path.join(downloadDir, "smoke.mp3"),
        episodeUrl: "https://example.com/episode/smoke"
      },
      {
        id: "hist-2",
        savedAt: new Date("2026-03-16T19:00:00.000Z").toISOString(),
        status: "failed",
        sourceType: "bbc",
        episodeTitle: "Second Smoke Episode",
        programTitle: "Other Smoke Program",
        outputDir: downloadDir,
        fileName: "smoke-2.mp3",
        filePath: path.join(downloadDir, "smoke-2.mp3"),
        episodeUrl: "https://example.com/episode/smoke-2",
        message: "metadata probe failed"
      }
    ], null, 2));
    fs.writeFileSync(path.join(tempDir, "schedules.json"), JSON.stringify([
      {
        id: "sched-1",
        programUrl: "https://example.com/program/smoke",
        title: "Smoke Program",
        description: "Smoke test schedule",
        image: "",
        runSchedule: "",
        nextBroadcastAt: "",
        nextBroadcastTitle: "",
        enabled: true,
        cadence: "weekly",
        averageDaysBetween: 7,
        latestEpisodeTitle: "Smoke Episode",
        latestEpisodePublishedTime: "2026-03-16",
        latestEpisodeImage: "",
        lastDownloaded: null,
        downloadedClipIds: [],
        retryQueue: [],
        initialBackfillCount: 0,
        backfillInProgress: false,
        backfillTotal: 0,
        backfillCompleted: 0,
        backfillFailed: 0,
        lastCheckedAt: null,
        lastRunAt: new Date("2026-03-16T18:10:00.000Z").toISOString(),
        lastStatus: "Enabled"
      }
    ], null, 2));
    fs.mkdirSync(path.join(tempDir, "bbc"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "bbc", "schedules.json"), JSON.stringify([
      {
        id: "bbc-sched-1",
        programUrl: "https://example.com/program/bbc-smoke",
        title: "BBC Smoke Program",
        description: "Smoke test BBC schedule",
        image: "",
        runSchedule: "Wed 18:00",
        nextBroadcastAt: new Date("2026-03-17T00:00:00.000Z").toISOString(),
        nextBroadcastTitle: "BBC Next Smoke",
        enabled: false,
        cadence: "weekly",
        averageDaysBetween: 7,
        latestEpisodeTitle: "BBC Smoke Episode",
        latestEpisodePublishedTime: "2026-03-15",
        latestEpisodeImage: "",
        lastDownloaded: null,
        downloadedClipIds: [],
        retryQueue: [{ clipId: "bbc-retry-1" }],
        initialBackfillCount: 0,
        backfillInProgress: false,
        backfillTotal: 0,
        backfillCompleted: 0,
        backfillFailed: 0,
        lastCheckedAt: new Date("2026-03-16T18:15:00.000Z").toISOString(),
        lastRunAt: new Date("2026-03-16T18:20:00.000Z").toISOString(),
        lastStatus: "Failed once"
      }
    ], null, 2));
    fs.writeFileSync(path.join(tempDir, "download-queue.json"), JSON.stringify({
      paused: false,
      pending: [],
      active: [],
      history: [
        {
          id: "queue-1",
          label: "Smoke Queue Task",
          sourceType: "rte",
          programTitle: "Smoke Program",
          description: "Queue metadata smoke entry",
          location: "Studio 8",
          hosts: ["Queue Smoke Host"],
          genres: ["Talk"],
          createdAt: new Date("2026-03-16T18:05:00.000Z").toISOString(),
          startedAt: new Date("2026-03-16T18:05:05.000Z").toISOString(),
          endedAt: new Date("2026-03-16T18:06:00.000Z").toISOString(),
          status: "done",
          outputDir: downloadDir,
          fileName: "smoke.mp3",
          filePath: path.join(downloadDir, "smoke.mp3"),
          message: "ok",
          persisted: {
            type: "download-url",
            sourceType: "rte",
            pageUrl: "https://example.com/episode/smoke"
          }
        },
        {
          id: "queue-2",
          label: "Failed BBC Queue Task",
          sourceType: "bbc",
          programTitle: "BBC Smoke Program",
          description: "Failed queue metadata",
          location: "London",
          hosts: ["BBC Host"],
          genres: ["Music"],
          createdAt: new Date("2026-03-16T18:07:00.000Z").toISOString(),
          startedAt: new Date("2026-03-16T18:07:05.000Z").toISOString(),
          endedAt: new Date("2026-03-16T18:08:00.000Z").toISOString(),
          status: "failed",
          outputDir: "",
          fileName: "",
          filePath: "",
          message: "bbc smoke failed",
          persisted: {
            type: "download-url",
            sourceType: "bbc",
            pageUrl: "https://example.com/episode/bbc-smoke"
          }
        }
      ]
    }, null, 2));

    const port = await getFreePort();
    const env = {
      ...process.env,
      PORT: String(port),
      DATA_DIR: tempDir,
      DOWNLOAD_DIR: downloadDir
    };

    const server = spawn(process.execPath, ["src/server.js"], {
      cwd: path.join(__dirname, ".."),
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let serverStderr = "";
    server.stderr.on("data", (chunk) => {
      serverStderr += chunk.toString();
    });

    try {
      await waitForServer(`http://127.0.0.1:${port}/health`);

      const electronPackageBinary = require("electron");
      const electronCandidates = [
        typeof electronPackageBinary === "string" ? electronPackageBinary : "",
        path.join(__dirname, "..", "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron"),
        path.join(__dirname, "..", "node_modules", "electron", "dist", "electron.exe"),
        path.join(__dirname, "..", "node_modules", "electron", "dist", "electron")
      ].filter(Boolean);
      const electronBinary = electronCandidates.find((candidate) => fs.existsSync(candidate));
      if (!electronBinary) {
        throw new Error(`Electron binary not found. Checked: ${electronCandidates.join(", ")}`);
      }
      const electronEnv = { ...process.env };
      delete electronEnv.ELECTRON_RUN_AS_NODE;
      const runnerPath = path.join(__dirname, "fixtures", "browser-smoke-runner.js");
      const result = await runProcess(electronBinary, [runnerPath, `http://127.0.0.1:${port}/`], {
        cwd: path.join(__dirname, ".."),
        env: {
          ...electronEnv,
          ELECTRON_DISABLE_SECURITY_WARNINGS: "1"
        }
      });
      const payload = JSON.parse(result.stdout.trim().split(/\r?\n/).filter(Boolean).pop());

      expect(payload.settingsVisible).toBe(true);
      expect(payload.hasSaveSettings).toBe(true);
      expect(payload.feedsText).toContain("Smoke Feed");
      expect(payload.feedsText).toContain("Night Transit");
      expect(payload.feedsText).toContain("DJ Smoke");
      expect(payload.feedsText).toContain("Smoke Feed Episode");
      expect(payload.feedsText).toContain("Smoke Next Episode");
      expect(payload.feedsSummaryText).toContain("Showing 2 of 2");
      expect(payload.feedsMetricsText).toContain("RSS Ready");
      expect(payload.filteredFeedsText).toContain("Night Transit");
      expect(payload.filteredFeedsText).not.toContain("Smoke Feed");
      expect(payload.filteredFeedsSummaryText).toContain("Showing 1 of 2");
      expect(payload.allSchedulesText).toContain("Smoke Program");
      expect(payload.allSchedulesText).toContain("BBC Smoke Program");
      expect(payload.allSchedulesSummaryText).toContain("3 of 3 subscriptions");
      expect(payload.allSchedulesMetricsText).toContain("Due Soon");
      expect(payload.allSchedulesMetricsText).toContain("Failed Recently");
      expect(payload.filteredSchedulesText).toContain("BBC Smoke Program");
      expect(payload.filteredSchedulesText).not.toContain("RTE Smoke Program");
      expect(payload.filteredSchedulesSummaryText).toContain("1 of 3 subscriptions");
      expect(payload.schedulesCompactMode).toBe(true);
      expect(payload.statsSummaryText).toContain("downloads");
      expect(payload.statsMetricsText).toContain("Subscriptions");
      expect(payload.statsSourceChartText).toContain("BBC");
      expect(payload.statsSourceTableText).toContain("Downloads");
      expect(payload.historyCount).toBe(2);
      expect(payload.historyText).toContain("Smoke Episode");
      expect(payload.historyText).toContain("DJ Smoke");
      expect(payload.historySummaryText).toContain("Showing 2 of 2");
      expect(payload.historyMetricsText).toContain("Programs");
      expect(payload.historyProgramFilterOptions).toContain("Smoke Program (1)");
      expect(payload.historyProgramFilterOptions).toContain("Other Smoke Program (1)");
      expect(payload.filteredHistoryText).toContain("Smoke Episode");
      expect(payload.filteredHistoryText).not.toContain("Second Smoke Episode");
      expect(payload.filteredHistorySummaryText).toContain("Showing 1 of 1");
      expect(payload.queueRecentCount).toBeGreaterThanOrEqual(2);
      expect(payload.queueText).toContain("Smoke Queue Task");
      expect(payload.queueText).toContain("Failed BBC Queue Task");
      expect(payload.queueText).toContain("BBC Host");
      expect(payload.queueSummaryText).toContain("Showing 2 of 2");
      expect(payload.queueMetricsText).toContain("Failed");
      expect(payload.queueMetricsText).toContain("Retry Ready");
      expect(payload.filteredQueueText).toContain("Failed BBC Queue Task");
      expect(payload.filteredQueueText).not.toContain("Smoke Queue Task");
      expect(payload.filteredQueueSummaryText).toContain("Showing 1 of 1");
      expect(payload.rteLiveFrameSrc).toContain("bosco/components/player/iframe.html");
      expect(payload.rteLiveFrameSrc).toContain("clipid=1");
      expect(payload.rteQuickStatusText).toContain("quick-rte-smoke.mp3");
      expect(payload.rteQuickLogText).toContain("Quick RT");
      expect(payload.rteDiscoveryText).toContain("Smoke RTE Show");
      expect(payload.rteProgramMetaText).toContain("Smoke RTE Show");
      expect(payload.rteEpisodesCount).toBeGreaterThanOrEqual(1);
      expect(payload.rteEpisodesText).toContain("Smoke RTE Episode");
      expect(payload.rteEpisodeStatusText).toContain("CUE ready");
      expect(payload.rteEpisodeChaptersText).toContain("Generated Smoke Track");
      expect(payload.nowPlayingTitleText).toContain("RTE Local");
      expect(payload.nowPlayingTrackText).toContain("Local Smoke Track");
      expect(payload.bbcQuickStatusText).toContain("quick-bbc-smoke.mp3");
      expect(payload.bbcQuickLogText).toContain("Quick BBC");
      expect(payload.bbcDiscoveryText).toContain("Smoke BBC Show");
      expect(payload.bbcProgramMetaText).toContain("Smoke BBC Show");
      expect(payload.bbcEpisodesCount).toBeGreaterThanOrEqual(1);
      expect(payload.bbcEpisodesText).toContain("Smoke BBC Episode");
      expect(payload.wwfDiscoveryText).toContain("Smoke WWF Show");
      expect(payload.wwfDiscoveryText).toContain("Discovery results stay here");
      expect(payload.wwfDiscoveryCount).toBeGreaterThanOrEqual(1);
      expect(payload.wwfDiscoveryHidden).toBe(false);
      expect(payload.wwfProgramMetaText).toContain("Smoke WWF Show");
      expect(payload.wwfEpisodesCount).toBeGreaterThanOrEqual(1);
      expect(payload.wwfEpisodesText).toContain("Smoke WWF Episode");
      expect(payload.ntsDiscoveryText).toContain("Smoke NTS Show");
      expect(payload.ntsDiscoveryText).toContain("Discovery results stay here");
      expect(payload.ntsDiscoveryCount).toBeGreaterThanOrEqual(1);
      expect(payload.ntsDiscoveryHidden).toBe(false);
      expect(payload.ntsProgramMetaText).toContain("Smoke NTS Show");
      expect(payload.ntsEpisodesCount).toBeGreaterThanOrEqual(1);
      expect(payload.ntsEpisodesText).toContain("Smoke NTS Episode");
      expect(payload.fipDiscoveryText).toContain("Smoke FIP Show");
      expect(payload.fipProgramMetaText).toContain("Smoke FIP Show");
      expect(payload.fipEpisodesCount).toBeGreaterThanOrEqual(2);
      expect(payload.fipEpisodesText).toContain("FIP Track 143");
      expect(payload.fipEpisodesText).toContain("FIP Track 142");
      expect(payload.fipTracklistCalls.every((entry) => entry && entry.opts && typeof entry.opts === "object")).toBe(true);
      expect(payload.fipNowPlayingTrackText).toContain("FIP Track 143");
      expect(payload.kexpSearchCount).toBeGreaterThanOrEqual(2);
      expect(payload.kexpSearchFilteredCount).toBe(1);
      expect(payload.kexpSearchFilteredText).toContain("Midnight Archive Smoke");
      expect(payload.kexpSearchFilteredText).not.toContain("Smoke KEXP Show");
      expect(payload.kexpLiveInfoText).toContain("Smoke KEXP Show");
      expect(payload.kexpDiscoveryText).toContain("Smoke KEXP Show");
      expect(payload.kexpDiscoveryText).toContain("Discovery stays visible");
      expect(payload.kexpDiscoveryCount).toBeGreaterThanOrEqual(1);
      expect(payload.kexpDiscoveryHidden).toBe(false);
      expect(payload.kexpProgramMetaText).toContain("Smoke KEXP Show");
      expect(payload.kexpArchiveNoticeVisible).toBe(true);
      expect(payload.kexpEpisodesCount).toBeGreaterThanOrEqual(1);
      expect(payload.kexpEpisodesText).toContain("Smoke Episode");
      expect(payload.kexpEpisodesText).toContain("Smoke Archive Episode");
      expect(payload.kexpScheduleText).toContain("Smoke KEXP Show");
      expect(payload.maxConcurrentDownloads).toBeGreaterThan(0);
    } finally {
      server.kill();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    expect(serverStderr).toBe("");
  });
});
