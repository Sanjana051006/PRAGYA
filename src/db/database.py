"""
Database Layer (Autonomous Database / SQLite Simulation).
Implements all 9 operational tables required by the build specification:
1. districts
2. raw_forecast
3. features
4. regime_predictions
5. corrected_forecast
6. probability_forecast
7. district_forecast
8. verification_results
9. forecaster_overrides

All tables indexed on (district_id, valid_time) with idempotent upsert capabilities.
"""

import sqlite3
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from src.config import BASE_DIR, DATA_DIR, DEFAULT_DEMO_DISTRICTS


class OperationalDatabase:
    """
    Manages operational SQL storage, tables, indexes, and upsert transactions.
    """

    DB_PATH = DATA_DIR / "operational_rainfall.db"

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or self.DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init_schema()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_schema(self):
        """Initializes all 9 schema tables and indexes."""
        with self.get_connection() as conn:
            cur = conn.cursor()

            # 1. districts
            cur.execute("""
            CREATE TABLE IF NOT EXISTS districts (
                district_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                state TEXT NOT NULL,
                lgd_district_code TEXT,
                lgd_state_code TEXT,
                terrain_type TEXT,
                lat REAL,
                lon REAL,
                mean_elevation_m REAL,
                elevation_gradient REAL,
                dist_to_coast_km REAL,
                primary_regime TEXT,
                polygon_geojson TEXT
            );
            """)

            # 2. raw_forecast
            cur.execute("""
            CREATE TABLE IF NOT EXISTS raw_forecast (
                district_id TEXT,
                valid_time TEXT,
                cycle_time TEXT,
                lead_time TEXT,
                raw_rainfall_mm REAL,
                model_source TEXT,
                PRIMARY KEY (district_id, valid_time, model_source)
            );
            """)

            # 3. features
            cur.execute("""
            CREATE TABLE IF NOT EXISTS features (
                district_id TEXT,
                valid_time TEXT,
                feature_json TEXT,
                PRIMARY KEY (district_id, valid_time)
            );
            """)

            # 4. regime_predictions
            cur.execute("""
            CREATE TABLE IF NOT EXISTS regime_predictions (
                district_id TEXT,
                valid_time TEXT,
                model_version TEXT,
                primary_regime TEXT,
                confidence REAL,
                entropy REAL,
                probability_vector_json TEXT,
                tier_b_flags_json TEXT,
                PRIMARY KEY (district_id, valid_time, model_version)
            );
            """)

            # 5. corrected_forecast
            cur.execute("""
            CREATE TABLE IF NOT EXISTS corrected_forecast (
                district_id TEXT,
                valid_time TEXT,
                model_version TEXT,
                corrected_rainfall_mm REAL,
                quantile_p10_mm REAL,
                quantile_p90_mm REAL,
                correction_method TEXT,
                PRIMARY KEY (district_id, valid_time, model_version)
            );
            """)

            # 6. probability_forecast
            cur.execute("""
            CREATE TABLE IF NOT EXISTS probability_forecast (
                district_id TEXT,
                valid_time TEXT,
                model_version TEXT,
                p_heavy REAL,
                p_very_heavy REAL,
                p_extreme REAL,
                alert_level TEXT,
                action_statement TEXT,
                PRIMARY KEY (district_id, valid_time, model_version)
            );
            """)

            # 7. district_forecast (Final aggregated product consumed by UI)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS district_forecast (
                district_id TEXT,
                valid_time TEXT,
                cycle_time TEXT,
                lead_time TEXT,
                district_name TEXT,
                state TEXT,
                regime TEXT,
                confidence REAL,
                raw_rainfall_mm REAL,
                corrected_rainfall_mm REAL,
                quantile_p10_mm REAL,
                quantile_p90_mm REAL,
                p_heavy REAL,
                p_very_heavy REAL,
                p_extreme REAL,
                alert_level TEXT,
                action_statement TEXT,
                model_version TEXT,
                PRIMARY KEY (district_id, valid_time, model_version)
            );
            """)

            # 8. verification_results
            cur.execute("""
            CREATE TABLE IF NOT EXISTS verification_results (
                regime TEXT,
                lead_time TEXT,
                model_version TEXT,
                threshold_mm REAL,
                raw_rmse REAL,
                corrected_rmse REAL,
                raw_ets REAL,
                corrected_ets REAL,
                raw_csi REAL,
                corrected_csi REAL,
                raw_pod REAL,
                corrected_pod REAL,
                raw_far REAL,
                corrected_far REAL,
                raw_fss REAL,
                corrected_fss REAL,
                rmse_reduction REAL,
                ets_gain REAL,
                PRIMARY KEY (regime, lead_time, model_version, threshold_mm)
            );
            """)

            # 9. forecaster_overrides
            cur.execute("""
            CREATE TABLE IF NOT EXISTS forecaster_overrides (
                override_id TEXT PRIMARY KEY,
                timestamp TEXT,
                district_id TEXT,
                district_name TEXT,
                cycle_time TEXT,
                original_regime TEXT,
                overridden_regime TEXT,
                forecaster_id TEXT,
                justification TEXT,
                action_status TEXT
            );
            """)

            # Indexes for high-throughput queries
            cur.execute("CREATE INDEX IF NOT EXISTS idx_df_dist_time ON district_forecast (district_id, valid_time);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_df_alert ON district_forecast (alert_level);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_verif_reg_lead ON verification_results (regime, lead_time);")

            # Seed demo districts if empty
            cur.execute("SELECT COUNT(*) FROM districts;")
            if cur.fetchone()[0] == 0:
                for d in DEFAULT_DEMO_DISTRICTS:
                    cur.execute("""
                    INSERT OR REPLACE INTO districts (
                        district_id, name, state, lgd_district_code, lgd_state_code,
                        terrain_type, lat, lon, mean_elevation_m, elevation_gradient,
                        dist_to_coast_km, primary_regime, polygon_geojson
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        d["id"], d["name"], d["state"], d["lgd_district_code"], d["lgd_state_code"],
                        d["terrain_type"], d["lat"], d["lon"], d["mean_elevation_m"], d["elevation_gradient"],
                        d["dist_to_coast_km"], d["primary_regime"].value if hasattr(d["primary_regime"], "value") else str(d["primary_regime"]),
                        json.dumps({"type": "Polygon", "coordinates": [[[d["lon"]-0.2, d["lat"]-0.2], [d["lon"]+0.2, d["lat"]-0.2], [d["lon"]+0.2, d["lat"]+0.2], [d["lon"]-0.2, d["lat"]+0.2], [d["lon"]-0.2, d["lat"]-0.2]]]})
                    ))
            conn.commit()

    def upsert_district_forecast(self, records: List[Dict[str, Any]], model_version: str = "v1.0"):
        """Idempotent upsert into district_forecast table."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            for r in records:
                cur.execute("""
                INSERT OR REPLACE INTO district_forecast (
                    district_id, valid_time, cycle_time, lead_time, district_name, state,
                    regime, confidence, raw_rainfall_mm, corrected_rainfall_mm,
                    quantile_p10_mm, quantile_p90_mm, p_heavy, p_very_heavy, p_extreme,
                    alert_level, action_statement, model_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    r["district_id"], r.get("valid_time", "2026-09-22T00:00:00Z"),
                    r.get("cycle_time", "2026-09-21T00:00:00Z"), r.get("lead_time", "T+24"),
                    r["district_name"], r["state"], r["regime"], r.get("confidence", 0.8),
                    r["raw_rainfall_mm"], r["corrected_rainfall_mm"],
                    r["quantile_p10_mm"], r["quantile_p90_mm"],
                    r["p_heavy"], r["p_very_heavy"], r.get("p_extreme", r.get("p_extremely_heavy", 0.0)),
                    r["alert_level"], r.get("action_statement", ""), model_version
                ))
            conn.commit()

    def upsert_verification_results(self, results: List[Dict[str, Any]]):
        """Idempotent upsert into verification_results table."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            for r in results:
                raw_m = r["raw_metrics"]
                corr_m = r["corrected_metrics"]
                delta = r.get("delta", {})
                cur.execute("""
                INSERT OR REPLACE INTO verification_results (
                    regime, lead_time, model_version, threshold_mm,
                    raw_rmse, corrected_rmse, raw_ets, corrected_ets,
                    raw_csi, corrected_csi, raw_pod, corrected_pod,
                    raw_far, corrected_far, raw_fss, corrected_fss,
                    rmse_reduction, ets_gain
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    r["regime"], r["lead_time"], r["model_version"], r["threshold_mm"],
                    raw_m["rmse"], corr_m["rmse"], raw_m["ets"], corr_m["ets"],
                    raw_m["csi"], corr_m["csi"], raw_m["pod"], corr_m["pod"],
                    raw_m["far"], corr_m["far"], raw_m["fss"], corr_m["fss"],
                    delta.get("rmse_reduction", raw_m["rmse"] - corr_m["rmse"]),
                    delta.get("ets_gain", corr_m["ets"] - raw_m["ets"])
                ))
            conn.commit()

    def get_district_forecast(self, valid_time: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            if valid_time:
                cur.execute("SELECT * FROM district_forecast WHERE valid_time = ? ORDER BY p_very_heavy DESC;", (valid_time,))
            else:
                cur.execute("SELECT * FROM district_forecast ORDER BY p_very_heavy DESC;")
            return [dict(row) for row in cur.fetchall()]

    def get_verification_results(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM verification_results ORDER BY regime, lead_time;")
            return [dict(row) for row in cur.fetchall()]
