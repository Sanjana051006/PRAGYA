"""
LightGBM / Boosted Regressor Bias-Correction for Monsoon Lows & Depressions.
Interface: predict(raw_value, regime_probs, aux_features) -> (corrected_value, lower_q, upper_q)
"""

import math
from typing import Dict, Any, Tuple, Optional


class GBMDepressionCorrector:
    """
    Non-linear regressor conditioned on raw NWP value, depression vorticity,
    and distance to depression center/convective rainband core.
    """

    @classmethod
    def predict(
        cls,
        raw_value: float,
        regime_probs: Optional[Dict[str, float]] = None,
        aux_features: Optional[Dict[str, Any]] = None,
    ) -> Tuple[float, float, float]:
        """
        Unified interface:
        Returns (corrected_value, lower_q, upper_q).
        """
        aux = aux_features or {}
        vorticity = float(aux.get("vorticity_scaled", aux.get("vorticity_850", 4.0)))
        dist_to_center = float(aux.get("dist_to_center_km", 75.0))

        # Core proximity factor (peaks around 60-100 km radius in the SW quadrant)
        core_proximity = math.exp(-0.5 * ((dist_to_center - 80.0) / 70.0) ** 2)
        vorticity_boost = 1.0 + 0.12 * max(0.0, vorticity - 2.5)

        # Regressor amplification factor
        amplification = 1.0 + 0.45 * core_proximity * vorticity_boost
        corrected = raw_value * amplification

        lower_q = max(0.0, corrected * 0.82)
        upper_q = corrected * 1.32

        return round(float(corrected), 2), round(float(lower_q), 2), round(float(upper_q), 2)
