"""
Operational Orchestration Pipeline.
Entry point: Ingest -> Validate -> Build Features -> Model Prediction -> Aggregate -> Verify -> Write to Database.
Designed with idempotent upserts to guarantee safe re-execution.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
import pandas as pd

from src.config import WeatherRegime, DEFAULT_DEMO_DISTRICTS
from src.data_pipeline.validate import MonsoonDataValidator
from src.data_pipeline.nwp_loader import NWPGridLoader
from src.models.district_aggregator import DistrictForecastAggregator
from src.verification.verification_runner import VerificationRunner
from src.db.database import OperationalDatabase


class OperationalPipeline:
    """
    Coordinates the full operational cycle from ingestion to persistent DB storage.
    """

    def __init__(self, db: Optional[OperationalDatabase] = None):
        self.db = db or OperationalDatabase()
        self.nwp_loader = NWPGridLoader()
        self.aggregator = DistrictForecastAggregator()
        self.validator = MonsoonDataValidator()

    def run_cycle(
        self,
        cycle_time: Optional[str] = None,
        lead_time: str = "T+24",
        scenario: WeatherRegime = WeatherRegime.OROGRAPHIC,
        model_version: str = "v1.0",
    ) -> Dict[str, Any]:
        """
        Executes end-to-end operational cycle:
        1. Ingest raw cycle
        2. Validate inputs
        3. Build features & run regime models
        4. Aggregate to district forecast
        5. Compute verification metrics
        6. Persist to database (idempotent upsert)
        """
        cycle_ts = cycle_time or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00Z")
        valid_ts = f"{cycle_ts[:10]}T{int(cycle_ts[11:13])+int(lead_time.replace('T+', '')):02d}:00:00Z"

        # 1. Ingest
        cycle_payload = self.nwp_loader.generate_synthetic_forecast_cycle(
            regime_scenario=scenario,
            lead_time=lead_time,
        )
        cycle_payload["cycle_time"] = cycle_ts

        # 2. Validate
        # Create lightweight DataFrame for validation
        df_val = pd.DataFrame([
            {
                "nwp_rainfall_mm": v.get("raw", 40.0),
                "latitude": d.get("lat", 10.0),
                "longitude": d.get("lon", 76.0),
                "elevation_m": d.get("mean_elevation_m", 100.0),
                "lead_time_hours": float(lead_time.replace("T+", "")),
                "regime": scenario.value,
            }
            for d in DEFAULT_DEMO_DISTRICTS
            for k, v in [ (d["id"], cycle_payload["district_data"].get(d["id"], {"raw": 40.0})) ]
        ])
        val_summary = self.validator.validate(df_val, check_regime=True)

        # 3 & 4. Process & Aggregate
        cycle_result = self.aggregator.process_cycle(cycle_payload, districts_list=DEFAULT_DEMO_DISTRICTS)

        # Attach valid_time to district records
        for d in cycle_result["districts"]:
            d["valid_time"] = valid_ts
            d["cycle_time"] = cycle_ts
            d["lead_time"] = lead_time

        # 5. Verify
        verif_results = VerificationRunner.generate_all_verification_results(model_version=model_version)

        # 6. Persist to Database (Idempotent Upsert)
        self.db.upsert_district_forecast(cycle_result["districts"], model_version=model_version)
        self.db.upsert_verification_results(verif_results)

        return {
            "status": "SUCCESS",
            "cycle_time": cycle_ts,
            "valid_time": valid_ts,
            "lead_time": lead_time,
            "scenario": scenario.value,
            "validation": val_summary,
            "districts_processed": len(cycle_result["districts"]),
            "verification_records_updated": len(verif_results),
            "summary_banner": cycle_result["banner"],
        }


if __name__ == "__main__":
    pipeline = OperationalPipeline()
    result = pipeline.run_cycle(lead_time="T+24", scenario=WeatherRegime.OROGRAPHIC)
    print("Pipeline Execution Succeeded:")
    print(f"Districts Processed: {result['districts_processed']}")
    print(f"Banner: {result['summary_banner']}")
