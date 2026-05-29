const fs = require("fs");
const https = require("node:https");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const request = require("supertest");

describe("server workflow contracts", () => {
  let app;
  let tmpDir;
  let fetchMock;
  let httpsRequestMock;
  let episodeCallCount;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rte-workflows-"));
    process.env.DATA_DIR = tmpDir;
    process.env.DOWNLOAD_DIR = tmpDir;
    episodeCallCount = 0;

    fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    }));
    global.fetch = fetchMock;

    httpsRequestMock = jest.spyOn(https, "request").mockImplementation((opts, callback) => {
      const written = [];
      const incoming = Readable.from([]);
      incoming.statusCode = 200;
      incoming.statusMessage = "OK";
      incoming.headers = {};
      const req = {
        on: jest.fn().mockReturnThis(),
        write: jest.fn((buf) => {
          if (buf) {
            written.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
          }
        }),
        end: jest.fn(() => {
          queueMicrotask(() => {
            req._bodyUtf8 = written.length ? Buffer.concat(written).toString("utf8") : "";
            req._opts = opts;
            callback(incoming);
          });
        })
      };
      return req;
    });

    jest.resetModules();
    jest.doMock("../src/lib/vendor-bootstrap", () => ({
      runVendorBootstrap: jest.fn(async () => ({ ok: true, code: 0, output: "bootstrap complete" })),
      getBootstrapScriptPath: jest.fn(() => "/mock/bootstrap-yt-dlp.js")
    }));
    jest.doMock("../src/lib/rte", () => ({
      LIVE_STATIONS: [{ id: "rte-radio-1", name: "RTE Radio 1" }],
      extractRteInfo: jest.fn(),
      getEpisodePlaylist: jest.fn(async () => ({ tracks: [] })),
      getPlaylist: jest.fn(async () => ({ items: [] })),
      getProgramSummary: jest.fn(async (programUrl) => ({
        programUrl,
        title: "Night Tracks",
        description: "Workflow contract test",
        image: "https://example.com/show.jpg",
        runSchedule: "Mon • 20:00 - 22:00"
      })),
      getProgramEpisodes: jest.fn(async () => {
        episodeCallCount += 1;
        if (episodeCallCount === 1) {
          return {
            title: "Night Tracks",
            cadence: "weekly",
            episodes: [
              {
                clipId: "clip-1",
                title: "Episode 1",
                episodeUrl: "https://example.com/episode-1",
                publishedTime: "2026-03-16",
                image: "https://example.com/episode-1.jpg"
              }
            ]
          };
        }
        return {
          title: "Night Tracks",
          cadence: "weekly",
          episodes: [
            {
              clipId: "clip-2",
              title: "Episode 2",
              episodeUrl: "https://example.com/episode-2",
              publishedTime: "2026-03-23",
              image: "https://example.com/episode-2.jpg"
            },
            {
              clipId: "clip-1",
              title: "Episode 1",
              episodeUrl: "https://example.com/episode-1",
              publishedTime: "2026-03-16",
              image: "https://example.com/episode-1.jpg"
            }
          ]
        };
      }),
      getLiveStationNow: jest.fn(async () => ({ title: "Now Playing" })),
      normalizeProgramUrl: jest.fn((url) => String(url || "").trim()),
      getRteDiscovery: jest.fn(async () => []),
      searchPrograms: jest.fn(async () => []),
      configure: jest.fn()
    }));
    jest.doMock("../src/lib/downloader", () => ({
      runYtDlpDownload: jest.fn(async (input = {}) => ({
        outputDir: input.outputDir || tmpDir,
        fileName: `${String(input.sourceId || input.clipId || "download")}.mp3`,
        log: "ok"
      })),
      runYtDlpJson: jest.fn(async () => ({})),
      spawnYtDlpPipe: jest.fn()
    }));
    jest.doMock("../src/lib/tags", () => ({
      applyId3Tags: jest.fn(async () => null),
      resolveBundledAtomicParsleyBinary: jest.fn(() => "")
    }));
    jest.doMock("../src/lib/cue-reader", () => ({
      readCueChaptersForAudio: jest.fn(() => [])
    }));
    jest.doMock("../src/lib/cue-worker-client", () => ({
      runCueTaskInChild: jest.fn(async () => null)
    }));

    app = require("../src/server");
  });

  afterEach(() => {
    httpsRequestMock.mockRestore();
    delete global.fetch;
    delete process.env.DATA_DIR;
    delete process.env.DOWNLOAD_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("scheduler add/patch/run exports feeds and posts webhook", async () => {
    const settingsRes = await request(app)
      .post("/api/settings")
      .send({
        webhookUrl: "https://hooks.example.test/downloads",
        feedExportEnabled: true
      });
    expect(settingsRes.status).toBe(200);

    const addRes = await request(app)
      .post("/api/scheduler")
      .send({ programUrl: "https://example.com/program/night-tracks" });
    expect(addRes.status).toBe(200);
    expect(addRes.body).toMatchObject({
      title: "Night Tracks",
      enabled: true
    });

    const disableRes = await request(app)
      .patch(`/api/scheduler/${addRes.body.id}`)
      .send({ enabled: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.enabled).toBe(false);

    const enableRes = await request(app)
      .patch(`/api/scheduler/${addRes.body.id}`)
      .send({ enabled: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.enabled).toBe(true);

    const runRes = await request(app)
      .post(`/api/scheduler/${addRes.body.id}/run`)
      .send({});
    expect(runRes.status).toBe(200);
    expect(runRes.body.downloaded).toHaveLength(1);
    expect(runRes.body.downloaded[0]).toMatchObject({
      clipId: "clip-2"
    });
    expect(runRes.body.downloaded[0].fileName).toMatch(/\.mp3$/);

    const feedsRes = await request(app).get("/api/feeds");
    expect(feedsRes.status).toBe(200);
    expect(feedsRes.body.feeds).toHaveLength(1);
    expect(feedsRes.body.feeds[0]).toMatchObject({
      title: "Night Tracks",
      sourceType: "rte"
    });
    expect(feedsRes.body.feeds[0].rssUrl).toContain(".rss.xml");
    expect(fs.existsSync(feedsRes.body.feeds[0].jsonPath)).toBe(true);

    expect(httpsRequestMock).toHaveBeenCalledTimes(2);
    const webhookEvents = [];
    for (const result of httpsRequestMock.mock.results) {
      const req = result.value;
      expect(req._opts.hostname).toBe("hooks.example.test");
      expect(req._opts.method).toBe("POST");
      expect(req._opts.headers["Content-Type"]).toBe("application/json");
      webhookEvents.push(JSON.parse(req._bodyUtf8));
    }
    expect(webhookEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "download.saved",
        source: "rte",
        title: "Night Tracks",
        episodeTitle: "Episode 2"
      }),
      expect.objectContaining({
        event: "download.complete",
        source: "rte",
        title: "Night Tracks",
        count: 1
      })
    ]));
  });
});
