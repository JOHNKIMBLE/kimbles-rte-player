# Kimble's RTE Player
Electron desktop app plus optional Docker web app for RTÉ + BBC radio downloading, playback, and scheduling.

## What It Does
- RTÉ + BBC tabs with:
  - live station player
  - quick URL download
  - program search + episode explorer
  - per-episode tracklists (when available)
- Episode actions:
  - `Play` (stream)
  - `Play Local` (already-downloaded file)
  - `Download`
  - `Generate CUE`

## Download Engine
- Output formats: `mp3`, `m4a`, `aac`, `opus`, `vorbis`
- Audio quality: `128K`, `192K`, `256K`, `320K`, `best VBR`
- Loudness normalization toggle (default ON): ffmpeg `loudnorm`
- Duplicate modes:
  - `source-id` (archive + source identity)
  - `title-date` (filename-based)
  - `none` (always download)
- Duplicate force flow: click Download again to force re-download
- Optional CUE/chapter generation (`.cue` file only)
- Optional ID3 tagging (enriched tags: title/album/artist/album_artist/genre/publisher/date/year/comment/source URL, etc.)

## Playback
- Sticky bottom **Now Playing** bar
- Hidden until playback starts
- Close with `X`
- Track/chapter line updates while playing/seeking when chapter/track data exists

## Scheduler
- RTÉ and BBC schedulers
- Checks around show windows: show end +30 min through +6 hours
- Cadence fallback outside that window
- Backfill modes: new-only or latest N
- Run Now status feedback
- Scheduler cards include artwork and latest episode details

## Queue Manager
In Settings, a **Download Queue** section provides:
- Active / queued / recent jobs
- Pause queue
- Resume queue
- Clear pending
- Cancel individual queued or active jobs

## Settings
- 12h / 24h time display
- Single base download directory
- Path format with presets, token legend, and live preview
- CUE auto-generate toggle
- Output format/quality
- Loudness normalization toggle
- Concurrent download limit
- Duplicate handling mode
- ID3 tagging toggle
- Feed export toggle (JSON/RSS)
- Webhook URL

Default path format:
`{radio}/{program}/{episode_short} {release_date}`

Supported path tokens:
- `{radio}`
- `{program}`
- `{program_slug}`
- `{episode}`
- `{episode_short}`
- `{episode_slug}`
- `{release_date}`
- `{year}`
- `{month}`
- `{day}`
- `{date_compact}`
- `{source_id}`

## Duplicate Archive Location
Per-folder `.yt-dlp-archive.txt` files are no longer used.

Archive file is now stored centrally:
- Electron: app user data folder (`download-archive.txt`)
- Docker/Web: `/data/download-archive.txt`

## Linux/Unraid Permissions
On Linux/container builds, newly created download dirs/files are chmod-adjusted for shared access:
- directories: `0777`
- files: `0666`

This helps avoid permission-denied issues on shared Unraid paths.

## Requirements
- Node.js 20+

## Desktop Quick Start
```bash
npm install
npm start
```

## Build
Windows:
```bash
npm run pack:win
```

macOS:
```bash
npm run pack:mac
```

Output: `dist/`

## Docker / Unraid
Start web UI + API + scheduler:
```bash
docker compose up -d --build
```

Container paths:
- Downloads: `/downloads`
- Data/state/settings/archive: `/data`

Unraid template:
- `unraid/kimbles-rte-player.xml`

Open:
- `http://<host>:<port>/` (web UI)
- `http://<host>:<port>/api/*` (API)

Note: in Docker/web mode, `Choose Folder` is disabled (no native picker). Set path manually in Settings.

## Vendored Binaries
- `yt-dlp` and `ffmpeg` are vendored under `vendor/`
- Build-time pruning keeps target-platform binaries in packaged output

## Third-Party Licenses
- `yt-dlp` (Unlicense): https://github.com/yt-dlp/yt-dlp
  - local: `vendor/yt-dlp/LICENSE`
- `FFmpeg` (LGPL/GPL depending on build/options): https://ffmpeg.org/legal.html
  - static binary source: https://github.com/eugeneware/ffmpeg-static
