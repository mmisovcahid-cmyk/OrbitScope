# OrbitScope — Scientific Methodology

## 1. Overview

OrbitScope implements a multi-stage astronomical detection pipeline designed to identify potential moving celestial sources by comparing observations of the same sky region taken at different times (epochs).

The methodology follows established practices in time-domain astronomy and transient detection, adapted for the SPHEREx mission's infrared survey data.

## 2. Data Sources

### 2.1 NASA SPHEREx

SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of Reionization, and Ices Explorer) is a NASA Medium Explorer mission that performs an all-sky spectral survey in 102 spectral bands spanning 0.75–5.0 micrometers.

**Key characteristics:**
- All-sky coverage over a 2-year nominal mission
- Multiple observation epochs for each sky position
- Spectral resolution R ~ 41–135
- Angular resolution ~ 6.2 arcseconds

**Data access:** Via NASA/IPAC Infrared Science Archive (IRSA) TAP service.

**Limitation:** SPHEREx data availability depends on the mission's public release schedule. OrbitScope provides a graceful fallback to clearly labeled simulated data when real observations are not yet accessible.

### 2.2 JPL Small-Body Database (SBDB)

Provides orbital elements, physical parameters, and close-approach data for known asteroids and comets.

**API endpoint:** `https://ssd-api.jpl.nasa.gov/sbdb.api`

### 2.3 JPL Horizons

Provides precise ephemeris computations for solar system bodies.

**API endpoint:** `https://ssd.jpl.nasa.gov/api/horizons.api`

## 3. Detection Pipeline

### 3.1 Image Preprocessing

**Background estimation:**
- Uses sigma-clipped statistics to estimate the background level
- Employs a mesh-based background model (similar to SExtractor)
- Subtracts background to create a flat-field image

**Noise estimation:**
- Computes local RMS noise maps
- Used to set detection thresholds

**Normalization:**
- Flux normalization between epochs
- Zero-point calibration when photometric information is available

### 3.2 Astrometric Alignment

**WCS-based alignment:**
- Uses World Coordinate System (WCS) information from FITS headers
- Reprojects images onto a common coordinate grid using astropy.wcs

**Image registration:**
- Phase-correlation-based registration for subpixel alignment
- Accounts for rotation, translation, and scale differences

**Quality metrics:**
- Alignment residuals
- Number of matched reference sources

### 3.3 Source Detection

**Method: DAOStarFinder (Photutils)**
- Implements the DAOFIND algorithm (Stetson 1987)
- Detects point sources above a configurable significance threshold
- Parameters: FWHM, detection threshold (in sigma units)

**Measurements per source:**
- Centroid position (x, y and RA, Dec)
- Peak flux
- Integrated flux
- FWHM
- Roundness
- Sharpness
- Signal-to-noise ratio

### 3.4 Image Subtraction

**Direct subtraction:**
- Pixel-by-pixel difference of aligned images
- Applied after background subtraction and normalization

**Kernel-matched subtraction:**
- Convolves one image to match the PSF of the other
- Reduces false positives from PSF variations

**Residual analysis:**
- Identifies significant residuals above noise threshold
- Filters based on morphology (real sources vs. artifacts)

### 3.5 Multi-Epoch Source Association

**Positional matching:**
- Cross-matches source catalogs from different epochs
- Uses configurable matching radius (default: 2× FWHM)
- Identifies unmatched sources as potential movers

**Motion analysis:**
- Computes positional displacement between epochs
- Estimates proper motion rate
- Verifies motion consistency with expected apparent rates for solar system objects

**Stationary source filtering:**
- Sources matched within astrometric uncertainty are classified as stationary
- Requires displacement significantly exceeding alignment uncertainty

### 3.6 Candidate Generation

Each moving candidate receives:
- Unique identifier
- Detection coordinates (both epochs)
- Displacement vector
- Time baseline
- Signal-to-noise in each epoch
- Morphological parameters
- Detection method provenance

### 3.7 Catalog Cross-Matching

**JPL SBDB search:**
- Cone search around each candidate position
- Search radius accounts for positional uncertainty + orbital motion
- Matches against known asteroids, comets, and other small bodies

**Classification logic:**
| Match Result | Classification |
|-------------|---------------|
| Exact match with known object | KNOWN_OBJECT |
| Close match, needs verification | CANDIDATE |
| No match in catalog | UNMATCHED_CANDIDATE |
| Morphology suggests artifact | POSSIBLE_ARTIFACT |
| Ambiguous detection | NEEDS_VERIFICATION |

### 3.8 Machine Learning Anomaly Detection

**Method: Isolation Forest (unsupervised)**

**Features:**
- Positional displacement
- Signal-to-noise ratio
- Flux ratio between epochs
- FWHM ratio
- Roundness deviation
- Detection consistency
- Catalog matching distance

**Purpose:**
- Rank candidates by anomaly score
- Prioritize unusual objects for manual inspection
- NOT used as a discovery tool

**Limitation:** Without labeled training data, the ML module operates in an exploratory mode. Results should be interpreted as prioritization, not classification.

## 4. Uncertainty and Limitations

### 4.1 Known Limitations

1. **SPHEREx temporal coverage:** Moving object detection requires multiple observation epochs of the same region. The availability of suitable multi-epoch data depends on the mission's survey strategy and data release schedule.

2. **Angular resolution:** SPHEREx's ~6.2 arcsecond resolution limits detection of slow-moving or distant objects.

3. **False positive sources:** Image artifacts, cosmic rays, and imperfect subtraction can produce false detections. The pipeline includes filters, but manual verification is recommended.

4. **Catalog completeness:** JPL SBDB is extensive but not complete. An unmatched candidate may be a known object not yet in the database.

5. **Simulated data:** When real SPHEREx observations are unavailable, the system generates synthetic data for demonstration purposes. This data is always clearly labeled.

### 4.2 Uncertainty Quantification

- Positional uncertainty from centroid fitting
- Photometric uncertainty from noise statistics
- Association confidence from matching metrics
- Classification confidence from cross-match scoring

## 5. Planet Nine Hypothesis Context

The Planet X module presents published scientific evidence regarding the hypothetical Planet Nine.

**Key points:**
- Planet Nine has NOT been directly detected or confirmed
- The hypothesis is based on gravitational evidence from trans-Neptunian objects (TNOs)
- Published estimated parameters: ~5-10 Earth masses, semi-major axis ~400-800 AU
- Multiple research groups have published supporting and challenging analyses
- OrbitScope does NOT claim to discover Planet Nine

**Primary references:**
- Batygin, K. & Brown, M. E. (2016). "Evidence for a Distant Giant Planet in the Solar System." AJ, 151, 22.
- Brown, M. E. & Batygin, K. (2021). "The Orbit of Planet Nine." AJ, 162, 219.
- Trujillo, C. A. & Sheppard, S. S. (2014). "A Sedna-like body with a perihelion of 80 astronomical units." Nature, 507, 471.

## 6. Reproducibility

All processing parameters are recorded in the pipeline results:
- Detection thresholds
- Alignment parameters
- Matching radii
- ML model parameters
- Data source versions
- Processing timestamps

This enables reproduction of any analysis result.
