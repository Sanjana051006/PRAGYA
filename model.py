"""
PRAGYA AI/ML Model Entrypoint.
Post-processing Rainfall with AI for Greater Yield Accuracy.

This module provides direct access to the full PRAGYA ML pipeline and its components.
Usage:
    from model import PragyaPipeline
    pipeline = PragyaPipeline()
    result = pipeline.predict_single_district(raw_rainfall_mm=75.0, regime="Orographic")
"""

import sys
from pathlib import Path

# Add current directory to path
_pkg_dir = Path(__file__).resolve().parent / "model"
if str(_pkg_dir) not in sys.path:
    sys.path.insert(0, str(_pkg_dir))

from model.config import (
    WeatherRegime,
    AlertLevel,
    RainfallCategory,
    DEFAULT_DEMO_DISTRICTS,
    THRESH_HEAVY_MIN,
    THRESH_VERY_HEAVY_MIN,
    THRESH_EXTREMELY_HEAVY_MIN,
)
from model.regime_classifier import RegimeClassifier, SynopticFeatureExtractor, TerrainFeatureExtractor
from model.bias_correction import RegimeConditionedBiasCorrector
from model.probability_engine import ProbabilityEngine
from model.blend import ConfidenceBlender
from model.district_aggregator import DistrictForecastAggregator
from model.pipeline import PragyaPipeline

__all__ = [
    "PragyaPipeline",
    "RegimeClassifier",
    "SynopticFeatureExtractor",
    "TerrainFeatureExtractor",
    "RegimeConditionedBiasCorrector",
    "ProbabilityEngine",
    "ConfidenceBlender",
    "DistrictForecastAggregator",
    "WeatherRegime",
    "AlertLevel",
    "RainfallCategory",
    "DEFAULT_DEMO_DISTRICTS",
    "THRESH_HEAVY_MIN",
    "THRESH_VERY_HEAVY_MIN",
    "THRESH_EXTREMELY_HEAVY_MIN",
]

if __name__ == "__main__":
    print("=" * 70)
    print("PRAGYA: Meteorological AI Post-Processing Pipeline")
    print("=" * 70)
    pipeline = PragyaPipeline()
    test_cycle = pipeline.run_cycle(lead_time="T+24")
    print(f"Synoptic Evaluation: {test_cycle['synoptic_regime']} (Confidence: {test_cycle['synoptic_confidence']})")
    print(f"Districts Processed: {len(test_cycle['districts'])}")
    for d in test_cycle["districts"][:4]:
        print(f"  - {d['district_name']:20s} [{d['regime']:10s}]: Raw {d['raw_rainfall_mm']:5.1f} mm -> AI {d['corrected_rainfall_mm']:5.1f} mm ({d['alert_level']})")
    print("=" * 70)
    print("Status: Model successfully executed.")
