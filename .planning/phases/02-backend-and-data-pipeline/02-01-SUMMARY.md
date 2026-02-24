---
phase: 02-backend-and-data-pipeline
plan: 01
subsystem: backend
tags: [fastapi, websocket, pydantic, python, rest-api, in-memory-state]
dependency_graph:
  requires: []
  provides: [backend-api, topology-endpoint, websocket-broadcast, storm-injection, shared-node-state]
  affects: [frontend-data-layer]
tech_stack:
  added: [fastapi==0.115.5, uvicorn==0.32.1, pydantic==2.10.3, influxdb-client==1.47.0, python-dotenv==1.0.1]
  patterns: [lifespan-context-manager, shared-in-memory-state, pydantic-v2-models, asyncio-background-task]
key_files:
  created:
    - backend/main.py
    - backend/models.py
    - backend/state.py
    - backend/routers/topology.py
    - backend/routers/ws.py
    - backend/requirements.txt
    - backend/.env.example
    - backend/__init__.py
    - backend/routers/__init__.py
  modified: []
decisions:
  - "lifespan context manager over deprecated @router.on_event('startup') for FastAPI 0.115 compatibility"
  - "shared NODE_STATES dict keyed by node id for O(1) access by both broadcast loop and storm endpoint"
  - "storm injection picks a generator as epicenter and affects 4 random other nodes for dramatic visual effect"
metrics:
  duration: 3min
  completed_date: 2026-02-24
  tasks_completed: 2
  files_created: 9
---

# Phase 2 Plan 1: FastAPI Backend — REST, WebSocket, Storm Injection

**One-liner:** FastAPI backend with GET /api/topology (24 nodes), WebSocket /ws/nodes (1-second broadcasts), and POST /api/storm (fault injection into shared in-memory state).

## What Was Built

A complete Python backend for AegisFlow in `backend/`:

- **backend/main.py** — FastAPI app with CORS (localhost:5173), lifespan-based broadcast task startup, and router registration
- **backend/models.py** — Pydantic v2 models: `NodeState` (id, name, type, status, lng, lat, voltage, frequency, load) and `TopologyResponse` (nodes + edges)
- **backend/state.py** — Shared in-memory `NODE_STATES` dict seeded with all 24 Chicago-area grid nodes (matching `src/data/topology.ts`), 39 edges, and `simulate_sensor_tick()` applying per-second noise
- **backend/routers/topology.py** — `GET /api/topology` returns current snapshot of all 24 nodes
- **backend/routers/ws.py** — `WebSocket /ws/nodes` broadcasts a 24-node JSON array every second; `POST /api/storm` picks a generator epicenter, sets it critical, and cascades to 4 more nodes

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FastAPI scaffold with models and topology endpoint | fd8679e | backend/main.py, backend/models.py, backend/routers/topology.py, backend/requirements.txt, backend/.env.example |
| 2 | Shared node state, WebSocket broadcast loop, and storm injection | bc0802c | backend/state.py, backend/routers/ws.py |

## Verification Results

- `len(NODE_STATES) == 24` — PASSED
- `len(EDGES) == 39` — PASSED
- All 9 node fields present (id, name, type, status, lng, lat, voltage, frequency, load) — PASSED
- `simulate_sensor_tick()` mutates in-place with values in range — PASSED
- `inject_storm` is async — PASSED
- `npm run build` exits 0 (backend files do not affect frontend build) — PASSED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] state.py and ws.py created during plan 02-02 execution**
- **Found during:** Plan 02-02 execution (topology router needed state.py; ws.py was blocking)
- **Issue:** Task 2 of plan 02-01 had not been executed when plan 02-02 started; ws.py and state.py were missing, blocking the import chain
- **Fix:** Created backend/state.py (24-node topology + simulate_sensor_tick) and backend/routers/ws.py (broadcast loop + storm endpoint) as Rule 3 auto-fix during plan 02-02 execution
- **Files modified:** backend/state.py, backend/routers/ws.py
- **Commit:** bc0802c (noted as Rule 3 in commit message)

**2. [Rule 2 - Missing Critical] lifespan used instead of deprecated on_event**
- **Found during:** Task 1
- **Issue:** Plan noted `@router.on_event("startup")` is deprecated in FastAPI 0.115 and suggested using lifespan
- **Fix:** Implemented lifespan context manager from the start in main.py; broadcast loop imported lazily inside lifespan to avoid circular import issues
- **Files modified:** backend/main.py
- **Commit:** fd8679e

## Self-Check: PASSED

- backend/main.py exists: FOUND
- backend/models.py exists: FOUND
- backend/state.py exists: FOUND
- backend/routers/topology.py exists: FOUND
- backend/routers/ws.py exists: FOUND
- Commit fd8679e exists: FOUND
- Commit bc0802c exists: FOUND
