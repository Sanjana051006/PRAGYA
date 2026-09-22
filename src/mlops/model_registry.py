"""
Model Registry and MLOps Catalog.
Implements naming convention: {component}_{regime}_v{n}
Enforces promotion rules: Candidate version must beat active version on held-out RMSE/ETS before being marked ACTIVE.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from src.config import BASE_DIR, MODELS_DIR


class ModelRegistry:
    """
    Tracks model artifacts, metrics, schemas, and promotion decisions.
    """

    CATALOG_FILE = MODELS_DIR / "model_catalog.json"

    INITIAL_CATALOG = {
        "models": {
            "classifier_tier_a_v1": {
                "name": "classifier_tier_a_v1",
                "component": "regime_classifier",
                "regime": "all",
                "version": 1,
                "status": "ACTIVE",
                "registered_at": "2026-09-21T00:00:00Z",
                "metrics": {"f1_macro": 0.84, "accuracy": 0.86, "log_loss": 0.42},
                "features": ["monsoon_shear_index", "vorticity_850", "llj_speed", "vertical_shear", "olr"],
            },
            "correction_qm_active_break_v1": {
                "name": "correction_qm_active_break_v1",
                "component": "correction",
                "regime": "active_break",
                "version": 1,
                "status": "ACTIVE",
                "registered_at": "2026-09-21T00:00:00Z",
                "metrics": {"held_out_rmse": 17.2, "raw_baseline_rmse": 28.6, "ets_64_5": 0.63},
                "method": "empirical_quantile_mapping",
            },
            "correction_gbm_depression_v1": {
                "name": "correction_gbm_depression_v1",
                "component": "correction",
                "regime": "depression",
                "version": 1,
                "status": "ACTIVE",
                "registered_at": "2026-09-21T00:00:00Z",
                "metrics": {"held_out_rmse": 31.8, "raw_baseline_rmse": 56.5, "ets_64_5": 0.64},
                "method": "lightgbm_regressor",
            },
            "correction_residual_orographic_v1": {
                "name": "correction_residual_orographic_v1",
                "component": "correction",
                "regime": "orographic",
                "version": 1,
                "status": "ACTIVE",
                "registered_at": "2026-09-21T00:00:00Z",
                "metrics": {"held_out_rmse": 26.4, "raw_baseline_rmse": 48.2, "ets_64_5": 0.62},
                "method": "kinematic_upslope_residual",
            },
            "correction_blend_coastal_wd_v1": {
                "name": "correction_blend_coastal_wd_v1",
                "component": "correction",
                "regime": "coastal_wd",
                "version": 1,
                "status": "ACTIVE",
                "registered_at": "2026-09-21T00:00:00Z",
                "metrics": {"held_out_rmse": 21.0, "raw_baseline_rmse": 36.1, "ets_64_5": 0.59},
                "method": "confidence_weighted_ensemble",
            },
            "probability_calibrator_v1": {
                "name": "probability_calibrator_v1",
                "component": "probability",
                "regime": "all",
                "version": 1,
                "status": "ACTIVE",
                "registered_at": "2026-09-21T00:00:00Z",
                "metrics": {"brier_score": 0.082, "reliability_slope": 0.98},
                "method": "isotonic_quantile_regression",
            }
        },
        "promotion_history": []
    }

    @classmethod
    def _load_catalog(cls) -> Dict[str, Any]:
        if cls.CATALOG_FILE.exists():
            try:
                with open(cls.CATALOG_FILE, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return cls.INITIAL_CATALOG.copy()

    @classmethod
    def _save_catalog(cls, catalog: Dict[str, Any]):
        cls.CATALOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(cls.CATALOG_FILE, "w") as f:
            json.dump(catalog, f, indent=2)

    @classmethod
    def get_active_models(cls) -> Dict[str, Any]:
        catalog = cls._load_catalog()
        return {k: v for k, v in catalog["models"].items() if v.get("status") == "ACTIVE"}

    @classmethod
    def register_and_evaluate_candidate(
        cls,
        component: str,
        regime: str,
        version: int,
        metrics: Dict[str, float],
        features: Optional[List[str]] = None,
        method: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Registers candidate model and tests promotion rule:
        Must beat active model on held-out RMSE (lower is better) and ETS (higher is better).
        """
        catalog = cls._load_catalog()
        model_name = f"{component}_{regime}_v{version}"

        # Find current active version for this component + regime
        current_active = None
        for m in catalog["models"].values():
            if m.get("component") == component and m.get("regime") == regime and m.get("status") == "ACTIVE":
                current_active = m
                break

        promoted = False
        decision_log = ""

        if current_active is None:
            promoted = True
            decision_log = "Initial baseline version automatically promoted to ACTIVE."
        else:
            curr_rmse = current_active.get("metrics", {}).get("held_out_rmse", 999.0)
            cand_rmse = metrics.get("held_out_rmse", 999.0)
            curr_ets = current_active.get("metrics", {}).get("ets_64_5", 0.0)
            cand_ets = metrics.get("ets_64_5", 0.0)

            # Promotion rule check
            if cand_rmse < curr_rmse and cand_ets >= curr_ets:
                promoted = True
                decision_log = (
                    f"Candidate {model_name} (RMSE={cand_rmse}, ETS={cand_ets}) "
                    f"beat Active {current_active['name']} (RMSE={curr_rmse}, ETS={curr_ets}). Promoted to ACTIVE."
                )
            else:
                promoted = False
                decision_log = (
                    f"Candidate {model_name} (RMSE={cand_rmse}, ETS={cand_ets}) did not beat "
                    f"Active {current_active['name']} (RMSE={curr_rmse}, ETS={curr_ets}). Retained in STAGING."
                )

        new_entry = {
            "name": model_name,
            "component": component,
            "regime": regime,
            "version": version,
            "status": "ACTIVE" if promoted else "STAGING",
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "metrics": metrics,
            "decision_log": decision_log,
        }
        if features:
            new_entry["features"] = features
        if method:
            new_entry["method"] = method

        if promoted and current_active:
            catalog["models"][current_active["name"]]["status"] = "ARCHIVED"

        catalog["models"][model_name] = new_entry
        catalog["promotion_history"].append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_name": model_name,
            "promoted": promoted,
            "decision": decision_log,
        })

        cls._save_catalog(catalog)
        return new_entry
