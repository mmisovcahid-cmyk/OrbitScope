"""
OrbitScope - Astrometric and Image Registration Alignment
Provides sub-pixel image alignment using phase cross-correlation (scikit-image)
and astrometric reprojection using Astropy WCS and spline interpolation.
"""
from __future__ import annotations

import numpy as np
from astropy.wcs import WCS
from scipy.ndimage import map_coordinates, shift as nd_shift
from skimage.registration import phase_cross_correlation
from skimage.transform import AffineTransform, warp

from app.core.logging_config import get_logger

logger = get_logger("pipeline.alignment")


class ImageAligner:
    """Aligns astronomical images using Astropy WCS or phase cross-correlation registration."""

    def __init__(self, default_upsample_factor: int = 100) -> None:
        """
        Initialize the ImageAligner.

        Args:
            default_upsample_factor: Upsampling factor for subpixel phase cross-correlation.
        """
        self.default_upsample_factor = int(default_upsample_factor)

    def compute_shift(
        self,
        reference: np.ndarray,
        target: np.ndarray,
        upsample_factor: int | None = None,
    ) -> tuple[float, float]:
        """
        Compute sub-pixel translation shift (shift_y, shift_x) between reference and target.
        A positive shift means target must be shifted by (shift_y, shift_x) to match reference.

        Args:
            reference: 2D numpy array (reference image).
            target: 2D numpy array (target image to align).
            upsample_factor: Subpixel precision factor (e.g. 100 = 0.01 pixel precision).

        Returns:
            tuple[float, float]: (shift_y, shift_x) in pixel units.
        """
        factor = upsample_factor or self.default_upsample_factor

        # Clean NaNs and infinite values
        ref_clean = np.nan_to_num(reference.astype(np.float64), nan=0.0)
        tgt_clean = np.nan_to_num(target.astype(np.float64), nan=0.0)

        # Subtract local median to eliminate background offset before correlation
        ref_clean -= np.median(ref_clean)
        tgt_clean -= np.median(tgt_clean)

        # Apply Tukey/Hanning window to suppress edge boundary artifacts
        ny, nx = ref_clean.shape
        win_y = np.hanning(ny)
        win_x = np.hanning(nx)
        window_2d = np.outer(win_y, win_x)

        ref_win = ref_clean * window_2d
        tgt_win = tgt_clean * window_2d

        try:
            # phase_cross_correlation returns (shift, error, phasediff)
            shift_arr, error, _ = phase_cross_correlation(
                ref_win,
                tgt_win,
                upsample_factor=factor,
            )
            shift_y = float(shift_arr[0])
            shift_x = float(shift_arr[1])
            logger.debug("Computed image registration shift: dy=%.4f, dx=%.4f, err=%.4f", shift_y, shift_x, error)
            return shift_y, shift_x

        except Exception as exc:
            logger.warning("Phase cross-correlation failed (%s); returning (0.0, 0.0)", exc)
            return 0.0, 0.0

    def apply_shift(
        self,
        image: np.ndarray,
        shift: tuple[float, float],
        order: int = 3,
        cval: float = 0.0,
    ) -> np.ndarray:
        """
        Apply a translation shift (shift_y, shift_x) to an image using subpixel interpolation.

        Args:
            image: 2D numpy array.
            shift: (shift_y, shift_x) tuple in pixel coordinates.
            order: Spline interpolation order (1=linear, 3=cubic).
            cval: Value used to fill edges out of bounds.

        Returns:
            np.ndarray: Shifted 2D float32 image.
        """
        shift_y, shift_x = float(shift[0]), float(shift[1])

        # If shift is effectively zero, return contiguous copy
        if abs(shift_y) < 1e-4 and abs(shift_x) < 1e-4:
            return np.ascontiguousarray(image, dtype=np.float32)

        img_float = np.ascontiguousarray(image, dtype=np.float64)

        try:
            # scipy.ndimage.shift applies: output[y, x] = input[y - shift_y, x - shift_x]
            # Since shift aligns target to reference, positive shift moves pixels in direction of reference
            shifted = nd_shift(
                img_float,
                shift=(shift_y, shift_x),
                order=order,
                mode="constant",
                cval=cval,
                prefilter=True,
            )
            return np.ascontiguousarray(shifted, dtype=np.float32)

        except Exception as exc:
            logger.warning("scipy.ndimage.shift failed (%s); trying skimage.transform.warp", exc)
            # AffineTransform translation in (x, y) space
            tform = AffineTransform(translation=(-shift_x, -shift_y))
            shifted = warp(
                img_float,
                tform.inverse,
                order=order,
                mode="constant",
                cval=cval,
                preserve_range=True,
            )
            return np.ascontiguousarray(shifted, dtype=np.float32)

    def align_image_registration(
        self,
        reference: np.ndarray,
        target: np.ndarray,
        upsample_factor: int = 100,
    ) -> tuple[np.ndarray, tuple[float, float]]:
        """
        Align target to reference using phase cross-correlation from scikit-image.

        Args:
            reference: Reference 2D image.
            target: Target 2D image to be transformed.
            upsample_factor: Subpixel precision factor.

        Returns:
            tuple[np.ndarray, tuple[float, float]]: (aligned_image, (shift_y, shift_x))
        """
        shift = self.compute_shift(reference, target, upsample_factor=upsample_factor)
        aligned = self.apply_shift(target, shift)
        return aligned, shift

    def align_wcs(
        self,
        image: np.ndarray,
        wcs_from: WCS,
        wcs_to: WCS,
        output_shape: tuple[int, int] | None = None,
        order: int = 3,
        cval: float = 0.0,
    ) -> np.ndarray:
        """
        Reproject an image from one World Coordinate System (WCS) to another.
        Performs pixel -> world (sky) -> pixel mapping with spline interpolation.

        Args:
            image: 2D numpy array in source WCS frame.
            wcs_from: Source Astropy WCS.
            wcs_to: Target Astropy WCS.
            output_shape: Optional (ny, nx) shape of output image. Defaults to image.shape.
            order: Interpolation order (1=bilinear, 3=bicubic spline).
            cval: Fill value for coordinates outside source image boundary.

        Returns:
            np.ndarray: Reprojected 2D float32 image on target WCS grid.
        """
        if output_shape is None:
            output_shape = image.shape

        out_ny, out_nx = output_shape
        logger.info(
            "Reprojecting image from source WCS to target WCS (shape %s -> %s)",
            image.shape,
            output_shape,
        )

        try:
            # Generate meshgrid of output pixel coordinates (0-indexed)
            y_indices, x_indices = np.indices(output_shape, dtype=np.float64)

            # Convert output pixel coordinates to celestial sky coordinates (RA, Dec in deg)
            sky_coords = wcs_to.pixel_to_world(x_indices, y_indices)

            # Convert celestial coordinates to input pixel coordinates in source frame
            x_in, y_in = wcs_from.world_to_pixel(sky_coords)

            # Map coordinates with spline interpolation
            img_float = np.ascontiguousarray(image, dtype=np.float64)
            reprojected = map_coordinates(
                img_float,
                [y_in, x_in],
                order=order,
                mode="constant",
                cval=cval,
                prefilter=True,
            )

            # Mask out any non-finite pixels
            reprojected = np.nan_to_num(reprojected, nan=cval, posinf=cval, neginf=cval)
            return np.ascontiguousarray(reprojected, dtype=np.float32)

        except Exception as exc:
            logger.error("WCS reprojection failed: %s", exc)
            # If reprojection fails, return fallback scaled or zeros
            return np.full(output_shape, cval, dtype=np.float32)
