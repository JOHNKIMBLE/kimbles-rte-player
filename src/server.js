const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const {
  LIVE_STATIONS,
  extractRteInfo,
  getEpisodePlaylist,
  getPlaylist,
  getProgramEpisodes,
  getProgramSummary,
  getLiveStationNow,
  normalizeProgramUrl,
  searchPrograms
} = require("./lib/rte");
const { runYtDlpDownload } = require("./lib/downloader");
const { createSchedulerStore } = require("./lib/scheduler");

const app = express();
app.use(express.json({ limit: "1mb" }));
const rendererDir = path.join(__dirname, "renderer");
app.use(express.static(rendererDir));
const progressSubscribers = new Map();

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || "/downloads";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function sanitizeDirName(name) {
  return String(name || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function inferProgramNameFromUrl(inputUrl) {
  try {
    const parsed = new URL(String(inputUrl || ""), "https://www.rte.ie");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "radio" && parts.length >= 3) {
      return parts[2].replace(/-/g, " ");
    }
  } catch {
    return "";
  }
  return "";
}

async function downloadFromManifest({ manifestUrl, title, programTitle, progressToken }) {
  const programFolder = sanitizeDirName(programTitle) || "misc";
  const outputDir = path.join(DOWNLOAD_DIR, programFolder);
  fs.mkdirSync(outputDir, { recursive: true });

  function emitProgress(payload) {
    if (!progressToken) {
      return;
    }
    const listeners = progressSubscribers.get(progressToken);
    if (!listeners || listeners.size === 0) {
      return;
    }
    const event = `data: ${JSON.stringify({ token: progressToken, ...payload })}\n\n`;
    for (const res of listeners) {
      res.write(event);
    }
  }

  const result = await runYtDlpDownload({
    manifestUrl,
    title,
    outputDir,
    onProgress: emitProgress
  });

  return {
    ...result,
    outputDir
  };
}

async function downloadEpisodeByClip({ clipId, title, episodeUrl, programTitle, progressToken }) {
  const playlist = await getPlaylist(String(clipId));
  const resolvedTitle = title || `rte-episode-${clipId}`;
  const download = await downloadFromManifest({
    manifestUrl: playlist.m3u8Url,
    title: resolvedTitle,
    programTitle,
    progressToken
  });

  return {
    clipId: String(clipId),
    episodeUrl: episodeUrl || "",
    title: resolvedTitle,
    playlistApiUrl: playlist.apiUrl,
    m3u8Url: playlist.m3u8Url,
    ...download
  };
}

const scheduler = createSchedulerStore({
  dataDir: DATA_DIR,
  getProgramSummary,
  getProgramEpisodes,
  runEpisodeDownload: async (episode) =>
    downloadEpisodeByClip({
      clipId: episode.clipId,
      title: episode.title,
      programTitle: episode.programTitle,
      episodeUrl: episode.episodeUrl
    })
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/live/stations", (_req, res) => {
  res.json(LIVE_STATIONS);
});

app.get("/api/live/now/:channelId", async (req, res) => {
  try {
    const data = await getLiveStationNow(req.params.channelId);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchPrograms(query);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/program/summary", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const data = await getProgramSummary(programUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const episodes = await getProgramEpisodes(programUrl, page);
    const summary = await getProgramSummary(programUrl);
    res.json({ ...summary, ...episodes });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/episode/playlist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getEpisodePlaylist(episodeUrl);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/progress/stream", (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("event: ready\ndata: ok\n\n");

  let listeners = progressSubscribers.get(token);
  if (!listeners) {
    listeners = new Set();
    progressSubscribers.set(token, listeners);
  }
  listeners.add(res);

  req.on("close", () => {
    const current = progressSubscribers.get(token);
    if (!current) {
      return;
    }
    current.delete(res);
    if (current.size === 0) {
      progressSubscribers.delete(token);
    }
  });
});

app.post("/api/download/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const info = await extractRteInfo(pageUrl);
    const download = await downloadFromManifest({
      manifestUrl: info.m3u8Url,
      title: info.title,
      programTitle: inferProgramNameFromUrl(pageUrl),
      progressToken
    });
    res.json({ ...info, ...download });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/episode", async (req, res) => {
  try {
    const clipId = String(req.body.clipId || "");
    const title = String(req.body.title || "");
    const programTitle = String(req.body.programTitle || "");
    const episodeUrl = String(req.body.episodeUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const data = await downloadEpisodeByClip({ clipId, title, programTitle, episodeUrl, progressToken });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/scheduler", (_req, res) => {
  res.json(scheduler.list());
});

app.post("/api/scheduler", async (req, res) => {
  try {
    const programUrl = normalizeProgramUrl(String(req.body.programUrl || ""));
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const data = await scheduler.add(programUrl, { backfillCount });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = scheduler.setEnabled(req.params.id, enabled);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/scheduler/:id/run", async (req, res) => {
  try {
    const data = await scheduler.checkOne(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/scheduler/:id", (req, res) => {
  scheduler.remove(req.params.id);
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(rendererDir, "index.html"));
});

scheduler.start();
scheduler.runAll().catch(() => {});

app.listen(PORT, () => {
  console.log(`Kimble's RTE Player API listening on ${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
  console.log(`DOWNLOAD_DIR=${DOWNLOAD_DIR}`);
});
