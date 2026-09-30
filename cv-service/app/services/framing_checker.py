"""Validates bottle framing within the captured image.

Checks two things:
1. The bottle bounding box covers 8-75% of the frame area (not too far, not too close).
2. The bottle bounding box is not clipped at any edge (min 3% margin on all sides).
"""
from __future__ import annotations

import numpy as np

from app.core.config import settings
from app.core.logging import logger


class FramingChecker:
    """Validates that the bottle is properly framed within the image."""

    def __init__(
        self,
        min_frame_fraction: float | None = None,
        max_frame_fraction: float | None = None,
        min_edge_margin: float | None = None,
    ):
        self.min_frame_fraction = min_frame_fraction or settings.MIN_BOTTLE_FRAME_FRACTION
        self.max_frame_fraction = max_frame_fraction or settings.MAX_BOTTLE_FRAME_FRACTION
        self.min_edge_margin = min_edge_margin or settings.MIN_EDGE_MARGIN_FRACTION

    def analyze(
        self,
        image_shape: tuple[int, int],
        bottle_bbox: tuple[int, int, int, int] | None,
    ) -> dict:
        """Analyze bottle framing within the image.

        Args:
            image_shape: (height, width) of the image.
            bottle_bbox: (x, y, w, h) bounding box of the detected bottle.
                         If None, returns cannot_evaluate result.

        Returns:
            Dict with area_fraction, is_too_small, is_too_large, edge margins,
            is_clipped, and overall is_ok.
        """
        img_h, img_w = image_shape

        if bottle_bbox is None:
            return {
                "area_fraction": 0.0,
                "is_too_small": False,
                "is_too_large": False,
                "is_clipped": False,
                "clipped_edges": [],
                "margins": {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0},
                "is_ok": False,
                "cannot_evaluate": True,
            }

        bx, by, bw, bh = bottle_bbox
        img_area = float(img_w * img_h)
        bottle_area = float(bw * bh)
        area_fraction = bottle_area / max(img_area, 1.0)

        is_too_small = area_fraction < self.min_frame_fraction
        is_too_large = area_fraction > self.max_frame_fraction

        # Edge margin checks (fraction of image dimension)
        margin_top = float(by) / max(img_h, 1)
        margin_bottom = float(img_h - (by + bh)) / max(img_h, 1)
        margin_left = float(bx) / max(img_w, 1)
        margin_right = float(img_w - (bx + bw)) / max(img_w, 1)

        clipped_edges = []
        if margin_top < self.min_edge_margin:
            clipped_edges.append("top")
        if margin_bottom < self.min_edge_margin:
            clipped_edges.append("bottom")
        if margin_left < self.min_edge_margin:
            clipped_edges.append("left")
        if margin_right < self.min_edge_margin:
            clipped_edges.append("right")

        is_clipped = len(clipped_edges) > 0

        is_ok = not is_too_small and not is_too_large and not is_clipped

        return {
            "area_fraction": round(area_fraction, 3),
            "is_too_small": bool(is_too_small),
            "is_too_large": bool(is_too_large),
            "is_clipped": bool(is_clipped),
            "clipped_edges": clipped_edges,
            "margins": {
                "top": round(margin_top, 3),
                "bottom": round(margin_bottom, 3),
                "left": round(margin_left, 3),
                "right": round(margin_right, 3),
            },
            "is_ok": bool(is_ok),
            "cannot_evaluate": False,
        }
