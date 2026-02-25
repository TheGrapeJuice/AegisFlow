---
phase: 03-xgboost-anomaly-detection
plan: 01
subsystem: ml
tags: [xgboost, numpy, scikit-learn, inference, anomaly-detection, pydantic]

# Dependency graph
requires:
  - phase: 02-backend-and-data-pipeline
    provides: NODE_STATES dict, NodeState Pydantic model, simulate_sensor_tick() sensor simulator
provides:
  - XGBoost binary classifier trained on synthetic grid sensor data (model.json)
  - backend/ml/inference.py — predict_anomalies(node_states) returning per-node (score, is_anomalous)
  - NodeState extended with anomaly_score (float) and is_anomalous (bool) fields
  - backend/ml/train.py — reproducible offline training script
affects:
  - 03-02 (inference loop reads predict_anomalies, writes results back to NodeState fields)
  - 03-03 (frontend reads anomaly_score and is_anomalous from WebSocket NodeState payloads)

# Tech tracking
tech-stack:
  added: [xgboost==2.1.3, numpy==2.2.2, scikit-learn==1.6.1]
  patterns:
    - xgb.Booster for model loading (avoids sklearn 1.6.1 wrapper compatibility issue with XGBoost 2.1.3)
    - Per-node rolling deque (maxlen=5) for streaming rolling statistics without storing full history
    - Module-level singleton model load (_MODEL) — loaded once at import, reused across all predict_anomalies calls

key-files:
  created:
    - backend/ml/__init__.py
    - backend/ml/train.py
    - backend/ml/inference.py
    - backend/ml/model.json
  modified:
    - backend/models.py
    - backend/requirements.txt

key-decisions:
  - "xgb.Booster for loading instead of XGBClassifier — XGBClassifier.load_model() triggers sklearn 1.6.1 tags API incompatibility; Booster loads cleanly and predict() returns positive-class probability directly"
  - "Label threshold: load > 94.0 or abs(frequency - 60.0) > 0.8 — produces ~24.7% positive class for meaningful model signal; stricter than simulate_sensor_tick warning thresholds to separate warning from anomaly"
  - "9-feature schema: voltage, frequency, load + 6 rolling stats (mean/std per field over window=5) — captures both instantaneous readings and trend context"
  - "Model artifact committed to repo (model.json, 86KB) — eliminates runtime training step; inference loop loads instantly"

patterns-established:
  - "ML module-level singleton: load model at import time, never reload per-request"
  - "Warm-up period: return (0.0, False) until rolling buffer has >= 5 readings — prevents NaN std with single sample"
  - "Booster.predict(DMatrix) with explicit feature_names — matches training feature order, prevents silent feature mismatch"

requirements-completed: [ML-01]

# Metrics
duration: 7min
completed: 2026-02-25
---

# Phase 3 Plan 01: XGBoost ML Backend Summary

**XGBoost binary anomaly classifier trained on 5000 synthetic grid samples (99.7% accuracy), with rolling-window inference module and NodeState model extension for anomaly_score/is_anomalous fields**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-25T18:48:24Z
- **Completed:** 2026-02-25T18:55:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Trained XGBoost binary classifier on 5000 synthetic samples matching NODE_STATES sensor ranges — 99.7% test accuracy, 24.7% positive class balance
- predict_anomalies(NODE_STATES) returns (anomaly_score, is_anomalous) for all 24 nodes; correctly identifies Pilsen Substation (load=98) and Kenwood Transformer (load=99) as anomalous
- NodeState extended with anomaly_score=0.0 and is_anomalous=False defaults — fully backward-compatible, existing serialization unchanged
- xgboost, numpy, scikit-learn added to requirements.txt for clean pip install

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ML deps and extend NodeState** - `9807c2e` (feat)
2. **Task 2: Create ml package, train model, inference module** - `c7c1def` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/ml/__init__.py` - Package marker
- `backend/ml/train.py` - Synthetic data generation, XGBClassifier training, model.json save
- `backend/ml/inference.py` - Booster model load at import, per-node rolling deque, predict_anomalies()
- `backend/ml/model.json` - Trained XGBoost artifact (86KB, committed to repo)
- `backend/models.py` - NodeState extended with anomaly_score and is_anomalous fields
- `backend/requirements.txt` - xgboost==2.1.3, numpy==2.2.2, scikit-learn==1.6.1 appended

## Decisions Made
- Used xgb.Booster for model loading instead of XGBClassifier to avoid sklearn 1.6.1 tag API incompatibility
- Label threshold set at load > 94.0 or abs(frequency - 60.0) > 0.8 for ~25% positive class (meaningful signal for training)
- 9 features: raw readings + 6 rolling stats over window=5 per node — captures trend alongside instantaneous values
- Model artifact committed to repo (not generated at server start) — instant cold start for inference loop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] XGBClassifier.load_model() fails due to sklearn 1.6.1 / XGBoost 2.1.3 incompatibility**
- **Found during:** Task 2 (inference module verification)
- **Issue:** `XGBClassifier().load_model()` internally calls `is_classifier()` from sklearn.base, which invokes `__sklearn_tags__()` — an API introduced in sklearn 1.6 that XGBoost 2.1.3's sklearn wrapper does not implement, raising `AttributeError: 'super' object has no attribute '__sklearn_tags__'`
- **Fix:** Changed inference.py to use `xgb.Booster` for model loading (`_MODEL = xgb.Booster(); _MODEL.load_model(...)`) and updated predict call to use `xgb.DMatrix` + `Booster.predict()` which returns positive-class probability directly
- **Files modified:** backend/ml/inference.py
- **Verification:** predict_anomalies(NODE_STATES) returns 24 results with scores in [0.0, 1.0], anomalous nodes match expected critical nodes from state.py
- **Committed in:** c7c1def (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for correctness — XGBClassifier sklearn wrapper is broken in this version pair. Booster API is actually the approach referenced in the plan's key_links section. No scope creep.

## Issues Encountered
- XGBoost 2.1.3 + scikit-learn 1.6.1 sklearn wrapper incompatibility on model load (resolved via Booster API)

## User Setup Required
None - no external service configuration required. xgboost, numpy, scikit-learn install via pip automatically.

## Next Phase Readiness
- inference.py ready for Plan 02 to wire into the background inference loop (predict_anomalies called every N seconds)
- NodeState fields (anomaly_score, is_anomalous) ready for Plan 02 to write and Plan 03 frontend to consume
- model.json committed — inference loop loads instantly, no training step at server start

---
*Phase: 03-xgboost-anomaly-detection*
*Completed: 2026-02-25*
