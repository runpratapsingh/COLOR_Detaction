"""ML & Computer Vision Object Recognition Service.

Detects whether an image contains a chemical bottle/container or an unrelated object
using multi-scale contour geometry and spatial coherence analysis.
"""
from __future__ import annotations

from dataclasses import dataclass
import cv2
import numpy as np


@dataclass
class ObjectDetectionResult:
    is_bottle: bool
    primary_object: str
    confidence: float
    bbox: tuple[int, int, int, int] | None
    detected_objects: list[dict]


class ObjectDetector:
    """Classifies objects in images to verify chemical bottle/vial presence and returns object label."""

    def __init__(self):
        pass

    def detect(self, bgr_image: np.ndarray) -> ObjectDetectionResult:
        """Analyzes an image and identifies if a bottle/liquid container is present.
        
        Optimized for chemical testing sample bottles & cylindrical vials with caps,
        supporting translucent, colored, and clear solutions against neutral backgrounds.
        """
        if bgr_image is None or bgr_image.size == 0:
            return ObjectDetectionResult(
                is_bottle=False,
                primary_object="unknown",
                confidence=0.0,
                bbox=None,
                detected_objects=[],
            )

        h_img, w_img = bgr_image.shape[:2]
        img_area = float(w_img * h_img)

        # 0. Fast reject for completely uniform blank images
        if float(np.std(bgr_image)) < 5.0:
            return ObjectDetectionResult(
                is_bottle=False,
                primary_object="unrelated_object",
                confidence=0.0,
                bbox=None,
                detected_objects=[{"label": "unrelated_object", "confidence": 0.0, "bbox": [0, 0, w_img, h_img]}],
            )

        # 1. Multi-channel color gradient (B, G, R, and Saturation)
        # Chemical liquids (e.g. yellow, orange, red, pink, amber) often match white paper
        # in grayscale luminance, but exhibit high contrast in Blue channel and Saturation!
        b_ch, g_ch, r_ch = cv2.split(bgr_image)
        hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
        s_ch = hsv[:, :, 1]

        edge_b = cv2.Canny(b_ch, 15, 80)
        edge_g = cv2.Canny(g_ch, 15, 80)
        edge_r = cv2.Canny(r_ch, 15, 80)
        edge_s = cv2.Canny(s_ch, 15, 80)
        color_edges = np.maximum(np.maximum(edge_b, edge_g), np.maximum(edge_r, edge_s))

        # Suppress outer 2% margin to avoid frame edges forming full-image contours
        pad_y = max(3, int(h_img * 0.02))
        pad_x = max(3, int(w_img * 0.02))
        color_edges[:pad_y, :] = 0
        color_edges[-pad_y:, :] = 0
        color_edges[:, :pad_x] = 0
        color_edges[:, -pad_x:] = 0

        # 2. Chromatic / Liquid Salience Map
        # Liquid in chemical test vials has higher saturation than neutral background paper
        med_s = float(np.median(s_ch))
        chroma_thresh = max(22.0, med_s + 16.0)
        chroma_mask = (s_ch > chroma_thresh).astype(np.uint8) * 255
        chroma_mask[:pad_y, :] = 0
        chroma_mask[-pad_y:, :] = 0
        chroma_mask[:, :pad_x] = 0
        chroma_mask[:, -pad_x:] = 0

        # 3. Vertical morphology to connect cap, neck, and liquid column into single container
        kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 15))
        closed_edges = cv2.morphologyEx(color_edges, cv2.MORPH_CLOSE, kernel_v, iterations=2)

        # Fuse structural edges and chromatic liquid blob
        fused_map = np.maximum(closed_edges, chroma_mask)
        kernel_fuse = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        fused_map = cv2.morphologyEx(fused_map, cv2.MORPH_CLOSE, kernel_fuse, iterations=1)

        contours, _ = cv2.findContours(fused_map, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best_bbox = None
        best_confidence = 0.0
        detected_objects = []

        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = float(w * h)

            # Accommodate real chemical sample vials: from small vials (0.3% of frame) to close-ups (98%)
            if area < 0.003 * img_area or area > 0.98 * img_area:
                continue

            aspect_ratio = float(h) / max(float(w), 1.0)
            center_x = x + w / 2.0
            center_dist = abs(center_x - w_img / 2.0) / float(w_img)

            # Check vertical container orientation and central alignment
            if 0.85 <= aspect_ratio <= 6.0 and center_dist < 0.44 and h >= 0.06 * h_img:
                size_score = min(1.0, (area / img_area) / 0.05)
                center_score = max(0.0, 1.0 - center_dist * 2.2)
                aspect_score = 1.0 if 1.1 <= aspect_ratio <= 4.2 else 0.75

                # Bonus if chromatic liquid is present inside the bounding box
                roi_chroma = chroma_mask[y : y + h, x : x + w]
                chroma_ratio = float(np.sum(roi_chroma > 0)) / max(float(area), 1.0)
                chroma_bonus = min(0.35, chroma_ratio * 0.7)

                conf = round(
                    float(0.30 * aspect_score + 0.35 * center_score + 0.15 * size_score + chroma_bonus),
                    2,
                )
                conf = min(0.96, conf)

                if conf > best_confidence:
                    best_confidence = conf
                    best_bbox = (x, y, w, h)

        # 4. Chromatic Liquid Fallback:
        # If edges were faint against white paper, use chromatic liquid column and expand upward for cap
        if best_confidence < 0.40 and np.sum(chroma_mask > 0) > 0.001 * img_area:
            y_pts, x_pts = np.where(chroma_mask > 0)
            lx1, lx2 = int(np.min(x_pts)), int(np.max(x_pts))
            ly1, ly2 = int(np.min(y_pts)), int(np.max(y_pts))
            lw = lx2 - lx1
            lh = ly2 - ly1
            center_x = lx1 + lw / 2.0
            center_dist = abs(center_x - w_img / 2.0) / float(w_img)

            if center_dist < 0.44 and lh >= 0.04 * h_img:
                # Expand upward by 40% for the vial cap and 6% for base
                cap_h = int(lh * 0.40)
                bx1 = max(0, lx1 - int(lw * 0.08))
                bx2 = min(w_img, lx2 + int(lw * 0.08))
                by1 = max(0, ly1 - cap_h)
                by2 = min(h_img, ly2 + int(lh * 0.06))
                best_bbox = (bx1, by1, bx2 - bx1, by2 - by1)
                best_confidence = 0.88

        # 5. Secondary Guide ROI verification (for clear water / blank baseline vials with faint edges)
        if best_confidence < 0.40:
            center_roi = bgr_image[int(0.20 * h_img) : int(0.80 * h_img), int(0.25 * w_img) : int(0.75 * w_img)]
            if center_roi.size > 0:
                gray_center = cv2.cvtColor(center_roi, cv2.COLOR_BGR2GRAY)
                std_val = float(np.std(gray_center))
                roi_blur = cv2.GaussianBlur(gray_center, (7, 7), 0)
                noise_diff = float(np.mean(np.abs(gray_center.astype(float) - roi_blur.astype(float))))
                sobel_x = np.abs(cv2.Sobel(gray_center, cv2.CV_64F, 1, 0, ksize=3))
                edge_energy = float(np.mean(sobel_x))

                # Bottle liquids have structural contrast with smooth interior
                if std_val > 8.0 and edge_energy > 2.0 and noise_diff < 22.0:
                    best_confidence = 0.75
                    best_bbox = (
                        int(0.25 * w_img),
                        int(0.20 * h_img),
                        int(0.50 * w_img),
                        int(0.60 * h_img),
                    )

        is_bottle = best_confidence >= 0.40

        if is_bottle and best_bbox is not None:
            primary_object = "bottle"
            detected_objects.append({
                "label": "bottle",
                "confidence": best_confidence,
                "bbox": list(best_bbox),
            })
        else:
            primary_object = "unrelated_object"
            best_confidence = round(min(0.35, best_confidence), 2)
            detected_objects.append({
                "label": "unrelated_object",
                "confidence": best_confidence,
                "bbox": [0, 0, w_img, h_img],
            })

        return ObjectDetectionResult(
            is_bottle=bool(is_bottle),
            primary_object=str(primary_object),
            confidence=float(best_confidence),
            bbox=best_bbox if is_bottle else None,
            detected_objects=detected_objects,
        )
