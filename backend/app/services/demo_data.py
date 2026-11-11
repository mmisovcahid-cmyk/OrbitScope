"""
OrbitScope - Demo & Simulation Data Generator
=============================================
Generates realistic, scientifically grounded, but CLEARLY LABELED simulated astronomical data.
All synthesized observations, catalogs, and moving source tracks have is_simulated=True.
Provides multi-epoch SPHEREx observations, realistic star field images with Poisson noise
and Gaussian PSFs, extreme TNO dynamical targets, and bilingual (EN/AZ) region descriptions.
"""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

from app.core.logging_config import get_logger
from app.models.schemas import (
    CatalogObject,
    CloseApproach,
    Locale,
    Observation,
    ObservationMetadata,
    OrbitalElements,
    PhysicalParams,
    SkyRegion,
)

logger = get_logger(__name__)

# SPHEREx 6 Nominal Spectral Bands (0.75 um - 5.00 um)
SPHEREX_BANDS = [
    {"name": "Band 1", "code": "B1", "wavelength_um": 0.93, "range": "0.75-1.11 um", "regime": "NIR"},
    {"name": "Band 2", "code": "B2", "wavelength_um": 1.38, "range": "1.11-1.64 um", "regime": "NIR"},
    {"name": "Band 3", "code": "B3", "wavelength_um": 2.03, "range": "1.64-2.42 um", "regime": "SWIR"},
    {"name": "Band 4", "code": "B4", "wavelength_um": 3.12, "range": "2.42-3.82 um", "regime": "MWIR"},
    {"name": "Band 5", "code": "B5", "wavelength_um": 4.12, "range": "3.82-4.42 um", "regime": "MWIR"},
    {"name": "Band 6", "code": "B6", "wavelength_um": 4.71, "range": "4.42-5.00 um", "regime": "MWIR"},
]


class DemoDataGenerator:
    """
    Generates realistic, scientifically validated demonstration data for OrbitScope.
    Every entity produced by this generator explicitly sets is_simulated=True.
    """

    # Pre-defined scientifically motivated sky regions
    DEMO_REGIONS: List[SkyRegion] = [
        SkyRegion(
            id="region_taurus_auriga_p9",
            ra=52.5,
            dec=18.2,
            radius=2.5,
            name="Planet X Predicted Aphelion (Taurus-Auriga)",
            description="Theoretical high-probability search region in Taurus-Auriga near the predicted Planet Nine aphelion (Batygin & Brown 2016, 2021).",
            descriptions={
                "en": "Theoretical high-probability search region in Taurus-Auriga near the predicted Planet Nine aphelion (Batygin & Brown 2016, 2021).",
                "az": "Buğa-Ərabaçı bürclərində Doqquzuncu Planetin proqnozlaşdırılan afeli yaxınlığındakı nəzəri yüksək ehtimallı axtarış bölgəsi (Batygin və Brown 2016, 2021).",
            },
            is_simulated=True,
        ),
        SkyRegion(
            id="region_cetus_eridanus_node",
            ra=38.0,
            dec=-8.5,
            radius=2.0,
            name="Cetus-Eridanus Orbital Plane Node",
            description="Secondary search sector along the hypothesized extreme trans-Neptunian orbital plane node crossing.",
            descriptions={
                "en": "Secondary search sector along the hypothesized extreme trans-Neptunian orbital plane node crossing.",
                "az": "Fərz edilən ekstrim trans-Neptun orbital müstəvisinin kəsişmə düyünü boyunca ikinci dərəcəli axtarış sektoru.",
            },
            is_simulated=True,
        ),
        SkyRegion(
            id="region_north_ecliptic_pole",
            ra=270.0,
            dec=66.5,
            radius=1.5,
            name="North Ecliptic Pole Continuous Viewing Zone",
            description="SPHEREx deep survey field at the North Ecliptic Pole with maximum temporal cadence and deep multi-epoch coadds.",
            descriptions={
                "en": "SPHEREx deep survey field at the North Ecliptic Pole with maximum temporal cadence and deep multi-epoch coadds.",
                "az": "Maksimum zaman tezliyi və dərin çoxsaylı epoxa yığımı ilə Şimal Ekliptik Qütbündə SPHEREx dərin tədqiqat sahəsi.",
            },
            is_simulated=True,
        ),
        SkyRegion(
            id="region_south_ecliptic_pole",
            ra=90.0,
            dec=-66.5,
            radius=1.5,
            name="South Ecliptic Pole Deep Survey Field",
            description="High-cadence deep survey sector at the South Ecliptic Pole optimized for time-domain infrared transients and moving objects.",
            descriptions={
                "en": "High-cadence deep survey sector at the South Ecliptic Pole optimized for time-domain infrared transients and moving objects.",
                "az": "Zaman sahəsində infraqırmızı qısamüddətli hadisələr və hərəkət edən cisimlər üçün Cənub Ekliptik Qütbündə yüksək tezlikli dərin axtarış sektoru.",
            },
            is_simulated=True,
        ),
        SkyRegion(
            id="region_kuiper_belt_sagittarius",
            ra=285.0,
            dec=-22.0,
            radius=2.0,
            name="Kuiper Belt Dense Sector (Sagittarius)",
            description="Ecliptic plane crossing field in Sagittarius with high density of classical, resonant, and scattered Kuiper Belt Objects.",
            descriptions={
                "en": "Ecliptic plane crossing field in Sagittarius with high density of classical, resonant, and scattered Kuiper Belt Objects.",
                "az": "Klassik, rezonans və səpələnmiş Koyper Qurşağı Cisimlərinin yüksək sıxlığı ilə Oxatan bürcündə ekliptik müstəvi kəsişmə sahəsi.",
            },
            is_simulated=True,
        ),
        SkyRegion(
            id="region_orion_molecular_cloud",
            ra=83.822,
            dec=-5.391,
            radius=1.5,
            name="Orion Calibration & Reference Field",
            description="Standard astronomical calibration and young stellar object reference region in the Orion molecular cloud complex.",
            descriptions={
                "en": "Standard astronomical calibration and young stellar object reference region in the Orion molecular cloud complex.",
                "az": "Orion molekulyar bulud kompleksində standart astronomik kalibrləmə və gənc ulduz obyektləri üçün istinad bölgəsi.",
            },
            is_simulated=True,
        ),
    ]

    def __init__(self) -> None:
        self._observations_cache: Dict[str, Observation] = {}
        # Pre-populate catalog with baseline multi-epoch observations for primary demo regions
        for reg in self.DEMO_REGIONS:
            self.generate_observations(reg, n_epochs=5)

    # ------------------------------------------------------------------------
    # Sky Region Queries
    # ------------------------------------------------------------------------

    def get_demo_regions(self) -> List[SkyRegion]:
        """Return predefined demo sky regions with full bilingual English/Azerbaijani descriptions."""
        return list(self.DEMO_REGIONS)

    # ------------------------------------------------------------------------
    # Observation Generation
    # ------------------------------------------------------------------------

    def generate_observations(
        self,
        region: Union[SkyRegion, float],
        n_epochs: Union[int, float] = 5,
        bands: Optional[Union[List[str], float]] = None,
    ) -> List[Observation]:
        """
        Generate multi-epoch observations for a sky region.
        Accepts either a SkyRegion object or (ra: float, dec: float, radius: float).
        All returned observations have is_simulated=True.
        """
        # Support flexible positional arguments for compatibility with various route callers
        if isinstance(region, (int, float)):
            ra_val = float(region)
            dec_val = float(n_epochs)
            rad_val = float(bands) if isinstance(bands, (int, float)) else 1.5
            region_obj = SkyRegion(
                id=f"region_custom_{int(ra_val)}_{int(dec_val)}",
                ra=ra_val,
                dec=dec_val,
                radius=rad_val,
                name=f"Custom Field ({ra_val:.1f}, {dec_val:.1f})",
                is_simulated=True,
            )
            epochs_count = 5
            requested_bands: Optional[List[str]] = None
        else:
            region_obj = region
            epochs_count = int(n_epochs) if isinstance(n_epochs, (int, float)) else 5
            requested_bands = bands if isinstance(bands, list) else None

        # Filter bands
        band_configs = SPHEREX_BANDS
        if requested_bands:
            band_configs = [
                b for b in SPHEREX_BANDS
                if b["name"].lower() in [rb.lower() for rb in requested_bands]
                or b["code"].lower() in [rb.lower() for rb in requested_bands]
            ]
            if not band_configs:
                band_configs = SPHEREX_BANDS

        # Base timestamp: starting 90 days ago with realistic cadence (e.g. 0, 7, 14, 30, 60 days)
        base_time = datetime.now(timezone.utc) - timedelta(days=90)
        time_offsets_days = [0, 7, 14, 30, 60, 90, 120]

        generated: List[Observation] = []
        region_slug = getattr(region_obj, "id", None) or f"R{int(region_obj.ra)}_{int(region_obj.dec)}"

        for epoch_idx in range(epochs_count):
            day_offset = time_offsets_days[epoch_idx] if epoch_idx < len(time_offsets_days) else epoch_idx * 15
            epoch_time = base_time + timedelta(days=day_offset, hours=epoch_idx * 2)

            for b_cfg in band_configs:
                obs_id = f"SPHEREX_SIM_{region_slug}_{epoch_idx+1}_{b_cfg['code']}"

                obs = Observation(
                    id=obs_id,
                    timestamp=epoch_time,
                    ra=region_obj.ra,
                    dec=region_obj.dec,
                    band=b_cfg["name"],
                    source="SPHEREx (Simulated)",
                    exposure_time=150.0,
                    wavelength_um=b_cfg["wavelength_um"],
                    metadata={
                        "instrument": "SPHEREx",
                        "band_name": b_cfg["name"],
                        "band_code": b_cfg["code"],
                        "wavelength_um": b_cfg["wavelength_um"],
                        "spectral_range": b_cfg["range"],
                        "spectral_regime": b_cfg["regime"],
                        "pixel_scale_arcsec": 6.2,
                        "limiting_magnitude": 22.4,
                        "epoch_index": epoch_idx + 1,
                        "quality_flag": "NOMINAL",
                        "is_simulated": True,
                        "description": f"Simulated SPHEREx observation at epoch {epoch_idx+1} ({b_cfg['name']})",
                    },
                    is_simulated=True,
                )

                self._observations_cache[obs_id] = obs
                generated.append(obs)

        return generated

    def get_demo_observation_by_id(self, obs_id: str) -> Optional[Observation]:
        """Retrieve a specific demo observation by its identifier."""
        if obs_id in self._observations_cache:
            return self._observations_cache[obs_id]

        # Dynamically generate deterministic observation if ID matches naming convention
        parts = obs_id.split("_")
        epoch_num = 1
        band_str = "Band 1"
        wave = 0.93

        for b in SPHEREX_BANDS:
            if b["code"] in parts or b["name"].replace(" ", "") in obs_id:
                band_str = b["name"]
                wave = b["wavelength_um"]
                break

        obs = Observation(
            id=obs_id,
            timestamp=datetime.now(timezone.utc) - timedelta(days=30),
            ra=83.822,
            dec=-5.391,
            band=band_str,
            source="SPHEREx (Simulated)",
            exposure_time=150.0,
            wavelength_um=wave,
            metadata={
                "instrument": "SPHEREx",
                "band_name": band_str,
                "wavelength_um": wave,
                "pixel_scale_arcsec": 6.2,
                "quality_flag": "NOMINAL",
                "is_simulated": True,
            },
            is_simulated=True,
        )
        self._observations_cache[obs_id] = obs
        return obs

    # ------------------------------------------------------------------------
    # Star Field & Moving Object Image Synthesis
    # ------------------------------------------------------------------------

    def generate_star_field(
        self,
        n_stars: int = 200,
        size: int = 512,
        moving_objects: int = 1,
        seed: Optional[int] = None,
        epoch_index: int = 1,
    ) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Generate a synthetic astronomical star field image with realistic noise and sources.
        Returns (image_array: np.ndarray, source_catalog: list[dict]).
        - Dimensions: size x size (e.g. 512x512 pixels).
        - Sky background: mean ~500.0 ADU with Poisson noise and Gaussian read noise.
        - Stars: Gaussian PSF (sigma ~ 1.3 px, FWHM ~ 3.0 px) following realistic power-law fluxes.
        - Moving objects: Optional simulated slow-moving TNO with proper motion displacement.
        """
        rng = np.random.RandomState(seed if seed is not None else 42)

        # Baseline background and noise model
        bg_mean = 520.0
        read_noise_sigma = 4.2  # ADU

        # Generate base Poisson background + detector Gaussian read noise
        poisson_bg = rng.poisson(lam=bg_mean, size=(size, size)).astype(np.float32)
        gaussian_rn = rng.normal(loc=0.0, scale=read_noise_sigma, size=(size, size)).astype(np.float32)
        image = poisson_bg + gaussian_rn

        source_catalog: List[Dict[str, Any]] = []

        # Stellar luminosity distribution (power-law: many faint stars, few bright stars)
        margin = 16
        xs = rng.uniform(margin, size - margin, size=n_stars)
        ys = rng.uniform(margin, size - margin, size=n_stars)

        # Magnitudes distributed between 14.0 (bright) and 22.0 (faint limit)
        mags = 14.0 + 8.0 * (rng.uniform(0.0, 1.0, size=n_stars) ** 0.4)
        fluxes = 10.0 ** ((22.5 - mags) / 2.5) * 450.0  # Peak flux in ADU

        psf_sigma = 1.30  # pixels
        cutout_radius = 8

        # Inject stationary stars
        for i in range(n_stars):
            x0, y0 = xs[i], ys[i]
            peak_flux = fluxes[i]

            x_min = max(0, int(round(x0)) - cutout_radius)
            x_max = min(size, int(round(x0)) + cutout_radius + 1)
            y_min = max(0, int(round(y0)) - cutout_radius)
            y_max = min(size, int(round(y0)) + cutout_radius + 1)

            yy, xx = np.meshgrid(np.arange(y_min, y_max), np.arange(x_min, x_max), indexing="ij")
            r2 = (xx - x0) ** 2 + (yy - y0) ** 2
            psf_patch = peak_flux * np.exp(-0.5 * r2 / (psf_sigma ** 2))

            image[y_min:y_max, x_min:x_max] += psf_patch.astype(np.float32)

            source_catalog.append(
                {
                    "source_id": f"STAR_{i+1:04d}",
                    "x": float(x0),
                    "y": float(y0),
                    "flux": float(peak_flux),
                    "mag": float(mags[i]),
                    "snr": float(peak_flux / (math.sqrt(bg_mean + peak_flux) + read_noise_sigma)),
                    "is_moving": False,
                    "is_simulated": True,
                }
            )

        # Inject moving objects (e.g. Extreme TNO candidate)
        for m in range(moving_objects):
            # Compute epoch-dependent position shift (e.g. 3.5 pixels per epoch)
            base_mx = size * 0.45 + m * 80.0
            base_my = size * 0.55 - m * 50.0
            dx_per_epoch = 3.6  # pixels
            dy_per_epoch = -1.2  # pixels

            mx = base_mx + (epoch_index - 1) * dx_per_epoch
            my = base_my + (epoch_index - 1) * dy_per_epoch
            moving_flux = 3200.0  # Apparent mag ~ 21.2
            moving_mag = 21.2

            x_min = max(0, int(round(mx)) - cutout_radius)
            x_max = min(size, int(round(mx)) + cutout_radius + 1)
            y_min = max(0, int(round(my)) - cutout_radius)
            y_max = min(size, int(round(my)) + cutout_radius + 1)

            yy, xx = np.meshgrid(np.arange(y_min, y_max), np.arange(x_min, x_max), indexing="ij")
            r2 = (xx - mx) ** 2 + (yy - my) ** 2
            psf_patch = moving_flux * np.exp(-0.5 * r2 / (psf_sigma ** 2))

            image[y_min:y_max, x_min:x_max] += psf_patch.astype(np.float32)

            source_catalog.append(
                {
                    "source_id": f"CAND_TNO_SIM_{m+1}",
                    "x": float(mx),
                    "y": float(my),
                    "flux": float(moving_flux),
                    "mag": moving_mag,
                    "snr": float(moving_flux / (math.sqrt(bg_mean + moving_flux) + read_noise_sigma)),
                    "is_moving": True,
                    "proper_motion_pix_per_epoch": math.sqrt(dx_per_epoch ** 2 + dy_per_epoch ** 2),
                    "is_simulated": True,
                }
            )

        return image, source_catalog

    # ------------------------------------------------------------------------
    # Moving Object Dynamics Simulation
    # ------------------------------------------------------------------------

    def generate_moving_object(
        self,
        epoch1: datetime,
        epoch2: datetime,
    ) -> Dict[str, Any]:
        """
        Generate a simulated moving object track with realistic outer solar system (TNO) kinematics.
        Computes apparent angular displacement, position angle, and velocities over baseline.
        """
        delta_seconds = abs((epoch2 - epoch1).total_seconds())
        delta_days = max(delta_seconds / 86400.0, 1e-4)

        # Typical extreme TNO apparent proper motion at opposition:
        # Reflex motion causes retrograde shift of ~1.5 to 3.5 arcsec/day in RA
        rate_ra_arcsec_day = -2.45
        rate_dec_arcsec_day = 0.58

        disp_ra = rate_ra_arcsec_day * delta_days
        disp_dec = rate_dec_arcsec_day * delta_days
        total_displacement_arcsec = math.sqrt(disp_ra ** 2 + disp_dec ** 2)

        # Position angle from North toward East [0, 360)
        pa_rad = math.atan2(disp_ra, disp_dec)
        position_angle_deg = math.degrees(pa_rad) % 360.0

        apparent_velocity_arcsec_per_day = total_displacement_arcsec / delta_days

        return {
            "name": "[SIMULATED] Trans-Neptunian Candidate Track",
            "time_interval_days": round(delta_days, 3),
            "rate_ra_arcsec_day": round(rate_ra_arcsec_day, 4),
            "rate_dec_arcsec_day": round(rate_dec_arcsec_day, 4),
            "displacement_arcsec": round(total_displacement_arcsec, 3),
            "position_angle_deg": round(position_angle_deg, 2),
            "apparent_velocity_arcsec_per_day": round(apparent_velocity_arcsec_per_day, 3),
            "magnitude_estimate": 21.8,
            "flux_epoch1": 3450.0,
            "flux_epoch2": 3390.0,
            "flux_ratio": 1.018,
            "snr": 16.4,
            "classification": "Extreme TNO Candidate",
            "confidence": 0.92,
            "is_simulated": True,
        }

    # ------------------------------------------------------------------------
    # Known Benchmark Test Objects
    # ------------------------------------------------------------------------

    def generate_known_test_objects(self) -> List[CatalogObject]:
        """
        Generate test catalog objects for algorithm calibration and verification.
        Includes high-perihelion sednoids, extreme TNOs, resonant KBOs, and near-Earth asteroids.
        All returned models explicitly set is_simulated=True.
        """
        return [
            CatalogObject(
                designation="SIM-90377",
                name="[SIMULATED] 90377 Sedna Analog",
                object_type="tno",
                orbit_class="Detached Sednoid",
                orbital_elements=OrbitalElements(
                    semi_major_axis_au=506.0,
                    eccentricity=0.855,
                    inclination_deg=11.93,
                    longitude_asc_node_deg=144.5,
                    argument_perihelion_deg=311.4,
                    mean_anomaly_deg=358.1,
                    perihelion_dist_au=76.2,
                    aphelion_dist_au=936.0,
                    orbital_period_years=11400.0,
                ),
                physical_params=PhysicalParams(
                    diameter_km=995.0,
                    albedo=0.32,
                    abs_magnitude=1.5,
                    rotation_period_hours=10.27,
                ),
                semi_major_axis_au=506.0,
                eccentricity=0.855,
                inclination_deg=11.93,
                perihelion_au=76.2,
                aphelion_au=936.0,
                period_yr=11400.0,
                absolute_magnitude=1.5,
                diameter_km=995.0,
                albedo=0.32,
                data_source="OrbitScope Simulated Catalog",
                is_simulated=True,
            ),
            CatalogObject(
                designation="SIM-2012VP113",
                name="[SIMULATED] 2012 VP113 Analog (Biden)",
                object_type="tno",
                orbit_class="Sednoid",
                orbital_elements=OrbitalElements(
                    semi_major_axis_au=263.0,
                    eccentricity=0.69,
                    inclination_deg=24.05,
                    longitude_asc_node_deg=90.8,
                    argument_perihelion_deg=293.8,
                    perihelion_dist_au=80.5,
                    aphelion_dist_au=445.0,
                    orbital_period_years=4270.0,
                ),
                physical_params=PhysicalParams(
                    diameter_km=450.0,
                    albedo=0.10,
                    abs_magnitude=4.0,
                ),
                semi_major_axis_au=263.0,
                eccentricity=0.69,
                inclination_deg=24.05,
                perihelion_au=80.5,
                aphelion_au=445.0,
                period_yr=4270.0,
                absolute_magnitude=4.0,
                diameter_km=450.0,
                albedo=0.10,
                data_source="OrbitScope Simulated Catalog",
                is_simulated=True,
            ),
            CatalogObject(
                designation="SIM-2015TG387",
                name="[SIMULATED] 2015 TG387 Analog (The Goblin)",
                object_type="tno",
                orbit_class="Extreme Sednoid",
                orbital_elements=OrbitalElements(
                    semi_major_axis_au=1094.0,
                    eccentricity=0.94,
                    inclination_deg=11.66,
                    perihelion_dist_au=65.0,
                    aphelion_dist_au=2123.0,
                    orbital_period_years=36200.0,
                ),
                physical_params=PhysicalParams(
                    diameter_km=300.0,
                    albedo=0.08,
                    abs_magnitude=5.3,
                ),
                semi_major_axis_au=1094.0,
                eccentricity=0.94,
                inclination_deg=11.66,
                perihelion_au=65.0,
                aphelion_au=2123.0,
                period_yr=36200.0,
                absolute_magnitude=5.3,
                diameter_km=300.0,
                albedo=0.08,
                data_source="OrbitScope Simulated Catalog",
                is_simulated=True,
            ),
            CatalogObject(
                designation="SIM-P9-HYPOTHESIS",
                name="[SIMULATED] Planet Nine Batygin & Brown (2021) Nominal Orbit",
                object_type="tno",
                orbit_class="Hypothetical Major Planet",
                orbital_elements=OrbitalElements(
                    semi_major_axis_au=380.0,
                    eccentricity=0.45,
                    inclination_deg=16.0,
                    perihelion_dist_au=210.0,
                    aphelion_dist_au=550.0,
                    orbital_period_years=7400.0,
                ),
                physical_params=PhysicalParams(
                    diameter_km=28000.0,
                    abs_magnitude=21.5,
                ),
                semi_major_axis_au=380.0,
                eccentricity=0.45,
                inclination_deg=16.0,
                perihelion_au=210.0,
                aphelion_au=550.0,
                period_yr=7400.0,
                absolute_magnitude=21.5,
                diameter_km=28000.0,
                data_source="OrbitScope Hypothesis Model",
                is_simulated=True,
            ),
            CatalogObject(
                designation="SIM-CERES-TEST",
                name="[SIMULATED] 1 Ceres Benchmark Analog",
                object_type="asteroid",
                orbit_class="Main-belt Asteroid",
                orbital_elements=OrbitalElements(
                    semi_major_axis_au=2.767,
                    eccentricity=0.076,
                    inclination_deg=10.59,
                    perihelion_dist_au=2.557,
                    aphelion_dist_au=2.977,
                    orbital_period_years=4.60,
                ),
                physical_params=PhysicalParams(
                    diameter_km=939.4,
                    albedo=0.09,
                    abs_magnitude=3.34,
                ),
                semi_major_axis_au=2.767,
                eccentricity=0.076,
                inclination_deg=10.59,
                perihelion_au=2.557,
                aphelion_au=2.977,
                period_yr=4.60,
                absolute_magnitude=3.34,
                diameter_km=939.4,
                albedo=0.09,
                data_source="OrbitScope Simulated Catalog",
                is_simulated=True,
            ),
            CatalogObject(
                designation="SIM-NEA-FAST-01",
                name="[SIMULATED] Near-Earth Asteroid Fast Mover",
                object_type="neo",
                orbit_class="Apollo Asteroid",
                orbital_elements=OrbitalElements(
                    semi_major_axis_au=1.45,
                    eccentricity=0.48,
                    inclination_deg=8.4,
                    perihelion_dist_au=0.75,
                    aphelion_dist_au=2.15,
                    orbital_period_years=1.75,
                ),
                physical_params=PhysicalParams(
                    diameter_km=0.35,
                    albedo=0.18,
                    abs_magnitude=19.8,
                ),
                semi_major_axis_au=1.45,
                eccentricity=0.48,
                inclination_deg=8.4,
                perihelion_au=0.75,
                aphelion_au=2.15,
                period_yr=1.75,
                absolute_magnitude=19.8,
                diameter_km=0.35,
                albedo=0.18,
                is_neo=True,
                data_source="OrbitScope Simulated Catalog",
                is_simulated=True,
            ),
        ]


# Default singleton instance
demo_data = DemoDataGenerator()
