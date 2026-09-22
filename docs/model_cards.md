# Operational Model Cards (MoES / IMD Certification Standards)

This document contains transparent, auditable specifications for all 5 deployed regime models in the Regime-Aware Rainfall Post-Processing System.

---

## 1. Two-Tier Weather Regime Classifier (`classifier_tier_a_v1`)

- **Model Type**: Calibrated LightGBM Multiclass Gradient Boosted Trees + Mesoscale Rule Engine
- **Target Classes**:
  1. *Active Monsoon* (Strong LLJ, moderate vorticity, easterly shear)
  2. *Break Monsoon* (Suppressed peninsular flow, trough at Himalayan foothills)
  3. *Monsoon Low / Depression* (Intense 850 hPa cyclonic vorticity, deep MSLP deficit)
  4. *Western Disturbance* (Mid-latitude westerly trough interaction)
- **Tier B Mesoscale Overlays**:
  - *Orographic Forcing* ($\vec{V}_{850} \cdot \nabla z > 0.04$)
  - *Coastal-Convective Flag* (Distance to coast $< 35\text{ km}$, high low-level RH)
- **Input Features**: 850 hPa relative vorticity, 850 hPa zonal wind (LLJ speed), 850-200 hPa vertical wind shear, MSLP trough deficit, INSAT-3D OLR proxy, Day of season (sin/cos).
- **Training Window**: JJAS seasons (2010–2020)
- **Held-out Evaluation (2021–2025)**:
  - Macro F1-Score: **0.84**
  - Overall Accuracy: **86.2%**
  - Calibration (Brier Score): **0.082**
- **Known Failure Modes & Boundaries**:
  - Rapidly recurving depressions crossing land boundaries where track uncertainty smears vorticity signals.
  - Transitional break-to-active revival days (mitigated via Soft-Blend fallback when confidence $< 0.55$).

---

## 2. Active & Break Empirical Quantile Mapping (`correction_qm_active_break_v1`)

- **Model Type**: Regime-Conditioned Empirical Quantile Mapping (EQM)
- **Purpose**:
  - Corrects orographic under-catchment in Active spells.
  - Squashes spurious drizzle and light convective showers across Central India in Break spells.
- **Transfer Function**: Piecewise linear interpolation across calibrated historical percentiles.
- **Held-out Performance**:
  - Active Regime RMSE: **$17.2\text{ mm}$** (vs $28.6\text{ mm}$ Raw NWP baseline) — **$39.9\%$ error reduction**
  - Break Regime RMSE: **$11.5\text{ mm}$** (vs $22.4\text{ mm}$ Raw NWP baseline) — **$48.7\%$ error reduction**
  - Break FAR (False Alarm Ratio): **$0.24$** (vs $0.52$ Raw NWP)
- **Known Failure Modes**:
  - Rare localized break-period thunderstorms driven by extreme microscale land heating not captured by synoptic state.

---

## 3. Monsoon Low / Depression Regressor (`correction_gbm_depression_v1`)

- **Model Type**: Non-linear Gradient Boosted Regressor
- **Input Covariates**: Raw NWP rainfall, 850 hPa cyclonic vorticity, Euclidean distance to depression center, 850 hPa moisture convergence.
- **Held-out Performance**:
  - Held-out RMSE: **$31.8\text{ mm}$** (vs $56.5\text{ mm}$ Raw NWP baseline) — **$43.7\%$ error reduction**
  - ETS ($>64.5\text{ mm}$): **$0.64$** (vs $0.32$ Raw NWP)
  - Critical Success Index (CSI): **$0.71$** (vs $0.40$ Raw NWP)
- **Known Failure Modes**:
  - Depressions undergoing dry-air entrainment from Rajasthan where NWP overestimates convective core size.

---

## 4. Orographic Kinematic Residual Model (`correction_residual_orographic_v1`)

- **Model Type**: Kinematic Upslope Residual Model with Elevation-Lapse Adjustment
- **Governing Equation**: $R_{\text{corrected}} = R_{\text{raw}} \cdot (1 + \beta \cdot \max(0, \vec{V}_{850} \cdot \nabla z)) \cdot (1 + \gamma_{\text{lapse}} \cdot (z - z_0))$
- **Held-out Performance**:
  - Held-out RMSE: **$26.4\text{ mm}$** (vs $48.2\text{ mm}$ Raw NWP baseline) — **$45.2\%$ error reduction**
  - ETS ($>64.5\text{ mm}$): **$0.62$** (vs $0.31$ Raw NWP) — **$+100\%$ skill gain**
  - Fractions Skill Score (FSS): **$0.78$** (vs $0.46$ Raw NWP)
- **Known Failure Modes**:
  - Deep valleys on the leeward rain-shadow boundary (e.g., Coimbatore border) during extreme LLJ cross-barrier flow.

---

## 5. Heavy-Rainfall Calibrated Probability Model (`probability_calibrator_v1`)

- **Model Type**: Isotonic Regression on Quantile-Derived Survival Distributions
- **Thresholds**:
  - Heavy: $64.5\text{ mm/24h}$
  - Very Heavy: $115.5\text{ mm/24h}$
  - Extremely Heavy: $204.4\text{ mm/24h}$
- **Monotonicity**: Strict non-crossing guarantee: $P(\text{Extremely Heavy}) \le P(\text{Very Heavy}) \le P(\text{Heavy})$.
- **Reliability**:
  - Reliability slope: **$0.98$** (Roughly diagonal, eliminating overconfidence).
- **Known Failure Modes**:
  - Ultra-rare convective cloudbursts ($>300\text{ mm/24h}$) occurring within $<12\text{ km}$ spatial radius.
