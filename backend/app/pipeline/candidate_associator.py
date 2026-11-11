"""
OrbitScope - Multi-Epoch Candidate Associator
Associates astronomical source detections across temporal epochs, separates
stationary reference stars from moving objects, computes proper motion vectors,
and constructs detection candidate tracks.
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any
import numpy as np
from astropy.coordinates import SkyCoord
import astropy.units as u
from scipy.spatial import cKDTree

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.schemas import DetectionCandidate, DetectionStatus, SourceMeasurement

logger = get_logger("pipeline.candidate_associator")


def _sky_to_cartesian(ra_deg: np.ndarray, dec_deg: np.ndarray) -> np.ndarray:
    """Convert celestial spherical coordinates (RA, Dec in deg) to 3D Cartesian coordinates on unit sphere."""
    ra_rad = np.radians(ra_deg)
    dec_rad = np.radians(dec_deg)
    x = np.cos(dec_rad) * np.cos(ra_rad)
    y = np.cos(dec_rad) * np.sin(ra_rad)
    z = np.sin(dec_rad)
    return np.column_stack((x, y, z))


def _angular_separation_arcsec(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    """Compute great-circle separation in arcseconds between two celestial coordinates."""
    r1, d1 = math.radians(ra1), math.radians(dec1)
    r2, d2 = math.radians(ra2), math.radians(dec2)
    d_ra = r2 - r1
    d_dec = d2 - d1
    a = math.sin(d_dec / 2.0) ** 2 + math.cos(d1) * math.cos(d2) * math.sin(d_ra / 2.0) ** 2
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return math.degrees(c) * 3600.0


class CandidateAssociator:
    """Associates sources across observation epochs and extracts moving object candidates."""

    def __init__(self, match_radius_arcsec: float | None = None) -> None:
        """
        Initialize the CandidateAssociator.

        Args:
            match_radius_arcsec: Default cross-matching radius in arcseconds.
        """
        default_radius = getattr(settings, "DEFAULT_MATCH_RADIUS_ARCSEC", 5.0)
        self.match_radius = float(match_radius_arcsec if match_radius_arcsec is not None else default_radius)

    def positional_match(
        self,
        sources1: list[SourceMeasurement],
        sources2: list[SourceMeasurement],
        max_separation_arcsec: float | None = None,
    ) -> list[tuple[int, int, float]]:
        """
        Match sources between two catalogs using 3D Euclidean k-d tree on unit sphere.

        Args:
            sources1: Catalog of detections from first epoch.
            sources2: Catalog of detections from second epoch.
            max_separation_arcsec: Maximum matching tolerance in arcseconds.

        Returns:
            list[tuple[int, int, float]]: List of (idx1, idx2, separation_arcsec) tuples.
        """
        if not sources1 or not sources2:
            return []

        max_sep = float(max_separation_arcsec if max_separation_arcsec is not None else self.match_radius)

        ra1 = np.array([s.ra for s in sources1], dtype=np.float64)
        dec1 = np.array([s.dec for s in sources1], dtype=np.float64)
        ra2 = np.array([s.ra for s in sources2], dtype=np.float64)
        dec2 = np.array([s.dec for s in sources2], dtype=np.float64)

        xyz1 = _sky_to_cartesian(ra1, dec1)
        xyz2 = _sky_to_cartesian(ra2, dec2)

        # 3D chord distance tolerance: 2 * sin(theta / 2)
        sep_rad = math.radians(max_sep / 3600.0)
        max_chord = 2.0 * math.sin(sep_rad / 2.0)

        tree2 = cKDTree(xyz2)
        # Query nearest neighbor in catalog 2 for each source in catalog 1
        dists, indices = tree2.query(xyz1, distance_upper_bound=max_chord)

        matches: list[tuple[int, int, float]] = []
        n_sources2 = len(sources2)

        for i, (dist, j) in enumerate(zip(dists, indices)):
            if j < n_sources2:
                exact_sep = _angular_separation_arcsec(ra1[i], dec1[i], ra2[j], dec2[j])
                if exact_sep <= max_sep:
                    matches.append((i, int(j), round(exact_sep, 3)))

        logger.debug("Positional cross-match found %d pairs within %.2f arcsec", len(matches), max_sep)
        return matches

    def find_stationary_sources(
        self,
        matches: list[tuple[int, int, float]],
        max_motion_arcsec: float = 1.0,
    ) -> list[tuple[int, int, float]]:
        """
        Identify stationary sources (background stars) from matched pairs.

        Args:
            matches: List of (idx1, idx2, separation_arcsec) tuples.
            max_motion_arcsec: Maximum allowed displacement for stationary designation.

        Returns:
            list[tuple[int, int, float]]: Stationary matches.
        """
        stationary = [m for m in matches if m[2] <= max_motion_arcsec]
        logger.debug("Identified %d stationary sources (sep <= %.2f arcsec)", len(stationary), max_motion_arcsec)
        return stationary

    def estimate_motion_vector(
        self,
        s1: SourceMeasurement,
        s2: SourceMeasurement,
        dt_hours: float,
    ) -> tuple[float, float]:
        """
        Compute apparent proper motion vector (mu_ra, mu_dec) in arcsec/hr.

        Args:
            s1: Detection at epoch 1.
            s2: Detection at epoch 2.
            dt_hours: Elapsed time between observations in hours.

        Returns:
            tuple[float, float]: (mu_ra, mu_dec) in arcsec/hr.
        """
        dt = max(abs(dt_hours), 1e-4)

        # Handle wrap-around in RA
        dra_deg = (s2.ra - s1.ra + 180.0) % 360.0 - 180.0
        dec_mean_rad = math.radians(0.5 * (s1.dec + s2.dec))

        dra_arcsec = dra_deg * math.cos(dec_mean_rad) * 3600.0
        ddec_arcsec = (s2.dec - s1.dec) * 3600.0

        mu_ra = dra_arcsec / dt
        mu_dec = ddec_arcsec / dt

        return round(mu_ra, 4), round(mu_dec, 4)

    def compute_association_confidence(self, candidate: DetectionCandidate) -> float:
        """
        Compute an association confidence score [0.0, 1.0] for a moving object candidate.
        Considers detection SNR, motion plausibility, and photometric/morphological stability.

        Args:
            candidate: DetectionCandidate object.

        Returns:
            float: Confidence score in range [0.05, 0.98].
        """
        # 1. SNR term (asymptote towards 1.0 above SNR ~ 20)
        snr_factor = 1.0 / (1.0 + math.exp(-0.25 * (candidate.snr - 8.0)))

        # 2. Photometric stability term (flux ratio between epochs)
        phot_factor = 0.8
        if len(candidate.measurements) >= 2:
            m1, m2 = candidate.measurements[0], candidate.measurements[1]
            if m1.flux > 0 and m2.flux > 0:
                ratio = max(m1.flux, m2.flux) / min(m1.flux, m2.flux)
                # Penalize extreme flux variations (> 3x) unless high SNR
                phot_factor = max(0.2, 1.0 - 0.2 * (ratio - 1.0))
            else:
                phot_factor = 0.5

        # 3. Motion plausibility term
        motion_factor = 0.85
        total_motion = 0.0
        if candidate.motion_ra is not None and candidate.motion_dec is not None:
            total_motion = math.hypot(candidate.motion_ra, candidate.motion_dec)
            # Optimal asteroid/KBO motion: 0.1 to 30 arcsec/hr
            if 0.1 <= total_motion <= 40.0:
                motion_factor = 0.95
            elif total_motion < 0.05:
                motion_factor = 0.3  # Likely un-subtracted static star
            else:
                motion_factor = 0.7  # Fast-moving NEO or satellite

        confidence = 0.5 * snr_factor + 0.25 * phot_factor + 0.25 * motion_factor
        return round(float(np.clip(confidence, 0.05, 0.98)), 3)

    def find_moving_candidates(
        self,
        sources1: list[SourceMeasurement],
        sources2: list[SourceMeasurement],
        epoch1: datetime,
        epoch2: datetime,
        min_motion_arcsec: float = 1.0,
        max_motion_arcsec: float = 300.0,
    ) -> list[DetectionCandidate]:
        """
        Identify moving object candidates between two epochs:
        1. Perform broad positional matching up to max_motion_arcsec.
        2. Filter out stationary sources (separation < min_motion_arcsec).
        3. Form moving candidate pairs and calculate proper motion vectors.
        4. Detect unmatched high-SNR transients.
        5. Score each candidate and classify dynamically.

        Args:
            sources1: Detections in epoch 1.
            sources2: Detections in epoch 2.
            epoch1: Timestamp of epoch 1.
            epoch2: Timestamp of epoch 2.
            min_motion_arcsec: Lower bound on displacement to exclude static stars.
            max_motion_arcsec: Upper bound on search radius for orbital motion tracks.

        Returns:
            list[DetectionCandidate]: List of identified moving or transient candidates.
        """
        dt_seconds = abs((epoch2 - epoch1).total_seconds())
        dt_hours = max(dt_seconds / 3600.0, 1e-4)

        logger.info(
            "Searching for moving candidates between epochs (dt=%.2f hrs, search_radius=%.1f arcsec)",
            dt_hours,
            max_motion_arcsec,
        )

        # 1. Match candidates within broad displacement radius
        all_matches = self.positional_match(
            sources1,
            sources2,
            max_separation_arcsec=max_motion_arcsec,
        )

        matched_idx1: set[int] = set()
        matched_idx2: set[int] = set()

        candidates: list[DetectionCandidate] = []

        # 2. Evaluate matched pairs for non-stationary motion
        for idx1, idx2, sep_arcsec in all_matches:
            if sep_arcsec < min_motion_arcsec:
                # Stationary star
                matched_idx1.add(idx1)
                matched_idx2.add(idx2)
                continue

            s1 = sources1[idx1]
            s2 = sources2[idx2]

            # Verify photometric consistency (avoid spurious noise-to-star pairing)
            f1, f2 = max(s1.flux, 1e-2), max(s2.flux, 1e-2)
            flux_ratio = max(f1, f2) / min(f1, f2)
            if flux_ratio > 8.0:
                continue

            matched_idx1.add(idx1)
            matched_idx2.add(idx2)

            mu_ra, mu_dec = self.estimate_motion_vector(s1, s2, dt_hours)
            velocity = math.hypot(mu_ra, mu_dec)

            # Center position at epoch 2
            cand_ra = s2.ra
            cand_dec = s2.dec
            comb_snr = math.sqrt(s1.snr**2 + s2.snr**2)

            # Estimate apparent magnitude
            mean_flux = 0.5 * (s1.flux + s2.flux)
            mag_est = -2.5 * math.log10(max(mean_flux, 1e-4)) + 25.0 if mean_flux > 0 else 22.0

            # Dynamic classification by proper motion
            if velocity < 1.5:
                classification = "Extreme TNO / Kuiper Belt Candidate"
            elif velocity <= 20.0:
                classification = "Main-Belt Asteroid Candidate"
            else:
                classification = "Near-Earth Asteroid (NEO) Candidate"

            cand_id = f"OS-CAND-{uuid.uuid4().hex[:6].upper()}"

            initial_cand = DetectionCandidate(
                id=cand_id,
                status=DetectionStatus.CANDIDATE if comb_snr >= 5.0 else DetectionStatus.NEEDS_VERIFICATION,
                ra=round(cand_ra, 6),
                dec=round(cand_dec, 6),
                displacement_arcsec=round(sep_arcsec, 3),
                motion_ra=mu_ra,
                motion_dec=mu_dec,
                snr=round(comb_snr, 2),
                magnitude_estimate=round(mag_est, 2),
                measurements=[s1, s2],
                classification=classification,
                anomaly_score=round(min(1.0, velocity / 50.0), 3),
                provenance={
                    "pipeline_version": "1.0.0",
                    "method": "CandidateAssociator.cKDTree",
                    "dt_hours": round(dt_hours, 3),
                    "velocity_arcsec_hr": round(velocity, 3),
                },
                is_simulated=getattr(s1, "is_simulated", False) or getattr(s2, "is_simulated", False),
            )

            confidence = self.compute_association_confidence(initial_cand)
            if confidence >= 0.65 and initial_cand.snr >= 5.0:
                initial_cand.status = DetectionStatus.CANDIDATE
            else:
                initial_cand.status = DetectionStatus.NEEDS_VERIFICATION

            candidates.append(initial_cand)

        # 3. Isolated high-significance single-epoch detections (new appearance / fast transient)
        for idx2, s2 in enumerate(sources2):
            if idx2 in matched_idx2:
                continue
            if s2.snr >= 8.0:
                # Strong new detection without epoch 1 counterpart
                cand_id = f"OS-TRNS-{uuid.uuid4().hex[:6].upper()}"
                mag_est = -2.5 * math.log10(max(s2.flux, 1e-4)) + 25.0 if s2.flux > 0 else 22.0
                candidates.append(
                    DetectionCandidate(
                        id=cand_id,
                        status=DetectionStatus.NEEDS_VERIFICATION,
                        ra=round(s2.ra, 6),
                        dec=round(s2.dec, 6),
                        displacement_arcsec=None,
                        motion_ra=None,
                        motion_dec=None,
                        snr=round(s2.snr, 2),
                        magnitude_estimate=round(mag_est, 2),
                        measurements=[s2],
                        classification="Unpaired Transient / Fast Mover",
                        anomaly_score=0.75,
                        provenance={
                            "pipeline_version": "1.0.0",
                            "method": "UnmatchedSourceIsolation",
                        },
                        is_simulated=getattr(s2, "is_simulated", False),
                    )
                )

        # Sort candidates descending by SNR
        candidates.sort(key=lambda c: c.snr, reverse=True)
        logger.info("Identified %d candidates across epochs", len(candidates))
        return candidates
