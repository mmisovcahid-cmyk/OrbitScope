"""
OrbitScope API - Real SPHEREx blink endpoints
=============================================
/api/v1/spherex/targets     challenge test targets
/api/v1/spherex/resolve     name / coordinate resolver
/api/v1/spherex/coverage    which SPHEREx frames cover a position
/api/v1/spherex/blink       co-registered time series of real SPHEREx images (JSON, float32 frames)
/api/v1/spherex/blink.gif   the same series as an animated GIF (for sharing / embedding)
"""
from __future__ import annotations

import base64
import io
from typing import Any, Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from PIL import Image, ImageDraw

from app.core.logging_config import get_logger
from app.services.spherex_archive import DETECTOR_BANDS, SpherexError, spherex_archive
from app.services.target_resolver import BUILTIN_TARGETS, resolve

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/spherex", tags=["SPHEREx (real data)"])

MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "ok": "SPHEREx frames loaded",
        "not_resolved": "Could not resolve '{q}'. Enter an object name or coordinates (e.g. 08h55m10.8s -07d14m42s).",
        "no_coverage": "SPHEREx has not observed this position in the public releases yet.",
        "no_detector_coverage": "No SPHEREx frames for the selected detector at this position. Try another detector.",
        "no_data": "SPHEREx frames were found, but none had valid pixels at this position.",
        "upstream": "The IRSA archive did not respond correctly. Please try again in a moment.",
        "bad_detector": "Detector must be 1-6 or 'all'.",
    },
    "az": {
        "ok": "SPHEREx kadrları yükləndi",
        "not_resolved": "'{q}' tapılmadı. Obyekt adı və ya koordinat daxil edin (məs. 08h55m10.8s -07d14m42s).",
        "no_coverage": "SPHEREx bu mövqeni ictimai buraxılışlarda hələ müşahidə etməyib.",
        "no_detector_coverage": "Seçilmiş detektor üçün bu mövqedə SPHEREx kadrı yoxdur. Başqa detektor seçin.",
        "no_data": "SPHEREx kadrları tapıldı, lakin bu mövqedə etibarlı piksel yoxdur.",
        "upstream": "IRSA arxivi düzgün cavab vermədi. Bir az sonra yenidən cəhd edin.",
        "bad_detector": "Detektor 1-6 və ya 'all' olmalıdır.",
    },
}


def _msg(locale: str, key: str, **kw: Any) -> str:
    table = MESSAGES.get((locale or "en").lower(), MESSAGES["en"])
    return table.get(key, MESSAGES["en"][key]).format(**kw)


def _parse_detectors(detector: str, locale: str) -> Optional[list[int]]:
    d = (detector or "all").strip().lower()
    if d in ("all", "", "0"):
        return None
    try:
        dets = sorted({int(x) for x in d.split(",") if x.strip()})
    except ValueError:
        raise HTTPException(status_code=400, detail=_msg(locale, "bad_detector"))
    if not dets or any(x < 1 or x > 6 for x in dets):
        raise HTTPException(status_code=400, detail=_msg(locale, "bad_detector"))
    return dets


async def _target_from_query(
    target: Optional[str], ra: Optional[float], dec: Optional[float],
    pmra: Optional[float], pmdec: Optional[float], ref_epoch: Optional[float], locale: str,
) -> dict[str, Any]:
    if ra is not None and dec is not None:
        return {"name": target or None, "ra": ra, "dec": dec, "pmra": pmra, "pmdec": pmdec,
                "ref_epoch": ref_epoch or 2000.0, "source": "coordinates"}
    if not target:
        raise HTTPException(status_code=400, detail=_msg(locale, "not_resolved", q=""))
    res = await resolve(target)
    if not res:
        raise HTTPException(status_code=404, detail=_msg(locale, "not_resolved", q=target))
    return res


def _raise_archive(exc: SpherexError, locale: str) -> None:
    status = 404 if exc.code in ("no_coverage", "no_detector_coverage", "no_data") else 502
    raise HTTPException(status_code=status, detail=_msg(locale, exc.code if exc.code in MESSAGES["en"] else "upstream"))


@router.get("/targets", summary="Challenge test targets")
async def list_targets() -> dict[str, Any]:
    return {
        "success": True,
        "data": {
            "targets": [{k: t[k] for k in ("id", "name", "ra", "dec", "pmra", "pmdec", "ref_epoch", "kind", "note", "detector")} for t in BUILTIN_TARGETS],
            "detectors": [{"id": d, "wavelength_um": list(b)} for d, b in DETECTOR_BANDS.items()],
        },
    }


@router.get("/resolve", summary="Resolve object name or coordinates")
async def resolve_target(q: str = Query(..., min_length=1, max_length=200), locale: str = "en") -> dict[str, Any]:
    res = await resolve(q)
    if not res:
        raise HTTPException(status_code=404, detail=_msg(locale, "not_resolved", q=q))
    return {"success": True, "data": res}


@router.get("/coverage", summary="SPHEREx frames covering a position")
async def coverage(
    ra: float = Query(..., ge=0, lt=360), dec: float = Query(..., ge=-90, le=90), locale: str = "en"
) -> dict[str, Any]:
    try:
        frames = await spherex_archive.query_frames(ra, dec)
    except SpherexError as exc:
        _raise_archive(exc, locale)
    return {"success": True, "data": spherex_archive.summarize(frames)}


async def _build(
    target, ra, dec, pmra, pmdec, ref_epoch, fov, detector, mode, per_epoch, max_frames, locale
) -> dict[str, Any]:
    tgt = await _target_from_query(target, ra, dec, pmra, pmdec, ref_epoch, locale)
    dets = _parse_detectors(detector, locale)
    try:
        result = await spherex_archive.build_blink(
            ra=tgt["ra"], dec=tgt["dec"], fov_deg=fov, detectors=dets, mode=mode,
            per_epoch=per_epoch, max_frames=max_frames,
            pmra=tgt.get("pmra"), pmdec=tgt.get("pmdec"), ref_epoch=tgt.get("ref_epoch") or 2000.0,
        )
    except SpherexError as exc:
        _raise_archive(exc, locale)
    result["target"].update({"name": tgt.get("name"), "resolver": tgt.get("source"), "note": tgt.get("note")})
    return result


@router.get("/blink", summary="Co-registered SPHEREx image time series around a position")
async def blink(
    target: Optional[str] = Query(None, max_length=200, description="Object name or coordinate string"),
    ra: Optional[float] = Query(None, ge=0, lt=360),
    dec: Optional[float] = Query(None, ge=-90, le=90),
    pmra: Optional[float] = Query(None, description="Proper motion in RA*cos(dec), mas/yr"),
    pmdec: Optional[float] = Query(None, description="Proper motion in Dec, mas/yr"),
    ref_epoch: Optional[float] = Query(None, description="Epoch of ra/dec (Julian year)"),
    fov: float = Query(0.1, ge=0.02, le=0.5, description="Field of view (deg)"),
    detector: str = Query("3", description="1-6, comma list, or 'all'"),
    mode: str = Query("epoch", pattern="^(epoch|frames)$"),
    per_epoch: int = Query(4, ge=1, le=12),
    max_frames: int = Query(16, ge=2, le=48),
    locale: str = "en",
) -> dict[str, Any]:
    data = await _build(target, ra, dec, pmra, pmdec, ref_epoch, fov, detector, mode, per_epoch, max_frames, locale)
    return {"success": True, "message": _msg(locale, "ok"), "data": data}


def _render_png_frames(data: dict[str, Any], scale: int = 4) -> list[Image.Image]:
    w, h = data["grid"]["width"], data["grid"]["height"]
    vmin, vmax = data["stretch_hint"]["vmin"], data["stretch_hint"]["vmax"]
    span = max(vmax - vmin, 1e-9)
    images = []
    for f in data["frames"]:
        arr = np.frombuffer(base64.b64decode(f["data"]), dtype="<f4").reshape(h, w)
        x = np.clip((np.nan_to_num(arr, nan=vmin) - vmin) / span, 0, 1)
        y = np.arcsinh(10 * x) / np.arcsinh(10)
        img = Image.fromarray((np.flipud(y) * 255).astype(np.uint8), mode="L").resize((w * scale, h * scale), Image.NEAREST)
        img = img.convert("RGB")
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, 0, w * scale, 14], fill=(0, 0, 0))
        draw.text((4, 2), f"SPHEREx {f['date'][:10]}  D{','.join(map(str, f['detectors']))}", fill=(255, 255, 255))
        if f.get("target_px"):
            tx, ty = f["target_px"]
            cx, cy = (tx + 0.5) * scale, (h - ty - 0.5) * scale
            r = 6 * scale
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(56, 189, 248))
        images.append(img)
    return images


@router.get("/blink.gif", summary="Animated GIF of the SPHEREx time series (embeddable)")
async def blink_gif(
    target: Optional[str] = Query(None, max_length=200),
    ra: Optional[float] = Query(None, ge=0, lt=360),
    dec: Optional[float] = Query(None, ge=-90, le=90),
    pmra: Optional[float] = None,
    pmdec: Optional[float] = None,
    ref_epoch: Optional[float] = None,
    fov: float = Query(0.1, ge=0.02, le=0.5),
    detector: str = "3",
    mode: str = Query("epoch", pattern="^(epoch|frames)$"),
    per_epoch: int = Query(4, ge=1, le=12),
    max_frames: int = Query(16, ge=2, le=48),
    delay_ms: int = Query(600, ge=50, le=5000),
    locale: str = "en",
) -> Response:
    data = await _build(target, ra, dec, pmra, pmdec, ref_epoch, fov, detector, mode, per_epoch, max_frames, locale)
    frames = _render_png_frames(data)
    buf = io.BytesIO()
    frames[0].save(buf, format="GIF", save_all=True, append_images=frames[1:], duration=delay_ms, loop=0)
    return Response(content=buf.getvalue(), media_type="image/gif", headers={"Cache-Control": "public, max-age=3600"})
