# CLAUDE.md — Kimble's RTE Player

## Project Overview

Electron desktop app + Express web/server mode for browsing, streaming, downloading, scheduling, tagging, and chaptering radio episodes from **RTE**, **BBC**, **Worldwide FM**, and **NTS**.

**Version**: 2.8.9 | **License**: MIT | **Node**: 20+ | **Electron**: 37+

## Runtime Modes

1. **Desktop** — `npm start` → Electron UI, IPC via `src/preload.js`, local folder picker
2. **Web/Server** — `npm run start:server` → Express on port 8080, browser UI from renderer assets, Docker/Unraid
3. **Docker** — `docker compose up -d --build` → port 8080, `DATA_DIR=/data`, `DOWNLOAD_DIR=/downloads`, `TZ=Europe/Dublin`

## Architecture

```
src/
├── main.js            Electron main process, IPC handlers (mirrors server routes)
├── preload.js         contextBridge API exposed as window.rteDownloader
├── server.js          Express server, REST API, SSE progress, static renderer
├── lib/
│   ├── rte.js         RTÉ: 9 live stations, search, episodes, HLS streams, playlists
│   ├── bbc.js         BBC: 7 live stations, Sounds API, search, episodes, streams
│   ├── nts.js         NTS: 2 live streams, API + slug-guessing search, tracklists
│   ├── worldwidefm.js WWF: live embed, RSC payload parsing, host metadata, Mixcloud
│   ├── downloader.js  yt-dlp wrapper, ffmpeg post-process, HLS handling
│   ├── scheduler.js   Per-source scheduler store, cadence detection, backfill, retry
│   ├── download-queue.js  Concurrent queue with pause/resume/cancel
│   ├── path-format.js Token-based output path templating
│   ├── tags.js        ID3/MP4 tagging, AtomicParsley for m4a artwork
│   ├── cue.js         CUE generation: silence/energy/loudness/spectral detection, AudD/AcoustID/Songrec
│   ├── cue-worker.js  Child process entry for CUE generation
│   ├── cue-worker-client.js  Client wrapper for cue-worker child process
│   ├── cue-reader.js  Parse .cue files back into chapter arrays
│   └── feeds.js       RSS/JSON feed export per scheduled program
└── renderer/
    ├── index.html     Main UI template (tabs: RTE, BBC, WWF, NTS, Settings)
    ├── renderer.js    ~4600 lines, all UI logic, state management, event handlers
    ├── styles.css     ~940 lines
    └── web-api-bridge.js  HTTP bridge for server mode (replaces IPC)
```

## Key Technical Details

### Source Integration Patterns

**RTE** (`src/lib/rte.js`): Scrapes RTÉ Radio Player pages, extracts clip IDs, resolves HLS `.m3u8` streams via RTÉ API. Search across 4 main stations. Schedule text scraped from program pages, Dublin time → UTC.

**BBC** (`src/lib/bbc.js`): Uses BBC Sounds API for search, episodes, streams. Broadcast times from API as ISO timestamps → UTC. 7 live stations (some disabled via `DISABLED_BBC_STATION_IDS`).

**NTS** (`src/lib/nts.js`): Uses NTS API (`/api/v2/`) for shows, episodes, search. Search runs two parallel strategies: paginated show index + direct slug guessing (15+ variations via `generateSlugGuesses()`). `timeslot` field parsed for schedule (e.g. "MONDAY - THURSDAY / 10AM - 1PM / WEEKLY"). Shows cadence, location, broadcast schedule, description, and genre tags in search results.

**Worldwide FM** (`src/lib/worldwidefm.js`): Next.js App Router site using RSC (React Server Components). Data extracted by parsing `self.__next_f.push()` payloads from HTML. Host slugs scraped from both `/shows` and `/shows?type=hosts-series` in parallel. Search runs three parallel strategies: episode matching, known host slug matching, direct host slug guessing. Host metadata (description, cadence, location) extracted by positional scoping in RSC chunks — find `displayName`, then walk forward to `show.metadata.description` within bounded range. Episodes resolved via Mixcloud URLs embedded in RSC data.

### RSC Payload Parsing (WWF)

WWF uses Cosmic JS CMS behind Next.js. The RSC payloads contain serialized component data in `self.__next_f.push([1, "..."])` blocks. Key extraction patterns:
- Host slugs: `"slug":"([a-z0-9-]+)","title":"([^"]+)"` — filter out date-pattern slugs
- Host metadata: Positionally scoped — find `displayName` index, then find `"show":{` after it, then `"metadata":{` within 500 chars, then `"description"` within 3000 chars of metadata
- Episode data: `"slug":"YYYY-MM-DD-title"` patterns with Mixcloud URLs
- Type slug: Find `"type":{` within 1000 chars after `displayName`, extract slug

### Download Pipeline

1. `yt-dlp` resolves and downloads source media
2. For HLS (RTE/BBC `.m3u8`): forced `ffmpeg` downloader with `--hls-use-mpegts`
3. `ffmpeg` post-processes: format conversion, optional `loudnorm` normalization
4. `tags.js` applies ID3/MP4 metadata and artwork (`AtomicParsley` for m4a, `ffmpeg` for mp3)
5. Optional CUE/chapter generation after media file exists

### Timezone Handling

- All `runSchedule` times stored in **UTC** internally
- Scheduler compares UTC against UTC windows
- Renderer converts UTC → user's local timezone for display
- 12h/24h format setting controls display throughout
- Helper functions: `toLocalSchedule(runSchedule)`, `localizeNextBroadcast(isoString)`

### Client-Side Pagination

Server APIs return 20 items per page. Client re-paginates based on user's `episodesPerPage` setting (default 5):
```
serverPage = Math.ceil(((clientPage - 1) * perPage + 1) / 20)
clientOffset = ((targetPage - 1) * perPage) % 20
episodes = serverResponse.slice(clientOffset, clientOffset + perPage)
```

### Scheduler System

Each source (RTE, BBC, NTS, WWF) has its own scheduler store created via `createSchedulerStore()`. Schedules persist to `{dataDir}/{source}-schedules.json`.

- **Cadence detection**: daily (avg ≤2 days), weekly (avg ≤9 days), irregular
- **Poll interval**: 30 minutes
- **Check logic**: Wait 30min after broadcast ends, then check within 6h window
- **Cadence fallback**: daily=6h, weekly=24h, irregular=12h intervals
- **Backfill**: "new only" or "latest N now" (download N recent immediately)
- **Retry**: Exponential backoff 15m → 1h → 3h → 12h → 24h → 48h, drop after 7 attempts

### CUE/Chapter Generation

Runs in child process via `cue-worker.js`. Multiple detection algorithms merged:
- **Silence detection**: `ffmpeg silencedetect`
- **Energy boundaries**: `ffmpeg ebur128`
- **Spectral flux**: `ffmpeg aspectralstats`
- **Recognition**: AudD API → AcoustID/fpcalc → Songrec (each toggled independently)
- **Source tracklists**: RTE playlists, BBC "music played", 1001Tracklists, MixesDB

### Download Queue

`createDownloadQueue(getConcurrency)` — concurrent task queue with:
- Active/pending/recent lists
- Pause/resume/cancel individual or clear pending
- Configurable concurrency (1–8)
- SSE progress events via `/api/progress/stream`

## API Surface

### Express Routes (server.js)

Per-source pattern (RTE, BBC, WWF, NTS):
- `GET /api/{source}/live/stations` — Live station list
- `GET /api/{source}/live/now/:channelId` — Now playing
- `GET /api/{source}/program/search` — Search programs
- `GET /api/{source}/program/episodes` — Get episodes (paginated)
- `GET /api/{source}/program/summary` — Program metadata
- `GET /api/{source}/episode/playlist` — Episode tracklist
- `GET /api/{source}/episode/stream` — Resolve stream URL
- `POST /api/download/{source}/url` — Download by URL

Scheduler CRUD per source:
- `GET/POST /api/{source}/scheduler` — List/add
- `PATCH/DELETE /api/{source}/scheduler/:id` — Update/remove
- `POST /api/{source}/scheduler/:id/run` — Run now

Queue: `/api/download-queue/*` (stats, snapshot, pause, resume, cancel, clear-pending)

Other: `/api/settings`, `/api/local-playback-url`, `/api/local-audio/:token`, `/api/cue/generate`, `/api/cue/preview`, `/api/progress/stream` (SSE)

### IPC Handlers (main.js)

Mirror all Express routes via `ipcMain.handle()`. Channel naming: `{source}-{action}` (e.g. `nts-program-search`, `wwf-scheduler-add`).

### Preload API (preload.js)

Exposed as `window.rteDownloader` via `contextBridge.exposeInMainWorld()`. Methods map 1:1 to IPC handlers. Web mode uses `web-api-bridge.js` which replaces IPC calls with HTTP fetch to Express.

## Renderer State & UI (renderer.js)

Single `state` object holds all UI state. Key properties:
- `episodesPerPage` (default 5) — controls pagination across all explorers
- `timeFormat` ("12h"/"24h") — controls time display
- Per-source: loaded program, episodes, current page, search results
- Player state: current track, chapters, artwork, playback position
- Queue state: active/pending/recent downloads

Tabs: RTE, BBC, Worldwide FM, NTS, Settings. Each source tab has:
- Live section (stations, now playing)
- Quick download by URL
- Program explorer (search → load → episodes with pagination)
- Scheduler management (add/remove/enable/disable/run/backfill)

Settings sections: General (time format, episodes per page), Download Path (base dir, path format tokens), Download Engine (format, quality, CUE, normalization, concurrency, duplicates, tagging, feeds, webhook), Track Alignment (AudD, AcoustID, Songrec, FFmpeg landmark filters).

## Vendored Binaries

Under `vendor/`: `yt-dlp`, `ffmpeg`, `songrec`, `chromaprint` (fpcalc), `atomicparsley`.

Platform dirs: `{tool}/bin/{platform}-{arch}/` (win32-x64, darwin-x64, darwin-arm64, linux-x64, linux-arm64).

`npm run postinstall` runs `scripts/bootstrap-yt-dlp.js` to download binaries for current platform. `npm run bootstrap:all-binaries` downloads for all platforms.

## Build & Package

```bash
npm run pack:win    # electron-builder --win portable
npm run pack:mac    # electron-builder --mac dmg zip
```

Output in `dist/`. `scripts/after-pack-prune-vendor-binaries.js` removes non-target platform binaries from packaged app.

## Settings Persistence

- **Desktop**: Electron app data directory (`app.getPath('userData')`)
- **Docker/Web**: `DATA_DIR` env var (default `/data`)
- Settings file: `settings.json`
- Download archive: `download-archive.txt`
- Scheduler files: `{source}-schedules.json`

## Duplicate Handling

Modes: `source-id` (track by source episode ID), `title-date` (track by title+date combo), `none` (no dedup). Force redownload available in UI and scheduler. Archive stored in `download-archive.txt`.

## Output Path Tokens

Default format: `{radio}/{program}/{episode_short} {release_date}`

Available: `{radio}`, `{program}`, `{program_slug}`, `{episode}`, `{episode_short}`, `{episode_slug}`, `{release_date}`, `{year}`, `{month}`, `{day}`, `{date_compact}`, `{source_id}`
