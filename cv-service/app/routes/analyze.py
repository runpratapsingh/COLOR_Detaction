import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.background_removal import remove_background
from app.services.color_analyzer import build_color_readout, estimate_confidence, extract_liquid_color
from app.services.delta_e import compare_to_target_colors
from app.services.image_processor import (
    assess_quality,
    decode_image,
    draw_roi_overlay,
    encode_png_base64,
    resize_for_processing,
)
from app.services.liquid_detector import detect_liquid_region
from app.utils.color_utils import rgb_to_lab

router = APIRouter()


def _roi_from_fraction(roi_json: str, shape: tuple[int, int]) -> tuple[int, int, int, int]:
    h, w = shape
    try:
        data = json.loads(roi_json)
        x = float(data["x"]) * w
        y = float(data["y"]) * h
        rw = float(data["width"]) * w
        rh = float(data["height"]) * h
    except (KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid roi payload: {exc}") from exc
    return int(x), int(y), max(int(rw), 4), max(int(rh), 4)


@router.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    targetColors: str = Form(...),
    negativeColors: str = Form("[]"),
    deltaETolerance: float = Form(5.0),
    roi: str | None = Form(None),
):
    raw_bytes = await image.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    try:
        target_list: list[dict] = json.loads(targetColors) if targetColors else []
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid targetColors payload: {exc}") from exc
    if not target_list:
        raise HTTPException(status_code=400, detail="At least one target color is required")

    try:
        negative_list: list[str] = json.loads(negativeColors) if negativeColors else []
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid negativeColors payload: {exc}") from exc

    try:
        bgr_full = decode_image(raw_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    bgr, _scale = resize_for_processing(bgr_full)
    quality = assess_quality(bgr)

    manual_mode = roi is not None
    if manual_mode:
        roi_box = _roi_from_fraction(roi, bgr.shape[:2])
        bottle_box = None
        bottle_found = False
        detection_confidence = 0.85  # user deliberately chose the region
        auto_detection_confident = True
        requires_manual_roi = False
        # Still worth locating a bottle silhouette purely to seed background
        # removal below — this does not affect bottleFound/bottle_box in the
        # response, which continue to reflect the user's manual selection.
        bg_seed_detection = detect_liquid_region(bgr)
        seed_box = bg_seed_detection.bottle_box
        bottle_contour = bg_seed_detection.bottle_contour
    else:
        detection = detect_liquid_region(bgr)
        roi_box = detection.liquid_roi
        bottle_box = detection.bottle_box
        bottle_found = detection.bottle_found
        detection_confidence = detection.detection_confidence
        auto_detection_confident = detection.bottle_found
        requires_manual_roi = not detection.bottle_found
        seed_box = bottle_box
        bottle_contour = detection.bottle_contour

    if seed_box is None:
        # No confident bottle silhouette found — pad the sampled/selected ROI
        # as a rough stand-in so background removal still has something to
        # crop to, rather than skipping isolation entirely.
        rx, ry, rw, rh = roi_box
        pad_w, pad_h = int(rw * 0.6), int(rh * 0.6)
        seed_box = (max(0, rx - pad_w), max(0, ry - pad_h), rw + 2 * pad_w, rh + 2 * pad_h)

    bgr_isolated, fg_mask, bg_removal_approximate = remove_background(bgr, seed_box, bottle_contour)
    background_warnings = (
        [
            "Background isolation was approximate — use a plain, evenly lit "
            "background for the most accurate color reading."
        ]
        if bg_removal_approximate
        else []
    )

    # Only trust the background-removed image for the actual measurement when
    # segmentation clearly covers the sampled region — a cluttered scene can
    # occasionally make the isolation clip real liquid pixels, which would
    # silently corrupt the reading. When coverage is uncertain, keep the
    # isolated image as a preview only and measure from the original photo.
    rx, ry, rw, rh = roi_box
    roi_mask = fg_mask[ry : ry + rh, rx : rx + rw]
    roi_coverage = float((roi_mask > 0).mean()) if roi_mask.size else 0.0
    if roi_coverage < 0.9:
        extraction_source = bgr
        background_warnings.append(
            "Background isolation looked uncertain over the sampled region; "
            "color was measured from the original photo instead."
        )
    else:
        extraction_source = bgr_isolated

    try:
        extraction = extract_liquid_color(extraction_source, roi_box)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    readout = build_color_readout(extraction)
    detected_lab = (readout["lab"]["l"], readout["lab"]["a"], readout["lab"]["b"])

    try:
        comparison = compare_to_target_colors(
            detected_lab=detected_lab,
            target_colors=target_list,
            negative_colors=negative_list,
            tolerance=deltaETolerance,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    confidence, confidence_warnings = estimate_confidence(
        extraction=extraction,
        roi=roi_box,
        image_shape=bgr.shape[:2],
        detection_confidence=detection_confidence,
        overexposed_fraction=quality.overexposed_fraction,
        underexposed_fraction=quality.underexposed_fraction,
    )

    warnings = list(quality.warnings) + confidence_warnings + background_warnings
    if requires_manual_roi:
        warnings.append(
            "Liquid region could not be confidently detected automatically. "
            "Please manually select the liquid region for a more reliable result."
        )

    overlay = draw_roi_overlay(bgr_isolated, roi_box, bottle_box)
    h, w = bgr.shape[:2]
    roi_normalized = {
        "x": roi_box[0] / w,
        "y": roi_box[1] / h,
        "width": roi_box[2] / w,
        "height": roi_box[3] / h,
    }

    return {
        "detected": readout,
        "colorMatches": comparison["colorMatches"],
        "bestMatch": comparison["bestMatch"],
        "closestNegative": comparison["closestNegative"],
        "negativeMatch": comparison["negativeMatch"],
        "deltaETolerance": deltaETolerance,
        "confidence": confidence,
        "confidenceLabel": "Estimated confidence (image-analysis quality, not a scientific probability)",
        "warnings": warnings,
        "autoDetectionConfident": auto_detection_confident,
        "requiresManualRoi": requires_manual_roi,
        "bottleFound": bottle_found,
        "mode": "manual" if manual_mode else "auto",
        "roiUsed": roi_normalized,
        "pixelStats": {
            "totalPixels": extraction.total_pixels,
            "keptPixels": extraction.kept_pixels,
            "stdRgb": {
                "r": round(extraction.std_rgb[0], 1),
                "g": round(extraction.std_rgb[1], 1),
                "b": round(extraction.std_rgb[2], 1),
            },
        },
        "imageQuality": {
            "overexposedFraction": round(quality.overexposed_fraction, 3),
            "underexposedFraction": round(quality.underexposed_fraction, 3),
            "blurScore": round(quality.blur_score, 1),
        },
        "originalImageBase64": encode_png_base64(bgr),
        "processedImageBase64": encode_png_base64(overlay),
    }
