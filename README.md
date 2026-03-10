# Kimble's RTE Player
Desktop (Electron) + optional Docker web app for RTÉ/BBC radio playback, downloads, and scheduling.

## Highlights
- RTÉ + BBC tabs:
  - live station player
  - quick URL download
  - program search and episode explorer
  - per-episode tracklists (when available)
- Per-episode actions:
  - `Play` (stream)
  - `Play Local` (downloaded file)
  - `Download`
  - `Generate CUE`
- Global bottom player:
  - hidden until playback starts
  - artwork + now playing text
  - chapter-aware track label
  - `Prev Track` / `Next Track` when chapter data exists
- Scheduler UI:
  - modern card layout with badges, stats, latest file path/time, and actions
  - times shown in the user’s local timezone

## Download Engine
- Formats: `mp3`, `m4a`, `aac`, `opus`, `vorbis`
- Quality: `128K`, `192K`, `256K`, `320K`, `best VBR`
- Loudness normalization (default ON): ffmpeg `loudnorm`
- Dedupe modes:
  - `source-id` (archive + source identity)
  - `title-date` (filename-based)
  - `none` (always download)
- Force re-download: click Download again after duplicate notice
- Optional CUE/chapter generation (`.cue`)
- Optional metadata tagging:
  - title/album/artist/date/etc.
  - embeds episode/program artwork when available

## Scheduler Behavior
- RTÉ + BBC schedulers
- Checks in show window: show end +30 min through +6 hours
- Cadence fallback outside window
- Backfill modes:
  - new-only
  - latest N now
- Backfill runs asynchronously with progress/status updates
- `Run Now` status feedback

## Download Queue
Settings tab includes queue controls and visibility:
- Active / queued / recent
- Pause / resume
- Clear pending
- Cancel individual jobs
- Play finished files from queue

## Settings
- 12h/24h display
- Base download directory
- Path format + presets + token legend + live preview
- CUE auto-generate toggle
- Output format/quality
- Loudness normalization toggle
- Max concurrent downloads
- Duplicate handling mode
- ID3 tagging toggle
- Feed export toggle (JSON/RSS)
- Webhook URL

Default path format:
`{radio}/{program}/{episode_short} {release_date}`

Supported path tokens:
`{radio}` `{program}` `{program_slug}` `{episode}` `{episode_short}` `{episode_slug}` `{release_date}` `{year}` `{month}` `{day}` `{date_compact}` `{source_id}`

## Storage Notes
- Central archive file (not per-folder):
  - Electron: app user data `download-archive.txt`
  - Docker/Web: `/data/download-archive.txt`
- Docker paths:
  - downloads: `/downloads`
  - state/settings/archive: `/data`
- Linux/Unraid permission helper for created paths:
  - directories `0777`
  - files `0666`

## Requirements
- Node.js 20+

## Quick Start (Desktop)
```bash
npm install
npm start
```

## Build
```bash
npm run pack:win
npm run pack:mac
```
Output: `dist/`

## Docker / Unraid
```bash
docker compose up -d --build
```

Open:
- Web UI: `http://<host>:<port>/`
- API: `http://<host>:<port>/api/*`

Unraid template:
- `unraid/kimbles-rte-player.xml`

Note: `Choose Folder` is desktop-only. In Docker/web, set path manually.

## Vendored Binaries
- `yt-dlp` and `ffmpeg` are included under `vendor/`
- Build-time pruning keeps only target-platform binaries in packaged builds

## Third-Party Licenses
- `yt-dlp` (Unlicense): https://github.com/yt-dlp/yt-dlp
  - local: `vendor/yt-dlp/LICENSE`
- FFmpeg (LGPL/GPL depending on build): https://ffmpeg.org/legal.html
  - static binary source: https://github.com/eugeneware/ffmpeg-static
