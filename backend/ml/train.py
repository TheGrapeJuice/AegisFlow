"""
Offline training script for the AegisFlow XGBoost anomaly detection model.

Generates 5000 synthetic samples matching the NODE_STATES sensor ranges,
trains a binary XGBClassifier, and saves the model to backend/ml/model.json.

Features (9 total, order matters for inference):
  voltage, frequency, load,
  voltage_mean, voltage_std,
  frequency_mean, frequency_std,
  load_mean, load_std

Label: is_anomalous = 1 if load > 94.0 or abs(frequency - 60.0) > 0.8 else 0
(~15% positive class — critical deviations, not warnings)
"""

import random
import numpy as np
import xgboost as xgb
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

RANDOM_SEED = 42
N_SAMPLES = 5000
WINDOW = 5

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


def _generate_sample():
    """
    Generate a single synthetic node-sensor sample with rolling statistics.

    Voltage ranges by node type:
      generator: ~345 kV, substation: ~138 kV, transformer: ~69 kV, junction: ~34 kV
    We sample uniformly from these nominal values with +/-5% variance.
    Frequency: 59.0 – 61.0 Hz (realistic grid range)
    Load: 0 – 100 %
    """
    # Pick a random nominal voltage level
    nominal_v = random.choice([345.0, 138.0, 69.0, 34.0])
    voltage_base = nominal_v * random.uniform(0.95, 1.05)
    frequency_base = random.uniform(59.0, 61.0)
    load_base = random.uniform(0.0, 100.0)

    # Simulate a rolling window with slight autocorrelation
    voltages = [voltage_base + random.uniform(-0.5, 0.5) for _ in range(WINDOW)]
    frequencies = [
        max(59.0, min(61.0, frequency_base + random.uniform(-0.05, 0.05)))
        for _ in range(WINDOW)
    ]
    loads = [
        max(0.0, min(100.0, load_base + random.uniform(-2.0, 2.0)))
        for _ in range(WINDOW)
    ]

    voltage = voltages[-1]
    frequency = frequencies[-1]
    load = loads[-1]

    voltage_mean = float(np.mean(voltages))
    voltage_std = float(np.std(voltages))
    frequency_mean = float(np.mean(frequencies))
    frequency_std = float(np.std(frequencies))
    load_mean = float(np.mean(loads))
    load_std = float(np.std(loads))

    # Label: wider threshold gives ~15% positive class for meaningful model signal
    is_anomalous = 1 if load > 94.0 or abs(frequency - 60.0) > 0.8 else 0

    features = [
        voltage, frequency, load,
        voltage_mean, voltage_std,
        frequency_mean, frequency_std,
        load_mean, load_std,
    ]
    return features, is_anomalous


def main():
    print(f"Generating {N_SAMPLES} synthetic samples...")
    data = [_generate_sample() for _ in range(N_SAMPLES)]
    X = np.array([d[0] for d in data], dtype=np.float32)
    y = np.array([d[1] for d in data], dtype=np.int32)

    pos = int(y.sum())
    print(f"Class balance — positive (anomalous): {pos}/{N_SAMPLES} ({100*pos/N_SAMPLES:.1f}%)")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    clf = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=RANDOM_SEED,
    )
    print("Training XGBClassifier...")
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Test accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["normal", "anomalous"]))

    model_path = Path(__file__).parent / "model.json"
    clf.save_model(str(model_path))
    print(f"Model saved to {model_path}")


if __name__ == "__main__":
    main()
