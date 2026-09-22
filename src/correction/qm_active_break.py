"""
Empirical Quantile Mapping (EQM) Bias-Correction for Active and Break Monsoon Regimes.
Interface: predict(raw_value, regime_probs, aux_features) -> (corrected_value, lower_q, upper_q)
"""

from typing import Dict, Any, Tuple, Optional
import numpy as np


class QMActiveBreakCorrector:
    """
    Empirical Quantile Mapping transfer models fit separately for Active and Break regimes.
    """

    QM_ACTIVE_TABLE = [
        (0.0, 0.0),
        (5.0, 3.5),
        (15.0, 16.0),
        (35.0, 42.0),
        (65.0, 85.0),
        (100.0, 140.0),
        (150.0, 210.0),
        (250.0, 320.0),
    ]

    QM_BREAK_TABLE = [
        (0.0, 0.0),
        (5.0, 0.5),   # Spurious drizzle squashed
        (15.0, 3.0),  # Light convection squashed
        (35.0, 12.0),
        (65.0, 38.0),
        (100.0, 75.0),
        (150.0, 120.0),
        (250.0, 200.0),
    ]

    @classmethod
    def _interpolate(cls, x: float, table: list) -> float:
        if x <= table[0][0]:
            return table[0][1]
        if x >= table[-1][0]:
            slope = (table[-1][1] - table[-2][1]) / (table[-1][0] - table[-2][0] + 1e-6)
            return table[-1][1] + slope * (x - table[-1][0])
        for i in range(len(table) - 1):
            x0, y0 = table[i]
            x1, y1 = table[i+1]
            if x0 <= x <= x1:
                t = (x - x0) / (x1 - x0 + 1e-6)
                return y0 + t * (y1 - y0)
        return x

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
        p_active = 0.5
        p_break = 0.5
        if regime_probs:
            p_active = regime_probs.get("Active", regime_probs.get("active_monsoon", 0.5))
            p_break = regime_probs.get("Break", regime_probs.get("break_monsoon", 0.5))
            total = p_active + p_break
            if total > 0:
                p_active /= total
                p_break /= total
            else:
                p_active, p_break = 0.5, 0.5

        val_active = cls._interpolate(raw_value, cls.QM_ACTIVE_TABLE)
        val_break = cls._interpolate(raw_value, cls.QM_BREAK_TABLE)

        corrected = p_active * val_active + p_break * val_break
        lower_q = max(0.0, corrected * (0.78 * p_active + 0.60 * p_break))
        upper_q = corrected * (1.25 * p_active + 1.35 * p_break)

        return round(float(corrected), 2), round(float(lower_q), 2), round(float(upper_q), 2)
