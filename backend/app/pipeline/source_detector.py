"""
OrbitScope - Astronomical Source Detection
Performs point-source detection using DAOStarFinder (DAOPhot algorithm)
and extended/blended source detection using photutils image segmentation.
"""
from __future__ import annotations

from typing import Any
import numpy as np
from astropy.stats import sigma_clipped_stats
from astropy.wcs import WCS
from photutils.centroids import centroid_quadratic
from photutils.detection import DAOStarFinder
from photutils.segmentation import SourceCatalog, deblend_sources, detect_sources

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.schemas import SourceMeasurement

logger = get_logger("pipeline.source_detector")


def _to_scalar(val: Any, default: float = 0.0) -> float:
    """Helper to safely extract dimensionless scalar from Astropy Quantity or NumPy scalar."""
    if val is None:
        return default
    if hasattr(val, "value"):
        val = val.value
    try:
        f = float(val)
        return f if np.isfinite(f) else default
    except Exception:
        return default


class SourceDetector:
    """Detects and characterizes astronomical sources in image arrays."""

    def __init__(
        self,
        detection_sigma: float | None = None,
        fwhm: float | None = None,
    ) -> None:
        """
        Initialize the SourceDetector.

        Args:
            detection_sigma: Detection significance threshold (sigmas above background).
            fwhm: Estimated Full Width at Half Maximum of the point spread function in pixels.
        """
        default_sigma = getattr(settings, "DEFAULT_DETECTION_SIGMA", 3.0)
        default_fwhm = getattr(settings, "SOURCE_FWHM", 3.0)

        self.sigma = float(detection_sigma if detection_sigma is not None else default_sigma)
        self.fwhm = float(fwhm if fwhm is not None else default_fwhm)

    def detect_dao(
        self,
        image: np.ndarray,
        threshold_sigma: float | None = None,
        fwhm: float | None = None,
        wcs: WCS | None = None,
    ) -> list[SourceMeasurement]:
        """
        Detect point sources using photutils DAOStarFinder (DAOPhot algorithm).

        Args:
            image: 2D numpy array (preferably background-subtracted).
            threshold_sigma: Significance threshold. Defaults to self.sigma.
            fwhm: PSF FWHM in pixels. Defaults to self.fwhm.
            wcs: Optional Astropy WCS for pixel-to-sky coordinate conversion.

        Returns:
            list[SourceMeasurement]: Detected sources with photometric parameters.
        """
        sig = float(threshold_sigma if threshold_sigma is not None else self.sigma)
        psf_fwhm = float(fwhm if fwhm is not None else self.fwhm)

        img_float = np.ascontiguousarray(image, dtype=np.float64)
        img_clean = np.nan_to_num(img_float, nan=0.0, posinf=0.0, neginf=0.0)

        mean_val, median_val, std_val = sigma_clipped_stats(img_clean, sigma=3.0, maxiters=5)
        if not np.isfinite(std_val) or std_val <= 0:
            std_val = 1.0

        threshold_val = float(median_val + (sig * std_val))
        logger.debug(
            "DAOStarFinder: fwhm=%.2f, threshold=%.4f (median=%.4f, std=%.4f, sig=%.1f)",
            psf_fwhm,
            threshold_val,
            median_val,
            std_val,
            sig,
        )

        try:
            daofind = DAOStarFinder(
                fwhm=psf_fwhm,
                threshold=threshold_val,
                roundlo=-1.0,
                roundhi=1.0,
                sharplo=0.1,
                sharphi=1.5,
            )
            sources_tbl = daofind(img_clean)

            if sources_tbl is None or len(sources_tbl) == 0:
                logger.info("DAOStarFinder detected 0 sources")
                return []

            sources: list[SourceMeasurement] = []
            for row in sources_tbl:
                meas = self._to_source_measurement(row, image=img_clean, wcs=wcs, std_noise=std_val)
                if meas is not None:
                    sources.append(meas)

            logger.info("DAOStarFinder detected %d sources", len(sources))
            return sources

        except Exception as exc:
            logger.error("DAOStarFinder detection failed: %s", exc)
            return []

    def detect_segmentation(
        self,
        image: np.ndarray,
        npixels: int = 5,
        threshold_sigma: float | None = None,
        wcs: WCS | None = None,
    ) -> list[SourceMeasurement]:
        """
        Detect sources using connected-pixel image segmentation and deblending.

        Args:
            image: 2D numpy array.
            npixels: Minimum number of connected pixels above threshold.
            threshold_sigma: Significance threshold. Defaults to self.sigma.
            wcs: Optional Astropy WCS for sky coordinates.

        Returns:
            list[SourceMeasurement]: Detected sources from segmentation catalog.
        """
        sig = float(threshold_sigma if threshold_sigma is not None else self.sigma)
        img_float = np.ascontiguousarray(image, dtype=np.float64)
        img_clean = np.nan_to_num(img_float, nan=0.0, posinf=0.0, neginf=0.0)

        mean_val, median_val, std_val = sigma_clipped_stats(img_clean, sigma=3.0, maxiters=5)
        if not np.isfinite(std_val) or std_val <= 0:
            std_val = 1.0

        threshold_val = float(median_val + (sig * std_val))

        try:
            segm = detect_sources(img_clean, threshold=threshold_val, npixels=npixels)
            if segm is None:
                logger.info("Segmentation detected 0 sources (segm is None)")
                return []

            try:
                segm_deblend = deblend_sources(img_clean, segm, npixels=npixels, nlevels=32, contrast=0.005)
            except Exception as deb_err:
                logger.debug("Deblending skipped or failed (%s); using direct segmentation", deb_err)
                segm_deblend = segm

            cat = SourceCatalog(img_clean, segm_deblend, wcs=wcs)
            if cat is None or len(cat) == 0:
                return []

            sources: list[SourceMeasurement] = []
            for item in cat:
                x = _to_scalar(item.xcentroid)
                y = _to_scalar(item.ycentroid)
                if not (np.isfinite(x) and np.isfinite(y)):
                    continue

                flux = max(0.0, _to_scalar(item.segment_flux))
                peak = _to_scalar(item.max_value)

                # Approximate FWHM from semi-major axis: FWHM ~ 2.355 * sigma
                if hasattr(item, "semimajor_sigma") and item.semimajor_sigma is not None:
                    fwhm_val = _to_scalar(item.semimajor_sigma) * 2.355
                else:
                    fwhm_val = self.fwhm

                elongation = 1.0
                if hasattr(item, "elongation") and item.elongation is not None:
                    elongation = max(1.0, _to_scalar(item.elongation, 1.0))

                snr = float(peak / std_val) if std_val > 0 else 0.0

                ra, dec = 0.0, 0.0
                if wcs is not None:
                    try:
                        coord = wcs.pixel_to_world(x, y)
                        ra = float(coord.ra.deg)
                        dec = float(coord.dec.deg)
                    except Exception:
                        pass

                sources.append(
                    SourceMeasurement(
                        x=round(x, 2),
                        y=round(y, 2),
                        ra=round(ra, 6),
                        dec=round(dec, 6),
                        flux=round(flux, 2),
                        snr=round(snr, 2),
                        fwhm=round(fwhm_val, 2),
                        elongation=round(elongation, 2),
                        sharpness=0.5,
                        is_simulated=False,
                    )
                )

            logger.info("Segmentation detected %d sources", len(sources))
            return sources

        except Exception as exc:
            logger.error("Segmentation detection failed: %s", exc)
            return []

    def detect(
        self,
        image: np.ndarray,
        method: str = "dao",
        threshold_sigma: float | None = None,
        fwhm: float | None = None,
        wcs: WCS | None = None,
    ) -> list[SourceMeasurement]:
        """
        Detect sources using specified method. Dispatches to detect_dao or detect_segmentation.

        Args:
            image: 2D image array.
            method: Detection method ("dao" or "segmentation").
            threshold_sigma: Optional significance threshold.
            fwhm: Optional PSF FWHM.
            wcs: Optional Astropy WCS.

        Returns:
            list[SourceMeasurement]: Detected sources.
        """
        method_clean = method.lower().strip()
        if method_clean in ("segmentation", "segm", "sextractor"):
            return self.detect_segmentation(image, threshold_sigma=threshold_sigma, wcs=wcs)
        return self.detect_dao(image, threshold_sigma=threshold_sigma, fwhm=fwhm, wcs=wcs)

    def measure_source_properties(
        self,
        image: np.ndarray,
        sources: list[SourceMeasurement],
        cutout_radius: int = 5,
    ) -> list[SourceMeasurement]:
        """
        Refine source measurements: compute subpixel centroid (centroid_quadratic),
        local peak, flux, SNR, and morphology.

        Args:
            image: 2D numpy array.
            sources: List of initial SourceMeasurement detections.
            cutout_radius: Radius in pixels around source center for refinement.

        Returns:
            list[SourceMeasurement]: Refined measurements.
        """
        if not sources:
            return []

        img_float = np.ascontiguousarray(image, dtype=np.float64)
        ny, nx = img_float.shape
        _, _, global_std = sigma_clipped_stats(img_float, sigma=3.0, maxiters=3)
        if not np.isfinite(global_std) or global_std <= 0:
            global_std = 1.0

        refined_sources: list[SourceMeasurement] = []
        for src in sources:
            ix = int(round(src.x))
            iy = int(round(src.y))

            x0 = max(0, ix - cutout_radius)
            x1 = min(nx, ix + cutout_radius + 1)
            y0 = max(0, iy - cutout_radius)
            y1 = min(ny, iy + cutout_radius + 1)

            cutout = img_float[y0:y1, x0:x1]
            if cutout.size < 9:
                refined_sources.append(src)
                continue

            try:
                # Quadratic 2D centroid refinement
                cx_rel, cy_rel = centroid_quadratic(cutout)
                refined_x = x0 + cx_rel if np.isfinite(cx_rel) else src.x
                refined_y = y0 + cy_rel if np.isfinite(cy_rel) else src.y

                peak_val = float(np.max(cutout))
                flux_val = float(np.sum(cutout[cutout > 0])) if np.any(cutout > 0) else src.flux
                snr_val = float(peak_val / global_std) if global_std > 0 else src.snr

                refined_sources.append(
                    SourceMeasurement(
                        x=round(refined_x, 2),
                        y=round(refined_y, 2),
                        ra=src.ra,
                        dec=src.dec,
                        flux=round(flux_val, 2),
                        snr=round(snr_val, 2),
                        fwhm=src.fwhm,
                        elongation=src.elongation,
                        sharpness=src.sharpness,
                        is_simulated=src.is_simulated,
                    )
                )
            except Exception:
                refined_sources.append(src)

        return refined_sources

    def _to_source_measurement(
        self,
        table_row: Any,
        image: np.ndarray | None = None,
        wcs: WCS | None = None,
        std_noise: float = 1.0,
    ) -> SourceMeasurement | None:
        """
        Convert a photutils DAOStarFinder table row to SourceMeasurement model.

        Args:
            table_row: Single row from DAOStarFinder QTable.
            image: Image array for flux/peak verification.
            wcs: Optional Astropy WCS.
            std_noise: Noise standard deviation for SNR computation.

        Returns:
            SourceMeasurement or None if coordinates are invalid.
        """
        try:
            x = _to_scalar(table_row["xcentroid"])
            y = _to_scalar(table_row["ycentroid"])
            if not (np.isfinite(x) and np.isfinite(y)):
                return None

            flux = _to_scalar(table_row["flux"]) if "flux" in table_row.colnames else 0.0
            peak = _to_scalar(table_row["peak"]) if "peak" in table_row.colnames else 0.0
            sharpness = _to_scalar(table_row["sharpness"]) if "sharpness" in table_row.colnames else 0.5
            roundness = _to_scalar(table_row["roundness1"]) if "roundness1" in table_row.colnames else 0.0

            snr = float(peak / std_noise) if std_noise > 0 else 0.0
            elongation = max(1.0, 1.0 / max(1e-3, 1.0 - min(0.99, abs(roundness))))

            ra, dec = 0.0, 0.0
            if wcs is not None:
                try:
                    sky_coord = wcs.pixel_to_world(x, y)
                    ra = float(sky_coord.ra.deg)
                    dec = float(sky_coord.dec.deg)
                except Exception:
                    pass

            return SourceMeasurement(
                x=round(x, 2),
                y=round(y, 2),
                ra=round(ra, 6),
                dec=round(dec, 6),
                flux=round(flux, 2),
                snr=round(snr, 2),
                fwhm=round(self.fwhm, 2),
                elongation=round(elongation, 2),
                sharpness=round(sharpness, 3),
                is_simulated=False,
            )
        except Exception as exc:
            logger.warning("Error parsing table row to SourceMeasurement: %s", exc)
            return None
