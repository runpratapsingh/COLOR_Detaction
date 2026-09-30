"""Image loading, validation, resizing, quality checks, and overlay rendering."""
from __future__ import annotations

import base64
from dataclasses import dataclass, field

import cv2
import numpy as np

MAX_WORKING_DIM = 1000
MIN_DIM = 40


@dataclass
class QualityStats:
    overexposed_fraction: float
    underexposed_fraction: float
    blur_score: float
    mean_brightness: float
    warnings: list[str] = field(default_factory=list)


def decode_image(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image. Supported formats: JPG, PNG, WEBP.")
    h, w = bgr.shape[:2]
    if h < MIN_DIM or w < MIN_DIM:
        raise ValueError("Image is too small to analyze reliably.")
    return bgr


def resize_for_processing(bgr: np.ndarray) -> tuple[np.ndarray, float]:
    h, w = bgr.shape[:2]
    scale = min(1.0, MAX_WORKING_DIM / max(h, w))
    if scale < 1.0:
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return bgr, scale


def assess_quality(bgr: np.ndarray) -> QualityStats:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    v_channel = hsv[:, :, 2].astype(np.float32)

    overexposed_fraction = float(np.mean(v_channel > 250))
    underexposed_fraction = float(np.mean(v_channel < 15))
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_brightness = float(v_channel.mean())

    warnings: list[str] = []
    if overexposed_fraction > 0.15:
        warnings.append(
            "The image appears overexposed. Color measurement may be unreliable."
        )
    if underexposed_fraction > 0.4:
        warnings.append(
            "The image appears underexposed / too dark. Color measurement may be unreliable."
        )
    if blur_score < 40:
        warnings.append("The image appears blurry. Please retake with a steadier shot.")

    return QualityStats(
        overexposed_fraction=overexposed_fraction,
        underexposed_fraction=underexposed_fraction,
        blur_score=blur_score,
        mean_brightness=mean_brightness,
        warnings=warnings,
    )


def draw_roi_overlay(
    bgr: np.ndarray,
    roi_box: tuple[int, int, int, int],
    bottle_box: tuple[int, int, int, int] | None = None,
) -> np.ndarray:
    """Return a copy of the image annotated with the bottle box and sampled ROI."""
    overlay = bgr.copy()
    if bottle_box is not None:
        bx, by, bw, bh = bottle_box
        cv2.rectangle(overlay, (bx, by), (bx + bw, by + bh), (255, 180, 0), 2)
    x, y, w, h = roi_box
    cv2.rectangle(overlay, (x, y), (x + w, y + h), (0, 255, 0), 2)
    cv2.putText(
        overlay,
        "sampled liquid ROI",
        (x, max(0, y - 8)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (0, 255, 0),
        1,
        cv2.LINE_AA,
    )
    return overlay


def encode_png_base64(bgr: np.ndarray) -> str:
    success, buf = cv2.imencode(".png", bgr)
    if not success:
        raise ValueError("Failed to encode processed image.")
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
