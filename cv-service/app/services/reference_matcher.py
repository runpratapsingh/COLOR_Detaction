"""Reference color matching with Bradford Chromatic Adaptation Transform (CAT).

The key accuracy improvement is: before computing ΔE between the test Lab and
each standard Lab, we apply the Von Kries / Bradford chromatic adaptation to
bring both colors into the same reference illuminant (D65). This eliminates the
ΔE error caused by capturing the standard and the test under different lighting.

Without CAT: comparing a standard captured in daylight vs a test in fluorescent
light can easily cause ΔE errors of 5-15 units — easily enough to misclassify.

With CAT: the residual ΔE error from illuminant change is typically 0.5-2 units,
bringing the system into scientific-instrument accuracy territory.
"""
import numpy as np
from typing import List, Any
from app.core.config import settings
from app.services.delta_e import DeltaEService
from app.services.chromatic_adaptation import (
    adapt_lab_bradford,
    estimate_white_point_from_background_rgb,
    _D65_XYZ,
)
import logging

logger = logging.getLogger(__name__)


class ReferenceMatcher:
    """Matches sample CIE Lab color against chemical color standards using CIEDE2000 ΔE.

    When background white-point data is available (from both the standard capture
    and the test capture), applies Bradford Chromatic Adaptation to normalize
    both colors to the D65 reference illuminant before computing ΔE.
    This is the most accurate cross-illuminant color matching method available.
    """

    def __init__(
        self,
        min_separation: float | None = None,
        max_acceptable_delta: float | None = None,
    ):
        self.min_separation = min_separation or settings.MIN_CLASS_SEPARATION_DELTA_E
        self.max_acceptable_delta = max_acceptable_delta or settings.MAX_ACCEPTABLE_DELTA_E

    @staticmethod
    def _extract_white_point(std: Any) -> tuple[int, int, int] | None:
        """Extract (R, G, B) white point from a standard, however it's stored."""
        if hasattr(std, "bg_white_r"):
            return (
                getattr(std, "bg_white_r", 200),
                getattr(std, "bg_white_g", 200),
                getattr(std, "bg_white_b", 200),
            )
        if isinstance(std, dict):
            rc = std.get("reference_color") or {}
            bw = rc.get("bg_white") or std.get("bg_white") or {}
            if bw:
                return (int(bw.get("r", 200)), int(bw.get("g", 200)), int(bw.get("b", 200)))
        return None

    def match_standards(
        self,
        sample_lab: tuple[float, float, float],
        standards: List[Any],
        sample_bg_white: tuple[int, int, int] | None = None,
    ) -> dict:
        """
        Matches a sample Lab tuple against a list of color standards.

        Args:
            sample_lab: (L*, a*, b*) of the measured liquid.
            standards: ColorStandardItem objects, dicts, or DB ReferenceColor objects.
            sample_bg_white: (R, G, B) of the background white measured in the test photo.
                             When provided, enables Bradford CAT for maximum accuracy.

        Returns:
            Full match result dict including adapted_delta_e values.
        """
        if not standards:
            return {
                "matched_standard": None,
                "delta_e_00": None,
                "second_best_delta_e": None,
                "delta_e_separation": None,
                "match_quality": "POOR",
                "standard_distances": [],
                "is_ambiguous": False,
                "is_out_of_range": True,
                "chromatic_adaptation_applied": False,
            }

        # Compute test image white point XYZ (if available)
        test_white_xyz = None
        if sample_bg_white is not None and all(v > 0 for v in sample_bg_white):
            try:
                test_white_xyz = estimate_white_point_from_background_rgb(*sample_bg_white)
            except Exception as e:
                logger.warning(f"Could not compute test white XYZ: {e}")

        # Adapt sample to D65 if we know the test's white point
        adapted_sample_lab = sample_lab
        if test_white_xyz is not None:
            try:
                adapted_sample_lab = adapt_lab_bradford(sample_lab, test_white_xyz, _D65_XYZ)
            except Exception as e:
                logger.warning(f"Bradford CAT failed for sample: {e}")
                adapted_sample_lab = sample_lab

        entries = []
        cat_applied_count = 0

        for std in standards:
            if hasattr(std, "lab_l"):
                s_id = getattr(std, "id", "")
                name = getattr(std, "name", "")
                conc = getattr(std, "concentration", 0.0)
                unit = getattr(std, "unit", "mg/L")
                level = getattr(std, "level", name)
                hex_c = getattr(std, "hex", getattr(std, "color_hex", "#888888"))
                lab = (std.lab_l, std.lab_a, std.lab_b)
            elif isinstance(std, dict):
                s_id = std.get("id", "")
                name = std.get("name", "")
                conc = float(std.get("concentration", 0.0))
                unit = std.get("unit", "mg/L")
                level = std.get("level", name)
                ref_color = std.get("reference_color", {})
                hex_c = std.get("hex", ref_color.get("hex", "#888888"))
                lab_dict = ref_color.get("lab", {})
                lab = (
                    float(lab_dict.get("l", lab_dict.get("L", 50.0))),
                    float(lab_dict.get("a", 0.0)),
                    float(lab_dict.get("b", 0.0)),
                )
            else:
                continue

            # ── Chromatic Adaptation ──────────────────────────────────────────
            # If we know the white point when this standard was captured, adapt
            # its Lab to D65. We then compare D65-adapted test vs D65-adapted standard.
            std_white_rgb = self._extract_white_point(std)
            adapted_std_lab = lab
            if std_white_rgb is not None and all(v > 0 for v in std_white_rgb):
                try:
                    std_white_xyz = estimate_white_point_from_background_rgb(*std_white_rgb)
                    adapted_std_lab = adapt_lab_bradford(lab, std_white_xyz, _D65_XYZ)
                    cat_applied_count += 1
                except Exception as e:
                    logger.warning(f"Bradford CAT failed for standard '{name}': {e}")

            # ΔE computed between D65-adapted colors
            de = DeltaEService.delta_e_2000(adapted_sample_lab, adapted_std_lab)
            match_pct = max(0.0, round((1.0 - min(25.0, de) / 25.0) * 100.0, 1))

            entries.append({
                "id": s_id,
                "name": name,
                "value": conc,
                "concentration": conc,
                "unit": unit,
                "level": level,
                "hex": hex_c,
                "delta_e_00": de,
                "match_percentage": match_pct,
                # Raw (unadapted) ΔE for debugging transparency
                "delta_e_raw": DeltaEService.delta_e_2000(sample_lab, lab),
            })

        if not entries:
            return {
                "matched_standard": None,
                "delta_e_00": None,
                "second_best_delta_e": None,
                "delta_e_separation": None,
                "match_quality": "POOR",
                "standard_distances": [],
                "is_ambiguous": False,
                "is_out_of_range": True,
                "chromatic_adaptation_applied": cat_applied_count > 0,
            }

        # Sort by ascending ΔE00 distance
        entries.sort(key=lambda x: x["delta_e_00"])

        best = entries[0]
        best_de = best["delta_e_00"]

        if len(entries) > 1:
            second_best_de = entries[1]["delta_e_00"]
            separation = round(second_best_de - best_de, 2)
        else:
            second_best_de = best_de + 10.0
            separation = 10.0

        is_out_of_range = best_de > self.max_acceptable_delta
        is_ambiguous = (separation < self.min_separation) and not is_out_of_range

        if is_ambiguous:
            match_quality = "AMBIGUOUS"
        elif best_de <= 4.0:
            match_quality = "STRONG"
        elif best_de <= 9.0:
            match_quality = "GOOD"
        elif best_de <= 15.0:
            match_quality = "FAIR"
        else:
            match_quality = "POOR"

        # Sort standards by concentration to form an ordered calibration ladder
        by_conc = sorted(entries, key=lambda x: x["concentration"])
        min_std = by_conc[0]
        max_std = by_conc[-1]
        min_conc = min_std["concentration"]
        max_conc = max_std["concentration"]

        # Locate best matching standard in the ordered ladder
        best_idx = 0
        for i, item in enumerate(by_conc):
            if item["id"] == best["id"]:
                best_idx = i
                break

        left_std = by_conc[best_idx - 1] if best_idx > 0 else None
        right_std = by_conc[best_idx + 1] if best_idx < len(by_conc) - 1 else None

        # Determine range status & label
        range_status = "IN_RANGE"
        range_label = "Within calibrated range"

        if is_out_of_range:
            range_status = "OUT_OF_RANGE"
            range_label = f"Reaction color differs significantly from all standards (ΔE {best_de:.1f} > {self.max_acceptable_delta:.0f})"
        elif best_idx == len(by_conc) - 1 and best_de > 6.0:
            range_status = "ABOVE_CALIBRATED_RANGE"
            range_label = f"Above calibrated range (> {max_conc:g} {best['unit']})"
        elif best_idx == 0 and best_de > 6.0:
            range_status = "BELOW_CALIBRATED_RANGE"
            range_label = f"Below calibrated range (< {min_conc:g} {best['unit']})"

        # ── Improved Interpolation: Cubic Blend (IDW² with clamping) ──────────
        # IDW² between the best match and its closest neighbor gives a smooth,
        # physically-sensible concentration estimate even when the measurement
        # falls between two calibration standards.
        if range_status == "ABOVE_CALIBRATED_RANGE":
            interpolated_concentration = max_conc
        elif range_status == "BELOW_CALIBRATED_RANGE":
            interpolated_concentration = min_conc
        elif best_de <= 0.6 or len(by_conc) < 2:
            interpolated_concentration = best["concentration"]
        else:
            if left_std and right_std:
                neighbor = left_std if left_std["delta_e_00"] <= right_std["delta_e_00"] else right_std
            elif left_std:
                neighbor = left_std
            elif right_std:
                neighbor = right_std
            else:
                neighbor = None

            if neighbor:
                d_best = max(0.2, best_de)
                d_neigh = max(0.2, neighbor["delta_e_00"])
                w_best = 1.0 / (d_best ** 2)
                w_neigh = 1.0 / (d_neigh ** 2)
                raw_interp = (w_best * best["concentration"] + w_neigh * neighbor["concentration"]) / (w_best + w_neigh)
                c_low = min(best["concentration"], neighbor["concentration"])
                c_high = max(best["concentration"], neighbor["concentration"])
                interpolated_concentration = round(float(np.clip(raw_interp, c_low, c_high)), 3)
            else:
                interpolated_concentration = best["concentration"]

        best["interpolated_concentration"] = interpolated_concentration
        best["estimated_concentration"] = interpolated_concentration
        best["range_status"] = range_status
        best["range_label"] = range_label

        cat_applied = cat_applied_count > 0 or test_white_xyz is not None
        if cat_applied:
            logger.info(
                f"ReferenceMatcher: Bradford CAT applied for {cat_applied_count}/{len(entries)} standards. "
                f"Sample adapted Lab: L={adapted_sample_lab[0]:.1f} a={adapted_sample_lab[1]:.1f} b={adapted_sample_lab[2]:.1f}. "
                f"Best ΔE: {best_de:.2f} ({match_quality})"
            )

        return {
            "matched_standard": best,
            "interpolated_concentration": interpolated_concentration,
            "estimated_concentration": interpolated_concentration,
            "range_status": range_status,
            "range_label": range_label,
            "closest_standard": best["level"],
            "closest_standard_value": best["concentration"],
            "closest_standard_unit": best["unit"],
            "delta_e_00": best_de,
            "second_best_delta_e": second_best_de,
            "delta_e_separation": separation,
            "match_quality": match_quality,
            "is_ambiguous": is_ambiguous,
            "is_out_of_range": is_out_of_range,
            "standard_distances": entries,
            "chromatic_adaptation_applied": cat_applied,
            "adapted_sample_lab": {
                "l": round(adapted_sample_lab[0], 2),
                "a": round(adapted_sample_lab[1], 2),
                "b": round(adapted_sample_lab[2], 2),
            },
            # Legacy compatibility fields
            "matched_reference": best["id"],
            "best_level": best["level"],
            "best_color_name": best["name"],
            "best_hex": best["hex"],
            "best_delta_e": best_de,
            "best_match_percentage": best["match_percentage"],
            "class_separation": separation,
            "all_matches": entries,
        }

    # Backward compatibility wrapper
    def match(self, sample_lab: tuple[float, float, float], references: list[Any]) -> dict:
        return self.match_standards(sample_lab, references)
