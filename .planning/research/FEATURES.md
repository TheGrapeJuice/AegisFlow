# Feature Research

**Domain:** AI-powered smart grid monitoring dashboard (portfolio project)
**Researched:** 2026-02-23
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every credible grid monitoring demo must have. Missing these makes it look like a toy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Live map with node/edge visualization | Grid monitoring = spatial; without a map it's just a table | MEDIUM | Mapbox GL JS + D3 overlay; nodes must show status via color |
| Real-time data updates (no refresh) | "Live dashboard" implies WebSocket/SSE; polling visible in DevTools reads as amateur | MEDIUM | WebSocket connection with reconnect logic |
| Node status indicators (normal/warning/critical) | Visual hierarchy — reviewers scan the map first; colors must mean something | LOW | Green → Yellow → Red state machine |
| Alert/anomaly list panel | Detected anomalies must surface somewhere; no panel = "does the AI do anything?" | LOW | Timestamped list, dismissible |
| Voltage/frequency time-series charts | Sensor data implies charts; if you only show map, the ML has nothing to look at | MEDIUM | Sidebar charts for selected node; Recharts is sufficient |
| Simulate event trigger | Without this, the reviewer waits forever for something to happen | LOW | Button that injects fault into data stream |
| Legend / map key | Without a legend, color coding is meaningless to a first-time viewer | LOW | Map overlay explaining node types and status colors |
| Responsive layout on 1080p+ desktop | Portfolio reviewers use laptops; broken layout = disqualified | LOW | TailwindCSS grid, min-width 1280px is fine |

### Differentiators (Competitive Advantage)

Features that elevate this above a standard "I made a dashboard" portfolio entry.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GNN cascade failure prediction with chain visualization | Graph neural networks on graph-structured data is exactly the right tool — shows architectural awareness | HIGH | PyTorch Geometric; visualize propagation path as sequential highlighting with timing |
| Federated learning simulation panel | FL without exposing raw data is a real enterprise concern; having it in a portfolio is rare and immediately memorable | HIGH | Flower with 3 simulated clients; accuracy curve matters more than training speed |
| Optimal rerouting path overlay | Goes beyond "detect problem" to "suggest solution" — shows systems thinking | MEDIUM | Shortest-path or minimum-cut on the graph; highlight in blue |
| XGBoost → GNN upgrade narrative | Showing the evolution from baseline to advanced model in the same codebase proves engineering judgment | MEDIUM | Keep XGBoost runnable; GNN replaces it in the inference loop |
| Load shedding recommendation | Actionable output beyond anomaly flag — "shed these 2 nodes" is an engineering decision | MEDIUM | Rule-based on top of GNN prediction is fine |
| Prediction confidence / timing estimate | "Node 7 → 12 → 19 at risk in ~4 minutes" is far more impressive than "anomaly detected" | LOW | GNN output + simple time-to-cascade estimate |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real SCADA/utility data integration | "More real" sounds better | Licensing issues, legal gray area, complexity blows scope; no reviewer expects real grid data | NREL/OPSD synthetic datasets — explicitly call out "synthetic" in README |
| Auth / login screen | Feels more "production-like" | Adds 0 signal for ML/systems roles; hides the demo behind a gate | No auth; live URL opens directly to the dashboard |
| Mobile responsive layout | Standard practice elsewhere | Smart grid dashboards are desktop-only in the real world; forcing mobile layout adds complexity with no credibility gain | Explicitly state "desktop-optimized" in README |
| "Accuracy: 97.3%" displayed prominently | Sounds impressive | Meaningless on synthetic data — reviewers know it; makes you look like you're gaming metrics | Show accuracy improving over FL rounds (relative progress is honest) |
| Auto-refresh page-based updates | Faster to implement than WebSocket | Visible in Network tab as GET requests every N seconds; screams junior | WebSocket from day one, even with mock data |
| Saving/persisting user configurations | Feature completeness | Adds state management complexity with zero portfolio signal | Stateless dashboard; reset on page load is fine |

## Feature Dependencies

```
Mapbox GL JS map
    └──requires──> Node/edge data model (defined in Phase 1)
                       └──requires──> FastAPI data endpoint

WebSocket streaming
    └──requires──> FastAPI WebSocket server
                       └──requires──> InfluxDB sensor data

GNN cascade prediction
    └──requires──> XGBoost anomaly detection (baseline, triggers GNN)
                       └──requires──> InfluxDB sensor data
    └──requires──> Graph topology model (nodes + edges defined)

Federated learning panel
    └──requires──> Base ML model (XGBoost or GNN trained)
    └──enhances──> GNN (FL updates global weights used in GNN inference)

Cascade failure visualization
    └──requires──> GNN predictions (propagation path output)
    └──requires──> Mapbox map (renders the path)

Optimal rerouting overlay
    └──requires──> Graph topology model
    └──enhances──> GNN cascade prediction (what to reroute)

Simulate event button
    └──requires──> Data injection endpoint (FastAPI POST)
    └──enhances──> All ML features (triggers the interesting data)
```

### Dependency Notes

- **GNN requires XGBoost first:** XGBoost acts as the anomaly trigger; GNN only activates when XGBoost flags a node. Build XGBoost first — it proves the pipeline before adding GNN complexity.
- **FL is decoupled from the main inference loop:** FL runs as a separate process writing checkpoint files; inference loop reloads weights on interval. This means FL can be added without touching the existing inference code.
- **Cascade visualization requires GNN:** Don't try to fake the chain visualization with mock data — it won't hold up to questions in an interview. Build it against real GNN output.
- **Simulate event enhances everything:** Every ML feature is more impressive when a reviewer can trigger it on demand. Build this early (even as a mock) and keep it working through all phases.

## MVP Definition

### Launch With (v1)

- [ ] Dark dashboard shell with sidebar, header, map container — sets the aesthetic
- [ ] Mapbox map with hardcoded nodes and edges — proves visual layer works
- [ ] FastAPI endpoint serving static node data — proves backend exists
- [ ] WebSocket connection (even with mock data) — proves real-time from day one
- [ ] XGBoost anomaly detection on synthetic InfluxDB data — proves ML pipeline works
- [ ] Anomaly alerts surfacing on dashboard — proves end-to-end integration
- [ ] Simulate event button — makes the demo controllable

### Add After Validation (v1.x)

- [ ] Live voltage/frequency charts — add when sensor data is flowing cleanly
- [ ] GNN cascade prediction + visualization — add when XGBoost pipeline is solid
- [ ] Rerouting path overlay — add alongside GNN (same data source)

### Future Consideration (v2+)

- [ ] Federated learning panel — highest complexity, highest differentiator; add last when everything else is stable
- [ ] Load shedding recommendations — rule-based enhancement on top of GNN
- [ ] NOAA weather API integration for storm context — nice narrative touch but not critical

## Feature Prioritization Matrix

| Feature | Portfolio Value | Implementation Cost | Priority |
|---------|----------------|---------------------|----------|
| Dark dashboard visual shell | HIGH | LOW | P1 |
| Map with node/edge visualization | HIGH | MEDIUM | P1 |
| WebSocket real-time updates | HIGH | MEDIUM | P1 |
| XGBoost anomaly detection | HIGH | MEDIUM | P1 |
| Simulate event trigger | HIGH | LOW | P1 |
| Voltage/frequency charts | MEDIUM | MEDIUM | P1 |
| GNN cascade prediction | HIGH | HIGH | P1 |
| Cascade failure visualization | HIGH | MEDIUM | P1 |
| Rerouting path overlay | MEDIUM | MEDIUM | P2 |
| Federated learning panel | HIGH | HIGH | P1 |
| Load shedding recommendation | MEDIUM | LOW | P2 |
| Demo video | HIGH | LOW | P1 |
| Architecture README | HIGH | LOW | P1 |
| Auth/login | LOW | MEDIUM | P3 |
| Mobile layout | LOW | MEDIUM | P3 |

## Competitor Feature Analysis

Context: "Competitors" here = other ML portfolio projects and commercial grid management UIs (OSIsoft PI, GE Grid Solutions, Siemens SCADA).

| Feature | Commercial Grid UIs | Other Portfolio Projects | AegisFlow Approach |
|---------|--------------------|--------------------------|--------------------|
| Real-time map | Standard | Rare (most use static charts) | Mapbox GL JS + D3 overlay |
| ML anomaly detection | Basic threshold alerts | XGBoost or LSTM | XGBoost baseline → GNN upgrade |
| Graph-based prediction | Advanced (rare in portfolio) | Almost never | PyTorch Geometric GNN — the key differentiator |
| Federated learning | Emerging (research stage) | Never seen in portfolios | Flower simulation — truly rare |
| Demo-ability | Requires real access | Hard to run locally | Live URL + demo video |

## Sources

- OSIsoft PI Vision, GE GridSolutions, Siemens SICAM UI feature analysis
- Common ML portfolio projects on GitHub (grid/energy category)
- IEEE Smart Grid ML papers for expected feature sets
- Hiring manager feedback patterns from ML/systems engineering job postings

---
*Feature research for: AI-powered smart grid monitoring dashboard*
*Researched: 2026-02-23*
