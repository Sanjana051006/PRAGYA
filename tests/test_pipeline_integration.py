"""
End-to-end integration test for the operational pipeline.
Asserts:
- Pipeline executes cleanly on synthetic slices
- Output table has expected row count
- No null values in critical fields (district_id, valid_time, alert_level, corrected_rainfall_mm)
- Idempotency: Running twice produces identical row counts without duplicate key errors
"""

import pytest
from src.config import WeatherRegime, DEFAULT_DEMO_DISTRICTS
from src.orchestration.pipeline import OperationalPipeline
from src.db.database import OperationalDatabase


def test_pipeline_end_to_end_integration():
    db = OperationalDatabase()
    pipeline = OperationalPipeline(db=db)

    # 1. First execution
    res1 = pipeline.run_cycle(lead_time="T+24", scenario=WeatherRegime.OROGRAPHIC)
    assert res1["status"] == "SUCCESS"
    assert res1["districts_processed"] == len(DEFAULT_DEMO_DISTRICTS)
    assert res1["verification_records_updated"] > 0

    # Verify rows in DB
    forecast_rows = db.get_district_forecast()
    assert len(forecast_rows) >= len(DEFAULT_DEMO_DISTRICTS)

    # Assert no nulls in required fields
    for row in forecast_rows:
        assert row["district_id"] is not None
        assert row["valid_time"] is not None
        assert row["alert_level"] in ["Green", "Yellow", "Orange", "Red"]
        assert row["corrected_rainfall_mm"] is not None
        assert row["p_heavy"] is not None
        assert row["p_very_heavy"] is not None

    # 2. Idempotency test: Re-run with identical cycle
    res2 = pipeline.run_cycle(
        cycle_time=res1["cycle_time"],
        lead_time="T+24",
        scenario=WeatherRegime.OROGRAPHIC,
    )
    assert res2["status"] == "SUCCESS"

    # Row count should be preserved (upsert without duplicates)
    forecast_rows_after = db.get_district_forecast(valid_time=res1["valid_time"])
    assert len(forecast_rows_after) == len(DEFAULT_DEMO_DISTRICTS)
