import numpy as np
import cv2
from app.services.color_converter import ColorConverter


class ColorExtractor:
    """Filters valid liquid ROI pixels and extracts robust RGB, HSV, and CIE Lab statistics.

    Improvements v2:
    - K-Means dominant cluster: finds the most populated uniform-color zone instead
      of pure percentile trimming — more robust for partially shadowed bottles.
    - Shadow band exclusion: removes pixels in the left/right 15% of the bounding-box
      width where bottle-glass refraction and shadow gradients appear.
    - Stronger glare mask: catches penumbra halos around specular hotspots (V>210, S<40)
      in addition to the fully clipped zone (V>248).
    """

    KMEANS_DOMINANT_MIN_FRACTION = 0.20

    def extract(
        self,
        image_bgr: np.ndarray,
        liquid_mask: np.ndarray,
        reflection_mask: np.ndarray | None = None,
    ) -> dict:
        h, w = image_bgr.shape[:2]

        # 1. Glare & Exposure mask
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        hsv_full = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
        v_ch = hsv_full[:, :, 2]
        s_ch = hsv_full[:, :, 1]

        specular_core     = (v_ch >= 248) & (s_ch <= 30)
        specular_penumbra = (v_ch >= 210) & (s_ch <= 40)
        glare_mask = specular_core | specular_penumbra

        exposure_valid_mask = (gray >= 10) & (gray <= 248) & (~glare_mask)

        # 2. Shadow band exclusion — left/right 15% of bottle column
        shadow_band_mask = np.ones((h, w), dtype=bool)
        roi_cols = np.where(np.any(liquid_mask > 0, axis=0))[0]
        if len(roi_cols) > 0:
            col_min, col_max = int(roi_cols[0]), int(roi_cols[-1])
            band_w = max(1, int((col_max - col_min + 1) * 0.15))
            shadow_band_mask[:, col_min: col_min + band_w] = False
            shadow_band_mask[:, col_max - band_w: col_max + 1] = False

        # 3. Combined valid pixel mask
        valid_mask = (liquid_mask > 0) & exposure_valid_mask & shadow_band_mask
        if reflection_mask is not None:
            valid_mask = valid_mask & (reflection_mask == 0)

        total_roi_pixels = int(np.sum(liquid_mask > 0))
        valid_pixel_count = int(np.sum(valid_mask))
        rejected_pixel_count = total_roi_pixels - valid_pixel_count
        valid_pct = (
            (valid_pixel_count / total_roi_pixels * 100.0) if total_roi_pixels > 0 else 0.0
        )

        if valid_pixel_count == 0:
            return self._empty_result(h, w, total_roi_pixels)

        valid_bgr = image_bgr[valid_mask]
        valid_rgb = ColorConverter.bgr_to_rgb(valid_bgr)
        lab_pixels = ColorConverter.rgb_to_lab(valid_rgb)

        # 4. Distance Transform weighting
        mask_uint8 = np.uint8(valid_mask * 255)
        dist_transform = cv2.distanceTransform(mask_uint8, cv2.DIST_L2, 5)
        pixel_weights = dist_transform[valid_mask].astype(np.float64)
        sum_weights = np.sum(pixel_weights)
        if sum_weights > 0:
            pixel_weights = pixel_weights / sum_weights
        else:
            pixel_weights = np.ones(valid_pixel_count, dtype=np.float64) / valid_pixel_count

        # 5. K-Means dominant cluster
        kmeans_rgb, kmeans_lab = self._dominant_cluster_kmeans(
            valid_rgb, lab_pixels, pixel_weights, valid_pixel_count
        )

        # 6. IQR outlier trimming on the dominant cluster
        l_vals = kmeans_lab[:, 0]
        a_vals = kmeans_lab[:, 1]
        b_vals = kmeans_lab[:, 2]

        l_q10, l_q90 = np.percentile(l_vals, 10), np.percentile(l_vals, 90)
        a_q10, a_q90 = np.percentile(a_vals, 10), np.percentile(a_vals, 90)
        b_q10, b_q90 = np.percentile(b_vals, 10), np.percentile(b_vals, 90)

        iqr_mask = (
            (l_vals >= l_q10) & (l_vals <= l_q90) &
            (a_vals >= a_q10) & (a_vals <= a_q90) &
            (b_vals >= b_q10) & (b_vals <= b_q90)
        )

        n_cluster = len(kmeans_rgb)
        if np.sum(iqr_mask) >= max(10, int(n_cluster * 0.15)):
            trimmed_rgb = kmeans_rgb[iqr_mask]
            trimmed_lab = kmeans_lab[iqr_mask]
        else:
            l_only = (l_vals >= l_q10) & (l_vals <= l_q90)
            trimmed_rgb = kmeans_rgb[l_only] if np.sum(l_only) > 0 else kmeans_rgb
            trimmed_lab = kmeans_lab[l_only] if np.sum(l_only) > 0 else kmeans_lab

        trimmed_weights = np.ones(len(trimmed_rgb), dtype=np.float64) / max(1, len(trimmed_rgb))

        # 7. Weighted Median
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

        median_r = int(round(weighted_median(trimmed_rgb[:, 0], trimmed_weights)))
        median_g = int(round(weighted_median(trimmed_rgb[:, 1], trimmed_weights)))
        median_b = int(round(weighted_median(trimmed_rgb[:, 2], trimmed_weights)))

        mean_r = float(np.mean(trimmed_rgb[:, 0]))
        mean_g = float(np.mean(trimmed_rgb[:, 1]))
        mean_b = float(np.mean(trimmed_rgb[:, 2]))
        rgb_std = float(np.mean([np.std(trimmed_rgb[:, 0]), np.std(trimmed_rgb[:, 1]), np.std(trimmed_rgb[:, 2])]))

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

        mask_out = np.uint8(valid_mask * 255)
        hex_code = ColorConverter.rgb_to_hex(median_r, median_g, median_b)

        return {
            "valid_mask": mask_out,
            "total_roi_pixels": total_roi_pixels,
            "valid_pixels": valid_pixel_count,
            "rejected_pixels": rejected_pixel_count,
            "valid_pixel_percentage": round(valid_pct, 2),
            "hex": hex_code,
            "rgb": {"r": median_r, "g": median_g, "b": median_b, "mean_r": round(mean_r, 1), "mean_g": round(mean_g, 1), "mean_b": round(mean_b, 1), "std": round(rgb_std, 2)},
            "hsv": {"h": round(h_val, 1), "s": round(s_val, 1), "v": round(v_val, 1), "spread": round(hsv_spread, 2)},
            "lab": {"l": round(lab_l, 2), "a": round(lab_a, 2), "b": round(lab_b, 2), "spread": round(lab_spread, 2)},
        }

    def _dominant_cluster_kmeans(
        self,
        valid_rgb: np.ndarray,
        lab_pixels: np.ndarray,
        pixel_weights: np.ndarray,
        valid_pixel_count: int,
    ) -> tuple[np.ndarray, np.ndarray]:
        if valid_pixel_count < 50:
            return valid_rgb, lab_pixels

        k = min(5, max(2, valid_pixel_count // 200))
        lab_f32 = lab_pixels.astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
        try:
            _, labels, _ = cv2.kmeans(lab_f32, k, None, criteria, 5, cv2.KMEANS_PP_CENTERS)
        except cv2.error:
            return valid_rgb, lab_pixels

        labels = labels.flatten()
        cluster_counts = np.bincount(labels, minlength=k)
        dominant_label = int(np.argmax(cluster_counts))
        dominant_fraction = cluster_counts[dominant_label] / valid_pixel_count

        if dominant_fraction < self.KMEANS_DOMINANT_MIN_FRACTION:
            return valid_rgb, lab_pixels

        cluster_mask = labels == dominant_label
        return valid_rgb[cluster_mask], lab_pixels[cluster_mask]

    def _empty_result(self, h: int, w: int, total_roi_pixels: int) -> dict:
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
