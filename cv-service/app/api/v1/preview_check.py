"""
Lightweight preview-check endpoint for real-time camera guidance.

Accepts a small JPEG snapshot (phone sends a low-res frame every ~1.5s)
and returns a CaptureStatus within ~50-80ms. NO full analysis is run —
this is purely geometry + photometry checks for the live overlay.

Response JSON:
  {
    "status": "waiting" | "too_far" | "too_close" | "off_center" |
              "too_dark" | "too_bright" | "ready",
    "confidence": 0.0-1.0,
    "details": { "brightness": float, "bottle_area_pct": float, "offset_pct": float }
  }
"""
from __future__ import annotations

import io
import numpy as np
import cv2
from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from app.core.logging import logger

router = APIRouter()


class PreviewCheckResponse(BaseModel):
    status: str
    confidence: float
    details: dict


# ── Thresholds ──────────────────────────────────────────────────────────────
MIN_BOTTLE_AREA_PCT  = 0.08   # bottle must fill at least 8% of frame
MAX_BOTTLE_AREA_PCT  = 0.75   # but not more than 75%
MAX_CENTER_OFFSET_X  = 0.20   # bottle center must be within 20% of frame center (x-axis)
MIN_BRIGHTNESS_L     = 45.0   # CIE L* — too dark below this
MAX_BRIGHTNESS_L     = 96.0   # CIE L* — too bright above this


@router.post("/preview-check", response_model=PreviewCheckResponse)
async def preview_check(image: UploadFile = File(...)) -> PreviewCheckResponse:
    """Fast pre-capture quality gate — returns capture status in <80ms."""
    try:
        raw = await image.read()
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return PreviewCheckResponse(status="waiting", confidence=0.0, details={})

        h, w = img.shape[:2]

        # ── 1. Brightness check (fast — full-frame Lab L*) ─────────────────
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2Lab)
        l_channel = lab[:, :, 0].astype(np.float32) / 255.0 * 100.0
        median_l = float(np.median(l_channel))

        if median_l < MIN_BRIGHTNESS_L:
            return PreviewCheckResponse(
                status="too_dark",
                confidence=0.85,
                details={"brightness_l": round(median_l, 1)},
            )
        if median_l > MAX_BRIGHTNESS_L:
            return PreviewCheckResponse(
                status="too_bright",
                confidence=0.85,
                details={"brightness_l": round(median_l, 1)},
            )

        # ── 2. Bottle detection (edge-based — no YOLO needed) ──────────────
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Downsample for speed
        scale = 0.5
        small = cv2.resize(gray, (int(w * scale), int(h * scale)))
        blurred = cv2.GaussianBlur(small, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 90)
        # Dilate to connect bottle outline
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 15))
        dilated = cv2.dilate(edges, kernel, iterations=2)
        # Find contours
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return PreviewCheckResponse(status="waiting", confidence=0.6, details={"bottle_found": False})

        # Pick the tallest contour (bottle is taller than wide)
        best = None
        best_score = 0.0
        for c in contours:
            x, y, cw, ch = cv2.boundingRect(c)
            if ch < small.shape[0] * 0.15:  # skip tiny blobs
                continue
            aspect_score = ch / max(cw, 1)   # taller → more bottle-like
            area = cw * ch
            score = aspect_score * np.sqrt(area)
            if score > best_score:
                best_score = score
                best = (x, y, cw, ch)

        if best is None:
            return PreviewCheckResponse(status="waiting", confidence=0.5, details={"bottle_found": False})

        # Scale back to original coords
        bx, by, bw, bh = [int(v / scale) for v in best]

        bottle_area_pct = (bw * bh) / (w * h)
        bottle_cx = bx + bw / 2.0
        frame_cx  = w / 2.0
        offset_pct = abs(bottle_cx - frame_cx) / w

        details = {
            "brightness_l":    round(median_l, 1),
            "bottle_area_pct": round(bottle_area_pct * 100, 1),
            "offset_pct":      round(offset_pct * 100, 1),
            "bottle_found":    True,
        }

        # ── 3. Distance / framing checks ───────────────────────────────────
        if bottle_area_pct < MIN_BOTTLE_AREA_PCT:
            return PreviewCheckResponse(status="too_far",    confidence=0.8, details=details)
        if bottle_area_pct > MAX_BOTTLE_AREA_PCT:
            return PreviewCheckResponse(status="too_close",  confidence=0.8, details=details)
        if offset_pct > MAX_CENTER_OFFSET_X:
            return PreviewCheckResponse(status="off_center", confidence=0.75, details=details)

        # ── 4. All checks pass ─────────────────────────────────────────────
        return PreviewCheckResponse(status="ready", confidence=0.90, details=details)

    except Exception as exc:
        logger.warning(f"preview_check error: {exc}")
        return PreviewCheckResponse(status="waiting", confidence=0.0, details={})
