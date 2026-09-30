import cv2
import numpy as np
from app.core.config import settings


class RoiService:
    """Manages Bottle ROI, Adaptive Safe Liquid Core extraction, and Multi-ROI spatial partitioning."""

    def __init__(
        self,
        bottle_guide: tuple[float, float, float, float] | None = None,
        inner_margin: float | None = None,
    ):
        self.bottle_guide = bottle_guide or settings.DEFAULT_BOTTLE_ROI
        self.inner_margin = inner_margin or settings.DEFAULT_LIQUID_INNER_MARGIN

    def extract_rois(
        self,
        image_shape: tuple[int, int, int],
        custom_bottle_guide: tuple[float, float, float, float] | None = None,
        image_bgr: np.ndarray | None = None,
        custom_liquid_roi: tuple[float, float, float, float] | None = None,
    ) -> dict:
        h, w = image_shape[:2]
        guide = custom_bottle_guide or self.bottle_guide

        # 1. Bottle Bounding Box (Pixels)
        bx1 = int(round(guide[0] * w))
        by1 = int(round(guide[1] * h))
        bx2 = int(round(guide[2] * w))
        by2 = int(round(guide[3] * h))

        bx1, by1 = max(0, bx1), max(0, by1)
        bx2, by2 = min(w, bx2), min(h, by2)

        bottle_width = bx2 - bx1
        bottle_height = by2 - by1

        # 2. Adaptive Pure Liquid Core Extraction
        if custom_liquid_roi is not None:
            # User or caller explicitly selected/verified liquid ROI
            lx1 = int(round(custom_liquid_roi[0] * w))
            ly1 = int(round(custom_liquid_roi[1] * h))
            lx2 = int(round(custom_liquid_roi[2] * w))
            ly2 = int(round(custom_liquid_roi[3] * h))
        else:
            # Standard chemical bottles contain Cap & Shoulder Label in the top ~40-45%
            # Liquid core column is located between Y = 44% and Y = 78% of the bottle
            # Inset 20% from left and right edges to eliminate curved glass refraction caustics
            margin_x = int(round(bottle_width * 0.20))
            lx1 = bx1 + margin_x
            lx2 = bx2 - margin_x

            ly1 = by1 + int(round(bottle_height * 0.44))  # Clear below cap & label
            ly2 = by2 - int(round(bottle_height * 0.22))  # Clear above base curve, tabletop shadow & surface reflection

        # Ensure valid coordinate bounds
        lx1, ly1 = max(0, lx1), max(0, ly1)
        lx2, ly2 = min(w, max(lx1 + 4, lx2)), min(h, max(ly1 + 4, ly2))

        # Create binary masks
        bottle_mask = np.zeros((h, w), dtype=np.uint8)
        bottle_mask[by1:by2, bx1:bx2] = 255

        liquid_mask = np.zeros((h, w), dtype=np.uint8)
        liquid_mask[ly1:ly2, lx1:lx2] = 255

        # 3. Multi-ROI Spatial Partitioning (Top, Center, Bottom)
        liquid_height = ly2 - ly1
        sub_h = max(2, liquid_height // 3)

        top_bbox = (lx1, ly1, lx2, ly1 + sub_h)
        center_bbox = (lx1, ly1 + sub_h, lx2, ly1 + 2 * sub_h)
        bottom_bbox = (lx1, ly1 + 2 * sub_h, lx2, ly2)

        top_mask = np.zeros((h, w), dtype=np.uint8)
        top_mask[top_bbox[1]:top_bbox[3], top_bbox[0]:top_bbox[2]] = 255

        center_mask = np.zeros((h, w), dtype=np.uint8)
        center_mask[center_bbox[1]:center_bbox[3], center_bbox[0]:center_bbox[2]] = 255

        bottom_mask = np.zeros((h, w), dtype=np.uint8)
        bottom_mask[bottom_bbox[1]:bottom_bbox[3], bottom_bbox[0]:bottom_bbox[2]] = 255

        return {
            "bottle_bbox": (bx1, by1, bx2, by2),
            "liquid_bbox": (lx1, ly1, lx2, ly2),
            "normalized_bottle_roi": (
                round(bx1 / max(w, 1), 4),
                round(by1 / max(h, 1), 4),
                round(bx2 / max(w, 1), 4),
                round(by2 / max(h, 1), 4),
            ),
            "normalized_liquid_roi": (
                round(lx1 / max(w, 1), 4),
                round(ly1 / max(h, 1), 4),
                round(lx2 / max(w, 1), 4),
                round(ly2 / max(h, 1), 4),
            ),
            "bottle_mask": bottle_mask,
            "liquid_mask": liquid_mask,
            "spatial_rois": {
                "top": {"bbox": top_bbox, "mask": top_mask},
                "center": {"bbox": center_bbox, "mask": center_mask},
                "bottom": {"bbox": bottom_bbox, "mask": bottom_mask},
            },
        }
