# Kimble's RTE Player
Electron desktop app plus optional Docker web app for RTÉ + BBC radio.

## Features
- RTÉ + BBC tabs:
  - live station player with play overlay
  - quick URL download
  - program search + episode explorer
  - music-played lists (where available)
- Download behavior:
  - MP3 output
  - duplicate detection (file + archive)
  - click download again to force re-download
  - optional auto CUE generation (writes `.cue` only, no JSON sidecar)
- Scheduler:
  - RTÉ and BBC both use show-time windows
  - checks from show end + 30 min up to +6 hours
  - falls back to cadence-based background checks
  - scheduler cards show program art + latest episode info
- Settings:
  - 12h/24h time display
  - episode filename mode (`date-only` / `full-title`)
  - single base download directory
  - path format template with presets + preview

## Path Format Tokens
Use in Settings `Path Format`:
- `{radio}` (`RTE` or `BBC`)
- `{program}`
- `{episode}`
- `{episode_short}`
- `{release_date}`

Default:
`{radio}/{program}/{episode_short} {release_date}`

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

Artifacts are written to `dist/`.

## Docker / Unraid
Run web UI + API + scheduler:
```bash
docker compose up -d --build
```

Container paths:
- Downloads: `/downloads`
- Scheduler/state: `/data`

Unraid template:
- `unraid/kimbles-rte-player.xml`

Open:
- `http://<host>:<port>/` (web UI)
- `http://<host>:<port>/api/*` (API)

Note: in Docker/web mode, `Choose Folder` is disabled; set the download path manually in Settings.

## Quick Release Script (PowerShell)
Use `scripts/release.ps1` for commit + git push + Docker build/push (Docker Hub + GHCR).

```powershell
.\scripts\release.ps1 -CommitMessage "release: update" -TagRelease -Version "1.0.1"
```

## Vendored Binaries
This project vendors `yt-dlp` and `ffmpeg` under `vendor/`.
Build-time pruning keeps only target-platform binaries in packaged output.

## Third-Party Licenses
- `yt-dlp` (Unlicense): https://github.com/yt-dlp/yt-dlp
  - local: `vendor/yt-dlp/LICENSE`
- `FFmpeg` (LGPL/GPL depending on build/options): https://ffmpeg.org/legal.html
  - binary source used: https://github.com/eugeneware/ffmpeg-static
