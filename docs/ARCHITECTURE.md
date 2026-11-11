# OrbitScope — System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │Sky Explorer│ │Detection │ │Comparison│ │Planet X │ │
│  └─────┬─────┘ └─────┬────┘ └─────┬────┘ └────┬────┘ │
│        └──────────────┴──────────┬─┴───────────┘      │
│                          API Service Layer             │
└─────────────────────────────────┬─────────────────────┘
                                  │ HTTP/REST
┌─────────────────────────────────┴─────────────────────┐
│                   Backend (FastAPI)                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │                   API Routes                      │  │
│  │  /sky  /observations  /detection  /catalog  ...   │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │              Service Layer                        │  │
│  │  ┌─────────────┐ ┌────────────┐ ┌──────────────┐ │  │
│  │  │ JPL Client  │ │IRSA Client │ │SPHEREx Data  │ │  │
│  │  └──────┬──────┘ └─────┬──────┘ └──────┬───────┘ │  │
│  └─────────┼──────────────┼───────────────┼─────────┘  │
│            │              │               │             │
│  ┌─────────┴──────────────┴───────────────┴─────────┐  │
│  │           Scientific Pipeline                     │  │
│  │  Preprocessing → Alignment → Detection            │  │
│  │  → Subtraction → Association → Cross-match        │  │
│  │  → Classification → ML Scoring                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Cache Layer (In-Memory TTL Cache)             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │                    │
          ▼                    ▼
  ┌───────────────┐   ┌─────────────────┐
  │ JPL SBDB API  │   │ IRSA TAP Service│
  │ JPL Horizons  │   │ (SPHEREx data)  │
  └───────────────┘   └─────────────────┘
```

## Component Details

### Frontend Components

| Component | Purpose | Key Libraries |
|-----------|---------|---------------|
| Sky Map | Interactive astronomical sky visualization | HTML5 Canvas |
| Detection UI | Pipeline control and results display | React, Recharts |
| Comparison | Side-by-side epoch comparison | Canvas |
| Planet X | Evidence explorer | Recharts |
| Catalog Browser | JPL SBDB search interface | React |
| i18n | Multi-language support (EN/AZ) | i18next |

### Backend Services

| Service | Purpose | External Dependency |
|---------|---------|-------------------|
| JPL Client | Small-body queries, ephemeris | JPL SBDB API, Horizons API |
| IRSA Client | SPHEREx data queries | IRSA TAP service |
| SPHEREx Data | Data management and demo generation | IRSA / Local cache |
| Pipeline Manager | Scientific processing orchestration | Internal |
| Anomaly Detector | ML-based candidate ranking | Internal |

### API Endpoints

| Route Group | Endpoints | Purpose |
|-------------|-----------|---------|
| `/api/v1/sky` | regions, observations, objects | Sky exploration |
| `/api/v1/observations` | list, detail, image, compare | Observation management |
| `/api/v1/detection` | run, candidates, crossmatch | Detection pipeline |
| `/api/v1/catalog` | search, object, ephemeris, nearby | JPL integration |
| `/api/v1/planetx` | evidence, tnos, regions | Planet Nine research |
| `/api/v1/system` | health, status, datasources | System monitoring |

## Data Flow

### Detection Pipeline Flow

```
1. User selects sky region (RA, Dec, radius)
2. Backend queries available observations
3. User selects observation epochs
4. Backend runs detection pipeline:
   a. Load observation images
   b. Estimate and subtract background
   c. Align images astrometrically
   d. Detect sources in each epoch
   e. Compute image differences
   f. Associate sources across epochs
   g. Identify moving candidates
   h. Cross-match with JPL catalog
   i. Score with ML anomaly detector
   j. Generate classification
5. Results returned with full provenance
6. Frontend displays candidates with visualizations
```

## Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend Framework | React 18 + TypeScript | Type safety, component architecture |
| Build Tool | Vite | Fast development builds |
| Styling | Tailwind CSS | Rapid professional theming |
| Charts | Recharts | React-native charting |
| Icons | Lucide React | Consistent icon set |
| HTTP Client | Axios | Request interceptors, error handling |
| i18n | i18next | Industry standard localization |
| Backend Framework | FastAPI | Async, auto-docs, type validation |
| HTTP Client (Python) | httpx | Async HTTP requests |
| Astronomy | Astropy | WCS, coordinates, FITS |
| Image Processing | OpenCV, scikit-image | Registration, morphology |
| Source Detection | Photutils | DAOStarFinder, background estimation |
| ML | scikit-learn | Isolation Forest |
| Caching | cachetools | In-memory TTL cache |
