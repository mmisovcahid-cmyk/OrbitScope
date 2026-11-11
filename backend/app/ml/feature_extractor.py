"""OrbitScope - ML Feature Extractor
Extracts photometric, astrometric, and morphological features from detection candidates.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, Optional
import numpy as np

if TYPE_CHECKING:
    from app.models.schemas import DetectionCandidate


class FeatureExtractor:
    """Extract features from detection candidates for ML analysis."""

    FEATURE_NAMES: list[str] = [
        "displacement_arcsec",
        "snr",
        "magnitude_estimate",
        "motion_ra",
        "motion_dec",
        "motion_total",
        "n_measurements",
        "flux_mean",
        "flux_std",
        "fwhm_mean",
        "elongation_mean",
        "sharpness_mean",
    ]

    def __init__(self) -> None:
        """Initialize the feature extractor."""
        pass

    def get_feature_names(self) -> list[str]:
        """Return the list of feature names."""
        return list(self.FEATURE_NAMES)

    def extract_features(self, candidate: Any) -> np.ndarray:
        """Extract a feature vector from a detection candidate.

        Parameters
        ----------
        candidate : DetectionCandidate or dict or object
            Candidate object or dictionary with astrometric and photometric fields.

        Returns
        -------
        np.ndarray
            1D array of shape (12,) containing feature values.
        """
        def _get(keys: tuple[str, ...], default: float = 0.0) -> float:
            for k in keys:
                if isinstance(candidate, dict) and k in candidate and candidate[k] is not None:
                    try:
                        return float(candidate[k])
                    except (ValueError, TypeError):
                        pass
                elif hasattr(candidate, k):
                    val = getattr(candidate, k)
                    if val is not None:
                        try:
                            return float(val)
                        except (ValueError, TypeError):
                            pass
            return default

        # 1. Displacement
        displacement_arcsec = _get(("displacement_arcsec", "displacement"), 0.0)

        # 2. SNR
        snr = _get(("snr", "signal_to_noise"), 0.0)

        # 3. Magnitude estimate
        magnitude_estimate = _get(("magnitude_estimate", "magnitude", "mag"), 20.0)

        # 4 & 5. Motion components
        motion_ra = _get(("motion_ra", "pm_ra", "rate_ra"), 0.0)
        motion_dec = _get(("motion_dec", "pm_dec", "rate_dec"), 0.0)

        # 6. Motion total
        calc_total = float(np.hypot(motion_ra, motion_dec))
        motion_total = _get(
            ("motion_total", "apparent_velocity_arcsec_per_day", "total_motion", "velocity"),
            calc_total,
        )
        if motion_total == 0.0 and calc_total > 0.0:
            motion_total = calc_total

        # Measurements exploration (source_measurements or measurements)
        measurements: Optional[list[Any]] = None
        if isinstance(candidate, dict):
            measurements = candidate.get("measurements") or candidate.get("source_measurements")
        elif hasattr(candidate, "measurements"):
            measurements = getattr(candidate, "measurements")
        elif hasattr(candidate, "source_measurements"):
            measurements = getattr(candidate, "source_measurements")

        # Fallback flux values from observations 1 & 2
        f1 = _get(("flux_observation_1", "flux_1", "flux1"), default=-1.0)
        f2 = _get(("flux_observation_2", "flux_2", "flux2"), default=-1.0)

        if measurements and len(measurements) > 0:
            n_measurements = float(len(measurements))
            fluxes = []
            fwhms = []
            elongations = []
            sharpnesses = []

            for m in measurements:
                def _get_m(keys: tuple[str, ...], d: float) -> float:
                    for k in keys:
                        if isinstance(m, dict) and k in m and m[k] is not None:
                            try:
                                return float(m[k])
                            except (ValueError, TypeError):
                                pass
                        elif hasattr(m, k):
                            v = getattr(m, k)
                            if v is not None:
                                try:
                                    return float(v)
                                except (ValueError, TypeError):
                                    pass
                    return d

                fluxes.append(_get_m(("flux", "peak_flux", "source_flux"), 0.0))
                fwhms.append(_get_m(("fwhm", "source_fwhm"), 3.0))
                elongations.append(_get_m(("elongation", "source_elongation"), 1.0))
                sharpnesses.append(_get_m(("sharpness", "source_sharpness"), 0.5))

            flux_mean = float(np.mean(fluxes)) if fluxes else 0.0
            flux_std = float(np.std(fluxes)) if len(fluxes) > 1 else 0.0
            fwhm_mean = float(np.mean(fwhms)) if fwhms else 3.0
            elongation_mean = float(np.mean(elongations)) if elongations else 1.0
            sharpness_mean = float(np.mean(sharpnesses)) if sharpnesses else 0.5

        else:
            n_meas = _get(("n_measurements",), default=-1.0)
            if n_meas > 0:
                n_measurements = n_meas
            else:
                n_measurements = 2.0 if (f1 >= 0 or f2 >= 0 or displacement_arcsec > 0) else 1.0

            if f1 >= 0 and f2 >= 0:
                flux_mean = float((f1 + f2) / 2.0)
                flux_std = float(abs(f1 - f2) / np.sqrt(2.0))
            elif f1 >= 0:
                flux_mean = float(f1)
                flux_std = 0.0
            else:
                flux_mean = _get(("flux_mean", "flux"), 100.0)
                flux_std = _get(("flux_std",), 0.0)

            fwhm_mean = _get(("fwhm_mean", "fwhm"), 3.0)
            elongation_mean = _get(("elongation_mean", "elongation"), 1.0)
            sharpness_mean = _get(("sharpness_mean", "sharpness"), 0.5)

        features = np.array(
            [
                displacement_arcsec,
                snr,
                magnitude_estimate,
                motion_ra,
                motion_dec,
                motion_total,
                n_measurements,
                flux_mean,
                flux_std,
                fwhm_mean,
                elongation_mean,
                sharpness_mean,
            ],
            dtype=np.float64,
        )

        # Sanitize against NaN and Inf
        features = np.nan_to_num(features, nan=0.0, posinf=1e6, neginf=-1e6)
        return features

    def extract_batch(self, candidates: list[Any]) -> np.ndarray:
        """Extract features from multiple candidates.

        Parameters
        ----------
        candidates : list[DetectionCandidate]
            List of candidate objects.

        Returns
        -------
        np.ndarray
            2D array of shape (n_candidates, n_features).
        """
        if not candidates:
            return np.empty((0, len(self.FEATURE_NAMES)), dtype=np.float64)

        rows = [self.extract_features(cand) for cand in candidates]
        return np.vstack(rows).astype(np.float64)
