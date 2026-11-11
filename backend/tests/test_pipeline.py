"""
OrbitScope - Scientific Pipeline Unit Tests
Tests each stage of the astronomical image processing pipeline:
1. ImagePreprocessor
2. ImageAligner
3. SourceDetector
4. ImageSubtractor
5. CandidateAssociator
6. CatalogCrossmatcher
7. PipelineManager
"""
from datetime import datetime, timezone
import numpy as np
import pytest
from astropy.wcs import WCS

from app.models.schemas import (
    CatalogObject,
    DetectionCandidate,
    DetectionStatus,
    PipelineResult,
    SourceMeasurement,
)
from app.pipeline.alignment import ImageAligner
from app.pipeline.candidate_associator import CandidateAssociator
from app.pipeline.crossmatcher import CatalogCrossmatcher
from app.pipeline.pipeline_manager import PipelineManager
from app.pipeline.preprocessor import ImagePreprocessor
from app.pipeline.source_detector import SourceDetector
from app.pipeline.subtractor import ImageSubtractor


@pytest.fixture
def sample_star_image():
    """Create a synthetic 64x64 astronomical test image with noise and a point source."""
    rng = np.random.RandomState(42)
    img = rng.normal(loc=50.0, scale=5.0, size=(64, 64))
    y, x = np.ogrid[:64, :64]
    # Add star at (32, 32)
    dist_sq = (x - 32) ** 2 + (y - 32) ** 2
    img += 200.0 * np.exp(-dist_sq / (2.0 * (1.5**2)))
    return np.ascontiguousarray(img, dtype=np.float32)


@pytest.fixture
def sample_wcs():
    """Create a basic celestial WCS."""
    w = WCS(naxis=2)
    w.wcs.crpix = [32.0, 32.0]
    w.wcs.cdelt = [-0.001667, 0.001667]
    w.wcs.crval = [100.0, 20.0]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    return w


def test_preprocessor(sample_star_image):
    """Test 2D background estimation, subtraction, noise estimation, and masking."""
    prep = ImagePreprocessor()
    res = prep.process(sample_star_image)

    assert "processed_image" in res
    assert "background" in res
    assert "background_rms" in res
    assert "noise" in res
    assert "bad_pixel_mask" in res
    assert "normalized_image" in res

    assert res["processed_image"].shape == sample_star_image.shape
    assert res["noise"] > 0.0
    assert 0.0 <= np.min(res["normalized_image"])
    assert np.max(res["normalized_image"]) <= 1.0


def test_aligner():
    """Test sub-pixel phase cross-correlation and image translation."""
    aligner = ImageAligner()
    ref = np.zeros((64, 64), dtype=np.float32)
    tgt = np.zeros((64, 64), dtype=np.float32)

    # Put Gaussian star at (30, 30) on ref, shifted to (32, 33) on tgt
    y, x = np.ogrid[:64, :64]
    ref += 100.0 * np.exp(-((x - 30) ** 2 + (y - 30) ** 2) / 8.0).astype(np.float32)
    tgt += 100.0 * np.exp(-((x - 33) ** 2 + (y - 32) ** 2) / 8.0).astype(np.float32)

    aligned, shift = aligner.align_image_registration(ref, tgt)

    # Shift needed to move target to reference is approximately (-2, -3)
    assert abs(shift[0] - (-2.0)) < 0.5
    assert abs(shift[1] - (-3.0)) < 0.5
    assert aligned.shape == tgt.shape


def test_source_detector(sample_star_image, sample_wcs):
    """Test DAOStarFinder and segmentation source detection."""
    detector = SourceDetector(detection_sigma=3.0, fwhm=3.0)

    # 1. DAOPhot detection
    dao_sources = detector.detect(sample_star_image, method="dao", wcs=sample_wcs)
    assert len(dao_sources) >= 1
    src = dao_sources[0]
    assert abs(src.x - 32.0) <= 1.5
    assert abs(src.y - 32.0) <= 1.5
    assert src.snr > 5.0
    assert 0.0 <= src.ra < 360.0

    # 2. Refine measurements
    refined = detector.measure_source_properties(sample_star_image, dao_sources)
    assert len(refined) == len(dao_sources)
    assert refined[0].flux > 0
    assert refined[0].snr > 0

    # 3. Segmentation detection
    seg_sources = detector.detect(sample_star_image, method="segmentation", wcs=sample_wcs)
    assert len(seg_sources) >= 1


def test_subtractor():
    """Test matched-filter difference and residual isolation."""
    sub = ImageSubtractor()
    ref = np.random.normal(50.0, 5.0, (64, 64)).astype(np.float32)
    tgt = np.copy(ref)
    # Add a transient source
    tgt[25, 25] += 60.0

    res = sub.subtract(ref, tgt, method="matched", threshold_sigma=4.0)

    assert "difference" in res
    assert "significance_map" in res
    assert "residuals" in res
    assert len(res["residuals"]) >= 1

    top_residual = res["residuals"][0]
    assert abs(top_residual["x"] - 25.0) <= 2.0
    assert abs(top_residual["y"] - 25.0) <= 2.0
    assert top_residual["type"] == "positive"


def test_candidate_associator():
    """Test multi-epoch source matching and moving candidate track extraction."""
    assoc = CandidateAssociator(match_radius_arcsec=10.0)

    s1_star = SourceMeasurement(x=10, y=10, ra=100.0, dec=20.0, flux=1000, snr=20.0)
    s2_star = SourceMeasurement(x=10, y=10, ra=100.0, dec=20.0, flux=1010, snr=20.0)

    # Moving asteroid candidate moves ~3 arcsec between epochs
    s1_ast = SourceMeasurement(x=40, y=40, ra=100.05, dec=20.05, flux=500, snr=12.0)
    # 0.0008 deg ~ 2.88 arcsec
    s2_ast = SourceMeasurement(x=43, y=42, ra=100.0508, dec=20.0505, flux=490, snr=11.5)

    sources1 = [s1_star, s1_ast]
    sources2 = [s2_star, s2_ast]

    t1 = datetime(2026, 3, 15, 10, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 3, 15, 12, 0, tzinfo=timezone.utc)

    # Positional match
    matches = assoc.positional_match(sources1, sources2, max_separation_arcsec=15.0)
    assert len(matches) == 2

    # Stationary separation
    stationary = assoc.find_stationary_sources(matches, max_motion_arcsec=1.0)
    assert len(stationary) == 1
    assert stationary[0][0] == 0  # Star is stationary

    # Moving candidates extraction
    candidates = assoc.find_moving_candidates(sources1, sources2, t1, t2)
    assert len(candidates) >= 1
    cand = candidates[0]
    assert cand.displacement_arcsec is not None and cand.displacement_arcsec > 1.0
    assert cand.status in (DetectionStatus.CANDIDATE, DetectionStatus.NEEDS_VERIFICATION)


def test_crossmatcher():
    """Test JPL SBDB cross-matching and classification."""
    import asyncio

    async def _test():
        crossmatcher = CatalogCrossmatcher()

        cand = DetectionCandidate(
            id="TEST_CAND_01",
            status=DetectionStatus.NEEDS_VERIFICATION,
            ra=100.0,
            dec=20.0,
            displacement_arcsec=4.5,
            motion_ra=1.5,
            motion_dec=0.8,
            snr=15.0,
            measurements=[
                SourceMeasurement(x=20, y=20, ra=100.0, dec=20.0, flux=800, snr=15.0),
                SourceMeasurement(x=24, y=22, ra=100.0012, dec=20.0005, flux=780, snr=14.5),
            ],
        )

        result_cand = await crossmatcher.crossmatch_candidate(cand, search_radius_arcsec=20.0)
        assert result_cand.id == cand.id
        assert result_cand.status in (
            DetectionStatus.CANDIDATE,
            DetectionStatus.KNOWN_OBJECT,
            DetectionStatus.NEEDS_VERIFICATION,
        )

    asyncio.run(_test())


def test_pipeline_manager_end_to_end():
    """Test full pipeline orchestration and comparison."""
    import asyncio

    async def _test():
        pm = PipelineManager()

        # 1. Full detection run
        res = await pm.run_detection(["OBS_FRAME_1", "OBS_FRAME_2"], detection_sigma=3.0, match_radius_arcsec=5.0)
        assert isinstance(res, PipelineResult)
        assert res.sources_detected > 0
        assert len(res.pipeline_stages) >= 5
        assert res.is_simulated is True

        # 2. Comparison between observations
        comp = await pm.compare_observations("OBS_FRAME_1", "OBS_FRAME_2")
        assert comp.observation_ids == ["OBS_FRAME_1", "OBS_FRAME_2"]
        assert "registration_shift_x" in comp.difference_stats

    asyncio.run(_test())
