import cv2
import numpy as np
from app.core.config import settings


class BlurDetector:
    """Detects image blur using Variance of Laplacian method."""

    def __init__(self, threshold: float | None = None):
        self.threshold = threshold if threshold is not None else settings.BLUR_THRESHOLD

    def analyze(self, image_bgr: np.ndarray, roi_mask: np.ndarray | None = None) -> dict:
        """
        Calculates Laplacian variance on grayscale image.
        Returns variance, normalized blur score (0-100), and is_blurry flag.
        """
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        if roi_mask is not None:
            roi_pixels = gray[roi_mask > 0]
            if len(roi_pixels) == 0:
                laplacian_var = 0.0
            else:
                # Compute laplacian on masked region
                lap = cv2.Laplacian(gray, cv2.CV_64F)
                laplacian_var = float(np.var(lap[roi_mask > 0]))
        else:
            laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Normalize score between 0 and 100 where >= threshold yields score >= 60
        target_scale = max(1.0, self.threshold * 1.5)
        score = min(100.0, max(0.0, (laplacian_var / target_scale) * 100.0))
        is_blurry = laplacian_var < self.threshold

        return {
            "laplacian_variance": round(laplacian_var, 2),
            "blur_score": round(score, 1),
            "is_blurry": is_blurry,
            "threshold": self.threshold,
        }
