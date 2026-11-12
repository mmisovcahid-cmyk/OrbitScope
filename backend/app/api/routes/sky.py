"""OrbitScope - Sky Region API Endpoints
Provides routes for querying sky regions, observations within regions, and known solar system bodies.
"""
from __future__ import annotations

from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request

from app.core.logging_config import get_logger
from app.models.schemas import ApiResponse, SkyRegion

logger = get_logger("routes.sky")

router = APIRouter(prefix="/api/v1/sky", tags=["Legacy demo (simulated data)"], deprecated=True)

# Supported i18n messages
MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "regions_success": "Sky regions retrieved successfully",
        "observations_success": "Observations for region retrieved successfully",
        "objects_success": "Known objects in region retrieved successfully",
        "error": "Failed to retrieve sky data",
    },
    "az": {
        "regions_success": "Göy regionları uğurla əldə edildi",
        "observations_success": "Region üzrə müşahidələr uğurla əldə edildi",
        "objects_success": "Regiondakı məlum cisimlər uğurla əldə edildi",
        "error": "Göy məlumatlarının əldə edilməsi zamanı xəta baş verdi",
    },
}


def _get_msg(locale: str, key: str) -> str:
    loc = locale.lower() if locale else "en"
    return MESSAGES.get(loc, MESSAGES["en"]).get(key, MESSAGES["en"].get(key, ""))


# Curated demo regions as reliable fallback
DEFAULT_DEMO_REGIONS: list[SkyRegion] = [
    SkyRegion(
        ra=83.822,
        dec=-5.391,
        radius=1.5,
    ),
    SkyRegion(
        ra=56.75,
        dec=24.116,
        radius=2.0,
    ),
    SkyRegion(
        ra=45.0,
        dec=0.0,
        radius=2.5,
    ),
    SkyRegion(
        ra=270.0,
        dec=66.5,
        radius=3.0,
    ),
    SkyRegion(
        ra=90.0,
        dec=-66.5,
        radius=3.0,
    ),
]


@router.get(
    "/regions",
    response_model=ApiResponse,
    summary="List demo sky regions",
    description="Returns pre-configured demonstration sky regions available for monitoring.",
)
async def list_sky_regions(
    request: Request,
    locale: str = Query("en", description="Preferred response locale (en or az)"),
) -> ApiResponse:
    """Retrieve demo sky regions from demo data service or built-in defaults."""
    try:
        demo_data = getattr(request.app.state, "demo_data", None)
        regions: list[Any] = []
        if demo_data and hasattr(demo_data, "get_demo_regions"):
            regions = demo_data.get_demo_regions()

        if not regions:
            regions = DEFAULT_DEMO_REGIONS

        return ApiResponse(
            success=True,
            data=regions,
            message=_get_msg(locale, "regions_success"),
            locale=locale,
            is_simulated=True,
        )
    except Exception as exc:
        logger.error(f"Error fetching sky regions: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"{_get_msg(locale, 'error')}: {exc}",
        ) from exc


@router.get(
    "/observations",
    response_model=ApiResponse,
    summary="Query observations for a sky region",
    description="Find all SPHEREx or demo observations intersecting the specified sky cone.",
)
async def get_observations_for_region(
    request: Request,
    ra: float = Query(..., ge=0.0, le=360.0, description="Center Right Ascension in degrees"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Center Declination in degrees"),
    radius: float = Query(1.0, gt=0.0, le=10.0, description="Search radius in degrees"),
    locale: str = Query("en", description="Preferred response locale (en or az)"),
) -> ApiResponse:
    """Query observations intersecting the requested cone."""
    try:
        observations: list[Any] = []
        spherex_data = getattr(request.app.state, "spherex_data", None)
        demo_data = getattr(request.app.state, "demo_data", None)

        if spherex_data and hasattr(spherex_data, "get_observations_for_region"):
            try:
                observations = await spherex_data.get_observations_for_region(ra, dec, radius)
            except Exception as e:
                logger.warning(f"spherex_data error, falling back to demo: {e}")

        if not observations and demo_data and hasattr(demo_data, "generate_observations"):
            observations = demo_data.generate_observations(ra, dec, radius)

        is_sim = True
        if observations and hasattr(observations[0], "is_simulated"):
            is_sim = any(getattr(obs, "is_simulated", True) for obs in observations)

        return ApiResponse(
            success=True,
            data=observations,
            message=_get_msg(locale, "observations_success"),
            locale=locale,
            is_simulated=is_sim,
        )
    except Exception as exc:
        logger.error(f"Error querying observations for region ({ra}, {dec}): {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"{_get_msg(locale, 'error')}: {exc}",
        ) from exc


@router.get(
    "/objects",
    response_model=ApiResponse,
    summary="Get known objects in a region via JPL",
    description="Query known solar system bodies near the specified sky coordinates using JPL services.",
)
async def get_known_objects_in_region(
    request: Request,
    ra: float = Query(..., ge=0.0, le=360.0, description="Center Right Ascension in degrees"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Center Declination in degrees"),
    radius: float = Query(1.0, gt=0.0, le=10.0, description="Search radius in degrees"),
    locale: str = Query("en", description="Preferred response locale (en or az)"),
) -> ApiResponse:
    """Find known objects near coordinates using JPLClient."""
    try:
        jpl = getattr(request.app.state, "jpl_client", None)
        objects: list[Any] = []
        radius_arcsec = radius * 3600.0 if radius <= 10.0 else radius

        if jpl and hasattr(jpl, "find_nearby_objects"):
            objects = await jpl.find_nearby_objects(ra, dec, radius_arcsec=radius_arcsec)

        return ApiResponse(
            success=True,
            data=objects,
            message=_get_msg(locale, "objects_success"),
            locale=locale,
            is_simulated=False,
        )
    except Exception as exc:
        logger.error(f"Error finding known objects in region ({ra}, {dec}): {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"{_get_msg(locale, 'error')}: {exc}",
        ) from exc
