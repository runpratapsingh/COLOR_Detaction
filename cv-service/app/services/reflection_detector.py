import cv2
import numpy as np
from app.core.config import settings


class ReflectionDetector:
    """Detects specular highlights and diffused reflections on transparent/semi-transparent bottle surfaces."""

    def __init__(self, max_reflection_pct: float | None = None):
        self.max_reflection_pct = max_reflection_pct or settings.MAX_REFLECTION_PERCENTAGE

    def analyze(self, image_bgr: np.ndarray, roi_mask: np.ndarray | None = None) -> dict:
        hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)

        # 1. Specular Highlights: High Brightness + Low Saturation (clipped white/hotspots)
        specular_mask = (v >= 230) & (s <= 55)

        # 2. Diffused Glass Reflections: High Local Luminance Gradient on V channel
        v_lap = np.abs(cv2.Laplacian(v, cv2.CV_64F))
        local_peak_mask = (v_lap > 45) & (v >= 195)

        # 3. Combined highlight mask
        raw_mask = np.uint8((specular_mask | local_peak_mask) * 255)

        # Morphological dilation to safely exclude transition/penumbra glare pixels
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        reflection_mask = cv2.dilate(raw_mask, kernel, iterations=1)

        if roi_mask is not None:
            reflection_mask = cv2.bitwise_and(reflection_mask, roi_mask)
            total_roi_pixels = int(np.sum(roi_mask > 0))
        else:
            total_roi_pixels = int(image_bgr.shape[0] * image_bgr.shape[1])

        reflection_pixels = int(np.sum(reflection_mask > 0))
        reflection_pct = (
            (reflection_pixels / total_roi_pixels * 100.0) if total_roi_pixels > 0 else 0.0
        )

        is_excessive = reflection_pct > self.max_reflection_pct
        reflection_score = max(0.0, min(100.0, 100.0 - (reflection_pct * 2.5)))

        return {
            "reflection_mask": reflection_mask,
            "reflection_percentage": round(reflection_pct, 2),
            "reflection_score": round(reflection_score, 1),
            "is_excessive_reflection": is_excessive,
            "threshold": self.max_reflection_pct,
        }
