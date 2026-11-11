"""
OrbitScope Astronomical Data Models & API Schemas
=================================================
Pydantic v2 schemas defining domain entities, pipeline requests/responses,
astronomical source measurements, orbital ephemerides, and i18n messaging
supporting English (EN) and Azerbaijani (AZ).
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

T = TypeVar("T")


# ============================================================================
# Enums
# ============================================================================

class Locale(str, enum.Enum):
    """Supported localization languages across API endpoints."""
    EN = "en"
    AZ = "az"


class DetectionStatus(str, enum.Enum):
    """Classification status for detected astronomical sources."""
    KNOWN_OBJECT = "known_object"
    CANDIDATE = "candidate"
    UNMATCHED = "unmatched"
    POSSIBLE_ARTIFACT = "possible_artifact"
    NEEDS_VERIFICATION = "needs_verification"


class DataSourceType(str, enum.Enum):
    """Origin data repository or mission provider."""
    SPHEREX = "spherex"
    IRSA = "irsa"
    JPL_SBDB = "jpl_sbdb"
    JPL_HORIZONS = "jpl_horizons"
    SIMULATED = "simulated"
    OTHER = "other"


class PipelineStage(str, enum.Enum):
    """Discrete execution stages in the astronomical processing pipeline."""
    PREPROCESSING = "preprocessing"
    ALIGNMENT = "alignment"
    SUBTRACTION = "subtraction"
    DETECTION = "detection"
    MEASUREMENT = "measurement"
    CROSS_MATCH = "cross_match"
    ANOMALY_DETECTION = "anomaly_detection"
    COMPLETE = "complete"


# ============================================================================
# i18n Messaging System
# ============================================================================

I18N_MESSAGES: Dict[str, Dict[Locale, str]] = {
    "detection_success": {
        Locale.EN: "Detection pipeline executed successfully.",
        Locale.AZ: "Aşkarlama boru kəməri uğurla icra edildi.",
    },
    "detection_started": {
        Locale.EN: "Detection pipeline process initiated.",
        Locale.AZ: "Aşkarlama prosesi başladıldı.",
    },
    "comparison_success": {
        Locale.EN: "Observation comparison completed successfully.",
        Locale.AZ: "Müşahidələrin müqayisəsi uğurla tamamlandı.",
    },
    "catalog_search_success": {
        Locale.EN: "Catalog query returned matching celestial objects.",
        Locale.AZ: "Kataloq sorğusu uyğun səma cisimlərini qaytardı.",
    },
    "catalog_not_found": {
        Locale.EN: "No astronomical catalog objects matched the query.",
        Locale.AZ: "Sorğuya uyğun heç bir astronomik kataloq obyekti tapılmadı.",
    },
    "ephemeris_success": {
        Locale.EN: "JPL Horizons ephemeris generated successfully.",
        Locale.AZ: "JPL Horizons efemeridi uğurla tərtib edildi.",
    },
    "planet_x_success": {
        Locale.EN: "Theoretical Planet X orbital evidence and sky regions retrieved.",
        Locale.AZ: "Nəzəri Planet X orbital sübutları və səma bölgələri əldə edildi.",
    },
    "observation_retrieved": {
        Locale.EN: "Observation frame retrieved successfully.",
        Locale.AZ: "Müşahidə kadrı uğurla əldə edildi.",
    },
    "observation_not_found": {
        Locale.EN: "Specified observation frame was not found.",
        Locale.AZ: "Göstərilən müşahidə kadrı tapılmadı.",
    },
    "cache_cleared": {
        Locale.EN: "Internal cache was cleared successfully.",
        Locale.AZ: "Daxili keş uğurla təmizləndi.",
    },
    "invalid_request": {
        Locale.EN: "Invalid request parameters provided.",
        Locale.AZ: "Yanlış daxiletmə parametrləri təqdim edildi.",
    },
    "service_healthy": {
        Locale.EN: "OrbitScope backend service is operational and healthy.",
        Locale.AZ: "OrbitScope arxa sistemi tam işlək və saz vəziyyətdədir.",
    },
    "internal_error": {
        Locale.EN: "An internal server error occurred while processing the request.",
        Locale.AZ: "Sorğunun icrası zamanı daxili server xətası baş verdi.",
    },
}


def get_i18n_message(key: str, locale: Locale = Locale.EN, default: Optional[str] = None) -> str:
    """
    Retrieve a localized message for the given key and locale.
    Falls back to English if the localized translation is not found.

    Args:
        key: The message identifier key.
        locale: Target locale (Locale.EN or Locale.AZ).
        default: Fallback string if key is unregistered.

    Returns:
        str: Localized string message.
    """
    translations = I18N_MESSAGES.get(key)
    if translations:
        if locale in translations:
            return translations[locale]
        if Locale.EN in translations:
            return translations[Locale.EN]
    return default or key


# ============================================================================
# Coordinate & Sky Models
# ============================================================================

class Coordinates(BaseModel):
    """Equatorial coordinates on celestial sphere."""
    ra: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Right Ascension in degrees (J2000)",
        examples=[83.633],
    )
    dec: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Declination in degrees (J2000)",
        examples=[22.014],
    )
    epoch: Optional[str] = Field(
        default="J2000",
        description="Astrometric coordinate reference epoch",
    )
    fov_radius: Optional[float] = Field(
        default=None,
        gt=0.0,
        description="Optional field of view radius in degrees",
    )


class SkyRegion(BaseModel):
    """
    Spherical celestial coordinates defining a region of interest on the celestial sphere.
    """
    ra: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Right Ascension of center point in degrees (J2000)",
        examples=[45.5],
    )
    dec: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Declination of center point in degrees (J2000)",
        examples=[-12.3],
    )
    radius: float = Field(
        ...,
        gt=0.0,
        description="Search or coverage radius in degrees",
        examples=[2.5],
    )
    id: Optional[str] = Field(
        default=None,
        description="Unique identifier for the sky region",
        examples=["region_taurus_auriga_p9"],
    )
    is_simulated: bool = Field(
        default=False,
        description="Flag indicating whether this region is simulated",
    )
    name: Optional[str] = Field(
        default=None,
        description="Descriptive name or survey identifier for this region",
        examples=["Planet X Predicted Aphelion Sector A"],
    )
    description: Optional[str] = Field(
        default=None,
        description="Standard description of the region",
        examples=["Theoretical high-probability search region in Taurus-Auriga"],
    )
    descriptions: Dict[str, str] = Field(
        default_factory=dict,
        description="Localized descriptions mapping locale codes ('en', 'az') to text",
        examples=[{
            "en": "Theoretical high-probability search region in Taurus-Auriga",
            "az": "Buğa-Ərabaçı bürcündə yüksək ehtimallı nəzəri axtarış bölgəsi",
        }],
    )

    def get_description(self, locale: Locale = Locale.EN) -> Optional[str]:
        """Retrieve description in the requested locale if available."""
        if self.descriptions and locale.value in self.descriptions:
            return self.descriptions[locale.value]
        return self.description

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "ra": 45.5,
                "dec": -12.3,
                "radius": 2.5,
                "name": "Planet X Predicted Aphelion Sector A",
                "description": "Theoretical high-probability search region in Taurus-Auriga",
                "descriptions": {
                    "en": "Theoretical high-probability search region in Taurus-Auriga",
                    "az": "Buğa-Ərabaçı bürcündə yüksək ehtimallı nəzəri axtarış bölgəsi",
                },
            }
        }
    )


# ============================================================================
# Observation & Imaging Models
# ============================================================================

class ObservationMetadata(BaseModel):
    """Detailed instrument, detector, and observational telemetry."""
    instrument: Optional[str] = Field(default="SPHEREx", description="Telescope instrument name")
    filter_band: Optional[str] = Field(default=None, description="Spectral band designation")
    exptime_s: Optional[float] = Field(default=None, gt=0.0, description="Integration time in seconds")
    airmass: Optional[float] = Field(default=None, description="Airmass or space orientation factor")
    observer: Optional[str] = Field(default=None, description="Observing program or facility")
    extra: Dict[str, Any] = Field(default_factory=dict, description="Additional telemetry key-values")


class Observation(BaseModel):
    """
    A single astronomical observation frame (e.g., SPHEREx multi-band spectral exposure).
    """
    id: str = Field(
        ...,
        description="Unique identifier for the observation frame",
        examples=["SPHEREX_20260315_B1_0042"],
    )
    timestamp: datetime = Field(
        ...,
        description="UTC datetime when the observation was acquired",
        examples=["2026-03-15T14:32:00Z"],
    )
    ra: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Boresight pointing Right Ascension in degrees (J2000)",
        examples=[83.633],
    )
    dec: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Boresight pointing Declination in degrees (J2000)",
        examples=[22.014],
    )
    band: str = Field(
        ...,
        description="Instrument spectral band identifier (e.g. 'Band 1' [0.75-1.11 um])",
        examples=["Band 1"],
    )
    source: str = Field(
        ...,
        description="Data origin or instrument facility (e.g. 'SPHEREx', 'IRSA', 'Synthetic')",
        examples=["SPHEREx"],
    )
    exposure_time: Optional[float] = Field(
        default=None,
        gt=0.0,
        description="Effective integration time in seconds",
        examples=[120.0],
    )
    wavelength_um: Optional[float] = Field(
        default=None,
        gt=0.0,
        description="Nominal central band wavelength in micrometers",
        examples=[0.93],
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary instrument calibration, detector temperature, or WCS metadata",
        examples=[{"gain": 1.25, "read_noise": 4.2, "filter": "SPH-B1"}],
    )
    is_simulated: bool = Field(
        default=False,
        description="Flag indicating whether this observation was synthetically generated",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "SPHEREX_20260315_B1_0042",
                "timestamp": "2026-03-15T14:32:00Z",
                "ra": 83.633,
                "dec": 22.014,
                "band": "Band 1",
                "source": "SPHEREx",
                "exposure_time": 120.0,
                "wavelength_um": 0.93,
                "metadata": {"gain": 1.25, "read_noise": 4.2},
                "is_simulated": False,
            }
        }
    )


class ObservationImage(BaseModel):
    """Raster visual representation or cutout of an observation frame."""
    observation_id: str = Field(..., description="ID of the parent observation")
    width: int = Field(..., ge=1, description="Width in pixels")
    height: int = Field(..., ge=1, description="Height in pixels")
    channels: int = Field(default=1, ge=1, description="Number of channels (1=grayscale, 3=RGB)")
    format: str = Field(default="png", description="Image encoding format ('png', 'jpeg', 'fits')")
    base64_data: Optional[str] = Field(default=None, description="Base64-encoded image string")
    url: Optional[str] = Field(default=None, description="Download or streaming URL")
    min_val: Optional[float] = Field(default=None, description="Minimum pixel intensity value")
    max_val: Optional[float] = Field(default=None, description="Maximum pixel intensity value")


# ============================================================================
# Photometry, Astrometry & Detection Candidates
# ============================================================================

class SourceMeasurement(BaseModel):
    """
    Photometric and astrometric extraction measurement of a detected source on a single frame.
    """
    x: float = Field(
        ...,
        description="Sub-pixel X coordinate on the 2D detector array",
        examples=[512.45],
    )
    y: float = Field(
        ...,
        description="Sub-pixel Y coordinate on the 2D detector array",
        examples=[480.12],
    )
    ra: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Right Ascension in degrees (J2000) derived from WCS calibration",
        examples=[83.6421],
    )
    dec: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Declination in degrees (J2000) derived from WCS calibration",
        examples=[22.0189],
    )
    flux: float = Field(
        ...,
        description="Aperture or PSF-fitted flux in instrumental ADU or photo-electrons",
        examples=[18420.5],
    )
    flux_err: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="1-sigma uncertainty associated with the flux measurement",
        examples=[135.2],
    )
    snr: float = Field(
        ...,
        description="Signal-to-noise ratio of the source detection",
        examples=[15.8],
    )
    fwhm: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Full Width at Half Maximum of the spatial PSF profile in pixels",
        examples=[2.85],
    )
    elongation: Optional[float] = Field(
        default=None,
        ge=1.0,
        description="Morphological elongation ratio (major axis / minor axis)",
        examples=[1.08],
    )
    sharpness: Optional[float] = Field(
        default=None,
        description="PSF sharpness parameter indicating point-source likeness",
        examples=[0.68],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "x": 512.45,
                "y": 480.12,
                "ra": 83.6421,
                "dec": 22.0189,
                "flux": 18420.5,
                "flux_err": 135.2,
                "snr": 15.8,
                "fwhm": 2.85,
                "elongation": 1.08,
                "sharpness": 0.68,
            }
        }
    )


class DetectionCandidate(BaseModel):
    """
    A moving object or transient candidate isolated by cross-matching temporal epochs.
    """
    id: str = Field(
        ...,
        description="Unique identifier for this candidate",
        examples=["CAND_20260315_001"],
    )
    status: DetectionStatus = Field(
        ...,
        description="Verification and categorization status",
        examples=[DetectionStatus.CANDIDATE],
    )
    ra: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Mean or latest Right Ascension in degrees (J2000)",
        examples=[83.6421],
    )
    dec: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Mean or latest Declination in degrees (J2000)",
        examples=[22.0189],
    )
    displacement_arcsec: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Total angular shift observed across epochs in arcseconds",
        examples=[7.42],
    )
    motion_ra: Optional[float] = Field(
        default=None,
        description="Apparent proper motion component in RA in arcsec/hr",
        examples=[1.85],
    )
    motion_dec: Optional[float] = Field(
        default=None,
        description="Apparent proper motion component in Dec in arcsec/hr",
        examples=[-0.92],
    )
    snr: float = Field(
        ...,
        description="Combined signal-to-noise ratio across detections",
        examples=[18.4],
    )
    magnitude_estimate: Optional[float] = Field(
        default=None,
        description="Estimated apparent calibrated magnitude",
        examples=[21.8],
    )
    measurements: List[SourceMeasurement] = Field(
        default_factory=list,
        description="Individual multi-epoch source detections forming this track",
    )
    classification: Optional[str] = Field(
        default=None,
        description="Dynamical or morphological classification",
        examples=["Extreme TNO Candidate"],
    )
    anomaly_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Machine learning anomaly score (higher implies more unusual motion/spectrum)",
        examples=[0.89],
    )
    provenance: Dict[str, Any] = Field(
        default_factory=dict,
        description="Algorithm lineage, pipeline version, and processing parameters",
        examples=[{"pipeline_version": "1.0.0", "algorithm": "DBSCAN+Kalman"}],
    )
    is_simulated: bool = Field(
        default=False,
        description="Flag indicating whether candidate was synthesized for simulation/testing",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when candidate was identified",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "CAND_20260315_001",
                "status": "candidate",
                "ra": 83.6421,
                "dec": 22.0189,
                "displacement_arcsec": 7.42,
                "motion_ra": 1.85,
                "motion_dec": -0.92,
                "snr": 18.4,
                "magnitude_estimate": 21.8,
                "measurements": [],
                "classification": "Extreme TNO Candidate",
                "anomaly_score": 0.89,
                "provenance": {"algorithm": "DBSCAN+Kalman"},
                "is_simulated": False,
                "created_at": "2026-03-15T15:00:00Z",
            }
        }
    )


# ============================================================================
# Orbital & Physical Characteristics
# ============================================================================

class OrbitalElements(BaseModel):
    """Keplerian osculating orbital elements."""
    semi_major_axis_au: Optional[float] = Field(default=None, description="Semi-major axis (a) in AU")
    eccentricity: Optional[float] = Field(default=None, ge=0.0, description="Eccentricity (e)")
    inclination_deg: Optional[float] = Field(default=None, ge=0.0, le=180.0, description="Inclination (i) in degrees")
    longitude_asc_node_deg: Optional[float] = Field(default=None, description="Longitude of ascending node (Omega) in degrees")
    argument_perihelion_deg: Optional[float] = Field(default=None, description="Argument of perihelion (omega) in degrees")
    mean_anomaly_deg: Optional[float] = Field(default=None, description="Mean anomaly (M) in degrees")
    perihelion_dist_au: Optional[float] = Field(default=None, ge=0.0, description="Perihelion distance (q) in AU")
    aphelion_dist_au: Optional[float] = Field(default=None, ge=0.0, description="Aphelion distance (Q) in AU")
    orbital_period_years: Optional[float] = Field(default=None, ge=0.0, description="Orbital period in Earth years")
    epoch_jd: Optional[float] = Field(default=None, description="Epoch of orbital elements in Julian Date")


class PhysicalParams(BaseModel):
    """Physical properties of small celestial bodies."""
    diameter_km: Optional[float] = Field(default=None, ge=0.0, description="Diameter in kilometers")
    albedo: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Geometric albedo")
    abs_magnitude: Optional[float] = Field(default=None, description="Absolute visual magnitude (H)")
    spectral_type: Optional[str] = Field(default=None, description="Tholen or SMASS spectral taxonomy")
    rotation_period_hours: Optional[float] = Field(default=None, ge=0.0, description="Sidereal rotation period in hours")


class CloseApproach(BaseModel):
    """Close approach encounter event between a small body and Earth/planets."""
    date: str = Field(..., description="Date and time string of close approach (YYYY-MMM-DD HH:MM)")
    body: str = Field(default="Earth", description="Approached body (default Earth)")
    distance_au: float = Field(..., ge=0.0, description="Nominal approach distance in AU")
    velocity_km_s: Optional[float] = Field(default=None, ge=0.0, description="Relative velocity in km/s")


class CatalogObject(BaseModel):
    """
    Known solar system celestial body from JPL Small-Body Database (SBDB) or MPC.
    Supports both flat attribute schema and structured sub-model parsing.
    """
    designation: str = Field(
        ...,
        description="Primary identifier or MPC designation",
        examples=["90377 Sedna"],
    )
    name: Optional[str] = Field(
        default=None,
        description="Common named label if officially designated",
        examples=["Sedna"],
    )
    object_type: Optional[str] = Field(
        default=None,
        description="Physical object class (e.g. 'TNO', 'Sednoid', 'Centaur', 'Asteroid')",
        examples=["Sednoid"],
    )
    orbit_class: Optional[str] = Field(
        default=None,
        description="Dynamical orbit classification code",
        examples=["Detached TNO"],
    )
    semi_major_axis_au: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Semi-major axis (a) in Astronomical Units",
        examples=[506.0],
    )
    eccentricity: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Orbital eccentricity (e)",
        examples=[0.855],
    )
    inclination_deg: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=180.0,
        description="Orbital inclination (i) relative to ecliptic in degrees",
        examples=[11.93],
    )
    perihelion_au: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Perihelion distance (q) in Astronomical Units",
        examples=[76.2],
    )
    aphelion_au: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Aphelion distance (Q) in Astronomical Units",
        examples=[936.0],
    )
    period_yr: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Orbital period in Earth years",
        examples=[11400.0],
    )
    absolute_magnitude: Optional[float] = Field(
        default=None,
        description="Absolute visual magnitude (H)",
        examples=[1.5],
    )
    diameter_km: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Estimated physical diameter in kilometers",
        examples=[995.0],
    )
    albedo: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Geometric surface albedo",
        examples=[0.32],
    )
    last_obs: Optional[str] = Field(
        default=None,
        description="Date string of the most recent cataloged observation",
        examples=["2025-11-20"],
    )
    data_source: str = Field(
        default="JPL SBDB",
        description="Authoritative catalog origin service",
        examples=["JPL SBDB"],
    )

    # Structured sub-models for compatibility with JPLClient
    orbital_elements: Optional[OrbitalElements] = Field(
        default=None,
        description="Full orbital elements sub-model",
    )
    physical_params: Optional[PhysicalParams] = Field(
        default=None,
        description="Full physical parameters sub-model",
    )
    close_approaches: List[CloseApproach] = Field(
        default_factory=list,
        description="Upcoming and historical close approach encounters",
    )
    discovery_date: Optional[str] = Field(default=None, description="Date of discovery")
    discoverer: Optional[str] = Field(default=None, description="Discoverer or survey name")
    last_updated: Optional[str] = Field(default=None, description="Epoch or date when elements were updated")
    is_simulated: bool = Field(default=False, description="Flag indicating whether this catalog object is simulated")
    is_neo: bool = Field(default=False, description="Near-Earth Object flag")
    is_pha: bool = Field(default=False, description="Potentially Hazardous Asteroid flag")
    ra: Optional[float] = Field(default=None, description="Right Ascension in degrees if localized")
    dec: Optional[float] = Field(default=None, description="Declination in degrees if localized")

    @model_validator(mode="after")
    def sync_nested_elements(self) -> "CatalogObject":
        """Synchronize nested orbital/physical parameters with top-level attributes."""
        if self.orbital_elements is not None:
            if self.semi_major_axis_au is None:
                self.semi_major_axis_au = self.orbital_elements.semi_major_axis_au
            if self.eccentricity is None:
                self.eccentricity = self.orbital_elements.eccentricity
            if self.inclination_deg is None:
                self.inclination_deg = self.orbital_elements.inclination_deg
            if self.perihelion_au is None:
                self.perihelion_au = self.orbital_elements.perihelion_dist_au
            if self.aphelion_au is None:
                self.aphelion_au = self.orbital_elements.aphelion_dist_au
            if self.period_yr is None:
                self.period_yr = self.orbital_elements.orbital_period_years

        if self.physical_params is not None:
            if self.diameter_km is None:
                self.diameter_km = self.physical_params.diameter_km
            if self.albedo is None:
                self.albedo = self.physical_params.albedo
            if self.absolute_magnitude is None:
                self.absolute_magnitude = self.physical_params.abs_magnitude

        if self.last_obs is None and self.last_updated is not None:
            self.last_obs = self.last_updated

        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "designation": "90377 Sedna",
                "name": "Sedna",
                "object_type": "Sednoid",
                "orbit_class": "Detached TNO",
                "semi_major_axis_au": 506.0,
                "eccentricity": 0.855,
                "inclination_deg": 11.93,
                "perihelion_au": 76.2,
                "aphelion_au": 936.0,
                "period_yr": 11400.0,
                "absolute_magnitude": 1.5,
                "diameter_km": 995.0,
                "albedo": 0.32,
                "last_obs": "2025-11-20",
                "data_source": "JPL SBDB",
            }
        }
    )


class EphemerisEntry(BaseModel):
    """
    Astrometric and photometric ephemeris point computed via JPL Horizons.
    """
    datetime_str: str = Field(
        ...,
        description="Timestamp string in UTC epoch format (YYYY-MM-DD HH:MM)",
        examples=["2026-06-01 00:00"],
    )
    ra: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Astrometric Right Ascension in degrees (J2000)",
        examples=[58.423],
    )
    dec: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Astrometric Declination in degrees (J2000)",
        examples=[8.115],
    )
    delta_au: float = Field(
        ...,
        ge=0.0,
        description="Observer-to-target distance in Astronomical Units",
        examples=[84.21],
    )
    r_au: float = Field(
        ...,
        ge=0.0,
        description="Sun-to-target heliocentric distance in Astronomical Units",
        examples=[84.58],
    )
    magnitude: Optional[float] = Field(
        default=None,
        description="Predicted apparent visual magnitude (V-mag)",
        examples=[20.8],
    )
    elongation: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=180.0,
        description="Target-to-Sun elongation angle as viewed by observer in degrees",
        examples=[145.2],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "datetime_str": "2026-06-01 00:00",
                "ra": 58.423,
                "dec": 8.115,
                "delta_au": 84.21,
                "r_au": 84.58,
                "magnitude": 20.8,
                "elongation": 145.2,
            }
        }
    )


# ============================================================================
# Pipeline Results & Comparison Models
# ============================================================================

class PipelineStageResult(BaseModel):
    """Execution status and performance metrics for a single pipeline step."""
    stage: Union[PipelineStage, str] = Field(..., description="Stage name or enum")
    status: str = Field(default="completed", description="Execution status: 'completed', 'failed', 'skipped'")
    duration_seconds: float = Field(default=0.0, ge=0.0, description="Duration in seconds")
    message: Optional[str] = Field(default=None, description="Optional diagnostic message")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Stage-specific execution metrics")


class ComparisonResult(BaseModel):
    """
    Differential analysis result comparing multiple temporal astronomical observation frames.
    """
    observation_ids: List[str] = Field(
        ...,
        min_length=2,
        description="List of observation identifiers evaluated in this comparison",
        examples=[["SPHEREX_FRAME_A", "SPHEREX_FRAME_B"]],
    )
    new_sources: List[SourceMeasurement] = Field(
        default_factory=list,
        description="Sources present in recent exposure but absent in baseline reference",
    )
    vanished_sources: List[SourceMeasurement] = Field(
        default_factory=list,
        description="Sources present in baseline reference but absent in recent exposure",
    )
    moved_sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Sources paired across epochs exhibiting statistically significant spatial displacement",
    )
    difference_stats: Dict[str, float] = Field(
        default_factory=dict,
        description="Summary statistics of pixel subtraction (e.g. RMS noise, registration offset, residual variance)",
        examples=[{"rms_residuals": 0.042, "matched_pairs": 128.0}],
    )
    is_simulated: bool = Field(
        default=False,
        description="Flag indicating simulated comparison calculation",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "observation_ids": ["SPHEREX_FRAME_A", "SPHEREX_FRAME_B"],
                "new_sources": [],
                "vanished_sources": [],
                "moved_sources": [],
                "difference_stats": {"rms_residuals": 0.042, "matched_pairs": 128.0},
                "is_simulated": False,
            }
        }
    )


class PipelineResult(BaseModel):
    """
    Complete output bundle produced by an OrbitScope processing pipeline execution.
    """
    id: str = Field(
        ...,
        description="Unique pipeline execution run ID",
        examples=["PIPE_RUN_20260315_882"],
    )
    observation_ids: List[str] = Field(
        ...,
        description="List of input observation IDs ingested by the pipeline",
        examples=[["SPHEREX_FRAME_A", "SPHEREX_FRAME_B"]],
    )
    started_at: datetime = Field(
        ...,
        description="UTC timestamp when processing began",
        examples=["2026-03-15T15:00:00Z"],
    )
    completed_at: Optional[datetime] = Field(
        default=None,
        description="UTC timestamp when processing completed",
        examples=["2026-03-15T15:00:12Z"],
    )
    sources_detected: int = Field(
        default=0,
        ge=0,
        description="Total single-frame sources extracted across all ingested images",
        examples=[412],
    )
    candidates_found: int = Field(
        default=0,
        ge=0,
        description="Count of moving or transient detection candidates identified",
        examples=[3],
    )
    candidates: List[DetectionCandidate] = Field(
        default_factory=list,
        description="List of verified moving or transient detection candidates",
    )
    comparison: Optional[ComparisonResult] = Field(
        default=None,
        description="Detailed frame-to-frame subtraction and displacement comparison",
    )
    pipeline_stages: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Telemetry and duration records for each processing stage",
        examples=[[{"stage": "photometry", "duration_ms": 320, "sources": 412}]],
    )
    is_simulated: bool = Field(
        default=False,
        description="Flag indicating simulated pipeline output",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "PIPE_RUN_20260315_882",
                "observation_ids": ["SPHEREX_FRAME_A", "SPHEREX_FRAME_B"],
                "started_at": "2026-03-15T15:00:00Z",
                "completed_at": "2026-03-15T15:00:12Z",
                "sources_detected": 412,
                "candidates_found": 1,
                "candidates": [],
                "comparison": None,
                "pipeline_stages": [{"stage": "photometry", "duration_ms": 320}],
                "is_simulated": False,
            }
        }
    )


# ============================================================================
# Planet X / Trans-Neptunian Object Models
# ============================================================================

class TNObject(BaseModel):
    """Extreme Trans-Neptunian Object (eTNO) supporting dynamical clustering hypotheses."""
    designation: str = Field(..., description="Provisional or official designation")
    name: Optional[str] = Field(default=None, description="Proper name if assigned")
    semi_major_axis_au: Optional[float] = Field(default=None, ge=0.0, description="Semi-major axis in AU")
    perihelion_au: Optional[float] = Field(default=None, ge=0.0, description="Perihelion distance in AU")
    eccentricity: Optional[float] = Field(default=None, ge=0.0, description="Orbital eccentricity")
    inclination_deg: Optional[float] = Field(default=None, ge=0.0, le=180.0, description="Inclination in degrees")
    argument_perihelion_deg: Optional[float] = Field(default=None, description="Argument of perihelion in degrees")
    longitude_node_deg: Optional[float] = Field(default=None, description="Longitude of ascending node in degrees")
    is_extreme_tno: bool = Field(default=True, description="Whether object meets extreme TNO criteria (a > 150 AU, q > 30 AU)")
    notes: Optional[str] = Field(default=None, description="Physical or dynamical notes")


class PlanetXPrediction(BaseModel):
    """Orbital parameter estimates for the hypothetical Planet Nine / Planet X."""
    mass_earth_masses: Optional[float] = Field(default=5.0, description="Predicted mass in Earth masses (5-10 M_Earth)")
    semi_major_axis_au: Optional[float] = Field(default=380.0, description="Predicted semi-major axis in AU (300-500 AU)")
    perihelion_au: Optional[float] = Field(default=300.0, description="Predicted perihelion distance in AU")
    aphelion_au: Optional[float] = Field(default=460.0, description="Predicted aphelion distance in AU")
    inclination_deg: Optional[float] = Field(default=16.0, description="Predicted orbital inclination in degrees (15-25 deg)")
    longitude_perihelion_deg: Optional[float] = Field(default=248.0, description="Predicted longitude of perihelion in degrees")
    current_predicted_ra: Optional[float] = Field(default=45.0, description="Current estimated sky Right Ascension near aphelion")
    current_predicted_dec: Optional[float] = Field(default=-10.0, description="Current estimated sky Declination near aphelion")
    current_predicted_dist_au: Optional[float] = Field(default=380.0, description="Current estimated heliocentric distance in AU")
    apparent_magnitude_v: Optional[float] = Field(default=22.5, description="Expected apparent visual magnitude (V ~ 22-24)")
    is_simulated: bool = Field(default=True, description="Always True for theoretical predictions")


class PlanetXEvidence(BaseModel):
    """
    Theoretical astrophysical constraints, orbital clustering statistics,
    and predicted celestial search zones for the hypothetical Planet Nine / Planet X.
    Always explicitly marked as simulated/theoretical.
    """
    clustering_sigma: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Statistical significance of orbital clustering in sigmas (e.g. Batygin & Brown 2016/2021)",
        examples=[3.8],
    )
    anti_aligned_fraction: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Fraction of extreme TNOs exhibiting clustered perihelion anti-alignment",
        examples=[0.82],
    )
    perihelion_clustering: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Clustering parameters for longitude of perihelion and orbital pole alignment",
        examples=[{"mean_varpi_deg": 240.0, "dispersion_deg": 35.0}],
    )
    predicted_regions: List[SkyRegion] = Field(
        default_factory=list,
        description="Target sky regions where Planet X is predicted to be located near aphelion",
    )
    relevant_tnos: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Extreme Trans-Neptunian Objects supporting the dynamical clustering hypothesis",
        examples=[[{"designation": "90377 Sedna", "a_au": 506.0, "e": 0.855, "i_deg": 11.93}]],
    )
    notes: str = Field(
        default="",
        description="Scientific commentary, model assumptions, and astrophysical references",
        examples=["Based on extreme TNO orbital clustering with semi-major axis > 150 AU and perihelion > 30 AU."],
    )
    is_simulated: bool = Field(
        default=True,
        description="Always True for theoretical Planet X orbital predictions",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "clustering_sigma": 3.8,
                "anti_aligned_fraction": 0.82,
                "perihelion_clustering": {"mean_varpi_deg": 240.0, "dispersion_deg": 35.0},
                "predicted_regions": [],
                "relevant_tnos": [{"designation": "90377 Sedna", "a_au": 506.0}],
                "notes": "Theoretical prediction from dynamical clustering of extreme TNOs.",
                "is_simulated": True,
            }
        }
    )


class PlanetXData(BaseModel):
    """Aggregate bundle of Planet X hypothesis data, predictions, and supporting eTNOs."""
    evidence: PlanetXEvidence = Field(..., description="Clustering evidence and predicted regions")
    prediction: Optional[PlanetXPrediction] = Field(default=None, description="Physical and orbital parameters prediction")
    predicted_regions: List[SkyRegion] = Field(default_factory=list, description="Target search regions")
    extreme_tnos: List[Dict[str, Any]] = Field(default_factory=list, description="List of extreme TNOs")
    is_simulated: bool = Field(default=True, description="Theoretical/simulated data indicator")


# ============================================================================
# API Request Models
# ============================================================================

class RunDetectionRequest(BaseModel):
    """Request payload to initiate source extraction and candidate tracking."""
    observation_ids: List[str] = Field(
        ...,
        min_length=1,
        description="List of observation frame IDs to ingest and analyze",
        examples=[["SPHEREX_FRAME_001", "SPHEREX_FRAME_002"]],
    )
    detection_sigma: float = Field(
        default=3.0,
        gt=0.0,
        le=50.0,
        description="Threshold in background noise standard deviations for peak detection",
        examples=[3.5],
    )
    match_radius_arcsec: float = Field(
        default=5.0,
        gt=0.0,
        le=60.0,
        description="Maximum cross-match association radius in arcseconds",
        examples=[5.0],
    )
    locale: Locale = Field(
        default=Locale.EN,
        description="Preferred language for response messages ('en' or 'az')",
        examples=[Locale.EN],
    )


# Alias for backward compatibility
DetectionRequest = RunDetectionRequest


class CompareObservationsRequest(BaseModel):
    """Request payload to perform differential image comparison between two observation frames."""
    observation_id_1: str = Field(
        ...,
        description="Baseline reference observation ID",
        examples=["SPHEREX_FRAME_001"],
    )
    observation_id_2: str = Field(
        ...,
        description="Target observation ID to compare against baseline",
        examples=["SPHEREX_FRAME_002"],
    )
    locale: Locale = Field(
        default=Locale.EN,
        description="Preferred language for response messages ('en' or 'az')",
        examples=[Locale.EN],
    )

    @model_validator(mode="before")
    @classmethod
    def resolve_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "observation_id_1" not in data:
                data["observation_id_1"] = data.get("observation_1_id") or data.get("obs1_id") or ""
            if "observation_id_2" not in data:
                data["observation_id_2"] = data.get("observation_2_id") or data.get("obs2_id") or ""
        return data



class CatalogSearchRequest(BaseModel):
    """Request query parameters to search JPL Small-Body Database."""
    query: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Target celestial designation or search query (e.g. 'Sedna', '2012 VP113')",
        examples=["Sedna"],
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum count of catalog items to return",
        examples=[20],
    )


class EphemerisRequest(BaseModel):
    """Request payload to generate ephemerides via JPL Horizons API."""
    target: str = Field(
        ...,
        min_length=1,
        description="Target small body name or JPL ID (e.g. '90377', 'Sedna', 'Pluto')",
        examples=["90377"],
    )
    start_time: str = Field(
        ...,
        description="Starting epoch in UTC format 'YYYY-MM-DD' or 'now'",
        examples=["2026-01-01"],
    )
    stop_time: str = Field(
        ...,
        description="Ending epoch in UTC format 'YYYY-MM-DD'",
        examples=["2026-02-01"],
    )
    step_size: str = Field(
        default="1d",
        description="Ephemeris time step size (e.g. '1d', '6h', '1h')",
        examples=["1d"],
    )


class SkyRegionRequest(BaseModel):
    """Request payload to query astronomical observations within a sky region."""
    ra: float = Field(..., ge=0.0, lt=360.0, description="Center Right Ascension in degrees")
    dec: float = Field(..., ge=-90.0, le=90.0, description="Center Declination in degrees")
    radius: float = Field(default=1.0, gt=0.0, description="Search radius in degrees")
    locale: Locale = Field(default=Locale.EN, description="Preferred response language")


class CrossMatchRequest(BaseModel):
    """Request payload to cross-match detected positions against known celestial catalogs."""
    ra: float = Field(..., ge=0.0, lt=360.0, description="Target Right Ascension in degrees")
    dec: float = Field(..., ge=-90.0, le=90.0, description="Target Declination in degrees")
    radius_arcsec: float = Field(default=5.0, gt=0.0, description="Match search radius in arcseconds")
    limit: int = Field(default=10, ge=1, le=100, description="Maximum matches to return")
    locale: Locale = Field(default=Locale.EN, description="Preferred response language")


# ============================================================================
# System Diagnostic Models
# ============================================================================

class SystemStatus(BaseModel):
    """Health check and runtime diagnostics for OrbitScope backend service."""
    status: str = Field(default="healthy", description="Service health: 'healthy', 'degraded', 'error'")
    service: str = Field(default="OrbitScope", description="Service name")
    version: str = Field(default="1.0.0", description="Backend version")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Current UTC timestamp")
    uptime_seconds: Optional[float] = Field(default=None, description="System uptime in seconds")
    demo_mode: bool = Field(default=True, description="Whether server is running in demo/fallback mode")
    components: Dict[str, Any] = Field(default_factory=dict, description="Status of internal services and cache")


# ============================================================================
# Generic API Response Wrapper
# ============================================================================

class APIResponse(BaseModel, Generic[T]):
    """
    Standard envelope returned across all OrbitScope backend REST endpoints.
    Provides typed payload encapsulation, localized status messaging,
    UTC timestamping, and explicit data provenance labeling.
    """
    success: bool = Field(
        default=True,
        description="Flag indicating whether the requested operation succeeded",
    )
    data: Optional[T] = Field(
        default=None,
        description="Typed payload data on success, or None on failure/empty results",
    )
    message: str = Field(
        ...,
        description="Human-readable status or explanatory message",
        examples=["Operation completed successfully."],
    )
    locale: Locale = Field(
        default=Locale.EN,
        description="Language code of the response message ('en' or 'az')",
        examples=[Locale.EN],
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when the response was constructed",
    )
    is_simulated: bool = Field(
        default=False,
        description="Explicit flag denoting whether the returned data is synthetic or simulated",
    )

    @classmethod
    def build(
        cls,
        data: Optional[T] = None,
        message_key: Optional[str] = None,
        custom_message: Optional[str] = None,
        locale: Locale = Locale.EN,
        success: bool = True,
        is_simulated: bool = False,
    ) -> "APIResponse[T]":
        """
        Convenience factory to construct an APIResponse with localized message resolution.

        Args:
            data: Payload data.
            message_key: Key in the I18N_MESSAGES dictionary.
            custom_message: Specific custom text overriding i18n lookup.
            locale: Language locale for message formatting.
            success: Boolean success flag.
            is_simulated: Explicit synthetic data indicator.

        Returns:
            APIResponse[T]: Initialized response object.
        """
        if custom_message is not None:
            resolved_message = custom_message
        elif message_key is not None:
            resolved_message = get_i18n_message(message_key, locale=locale)
        else:
            default_en = "Operation completed successfully." if success else "Operation failed."
            default_az = "Əməliyyat uğurla tamamlandı." if success else "Əməliyyat uğursuz oldu."
            resolved_message = default_az if locale == Locale.AZ else default_en

        return cls(
            success=success,
            data=data,
            message=resolved_message,
            locale=locale,
            is_simulated=is_simulated,
        )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "data": None,
                "message": "Detection pipeline executed successfully.",
                "locale": "en",
                "timestamp": "2026-03-15T15:00:00Z",
                "is_simulated": False,
            }
        }
    )


# Alias for backward-compatibility with alternative casing
ApiResponse = APIResponse
