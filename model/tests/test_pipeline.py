"""Tests for unified PragyaPipeline."""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import PragyaPipeline


def test_pipeline_single_district():
    pipeline = PragyaPipeline()
    res = pipeline.predict_single_district(
        raw_rainfall_mm=60.0,
        regime="Active",
    )
    assert res["raw_mm"] == 60.0
    assert res["corrected_mm"] > 0
    assert "alert_level" in res
    assert "p_heavy" in res


def test_pipeline_run_cycle():
    pipeline = PragyaPipeline()
    res = pipeline.run_cycle(lead_time="T+48")
    assert res["lead_time"] == "T+48"
    assert len(res["districts"]) > 0
