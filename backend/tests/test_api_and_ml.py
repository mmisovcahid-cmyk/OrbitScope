"""OrbitScope - API Routes & ML Unit Tests
Validates all endpoints across /sky, /observations, /detection, /catalog, /planetx, /system,
and unit tests for FeatureExtractor and AnomalyDetector.
"""
from __future__ import annotations

import io
from fastapi.testclient import TestClient
import numpy as np
import pytest
from PIL import Image

from app.main import app
from app.ml.anomaly_detector import AnomalyDetector
from app.ml.feature_extractor import FeatureExtractor
from app.models.schemas import (
    DetectionCandidate,
    DetectionStatus,
    Locale,
    SourceMeasurement,
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


# ============================================================================
# Root and System Route Tests
# ============================================================================

def test_root_endpoint(client: TestClient) -> None:
    """Test GET / returns OrbitScope metadata and operational status."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["app"] == "OrbitScope"
    assert "documentation" in data
    assert data["status"] == "operational"


def test_system_health(client: TestClient) -> None:
    """Test GET /api/v1/system/health."""
    res = client.get("/api/v1/system/health")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert payload["data"]["status"] == "healthy"
    assert "uptime_seconds" in payload["data"]


def test_system_status(client: TestClient) -> None:
    """Test GET /api/v1/system/status."""
    res = client.get("/api/v1/system/status")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert payload["data"]["status"] == "operational"
    assert "components" in payload["data"]
    assert "cache_size" in payload["data"]["components"]


def test_system_datasources(client: TestClient) -> None:
    """Test GET /api/v1/system/datasources."""
    res = client.get("/api/v1/system/datasources")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert isinstance(payload["data"], list)
    assert len(payload["data"]) >= 3


# ============================================================================
# Sky Routes Tests
# ============================================================================

def test_sky_regions(client: TestClient) -> None:
    """Test GET /api/v1/sky/regions."""
    res = client.get("/api/v1/sky/regions")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert len(payload["data"]) > 0


def test_sky_observations(client: TestClient) -> None:
    """Test GET /api/v1/sky/observations cone search."""
    res = client.get("/api/v1/sky/observations?ra=83.822&dec=-5.391&radius=1.5")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert isinstance(payload["data"], list)


def test_sky_objects(client: TestClient) -> None:
    """Test GET /api/v1/sky/objects cone search via JPL."""
    res = client.get("/api/v1/sky/objects?ra=83.822&dec=-5.391&radius=1.0")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True


# ============================================================================
# Observations Routes Tests
# ============================================================================

def test_observations_list_and_pagination(client: TestClient) -> None:
    """Test GET /api/v1/observations/."""
    res = client.get("/api/v1/observations/?limit=5&offset=0")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert "items" in payload["data"]
    assert "total" in payload["data"]


def test_observation_image_rendering(client: TestClient) -> None:
    """Test GET /api/v1/observations/{id}/image streams valid PNG image."""
    res = client.get("/api/v1/observations/SPHEREX_SIM_001/image")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    # Verify PNG header
    img = Image.open(io.BytesIO(res.content))
    assert img.size[0] > 0 and img.size[1] > 0


def test_observations_compare(client: TestClient) -> None:
    """Test POST /api/v1/observations/compare."""
    req = {
        "observation_1_id": "SPHEREX_SIM_001",
        "observation_2_id": "SPHEREX_SIM_002",
        "locale": "en",
    }
    res = client.post("/api/v1/observations/compare", json=req)
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert len(payload["data"]["observation_ids"]) == 2


# ============================================================================
# Detection Routes Tests
# ============================================================================

def test_detection_run_and_candidates(client: TestClient) -> None:
    """Test POST /api/v1/detection/run and GET /api/v1/detection/candidates."""
    run_req = {
        "observation_ids": ["SPHEREX_SIM_001", "SPHEREX_SIM_002"],
        "threshold_sigma": 4.5,
        "run_ml_scoring": True,
        "locale": "en",
    }
    res = client.post("/api/v1/detection/run", json=run_req)
    assert res.status_code == 200
    run_payload = res.json()
    assert run_payload["success"] is True
    assert run_payload["data"]["candidates_found"] >= 1

    # List candidates
    list_res = client.get("/api/v1/detection/candidates")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["success"] is True
    assert len(list_data["data"]["items"]) >= 1

    # Get single candidate detail
    candidate_id = list_data["data"]["items"][0]["id"]
    detail_res = client.get(f"/api/v1/detection/candidates/{candidate_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["data"]["id"] == candidate_id

    # Crossmatch candidate
    cm_res = client.post(f"/api/v1/detection/crossmatch/{candidate_id}?radius_arcsec=60")
    assert cm_res.status_code == 200
    assert cm_res.json()["success"] is True


# ============================================================================
# Catalog Routes Tests
# ============================================================================

def test_catalog_search(client: TestClient) -> None:
    """Test GET /api/v1/catalog/search."""
    res = client.get("/api/v1/catalog/search?query=Ceres&limit=5")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True


def test_catalog_ephemeris(client: TestClient) -> None:
    """Test GET /api/v1/catalog/ephemeris."""
    res = client.get("/api/v1/catalog/ephemeris?target=Ceres&start_time=now&step_size=1d")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert isinstance(payload["data"], dict)
    assert payload["data"]["target"] == "Ceres"
    assert "entries" in payload["data"]


def test_catalog_nearby(client: TestClient) -> None:
    """Test GET /api/v1/catalog/nearby."""
    res = client.get("/api/v1/catalog/nearby?ra=84.0&dec=-5.0&radius=1.0")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True


# ============================================================================
# Planet X Routes Tests
# ============================================================================

def test_planetx_evidence(client: TestClient) -> None:
    """Test GET /api/v1/planetx/evidence."""
    res = client.get("/api/v1/planetx/evidence")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert len(payload["data"]["evidence"]) >= 5
    assert len(payload["data"]["predictions"]) >= 5
    assert payload["is_simulated"] is True


def test_planetx_tnos(client: TestClient) -> None:
    """Test GET /api/v1/planetx/tnos."""
    res = client.get("/api/v1/planetx/tnos")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert len(payload["data"]) >= 6
    names = [t["name"] for t in payload["data"]]
    assert any("Sedna" in n for n in names)


def test_planetx_regions(client: TestClient) -> None:
    """Test GET /api/v1/planetx/regions."""
    res = client.get("/api/v1/planetx/regions")
    assert res.status_code == 200
    payload = res.json()
    assert payload["success"] is True
    assert len(payload["data"]) >= 2
    # Verify Batygin & Brown 40-100 deg RA prediction
    primary = payload["data"][0]
    assert primary["ra_min"] == 40.0
    assert primary["ra_max"] == 100.0


# ============================================================================
# ML Module Tests: FeatureExtractor & AnomalyDetector
# ============================================================================

def test_feature_extractor() -> None:
    """Test FeatureExtractor with candidate objects."""
    extractor = FeatureExtractor()
    assert len(extractor.FEATURE_NAMES) == 12
    assert extractor.get_feature_names() == extractor.FEATURE_NAMES

    # Candidate with measurements
    meas1 = SourceMeasurement(
        x=10.0, y=12.0, ra=83.5, dec=-5.0, flux=150.0, peak=200.0, fwhm=3.2, roundness=0.9, sharpness=0.6, snr=12.0
    )
    meas2 = SourceMeasurement(
        x=14.0, y=16.0, ra=83.502, dec=-5.001, flux=140.0, peak=190.0, fwhm=3.1, roundness=0.88, sharpness=0.58, snr=11.5
    )
    candidate = DetectionCandidate(
        id="CAND_01",
        status=DetectionStatus.CANDIDATE,
        ra=83.501,
        dec=-5.0005,
        displacement_arcsec=9.5,
        motion_ra=1.2,
        motion_dec=-0.8,
        snr=15.0,
        magnitude_estimate=20.2,
        measurements=[meas1, meas2],
    )

    vec = extractor.extract_features(candidate)
    assert isinstance(vec, np.ndarray)
    assert vec.shape == (12,)
    assert not np.isnan(vec).any()
    assert vec[0] == 9.5  # displacement
    assert vec[1] == 15.0  # snr

    batch = extractor.extract_batch([candidate, candidate])
    assert batch.shape == (2, 12)


def test_anomaly_detector_scoring() -> None:
    """Test AnomalyDetector scoring and anomaly ranking."""
    extractor = FeatureExtractor()
    detector = AnomalyDetector(contamination=0.15, n_estimators=50)

    # Normal population
    candidates: list[DetectionCandidate] = []
    for i in range(15):
        candidates.append(
            DetectionCandidate(
                id=f"NORM_{i}",
                status=DetectionStatus.CANDIDATE,
                ra=80.0 + i * 0.01,
                dec=20.0 + i * 0.01,
                displacement_arcsec=2.0 + np.random.uniform(-0.2, 0.2),
                motion_ra=0.1,
                motion_dec=0.1,
                snr=8.0,
                magnitude_estimate=21.0,
            )
        )

    # Strong outlier candidate
    outlier = DetectionCandidate(
        id="OUTLIER_01",
        status=DetectionStatus.CANDIDATE,
        ra=80.5,
        dec=20.5,
        displacement_arcsec=35.0,  # Fast moving
        motion_ra=15.0,
        motion_dec=-12.0,
        snr=45.0,
        magnitude_estimate=17.0,
    )
    candidates.append(outlier)

    scored = detector.score_candidates(candidates, extractor)
    assert len(scored) == 16
    for c in scored:
        assert c.anomaly_score is not None
        assert 0.0 <= c.anomaly_score <= 1.0


# ============================================================================
# i18n Localization Tests
# ============================================================================

def test_i18n_responses(client: TestClient) -> None:
    """Test API responses under English and Azerbaijani locales."""
    # Health check
    res_en = client.get("/api/v1/system/health?locale=en")
    assert res_en.status_code == 200
    assert "healthy" in res_en.json()["message"].lower()

    res_az = client.get("/api/v1/system/health?locale=az")
    assert res_az.status_code == 200
    assert "saz" in res_az.json()["message"].lower()

    # Planet X evidence
    res_ev_az = client.get("/api/v1/planetx/evidence?locale=az")
    assert res_ev_az.status_code == 200
    assert "elmi" in res_ev_az.json()["message"].lower()
