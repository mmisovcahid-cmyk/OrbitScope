"""
OrbitScope - SPHEREx Archive Service (real data)
=================================================
Retrieves real NASA SPHEREx Level-2 spectral images from NASA/IPAC IRSA and turns
them into a time series ("blink" frames) centred on a sky position:

1. ``spherex.obscore`` TAP query -> every SPHEREx frame whose footprint covers the point.
   Collections are matched with ``LIKE 'spherex%'`` so new data releases appear automatically.
2. IRSA datalink -> direct Level-2 FITS URL for each selected frame (cached on disk).
3. IBE cutout service -> small FITS cutout (IMAGE, FLAGS, VARIANCE, ZODI, WCS-WAVE),
   stored on disk without the large PSF cube.
4. Frames are zodi- and sky-subtracted, flag-masked, reprojected onto a common
   north-up TAN grid centred on the target, and inverse-variance co-added per epoch.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import math
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import httpx
import numpy as np
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS, FITSFixedWarning
from cachetools import TTLCache
from scipy import ndimage
from scipy.ndimage import map_coordinates

from app.core.config import settings
from app.core.logging_config import get_logger

import warnings
from astropy import log as astropy_log

warnings.filterwarnings("ignore", category=FITSFixedWarning)
astropy_log.setLevel("ERROR")

logger = get_logger(__name__)

IRSA_ROOT = "https://irsa.ipac.caltech.edu"
DATALINK_URL = f"{IRSA_ROOT}/datalink/links/spherex"

# Approximate wavelength coverage of the six SPHEREx detector arrays (micron).
DETECTOR_BANDS: dict[int, tuple[float, float]] = {
    1: (0.75, 1.11),
    2: (1.10, 1.65),
    3: (1.63, 2.42),
    4: (2.42, 3.82),
    5: (3.82, 4.42),
    6: (4.41, 5.01),
}

# FLAGS bits masked before co-adding (bit numbers are read from the FITS header when present).
MASKED_FLAG_NAMES = ("TRANSIENT", "NONFUNC", "MISSING_DATA", "HOT", "COLD", "OUTLIER")
DEFAULT_FLAG_BITS: dict[str, int] = {
    "TRANSIENT": 0, "OVERFLOW": 1, "SUR_ERROR": 2, "PHANTOM": 4, "REFERENCE": 5,
    "NONFUNC": 6, "DICHROIC": 7, "MISSING_DATA": 9, "HOT": 10, "COLD": 11,
    "FULLSAMPLE": 12, "PHANMISS": 14, "NONLINEAR": 15, "PERSIST": 17, "OUTLIER": 19, "SOURCE": 21,
}
REPORTED_FLAGS = ("OVERFLOW", "SUR_ERROR", "NONLINEAR", "PERSIST", "OUTLIER", "TRANSIENT", "HOT", "NONFUNC", "DICHROIC")

NATIVE_PIXSCALE_ARCSEC = 6.15
EPOCH_GAP_DAYS = 30.0
MAX_DOWNLOADS = 48


class SpherexError(Exception):
    """Raised for user-facing archive errors (no coverage, upstream failure)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class FrameRecord:
    obs_id: str
    collection: str
    detector: int
    mjd: float
    em_min_um: float
    em_max_um: float

    @property
    def key(self) -> str:
        return f"{self.collection}:{self.obs_id}:D{self.detector}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "obs_id": self.obs_id,
            "collection": self.collection,
            "detector": self.detector,
            "mjd": self.mjd,
            "date": mjd_to_iso(self.mjd),
            "wavelength_um": [round(self.em_min_um, 3), round(self.em_max_um, 3)],
        }


@dataclass
class Cutout:
    record: FrameRecord
    url: str
    image: np.ndarray
    flags: np.ndarray
    variance: np.ndarray
    wcs: WCS
    mjd: float
    wavelength_um: Optional[float]
    flag_bits: dict[str, int] = field(default_factory=dict)


def mjd_to_iso(mjd: float) -> str:
    return Time(mjd, format="mjd").to_datetime().strftime("%Y-%m-%dT%H:%M:%SZ")


def mjd_to_year(mjd: float) -> float:
    return float(Time(mjd, format="mjd").jyear)


def propagate(ra: float, dec: float, pmra: float, pmdec: float, ref_epoch: float, epoch: float) -> tuple[float, float]:
    """Linear proper-motion propagation (pm in mas/yr, pmra includes cos(dec))."""
    dt = epoch - ref_epoch
    dec_new = dec + pmdec * dt / 3.6e6
    cosd = max(math.cos(math.radians(dec)), 1e-6)
    ra_new = (ra + pmra * dt / 3.6e6 / cosd) % 360.0
    return ra_new, dec_new


def make_target_wcs(ra: float, dec: float, size_px: int, pixscale_arcsec: float) -> WCS:
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra, dec]
    w.wcs.crpix = [(size_px + 1) / 2.0, (size_px + 1) / 2.0]
    w.wcs.cdelt = [-pixscale_arcsec / 3600.0, pixscale_arcsec / 3600.0]
    return w


class SpherexArchive:
    """Real SPHEREx data access + blink-frame construction."""

    def __init__(self, cache_dir: Optional[Path] = None) -> None:
        self.tap_url = settings.IRSA_TAP_URL
        self.cache_dir = Path(cache_dir or settings.SPHEREX_CACHE_DIR)
        (self.cache_dir / "cutouts").mkdir(parents=True, exist_ok=True)
        self._urls_path = self.cache_dir / "datalink_urls.json"
        self._urls: dict[str, str] = self._load_json(self._urls_path)
        self._coverage_cache: TTLCache = TTLCache(maxsize=256, ttl=6 * 3600)
        self._sem = asyncio.Semaphore(6)
        self._locks: dict[str, asyncio.Lock] = {}

    # ------------------------------------------------------------------ utils
    @staticmethod
    def _load_json(path: Path) -> dict[str, str]:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _save_urls(self) -> None:
        try:
            self._urls_path.write_text(json.dumps(self._urls), encoding="utf-8")
        except Exception as exc:  # cache write failures are non-fatal
            logger.warning(f"Could not persist datalink cache: {exc}")

    # --------------------------------------------------------------- coverage
    async def query_frames(self, ra: float, dec: float) -> list[FrameRecord]:
        """All SPHEREx L2 frames whose footprint contains (ra, dec), sorted by time."""
        key = f"{ra:.3f}:{dec:.3f}"
        if key in self._coverage_cache:
            return self._coverage_cache[key]

        disk = self.cache_dir / f"coverage_{hashlib.md5(key.encode()).hexdigest()[:16]}.json"
        if disk.exists() and time.time() - disk.stat().st_mtime < 24 * 3600:
            rows = json.loads(disk.read_text(encoding="utf-8"))
        else:
            adql = (
                "SELECT obs_collection, obs_id, t_min, t_max, em_min, em_max, energy_bandpassname "
                "FROM spherex.obscore "
                f"WHERE CONTAINS(POINT('ICRS', {ra:.6f}, {dec:.6f}), s_region) = 1"
            )
            try:
                async with httpx.AsyncClient(timeout=180.0) as client:
                    resp = await client.post(
                        self.tap_url, data={"LANG": "ADQL", "FORMAT": "csv", "QUERY": adql}
                    )
            except httpx.HTTPError as exc:
                raise SpherexError("upstream", f"IRSA TAP request failed: {exc}") from exc
            if resp.status_code != 200 or "QUERY_STATUS" in resp.text[:2000]:
                raise SpherexError("upstream", f"IRSA TAP error (HTTP {resp.status_code})")
            rows = self._parse_csv(resp.text)
            try:
                disk.write_text(json.dumps(rows), encoding="utf-8")
            except Exception:
                pass

        frames: list[FrameRecord] = []
        for r in rows:
            collection = r.get("obs_collection", "")
            if not collection.startswith("spherex"):
                continue
            m = re.search(r"D(\d)", r.get("energy_bandpassname", ""))
            if not m:
                continue
            try:
                t_min = float(r["t_min"])
                t_max = float(r.get("t_max") or t_min)
                frames.append(
                    FrameRecord(
                        obs_id=r["obs_id"],
                        collection=collection,
                        detector=int(m.group(1)),
                        mjd=(t_min + t_max) / 2.0,
                        em_min_um=float(r["em_min"]) * 1e6,
                        em_max_um=float(r["em_max"]) * 1e6,
                    )
                )
            except (KeyError, ValueError):
                continue
        frames.sort(key=lambda f: f.mjd)
        self._coverage_cache[key] = frames
        return frames

    @staticmethod
    def _parse_csv(text: str) -> list[dict[str, str]]:
        lines = [ln for ln in text.strip().splitlines() if ln.strip()]
        if not lines:
            return []
        header = [h.strip() for h in lines[0].split(",")]
        out = []
        for ln in lines[1:]:
            parts = ln.split(",")
            if len(parts) == len(header):
                out.append(dict(zip(header, (p.strip() for p in parts))))
        return out

    @staticmethod
    def summarize(frames: list[FrameRecord]) -> dict[str, Any]:
        by_det: dict[str, int] = {}
        for f in frames:
            by_det[str(f.detector)] = by_det.get(str(f.detector), 0) + 1
        collections = sorted({f.collection for f in frames})
        epochs = group_epochs(frames)
        return {
            "total_frames": len(frames),
            "by_detector": by_det,
            "collections": collections,
            "n_epochs": len(epochs),
            "epochs": [
                {"start": mjd_to_iso(g[0].mjd), "end": mjd_to_iso(g[-1].mjd), "n_frames": len(g)} for g in epochs
            ],
            "mjd_min": frames[0].mjd if frames else None,
            "mjd_max": frames[-1].mjd if frames else None,
            "date_min": mjd_to_iso(frames[0].mjd) if frames else None,
            "date_max": mjd_to_iso(frames[-1].mjd) if frames else None,
        }

    # -------------------------------------------------------------- download
    async def _resolve_file_url(self, client: httpx.AsyncClient, rec: FrameRecord) -> str:
        if rec.key in self._urls:
            return self._urls[rec.key]
        params = {"ID": f"ivo://irsa.ipac/{rec.collection}?{rec.obs_id}/D{rec.detector}"}
        resp = await client.get(DATALINK_URL, params=params)
        resp.raise_for_status()
        for cand in re.findall(r"<TD>(https://[^<]+?level2_[^<]+?\.fits)</TD>", resp.text):
            self._urls[rec.key] = cand
            self._save_urls()
            return cand
        raise SpherexError("upstream", f"No Level-2 file found for {rec.key}")

    async def fetch_cutout(
        self, client: httpx.AsyncClient, rec: FrameRecord, ra: float, dec: float, size_deg: float
    ) -> Optional[Cutout]:
        tag = hashlib.md5(f"{rec.key}:{ra:.4f}:{dec:.4f}:{size_deg:.4f}".encode()).hexdigest()[:20]
        path = self.cache_dir / "cutouts" / f"{rec.obs_id}_D{rec.detector}_{tag}.fits"
        lock = self._locks.setdefault(str(path), asyncio.Lock())
        async with lock:
            if not path.exists():
                async with self._sem:
                    last_exc: Optional[Exception] = None
                    for attempt in range(3):
                        try:
                            url = await self._resolve_file_url(client, rec)
                            resp = await client.get(
                                url, params={"center": f"{ra:.6f},{dec:.6f}", "size": f"{size_deg:.5f}"}
                            )
                            resp.raise_for_status()
                            await asyncio.to_thread(self._store_compact, resp.content, path, url)
                            last_exc = None
                            break
                        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                            last_exc = exc
                            status = getattr(getattr(exc, "response", None), "status_code", 0)
                            if isinstance(exc, httpx.HTTPStatusError) and status < 500:
                                break  # 4xx will not get better
                            await asyncio.sleep(2.0 * (attempt + 1))
                        except Exception as exc:
                            last_exc = exc
                            break
                    if last_exc is not None:
                        logger.warning(f"SPHEREx cutout failed for {rec.key}: {last_exc}")
                        return None
        try:
            return await asyncio.to_thread(self._read_cutout, path, rec)
        except Exception as exc:
            logger.warning(f"Unreadable cached cutout {path.name}: {exc}")
            path.unlink(missing_ok=True)
            return None

    @staticmethod
    def _store_compact(content: bytes, path: Path, url: str) -> None:
        """Keep only the extensions we need (drops the ~5 MB PSF cube)."""
        with fits.open(io.BytesIO(content)) as hdul:
            keep = [fits.PrimaryHDU(header=hdul[0].header)]
            for name in ("IMAGE", "FLAGS", "VARIANCE", "ZODI", "WCS-WAVE"):
                if name in hdul:
                    keep.append(hdul[name].copy())
            keep[0].header["SRCURL"] = url[:68]
            tmp = path.with_suffix(".tmp")
            fits.HDUList(keep).writeto(tmp, overwrite=True)
            tmp.replace(path)
            path.with_suffix(".url").write_text(url, encoding="utf-8")

    @staticmethod
    def _read_cutout(path: Path, rec: FrameRecord) -> Cutout:
        with fits.open(path) as hdul:
            hdr = hdul["IMAGE"].header
            image = hdul["IMAGE"].data.astype(np.float32)
            if "ZODI" in hdul:
                image = image - hdul["ZODI"].data.astype(np.float32)
            flags = hdul["FLAGS"].data.astype(np.int64) if "FLAGS" in hdul else np.zeros(image.shape, np.int64)
            variance = (
                hdul["VARIANCE"].data.astype(np.float32) if "VARIANCE" in hdul else np.ones(image.shape, np.float32)
            )
            if "A_ORDER" in hdr:
                for k in ("CTYPE1", "CTYPE2"):
                    if not str(hdr.get(k, "")).endswith("-SIP"):
                        hdr[k] = f"{hdr[k]}-SIP"
            wcs = WCS(hdr)
            wavelength = None
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    ww = WCS(hdr, fobj=hdul, key="W")
                ny, nx = image.shape
                lam, _ = ww.pixel_to_world_values((nx - 1) / 2.0, (ny - 1) / 2.0)
                wavelength = float(lam) if np.isfinite(lam) else None
            except Exception:
                wavelength = None
            bits = dict(DEFAULT_FLAG_BITS)
            if "FLAGS" in hdul:
                for k, v in hdul["FLAGS"].header.items():
                    if k.startswith("MP_"):
                        bits[k[3:]] = int(v)
            mjd = float(hdr.get("MJD-AVG", rec.mjd))
        url_file = path.with_suffix(".url")
        url = url_file.read_text(encoding="utf-8") if url_file.exists() else ""
        return Cutout(rec, url, image, flags, variance, wcs, mjd, wavelength, bits)

    # -------------------------------------------------------------- building
    async def build_blink(
        self,
        ra: float,
        dec: float,
        fov_deg: float = 0.1,
        detectors: Optional[list[int]] = None,
        mode: str = "epoch",
        per_epoch: int = 4,
        max_frames: int = 16,
        pmra: Optional[float] = None,
        pmdec: Optional[float] = None,
        ref_epoch: float = 2000.0,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        has_pm = pmra is not None and pmdec is not None and (abs(pmra) > 0 or abs(pmdec) > 0)

        # Centre on where the target is during the SPHEREx survey (matters for fast movers).
        q_ra, q_dec = (ra, dec)
        if has_pm:
            q_ra, q_dec = propagate(ra, dec, pmra or 0.0, pmdec or 0.0, ref_epoch, mjd_to_year(61000.0))

        all_frames = await self.query_frames(q_ra, q_dec)
        if not all_frames:
            raise SpherexError("no_coverage", "No SPHEREx frames cover this position yet.")
        coverage = self.summarize(all_frames)

        if has_pm:
            mid = (all_frames[0].mjd + all_frames[-1].mjd) / 2.0
            c_ra, c_dec = propagate(ra, dec, pmra or 0.0, pmdec or 0.0, ref_epoch, mjd_to_year(mid))
        else:
            c_ra, c_dec = ra, dec

        frames = [f for f in all_frames if not detectors or f.detector in detectors]
        if not frames:
            raise SpherexError("no_detector_coverage", "No frames for the selected detector(s).")

        groups = select_groups(frames, mode, per_epoch, max_frames)
        size_px = int(round(fov_deg * 3600.0 / NATIVE_PIXSCALE_ARCSEC))
        size_px = max(15, size_px + (1 - size_px % 2))
        out_wcs = make_target_wcs(c_ra, c_dec, size_px, NATIVE_PIXSCALE_ARCSEC)
        cut_size = fov_deg * 1.5 + 0.01  # margin so reprojection never runs off the cutout

        needed = {r.key: r for g in groups for r in g}
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0), follow_redirects=True) as client:
            results = await asyncio.gather(
                *(self.fetch_cutout(client, r, c_ra, c_dec, cut_size) for r in needed.values())
            )
        cutouts = {c.record.key: c for c in results if c is not None}
        if not cutouts:
            raise SpherexError("upstream", "Could not download any SPHEREx cutouts from IRSA.")

        out_frames = await asyncio.to_thread(
            self._assemble, groups, cutouts, out_wcs, size_px, ra, dec, pmra, pmdec, ref_epoch, has_pm
        )
        if not out_frames:
            raise SpherexError("no_data", "Frames were found but contained no valid pixels at this position.")

        arrays = [f.pop("_arr") for f in out_frames]
        finite = np.concatenate([a[np.isfinite(a)] for a in arrays])
        vmin, vmax = (float(np.percentile(finite, 1.0)), float(np.percentile(finite, 99.7))) if finite.size else (0.0, 1.0)

        return {
            "target": {
                "ra": ra, "dec": dec, "pmra": pmra, "pmdec": pmdec, "ref_epoch": ref_epoch,
                "center_ra": c_ra, "center_dec": c_dec,
            },
            "grid": {
                "width": size_px, "height": size_px, "pixscale_arcsec": NATIVE_PIXSCALE_ARCSEC,
                "fov_deg": size_px * NATIVE_PIXSCALE_ARCSEC / 3600.0, "crpix": [(size_px - 1) / 2.0] * 2,
                "ra": c_ra, "dec": c_dec, "projection": "TAN", "orientation": "north-up, east-left",
            },
            "coverage": coverage,
            "mode": mode,
            "detectors": detectors or [1, 2, 3, 4, 5, 6],
            "frames": out_frames,
            "stretch_hint": {"vmin": vmin, "vmax": vmax},
            "units": "MJy/sr (zodiacal light and local sky subtracted)",
            "source": "NASA/IPAC IRSA - SPHEREx Level-2 spectral images (" + ", ".join(coverage["collections"]) + ")",
            "is_simulated": False,
            "elapsed_s": round(time.perf_counter() - t0, 2),
        }

    def _assemble(
        self, groups, cutouts, out_wcs, size_px, ra, dec, pmra, pmdec, ref_epoch, has_pm
    ) -> list[dict[str, Any]]:
        yy, xx = np.mgrid[0:size_px, 0:size_px]
        world_ra, world_dec = out_wcs.pixel_to_world_values(xx, yy)
        out: list[dict[str, Any]] = []
        for gi, group in enumerate(groups):
            members = [cutouts[r.key] for r in group if r.key in cutouts]
            if not members:
                continue
            num = np.zeros((size_px, size_px), np.float64)
            den = np.zeros((size_px, size_px), np.float64)
            flag_hits = {name: 0 for name in REPORTED_FLAGS}
            masked_any = np.zeros((size_px, size_px), bool)
            used = []
            for c in members:
                img, var, msk, flag_stats = reproject_cutout(c, world_ra, world_dec)
                if img is None:
                    continue
                valid = ~msk & np.isfinite(img) & np.isfinite(var) & (var > 0)
                if valid.sum() < 0.25 * valid.size:
                    continue
                sky = np.nanmedian(img[valid])
                w = np.where(valid, 1.0 / np.where(var > 0, var, np.inf), 0.0)
                num += np.where(valid, (img - sky) * w, 0.0)
                den += w
                masked_any |= msk
                for name, frac in flag_stats.items():
                    flag_hits[name] = flag_hits.get(name, 0) + frac
                used.append(c)
            if not used:
                continue
            with np.errstate(invalid="ignore", divide="ignore"):
                data = np.where(den > 0, num / den, np.nan).astype(np.float32)
            data, filled = fill_saturated_holes(data)
            masked_any |= filled
            mjd = float(np.mean([c.mjd for c in used]))
            waves = [c.wavelength_um for c in used if c.wavelength_um]
            target_px = None
            if has_pm:
                t_ra, t_dec = propagate(ra, dec, pmra or 0.0, pmdec or 0.0, ref_epoch, mjd_to_year(mjd))
            else:
                t_ra, t_dec = ra, dec
            px, py = out_wcs.world_to_pixel_values(t_ra, t_dec)
            if np.isfinite(px) and np.isfinite(py):
                target_px = [round(float(px), 2), round(float(py), 2)]
            out.append(
                {
                    "index": len(out),
                    "group": gi,
                    "mjd": mjd,
                    "date": mjd_to_iso(mjd),
                    "date_start": mjd_to_iso(min(c.mjd for c in used)),
                    "date_end": mjd_to_iso(max(c.mjd for c in used)),
                    "n_frames": len(used),
                    "detectors": sorted({c.record.detector for c in used}),
                    "wavelength_um": [round(min(waves), 3), round(max(waves), 3)] if waves else None,
                    "members": [
                        {**c.record.to_dict(), "wavelength_center_um": round(c.wavelength_um, 4) if c.wavelength_um else None, "url": c.url}
                        for c in used
                    ],
                    "flags": {k: round(v / len(used), 4) for k, v in flag_hits.items() if v > 0},
                    "masked_fraction": round(float(masked_any.mean()), 4),
                    "target_px": target_px,
                    "data": base64.b64encode(np.ascontiguousarray(data, dtype="<f4").tobytes()).decode("ascii"),
                    "mask": base64.b64encode(np.packbits(masked_any.astype(np.uint8)).tobytes()).decode("ascii"),
                    "_arr": data,
                }
            )
        return out


def reproject_cutout(c: Cutout, world_ra: np.ndarray, world_dec: np.ndarray):
    """Bilinear reprojection of one cutout onto the output grid (SIP-aware)."""
    try:
        px, py = c.wcs.world_to_pixel_values(world_ra, world_dec)
    except Exception:
        return None, None, None, {}
    ny, nx = c.image.shape
    inside = (px >= 0) & (px <= nx - 1) & (py >= 0) & (py <= ny - 1)
    if not inside.any():
        return None, None, None, {}

    bad_bits = 0
    for name in MASKED_FLAG_NAMES:
        bit = c.flag_bits.get(name)
        if bit is not None:
            bad_bits |= 1 << bit
    bad = ((c.flags & bad_bits) != 0) | ~np.isfinite(c.image)
    img = np.where(bad, 0.0, c.image)
    var = np.where(bad | ~np.isfinite(c.variance), 0.0, c.variance)
    coords = [py, px]
    r_img = map_coordinates(img, coords, order=1, mode="constant", cval=0.0)
    r_var = map_coordinates(var, coords, order=1, mode="constant", cval=0.0)
    r_bad = map_coordinates(bad.astype(np.float32), coords, order=1, mode="constant", cval=1.0)
    mask = (r_bad > 0.01) | ~inside
    r_img = np.where(mask, np.nan, r_img)

    stats: dict[str, float] = {}
    region = c.flags[
        max(0, int(np.nanmin(py[inside]))): int(np.nanmax(py[inside])) + 1,
        max(0, int(np.nanmin(px[inside]))): int(np.nanmax(px[inside])) + 1,
    ]
    if region.size:
        for name in REPORTED_FLAGS:
            bit = c.flag_bits.get(name)
            if bit is not None:
                frac = float(((region >> bit) & 1).mean())
                if frac > 0:
                    stats[name] = frac
    return r_img, r_var, mask, stats


def fill_saturated_holes(data: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Fill interior NaN islands (saturated / flagged star cores) with the bright rim value.

    Bright stars such as Barnard's Star have flagged cores in every exposure; without this
    they render as black holes. Returns the filled image and a mask of filled pixels.
    """
    holes = ~np.isfinite(data)
    if not holes.any():
        return data, np.zeros(data.shape, bool)
    labels, n = ndimage.label(holes)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    out = data.copy()
    filled = np.zeros(data.shape, bool)
    for lab in range(1, n + 1):
        if lab in border:
            continue
        region = labels == lab
        if region.sum() > 0.05 * data.size:
            continue
        rim = ndimage.binary_dilation(region, iterations=1) & ~holes
        if rim.any():
            out[region] = np.percentile(data[rim], 90)
            filled |= region
    return out, filled


def group_epochs(frames: list[FrameRecord]) -> list[list[FrameRecord]]:
    groups: list[list[FrameRecord]] = []
    for f in sorted(frames, key=lambda r: r.mjd):
        if groups and f.mjd - groups[-1][-1].mjd <= EPOCH_GAP_DAYS:
            groups[-1].append(f)
        else:
            groups.append([f])
    return groups


def _spread(items: list, n: int) -> list:
    if n <= 0 or len(items) <= n:
        return list(items)
    idx = np.linspace(0, len(items) - 1, n).round().astype(int)
    return [items[i] for i in sorted(set(idx.tolist()))]


def select_groups(frames: list[FrameRecord], mode: str, per_epoch: int, max_frames: int) -> list[list[FrameRecord]]:
    """Choose which frames to download and how to group them into blink frames."""
    if mode == "frames":
        picked = _spread(sorted(frames, key=lambda r: r.mjd), min(max_frames, MAX_DOWNLOADS))
        return [[f] for f in picked]
    epochs = group_epochs(frames)
    budget = max(1, min(per_epoch, MAX_DOWNLOADS // max(1, len(epochs))))
    return [_spread(g, budget) for g in epochs]


spherex_archive = SpherexArchive()
