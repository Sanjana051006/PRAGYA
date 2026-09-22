"""
Pydantic Data Schemas for REST API Endpoints.
Conforms to IMD operational product schemas and NDMA SACHET requirements.
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class DistrictForecastRecord(BaseModel):
    district_id: str
    district_name: str
    state: str
    lgd_district_code: str
    lgd_state_code: str
    terrain_type: str
    regime: str
    tier_a_synoptic: str
    tier_b_flags: List[str]
    confidence: float
    entropy: float
    raw_rainfall_mm: float
    corrected_rainfall_mm: float
    quantile_p10_mm: float
    quantile_p90_mm: float
    p_heavy: float
    p_very_heavy: float
    p_extremely_heavy: float
    alert_level: str
    action_statement: str
    observed_rainfall_mm: Optional[float] = None
    lat: float
    lon: float


class ForecastCycleResponse(BaseModel):
    cycle_time: str
    lead_time: str
    synoptic_evaluation: Dict[str, Any]
    banner: Dict[str, str]
    alert_counts: Dict[str, int]
    districts: List[DistrictForecastRecord]
    grid_raster: List[List[str]]


class ForecasterOverrideRequest(BaseModel):
    district_id: str
    district_name: str
    cycle_time: str
    original_regime: str
    overridden_regime: str
    forecaster_id: str = "forecaster_duty_desk_1"
    justification: str = Field(..., min_length=5, description="Synoptic rationale for override")


class ForecasterOverrideResponse(BaseModel):
    success: bool
    message: str
    record: Dict[str, Any]


class BilingualBulletinResponse(BaseModel):
    bulletin_id: str
    issued_time: str
    valid_until: str
    title_en: str
    title_hi: str
    summary_en: str
    summary_hi: str
    district_bulletins: List[Dict[str, Any]]
