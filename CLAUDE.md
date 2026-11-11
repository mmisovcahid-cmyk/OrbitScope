# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

OrbitScope is a SPHEREx time-domain sky monitoring / moving-object detection platform: a Python FastAPI backend (`backend/`) running an astronomical image-processing pipeline, plus a React + TypeScript + Vite + Tailwind frontend (`frontend/`). Not a git repository. The UI is bilingual (English / Azerbaijani). See `docs/` (ARCHITECTURE, METHODOLOGY, LIMITATIONS, REFERENCES) for scientific background.

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
`npm run lint` is defined but ESLint is neither installed nor configured, so it won't work as-is.

`start.bat` / `start.ps1` at the root launch backend and frontend in separate windows.

Port note: README and start scripts say the frontend runs on 5173, but `vite.config.ts` sets `server.port: 3000` (both are in the backend's CORS list). The frontend calls the backend directly via `VITE_API_BASE` (default `http://localhost:8000`) in `src/services/api.ts`; the Vite `/api` proxy exists but is not what the axios client uses.

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

- `src/App.tsx` — react-router routes inside a shared `Layout`: `/` Dashboard, `/detection`, `/analysis/:id`, `/comparison`, `/planetx`, `/catalog`, `/about`. Pages live in `src/pages/`.
- `src/services/api.ts` (axios instance) + `src/services/index.ts` (`skyService`, `detectionService`, `catalogService`, etc., one per backend router).
- `src/hooks/useApi.ts` — generic fetch hook; unwraps `res.data.data ?? res.data`, so backend responses are typically wrapped in a `data` envelope.
- `src/types/index.ts` — TS mirrors of backend schemas; keep in sync with `schemas.py` when changing API shapes.
- `src/i18n/en.json` and `az.json` — every UI string needs a key in both files.
- Sky map is custom HTML5 Canvas (`components/skymap/SkyMapCanvas.tsx`); charts use Recharts; `@` alias maps to `src/`.
