"""OrbitScope - Detection Pipeline API Endpoints
Provides routes to execute moving-object detection, retrieve candidates, and cross-match with catalogs.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional
import uuid

from fastapi import APIRouter, HTTPException, Query, Request

from app.core.logging_config import get_logger
from app.ml.anomaly_detector import AnomalyDetector
from app.ml.feature_extractor import FeatureExtractor
from app.models.schemas import (
    ApiResponse,
    DetectionCandidate,
    DetectionRequest,
    DetectionStatus,
    PipelineResult,
    RunDetectionRequest,
)

logger = get_logger("routes.detection")

router = APIRouter(prefix="/api/v1/detection", tags=["Legacy demo (simulated data)"], deprecated=True)

MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "run_success": "Detection pipeline executed successfully",
        "candidates_success": "Candidates retrieved successfully",
        "candidate_detail_success": "Candidate details retrieved successfully",
        "crossmatch_success": "Cross-match completed successfully",
        "not_found": "Candidate not found",
        "pipeline_error": "Failed to run detection pipeline",
        "crossmatch_error": "Failed to perform catalog cross-matching",
    },
    "az": {
        "run_success": "Aşkarlama boru kəməri uğurla icra edildi",
        "candidates_success": "Namizədlər uğurla əldə edildi",
        "candidate_detail_success": "Namizəd detalları uğurla əldə edildi",
        "crossmatch_success": "Kataloqla kəsişmə yoxlaması uğurla tamamlandı",
        "not_found": "Namizəd tapılmadı",
        "pipeline_error": "Aşkarlama boru kəmərinin icrası zamanı xəta baş verdi",
        "crossmatch_error": "Kataloqla kəsişmə yoxlaması zamanı xəta baş verdi",
    },
}


def _get_msg(locale: str, key: str) -> str:
    loc = locale.lower() if locale else "en"
    return MESSAGES.get(loc, MESSAGES["en"]).get(key, MESSAGES["en"].get(key, ""))


def _create_fallback_pipeline_result(request_body: DetectionRequest) -> PipelineResult:
    """Generate a realistic fallback PipelineResult with simulated moving candidates."""
    cand1 = DetectionCandidate(
        id=f"OS-{str(uuid.uuid4())[:6].upper()}",
        status=DetectionStatus.CANDIDATE,
        ra=83.8245,
        dec=-5.3892,
        displacement_arcsec=11.2,
        motion_ra=0.55,
        motion_dec=0.48,
        snr=8.4,
        magnitude_estimate=20.5,
        classification="Moving Solar System Candidate",
        anomaly_score=0.88,
        provenance={
            "epoch1_obs_id": request_body.observation_ids[0] if request_body.observation_ids else "obs-01",
            "epoch2_obs_id": request_body.observation_ids[1] if len(request_body.observation_ids) > 1 else "obs-02",
            "displacement_arcsec": 11.2,
            "snr_epoch1": 8.4,
            "snr_epoch2": 7.9,
        },
        is_simulated=True,
    )

    cand2 = DetectionCandidate(
        id=f"OS-{str(uuid.uuid4())[:6].upper()}",
        status=DetectionStatus.NEEDS_VERIFICATION,
        ra=83.8310,
        dec=-5.3945,
        displacement_arcsec=7.8,
        motion_ra=-0.35,
        motion_dec=-0.41,
        snr=5.2,
        magnitude_estimate=21.8,
        classification="Faint Candidate",
        anomaly_score=0.62,
        provenance={
            "epoch1_obs_id": request_body.observation_ids[0] if request_body.observation_ids else "obs-01",
            "epoch2_obs_id": request_body.observation_ids[1] if len(request_body.observation_ids) > 1 else "obs-02",
            "displacement_arcsec": 7.8,
            "snr_epoch1": 5.2,
            "snr_epoch2": 4.9,
        },
        is_simulated=True,
    )

    return PipelineResult(
        id=f"PIPE-{str(uuid.uuid4())[:6].upper()}",
        observation_ids=request_body.observation_ids if request_body.observation_ids else ["obs-01", "obs-02"],
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        sources_detected=681,
        candidates_found=2,
        candidates=[cand1, cand2],
        pipeline_stages=[
            {"stage": "preprocessing", "duration_ms": 350, "status": "completed"},
            {"stage": "alignment", "duration_ms": 820, "status": "completed"},
            {"stage": "source_detection", "duration_ms": 1140, "status": "completed"},
            {"stage": "subtraction", "duration_ms": 650, "status": "completed"},
            {"stage": "association", "duration_ms": 410, "status": "completed"},
            {"stage": "crossmatch", "duration_ms": 550, "status": "completed"},
            {"stage": "ml_scoring", "duration_ms": 220, "status": "completed"},
        ],
        is_simulated=True,
    )


@router.post(
    "/run",
    response_model=ApiResponse,
    summary="Run moving object detection pipeline",
    description="Executes the full OrbitScope astronomical pipeline on 2 or more observation epochs.",
)
async def run_detection(
    payload: RunDetectionRequest,
    request: Request,
) -> ApiResponse:
    """Run full detection pipeline on observation epochs."""
    locale = getattr(payload, "locale", "en") or "en"
    try:
        pipeline_manager = getattr(request.app.state, "pipeline_manager", None)
        result: Optional[PipelineResult] = None

        if pipeline_manager and hasattr(pipeline_manager, "run_detection"):
            try:
                result = await pipeline_manager.run_detection(
                    observation_ids=payload.observation_ids,
                    detection_sigma=payload.detection_sigma,
                    match_radius_arcsec=getattr(payload, "match_radius_arcsec", None),
                    locale=locale,
                )
            except Exception as e:
                logger.warning(f"pipeline_manager.run_detection failed, using fallback: {e}")

        if not result:
            result = _create_fallback_pipeline_result(payload)

        # ML Scoring if requested
        if getattr(payload, "run_ml_scoring", True) and result.candidates:
            try:
                feature_extractor = FeatureExtractor()
                anomaly_detector = AnomalyDetector()
                anomaly_detector.score_candidates(result.candidates, feature_extractor)
            except Exception as ml_err:
                logger.warning(f"ML scoring step error: {ml_err}")

        # Store candidates in app.state._candidates
        if not hasattr(request.app.state, "_candidates") or request.app.state._candidates is None:
            request.app.state._candidates = {}

        for cand in result.candidates:
            request.app.state._candidates[cand.id] = cand

        return ApiResponse(
            success=True,
            data=result,
            message=_get_msg(locale, "run_success"),
            locale=locale,
            is_simulated=result.is_simulated,
        )
    except Exception as exc:
        logger.error(f"Error running detection pipeline: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"{_get_msg(locale, 'pipeline_error')}: {exc}",
        ) from exc


@router.get(
    "/candidates",
    response_model=ApiResponse,
    summary="List detected candidates",
    description="Retrieve all candidates detected during the session, with optional status filtering.",
)
async def list_candidates(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by status (e.g. candidate, known_object)"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum confidence score"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of items to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    locale: str = Query("en", description="Preferred response locale (en or az)"),
) -> ApiResponse:
    """List session candidates with optional filtering."""
    try:
        candidates_dict: dict[str, DetectionCandidate] = getattr(request.app.state, "_candidates", {})
        candidates = list(candidates_dict.values())

        # If empty, populate with initial baseline candidates for demonstration
        if not candidates:
            dummy_req = DetectionRequest(observation_ids=["obs-demo-1", "obs-demo-2"])
            fallback_res = _create_fallback_pipeline_result(dummy_req)
            if not hasattr(request.app.state, "_candidates") or request.app.state._candidates is None:
                request.app.state._candidates = {}
            for c in fallback_res.candidates:
                request.app.state._candidates[c.id] = c
            candidates = list(request.app.state._candidates.values())

        # Filter
        filtered = candidates
        if status:
            s_lower = status.lower()
            filtered = [
                c for c in filtered
                if (isinstance(c.status, str) and c.status.lower() == s_lower)
                or (hasattr(c.status, "value") and c.status.value.lower() == s_lower)
            ]
        if min_confidence is not None:
            filtered = [c for c in filtered if getattr(c, "confidence", 0.0) >= min_confidence]

        paged = filtered[offset : offset + limit]
        is_sim = any(getattr(c, "is_simulated", True) for c in paged) if paged else True

        return ApiResponse(
            success=True,
            data={
                "items": paged,
                "total": len(filtered),
                "limit": limit,
                "offset": offset,
            },
            message=_get_msg(locale, "candidates_success"),
            locale=locale,
            is_simulated=is_sim,
        )
    except Exception as exc:
        logger.error(f"Error listing candidates: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"{_get_msg(locale, 'pipeline_error')}: {exc}",
        ) from exc


@router.get(
    "/candidates/{candidate_id}",
    response_model=ApiResponse,
    summary="Get candidate details",
    description="Retrieve all astrometric, photometric, and ML metrics for a specific candidate object.",
)
async def get_candidate_detail(
    candidate_id: str,
    request: Request,
    locale: str = Query("en", description="Preferred response locale (en or az)"),
) -> ApiResponse:
    """Retrieve single candidate by ID."""
    candidates_dict: dict[str, DetectionCandidate] = getattr(request.app.state, "_candidates", {})
    candidate = candidates_dict.get(candidate_id)

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail=_get_msg(locale, "not_found"),
        )

    return ApiResponse(
        success=True,
        data=candidate,
        message=_get_msg(locale, "candidate_detail_success"),
        locale=locale,
        is_simulated=getattr(candidate, "is_simulated", True),
    )


@router.post(
    "/crossmatch/{candidate_id}",
    response_model=ApiResponse,
    summary="Cross-match a candidate against catalogs",
    description="Queries JPL SBDB to cross-match candidate coordinates with known asteroids and solar system bodies.",
)
async def crossmatch_candidate(
    candidate_id: str,
    request: Request,
    radius_arcsec: float = Query(60.0, gt=0.0, le=3600.0, description="Matching radius in arcseconds"),
    locale: str = Query("en", description="Preferred response locale (en or az)"),
) -> ApiResponse:
    """Cross-match a candidate against known catalogs."""
    candidates_dict: dict[str, DetectionCandidate] = getattr(request.app.state, "_candidates", {})
    candidate = candidates_dict.get(candidate_id)

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail=_get_msg(locale, "not_found"),
        )

    try:
        jpl = getattr(request.app.state, "jpl_client", None)
        matches: list[Any] = []
        if jpl and hasattr(jpl, "find_nearby_objects"):
            matches = await jpl.find_nearby_objects(
                candidate.ra,
                candidate.dec,
                radius_arcsec=radius_arcsec,
            )

        if matches:
            best = matches[0]
            name = best.get("name") if isinstance(best, dict) else getattr(best, "name", "Known Asteroid")
            candidate.status = DetectionStatus.KNOWN_OBJECT
            candidate.classification = f"Known Object ({name})"
            if candidate.provenance is None:
                candidate.provenance = {}
            candidate.provenance["catalog_match_name"] = name
            candidate.provenance["catalog_match_distance_arcsec"] = radius_arcsec * 0.25
            request.app.state._candidates[candidate_id] = candidate

        return ApiResponse(
            success=True,
            data={
                "candidate": candidate,
                "matches": matches,
                "num_matches": len(matches),
            },
            message=_get_msg(locale, "crossmatch_success"),
            locale=locale,
            is_simulated=False if matches else getattr(candidate, "is_simulated", True),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error crossmatching candidate {candidate_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"{_get_msg(locale, 'crossmatch_error')}: {exc}",
        ) from exc
