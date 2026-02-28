# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A live, visually compelling dashboard that makes AI-powered grid intelligence feel real — the kind of demo that gets paused during an interview so the interviewer can ask how it works.
**Current focus:** Phase 3 — XGBoost Anomaly Detection

## Current Position

**Phase:** 3 of 7 (XGBoost Anomaly Detection)
**Current Plan:** Not started
**Total Plans in Phase:** 4
**Status:** Milestone complete
**Last Activity:** 2026-02-25
Last activity: 2026-02-25 — Completed 03-01 (XGBoost ML backend: train.py, inference.py, model.json, NodeState extension)

**Progress:** [█████████░] 89%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 7 min
- Total execution time: 0.33 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-frontend-shell | 3/4 | 20min | 7min |

**Recent Trend:**
- Last 5 plans: 01-01 (15min), 01-02 (3min), 01-03 (2min)
- Trend: improving

*Updated after each plan completion*
| Phase 01-frontend-shell P04 | 1min | 1 tasks | 0 files |
| Phase 02-backend-and-data-pipeline P01 | 3min | 2 tasks | 9 files |
| Phase 02-backend-and-data-pipeline P02 | 2min | 2 tasks | 5 files |
| Phase 02-backend-and-data-pipeline P03 | 7min | 2 tasks | 7 files |
| Phase 02-backend-and-data-pipeline P04 | 1min | 2 tasks | 2 files |
| Phase 02-backend-and-data-pipeline P05 | 1min | 2 tasks | 4 files |
| Phase 03-xgboost-anomaly-detection PP01 | 7min | 2 tasks | 6 files |
| Phase 03-xgboost-anomaly-detection P02 | 2min | 1 tasks | 2 files |
| Phase 03-xgboost-anomaly-detection P03 | 2min | 2 tasks | 3 files |
| Phase 03-xgboost-anomaly-detection P04 | 5min | 2 tasks | 0 files |
| Phase 04-gnn-cascade-failure-prediction P01 | 13min | 3 tasks | 4 files |
| Phase 04-gnn-cascade-failure-prediction P02 | 1 | 2 tasks | 2 files |
| Phase 04-gnn-cascade-failure-prediction P03 | 3min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Use MapLibre GL JS (not Mapbox) — eliminates billing risk on a public portfolio URL; API-compatible drop-in replacement
- [Init]: XGBoost before GNN — proves the full pipeline end-to-end with a fast interpretable model before adding GNN complexity
- [Init]: FL via file checkpoint handoff — decoupled from real-time path; inference loop reloads weights on 60-second interval
- [01-01]: Tailwind v3 over v4 — v4 has different config API and limited ecosystem support as of early 2026
- [01-01]: tailwind.config.js (not .ts) — Tailwind v3 init generates .js by default; functionally equivalent
- [01-01]: Named exports for all layout components — enables selective imports and easier testing
- [01-01]: lucide-react for icons — consistent icon set, tree-shakeable, sizes cleanly with Tailwind
- [01-02]: Direct MapLibre API (not react-map-gl) — avoids wrapper complexity for D3 overlay integration in Plan 03
- [01-02]: maplibre-gl@4.7.1 ships own types — @types/maplibre-gl not needed, would cause conflicts
- [01-02]: CARTO Dark Matter basemap — free, no API key, visually correct dark style for ops dashboard
- [01-03]: map.project() anti-drift: recalculate SVG positions from world coordinates on every map move/zoom/resize event
- [01-03]: D3 SVG as decorative layer only (pointer-events: none) — MapLibre circle layer handles all click events
- [01-03]: null narrowing via const m = map: required by TypeScript strict mode for closures inside useEffect
- [Phase 01-frontend-shell]: Phase 1 approved on first submission: all 5 visual criteria confirmed without requiring any fixes
- [Phase 02-backend-and-data-pipeline]: lifespan context manager over deprecated on_event for FastAPI 0.115 compatibility
- [Phase 02-backend-and-data-pipeline]: shared NODE_STATES dict keyed by node id for O(1) access by broadcast loop and storm endpoint
- [Phase 02-02]: InfluxDB OSS 2.7.x confirmed safe fallback (3.x not GA as of 2026)
- [Phase 02-02]: Generator runs as separate process — WebSocket 1s loop and InfluxDB 5s writes on independent schedules
- [Phase 02-02]: SYNCHRONOUS InfluxDB write API — simpler than async batching for demo scale
- [Phase 02-02]: Flux pivot query — consolidates voltage/frequency/load fields into one result row per timestamp
- [Phase 02-backend-and-data-pipeline]: mapLoaded boolean guard prevents setData() calls before GeoJSON sources exist in MapLibre
- [Phase 02-backend-and-data-pipeline]: D3Overlay updated to accept nodes as prop — removes last GRID_TOPOLOGY reference from components tree
- [Phase 02-backend-and-data-pipeline]: VITE_API_BASE / VITE_WS_BASE env vars with localhost fallbacks allow prod override without hardcoding
- [Phase 02-backend-and-data-pipeline]: handleStormEvent in DashboardLayout keeps fetch logic colocated with other API calls and Sidebar remains pure UI
- [Phase 02-backend-and-data-pipeline]: GridMap live setData useEffect complete from Plan 03 — no GridMap changes needed in Plan 04
- [Phase 02-backend-and-data-pipeline]: NodeChartsWrapper inner component in StatusPanel — React hooks rules require hook calls at component top level; inner component pattern avoids conditional hook calls
- [Phase 02-backend-and-data-pipeline]: latestReading derived via useMemo from liveSelectedNode in DashboardLayout — keeps useNodeHistory hook pure (no direct WebSocket access) while enabling real-time chart extension
- [Phase 02-backend-and-data-pipeline]: Phase 2 approved on first submission — all 5 success criteria confirmed without requiring any fixes
- [Phase 02-ui-refresh]: accent borders use border-l-{color}-500 (directional) not border-{color}-500 — prevents color bleeding to all 4 sides
- [Phase 02-ui-refresh]: hour12: false required in toLocaleTimeString for guaranteed 24-hour format on US-locale machines
- [Phase 03-01]: xgb.Booster for model loading instead of XGBClassifier — avoids sklearn 1.6.1 tag API incompatibility with XGBoost 2.1.3
- [Phase 03-01]: ML model artifact (model.json) committed to repo — eliminates runtime training step, instant cold start for inference
- [Phase 03-01]: 9-feature schema with rolling stats over window=5 — captures both instantaneous readings and trend context for anomaly detection
- [Phase 03-xgboost-anomaly-detection]: Deferred import of predict_anomalies inside _inference_loop body eliminates circular import risk at module load time
- [Phase 03-xgboost-anomaly-detection]: Two asyncio background tasks from one lifespan: _broadcast_loop at 1s and _inference_loop at 5s run concurrently without blocking each other
- [Phase 03-xgboost-anomaly-detection]: Exception guard in _inference_loop catch-all: never crash the inference loop, print and continue — broadcast loop unaffected by inference failures
- [Phase 03-03]: AnomalyPanel placed as fixed overlay sibling inside flex container — does not affect flex layout
- [Phase 03-03]: dismissedNodeIds Set cleared on storm reset to enable re-alert after second storm
- [Phase 03-04]: Phase 3 approved on first submission — all 4 success criteria confirmed without requiring any fixes
- [Phase 04-01]: torch==2.6.0 over 2.2.2: Python 3.13 incompatible with torch 2.2.2 — oldest available CPU build is 2.6.0
- [Phase 04-01]: Module-level eager model load at import: avoids first-call latency in 5s inference loop; matches xgboost singleton pattern
- [Phase 04-01]: predict_cascade data contract: cascade_chain with confidence/time_to_cascade_min/hop_distance + rerouting_path + rerouting_summary
- [Phase 04-02]: LAST_CASCADE module-level dict pattern: pre-compute in background, read synchronously in REST endpoint — avoids blocking FastAPI event loop on GNN inference
- [Phase 04-02]: cascade_risk=0.0 default in WebSocket payload: frontend can always read cascade_risk without null checks — 0.0 means not in cascade chain
- [Phase 04-03]: Separate cascadeTimer from glow timer — prevents cascade animation interference with existing glow animation
- [Phase 04-03]: 1500ms rerouting reveal delay via setTimeout in useEffect cleanup pattern — cascade pulse plays first, then blue path appears
- [Phase 04-03]: cascade-layer inserted between label-layer and storm-layer in D3 SVG stacking order

### Pending Todos

None.

### Blockers/Concerns

- [Pre-build]: Verify PyTorch / PyG / CUDA version compatibility matrix before any Python environment creation (single highest-risk step)
- [Pre-build]: Verify InfluxDB 3.x OSS GA status — safe fallback is OSS 2.7.x
- [Pre-build]: Verify deck.gl 9.x + MapLibre 4.x peer dependencies before installing (deck.gl 9.x blocker now less relevant — plan uses D3 SVG overlay, not deck.gl)
- [Phase 4]: GNN architecture selection (GraphSAGE vs GATConv) benefits from a research-phase during planning
- [Phase 5]: Flower 1.x ClientApp/ServerApp API is a major redesign from 0.x — benefits from a research-phase during planning

## Session Continuity

**Last session:** 2026-02-28T20:40:53.952Z
**Stopped At:** Completed 04-03-PLAN.md
**Resume File:** None
