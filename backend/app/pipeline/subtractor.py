"""
OrbitScope - Astronomical Image Subtractor
Performs image subtraction with PSF matching (optimal Fourier / least-squares
kernel deconvolution) and difference significance residual analysis.
"""
from __future__ import annotations

from typing import Any
import numpy as np
from astropy.stats import sigma_clipped_stats
from scipy.ndimage import convolve, maximum_filter, minimum_filter
from scipy.signal import fftconvolve

from app.core.logging_config import get_logger

logger = get_logger("pipeline.subtractor")


class ImageSubtractor:
    """Performs astronomical image subtraction for transient and moving object detection."""

    def __init__(self, default_kernel_size: int = 7) -> None:
        """
        Initialize the ImageSubtractor.

        Args:
            default_kernel_size: Size (in pixels) of the convolution kernel for PSF matching.
        """
        self.default_kernel_size = int(default_kernel_size if default_kernel_size % 2 == 1 else default_kernel_size + 1)

    def simple_difference(self, reference: np.ndarray, target: np.ndarray) -> np.ndarray:
        """
        Compute direct pixel-by-pixel difference: (target - reference).

        Args:
            reference: 2D numpy array (reference epoch image).
            target: 2D numpy array (target / current epoch image).

        Returns:
            np.ndarray: 2D float32 difference image.
        """
        ref_float = np.ascontiguousarray(reference, dtype=np.float64)
        tgt_float = np.ascontiguousarray(target, dtype=np.float64)

        diff = tgt_float - ref_float
        diff = np.nan_to_num(diff, nan=0.0, posinf=0.0, neginf=0.0)
        return np.ascontiguousarray(diff, dtype=np.float32)

    def matched_filter_difference(
        self,
        reference: np.ndarray,
        target: np.ndarray,
        kernel_size: int | None = None,
        reg_factor: float = 1e-3,
    ) -> np.ndarray:
        """
        Image subtraction with Point Spread Function (PSF) kernel matching.
        Estimates the optical transfer kernel K such that (reference * K) ~ target
        via regularized Wiener deconvolution in Fourier space, then computes (target - reference * K).

        Args:
            reference: 2D numpy array (reference epoch image).
            target: 2D numpy array (target epoch image).
            kernel_size: Odd integer kernel diameter (default 7).
            reg_factor: Tikhonov regularization factor to avoid high-frequency noise amplification.

        Returns:
            np.ndarray: 2D float32 matched-difference image.
        """
        k_size = kernel_size or self.default_kernel_size
        if k_size % 2 == 0:
            k_size += 1

        ref_float = np.ascontiguousarray(reference, dtype=np.float64)
        tgt_float = np.ascontiguousarray(target, dtype=np.float64)

        # Ensure finite clean inputs
        ref_clean = np.nan_to_num(ref_float, nan=0.0, posinf=0.0, neginf=0.0)
        tgt_clean = np.nan_to_num(tgt_float, nan=0.0, posinf=0.0, neginf=0.0)

        ny, nx = ref_clean.shape

        try:
            # Fourier transforms of reference and target
            r_fft = np.fft.rfft2(ref_clean)
            t_fft = np.fft.rfft2(tgt_clean)

            # Wiener deconvolution transfer function
            # K_fft = (T * conj(R)) / (|R|^2 + lambda * max(|R|^2))
            r_power = np.abs(r_fft) ** 2
            max_power = np.max(r_power)
            if max_power <= 1e-12:
                logger.warning("Reference image has zero power; falling back to simple difference")
                return self.simple_difference(reference, target)

            reg_epsilon = reg_factor * max_power
            k_fft = (t_fft * np.conj(r_fft)) / (r_power + reg_epsilon)

            # Spatial kernel
            k_spatial = np.fft.irfft2(k_fft, s=(ny, nx))
            k_spatial = np.fft.fftshift(k_spatial)

            # Crop kernel to central (k_size, k_size)
            cy, cx = ny // 2, nx // 2
            half_k = k_size // 2
            kernel_crop = k_spatial[cy - half_k : cy + half_k + 1, cx - half_k : cx + half_k + 1]

            # Normalize kernel flux
            kernel_sum = np.sum(kernel_crop)
            if np.isfinite(kernel_sum) and abs(kernel_sum) > 1e-4:
                # Retain relative photometric scale
                ref_flux = np.sum(ref_clean[ref_clean > 0])
                tgt_flux = np.sum(tgt_clean[tgt_clean > 0])
                if ref_flux > 0 and tgt_flux > 0:
                    scale = tgt_flux / ref_flux
                    kernel_crop = (kernel_crop / kernel_sum) * scale
                else:
                    kernel_crop = kernel_crop / kernel_sum
            else:
                kernel_crop = np.zeros((k_size, k_size), dtype=np.float64)
                kernel_crop[half_k, half_k] = 1.0

            # Convolve reference with matching kernel
            matched_ref = fftconvolve(ref_clean, kernel_crop, mode="same")
            diff = tgt_clean - matched_ref
            diff = np.nan_to_num(diff, nan=0.0, posinf=0.0, neginf=0.0)
            logger.debug("Matched-filter subtraction completed with %dx%d kernel", k_size, k_size)
            return np.ascontiguousarray(diff, dtype=np.float32)

        except Exception as exc:
            logger.warning("Matched-filter subtraction failed (%s); falling back to simple difference", exc)
            return self.simple_difference(reference, target)

    def compute_significance_map(
        self,
        difference: np.ndarray,
        noise_map: np.ndarray | None = None,
    ) -> np.ndarray:
        """
        Compute signal-to-noise ratio (SNR) significance map from difference image.

        Args:
            difference: 2D numpy array representing image difference.
            noise_map: Optional 2D noise map (RMS). If None, estimated via sigma clipping.

        Returns:
            np.ndarray: 2D float32 significance map (in units of sigma).
        """
        diff_float = np.ascontiguousarray(difference, dtype=np.float64)
        clean_diff = np.nan_to_num(diff_float, nan=0.0, posinf=0.0, neginf=0.0)

        if noise_map is None:
            _, _, std_noise = sigma_clipped_stats(clean_diff, sigma=3.0, maxiters=5)
            if not np.isfinite(std_noise) or std_noise <= 0:
                std_noise = 1.0
            sig_map = clean_diff / std_noise
        else:
            noise_clean = np.where(
                np.isfinite(noise_map) & (noise_map > 1e-6),
                noise_map,
                1.0,
            )
            sig_map = clean_diff / noise_clean

        sig_map = np.nan_to_num(sig_map, nan=0.0, posinf=0.0, neginf=0.0)
        return np.ascontiguousarray(sig_map, dtype=np.float32)

    def detect_residuals(
        self,
        significance_map: np.ndarray,
        threshold_sigma: float = 5.0,
        box_radius: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Find significant positive and negative residuals in the significance map.
        Positive residuals indicate new or brightening sources in target epoch.
        Negative residuals indicate vanished or faded sources in target epoch.

        Args:
            significance_map: 2D numpy array of SNR values.
            threshold_sigma: Significance threshold.
            box_radius: Radius in pixels for local peak finding.

        Returns:
            list[dict]: List of detected residuals with x, y, significance, flux, and type.
        """
        sig_float = np.ascontiguousarray(significance_map, dtype=np.float64)
        sig_clean = np.nan_to_num(sig_float, nan=0.0, posinf=0.0, neginf=0.0)
        ny, nx = sig_clean.shape

        filter_size = (2 * box_radius) + 1
        residuals: list[dict[str, Any]] = []

        # 1. Detect positive peaks
        pos_peaks = (sig_clean == maximum_filter(sig_clean, size=filter_size)) & (sig_clean >= threshold_sigma)
        pos_y, pos_x = np.nonzero(pos_peaks)

        for y, x in zip(pos_y, pos_x):
            # Avoid image borders
            if x < 2 or x >= nx - 2 or y < 2 or y >= ny - 2:
                continue

            significance = float(sig_clean[y, x])
            # Local aperture flux estimate (3x3 sum)
            y0, y1 = max(0, y - 1), min(ny, y + 2)
            x0, x1 = max(0, x - 1), min(nx, x + 2)
            flux = float(np.sum(sig_clean[y0:y1, x0:x1]))

            residuals.append(
                {
                    "x": round(float(x), 2),
                    "y": round(float(y), 2),
                    "significance": round(significance, 2),
                    "flux": round(flux, 2),
                    "type": "positive",
                }
            )

        # 2. Detect negative peaks (dipoles / vanished sources)
        neg_peaks = (sig_clean == minimum_filter(sig_clean, size=filter_size)) & (sig_clean <= -threshold_sigma)
        neg_y, neg_x = np.nonzero(neg_peaks)

        for y, x in zip(neg_y, neg_x):
            if x < 2 or x >= nx - 2 or y < 2 or y >= ny - 2:
                continue

            significance = float(sig_clean[y, x])
            y0, y1 = max(0, y - 1), min(ny, y + 2)
            x0, x1 = max(0, x - 1), min(nx, x + 2)
            flux = float(np.sum(sig_clean[y0:y1, x0:x1]))

            residuals.append(
                {
                    "x": round(float(x), 2),
                    "y": round(float(y), 2),
                    "significance": round(significance, 2),
                    "flux": round(flux, 2),
                    "type": "negative",
                }
            )

        # Sort residuals descending by absolute significance
        residuals.sort(key=lambda item: abs(item["significance"]), reverse=True)
        logger.info("Detected %d significant residuals (threshold=%.1f sigma)", len(residuals), threshold_sigma)
        return residuals

    def subtract(
        self,
        reference: np.ndarray,
        target: np.ndarray,
        method: str = "matched",
        threshold_sigma: float = 5.0,
    ) -> dict[str, Any]:
        """
        Full astronomical image subtraction pipeline:
        1. Compute difference image (matched filter or simple).
        2. Compute significance (SNR) map.
        3. Detect significant positive and negative residuals.

        Args:
            reference: Reference image array.
            target: Target image array.
            method: "matched" or "simple".
            threshold_sigma: Significance threshold for residual isolation.

        Returns:
            dict containing:
                - difference (np.ndarray): 2D difference array.
                - significance_map (np.ndarray): 2D SNR significance map.
                - residuals (list[dict]): Detected significant residuals.
                - noise (float): Robust standard deviation of difference background.
                - method (str): Subtraction method executed.
        """
        method_clean = method.lower().strip()
        if method_clean in ("matched", "psf_match", "wiener"):
            diff = self.matched_filter_difference(reference, target)
        else:
            diff = self.simple_difference(reference, target)

        _, _, noise = sigma_clipped_stats(diff, sigma=3.0, maxiters=5)
        if not np.isfinite(noise) or noise <= 0:
            noise = 1.0

        sig_map = self.compute_significance_map(diff)
        residuals = self.detect_residuals(sig_map, threshold_sigma=threshold_sigma)

        return {
            "difference": diff,
            "significance_map": sig_map,
            "residuals": residuals,
            "noise": float(noise),
            "method": method_clean,
        }
