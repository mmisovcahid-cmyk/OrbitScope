"""
OrbitScope - NEOSSat archive service (real data, CSA / CADC)
============================================================
NEOSSat (Canadian Space Agency) is a small optical space telescope (0.4-0.9 um, ~3"/pixel)
that takes short exposure sequences of asteroids, comets and stars. Its public science
frames are archived at the Canadian Astronomy Data Centre (CADC); the CSA open-data portal
mirrors the same files.

1. CADC TAP (``caom2.Observation`` / ``Plane`` / ``Artifact``, collection ``NEOSSAT``) ->
   every public science frame whose footprint covers the position.
2. Each frame is downloaded once (CADC, falling back to the CSA mirror) and cached on disk.
3. The raw frames carry no WCS - only the commanded boresight and roll - so every frame is
   plate-solved here against Gaia DR3 (stars detected in the frame are matched to Gaia by a
   rotation + offset vote, then an affine fit). Frames that cannot be solved are reported
   with the reason and are never shown with a guessed position.
4. Solved frames are bias- and sky-subtracted, reprojected onto a north-up TAN grid centred
   on the target, and median-stacked per visit (or shown one by one within a visit).

The result has the same shape as the SPHEREx blink result (``grid`` + ``frames``), so the
browser's blink viewer shows it unchanged.
"""
from __future__ import annotations

import asyncio
import base64
import csv
import io
import json
import math
import time
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
import numpy as np
from astropy.coordinates import Angle
from astropy.io import fits
from astropy.wcs import WCS
from cachetools import TTLCache
from scipy import ndimage
from scipy.ndimage import map_coordinates

from app.core.config import settings
from app.core.logging_config import get_logger
from app.core.progress import gather_with_progress, report
from app.services.catalog_overlay import CatalogError, fetch_catalog
from app.services.spherex_archive import make_target_wcs, mjd_to_iso, mjd_to_year, propagate

logger = get_logger(__name__)

CADC_TAP = "https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus/sync"
CADC_FILE = "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/data/pub/NEOSSAT/{name}"
CSA_FILE = "https://data.asc-csa.gc.ca/users/OpenData_DonneesOuvertes/pub/NEOSSAT/ASTRO/{year}/{doy}/{name}"
CADC_OBS_PAGE = "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/search/?collection=NEOSSAT&observationID={obs}#resultTableTab"

NOMINAL_PIXSCALE = 3.0       # arcsec / pixel (CAOM position_sampleSize)
BANDPASS_UM = (0.4, 0.9)     # clear filter, from the FITS header (BANDPASS = 4000,9000 A)
VISIT_GAP_DAYS = 0.02        # frames < ~30 min apart belong to one visit (sequence)
MAX_DOWNLOADS = 36
DOWNLOAD_CONCURRENCY = 6
COVERAGE_TTL_S = 6 * 3600
CACHE_MAX_MB = 1500

# Plate-solution acceptance (see solve_frame)
MIN_MATCHES = 5
MAX_RMS_ARCSEC = 3.0
SCALE_RANGE = (2.8, 3.2)


class NeossatError(Exception):
    """User-facing NEOSSat errors (no coverage, no solvable frames, upstream failure)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class NeossatFrame:
    obs_id: str
    target: str
    mjd: float          # exposure start (UTC)
    exptime: float      # s
    file: str           # e.g. NEOS_SCI_2019337012448.fits

    @property
    def mjd_mid(self) -> float:
        return self.mjd + self.exptime / 2.0 / 86400.0

    def urls(self) -> list[str]:
        year, doy = self.obs_id[:4], self.obs_id[4:7]
        return [CADC_FILE.format(name=self.file), CSA_FILE.format(year=year, doy=doy, name=self.file)]

    def to_dict(self) -> dict[str, Any]:
        return {"obs_id": self.obs_id, "target": self.target, "mjd": self.mjd, "date": mjd_to_iso(self.mjd),
                "exptime_s": self.exptime, "file": self.file}


@dataclass
class Calibrated:
    image: np.ndarray        # float32, ADU/s, bias and sky subtracted (data section only)
    noise: float             # robust per-pixel noise (ADU/s)
    ra0: float               # boresight at exposure start (deg)
    dec0: float
    roll: float              # deg
    mjd_mid: float


@dataclass
class Solution:
    wcs: WCS
    n_match: int
    n_stars: int
    rms_arcsec: float
    scale_arcsec: float


# ---------------------------------------------------------------- archive queries
def parse_tap_rows(text: str) -> list[NeossatFrame]:
    """CADC TAP CSV (observationID, target_name, time_bounds_lower, time_exposure, uri) -> frames."""
    frames: list[NeossatFrame] = []
    for r in csv.DictReader(io.StringIO(text.strip())):
        try:
            uri = r["uri"]
            name = uri.split("/")[-1]
            if not name.lower().endswith(".fits"):
                continue
            frames.append(NeossatFrame(
                obs_id=r["observationID"], target=(r.get("target_name") or "").strip(),
                mjd=float(r["time_bounds_lower"]), exptime=float(r.get("time_exposure") or 0.0), file=name,
            ))
        except (KeyError, ValueError):
            continue
    frames.sort(key=lambda f: f.mjd)
    return frames


def group_visits(frames: list[NeossatFrame], gap_days: float = VISIT_GAP_DAYS) -> list[list[NeossatFrame]]:
    visits: list[list[NeossatFrame]] = []
    for f in sorted(frames, key=lambda f: f.mjd):
        if visits and f.mjd - visits[-1][-1].mjd < gap_days:
            visits[-1].append(f)
        else:
            visits.append([f])
    return visits


def summarize(frames: list[NeossatFrame]) -> dict[str, Any]:
    visits = group_visits(frames)
    return {
        "total_frames": len(frames),
        "n_visits": len(visits),
        "date_min": mjd_to_iso(frames[0].mjd) if frames else None,
        "date_max": mjd_to_iso(frames[-1].mjd) if frames else None,
        "visits": [
            {
                "index": i, "start": mjd_to_iso(v[0].mjd), "end": mjd_to_iso(v[-1].mjd), "n_frames": len(v),
                "targets": sorted({f.target for f in v if f.target}),
                "exptime_s": round(float(np.median([f.exptime for f in v])), 3),
            }
            for i, v in enumerate(visits)
        ],
        "collection": "NEOSSAT",
        "bandpass_um": list(BANDPASS_UM),
    }


def _spread(items: list, n: int) -> list:
    if len(items) <= n:
        return list(items)
    idx = np.linspace(0, len(items) - 1, n).round().astype(int)
    return [items[i] for i in sorted(set(idx.tolist()))]


# ---------------------------------------------------------------- calibration and astrometry
def _section(spec: str) -> tuple[slice, slice]:
    """FITS section '[x0:x1,y0:y1]' (1-based, inclusive) -> numpy (rows, cols) slices."""
    x, y = spec.strip().strip("[]").split(",")
    x0, x1 = (int(v) for v in x.split(":"))
    y0, y1 = (int(v) for v in y.split(":"))
    return slice(y0 - 1, y1), slice(x0 - 1, x1)


def _background(img: np.ndarray, box: int = 32) -> np.ndarray:
    """Smooth sky estimate: median of box x box blocks, bilinearly interpolated."""
    ny, nx = img.shape
    by, bx = max(1, ny // box), max(1, nx // box)
    grid = np.empty((by, bx), np.float64)
    for j in range(by):
        for i in range(bx):
            block = img[j * ny // by:(j + 1) * ny // by, i * nx // bx:(i + 1) * nx // bx]
            grid[j, i] = np.nanmedian(block)
    if by == 1 and bx == 1:
        return np.full_like(img, grid[0, 0])
    yy = (np.arange(ny) + 0.5) * by / ny - 0.5
    xx = (np.arange(nx) + 0.5) * bx / nx - 0.5
    gy, gx = np.meshgrid(np.clip(yy, 0, by - 1), np.clip(xx, 0, bx - 1), indexing="ij")
    return map_coordinates(grid, [gy, gx], order=1, mode="nearest")


def calibrate(hdu: fits.PrimaryHDU, frame: NeossatFrame) -> Calibrated:
    h = hdu.header
    raw = np.asarray(hdu.data, dtype=np.float64)
    data = raw[_section(h.get("DATASEC") or h.get("TRIMSEC"))] if (h.get("DATASEC") or h.get("TRIMSEC")) else raw
    bias = float(np.median(raw[_section(h["BIASSEC"])])) if h.get("BIASSEC") else float(np.percentile(data, 5))
    exptime = float(h.get("EXPOSURE") or h.get("AEXPTIME") or frame.exptime or 1.0)
    img = (data - bias) / max(exptime, 1e-3)
    img = img - _background(img)
    # Raw NEOSSat frames show column banding (read-out pattern): remove each column's median.
    # Stars cover a small fraction of a column, so the median is the pattern, not the stars.
    img = img - np.median(img, axis=0, keepdims=True)
    resid = img[np.isfinite(img)]
    noise = float(np.median(np.abs(resid - np.median(resid))) * 1.4826) if resid.size else 1.0
    ra0 = float(Angle(str(h.get("RA") or h["OBJCTRA"]).replace(" ", ":"), unit="hourangle").deg)
    dec0 = float(Angle(str(h.get("DEC") or h["OBJCTDEC"]).replace(" ", ":"), unit="deg").deg)
    roll = float(h.get("OBJCTROL", h.get("CMDROL", 0.0)) or 0.0)
    return Calibrated(image=img.astype(np.float32), noise=max(noise, 1e-6), ra0=ra0, dec0=dec0, roll=roll,
                      mjd_mid=frame.mjd + exptime / 2.0 / 86400.0)


def detect_stars(img: np.ndarray, noise: float, nmax: int = 40) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Star-like peaks (> 6 sigma, spread over >= 4 pixels, so hot pixels and cosmics drop out)."""
    hot = img > 3.0 * noise
    support = ndimage.uniform_filter(hot.astype(np.float32), size=3) * 9.0
    peaks = (img == ndimage.maximum_filter(img, size=7)) & (img > 6.0 * noise) & (support >= 4.0)
    peaks[:3, :] = peaks[-3:, :] = False
    peaks[:, :3] = peaks[:, -3:] = False
    ys, xs = np.nonzero(peaks)
    if xs.size == 0:
        return np.empty(0), np.empty(0), np.empty(0)
    flux = img[ys, xs]
    order = np.argsort(-flux)[:nmax]
    xs, ys, flux = xs[order], ys[order], flux[order]
    cx, cy = np.empty(len(xs)), np.empty(len(xs))
    for k, (x, y) in enumerate(zip(xs, ys)):
        win = np.clip(img[y - 2:y + 3, x - 2:x + 3], 0, None)
        s = win.sum()
        oy, ox = np.mgrid[-2:3, -2:3]
        cx[k] = x + ((win * ox).sum() / s if s > 0 else 0.0)
        cy[k] = y + ((win * oy).sum() / s if s > 0 else 0.0)
    return cx, cy, flux


def _standard(ra: np.ndarray, dec: np.ndarray, ra0: float, dec0: float) -> tuple[np.ndarray, np.ndarray]:
    """Gnomonic standard coordinates (xi east, eta north) in arcsec about (ra0, dec0)."""
    d2r = math.pi / 180.0
    r, d, r0, d0 = ra * d2r, dec * d2r, ra0 * d2r, dec0 * d2r
    cosc = np.sin(d0) * np.sin(d) + np.cos(d0) * np.cos(d) * np.cos(r - r0)
    xi = np.cos(d) * np.sin(r - r0) / cosc
    eta = (np.cos(d0) * np.sin(d) - np.sin(d0) * np.cos(d) * np.cos(r - r0)) / cosc
    return xi / d2r * 3600.0, eta / d2r * 3600.0


def _vote(px, py, xi, eta, angles, parities, half=1800.0, bins=180):
    """Rotation + offset vote: rotate the pixel pattern, histogram all star-Gaia offsets."""
    best = (0.0, 1, 0.0, 0.0, 0.0)
    for parity in parities:
        for th in angles:
            t = math.radians(th)
            X = px * math.cos(t) - parity * py * math.sin(t)
            Y = px * math.sin(t) + parity * py * math.cos(t)
            dx = (xi[None, :] - X[:, None]).ravel()
            dy = (eta[None, :] - Y[:, None]).ravel()
            m = (np.abs(dx) < half) & (np.abs(dy) < half)
            if not m.any():
                continue
            H, ex, ey = np.histogram2d(dx[m], dy[m], bins=bins, range=[[-half, half], [-half, half]])
            k = float(H.max())
            if k > best[0]:
                i, j = np.unravel_index(int(H.argmax()), H.shape)
                best = (k, parity, float(th), float((ex[i] + ex[i + 1]) / 2), float((ey[j] + ey[j + 1]) / 2))
    return best


def _affine_matches(xs, ys, xi, eta, predict, tol):
    """Nearest Gaia star to each predicted position within tol arcsec -> affine fit."""
    X, Y = predict(xs, ys)
    d = np.hypot(xi[None, :] - X[:, None], eta[None, :] - Y[:, None])
    j = d.argmin(axis=1)
    ok = d[np.arange(len(xs)), j] < tol
    # one Gaia star may only be used once
    if ok.any():
        _, first = np.unique(j[ok], return_index=True)
        keep = np.zeros(ok.sum(), bool)
        keep[first] = True
        ok_idx = np.nonzero(ok)[0][keep]
        ok = np.zeros_like(ok)
        ok[ok_idx] = True
    n = int(ok.sum())
    if n < 3:
        return n, None
    A = np.c_[xs[ok], ys[ok], np.ones(n)]
    cx, *_ = np.linalg.lstsq(A, xi[j[ok]], rcond=None)
    cy, *_ = np.linalg.lstsq(A, eta[j[ok]], rcond=None)
    res = np.hypot(A @ cx - xi[j[ok]], A @ cy - eta[j[ok]])
    return n, (cx, cy, float(np.sqrt(np.mean(res ** 2))))


def solve_frame(
    xs: np.ndarray, ys: np.ndarray, shape: tuple[int, int], gaia_ra: np.ndarray, gaia_dec: np.ndarray,
    ra0: float, dec0: float, roll: float,
) -> tuple[Optional[Solution], str]:
    """Plate solution of one frame. Returns (solution, "") or (None, reason)."""
    if len(xs) < MIN_MATCHES:
        return None, "too_few_stars"
    if len(gaia_ra) < MIN_MATCHES:
        return None, "too_few_reference_stars"
    xi, eta = _standard(gaia_ra, gaia_dec, ra0, dec0)
    cx0, cy0 = (shape[1] - 1) / 2.0, (shape[0] - 1) / 2.0
    px, py = (xs - cx0) * NOMINAL_PIXSCALE, (ys - cy0) * NOMINAL_PIXSCALE

    # The header roll predicts the sky angle (validated on real frames: angle = roll + 270 deg).
    # Search around it first; only if that fails, search the full circle and both parities.
    hint = (roll + 270.0) % 360.0
    votes = _vote(px, py, xi, eta, np.arange(hint - 20.0, hint + 20.01, 0.5), (1,))
    if votes[0] < MIN_MATCHES:
        votes = _vote(px, py, xi, eta, np.arange(0.0, 360.0, 0.5), (1, -1))
    if votes[0] < MIN_MATCHES:
        return None, "no_pattern_match"
    _, parity, th, ox, oy = votes
    t = math.radians(th)

    def first_guess(x, y):
        qx, qy = (x - cx0) * NOMINAL_PIXSCALE, (y - cy0) * NOMINAL_PIXSCALE
        return (qx * math.cos(t) - parity * qy * math.sin(t) + ox, qx * math.sin(t) + parity * qy * math.cos(t) + oy)

    n, fit = _affine_matches(xs, ys, xi, eta, first_guess, tol=9.0)
    if fit is None:
        return None, "no_pattern_match"
    for tol in (6.0, 4.5):  # refine with the fitted transform
        cx, cy, _ = fit
        n2, fit2 = _affine_matches(xs, ys, xi, eta, lambda x, y, cx=cx, cy=cy: (cx[0] * x + cx[1] * y + cx[2],
                                                                                 cy[0] * x + cy[1] * y + cy[2]), tol)
        if fit2 is None:
            break
        n, fit = n2, fit2
    cx, cy, rms = fit
    scale = math.sqrt(abs(cx[0] * cy[1] - cx[1] * cy[0]))
    if n < MIN_MATCHES or n < 0.3 * len(xs):
        return None, "too_few_matches"
    if rms > MAX_RMS_ARCSEC:
        return None, "poor_fit"
    if not SCALE_RANGE[0] <= scale <= SCALE_RANGE[1]:
        return None, "wrong_scale"

    # pixel -> standard coordinates is affine; the tangent point (xi = eta = 0) is the reference pixel
    M = np.array([[cx[0], cx[1]], [cy[0], cy[1]]])
    x_ref, y_ref = np.linalg.solve(M, -np.array([cx[2], cy[2]]))
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra0, dec0]
    w.wcs.crpix = [x_ref + 1.0, y_ref + 1.0]  # FITS pixels are 1-based
    w.wcs.cd = M / 3600.0
    return Solution(wcs=w, n_match=n, n_stars=len(xs), rms_arcsec=round(rms, 2), scale_arcsec=round(scale, 4)), ""


def reproject(img: np.ndarray, wcs: WCS, world_ra: np.ndarray, world_dec: np.ndarray) -> np.ndarray:
    px, py = wcs.world_to_pixel_values(world_ra, world_dec)
    ny, nx = img.shape
    inside = (px >= 0) & (px <= nx - 1) & (py >= 0) & (py <= ny - 1)
    out = map_coordinates(np.nan_to_num(img), [py, px], order=1, mode="constant", cval=0.0)
    return np.where(inside, out, np.nan).astype(np.float32)


# ---------------------------------------------------------------- archive class
class NeossatArchive:
    def __init__(self, cache_dir: Optional[Path] = None, tap_url: str = CADC_TAP) -> None:
        self.cache_dir = Path(cache_dir or Path(settings.SPHEREX_CACHE_DIR).parent / "neossat")
        self.tap_url = tap_url
        self._coverage: TTLCache = TTLCache(maxsize=256, ttl=COVERAGE_TTL_S)
        self._new_downloads = 0

    # coverage --------------------------------------------------------------
    def _coverage_path(self, ra: float, dec: float) -> Path:
        d = self.cache_dir / "coverage"
        d.mkdir(parents=True, exist_ok=True)
        return d / f"{ra:.4f}_{dec:+.4f}.json"

    async def query_frames(self, ra: float, dec: float, radius_deg: float = 0.01) -> list[NeossatFrame]:
        key = (round(ra, 4), round(dec, 4), round(radius_deg, 4))
        if key in self._coverage:
            return self._coverage[key]
        path = self._coverage_path(ra, dec)
        try:
            if path.exists() and time.time() - path.stat().st_mtime < COVERAGE_TTL_S:
                frames = [NeossatFrame(**f) for f in json.loads(path.read_text(encoding="utf-8"))]
                self._coverage[key] = frames
                return frames
        except Exception:  # noqa: BLE001 - corrupt cache: query again
            pass
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        # Only public frames (dataRelease in the past); raw science frames are the only NEOSSat
        # science product CADC serves for most fields.
        query = (
            "SELECT o.observationID, o.target_name, p.time_bounds_lower, p.time_exposure, a.uri "
            "FROM caom2.Observation o JOIN caom2.Plane p ON o.obsID = p.obsID "
            "JOIN caom2.Artifact a ON a.planeID = p.planeID "
            "WHERE o.collection = 'NEOSSAT' AND o.intent = 'science' AND a.productType = 'science' "
            f"AND p.dataRelease <= '{now}' "
            f"AND INTERSECTS(CIRCLE('ICRS', {ra:.6f}, {dec:.6f}, {radius_deg:.5f}), p.position_bounds) = 1 "
            "ORDER BY p.time_bounds_lower"
        )
        try:
            # CADC answers a sync POST with 303 -> result URL
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0), follow_redirects=True) as client:
                resp = await client.post(self.tap_url, data={"LANG": "ADQL", "FORMAT": "csv", "QUERY": query})
        except httpx.HTTPError as exc:
            raise NeossatError("upstream", f"CADC TAP unreachable: {exc}") from exc
        if resp.status_code != 200 or resp.text.lstrip().startswith("<"):
            raise NeossatError("upstream", f"CADC TAP error (HTTP {resp.status_code})")
        frames = parse_tap_rows(resp.text)
        self._coverage[key] = frames
        try:
            path.write_text(json.dumps([f.__dict__ for f in frames]), encoding="utf-8")
        except OSError as exc:
            logger.warning(f"Could not cache NEOSSat coverage: {exc}")
        return frames

    # downloads -------------------------------------------------------------
    def _frame_path(self, f: NeossatFrame) -> Path:
        d = self.cache_dir / "frames"
        d.mkdir(parents=True, exist_ok=True)
        return d / f.file

    async def fetch_frame(self, client: httpx.AsyncClient, sem: asyncio.Semaphore, f: NeossatFrame) -> Optional[tuple[fits.PrimaryHDU, str]]:
        path = self._frame_path(f)
        url_file = path.with_suffix(".url")
        if path.exists():
            try:
                with fits.open(path) as hl:
                    hdu = fits.PrimaryHDU(data=np.array(hl[0].data), header=hl[0].header.copy())
                return hdu, url_file.read_text(encoding="utf-8") if url_file.exists() else f.urls()[0]
            except Exception:  # noqa: BLE001 - corrupt cache file: download again
                path.unlink(missing_ok=True)
        async with sem:
            for url in f.urls():
                for attempt in range(3):
                    try:
                        resp = await client.get(url)
                    except httpx.HTTPError:
                        await asyncio.sleep(1.5 * (attempt + 1))
                        continue
                    if resp.status_code == 200 and resp.content[:6] == b"SIMPLE":
                        try:
                            with fits.open(io.BytesIO(resp.content)) as hl:
                                hdu = fits.PrimaryHDU(data=np.array(hl[0].data), header=hl[0].header.copy())
                            hdu.writeto(path, overwrite=True)  # keep only the image (drops telemetry tables)
                            url_file.write_text(url, encoding="utf-8")
                            self._new_downloads += 1
                            return hdu, url
                        except Exception as exc:  # noqa: BLE001 - unreadable file: try the mirror
                            logger.warning(f"NEOSSat {f.file}: unreadable FITS from {url}: {exc}")
                            break
                    if resp.status_code in (429, 500, 502, 503, 504):
                        await asyncio.sleep(1.5 * (attempt + 1))
                        continue
                    break  # 404 etc.: try the next mirror
        return None

    def cache_stats(self) -> dict[str, Any]:
        files = list((self.cache_dir / "frames").glob("*.fits")) if (self.cache_dir / "frames").exists() else []
        return {"frames": len(files), "size_mb": round(sum(p.stat().st_size for p in files) / 1e6, 1)}

    def prune_cache(self, max_mb: float = CACHE_MAX_MB) -> None:
        d = self.cache_dir / "frames"
        if not d.exists():
            return
        files = sorted(d.glob("*.fits"), key=lambda p: p.stat().st_mtime)
        total = sum(p.stat().st_size for p in files)
        while files and total > max_mb * 1e6:
            p = files.pop(0)
            total -= p.stat().st_size
            p.unlink(missing_ok=True)
            p.with_suffix(".url").unlink(missing_ok=True)

    # blink -----------------------------------------------------------------
    async def build_blink(
        self, ra: float, dec: float, fov_deg: float = 0.1, mode: str = "visits", visit_index: Optional[int] = None,
        per_visit: int = 5, max_frames: int = 12, pmra: Optional[float] = None, pmdec: Optional[float] = None,
        ref_epoch: float = 2000.0,
    ) -> dict[str, Any]:
        """mode="visits": one median stack per visit (per_visit exposures each, up to max_frames visits)
        mode="frames": individual exposures of one visit (visit_index; default the richest visit)."""
        t0 = time.perf_counter()
        has_pm = pmra is not None and pmdec is not None and (abs(pmra) > 0 or abs(pmdec) > 0)
        report("neossat_coverage")
        frames = await self.query_frames(ra, dec)
        if has_pm and not frames:
            # high-proper-motion targets: also look where the star was mid-way through the mission
            frames = await self.query_frames(*propagate(ra, dec, pmra or 0.0, pmdec or 0.0, ref_epoch, 2021.0))
        if not frames:
            raise NeossatError("no_coverage", "NEOSSat has no public science frames of this position.")
        coverage = summarize(frames)
        visits = group_visits(frames)

        if mode == "frames":
            vi = visit_index if visit_index is not None else max(range(len(visits)), key=lambda i: len(visits[i]))
            if not 0 <= vi < len(visits):
                raise NeossatError("bad_visit", f"Visit index must be 0..{len(visits) - 1}.")
            groups = [[f] for f in _spread(visits[vi], min(max_frames, MAX_DOWNLOADS))]
        else:
            vi = None
            chosen = _spread(visits, max_frames)
            per = max(1, min(per_visit, MAX_DOWNLOADS // max(1, len(chosen))))
            groups = [_spread(v, per) for v in chosen]

        picked = [f for g in groups for f in g]
        mjds = [f.mjd_mid for f in picked]
        mid = (min(mjds) + max(mjds)) / 2.0
        c_ra, c_dec = propagate(ra, dec, pmra or 0.0, pmdec or 0.0, ref_epoch, mjd_to_year(mid)) if has_pm else (ra, dec)

        # Gaia DR3 reference stars for the plate solutions (brightest first, cached on disk)
        report("neossat_gaia")
        try:
            gaia = await fetch_catalog("gaia", c_ra, c_dec, radius_deg=0.35, limit=800)
        except CatalogError as exc:
            raise NeossatError("catalog_down", f"Gaia DR3 unavailable: {exc}") from exc
        g_src = [s for s in gaia["sources"] if s.get("mag") is None or s["mag"] < 16.5]

        sem = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0), follow_redirects=True) as client:
            downloaded = await gather_with_progress("download", (self.fetch_frame(client, sem, f) for f in picked))
        if self._new_downloads >= 50:
            self._new_downloads = 0
            await asyncio.to_thread(self.prune_cache)
        if not any(downloaded):
            raise NeossatError("upstream", "Could not download any NEOSSat frames from CADC or the CSA mirror.")

        report("solve")
        result = await asyncio.to_thread(
            self._assemble, groups, dict(zip((f.obs_id for f in picked), downloaded)), g_src, gaia.get("ref_epoch", 2016.0),
            fov_deg, c_ra, c_dec, ra, dec, pmra, pmdec, ref_epoch, has_pm,
        )
        out_frames, rejected, size_px = result
        if not out_frames:
            raise NeossatError("no_solution", "NEOSSat frames were found, but none could be placed on the sky.")

        finite = np.concatenate([f["_arr"][np.isfinite(f["_arr"])] for f in out_frames])
        for f in out_frames:
            f.pop("_arr")
        vmin, vmax = (float(np.percentile(finite, 1.0)), float(np.percentile(finite, 99.7))) if finite.size else (0.0, 1.0)
        return {
            "target": {"ra": ra, "dec": dec, "pmra": pmra, "pmdec": pmdec, "ref_epoch": ref_epoch,
                       "center_ra": c_ra, "center_dec": c_dec},
            "grid": {
                "width": size_px, "height": size_px, "pixscale_arcsec": NOMINAL_PIXSCALE,
                "fov_deg": size_px * NOMINAL_PIXSCALE / 3600.0, "crpix": [(size_px - 1) / 2.0] * 2,
                "ra": c_ra, "dec": c_dec, "projection": "TAN", "orientation": "north-up, east-left",
            },
            "coverage": coverage,
            "mode": mode,
            "visit_index": vi,
            "frames": out_frames,
            "rejected": rejected,
            "stretch_hint": {"vmin": vmin, "vmax": vmax},
            "units": "ADU/s (raw frames: overscan bias and local sky subtracted, no flat field)",
            "unit_short": "ADU/s",
            "astrometry": f"each frame plate-solved against Gaia DR3 ({gaia.get('mirror', 'ESA')})",
            "source": "CSA NEOSSat raw science frames via CADC (CSA open-data mirror as fallback)",
            "is_simulated": False,
            "elapsed_s": round(time.perf_counter() - t0, 2),
        }

    def _assemble(self, groups, downloaded, g_src, g_epoch, fov_deg, c_ra, c_dec, ra, dec, pmra, pmdec, ref_epoch, has_pm):
        size_px = int(round(fov_deg * 3600.0 / NOMINAL_PIXSCALE))
        size_px = max(15, size_px + (1 - size_px % 2))
        out_wcs = make_target_wcs(c_ra, c_dec, size_px, NOMINAL_PIXSCALE)
        yy, xx = np.mgrid[0:size_px, 0:size_px]
        world_ra, world_dec = out_wcs.pixel_to_world_values(xx, yy)
        g_ra = np.array([s["ra"] for s in g_src], float)
        g_dec = np.array([s["dec"] for s in g_src], float)
        g_pmra = np.array([s.get("pmra") or 0.0 for s in g_src], float)
        g_pmdec = np.array([s.get("pmdec") or 0.0 for s in g_src], float)

        rejected: list[dict[str, Any]] = []
        out: list[dict[str, Any]] = []
        n_total = sum(len(g) for g in groups)
        n_done = 0
        for gi, group in enumerate(groups):
            stack, used = [], []
            for f in group:
                n_done += 1
                report("solve", n_done, n_total)
                got = downloaded.get(f.obs_id)
                if got is None:
                    rejected.append({**f.to_dict(), "reason": "download_failed"})
                    continue
                hdu, url = got
                try:
                    cal = calibrate(hdu, f)
                except Exception as exc:  # noqa: BLE001 - malformed header
                    logger.warning(f"NEOSSat {f.file}: calibration failed: {exc}")
                    rejected.append({**f.to_dict(), "reason": "bad_header"})
                    continue
                year = mjd_to_year(cal.mjd_mid)
                dt = year - g_epoch
                cosd = np.maximum(np.cos(np.radians(g_dec)), 1e-6)
                ref_ra = g_ra + g_pmra * dt / 3.6e6 / cosd
                ref_dec = g_dec + g_pmdec * dt / 3.6e6
                xs, ys, _ = detect_stars(cal.image, cal.noise)
                sol, reason = solve_frame(xs, ys, cal.image.shape, ref_ra, ref_dec, cal.ra0, cal.dec0, cal.roll)
                if sol is None:
                    rejected.append({**f.to_dict(), "reason": reason, "n_stars": int(len(xs))})
                    continue
                t_ra, t_dec = propagate(ra, dec, pmra or 0.0, pmdec or 0.0, ref_epoch, year) if has_pm else (ra, dec)
                tx, ty = sol.wcs.world_to_pixel_values(t_ra, t_dec)
                ny, nx = cal.image.shape
                if not (0 <= tx <= nx - 1 and 0 <= ty <= ny - 1):
                    rejected.append({**f.to_dict(), "reason": "target_outside_frame"})
                    continue
                stack.append(reproject(cal.image, sol.wcs, world_ra, world_dec))
                used.append((f, url, sol, cal))
            if not used:
                continue
            if len(stack) == 1:
                arr = stack[0]
            else:
                with warnings.catch_warnings():  # pixels outside every frame stay NaN
                    warnings.simplefilter("ignore", RuntimeWarning)
                    arr = np.nanmedian(np.stack(stack), axis=0).astype(np.float32)
            mask = ~np.isfinite(arr)
            mjd = float(np.mean([c.mjd_mid for _, _, _, c in used]))
            t_ra, t_dec = propagate(ra, dec, pmra or 0.0, pmdec or 0.0, ref_epoch, mjd_to_year(mjd)) if has_pm else (ra, dec)
            px, py = out_wcs.world_to_pixel_values(t_ra, t_dec)
            target_px = [round(float(px), 2), round(float(py), 2)] if np.isfinite(px) and np.isfinite(py) else None
            out.append({
                "index": len(out), "group": gi, "mjd": mjd, "date": mjd_to_iso(mjd),
                "date_start": mjd_to_iso(min(f.mjd for f, *_ in used)),
                "date_end": mjd_to_iso(max(f.mjd for f, *_ in used)),
                "n_frames": len(used), "detectors": [], "wavelength_um": list(BANDPASS_UM),
                "members": [
                    {"obs_id": f.obs_id, "collection": "NEOSSAT", "detector": 0, "mjd": f.mjd, "date": mjd_to_iso(f.mjd),
                     "wavelength_um": list(BANDPASS_UM), "wavelength_center_um": 0.6, "url": url,
                     "target": f.target, "exptime_s": f.exptime,
                     "astrometry": {"n_match": s.n_match, "n_stars": s.n_stars, "rms_arcsec": s.rms_arcsec,
                                    "scale_arcsec": s.scale_arcsec}}
                    for f, url, s, _ in used
                ],
                "flags": {}, "masked_fraction": round(float(mask.mean()), 4), "target_px": target_px,
                "data": base64.b64encode(np.ascontiguousarray(arr, dtype="<f4").tobytes()).decode("ascii"),
                "mask": base64.b64encode(np.packbits(mask.astype(np.uint8)).tobytes()).decode("ascii"),
                "_arr": arr,
            })
        return out, rejected, size_px


neossat_archive = NeossatArchive()
