"""Color naming and hex/RGB conversion helpers shared across the CV pipeline."""
from __future__ import annotations

import re
from typing import Tuple

import numpy as np
from skimage.color import rgb2lab

HEX_RE = re.compile(r"^#?([0-9a-fA-F]{6})$")

# Representative sRGB values for the eleven named colors the product supports.
# These are used both for parsing "Yellow" -> RGB and for naming a detected RGB.
NAMED_COLORS: dict[str, Tuple[int, int, int]] = {
    "Red": (211, 47, 47),
    "Green": (56, 142, 60),
    "Blue": (25, 90, 205),
    "Yellow": (229, 212, 90),
    "Orange": (230, 126, 34),
    "Brown": (121, 85, 61),
    "Purple": (123, 63, 165),
    "Pink": (233, 121, 168),
    "Clear": (245, 245, 245),
    "White": (250, 250, 250),
    "Black": (25, 25, 25),
}


def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    match = HEX_RE.match(hex_str.strip())
    if not match:
        raise ValueError(f"Invalid hex color: {hex_str!r}")
    value = match.group(1)
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    r, g, b = (max(0, min(255, round(c))) for c in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


def resolve_color_input(value: str) -> Tuple[int, int, int]:
    """Accept either a named color ("Yellow") or a hex string ("#E5D45A")."""
    value = value.strip()
    if value.startswith("#") or HEX_RE.match(value):
        return hex_to_rgb(value)
    title = value.strip().title()
    if title in NAMED_COLORS:
        return NAMED_COLORS[title]
    raise ValueError(f"Unrecognized color: {value!r}")


def rgb_to_lab(rgb: Tuple[int, int, int]) -> Tuple[float, float, float]:
    arr = np.array([[[rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0]]], dtype=np.float64)
    lab = rgb2lab(arr)[0][0]
    return float(lab[0]), float(lab[1]), float(lab[2])


def rgb_to_hsv_deg(rgb: Tuple[int, int, int]) -> Tuple[float, float, float]:
    r, g, b = (c / 255.0 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    diff = mx - mn
    if diff == 0:
        h = 0.0
    elif mx == r:
        h = (60 * ((g - b) / diff) + 360) % 360
    elif mx == g:
        h = (60 * ((b - r) / diff) + 120) % 360
    else:
        h = (60 * ((r - g) / diff) + 240) % 360
    s = 0.0 if mx == 0 else diff / mx
    v = mx
    return round(h, 1), round(s * 100, 1), round(v * 100, 1)


_NAMED_LAB_CACHE: dict[str, Tuple[float, float, float]] | None = None


def _named_lab_table() -> dict[str, Tuple[float, float, float]]:
    global _NAMED_LAB_CACHE
    if _NAMED_LAB_CACHE is None:
        _NAMED_LAB_CACHE = {name: rgb_to_lab(rgb) for name, rgb in NAMED_COLORS.items()}
    return _NAMED_LAB_CACHE


def nearest_color_name(rgb: Tuple[int, int, int]) -> str:
    """Classify a detected RGB into one of the eleven supported color names.

    Falls back to simple HSV rules for near-neutral colors (white/black/clear)
    since pure Lab-distance can misclassify low-saturation liquids as "Pink"
    or similar chromatic colors that happen to sit nearby in Lab space.
    """
    h, s, v = rgb_to_hsv_deg(rgb)
    if v < 15:
        return "Black"
    if s < 12 and v > 85:
        return "White"
    if s < 18:
        return "Clear"

    lab = rgb_to_lab(rgb)
    table = _named_lab_table()
    best_name = "Yellow"
    best_dist = float("inf")
    for name, ref_lab in table.items():
        if name in ("White", "Black", "Clear"):
            continue
        dist = sum((a - b) ** 2 for a, b in zip(lab, ref_lab)) ** 0.5
        if dist < best_dist:
            best_dist = dist
            best_name = name
    return best_name
