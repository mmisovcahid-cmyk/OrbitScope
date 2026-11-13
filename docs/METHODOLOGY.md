# OrbitScope — Scientific Methodology

OrbitScope works only on real public data. Its sources are SPHEREx Level-2 images from NASA/IPAC IRSA, reference catalogs (Gaia DR3, CatWISE2020) and NASA/JPL small-body services. No page substitutes simulated values when a service is unavailable: the user sees an explanation instead (HTTP 502). Every API endpoint and service is listed in [DATA_SOURCES.md](DATA_SOURCES.md).

Detected objects are **candidates**, not discoveries. Planet Nine is presented as an unconfirmed hypothesis.

## 1. SPHEREx data access

| Step | Method |
|---|---|
| Which exposures cover a position | IRSA TAP: `CONTAINS(POINT(ra,dec), s_region)` on `spherex.obscore`. Collections are matched by the `spherex` prefix, so new data releases appear without code changes. |
| File location | IRSA datalink gives the Level-2 FITS URL of each exposure. |
| Pixels | IBE cutout service (`?center=&size=`). Only `IMAGE`, `FLAGS`, `VARIANCE`, `ZODI` and `WCS-WAVE` are kept; the ~5 MB PSF cube is dropped. Cutouts are cached on disk with LRU pruning. |
| Wavelength | SPHEREx uses linear variable filters (LVF): the wavelength changes across each detector. The wavelength of any pixel is read from the `WCS-WAVE` (-TAB) lookup table. Detectors D1–D6 cover 0.75–5.0 µm in 102 spectral channels. |

## 2. Image preparation (`spherex_archive.py`)

1. **Background:**
   - Subtract the `ZODI` model (zodiacal light).
   - Subtract a robust local sky level.
2. **Masking:** pixels with problem `FLAGS` bits are masked.
3. **Reprojection:** each cutout is resampled onto a common north-up gnomonic (TAN) grid.
   - Uses the full SIP distortion WCS with `scipy.ndimage.map_coordinates`.
   - All frames of one target share the grid, so a static star stays on the same pixel.
4. **Coadd per survey pass:**
   - Frames more than 30 days apart are separate passes.
   - Within a pass, frames are combined with inverse-variance weights.
   - A pixel is masked when fewer than half of the exposures are valid there.
5. **Saturated cores:** the cores of very bright stars are saturated (OVERFLOW). They are filled from the surroundings for display only and are never used for measurements.
6. **High proper-motion targets:** the position is propagated from the catalog epoch to each SPHEREx epoch, so the target marker follows the star.
7. **Delivery:** frames are sent to the browser as float32. Stretch, colour map, difference and motion-colour views are computed client-side.

## 3. Spectrum and light curve (`photometry`)

- **Exposure selection:** up to 96 exposures, spread over all detectors and over time.
- **Measurement:** aperture photometry with local-annulus background subtraction and an error from `VARIANCE`.
- **Wavelength per point:** the LVF wavelength at the target pixel. One measurement set therefore gives both a **spectrum** (flux vs. wavelength) and a **light curve** (flux vs. time).
- **Flagged points:** saturated or mostly masked apertures are returned with `flagged: true` instead of being dropped silently.
- **Real-data result:** the T dwarf ε Indi B shows the expected CH₄ absorption near 3.3 µm.

## 4. Moving-object search (`pipeline/moving_objects.py`)

### 4.1 Asteroids and comets (`search=asteroids`)

**Input:** the individual exposures of one survey pass.
- SPHEREx observes in visits of about 4 exposures within about 7 minutes; `select_sequences` keeps those visits intact.
- Paired detectors D1/D4, D2/D5 and D3/D6 expose simultaneously.

**Steps:**
1. **Static-sky template:** the median image per detector. It is subtracted from each exposure.
2. **Noise model:** `σ² + (0.15 · template)²`.
   - The second term absorbs brightness changes of stars caused by the LVF wavelength shift between exposures.
   - Residuals are smoothed with a 1-px Gaussian (matched filter); peaks above 5σ are detections.
3. **Noisy-frame rejection:** frames whose residual noise exceeds 3× the detector median are skipped.
4. **Linking within a visit:**
   - Detections within `VISIT_WINDOW_DAYS = 0.01` are linked by union-find into straight-line tracklets.
   - Each tracklet needs at least 3 detections and an RMS of at most 0.8 px.
5. **Joining across visits:** tracklets are joined when a common linear motion fits all of them (`MAX_JOIN_RMS_PX = 1.5`).
6. **Stationary rejection:** detector persistence and variable stars produce residuals at a fixed position.
   - `recurrence()` checks whether the same position is significant in clearly different visits (gap > 0.05 d, threshold max(4, 0.3·mean z)).
   - A "parked" rule catches zero-motion tracks.
   - Both cases are classified `stationary_transient`, not movers.
7. **Known objects:** NASA/JPL SB Ident is queried once per visit cluster, and positions are extrapolated linearly with the returned rates.
   - A track counts as recovering a known object only if both position (≤ 5 px ≈ 30″) and rate agree.
   - Otherwise it stays an `unknown_mover` candidate.

**Validation on real data:** 626 Notburga (V = 13.5) was recovered with 8 detections, 1.6″ from the JPL position and a rate of 58″/h. Static fields produce no `unknown_mover`.

### 4.2 Proper motion (`search=proper_motion`)

**Input:** one stack per survey pass, typically about 6 months apart.

**Steps:**
1. **Source selection:** isolated, unsaturated sources with S/N ≥ 10 are centroided in every epoch with a re-centred Gaussian fit (`refine_centroid`).
2. **Registration offset:** the global frame-to-frame offset is measured on all stars and removed.
3. **Noise floor:** the scatter of the static stars gives the astrometric noise floor. Each source adds an error term of 1.5/SNR px.
4. **Classification:**
   - A source is reported as moving when its shift is above 5σ and at least 0.25 px.
   - It is reported as variable when its flux ratio between epochs is at least 1.6.
5. **Catalog check:** Gaia DR3 and CatWISE2020 positions are propagated to the SPHEREx epoch.
   - A catalog match must agree in both position and proper-motion vector.
   - The match radius grows for fast catalog movers.

**Validation on real data:**
- ε Indi B: 4.1″/yr at PA ≈ 123°, matched to Gaia.
- WISE 0855−0714: 7.9″/yr at PA 280°, matched to CatWISE.

Saturated stars are excluded from astrometry by design: Barnard's Star, RW Aur and R Dra. They are still shown in Blink.

### 4.3 Candidate handling

- **Storage:** runs and candidates are stored in SQLite (`candidate_store.py`) with metrics, recurrence data and catalog matches.
- **Review:** a human marks each candidate *real / artifact / unsure*.
- **Export:** each candidate's astrometry can be exported as CSV, the starting point for a Minor Planet Center report (submission requires the team's own MPC registration).

## 5. Live JPL catalog (`jpl_catalog.py`)

- **SBDB:** orbit, physical parameters, discovery circumstances and close approaches. An ambiguous name returns a list of matches.
- **Horizons:** observer ephemeris.
  - Asteroids are addressed by `DES=<spkid>;`, comets by `DES=<des>;CAP;`, and planets by their major-body ID.
  - The output is CSV with angles in degrees.
- **SB Ident:** known small bodies in a field at a given time, for the Catalog field search and the detection cross-check.

## 6. Planet Nine test (`etno.py`)

- **Hypothesis being tested:** extreme TNOs (a ≥ 150 AU, q ≥ 30 AU) cluster in orbital orientation (Batygin & Brown 2016).
- **Data:** OrbitScope fetches the current orbits of 20 such objects live from SBDB.
- **Statistic:** a Rayleigh test on the longitude of perihelion ϖ = Ω + ω, and separately on Ω and ω. A small p-value means the angles are not uniformly distributed.
- **Result on live orbits:** mean ϖ ≈ 68°, p ≈ 5×10⁻⁴.
- **What it does not show:** the test does not address the observational selection bias discussed in the literature (e.g. Shankman et al. 2017, Napier et al. 2021), and it is not evidence for the planet itself. Search corridors and evidence cards on the page are taken from published papers and labelled as literature.

## 7. Reproducibility

- **Self-describing results:**
  - Every blink, photometry and detection response contains the exact IRSA file URLs, observation IDs, detector, epoch and pixel scale.
  - Detection runs also store all parameters.
- **Shareable state:** the Blink page URL encodes the full query (`target, ra, dec, fov, det, mode, per, max`).
- **Tests:** the backend tests include real SPHEREx cutouts (`backend/tests/fixtures`) and synthetic moving-object scenes, and run offline.
