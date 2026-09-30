import base64
import json
import os
import uuid
import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import AnalysisStatus, RejectionReason, WhiteBalanceMethod
from app.core.logging import logger
from app.models.chemical_test import ChemicalTest
from app.repositories.test_repository import TestRepository
from app.repositories.reference_repository import ReferenceRepository
from app.repositories.result_repository import ResultRepository

from app.services.image_loader import ImageLoader
from app.services.roi_service import RoiService
from app.services.image_quality import ImageQualityService
from app.services.color_normalizer import WhiteBalanceFactory
from app.services.reference_matcher import ReferenceMatcher
from app.services.confidence_service import ConfidenceService
from app.services.color_converter import ColorConverter
from app.services.delta_e import DeltaEService
from app.services.in_memory_store import in_memory_store, InMemoryTest, InMemoryReference
from app.services.object_detector import ObjectDetector
from app.services.capture_validator import CaptureValidator
from app.services.chromatic_adaptation import extract_background_white_from_bgr


class AnalysisService:
    """Orchestrates the entire Computer Vision & Color Science processing pipeline."""

    def __init__(self, db: Session | None = None):
        self.db = db
        self.roi_service = RoiService()
        self.quality_service = ImageQualityService()
        self.reference_matcher = ReferenceMatcher()
        self.object_detector = ObjectDetector()
        self.capture_validator = CaptureValidator()

    @staticmethod
    def _build_background_patch_mask(
        image_shape: tuple[int, int, int],
        bottle_bbox: tuple[int, int, int, int],
    ) -> np.ndarray:
        """Reference patch for white balance: the visible white paper surrounding the bottle,
        not an arbitrary guess at two frame corners. Excludes the bottle itself plus a buffer
        ring (catches its cast shadow / specular halo) and the outer frame border (phone-lens
        vignetting / out-of-focus edges), leaving the paper background as the neutral sample.
        """
        h, w = image_shape[:2]
        bx1, by1, bx2, by2 = bottle_bbox
        min_dim = min(h, w)

        mask = np.full((h, w), 255, dtype=np.uint8)

        buffer = max(4, int(min_dim * 0.04))
        ex1, ey1 = max(0, bx1 - buffer), max(0, by1 - buffer)
        ex2, ey2 = min(w, bx2 + buffer), min(h, by2 + buffer)
        mask[ey1:ey2, ex1:ex2] = 0

        border = max(2, int(min_dim * 0.02))
        mask[:border, :] = 0
        mask[h - border:, :] = 0
        mask[:, :border] = 0
        mask[:, w - border:] = 0

        return mask

    def analyze_reference_sample(
        self,
        image_bytes: bytes,
        device_model: str | None = None,
        white_balance_method: str = settings.DEFAULT_WHITE_BALANCE_METHOD,
        bottle_guide: tuple[float, float, float, float] | None = None,
        custom_liquid_roi: tuple[float, float, float, float] | None = None,
    ) -> dict:
        """Runs the REAL computer vision & color pipeline on a reference sample to validate quality
        and extract exact sRGB, HSV, and CIELAB color standards.
        """
        bgr_image, img_meta = ImageLoader.load_from_bytes(image_bytes)

        # 1. Bottle Object Detection
        object_detection_res = self.object_detector.detect(bgr_image)
        is_bottle_detected = object_detection_res.is_bottle
        # If user explicitly provided a verified solution ROI, trust bottle presence
        if custom_liquid_roi is not None:
            is_bottle_detected = True

        object_info = {
            "is_bottle": is_bottle_detected,
            "primary_object": object_detection_res.primary_object if not custom_liquid_roi else "bottle",
            "confidence": object_detection_res.confidence if not custom_liquid_roi else 0.95,
            "detected_objects": object_detection_res.detected_objects,
        }

        effective_bottle_guide = bottle_guide
        if effective_bottle_guide is None and object_detection_res.is_bottle and object_detection_res.bbox:
            img_h, img_w = bgr_image.shape[:2]
            bx, by, bw, bh = object_detection_res.bbox
            bbox_area_fraction = (bw * bh) / float(img_w * img_h)
            if bbox_area_fraction <= settings.MAX_TRUSTED_BOTTLE_BBOX_AREA_FRACTION:
                effective_bottle_guide = (
                    max(0.0, bx / img_w),
                    max(0.0, by / img_h),
                    min(1.0, (bx + bw) / img_w),
                    min(1.0, (by + bh) / img_h),
                )

        # 2. Adaptive Liquid ROI Extraction
        roi_info = self.roi_service.extract_rois(
            bgr_image.shape,
            custom_bottle_guide=effective_bottle_guide,
            image_bgr=bgr_image,
            custom_liquid_roi=custom_liquid_roi,
        )

        # 3. White Balance — same background-patch method used in analyze(), so calibrated
        # standards and later test readings are corrected the same way.
        bg_patch_mask = self._build_background_patch_mask(bgr_image.shape, roi_info["bottle_bbox"])
        wb_strategy = WhiteBalanceFactory.get_strategy(white_balance_method)
        processed_bgr = wb_strategy.apply(bgr_image, patch_mask=bg_patch_mask)

        # 3a. Extract background white point from the RAW (pre-WB) image.
        # This is the actual camera reading of the paper under the scene illuminant.
        # Used for Bradford CAT at match time to normalise across different lighting.
        try:
            bg_white_rgb = extract_background_white_from_bgr(bgr_image, bg_patch_mask)
        except Exception:
            bg_white_rgb = None

        # 4. Image Quality Evaluation
        quality_res = self.quality_service.evaluate(processed_bgr, roi_info)
        rejection_reasons = list(quality_res.get("rejection_reasons", []))
        extracted_color = quality_res.get("extracted_color")

        # 5. Capture Validation
        capture_validation = self.capture_validator.validate(
            image_bgr=bgr_image,
            img_metadata=img_meta,
            bottle_bbox=object_detection_res.bbox,
            bottle_detected=is_bottle_detected,
            quality_result=quality_res,
        )
        for r in capture_validation.rejection_reasons:
            if r not in rejection_reasons:
                rejection_reasons.append(r)

        # 6. Quality & Integrity Problems Gate
        problems = []
        warnings = []

        if not is_bottle_detected:
            problems.append("Bottle not detected in reference sample image.")
        if roi_info.get("liquid_bbox") is None or roi_info.get("liquid_mask") is None:
            problems.append("Liquid region could not be localized.")
        if quality_res.get("valid_pixel_percentage", 0) < settings.MIN_VALID_PIXEL_PERCENTAGE:
            problems.append(
                f"Insufficient valid liquid pixels ({quality_res.get('valid_pixel_percentage', 0):.1f}% < {settings.MIN_VALID_PIXEL_PERCENTAGE}%)."
            )
        # Blur / focus validation is informational only per requirement
        if quality_res.get("blur_score", 100) < 30.0 or RejectionReason.BLURRY.value in rejection_reasons:
            warnings.append("Image is slightly blurry (focus check bypassed).")
        if quality_res.get("exposure_score", 100) < 30.0 or (
            RejectionReason.UNDEREXPOSED.value in rejection_reasons
            and quality_res.get("exposure_score", 100) < 35.0
        ):
            problems.append("Sub-optimal exposure (overexposed or underexposed liquid).")
        # Framing / edge margins / glare / orientation / blur are non-fatal warnings for reference capture
        for r in rejection_reasons:
            msg = r.replace("_", " ").title()
            if r in (
                RejectionReason.POOR_FRAMING_CLIPPED.value,
                RejectionReason.NON_UNIFORM_COLOR.value,
                RejectionReason.POOR_FRAMING_TOO_LARGE.value,
                RejectionReason.POOR_FRAMING_TOO_SMALL.value,
                RejectionReason.LANDSCAPE_ORIENTATION.value,
                RejectionReason.EXCESSIVE_REFLECTION.value,
                RejectionReason.BLURRY.value,
            ):
                if msg not in warnings:
                    warnings.append(msg)
            elif r in (
                RejectionReason.BOTTLE_NOT_DETECTED.value,
                RejectionReason.INSUFFICIENT_VALID_PIXELS.value,
                RejectionReason.UNDEREXPOSED.value,
                RejectionReason.OVEREXPOSED.value,
                # Background checks are now warnings only (see capture_validator.py) —
                # white-balance corrects most color cast; we still warn but don't block.
            ):
                if msg not in problems and not (custom_liquid_roi and r == RejectionReason.BOTTLE_NOT_DETECTED.value):
                    problems.append(msg)


        is_valid = (
            len(problems) == 0
            and is_bottle_detected
            and quality_res.get("overall_score", 0) >= settings.MIN_QUALITY_SCORE
        )

        # Generate preview thumbnail with visual Solution ROI & Bottle bounds overlay
        h, w = bgr_image.shape[:2]
        thumb_h = 280
        thumb_w = max(1, int(w * (thumb_h / float(h))))
        thumb = cv2.resize(bgr_image, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)

        scale_x = thumb_w / float(w)
        scale_y = thumb_h / float(h)

        # Draw Bottle ROI (Cyan)
        bx1, by1, bx2, by2 = roi_info["bottle_bbox"]
        tbx1, tby1 = int(round(bx1 * scale_x)), int(round(by1 * scale_y))
        tbx2, tby2 = int(round(bx2 * scale_x)), int(round(by2 * scale_y))
        cv2.rectangle(thumb, (tbx1, tby1), (tbx2, tby2), (255, 200, 0), 1)

        # Draw Solution Liquid ROI (Emerald Green box with label)
        lx1, ly1, lx2, ly2 = roi_info["liquid_bbox"]
        tlx1, tly1 = int(round(lx1 * scale_x)), int(round(ly1 * scale_y))
        tlx2, tly2 = int(round(lx2 * scale_x)), int(round(ly2 * scale_y))
        cv2.rectangle(thumb, (tlx1, tly1), (tlx2, tly2), (0, 220, 100), 2)
        cv2.putText(
            thumb,
            "SOLUTION",
            (tlx1, max(12, tly1 - 4)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.38,
            (0, 220, 100),
            1,
            cv2.LINE_AA,
        )

        _, thumb_buf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])
        thumb_base64 = "data:image/jpeg;base64," + base64.b64encode(thumb_buf.tobytes()).decode("utf-8")

        rgb_dict = extracted_color["rgb"] if extracted_color else {"r": 0, "g": 0, "b": 0}
        hex_code = extracted_color.get("hex") if extracted_color else ColorConverter.rgb_to_hex(rgb_dict["r"], rgb_dict["g"], rgb_dict["b"])
        hsv_dict = extracted_color["hsv"] if extracted_color else {"h": 0.0, "s": 0.0, "v": 0.0}
        lab_dict = extracted_color["lab"] if extracted_color else {"l": 0.0, "a": 0.0, "b": 0.0}

        roi_payload = {
            "bottle_bbox": list(roi_info["bottle_bbox"]),
            "liquid_bbox": list(roi_info["liquid_bbox"]),
            "normalized_bottle_roi": list(roi_info["normalized_bottle_roi"]),
            "normalized_liquid_roi": list(roi_info["normalized_liquid_roi"]),
        }

        if not is_valid:
            return {
                "is_valid": False,
                "status": "REJECTED",
                "problems": problems,
                "message": "Reference image cannot be used. Please address the problems and capture another reference image.",
                "quality": {
                    "overall": round(quality_res.get("overall_score", 0.0), 1),
                    "valid_pixel_percentage": round(quality_res.get("valid_pixel_percentage", 0.0), 1),
                    "blur": round(quality_res.get("blur_score", 0.0), 1),
                    "exposure": round(quality_res.get("exposure_score", 0.0), 1),
                    "reflection": round(quality_res.get("reflection_score", 0.0), 1),
                },
                "object_detection": object_info,
                "roi": roi_payload,
                "preview_image": thumb_base64,
            }

        return {
            "is_valid": True,
            "status": "VALID",
            "problems": [],
            "detected_color": {
                "rgb": rgb_dict,
                "hex": hex_code if hex_code.startswith("#") else f"#{hex_code}",
                "hsv": {
                    "h": round(float(hsv_dict["h"]), 1),
                    "s": round(float(hsv_dict["s"]), 1),
                    "v": round(float(hsv_dict["v"]), 1),
                },
                "lab": {
                    "l": round(float(lab_dict["l"]), 2),
                    "a": round(float(lab_dict["a"]), 2),
                    "b": round(float(lab_dict["b"]), 2),
                },
                # Background white point — store alongside Lab so Bradford CAT
                # can be applied when comparing against a test shot in different light.
                "bg_white": {
                    "r": bg_white_rgb[0] if bg_white_rgb else 200,
                    "g": bg_white_rgb[1] if bg_white_rgb else 200,
                    "b": bg_white_rgb[2] if bg_white_rgb else 200,
                },
            },
            "quality": {
                "overall": round(quality_res["overall_score"], 1),
                "valid_pixel_percentage": round(quality_res["valid_pixel_percentage"], 1),
                "blur": round(quality_res["blur_score"], 1),
                "exposure": round(quality_res["exposure_score"], 1),
                "reflection": round(quality_res["reflection_score"], 1),
                "roi_uniformity": round(quality_res["roi_uniformity_score"], 1),
            },
            "object_detection": object_info,
            "roi": roi_payload,
            "reference_image": thumb_base64,
            "preview_image": thumb_base64,
            "warnings": warnings,
        }

    def analyze_multi(
        self,
        images_bytes: list[bytes],
        test_code: str | None = None,
        incubation_seconds: int | None = None,
        device_model: str | None = None,
        white_balance_method: str = settings.DEFAULT_WHITE_BALANCE_METHOD,
        bottle_guide: tuple[float, float, float, float] | None = None,
        target_colors: list[dict] | None = None,
        debug: bool = False,
    ) -> dict:
        """Run the pipeline on 2-3 shots of the same bottle and average their Lab values.

        This significantly reduces measurement noise from camera shake, glare flicker,
        and auto-exposure hunting — the most common causes of inconsistent field readings.
        Each image is processed independently; failed/rejected shots are dropped.
        The averaged Lab is then passed through the standard reference matcher.

        If only one image passes validation, falls back to that single result.
        If ALL images fail validation, returns the failure details of the first shot.
        """
        if not images_bytes:
            raise ValueError("At least one image is required for multi-shot analysis.")

        images_bytes = images_bytes[:3]  # cap at 3 shots

        passing_labs: list[tuple[float, float, float]] = []
        passing_quality_scores: list[float] = []
        first_failed_result: dict | None = None
        first_passing_result: dict | None = None

        for idx, img_bytes in enumerate(images_bytes):
            try:
                result = self.analyze(
                    image_bytes=img_bytes,
                    test_code=test_code,
                    incubation_seconds=incubation_seconds,
                    device_model=device_model,
                    white_balance_method=white_balance_method,
                    bottle_guide=bottle_guide,
                    target_colors=target_colors,
                    debug=False,
                )
                status_val = result.get("status", "")
                lab = result.get("detected_color", {}).get("lab", {})

                is_retake = status_val in (
                    AnalysisStatus.RETAKE_IMAGE.value,
                    AnalysisStatus.INVALID_INCUBATION_TIME.value,
                )

                if is_retake:
                    if first_failed_result is None:
                        first_failed_result = result
                    logger.info(f"analyze_multi: shot {idx + 1} REJECTED ({status_val})")
                    continue

                l_val = float(lab.get("l", 0.0))
                a_val = float(lab.get("a", 0.0))
                b_val = float(lab.get("b", 0.0))

                if l_val == 0.0 and a_val == 0.0 and b_val == 0.0:
                    if first_failed_result is None:
                        first_failed_result = result
                    continue

                passing_labs.append((l_val, a_val, b_val))
                passing_quality_scores.append(result.get("quality_score", 0.0))
                if first_passing_result is None:
                    first_passing_result = result
                logger.info(f"analyze_multi: shot {idx + 1} PASSED (L={l_val:.1f} a={a_val:.1f} b={b_val:.1f})")

            except Exception as e:
                logger.warning(f"analyze_multi: shot {idx + 1} raised exception: {e}")

        # All shots failed — return the first failure so the user gets actionable feedback
        if not passing_labs:
            logger.warning("analyze_multi: all shots failed validation — returning first failure result")
            if first_failed_result:
                first_failed_result["multi_shot"] = {
                    "shots_submitted": len(images_bytes),
                    "shots_passed": 0,
                    "averaged": False,
                    "note": "All submitted shots failed validation. Improve lighting/background and retry.",
                }
                return first_failed_result
            raise ValueError("No valid images could be processed.")

        # Only one shot passed — return it directly (no averaging needed)
        if len(passing_labs) == 1:
            logger.info("analyze_multi: only 1 shot passed — returning single-shot result")
            result = first_passing_result
            result["multi_shot"] = {
                "shots_submitted": len(images_bytes),
                "shots_passed": 1,
                "averaged": False,
                "note": "Only 1 of the submitted shots passed validation. Try to ensure consistent lighting.",
            }
            return result

        # Average Lab values across all passing shots (simple mean — Lab is perceptually linear)
        avg_l = float(np.mean([lab[0] for lab in passing_labs]))
        avg_a = float(np.mean([lab[1] for lab in passing_labs]))
        avg_b = float(np.mean([lab[2] for lab in passing_labs]))
        avg_quality = float(np.mean(passing_quality_scores))

        logger.info(
            f"analyze_multi: averaging {len(passing_labs)} shots → "
            f"L={avg_l:.2f} a={avg_a:.2f} b={avg_b:.2f}"
        )

        # Re-run reference matching on the averaged Lab
        standards_to_match: list = []
        effective_code = test_code or "CHEM_001"
        if target_colors and len(target_colors) > 0:
            # Use caller-supplied standards directly (already parsed by analyze())
            standards_to_match = target_colors  # type: ignore[assignment]
        else:
            if self.db:
                try:
                    test_repo = TestRepository(self.db)
                    chemical_test = test_repo.get_by_code(effective_code)
                    if chemical_test and hasattr(chemical_test, "id"):
                        ref_repo = ReferenceRepository(self.db)
                        standards_to_match = ref_repo.get_by_test_id(chemical_test.id)
                except Exception:
                    pass
            if not standards_to_match:
                standards_to_match = in_memory_store.get_standards_for_test(effective_code)

        sample_lab = (avg_l, avg_a, avg_b)
        # Use the averaged bg_white from all passing shots for CAT in multi-shot mode
        avg_bg_white = None
        try:
            bg_whites = []
            for r in [first_passing_result]:
                if r:
                    dc = r.get("detected_color") or {}
                    bw = dc.get("bg_white")
                    if bw and all(v > 0 for v in [bw.get("r", 0), bw.get("g", 0), bw.get("b", 0)]):
                        bg_whites.append((bw["r"], bw["g"], bw["b"]))
            if bg_whites:
                avg_bg_white = (
                    int(np.mean([w[0] for w in bg_whites])),
                    int(np.mean([w[1] for w in bg_whites])),
                    int(np.mean([w[2] for w in bg_whites])),
                )
        except Exception:
            pass
        match_res = self.reference_matcher.match_standards(
            sample_lab,
            standards_to_match,
            sample_bg_white=avg_bg_white,
        )


        # Build an augmented response based on the first passing result, overriding
        # the detected color and classification with the averaged values
        result = dict(first_passing_result)
        result["detected_color"] = {
            **result.get("detected_color", {}),
            "lab": {"l": round(avg_l, 2), "a": round(avg_a, 2), "b": round(avg_b, 2)},
        }
        result["classification"] = {
            **result.get("classification", {}),
            "matched_standard": match_res["matched_standard"],
            "estimated_concentration": match_res.get("estimated_concentration"),
            "interpolated_concentration": match_res.get("interpolated_concentration"),
            "range_status": match_res.get("range_status", "IN_RANGE"),
            "range_label": match_res.get("range_label"),
            "delta_e_00": match_res["delta_e_00"],
            "second_best_delta_e": match_res["second_best_delta_e"],
            "delta_e_separation": match_res["delta_e_separation"],
            "match_quality": match_res["match_quality"],
            "standard_distances": match_res["standard_distances"],
            "level": match_res["best_level"],
            "delta_e_2000": match_res["delta_e_00"],
            "match_percentage": match_res["matched_standard"].get("match_percentage", 0.0) if match_res["matched_standard"] else 0.0,
        }
        is_out_of_range = match_res["is_out_of_range"]
        is_ambiguous = match_res["is_ambiguous"]
        if is_out_of_range:
            result["status"] = AnalysisStatus.NO_MATCH_FOUND.value
        elif is_ambiguous:
            result["status"] = AnalysisStatus.AMBIGUOUS_RESULT.value
        else:
            result["status"] = AnalysisStatus.SUCCESS.value

        result["quality_score"] = round(avg_quality, 1)
        result["multi_shot"] = {
            "shots_submitted": len(images_bytes),
            "shots_passed": len(passing_labs),
            "averaged": True,
            "individual_labs": [
                {"l": round(lab[0], 2), "a": round(lab[1], 2), "b": round(lab[2], 2)}
                for lab in passing_labs
            ],
            "averaged_lab": {"l": round(avg_l, 2), "a": round(avg_a, 2), "b": round(avg_b, 2)},
            "note": f"Result averaged from {len(passing_labs)} of {len(images_bytes)} submitted shots.",
        }
        return result

    def analyze(
        self,
        image_bytes: bytes,
        test_code: str | None = None,
        incubation_seconds: int | None = None,
        device_model: str | None = None,
        white_balance_method: str = settings.DEFAULT_WHITE_BALANCE_METHOD,
        bottle_guide: tuple[float, float, float, float] | None = None,
        custom_liquid_roi: tuple[float, float, float, float] | None = None,
        target_colors: list[dict] | None = None,
        debug: bool = False,
    ) -> dict:
        analysis_id = str(uuid.uuid4())
        effective_code = test_code or "CHEM_001"
        logger.info(f"Starting analysis transaction {analysis_id} for test_code={effective_code}")

        # 1. Load image and correct EXIF orientation
        bgr_image, img_meta = ImageLoader.load_from_bytes(image_bytes)

        # 2. ML & Computer Vision Object Recognition — run first so a confidently
        # detected bottle location can steer the ROI instead of trusting a fixed guess box.
        object_detection_res = self.object_detector.detect(bgr_image)
        object_info = {
            "is_bottle": object_detection_res.is_bottle,
            "primary_object": object_detection_res.primary_object,
            "confidence": object_detection_res.confidence,
            "detected_objects": object_detection_res.detected_objects,
        }

        # 3. Resolve the bottle guide box: explicit client guide > confidently detected
        # bottle bbox (if plausibly sized) > static default (RoiService falls back to
        # DEFAULT_BOTTLE_ROI). A detected bbox covering an implausible fraction of the frame
        # usually means edge-closing merged background clutter into the contour rather than
        # finding the real bottle, so it's distrusted for ROI placement in that case.
        effective_bottle_guide = bottle_guide
        background_contamination_suspected = False
        if effective_bottle_guide is None and object_detection_res.is_bottle and object_detection_res.bbox:
            img_h, img_w = bgr_image.shape[:2]
            bx, by, bw, bh = object_detection_res.bbox
            bbox_area_fraction = (bw * bh) / float(img_w * img_h)
            if bbox_area_fraction <= settings.MAX_TRUSTED_BOTTLE_BBOX_AREA_FRACTION:
                effective_bottle_guide = (
                    max(0.0, bx / img_w),
                    max(0.0, by / img_h),
                    min(1.0, (bx + bw) / img_w),
                    min(1.0, (by + bh) / img_h),
                )
            else:
                # The detector was confident but the box covers most of the frame — almost
                # always background clutter merged into the contour rather than a real bottle
                # find. Don't trust the color reading in that case; ask for a plain background.
                background_contamination_suspected = True

        # 4. Extract Adaptive Liquid Core ROI Bounding Boxes & Masks
        roi_info = self.roi_service.extract_rois(
            bgr_image.shape,
            custom_bottle_guide=effective_bottle_guide,
            image_bgr=bgr_image,
            custom_liquid_roi=custom_liquid_roi,
        )

        roi_payload = {
            "bottle_roi": roi_info.get("bottle_roi"),
            "liquid_roi": roi_info.get("liquid_roi"),
            "normalized_bottle_roi": roi_info.get("normalized_bottle_roi"),
            "normalized_liquid_roi": roi_info.get("normalized_liquid_roi"),
        }

        # 5. Apply White Balance Strategy (e.g. REFERENCE_PATCH / AUTO / NONE), referenced
        # against the actual white-paper background around the detected bottle rather than
        # a blind guess at the frame corners.
        bg_patch_mask = self._build_background_patch_mask(bgr_image.shape, roi_info["bottle_bbox"])
        wb_strategy = WhiteBalanceFactory.get_strategy(white_balance_method)
        processed_bgr = wb_strategy.apply(bgr_image, patch_mask=bg_patch_mask)

        # 5a. Extract background white point from the RAW (pre-WB) image.
        # This is the actual illuminant reading and is used for Bradford CAT at match time.
        try:
            sample_bg_white_rgb = extract_background_white_from_bgr(bgr_image, bg_patch_mask)
        except Exception:
            sample_bg_white_rgb = None

        # 6. Evaluate Image Quality Engine
        quality_res = self.quality_service.evaluate(processed_bgr, roi_info)
        rejection_reasons = quality_res["rejection_reasons"]
        extracted_color = quality_res["extracted_color"]


        is_bottle_confirmed = object_detection_res.is_bottle or (custom_liquid_roi is not None)

        if background_contamination_suspected and custom_liquid_roi is None:
            if RejectionReason.BACKGROUND_CONTAMINATION.value not in rejection_reasons:
                rejection_reasons.append(RejectionReason.BACKGROUND_CONTAMINATION.value)

        if not is_bottle_confirmed:
            if RejectionReason.BOTTLE_NOT_DETECTED.value not in rejection_reasons:
                rejection_reasons.append(RejectionReason.BOTTLE_NOT_DETECTED.value)

        # 6.5. Capture Validation Gate (outdoor field checks)
        capture_validation = self.capture_validator.validate(
            image_bgr=bgr_image,
            img_metadata=img_meta,
            bottle_bbox=object_detection_res.bbox,
            bottle_detected=is_bottle_confirmed,
            quality_result=quality_res,
        )
        capture_validation_info = {
            "is_valid": capture_validation.is_valid,
            "checks": capture_validation.checks,
        }
        # Merge capture validation rejection reasons into the main list
        for reason in capture_validation.rejection_reasons:
            if reason == RejectionReason.BOTTLE_NOT_DETECTED.value and is_bottle_confirmed:
                continue
            if reason not in rejection_reasons:
                rejection_reasons.append(reason)

        # 7. Chemical Test Lookup (with in-memory fallback)
        chemical_test = None
        if self.db:
            try:
                test_repo = TestRepository(self.db)
                chemical_test = test_repo.get_by_code(effective_code)
            except Exception:
                pass

        if not chemical_test:
            chemical_test = in_memory_store.get_test(effective_code)

        if chemical_test and incubation_seconds is not None:
            min_inc = chemical_test.incubation_seconds - chemical_test.incubation_tolerance
            max_inc = chemical_test.incubation_seconds + chemical_test.incubation_tolerance
            if not (min_inc <= incubation_seconds <= max_inc):
                if RejectionReason.INCUBATION_OUT_OF_BOUNDS.value not in rejection_reasons:
                    rejection_reasons.append(RejectionReason.INCUBATION_OUT_OF_BOUNDS.value)

        # 8. Rejection Decision — STRICT MODE: any capture validation failure blocks analysis
        should_reject = (
            not capture_validation.is_valid
            or quality_res["should_reject"]
            or (RejectionReason.INCUBATION_OUT_OF_BOUNDS.value in rejection_reasons)
        )

        if should_reject:
            status = AnalysisStatus.RETAKE_IMAGE.value
            if RejectionReason.INCUBATION_OUT_OF_BOUNDS.value in rejection_reasons and len(rejection_reasons) == 1:
                status = AnalysisStatus.INVALID_INCUBATION_TIME.value

            det_hex = extracted_color.get("hex") or ColorConverter.rgb_to_hex(
                extracted_color["rgb"]["r"], extracted_color["rgb"]["g"], extracted_color["rgb"]["b"]
            )
            rejection_info = self._generate_rejection_explanation(rejection_reasons)

            response = {
                "analysis_id": analysis_id,
                "status": status,
                "test_id": effective_code,
                "test": {"code": effective_code},
                "confidence": 0.0,
                "quality_score": quality_res["overall_score"],
                "rejection_title": rejection_info["title"],
                "rejection_message": rejection_info["message"],
                "rejection_details": rejection_info["details"],
                "reasons": rejection_reasons,
                "detected_color": {
                    "hex": det_hex,
                    "rgb": extracted_color["rgb"],
                    "hsv": extracted_color["hsv"],
                    "lab": extracted_color["lab"],
                },
                "quality": {
                    "overall": quality_res["overall_score"],
                    "blur": quality_res["blur_score"],
                    "exposure": quality_res["exposure_score"],
                    "reflection": quality_res["reflection_score"],
                    "roi_uniformity": quality_res["roi_uniformity_score"],
                    "valid_pixel_percentage": quality_res["valid_pixel_percentage"],
                },
                "quality_validation": quality_res["quality_validation"],
                "capture_validation": capture_validation_info,
                "capture_rejection_details": capture_validation.rejection_details,
                "object_detection": object_info,
                "roi": roi_payload,
                "validation_messages": self._generate_validation_messages(object_info, quality_res, rejection_reasons),
                "recommendations": self._generate_recommendations(rejection_reasons),
            }

            if self.db:
                try:
                    ResultRepository(self.db).save_result(
                        chemical_test_id=chemical_test.id if hasattr(chemical_test, "id") else None,
                        status=status,
                        lab_l=extracted_color["lab"]["l"],
                        lab_a=extracted_color["lab"]["a"],
                        lab_b=extracted_color["lab"]["b"],
                        confidence=0.0,
                        quality_score=quality_res["overall_score"],
                        rejection_reasons=rejection_reasons,
                        device_model=device_model,
                    )
                except Exception:
                    pass

            if debug:
                response["debug_artifacts"] = self._create_debug_artifacts(
                    analysis_id, bgr_image, roi_info, quality_res, response
                )

            return response

        # 9. Color Matching against User Target Colors or Test Standards
        sample_lab = (
            extracted_color["lab"]["l"],
            extracted_color["lab"]["a"],
            extracted_color["lab"]["b"],
        )

        standards_to_match = []
        if target_colors and len(target_colors) > 0:
            for tc in target_colors:
                name = tc.get("name", "Target Color")
                ref_col = tc.get("reference_color") or {}
                hex_str = tc.get("hex") or ref_col.get("hex") or tc.get("color_hex") or "#000000"

                lab_dict = ref_col.get("lab") or {}
                if "l" in lab_dict or "L" in lab_dict:
                    t_lab_l = float(lab_dict.get("l", lab_dict.get("L", 50.0)))
                    t_lab_a = float(lab_dict.get("a", 0.0))
                    t_lab_b = float(lab_dict.get("b", 0.0))
                elif "lab_l" in tc:
                    t_lab_l = float(tc["lab_l"])
                    t_lab_a = float(tc["lab_a"])
                    t_lab_b = float(tc["lab_b"])
                else:
                    r, g, b = ColorConverter.hex_to_rgb(hex_str)
                    t_lab = ColorConverter.rgb_to_lab(np.uint8([[[r, g, b]]]))[0][0]
                    t_lab_l, t_lab_a, t_lab_b = float(t_lab[0]), float(t_lab[1]), float(t_lab[2])

                r, g, b = ColorConverter.hex_to_rgb(hex_str)
                standards_to_match.append({
                    "id": tc.get("id", name),
                    "name": name,
                    "concentration": float(tc.get("concentration", tc.get("value", 0.0))),
                    "unit": tc.get("unit", "mg/L"),
                    "level": tc.get("level", name),
                    "hex": hex_str.upper() if hex_str.startswith("#") else f"#{hex_str.upper()}",
                    "reference_color": {
                        "hex": hex_str.upper() if hex_str.startswith("#") else f"#{hex_str.upper()}",
                        "rgb": ref_col.get("rgb") or {"r": r, "g": g, "b": b},
                        "lab": {"l": t_lab_l, "a": t_lab_a, "b": t_lab_b},
                    },
                })
        else:
            if self.db and hasattr(chemical_test, "id"):
                try:
                    ref_repo = ReferenceRepository(self.db)
                    standards_to_match = ref_repo.get_by_test_id(chemical_test.id)
                except Exception:
                    pass

            if not standards_to_match:
                standards_to_match = in_memory_store.get_standards_for_test(effective_code)

        match_res = self.reference_matcher.match_standards(
            sample_lab,
            standards_to_match,
            sample_bg_white=sample_bg_white_rgb,  # Bradford CAT: cross-illuminant correction
        )

        matched_standard = match_res["matched_standard"]
        matched_level = match_res["best_level"]
        matched_color_name = match_res["best_color_name"]
        best_delta_e = match_res["delta_e_00"]
        second_best_delta_e = match_res["second_best_delta_e"]
        delta_e_separation = match_res["delta_e_separation"]
        match_quality = match_res["match_quality"]
        is_ambiguous = match_res["is_ambiguous"]
        is_out_of_range = match_res["is_out_of_range"]
        standard_distances = match_res["standard_distances"]

        # Determine Final Status
        if is_out_of_range:
            status = AnalysisStatus.NO_MATCH_FOUND.value
        elif is_ambiguous:
            status = AnalysisStatus.AMBIGUOUS_RESULT.value
        elif not matched_level:
            status = AnalysisStatus.CALIBRATION_REQUIRED.value
        else:
            status = AnalysisStatus.SUCCESS.value

        # Calculate Confidence
        confidence = ConfidenceService.calculate_confidence(
            quality_score=quality_res["overall_score"],
            best_delta_e=best_delta_e,
            class_separation=delta_e_separation,
            should_reject=is_out_of_range,
            is_ambiguous=is_ambiguous,
        )

        detected_hex = extracted_color.get("hex") or ColorConverter.rgb_to_hex(
            extracted_color["rgb"]["r"], extracted_color["rgb"]["g"], extracted_color["rgb"]["b"]
        )

        best_match_percentage = matched_standard.get("match_percentage", 0.0) if matched_standard else 0.0

        recommendations = self._generate_recommendations(rejection_reasons)
        if status == AnalysisStatus.NO_MATCH_FOUND.value:
            recommendations.insert(
                0,
                f"Detected liquid color (ΔE {best_delta_e:.1f}) does not closely match any chemical standard. "
                "Retake the photo with neutral lighting / plain white background.",
            )

        response = {
            "analysis_id": analysis_id,
            "status": status,
            "test_id": effective_code,
            "test": {"code": effective_code},
            "detected_color": {
                "name": matched_color_name or "MEASURED_COLOR",
                "hex": detected_hex,
                "rgb": extracted_color["rgb"],
                "hsv": extracted_color["hsv"],
                "lab": extracted_color["lab"],
                "match_percentage": best_match_percentage,
                "bg_white": {
                    "r": sample_bg_white_rgb[0] if sample_bg_white_rgb else None,
                    "g": sample_bg_white_rgb[1] if sample_bg_white_rgb else None,
                    "b": sample_bg_white_rgb[2] if sample_bg_white_rgb else None,
                },
                "chromatic_adaptation_applied": match_res.get("chromatic_adaptation_applied", False),
                "adapted_lab": match_res.get("adapted_sample_lab"),
            },

            "classification": {
                "matched_standard": matched_standard,
                "estimated_concentration": match_res.get("estimated_concentration", matched_standard.get("concentration", 0.0) if matched_standard else 0.0),
                "interpolated_concentration": match_res.get("interpolated_concentration"),
                "range_status": match_res.get("range_status", "IN_RANGE"),
                "range_label": match_res.get("range_label", "Within calibrated range"),
                "closest_standard_value": match_res.get("closest_standard_value", matched_standard.get("concentration") if matched_standard else 0.0),
                "closest_standard_unit": match_res.get("closest_standard_unit", matched_standard.get("unit", "mg/L") if matched_standard else "mg/L"),
                "delta_e_00": best_delta_e,
                "second_best_delta_e": second_best_delta_e,
                "delta_e_separation": delta_e_separation,
                "match_quality": match_quality,
                "standard_distances": standard_distances,
                # Legacy compatibility fields
                "level": matched_level,
                "hex": matched_standard.get("hex") if matched_standard else None,
                "delta_e_2000": best_delta_e,
                "match_percentage": best_match_percentage,
                "confidence": confidence,
                "target_matches": standard_distances,
                "best_target_match": matched_standard,
            },
            "quality": {
                "overall": quality_res["overall_score"],
                "blur": quality_res["blur_score"],
                "exposure": quality_res["exposure_score"],
                "reflection": quality_res["reflection_score"],
                "roi_uniformity": quality_res["roi_uniformity_score"],
                "valid_pixel_percentage": quality_res["valid_pixel_percentage"],
            },
            "quality_validation": quality_res["quality_validation"],
            "capture_validation": capture_validation_info,
            "object_detection": object_info,
            "roi": roi_payload,
            "validation_messages": self._generate_validation_messages(object_info, quality_res, rejection_reasons),
            "reasons": rejection_reasons if rejection_reasons else [],
            "warnings": rejection_reasons if rejection_reasons else [],
            "recommendations": recommendations,
        }

        # 10. Database Persistence (optional)
        if self.db:
            try:
                ResultRepository(self.db).save_result(
                    chemical_test_id=chemical_test.id if hasattr(chemical_test, "id") else None,
                    status=status,
                    detected_color=matched_color_name,
                    detected_level=matched_level,
                    lab_l=extracted_color["lab"]["l"],
                    lab_a=extracted_color["lab"]["a"],
                    lab_b=extracted_color["lab"]["b"],
                    delta_e=best_delta_e,
                    second_best_delta_e=second_best_delta_e,
                    confidence=confidence,
                    quality_score=quality_res["overall_score"],
                    rejection_reasons=rejection_reasons if rejection_reasons else None,
                    device_model=device_model,
                )
            except Exception:
                pass

        # 11. Debug Visualizations & Artifact Generation
        if debug:
            response["debug_artifacts"] = self._create_debug_artifacts(
                analysis_id, bgr_image, roi_info, quality_res, response
            )

        return response

    def _generate_rejection_explanation(self, rejection_reasons: list[str]) -> dict:
        explanation_map = {
            RejectionReason.BOTTLE_NOT_DETECTED.value: {
                "title": "No Chemical Bottle Detected",
                "message": "The AI object detector could not find a sample bottle in the photo.",
                "fix": "Place the chemical bottle vertically in the center of the camera screen and align it inside the guide box.",
            },
            RejectionReason.BLURRY.value: {
                "title": "Image Is Blurry / Out of Focus",
                "message": "The photo lacks edge sharpness due to motion blur or camera shake.",
                "fix": "Hold the phone steady with both hands, tap the screen to focus on the bottle, and retake.",
            },
            RejectionReason.EXCESSIVE_REFLECTION.value: {
                "title": "Excessive Specular Glare",
                "message": "Harsh light reflections or flash hotspots are covering the liquid area.",
                "fix": "Turn off direct room spotlights or rotate the bottle slightly to eliminate white glare spots.",
            },
            RejectionReason.UNDEREXPOSED.value: {
                "title": "Image Is Too Dark",
                "message": "The scene is underexposed, making accurate chemical color extraction impossible.",
                "fix": "Turn on the phone camera LED torch or photograph the sample in a brighter room.",
            },
            RejectionReason.OVEREXPOSED.value: {
                "title": "Image Is Too Bright (Washed Out)",
                "message": "Direct intense light has overexposed the liquid pixels.",
                "fix": "Move slightly away from harsh lights to ensure the bottle colors are not washed out.",
            },
            RejectionReason.NON_UNIFORM_COLOR.value: {
                "title": "Non-Uniform Liquid Reaction",
                "message": "The chemical liquid shows uneven color gradients, bubbles, or sediment settling.",
                "fix": "Gently swirl the chemical test bottle to achieve uniform liquid color before photographing.",
            },
            RejectionReason.INSUFFICIENT_VALID_PIXELS.value: {
                "title": "Insufficient Liquid Area",
                "message": "Not enough unobstructed liquid pixels could be sampled inside the bottle core.",
                "fix": "Hold the camera 15–20 cm away so the sample bottle completely fills the camera guide.",
            },
            RejectionReason.INCUBATION_OUT_OF_BOUNDS.value: {
                "title": "Incubation Time Out of Range",
                "message": "The photo was captured outside the required chemical reaction incubation window.",
                "fix": "Wait for the exact incubation duration specified for this chemical reaction protocol.",
            },
            RejectionReason.BACKGROUND_CONTAMINATION.value: {
                "title": "Background Too Cluttered to Isolate Bottle",
                "message": "The bottle could not be confidently separated from a busy or textured background, "
                "so the color reading could not be trusted.",
                "fix": "Place the bottle against a plain, empty background (e.g. a blank wall, plain "
                "table, or a sheet of paper), and don't hold it in your hand — hold the phone steady "
                "instead and let the bottle rest on a surface.",
            },
            RejectionReason.LANDSCAPE_ORIENTATION.value: {
                "title": "Photo Is in Landscape Orientation",
                "message": "The photo was taken horizontally. Bottles are taller than wide — portrait "
                "mode captures more liquid pixels for accurate color measurement.",
                "fix": "Rotate your phone upright (portrait orientation) and retake the photo.",
            },
            RejectionReason.POOR_FRAMING_TOO_SMALL.value: {
                "title": "Bottle Is Too Far Away",
                "message": "The bottle is too small in the frame — not enough liquid pixels for reliable measurement.",
                "fix": "Move closer so the bottle fills about 40–60% of the screen.",
            },
            RejectionReason.POOR_FRAMING_TOO_LARGE.value: {
                "title": "Bottle Is Too Close",
                "message": "The bottle fills most of the frame, causing lens distortion and edge clipping.",
                "fix": "Move further back so the full bottle is visible with space around it.",
            },
            RejectionReason.POOR_FRAMING_CLIPPED.value: {
                "title": "Bottle Is Cut Off at the Edge",
                "message": "Part of the bottle is cut off at the edge of the photo. The system needs to see "
                "the full bottle (cap to base) to locate the liquid region.",
                "fix": "Move back or reposition so the entire bottle is visible with a small margin on all sides.",
            },
            RejectionReason.COLORED_BACKGROUND.value: {
                "title": "Colored Background Detected",
                "message": "The background behind the bottle has a strong color (e.g. green grass, blue sky). "
                "This color passes through transparent glass and contaminates the liquid reading.",
                "fix": "Hold a white sheet of paper or clipboard directly behind the bottle. "
                "Avoid grass, sky, or colored walls as backgrounds.",
            },
            RejectionReason.FLASH_DETECTED.value: {
                "title": "Camera Flash Was Used",
                "message": "The camera flash creates a massive white hotspot on glass that "
                "destroys the color reading.",
                "fix": "Turn off the camera flash. Move to a brighter area with natural diffused light instead.",
            },
        }

        details = []
        primary_title = "Image Quality Rejection"
        primary_msg = "Please retake the photo following the camera guidelines."

        for r in rejection_reasons:
            if r in explanation_map:
                info = explanation_map[r]
                details.append({
                    "reason": r,
                    "title": info["title"],
                    "description": info["message"],
                    "how_to_fix": info["fix"],
                })

        if details:
            primary_title = details[0]["title"]
            primary_msg = details[0]["description"]

        return {
            "title": primary_title,
            "message": primary_msg,
            "details": details,
        }

    def _generate_recommendations(self, rejection_reasons: list[str]) -> list[str]:
        recs = []
        if RejectionReason.EXCESSIVE_REFLECTION.value in rejection_reasons:
            recs.append("Avoid direct overhead lighting or camera flash that causes specular glare on bottle.")
        if RejectionReason.UNDEREXPOSED.value in rejection_reasons:
            recs.append("Increase room lighting or move bottle to a better-lit area.")
        if RejectionReason.OVEREXPOSED.value in rejection_reasons:
            recs.append("Reduce harsh direct light source or adjust camera exposure.")
        if RejectionReason.BLURRY.value in rejection_reasons:
            recs.append("Hold camera steady and focus clearly on the bottle.")
        if RejectionReason.NON_UNIFORM_COLOR.value in rejection_reasons:
            recs.append("Ensure chemical reaction is thoroughly mixed and no sediment is present.")
        if RejectionReason.INSUFFICIENT_VALID_PIXELS.value in rejection_reasons:
            recs.append("Position bottle inside on-screen guide with a plain white or neutral background.")
        if RejectionReason.INCUBATION_OUT_OF_BOUNDS.value in rejection_reasons:
            recs.append("Photograph sample at the exact required reaction incubation time.")
        if RejectionReason.BOTTLE_NOT_DETECTED.value in rejection_reasons:
            recs.append("Ensure the chemical bottle is clearly visible and centered inside the camera guide.")
        if RejectionReason.BACKGROUND_CONTAMINATION.value in rejection_reasons:
            recs.append("Place the bottle against a plain background and avoid holding it in your hand.")
        if RejectionReason.LANDSCAPE_ORIENTATION.value in rejection_reasons:
            recs.append("Hold your phone upright in portrait orientation (vertical) when photographing bottles.")
        if RejectionReason.POOR_FRAMING_TOO_SMALL.value in rejection_reasons:
            recs.append("Move closer to the bottle so it fills about 40–60% of the frame.")
        if RejectionReason.POOR_FRAMING_TOO_LARGE.value in rejection_reasons:
            recs.append("Move further back so the full bottle is visible with margins around it.")
        if RejectionReason.POOR_FRAMING_CLIPPED.value in rejection_reasons:
            recs.append("Ensure the entire bottle (cap to base) is visible in the frame — don't cut off any edges.")
        if RejectionReason.COLORED_BACKGROUND.value in rejection_reasons:
            recs.append("Hold a white paper or clipboard behind the bottle — avoid green grass, blue sky, or colored walls.")
        if RejectionReason.FLASH_DETECTED.value in rejection_reasons:
            recs.append("Turn off the camera flash. Use natural diffused light instead.")
        if not recs:
            recs.append("Use a plain white or neutral-gray background for consistent measurement.")
        return recs

    def _generate_validation_messages(self, object_info: dict, quality_res: dict, rejection_reasons: list[str]) -> list[str]:
        messages = []
        if object_info.get("is_bottle"):
            messages.append(f"✅ Verified Object: {object_info.get('primary_object', 'bottle').upper()} ({int(object_info.get('confidence', 0)*100)}% confidence)")
        else:
            messages.append("❌ Object Warning: No chemical bottle detected in frame")

        q_val = quality_res.get("quality_validation", {})
        if q_val.get("is_blurry"):
            messages.append("❌ Blur Warning: Image is blurry. Hold phone steady.")
        else:
            messages.append("✅ Sharpness: Clear image focus")

        if q_val.get("is_reflection_excessive"):
            messages.append("⚠️ Glare Warning: Specular reflections detected on glass surface")
        else:
            messages.append("✅ Lighting: No excessive glare")

        if q_val.get("is_underexposed"):
            messages.append("⚠️ Exposure Warning: Image is too dark (underexposed)")
        elif q_val.get("is_overexposed"):
            messages.append("⚠️ Exposure Warning: Image is too bright (overexposed)")
        else:
            messages.append("✅ Exposure: Balanced lighting level")

        return messages

    def _create_debug_artifacts(
        self,
        analysis_id: str,
        bgr_image: np.ndarray,
        roi_info: dict,
        quality_res: dict,
        response: dict,
    ) -> dict:
        os.makedirs(settings.DEBUG_ARTIFACTS_DIR, exist_ok=True)
        id_prefix = analysis_id[:8]

        diag_img = bgr_image.copy()
        bx1, by1, bx2, by2 = roi_info["bottle_bbox"]
        lx1, ly1, lx2, ly2 = roi_info["liquid_bbox"]

        # Bottle ROI (Cyan)
        cv2.rectangle(diag_img, (bx1, by1), (bx2, by2), (255, 255, 0), 2)
        cv2.putText(diag_img, "Bottle ROI", (bx1, max(20, by1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        # Liquid ROI (Green)
        cv2.rectangle(diag_img, (lx1, ly1), (lx2, ly2), (0, 255, 0), 2)
        cv2.putText(diag_img, "Liquid ROI", (lx1, ly1 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        # Highlight Reflection Pixels (Red overlay)
        refl_mask = quality_res["reflection_details"]["reflection_mask"]
        diag_img[refl_mask > 0] = [0, 0, 255]

        # Draw Color Patch in Top Right
        rgb = response["detected_color"]["rgb"]
        bgr_patch = (rgb["b"], rgb["g"], rgb["r"])
        patch_h, patch_w = 60, 120
        h_img, w_img = diag_img.shape[:2]
        diag_img[10:10+patch_h, w_img-130:w_img-10] = bgr_patch
        cv2.rectangle(diag_img, (w_img-130, 10), (w_img-10, 10+patch_h), (255, 255, 255), 2)
        cv2.putText(diag_img, "Color", (w_img-125, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

        # Text overlay for Status & Quality
        status_str = f"Status: {response['status']} | Quality: {response['quality']['overall']}"
        cv2.putText(diag_img, status_str, (20, h_img - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Save annotated image
        annotated_path = os.path.join(settings.DEBUG_ARTIFACTS_DIR, f"{id_prefix}_annotated.jpg")
        cv2.imwrite(annotated_path, diag_img)

        # Convert annotated image to base64 for API response
        _, buffer = cv2.imencode(".jpg", diag_img)
        b64_str = base64.b64encode(buffer).decode("utf-8")

        return {
            "annotated_image_path": annotated_path,
            "annotated_image_b64": f"data:image/jpeg;base64,{b64_str}",
            "roi_details": {
                "bottle_bbox": roi_info["bottle_bbox"],
                "liquid_bbox": roi_info["liquid_bbox"],
            },
        }
