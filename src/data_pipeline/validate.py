"""
Data validation module for Regime-Aware Rainfall Post-Processing System.
Provides strict schema validation, physical range assertions, null checks,
and regime distribution checks prior to model training and inference.
"""

from typing import Dict, Any, List, Tuple
import pandas as pd
import numpy as np


class DataValidationError(Exception):
    """Raised when data fails meteorological schema or physical constraint validation."""
    pass


class MonsoonDataValidator:
    """
    Validates meteorological input datasets against operational IMD physical ranges
    and schema requirements.
    """

    # Physical valid bounds for meteorological variables
    PHYSICAL_BOUNDS: Dict[str, Tuple[float, float]] = {
        "nwp_rainfall_mm": (0.0, 500.0),
        "latitude": (8.0, 37.0),
        "longitude": (68.0, 98.0),
        "elevation_m": (0.0, 6000.0),
        "lead_time_hours": (1.0, 168.0),
        "relative_humidity": (0.0, 100.0),
        "wind_speed_ms": (0.0, 60.0),
        "surface_pressure_hpa": (900.0, 1050.0),
        "sea_surface_temperature_c": (18.0, 36.0),
        "sst_anomaly_c": (-5.0, 5.0),
    }

    VALID_REGIMES: List[str] = [
        "active_monsoon",
        "break_monsoon",
        "monsoon_low_depression",
        "coastal_orographic",
        "western_disturbance",
        # Alternate naming forms
        "Active",
        "Break",
        "Low / Depression",
        "Orographic",
        "Coastal-Convective",
        "Western Disturbance",
    ]

    @classmethod
    def validate(cls, df: pd.DataFrame, check_regime: bool = True) -> Dict[str, Any]:
        """
        Validates DataFrame against schema, null constraints, and physical ranges.
        
        Returns:
            Dict containing validation summary statistics.
            
        Raises:
            DataValidationError: If any critical validation check fails.
        """
        issues: List[str] = []
        
        # 1. Null check
        null_counts = df.isnull().sum()
        critical_cols = [c for c in ["nwp_rainfall_mm", "latitude", "longitude"] if c in df.columns]
        for col in critical_cols:
            if null_counts[col] > 0:
                issues.append(f"Column '{col}' has {null_counts[col]} null values.")

        # 2. Physical range checks
        for col, (low, high) in cls.PHYSICAL_BOUNDS.items():
            if col in df.columns:
                series = pd.to_numeric(df[col], errors="coerce")
                out_of_bounds = ((series < low) | (series > high)).sum()
                if out_of_bounds > 0:
                    min_val = series.min()
                    max_val = series.max()
                    issues.append(
                        f"Column '{col}' has {out_of_bounds} values outside physical range "
                        f"[{low}, {high}]. Min found: {min_val}, Max found: {max_val}."
                    )

        # 3. Regime distribution check
        regime_distribution = {}
        if check_regime and "regime" in df.columns:
            regime_counts = df["regime"].value_counts(dropna=False).to_dict()
            regime_distribution = regime_counts
            invalid_regimes = [r for r in regime_counts.keys() if str(r) not in cls.VALID_REGIMES]
            if invalid_regimes:
                issues.append(f"Invalid regime labels detected: {invalid_regimes}")

        if issues:
            raise DataValidationError(f"Dataset validation failed with {len(issues)} issues:\n" + "\n".join(issues))

        return {
            "is_valid": True,
            "total_rows": len(df),
            "columns_validated": list(df.columns),
            "regime_distribution": regime_distribution,
        }
