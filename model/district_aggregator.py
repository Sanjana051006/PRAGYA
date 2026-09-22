"""
District Aggregation & Spatial Processing Module.
Executes the full pipeline for a list of districts given synoptic atmospheric features.
"""

from typing import Dict, List, Any, Optional

try:
    from .config import DEFAULT_DEMO_DISTRICTS, WeatherRegime
    from .regime_classifier import RegimeClassifier, SynopticFeatureExtractor
    from .bias_correction import RegimeConditionedBiasCorrector
    from .probability_engine import ProbabilityEngine
    from .blend import ConfidenceBlender
except ImportError:
    from config import DEFAULT_DEMO_DISTRICTS, WeatherRegime
    from regime_classifier import RegimeClassifier, SynopticFeatureExtractor
    from bias_correction import RegimeConditionedBiasCorrector
    from probability_engine import ProbabilityEngine
    from blend import ConfidenceBlender


class DistrictForecastAggregator:
    """
    Orchestrates the complete regime-aware QPF post-processing pipeline for all districts.
    """

    def __init__(self):
        self.synoptic_extractor = SynopticFeatureExtractor()
        self.regime_classifier = RegimeClassifier()
        self.bias_corrector = RegimeConditionedBiasCorrector()
        self.probability_engine = ProbabilityEngine()

    def process_cycle(
        self,
        cycle_payload: Dict[str, Any],
        districts_list: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Executes end-to-end post-processing on a cycle payload.
        """
        if districts_list is None:
            districts_list = DEFAULT_DEMO_DISTRICTS

        synoptic_raw = cycle_payload.get("synoptic_state", {})
        district_raw_map = cycle_payload.get("district_raw_qpf", {})
        lead_time = cycle_payload.get("lead_time", "T+24")

        # 1. Evaluate Synoptic Regime (Tier A)
        syn_features = self.synoptic_extractor.extract(
            vorticity_850=synoptic_raw.get("vorticity_850", 2.5e-5),
            llj_speed_knots=synoptic_raw.get("llj_speed_knots", 24.0),
            u_850_ms=synoptic_raw.get("u_850_ms", 15.0),
            u_200_ms=synoptic_raw.get("u_200_ms", -20.0),
            mslp_trough_hpa=synoptic_raw.get("mslp_trough_hpa", 1002.0),
            olr_wm2=synoptic_raw.get("olr_wm2", 200.0),
            day_of_monsoon=synoptic_raw.get("day_of_monsoon", 90),
        )
        synoptic_eval = self.regime_classifier.predict_synoptic_regime(syn_features)

        results = []
        for dist in districts_list:
            dist_id = dist.get("id", dist.get("district_id", "unknown"))
            raw_mm = float(district_raw_map.get(dist_id, dist.get("raw_rainfall_mm", 45.0)))

            # 2. Mesoscale & Effective Regime (Tier B)
            reg_eval = self.regime_classifier.evaluate_district_regime(
                synoptic_result=synoptic_eval,
                district_metadata=dist,
                wind_u_ms=synoptic_raw.get("u_850_ms", 14.0),
            )
            eff_regime = reg_eval["effective_regime"]

            # 3. Regime-Conditioned Bias Correction
            bias_res = self.bias_corrector.correct_rainfall(
                raw_val=raw_mm,
                effective_regime=eff_regime,
                features={
                    "orographic_lift_index": reg_eval["orographic_lift_index"],
                    "mean_elevation_m": dist.get("mean_elevation_m", 500.0),
                    "dist_to_coast_km": dist.get("dist_to_coast_km", 100.0),
                    "wind_u_ms": synoptic_raw.get("u_850_ms", 14.0),
                },
            )

            # 4. Heavy Rainfall Probabilities & Alert Levels
            prob_res = self.probability_engine.compute_probabilities(
                corrected_p50=bias_res["corrected_mm"],
                quantile_p10=bias_res["q10_mm"],
                quantile_p90=bias_res["q90_mm"],
                regime_str=eff_regime,
            )

            results.append({
                "district_id": dist_id,
                "district_name": dist.get("name", dist.get("district_name", dist_id)),
                "state": dist.get("state", "Unknown"),
                "regime": eff_regime,
                "raw_rainfall_mm": raw_mm,
                "corrected_rainfall_mm": bias_res["corrected_mm"],
                "quantile_p10_mm": bias_res["q10_mm"],
                "quantile_p90_mm": bias_res["q90_mm"],
                "p_heavy": prob_res["p_heavy"],
                "p_very_heavy": prob_res["p_very_heavy"],
                "p_extremely_heavy": prob_res["p_extremely_heavy"],
                "alert_level": prob_res["alert_level"],
                "action_statement": prob_res["action_statement"],
                "confidence": synoptic_eval["confidence"],
            })

        return {
            "lead_time": lead_time,
            "synoptic_regime": synoptic_eval["primary_synoptic"],
            "synoptic_confidence": synoptic_eval["confidence"],
            "districts": results,
        }
