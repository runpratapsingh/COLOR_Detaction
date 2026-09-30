import cv2
import numpy as np
from app.core.config import settings


class ExposureDetector:
    """Analyzes image luminance histogram for underexposure, overexposure, and clipping."""

    def __init__(
        self,
        max_underexposed_pct: float | None = None,
        max_overexposed_pct: float | None = None,
    ):
        self.max_underexposed_pct = max_underexposed_pct or settings.MAX_UNDEREXPOSED_PERCENTAGE
        self.max_overexposed_pct = max_overexposed_pct or settings.MAX_OVEREXPOSED_PERCENTAGE

    def analyze(self, image_bgr: np.ndarray, roi_mask: np.ndarray | None = None) -> dict:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        if roi_mask is not None and np.sum(roi_mask > 0) > 0:
            pixels = gray[roi_mask > 0]
        else:
            pixels = gray.flatten()

        total_pixels = len(pixels)
        if total_pixels == 0:
            return {
                "mean_luminance": 0.0,
                "luminance_std": 0.0,
                "dark_pixel_pct": 0.0,
                "bright_pixel_pct": 0.0,
                "clipped_black_pct": 0.0,
                "clipped_white_pct": 0.0,
                "exposure_score": 0.0,
                "is_underexposed": False,
                "is_overexposed": False,
                "has_highlight_clipping": False,
                "has_shadow_clipping": False,
            }

        mean_lum = float(np.mean(pixels))
        std_lum = float(np.std(pixels))

        dark_pixels = int(np.sum(pixels < 15))
        bright_pixels = int(np.sum(pixels > 240))
        clipped_black = int(np.sum(pixels == 0))
        clipped_white = int(np.sum(pixels == 255))

        dark_pct = (dark_pixels / total_pixels) * 100.0
        bright_pct = (bright_pixels / total_pixels) * 100.0
        clipped_black_pct = (clipped_black / total_pixels) * 100.0
        clipped_white_pct = (clipped_white / total_pixels) * 100.0

        is_underexposed = bool(dark_pct > self.max_underexposed_pct or mean_lum < 35.0)
        is_overexposed = bool(bright_pct > self.max_overexposed_pct or mean_lum > 220.0)
        has_highlight_clipping = bool(clipped_white_pct > 2.0)
        has_shadow_clipping = bool(clipped_black_pct > 5.0)

        # Score calculation (100 is optimal luminance ~128 with low clipping)
        lum_diff = abs(mean_lum - 128.0) / 128.0
        clip_penalty = min(50.0, (clipped_white_pct + clipped_black_pct) * 2.5)
        exposure_score = max(0.0, min(100.0, (1.0 - lum_diff) * 100.0 - clip_penalty))

        return {
            "mean_luminance": round(mean_lum, 2),
            "luminance_std": round(std_lum, 2),
            "dark_pixel_pct": round(dark_pct, 2),
            "bright_pixel_pct": round(bright_pct, 2),
            "clipped_black_pct": round(clipped_black_pct, 2),
            "clipped_white_pct": round(clipped_white_pct, 2),
            "exposure_score": round(exposure_score, 1),
            "is_underexposed": is_underexposed,
            "is_overexposed": is_overexposed,
            "has_highlight_clipping": has_highlight_clipping,
            "has_shadow_clipping": has_shadow_clipping,
        }
