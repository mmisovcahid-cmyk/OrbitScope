# 🔭 OrbitScope

## SPHEREx Time-Domain Sky Monitoring & Moving Object Detection Platform

<div align="center">

**Göyü kəşf edin. Dəyişiklikləri aşkar edin. Göy cisimlərini izləyin. Naməlumu araşdırın.**

*Explore the sky. Detect changes. Track celestial objects. Investigate the unknown.*

</div>

---

OrbitScope is an interactive astronomical monitoring and analysis platform that combines NASA SPHEREx observation data with NASA/JPL Small-Body Database and other astronomical resources.

## 🚀 Features

- **Sky Explorer** — Interactive astronomical sky map with observation layers
- **Moving Object Detection** — Scientific image-processing pipeline for identifying moving celestial sources
- **Candidate Analysis** — Detailed analysis of detected candidate objects with cross-matching
- **Observation Comparison** — Side-by-side temporal comparison of sky observations
- **JPL Catalog Integration** — Real-time access to NASA/JPL Small-Body Database
- **Planet X Research** — Evidence explorer for the Planet Nine hypothesis
- **Multi-language Support** — English and Azerbaijani (Azərbaycan dili)

## 🏗️ Architecture

```
OrbitScope
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── api/      # REST API routes
│   │   ├── core/     # Configuration, caching, logging
│   │   ├── models/   # Pydantic schemas
│   │   ├── services/ # External API clients (JPL, IRSA)
│   │   ├── pipeline/ # Scientific processing pipeline
│   │   └── ml/       # Machine learning modules
│   └── tests/        # Backend tests
├── frontend/         # React + TypeScript frontend
│   └── src/
│       ├── components/  # UI components
│       ├── pages/       # Page views
│       ├── services/    # API service layer
│       ├── i18n/        # Internationalization (EN/AZ)
│       ├── hooks/       # Custom React hooks
│       └── types/       # TypeScript type definitions
└── docs/             # Documentation
```

## 📋 Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **npm or yarn**

## 🔧 Installation & Setup

### 1. Clone and Navigate

```bash
cd orbitscope
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment config
copy .env.example .env    # Windows
# cp .env.example .env    # Linux/Mac

# Start backend server
python run.py
```

The backend will start at **http://localhost:8000**

API documentation: **http://localhost:8000/docs**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start at **http://localhost:5173**

## ✨ SPHEREx Blink — real data time-lapse (home page)

Type an object name or coordinates (e.g. `Barnard's Star`, `08h55m10.831s -7d14m42.53s`, `269.452 4.693`).
OrbitScope fetches every real SPHEREx Level-2 exposure covering that point from NASA/IPAC IRSA, aligns them
north-up, stacks one image per survey pass and plays them as a movie. View modes: **Blink**, **Difference**
and **Motion colour** (older frame red, newer frame cyan). Other features: per-detector wavelength choice
(D1–D6, 0.75–5 µm), quality-flag overlay, a proper-motion target marker, and links to the source FITS files.

- Shareable URL: `http://localhost:5173/?target=Barnard%27s+Star&fov=0.1&det=3`
- Embed: `http://localhost:5173/embed?target=WISE+0855-0714&det=6` (iframe-friendly)
- API: `GET /api/v1/spherex/blink?target=...|ra=&dec=&fov=0.1&detector=3&mode=epoch|frames`
  and `GET /api/v1/spherex/blink.gif?...` (animated GIF)

The first request for a new field downloads cutouts (30–90 s); after that it is served from `backend/cache/spherex/`.

## 🔬 Scientific Pipeline

OrbitScope implements a modular astronomical detection pipeline:

```
DATA SOURCE → DATA RETRIEVAL → METADATA VALIDATION
    → IMAGE PREPROCESSING → ASTROMETRIC ALIGNMENT
    → SOURCE DETECTION → MULTI-EPOCH ASSOCIATION
    → CANDIDATE GENERATION → JPL CATALOG CROSS-MATCH
    → CLASSIFICATION & UNCERTAINTY → VISUALIZATION
```

### Pipeline Components

| Stage | Method | Library |
|-------|--------|---------|
| Background Estimation | SExtractor-style | Photutils |
| Source Detection | DAOStarFinder | Photutils |
| Image Alignment | WCS-based | Astropy |
| Image Registration | Phase correlation | scikit-image |
| Image Subtraction | Kernel-matched | NumPy/SciPy |
| Candidate Association | Positional matching | Astropy |
| Anomaly Detection | Isolation Forest | scikit-learn |
| Cross-matching | Cone search | JPL SBDB API |

## 🌐 Data Sources

| Source | Type | Status |
|--------|------|--------|
| NASA SPHEREx (via IRSA) | Observations | ✅ Integrated (availability depends on public releases) |
| JPL Small-Body Database | Catalog | ✅ Live API |
| JPL Horizons | Ephemeris | ✅ Live API |
| Demo Data Generator | Testing | ✅ Clearly labeled |

## ⚠️ Data Transparency

OrbitScope clearly distinguishes between:

- **Real Data** — Sourced from NASA/JPL APIs with provenance
- **Simulated Data** — Generated for demonstration, always labeled as `[SIMULATED]`
- **Candidates** — Algorithmically detected, not confirmed discoveries
- **Known Objects** — Cross-matched against verified catalogs

> **Important:** OrbitScope is a scientific analysis tool. It does not claim discoveries.
> All detected candidates require independent verification.
> Planet Nine has not been directly confirmed — the Planet X module explores the scientific hypothesis.

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Frontend Build Check
```bash
cd frontend
npm run build
```

## 🌍 Language Support

OrbitScope supports:
- **English (EN)** — Default
- **Azərbaycan dili (AZ)** — Full Azerbaijani translation

Switch languages using the toggle in the top navigation bar.

## 📚 References

- [NASA SPHEREx Mission](https://spherex.caltech.edu/)
- [NASA/IPAC Infrared Science Archive](https://irsa.ipac.caltech.edu/)
- [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html)
- [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/)
- [Batygin & Brown (2016) — Planet Nine](https://doi.org/10.3847/0004-6256/151/2/22)

## 📄 License

This project is developed for educational and scientific exploration purposes.
NASA data is used under NASA's open data policy.

## 🤝 Credits

Built as a scientific exploration platform demonstrating how SPHEREx observations and NASA/JPL data can be used to explore and investigate potentially moving celestial objects.

---

<div align="center">
<i>OrbitScope — Professional Astronomical Monitoring Platform</i>
<br/>
<i>"Göyü kəşf edin. Naməlumu araşdırın."</i>
</div>
