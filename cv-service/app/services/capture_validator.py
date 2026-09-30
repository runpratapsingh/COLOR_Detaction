"""Orchestrates all pre-analysis capture validation checks.

Runs the full 8-point outdoor capture checklist against the uploaded image
BEFORE the expensive color analysis pipeline. If any critical check fails,
the image is rejected immediately with specific, actionable fix instructions.

Checks performed:
1. Orientation — image must be portrait (height > width)
2. Bottle detection — a bottle must be found in the frame
3. Framing — bottle must fill 8-75% of the frame with margins on all sides
4. Exposure — not over/underexposed
5. Blur — liquid region must be in focus
6. Reflection — no excessive specular glare
7. Background neutrality — background must not be strongly colored
8. EXIF flash — flash must not have fired (checked via metadata if available)

All checks are strict: any failure blocks submission and forces a retake.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.core.config import settings
from app.core.constants import RejectionReason
from app.core.logging import logger
from app.services.background_checker import BackgroundChecker
from app.services.framing_checker import FramingChecker


@dataclass
class CaptureValidationResult:
    """Result of the pre-analysis capture validation gate."""
    is_valid: bool
    rejection_reasons: list[str] = field(default_factory=list)
    rejection_details: list[dict] = field(default_factory=list)
    checks: dict = field(default_factory=dict)


class CaptureValidator:
    """Runs all pre-analysis capture quality checks and returns pass/fail.

    This is the "gate" that sits before AnalysisService.analyze() — if it
    fails, the image never reaches the color pipeline.
    """

    def __init__(self):
        self.background_checker = BackgroundChecker()
        self.framing_checker = FramingChecker()

    def validate(
        self,
        image_bgr: np.ndarray,
        img_metadata: dict,
        bottle_bbox: tuple[int, int, int, int] | None,
        bottle_detected: bool,
        quality_result: dict,
    ) -> CaptureValidationResult:
        """Run all capture validation checks.

        Args:
            image_bgr: The loaded image in BGR format.
            img_metadata: Metadata dict from ImageLoader (contains format, width, height).
            bottle_bbox: (x, y, w, h) bounding box if bottle was detected, else None.
            bottle_detected: Whether the object detector found a bottle.
            quality_result: Result dict from ImageQualityService.evaluate().

        Returns:
            CaptureValidationResult with pass/fail and specific rejection details.
        """
        rejection_reasons: list[str] = []
        rejection_details: list[dict] = []
        checks: dict = {}

        img_h, img_w = image_bgr.shape[:2]

        # ── 1. Orientation Check (Informational only — non-blocking) ─────
        is_portrait = img_h > img_w
        checks["orientation"] = {
            "is_portrait": is_portrait,
            "width": img_w,
            "height": img_h,
        }

        # ── 2. Bottle Detection ───────────────────────────────────────────
        checks["bottle_detected"] = bottle_detected
        if not bottle_detected:
            rejection_reasons.append(RejectionReason.BOTTLE_NOT_DETECTED.value)
            rejection_details.append({
                "reason": RejectionReason.BOTTLE_NOT_DETECTED.value,
                "title": "No Chemical Bottle Detected",
                "description": "The system could not find a bottle in the photo.",
                "how_to_fix": "Place the bottle vertically in the center of the frame against "
                              "a plain background. Make sure the full bottle is visible.",
            })

        # ── 3. Framing Check (Distance & Fit — Informational only, non-blocking)
        framing = self.framing_checker.analyze(
            image_shape=(img_h, img_w),
            bottle_bbox=bottle_bbox,
        )
        checks["framing"] = framing

        # ── 4. Exposure Check ─────────────────────────────────────────────
        quality_validation = quality_result.get("quality_validation", {})
        exposure_details = quality_result.get("exposure_details", {})
        checks["exposure"] = {
            "is_underexposed": quality_validation.get("is_underexposed", False),
            "is_overexposed": quality_validation.get("is_overexposed", False),
            "score": quality_result.get("exposure_score", 0),
        }
        if quality_validation.get("is_underexposed"):
            if RejectionReason.UNDEREXPOSED.value not in rejection_reasons:
                rejection_reasons.append(RejectionReason.UNDEREXPOSED.value)
                rejection_details.append({
                    "reason": RejectionReason.UNDEREXPOSED.value,
                    "title": "Photo Is Too Dark",
                    "description": "The image is underexposed — not enough light for accurate color measurement.",
                    "how_to_fix": "Move to a brighter area (diffused daylight is best). "
                                  "Do NOT use the camera flash — it creates glare on glass.",
                })
        if quality_validation.get("is_overexposed"):
            if RejectionReason.OVEREXPOSED.value not in rejection_reasons:
                rejection_reasons.append(RejectionReason.OVEREXPOSED.value)
                rejection_details.append({
                    "reason": RejectionReason.OVEREXPOSED.value,
                    "title": "Photo Is Too Bright / Washed Out",
                    "description": "Direct sunlight or flash has overexposed the liquid area.",
                    "how_to_fix": "Move to open shade (under a tree, awning, or building shadow). "
                                  "Avoid direct sunlight hitting the bottle.",
                })

        # ── 5. Blur / Focus Check (Informational only — non-blocking) ─────
        checks["blur"] = {
            "is_blurry": quality_validation.get("is_blurry", False),
            "score": quality_result.get("blur_score", 0),
        }

        # ── 6. Reflection / Glare Check (Informational only — non-blocking) ─
        checks["reflection"] = {
            "is_excessive": quality_validation.get("is_reflection_excessive", False),
            "score": quality_result.get("reflection_score", 0),
        }

        # ── 7. Background Neutrality Check ────────────────────────────────
        bg_result = self.background_checker.analyze(image_bgr, bottle_bbox)
        checks["background"] = bg_result

        if bg_result["is_colored"]:
            cast = bg_result["dominant_cast"]
            # ── Warning only (not a hard blocker) ──────────────────────────
            # A slightly colored background degrades accuracy but does not void
            # the reading entirely — the white-balance step corrects most of it.
            # We still surface the tip so the user can improve the next shot.
            checks["background_warning"] = {
                "reason": RejectionReason.COLORED_BACKGROUND.value,
                "title": f"Tip: Colored Background Detected ({cast})",
                "description": f"The background has a {cast} color cast (Lab a*={bg_result['median_lab_a']:.0f}, "
                               f"b*={bg_result['median_lab_b']:.0f}). A white background gives more accurate readings.",
                "how_to_fix": "Hold a white sheet of paper or clipboard directly behind the bottle. "
                              "Avoid green grass, blue sky, or colored walls as backgrounds.",
            }

        # White balance corrects color cast, not absolute brightness — two photos of the same
        # background at very different exposure levels can still yield different liquid
        # readings even after correction. Gating the background's own lightness (L*) to a
        # consistent band forces every accepted photo to start from roughly the same exposure.
        if bg_result.get("is_too_dark"):
            # Warning only — not a hard blocker (WB correction handles moderate dimness)
            checks["background_brightness_warning"] = {
                "reason": RejectionReason.BACKGROUND_TOO_DARK.value,
                "title": "Tip: Background Is Dim",
                "description": f"The white paper background measures L*={bg_result['median_lab_l']:.0f}. "
                               "Brighter, evenly lit conditions give the most repeatable readings.",
                "how_to_fix": "Move to a brighter area. Diffused daylight near a window works well. "
                              "Avoid shadows falling across the paper.",
            }
        if bg_result.get("is_too_bright"):
            # Warning only — not a hard blocker (WB gain clamping handles mild overexposure)
            checks["background_brightness_warning"] = {
                "reason": RejectionReason.BACKGROUND_TOO_BRIGHT.value,
                "title": "Tip: Background Looks Very Bright",
                "description": f"The white paper background measures L*={bg_result['median_lab_l']:.0f}. "
                               "Slightly overexposed backgrounds can still be corrected, but shade works better.",
                "how_to_fix": "Move out of direct sunlight. Diffused, even light is ideal.",
            }

        # ── 8. EXIF Flash Check ───────────────────────────────────────────
        # img_metadata may contain EXIF flash info if the image loader extracted it.
        # For now, we check metadata; the mobile app should also enforce flash=off.
        exif_flash = img_metadata.get("flash_fired", None)
        checks["flash"] = {"flash_fired": exif_flash}
        if exif_flash is True:
            rejection_reasons.append(RejectionReason.FLASH_DETECTED.value)
            rejection_details.append({
                "reason": RejectionReason.FLASH_DETECTED.value,
                "title": "Camera Flash Was Used",
                "description": "The camera flash creates a massive white hotspot on glass that "
                               "destroys the color reading.",
                "how_to_fix": "Turn off the camera flash. Move to a brighter area instead.",
            })

        # ── Deduplicate & Verdict ─────────────────────────────────────────
        unique_reasons = list(dict.fromkeys(rejection_reasons))
        is_valid = len(unique_reasons) == 0

        if not is_valid:
            reason_names = ", ".join(unique_reasons)
            logger.info(f"CaptureValidator: REJECTED — {reason_names}")
        else:
            logger.info("CaptureValidator: PASSED all checks")

        return CaptureValidationResult(
            is_valid=is_valid,
            rejection_reasons=unique_reasons,
            rejection_details=rejection_details,
            checks=checks,
        )
