from app.core.config import settings


class ConfidenceService:
    """Estimates confidence percentage for chemical color classification."""

    @staticmethod
    def calculate_confidence(
        quality_score: float,
        best_delta_e: float | None,
        class_separation: float | None,
        should_reject: bool,
        is_ambiguous: bool = False,
    ) -> float:
        if should_reject or best_delta_e is None or class_separation is None:
            return 0.0

        if is_ambiguous:
            return float(round(min(49.0, quality_score * 0.4), 1))

        # 1. Quality factor (0-100)
        q_factor = max(0.0, min(100.0, quality_score))

        # 2. Delta E match factor (lower ΔE -> higher factor)
        max_de = settings.MAX_ACCEPTABLE_DELTA_E
        de_factor = max(0.0, min(100.0, (1.0 - (best_delta_e / max_de)) * 100.0))

        # 3. Separation factor (larger separation -> higher factor)
        sep_factor = max(0.0, min(100.0, class_separation * 15.0))

        # Weighted calculation
        confidence = (0.40 * q_factor) + (0.40 * de_factor) + (0.20 * sep_factor)
        confidence = max(0.0, min(99.9, confidence))

        return float(round(confidence, 1))
