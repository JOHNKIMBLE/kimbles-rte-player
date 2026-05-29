const { app, BrowserWindow } = require("electron");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");

async function run() {
  const url = process.argv[2];
  if (!url) {
    throw new Error("URL argument is required.");
  }

  await app.whenReady();

  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 980,
    webPreferences: {
      contextIsolation: false,
      sandbox: false
    }
  });

  await win.loadURL(url);

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (predicate, timeoutMs = 3000, stepMs = 50) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          if (predicate()) {
            return true;
          }
          await wait(stepMs);
        }
        return Boolean(predicate());
      };
      HTMLMediaElement.prototype.play = function play() {
        this.dispatchEvent(new Event("loadedmetadata"));
        this.dispatchEvent(new Event("playing"));
        return Promise.resolve();
      };
      window.confirm = () => true;
      window.rteDownloader.getLiveNow = async () => ({
        stationName: "RTÃ‰ 2FM",
        programmeName: "Smoke Live",
        description: "Smoke RTÃ‰ live description"
      });
      window.rteDownloader.getKexpNowPlaying = async () => ({
        play: {
          artist: "Smoke Artist",
          title: "Smoke Track",
          album: "Smoke Album",
          comment: "Smoke comment"
        },
        show: {
          hosts: "DJ Smoke",
          programTitle: "Smoke KEXP Show",
          image: ""
        }
      });
      window.rteDownloader.searchKexpPrograms = async () => ([
        {
          programUrl: "https://api.kexp.org/v2/programs/42/",
          title: "Smoke KEXP Show",
          description: "A smoke-test KEXP program",
          genres: ["Eclectic"],
          cadence: "weekly",
          location: "Seattle",
          airtime: "Fridays 6pm"
        },
        {
          programUrl: "https://api.kexp.org/v2/programs/77/",
          title: "Midnight Archive Smoke",
          description: "A second smoke-test KEXP program",
          genres: ["Ambient"],
          cadence: "monthly",
          location: "Portland",
          airtime: "Sundays 11pm"
        }
      ]);
      window.rteDownloader.getKexpDiscovery = async () => ([
        {
          programUrl: "https://api.kexp.org/v2/programs/42/",
          title: "Smoke KEXP Show",
          description: "A smoke-test KEXP program",
          genres: ["Eclectic"],
          cadence: "weekly",
          location: "Seattle",
          airtime: "Fridays 6pm"
        }
      ]);
      window.rteDownloader.getKexpProgramSummary = async () => ({
        title: "Smoke KEXP Show",
        description: "Program summary for smoke tests",
        image: "",
        genres: ["Eclectic"],
        cadence: "weekly",
        location: "Seattle"
      });
      window.rteDownloader.getKexpProgramEpisodes = async () => ({
        total: 1,
        hasMore: false,
        episodes: [
          {
            episodeUrl: "https://www.kexp.org/shows/smoke-episode/",
            fullTitle: "Smoke Episode",
            title: "Smoke Episode",
            publishedTime: "2026-03-16T18:00:00.000Z",
            endTime: "2026-03-16T20:00:00.000Z",
            hosts: "DJ Smoke",
            genres: ["Eclectic"],
            image: ""
          }
        ]
      });
      window.rteDownloader.getKexpEpisodeTracklist = async () => ({
        tracks: [
          { artist: "Smoke Artist", title: "Smoke Track", startSeconds: 0 }
        ]
      });
      window.rteDownloader.listSchedules = async () => ([
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
          lastRunAt: "2026-03-16T18:10:00.000Z",
          lastStatus: "Enabled"
        }
      ]);
      window.rteDownloader.listBbcSchedules = async () => ([
        {
          id: "bbc-sched-1",
          programUrl: "https://example.com/program/bbc-smoke",
          title: "BBC Smoke Program",
          description: "Smoke test BBC schedule",
          image: "",
          runSchedule: "Wed 18:00",
          nextBroadcastAt: "2026-03-17T00:00:00.000Z",
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
          lastCheckedAt: "2026-03-16T18:15:00.000Z",
          lastRunAt: "2026-03-16T18:20:00.000Z",
          lastStatus: "Failed once"
        }
      ]);
      window.rteDownloader.listWwfSchedules = async () => new Promise(() => {});
      window.rteDownloader.listNtsSchedules = async () => {
        throw new Error("NTS schedule fixture failure");
      };
      window.rteDownloader.listFipSchedules = async () => ({ not: "an array" });
      window.rteDownloader.listKexpSchedules = async () => ([
        {
          id: "kexp-sched-1",
          programUrl: "https://api.kexp.org/v2/programs/42/",
          title: "Smoke KEXP Show",
          description: "Smoke test KEXP schedule",
          image: "",
          runSchedule: "Fri • 18:00 - 20:00",
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
          lastRunAt: "2026-03-16T18:10:00.000Z",
          lastStatus: "Enabled"
        }
      ]);
      window.rteDownloader.searchKexpExtendedPrograms = async () => ([
        {
          programUrl: "https://www.kexp.org/archive/shows/smoke-archive/",
          title: "Smoke KEXP Show",
          description: "Extended archive show for smoke tests",
          genres: ["Archive"],
          cadence: "weekly",
          location: "Seattle",
          image: ""
        }
      ]);
      window.rteDownloader.getKexpExtendedDiscovery = async () => ([
        {
          programUrl: "https://www.kexp.org/archive/shows/smoke-archive/",
          title: "Smoke KEXP Show",
          description: "Extended archive show for smoke tests",
          genres: ["Archive"],
          cadence: "weekly",
          location: "Seattle",
          image: ""
        }
      ]);
      window.rteDownloader.getKexpExtendedProgramSummary = async () => ({
        title: "Smoke KEXP Show",
        description: "Extended archive summary",
        genres: ["Archive"],
        image: ""
      });
      window.rteDownloader.getKexpExtendedProgramEpisodes = async () => ({
        total: 1,
        hasMore: false,
        episodes: [
          {
            episodeUrl: "https://www.kexp.org/archive/mixes/smoke-mix/",
            fullTitle: "Smoke Archive Episode",
            title: "Smoke Archive Episode",
            publishedTime: "2026-03-09T18:00:00.000Z",
            duration: 7200,
            hosts: "DJ Archive",
            image: ""
          }
        ]
      });
      window.rteDownloader.getKexpExtendedEpisodeTracklist = async () => ({
        tracks: [
          { artist: "Archive Artist", title: "Archive Track", startSeconds: 0 }
        ]
      });
      window.rteDownloader.getRteDiscovery = async () => ([
        {
          programUrl: "https://www.rte.ie/radio/radio1/clips/12345678/",
          title: "Smoke RTE Show",
          description: "A smoke-test RTÉ program",
          genres: ["Talk"],
          runSchedule: "Mon 18:00",
          image: ""
        }
      ]);
      window.rteDownloader.getProgramEpisodes = async () => ({
        programUrl: "https://www.rte.ie/radio/radio1/clips/12345678/",
        title: "Smoke RTE Show",
        description: "Program summary for smoke tests",
        image: "",
        genres: ["Talk"],
        runSchedule: "Mon 18:00",
        nextBroadcastAt: "",
        nextBroadcastTitle: "",
        cadence: "weekly",
        episodes: [
          {
            clipId: "rte-clip-1",
            episodeUrl: "https://www.rte.ie/radio/radio1/clips/22334455/",
            title: "Smoke RTE Episode",
            fullTitle: "Smoke RTE Episode",
            publishedTime: "2026-03-16T18:00:00.000Z",
            publishedTimeFormatted: "16 Mar 2026",
            durationString: "00:30:00",
            image: ""
          }
        ]
      });
      window.rteDownloader.getEpisodePlaylist = async () => ({
        tracks: [
          { artist: "Smoke Artist", title: "Smoke RTE Track", startSeconds: 0 }
        ]
      });
      window.rteDownloader.downloadFromPageUrl = async () => ({
        outputDir: "C:\\\\SmokeDownloads",
        fileName: "quick-rte-smoke.mp3",
        log: "Quick RTÉ download ok",
        cue: {
          cuePath: "C:\\\\SmokeDownloads\\\\quick-rte-smoke.cue",
          source: "rte-episode-playlist",
          alignment: { method: "tracklist", confidence: 0.98 }
        }
      });
      window.rteDownloader.downloadEpisode = async () => ({
        outputDir: "C:\\\\SmokeDownloads",
        fileName: "rte-episode-smoke.mp3",
        cue: {
          cuePath: "C:\\\\SmokeDownloads\\\\rte-episode-smoke.cue",
          source: "rte-episode-playlist",
          alignment: { method: "tracklist", confidence: 0.97 },
          chapters: [
            { start: "00:00", title: "Downloaded Smoke Track", artist: "Smoke Artist" }
          ]
        }
      });
      window.rteDownloader.getLocalPlaybackUrl = async () => "https://example.com/local-smoke.mp3";
      window.rteDownloader.getLocalCueChapters = async () => ([
        { start: "00:00", title: "Local Smoke Track", artist: "Smoke Artist" }
      ]);
      window.rteDownloader.generateCue = async (payload) => ({
        cuePath: "C:\\\\SmokeDownloads\\\\" + String(payload?.fileName || "generated-smoke.mp3") + ".cue",
        source: String(payload?.sourceType || "rte") + "-episode-playlist",
        alignment: { method: "tracklist", confidence: 0.99 },
        chapters: [
          { start: "00:00", title: "Generated Smoke Track", artist: "Smoke Artist" }
        ]
      });
      window.rteDownloader.downloadFromBbcUrl = async () => ({
        outputDir: "C:\\\\SmokeDownloads",
        fileName: "quick-bbc-smoke.mp3",
        log: "Quick BBC download ok",
        cue: {
          cuePath: "C:\\\\SmokeDownloads\\\\quick-bbc-smoke.cue",
          source: "bbc-music-played",
          alignment: { method: "tracklist", confidence: 0.96 }
        }
      });
      window.rteDownloader.getBbcDiscovery = async () => ([
        {
          programUrl: "https://www.bbc.co.uk/programmes/m000smoke",
          title: "Smoke BBC Show",
          description: "A smoke-test BBC program",
          genres: ["Music"],
          cadence: "weekly",
          image: ""
        }
      ]);
      window.rteDownloader.getBbcProgramEpisodes = async () => ({
        programUrl: "https://www.bbc.co.uk/programmes/m000smoke",
        title: "Smoke BBC Show",
        description: "BBC summary for smoke tests",
        image: "",
        genres: ["Music"],
        cadence: "weekly",
        nextBroadcastAt: "",
        nextBroadcastTitle: "",
        episodes: [
          {
            episodeUrl: "https://www.bbc.co.uk/sounds/play/p0smoke",
            downloadUrl: "https://www.bbc.co.uk/sounds/play/p0smoke",
            title: "Smoke BBC Episode",
            publishedTime: "2026-03-16",
            durationSeconds: 1800,
            image: ""
          }
        ]
      });
      window.rteDownloader.getBbcEpisodePlaylist = async () => ({
        tracks: [
          { artist: "Smoke Artist", title: "Smoke BBC Track", startSeconds: 0 }
        ]
      });
      window.rteDownloader.getWwfDiscovery = async () => ({
        results: [
          {
            programUrl: "https://worldwidefm.net/shows/smoke-wwf-show",
            title: "Smoke WWF Show",
            description: "A smoke-test Worldwide FM show",
            genres: ["Eclectic"],
            cadence: "weekly",
            location: "London",
            image: ""
          }
        ]
      });
      window.rteDownloader.getWwfProgramEpisodes = async () => ({
        programUrl: "https://worldwidefm.net/shows/smoke-wwf-show",
        title: "Smoke WWF Show",
        description: "Worldwide FM summary for smoke tests",
        image: "",
        genres: ["Eclectic"],
        cadence: "weekly",
        location: "London",
        runSchedule: "Tue 20:00",
        nextBroadcastAt: "",
        nextBroadcastTitle: "",
        totalItems: 1,
        episodes: [
          {
            episodeUrl: "https://worldwidefm.net/episodes/smoke-wwf-episode",
            title: "Smoke WWF Episode",
            fullTitle: "Smoke WWF Episode",
            publishedTime: "2026-03-16",
            image: "",
            hosts: ["DJ Smoke"]
          }
        ]
      });
      window.rteDownloader.getWwfEpisodePlaylist = async () => ({
        tracks: [
          { artist: "Smoke Artist", title: "Smoke WWF Track", startSeconds: 0 }
        ]
      });
      window.rteDownloader.getNtsDiscovery = async () => ({
        results: [
          {
            programUrl: "https://www.nts.live/shows/smoke-nts-show",
            title: "Smoke NTS Show",
            description: "A smoke-test NTS show",
            genres: ["Electronic"],
            cadence: "weekly",
            location: "London",
            image: ""
          }
        ]
      });
      window.rteDownloader.getNtsProgramEpisodes = async () => ({
        programUrl: "https://www.nts.live/shows/smoke-nts-show",
        title: "Smoke NTS Show",
        description: "NTS summary for smoke tests",
        image: "",
        genres: ["Electronic"],
        cadence: "weekly",
        location: "London",
        runSchedule: "Wed 21:00",
        nextBroadcastAt: "",
        nextBroadcastTitle: "",
        totalItems: 1,
        episodes: [
          {
            episodeUrl: "https://www.nts.live/shows/smoke-nts-show/episodes/smoke-nts-episode",
            title: "Smoke NTS Episode",
            fullTitle: "Smoke NTS Episode",
            publishedTime: "2026-03-16",
            image: "",
            genres: ["Electronic"]
          }
        ]
      });
      window.rteDownloader.getNtsEpisodePlaylist = async () => ({
        tracks: [
          { artist: "Smoke Artist", title: "Smoke NTS Track", startSeconds: 0 }
        ]
      });
      window.rteDownloader.getFipDiscovery = async () => ({
        results: [
          {
            programUrl: "https://www.radiofrance.fr/fip/podcasts/smoke-fip-show",
            title: "Smoke FIP Show",
            description: "A smoke-test FIP show",
            genres: ["Ambient"],
            cadence: "weekly",
            image: "",
            hosts: ["DJ Smoke"]
          }
        ]
      });
      window.rteDownloader.getFipProgramEpisodes = async () => ({
        programUrl: "https://www.radiofrance.fr/fip/podcasts/smoke-fip-show",
        title: "Smoke FIP Show",
        description: "FIP summary for smoke tests",
        image: "",
        genres: ["Ambient"],
        cadence: "weekly",
        hosts: ["DJ Smoke"],
        totalItems: 2,
        episodes: [
          {
            episodeUrl: "https://www.radiofrance.fr/fip/podcasts/smoke-fip-show/smoke-fip-143",
            title: "Smoke FIP Episode 143",
            fullTitle: "Smoke FIP Episode 143",
            publishedTime: "2026-03-16",
            image: "",
            broadcastStartTs: 1773684000,
            duration: 7200,
            hosts: ["DJ Smoke"],
            genres: ["Ambient"]
          },
          {
            episodeUrl: "https://www.radiofrance.fr/fip/podcasts/smoke-fip-show/smoke-fip-142",
            title: "Smoke FIP Episode 142",
            fullTitle: "Smoke FIP Episode 142",
            publishedTime: "2026-03-09",
            image: "",
            broadcastStartTs: 1773079200,
            duration: 7200,
            hosts: ["DJ Smoke"],
            genres: ["Ambient"]
          }
        ]
      });
      window.__fipTracklistCalls = [];
      window.rteDownloader.getFipEpisodeTracklist = async (episodeUrl, opts) => {
        window.__fipTracklistCalls.push({ episodeUrl, opts });
        if (!opts || typeof opts !== "object") {
          return [];
        }
        if (String(episodeUrl).includes("143") && Number(opts.startTs) === 1773684000) {
          return [{ artist: "FIP Artist 143", title: "FIP Track 143", startSeconds: 0 }];
        }
        if (String(episodeUrl).includes("142") && Number(opts.startTs) === 1773079200) {
          return [{ artist: "FIP Artist 142", title: "FIP Track 142", startSeconds: 0 }];
        }
        return [];
      };
      window.rteDownloader.getFipEpisodeStream = async () => ({
        streamUrl: "https://example.com/fip-smoke.mp3",
        title: "Smoke FIP Episode 143",
        image: ""
      });
      window.rteDownloader.listProgramFeeds = async () => ({
        feeds: [
          {
            sourceType: "rte",
            title: "Smoke Feed",
            slug: "smoke-feed",
            description: "Feed metadata description for smoke tests",
            programUrl: "https://example.com/program/smoke",
            jsonUrl: "http://127.0.0.1/feed/smoke.json",
            rssUrl: "http://127.0.0.1/feed/smoke.xml",
            jsonPath: "C:\\\\SmokeDownloads\\\\smoke.json",
            episodeCount: 3,
            updatedAt: "2026-03-16T18:10:00.000Z",
            location: "Dublin",
            hosts: ["DJ Smoke"],
            genres: ["Talk", "Interview"],
            runSchedule: "Mon • 18:00 - 19:00",
            nextBroadcastAt: "2026-03-17T18:00:00.000Z",
            nextBroadcastTitle: "Smoke Next Episode",
            latestEpisodeTitle: "Smoke Feed Episode",
            latestEpisodePublishedTime: "2026-03-16T18:00:00.000Z",
            latestEpisodeDescription: "Latest feed episode description",
            latestEpisodeLocation: "Studio Smoke",
            latestEpisodeHosts: ["DJ Smoke"],
            latestEpisodeGenres: ["Talk"]
          },
          {
            sourceType: "bbc",
            title: "Night Transit",
            slug: "night-transit",
            description: "BBC feed metadata description for smoke tests",
            programUrl: "https://example.com/program/night-transit",
            jsonUrl: "http://127.0.0.1/feed/night-transit.json",
            rssUrl: "http://127.0.0.1/feed/night-transit.xml",
            jsonPath: "C:\\\\SmokeDownloads\\\\night-transit.json",
            episodeCount: 2,
            updatedAt: "2026-03-15T23:10:00.000Z",
            location: "London",
            hosts: ["Ben Smoke"],
            genres: ["Electronic", "Ambient"],
            runSchedule: "Wed • 23:00 - 01:00",
            nextBroadcastAt: "2026-03-18T23:00:00.000Z",
            nextBroadcastTitle: "Night Transit Next",
            latestEpisodeTitle: "Night Transit Episode",
            latestEpisodePublishedTime: "2026-03-15T23:00:00.000Z",
            latestEpisodeDescription: "Late-night BBC metadata description",
            latestEpisodeLocation: "Studio 6",
            latestEpisodeHosts: ["Ben Smoke"],
            latestEpisodeGenres: ["Electronic"]
          }
        ]
      });
      window.rteDownloader.refreshProgramFeeds = async () => {
        const data = await window.rteDownloader.listProgramFeeds();
        return {
          ok: true,
          rebuilt: 2,
          errors: [],
          message: "Rebuilt 2 feed file(s) from current subscriptions.",
          feeds: data.feeds
        };
      };
      window.rteDownloader.openExternalUrl = async () => ({ ok: true });
      document.getElementById("feedsRefreshBtn")?.click();
      await wait(1200);
      const feedsText = document.getElementById("feedsList")?.textContent || "";
      const feedsSummaryText = document.getElementById("feedsSummary")?.textContent || "";
      const feedsMetricsText = document.getElementById("feedsMetrics")?.textContent || "";
      const feedsSourceFilter = document.getElementById("feedsSourceFilter");
      if (feedsSourceFilter) {
        feedsSourceFilter.value = "bbc";
        feedsSourceFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const feedsSearchInput = document.getElementById("feedsSearchInput");
      if (feedsSearchInput) {
        feedsSearchInput.value = "ambient";
        feedsSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await wait(250);
      const filteredFeedsText = document.getElementById("feedsList")?.textContent || "";
      const filteredFeedsSummaryText = document.getElementById("feedsSummary")?.textContent || "";
      document.getElementById("tabSchedulesBtn")?.click();
      await wait(1200);
      for (let attempts = 0; attempts < 10; attempts += 1) {
        const text = document.getElementById("allSchedulesList")?.textContent || "";
        if (text && !text.includes("Fetching") && !text.includes("Loading...")) {
          break;
        }
        await wait(250);
      }
      const allSchedulesText = document.getElementById("allSchedulesList")?.textContent || "";
      const allSchedulesSummaryText = document.getElementById("allSchedulesSummary")?.textContent || "";
      const allSchedulesMetricsText = document.getElementById("allSchedulesMetrics")?.textContent || "";
      const allSchedulesViewMode = document.getElementById("allSchedulesViewMode");
      if (allSchedulesViewMode) {
        allSchedulesViewMode.value = "compact";
        allSchedulesViewMode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const allSchedulesSourceFilter = document.getElementById("allSchedulesSourceFilter");
      const allSchedulesStatusFilter = document.getElementById("allSchedulesStatusFilter");
      if (allSchedulesSourceFilter) {
        allSchedulesSourceFilter.value = "bbc";
        allSchedulesSourceFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (allSchedulesStatusFilter) {
        allSchedulesStatusFilter.value = "attention";
        allSchedulesStatusFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const allSchedulesSearchInput = document.getElementById("allSchedulesSearchInput");
      if (allSchedulesSearchInput) {
        allSchedulesSearchInput.value = "failed once";
        allSchedulesSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await wait(200);
      const filteredSchedulesText = document.getElementById("allSchedulesList")?.textContent || "";
      const filteredSchedulesSummaryText = document.getElementById("allSchedulesSummary")?.textContent || "";
      const schedulesCompactMode = document.getElementById("allSchedulesList")?.classList.contains("subscriptions-compact") || false;
      document.getElementById("tabStatsBtn")?.click();
      await wait(1200);
      for (let attempts = 0; attempts < 10; attempts += 1) {
        const text = document.getElementById("statsSummary")?.textContent || "";
        if (text && !text.includes("Loading stats")) {
          break;
        }
        await wait(250);
      }
      const statsSummaryText = document.getElementById("statsSummary")?.textContent || "";
      const statsMetricsText = document.getElementById("statsMetrics")?.textContent || "";
      const statsSourceChartText = document.getElementById("statsSourceChart")?.textContent || "";
      const statsSourceTableText = document.getElementById("statsSourceTable")?.textContent || "";
      document.getElementById("tabHistoryBtn")?.click();
      await wait(1200);
      for (let attempts = 0; attempts < 10; attempts += 1) {
        const text = document.getElementById("historyList")?.textContent || "";
        if (text && !text.includes("Loading")) {
          break;
        }
        await wait(250);
      }
      const historyText = document.getElementById("historyList")?.textContent || "";
      const historySummaryText = document.getElementById("historySummary")?.textContent || "";
      const historyMetricsText = document.getElementById("historyMetrics")?.textContent || "";
      const historyProgramFilterOptions = Array.from(document.querySelectorAll("#historyProgramFilter option")).map((option) => option.textContent || "");
      const historyProgramFilter = document.getElementById("historyProgramFilter");
      if (historyProgramFilter) {
        historyProgramFilter.value = "Smoke Program";
        historyProgramFilter.dispatchEvent(new Event("change", { bubbles: true }));
        await wait(200);
      }
      const filteredHistoryText = document.getElementById("historyList")?.textContent || "";
      const filteredHistorySummaryText = document.getElementById("historySummary")?.textContent || "";
      const queueText = document.getElementById("downloadQueueRecent")?.textContent || "";
      const queueSummaryText = document.getElementById("queueRecentSummary")?.textContent || "";
      const queueMetricsText = document.getElementById("queueMetrics")?.textContent || "";
      const queueRecentSourceFilter = document.getElementById("queueRecentSourceFilter");
      const queueRecentStatusFilter = document.getElementById("queueRecentStatusFilter");
      if (queueRecentSourceFilter) {
        queueRecentSourceFilter.value = "bbc";
        queueRecentSourceFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (queueRecentStatusFilter) {
        queueRecentStatusFilter.value = "failed";
        queueRecentStatusFilter.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await wait(200);
      const filteredQueueText = document.getElementById("downloadQueueRecent")?.textContent || "";
      const filteredQueueSummaryText = document.getElementById("queueRecentSummary")?.textContent || "";
      document.getElementById("tabRteBtn")?.click();
      await wait(500);
      await waitFor(() => Boolean(window.rteDownloader?.downloadFromPageUrl) && !document.getElementById("quickDownloadBtn")?.disabled, 5000);
      const rteLiveFrameSrc = document.getElementById("livePlayerFrame")?.src || "";
      document.getElementById("quickUrlInput").value = "https://www.rte.ie/radio/smoke-quick";
      document.getElementById("quickDownloadBtn")?.click();
      await waitFor(() => {
        const quickResultText = document.getElementById("quickResult")?.textContent || "";
        const quickLogText = document.getElementById("quickLog")?.textContent || "";
        return quickResultText.includes("quick-rte-smoke.mp3") || quickLogText.includes("Quick RT");
      }, 8000);
      const rteQuickStatusText = document.getElementById("quickResult")?.textContent || "";
      const rteQuickLogText = document.getElementById("quickLog")?.textContent || "";
      document.getElementById("rteDiscoverBtn")?.click();
      await wait(500);
      document.querySelector("#rteDiscoveryResult [data-load-program-url]")?.click();
      await wait(700);
      document.querySelector('#episodesResult button[data-download-clip="rte-clip-1"]')?.click();
      await wait(500);
      document.querySelector('#episodesResult button[data-play-local-clip="rte-clip-1"]')?.click();
      await wait(500);
      document.querySelector('#episodesResult button[data-generate-cue-clip="rte-clip-1"]')?.click();
      await wait(500);
      const rteDiscoveryText = document.getElementById("rteDiscoveryResult")?.textContent || "";
      const rteProgramMetaText = document.getElementById("programMeta")?.textContent || "";
      const rteEpisodesText = document.getElementById("episodesResult")?.textContent || "";
      const rteEpisodesCount = document.querySelectorAll("#episodesResult .item").length;
      const rteEpisodeStatusText = document.querySelector('[data-episode-status="rte-clip-1"]')?.textContent || "";
      const rteEpisodeChaptersText = document.querySelector('[data-episode-chapters="rte-clip-1"]')?.textContent || "";
      const nowPlayingTitleText = document.getElementById("nowPlayingTitle")?.textContent || "";
      const nowPlayingTrackText = document.getElementById("nowPlayingTrack")?.textContent || "";
      document.getElementById("tabBbcBtn")?.click();
      await wait(500);
      await waitFor(() => Boolean(window.rteDownloader?.downloadFromBbcUrl) && !document.getElementById("bbcDownloadBtn")?.disabled, 5000);
      document.getElementById("bbcUrlInput").value = "https://www.bbc.co.uk/sounds/play/smoke-quick";
      document.getElementById("bbcDownloadBtn")?.click();
      await waitFor(() => {
        const bbcResultText = document.getElementById("bbcResult")?.textContent || "";
        const bbcLogText = document.getElementById("bbcLog")?.textContent || "";
        return bbcResultText.includes("quick-bbc-smoke.mp3") || bbcLogText.includes("Quick BBC");
      }, 8000);
      document.getElementById("bbcDiscoverBtn")?.click();
      await wait(500);
      document.querySelector("#bbcDiscoveryResult [data-load-bbc-program-url]")?.click();
      await wait(700);
      const bbcQuickStatusText = document.getElementById("bbcResult")?.textContent || "";
      const bbcQuickLogText = document.getElementById("bbcLog")?.textContent || "";
      const bbcDiscoveryText = document.getElementById("bbcDiscoveryResult")?.textContent || "";
      const bbcProgramMetaText = document.getElementById("bbcProgramMeta")?.textContent || "";
      const bbcEpisodesText = document.getElementById("bbcEpisodesResult")?.textContent || "";
      const bbcEpisodesCount = document.querySelectorAll("#bbcEpisodesResult .item").length;
      document.getElementById("tabWwfBtn")?.click();
      await wait(500);
      document.getElementById("wwfDiscoverBtn")?.click();
      await wait(500);
      document.querySelector("#wwfDiscoveryResult [data-wwf-pick-program]")?.click();
      await wait(700);
      const wwfDiscoveryText = document.getElementById("wwfDiscoveryResult")?.textContent || "";
      const wwfDiscoveryCount = document.querySelectorAll("#wwfDiscoveryResult [data-wwf-pick-program]").length;
      const wwfDiscoveryHidden = document.getElementById("wwfDiscoveryResult")?.classList.contains("hidden") || false;
      const wwfProgramMetaText = document.getElementById("wwfProgramMeta")?.textContent || "";
      const wwfEpisodesText = document.getElementById("wwfEpisodesResult")?.textContent || "";
      const wwfEpisodesCount = document.querySelectorAll("#wwfEpisodesResult .item").length;
      document.getElementById("tabNtsBtn")?.click();
      await wait(500);
      document.getElementById("ntsDiscoverBtn")?.click();
      await wait(500);
      document.querySelector("#ntsDiscoveryResult [data-nts-program-url]")?.click();
      await wait(700);
      const ntsDiscoveryText = document.getElementById("ntsDiscoveryResult")?.textContent || "";
      const ntsDiscoveryCount = document.querySelectorAll("#ntsDiscoveryResult [data-nts-program-url]").length;
      const ntsDiscoveryHidden = document.getElementById("ntsDiscoveryResult")?.classList.contains("hidden") || false;
      const ntsProgramMetaText = document.getElementById("ntsProgramMeta")?.textContent || "";
      const ntsEpisodesText = document.getElementById("ntsEpisodesResult")?.textContent || "";
      const ntsEpisodesCount = document.querySelectorAll("#ntsEpisodesResult .item").length;
      document.getElementById("tabFipBtn")?.click();
      await wait(500);
      document.getElementById("fipDiscoverBtn")?.click();
      await wait(500);
      document.querySelector("#fipDiscoveryResult [data-fip-program-url]")?.click();
      await wait(900);
      document.querySelector('#fipEpisodesResult button[data-fip-play-url]')?.click();
      await wait(700);
      const fipDiscoveryText = document.getElementById("fipDiscoveryResult")?.textContent || "";
      const fipProgramMetaText = document.getElementById("fipProgramMeta")?.textContent || "";
      const fipEpisodesText = document.getElementById("fipEpisodesResult")?.textContent || "";
      const fipEpisodesCount = document.querySelectorAll("#fipEpisodesResult .item").length;
      const fipTracklistCalls = Array.isArray(window.__fipTracklistCalls) ? window.__fipTracklistCalls.slice() : [];
      const fipNowPlayingTrackText = document.getElementById("nowPlayingTrack")?.textContent || "";
      document.getElementById("tabKexpBtn")?.click();
      await wait(700);
      document.getElementById("kexpProgramSearchBtn")?.click();
      await wait(500);
      const kexpSearchCount = document.querySelectorAll("#kexpProgramSearchResult [data-kexp-program-url]").length;
      const kexpProgramResultFilterInput = document.getElementById("kexpProgramResultFilterInput");
      if (kexpProgramResultFilterInput) {
        kexpProgramResultFilterInput.value = "Portland";
        kexpProgramResultFilterInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await wait(250);
      const kexpSearchFilteredText = document.getElementById("kexpProgramSearchResult")?.textContent || "";
      const kexpSearchFilteredCount = document.querySelectorAll("#kexpProgramSearchResult [data-kexp-program-url]").length;
      if (kexpProgramResultFilterInput) {
        kexpProgramResultFilterInput.value = "";
        kexpProgramResultFilterInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await wait(250);
      document.getElementById("kexpDiscoverBtn")?.click();
      await wait(700);
      document.querySelector("#kexpDiscoveryResult [data-kexp-program-url]")?.click();
      await wait(700);
      const kexpLiveInfoText = document.getElementById("kexpLiveInfo")?.textContent || "";
      const kexpDiscoveryText = document.getElementById("kexpDiscoveryResult")?.textContent || "";
      const kexpDiscoveryCount = document.querySelectorAll("#kexpDiscoveryResult [data-kexp-program-url]").length;
      const kexpDiscoveryHidden = document.getElementById("kexpDiscoveryResult")?.classList.contains("hidden") || false;
      const kexpProgramMetaText = document.getElementById("kexpProgramMeta")?.textContent || "";
      const kexpEpisodesText = document.getElementById("kexpEpisodesResult")?.textContent || "";
      const kexpEpisodesCount = document.querySelectorAll("#kexpEpisodesResult .item").length;
      const kexpScheduleText = document.getElementById("kexpScheduleList")?.textContent || "";
      const kexpArchiveNoticeVisible = (document.getElementById("kexpProgramMeta")?.textContent || "").includes("Older archive episodes are folded into this explorer automatically.");
      document.getElementById("tabSettingsBtn")?.click();
      await wait(500);
      const settings = await window.rteDownloader.getSettings();
      const queue = await window.rteDownloader.getDownloadQueueSnapshot();
      const historyPayload = await window.rteDownloader.listDownloadHistory();
      const historyItems = Array.isArray(historyPayload?.history) ? historyPayload.history : [];
      return {
        activeTab: document.querySelector(".tab-btn.active")?.id || "",
        settingsVisible: !document.getElementById("settingsTabContent")?.classList.contains("hidden"),
        hasSaveSettings: Boolean(document.getElementById("saveSettingsBtn")),
        allSchedulesText,
        allSchedulesSummaryText,
        allSchedulesMetricsText,
        feedsText,
        feedsSummaryText,
        feedsMetricsText,
        filteredFeedsText,
        filteredFeedsSummaryText,
        filteredSchedulesText,
        filteredSchedulesSummaryText,
        schedulesCompactMode,
        statsSummaryText,
        statsMetricsText,
        statsSourceChartText,
        statsSourceTableText,
        historyText,
        historySummaryText,
        historyMetricsText,
        historyProgramFilterOptions,
        filteredHistoryText,
        filteredHistorySummaryText,
        queueText,
        queueSummaryText,
        queueMetricsText,
        filteredQueueText,
        filteredQueueSummaryText,
        rteLiveFrameSrc,
        rteQuickStatusText,
        rteQuickLogText,
        rteDiscoveryText,
        rteProgramMetaText,
        rteEpisodesText,
        rteEpisodesCount,
        rteEpisodeStatusText,
        rteEpisodeChaptersText,
        nowPlayingTitleText,
        nowPlayingTrackText,
        bbcQuickStatusText,
        bbcQuickLogText,
        bbcDiscoveryText,
        bbcProgramMetaText,
        bbcEpisodesText,
        bbcEpisodesCount,
        wwfDiscoveryText,
        wwfDiscoveryCount,
        wwfDiscoveryHidden,
        wwfProgramMetaText,
        wwfEpisodesText,
        wwfEpisodesCount,
        ntsDiscoveryText,
        ntsDiscoveryCount,
        ntsDiscoveryHidden,
        ntsProgramMetaText,
        ntsEpisodesText,
        ntsEpisodesCount,
        fipDiscoveryText,
        fipProgramMetaText,
        fipEpisodesText,
        fipEpisodesCount,
        fipTracklistCalls,
        fipNowPlayingTrackText,
        kexpSearchCount,
        kexpSearchFilteredText,
        kexpSearchFilteredCount,
        kexpLiveInfoText,
        kexpDiscoveryText,
        kexpDiscoveryCount,
        kexpDiscoveryHidden,
        kexpProgramMetaText,
        kexpEpisodesText,
        kexpEpisodesCount,
        kexpScheduleText,
        kexpArchiveNoticeVisible,
        queueRecentCount: Array.isArray(queue?.recent) ? queue.recent.length : -1,
        historyCount: historyItems.length,
        maxConcurrentDownloads: Number(settings?.maxConcurrentDownloads || 0)
      };
    })();
  `, true);

  process.stdout.write(`${JSON.stringify(result)}\n`);
  await win.close();
  await app.quit();
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  app.exit(1);
});
