"""
Confidence-Weighted Blend Bias-Correction for Coastal-Convective & Western Disturbance Regimes.
Interface: predict(raw_value, regime_probs, aux_features) -> (corrected_value, lower_q, upper_q)
"""

import math
from typing import Dict, Any, Tuple, Optional
from src.correction.qm_active_break import QMActiveBreakCorrector
from src.correction.gbm_depression import GBMDepressionCorrector


class BlendCoastalWDCorrector:
    """
    Ensemble blend of Empirical Quantile Mapping and non-linear regression
    with coastal boundary convergence adjustments.
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
        dist_to_coast = float(aux.get("dist_to_coast_km", 20.0))

        # Land-sea breeze convergence amplification near coast
        coastal_boost = 1.0 + 0.35 * math.exp(-dist_to_coast / 25.0)

        # Blend QM and GBM outputs
        qm_val, qm_low, qm_high = QMActiveBreakCorrector.predict(raw_value, regime_probs, aux_features)
        gbm_val, gbm_low, gbm_high = GBMDepressionCorrector.predict(raw_value, regime_probs, aux_features)

        # 60% QM, 40% GBM weighted blend * coastal factor
        corrected = (0.60 * qm_val + 0.40 * gbm_val) * coastal_boost
        lower_q = max(0.0, (0.60 * qm_low + 0.40 * gbm_low) * coastal_boost)
        upper_q = (0.60 * qm_high + 0.40 * gbm_high) * coastal_boost

        return round(float(corrected), 2), round(float(lower_q), 2), round(float(upper_q), 2)
