"""Tests for probability engine and alert levels."""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from probability_engine import ProbabilityEngine
from config import AlertLevel


def test_probability_engine_monotonicity():
    engine = ProbabilityEngine()
    res = engine.compute_probabilities(
        corrected_p50=125.0,
        quantile_p10=90.0,
        quantile_p90=165.0,
        regime_str="Orographic",
    )
    # Check monotonicity: P(EHR) <= P(VHR) <= P(HR)
    assert res["p_extremely_heavy"] <= res["p_very_heavy"] <= res["p_heavy"]
    assert 0.0 <= res["p_heavy"] <= 1.0
    assert 0.0 <= res["p_very_heavy"] <= 1.0
    assert 0.0 <= res["p_extremely_heavy"] <= 1.0


def test_alert_level_red():
    engine = ProbabilityEngine()
    # High rainfall exceeding 200 mm
    res = engine.compute_probabilities(
        corrected_p50=220.0,
        quantile_p10=180.0,
        quantile_p90=280.0,
        regime_str="Active",
    )
    assert res["alert_level"] == AlertLevel.RED.value
    assert "Take Action" in res["action_statement"]


def test_alert_level_green():
    engine = ProbabilityEngine()
    # Light rainfall
    res = engine.compute_probabilities(
        corrected_p50=12.0,
        quantile_p10=5.0,
        quantile_p90=20.0,
        regime_str="Break",
    )
    assert res["alert_level"] == AlertLevel.GREEN.value
    assert res["p_heavy"] < 0.25
