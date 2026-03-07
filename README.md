# Kimble's RTE Player

Electron desktop app plus optional Docker web app for RTE and BBC radio:
- live station player
- program explorer
- per-episode MP3 downloads
- auto scheduler

## Features
- RTE tab:
  - Live stations with play overlay
  - Quick download by episode URL
  - Program search, episodes, music-played list
  - Scheduler with run windows based on show schedule
- BBC tab:
  - Live stations with play overlay
  - Quick download by URL
  - Program search, episodes, music-played list
  - Scheduler using upcoming-broadcast schedule (run at show end + 30 min)
- Settings tab:
  - 12h/24h time format
  - Episode filename mode (`date-only` or `full-title`)
  - Download directory chooser

## Requirements
- Node.js 20+

## Desktop Quick Start
```bash
npm install
npm start
```

Default download folders:
- RTE: `~/Downloads/RTE/<program>/<episode>.mp3`
- BBC: `~/Downloads/BBC/<program>/<episode>.mp3`

In Settings, the directory shown is for the last selected source tab (RTE or BBC).

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

## Quick Release Script (PowerShell)
Use `scripts/release.ps1` to do commit + git push + Docker build/push (Docker Hub + GHCR).

Example (latest + version tag):
```powershell
.\scripts\release.ps1 -CommitMessage "release: bbc fixes" -TagRelease -Version "1.0.1"
```

Example (no git, only rebuild/push images):
```powershell
.\scripts\release.ps1 -CommitMessage "rebuild images" -SkipGit
```

## Vendored Binaries
This project vendors `yt-dlp` and `ffmpeg` under `vendor/`.

Build-time pruning keeps only target-platform binaries in packaged output:
- Windows builds -> `win32-*`
- macOS builds -> `darwin-*`
- Linux/Docker builds -> `linux-*`

## Third-Party Licenses
- `yt-dlp` (Unlicense): https://github.com/yt-dlp/yt-dlp
  - local: `vendor/yt-dlp/LICENSE`
- `FFmpeg` (LGPL/GPL depending on build/options): https://ffmpeg.org/legal.html
  - binary source used: https://github.com/eugeneware/ffmpeg-static
