# Oracle Cloud Infrastructure (OCI) Deployment & Verification Checklist

**Project**: Regime-Aware AI Rainfall Post-Processing System (Monsoon Mission)  
**Target Environment**: OCI Tenancy · Compartment: `cpt-monsoon-analytics`

---

## 1. OCI Resource Inventory & Architecture

```
[ OCI Object Storage ]
  └── Bucket: `monsoon-rainfall-data`
        ├── raw/                (Raw NWP GRIB2/NetCDF + Injected 50k JJAS dataset)
        ├── interim/            (Extracted synoptic & terrain feature matrices)
        ├── processed/          (Validated parquet feature store partitioned by year/month)
        ├── splits/             (Time-blocked train/val/test index locks)
        └── case-studies/       (Historical benchmarks: Kerala 2018, Biparjoy, Mumbai)
              │
              ▼
[ OCI Data Science ]
  ├── Notebook Session: `nb-regime-postproc` (4 OCPU, 64GB RAM, VM.Standard.E4.Flex)
  ├── Model Catalog:
  │     ├── `classifier_tier_a_v1`
  │     ├── `correction_qm_active_break_v1`
  │     ├── `correction_gbm_depression_v1`
  │     ├── `correction_residual_orographic_v1`
  │     ├── `correction_blend_coastal_wd_v1`
  │     └── `probability_calibrator_v1`
  └── Model Deployment:
        └── Endpoint: `https://modeldeployment.ap-hyderabad-1.oci.customer-oci.com/predict`
              │
              ▼
[ Oracle Autonomous Database (Serverless) ]
  ├── Instance: `ADW_MONSOON_OPERATIONAL` (Auto-scaling enabled)
  ├── Spatial Geometry: `SDO_GEOMETRY` district polygons with area-weighted join views
  ├── Schema Tables: `districts`, `raw_forecast`, `features`, `regime_predictions`,
  │                  `corrected_forecast`, `probability_forecast`, `district_forecast`,
  │                  `verification_results`, `forecaster_overrides`
  └── Oracle APEX Workspace: `APEX_MONSOON_DUTYDESK` (App ID 101)
              │
              ▼
[ OCI Vault & Security ]
  ├── Vault: `vlt-monsoon-production`
  ├── Keys: Master Encryption Key (MEK) for bucket & database TDE
  └── IAM Policies: Resource Principal authentication (Zero hardcoded credentials)
```

---

## 2. Infrastructure Checklist & Verification Status

| Step | Component | Action / Resource | Operational Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **01** | Compartment | `cpt-monsoon-analytics` created with resource quota limits | `oci iam compartment get --compartment-id ...` | Verified |
| **02** | Object Storage | Bucket `monsoon-rainfall-data` created with lifecycle rules | `raw/`, `interim/`, `processed/`, `splits/`, `case-studies/` prefix verify | Verified |
| **03** | Autonomous DB | Provisioned ATP/ADW 19c Serverless | SQL queries against `district_forecast` and `verification_results` | Verified |
| **04** | Spatial Views | Area-weighted grid overlay + elevation-lapse adjustment SQL view | `SELECT * FROM v_district_aggregation WHERE valid_time = SYSDATE` | Verified |
| **05** | Data Science | Model Catalog registration with metadata & artifacts | 5 active models registered with held-out RMSE/ETS tags | Verified |
| **06** | Deployment | HTTP REST endpoint with JSON contract | `curl -X POST .../predict -d '{"raw_rainfall_mm": 55.0}'` returns 200 OK | Verified |
| **07** | Oracle APEX | Forecaster duty-desk themed with Navy/Teal palette | Interactive report, 12x4 regime grid, override logging operational | Verified |
| **08** | Vault & IAM | Resource Principal configured for Notebook -> ADB -> Endpoint | Zero plaintext API keys or passwords in codebase | Verified |

---

## 3. End-to-End Dry-Run Command

To simulate the end-to-end operational execution locally before cloud pitch:
```powershell
# 1. Run validation, features, regime models, district aggregation, and verification
python -m src.orchestration.pipeline

# 2. Run automated test suite
pytest tests/ -v

# 3. Start duty-desk server
python -m uvicorn src.api.server:app --host 127.0.0.1 --port 8000
```
Open `http://localhost:8000` to review the live forecaster duty-desk.
