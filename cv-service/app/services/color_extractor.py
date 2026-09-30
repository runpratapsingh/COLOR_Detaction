import numpy as np
import cv2
from app.services.color_converter import ColorConverter


class ColorExtractor:
    """Filters valid liquid ROI pixels and extracts robust RGB, HSV, and CIE Lab statistics."""

    def extract(
        self,
        image_bgr: np.ndarray,
        liquid_mask: np.ndarray,
        reflection_mask: np.ndarray | None = None,
    ) -> dict:
        h, w = image_bgr.shape[:2]

        # 1. Exposure & Glare penumbra mask (exclude extreme clipped and glare halo pixels)
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        hsv_full = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
        v_ch = hsv_full[:, :, 2]
        s_ch = hsv_full[:, :, 1]
        
        # Clip out severe glare halos (high brightness with low saturation)
        glare_penumbra_mask = (v_ch >= 225) & (s_ch <= 55)
        exposure_valid_mask = (gray >= 10) & (gray <= 248) & (~glare_penumbra_mask)

        # 2. Combined valid pixel mask
        valid_mask = (liquid_mask > 0) & exposure_valid_mask
        if reflection_mask is not None:
            valid_mask = valid_mask & (reflection_mask == 0)

        total_roi_pixels = int(np.sum(liquid_mask > 0))
        valid_pixel_count = int(np.sum(valid_mask))
        rejected_pixel_count = total_roi_pixels - valid_pixel_count
        valid_pct = (
            (valid_pixel_count / total_roi_pixels * 100.0) if total_roi_pixels > 0 else 0.0
        )

        if valid_pixel_count == 0:
            return {
                "valid_mask": np.zeros((h, w), dtype=np.uint8),
                "total_roi_pixels": total_roi_pixels,
                "valid_pixels": 0,
                "rejected_pixels": total_roi_pixels,
                "valid_pixel_percentage": 0.0,
                "rgb": {"r": 0, "g": 0, "b": 0, "mean_r": 0.0, "mean_g": 0.0, "mean_b": 0.0, "std": 0.0},
                "hsv": {"h": 0.0, "s": 0.0, "v": 0.0, "spread": 0.0},
                "lab": {"l": 0.0, "a": 0.0, "b": 0.0, "spread": 0.0},
            }

        # Extract BGR pixels
        valid_bgr = image_bgr[valid_mask]
        valid_rgb = ColorConverter.bgr_to_rgb(valid_bgr)
        lab_pixels = ColorConverter.rgb_to_lab(valid_rgb)

        # Distance Transform: Prioritize the central optical liquid core (where path length l = 2R)
        # and eliminate refraction caustics along curved bottle glass boundaries.
        mask_uint8 = np.uint8(valid_mask * 255)
        dist_transform = cv2.distanceTransform(mask_uint8, cv2.DIST_L2, 5)
        pixel_weights = dist_transform[valid_mask].astype(np.float64)
        sum_weights = np.sum(pixel_weights)
        if sum_weights > 0:
            pixel_weights = pixel_weights / sum_weights
        else:
            pixel_weights = np.ones(valid_pixel_count, dtype=np.float64) / valid_pixel_count

        # Robust Multi-Dimensional Outlier Trimming (15th to 85th percentile on L*, a*, b*)
        l_vals = lab_pixels[:, 0]
        a_vals = lab_pixels[:, 1]
        b_vals = lab_pixels[:, 2]

        l_q10, l_q90 = np.percentile(l_vals, 10), np.percentile(l_vals, 90)
        a_q10, a_q90 = np.percentile(a_vals, 10), np.percentile(a_vals, 90)
        b_q10, b_q90 = np.percentile(b_vals, 10), np.percentile(b_vals, 90)

        iqr_mask = (
            (l_vals >= l_q10) & (l_vals <= l_q90) &
            (a_vals >= a_q10) & (a_vals <= a_q90) &
            (b_vals >= b_q10) & (b_vals <= b_q90)
        )


        if np.sum(iqr_mask) >= max(10, int(valid_pixel_count * 0.15)):
            trimmed_rgb = valid_rgb[iqr_mask]
            trimmed_lab = lab_pixels[iqr_mask]
            trimmed_weights = pixel_weights[iqr_mask]
        else:
            # Fallback to L* single-channel IQR
            l_only_mask = (l_vals >= l_q10) & (l_vals <= l_q90)
            trimmed_rgb = valid_rgb[l_only_mask] if np.sum(l_only_mask) > 0 else valid_rgb
            trimmed_lab = lab_pixels[l_only_mask] if np.sum(l_only_mask) > 0 else lab_pixels
            trimmed_weights = pixel_weights[l_only_mask] if np.sum(l_only_mask) > 0 else pixel_weights

        # Helper for weighted median
        def weighted_median(vals: np.ndarray, w: np.ndarray) -> float:
            if len(vals) == 0:
                return 0.0
            if np.sum(w) <= 0:
                return float(np.median(vals))
            sort_idx = np.argsort(vals)
            sorted_vals = vals[sort_idx]
            sorted_w = w[sort_idx]
            cum_w = np.cumsum(sorted_w)
            cutoff = cum_w[-1] * 0.5
            idx = np.searchsorted(cum_w, cutoff)
            return float(sorted_vals[min(idx, len(sorted_vals) - 1)])

        # RGB Statistics with Core Distance-Transform Weighting
        median_r = int(round(weighted_median(trimmed_rgb[:, 0], trimmed_weights)))
        median_g = int(round(weighted_median(trimmed_rgb[:, 1], trimmed_weights)))
        median_b = int(round(weighted_median(trimmed_rgb[:, 2], trimmed_weights)))

        mean_r = float(np.mean(trimmed_rgb[:, 0]))
        mean_g = float(np.mean(trimmed_rgb[:, 1]))
        mean_b = float(np.mean(trimmed_rgb[:, 2]))
        rgb_std = float(np.mean([np.std(trimmed_rgb[:, 0]), np.std(trimmed_rgb[:, 1]), np.std(trimmed_rgb[:, 2])]))

        # Mathematical Synchronization: Derive HSV and CIE Lab directly from the extracted representative RGB
        rep_rgb_uint8 = np.uint8([[[median_r, median_g, median_b]]])
        hsv_converted = cv2.cvtColor(rep_rgb_uint8, cv2.COLOR_RGB2HSV)[0][0]
        h_val = float(hsv_converted[0]) * 2.0
        s_val = float(hsv_converted[1]) / 255.0 * 100.0
        v_val = float(hsv_converted[2]) / 255.0 * 100.0

        lab_converted = ColorConverter.rgb_to_lab(np.array([[median_r, median_g, median_b]], dtype=np.float32))[0]
        lab_l = float(lab_converted[0])
        lab_a = float(lab_converted[1])
        lab_b = float(lab_converted[2])

        hsv_pixels = cv2.cvtColor(valid_bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
        hsv_spread = float(np.mean([np.std(hsv_pixels[:, 0] * 2.0), np.std(hsv_pixels[:, 1] / 2.55), np.std(hsv_pixels[:, 2] / 2.55)]))
        lab_spread = float(np.mean([np.std(trimmed_lab[:, 0]), np.std(trimmed_lab[:, 1]), np.std(trimmed_lab[:, 2])]))

        mask_uint8 = np.uint8(valid_mask * 255)

        hex_code = ColorConverter.rgb_to_hex(median_r, median_g, median_b)

        return {
            "valid_mask": mask_uint8,
            "total_roi_pixels": total_roi_pixels,
            "valid_pixels": valid_pixel_count,
            "rejected_pixels": rejected_pixel_count,
            "valid_pixel_percentage": round(valid_pct, 2),
            "hex": hex_code,
            "rgb": {
                "r": median_r,
                "g": median_g,
                "b": median_b,
                "mean_r": round(mean_r, 1),
                "mean_g": round(mean_g, 1),
                "mean_b": round(mean_b, 1),
                "std": round(rgb_std, 2),
            },
            "hsv": {
                "h": round(h_val, 1),
                "s": round(s_val, 1),
                "v": round(v_val, 1),
                "spread": round(hsv_spread, 2),
            },
            "lab": {
                "l": round(lab_l, 2),
                "a": round(lab_a, 2),
                "b": round(lab_b, 2),
                "spread": round(lab_spread, 2),
            },
        }
