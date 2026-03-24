# Kimble's RTE Player

Kimble's RTE Player is a multi-source radio app for browsing, streaming, downloading, scheduling, and organizing shows from:

- RTE
- BBC Sounds
- Worldwide FM
- NTS
- FIP
- KEXP

It runs in two modes:

- Electron desktop app
- Express web/server app on port `8080`

## Highlights

- Live playback and program exploration across 6 sources
- Episode downloads via `yt-dlp` and `ffmpeg`
- `m4a` and `mp3` output with artwork, tags, tracklists, and chapters
- Optional physical `.cue` sidecars
- Playback queue with auto-play next
- Local-file tracklists sourced from the original episode page when available
- Persistent download queue with pause, resume, cancel, rerun, and retry support
- Source schedulers with backfill, retry queues, and run-now controls
- Per-program download rules:
  - custom folders
  - custom path formats
  - retention rules
  - rerun skipping
- Path format tokens including `{program}`, `{episode}`, `{host}`, `{hosts}`, `{source_type}`, and date tokens
- Library workspace with subscriptions, collections, metadata explorer, entity graph, feeds, queue, history, and diagnostics
- Source health, thin-doc diagnostics, reharvest, and deep reharvest controls
- Binary diagnostics and one-click vendor repair

## Library

The Library tab is the main control center for the app.

It includes:

- combined subscriptions across all sources
- smart and manual collections
- metadata explorer and harvested discovery
- entity graph and entity profiles
- metadata repair tools
- program feed exports
- download queue and download history
- diagnostics, source health, and thin-doc inspection

Recent UX additions:

- Library jump bar for faster navigation
- collapsible Library sections with saved open/closed state
- Library Health cards: click a source to open Subscriptions filtered to that source
- Active tab (source, Library, Settings) is remembered across refresh
- Subscriptions: **Program Page** opens the show’s website in your browser; **Open Explorer** still loads the in-app program view
- Program Feeds **Refresh Feeds**: shows progress text and rebuilds JSON/RSS from current subscriptions when feed export is enabled (otherwise reloads the list from disk)
- Subscription cards surface retry-wait counts under **Last run** when applicable (no separate retry column)
- Metadata Explorer: **subscription-based suggestions** rank harvested/discovery items against your active subscriptions (same source filter and search box as below); excludes programs you already subscribe to

## Audio Metadata

- `m4a`
  - artwork
  - tags
  - embedded tracklists
  - native chapters

- `mp3`
  - artwork
  - tags
  - text tracklists
  - ID3 chapter frames

Settings split:

- `cueAutoGenerate`
  - controls physical `.cue` sidecars

- `id3Tagging`
  - controls embedded metadata and embedded chapters/tracklists

## Quick Start

### Desktop

```bash
npm install
npm start
```

### Web / Server

```bash
npm install
npm run start:server
```

Then open `http://localhost:8080/`.

### Docker

```bash
docker compose up -d --build
```

The local Docker setup uses:

- `PORT=8080`
- `DATA_DIR=/data`
- `DOWNLOAD_DIR=/downloads`
- `TZ=Europe/Dublin`

## Requirements

- Node.js 20+
- `yt-dlp`
- `ffmpeg`

Optional tools and services:

- `AtomicParsley`
- `songrec`
- `fpcalc`
- AudD API token
- AcoustID API key

Desktop builds and Docker packaging can use bundled vendor binaries from `vendor/`.

## Docker Notes

The repo Docker image is server-mode only.

It includes:

- `yt-dlp`
- `ffmpeg`
- `songrec`
- `AtomicParsley`
- Chromaprint / `fpcalc`

Main environment variables:

- `PORT`
- `DATA_DIR`
- `DOWNLOAD_DIR`
- `TZ`

See [DOCKERHUB_README.md](./DOCKERHUB_README.md) for the Docker Hub specific copy.

## Scripts

```bash
npm start
npm run start:server
npm test
npm run lint
npm run bootstrap:all-binaries
npm run pack:win
npm run pack:mac
npm run pack:mac:dir
```

## Storage

Desktop mode stores app state under the Electron user-data directory.

Server mode uses:

- `DATA_DIR`
  - settings
  - schedules
  - feeds
  - queue state
  - history
  - collections
  - harvested metadata
  - materialized metadata index and entity graph snapshots

- `DOWNLOAD_DIR`
  - final audio files

## Project Structure

```text
src/
  main.js                  Electron runtime
  server.js                Express runtime
  preload.js               Electron bridge
  lib/                     Core logic, source adapters, queue, scheduler, metadata, diagnostics
  renderer/                UI shell and screen modules
scripts/
  bootstrap-yt-dlp.js
  after-pack-prune-vendor-binaries.js
vendor/
  yt-dlp, ffmpeg, songrec, chromaprint, atomicparsley
```

## Documentation

- `README.md`
  - user-facing overview
- `CLAUDE.md`
  - concise operational repo guide
- `CONTEXT.md`
  - verbose engineering map
- `DOCKERHUB_README.md`
  - Docker Hub focused copy

## Troubleshooting

- If downloads fail, check binary and writable-path diagnostics in Library.
- If chapters or tracklists are missing, use `Rebuild Tags/Chapters` from History after fixing settings.
- If metadata looks thin, check source health and run `Reharvest` or `Deep Reharvest`.
- If vendor binaries are missing, use `Repair Binaries` from Diagnostics.

## License

MIT
