"""
Unit Tests for Weather Regime Classifier (Tier A & Tier B).
"""

import pytest
import numpy as np
from src.config import WeatherRegime, DEFAULT_DEMO_DISTRICTS
from src.data_pipeline.synoptic_features import SynopticFeatureExtractor
from src.models.regime_classifier import RegimeClassifier


def test_synoptic_feature_extractor():
    extractor = SynopticFeatureExtractor()
    features = extractor.extract_from_raw_values(
        vorticity_850=3.2e-5,
        llj_speed_knots=34.0,
        u_850_ms=17.0,
        u_200_ms=-22.0,
        mslp_trough_hpa=998.0,
        olr_wm2=180.0,
        day_of_monsoon=75,
    )

    assert "vort_850_scaled" in features
    assert "llj_anomaly" in features
    assert features["vertical_shear_ms"] == 39.0 # 17 - (-22)
    assert features["mslp_deficit_hpa"] == -6.0 # 998 - 1004
    assert features["convective_index"] > 1.0


def test_regime_classifier_depression():
    classifier = RegimeClassifier()
    synoptic_features = {
        "vort_850_scaled": 6.5,
        "llj_speed_knots": 28.0,
        "vertical_shear_ms": 32.0,
        "mslp_deficit_hpa": -9.0, # Deep depression
        "olr_wm2": 140.0,          # Intense convection
        "doy_sin": 0.5,
    }

    result = classifier.predict_synoptic_regime(synoptic_features)
    assert result["primary_synoptic"] == WeatherRegime.DEPRESSION
    assert result["confidence"] > 0.60
    assert result["entropy"] < 0.70
    assert not result["fallback_active"]


def test_regime_classifier_break():
    classifier = RegimeClassifier()
    synoptic_features = {
        "vort_850_scaled": 0.5,
        "llj_speed_knots": 12.0,
        "vertical_shear_ms": 16.0,
        "mslp_deficit_hpa": 5.0,  # High pressure anomaly
        "olr_wm2": 260.0,         # Suppressed clouds
        "doy_sin": 0.2,
    }

    result = classifier.predict_synoptic_regime(synoptic_features)
    assert result["primary_synoptic"] == WeatherRegime.BREAK
    assert result["confidence"] > 0.55


def test_district_mesoscale_evaluation_orographic():
    classifier = RegimeClassifier()
    synoptic_features = {
        "vort_850_scaled": 2.5,
        "llj_speed_knots": 35.0,
        "vertical_shear_ms": 35.0,
        "mslp_deficit_hpa": -2.0,
        "olr_wm2": 185.0,
        "doy_sin": 0.4,
    }
    synoptic_result = classifier.predict_synoptic_regime(synoptic_features)
    
    idukki = next(d for d in DEFAULT_DEMO_DISTRICTS if d["id"] == "idukki")
    dist_eval = classifier.evaluate_district_regime(
        synoptic_result=synoptic_result,
        district_info=idukki,
        wind_speed_850=18.0,
        wind_direction_850=265.0,
    )

    assert dist_eval["effective_regime"] == WeatherRegime.OROGRAPHIC
    assert WeatherRegime.OROGRAPHIC.value in dist_eval["tier_b_flags"]
    assert dist_eval["is_windward"] is True
    assert dist_eval["upslope_kinematic_ascent_ms"] > 0.0
