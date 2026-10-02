from abc import ABC, abstractmethod
import numpy as np
import cv2

from app.core.config import settings


class WhiteBalanceStrategy(ABC):
    @abstractmethod
    def apply(self, image_bgr: np.ndarray, patch_mask: np.ndarray | None = None) -> np.ndarray:
        pass


class NoWhiteBalance(WhiteBalanceStrategy):
    def apply(self, image_bgr: np.ndarray, patch_mask: np.ndarray | None = None) -> np.ndarray:
        return image_bgr.copy()


class GrayWorldWhiteBalance(WhiteBalanceStrategy):
    def apply(self, image_bgr: np.ndarray, patch_mask: np.ndarray | None = None) -> np.ndarray:
        b, g, r = cv2.split(image_bgr.astype(np.float32))
        b_avg = np.mean(b)
        g_avg = np.mean(g)
        r_avg = np.mean(r)

        if b_avg == 0 or g_avg == 0 or r_avg == 0:
            return image_bgr.copy()

        gray_avg = (b_avg + g_avg + r_avg) / 3.0

        b = np.clip(b * (gray_avg / b_avg), 0, 255)
        g = np.clip(g * (gray_avg / g_avg), 0, 255)
        r = np.clip(r * (gray_avg / r_avg), 0, 255)

        return cv2.merge([b, g, r]).astype(np.uint8)


class ShadesOfGrayWhiteBalance(WhiteBalanceStrategy):
    def __init__(self, p: int = 6):
        self.p = p

    def apply(self, image_bgr: np.ndarray, patch_mask: np.ndarray | None = None) -> np.ndarray:
        img_float = image_bgr.astype(np.float32)
        b, g, r = cv2.split(img_float)

        e_b = (np.mean(b ** self.p)) ** (1.0 / self.p)
        e_g = (np.mean(g ** self.p)) ** (1.0 / self.p)
        e_r = (np.mean(r ** self.p)) ** (1.0 / self.p)

        e_norm = (e_b + e_g + e_r) / 3.0
        if e_b == 0 or e_g == 0 or e_r == 0:
            return image_bgr.copy()

        b = np.clip(b * (e_norm / e_b), 0, 255)
        g = np.clip(g * (e_norm / e_g), 0, 255)
        r = np.clip(r * (e_norm / e_r), 0, 255)

        return cv2.merge([b, g, r]).astype(np.uint8)


class ReferencePatchWhiteBalance(WhiteBalanceStrategy):
    """
    Normalizes color based on a known neutral reference card or plain white/gray background.
    Calculates per-channel gains (k_R, k_G, k_B) to stabilize illumination across phone cameras.
    """

    # Below this many neutral-filtered candidate pixels, the filtered set is considered too
    # small to trust (could be noise) and the unfiltered patch is used instead.
    MIN_NEUTRAL_SAMPLES = 200

    def __init__(
        self,
        target_gray_level: float | None = None,
        min_gain: float | None = None,
        max_gain: float | None = None,
    ):
        # None (the default) means "target the patch's own mean" — cast-only correction, safe
        # against clipping. A number locks absolute exposure too; see config.py for the tradeoff.
        self.target_gray_level = target_gray_level if target_gray_level is not None else settings.WHITE_BALANCE_TARGET_GRAY_LEVEL
        self.min_gain = min_gain if min_gain is not None else settings.WHITE_BALANCE_MIN_GAIN
        self.max_gain = max_gain if max_gain is not None else settings.WHITE_BALANCE_MAX_GAIN

    def apply(self, image_bgr: np.ndarray, patch_mask: np.ndarray | None = None) -> np.ndarray:
        h, w = image_bgr.shape[:2]

        if patch_mask is not None and np.sum(patch_mask > 0) > 0:
            patch_pixels = image_bgr[patch_mask > 0].reshape(-1, 3)
        else:
            # Fallback only: no caller-supplied background mask (e.g. bottle bbox unknown).
            # Auto-sample the raw frame's top corners as a rough stand-in for the background.
            top_h = max(10, int(h * 0.12))
            corner_w = max(10, int(w * 0.20))
            tl = image_bgr[0:top_h, 0:corner_w]
            tr = image_bgr[0:top_h, w - corner_w:w]
            patch_pixels = np.vstack([tl.reshape(-1, 3), tr.reshape(-1, 3)])

        if len(patch_pixels) == 0:
            return image_bgr.copy()

        # Reject non-neutral pixels within the patch (a hand, clutter, or shadow that spills
        # into the sampled background region) so gains come only from genuinely white/gray
        # pixels rather than being skewed by whatever else happened to be in frame.
        # S < 80 rejects strongly colored pixels (bright red, green, blue objects) while keeping
        # warm/cool-tinted white-paper pixels which reach 26-70% HSV saturation under real illuminants.
        hsv_patch = cv2.cvtColor(patch_pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2HSV).reshape(-1, 3)
        neutral_selector = (hsv_patch[:, 1] < 80) & (hsv_patch[:, 2] > 80)
        if int(np.sum(neutral_selector)) >= self.MIN_NEUTRAL_SAMPLES:
            patch_pixels = patch_pixels[neutral_selector]

        # Compute robust median background channel values
        mean_b = float(np.median(patch_pixels[:, 0]))
        mean_g = float(np.median(patch_pixels[:, 1]))
        mean_r = float(np.median(patch_pixels[:, 2]))

        # Verify that sampled background is genuinely neutral/white (low saturation and decent brightness)
        hsv_sample = cv2.cvtColor(np.uint8([[[int(mean_r), int(mean_g), int(mean_b)]]]), cv2.COLOR_RGB2HSV)[0][0]
        sat = float(hsv_sample[1]) / 255.0 * 100.0
        val = float(hsv_sample[2]) / 255.0 * 100.0

        # If background is too saturated (> 40% saturation) or too dark (V < 45%), do not distort with blind gains
        # NOTE: 40% (not 25%) — warm fluorescent or incandescent white paper can reach 26-35% saturation
        # in HSV. Gating at 25% was incorrectly bypassing WB for real-world warm-light captures.
        # We only want to reject clearly non-neutral surfaces (colored walls, fabric, green grass).
        if sat > 40.0 or val < 45.0:
            return image_bgr.copy()

        # Default: target the patch's OWN mean, i.e. remove color cast only (gains bounded
        # 0.70-1.40, matches original safe behavior — cannot push a near-white liquid channel
        # past clipping). If target_gray_level is explicitly configured, exposure is locked to
        # that fixed level too — stronger correction, but risks clipping/hue-shift on pale or
        # near-white liquids under large gains, so it's opt-in, not the default.
        target_gray = self.target_gray_level if self.target_gray_level is not None else (mean_b + mean_g + mean_r) / 3.0
        gain_b = float(np.clip(target_gray / max(mean_b, 1.0), self.min_gain, self.max_gain))
        gain_g = float(np.clip(target_gray / max(mean_g, 1.0), self.min_gain, self.max_gain))
        gain_r = float(np.clip(target_gray / max(mean_r, 1.0), self.min_gain, self.max_gain))

        img_float = image_bgr.astype(np.float32)
        b, g, r = cv2.split(img_float)

        b = np.clip(b * gain_b, 0, 255)
        g = np.clip(g * gain_g, 0, 255)
        r = np.clip(r * gain_r, 0, 255)

        return cv2.merge([b, g, r]).astype(np.uint8)


class WhiteBalanceFactory:
    @staticmethod
    def get_strategy(method_name: str) -> WhiteBalanceStrategy:
        name = (method_name or "").upper().strip()
        if name == "GRAY_WORLD":
            return GrayWorldWhiteBalance()
        elif name == "SHADES_OF_GRAY":
            return ShadesOfGrayWhiteBalance()
        elif name in ["REFERENCE_PATCH", "AUTO", "CALIBRATED"]:
            return ReferencePatchWhiteBalance()
        else:
            return NoWhiteBalance()
