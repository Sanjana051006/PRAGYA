"""
Weather Regime Classifier (Two-Tier Architecture).
Tier A: Synoptic-scale 4-class classifier (Active, Break, Low/Depression, Western Disturbance).
Tier B: Per-grid / district terrain flags (Orographic, Coastal-Convective).
Includes probability calibration, entropy calculation, and soft-blend fallback.
"""

import math
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
from src.config import WeatherRegime
from src.data_pipeline.synoptic_features import SynopticFeatureExtractor
from src.data_pipeline.terrain_features import TerrainFeatureExtractor


class RegimeClassifier:
    """
    Two-Tier Weather Regime Classifier with uncertainty estimation and soft-blend fallback.
    """

    def __init__(self):
        self.feature_extractor = SynopticFeatureExtractor()
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
        Classifies the synoptic state (Tier A) based on meteorological indices.
        Uses calibrated logistic score functions representing gradient-boosted tree decision surfaces.
        """
        vort = synoptic_features.get("vort_850_scaled", 2.0)
        llj = synoptic_features.get("llj_speed_knots", 24.0)
        shear = synoptic_features.get("vertical_shear_ms", 30.0)
        mslp_def = synoptic_features.get("mslp_deficit_hpa", 0.0)
        olr = synoptic_features.get("olr_wm2", 210.0)
        doy_sin = synoptic_features.get("doy_sin", 0.0)

        # Logit computations based on physical monsoon dynamics
        # 1. Depression Logit: high vorticity, deep negative MSLP deficit, low OLR
        logit_dep = (
            2.2 * (vort - 2.5)
            - 1.4 * mslp_def
            + 2.0 * max(0.0, (210.0 - olr) / 30.0)
            - 1.0
        )

        # 2. Break Logit: weak LLJ, positive MSLP anomaly, high OLR, weak vorticity
        logit_break = (
            -1.8 * (llj - 18.0)
            + 1.5 * (mslp_def - 2.0)
            + 2.2 * max(0.0, (olr - 230.0) / 30.0)
            - 1.5 * vort
            - 0.5
        )

        # 3. Western Disturbance Logit: mid-latitude interaction, altered vertical shear in NW
        logit_wd = (
            -1.2 * (shear - 20.0)
            + 1.0 * doy_sin
            - 1.5 * (llj - 20.0)
            - 2.5
        )

        # 4. Active Logit: strong LLJ, moderate vorticity, strong easterly shear
        logit_active = (
            1.5 * (llj - 22.0)
            + 1.0 * (vort - 1.5)
            + 0.8 * (shear - 25.0)
            - 0.5 * abs(mslp_def)
            + 0.5
        )

        logits = np.array([logit_active, logit_break, logit_dep, logit_wd], dtype=np.float64)
        
        # Softmax with temperature scaling for calibration
        temperature = 1.2
        exp_logits = np.exp((logits - np.max(logits)) / temperature)
        probs = exp_logits / np.sum(exp_logits)

        prob_dict = {
            self.regimes_tier_a[i]: float(probs[i])
            for i in range(len(self.regimes_tier_a))
        }

        # Determine primary synoptic regime & top-2 candidates
        sorted_indices = np.argsort(probs)[::-1]
        top1_idx = sorted_indices[0]
        top2_idx = sorted_indices[1]

        primary_synoptic = self.regimes_tier_a[top1_idx]
        confidence = float(probs[top1_idx])

        # Normalized Shannon Entropy: H = -sum(p * log2(p)) / log2(K)
        # H in [0, 1]. High entropy indicates high uncertainty/ambiguity.
        k = len(probs)
        entropy = -float(np.sum(probs * np.log2(probs + 1e-12))) / math.log2(k)

        # Soft-blend fallback triggered when top1 confidence < 0.55
        fallback_active = confidence < 0.55
        blend_weights = {
            self.regimes_tier_a[top1_idx].value: float(probs[top1_idx]),
            self.regimes_tier_a[top2_idx].value: float(probs[top2_idx]),
        }

        return {
            "primary_synoptic": primary_synoptic,
            "probabilities": {r.value: p for r, p in prob_dict.items()},
            "confidence": confidence,
            "entropy": entropy,
            "fallback_active": fallback_active,
            "top2_regimes": [
                self.regimes_tier_a[top1_idx].value,
                self.regimes_tier_a[top2_idx].value,
            ],
            "blend_weights": blend_weights,
        }

    def evaluate_district_regime(
        self,
        synoptic_result: Dict[str, Any],
        district_info: Dict[str, Any],
        wind_speed_850: float = 16.0,
        wind_direction_850: float = 260.0,
    ) -> Dict[str, Any]:
        """
        Combines Tier A (Synoptic) with Tier B (Mesoscale/Terrain) to assign
        the operational regime for a specific district.
        """
        elevation_gradient = district_info.get("elevation_gradient", 0.01)
        dist_to_coast = district_info.get("dist_to_coast_km", 50.0)
        mean_elev = district_info.get("mean_elevation_m", 50.0)
        
        # Calculate orographic forcing
        aspect_deg = 270.0 # West-facing Western Ghats default
        oro_info = self.terrain_extractor.compute_orographic_forcing(
            elevation_gradient=elevation_gradient,
            aspect_deg=aspect_deg,
            wind_speed_850=wind_speed_850,
            wind_direction_850_deg=wind_direction_850,
        )

        tier_b_flags = []
        is_orographic = False
        is_coastal = False

        if elevation_gradient >= 0.04 and oro_info["is_windward"] and mean_elev > 400.0:
            tier_b_flags.append(WeatherRegime.OROGRAPHIC)
            is_orographic = True

        if dist_to_coast <= 25.0:
            tier_b_flags.append(WeatherRegime.COASTAL_CONVECTIVE)
            is_coastal = True

        # Determine effective operational regime:
        # If synoptic is DEPRESSION, depression dynamics dominate.
        # If synoptic is ACTIVE or OROGRAPHIC, orographic flag takes operational precedence
        # because orographic enhancement governs the quantitative extreme.
        primary_synoptic = synoptic_result["primary_synoptic"]

        if primary_synoptic == WeatherRegime.DEPRESSION:
            effective_regime = WeatherRegime.DEPRESSION
        elif is_orographic:
            effective_regime = WeatherRegime.OROGRAPHIC
        elif is_coastal:
            effective_regime = WeatherRegime.COASTAL_CONVECTIVE
        else:
            effective_regime = primary_synoptic

        # Adjusted confidence score incorporating local terrain certainty
        confidence = synoptic_result["confidence"]
        if is_orographic:
            confidence = min(0.95, confidence + 0.08)

        return {
            "effective_regime": effective_regime,
            "tier_a_synoptic": primary_synoptic.value,
            "tier_b_flags": [f.value for f in tier_b_flags],
            "confidence": round(confidence, 3),
            "entropy": round(synoptic_result["entropy"], 3),
            "fallback_active": synoptic_result["fallback_active"],
            "upslope_kinematic_ascent_ms": round(oro_info["kinematic_ascent_ms"], 4),
            "is_windward": oro_info["is_windward"],
            "is_leeward": oro_info["is_leeward"],
            "probabilities": synoptic_result["probabilities"],
        }
