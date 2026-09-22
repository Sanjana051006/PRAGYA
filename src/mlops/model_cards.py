"""
Model Cards Module for Operational Machine Learning Governance.
Provides auditable, transparent model cards for every regime-conditioned model
conforming to MoES / IMD operational certification standards.
"""

from typing import Dict, List, Any
from src.config import WeatherRegime


class ModelCardRegistry:
    """
    Maintains and serves machine-readable and human-auditable model cards.
    """

    @staticmethod
    def get_all_cards() -> List[Dict[str, Any]]:
        """Returns model cards for all deployed regime models."""
        return [
            {
                "model_id": "mc-regime-clf-v1",
                "model_name": "Tier A Synoptic Regime Classifier",
                "architecture": "LightGBM Multiclass Gradient Boosted Trees (150 estimators, depth=5)",
                "training_window": "JJAS 2015–2023 (1,098 monsoon days)",
                "input_features": [
                    "Monsoon Trough 850 hPa Relative Vorticity",
                    "Arabian Sea Findlater LLJ Speed (knots)",
                    "Vertical Zonal Wind Shear (u850 - u200 m/s)",
                    "Trough MSLP Deficit (hPa)",
                    "OLR Convective Proxy (W/m^2)",
                    "Monsoon Seasonality Index (MSI)",
                    "Day-of-Monsoon (sin/cos cyclical)",
                ],
                "sample_count": 1098,
                "calibration": "Temperature-scaled softmax; isotonic reliability evaluated against held-out 2024 season",
                "known_failure_modes": [
                    "Transition days between Active and Break spells may exhibit high entropy (entropy > 0.70)",
                    "Early onset / delayed withdrawal anomalous synoptic patterns",
                ],
                "fallback_mechanism": "Soft-blends top-2 regime correction models when confidence < 0.55",
                "certifiable_for_operational_use": True,
            },
            {
                "model_id": "mc-qm-active-break-v1",
                "model_name": "Active / Break Empirical Quantile Mapping",
                "architecture": "Non-parametric Piecewise Empirical Quantile Mapping (EQM)",
                "training_window": "JJAS 2015–2023 stratified by meteorological subdivision",
                "sample_count": 1940,
                "input_features": ["Raw 24h NWP Rainfall (mm)", "Subdivision Climatology"],
                "calibration": "Continuous monotonic CDF matching with tail extrapolation",
                "known_failure_modes": [
                    "Extreme tail events exceeding historical 99.9th percentile require linear slope extrapolation",
                ],
                "certifiable_for_operational_use": True,
            },
            {
                "model_id": "mc-gbm-depression-v1",
                "model_name": "Monsoon Low / Depression GBM Regressor",
                "architecture": "LightGBM Regressor with Huber loss",
                "training_window": "58 historical Bay of Bengal and Arabian Sea depressions (2012–2023)",
                "sample_count": 420,
                "input_features": [
                    "Raw 24h NWP Rainfall (mm)",
                    "Distance to Vortex Center (km)",
                    "Vorticity Anomaly",
                    "Vertical Shear",
                    "Regime Probability",
                ],
                "calibration": "Pinball loss evaluated at 10th, 50th, 90th percentiles",
                "known_failure_modes": [
                    "Rapidly recurving or accelerating depressions with >120 km track displacement error",
                ],
                "certifiable_for_operational_use": True,
            },
            {
                "model_id": "mc-res-orographic-v1",
                "model_name": "Western Ghats Orographic Spatial Residual Model",
                "architecture": "Kinematic upslope ascent residual regression with elevation-lapse adjustment",
                "training_window": "JJAS 2016–2023 high-resolution Western Ghats AWS gauge network",
                "sample_count": 840,
                "input_features": [
                    "SRTM 90m Topographic Slope (dz/dx)",
                    "Slope Aspect vs Wind Direction Angle",
                    "Kinematic Upslope Ascent Velocity (m/s)",
                    "Mean Elevation (m)",
                ],
                "calibration": "Lapse rate adjusted up to 1400m crest level",
                "known_failure_modes": [
                    "Valley micro-climates shielded by localized knolls not resolved at 90m DEM",
                ],
                "certifiable_for_operational_use": True,
            },
        ]
