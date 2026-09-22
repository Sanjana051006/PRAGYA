"""
Time-blocked data splitting module.
Ensures splits preserve meteorological temporal dependencies (avoiding random leakage across consecutive forecast cycles).
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple
import pandas as pd
import numpy as np

from src.config import BASE_DIR, DATA_DIR


def generate_time_blocked_splits(
    df: pd.DataFrame,
    year_col: str = "forecast_year",
    train_years: List[int] = None,
    val_years: List[int] = None,
    test_years: List[int] = None,
    output_path: Path = None,
) -> Dict[str, List[int]]:
    """
    Partitions dataset by forecast year blocks.
    Default split:
    - Train: 2010 - 2020
    - Validation: 2021 - 2023
    - Test: 2024 - 2025
    """
    if train_years is None:
        train_years = list(range(2010, 2021))
    if val_years is None:
        val_years = list(range(2021, 2024))
    if test_years is None:
        test_years = [2024, 2025]

    if year_col in df.columns:
        train_idx = df[df[year_col].isin(train_years)].index.tolist()
        val_idx = df[df[year_col].isin(val_years)].index.tolist()
        test_idx = df[df[year_col].isin(test_years)].index.tolist()
    else:
        # Fallback to deterministic sequential block split
        n = len(df)
        n_train = int(n * 0.70)
        n_val = int(n * 0.15)
        indices = list(range(n))
        train_idx = indices[:n_train]
        val_idx = indices[n_train:n_train + n_val]
        test_idx = indices[n_train + n_val:]

    split_dict = {
        "train_indices": train_idx,
        "val_indices": val_idx,
        "test_indices": test_idx,
        "summary": {
            "train_count": len(train_idx),
            "val_count": len(val_idx),
            "test_count": len(test_idx),
            "total_count": len(df),
        }
    }

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump({
                "summary": split_dict["summary"],
                "train_count": len(train_idx),
                "val_count": len(val_idx),
                "test_count": len(test_idx),
            }, f, indent=2)

    return split_dict
