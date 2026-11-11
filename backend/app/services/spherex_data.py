"""
OrbitScope - SPHEREx Data Manager
=================================
Manages SPHEREx observation frames, spectral image cubes, and sky region queries.
Interfaces with IRSAClient for live TAP queries and smoothly transitions to
synthesized multi-epoch observations with realistic Gaussian PSFs and moving sources
when live SPHEREx mission data is not yet publicly hosted.
"""
from __future__ import annotations

import hashlib
import io
import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import numpy as np

from app.core.cache import observation_cache
from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.schemas import (
    DataSourceType,
    Observation,
    ObservationMetadata,
    SkyRegion,
)
from app.services.irsa_client import IRSAClient, irsa_client

logger = get_logger(__name__)


class SPHERExDataManager:
    """
    Manages SPHEREx observation data products with transparent fallback to demo data.
    Provides regional spatial queries, frame retrieval, and synthetic FITS/array generation.
    """

    def __init__(self, irsa_client_instance: Optional[IRSAClient] = None) -> None:
        self.irsa: IRSAClient = irsa_client_instance or irsa_client
        self._demo_generator = None

    def _get_demo_generator(self):
        """Lazy load DemoDataGenerator to prevent cyclic imports."""
        if self._demo_generator is None:
            from app.services.demo_data import demo_data
            self._demo_generator = demo_data
        return self._demo_generator

    # ------------------------------------------------------------------------
    # Availability Inspection
    # ------------------------------------------------------------------------

    async def check_data_availability(self) -> Dict[str, Any]:
        """
        Check what SPHEREx data products are available on IRSA TAP.
        Returns product catalogs, schema tables, and demo fallback state.
        """
        cache_key = "spherex_data_availability_status"
        cached = observation_cache.get(cache_key)
        if cached is not None:
            return cached

        tables = await self.irsa.get_available_tables()
        has_real = any(not t.get("is_simulated", True) for t in tables)

        status_payload = {
            "mission": "SPHEREx",
            "full_name": "Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer",
            "agency": "NASA / JPL / Caltech",
            "spectral_bands": 6,
            "wavelength_coverage_um": "0.75 - 5.00",
            "spatial_resolution_arcsec": 6.2,
            "real_data_available": has_real,
            "fallback_to_demo": not has_real or settings.DEMO_MODE,
            "tables": tables,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        observation_cache.set(cache_key, status_payload)
        return status_payload

    # ------------------------------------------------------------------------
    # Region Observation Retrieval
    # ------------------------------------------------------------------------

    async def get_observations_for_region(
        self,
        ra: float,
        dec: float,
        radius: float,
        band: Optional[str] = None,
    ) -> List[Observation]:
        """
        Get observation frames covering a sky position (ra, dec, radius).
        Attempts query against IRSA TAP first; falls back to multi-epoch demo data.
        Filters by instrument spectral band if specified.
        """
        band_tag = band.lower().replace(" ", "_") if band else "all"
        cache_key = f"spherex_obs_region:{ra:.3f}:{dec:.3f}:{radius:.3f}:{band_tag}"
        cached = observation_cache.get(cache_key)
        if cached is not None:
            return cached

        observations: List[Observation] = []

        # Attempt live query if not strictly forced into demo mode
        if not settings.DEMO_MODE:
            try:
                sources = await self.irsa.search_spherex_sources(ra, dec, radius)
                if sources and not any(s.get("is_simulated", True) for s in sources):
                    # Wrap real records in Observation model
                    now = datetime.now(timezone.utc)
                    obs = Observation(
                        id=f"SPHEREX_IRSA_{int(ra)}_{int(dec)}",
                        timestamp=now,
                        ra=ra,
                        dec=dec,
                        band=band or "Band 1",
                        source="NASA SPHEREx / IRSA TAP",
                        wavelength_um=0.93,
                        exposure_time=150.0,
                        metadata={
                            "source_count": len(sources),
                            "instrument": "SPHEREx",
                            "quality_flag": "NOMINAL",
                            "is_simulated": False,
                        },
                        is_simulated=False,
                    )
                    observations.append(obs)
            except Exception as exc:
                logger.warning(f"Error querying live IRSA TAP observations: {exc}")

        # Fallback to simulated multi-epoch observations
        if not observations:
            generator = self._get_demo_generator()
            region = SkyRegion(
                id=f"region_query_{int(ra)}_{int(dec)}",
                ra=ra,
                dec=dec,
                radius=radius,
                name=f"Survey Field ({ra:.2f}, {dec:.2f})",
                is_simulated=True,
            )
            bands_param = [band] if band else None
            observations = generator.generate_observations(region, n_epochs=5, bands=bands_param)

        # Apply band filter if requested
        if band:
            b_clean = band.lower().replace(" ", "")
            observations = [
                obs for obs in observations
                if obs.band.lower().replace(" ", "") == b_clean
                or (obs.metadata and str(obs.metadata.get("band_code", "")).lower() == b_clean)
            ]

        observation_cache.set(cache_key, observations)
        return observations

    # ------------------------------------------------------------------------
    # Single Observation Retrieval
    # ------------------------------------------------------------------------

    async def get_observation_by_id(self, obs_id: str) -> Optional[Observation]:
        """Get single observation frame by its identifier."""
        clean_id = obs_id.strip()
        cached = observation_cache.get(f"obs_by_id:{clean_id}")
        if cached is not None:
            return cached

        # Check demo generator cache
        generator = self._get_demo_generator()
        obs = generator.get_demo_observation_by_id(clean_id)
        if obs:
            observation_cache.set(f"obs_by_id:{clean_id}", obs)
            return obs

        # Query metadata from IRSA client
        meta = await self.irsa.get_observation_metadata(clean_id)
        if meta:
            obs = Observation(
                id=clean_id,
                timestamp=datetime.now(timezone.utc),
                ra=meta.get("crval1", 83.822),
                dec=meta.get("crval2", -5.391),
                band=meta.get("band", "Band 1"),
                source=meta.get("source", "SPHEREx Archive"),
                wavelength_um=meta.get("wavelength_um", 0.93),
                exposure_time=meta.get("exposure_time_sec", 140.0),
                metadata=meta,
                is_simulated=meta.get("is_simulated", True),
            )
            observation_cache.set(f"obs_by_id:{clean_id}", obs)
            return obs

        return None

    # ------------------------------------------------------------------------
    # Image Synthesis & Generation
    # ------------------------------------------------------------------------

    async def get_observation_image(self, obs_id: str) -> np.ndarray:
        """
        Get 2D float32 image array for an observation frame.
        In demo mode or when raw FITS data is not archived, generates
        a realistic synthetic star field with Gaussian PSFs and Poisson noise.
        """
        obs = await self.get_observation_by_id(obs_id)
        if not obs:
            # Create transient observation object to drive synthetic generation
            obs = Observation(
                id=obs_id,
                timestamp=datetime.now(timezone.utc),
                ra=83.822,
                dec=-5.391,
                band="Band 1",
                source="SPHEREx (Simulated)",
                wavelength_um=0.93,
                is_simulated=True,
            )

        return self._generate_demo_image(obs)

    def _generate_demo_image(self, obs: Observation) -> np.ndarray:
        """
        Generate a realistic synthetic astronomical image array (512x512 pixels).
        - Fixed stationary star positions tied to sky coordinates (ra, dec).
        - Distinct epoch-dependent shift for moving candidate object.
        - Realistic Poisson sky background + Gaussian detector read noise.
        """
        generator = self._get_demo_generator()

        # Seed static star field based on sky pointing so static stars align across epochs
        coord_key = f"{obs.ra:.3f}_{obs.dec:.3f}"
        region_seed = int(hashlib.md5(coord_key.encode()).hexdigest()[:8], 16) % (2**31 - 1)

        # Determine epoch index from metadata or observation id
        epoch_idx = 1
        if obs.metadata and "epoch_index" in obs.metadata:
            epoch_idx = int(obs.metadata["epoch_index"])
        else:
            match = re.search(r"(\d+)_B\d", obs.id)
            if match:
                epoch_idx = int(match.group(1))

        # Generate base field: stationary stars match region_seed, moving object advances with epoch_idx
        image, _ = generator.generate_star_field(
            n_stars=180,
            size=512,
            moving_objects=1,
            seed=region_seed,
            epoch_index=epoch_idx,
        )

        # Add independent frame read noise so multi-epoch subtraction is physically realistic
        frame_seed = int(hashlib.md5(obs.id.encode()).hexdigest()[:8], 16) % (2**31 - 1)
        frame_rng = np.random.RandomState(frame_seed)
        extra_read_noise = frame_rng.normal(loc=0.0, scale=3.5, size=image.shape).astype(np.float32)

        return (image + extra_read_noise).astype(np.float32)


# Default singleton instance
spherex_data = SPHERExDataManager()
