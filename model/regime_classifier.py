"""
Weather Regime Classifier (Two-Tier Architecture).
Tier A: Synoptic-scale 4-class classifier (Active, Break, Low/Depression, Western Disturbance).
Tier B: Per-grid / district mesoscale terrain flags (Orographic, Coastal-Convective).
Includes probability calibration, entropy calculation, and soft-blend fallback.
"""

import math
from typing import Dict, List, Tuple, Any, Optional
import numpy as np

try:
    from .config import WeatherRegime
except ImportError:
    from config import WeatherRegime


class SynopticFeatureExtractor:
    """Extracts normalized atmospheric indices for Tier A synoptic evaluation."""

    def extract(
        self,
        vorticity_850: float = 2.5e-5,
        llj_speed_knots: float = 24.0,
        u_850_ms: float = 15.0,
        u_200_ms: float = -20.0,
        mslp_trough_hpa: float = 1002.0,
        olr_wm2: float = 200.0,
        day_of_monsoon: int = 90,
    ) -> Dict[str, float]:
        vort_scaled = (vorticity_850 / 1e-5)
        vert_shear = abs(u_200_ms - u_850_ms)
        mslp_deficit = max(0.0, 1008.0 - mslp_trough_hpa)
        doy_sin = math.sin(2.0 * math.pi * (day_of_monsoon / 122.0))

        return {
            "vort_850_scaled": round(vort_scaled, 3),
            "llj_speed_knots": round(llj_speed_knots, 1),
            "vertical_shear_ms": round(vert_shear, 1),
            "mslp_deficit_hpa": round(mslp_deficit, 1),
            "olr_wm2": round(olr_wm2, 1),
            "doy_sin": round(doy_sin, 3),
        }


class TerrainFeatureExtractor:
    """Extracts mesoscale orographic lift and coastal proximity flags for Tier B."""

    def extract(
        self,
        elevation_m: float,
        gradient: float,
        dist_to_coast_km: float,
        wind_u_ms: float = 12.0,
        wind_v_ms: float = 8.0,
    ) -> Dict[str, Any]:
        wind_speed = math.sqrt(wind_u_ms**2 + wind_v_ms**2)
        # Western Ghats orientation is roughly N-S; westerly (u > 0) creates orthogonal lift
        orographic_lift_index = max(0.0, wind_u_ms * gradient * (elevation_m / 1000.0))
        is_orographic = (elevation_m >= 400.0 and gradient >= 0.03 and wind_u_ms >= 5.0)
        is_coastal = (dist_to_coast_km <= 50.0)

        return {
            "orographic_lift_index": round(orographic_lift_index, 3),
            "is_orographic": is_orographic,
            "is_coastal": is_coastal,
            "elevation_m": elevation_m,
            "dist_to_coast_km": dist_to_coast_km,
        }


class RegimeClassifier:
    """
    Two-Tier Weather Regime Classifier with uncertainty estimation and soft-blend fallback.
    """

    def __init__(self):
        self.synoptic_extractor = SynopticFeatureExtractor()
        self.terrain_extractor = TerrainFeatureExtractor()
        self.regimes_tier_a = [
            WeatherRegime.ACTIVE,
            WeatherRegime.BREAK,
            WeatherRegime.DEPRESSION,
            WeatherRegime.WESTERN_DISTURBANCE,
        ]

    def predict_synoptic_regime(
        self,
        synoptic_features: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Classifies synoptic state (Tier A) based on atmospheric indices using calibrated logit models.
        """
        vort = synoptic_features.get("vort_850_scaled", 2.0)
        llj = synoptic_features.get("llj_speed_knots", 24.0)
        shear = synoptic_features.get("vertical_shear_ms", 30.0)
        mslp_def = synoptic_features.get("mslp_deficit_hpa", 0.0)
        olr = synoptic_features.get("olr_wm2", 210.0)
        doy_sin = synoptic_features.get("doy_sin", 0.0)

        # 1. Depression Logit
        logit_dep = (
            2.2 * (vort - 2.5)
            - 1.4 * mslp_def
            + 2.0 * max(0.0, (210.0 - olr) / 30.0)
            - 1.0
        )

        # 2. Break Logit
        logit_break = (
            -1.8 * (llj - 18.0)
            + 1.5 * (mslp_def - 2.0)
            + 2.2 * max(0.0, (olr - 230.0) / 30.0)
            - 1.5 * vort
            - 0.5
        )

        # 3. Western Disturbance Logit
        logit_wd = (
            -1.2 * (shear - 20.0)
            + 1.0 * doy_sin
            - 1.5 * (llj - 20.0)
            - 2.5
        )

        # 4. Active Logit
        logit_active = (
            1.5 * (llj - 22.0)
            + 1.0 * (vort - 1.5)
            + 0.8 * (shear - 25.0)
            - 0.5 * abs(mslp_def)
            + 0.5
        )

        logits = np.array([logit_active, logit_break, logit_dep, logit_wd], dtype=np.float64)
        temperature = 1.2
        exp_logits = np.exp((logits - np.max(logits)) / temperature)
        probs = exp_logits / np.sum(exp_logits)

        prob_dict = {
            self.regimes_tier_a[i].value: round(float(probs[i]), 3)
            for i in range(len(self.regimes_tier_a))
        }

        sorted_indices = np.argsort(probs)[::-1]
        top1_idx = sorted_indices[0]
        top2_idx = sorted_indices[1]

        primary_synoptic = self.regimes_tier_a[top1_idx]
        confidence = float(probs[top1_idx])

        # Shannon Entropy for classification ambiguity check
        entropy = -float(np.sum(probs * np.log2(probs + 1e-9)))
        max_entropy = np.log2(len(self.regimes_tier_a))
        normalized_uncertainty = float(entropy / max_entropy)

        should_blend = confidence < 0.55 or normalized_uncertainty > 0.75

        return {
            "primary_synoptic": primary_synoptic.value,
            "confidence": round(confidence, 3),
            "uncertainty_entropy": round(normalized_uncertainty, 3),
            "should_blend": should_blend,
            "candidate_probabilities": prob_dict,
            "top_candidates": [
                (self.regimes_tier_a[top1_idx].value, round(float(probs[top1_idx]), 3)),
                (self.regimes_tier_a[top2_idx].value, round(float(probs[top2_idx]), 3)),
            ],
        }

    def evaluate_district_regime(
        self,
        synoptic_result: Dict[str, Any],
        district_metadata: Dict[str, Any],
        wind_u_ms: float = 12.0,
        wind_v_ms: float = 8.0,
    ) -> Dict[str, Any]:
        """
        Combines Tier A (synoptic) with Tier B (mesoscale/terrain) to resolve effective local regime.
        """
        elev = district_metadata.get("mean_elevation_m", 100.0)
        grad = district_metadata.get("elevation_gradient", 0.01)
        coast_dist = district_metadata.get("dist_to_coast_km", 200.0)

        terrain_info = self.terrain_extractor.extract(
            elevation_m=elev,
            gradient=grad,
            dist_to_coast_km=coast_dist,
            wind_u_ms=wind_u_ms,
            wind_v_ms=wind_v_ms,
        )

        primary_syn = synoptic_result.get("primary_synoptic", WeatherRegime.ACTIVE.value)

        # Tier B Mesoscale override: High orographic lift supercedes Active/Break synoptic labels
        if terrain_info["is_orographic"] and wind_u_ms >= 8.0:
            effective_regime = WeatherRegime.OROGRAPHIC.value
        elif terrain_info["is_coastal"] and primary_syn in [WeatherRegime.ACTIVE.value, WeatherRegime.DEPRESSION.value]:
            effective_regime = WeatherRegime.COASTAL_CONVECTIVE.value
        else:
            effective_regime = primary_syn

        return {
            "effective_regime": effective_regime,
            "tier_a_synoptic": primary_syn,
            "is_orographic": terrain_info["is_orographic"],
            "is_coastal": terrain_info["is_coastal"],
            "orographic_lift_index": terrain_info["orographic_lift_index"],
        }
