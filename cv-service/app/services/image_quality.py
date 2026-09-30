import numpy as np
from app.core.config import settings
from app.core.constants import RejectionReason
from app.services.blur_detector import BlurDetector
from app.services.exposure_detector import ExposureDetector
from app.services.reflection_detector import ReflectionDetector
from app.services.color_extractor import ColorExtractor
from app.services.delta_e import DeltaEService


class ImageQualityService:
    """Evaluates overall image quality, component quality scores, and rejection conditions."""

    def __init__(self):
        self.blur_detector = BlurDetector()
        self.exposure_detector = ExposureDetector()
        self.reflection_detector = ReflectionDetector()
        self.color_extractor = ColorExtractor()

    def evaluate(
        self,
        image_bgr: np.ndarray,
        roi_info: dict,
    ) -> dict:
        liquid_mask = roi_info["liquid_mask"]
        bottle_mask = roi_info.get("bottle_mask", liquid_mask)
        rejection_reasons = []

        # 1. Blur Detection (Informational metric only — non-blocking per requirement)
        blur_res = self.blur_detector.analyze(image_bgr, roi_mask=bottle_mask)
        # Blur/focus validation disabled for now per user request

        # 2. Exposure Detection
        exposure_res = self.exposure_detector.analyze(image_bgr, roi_mask=liquid_mask)
        if exposure_res["is_underexposed"]:
            rejection_reasons.append(RejectionReason.UNDEREXPOSED)
        if exposure_res["is_overexposed"] or exposure_res["has_highlight_clipping"]:
            rejection_reasons.append(RejectionReason.OVEREXPOSED)

        # 3. Reflection Detection (Informational metric & masking only — non-blocking)
        reflection_res = self.reflection_detector.analyze(image_bgr, roi_mask=liquid_mask)

        # 4. Color Extraction on Liquid ROI
        color_res = self.color_extractor.extract(
            image_bgr,
            liquid_mask=liquid_mask,
            reflection_mask=reflection_res["reflection_mask"],
        )

        valid_pct = color_res["valid_pixel_percentage"]
        if valid_pct < settings.MIN_VALID_PIXEL_PERCENTAGE:
            rejection_reasons.append(RejectionReason.INSUFFICIENT_VALID_PIXELS)

        # 5. Multi-ROI Spatial Uniformity Check (Center vs Bottom liquid regions)
        spatial_rois = roi_info["spatial_rois"]
        center_res = self.color_extractor.extract(image_bgr, spatial_rois["center"]["mask"], reflection_res["reflection_mask"])
        bottom_res = self.color_extractor.extract(image_bgr, spatial_rois["bottom"]["mask"], reflection_res["reflection_mask"])

        center_lab = (center_res["lab"]["l"], center_res["lab"]["a"], center_res["lab"]["b"])
        bottom_lab = (bottom_res["lab"]["l"], bottom_res["lab"]["a"], bottom_res["lab"]["b"])

        de_center_bottom = DeltaEService.delta_e_2000(center_lab, bottom_lab)

        is_non_uniform = de_center_bottom > settings.MAX_ROI_COLOR_VARIATION_DELTA_E
        if is_non_uniform:
            rejection_reasons.append(RejectionReason.NON_UNIFORM_COLOR)

        uniformity_score = max(0.0, min(100.0, 100.0 - (de_center_bottom * 5.0)))
        valid_pixel_score = min(100.0, valid_pct * 1.25)

        # Overall Quality Weighted Average (0-100) — glare and blur don't penalize pass/fail
        reflection_norm = max(reflection_res["reflection_score"], 80.0)
        blur_norm = max(blur_res["blur_score"], 80.0)
        overall_score = (
            0.30 * blur_norm
            + 0.30 * exposure_res["exposure_score"]
            + 0.10 * reflection_norm
            + 0.15 * uniformity_score
            + 0.15 * valid_pixel_score
        )
        overall_score = round(max(0.0, min(100.0, overall_score)), 1)

        if overall_score < settings.MIN_QUALITY_SCORE and RejectionReason.POOR_QUALITY_SCORE not in rejection_reasons:
            rejection_reasons.append(RejectionReason.POOR_QUALITY_SCORE)

        # Deduplicate reasons while preserving order
        unique_reasons = list(dict.fromkeys(rejection_reasons))

        return {
            "overall_score": overall_score,
            "blur_score": blur_res["blur_score"],
            "exposure_score": exposure_res["exposure_score"],
            "reflection_score": reflection_res["reflection_score"],
            "roi_uniformity_score": round(uniformity_score, 1),
            "valid_pixel_percentage": valid_pct,
            "max_spatial_delta_e": de_center_bottom,
            "blur_details": blur_res,
            "exposure_details": exposure_res,
            "reflection_details": reflection_res,
            "extracted_color": color_res,
            "quality_validation": {
                "is_blurry": bool(blur_res["is_blurry"]),
                "is_reflection_excessive": bool(reflection_res["is_excessive_reflection"]),
                "is_underexposed": bool(exposure_res["is_underexposed"]),
                "is_overexposed": bool(exposure_res["is_overexposed"] or exposure_res["has_highlight_clipping"]),
                "is_non_uniform": bool(is_non_uniform),
                "is_insufficient_pixels": bool(valid_pct < settings.MIN_VALID_PIXEL_PERCENTAGE),
            },
            "rejection_reasons": [r.value for r in unique_reasons],
            "should_reject": len(unique_reasons) > 0,
        }

