"""
Calibrated Heavy-Rainfall Probability Engine.
Computes exceedance probabilities for IMD operational thresholds:
- Heavy Rain (>= 64.5 mm)
- Very Heavy Rain (>= 115.6 mm)
- Extremely Heavy Rain (>= 204.5 mm)
Enforces strict monotonicity: P(EHR) <= P(VHR) <= P(HR).
Maps directly to IMD 4-stage alert levels (Green, Yellow, Orange, Red).
"""

import math
from typing import Dict, Any

try:
    from .config import (
        THRESH_HEAVY_MIN,
        THRESH_VERY_HEAVY_MIN,
        THRESH_EXTREMELY_HEAVY_MIN,
        AlertLevel,
    )
except ImportError:
    from config import (
        THRESH_HEAVY_MIN,
        THRESH_VERY_HEAVY_MIN,
        THRESH_EXTREMELY_HEAVY_MIN,
        AlertLevel,
    )


class ProbabilityEngine:
    """
    Computes calibrated heavy precipitation exceedance probabilities from corrected quantiles.
    """

    def __init__(self):
        pass

    def _logistic_exceedance(
        self,
        p50: float,
        p10: float,
        p90: float,
        threshold: float,
        shape_param: float = 1.0,
    ) -> float:
        """
        Calculates exceedance probability assuming an asymmetric distribution
        defined by the predicted quantiles (p10, p50, p90).
        """
        if p50 <= 0.0:
            return 0.0

        if threshold >= p50:
            scale = max(1.0, (p90 - p50) / 1.28)
        else:
            scale = max(1.0, (p50 - p10) / 1.28)

        z = (threshold - p50) / (scale * shape_param)
        prob = 1.0 / (1.0 + math.exp(min(50.0, max(-50.0, z))))
        return float(prob)

    def compute_probabilities(
        self,
        corrected_p50: float,
        quantile_p10: float,
        quantile_p90: float,
        regime_str: str = "Active",
    ) -> Dict[str, Any]:
        """
        Computes calibrated exceedance probabilities for Heavy, Very Heavy, and Extremely Heavy rain.
        Ensures strict non-crossing monotonicity: P(EHR) <= P(VHR) <= P(HR).
        """
        if "Depression" in regime_str or "Orographic" in regime_str:
            shape = 1.15
        elif "Break" in regime_str:
            shape = 0.85
        else:
            shape = 1.0

        p_heavy = self._logistic_exceedance(corrected_p50, quantile_p10, quantile_p90, THRESH_HEAVY_MIN, shape)
        p_very_heavy = self._logistic_exceedance(corrected_p50, quantile_p10, quantile_p90, THRESH_VERY_HEAVY_MIN, shape)
        p_extreme = self._logistic_exceedance(corrected_p50, quantile_p10, quantile_p90, THRESH_EXTREMELY_HEAVY_MIN, shape)

        # Enforce strict monotonicity
        p_very_heavy = min(p_very_heavy, p_heavy)
        p_extreme = min(p_extreme, p_very_heavy)

        # Determine IMD Alert Color Code
        if p_extreme >= 0.40 or p_very_heavy >= 0.75:
            alert_level = AlertLevel.RED
            action_statement = "Take Action: Mobilize district emergency teams, prepare for severe inundation / landslides."
        elif p_very_heavy >= 0.50 or p_heavy >= 0.70:
            alert_level = AlertLevel.ORANGE
            action_statement = "Be Prepared: High risk of localized waterlogging and low-lying flash floods."
        elif p_heavy >= 0.25:
            alert_level = AlertLevel.YELLOW
            action_statement = "Be Updated: Monitor local river gauges and drainage systems."
        else:
            alert_level = AlertLevel.GREEN
            action_statement = "No Warning: Normal operational monitoring."

        return {
            "p_heavy": round(p_heavy, 2),
            "p_very_heavy": round(p_very_heavy, 2),
            "p_extremely_heavy": round(p_extreme, 2),
            "alert_level": alert_level.value,
            "action_statement": action_statement,
        }
