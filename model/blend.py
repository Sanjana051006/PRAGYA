"""
Confidence Blending Module for Regime-Aware Post-Processing.
When Tier A classification confidence < 0.55 or entropy is elevated,
blends bias-corrected forecast outputs across the candidate regimes
instead of forcing an arbitrary hard classification boundary.
"""

from typing import Dict, Tuple, Any, List
import numpy as np


class ConfidenceBlender:
    """
    Blends bias corrections and credible intervals across multiple candidate regimes.
    """

    CONFIDENCE_THRESHOLD = 0.55

    @classmethod
    def should_blend(cls, top_prob: float) -> bool:
        """Returns True if top class probability is below threshold (0.55)."""
        return top_prob < cls.CONFIDENCE_THRESHOLD

    @classmethod
    def blend_predictions(
        cls,
        candidate_predictions: List[Dict[str, Any]],
        weights: List[float],
    ) -> Dict[str, Any]:
        """
        Blends corrected values and credible intervals (p10, p90) using normalized weights.
        """
        if not candidate_predictions:
            return {"corrected_mm": 0.0, "q10_mm": 0.0, "q90_mm": 0.0, "blended_regimes": []}

        if len(candidate_predictions) == 1 or sum(weights) == 0:
            p = candidate_predictions[0]
            return {
                "corrected_mm": p.get("corrected_mm", 0.0),
                "q10_mm": p.get("q10_mm", 0.0),
                "q90_mm": p.get("q90_mm", 0.0),
                "blended_regimes": [p.get("regime_applied", "Unknown")],
            }

        w = np.array(weights, dtype=np.float64)
        w = w / np.sum(w)

        corrected = float(sum(p["corrected_mm"] * w[i] for i, p in enumerate(candidate_predictions)))
        q10 = float(sum(p["q10_mm"] * w[i] for i, p in enumerate(candidate_predictions)))
        q90 = float(sum(p["q90_mm"] * w[i] for i, p in enumerate(candidate_predictions)))
        regimes = [p.get("regime_applied", f"R{i}") for i, p in enumerate(candidate_predictions)]

        return {
            "corrected_mm": round(corrected, 1),
            "q10_mm": round(q10, 1),
            "q90_mm": round(q90, 1),
            "blended_regimes": regimes,
            "weights": [round(float(val), 3) for val in w],
        }
