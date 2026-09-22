"""Tests for district forecast aggregator."""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from district_aggregator import DistrictForecastAggregator
from config import DEFAULT_DEMO_DISTRICTS


def test_district_forecast_aggregator():
    aggregator = DistrictForecastAggregator()
    payload = {
        "synoptic_state": {
            "vorticity_850": 2.8e-5,
            "llj_speed_knots": 26.0,
            "u_850_ms": 15.0,
            "u_200_ms": -20.0,
            "mslp_trough_hpa": 1000.0,
            "olr_wm2": 190.0,
            "day_of_monsoon": 85,
        },
        "district_raw_qpf": {
            "idukki": 95.0,
            "wayanad": 80.0,
            "patna": 25.0,
        },
        "lead_time": "T+24",
    }
    res = aggregator.process_cycle(payload, DEFAULT_DEMO_DISTRICTS)
    assert "districts" in res
    assert len(res["districts"]) == len(DEFAULT_DEMO_DISTRICTS)
    assert res["lead_time"] == "T+24"

    # Verify each district has complete fields
    for d in res["districts"]:
        assert "district_id" in d
        assert "corrected_rainfall_mm" in d
        assert "p_heavy" in d
        assert "alert_level" in d
