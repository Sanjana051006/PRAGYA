"""
FastAPI Operational Backend for Regime-Aware AI Rainfall Post-Processing.
Serves live forecast cycles, district tables, historical case studies,
verification scorecards, forecaster override queues, and CAP/SACHET feeds.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import BASE_DIR, WeatherRegime
from src.data_pipeline.nwp_loader import NWPGridLoader
from src.models.district_aggregator import DistrictForecastAggregator
from src.benchmark.historical_cases import HistoricalCaseStudyManager
from src.verification.scorecard import VerificationScorecardEngine
from src.mlops.model_cards import ModelCardRegistry
from src.mlops.active_learning import ActiveLearningManager
from src.api.cap_exporter import CAPAlertExporter
from src.api.schemas import (
    ForecastCycleResponse,
    ForecasterOverrideRequest,
    ForecasterOverrideResponse,
    BilingualBulletinResponse,
)

# Initialize application
app = FastAPI(
    title="Regime-Aware AI Rainfall Post-Processing API",
    description="Operational rainfall post-processing system for the Indian Summer Monsoon",
    version="0.1.0",
)

# Enable CORS for duty-desk web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize singletons
nwp_loader = NWPGridLoader()
aggregator = DistrictForecastAggregator()
case_manager = HistoricalCaseStudyManager()
scorecard_engine = VerificationScorecardEngine()
active_learning = ActiveLearningManager()
cap_exporter = CAPAlertExporter()

# Cached current operational state
CURRENT_CYCLE_STATE = aggregator.process_cycle(
    nwp_loader.generate_synthetic_forecast_cycle(
        regime_scenario=WeatherRegime.OROGRAPHIC,
        lead_time="T+24",
    )
)


@app.get("/api/v1/health")
def health_check():
    """Health check endpoint."""
    return {"status": "operational", "system": "Regime-Aware AI Rainfall Post-Processing MVP"}


@app.get("/api/v1/forecast/latest", response_model=ForecastCycleResponse)
def get_latest_forecast():
    """Returns the latest operational forecast cycle, district outlook table, and regime map grid."""
    return CURRENT_CYCLE_STATE


@app.get("/api/v1/forecast/cases")
def get_case_studies():
    """Returns list and metadata of pre-loaded historical benchmark case studies."""
    return case_manager.get_case_metadata()


@app.get("/api/v1/forecast/case/{case_id}", response_model=ForecastCycleResponse)
def load_case_study(case_id: str):
    """Loads a specific historical benchmark case study into the forecast engine."""
    global CURRENT_CYCLE_STATE
    try:
        case_forecast = case_manager.load_case_forecast(case_id)
        CURRENT_CYCLE_STATE = case_forecast
        return case_forecast
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Case study {case_id} not found: {str(e)}")


@app.post("/api/v1/forecast/override", response_model=ForecasterOverrideResponse)
def submit_forecaster_override(req: ForecasterOverrideRequest):
    """
    Submits a forecaster-in-the-loop override into the active-learning queue.
    Updates the live in-memory forecast state and logs the justification.
    """
    global CURRENT_CYCLE_STATE
    
    # 1. Log to active learning queue
    log_res = active_learning.record_override(
        district_id=req.district_id,
        district_name=req.district_name,
        cycle_time=req.cycle_time,
        original_regime=req.original_regime,
        overridden_regime=req.overridden_regime,
        forecaster_id=req.forecaster_id,
        justification=req.justification,
    )

    # 2. Update current cycle state for the target district
    for dist in CURRENT_CYCLE_STATE["districts"]:
        if dist["district_id"] == req.district_id:
            dist["regime"] = req.overridden_regime
            dist["confidence"] = 0.92 # Forecaster validated confidence
            break

    return ForecasterOverrideResponse(
        success=True,
        message=f"Override registered for {req.district_name}. Sent to active-learning retraining queue.",
        record=log_res["record"],
    )


@app.get("/api/v1/mlops/overrides")
def get_overrides():
    """Returns recent forecaster overrides and queue summary statistics."""
    return {
        "recent_overrides": active_learning.get_recent_overrides(),
        "queue_stats": active_learning.get_queue_statistics(),
    }


@app.get("/api/v1/verification/scorecard")
def get_verification_scorecard():
    """Returns comparative verification scorecards comparing Corrected AI vs Raw NWP."""
    return scorecard_engine.generate_benchmark_scorecard()


@app.get("/api/v1/mlops/model-cards")
def get_model_cards():
    """Returns auditable model cards for all deployed regime models."""
    return ModelCardRegistry.get_all_cards()


@app.get("/api/v1/mlops/model-registry")
def get_model_registry():
    """Returns active models and metadata from OCI / local model catalog."""
    from src.mlops.model_registry import ModelRegistry
    return {
        "active_models": ModelRegistry.get_active_models(),
        "catalog_summary": "OCI Data Science Model Catalog (local mirror)",
    }


@app.get("/api/v1/verification/results")
def get_db_verification_results():
    """Returns verification results queried directly from the operational database."""
    from src.db.database import OperationalDatabase
    db = OperationalDatabase()
    return {"results": db.get_verification_results()}


@app.post("/api/v1/pipeline/run")
def trigger_pipeline_run(
    lead_time: str = Query("T+24", description="Lead time (T+24, T+48, T+72)"),
    scenario: str = Query("Orographic", description="Regime scenario"),
):
    """Triggers an operational pipeline cycle and commits results to Autonomous DB."""
    from src.orchestration.pipeline import OperationalPipeline
    pipeline = OperationalPipeline()
    reg_enum = WeatherRegime.OROGRAPHIC
    for r in WeatherRegime:
        if r.value.lower() == scenario.lower() or r.name.lower() == scenario.lower():
            reg_enum = r
            break
    result = pipeline.run_cycle(lead_time=lead_time, scenario=reg_enum)
    return result


@app.get("/api/v1/alerts/cap.xml")
def export_cap_xml(district_id: Optional[str] = Query(None, description="Target district ID")):
    """
    Generates and returns OASIS CAP v1.2 XML for NDMA SACHET integration.
    Defaults to the highest alerted district if no district_id is provided.
    """
    districts = CURRENT_CYCLE_STATE.get("districts", [])
    if not districts:
        raise HTTPException(status_code=404, detail="No districts in current forecast")

    target_dist = None
    if district_id:
        for d in districts:
            if d["district_id"] == district_id:
                target_dist = d
                break
        if not target_dist:
            raise HTTPException(status_code=404, detail=f"District {district_id} not found")
    else:
        # Select highest severity district (Red > Orange > Yellow > Green)
        severity_order = {"Red": 4, "Orange": 3, "Yellow": 2, "Green": 1}
        target_dist = max(districts, key=lambda d: severity_order.get(d.get("alert_level", "Green"), 0))

    xml_content = cap_exporter.generate_cap_xml(target_dist, CURRENT_CYCLE_STATE.get("cycle_time", ""))
    return Response(content=xml_content, media_type="application/xml")


@app.get("/api/v1/bulletin/bilingual", response_model=BilingualBulletinResponse)
def get_bilingual_bulletin():
    """
    Generates a bilingual (English and Hindi) plain-language district weather bulletin.
    """
    now = datetime.now(timezone.utc)
    districts = CURRENT_CYCLE_STATE.get("districts", [])
    
    # Identify alerted districts
    alerted = [d for d in districts if d["alert_level"] in ["Orange", "Red"]]
    
    if alerted:
        dist_names = ", ".join([d["district_name"] for d in alerted])
        summary_en = f"Very heavy to extremely heavy rainfall warning issued for {dist_names} over the next 24 hours under active orographic/depression regime."
        summary_hi = f"सक्रिय वर्षा व्यवस्था के तहत अगले 24 घंटों के दौरान {dist_names} में भारी से बहुत भारी बारिश की चेतावनी जारी की गई है।"
    else:
        summary_en = "Light to moderate rainfall expected across majority of districts. No severe weather warning active."
        summary_hi = "अधिकांश जिलों में हल्की से मध्यम बारिश की संभावना है। कोई गंभीर मौसम चेतावनी सक्रिय नहीं है।"

    district_bulletins = []
    for d in districts:
        district_bulletins.append({
            "district": d["district_name"],
            "state": d["state"],
            "alert": d["alert_level"],
            "regime": d["regime"],
            "rainfall_range_mm": f"{d['quantile_p10_mm']} – {d['quantile_p90_mm']}",
            "expected_p50_mm": d["corrected_rainfall_mm"],
            "advisory_en": d["action_statement"],
            "advisory_hi": "स्थानीय अधिकारियों के निर्देशों का पालन करें और जलभराव वाले क्षेत्रों से दूर रहें।"
        })

    return BilingualBulletinResponse(
        bulletin_id=f"BULLETIN-IMD-NWAP-{now.strftime('%Y%m%d%H%M')}",
        issued_time=now.strftime("%d-%b-%Y %H:%M UTC"),
        valid_until=(now.replace(hour=23, minute=59)).strftime("%d-%b-%Y %H:%M UTC"),
        title_en="National Weather Analytics Programme — Daily District Monsoon Bulletin",
        title_hi="राष्ट्रीय मौसम विश्लेषिकी कार्यक्रम — दैनिक जिला मानसून बुलेटिन",
        summary_en=summary_en,
        summary_hi=summary_hi,
        district_bulletins=district_bulletins,
    )


# Mount static web directory
web_dir = BASE_DIR / "web"
if web_dir.exists():
    app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="web")
