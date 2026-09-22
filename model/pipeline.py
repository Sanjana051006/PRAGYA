"""
Unified PRAGYA AI/ML Pipeline.
Provides an easy-to-use high-level interface to the full quantitative precipitation
post-processing system.
"""

from typing import Dict, List, Any, Optional
import json

try:
    from .config import WeatherRegime, AlertLevel, DEFAULT_DEMO_DISTRICTS
    from .regime_classifier import RegimeClassifier, SynopticFeatureExtractor
    from .bias_correction import RegimeConditionedBiasCorrector
    from .probability_engine import ProbabilityEngine
    from .district_aggregator import DistrictForecastAggregator
    from .blend import ConfidenceBlender
except ImportError:
    from config import WeatherRegime, AlertLevel, DEFAULT_DEMO_DISTRICTS
    from regime_classifier import RegimeClassifier, SynopticFeatureExtractor
    from bias_correction import RegimeConditionedBiasCorrector
    from probability_engine import ProbabilityEngine
    from district_aggregator import DistrictForecastAggregator
    from blend import ConfidenceBlender


class PragyaPipeline:
    """
    Unified operational post-processing pipeline.
    """

    def __init__(self):
        self.aggregator = DistrictForecastAggregator()
        self.classifier = self.aggregator.regime_classifier
        self.corrector = self.aggregator.bias_corrector
        self.prob_engine = self.aggregator.probability_engine
        self.blender = ConfidenceBlender()

    def predict_single_district(
        self,
        raw_rainfall_mm: float,
        regime: str = "Active",
        district_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Runs bias correction & probability generation for an individual district.
        """
        features = district_metadata or {}
        corr = self.corrector.correct_rainfall(raw_rainfall_mm, regime, features)
        probs = self.prob_engine.compute_probabilities(
            corrected_p50=corr["corrected_mm"],
            quantile_p10=corr["q10_mm"],
            quantile_p90=corr["q90_mm"],
            regime_str=regime,
        )
        return {
            "raw_mm": raw_rainfall_mm,
            "corrected_mm": corr["corrected_mm"],
            "quantile_p10_mm": corr["q10_mm"],
            "quantile_p90_mm": corr["q90_mm"],
            "regime": regime,
            **probs,
        }

    def run_cycle(
        self,
        synoptic_state: Optional[Dict[str, Any]] = None,
        district_raw_qpf: Optional[Dict[str, float]] = None,
        districts_list: Optional[List[Dict[str, Any]]] = None,
        lead_time: str = "T+24",
    ) -> Dict[str, Any]:
        """
        Runs complete post-processing cycle.
        """
        payload = {
            "synoptic_state": synoptic_state or {},
            "district_raw_qpf": district_raw_qpf or {},
            "lead_time": lead_time,
        }
        return self.aggregator.process_cycle(payload, districts_list)
