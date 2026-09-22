"""
Active Learning and Forecaster-in-the-Loop Logging.
Enables operational meteorologists to review, accept, or override AI regime calls.
Overrides are logged to an auditable queue to drive priority active-learning retraining.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
from src.config import (
    ACTIVE_LEARNING_LOG_PATH,
    RETRAINING_QUEUE_PATH,
    WeatherRegime,
)


class ActiveLearningManager:
    """
    Manages forecaster overrides, active learning logging, and retraining queues.
    """

    def __init__(self):
        self.log_path = ACTIVE_LEARNING_LOG_PATH
        self.queue_path = RETRAINING_QUEUE_PATH

    def record_override(
        self,
        district_id: str,
        district_name: str,
        cycle_time: str,
        original_regime: str,
        overridden_regime: str,
        forecaster_id: str,
        justification: str,
        synoptic_features: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Logs a forecaster override and adds the sample to the retraining queue.
        """
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "forecaster_id": forecaster_id,
            "district_id": district_id,
            "district_name": district_name,
            "cycle_time": cycle_time,
            "original_regime": original_regime,
            "overridden_regime": overridden_regime,
            "justification": justification,
            "synoptic_features": synoptic_features or {},
            "status": "pending_retraining",
        }

        # Append to jsonl log file
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

        with open(self.queue_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

        return {
            "success": True,
            "message": f"Override logged successfully for {district_name}. Added to active-learning queue.",
            "record": record,
        }

    def get_recent_overrides(self, limit: int = 15) -> List[Dict[str, Any]]:
        """Returns the most recent forecaster override records."""
        if not self.log_path.exists():
            return []

        records = []
        try:
            with open(self.log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        records.append(json.loads(line))
        except Exception:
            return []

        # Return latest first
        return records[::-1][:limit]

    def get_queue_statistics(self) -> Dict[str, Any]:
        """Returns summary statistics of the active learning queue."""
        records = self.get_recent_overrides(limit=1000)
        total_overrides = len(records)
        
        regime_counts = {}
        for r in records:
            to_reg = r.get("overridden_regime", "Unknown")
            regime_counts[to_reg] = regime_counts.get(to_reg, 0) + 1

        return {
            "total_overrides": total_overrides,
            "pending_samples": total_overrides,
            "overridden_to_distribution": regime_counts,
            "last_override_time": records[0]["timestamp"] if records else None,
        }
