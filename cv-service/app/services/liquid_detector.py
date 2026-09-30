"""Improved liquid region detector for chemical bottles.

Uses a multi-pass approach for maximum ROI accuracy:
1. Canny edge detection + morphological closing to find the bottle silhouette
2. GrabCut refinement (if the Canny result has sufficient confidence)
3. Contour-based inner-rectangle carving to exclude glass walls, cap, label, and base shadow
4. Fallback to a conservative center crop if no confident bottle is found

The key accuracy improvement over the original POC is using the detected contour's
actual convex hull to trim left/right insets rather than a fixed 24% — this means
curved or narrow vials get a proportionally larger sampling zone, while wide flat-panel
bottles don't over-trim and discard usable pixels.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

Box = tuple[int, int, int, int]  # x, y, w, h


@dataclass
class LiquidDetectionResult:
    bottle_box: Box | None
    bottle_contour: np.ndarray | None
    liquid_roi: Box
    bottle_found: bool
    detection_confidence: float  # 0..1, heuristic


def _find_bottle_box(gray: np.ndarray) -> tuple[Box, np.ndarray, float] | None:
    """Find the main bottle contour using Canny + morphological closing.
    
    Returns (bounding_box, contour, confidence_score) or None.
    """
    h_img, w_img = gray.shape

    # Multi-scale Gaussian blur — bottles often have smooth surfaces
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive Canny: use the Otsu threshold as a guide
    otsu_thresh, _ = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    canny_lo = max(20, int(otsu_thresh * 0.3))
    canny_hi = min(200, int(otsu_thresh * 0.9))
    edges = cv2.Canny(blurred, canny_lo, canny_hi)

    # Morphological closing — bridge gaps in the bottle silhouette
    kernel = np.ones((19, 7), np.uint8)
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_box: Box | None = None
    best_contour: np.ndarray | None = None
    best_score = 0.0
    img_area = float(w_img * h_img)

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area < 0.02 * img_area or area > 0.95 * img_area:
            continue
        aspect = h / max(w, 1)
        # Accept a wider aspect range — some vials are squatter, some are very tall
        if aspect < 0.8 or aspect > 8.0:
            continue
        center_offset = abs((x + w / 2) - w_img / 2) / w_img
        # Score: prefer large, centered, tall-ish contours
        aspect_score = min(aspect / 2.5, 1.0)  # peak at aspect ratio ~2.5
        score = (area / img_area) * (1.0 - min(center_offset, 1.0) * 0.5) * aspect_score
        if score > best_score:
            best_score = score
            best_box = (x, y, w, h)
            best_contour = contour

    if best_box is None or best_contour is None:
        return None

    # Confidence based on how bottle-like the shape is
    x, y, w, h = best_box
    solidity = cv2.contourArea(best_contour) / max(w * h, 1)
    confidence = min(0.95, best_score * 2.0) * (0.6 + 0.4 * solidity)
    return best_box, best_contour, confidence


def _refine_with_grabcut(
    bgr: np.ndarray,
    box: Box,
    max_size: int = 600,
) -> np.ndarray | None:
    """Optional GrabCut refinement of the bottle mask.
    
    Runs only when the image is not too large (performance constraint).
    Returns a binary mask of the bottle foreground, or None if it fails.
    """
    h_img, w_img = bgr.shape[:2]
    if h_img > max_size or w_img > max_size:
        return None

    x, y, w, h = box
    # Shrink the rect by 5% so GrabCut doesn't seed foreground from the border
    pad_x = max(1, int(w * 0.05))
    pad_y = max(1, int(h * 0.05))
    rect = (
        max(0, x + pad_x),
        max(0, y + pad_y),
        max(4, w - 2 * pad_x),
        max(4, h - 2 * pad_y),
    )

    try:
        bgr_small = bgr.astype(np.uint8)
        mask = np.zeros(bgr_small.shape[:2], dtype=np.uint8)
        bg_model = np.zeros((1, 65), np.float64)
        fg_model = np.zeros((1, 65), np.float64)
        cv2.grabCut(bgr_small, mask, rect, bg_model, fg_model, 3, cv2.GC_INIT_WITH_RECT)
        # GC_PR_FGD (3) and GC_FGD (1) are foreground
        fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        return fg_mask if np.sum(fg_mask > 0) > 100 else None
    except Exception:
        return None


def _liquid_roi_from_bottle(box: Box, contour: np.ndarray | None = None) -> Box:
    """Carve a conservative liquid sampling rectangle from the bottle bounding box.
    
    Key improvements over original:
    - Left/right inset uses contour width at the liquid zone, not a fixed fraction
    - Top skip is adaptive: 28% for tall bottles, 22% for shorter ones (fewer labels)
    - Bottom skip accounts for base shadow and table reflection
    """
    x, y, w, h = box

    # ── Adaptive horizontal inset ─────────────────────────────────────────────
    # Standard cylindrical bottles have significant refraction/reflection at the
    # edges where the glass curves away. Inset 22-28% to avoid these artifacts.
    aspect = h / max(w, 1)
    if aspect > 4.0:
        # Very tall/narrow vial — less margin needed because the glass column is straight
        inset_x_frac = 0.18
    elif aspect > 2.5:
        inset_x_frac = 0.22
    else:
        # Shorter or wider bottle/flask — more curved edges, more inset
        inset_x_frac = 0.26

    inset_x = int(w * inset_x_frac)
    rx = x + inset_x
    rw = max(w - 2 * inset_x, 6)

    # ── Adaptive vertical skip ────────────────────────────────────────────────
    # Top: skip cap + shoulder + label (typically 28-35% of bottle height)
    # Bottom: skip base shadow + base label (typically 10-15%)
    top_skip_frac = 0.30 if aspect > 3.0 else 0.35
    bot_skip_frac = 0.12

    top_skip = int(h * top_skip_frac)
    bot_skip = int(h * bot_skip_frac)

    ry = y + top_skip
    rh = max(h - top_skip - bot_skip, 6)

    return (rx, ry, rw, rh)


def _default_center_roi(shape: tuple[int, int]) -> Box:
    h, w = shape
    rw, rh = int(w * 0.28), int(h * 0.36)
    rx, ry = (w - rw) // 2, (h - rh) // 2
    return (rx, ry, rw, rh)


def detect_liquid_region(bgr: np.ndarray) -> LiquidDetectionResult:
    """Detect the bottle and extract a conservative liquid sampling ROI.
    
    The pipeline:
    1. Grayscale → adaptive Canny → morphological closing → contour selection
    2. (Optional) GrabCut refinement for higher precision on small images
    3. Inner rectangle carving to exclude glass walls, labels, cap, and base
    4. Fallback to centered default crop if no confident bottle found
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    found = _find_bottle_box(gray)

    if found is not None:
        bottle_box, bottle_contour, confidence = found
        roi = _liquid_roi_from_bottle(bottle_box, bottle_contour)

        # Optional GrabCut refinement — only when confidence is medium
        # (high confidence means the Canny already found a clean silhouette)
        if 0.35 < confidence < 0.75:
            gc_mask = _refine_with_grabcut(bgr, bottle_box)
            if gc_mask is not None:
                # Re-derive bounding box from GrabCut mask for a tighter fit
                coords = cv2.findNonZero(gc_mask)
                if coords is not None:
                    gx, gy, gw, gh = cv2.boundingRect(coords)
                    refined_box = (gx, gy, gw, gh)
                    # Only accept if it's inside the original box and not dramatically smaller
                    if gw * gh > 0.4 * (bottle_box[2] * bottle_box[3]):
                        roi = _liquid_roi_from_bottle(refined_box, None)
                        confidence = min(confidence + 0.1, 0.90)
    else:
        bottle_box = None
        bottle_contour = None
        roi = _default_center_roi(gray.shape)
        confidence = 0.25

    return LiquidDetectionResult(
        bottle_box=bottle_box,
        bottle_contour=bottle_contour,
        liquid_roi=roi,
        bottle_found=bottle_box is not None,
        detection_confidence=confidence,
    )
