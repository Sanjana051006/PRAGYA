"""
Model Configuration & IMD Meteorological Standards.
Provides rainfall classification thresholds, alert levels, regimes, and demonstration districts.
"""

from enum import Enum
from pathlib import Path
from typing import Dict, List, Any

# Operational 24h Accumulated Rainfall Thresholds (mm / 24h)
THRESH_VERY_LIGHT_MIN = 0.1
THRESH_LIGHT_MIN = 2.5
THRESH_MODERATE_MIN = 15.6
THRESH_HEAVY_MIN = 64.5
THRESH_VERY_HEAVY_MIN = 115.6
THRESH_EXTREMELY_HEAVY_MIN = 204.5


class RainfallCategory(str, Enum):
    NO_RAIN = "No Rain"
    VERY_LIGHT = "Very Light Rain"
    LIGHT = "Light Rain"
    MODERATE = "Moderate Rain"
    HEAVY = "Heavy Rain"
    VERY_HEAVY = "Very Heavy Rain"
    EXTREMELY_HEAVY = "Extremely Heavy Rain"


class AlertLevel(str, Enum):
    GREEN = "Green"
    YELLOW = "Yellow"
    ORANGE = "Orange"
    RED = "Red"


class WeatherRegime(str, Enum):
    ACTIVE = "Active"
    BREAK = "Break"
    DEPRESSION = "Low / Depression"
    WESTERN_DISTURBANCE = "Western Disturbance"
    OROGRAPHIC = "Orographic"
    COASTAL_CONVECTIVE = "Coastal-Convective"


ALERT_COLORS = {
    AlertLevel.GREEN: "#2E6B3E",
    AlertLevel.YELLOW: "#B5730E",
    AlertLevel.ORANGE: "#D97706",
    AlertLevel.RED: "#9C2A2A",
}

REGIME_COLORS = {
    WeatherRegime.ACTIVE: "#1B6E8C",
    WeatherRegime.BREAK: "#B5730E",
    WeatherRegime.DEPRESSION: "#9C2A2A",
    WeatherRegime.WESTERN_DISTURBANCE: "#0B2C4D",
    WeatherRegime.OROGRAPHIC: "#2E6B3E",
    WeatherRegime.COASTAL_CONVECTIVE: "#5B4B8A",
}

DEFAULT_DEMO_DISTRICTS: List[Dict[str, Any]] = [
    {
        "id": "idukki",
        "name": "Idukki",
        "state": "Kerala",
        "lgd_district_code": "560",
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
        "terrain_type": "high_ghats",
        "lat": 11.68,
        "lon": 76.13,
        "mean_elevation_m": 950,
        "elevation_gradient": 0.075,
        "dist_to_coast_km": 60,
        "primary_regime": WeatherRegime.OROGRAPHIC,
    },
    {
        "id": "ernakulam",
        "name": "Ernakulam",
        "state": "Kerala",
        "lgd_district_code": "561",
        "terrain_type": "coastal",
        "lat": 9.98,
        "lon": 76.28,
        "mean_elevation_m": 15,
        "elevation_gradient": 0.002,
        "dist_to_coast_km": 5,
        "primary_regime": WeatherRegime.COASTAL_CONVECTIVE,
    },
    {
        "id": "shimla",
        "name": "Shimla",
        "state": "Himachal Pradesh",
        "lgd_district_code": "24",
        "terrain_type": "himalayan_mountain",
        "lat": 31.10,
        "lon": 77.17,
        "mean_elevation_m": 2200,
        "elevation_gradient": 0.120,
        "dist_to_coast_km": 1100,
        "primary_regime": WeatherRegime.OROGRAPHIC,
    },
    {
        "id": "dehradun",
        "name": "Dehradun",
        "state": "Uttarakhand",
        "lgd_district_code": "56",
        "terrain_type": "himalayan_mountain",
        "lat": 30.31,
        "lon": 78.03,
        "mean_elevation_m": 650,
        "elevation_gradient": 0.095,
        "dist_to_coast_km": 1050,
        "primary_regime": WeatherRegime.OROGRAPHIC,
    },
    {
        "id": "patna",
        "name": "Patna",
        "state": "Bihar",
        "lgd_district_code": "213",
        "terrain_type": "river_valley",
        "lat": 25.60,
        "lon": 85.12,
        "mean_elevation_m": 53,
        "elevation_gradient": 0.001,
        "dist_to_coast_km": 420,
        "primary_regime": WeatherRegime.BREAK,
    },
    {
        "id": "pune",
        "name": "Pune",
        "state": "Maharashtra",
        "lgd_district_code": "521",
        "terrain_type": "leeward_plateau",
        "lat": 18.52,
        "lon": 73.85,
        "mean_elevation_m": 560,
        "elevation_gradient": 0.015,
        "dist_to_coast_km": 110,
        "primary_regime": WeatherRegime.ACTIVE,
    },
    {
        "id": "kamrup",
        "name": "Kamrup Metropolitan",
        "state": "Assam",
        "lgd_district_code": "301",
        "terrain_type": "river_valley",
        "lat": 26.14,
        "lon": 91.73,
        "mean_elevation_m": 55,
        "elevation_gradient": 0.020,
        "dist_to_coast_km": 550,
        "primary_regime": WeatherRegime.BREAK,
    }
]
