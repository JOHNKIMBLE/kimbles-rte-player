# Kimble's RTE Player

Cross-source radio app for browsing, playing, downloading, scheduling, and organizing shows from:

- RTE
- BBC
- Worldwide FM
- NTS
- FIP
- KEXP

It runs as either:

- an Electron desktop app
- an Express server with the same UI in the browser

## What It Does

- Live playback and program exploration across six sources
- Metadata-aware search and discovery
- Episode downloads with `yt-dlp` and `ffmpeg`
- Embedded tags, artwork, tracklists, and chapters in `m4a` and `mp3`
- Optional physical `.cue` sidecars
- Persistent download queue with pause, resume, cancel, and rerun
- Per-program schedulers with backfill, feed export, and Library controls
- Collections, metadata explorer, entity graph, and graph-powered recommendations
- Binary diagnostics, harvest diagnostics, and one-click vendor repair
- Materialized metadata/graph snapshots for faster startup and Library loads

## Main UI Areas

- Source tabs: RTE, BBC, Worldwide FM, NTS, FIP, KEXP
- Library tab:
  - subscriptions across all sources
  - collections and smart recommendations
  - metadata explorer and harvested discovery
  - entity graph and entity profiles
  - program feeds
  - download queue
  - download history
  - diagnostics and harvest health
- Settings tab:
  - output path and naming
  - audio format and quality
  - embedded tagging and chapter options
  - duplicate handling
  - webhook, feed export, and recognition settings

## Library Highlights

- `Subscriptions`: combined scheduler view with source/status/search/sort controls
- `Collections`: save shows, hosts, genres, locations, and episodes, then build new collections from graph-linked entities
- `Metadata Explorer`: search local library metadata plus harvested discovery cache
- `Entity Graph`: normalized hosts, programs, episodes, genres, and locations with direct and second-order recommendations
- `Open Explorer`: jump from Library items back into the source Program Explorer
- `Rebuild Tags/Chapters`: reprocess existing downloaded files without redownloading

## Audio Metadata

- `m4a`: embeds artwork, tags, tracklists, and native chapters
- `mp3`: embeds artwork, tags, text tracklists, and ID3 chapter frames
- Chapter titles prefer `artist - track title` when tracklist data exists
- `Write physical .cue file on download`: controls sidecar `.cue` output
- `Write ID3 tags + embedded tracklist/chapters`: controls in-file metadata/chapter embedding

If you want single-file chapter support in players like VLC, `m4a` is the strongest option.

## Metadata and Graph

- The app builds a normalized metadata index from:
  - subscriptions
  - feeds
  - download history
  - harvested discovery/search cache
- Metadata and entity graph views are materialized to disk and reused on startup
- Common local mutations patch the stored snapshot incrementally:
  - subscriptions
  - feeds
  - download history
- The harvest system now runs on a per-source cadence and rotates deeper episode-page scraping over time
- Entity graph data powers:
  - host/program/genre/location/episode profiles
  - related entities
  - graph-powered recommendations
  - collection building

## Performance Notes

- The app now persists a materialized metadata index and entity graph snapshot
- Heavy Library metadata surfaces hydrate after the rest of the Library tab renders
- Startup harvest/materialization work is deferred briefly so the app can paint sooner
- Harvest refreshes still rebuild the broader snapshot in the background when needed

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

Open `http://localhost:8080/`.

### Docker

```bash
docker compose up -d --build
```

Default server port: `8080`

## Requirements

- Node.js 20+
- `yt-dlp`
- `ffmpeg`

The app can use bundled vendor binaries from `vendor/`, or system binaries when available.

Optional tools:

- `AtomicParsley` for stronger `m4a` artwork embedding
- `songrec`
- `fpcalc`
- AudD API token
- AcoustID API key

## Useful Scripts

```bash
npm start
npm run start:server
npm test
npm run lint
npm run bootstrap:all-binaries
npm run pack:win
npm run pack:mac
```

## Storage

- Desktop mode stores state in the Electron user data directory
- Server mode uses `DATA_DIR` and `DOWNLOAD_DIR`
- Queue state, history, schedules, feeds, collections, harvested metadata, and materialized metadata/graph snapshots are persisted to disk

Common server defaults:

- `DATA_DIR=/data`
- `DOWNLOAD_DIR=/downloads`

## Packaging

- Windows build: `npm run pack:win`
- macOS build: `npm run pack:mac`

Artifacts are written to `dist/`.

The packaging step prunes vendored binaries down to the target platform via `scripts/after-pack-prune-vendor-binaries.js`.

## Project Structure

```text
src/
  main.js                  Electron main process
  preload.js               Electron renderer bridge
  server.js                Express runtime
  lib/                     Source adapters, queue, scheduler, feeds, tags, diagnostics, metadata
  renderer/                UI shell and screen modules
scripts/
  bootstrap-yt-dlp.js
  after-pack-prune-vendor-binaries.js
vendor/
  yt-dlp, ffmpeg, songrec, chromaprint, atomicparsley
```

## Troubleshooting

- If downloads fail, check `yt-dlp`, `ffmpeg`, and writable output paths in Library diagnostics
- If vendored binaries are missing or stale, use Library `Repair`
- If a file is missing chapters/tracklists, use `Rebuild Tags/Chapters` from History after fixing settings
- If source metadata looks thin, check the Library harvest diagnostics and refresh harvested discovery

## License

MIT
