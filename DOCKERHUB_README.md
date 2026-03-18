# Kimble's RTE Player

Browse, stream, download, schedule, and organize radio shows from:

- RTE
- BBC Sounds
- Worldwide FM
- NTS
- FIP
- KEXP

Served as a web UI on port `8080`.

## Features

- 6 radio sources in one UI
- Live browser playback for supported stations
- Episode downloads via `yt-dlp` + `ffmpeg`
- `m4a` and `mp3` output
- Embedded artwork, tags, tracklists, and chapters
- Optional physical `.cue` sidecar generation
- Scheduler with automatic new-episode downloads and backfill
- Persistent download queue with pause, resume, cancel, and rerun
- Library tools: subscriptions, feeds, history, collections, metadata explorer, and entity graph
- Diagnostics and one-click vendor repair from the UI
- KEXP explorer includes older extended archive episodes when available

## Quick Start

```bash
docker run -d \
  --name kimbles-rte-player \
  -p 8080:8080 \
  -v /your/data:/data \
  -v /your/downloads:/downloads \
  -e TZ=Europe/Dublin \
  johnkimble/kimbles-rte-player:latest
```

Then open `http://localhost:8080` in your browser.

## Docker Compose

```yaml
services:
  kimbles-rte-player:
    image: johnkimble/kimbles-rte-player:latest
    container_name: kimbles-rte-player
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - DATA_DIR=/data
      - DOWNLOAD_DIR=/downloads
      - TZ=Europe/Dublin
    volumes:
      - /your/data:/data
      - /your/downloads:/downloads
    restart: unless-stopped
```

## Web UI Highlights

- Source tabs for RTE, BBC, Worldwide FM, NTS, FIP, and KEXP
- Live now panels and station playback where supported
- Per-program explorers with search, discovery, and episode listings
- Scheduler management for automatic downloads
- Library views for subscriptions, feed exports, download queue, and download history
- Collections, graph-powered recommendations, and metadata/entity exploration
- Settings for output format, quality, naming, duplicate handling, tagging, feed export, webhook, and recognition options

## Storage

`/data` stores:

- settings
- schedules and subscriptions
- download queue and download history
- collections
- feed exports
- cache and harvested metadata
- materialized metadata and entity graph snapshots

`/downloads` stores the downloaded audio files.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Web UI / API port inside the container |
| `TZ` | `Europe/Dublin` | Timezone used for schedule display |
| `DATA_DIR` | `/data` | App state, settings, schedules, feeds, cache, and library metadata |
| `DOWNLOAD_DIR` | `/downloads` | Download destination for audio files |

## Audio Metadata

- `m4a`: artwork, tags, tracklists, and native chapters
- `mp3`: artwork, tags, text tracklists, and ID3 chapter frames
- Optional `.cue` file generation on download
- Rebuild tags/chapters from History without redownloading

## Notes

- Most behavior is configured from the web UI after the container starts.
- Download format, quality, dedupe mode, tagging, webhook, RSS feed export, and track recognition options are all saved under `/data`.
- Recognition features can use AudD, AcoustID/Chromaprint, and Songrec when configured.

## Source

`https://github.com/johnkimble/kimbles-rte-player`
