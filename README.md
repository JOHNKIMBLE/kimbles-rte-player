# Kimble's RTE Player

Electron desktop app plus optional web/server mode for browsing, streaming, downloading, scheduling, tagging, and chaptering **RTE, BBC, Worldwide FM, NTS, FIP, and KEXP** radio episodes.

## Scope

- **RTE & BBC**: Live stations, program search, episode explorers, remote/local playback, downloads via `yt-dlp`, schedulers with backfill.
- **Worldwide FM** (worldwidefm.net): Live embed, search shows and hosts, load by name or host URL, episode list from `/shows` and host pages, play (via yt-dlp pipe for Mixcloud), download, schedulers. Host metadata (avatar, cadence, location, bio) via RSC payload parsing.
- **NTS** (nts.live): NTS 1 & 2 live streams with now-playing artwork, search shows, load by URL/slug, episode list (with tracklists), play, download, schedulers.
- **FIP** (radiofrance.fr/fip): 13 live stations with now-playing song and cover art, podcast show browser, episode search, play, download, schedulers. Show titles and airtimes translated to English.
- **KEXP** (kexp.org): Program search, episode list, play (StreamGuys archive or CloudFront extended CDN), download, CUE from KEXP tracklist API. Chapter positions aligned to `sg-offset` (show start within the multi-show recording file).
- Final audio: `ffmpeg` post-process, embedded artwork (`m4a`/`mp3`), optional CUE/chapter generation, queue, optional AudD/AcoustID/Songrec recognition and FFmpeg landmark cue timing.

## Runtime Modes

1. **Desktop app** — Electron UI, local folder picker, IPC bridge through `src/preload.js`
2. **Web/server mode** — Express server with the same core pipeline, browser UI served from renderer assets, Docker/Unraid deployments

## Highlights

- **Tabs**: RTE, BBC, Worldwide FM, NTS, FIP, KEXP, Settings. Each source tab has live (where applicable), quick download by URL, explorer (search + load + episodes), and schedulers.
- **Program Search**: All platforms show rich metadata in search results — broadcast schedule, cadence, location, genres, description, and artwork. Helps you discover and evaluate shows before loading.
- **Per-episode**: Play, Play Local, Download, Generate CUE. Global player with artwork, chapter-aware prev/next, inferred track labels.
- **Queue**: Active, pending, recent; pause, resume, cancel, clear pending.
- **Schedulers**: RTE, BBC, Worldwide FM, NTS, FIP; backfill modes; retry and recovery; local-time display.

### Search and Discovery

**RTE/BBC**: Program search with schedule times and episode counts. Cadence, genre, and airtime pills on program cards.

**NTS**: Search uses two parallel strategies — a paginated show index plus direct slug guessing (15+ variations). Results show cadence, location, broadcast schedule, description, and genre pills.

**Worldwide FM**: Search runs three parallel strategies — episode matching, known host slug matching (from `/shows` and `/shows?type=hosts-series`), and direct host slug guessing. Host results show rich metadata: display name, avatar, cadence, location, and bio. Clicking a host loads their full episode archive via RSC payload parsing. Episode play streams Mixcloud audio via yt-dlp pipe (fast start, no seek).

**FIP**: Podcast show browser via SvelteKit `/__data.json`. 13 live sub-stations (Rock, Jazz, Groove, World, Reggae, Electro, Hip-Hop, Pop, Metal, Nouveautés, Sacré Français, Cultes). Live now-playing fetched via Radio France public API with per-station webradio slug. French airtimes auto-translated to English.

**KEXP**: Program search via KEXP API. Episodes sourced from StreamGuys archive (primary, ~2-week rolling window) with CloudFront CDN fallback for extended archives. Tracklist data from KEXP API (`startSeconds` per track). Chapter positions shifted by `sg-offset` to align with the multi-show recording file structure.

## Download Pipeline

1. `yt-dlp` resolves and downloads the source media.
2. `ffmpeg` performs the final audio conversion and optional normalization.
3. Metadata tagging and artwork embedding are applied after the final file exists.
4. Optional `.cue` generation runs after the media file exists.

### Output Formats

- `m4a` (default)
- `mp3` (optional)

### Artwork Embedding

- `mp3` artwork: embedded through `ffmpeg`
- `m4a` artwork: embedded through `AtomicParsley`

### HLS Behavior

For HLS sources (RTE/BBC `.m3u8` streams), `yt-dlp` is forced to use the `ffmpeg` downloader with `--hls-use-mpegts` enabled.

### Normalization

If enabled, the app runs `ffmpeg` with `loudnorm` during post-processing.

## Chapter and CUE Pipeline

The app supports full CUE generation for local files, cue preview for remote playback, and background chapter refinement while playback runs.

### Cue Worker

Cue generation runs in a child process (`src/lib/cue-worker.js`, client wrapper `src/lib/cue-worker-client.js`).

### Chapter Sources

- RTE episode playlists
- BBC `music played` data
- Curated external tracklists (1001Tracklists, MixesDB)
- AudD / AcoustID / Songrec window recognition
- FFmpeg landmark filters (silencedetect, ebur128, aspectralstats)
- Timing fallback when source data is weak

### Remote Playback

1. Playback starts immediately
2. Cached chapters used if available, otherwise rough fallback
3. Background cue preview runs
4. Player swaps in improved chapters when ready

### Recognition Provider Order

1. AudD → 2. AcoustID → 3. Songrec (each toggled independently)

### FFmpeg Landmark Filters

- `silencedetect`, `ebur128`, `aspectralstats` — estimate chapter landmarks only
- Multiple filters merge into one converged chapter plan

## Queue and Scheduler

### Download Queue

Configurable concurrent downloads, active/pending/recent lists, pause/resume, cancel individual or clear pending.

### Scheduler

Supports RTE, BBC, Worldwide FM, NTS, and FIP programs. Each source has its own scheduler list.

#### How It Works

When you add a program, the scheduler fetches the program summary and recent episodes to determine:

- **Cadence**: daily (avg ≤2 days), weekly (avg ≤9 days), or irregular
- **Run Schedule**: Day(s) and time window, stored in UTC
- **Next Broadcast**: Computed from cadence and most recent episode

The scheduler polls every 30 minutes. For each program:

1. **Schedule window**: Waits until 30 minutes after broadcast ends, then checks within a 6-hour window.
2. **Cadence fallback**: If no schedule window — daily=6h, weekly=24h, irregular=12h intervals.
3. **Episode detection**: Fetches latest episodes, compares against already-downloaded IDs, downloads new ones.

#### Schedule Sources Per Platform

- **RTE**: Schedule text scraped from program page, Dublin time converted to UTC.
- **BBC**: Broadcast times from BBC Sounds API, ISO timestamps to UTC.
- **NTS**: `timeslot` field from NTS API (e.g. "MONDAY - THURSDAY / 10AM - 1PM / WEEKLY"). Falls back to episode timestamp inference. Stored in UTC.
- **Worldwide FM**: Cadence and day/time inferred from recent episode timestamps. Typical broadcast day from frequency analysis, hour from metadata. Stored in UTC.
- **FIP**: Airtime parsed from French show metadata (e.g. "Tous les jours à 19h"), converted Paris → UTC. Cadence derived from day pattern keywords.

#### Timezone Handling

All schedule times are stored in UTC internally. The scheduler compares UTC against UTC windows.

The UI converts UTC → user's local timezone for display. The 12h/24h setting controls time format throughout.

#### Backfill

- **New episodes only**: Track new episodes going forward
- **Latest N now**: Download N recent episodes immediately, then new-only

#### Retry and Recovery

Failed downloads retry with exponential backoff (15m → 1h → 3h → 12h → 24h → 48h). Dropped after 7 attempts. Auto-retries with forced redownload when archive says "done" but file is missing.

## Settings

### General

- **Time Format**: 12-hour or 24-hour display
- **Episodes Per Page**: Number of episodes shown per page in all program explorers (RTE, BBC, NTS, WWF, FIP). Default: 5.

### Download Path

- Base download directory
- Path format with token preview and presets

### Download Engine

- Audio format (m4a / mp3) and quality (128K–320K / Best VBR)
- Generate CUE/chapters on download
- Loudness normalization
- Max concurrent downloads (1–8)
- Duplicate handling (source-id / title-date / none)
- ID3 tagging
- Feed export (JSON/RSS)
- Webhook URL

### Track Alignment

- AudD mix recognition + API token
- AcoustID fingerprint matching + API key
- Songrec window recognition + sample length
- FFmpeg cue landmark filters (silence, loudness, spectral)

### Path Tokens

Default: `{radio}/{program}/{episode_short} {release_date}`

Tokens: `{radio}`, `{program}`, `{program_slug}`, `{episode}`, `{episode_short}`, `{episode_slug}`, `{release_date}`, `{year}`, `{month}`, `{day}`, `{date_compact}`, `{source_id}`

### Duplicate Handling

Modes: `source-id`, `title-date`, `none`. Force redownload supported in download UI and scheduler flows.

## Storage and State

### Desktop

Settings and state in Electron app data directory. Central download archive: `download-archive.txt`.

### Docker/Web

Defaults: `DATA_DIR=/data`, `DOWNLOAD_DIR=/downloads`, archive at `/data/download-archive.txt`.

Linux/Unraid permissions: directories `0777`, files `0666`.

## Requirements

- Node.js 20+
- Bundled or system `ffmpeg`
- Bundled or system `yt-dlp`

Optional: `Songrec`, `fpcalc` (AcoustID), `AtomicParsley` (m4a artwork), AudD API token, AcoustID API key.

## Vendored Binaries

Under `vendor/`: `yt-dlp`, `ffmpeg`, `songrec`, `chromaprint` (`fpcalc`), `atomicparsley`.

Bootstrap downloads binaries for the current platform. For all platforms: `npm run bootstrap:all-binaries`.

## Quick Start

### Desktop

```bash
npm install
npm start
```

### Web/Server

```bash
npm install
npm run start:server
```

Open `http://localhost:8080/`.

## Docker / Unraid

```bash
docker compose up -d --build
```

Default: port `8080`, `DATA_DIR=/data`, `DOWNLOAD_DIR=/downloads`, `TZ=Europe/Dublin`.

- UI: `http://<host>:8080/`
- API: `http://<host>:8080/api/*`
- Unraid template: `unraid/kimbles-rte-player.xml`

## Build

```bash
npm run pack:win
npm run pack:mac
```

Artifacts in `dist/`. Packaging includes vendored binaries and prunes non-target platforms.

## HTTP API Overview

Express exposes health, live/station data, program search, episode lists, playlist lookup, stream resolution, download-by-URL (RTE, BBC, WWF, NTS, FIP), progress events, local playback/cue, queue control, cue generate/preview, and scheduler CRUD + run. See `src/server.js`. Electron IPC mirrors via `src/main.js` and `src/preload.js`.

## Troubleshooting

### RTE or BBC HLS download fails

Check: `ffmpeg` available, target path writable, stream not expired.

### Final file has no artwork

Check: tagging enabled, source has artwork, `AtomicParsley` for m4a / `ffmpeg` for mp3.

### CUE generation is slow or falls back

Use the episode card cue debug log for HLS sample planning, extraction failures, recognition results, and convergence summary.

### No chapters during live station playback

Expected: cue preview applies to episode playback, not live streams.

### NTS search shows no results

NTS search uses parallel strategies: paginated index + slug guessing (15+ variations). If a show has an unusual slug, the direct lookup should still find it.

### WWF search shows no results

WWF search merges results from `/shows`, `/shows?type=hosts-series`, and host page archives via RSC payload parsing. If a host only appears on their host page, it should still be discoverable through slug guessing.

### WWF episode won't seek

Expected behavior. WWF episodes play via a yt-dlp pipe stream (Mixcloud uses AES-128 HLS encryption; the browser cannot decrypt it directly). The pipe delivers fast start (~5–10s) but no Content-Length, so the browser audio element cannot seek. Download the episode to get a local seekable file.

### KEXP episode won't play or shows no chapters

- Episodes older than ~2 weeks may fall back to the CloudFront CDN. If the CDN also misses, an error is shown on the card.
- Tracklist chapters require KEXP API data (`startSeconds`). They are loaded automatically when you press Play and passed through `playEpisodeWithBackgroundCue`.
- Chapter timestamps are show-relative and are shifted by `sg-offset` so they align with the StreamGuys multi-show recording file.

### FIP live shows no now-playing data

FIP sub-stations use `GET /fip/api/live?webradio=fip_X` (e.g. `fip_cultes`, `fip_hiphop`). The main FIP station uses `GET /fip/api/live` with no webradio param. Song data falls back to `api.radiofrance.fr/livemeta/pull/{id}` for stations where livemeta is supported (IDs 7, 64–78). Newer station IDs (95, 96, 709) are not supported by livemeta/pull and rely entirely on the webradio API.

## Third-Party Components

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense)
- [FFmpeg](https://ffmpeg.org/legal.html) (LGPL/GPL)
- [Songrec](https://github.com/marin-m/SongRec)
- [Chromaprint / fpcalc](https://github.com/acoustid/chromaprint)
- [AtomicParsley](https://github.com/wez/atomicparsley)
- [AudD API](https://docs.audd.io/)
