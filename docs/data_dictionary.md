# Data Dictionary: Regime-Aware AI Rainfall Post-Processing System

| Column / Feature | Data Type | Physical Unit | Valid Range | Source Layer | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sample_id` | Integer | - | $[1, 50000]$ | Ingestion | Unique record identifier |
| `forecast_year` | Integer | Year | $[2010, 2025]$ | Ingestion | Historical monsoon forecast year |
| `monsoon_month` | String (Enum) | Month | `June, July, August, September` | Ingestion | JJAS core monsoon months |
| `region` | String (Enum) | Region | `west_coast, east_coast, central_india, north_india, northeast_india, himalayan, peninsular_india` | Ingestion | Geographic regional classification |
| `latitude` | Float | Degrees North | $[8.0, 35.0]$ | Spatial | Latitude coordinate across Indian subcontinent |
| `longitude` | Float | Degrees East | $[68.0, 97.5]$ | Spatial | Longitude coordinate across Indian subcontinent |
| `elevation_m` | Float | Meters ($m$) | $[20.0, 5000.0]$ | Static / DEM | Mean terrain elevation (SRTM 90m DEM) |
| `lead_time_hours`| Integer | Hours ($h$) | $[24, 120]$ | NWP Forecast | Forecast lead time ($T+24$ to $T+120$) |
| `regime` | String (Enum) | Regime | `active_monsoon, break_monsoon, monsoon_low_depression, coastal_orographic, western_disturbance` | Two-Tier Classifier | Synoptic-to-mesoscale meteorological regime |
| `nwp_rainfall_mm`| Float | $mm/24h$ | $[0.0, 300.0]$ | Raw NWP | Raw Numerical Weather Prediction quantitative precipitation forecast |
| `nwp_temperature_c` | Float | $^{\circ}C$ | $[10.0, 40.0]$ | Raw NWP | 2m Surface air temperature forecast |
| `relative_humidity` | Float | $\%$ | $[25.0, 100.0]$ | Raw NWP | Surface relative humidity |
| `specific_humidity` | Float | $g/kg$ | $[3.0, 30.0]$ | Raw NWP | 850 hPa specific humidity |
| `wind_speed_ms` | Float | $m/s$ | $[0.0, 35.0]$ | Raw NWP | 850 hPa wind speed (monsoon low-level jet strength) |
| `surface_pressure_hpa` | Float | $hPa$ | $[975.0, 1038.0]$ | Raw NWP | Mean sea-level pressure |
| `vertical_velocity_pa_s` | Float | $Pa/s$ | $[-0.6, 0.6]$ | Raw NWP | 500 hPa vertical velocity ($\omega$) |
| `sea_surface_temperature_c` | Float | $^{\circ}C$ | $[22.0, 33.5]$ | Ocean / SST | Arabian Sea & Bay of Bengal sea surface temperature |
| `sst_anomaly_c` | Float | $^{\circ}C$ | $[-3.0, 3.0]$ | Ocean / SST | Sea surface temperature anomaly from climatology |
| `mjo_phase` | Integer / Enum| Phase Index | $[1, 8]$ | Synoptic | Madden-Julian Oscillation convective phase |
| `corrected_rainfall_mm` | Float | $mm/24h$ | $[0.0, 600.0]$ | AI Post-Process | Regime-conditioned bias-corrected precipitation forecast |
| `q10_rainfall_mm`| Float | $mm/24h$ | $[0.0, 500.0]$ | AI Uncertainty | 10th percentile (lower 80% credible band) |
| `q90_rainfall_mm`| Float | $mm/24h$ | $[0.0, 800.0]$ | AI Uncertainty | 90th percentile (upper 80% credible band) |
| `p_heavy` | Float | Probability | $[0.0, 1.0]$ | Probability Engine | Calibrated probability of exceeding $64.5\text{ mm/24h}$ |
| `p_very_heavy` | Float | Probability | $[0.0, 1.0]$ | Probability Engine | Calibrated probability of exceeding $115.5\text{ mm/24h}$ |
| `p_extreme` | Float | Probability | $[0.0, 1.0]$ | Probability Engine | Calibrated probability of exceeding $204.4\text{ mm/24h}$ |
| `alert_level` | String (Enum) | Warning | `Green, Yellow, Orange, Red` | Decision Support | Official IMD color-coded warning alert level |
