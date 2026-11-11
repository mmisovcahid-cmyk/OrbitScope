"""
Unit and Integration Tests for OrbitScope Services
==================================================
Tests for JPLClient, IRSAClient, SPHERExDataManager, and DemoDataGenerator.
"""
import asyncio
import numpy as np
import pytest
from datetime import datetime, timezone, timedelta

from app.services.jpl_client import JPLClient, _parse_ra_dms, _parse_dec_dms, _angular_separation_deg
from app.services.irsa_client import IRSAClient
from app.services.spherex_data import SPHERExDataManager
from app.services.demo_data import DemoDataGenerator, SPHEREX_BANDS
from app.models.schemas import SkyRegion, Observation, CatalogObject, EphemerisEntry


class TestCoordinateHelpers:
    """Test astronomical coordinate parsing utilities."""

    def test_parse_ra_dms(self):
        # 12h 00m 00s = 180.0 deg
        assert abs(_parse_ra_dms("12 00 00.00") - 180.0) < 1e-4
        # 00h 00m 00s = 0.0 deg
        assert abs(_parse_ra_dms("00 00 00.00") - 0.0) < 1e-4
        # Single float degree string
        assert abs(_parse_ra_dms("45.5") - 45.5) < 1e-4

    def test_parse_dec_dms(self):
        # +45 00 00 = +45.0 deg
        assert abs(_parse_dec_dms("+45 00 00.0") - 45.0) < 1e-4
        # -30 30 00 = -30.5 deg
        assert abs(_parse_dec_dms("-30 30 00.0") - (-30.5)) < 1e-4

    def test_angular_separation(self):
        # Distance between identical points is 0
        assert abs(_angular_separation_deg(50.0, 10.0, 50.0, 10.0)) < 1e-6
        # Distance along equator: 0 to 1 deg RA
        sep = _angular_separation_deg(0.0, 0.0, 1.0, 0.0)
        assert abs(sep - 1.0) < 1e-4


class TestJPLClient:
    """Test JPL SBDB and Horizons client methods."""

    def test_search_small_body_live_or_fallback(self):
        async def _test():
            client = JPLClient(timeout=10.0)
            results = await client.search_small_body("Ceres", limit=5)
            assert isinstance(results, list)
            assert len(results) > 0
            first = results[0]
            assert isinstance(first, CatalogObject)
            assert "Ceres" in (first.name or first.designation)
            assert first.object_type is not None

        asyncio.run(_test())

    def test_get_object_details(self):
        async def _test():
            client = JPLClient(timeout=10.0)
            obj = await client.get_object_details("1")
            assert obj is not None
            assert isinstance(obj, CatalogObject)
            assert obj.designation in ["1", "SIM-1"]
            if obj.semi_major_axis_au:
                assert obj.semi_major_axis_au > 0.0

        asyncio.run(_test())

    def test_get_close_approaches(self):
        async def _test():
            client = JPLClient(timeout=10.0)
            ca_list = await client.get_close_approaches("1")
            assert isinstance(ca_list, list)

        asyncio.run(_test())

    def test_get_ephemeris(self):
        async def _test():
            client = JPLClient(timeout=10.0)
            ephem = await client.get_ephemeris(
                target="Ceres",
                start_time="2026-01-01",
                stop_time="2026-01-03",
                step_size="1d",
            )
            assert isinstance(ephem, list)
            assert len(ephem) > 0
            first = ephem[0]
            assert isinstance(first, EphemerisEntry)
            assert 0.0 <= first.ra <= 360.0
            assert -90.0 <= first.dec <= 90.0
            assert first.delta_au > 0.0

        asyncio.run(_test())

    def test_find_nearby_objects(self):
        async def _test():
            client = JPLClient(timeout=10.0)
            nearby = await client.find_nearby_objects(ra=52.5, dec=18.2, radius_deg=2.0)
            assert isinstance(nearby, list)

        asyncio.run(_test())


class TestIRSAClient:
    """Test IRSA TAP client methods."""

    def test_get_available_tables(self):
        async def _test():
            client = IRSAClient(timeout=10.0)
            tables = await client.get_available_tables()
            assert isinstance(tables, list)
            assert len(tables) > 0
            assert "table_name" in tables[0]

        asyncio.run(_test())

    def test_search_spherex_sources(self):
        async def _test():
            client = IRSAClient(timeout=10.0)
            sources = await client.search_spherex_sources(ra=83.822, dec=-5.391, radius_deg=0.5)
            assert isinstance(sources, list)
            assert len(sources) > 0
            first = sources[0]
            assert "ra" in first
            assert "dec" in first
            assert "flux_ujy" in first or "mag_ab" in first
            assert "is_simulated" in first

        asyncio.run(_test())

    def test_get_observation_metadata(self):
        async def _test():
            client = IRSAClient(timeout=10.0)
            meta = await client.get_observation_metadata("SPHEREX_SIM_001")
            assert isinstance(meta, dict)
            assert "instrument" in meta
            assert meta["instrument"] == "SPHEREx"
            assert "is_simulated" in meta

        asyncio.run(_test())


class TestDemoDataGenerator:
    """Test demo data generator and scientific simulation tools."""

    def test_demo_regions_bilingual(self):
        generator = DemoDataGenerator()
        regions = generator.get_demo_regions()
        assert len(regions) >= 4
        for r in regions:
            assert isinstance(r, SkyRegion)
            assert r.is_simulated is True
            assert 0.0 <= r.ra <= 360.0
            assert -90.0 <= r.dec <= 90.0
            assert r.radius > 0.0
            assert "en" in r.descriptions
            assert "az" in r.descriptions
            assert len(r.descriptions["az"]) > 10

    def test_generate_observations(self):
        generator = DemoDataGenerator()
        region = generator.get_demo_regions()[0]
        observations = generator.generate_observations(region, n_epochs=3)
        assert isinstance(observations, list)
        assert len(observations) == 3 * len(SPHEREX_BANDS)
        for obs in observations:
            assert isinstance(obs, Observation)
            assert obs.is_simulated is True
            assert obs.exposure_time == 150.0
            assert obs.wavelength_um in [b["wavelength_um"] for b in SPHEREX_BANDS]

    def test_generate_star_field(self):
        generator = DemoDataGenerator()
        img, catalog = generator.generate_star_field(n_stars=100, size=256, moving_objects=1, seed=42)
        assert isinstance(img, np.ndarray)
        assert img.shape == (256, 256)
        assert img.dtype == np.float32
        assert img.mean() > 400.0  # Background level
        assert len(catalog) == 101  # 100 stars + 1 moving object
        moving_sources = [s for s in catalog if s["is_moving"]]
        assert len(moving_sources) == 1

    def test_generate_moving_object(self):
        generator = DemoDataGenerator()
        t1 = datetime(2026, 1, 1, tzinfo=timezone.utc)
        t2 = datetime(2026, 1, 15, tzinfo=timezone.utc)
        track = generator.generate_moving_object(t1, t2)
        assert isinstance(track, dict)
        assert track["time_interval_days"] == 14.0
        assert track["displacement_arcsec"] > 0.0
        assert track["is_simulated"] is True

    def test_generate_known_test_objects(self):
        generator = DemoDataGenerator()
        objects = generator.generate_known_test_objects()
        assert len(objects) >= 5
        for obj in objects:
            assert isinstance(obj, CatalogObject)
            assert obj.is_simulated is True
            assert obj.data_source is not None


class TestSPHERExDataManager:
    """Test SPHEREx observation data manager."""

    def test_check_data_availability(self):
        async def _test():
            manager = SPHERExDataManager()
            status = await manager.check_data_availability()
            assert isinstance(status, dict)
            assert status["mission"] == "SPHEREx"
            assert status["spectral_bands"] == 6

        asyncio.run(_test())

    def test_get_observations_for_region(self):
        async def _test():
            manager = SPHERExDataManager()
            obs = await manager.get_observations_for_region(52.5, 18.2, 2.5, band="Band 1")
            assert isinstance(obs, list)
            assert len(obs) > 0
            for o in obs:
                assert isinstance(o, Observation)
                assert "Band 1" in o.band or "B1" in o.band

        asyncio.run(_test())

    def test_get_observation_image(self):
        async def _test():
            manager = SPHERExDataManager()
            obs_list = await manager.get_observations_for_region(52.5, 18.2, 2.5)
            obs_id = obs_list[0].id
            img = await manager.get_observation_image(obs_id)
            assert isinstance(img, np.ndarray)
            assert img.shape == (512, 512)
            assert img.dtype == np.float32
            assert img.max() > img.min()

        asyncio.run(_test())
