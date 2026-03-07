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
const {
  getBbcEpisodePlaylist,
  getBbcLiveStations,
  getBbcProgramEpisodes,
  getBbcProgramSummary,
  normalizeBbcProgramUrl,
  searchBbcPrograms
} = require("./lib/bbc");
const { runYtDlpDownload } = require("./lib/downloader");
const { runYtDlpJson } = require("./lib/downloader");
const { createSchedulerStore } = require("./lib/scheduler");

const app = express();
app.use(express.json({ limit: "1mb" }));
const rendererDir = path.join(__dirname, "renderer");
app.use(express.static(rendererDir));
app.use("/build", express.static(path.join(__dirname, "..", "build")));
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
    if (parsed.hostname.includes("bbc.")) {
      return "BBC";
    }
  } catch {
    return "";
  }
  return "";
}

function toCanonicalBbcEpisodeUrl(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (!/bbc\./i.test(parsed.hostname)) {
      return raw;
    }
    const match = parsed.pathname.match(/\/sounds\/play\/([a-z0-9]{8})/i);
    if (match?.[1]) {
      return `https://www.bbc.co.uk/programmes/${match[1].toLowerCase()}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

function shouldRetryBbcWithFallback(error) {
  const text = String(error?.message || "");
  return /\[bbc\]/i.test(text) && /Unable to extract playlist data/i.test(text);
}

function inferTitleFromUrl(inputUrl, fallback = "audio") {
  try {
    const parsed = new URL(String(inputUrl || ""), "https://example.com");
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const clean = last
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (clean) {
      return clean;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

async function downloadFromManifest({ manifestUrl, sourceUrl, title, programTitle, progressToken, sourceType = "rte" }) {
  const sourceRoot = sourceType === "bbc" ? "BBC" : "RTE";
  const programFolder = sanitizeDirName(programTitle) || "misc";
  const outputDir = path.join(DOWNLOAD_DIR, sourceRoot, programFolder);
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
    sourceUrl,
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
    progressToken,
    sourceType: "rte"
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

const bbcScheduler = createSchedulerStore({
  dataDir: path.join(DATA_DIR, "bbc"),
  getProgramSummary: async (programUrl) => getBbcProgramSummary(programUrl, runYtDlpJson),
  getProgramEpisodes: async (programUrl, page) => getBbcProgramEpisodes(programUrl, runYtDlpJson, page),
  runEpisodeDownload: async (episode) =>
    downloadFromManifest({
      sourceUrl: String(episode.episodeUrl || ""),
      manifestUrl: String(episode.episodeUrl || ""),
      title: String(episode.title || "bbc-episode"),
      programTitle: String(episode.programTitle || "BBC"),
      sourceType: "bbc"
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

app.get("/api/bbc/live/stations", async (_req, res) => {
  try {
    const data = await getBbcLiveStations(runYtDlpJson);
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

app.get("/api/bbc/program/search", async (req, res) => {
  try {
    const query = String(req.query.q || "");
    const data = await searchBbcPrograms(query, runYtDlpJson);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/bbc/program/episodes", async (req, res) => {
  try {
    const programUrl = String(req.query.url || "");
    const page = Number(req.query.page || 1);
    const data = await getBbcProgramEpisodes(programUrl, runYtDlpJson, page);
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

app.get("/api/bbc/episode/playlist", async (req, res) => {
  try {
    const episodeUrl = String(req.query.url || "");
    const data = await getBbcEpisodePlaylist(episodeUrl);
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
      progressToken,
      sourceType: "rte"
    });
    res.json({ ...info, ...download });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/download/bbc/url", async (req, res) => {
  try {
    const pageUrl = String(req.body.pageUrl || "");
    const progressToken = String(req.body.progressToken || "");
    const providedTitle = String(req.body.title || "").trim();
    const providedProgramTitle = String(req.body.programTitle || "").trim();
    const inferredTitle = providedTitle || inferTitleFromUrl(pageUrl, "bbc-audio");
    const canonicalUrl = toCanonicalBbcEpisodeUrl(pageUrl);
    const attemptUrls = Array.from(new Set([canonicalUrl, String(pageUrl).trim()].filter(Boolean)));
    let download = null;
    let lastError = null;
    let usedUrl = canonicalUrl || String(pageUrl).trim();

    for (let i = 0; i < attemptUrls.length; i += 1) {
      const candidate = attemptUrls[i];
      try {
        download = await downloadFromManifest({
          sourceUrl: candidate,
          manifestUrl: candidate,
          title: inferredTitle,
          programTitle: providedProgramTitle || inferProgramNameFromUrl(candidate) || inferProgramNameFromUrl(pageUrl) || "BBC",
          progressToken,
          sourceType: "bbc"
        });
        usedUrl = candidate;
        break;
      } catch (error) {
        lastError = error;
        const hasNext = i < attemptUrls.length - 1;
        if (!hasNext || !shouldRetryBbcWithFallback(error)) {
          throw error;
        }
      }
    }

    if (!download) {
      throw lastError || new Error("BBC download failed.");
    }

    res.json({ pageUrl, sourceUrlUsed: usedUrl, title: inferredTitle, ...download });
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

app.get("/api/bbc/scheduler", (_req, res) => {
  res.json(bbcScheduler.list());
});

app.post("/api/bbc/scheduler", async (req, res) => {
  try {
    const programUrl = normalizeBbcProgramUrl(String(req.body.programUrl || ""));
    const backfillCount = Math.max(0, Math.floor(Number(req.body.backfillCount || 0)));
    const data = await bbcScheduler.add(programUrl, { backfillCount });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/bbc/scheduler/:id", (req, res) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const data = bbcScheduler.setEnabled(req.params.id, enabled);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/bbc/scheduler/:id/run", async (req, res) => {
  try {
    const data = await bbcScheduler.checkOne(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/bbc/scheduler/:id", (req, res) => {
  bbcScheduler.remove(req.params.id);
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(rendererDir, "index.html"));
});

scheduler.start();
scheduler.runAll().catch(() => {});
bbcScheduler.start();
bbcScheduler.runAll().catch(() => {});

app.listen(PORT, () => {
  console.log(`Kimble's RTE Player API listening on ${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
  console.log(`DOWNLOAD_DIR=${DOWNLOAD_DIR}`);
});
