"""Tests for two-tier regime classifier."""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from regime_classifier import RegimeClassifier, SynopticFeatureExtractor
from config import WeatherRegime


def test_synoptic_feature_extractor():
    extractor = SynopticFeatureExtractor()
    features = extractor.extract(
        vorticity_850=3.2e-5,
        llj_speed_knots=28.0,
        u_850_ms=16.0,
        u_200_ms=-22.0,
        mslp_trough_hpa=998.0,
        olr_wm2=185.0,
        day_of_monsoon=75,
    )
    assert features["vort_850_scaled"] == 3.2
    assert features["vertical_shear_ms"] == 38.0
    assert features["mslp_deficit_hpa"] == 10.0


def test_active_monsoon_classification():
    classifier = RegimeClassifier()
    # Strong low level jet, moderate vorticity, strong easterly shear -> Active
    features = {
        "vort_850_scaled": 2.2,
        "llj_speed_knots": 30.0,
        "vertical_shear_ms": 35.0,
        "mslp_deficit_hpa": 2.0,
        "olr_wm2": 195.0,
        "doy_sin": 0.5,
    }
    result = classifier.predict_synoptic_regime(features)
    assert result["primary_synoptic"] == WeatherRegime.ACTIVE.value
    assert 0.0 <= result["confidence"] <= 1.0
    assert 0.0 <= result["uncertainty_entropy"] <= 1.0


def test_break_monsoon_classification():
    classifier = RegimeClassifier()
    # Weak LLJ, positive MSLP anomaly (+5.0 hPa), high OLR (suppressed convection) -> Break
    features = {
        "vort_850_scaled": 0.5,
        "llj_speed_knots": 12.0,
        "vertical_shear_ms": 16.0,
        "mslp_deficit_hpa": 5.0,
        "olr_wm2": 260.0,
        "doy_sin": 0.2,
    }
    result = classifier.predict_synoptic_regime(features)
    assert result["primary_synoptic"] == WeatherRegime.BREAK.value


def test_tier_b_orographic_override():
    classifier = RegimeClassifier()
    synoptic_result = {"primary_synoptic": WeatherRegime.ACTIVE.value, "confidence": 0.85}
    district_meta = {
        "mean_elevation_m": 1200.0,
        "elevation_gradient": 0.08,
        "dist_to_coast_km": 80.0,
    }
    res = classifier.evaluate_district_regime(synoptic_result, district_meta, wind_u_ms=15.0)
    assert res["effective_regime"] == WeatherRegime.OROGRAPHIC.value
    assert res["is_orographic"] is True
