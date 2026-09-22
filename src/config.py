"""
Meteorological and Operational Configuration for Regime-Aware AI Rainfall Post-Processing.
Conforms strictly to India Meteorological Department (IMD) operational standards,
WMO guidelines, and NDMA Pan-India SACHET alert framework.
"""

from enum import Enum
from pathlib import Path
from typing import Dict, List, Tuple

# Base Directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"
MODELS_DIR = BASE_DIR / "models_store"

# Ensure directories exist
for p in [DATA_DIR, LOGS_DIR, MODELS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# IMD Operational Rainfall Thresholds (24-Hour Accumulated, 03:00 to 03:00 UTC)
# -----------------------------------------------------------------------------
class RainfallCategory(str, Enum):
    NO_RAIN = "No Rain"
    VERY_LIGHT = "Very Light Rain"
    LIGHT = "Light Rain"
    MODERATE = "Moderate Rain"
    HEAVY = "Heavy Rain"
    VERY_HEAVY = "Very Heavy Rain"
    EXTREMELY_HEAVY = "Extremely Heavy Rain"

# Operational Threshold Values in mm/24h
THRESH_VERY_LIGHT_MIN = 0.1
THRESH_LIGHT_MIN = 2.5
THRESH_MODERATE_MIN = 15.6
THRESH_HEAVY_MIN = 64.5
THRESH_VERY_HEAVY_MIN = 115.6
THRESH_EXTREMELY_HEAVY_MIN = 204.5

# IMD Warning Color Codes
class AlertLevel(str, Enum):
    GREEN = "Green"    # No warning / Normal
    YELLOW = "Yellow"  # Watch / Be updated
    ORANGE = "Orange"  # Alert / Be prepared
    RED = "Red"        # Warning / Take action

ALERT_COLORS = {
    AlertLevel.GREEN: "#2E6B3E",
    AlertLevel.YELLOW: "#B5730E",
    AlertLevel.ORANGE: "#D97706",
    AlertLevel.RED: "#9C2A2A",
}

# -----------------------------------------------------------------------------
# Weather Regime Taxonomy
# -----------------------------------------------------------------------------
class WeatherRegime(str, Enum):
    ACTIVE = "Active"
    BREAK = "Break"
    DEPRESSION = "Low / Depression"
    WESTERN_DISTURBANCE = "Western Disturbance"
    OROGRAPHIC = "Orographic"
    COASTAL_CONVECTIVE = "Coastal-Convective"

REGIME_COLORS = {
    WeatherRegime.ACTIVE: "#1B6E8C",               # Monsoon Teal
    WeatherRegime.BREAK: "#B5730E",                # Break Amber
    WeatherRegime.DEPRESSION: "#9C2A2A",           # Depression Crimson
    WeatherRegime.WESTERN_DISTURBANCE: "#0B2C4D",  # Navy
    WeatherRegime.OROGRAPHIC: "#2E6B3E",           # Forest Green
    WeatherRegime.COASTAL_CONVECTIVE: "#5B4B8A",   # Violet
}

# -----------------------------------------------------------------------------
# Demonstration Domain: Kerala–Karnataka Western Ghats & Coastal Belt + Odisha
# -----------------------------------------------------------------------------
DEFAULT_DEMO_DISTRICTS: List[Dict] = [
    {
        "id": "idukki",
        "name": "Idukki",
        "state": "Kerala",
        "lgd_district_code": "560",
        "lgd_state_code": "32",
        "terrain_type": "high_ghats",
        "lat": 9.85,
        "lon": 76.97,
        "mean_elevation_m": 1200,
        "elevation_gradient": 0.085,
        "dist_to_coast_km": 85,
        "primary_regime": WeatherRegime.OROGRAPHIC,
    },
    {
        "id": "wayanad",
        "name": "Wayanad",
        "state": "Kerala",
        "lgd_district_code": "555",
        "lgd_state_code": "32",
        "terrain_type": "high_ghats",
        "lat": 11.68,
        "lon": 76.13,
        "mean_elevation_m": 950,
        "elevation_gradient": 0.078,
        "dist_to_coast_km": 60,
        "primary_regime": WeatherRegime.OROGRAPHIC,
    },
    {
        "id": "kozhikode",
        "name": "Kozhikode",
        "state": "Kerala",
        "lgd_district_code": "556",
        "lgd_state_code": "32",
        "terrain_type": "coastal",
        "lat": 11.25,
        "lon": 75.78,
        "mean_elevation_m": 15,
        "elevation_gradient": 0.012,
        "dist_to_coast_km": 4,
        "primary_regime": WeatherRegime.COASTAL_CONVECTIVE,
    },
    {
        "id": "ernakulam",
        "name": "Ernakulam",
        "state": "Kerala",
        "lgd_district_code": "559",
        "lgd_state_code": "32",
        "terrain_type": "coastal_plain",
        "lat": 9.98,
        "lon": 76.28,
        "mean_elevation_m": 10,
        "elevation_gradient": 0.008,
        "dist_to_coast_km": 6,
        "primary_regime": WeatherRegime.COASTAL_CONVECTIVE,
    },
    {
        "id": "dakshina_kannada",
        "name": "Dakshina Kannada",
        "state": "Karnataka",
        "lgd_district_code": "535",
        "lgd_state_code": "29",
        "terrain_type": "coastal_ghats_transition",
        "lat": 12.87,
        "lon": 75.05,
        "mean_elevation_m": 110,
        "elevation_gradient": 0.045,
        "dist_to_coast_km": 15,
        "primary_regime": WeatherRegime.COASTAL_CONVECTIVE,
    },
    {
        "id": "kodagu",
        "name": "Kodagu (Coorg)",
        "state": "Karnataka",
        "lgd_district_code": "538",
        "lgd_state_code": "29",
        "terrain_type": "high_ghats",
        "lat": 12.42,
        "lon": 75.73,
        "mean_elevation_m": 1150,
        "elevation_gradient": 0.082,
        "dist_to_coast_km": 70,
        "primary_regime": WeatherRegime.OROGRAPHIC,
    },
    {
        "id": "shivamogga",
        "name": "Shivamogga (Shimoga)",
        "state": "Karnataka",
        "lgd_district_code": "544",
        "lgd_state_code": "29",
        "terrain_type": "malnad_ghats",
        "lat": 13.93,
        "lon": 75.57,
        "mean_elevation_m": 640,
        "elevation_gradient": 0.052,
        "dist_to_coast_km": 95,
        "primary_regime": WeatherRegime.OROGRAPHIC,
    },
    {
        "id": "kolhapur",
        "name": "Kolhapur",
        "state": "Maharashtra",
        "lgd_district_code": "489",
        "lgd_state_code": "27",
        "terrain_type": "leeward_plateau",
        "lat": 16.70,
        "lon": 74.24,
        "mean_elevation_m": 570,
        "elevation_gradient": 0.025,
        "dist_to_coast_km": 110,
        "primary_regime": WeatherRegime.ACTIVE,
    },
    {
        "id": "balasore",
        "name": "Balasore",
        "state": "Odisha",
        "lgd_district_code": "344",
        "lgd_state_code": "21",
        "terrain_type": "east_coast_cyclone_belt",
        "lat": 21.49,
        "lon": 86.93,
        "mean_elevation_m": 16,
        "elevation_gradient": 0.005,
        "dist_to_coast_km": 12,
        "primary_regime": WeatherRegime.DEPRESSION,
    },
]

# Forecast Lead Times
LEAD_TIMES = ["T+24", "T+48", "T+72"]

# Operational NWP Grid Specs (NCUM 12km / GFS 0.125°)
GRID_LAT_MIN = 8.0
GRID_LAT_MAX = 22.0
GRID_LON_MIN = 72.0
GRID_LON_MAX = 88.0
GRID_RESOLUTION_DEG = 0.125  # ~12 km

# Active Learning Configuration
ACTIVE_LEARNING_LOG_PATH = LOGS_DIR / "forecaster_overrides.jsonl"
RETRAINING_QUEUE_PATH = LOGS_DIR / "retraining_queue.jsonl"
