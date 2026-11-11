"""
OrbitScope - Astronomical Image Preprocessor
Performs background estimation, background subtraction, noise estimation,
robust normalization, and bad pixel / cosmic ray masking using photutils,
astropy.stats, and numpy.
"""
from __future__ import annotations

import numpy as np
from astropy.stats import SigmaClip, sigma_clipped_stats
from photutils.background import Background2D, MedianBackground, SExtractorBackground

from app.core.logging_config import get_logger

logger = get_logger("pipeline.preprocessor")


class ImagePreprocessor:
    """Preprocesses astronomical images for source detection and difference imaging."""

    def __init__(self, sigma_clip_val: float = 3.0, max_iters: int = 5) -> None:
        """
        Initialize the preprocessor.

        Args:
            sigma_clip_val: Sigma threshold for clipping outliers during stats estimation.
            max_iters: Maximum iterations for sigma clipping convergence.
        """
        self.sigma_clip_val = float(sigma_clip_val)
        self.max_iters = int(max_iters)
        self.sigma_clip = SigmaClip(sigma=self.sigma_clip_val, maxiters=self.max_iters)

    def estimate_background(
        self,
        image: np.ndarray,
        box_size: int = 64,
        filter_size: int = 3,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Estimate 2D background and RMS noise map using photutils Background2D.
        Uses MedianBackground estimator with sigma clipping.

        Args:
            image: 2D numpy array representing the raw or pre-cleaned image.
            box_size: Size of the background mesh box in pixels.
            filter_size: Window size for 2D median filter applied to mesh grid.

        Returns:
            tuple[np.ndarray, np.ndarray]: (background_map, background_rms_map)
        """
        img_float = np.ascontiguousarray(image, dtype=np.float64)

        # Handle non-finite values (NaN / Inf) if present
        nan_mask = ~np.isfinite(img_float)
        if np.any(nan_mask):
            finite_median = np.nanmedian(img_float)
            if not np.isfinite(finite_median):
                finite_median = 0.0
            img_float = np.where(nan_mask, finite_median, img_float)

        ny, nx = img_float.shape

        # Dynamically adjust box_size if image is smaller than mesh size
        min_dim = min(ny, nx)
        effective_box_size = box_size
        if min_dim < box_size:
            effective_box_size = max(4, min_dim // 2)

        # Ensure filter_size is odd and smaller than number of boxes
        effective_filter_size = filter_size if filter_size % 2 == 1 else filter_size + 1
        num_boxes_y = max(1, ny // effective_box_size)
        num_boxes_x = max(1, nx // effective_box_size)
        effective_filter_size = min(effective_filter_size, num_boxes_y, num_boxes_x)
        if effective_filter_size % 2 == 0:
            effective_filter_size = max(1, effective_filter_size - 1)

        try:
            bkg = Background2D(
                img_float,
                box_size=(effective_box_size, effective_box_size),
                filter_size=(effective_filter_size, effective_filter_size),
                bkg_estimator=MedianBackground(),
                sigma_clip=self.sigma_clip,
                fill_value=0.0,
            )
            bkg_data = np.ascontiguousarray(bkg.background, dtype=np.float32)
            bkg_rms = np.ascontiguousarray(bkg.background_rms, dtype=np.float32)
            
            # Guard against zero or NaN RMS
            bkg_rms = np.where(np.isfinite(bkg_rms) & (bkg_rms > 0), bkg_rms, 1.0)
            return bkg_data, bkg_rms

        except Exception as exc:
            logger.warning("Background2D mesh estimation failed (%s); falling back to scalar sigma clip", exc)
            _, median_val, std_val = sigma_clipped_stats(
                img_float, sigma=self.sigma_clip_val, maxiters=self.max_iters
            )
            if not np.isfinite(median_val):
                median_val = 0.0
            if not np.isfinite(std_val) or std_val <= 0:
                std_val = 1.0

            bkg_data = np.full(img_float.shape, median_val, dtype=np.float32)
            bkg_rms = np.full(img_float.shape, std_val, dtype=np.float32)
            return bkg_data, bkg_rms

    def subtract_background(
        self,
        image: np.ndarray,
        background: np.ndarray | None = None,
    ) -> np.ndarray:
        """
        Subtract background from image. If background is not provided, estimate it.

        Args:
            image: 2D numpy array.
            background: Optional pre-estimated 2D background array.

        Returns:
            np.ndarray: Background-subtracted 2D float32 image.
        """
        if background is None:
            background, _ = self.estimate_background(image)

        subtracted = (image.astype(np.float64) - background.astype(np.float64)).astype(np.float32)
        # Ensure finite values
        subtracted = np.nan_to_num(subtracted, nan=0.0, posinf=0.0, neginf=0.0)
        return subtracted

    def estimate_noise(self, image: np.ndarray) -> float:
        """
        Estimate global noise level (RMS standard deviation) using sigma-clipped statistics.

        Args:
            image: 2D numpy array.

        Returns:
            float: Robust standard deviation of the background noise.
        """
        clean_img = np.ascontiguousarray(image, dtype=np.float64)
        clean_img = clean_img[np.isfinite(clean_img)]

        if clean_img.size == 0:
            return 1.0

        _, _, std_val = sigma_clipped_stats(
            clean_img,
            sigma=self.sigma_clip_val,
            maxiters=self.max_iters,
        )

        if not np.isfinite(std_val) or std_val <= 0.0:
            # Fallback to median absolute deviation
            med = np.median(clean_img)
            mad = np.median(np.abs(clean_img - med))
            std_val = 1.4826 * mad
            if not np.isfinite(std_val) or std_val <= 0.0:
                std_val = 1.0

        return float(std_val)

    def normalize(self, image: np.ndarray) -> np.ndarray:
        """
        Normalize image to [0, 1] range using robust percentile scaling.
        Avoids outliers / hot pixels skewing the dynamic range.

        Args:
            image: 2D numpy array.

        Returns:
            np.ndarray: Normalized 2D float32 array in [0.0, 1.0].
        """
        img_float = np.ascontiguousarray(image, dtype=np.float64)
        finite_vals = img_float[np.isfinite(img_float)]

        if finite_vals.size == 0:
            return np.zeros_like(img_float, dtype=np.float32)

        p_low, p_high = np.percentile(finite_vals, [0.5, 99.5])
        dynamic_range = p_high - p_low

        if dynamic_range <= 1e-12:
            min_val = np.min(finite_vals)
            max_val = np.max(finite_vals)
            dynamic_range = max_val - min_val
            if dynamic_range <= 1e-12:
                return np.zeros_like(img_float, dtype=np.float32)
            p_low, p_high = min_val, max_val

        scaled = (img_float - p_low) / dynamic_range
        scaled = np.clip(scaled, 0.0, 1.0)
        return scaled.astype(np.float32)

    def create_bad_pixel_mask(
        self,
        image: np.ndarray,
        sigma_low: float = 5.0,
        sigma_high: float = 5.0,
    ) -> np.ndarray:
        """
        Create a boolean mask of bad pixels (hot pixels, dead pixels, NaNs, Infs).
        Uses sigma clipping to identify extreme outliers.

        Args:
            image: 2D numpy array.
            sigma_low: Lower threshold in standard deviations for dead pixels.
            sigma_high: Upper threshold in standard deviations for hot pixels / cosmic rays.

        Returns:
            np.ndarray: Boolean 2D mask where True indicates an invalid / bad pixel.
        """
        img_float = np.ascontiguousarray(image, dtype=np.float64)
        bad_mask = ~np.isfinite(img_float)

        finite_pixels = img_float[~bad_mask]
        if finite_pixels.size == 0:
            return np.ones(image.shape, dtype=bool)

        _, median_val, std_val = sigma_clipped_stats(
            finite_pixels,
            sigma=self.sigma_clip_val,
            maxiters=self.max_iters,
        )

        if not np.isfinite(std_val) or std_val <= 0:
            std_val = 1.0

        upper_bound = median_val + (sigma_high * std_val)
        lower_bound = median_val - (sigma_low * std_val)

        bad_mask |= (img_float > upper_bound) | (img_float < lower_bound)
        return bad_mask

    def process(self, image: np.ndarray) -> dict:
        """
        Full astronomical image preprocessing pipeline:
        1. Replace NaNs/Infs with local/global median.
        2. Create bad pixel mask.
        3. Estimate 2D background and RMS noise.
        4. Subtract background.
        5. Estimate global background noise.
        6. Normalize processed image to [0, 1].

        Args:
            image: Raw 2D input image array.

        Returns:
            dict containing:
                - processed_image (np.ndarray): Background-subtracted image (float32).
                - background (np.ndarray): 2D background map (float32).
                - background_rms (np.ndarray): 2D background RMS noise map (float32).
                - noise (float): Global background noise standard deviation.
                - bad_pixel_mask (np.ndarray): Boolean mask of bad pixels.
                - normalized_image (np.ndarray): Scaled [0, 1] image for visualization.
        """
        logger.info("Starting image preprocessing pipeline on image of shape %s", image.shape)
        
        # 1. Clean NaNs and infinite values
        clean_img = np.ascontiguousarray(image, dtype=np.float64)
        initial_mask = ~np.isfinite(clean_img)
        if np.any(initial_mask):
            finite_med = np.nanmedian(clean_img) if np.any(~initial_mask) else 0.0
            clean_img = np.where(initial_mask, finite_med, clean_img)

        # 2. Bad pixel mask
        bad_mask = self.create_bad_pixel_mask(clean_img)

        # 3. 2D Background estimation
        background, background_rms = self.estimate_background(clean_img)

        # 4. Background subtraction
        subtracted = self.subtract_background(clean_img, background=background)

        # 5. Global noise estimation
        noise = self.estimate_noise(subtracted)

        # 6. Normalization
        normalized = self.normalize(subtracted)

        logger.info("Image preprocessing completed: estimated global noise=%.4f", noise)

        return {
            "processed_image": subtracted,
            "background": background,
            "background_rms": background_rms,
            "noise": noise,
            "bad_pixel_mask": bad_mask,
            "normalized_image": normalized,
        }
