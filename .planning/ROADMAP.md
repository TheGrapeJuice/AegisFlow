# Roadmap: AegisFlow

## Overview

Build a live, visually compelling AI-powered smart grid dashboard from the outside in. Start with a static React shell to lock the visual design, wire in a real backend and WebSocket data pipeline, then layer ML complexity in dependency order: XGBoost anomaly detection first (proves the full pipeline), GNN cascade failure prediction second (the primary technical differentiator), and Flower federated learning last (architecturally decoupled, highest complexity). Deploy and record the demo video when everything is stable. Each phase produces a independently demonstrable artifact.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Frontend Shell** - Dark-themed dashboard with MapLibre map and D3 overlay, no backend required (completed 2026-02-24)
- [x] **Phase 2: Backend & Data Pipeline** - FastAPI + InfluxDB + WebSocket delivering live synthetic sensor data to the frontend (completed 2026-02-25)
- [x] **Phase 3: XGBoost Anomaly Detection** - ML pipeline end-to-end: InfluxDB → XGBoost inference → anomaly alerts in the UI (completed 2026-02-25)
- [ ] **Phase 4: GNN Cascade Failure Prediction** - GNN cascade chain visualization, rerouting overlay, and confidence scores
- [ ] **Phase 5: Federated Learning Simulation** - Flower FL simulation with 3 partitioned clients and live training progress panel
- [ ] **Phase 6: Deployment** - Frontend on Vercel, backend on Railway, cold-start mitigation active
- [ ] **Phase 7: Demo Assets** - Architecture README and 2-minute storm simulation demo video

## Phase Details

### Phase 1: Frontend Shell
**Goal**: The dashboard looks and feels real before any backend exists — visual design is validated on a static artifact
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Opening the app at 1280px+ shows a dark-themed dashboard with a sidebar, header, and status panel — no white/blank areas
  2. The MapLibre map renders a dark-styled city grid with hardcoded power nodes as dots and distribution lines connecting them
  3. The D3 overlay stays correctly positioned on top of the map when the user pans or zooms (no drift)
  4. Clicking any node opens a detail panel showing that node's name, type, and (hardcoded) sensor readings
  5. A visible legend explains node status colors (green = normal, yellow = warning, red = critical)
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Vite + React + TailwindCSS scaffold and dark layout shell (sidebar, header, status panel)
- [ ] 01-02-PLAN.md — MapLibre GL JS dark map with 24 hardcoded power nodes and distribution edge lines
- [ ] 01-03-PLAN.md — D3 SVG overlay (pan/zoom sync), node detail panel, and map legend
- [ ] 01-04-PLAN.md — Human verification of all Phase 1 success criteria

### Phase 2: Backend & Data Pipeline
**Goal**: The frontend reads live synthetic sensor data from a real backend over WebSocket — the static shell becomes a live display
**Depends on**: Phase 1
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Node topology loads from the FastAPI REST endpoint on page load; the map populates from real backend data, not hardcoded values
  2. Node status colors on the map update in real time via WebSocket without any page refresh or visible polling
  3. Selecting a node shows live voltage and frequency charts in the sidebar, updating as new readings arrive
  4. Clicking "Simulate Storm Event" injects a fault into the data stream and nodes near the fault visibly change state within a few seconds
  5. If the WebSocket connection drops, the frontend reconnects automatically with exponential backoff (no manual refresh needed)
**Plans**: 6 plans

Plans:
- [ ] 02-01-PLAN.md — FastAPI scaffold: topology REST endpoint, WebSocket broadcast loop, storm injection endpoint
- [ ] 02-02-PLAN.md — InfluxDB client + synthetic sensor data generator (5s write interval)
- [ ] 02-03-PLAN.md — Frontend REST fetch replacing hardcoded topology + WebSocket hook with exponential backoff
- [ ] 02-04-PLAN.md — Live map node color updates from WebSocket + Storm Event button wired to backend
- [ ] 02-05-PLAN.md — Voltage and frequency sparkline charts in sidebar using D3 v7
- [ ] 02-06-PLAN.md — Human verification of all 5 Phase 2 success criteria

### Phase 3: XGBoost Anomaly Detection
**Goal**: The dashboard detects and surfaces real ML-identified anomalies — the system moves from rule-based thresholds to an actual model
**Depends on**: Phase 2
**Requirements**: ML-01, UX-03
**Success Criteria** (what must be TRUE):
  1. After triggering a storm event, affected nodes are flagged by the XGBoost model (not a hardcoded rule) and their status color shifts to red
  2. The anomaly alert panel shows a timestamped list of XGBoost-detected anomalies with node identifiers
  3. Anomaly alerts can be individually dismissed from the panel
  4. The inference loop runs asynchronously and does not block WebSocket message delivery (no visible lag spike on storm trigger)
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — XGBoost training script, model artifact, inference module, NodeState model extension
- [ ] 03-02-PLAN.md — Wire inference background task into FastAPI lifespan; extend WebSocket payload
- [ ] 03-03-PLAN.md — Frontend: GridNode type extension, AnomalyPanel overlay, DashboardLayout alert wiring
- [ ] 03-04-PLAN.md — Human verification of all 4 Phase 3 success criteria

### Phase 4: GNN Cascade Failure Prediction
**Goal**: The dashboard predicts and visualizes how a fault propagates through the grid — the GNN turns anomaly detection into actionable foresight
**Depends on**: Phase 3
**Requirements**: ML-02, ML-03, ML-04, MAP-04, UX-04
**Success Criteria** (what must be TRUE):
  1. When XGBoost flags an anomaly, nodes in the predicted cascade chain highlight in sequence on the map with timing labels (e.g., "~4 min")
  2. Each at-risk node displays a confidence score (e.g., "87% cascade risk") rather than a binary flag
  3. A recommended rerouting path highlights in blue on the map overlay
  4. The cascade visualization only triggers on a state change, not on every WebSocket tick (no animation flicker)
**Plans**: 5 plans

Plans:
- [ ] 04-01-PLAN.md — PyTorch Geometric GCN training script, gnn_model.pt artifact, predict_cascade() inference module with Dijkstra rerouting
- [ ] 04-02-PLAN.md — Backend _cascade_loop background task, /api/cascade REST endpoint, cascade_risk in WebSocket payload
- [ ] 04-03-PLAN.md — Frontend cascade map visualization: amber D3 pulse animation, timing labels, confidence badges, blue rerouting MapLibre layer
- [ ] 04-04-PLAN.md — CascadePanel sidebar component, DashboardLayout cascade state wiring, 30s auto-fade
- [ ] 04-05-PLAN.md — Human verification of all 4 Phase 4 success criteria

### Phase 5: Federated Learning Simulation
**Goal**: Three geographically distinct simulated utility clients train a shared model, and the dashboard makes that training visible
**Depends on**: Phase 3
**Requirements**: FL-01, FL-02, FL-03
**Success Criteria** (what must be TRUE):
  1. The FL panel shows three distinct clients with separate per-client accuracy curves that diverge (proving non-IID data partitioning, not the same dataset repeated)
  2. The global model accuracy curve shows improvement over FL rounds in the UI
  3. After each 60-second model reload interval, the inference loop visibly uses the updated FL weights — predictions shift as rounds progress
**Plans**: TBD

### Phase 6: Deployment
**Goal**: The dashboard is live at a public URL that a recruiter can open without hitting a cold-start broken state
**Depends on**: Phase 4, Phase 5
**Requirements**: DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):
  1. The React frontend is accessible at a stable public Vercel URL with no authentication gate
  2. The FastAPI backend on Railway responds within 3 seconds on first load (cold-start mitigation via keep-alive cron ping is active)
  3. Opening the Vercel URL on a fresh browser session loads the dashboard with live WebSocket data flowing within 5 seconds
**Plans**: TBD

### Phase 7: Demo Assets
**Goal**: A reviewer watching the demo video understands what the system does, how it works, and why it matters — before visiting the live URL
**Depends on**: Phase 6
**Requirements**: DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. The README contains an architecture diagram that matches the actual deployed implementation (built last, not planned state)
  2. The README explains the labeling methodology, what "real-time" means with a measured latency number, and what the FL simulation does vs. what production FL would do differently
  3. The demo video shows the full storm simulation flow (calm state → event trigger → anomaly detection → cascade prediction → rerouting) in under 2 minutes
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Frontend Shell | 4/4 | Complete   | 2026-02-24 |
| 2. Backend & Data Pipeline | 6/6 | Complete   | 2026-02-25 |
| 3. XGBoost Anomaly Detection | 4/4 | Complete   | 2026-02-25 |
| 4. GNN Cascade Failure Prediction | 1/5 | In Progress|  |
| 5. Federated Learning Simulation | 0/TBD | Not started | - |
| 6. Deployment | 0/TBD | Not started | - |
| 7. Demo Assets | 0/TBD | Not started | - |
