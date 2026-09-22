"""
Mesoscale and Terrain Feature Extraction (Tier B Flags & Orographic Conditioning).
Computes topographic slope, aspect, upslope windward forcing, and coastal proximity
from SRTM DEM and low-level wind fields.
"""

import math
from typing import Dict, Any, Tuple
import numpy as np


class TerrainFeatureExtractor:
    """
    Computes topographic and coastal features for grid points or district centers.
    Determines orographic enhancement potential and leeward rain-shadow effects.
    """

    def __init__(self):
        pass

    def compute_orographic_forcing(
        self,
        elevation_gradient: float,  # dimensionless slope (dz/dx)
        aspect_deg: float,          # slope facing direction (0 = North, 90 = East, 180 = South, 270 = West)
        wind_speed_850: float,      # m/s
        wind_direction_850_deg: float, # meteorological wind direction (direction wind is blowing FROM)
    ) -> Dict[str, float]:
        """
        Calculates the kinematic upslope velocity component:
        w_oro = V_850 * sin(theta_wind - theta_aspect) * slope
        """
        # In meteorology, wind direction is the direction the wind is blowing FROM.
        # A slope aspect is the direction the slope faces (outward).
        # When wind is blowing FROM 270° (Westerly) against a slope facing 270° (West-facing),
        # the wind hits the slope perpendicularly, causing maximum upslope ascent.
        angle_diff_rad = math.radians(wind_direction_850_deg - aspect_deg)
        
        # Cosine of angle difference gives the direct perpendicular projection onto the slope
        upslope_projection = math.cos(angle_diff_rad)
        
        # Effective kinematic vertical velocity (m/s)
        kinematic_ascent = wind_speed_850 * elevation_gradient * max(0.0, upslope_projection)
        
        # Leeward rain shadow factor (negative projection indicates wind blowing downslope)
        is_leeward = upslope_projection < -0.2
        rain_shadow_factor = abs(upslope_projection) if is_leeward else 0.0

        return {
            "upslope_projection": float(upslope_projection),
            "kinematic_ascent_ms": float(kinematic_ascent),
            "is_windward": bool(upslope_projection > 0.3),
            "is_leeward": bool(is_leeward),
            "rain_shadow_factor": float(rain_shadow_factor),
        }

    def compute_elevation_lapse_correction(
        self,
        base_rainfall_mm: float,
        mean_elevation_m: float,
        is_windward: bool,
    ) -> float:
        """
        Applies a terrain-aware elevation adjustment.
        In the Western Ghats, rainfall increases with elevation on the windward side
        up to ~1200-1400m crest level (lapse rate ~0.08 to 0.12 mm/m for heavy events),
        whereas leeward plateau stations experience strong precipitation drying.
        """
        if is_windward and mean_elevation_m > 300.0:
            # Elevation enhancement up to crest level (1400m)
            effective_elevation = min(mean_elevation_m, 1400.0)
            enhancement_factor = 1.0 + (effective_elevation - 300.0) / 1500.0 * 0.45
            return base_rainfall_mm * enhancement_factor
        elif not is_windward and mean_elevation_m > 400.0:
            # Leeward rain shadow reduction
            reduction_factor = max(0.65, 1.0 - (mean_elevation_m / 2000.0) * 0.35)
            return base_rainfall_mm * reduction_factor
        return base_rainfall_mm
