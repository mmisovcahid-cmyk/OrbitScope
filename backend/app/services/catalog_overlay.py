"""
OrbitScope - Reference catalog overlays
=======================================
Fetches sources around a position from external surveys so they can be drawn on top
of the SPHEREx frames. Every source carries its proper motion and reference epoch, so the
browser can move each marker to where the star was on the date of each SPHEREx frame.

* Gaia DR3   (ESA Gaia archive TAP)   epoch 2016.0, pm in mas/yr
* CatWISE2020 (NASA/IPAC IRSA TAP)    epoch 2015.4, pm converted from arcsec/yr to mas/yr
"""
from __future__ import annotations

import csv
import io
import math
from typing import Any

import httpx
from cachetools import TTLCache

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

GAIA_TAP = "https://gea.esac.esa.int/tap-server/tap/sync"

CATALOGS: dict[str, dict[str, Any]] = {
    "gaia": {"label": "Gaia DR3", "ref_epoch": 2016.0, "band": "G"},
    "catwise": {"label": "CatWISE2020", "ref_epoch": 2015.4, "band": "W2"},
}

_cache: TTLCache = TTLCache(maxsize=256, ttl=6 * 3600)


class CatalogError(Exception):
    pass


def _rows(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text.strip())))


def _f(v: str | None) -> float | None:
    try:
        return float(v) if v not in (None, "", "null", "NaN") else None
    except ValueError:
        return None


async def _tap(url: str, query: str, extra: dict[str, str] | None = None) -> list[dict[str, str]]:
    data = {"LANG": "ADQL", "FORMAT": "csv", "QUERY": query, **(extra or {})}
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, data=data)
    except httpx.HTTPError as exc:
        raise CatalogError(f"catalog service unreachable: {exc}") from exc
    if resp.status_code != 200 or resp.text.lstrip().startswith("<"):
        raise CatalogError(f"catalog service error (HTTP {resp.status_code})")
    return _rows(resp.text)


async def fetch_catalog(catalog: str, ra: float, dec: float, radius_deg: float, limit: int = 1500) -> dict[str, Any]:
    if catalog not in CATALOGS:
        raise CatalogError(f"unknown catalog '{catalog}'")
    key = f"{catalog}:{ra:.4f}:{dec:.4f}:{radius_deg:.4f}:{limit}"
    if key in _cache:
        return _cache[key]

    circle = f"CIRCLE('ICRS', {ra:.6f}, {dec:.6f}, {radius_deg:.5f})"
    sources: list[dict[str, Any]] = []
    if catalog == "gaia":
        q = (
            f"SELECT TOP {limit} source_id, ra, dec, pmra, pmdec, parallax, phot_g_mean_mag "
            f"FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS', ra, dec), {circle}) "
            "ORDER BY phot_g_mean_mag"
        )
        for r in await _tap(GAIA_TAP, q, {"REQUEST": "doQuery"}):
            ra_s, dec_s = _f(r.get("ra")), _f(r.get("dec"))
            if ra_s is None or dec_s is None:
                continue
            sources.append({
                "id": f"Gaia DR3 {r.get('source_id')}", "ra": ra_s, "dec": dec_s,
                "pmra": _f(r.get("pmra")) or 0.0, "pmdec": _f(r.get("pmdec")) or 0.0,
                "parallax": _f(r.get("parallax")), "mag": _f(r.get("phot_g_mean_mag")),
            })
    else:
        q = (
            f"SELECT TOP {limit} source_name, ra, dec, pmra, pmdec, sigpmra, sigpmdec, w1mpro, w2mpro, ab_flags, nb "
            f"FROM catwise_2020 WHERE CONTAINS(POINT('ICRS', ra, dec), {circle}) = 1 "
            "ORDER BY w2mpro"
        )
        for r in await _tap(settings.IRSA_TAP_URL, q):
            ra_s, dec_s = _f(r.get("ra")), _f(r.get("dec"))
            if ra_s is None or dec_s is None:
                continue
            # Upper-case artifact flags (D diffraction spike, P persistence, H halo, O ghost) mark
            # sources that are most likely spurious - common around bright stars like Barnard's.
            if any(ch in (r.get("ab_flags") or "") for ch in "DPHO"):
                continue
            pmra = (_f(r.get("pmra")) or 0.0) * 1000.0
            pmdec = (_f(r.get("pmdec")) or 0.0) * 1000.0
            sig = math.hypot((_f(r.get("sigpmra")) or 0.0) * 1000.0, (_f(r.get("sigpmdec")) or 0.0) * 1000.0)
            pm_snr = math.hypot(pmra, pmdec) / sig if sig > 0 else 0.0
            blended = (_f(r.get("nb")) or 1) > 1
            if pm_snr < 5.0 or blended:  # only trust motions of clean, unblended detections
                pmra = pmdec = 0.0
            sources.append({
                "id": f"CWISE {r.get('source_name')}", "ra": ra_s, "dec": dec_s,
                "pmra": pmra, "pmdec": pmdec, "pm_snr": round(pm_snr, 1),
                "parallax": None, "mag": _f(r.get("w2mpro")), "w1": _f(r.get("w1mpro")),
            })

    meta = CATALOGS[catalog]
    result = {
        "catalog": catalog, "label": meta["label"], "band": meta["band"], "ref_epoch": meta["ref_epoch"],
        "count": len(sources), "truncated": len(sources) >= limit, "sources": sources,
    }
    _cache[key] = result
    return result
