---
phase: 04-gnn-cascade-failure-prediction
plan: 02
subsystem: api
tags: [fastapi, websocket, asyncio, gnn, cascade-prediction, rest-endpoint]

# Dependency graph
requires:
  - phase: 04-gnn-cascade-failure-prediction
    provides: "predict_cascade() GCN inference function from gnn_inference.py with cascade_chain + rerouting_path + rerouting_summary contract"
  - phase: 03-xgboost-anomaly-detection
    provides: "NODE_STATES.is_anomalous flags from XGBoost _inference_loop — feeds anomalous_ids to _cascade_loop"
provides:
  - "_cascade_loop background asyncio task: runs predict_cascade() every 5s when anomalies present, stores in LAST_CASCADE"
  - "LAST_CASCADE module-level dict: pre-computed cascade result read by REST endpoint without blocking"
  - "GET /api/cascade: REST endpoint returning cascade_chain + rerouting_path + rerouting_summary"
  - "WebSocket payload extended with cascade_risk float per node (0.0 if not in cascade chain)"
affects: [04-03-frontend-visualization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third asyncio background task pattern: _cascade_loop alongside _broadcast_loop and _inference_loop — all three started in lifespan"
    - "Module-level mutable dict (LAST_CASCADE) as shared state between background task writer and REST endpoint reader — avoids blocking on GNN inference"
    - "Deferred import inside loop body: predict_cascade imported inside _cascade_loop to eliminate circular import risk at module load"
    - "Exception guard wrapping entire loop body: never crash the cascade loop, print and preserve last known good LAST_CASCADE"
    - "No-op optimization: cascade loop skips GNN call entirely when no anomalies present — checks is_anomalous before calling predict_cascade"

key-files:
  created: []
  modified:
    - backend/routers/ws.py
    - backend/main.py

key-decisions:
  - "LAST_CASCADE module-level dict pattern: pre-compute in background, read synchronously in REST endpoint — avoids blocking FastAPI event loop on GNN inference"
  - "Deferred import of predict_cascade inside _cascade_loop body: consistent with _inference_loop pattern, eliminates circular import risk"
  - "cascade_risk=0.0 default in WebSocket payload: frontend can always read cascade_risk without null checks — 0.0 means not in cascade chain"

patterns-established:
  - "Background task writer / REST endpoint reader: LAST_CASCADE updated by async loop, read synchronously by GET endpoint — no locks needed for demo scale"
  - "No-op on idle state: cascade loop returns empty dict immediately when no anomalies, never wastes GNN inference compute on normal grid state"

requirements-completed: [ML-02, ML-03, ML-04]

# Metrics
duration: 1min
completed: 2026-02-25
---

# Phase 04 Plan 02: GNN Cascade Prediction API Integration Summary

**_cascade_loop background task wired into FastAPI lifespan: runs predict_cascade() every 5s when anomalies present, exposes GET /api/cascade REST endpoint, and injects cascade_risk float into every WebSocket node payload**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-26T01:31:37Z
- **Completed:** 2026-02-26T01:32:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added LAST_CASCADE module-level dict as shared state between _cascade_loop writer and /api/cascade reader
- Added _cascade_loop(): 5-second asyncio loop that calls predict_cascade() only when anomalies are present; no-ops on idle state
- Added GET /api/cascade endpoint returning LAST_CASCADE as JSONResponse
- Extended _broadcast_loop WebSocket payload to include cascade_risk per node (0.0 when node not in cascade chain)
- Registered _cascade_loop as third asyncio.create_task() in FastAPI lifespan alongside _broadcast_loop and _inference_loop

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cascade inference loop and /api/cascade endpoint to ws.py** - `e044604` (feat)
2. **Task 2: Register _cascade_loop in FastAPI lifespan and verify server starts** - `6758acf` (feat)

## Files Created/Modified
- `backend/routers/ws.py` - Added LAST_CASCADE dict, _cascade_loop(), GET /api/cascade endpoint, cascade_risk in broadcast payload
- `backend/main.py` - Added _cascade_loop import and asyncio.create_task(_cascade_loop()) in lifespan

## Decisions Made
- **LAST_CASCADE module-level dict:** Pre-compute in _cascade_loop background task, read synchronously in GET /api/cascade — no blocking of the FastAPI event loop during GNN inference, no locks needed at demo scale.
- **Deferred import of predict_cascade inside loop body:** Consistent with _inference_loop's deferred import of predict_anomalies — eliminates circular import risk at module load time.
- **cascade_risk=0.0 default:** Frontend always receives a numeric value for cascade_risk; 0.0 means "not in cascade chain" — removes null check requirement in map overlay rendering.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GET /api/cascade endpoint is live and returns the correct shape: `{"cascade_chain": [...], "rerouting_path": [...], "rerouting_summary": "..."}`
- WebSocket payload includes cascade_risk per node — frontend Plan 03 can read it directly from the existing WebSocket connection
- No blockers for 04-03 frontend visualization

---
*Phase: 04-gnn-cascade-failure-prediction*
*Completed: 2026-02-25*
