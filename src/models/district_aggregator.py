"""
District Aggregation and Forecast Orchestration Module.
Combines Regime Classification, Bias Correction, Probability Calibration,
and Area-Weighted District Aggregation into a unified operational pipeline.
"""

from typing import Dict, List, Any, Optional
from src.config import (
    DEFAULT_DEMO_DISTRICTS,
    WeatherRegime,
    AlertLevel,
)
from src.models.regime_classifier import RegimeClassifier
from src.models.bias_correction import RegimeConditionedBiasCorrector
from src.models.probability_engine import ProbabilityEngine
from src.data_pipeline.synoptic_features import SynopticFeatureExtractor


class DistrictForecastAggregator:
    """
    Executes the full end-to-end post-processing pipeline for all districts in a cycle.
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
        Processes a forecast cycle:
        1. Evaluates synoptic regime (Tier A)
        2. For each district, evaluates mesoscale flags (Tier B) and effective regime
        3. Applies regime-conditioned bias correction
        4. Calculates calibrated heavy-rainfall probabilities and IMD alert levels
        5. Formulates the complete district outlook table and summary stats
        """
        if districts_list is None:
            districts_list = DEFAULT_DEMO_DISTRICTS

        synoptic_raw = cycle_payload.get("synoptic_state", {})
        district_raw_map = cycle_payload.get("district_data", {})
        lead_time = cycle_payload.get("lead_time", "T+24")
        cycle_time = cycle_payload.get("cycle_time", "2026-09-21T00:00:00Z")

        # 1. Extract synoptic features
        synoptic_features = self.synoptic_extractor.extract_from_raw_values(
            vorticity_850=synoptic_raw.get("vorticity_850", 2.5e-5),
            llj_speed_knots=synoptic_raw.get("llj_speed_knots", 24.0),
            u_850_ms=synoptic_raw.get("u_850_ms", 15.0),
            u_200_ms=synoptic_raw.get("u_200_ms", -20.0),
            mslp_trough_hpa=synoptic_raw.get("mslp_trough_hpa", 1002.0),
            olr_wm2=synoptic_raw.get("olr_wm2", 200.0),
            day_of_monsoon=synoptic_raw.get("day_of_monsoon", 90),
        )

        # 2. Predict Tier A synoptic regime
        synoptic_eval = self.regime_classifier.predict_synoptic_regime(synoptic_features)

        # 3. Process each district
        district_records = []
        alert_counts = {AlertLevel.GREEN.value: 0, AlertLevel.YELLOW.value: 0, AlertLevel.ORANGE.value: 0, AlertLevel.RED.value: 0}

        wind_speed_850 = synoptic_raw.get("llj_speed_knots", 24.0) * 0.514444
        wind_dir_850 = synoptic_raw.get("wind_direction_850", 260.0)

        for dist in districts_list:
            dist_id = dist["id"]
            raw_info = district_raw_map.get(dist_id, {"raw": 45.0, "obs": 50.0})
            raw_rainfall = raw_info.get("raw", 45.0)
            observed_rainfall = raw_info.get("obs", None)

            # Evaluate district regime
            dist_regime_eval = self.regime_classifier.evaluate_district_regime(
                synoptic_result=synoptic_eval,
                district_info=dist,
                wind_speed_850=wind_speed_850,
                wind_direction_850=wind_dir_850,
            )

            # Regime-conditioned bias correction
            corrected_output = self.bias_corrector.predict(
                raw_rainfall_mm=raw_rainfall,
                regime_eval=dist_regime_eval,
                district_info=dist,
                synoptic_features=synoptic_features,
            )

            # Calibrated probability computation
            prob_output = self.probability_engine.compute_probabilities(
                corrected_p50=corrected_output["corrected_rainfall_mm"],
                quantile_p10=corrected_output["quantile_p10_mm"],
                quantile_p90=corrected_output["quantile_p90_mm"],
                regime_str=dist_regime_eval["effective_regime"].value if hasattr(dist_regime_eval["effective_regime"], "value") else str(dist_regime_eval["effective_regime"]),
            )

            alert_counts[prob_output["alert_level"]] += 1

            record = {
                "district_id": dist["id"],
                "district_name": dist["name"],
                "state": dist["state"],
                "lgd_district_code": dist["lgd_district_code"],
                "lgd_state_code": dist["lgd_state_code"],
                "terrain_type": dist["terrain_type"],
                "regime": dist_regime_eval["effective_regime"].value if hasattr(dist_regime_eval["effective_regime"], "value") else str(dist_regime_eval["effective_regime"]),
                "tier_a_synoptic": dist_regime_eval["tier_a_synoptic"],
                "tier_b_flags": dist_regime_eval["tier_b_flags"],
                "confidence": dist_regime_eval["confidence"],
                "entropy": dist_regime_eval["entropy"],
                "raw_rainfall_mm": corrected_output["raw_rainfall_mm"],
                "corrected_rainfall_mm": corrected_output["corrected_rainfall_mm"],
                "quantile_p10_mm": corrected_output["quantile_p10_mm"],
                "quantile_p90_mm": corrected_output["quantile_p90_mm"],
                "p_heavy": prob_output["p_heavy"],
                "p_very_heavy": prob_output["p_very_heavy"],
                "p_extremely_heavy": prob_output["p_extremely_heavy"],
                "alert_level": prob_output["alert_level"],
                "action_statement": prob_output["action_statement"],
                "observed_rainfall_mm": observed_rainfall,
                "lat": dist["lat"],
                "lon": dist["lon"],
            }
            district_records.append(record)

        # Formulate active banner
        orange_or_red = [d for d in district_records if d["alert_level"] in [AlertLevel.ORANGE.value, AlertLevel.RED.value]]
        if orange_or_red:
            highest_level = AlertLevel.RED.value if any(d["alert_level"] == AlertLevel.RED.value for d in orange_or_red) else AlertLevel.ORANGE.value
            banner_text = f"{highest_level} — {len(orange_or_red)} districts >50% probability of very heavy rainfall in next 24h."
        else:
            banner_text = "Green — No severe heavy rainfall alerts in the current forecast cycle."

        return {
            "cycle_time": cycle_time,
            "lead_time": lead_time,
            "synoptic_evaluation": {
                "primary_synoptic": synoptic_eval["primary_synoptic"].value,
                "confidence": synoptic_eval["confidence"],
                "entropy": synoptic_eval["entropy"],
                "fallback_active": synoptic_eval["fallback_active"],
                "probabilities": synoptic_eval["probabilities"],
            },
            "banner": {
                "level": highest_level if orange_or_red else "Green",
                "text": banner_text,
            },
            "alert_counts": alert_counts,
            "districts": district_records,
            "grid_raster": cycle_payload.get("grid_raster", []),
        }
