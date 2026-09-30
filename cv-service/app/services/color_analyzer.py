"""Robust color extraction from a liquid ROI and estimated-confidence scoring."""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from app.utils.color_utils import nearest_color_name, rgb_to_hex, rgb_to_hsv_deg, rgb_to_lab

Box = tuple[int, int, int, int]

# Specular highlight: very bright and desaturated.
HIGHLIGHT_V = 235
HIGHLIGHT_S = 60
# Shadow: very dark.
SHADOW_V = 25


@dataclass
class ColorExtractionResult:
    median_rgb: tuple[int, int, int]
    std_rgb: tuple[float, float, float]
    total_pixels: int
    kept_pixels: int
    highlight_clipped_fraction: float


def extract_liquid_color(bgr: np.ndarray, roi: Box) -> ColorExtractionResult:
    x, y, w, h = roi
    img_h, img_w = bgr.shape[:2]
    x = max(0, min(x, img_w - 1))
    y = max(0, min(y, img_h - 1))
    w = max(1, min(w, img_w - x))
    h = max(1, min(h, img_h - y))

    crop = bgr[y : y + h, x : x + w]
    if crop.size == 0:
        raise ValueError("Selected region is empty or out of bounds.")

    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).reshape(-1, 3).astype(np.float32)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV).reshape(-1, 3).astype(np.float32)
    # OpenCV HSV: H in [0,180), S,V in [0,255]
    s = hsv[:, 1] / 255.0 * 100
    v = hsv[:, 2] / 255.0 * 100

    highlight_mask = (v > (HIGHLIGHT_V / 255 * 100)) & (s < HIGHLIGHT_S)
    shadow_mask = v < (SHADOW_V / 255 * 100)
    keep_mask = ~(highlight_mask | shadow_mask)

    total = rgb.shape[0]
    filtered = rgb[keep_mask]

    if filtered.shape[0] < max(20, total * 0.05):
        # Highlight/shadow removal ate almost everything (e.g. a very small ROI).
        # Fall back to excluding only the most extreme highlight pixels.
        fallback_mask = ~highlight_mask
        filtered = rgb[fallback_mask] if fallback_mask.sum() > 0 else rgb

    kept = filtered.shape[0]
    median = np.median(filtered, axis=0)
    std = np.std(filtered, axis=0)

    return ColorExtractionResult(
        median_rgb=(int(round(median[0])), int(round(median[1])), int(round(median[2]))),
        std_rgb=(float(std[0]), float(std[1]), float(std[2])),
        total_pixels=total,
        kept_pixels=kept,
        highlight_clipped_fraction=float(highlight_mask.mean()),
    )


def build_color_readout(extraction: ColorExtractionResult) -> dict:
    rgb = extraction.median_rgb
    h, s, v = rgb_to_hsv_deg(rgb)
    l, a, b = rgb_to_lab(rgb)
    return {
        "rgb": {"r": rgb[0], "g": rgb[1], "b": rgb[2]},
        "hex": rgb_to_hex(rgb),
        "hsv": {"h": h, "s": s, "v": v},
        "lab": {"l": round(l, 1), "a": round(a, 1), "b": round(b, 1)},
        "colorName": nearest_color_name(rgb),
    }


def estimate_confidence(
    extraction: ColorExtractionResult,
    roi: Box,
    image_shape: tuple[int, int],
    detection_confidence: float,
    overexposed_fraction: float,
    underexposed_fraction: float,
) -> tuple[int, list[str]]:
    """Combine measurable factors into an approximate 0-100 confidence score.

    This is explicitly NOT a probability that the chemical is a given color —
    it reflects how trustworthy the pixel measurement itself looks (enough
    sample pixels, low color variance, sane exposure, ROI plausibly found).
    """
    warnings: list[str] = []

    img_h, img_w = image_shape
    roi_area_fraction = (roi[2] * roi[3]) / max(img_w * img_h, 1)
    roi_size_score = min(1.0, roi_area_fraction / 0.03)
    if roi_area_fraction < 0.005:
        warnings.append("The selected/detected region is very small; results may be noisy.")

    kept_ratio = extraction.kept_pixels / max(extraction.total_pixels, 1)
    sample_score = min(1.0, kept_ratio / 0.4)
    if kept_ratio < 0.15:
        warnings.append(
            "Most pixels in the region were excluded as highlights or shadows; "
            "measurement may be unreliable."
        )

    mean_std = float(np.mean(extraction.std_rgb))
    consistency_score = max(0.0, 1.0 - min(1.0, mean_std / 45.0))
    if mean_std > 35:
        warnings.append("Color varies a lot across the sampled region (possible reflections).")

    if extraction.highlight_clipped_fraction > 0.35:
        warnings.append("Strong reflection detected in the sampled region.")

    exposure_penalty = min(1.0, overexposed_fraction * 2 + underexposed_fraction)
    exposure_score = max(0.0, 1.0 - exposure_penalty)

    weights = {
        "detection": 0.25,
        "roi_size": 0.15,
        "sample": 0.2,
        "consistency": 0.25,
        "exposure": 0.15,
    }
    score = (
        weights["detection"] * detection_confidence
        + weights["roi_size"] * roi_size_score
        + weights["sample"] * sample_score
        + weights["consistency"] * consistency_score
        + weights["exposure"] * exposure_score
    )

    # A uniform, well-exposed ROI can look perfectly "consistent" even when it
    # landed on background rather than liquid (e.g. bottle contour not found).
    # Cap the score in that case so confidence reflects ROI trustworthiness,
    # not just pixel uniformity.
    if detection_confidence < 0.5:
        score = min(score, 0.55)

    return int(round(score * 100)), warnings
