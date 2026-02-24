# Project Research Summary

**Project:** Aegis Flow — AI-Powered Smart Grid Management Dashboard
**Domain:** Real-time ML monitoring system (portfolio / greenfield)
**Researched:** 2026-02-23
**Confidence:** HIGH

## Executive Summary

Aegis Flow is a real-time AI-powered smart grid monitoring dashboard targeting portfolio / engineering showcase purposes. The system combines a WebSocket-driven React frontend with a Python backend that runs XGBoost anomaly detection and PyTorch Geometric (GNN) cascade failure prediction on synthetic grid telemetry stored in InfluxDB — topped with a Flower federated learning simulation layer. Experts building this class of system structure it as a strict five-layer pipeline: synthetic sensor generator → time-series store → ML inference engine → WebSocket push transport → React visualization. Each layer has a clean contract with its neighbors, meaning the XGBoost → GNN upgrade path and the federated learning add-on can be bolted on without redesigning the core pipeline.

The recommended approach is to build from the outside in and prove each integration seam before adding ML complexity. Start with a static React shell (no backend), progress to a live WebSocket feed with a rule-based anomaly threshold, then slot in XGBoost, then the GNN, and finally Flower FL as a parallel background process. This ordering is driven hard by the feature dependency graph: GNN requires XGBoost to be working and producing anomaly flags; the FL panel is decoupled from inference entirely and can be added independently once the base model exists. The stack is well-chosen — MapLibre GL JS (over Mapbox to avoid cost surprises), deck.gl for high-density overlays, FastAPI + Celery + Redis for async ML dispatch, InfluxDB for time-series compression, and PyTorch Geometric for the GNN.

The top risks are the PyTorch / PyG / CUDA version triangle (install from the PyG wheel index, not pip), Mapbox billing surprises on a public deployment (switch to MapLibre or restrict the token hard), WebSocket memory leaks from unreleased connections, and federated learning simulation that doesn't actually partition data across clients (which makes FedAvg meaningless and is immediately detectable by interviewers). A secondary cluster of risks — temporal leakage in XGBoost training, D3/Mapbox synchronization on pan/zoom, and cold-start problems on Railway free tier — must each be addressed at their natural phase rather than retrofitted.

---

## Key Findings

### Recommended Stack

The stack is sound for a 2025–2026 greenfield project. The only firm substitution is MapLibre GL JS over Mapbox GL JS — MapLibre is the open-source Linux Foundation fork, API-compatible, and eliminates the pay-per-tile-load cost that becomes unpredictable on a public portfolio URL. For the high-density node/edge rendering over the map, deck.gl layers (ScatterplotLayer, ArcLayer) are the right call; D3 alone cannot handle 1,000+ SVG elements at real-time update rates. The async inference dispatch pattern (FastAPI → Celery + Redis → model worker → Redis pub/sub → WebSocket) is non-negotiable: ML inference is CPU/GPU-bound and must never block the async event loop. PyG installation must use the PyG wheel index with exact version pinning of the PyTorch / CUDA triple — this is the single highest-risk technical step in the entire project.

**Core technologies:**
- **React 19 + TypeScript 5.4 + Vite 5** — frontend foundation; React 19 concurrent rendering handles WebSocket update bursts without re-render cascades
- **MapLibre GL JS 4.x** — WebGL map renderer; zero licensing cost; drop-in replacement for Mapbox GL JS
- **deck.gl 9.x** — high-density grid overlay layers on top of MapLibre; handles 10,000+ nodes without performance degradation
- **D3.js v7** — custom force-directed graph topology and bespoke visualizations only; use Recharts for standard time-series panels
- **Zustand 4.x + TanStack Query 5.x** — Zustand for WebSocket/UI state; TanStack Query for REST data fetching; Redux is over-engineered for this use case
- **FastAPI 0.111 + Pydantic v2 + Uvicorn** — ASGI-native, first-class WebSocket support, automatic OpenAPI; Pydantic v2 mandatory (v1 is EOL and conflicts with FastAPI 0.100+)
- **Celery 5.4 + Redis 7** — async ML job queue; XGBoost and GNN inference must run in Celery workers, not FastAPI BackgroundTasks
- **XGBoost 2.1 + SHAP 0.45** — tabular anomaly detection; GPU-native in v2; SHAP explainability is non-negotiable for grid operator credibility
- **PyTorch 2.3 + PyTorch Geometric 2.5** — GNN cascade failure prediction; install via PyG wheel index with exact CUDA version pinning
- **Flower (flwr) 1.8** — federated learning simulation; use 1.x API only (0.x examples widely indexed but incompatible)
- **InfluxDB OSS 2.7.x** (or Cloud Serverless on v3 architecture) — purpose-built time-series compression; use v2 for self-hosting until v3 OSS GA status is confirmed
- **MLflow 2.13** — model registry and experiment tracking; enables checkpoint versioning for federated rounds

**Critical version verifications before development starts:**
- PyG compatibility matrix: https://pytorch-geometric.readthedocs.io/en/latest/notes/installation.html
- InfluxDB 3.x OSS GA status: https://github.com/influxdata/influxdb
- Mapbox vs. MapLibre decision: confirm with stakeholders before any map code is written
- Flower 1.x latest patch: https://pypi.org/project/flwr/

---

### Expected Features

The feature research draws a clear line between what makes this look credible versus what makes it stand out. Missing any table-stakes item makes the project look like a toy; adding any differentiator correctly is what gets it remembered.

**Must have (table stakes):**
- Live map with node/edge visualization — grid monitoring is inherently spatial; without a map it's a table
- Real-time WebSocket updates (no polling) — visible GET requests in DevTools read as junior
- Node status color coding (green/yellow/red) — reviewers scan the map first
- Alert/anomaly list panel — surfaces that the ML is doing something
- Voltage/frequency time-series charts — the sensor data needs a visualization home
- Simulate event trigger — without this, a reviewer waits forever for anything to happen
- Legend/map key — color coding is meaningless without explanation
- XGBoost anomaly detection on synthetic InfluxDB data — proves the ML pipeline end-to-end

**Should have (differentiators):**
- GNN cascade failure prediction with chain visualization — graph neural networks on graph-structured data is the architectural awareness signal; almost never seen in portfolio projects
- Federated learning simulation panel — truly rare in portfolios; shows awareness of enterprise privacy concerns
- Optimal rerouting path overlay — "suggest solution" is more impressive than "detect problem"
- XGBoost → GNN upgrade narrative in the same codebase — demonstrates engineering judgment
- Prediction confidence / probability scores ("Node 7: 87% cascade risk in ~4 min") — distinguishes probabilistic ML from threshold alerting

**Defer to v2+:**
- NOAA weather API for storm context (nice narrative but not critical)
- Load shedding rule-based recommendations (depends on GNN being solid first)
- Auth / login (adds zero signal for ML/systems roles; hides the demo behind a gate)
- Mobile responsive layout (real grid dashboards are desktop-only; forces complexity with no credibility gain)

**Anti-features to actively avoid:**
- Real SCADA/utility data (licensing gray area; no reviewer expects it; use labeled synthetic data instead)
- Displaying "Accuracy: 97.3%" prominently (meaningless on synthetic data; show FL accuracy improving over rounds instead)
- Auto-refresh polling (immediately detectable in Network DevTools)

---

### Architecture Approach

The system is a strict five-layer pipeline with a clean WebSocket seam between the Python backend and the React frontend. Everything upstream of the WebSocket is Python; everything downstream is React. The federated learning component sits entirely outside the real-time pipeline — it writes model checkpoints to disk, which the inference loop reloads on a 60-second interval. This decoupling is the correct production pattern and is directly explainable in an interview.

**Major components:**
1. **Synthetic Sensor Generator** — Python process writing voltage/frequency/load readings to InfluxDB at 1 Hz per node; storm events flip a flag that shifts distributions toward fault ranges and propagate voltage sag through the edge structure with physical attenuation
2. **InfluxDB Time-Series Store** — persistence layer for all sensor readings; serves the ML inference loop (windowed queries) and frontend historical charts (REST); 7-day raw retention with 30-day 1-minute downsampled aggregates
3. **ML Inference Engine** — polls InfluxDB every 2 seconds; runs XGBoost on 10-second rolling windows per node; triggers GNN cascade prediction when XGBoost flags any anomaly; publishes results to asyncio.Queue for WebSocket broadcast
4. **FastAPI + Celery + WebSocket Server** — ASGI API with REST endpoints for topology and history data, WebSocket /ws/grid for real-time push, POST /events/storm for event injection; ConnectionManager handles multi-client broadcast with dead-connection pruning
5. **React Frontend** — single useGridStore (Zustand) stores all node states; WebSocket messages patch the store; MapLibre map, D3 force-directed graph, and Recharts panels all subscribe to the same store and re-render on updates
6. **Flower FL Process** — separate background process running 3 simulated utility clients with non-IID data partitions; writes checkpoint to /models/checkpoints/; frontend polls /fl/status at 5-second REST intervals

**Key patterns confirmed by architecture research:**
- WebSocket preferred over SSE (bidirectional control for storm event trigger)
- File checkpoint handoff for FL (interview-explainable; production would use MLflow model registry)
- Single global Zustand store subscribed to by all visualization components
- XGBoost flags first → GNN propagates (additive, not replacing; same WebSocket schema handles both phases)
- Batch WebSocket messages (one JSON array per inference cycle, not one message per node)

---

### Critical Pitfalls

The 8 pitfall domains identified cover 28 specific failure modes. The highest-priority ones by likelihood of project-killing impact:

1. **PyTorch / PyG / CUDA version mismatch (STACK)** — Installing PyG with plain `pip install torch-geometric` silently falls back to 10-100x slower pure-Python scatter operations; always install from the PyG wheel index with exact PyTorch and CUDA version pinning. Verify the compatibility matrix before writing a single line of ML code.

2. **Mapbox billing surprise on public deployment (P7.1)** — An unrestricted Mapbox token on a public Vercel URL can exceed the 50,000 free-tier map loads in hours if shared on LinkedIn; charges are $0.50 per 1,000 loads with no cap. Mitigation: switch to MapLibre GL JS (free), or restrict the Mapbox token to the exact deployment URL and set a $0 spending limit before any deployment.

3. **WebSocket ConnectionManager memory leak (P6.1)** — FastAPI WebSocket handlers that add connections to a list but never remove them on disconnect accumulate zombie connections indefinitely; broadcasting to dead connections raises exceptions and grows memory monotonically. Use a `set` with `discard()` and purge dead connections after each broadcast cycle.

4. **Federated learning data partitioning omission (P4.1)** — Running all 3 Flower clients on the same full dataset makes FedAvg identical to centralized training and is immediately obvious to any FL-literate interviewer. Partition by geographic region with non-IID load profiles; show divergent per-client loss curves to prove real heterogeneity.

5. **D3/Mapbox pan-zoom desynchronization (P7.2)** — Positioning a D3 SVG overlay with `position: absolute` over the Mapbox canvas causes nodes and edges to drift from their geographic positions on pan/zoom. Re-project all D3 elements on every `map.on('render')` event, or use Mapbox's custom layer API for the overlay.

6. **Synchronous ML inference blocking the async event loop (P6.4)** — Running XGBoost or GNN inference synchronously inside the FastAPI event loop blocks all WebSocket sends; GNN inference can take 50–500ms. Use `run_in_executor()` for CPU-bound inference or, better, dispatch to Celery workers.

7. **Temporal leakage in XGBoost training (P1.1)** — Using `train_test_split(shuffle=True)` on time-series data leaks future rolling-window features into training, producing inflated accuracy that collapses under scrutiny. Always split by timestamp cutoff; compute rolling features after the split inside a time-aware pipeline.

8. **Cold-start on Railway free tier (P8.3)** — Railway spins down after 5 minutes of inactivity; a 30–60 second cold-start on a recruiter's first visit produces a broken dashboard impression. Add a `/health` ping cron job (cron-job.org free tier) every 4 minutes, or pay $5/month for Railway Starter to eliminate sleep.

---

## Implications for Roadmap

The architecture research explicitly defines an 8-phase build order grounded in dependency constraints. This should be adopted directly as the roadmap phase structure with minor consolidation.

### Phase 1: Foundation — Static Frontend Shell + Infrastructure Setup
**Rationale:** The frontend visual design must be validated before any backend work; it unblocks the team from day one and produces a reviewable artifact immediately. Infrastructure decisions (MapLibre vs. Mapbox, InfluxDB retention policy, Mapbox token restrictions) must be locked before any deployment to avoid costly mid-project migrations.
**Delivers:** Dark-themed dashboard with MapLibre map, hardcoded nodes/edges as dots, D3 force-directed graph overlay, sidebar layout — no backend required. InfluxDB bucket with retention policy configured. MapLibre/Mapbox decision finalized.
**Addresses:** Table-stakes map visualization, legend, responsive desktop layout, dashboard visual shell
**Avoids:** P7.1 (Mapbox billing — decide MapLibre now), P7.2 (D3/Mapbox sync — build correctly from the start), P7.3 (layer ordering), P5.3 (InfluxDB retention policy set at bucket creation)
**Research flag:** Standard patterns; no additional research needed

### Phase 2: Backend Skeleton + Data Pipeline
**Rationale:** The frontend mock must be replaced with a real API contract before any ML work begins. The data pipeline (synthetic generator → InfluxDB → FastAPI REST) is the foundation everything else reads from. WebSocket infrastructure should be established here even with a dummy model so the real-time seam is proven before ML complexity is added.
**Delivers:** FastAPI with GET /nodes, GET /nodes/{id}/history, POST /events/storm; synthetic sensor generator writing to InfluxDB; Recharts sidebar charts showing live time-series; WebSocket endpoint with rule-based threshold anomaly detection (not ML yet); ConnectionManager with dead-connection pruning
**Addresses:** Real-time WebSocket updates, voltage/frequency charts, simulate event trigger
**Avoids:** P5.1 (async InfluxDB batch writes), P5.2 (use query_api.query_data_frame(), not raw Flux), P6.1 (WebSocket memory leak), P6.3 (exponential backoff reconnection in frontend), P1.3 (OPSD timezone UTC normalization)
**Research flag:** Standard patterns; FastAPI WebSocket and InfluxDB client are well-documented

### Phase 3: XGBoost Anomaly Detection
**Rationale:** XGBoost is the simpler ML component and acts as the trigger for the GNN. It must be built and validated first — both because GNN depends on it for anomaly flags and because it proves the full pipeline (generator → InfluxDB → inference → WebSocket → UI) with a fast, interpretable model before adding GNN complexity.
**Delivers:** XGBoost model trained on synthetic data with time-aware train/test split; SHAP explainability; anomaly probability scores visible in UI; alert/anomaly list panel; Celery worker for async inference dispatch
**Addresses:** XGBoost anomaly detection (P1 feature), alert panel, anomaly scores
**Avoids:** P1.1 (temporal leakage — timestamp cutoff split), P2.1 (labeling strategy — isolation forest pseudo-labels or documented rule-based labels), P2.2 (temporal feature engineering with lag/rolling/rate-of-change), P2.3 (XGBoost native .ubj serialization, not pickle), P6.4 (ML inference via run_in_executor or Celery, not blocking the event loop)
**Research flag:** May need brief research into SHAP TreeExplainer integration with FastAPI response serialization

### Phase 4: GNN Cascade Failure Prediction
**Rationale:** The GNN is the primary technical differentiator. It depends on XGBoost anomaly flags to activate (GNN only runs when XGBoost fires on any node). The graph data construction must be built carefully against the physical topology, and uncertainty quantification (Monte Carlo dropout) must be built in from the start — retrofitting it is harder.
**Delivers:** PyTorch Geometric GNN (GraphSAGE for inductive generalization) producing cascade risk probabilities per node; cascade chain visualization with sequential animation on the map; rerouting path overlay; Monte Carlo dropout uncertainty quantification ("87% cascade risk" not binary prediction)
**Addresses:** GNN cascade prediction, cascade visualization, rerouting overlay, confidence display
**Avoids:** P1.2 (grid-physics-constrained fault injection — voltage sag rippling through edge structure), P3.1 (GNN overfitting — dropout, weight decay, early stopping, class weights), P3.2 (graph data construction — undirected edges, assertion checks, NetworkX visualization before training), P3.3 (probabilistic outputs, not deterministic), P3.4 (GraphSAGE inductive rather than vanilla GCN transductive), P7.4 (cascade animation gated on state change, not every WebSocket tick)
**Research flag:** NEEDS research-phase — PyG graph construction for heterogeneous grid topologies, GraphSAGE vs GATConv tradeoffs for this specific use case, Monte Carlo dropout implementation with PyG

### Phase 5: Federated Learning Simulation
**Rationale:** FL is architecturally decoupled from the inference pipeline (file checkpoint handoff) and can be added without touching the real-time data path. It is the highest-complexity, highest-differentiator feature and should come last among ML features when everything else is stable.
**Delivers:** Flower 1.x simulation with 3 clients, non-IID geographic partition (nodes by region), FedProx aggregation strategy with weighted averaging by data size; FL panel in frontend showing per-client accuracy curves and global round progress via REST polling /fl/status; checkpoint reload by inference loop every 60 seconds
**Addresses:** Federated learning simulation panel (highest-differentiator feature)
**Avoids:** P4.1 (non-IID data partitioning — different load profiles and anomaly rates per region), P4.2 (FedProx with num_examples weighting), P4.3 (live Flower metrics, not pre-computed), P4.4 (README clearly states in-process simulation mode and what would differ in production)
**Research flag:** NEEDS research-phase — Flower 1.x ClientApp/ServerApp API (significant redesign from 0.x), FedProx configuration, integrating Flower simulation with FastAPI background tasks

### Phase 6: Integration Polish + Optimization
**Rationale:** Once all ML features are working, performance bottlenecks become visible under realistic demo conditions. This phase addresses the gap between "works in development" and "holds up in a live demo."
**Delivers:** Delta WebSocket updates (only changed nodes), batch message framing, GNN result caching (5-second stale serve), latency measurement (end-to-end timestamp logging), connection status badge in header, Railway keep-alive cron job
**Addresses:** Demo reliability under cold-start and network conditions
**Avoids:** P6.2 (delta updates, lean payload), P8.3 (cold-start mitigation), P8.4 (define "real-time" with measured latency in README)
**Research flag:** Standard patterns; no additional research needed

### Phase 7: Deployment
**Rationale:** Frontend and backend deploy to different platforms with different constraints; the separation must be deliberate. Demo infrastructure (keep-alive, environment variable management) must be in place before the URL is shared publicly.
**Delivers:** Frontend on Vercel, backend on Railway (Starter plan recommended to avoid sleep), InfluxDB containerized, environment variables for tokens, MapLibre tile source configuration, /health endpoint
**Avoids:** P8.3 (cold-start — Railway Starter or keep-alive cron), P7.1 (Mapbox token restricted to Vercel URL if Mapbox is used)
**Research flag:** Standard deployment patterns; no additional research needed

### Phase 8: Demo Assets
**Rationale:** A portfolio project is only as good as its presentation layer. The README and demo video are what a reviewer sees first — they must accurately reflect the actual implementation, not the planned implementation.
**Delivers:** Architecture diagram (built last to match actual implementation), README with architecture section, labeling methodology, "real-time" latency definition, FL limitations section; demo video with 30s visual hook + 60s technical walkthrough + 30s "what I'd do next"
**Addresses:** Demo video, architecture README
**Avoids:** P8.1 (diagram built last, matches code), P8.2 (video includes 3 specific technical decisions and one graceful failure scenario)
**Research flag:** Standard; no additional research needed

### Phase Ordering Rationale

- **Frontend first (Phase 1)** — validated by architecture research: static shell unblocks visual design without any backend dependency and produces an immediate reviewable artifact
- **Data pipeline before ML (Phases 2 before 3)** — the inference engine needs InfluxDB data to query; the WebSocket transport must be proven before adding ML latency to it
- **XGBoost before GNN (Phase 3 before 4)** — confirmed by both FEATURES.md and ARCHITECTURE.md: GNN activates only when XGBoost flags an anomaly; XGBoost proves the full pipeline with a fast model
- **FL last among ML features (Phase 5)** — FL is decoupled from the real-time path and adds the most operational complexity; it should not block the core ML pipeline from being demo-ready
- **Optimization before deployment (Phase 6 before 7)** — performance issues must be found in development, not discovered when a recruiter opens the live URL for the first time

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 4 (GNN):** Complex PyG integration, graph construction correctness for grid topologies, GraphSAGE vs. GATConv decision, Monte Carlo dropout with PyG — sparse implementation examples for the specific grid domain
- **Phase 5 (Flower FL):** Flower 1.x API (ClientApp/ServerApp abstraction is a major redesign from 0.x); FedProx strategy configuration; integrating simulation mode with FastAPI async; per-client metric streaming to frontend

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1 (Shell):** MapLibre + deck.gl + Vite + React setup is thoroughly documented
- **Phase 2 (Backend skeleton):** FastAPI WebSocket + InfluxDB client patterns are well-documented in official sources
- **Phase 3 (XGBoost):** XGBoost + SHAP + scikit-learn pipeline is heavily documented; only SHAP/FastAPI serialization edge may need a quick check
- **Phase 6 (Optimization):** Delta update patterns and Railway deployment are standard
- **Phase 7 (Deployment):** Vercel + Railway deployment is standard
- **Phase 8 (Demo assets):** No technical research needed

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies are stable major releases with broad production adoption; PyG version matrix is the only MEDIUM-HIGH item requiring pre-development verification |
| Features | HIGH | Feature prioritization is grounded in both commercial grid UI analysis and ML portfolio hiring patterns; anti-features are well-reasoned |
| Architecture | HIGH | Five-layer pipeline is a canonical pattern for real-time ML monitoring systems; FL decoupling via file checkpoint is explicitly validated by production ML system patterns (Uber Michelangelo, NREL/EPRI references) |
| Pitfalls | HIGH | Pitfalls are stack-specific and scenario-specific (not generic advice); 28 failure modes catalogued with concrete code-level prevention strategies |

**Overall confidence:** HIGH

### Gaps to Address

- **InfluxDB 3.x OSS GA status** — research used training data (cutoff Aug 2025); InfluxDB v3 OSS may still be in preview. Safe fallback: use OSS 2.7.x for self-hosting. Verify at https://github.com/influxdata/influxdb before setting up infrastructure.

- **PyTorch / PyG / CUDA version triple** — must be verified against the live PyG compatibility matrix before any Python environment is created. This is not a planning gap but a mandatory pre-development action.

- **Flower 1.x latest patch version** — training data identified 1.8.x; verify current patch at https://pypi.org/project/flwr/ before pinning.

- **deck.gl 9.x + MapLibre 4.x peer dependency** — verify with `npm info @deck.gl/core peerDependencies` before installing; deck.gl peer dependency specifications lag behind MapLibre releases occasionally.

- **GNN architecture selection (GraphSAGE vs. GATConv vs. GCNConv)** — research recommends GraphSAGE for inductive generalization but did not benchmark against the specific grid topology size (50–200 nodes). This is a Phase 4 planning decision that benefits from a research-phase.

- **Railway Starter plan cost vs. free tier** — the $5/month recommendation for Railway Starter (to avoid sleep) was the research recommendation; validate current Railway pricing before committing.

---

## Sources

### Primary (HIGH confidence)
- FastAPI official WebSocket documentation — ConnectionManager patterns, async WebSocket handler design
- InfluxDB OSS documentation — line protocol, Flux query language, retention policies, Python client batching API
- PyTorch Geometric documentation — graph construction, node classification, installation compatibility matrix
- Flower (flwr) framework documentation — simulation mode, FedAvg/FedProx strategies, ClientApp/ServerApp 1.x API
- MapLibre GL JS documentation — custom layer API, render event re-projection pattern
- XGBoost documentation — native model format (.ubj), GPU training, multi-output support
- SHAP documentation — TreeExplainer for XGBoost, Shapley value interpretation

### Secondary (MEDIUM confidence)
- OSIsoft PI Vision, GE GridSolutions, Siemens SICAM — commercial grid UI feature benchmarking
- NREL SMART-DS synthetic grid topology datasets — grid physics constraints and synthetic data generation approach
- EPRI, EnergyHub production patterns — architecture patterns for energy grid monitoring analytics layers
- Common ML portfolio projects on GitHub (grid/energy category) — competitive feature analysis
- IEEE Smart Grid ML papers — expected feature sets for grid ML systems
- Uber Michelangelo, LinkedIn real-time serving papers — adapted ML serving patterns for portfolio scale

### Tertiary (LOW confidence — verify before use)
- InfluxDB 3.x OSS availability as of Aug 2025 — training data; status may have changed
- PyG 2.5.x + PyTorch 2.3.x compatibility — verify against live compatibility matrix
- Railway free tier sleep behavior — verify current tier specifications

---
*Research completed: 2026-02-23*
*Ready for roadmap: yes*
