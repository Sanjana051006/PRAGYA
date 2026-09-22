"""
Synoptic Feature Extraction for Monsoon Regime Classification (Tier A).
Derives physical meteorological indices from 2D/3D atmospheric fields:
- Monsoon Trough 850 hPa Relative Vorticity
- Low-Level Jet (Findlater Jet) Speed at 850 hPa
- Vertical Zonal Wind Shear (850 hPa - 200 hPa)
- Trough MSLP Deficit / Anomaly
- Outgoing Longwave Radiation (OLR) Convective Proxy
- Cyclical Day-of-Monsoon Temporal Encoding
"""

import math
from typing import Dict, Any
import numpy as np


class SynopticFeatureExtractor:
    """
    Extracts synoptic-scale index vectors for monsoon regime identification.
    Operates on domain-averaged or box-averaged reanalysis/NWP fields.
    """

    def __init__(self):
        # Climatological baseline values for normalization
        self.clim_mslp_trough = 1004.0  # hPa (normal monsoon trough SLP)
        self.clim_llj_speed = 22.0      # knots (normal Arabian Sea LLJ speed)
        self.clim_vorticity_850 = 1.8e-5 # s^-1 (normal trough vorticity)

    def extract_from_raw_values(
        self,
        vorticity_850: float,      # s^-1 (e.g. 1.5e-5 to 6.0e-5)
        llj_speed_knots: float,    # knots (e.g. 10.0 to 45.0)
        u_850_ms: float,           # m/s (low-level zonal wind)
        u_200_ms: float,           # m/s (upper-level zonal wind, typically negative / easterly)
        mslp_trough_hpa: float,    # hPa
        olr_wm2: float,            # W/m^2 (convective proxy)
        day_of_monsoon: int,       # 1 to 122 (June 1 = 1, Sept 30 = 122)
    ) -> Dict[str, float]:
        """
        Calculates normalized synoptic features and physically grounded indices.
        """
        # 1. Trough Vorticity Index (scaled by 1e-5)
        vort_index = vorticity_850 * 1e5

        # 2. Findlater Low-Level Jet Anomaly (knots relative to climatology)
        llj_anomaly = llj_speed_knots - self.clim_llj_speed

        # 3. Vertical Zonal Wind Shear (u850 - u200)
        # Note: In mature JJAS, u850 is westerly (+), u200 is easterly (-),
        # so vertical shear (u850 - u200) is strongly positive (> 25-35 m/s).
        vertical_shear = u_850_ms - u_200_ms

        # 4. Trough MSLP Deficit (negative means lower pressure = stronger depression/trough)
        mslp_deficit = mslp_trough_hpa - self.clim_mslp_trough

        # 5. Convective Activity Index from OLR
        # OLR < 200 indicates deep organized convection; OLR > 250 indicates clear skies.
        convective_index = max(0.0, (260.0 - olr_wm2) / 60.0)

        # 6. Cyclical Temporal Encoding (day 1..122 of JJAS)
        doy_fraction = (day_of_monsoon - 1) / 122.0
        doy_sin = math.sin(2.0 * math.pi * doy_fraction)
        doy_cos = math.cos(2.0 * math.pi * doy_fraction)

        # 7. Monsoon Seasonality Index (MSI)
        # Ratio of low-level kinetic energy to upper-level easterly strength
        msi = (llj_speed_knots * 0.514444) / (abs(u_200_ms) + 1e-3)

        return {
            "vort_850_scaled": float(vort_index),
            "llj_speed_knots": float(llj_speed_knots),
            "llj_anomaly": float(llj_anomaly),
            "vertical_shear_ms": float(vertical_shear),
            "mslp_deficit_hpa": float(mslp_deficit),
            "olr_wm2": float(olr_wm2),
            "convective_index": float(convective_index),
            "doy_sin": float(doy_sin),
            "doy_cos": float(doy_cos),
            "msi": float(msi),
        }

    def to_feature_vector(self, feature_dict: Dict[str, float]) -> np.ndarray:
        """Converts feature dictionary to standard 1D numpy array for ML inference."""
        keys = [
            "vort_850_scaled",
            "llj_speed_knots",
            "llj_anomaly",
            "vertical_shear_ms",
            "mslp_deficit_hpa",
            "olr_wm2",
            "convective_index",
            "doy_sin",
            "doy_cos",
            "msi",
        ]
        return np.array([feature_dict[k] for k in keys], dtype=np.float32)
