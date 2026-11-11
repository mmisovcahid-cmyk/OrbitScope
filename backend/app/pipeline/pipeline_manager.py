"""
OrbitScope - Scientific Detection Pipeline Manager
Orchestrates the complete multi-epoch astronomical detection pipeline:
Image Loading -> Preprocessing -> Source Detection -> Astrometric Alignment
-> Matched Image Subtraction -> Candidate Association -> Catalog Cross-Matching -> Result Assembly.
"""
from __future__ import annotations

import asyncio
import math
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from astropy.coordinates import SkyCoord
import astropy.units as u
from astropy.wcs import WCS

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.schemas import (
    ComparisonResult,
    DetectionCandidate,
    DetectionStatus,
    Observation,
    PipelineResult,
    SourceMeasurement,
)
from app.pipeline.alignment import ImageAligner
from app.pipeline.candidate_associator import CandidateAssociator
from app.pipeline.crossmatcher import CatalogCrossmatcher
from app.pipeline.preprocessor import ImagePreprocessor
from app.pipeline.source_detector import SourceDetector
from app.pipeline.subtractor import ImageSubtractor

logger = get_logger("pipeline.pipeline_manager")


def _generate_synthetic_wcs(ra_center: float = 83.633, dec_center: float = 22.014, nx: int = 128, ny: int = 128) -> WCS:
    """Generate an Astropy WCS header for a synthetic field (SPHEREx ~6.0 arcsec/pixel)."""
    w = WCS(naxis=2)
    w.wcs.crpix = [nx / 2.0, ny / 2.0]
    # 6.0 arcsec/pix = 6.0 / 3600.0 = 0.0016667 deg/pix
    deg_per_pix = 6.0 / 3600.0
    w.wcs.cdelt = [-deg_per_pix, deg_per_pix]
    w.wcs.crval = [ra_center, dec_center]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    return w


def _create_synthetic_frame(
    wcs: WCS,
    epoch_idx: int = 1,
    nx: int = 128,
    ny: int = 128,
    seed: int = 42,
) -> tuple[np.ndarray, list[tuple[float, float, float]]]:
    """
    Generate synthetic astronomical image frame with background noise, fixed stars,
    and a moving solar system body.
    """
    rng = np.random.RandomState(seed + epoch_idx)
    # Background Gaussian noise ~ 25 ADU
    img = rng.normal(loc=120.0, scale=12.0, size=(ny, nx)).astype(np.float64)

    # Fixed background stars (same across epochs)
    star_rng = np.random.RandomState(seed)
    n_stars = 15
    for _ in range(n_stars):
        sx = star_rng.uniform(10, nx - 10)
        sy = star_rng.uniform(10, ny - 10)
        peak = star_rng.uniform(150.0, 1500.0)
        fwhm = 2.8
        sig = fwhm / 2.355

        y_grid, x_grid = np.ogrid[:ny, :nx]
        dist_sq = (x_grid - sx) ** 2 + (y_grid - sy) ** 2
        img += peak * np.exp(-dist_sq / (2.0 * sig**2))

    # Moving object: moves ~4 pixels between epoch 1 and 2
    # Epoch 1 pos: (45, 50), Epoch 2 pos: (49, 52)
    mx = 45.0 + (epoch_idx - 1) * 4.2
    my = 50.0 + (epoch_idx - 1) * 2.1
    m_peak = 480.0
    sig = 2.8 / 2.355

    y_grid, x_grid = np.ogrid[:ny, :nx]
    dist_sq = (x_grid - mx) ** 2 + (y_grid - my) ** 2
    img += m_peak * np.exp(-dist_sq / (2.0 * sig**2))

    return np.ascontiguousarray(img, dtype=np.float32), [(mx, my, m_peak)]


class PipelineManager:
    """Orchestrates the full OrbitScope astronomical detection pipeline."""

    def __init__(
        self,
        spherex_data_manager: Any = None,
        jpl_client: Any = None,
    ) -> None:
        """
        Initialize the PipelineManager with all processing stages.

        Args:
            spherex_data_manager: Service providing access to SPHEREx/IRSA observations.
            jpl_client: Service providing access to JPL SBDB and Horizons ephemerides.
        """
        self.data_manager = spherex_data_manager
        self.jpl_client = jpl_client

        self.preprocessor = ImagePreprocessor()
        self.aligner = ImageAligner()
        self.detector = SourceDetector()
        self.subtractor = ImageSubtractor()
        self.associator = CandidateAssociator()
        self.crossmatcher = CatalogCrossmatcher(jpl_client)

    async def _load_observation_data(
        self,
        obs_id: str,
        index: int,
    ) -> tuple[Observation, np.ndarray, WCS]:
        """Load observation metadata, pixel array, and WCS for a single observation ID."""
        # 1. Try spherex_data_manager if available
        if self.data_manager is not None:
            try:
                if hasattr(self.data_manager, "get_observation_and_image"):
                    obs, img, wcs = await self.data_manager.get_observation_and_image(obs_id)
                    return obs, img, wcs
                elif hasattr(self.data_manager, "get_observation"):
                    obs = await self.data_manager.get_observation(obs_id)
                    img = None
                    if hasattr(self.data_manager, "get_image"):
                        img = await self.data_manager.get_image(obs_id)
                    if img is not None:
                        wcs = _generate_synthetic_wcs(obs.ra, obs.dec, img.shape[1], img.shape[0])
                        return obs, img, wcs
            except Exception as exc:
                logger.warning("Data manager failed to load obs %s: %s; using synthetic fallback", obs_id, exc)

        # 2. Synthetic fallback (clearly labeled is_simulated=True)
        now = datetime.now(timezone.utc)
        epoch_time = now - timedelta(hours=(2 - index) * 3)

        ra_center, dec_center = 83.633, 22.014
        wcs = _generate_synthetic_wcs(ra_center, dec_center, nx=128, ny=128)
        img, _ = _create_synthetic_frame(wcs, epoch_idx=index, nx=128, ny=128)

        obs = Observation(
            id=obs_id,
            timestamp=epoch_time,
            ra=ra_center,
            dec=dec_center,
            band="Band 1",
            source="SPHEREx (Simulated)",
            exposure_time=120.0,
            wavelength_um=0.93,
            metadata={"simulated_epoch": index, "pixel_scale_arcsec": 6.0},
            is_simulated=True,
        )
        return obs, img, wcs

    async def run_detection(
        self,
        observation_ids: list[str],
        detection_sigma: float | None = None,
        match_radius_arcsec: float | None = None,
        locale: str = "en",
    ) -> PipelineResult:
        """
        Run the full OrbitScope astronomical detection pipeline:
        1. Ingest multi-epoch observation frames and WCS solutions.
        2. Preprocess images (background estimation, subtraction, bad-pixel masking).
        3. Extract point sources with sub-pixel photometry in each epoch.
        4. Astrometrically register and align frames.
        5. Compute PSF-matched difference image and residual significance map.
        6. Cross-associate sources to identify moving candidates.
        7. Cross-match candidates against NASA/JPL SBDB catalog.
        8. Return comprehensive PipelineResult with full stage provenance.

        Args:
            observation_ids: List of at least 2 observation IDs to process.
            detection_sigma: Detection threshold in background sigmas.
            match_radius_arcsec: Association cone search radius.
            locale: Language locale for response ("en" or "az").

        Returns:
            PipelineResult: Complete output bundle with detected candidates and provenance.
        """
        start_time = datetime.now(timezone.utc)
        run_id = f"PIPE-{uuid.uuid4().hex[:8].upper()}"
        stages_telemetry: list[dict[str, Any]] = []

        if len(observation_ids) < 2:
            raise ValueError(f"Detection pipeline requires at least 2 observation IDs (got {len(observation_ids)})")

        sig = float(detection_sigma if detection_sigma is not None else getattr(settings, "DEFAULT_DETECTION_SIGMA", 3.0))
        radius = float(match_radius_arcsec if match_radius_arcsec is not None else getattr(settings, "DEFAULT_MATCH_RADIUS_ARCSEC", 5.0))

        logger.info("Initiating pipeline %s on %d observations (sigma=%.1f, radius=%.1f)", run_id, len(observation_ids), sig, radius)

        # -------------------------------------------------------------
        # STAGE 1: Image Ingestion
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        obs1, img1, wcs1 = await self._load_observation_data(observation_ids[0], index=1)
        obs2, img2, wcs2 = await self._load_observation_data(observation_ids[1], index=2)
        dur1 = time.perf_counter() - t0

        is_simulated = bool(obs1.is_simulated or obs2.is_simulated)
        stages_telemetry.append(
            {
                "stage": "data_ingestion",
                "status": "completed",
                "duration_seconds": round(dur1, 4),
                "message": f"Loaded observations {obs1.id} and {obs2.id}",
                "metrics": {"is_simulated": is_simulated, "shape": list(img1.shape)},
            }
        )

        # -------------------------------------------------------------
        # STAGE 2: Image Preprocessing
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        prep1 = self.preprocessor.process(img1)
        prep2 = self.preprocessor.process(img2)
        dur2 = time.perf_counter() - t0

        stages_telemetry.append(
            {
                "stage": "preprocessing",
                "status": "completed",
                "duration_seconds": round(dur2, 4),
                "message": "Background estimation and subtraction completed",
                "metrics": {
                    "noise_epoch1": round(float(prep1["noise"]), 3),
                    "noise_epoch2": round(float(prep2["noise"]), 3),
                },
            }
        )

        # -------------------------------------------------------------
        # STAGE 3: Source Detection
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        sources1 = self.detector.detect(prep1["processed_image"], method="dao", threshold_sigma=sig, wcs=wcs1)
        sources2 = self.detector.detect(prep2["processed_image"], method="dao", threshold_sigma=sig, wcs=wcs2)

        # Refine source properties
        sources1 = self.detector.measure_source_properties(prep1["processed_image"], sources1)
        sources2 = self.detector.measure_source_properties(prep2["processed_image"], sources2)
        dur3 = time.perf_counter() - t0

        stages_telemetry.append(
            {
                "stage": "source_detection",
                "status": "completed",
                "duration_seconds": round(dur3, 4),
                "message": f"Extracted {len(sources1)} sources in epoch 1, {len(sources2)} in epoch 2",
                "metrics": {"sources_epoch1": len(sources1), "sources_epoch2": len(sources2)},
            }
        )

        # -------------------------------------------------------------
        # STAGE 4: Astrometric Alignment
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        aligned_img2, shift = self.aligner.align_image_registration(
            prep1["processed_image"],
            prep2["processed_image"],
            upsample_factor=100,
        )
        dur4 = time.perf_counter() - t0

        stages_telemetry.append(
            {
                "stage": "alignment",
                "status": "completed",
                "duration_seconds": round(dur4, 4),
                "message": f"Phase correlation alignment offset: dy={shift[0]:.2f}px, dx={shift[1]:.2f}px",
                "metrics": {"shift_y": round(shift[0], 3), "shift_x": round(shift[1], 3)},
            }
        )

        # -------------------------------------------------------------
        # STAGE 5: Matched Subtraction
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        sub_res = self.subtractor.subtract(
            reference=prep1["processed_image"],
            target=aligned_img2,
            method="matched",
            threshold_sigma=sig,
        )
        dur5 = time.perf_counter() - t0

        stages_telemetry.append(
            {
                "stage": "subtraction",
                "status": "completed",
                "duration_seconds": round(dur5, 4),
                "message": f"Subtracted images: isolated {len(sub_res['residuals'])} significant residuals",
                "metrics": {
                    "method": sub_res["method"],
                    "noise_rms": round(sub_res["noise"], 4),
                    "residuals_count": len(sub_res["residuals"]),
                },
            }
        )

        # -------------------------------------------------------------
        # STAGE 6: Multi-Epoch Candidate Association
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        candidates = self.associator.find_moving_candidates(
            sources1=sources1,
            sources2=sources2,
            epoch1=obs1.timestamp,
            epoch2=obs2.timestamp,
            min_motion_arcsec=1.0,
            max_motion_arcsec=max(30.0, radius * 8.0),
        )
        dur6 = time.perf_counter() - t0

        stages_telemetry.append(
            {
                "stage": "candidate_association",
                "status": "completed",
                "duration_seconds": round(dur6, 4),
                "message": f"Track association identified {len(candidates)} candidate movers/transients",
                "metrics": {"candidates_formed": len(candidates)},
            }
        )

        # -------------------------------------------------------------
        # STAGE 7: Catalog Cross-Matching
        # -------------------------------------------------------------
        t0 = time.perf_counter()
        classified_candidates = await self.crossmatcher.crossmatch_batch(
            candidates,
            search_radius_arcsec=radius * 3.0,
        )
        dur7 = time.perf_counter() - t0

        stages_telemetry.append(
            {
                "stage": "catalog_crossmatch",
                "status": "completed",
                "duration_seconds": round(dur7, 4),
                "message": f"Cross-matched {len(classified_candidates)} candidates against JPL SBDB",
                "metrics": {
                    "known_objects": sum(1 for c in classified_candidates if c.status == DetectionStatus.KNOWN_OBJECT),
                    "novel_candidates": sum(1 for c in classified_candidates if c.status == DetectionStatus.CANDIDATE),
                },
            }
        )

        # -------------------------------------------------------------
        # STAGE 8: Comparison & Final Result Assembly
        # -------------------------------------------------------------
        comparison = await self._build_comparison_result(
            obs1, obs2, sources1, sources2, sub_res, shift, is_simulated
        )

        completed_time = datetime.now(timezone.utc)
        pipeline_result = self._create_pipeline_result(
            run_id=run_id,
            observation_ids=observation_ids,
            started_at=start_time,
            completed_at=completed_time,
            sources_detected=len(sources1) + len(sources2),
            candidates=classified_candidates,
            comparison=comparison,
            stages=stages_telemetry,
            is_simulated=is_simulated,
        )

        logger.info(
            "Pipeline %s completed in %.2fs: %d candidates found (%d known, %d new)",
            run_id,
            (completed_time - start_time).total_seconds(),
            len(classified_candidates),
            sum(1 for c in classified_candidates if c.status == DetectionStatus.KNOWN_OBJECT),
            sum(1 for c in classified_candidates if c.status == DetectionStatus.CANDIDATE),
        )

        return pipeline_result

    async def compare_observations(self, obs_id_1: str, obs_id_2: str) -> ComparisonResult:
        """
        Compare two observations side-by-side:
        1. Ingest both frames and WCS metadata.
        2. Preprocess images.
        3. Detect sources in both frames.
        4. Align frame 2 to frame 1.
        5. Compute difference map and identify new, vanished, and moved sources.
        6. Return strongly typed ComparisonResult.

        Args:
            obs_id_1: Baseline reference observation ID.
            obs_id_2: Follow-up target observation ID.

        Returns:
            ComparisonResult: Detailed structural differences between observations.
        """
        logger.info("Comparing observations %s vs %s", obs_id_1, obs_id_2)
        obs1, img1, wcs1 = await self._load_observation_data(obs_id_1, index=1)
        obs2, img2, wcs2 = await self._load_observation_data(obs_id_2, index=2)

        is_simulated = bool(obs1.is_simulated or obs2.is_simulated)

        prep1 = self.preprocessor.process(img1)
        prep2 = self.preprocessor.process(img2)

        sig = getattr(settings, "DEFAULT_DETECTION_SIGMA", 3.0)
        sources1 = self.detector.detect(prep1["processed_image"], method="dao", threshold_sigma=sig, wcs=wcs1)
        sources2 = self.detector.detect(prep2["processed_image"], method="dao", threshold_sigma=sig, wcs=wcs2)

        aligned_img2, shift = self.aligner.align_image_registration(prep1["processed_image"], prep2["processed_image"])
        sub_res = self.subtractor.subtract(prep1["processed_image"], aligned_img2, method="matched")

        return await self._build_comparison_result(obs1, obs2, sources1, sources2, sub_res, shift, is_simulated)

    async def _build_comparison_result(
        self,
        obs1: Observation,
        obs2: Observation,
        sources1: list[SourceMeasurement],
        sources2: list[SourceMeasurement],
        sub_res: dict[str, Any],
        shift: tuple[float, float],
        is_simulated: bool,
    ) -> ComparisonResult:
        """Helper to construct ComparisonResult model from processed epochs."""
        # Find matches between epochs
        matches = self.associator.positional_match(sources1, sources2, max_separation_arcsec=15.0)
        matched_1 = {m[0] for m in matches}
        matched_2 = {m[1] for m in matches}

        # Vanished sources: in epoch 1 but missing in epoch 2
        vanished = [sources1[i] for i in range(len(sources1)) if i not in matched_1]

        # New sources: in epoch 2 but missing in epoch 1
        new_sources = [sources2[j] for j in range(len(sources2)) if j not in matched_2]

        # Moved sources: paired but separation > 1.0 arcsec
        moved_sources: list[dict[str, Any]] = []
        for i, j, sep in matches:
            if sep >= 1.0:
                s1 = sources1[i]
                s2 = sources2[j]
                moved_sources.append(
                    {
                        "source1": {"x": s1.x, "y": s1.y, "ra": s1.ra, "dec": s1.dec, "flux": s1.flux},
                        "source2": {"x": s2.x, "y": s2.y, "ra": s2.ra, "dec": s2.dec, "flux": s2.flux},
                        "displacement_arcsec": round(sep, 3),
                    }
                )

        diff_stats = {
            "registration_shift_y": round(float(shift[0]), 3),
            "registration_shift_x": round(float(shift[1]), 3),
            "subtraction_noise_rms": round(float(sub_res.get("noise", 1.0)), 4),
            "significant_residuals_count": float(len(sub_res.get("residuals", []))),
            "matched_source_pairs": float(len(matches)),
        }

        return ComparisonResult(
            observation_ids=[obs1.id, obs2.id],
            new_sources=new_sources,
            vanished_sources=vanished,
            moved_sources=moved_sources,
            difference_stats=diff_stats,
            is_simulated=is_simulated,
        )

    def _create_pipeline_result(
        self,
        run_id: str,
        observation_ids: list[str],
        started_at: datetime,
        completed_at: datetime,
        sources_detected: int,
        candidates: list[DetectionCandidate],
        comparison: ComparisonResult | None,
        stages: list[dict[str, Any]],
        is_simulated: bool,
    ) -> PipelineResult:
        """Construct the final PipelineResult with full telemetry and provenance."""
        return PipelineResult(
            id=run_id,
            observation_ids=observation_ids,
            started_at=started_at,
            completed_at=completed_at,
            sources_detected=sources_detected,
            candidates_found=len(candidates),
            candidates=candidates,
            comparison=comparison,
            pipeline_stages=stages,
            is_simulated=is_simulated,
        )


def _build_default_manager() -> PipelineManager:
    """Application singleton wired to the JPL client for catalog cross-matching."""
    from app.services.jpl_client import jpl_client

    return PipelineManager(spherex_data_manager=None, jpl_client=jpl_client)


# Default singleton instance (imported by app.main)
pipeline_manager = _build_default_manager()
