"""Checks whether the image background behind a transparent bottle is neutral (white/gray).

A colored background (green grass, blue sky, red wall) transmits light through
transparent glass and contaminates the liquid color reading — this is the #1
outdoor field error.

Samples a ring of pixels around (but outside) the detected bottle bounding box,
converts to CIE L*a*b*, and checks that |a*| and |b*| are within the neutral
threshold.  High |a*| or |b*| means the background has a strong color cast.
"""
from __future__ import annotations

import cv2
import numpy as np

from app.core.config import settings
from app.core.logging import logger


class BackgroundChecker:
    """Validates that the image background is color-neutral for accurate liquid color measurement."""

    def __init__(
        self,
        max_lab_a: float | None = None,
        max_lab_b: float | None = None,
        min_lab_l: float | None = None,
        max_lab_l: float | None = None,
    ):
        self.max_lab_a = max_lab_a or settings.MAX_BACKGROUND_LAB_A
        self.max_lab_b = max_lab_b or settings.MAX_BACKGROUND_LAB_B
        self.min_lab_l = min_lab_l if min_lab_l is not None else settings.MIN_BACKGROUND_LAB_L
        self.max_lab_l = max_lab_l if max_lab_l is not None else settings.MAX_BACKGROUND_LAB_L

    def analyze(
        self,
        image_bgr: np.ndarray,
        bottle_bbox: tuple[int, int, int, int] | None,
    ) -> dict:
        """Analyze the background region around the bottle for color neutrality.

        Args:
            image_bgr: Full image in BGR format.
            bottle_bbox: (x, y, w, h) bounding box of the detected bottle.
                         If None, samples the image border regions as fallback.

        Returns:
            Dict with median_lab_a, median_lab_b, is_colored, dominant_cast description.
        """
        img_h, img_w = image_bgr.shape[:2]

        if bottle_bbox is not None:
            bx, by, bw, bh = bottle_bbox
            bg_mask = np.ones((img_h, img_w), dtype=np.uint8) * 255
            # Zero out the bottle region so we only sample outside it
            # Expand the bottle box slightly inward to avoid edge pixels
            inset = 5
            x1 = max(0, bx + inset)
            y1 = max(0, by + inset)
            x2 = min(img_w, bx + bw - inset)
            y2 = min(img_h, by + bh - inset)
            bg_mask[y1:y2, x1:x2] = 0
        else:
            # Fallback: sample the outer 15% border strip of the image
            bg_mask = np.zeros((img_h, img_w), dtype=np.uint8)
            margin_y = int(img_h * 0.15)
            margin_x = int(img_w * 0.15)
            bg_mask[:margin_y, :] = 255  # top strip
            bg_mask[img_h - margin_y:, :] = 255  # bottom strip
            bg_mask[:, :margin_x] = 255  # left strip
            bg_mask[:, img_w - margin_x:] = 255  # right strip

        # Extract background pixels
        bg_pixels_bgr = image_bgr[bg_mask > 0]

        if bg_pixels_bgr.shape[0] < 100:
            logger.warning("BackgroundChecker: too few background pixels to analyze")
            return {
                "median_lab_a": 0.0,
                "median_lab_b": 0.0,
                "median_lab_l": 0.0,
                "is_colored": False,
                "is_too_dark": False,
                "is_too_bright": False,
                "dominant_cast": "unknown",
                "bg_pixel_count": int(bg_pixels_bgr.shape[0]),
            }

        # Convert to CIE L*a*b*
        # Reshape to a 1-row image for cvtColor
        bg_rgb = cv2.cvtColor(
            bg_pixels_bgr.reshape(1, -1, 3), cv2.COLOR_BGR2RGB
        )
        bg_lab = cv2.cvtColor(bg_rgb, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)

        # OpenCV LAB ranges: L [0,255], a [0,255] (128=neutral), b [0,255] (128=neutral)
        # Convert to standard CIE Lab: L [0,100], a [-128,127], b [-128,127]
        lab_l = bg_lab[:, 0] * (100.0 / 255.0)
        lab_a = bg_lab[:, 1] - 128.0
        lab_b = bg_lab[:, 2] - 128.0

        median_l = float(np.median(lab_l))
        median_a = float(np.median(lab_a))
        median_b = float(np.median(lab_b))

        is_colored = abs(median_a) > self.max_lab_a or abs(median_b) > self.max_lab_b
        is_too_dark = median_l < self.min_lab_l
        is_too_bright = median_l > self.max_lab_l

        # Describe the dominant color cast for user-friendly messages
        dominant_cast = "neutral"
        if is_colored:
            if median_a > self.max_lab_a:
                dominant_cast = "reddish/magenta"
            elif median_a < -self.max_lab_a:
                dominant_cast = "greenish"
            elif median_b > self.max_lab_b:
                dominant_cast = "yellowish"
            elif median_b < -self.max_lab_b:
                dominant_cast = "bluish"

        return {
            "median_lab_a": round(median_a, 1),
            "median_lab_b": round(median_b, 1),
            "median_lab_l": round(median_l, 1),
            "is_colored": bool(is_colored),
            "is_too_dark": bool(is_too_dark),
            "is_too_bright": bool(is_too_bright),
            "dominant_cast": dominant_cast,
            "bg_pixel_count": int(bg_pixels_bgr.shape[0]),
        }
