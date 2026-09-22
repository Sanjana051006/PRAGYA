"""Tests for multi-regime confidence blending module."""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from blend import ConfidenceBlender


def test_confidence_blender_threshold():
    assert ConfidenceBlender.should_blend(0.48) is True
    assert ConfidenceBlender.should_blend(0.55) is False
    assert ConfidenceBlender.should_blend(0.82) is False


def test_blend_predictions():
    candidates = [
        {"corrected_mm": 50.0, "q10_mm": 35.0, "q90_mm": 70.0, "regime_applied": "Active"},
        {"corrected_mm": 20.0, "q10_mm": 10.0, "q90_mm": 30.0, "regime_applied": "Break"},
    ]
    weights = [0.5, 0.5]
    res = ConfidenceBlender.blend_predictions(candidates, weights)
    # Equal weights: mean of 50 and 20 is 35
    assert res["corrected_mm"] == 35.0
    assert res["q10_mm"] == 22.5
    assert res["q90_mm"] == 50.0
    assert len(res["blended_regimes"]) == 2
