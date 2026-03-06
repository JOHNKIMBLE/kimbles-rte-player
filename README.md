# Kimble's RTÉ Player

Desktop app + optional Docker API for downloading RTÉ radio episodes as MP3.

## Features
- Quick download from an RTÉ episode URL
- Program explorer + per-episode download
- Live station panel
- Scheduler for auto-downloading new episodes

## Requirements
- Node.js 20+

## Quick Start (Desktop)
```bash
npm install
npm start
```

Default desktop download location:
- `~/Downloads/RTE/<program>/<episode>.mp3`

Notes:
- Download/filename/time format can be changed in app Settings.
- Bundled `yt-dlp` + `ffmpeg` are used for packaged builds (no PATH dependency).

## Build
Windows:
```bash
npm run pack:win
```

macOS:
```bash
npm run pack:mac
```

Output is written to `dist/`.

## Docker / Unraid
Run API + scheduler in Docker:
```bash
docker compose up -d --build
```

Container paths:
- Scheduler/state: `/data`
- Downloads: `/downloads`

Unraid template:
- `unraid/kimbles-rte-player.xml`

## Vendored Binaries
Install/bootstrap downloads platform binaries into:
- `vendor/yt-dlp/bin/<platform-arch>/...`
- `vendor/ffmpeg/bin/<platform-arch>/...`

Examples:
- `win32-x64`, `win32-arm64`
- `darwin-x64`, `darwin-arm64`
- `linux-x64`, `linux-arm64`

## Third-Party Licenses
This project redistributes third-party binaries. Ensure compliance when distributing.

- `yt-dlp`: Unlicense
  - https://github.com/yt-dlp/yt-dlp
  - local file: `vendor/yt-dlp/LICENSE`
- `FFmpeg`: LGPL/GPL depending on build/options
  - https://ffmpeg.org/legal.html
  - binary source used: https://github.com/eugeneware/ffmpeg-static
