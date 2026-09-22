"""
Unit tests for data validation layer.
"""

import pytest
import pandas as pd
from src.data_pipeline.validate import MonsoonDataValidator, DataValidationError


def test_valid_dataset():
    df = pd.DataFrame({
        "nwp_rainfall_mm": [0.0, 45.0, 120.0, 250.0],
        "latitude": [10.0, 12.5, 18.0, 25.0],
        "longitude": [75.0, 76.5, 80.0, 85.0],
        "elevation_m": [50.0, 600.0, 1200.0, 2500.0],
        "lead_time_hours": [24, 48, 72, 120],
        "relative_humidity": [60.0, 85.0, 92.0, 98.0],
        "regime": ["active_monsoon", "coastal_orographic", "monsoon_low_depression", "break_monsoon"],
    })
    res = MonsoonDataValidator.validate(df)
    assert res["is_valid"] is True
    assert res["total_rows"] == 4


def test_null_value_rejection():
    df = pd.DataFrame({
        "nwp_rainfall_mm": [45.0, None, 120.0],
        "latitude": [10.0, 12.5, 18.0],
        "longitude": [75.0, 76.5, 80.0],
    })
    with pytest.raises(DataValidationError) as excinfo:
        MonsoonDataValidator.validate(df)
    assert "null values" in str(excinfo.value)


def test_out_of_bounds_rejection():
    df = pd.DataFrame({
        "nwp_rainfall_mm": [45.0, 999.0, 120.0],  # 999 > 500 max
        "latitude": [10.0, 12.5, 18.0],
        "longitude": [75.0, 76.5, 80.0],
    })
    with pytest.raises(DataValidationError) as excinfo:
        MonsoonDataValidator.validate(df)
    assert "outside physical range" in str(excinfo.value)
