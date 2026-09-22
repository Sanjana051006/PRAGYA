# SIH26080 Synthetic Dataset v2

50,000-row structured synthetic benchmark for **Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts**.

## Main targets
- `observed_rainfall_mm`: primary regression target.
- `heavy_rainfall`: secondary binary classification target.
- `forecast_error_mm`: latent causal/audit variable; do not use as an ML input.

## V2 changes
- Forecast dates restricted to June–September, 2010–2025.
- Explicit monsoon month and forecast year.
- Region-conditioned latitude/longitude ranges.
- Elevation and coastal-distance features.
- Regime-aware forecast-error process.
- Nonlinear and interaction terms in the rainfall-error process.
- Controlled MCAR/MAR missingness, feature noise, and label noise in the injected version.
- Difficulty proxy calibrated to AUROC 0.764, inside the requested 0.72–0.82 band.

## Files
- `data.csv`: clean dataset.
- `data.injected.csv`: data-quality-challenged dataset.
- `data.json`: clean JSON.
- `data.injected.json`: injected JSON.
- `spec.v2.yaml`: DataDoom-compatible schema/metadata.
- `metadata.json`: generated audit statistics.
- `audit_report.md`: short audit report.

Parquet is not included because the current runtime does not have `pyarrow` or `fastparquet` installed and has no network access to install them.
