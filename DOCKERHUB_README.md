# Kimble's RTE Player (Docker)

Web UI for **RTE**, **BBC Sounds**, **Worldwide FM**, **NTS**, **FIP**, and **KEXP**: browse, stream, download, schedule, and organize radio. Listens on port **8080** by default.

Image includes `yt-dlp`, `ffmpeg`, `songrec`, AtomicParsley, and Chromaprint/`fpcalc` where applicable.

## Features (server UI)

- Six sources, live playback where supported, per-program explorers and episode downloads (KEXP includes extended archive when available)
- `m4a` / `mp3` with embedded artwork, tags, tracklists, chapters; optional `.cue`
- Schedulers, persistent download queue, Library (subscriptions, collections, feeds, metadata explorer, entity graph, diagnostics, vendor repair)
- Settings: format, quality, naming, dedupe, tagging, feed export, webhooks, recognition (AudD / AcoustID / Songrec when configured)

## Quick start

```bash
docker run -d \
  --name kimbles-rte-player \
  -p 8080:8080 \
  -v /your/data:/data \
  -v /your/downloads:/downloads \
  -e TZ=Europe/Dublin \
  johnkimble/kimbles-rte-player:latest
```

Open `http://localhost:8080`.

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

## Volumes

| Mount | Contents |
| --- | --- |
| `/data` | Settings, schedules, queue/history, collections, feeds, cache, harvested + materialized metadata, graph snapshots |
| `/downloads` | Audio files |

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port in container |
| `TZ` | `Europe/Dublin` | Schedule display timezone |
| `DATA_DIR` | `/data` | App state |
| `DOWNLOAD_DIR` | `/downloads` | Download target |

## Notes

- Configure almost everything from the UI after start; state persists under `/data`.
- Rebuild tags/chapters from History without redownloading when needed.

## Source

https://github.com/johnkimble/kimbles-rte-player
