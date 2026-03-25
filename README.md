# Kimble's RTE Player

Multi-source radio app for browsing, streaming, downloading, scheduling, and organizing shows from **RTE**, **BBC Sounds**, **Worldwide FM**, **NTS**, **FIP**, and **KEXP**.

**Runtimes:** Electron desktop · Express web/server on port `8080` (default).

## What it does

- Live playback and per-source explorers; episode downloads via `yt-dlp` and `ffmpeg`
- **BBC** programme metadata uses the on-page **masthead title link** (`.br-masthead__title`) when present, in addition to structured data, so presenter names stay accurate when titles differ from `og:title`
- `m4a` / `mp3` with artwork, tags, tracklists, chapters; optional `.cue` sidecars (`cueAutoGenerate` / `id3Tagging` in settings)
- Queue (prefer queue when something is already playing), persistent download queue with pause/resume/retry, schedulers with backfill and retries
- Per-program rules: folders, path tokens (`{program}`, `{episode}`, `{host}`, `{hosts}`, `{source_type}`, dates), retention, rerun skipping
- **Library** (main hub): **You may like** (cross-source picks from subscriptions + discovery cache, source-balanced), Library Jump, subscriptions, collections, metadata explorer & harvest (including subscription-based suggestions), entity graph, feeds, queue, history, diagnostics, source health, vendor repair
- **Accessibility:** skip link to the Library, visible **:focus-visible** outlines, labeled Library Jump nav and metric summaries, improved contrast on metric detail text, theme toggle and health cards exposed to assistive tech

## Quick start

**Desktop**

```bash
npm install
npm start
```

**Web / server**

```bash
npm install
npm run start:server
```

Open `http://localhost:8080/`.

**Docker**

```bash
docker compose up -d --build
```

Typical env: `PORT=8080`, `DATA_DIR=/data`, `DOWNLOAD_DIR=/downloads`, `TZ=Europe/Dublin`. Image is server-mode only. See [DOCKERHUB_README.md](./DOCKERHUB_README.md) for Hub-focused instructions.

## Requirements

- Node.js **20+**
- `yt-dlp`, `ffmpeg` (desktop/Docker can use bundled `vendor/` binaries)

Optional: AtomicParsley, songrec, fpcalc, AudD / AcoustID keys for recognition features.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Electron |
| `npm run start:server` | Express |
| `npm test` / `npm run lint` | CI |
| `npm run bootstrap:all-binaries` | Vendor binaries |
| `npm run pack:win` / `pack:mac` | Desktop packages |

## Storage

| Mode | Where |
| --- | --- |
| Desktop | Electron user-data directory |
| Server | `DATA_DIR` — settings, schedules, feeds, queue/history, collections, harvested + materialized metadata, graph snapshots |
| | `DOWNLOAD_DIR` — audio files |

## Layout

```text
src/main.js, server.js, preload.js   — entries
src/lib/                             — adapters, queue, scheduler, metadata, diagnostics
src/renderer/                        — UI
scripts/                             — bootstrap, packaging helpers
vendor/                              — yt-dlp, ffmpeg, optional tools
```

## Docs

| File | Role |
| --- | --- |
| `README.md` | This overview |
| `CLAUDE.md` | Short repo ops |
| `CONTEXT.md` | Deep engineering reference |
| `DOCKERHUB_README.md` | Docker Hub copy |

## Troubleshooting

- Failed downloads → Library diagnostics (binaries, paths).
- Missing chapters/tracklists → History **Rebuild Tags/Chapters** after fixing settings.
- Thin metadata → source health; **Reharvest** / **Deep Reharvest**.
- Empty **You may like** → add subscriptions and refresh the discovery cache (Metadata Explorer).
- Missing vendor tools → **Repair Binaries** in Diagnostics.

## License

MIT
