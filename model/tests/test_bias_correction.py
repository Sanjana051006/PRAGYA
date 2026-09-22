"""Tests for regime-conditioned bias correction module."""

import pytest
import sys
from pathlib import Path

# Ensure model directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bias_correction import RegimeConditionedBiasCorrector
from config import WeatherRegime


def test_bias_correction_active():
    corrector = RegimeConditionedBiasCorrector()
    res = corrector.correct_rainfall(45.0, WeatherRegime.ACTIVE.value)
    assert res["corrected_mm"] > 0
    assert res["q10_mm"] <= res["corrected_mm"] <= res["q90_mm"]
    assert res["regime_applied"] == WeatherRegime.ACTIVE.value


def test_bias_correction_break():
    corrector = RegimeConditionedBiasCorrector()
    # During break spell, raw drizzle of 5 mm should be squashed
    res = corrector.correct_rainfall(5.0, WeatherRegime.BREAK.value)
    assert res["corrected_mm"] < 5.0
    assert res["q10_mm"] <= res["corrected_mm"] <= res["q90_mm"]


def test_bias_correction_depression():
    corrector = RegimeConditionedBiasCorrector()
    res = corrector.correct_rainfall(
        80.0,
        WeatherRegime.DEPRESSION.value,
        features={"vorticity_scaled": 5.5, "dist_to_center_km": 40.0}
    )
    # Depressions should amplify raw under-forecast
    assert res["corrected_mm"] > 80.0
    assert res["q10_mm"] <= res["corrected_mm"] <= res["q90_mm"]


def test_bias_correction_orographic():
    corrector = RegimeConditionedBiasCorrector()
    res = corrector.correct_rainfall(
        70.0,
        WeatherRegime.OROGRAPHIC.value,
        features={"orographic_lift_index": 1.8, "mean_elevation_m": 1200.0, "wind_u_ms": 16.0}
    )
    # Orographic lift should amplify raw precipitation over mountain ridges
    assert res["corrected_mm"] > 70.0
    assert res["q10_mm"] <= res["corrected_mm"] <= res["q90_mm"]
