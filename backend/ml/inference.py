"""
AegisFlow XGBoost inference module.

Loads the trained model once at import time.
Maintains a per-node rolling buffer of the last 5 (voltage, frequency, load) readings.
Exposes predict_anomalies(node_states) for use by the inference loop.
"""

from collections import deque
from pathlib import Path

import numpy as np
import xgboost as xgb

# Load model once at module import using Booster to avoid sklearn wrapper issues
_MODEL = xgb.Booster()
_MODEL.load_model(str(Path(__file__).parent / "model.json"))

# Per-node rolling buffer: last 5 (voltage, frequency, load) tuples
_ROLLING: dict[str, deque] = {}

# Feature order must match train.py exactly
_FEATURE_NAMES = [
    "voltage", "frequency", "load",
    "voltage_mean", "voltage_std",
    "frequency_mean", "frequency_std",
    "load_mean", "load_std",
]


def predict_anomalies(node_states: dict) -> dict[str, tuple[float, bool]]:
    """
    Compute per-node anomaly predictions from current NODE_STATES.

    For each node:
      - Appends (voltage, frequency, load) to a maxlen=5 rolling deque.
      - During warm-up (< 5 readings): returns score=0.0, is_anomalous=False.
      - After warm-up: builds a 9-feature row using the rolling window stats
        and calls _MODEL.predict() via xgb.DMatrix (Booster API).

    Returns:
        dict mapping node_id -> (anomaly_score: float, is_anomalous: bool)
        where anomaly_score is the positive-class probability in [0.0, 1.0].
    """
    results: dict[str, tuple[float, bool]] = {}

    for node_id, node in node_states.items():
        if node_id not in _ROLLING:
            _ROLLING[node_id] = deque(maxlen=5)

        buf = _ROLLING[node_id]
        buf.append((node.voltage, node.frequency, node.load))

        if len(buf) < 5:
            results[node_id] = (0.0, False)
            continue

        readings = list(buf)  # list of 5 (v, f, l) tuples
        voltages = [r[0] for r in readings]
        frequencies = [r[1] for r in readings]
        loads = [r[2] for r in readings]

        # Most recent values
        voltage = node.voltage
        frequency = node.frequency
        load = node.load

        feature_row = np.array([[
            voltage,
            frequency,
            load,
            float(np.mean(voltages)),
            float(np.std(voltages)),
            float(np.mean(frequencies)),
            float(np.std(frequencies)),
            float(np.mean(loads)),
            float(np.std(loads)),
        ]], dtype=np.float32)

        # Booster.predict() returns positive-class probability directly
        dmat = xgb.DMatrix(feature_row, feature_names=_FEATURE_NAMES)
        score = float(_MODEL.predict(dmat)[0])
        is_anomalous = score > 0.5

        results[node_id] = (score, is_anomalous)

    return results
