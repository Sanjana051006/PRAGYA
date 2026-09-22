"""
Unit tests for hand-computed toy contingency tables.
Verifies pure functions in src/verification/metrics.py:
rmse(), pod(), far(), csi(), ets(), fss()
"""

import pytest
import numpy as np
from src.verification.metrics import rmse, pod, far, csi, ets, fss, contingency_table_counts


def test_hand_computed_contingency_table():
    """
    Hand-calculated 2x2 contingency table scenario:
    Threshold = 64.5 mm
    Samples N = 10
    Hits (H) = 4: Pred >= 64.5 & Obs >= 64.5
    Misses (M) = 1: Pred < 64.5 & Obs >= 64.5
    False Alarms (F) = 2: Pred >= 64.5 & Obs < 64.5
    Correct Negatives (C) = 3: Pred < 64.5 & Obs < 64.5

    Hand calculation:
    N = 4 + 1 + 2 + 3 = 10
    POD = H / (H + M) = 4 / (4 + 1) = 4/5 = 0.800
    FAR = F / (H + F) = 2 / (4 + 2) = 2/6 = 0.333
    CSI = H / (H + M + F) = 4 / (4 + 1 + 2) = 4/7 = 0.571
    H_chance = ((H + M) * (H + F)) / N = (5 * 6) / 10 = 30 / 10 = 3.0
    ETS = (H - H_chance) / (H + M + F - H_chance) = (4 - 3.0) / (7 - 3.0) = 1.0 / 4.0 = 0.250
    """
    preds = np.array([70.0, 80.0, 90.0, 65.0, 50.0, 75.0, 85.0, 20.0, 10.0, 30.0])
    obs   = np.array([72.0, 85.0, 92.0, 68.0, 70.0, 40.0, 35.0, 15.0, 25.0, 10.0])
    threshold = 64.5

    h, m, f, c = contingency_table_counts(preds, obs, threshold=threshold)
    assert h == 4
    assert m == 1
    assert f == 2
    assert c == 3

    assert pod(preds, obs, threshold=threshold) == 0.800
    assert far(preds, obs, threshold=threshold) == 0.333
    assert csi(preds, obs, threshold=threshold) == 0.571
    assert ets(preds, obs, threshold=threshold) == 0.250


def test_hand_computed_rmse():
    """
    Hand-calculated RMSE:
    diffs = [2, -5, -2, -3, 20, 35, 50, 5, -15, 20]
    squared = [4, 25, 4, 9, 400, 1225, 2500, 25, 225, 400]
    sum = 4817
    mean = 481.7
    sqrt = 21.94766... -> 21.948
    """
    preds = np.array([70.0, 80.0, 90.0, 65.0, 50.0, 75.0, 85.0, 20.0, 10.0, 30.0])
    obs   = np.array([68.0, 85.0, 92.0, 68.0, 30.0, 40.0, 35.0, 15.0, 25.0, 10.0])
    computed_rmse = rmse(preds, obs)
    assert abs(computed_rmse - 21.948) < 0.01
