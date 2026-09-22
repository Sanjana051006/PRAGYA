"""
Spatial Residual Bias-Correction for Orographic Regimes (Western Ghats).
Interface: predict(raw_value, regime_probs, aux_features) -> (corrected_value, lower_q, upper_q)
"""

from typing import Dict, Any, Tuple, Optional
from src.data_pipeline.terrain_features import TerrainFeatureExtractor


class ResidualOrographicCorrector:
    """
    Spatial residual model conditioned on slope steepness, kinematic upslope ascent,
    and elevation lapse rates.
    """

    terrain_extractor = TerrainFeatureExtractor()

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
        mean_elev = float(aux.get("mean_elevation_m", aux.get("elevation_m", 600.0)))
        gradient = float(aux.get("elevation_gradient", 0.05))
        is_windward = bool(aux.get("is_windward", True))
        kinematic_ascent = float(aux.get("kinematic_ascent", 0.08))

        # Kinematic upslope scaling
        upslope_factor = 1.0 + 3.2 * max(0.0, kinematic_ascent)
        intermediate = raw_value * upslope_factor

        # Elevation lapse rate adjustment
        corrected = cls.terrain_extractor.compute_elevation_lapse_correction(
            base_rainfall_mm=intermediate,
            mean_elevation_m=mean_elev,
            is_windward=is_windward,
        )

        lower_q = max(0.0, corrected * 0.80)
        upper_q = corrected * 1.30

        return round(float(corrected), 2), round(float(lower_q), 2), round(float(upper_q), 2)
