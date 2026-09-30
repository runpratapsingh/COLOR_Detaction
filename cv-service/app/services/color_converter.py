import numpy as np
import cv2
from skimage import color


class ColorConverter:
    """Provides exact color space conversions between sRGB, HSV, and CIE L*a*b* (D65/2°)."""

    @staticmethod
    def bgr_to_rgb(bgr: np.ndarray) -> np.ndarray:
        if bgr.ndim == 2 and bgr.shape[1] == 3:
            return bgr[:, ::-1]
        return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    @staticmethod
    def rgb_to_hsv(rgb_pixel: tuple[int, int, int]) -> tuple[float, float, float]:
        """Converts RGB uint8 tuple (0-255) to HSV float tuple (H: 0-360, S: 0-100, V: 0-100)."""
        arr = np.uint8([[rgb_pixel]])
        hsv_arr = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[0][0]
        # OpenCV HSV ranges: H: 0-179, S: 0-255, V: 0-255
        h = float(hsv_arr[0]) * 2.0
        s = float(hsv_arr[1]) / 255.0 * 100.0
        v = float(hsv_arr[2]) / 255.0 * 100.0
        return (round(h, 1), round(s, 1), round(v, 1))

    @staticmethod
    def rgb_to_lab(rgb_pixels: np.ndarray) -> np.ndarray:
        """
        Converts RGB image array or pixel array (uint8 0-255) to standard CIE L*a*b* float array.
        Output ranges: L* in [0, 100], a* in [-128, 127], b* in [-128, 127].
        """
        rgb_normalized = rgb_pixels.astype(np.float64) / 255.0
        is_2d = rgb_pixels.ndim == 2 and rgb_pixels.shape[1] == 3
        if is_2d:
            rgb_3d = rgb_normalized.reshape(1, -1, 3)
            lab_3d = color.rgb2lab(rgb_3d)
            return lab_3d.reshape(-1, 3)
        return color.rgb2lab(rgb_normalized)

    @staticmethod
    def lab_to_rgb(l: float, a: float, b: float) -> tuple[int, int, int]:
        """Converts standard CIE L*a*b* float values to sRGB uint8 (0-255) tuple."""
        lab_arr = np.array([[[l, a, b]]], dtype=np.float64)
        rgb_float = color.lab2rgb(lab_arr)[0][0]
        rgb_clipped = np.clip(rgb_float * 255.0, 0, 255).astype(np.uint8)
        return (int(rgb_clipped[0]), int(rgb_clipped[1]), int(rgb_clipped[2]))

    @staticmethod
    def rgb_to_hex(r: int, g: int, b: int) -> str:
        """Converts RGB uint8 integers (0-255) to uppercase hex code #RRGGBB."""
        r_cl = max(0, min(255, int(round(r))))
        g_cl = max(0, min(255, int(round(g))))
        b_cl = max(0, min(255, int(round(b))))
        return f"#{r_cl:02X}{g_cl:02X}{b_cl:02X}"

    @staticmethod
    def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
        """Converts hex code #RRGGBB or RRGGBB to (r, g, b) tuple."""
        clean = hex_str.lstrip("#").strip()
        if len(clean) == 6:
            return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16))
        elif len(clean) == 3:
            return (int(clean[0] * 2, 16), int(clean[1] * 2, 16), int(clean[2] * 2, 16))
        return (128, 128, 128)
