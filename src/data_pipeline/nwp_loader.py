"""
NWP Ingestion and Grid Processing Module.
Handles NCUM 12km / GFS 0.125° precipitation grids and provides synthetic
meteorological state generation for operational testing and demonstration.
"""

from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
import numpy as np
from src.config import (
    DEFAULT_DEMO_DISTRICTS,
    WeatherRegime,
    LEAD_TIMES,
)


class NWPGridLoader:
    """
    Ingests or generates 24-hour accumulated NWP precipitation grids and synoptic parameters.
    """

    def __init__(self):
        pass

    def generate_synthetic_forecast_cycle(
        self,
        regime_scenario: WeatherRegime = WeatherRegime.OROGRAPHIC,
        lead_time: str = "T+24",
        cycle_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Generates a physically consistent synthetic NWP forecast cycle and matching
        ground truth observations for testing and operational demonstration.
        """
        if cycle_time is None:
            cycle_time = datetime(2026, 9, 21, 0, 0, tzinfo=timezone.utc)

        # 1. Base synoptic conditions conditioned on the scenario
        if regime_scenario == WeatherRegime.OROGRAPHIC:
            # Active monsoon surge with intense orographic Ghats enhancement
            synoptic_state = {
                "vorticity_850": 2.8e-5,
                "llj_speed_knots": 36.0,
                "u_850_ms": 18.5,
                "u_200_ms": -22.0,
                "mslp_trough_hpa": 998.5,
                "olr_wm2": 175.0,
                "day_of_monsoon": 113,
                "wind_direction_850": 260.0, # West-southwesterly
            }
            # District raw forecasts vs ground truth
            district_raw_obs = {
                "idukki": {"raw": 88.0, "obs": 152.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "wayanad": {"raw": 72.0, "obs": 134.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kozhikode": {"raw": 61.0, "obs": 98.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "ernakulam": {"raw": 55.0, "obs": 82.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "dakshina_kannada": {"raw": 68.0, "obs": 112.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "kodagu": {"raw": 82.0, "obs": 140.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "shivamogga": {"raw": 64.0, "obs": 96.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kolhapur": {"raw": 54.0, "obs": 48.0, "primary_regime": WeatherRegime.ACTIVE}, # Rain-shadow
                "balasore": {"raw": 24.0, "obs": 20.0, "primary_regime": WeatherRegime.ACTIVE},
            }

        elif regime_scenario == WeatherRegime.DEPRESSION:
            # Bay of Bengal Monsoon Depression making landfall near Odisha / West Bengal
            synoptic_state = {
                "vorticity_850": 6.2e-5,
                "llj_speed_knots": 28.0,
                "u_850_ms": 14.0,
                "u_200_ms": -18.0,
                "mslp_trough_hpa": 991.0, # Deep depression
                "olr_wm2": 140.0,
                "day_of_monsoon": 105,
                "wind_direction_850": 110.0, # Southeasterly inflow
            }
            district_raw_obs = {
                "idukki": {"raw": 22.0, "obs": 28.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "wayanad": {"raw": 18.0, "obs": 20.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kozhikode": {"raw": 15.0, "obs": 18.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "ernakulam": {"raw": 12.0, "obs": 14.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "dakshina_kannada": {"raw": 25.0, "obs": 28.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "kodagu": {"raw": 30.0, "obs": 35.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "shivamogga": {"raw": 35.0, "obs": 40.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kolhapur": {"raw": 42.0, "obs": 46.0, "primary_regime": WeatherRegime.ACTIVE},
                "balasore": {"raw": 140.0, "obs": 224.0, "primary_regime": WeatherRegime.DEPRESSION}, # Extreme rain
            }

        elif regime_scenario == WeatherRegime.BREAK:
            # Break monsoon spell - trough along foothills, suppressed peninsular rainfall
            synoptic_state = {
                "vorticity_850": 0.6e-5,
                "llj_speed_knots": 12.0,
                "u_850_ms": 6.0,
                "u_200_ms": -10.0,
                "mslp_trough_hpa": 1008.0,
                "olr_wm2": 265.0,
                "day_of_monsoon": 72,
                "wind_direction_850": 290.0, # North-westerly dry air
            }
            district_raw_obs = {
                "idukki": {"raw": 14.0, "obs": 4.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "wayanad": {"raw": 12.0, "obs": 3.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kozhikode": {"raw": 8.0, "obs": 1.5, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "ernakulam": {"raw": 6.0, "obs": 0.5, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "dakshina_kannada": {"raw": 10.0, "obs": 2.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "kodagu": {"raw": 15.0, "obs": 4.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "shivamogga": {"raw": 8.0, "obs": 1.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kolhapur": {"raw": 5.0, "obs": 0.0, "primary_regime": WeatherRegime.BREAK},
                "balasore": {"raw": 4.0, "obs": 0.0, "primary_regime": WeatherRegime.BREAK},
            }
        else: # Active normal
            synoptic_state = {
                "vorticity_850": 2.2e-5,
                "llj_speed_knots": 26.0,
                "u_850_ms": 13.0,
                "u_200_ms": -19.0,
                "mslp_trough_hpa": 1002.0,
                "olr_wm2": 210.0,
                "day_of_monsoon": 85,
                "wind_direction_850": 270.0,
            }
            district_raw_obs = {
                "idukki": {"raw": 55.0, "obs": 75.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "wayanad": {"raw": 48.0, "obs": 62.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kozhikode": {"raw": 42.0, "obs": 50.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "ernakulam": {"raw": 38.0, "obs": 44.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "dakshina_kannada": {"raw": 46.0, "obs": 58.0, "primary_regime": WeatherRegime.COASTAL_CONVECTIVE},
                "kodagu": {"raw": 52.0, "obs": 68.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "shivamogga": {"raw": 40.0, "obs": 48.0, "primary_regime": WeatherRegime.OROGRAPHIC},
                "kolhapur": {"raw": 54.0, "obs": 49.0, "primary_regime": WeatherRegime.ACTIVE},
                "balasore": {"raw": 35.0, "obs": 38.0, "primary_regime": WeatherRegime.ACTIVE},
            }

        # 2. Build 12x4 demonstration grid raster
        # Representing an abstracted synoptic-to-mesoscale grid over Peninsular India
        grid_rows, grid_cols = 4, 12
        grid_cells = []
        regimes_palette = [
            WeatherRegime.ACTIVE,
            WeatherRegime.BREAK,
            WeatherRegime.DEPRESSION,
            WeatherRegime.OROGRAPHIC,
            WeatherRegime.COASTAL_CONVECTIVE,
            WeatherRegime.WESTERN_DISTURBANCE,
        ]
        
        np.random.seed(42 if regime_scenario == WeatherRegime.OROGRAPHIC else 99)
        for r in range(grid_rows):
            row_cells = []
            for c in range(grid_cols):
                # Distribute regimes across the grid in a physically plausible spatial pattern
                if c < 3:
                    reg = WeatherRegime.COASTAL_CONVECTIVE if r < 2 else WeatherRegime.OROGRAPHIC
                elif c < 6:
                    reg = WeatherRegime.OROGRAPHIC if r < 3 else WeatherRegime.ACTIVE
                elif c < 9:
                    reg = WeatherRegime.DEPRESSION if regime_scenario == WeatherRegime.DEPRESSION else WeatherRegime.ACTIVE
                else:
                    reg = WeatherRegime.BREAK if regime_scenario == WeatherRegime.BREAK else WeatherRegime.ACTIVE
                row_cells.append(reg)
            grid_cells.append(row_cells)

        return {
            "cycle_time": cycle_time.isoformat(),
            "lead_time": lead_time,
            "scenario": regime_scenario.value,
            "synoptic_state": synoptic_state,
            "district_data": district_raw_obs,
            "grid_raster": [[reg.value for reg in row] for row in grid_cells],
        }
