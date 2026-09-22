"""
Unit Tests for Regime-Conditioned Bias Correction and Probability Engine.
"""

import pytest
from src.config import WeatherRegime, AlertLevel, DEFAULT_DEMO_DISTRICTS
from src.models.bias_correction import RegimeConditionedBiasCorrector
from src.models.probability_engine import ProbabilityEngine


def test_quantile_mapping_active():
    corrector = RegimeConditionedBiasCorrector()
    p10, p50, p90 = corrector.correct_active(raw_val=65.0)
    
    # In active spells, NWP underestimates heavy rain, so p50 should be elevated
    assert p50 >= 65.0
    assert p10 < p50 < p90


def test_quantile_mapping_break():
    corrector = RegimeConditionedBiasCorrector()
    p10, p50, p90 = corrector.correct_break(raw_val=15.0)
    
    # In break spells, spurious light rain is squashed
    assert p50 < 15.0
    assert p10 < p50 < p90


def test_orographic_spatial_residual():
    corrector = RegimeConditionedBiasCorrector()
    p10, p50, p90 = corrector.correct_orographic(
        raw_val=88.0,
        elevation_gradient=0.085,
        mean_elevation_m=1200.0,
        is_windward=True,
        kinematic_ascent=0.045,
    )

    # In orographic crest with windward ascent, peak rain should be strongly elevated
    assert p50 > 120.0
    assert p10 < p50 < p90


def test_probability_engine_calibration():
    engine = ProbabilityEngine()
    probs = engine.compute_probabilities(
        corrected_p50=146.0,
        quantile_p10=116.0,
        quantile_p90=190.0,
        regime_str="Orographic",
    )

    assert probs["p_heavy"] > 0.80
    assert probs["p_very_heavy"] >= 0.50
    assert probs["p_extremely_heavy"] <= probs["p_very_heavy"] <= probs["p_heavy"]
    assert probs["alert_level"] in [AlertLevel.ORANGE.value, AlertLevel.RED.value]
