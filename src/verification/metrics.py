"""
Operational Meteorological Verification Metrics.
Implements WMO and IMD standard verification scores:
- Continuous: RMSE, Mean Bias, MAE
- Categorical: POD, FAR, CSI, ETS, Frequency Bias
- Spatial / Scale-selective: Fractions Skill Score (FSS)
"""

import math
from typing import Dict, List, Any, Tuple
import numpy as np


class VerificationMetrics:
    """
    Computes mathematical verification metrics for quantitative precipitation forecasts (QPF).
    """

    @staticmethod
    def compute_continuous(predictions: np.ndarray, observations: np.ndarray) -> Dict[str, float]:
        """Calculates RMSE, MAE, and Mean Bias."""
        if len(predictions) == 0 or len(observations) == 0:
            return {"rmse": 0.0, "mae": 0.0, "bias": 0.0}
        
        diff = predictions - observations
        rmse = float(np.sqrt(np.mean(diff ** 2)))
        mae = float(np.mean(np.abs(diff)))
        bias = float(np.mean(diff))
        
        return {
            "rmse": round(rmse, 2),
            "mae": round(mae, 2),
            "mean_bias": round(bias, 2),
        }

    @staticmethod
    def compute_contingency_table(
        predictions: np.ndarray,
        observations: np.ndarray,
        threshold_mm: float,
    ) -> Dict[str, int]:
        """
        Builds 2x2 contingency table for threshold exceedance:
        Hits (H), Misses (M), False Alarms (F), Correct Negatives (C).
        """
        pred_yes = predictions >= threshold_mm
        obs_yes = observations >= threshold_mm

        h = int(np.sum(pred_yes & obs_yes))
        m = int(np.sum((~pred_yes) & obs_yes))
        f = int(np.sum(pred_yes & (~obs_yes)))
        c = int(np.sum((~pred_yes) & (~obs_yes)))

        return {"H": h, "M": m, "F": f, "C": c, "N": h + m + f + c}

    @staticmethod
    def compute_categorical_scores(
        predictions: np.ndarray,
        observations: np.ndarray,
        threshold_mm: float,
    ) -> Dict[str, float]:
        """
        Calculates POD, FAR, CSI, ETS, and Frequency Bias at a given threshold.
        """
        ct = VerificationMetrics.compute_contingency_table(predictions, observations, threshold_mm)
        h, m, f, c, n = ct["H"], ct["M"], ct["F"], ct["C"], ct["N"]

        # Probability of Detection (POD) / Hit Rate
        pod = (h / (h + m)) if (h + m) > 0 else 0.0

        # False Alarm Ratio (FAR)
        far = (f / (h + f)) if (h + f) > 0 else 0.0

        # Critical Success Index (CSI) / Threat Score
        csi = (h / (h + m + f)) if (h + m + f) > 0 else 0.0

        # Frequency Bias
        freq_bias = ((h + f) / (h + m)) if (h + m) > 0 else 1.0

        # Equitable Threat Score (ETS)
        h_chance = ((h + m) * (h + f)) / n if n > 0 else 0.0
        denom = (h + m + f - h_chance)
        ets = ((h - h_chance) / denom) if denom != 0 else 0.0

        return {
            "POD": round(pod, 3),
            "FAR": round(far, 3),
            "CSI": round(csi, 3),
            "ETS": round(ets, 3),
            "BIAS": round(freq_bias, 3),
            "contingency": ct,
        }

    @staticmethod
    def compute_fractions_skill_score(
        pred_field: np.ndarray,
        obs_field: np.ndarray,
        threshold_mm: float,
        window_size: int = 3,
    ) -> float:
        """
        Calculates Fractions Skill Score (FSS) over 2D spatial precipitation fields.
        Tolerates small spatial displacement errors by comparing neighborhood fractions.
        """
        if pred_field.ndim != 2 or obs_field.ndim != 2:
            # Fallback for 1D arrays: simulate spatial neighborhood via moving window
            pred_binary = (pred_field >= threshold_mm).astype(float)
            obs_binary = (obs_field >= threshold_mm).astype(float)
            
            kernel = np.ones(min(window_size, len(pred_binary))) / min(window_size, len(pred_binary))
            p_frac = np.convolve(pred_binary, kernel, mode="same")
            o_frac = np.convolve(obs_binary, kernel, mode="same")
            
            mse = np.mean((p_frac - o_frac) ** 2)
            mse_ref = np.mean(p_frac ** 2 + o_frac ** 2)
            
            if mse_ref < 1e-6:
                return 1.0 if mse < 1e-6 else 0.0
            return float(round(max(0.0, 1.0 - (mse / mse_ref)), 3))

        # 2D Field computation
        pred_bin = (pred_field >= threshold_mm).astype(float)
        obs_bin = (obs_field >= threshold_mm).astype(float)
        
        from scipy.ndimage import uniform_filter
        p_frac = uniform_filter(pred_bin, size=window_size, mode="constant")
        o_frac = uniform_filter(obs_bin, size=window_size, mode="constant")

        mse = np.mean((p_frac - o_frac) ** 2)
        mse_ref = np.mean(p_frac ** 2 + o_frac ** 2)

        if mse_ref < 1e-6:
            return 1.0 if mse < 1e-6 else 0.0
        return float(round(max(0.0, 1.0 - (mse / mse_ref)), 3))


# -----------------------------------------------------------------------------
# Pure Top-Level Metric Functions (Category 07 Requirement)
# -----------------------------------------------------------------------------

def rmse(predictions: np.ndarray, observations: np.ndarray) -> float:
    """Computes Root Mean Square Error (RMSE)."""
    p = np.asarray(predictions, dtype=float)
    o = np.asarray(observations, dtype=float)
    if len(p) == 0 or len(o) == 0:
        return 0.0
    return float(round(np.sqrt(np.mean((p - o) ** 2)), 3))


def contingency_table_counts(
    predictions: np.ndarray,
    observations: np.ndarray,
    threshold: float = 64.5,
) -> Tuple[int, int, int, int]:
    """Returns (hits, misses, false_alarms, correct_negatives)."""
    p = np.asarray(predictions, dtype=float) >= threshold
    o = np.asarray(observations, dtype=float) >= threshold
    h = int(np.sum(p & o))
    m = int(np.sum((~p) & o))
    f = int(np.sum(p & (~o)))
    c = int(np.sum((~p) & (~o)))
    return h, m, f, c


def pod(predictions: np.ndarray, observations: np.ndarray, threshold: float = 64.5) -> float:
    """Probability of Detection (Hit Rate): H / (H + M)."""
    h, m, f, c = contingency_table_counts(predictions, observations, threshold)
    return float(round(h / (h + m), 3)) if (h + m) > 0 else 0.0


def far(predictions: np.ndarray, observations: np.ndarray, threshold: float = 64.5) -> float:
    """False Alarm Ratio: F / (H + F)."""
    h, m, f, c = contingency_table_counts(predictions, observations, threshold)
    return float(round(f / (h + f), 3)) if (h + f) > 0 else 0.0


def csi(predictions: np.ndarray, observations: np.ndarray, threshold: float = 64.5) -> float:
    """Critical Success Index (Threat Score): H / (H + M + F)."""
    h, m, f, c = contingency_table_counts(predictions, observations, threshold)
    denom = h + m + f
    return float(round(h / denom, 3)) if denom > 0 else 0.0


def ets(predictions: np.ndarray, observations: np.ndarray, threshold: float = 64.5) -> float:
    """
    Equitable Threat Score (Gilbert Skill Score):
    H_chance = ((H + M) * (H + F)) / N
    ETS = (H - H_chance) / (H + M + F - H_chance)
    """
    h, m, f, c = contingency_table_counts(predictions, observations, threshold)
    n = h + m + f + c
    if n == 0:
        return 0.0
    h_chance = ((h + m) * (h + f)) / n
    denom = h + m + f - h_chance
    if denom == 0:
        return 0.0
    return float(round((h - h_chance) / denom, 3))


def fss(
    pred_field: np.ndarray,
    obs_field: np.ndarray,
    threshold: float = 64.5,
    window_size: int = 3,
) -> float:
    """Fractions Skill Score (FSS)."""
    return VerificationMetrics.compute_fractions_skill_score(
        np.asarray(pred_field, dtype=float),
        np.asarray(obs_field, dtype=float),
        threshold_mm=threshold,
        window_size=window_size,
    )
