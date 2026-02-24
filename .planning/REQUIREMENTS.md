# Requirements: AegisFlow

**Defined:** 2026-02-23
**Core Value:** A live, visually compelling dashboard that makes AI-powered grid intelligence *feel* real — the kind of demo that gets paused during an interview so the interviewer can ask how it works.

## v1 Requirements

### Frontend Shell

- [ ] **SHELL-01**: User sees a dark-themed dashboard with sidebar, header, map canvas, and status panel on page load
- [ ] **SHELL-02**: Power nodes display status colors (green = normal, yellow = warning, red = critical) that update in real time
- [ ] **SHELL-03**: Map legend is visible explaining node types and status color meanings
- [ ] **SHELL-04**: Dashboard renders correctly at 1280px+ desktop viewport (no mobile requirement)

### Map & Visualization

- [ ] **MAP-01**: MapLibre GL JS base map renders a dark-styled city grid as the spatial canvas (not Mapbox — avoids billing risk)
- [ ] **MAP-02**: D3.js graph overlay renders power nodes as dots and distribution routes as connecting lines on top of the map, synchronized on pan/zoom
- [ ] **MAP-03**: User can click a node to see its name, type, and current sensor readings in a detail panel
- [ ] **MAP-04**: When a cascade failure is predicted, nodes in the propagation chain highlight in sequence with a timing label (e.g., "~4 min")

### Backend & Data Pipeline

- [ ] **BACK-01**: FastAPI serves node topology (id, position, type, connections) as a REST endpoint consumed by the frontend on load
- [ ] **BACK-02**: InfluxDB stores synthetic time-series sensor readings (voltage, frequency, load) with a retention policy set
- [ ] **BACK-03**: Synthetic sensor data generator replays NREL/OPSD dataset at configurable speed to simulate a live sensor feed
- [ ] **BACK-04**: Frontend receives real-time node state updates via WebSocket (no polling); reconnects automatically with exponential backoff

### Real-Time UX

- [ ] **UX-01**: "Simulate Storm Event" button injects a fault into the data stream, triggering anomaly detection and cascade prediction
- [ ] **UX-02**: Sidebar displays live voltage and frequency charts for the selected node, updating via WebSocket stream
- [ ] **UX-03**: Anomaly alert panel shows a timestamped list of detected anomalies; alerts can be dismissed
- [ ] **UX-04**: When a rerouting path is recommended, it highlights in blue on the map overlay

### ML — Anomaly Detection

- [ ] **ML-01**: XGBoost model detects abnormal voltage/frequency readings in the InfluxDB time-series stream and flags affected nodes
- [ ] **ML-02**: When XGBoost flags an anomaly, PyTorch Geometric GNN (GraphSAGE architecture) predicts the cascade failure propagation path through the node graph
- [ ] **ML-03**: GNN output includes a confidence score and estimated time-to-cascade for each at-risk node in the chain
- [ ] **ML-04**: System recommends which nodes to shed load from based on GNN propagation predictions

### Federated Learning

- [ ] **FL-01**: Flower simulation runs 3 local "utility" clients, each trained on a geographically distinct partition of the NREL dataset (not the same data repeated)
- [ ] **FL-02**: Dashboard FL panel shows each client's training rounds, per-client accuracy, and global model accuracy curve over rounds
- [ ] **FL-03**: Inference loop reloads FL-updated global model weights on a 60-second interval, so FL rounds visibly affect predictions

### Deployment & Portfolio

- [ ] **DEPLOY-01**: React frontend is deployed on Vercel with a stable public URL
- [ ] **DEPLOY-02**: FastAPI backend is deployed on Railway with a keep-alive cron ping to prevent cold-start delays on the portfolio link
- [ ] **DEPLOY-03**: 2-minute demo video records the full storm simulation flow (calm state → event trigger → anomaly → cascade prediction → rerouting)
- [ ] **DEPLOY-04**: README includes an architecture diagram, stack rationale, and explanation of what the ML models actually do

## v2 Requirements

### Content & Narrative

- **CONT-01**: NOAA Weather API integration — storm events display real weather context (wind/precipitation overlaying the cascade)
- **CONT-02**: Medium or dev.to article explaining the technical decisions — increases portfolio discoverability

### Analytics

- **ANLX-01**: Historical anomaly playback — user can replay past storm events from InfluxDB
- **ANLX-02**: Per-node health score trend over time (7-day rolling view)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auth / login screen | Adds zero ML/systems signal; hides the demo behind a gate for portfolio reviewers |
| Real SCADA or utility data | Licensing issues, legal gray area, no reviewer expects real grid data |
| Mobile responsive layout | Smart grid dashboards are desktop-only in the real world; forces unnecessary complexity |
| Auto-refresh polling | Visible in Network tab as GET requests; reads as junior — WebSocket from day one |
| Displaying static accuracy % ("97.3%") | Meaningless on synthetic data; reviewers know it; FL rounds showing improvement over time is honest |
| Multi-user features | This is a demo, not a SaaS product |
| Native mobile app | No portfolio context justifies this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 | Pending |
| SHELL-02 | Phase 1 | Pending |
| SHELL-03 | Phase 1 | Pending |
| SHELL-04 | Phase 1 | Pending |
| MAP-01 | Phase 1 | Pending |
| MAP-02 | Phase 1 | Pending |
| MAP-03 | Phase 1 | Pending |
| MAP-04 | Phase 4 | Pending |
| BACK-01 | Phase 2 | Pending |
| BACK-02 | Phase 2 | Pending |
| BACK-03 | Phase 2 | Pending |
| BACK-04 | Phase 2 | Pending |
| UX-01 | Phase 2 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 3 | Pending |
| UX-04 | Phase 4 | Pending |
| ML-01 | Phase 3 | Pending |
| ML-02 | Phase 4 | Pending |
| ML-03 | Phase 4 | Pending |
| ML-04 | Phase 4 | Pending |
| FL-01 | Phase 5 | Pending |
| FL-02 | Phase 5 | Pending |
| FL-03 | Phase 5 | Pending |
| DEPLOY-01 | Phase 6 | Pending |
| DEPLOY-02 | Phase 6 | Pending |
| DEPLOY-03 | Phase 7 | Pending |
| DEPLOY-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after roadmap creation*
