"""
Unit Tests for Meteorological Verification Metrics.
"""

import pytest
import numpy as np
from src.verification.metrics import VerificationMetrics


def test_continuous_metrics():
    preds = np.array([10.0, 20.0, 30.0, 40.0])
    obs = np.array([12.0, 18.0, 33.0, 38.0])

    res = VerificationMetrics.compute_continuous(preds, obs)
    # diffs = [-2, 2, -3, 2] -> diff^2 = [4, 4, 9, 4] -> mean = 21/4 = 5.25 -> sqrt = 2.29
    assert abs(res["rmse"] - 2.29) < 0.05
    assert abs(res["mae"] - 2.25) < 0.05
    assert abs(res["mean_bias"] - (-0.25)) < 0.05


def test_categorical_metrics():
    # Threshold 50.0 mm
    # Pair 1: (60, 70) -> Hit
    # Pair 2: (40, 60) -> Miss
    # Pair 3: (70, 30) -> False Alarm
    # Pair 4: (20, 10) -> Correct Negative
    preds = np.array([60.0, 40.0, 70.0, 20.0])
    obs = np.array([70.0, 60.0, 30.0, 10.0])

    res = VerificationMetrics.compute_categorical_scores(preds, obs, threshold_mm=50.0)
    ct = res["contingency"]

    assert ct["H"] == 1
    assert ct["M"] == 1
    assert ct["F"] == 1
    assert ct["C"] == 1

    # POD = H / (H + M) = 1/2 = 0.5
    assert res["POD"] == 0.5
    # FAR = F / (H + F) = 1/2 = 0.5
    assert res["FAR"] == 0.5
    # CSI = H / (H + M + F) = 1/3 = 0.333
    assert res["CSI"] == 0.333
    # ETS: H_chance = (1+1)*(1+1)/4 = 1.0 -> (1 - 1.0) / (3 - 1.0) = 0.0
    assert res["ETS"] == 0.0


def test_fractions_skill_score():
    # Perfect alignment
    p = np.array([0, 10, 80, 100, 20, 0])
    o = np.array([0, 15, 85, 95, 18, 0])
    fss = VerificationMetrics.compute_fractions_skill_score(p, o, threshold_mm=50.0, window_size=3)
    assert fss > 0.85
