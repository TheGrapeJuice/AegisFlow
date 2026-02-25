---
phase: 03-xgboost-anomaly-detection
plan: 02
subsystem: api
tags: [xgboost, asyncio, fastapi, websocket, background-task, inference]

# Dependency graph
requires:
  - phase: 03-xgboost-anomaly-detection
    plan: 01
    provides: predict_anomalies(node_states) inference module, NodeState.anomaly_score and .is_anomalous fields, model.json artifact
provides:
  - _inference_loop() background asyncio task in backend/routers/ws.py — calls predict_anomalies every 5s, mutates NODE_STATES anomaly fields in-place
  - main.py lifespan starts both _broadcast_loop and _inference_loop via asyncio.create_task
  - WebSocket /ws/nodes payload now includes anomaly_score (float) and is_anomalous (bool) on every node message
affects:
  - 03-03 (frontend reads anomaly_score and is_anomalous from WebSocket payload to drive anomaly UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Deferred import inside async loop body (from backend.ml.inference import predict_anomalies inside _inference_loop) — prevents circular import at module load time
    - Exception-swallowing loop — never crash the inference background task, print and continue
    - Two independent asyncio background tasks from a single lifespan context manager — one at 1s cadence (broadcast), one at 5s cadence (inference)

key-files:
  created: []
  modified:
    - backend/routers/ws.py
    - backend/main.py

key-decisions:
  - "Deferred import of predict_anomalies inside _inference_loop body — eliminates circular import risk (ws.py imports from state.py; if inference.py were top-level imported in ws.py before models are ready it could fail at module load)"
  - "_inference_loop placed between _broadcast_loop and the storm endpoint in ws.py — follows existing module structure, broadcast loop unchanged"
  - "asyncio.create_task(_inference_loop()) added to lifespan alongside existing _broadcast_loop task — both tasks run concurrently without blocking each other"

patterns-established:
  - "5s inference cadence decoupled from 1s broadcast cadence — two independent asyncio.sleep() loops, no shared locks needed because Python GIL serializes the dict mutation"
  - "Exception guard in inference loop: catch-all except prints to console and continues — prevents inference failure from killing broadcast loop"

requirements-completed: [ML-01]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 3 Plan 02: Inference Loop Wiring Summary

**asyncio background inference loop calling XGBoost predict_anomalies every 5 seconds, mutating NODE_STATES in-place so WebSocket broadcasts automatically include anomaly_score and is_anomalous**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T18:55:44Z
- **Completed:** 2026-02-25T18:56:50Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- _inference_loop() added to backend/routers/ws.py — 5-second asyncio loop calling predict_anomalies(NODE_STATES) and writing (score, flag) back to each NodeState's anomaly_score and is_anomalous fields
- main.py lifespan now creates two concurrent background tasks: _broadcast_loop (1s) and _inference_loop (5s)
- Deferred import prevents circular import at module load time; exception guard ensures inference errors never crash the broadcast loop
- WebSocket /ws/nodes payload now includes anomaly_score and is_anomalous for all 24 nodes without any changes to the broadcast loop or serialization code

## Task Commits

Each task was committed atomically:

1. **Task 1: Add _inference_loop to ws.py and start it in main.py lifespan** - `6a5ff0a` (feat)

**Plan metadata:** `2c9b358` (docs: complete plan)

## Files Created/Modified
- `backend/routers/ws.py` - Added _inference_loop() async function between _broadcast_loop and storm endpoint
- `backend/main.py` - Updated lifespan to import and create_task _inference_loop alongside _broadcast_loop

## Decisions Made
- Deferred import of predict_anomalies inside the function body (not at module top) to avoid circular import at ws.py load time
- Exception-swallowing pattern in loop body ensures inference failures never kill the broadcast loop
- No changes to _broadcast_loop or the WebSocket endpoint — model_dump() already serializes all NodeState fields including the new anomaly fields

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WebSocket /ws/nodes payload now includes anomaly_score and is_anomalous — frontend Plan 03 can read these fields immediately
- After 5 seconds of server uptime, all 24 nodes will have live XGBoost anomaly scores flowing in WebSocket messages
- Rolling buffer warm-up (5 readings) still applies — first 5s returns (0.0, False) for all nodes, which is correct default behavior

## Self-Check: PASSED

- FOUND: backend/routers/ws.py
- FOUND: backend/main.py
- FOUND: .planning/phases/03-xgboost-anomaly-detection/03-02-SUMMARY.md
- FOUND: commit 6a5ff0a (feat: wire XGBoost inference loop into FastAPI lifespan)

---
*Phase: 03-xgboost-anomaly-detection*
*Completed: 2026-02-25*
