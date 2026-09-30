"""Isolates the bottle from its background before color sampling.

Primary path: fill the exact bottle contour already traced by the Canny-edge
bottle detector (deterministic, unaffected by background clutter color/shape,
since it works purely off edges). Falls back to a padded rectangular crop
around the seed box when no contour is available (manual ROI selection, or
auto-detection didn't find a confident bottle silhouette) — a plain rectangle
is a cruder cutout than a contour fill, so callers should surface that as a
lower-confidence isolation.
"""
from __future__ import annotations

import cv2
import numpy as np

Box = tuple[int, int, int, int]  # x, y, w, h


def _rect_fallback(bgr: np.ndarray, seed_box: Box) -> tuple[np.ndarray, np.ndarray, bool]:
    h_img, w_img = bgr.shape[:2]
    x, y, w, h = seed_box
    pad_x, pad_y = int(w * 0.1), int(h * 0.08)
    rx = max(0, x - pad_x)
    ry = max(0, y - pad_y)
    rw = min(w_img - rx, w + 2 * pad_x)
    rh = min(h_img - ry, h + 2 * pad_y)

    mask = np.zeros((h_img, w_img), dtype=np.uint8)
    mask[ry : ry + rh, rx : rx + rw] = 255
    white = np.full_like(bgr, 255)
    isolated = np.where(mask[:, :, None] > 0, bgr, white).astype(np.uint8)
    return isolated, mask, True


def remove_background(
    bgr: np.ndarray,
    seed_box: Box,
    contour: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, bool]:
    """Isolate the bottle onto a solid white background.

    Returns (isolated_bgr, foreground_mask, approximate). `approximate` is
    True when no bottle contour was available and a plain rectangular cutout
    was used instead — a coarser isolation worth flagging to the caller.
    """
    if contour is None or len(contour) < 3:
        return _rect_fallback(bgr, seed_box)

    h_img, w_img = bgr.shape[:2]
    mask = np.zeros((h_img, w_img), dtype=np.uint8)
    # The traced contour can include strong internal edges (e.g. a glare line
    # at the liquid surface) alongside the true outer boundary, which makes
    # it self-intersecting — filling it directly then only fills thin bands
    # along those edges instead of the solid bottle shape. A bottle silhouette
    # (stacked rectangles/trapezoid) is already close to convex, so filling
    # the convex hull instead reliably gives a solid mask.
    hull = cv2.convexHull(contour)
    cv2.drawContours(mask, [hull], -1, 255, thickness=cv2.FILLED)

    # The edge-derived contour hugs the outer edge of the glass; grow it a
    # couple of pixels so the glass rim itself isn't shaved off and left as a
    # thin non-white ring in the isolated image.
    kernel = np.ones((7, 7), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)

    if mask.sum() < 0.02 * (w_img * h_img) * 255:
        return _rect_fallback(bgr, seed_box)

    white = np.full_like(bgr, 255)
    isolated = np.where(mask[:, :, None] > 0, bgr, white).astype(np.uint8)
    return isolated, mask, False
