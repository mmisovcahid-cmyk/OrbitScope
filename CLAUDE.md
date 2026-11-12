# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

OrbitScope is a SPHEREx time-domain sky monitoring / moving-object detection platform: a Python FastAPI backend (`backend/`) running an astronomical image-processing pipeline, plus a React + TypeScript + Vite + Tailwind frontend (`frontend/`). The UI is bilingual (English / Azerbaijani). See `docs/DATA_SOURCES.md` for every external API (all keyless) and `docs/AUDIT_AND_ROADMAP.md` for status and validation results.

Git workflow (from the user): develop in the worktree `.claude/worktrees/full-system` (branch `dev/full-system`), merge into `main` only after the user approves, and never push without explicit approval.

## Commands

Backend (run from `backend/`, Python 3.10+):
```bash
pip install -r requirements.txt
python run.py                         # uvicorn app.main:app on :8000 (reload when DEBUG=true); docs at /docs
pytest tests/ -v                      # all tests
pytest tests/test_pipeline.py -v      # one file
pytest tests/test_api_and_ml.py::test_root_endpoint -v   # one test
```
Config comes from `backend/.env` (template: `.env.example`), loaded by `app/core/config.py` (pydantic-settings, `settings` singleton).

Frontend (run from `frontend/`):
```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc type-check + vite build — the main correctness check for frontend changes
```
`npm run lint` runs ESLint 9 with a flat config (`eslint.config.js`, typescript-eslint + react-hooks). Errors fail; `any` is only a warning, because the older demo pages still use it. `npm run typecheck` runs `tsc --noEmit`.

Docker: `docker compose up --build` serves the app on :8080. Images: `backend/Dockerfile` (uvicorn, data in the `/data` volume) and `frontend/Dockerfile` (Vite build with an empty `VITE_API_BASE`, served by nginx, which proxies `/api` to `backend:8000`). `services/api.ts` uses `??`, so an empty `VITE_API_BASE` means same origin.

`start.bat` / `start.ps1` at the root launch backend and frontend in separate windows.

The Vite dev server runs on 5173. The frontend calls the backend directly via `VITE_API_BASE` (default `http://localhost:8000`) in `src/services/api.ts`; the Vite `/api` proxy exists but is not what the axios client uses.

## Real SPHEREx data path (the main feature)

Every page in the UI uses real data:

- Blink, Detection, Comparison and Analysis use SPHEREx data via IRSA.
- Sky Explorer uses the saved runs and candidates plus live status.
- Catalog uses live JPL data (`app/services/jpl_catalog.py`: SBDB, Horizons, SB Ident).
- Planet X runs a live Rayleigh clustering test on JPL orbits (`app/services/etno.py`); its evidence cards are labelled literature.

Real-data paths must never fall back to invented values: return a 502 with an explanation instead. Only the deprecated legacy routers `/api/v1/{sky,observations,detection}` (and the old `jpl_client` they use) still produce `[SIMULATED]` data, and they are not used by the UI. The test suite blocks network access to SB Ident in `tests/conftest.py`, so it runs offline in about 40 s.

- `app/services/spherex_archive.py`:
  1. Queries IRSA TAP `spherex.obscore` with `CONTAINS(POINT(ra,dec), s_region)`. Collections are matched by the `spherex` prefix, so new releases are picked up without code changes.
  2. Resolves each frame's Level-2 FITS URL through IRSA datalink.
  3. Downloads IBE cutouts (`?center=&size=`), stores them compactly, and drops the ~5 MB PSF cube.
  4. Subtracts ZODI and the local sky, masks FLAGS bits, reprojects onto a north-up TAN grid with SIP-aware `map_coordinates`, and does an inverse-variance coadd per survey pass (frames >30 days apart are separate passes). It also fills saturated star cores.
  5. Returns float32 frames as base64; the browser does stretching, colour maps, difference and motion modes.
- Everything is cached under `backend/cache/spherex/` (gitignored). The first request for a new field takes 30–90 s; repeats are instant.
- `app/services/target_resolver.py` accepts decimal or sexagesimal coordinates, the five challenge targets (Gaia DR3/SIMBAD positions + proper motion), CDS Sesame (with a CfA mirror) and NED. High-PM targets are propagated to the SPHEREx epoch.
- Routes are in `app/api/routes/spherex.py`: `/api/v1/spherex/{targets,resolve,coverage,blink,blink.gif}`.
- Frontend: `pages/BlinkPage.tsx` (`/`), `pages/EmbedPage.tsx` (`/embed`, iframe-friendly), `components/blink/BlinkViewer.tsx`, `lib/spherex.ts`. The URL query (`target, ra, dec, fov, det, mode, per, max`) is the source of truth, so links are shareable.
- The IRSA cutout service sometimes returns 503; `fetch_cutout` retries with backoff.
- `/api/v1/spherex/photometry` measures one position in up to 96 exposures, spread over detectors and time (`select_for_photometry`). Each point's wavelength comes from that pixel's LVF wavelength via the `WCS-WAVE` table (`Cutout.wavelength_at`), so the same result gives both a spectrum and a light curve. Saturated (OVERFLOW) or mostly masked apertures are returned with `flagged: true` rather than dropped.
- `/api/v1/spherex/overlay` (`app/services/catalog_overlay.py`) serves Gaia DR3 (ESA TAP, epoch 2016.0) and CatWISE2020 (IRSA TAP, epoch 2015.4, pm converted to mas/yr). CatWISE rows with D/P/H/O artifact flags are dropped, and motions of blended (nb>1) or low-S/N detections are zeroed. The browser propagates each marker to the date of the frame being shown.
## Background jobs and progress

- `app/services/jobs.py` (`JobManager`) runs long work as in-process asyncio tasks, at most 3 at a time. Identical requests (same kind, locale and params) share one job, and finished jobs are kept for 30 minutes.
- Routes are in `app/api/routes/jobs.py`. `POST /api/v1/jobs {kind: blink|detect|photometry, params, locale}` validates the params with the same limits as the direct endpoints and calls the same internals (`spherex._build`, `run_detection`, `spherex_archive.photometry`).
- Progress: library code calls `app.core.progress.report(stage, done, total)`, or `gather_with_progress` for parallel downloads. The job installs a ContextVar callback, so this works through `asyncio.gather` and `to_thread` without any signature changes. Stage names are the keys under `jobs.stage.*` in i18n.
- Frontend: `lib/jobs.ts` `runJob()` submits a job, polls it, cancels it when the AbortSignal fires, and throws `JobError` with the server's localized message. `components/common/JobProgressBar.tsx` shows the progress. Blink, Detection, Photometry and Embed all use jobs; the direct GET endpoints stay for scripts and GIF export.
- `spherex_archive.prune_cache()` keeps the cutout cache under `SPHEREX_CACHE_MAX_MB`. It runs at startup and after every 50 new downloads. `GET /api/v1/spherex/status` is the health endpoint.

## Real-data moving-object search (`/detection`)

- `app/services/detection_service.py`: `run_detection()` gets frames from `build_blink(..., keep_arrays=True)` and runs `app/pipeline/moving_objects.py`. It then matches the results against reference catalogs and saves them through `candidate_store.py` (SQLite at `backend/data/orbitscope.db`, gitignored). Endpoints: `/api/v1/spherex/detect`, `/candidates` (GET), `/candidates/{id}` (PATCH review: unreviewed/real/artifact/unsure), `/candidates/{id}/export` (CSV).
- **Asteroids** (`search=asteroids`, `mode="pass"`):
  - Input: individual exposures of one survey pass. `select_sequences` keeps SPHEREx's ~4-exposure / ~7-minute visits intact. Paired detectors D1/D4, D2/D5 and D3/D6 expose simultaneously.
  - Detection: median template per detector, then residual detection with the noise model `sigma^2 + (0.15*template)^2` (LVF brightness changes).
  - Linking: within a visit only (`VISIT_WINDOW_DAYS`), then cross-visit joining guarded by `MAX_JOIN_RMS_PX`.
  - Rejection: noisy frames are skipped (`NOISY_FRAME_FACTOR`). `recurrence()` and the "parked" rule turn fixed-position residuals (persistence, variables) into `stationary_transient`.
  - Known objects come from JPL SB Ident (`app/services/small_bodies.py`): one query per visit cluster, linear extrapolation with the returned rates, cached on disk. A known object only counts as recovered if the track is a genuine mover, or position plus rate agree.
- **Proper motion** (`search=proper_motion`, per-pass stacks):
  - Astrometric, not difference-based: `search_proper_motion` centroids isolated, unsaturated sources in every epoch (`refine_centroid`), removes the frame-wide registration offset, and derives the noise floor from the static stars. Reports shifts above 5σ, or brightness ratios ≥1.6 as variables.
  - Catalog matching (Gaia/CatWISE) requires the proper-motion vectors to agree, and widens the radius for fast catalog movers.
  - Saturated stars (Barnard's Star, RW Aur, R Dra) are excluded by design.
- Validated on real data:
  - 626 Notburga (V=13.5) recovered: 8 detections, 1.6″ from JPL, 58″/h.
  - ε Indi B: 4.1″/yr at PA 123°, Gaia match.
  - WISE 0855−0714: 7.9″/yr at PA 280°, CatWISE match.
  - Static fields produce no `unknown_mover`.
  - Synthetic tests are in `tests/test_moving_objects.py`.
- The uvicorn `--reload` watcher restarts the backend on any change under `backend/` (tests included), which drops in-flight long requests. Expect this while editing during a long blink or photometry call.

## Backend architecture

- **`app/main.py`** — FastAPI app. The `lifespan` hook registers service singletons on `app.state` (`jpl_client`, `irsa_client`, `spherex_data`, `demo_data`, `pipeline_manager`) plus in-memory session stores `app.state._candidates` and `app.state._observations`. Routes fetch these via `request.app.state` (no DI container, no database — all state is per-process and lost on restart). Several service imports are wrapped in `try/except ImportError` and may be `None`; routes guard for that.
- **`app/api/routes/`** — one router per area, each with prefix `/api/v1/<area>`: `sky`, `observations`, `detection`, `catalog`, `planetx`, `system`. Routes take a `locale` param and return localized messages from a per-module `MESSAGES = {"en": ..., "az": ...}` dict — add both languages when adding messages.
- **`app/models/schemas.py`** — all Pydantic models (single large file) shared by routes, services and pipeline.
- **`app/services/`** — external clients: `jpl_client` (SBDB, Horizons, CAD via httpx), `irsa_client` (IRSA TAP for SPHEREx), `spherex_data` (data management), `demo_data` (synthetic data generator).
- **`app/pipeline/`** — `pipeline_manager.PipelineManager.run_detection` orchestrates stages in order: data ingestion → `preprocessor` → `source_detector` (photutils) → `alignment` (WCS / phase correlation) → `subtractor` → `candidate_associator` → `crossmatcher` (JPL). Each stage appends a telemetry dict to `stages`, returned as `PipelineResult.pipeline_stages` for provenance. When no real images are available it builds synthetic frames with a synthetic WCS.
- **`app/ml/`** — `feature_extractor` + `anomaly_detector` (Isolation Forest) for ranking candidates.
- **`app/core/cache.py`** — thread-safe `TTLCacheWrapper` around cachetools; module-level `catalog_cache` / `observation_cache` instances.

### Demo mode and data transparency (project invariant)

`DEMO_MODE` (default true) makes services fall back to simulated data when NASA/JPL APIs are unreachable (see `jpl_client.py`, `spherex_data.py`); routes like `detection` also have their own fallback result builders. Simulated data must always be flagged — models carry `is_simulated` / `data_source` fields and the UI labels it `[SIMULATED]`. Detected objects are "candidates", never discoveries; Planet Nine is presented as an unconfirmed hypothesis. Preserve these distinctions in any new data paths or UI copy.

## Frontend architecture

- `src/App.tsx` sets up react-router routes (lazy-loaded), all inside a shared `Layout` except `/embed`. Pages live in `src/pages/`:
  - `/` SPHEREx Blink
  - `/dashboard` Sky Explorer (`components/skymap/AllSkyMap.tsx`)
  - `/detection`
  - `/analysis/:id` (saved candidate)
  - `/comparison` (two real passes)
  - `/planetx`
  - `/catalog` (live JPL; `?q=` deep link)
  - `/about`
  - `/embed` (outside the Layout)
- `src/services/api.ts` (axios instance) + `src/services/index.ts` (`skyService`, `detectionService`, `catalogService`, etc., one per backend router).
- `src/hooks/useApi.ts` — generic fetch hook; unwraps `res.data.data ?? res.data`, so backend responses are typically wrapped in a `data` envelope.
- `src/types/index.ts` — TS mirrors of backend schemas; keep in sync with `schemas.py` when changing API shapes.
- `src/i18n/en.json` and `az.json` — every UI string needs a key in both files.
- Charts use Recharts; `@` alias maps to `src/`.
