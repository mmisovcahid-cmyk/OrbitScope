"""
OrbitScope API - NEOSSat (CSA) real-data endpoints
==================================================
/api/v1/neossat/coverage   public NEOSSat science frames covering a position (CADC TAP), grouped into visits
/api/v1/neossat/blink      plate-solved, co-registered NEOSSat frames around a position (same shape as SPHEREx blink)
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from app.api.routes.spherex import _target_from_query
from app.services.neossat_archive import NeossatError, neossat_archive, summarize

router = APIRouter(prefix="/api/v1/neossat", tags=["NEOSSat (real data, CSA/CADC)"])

MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "ok": "NEOSSat frames loaded",
        "no_coverage": "NEOSSat has no public science frames of this position. NEOSSat observes selected targets, not the whole sky.",
        "no_solution": "NEOSSat frames were found, but none could be placed on the sky reliably (too few stars matched Gaia DR3), so none are shown.",
        "upstream": "The CADC archive did not respond correctly. Please try again in a moment.",
        "catalog_down": "Gaia DR3 (needed to place NEOSSat frames on the sky) is not responding at ESA or MAST. Try again later.",
        "bad_visit": "That NEOSSat visit does not exist for this position.",
    },
    "az": {
        "ok": "NEOSSat kadrları yükləndi",
        "no_coverage": "NEOSSat bu mövqenin ictimai elmi kadrlarına malik deyil. NEOSSat bütün göyü deyil, seçilmiş hədəfləri müşahidə edir.",
        "no_solution": "NEOSSat kadrları tapıldı, lakin heç biri göydə etibarlı yerləşdirilə bilmədi (Gaia DR3 ilə çox az ulduz uyğunlaşdı), ona görə göstərilmir.",
        "upstream": "CADC arxivi düzgün cavab vermədi. Bir az sonra yenidən cəhd edin.",
        "catalog_down": "NEOSSat kadrlarını göydə yerləşdirmək üçün lazım olan Gaia DR3 nə ESA-da, nə də MAST-da cavab vermir. Bir az sonra yenidən cəhd edin.",
        "bad_visit": "Bu mövqe üçün belə NEOSSat müşahidəsi yoxdur.",
    },
}

STATUS = {"no_coverage": 404, "no_solution": 404, "bad_visit": 400}


def msg(locale: str, key: str) -> str:
    table = MESSAGES.get((locale or "en").lower(), MESSAGES["en"])
    return table.get(key, MESSAGES["en"].get(key, MESSAGES["en"]["upstream"]))


def error_status(code: str) -> int:
    return STATUS.get(code, 502)


def raise_neossat(exc: NeossatError, locale: str) -> None:
    code = exc.code if exc.code in MESSAGES["en"] else "upstream"
    raise HTTPException(status_code=error_status(code), detail=msg(locale, code))


async def build(
    target, ra, dec, pmra, pmdec, ref_epoch, fov, mode, visit_index, per_visit, max_frames, locale,
) -> dict[str, Any]:
    tgt = await _target_from_query(target, ra, dec, pmra, pmdec, ref_epoch, locale)
    try:
        data = await neossat_archive.build_blink(
            ra=tgt["ra"], dec=tgt["dec"], fov_deg=fov, mode=mode, visit_index=visit_index, per_visit=per_visit,
            max_frames=max_frames, pmra=tgt.get("pmra"), pmdec=tgt.get("pmdec"), ref_epoch=tgt.get("ref_epoch") or 2000.0,
        )
    except NeossatError as exc:
        raise_neossat(exc, locale)
    data["target"].update({"name": tgt.get("name"), "resolver": tgt.get("source"), "note": tgt.get("note")})
    return data


@router.get("/coverage", summary="Public NEOSSat science frames covering a position (CADC), grouped into visits")
async def coverage(
    ra: float = Query(..., ge=0, lt=360), dec: float = Query(..., ge=-90, le=90), locale: str = "en",
) -> dict[str, Any]:
    try:
        frames = await neossat_archive.query_frames(ra, dec)
    except NeossatError as exc:
        raise_neossat(exc, locale)
    return {"success": True, "data": {**summarize(frames), "position": {"ra": ra, "dec": dec},
                                      "source": "CSA NEOSSat via CADC TAP (caom2, collection NEOSSAT, public frames only)"}}


@router.get("/blink", summary="Plate-solved NEOSSat frames around a position (same shape as the SPHEREx blink)")
async def blink(
    target: Optional[str] = Query(None, max_length=200),
    ra: Optional[float] = Query(None, ge=0, lt=360),
    dec: Optional[float] = Query(None, ge=-90, le=90),
    pmra: Optional[float] = None,
    pmdec: Optional[float] = None,
    ref_epoch: Optional[float] = None,
    fov: float = Query(0.1, ge=0.02, le=0.2, description="Field of view (deg); NEOSSat sub-frames are ~0.2 deg wide"),
    mode: str = Query("visits", pattern="^(visits|frames)$"),
    visit_index: Optional[int] = Query(None, ge=0, le=5000),
    per_visit: int = Query(5, ge=1, le=12),
    max_frames: int = Query(12, ge=2, le=36),
    locale: str = "en",
) -> dict[str, Any]:
    data = await build(target, ra, dec, pmra, pmdec, ref_epoch, fov, mode, visit_index, per_visit, max_frames, locale)
    return {"success": True, "message": msg(locale, "ok"), "data": data}
