# Architecture Research — AegisFlow Smart Grid ML Dashboard

**Research type:** Architecture dimension
**Project:** AegisFlow — AI-powered smart grid monitoring dashboard
**Date:** 2026-02-23
**Milestone context:** Greenfield — no existing code

---

## Research Question

How are real-time AI monitoring systems (especially energy/grid domain) typically structured? What are the major components, their boundaries, and the data flow from synthetic sensor generation through ML inference to frontend visualization? What is the suggested build order given dependencies?

---

## Summary Finding

Real-time ML monitoring systems for grid/energy domains are consistently structured as a **pipeline of five layers**: sensor generation → time-series storage → ML inference → push transport → frontend visualization. Each layer has a clear contract with its neighbors, which makes it possible to swap implementations (e.g., XGBoost → GNN) without rebuilding the whole system. The WebSocket boundary between backend and frontend is the critical seam: everything upstream of it is Python, everything downstream is React.

Federated learning sits outside the primary monitoring pipeline — it is a background training loop that periodically updates the inference model. It does not touch the real-time data path at all during inference.

---

## Component Map

### Layer 1 — Sensor Data Generator

**What it is:** A Python process (or FastAPI background task) that synthesizes time-series readings for each power node — voltage (kV), frequency (Hz), load (MW), temperature. In production grid systems this would be replaced by actual SCADA/PMU streams; for AegisFlow it is a configurable synthetic generator.

**Boundary:**
- Reads: configuration (node topology, normal operating ranges, fault injection flags)
- Writes: raw sensor records to InfluxDB

**Internal pattern:** Typically a simple loop with a `time.sleep(interval)` — 1-second cadence for dashboard realism. Storm events are injected by flipping a flag that shifts voltage/frequency distributions toward fault ranges.

**Why separate:** Keeping generation decoupled from inference means the storm-event button only needs to mutate state visible to the generator. The ML layer never needs to know about the injection mechanism.

---

### Layer 2 — Time-Series Store (InfluxDB)

**What it is:** InfluxDB is the persistence layer for all sensor readings. It serves two consumers: (1) the ML inference loop, which reads recent windows of data, and (2) the historical chart queries from the frontend (via FastAPI REST endpoints).

**Boundary:**
- Reads from: Sensor Data Generator
- Reads by: Inference Engine (windowed queries), FastAPI REST handlers (historical queries)
- Writes to: nothing downstream — it is purely a store

**Key InfluxDB concepts for this system:**
- **Measurement:** `grid_sensor_readings`
- **Tags:** `node_id`, `node_type` (generation/distribution/load) — these are indexed for fast filtering
- **Fields:** `voltage_kv`, `frequency_hz`, `load_mw`, `temperature_c`
- **Retention policy:** 7 days for raw readings; 30 days for 1-minute downsampled aggregates

**Why InfluxDB over PostgreSQL:** Time-series databases store data in columnar time-ordered blocks. Range queries like "give me the last 30 seconds of voltage for node 12" are an order of magnitude faster than equivalent SQL on a row store. InfluxDB's line protocol also makes ingestion from the generator trivial.

---

### Layer 3 — Inference Engine

**What it is:** The Python ML inference loop. It runs on a configurable polling interval (e.g., every 2 seconds), queries InfluxDB for recent sensor windows, runs them through the anomaly detection model, and publishes results to the WebSocket broadcast layer.

**Boundary:**
- Reads from: InfluxDB (via InfluxDB Python client)
- Reads: model artifact (serialized XGBoost or PyTorch Geometric checkpoint)
- Writes to: in-memory state store (dict of node states), which the WebSocket broadcaster reads
- Writes to: InfluxDB (anomaly events table, optional — for audit trail)

**What the inference engine produces per node:**
```
{
  "node_id": "node_12",
  "timestamp": "2026-02-23T14:00:01Z",
  "voltage_kv": 11.8,
  "frequency_hz": 49.6,
  "load_mw": 142.3,
  "anomaly_score": 0.87,        # XGBoost output_proba
  "anomaly_flag": true,
  "cascade_risk_nodes": [],     # GNN output (empty until GNN phase)
  "cascade_timing_s": null,     # GNN output
  "reroute_path": null          # GNN output
}
```

**XGBoost implementation:** Trained offline on labeled synthetic data (normal vs. fault distributions). At inference time, features are extracted from a 10-second rolling window: mean, std, min, max of voltage and frequency, plus delta (rate of change). The model scores each node independently — no graph structure needed at this stage.

**Why XGBoost first:** XGBoost inference is ~1ms per sample. It is stateless per-node — no graph construction overhead. It proves the entire pipeline (generator → InfluxDB → inference → WebSocket → frontend) works before introducing the complexity of graph neural networks. It also produces visible, explainable anomaly flags that make the dashboard compelling even in the baseline demo.

---

### Layer 4 — API + WebSocket Server (FastAPI)

**What it is:** FastAPI serves two roles: REST endpoints for initial data load (node topology, historical charts) and WebSocket endpoints for the real-time push stream.

**Boundary:**
- REST GET `/nodes` — returns node list with static properties (location, type, capacity)
- REST GET `/nodes/{node_id}/history` — returns last N minutes of sensor readings from InfluxDB
- WebSocket `/ws/grid` — streams inference results at ~1-second intervals
- POST `/events/storm` — triggers the storm event flag in the generator

**WebSocket broadcast pattern:** FastAPI maintains a `ConnectionManager` — a set of active WebSocket connections. The inference loop writes to a shared async queue; the broadcast coroutine drains the queue and sends to all connected clients. This is the standard pattern from FastAPI's own WebSocket documentation and is used in production monitoring dashboards at scale.

```
Inference loop → asyncio.Queue → ConnectionManager.broadcast() → all WS clients
```

**Why FastAPI:** Native async support means the WebSocket broadcast loop and REST handlers share the same event loop without thread overhead. Pydantic models provide automatic validation of the inference output shape before it hits the wire.

---

### Layer 5 — React Frontend

**What it is:** A React + Vite application. Its job is to receive the WebSocket stream, maintain local state for all nodes, and render three synchronized views: the Mapbox GL JS map (spatial), the D3.js graph network (topology), and the Recharts time-series panels (telemetry).

**Boundary:**
- Reads: WebSocket stream from FastAPI `/ws/grid`
- Reads: REST `/nodes` on mount (initial topology load)
- Reads: REST `/nodes/{id}/history` on node selection (chart drill-down)
- Writes: POST `/events/storm` on button press

**State management pattern:** A single `useGridStore` (Zustand or React Context) holds the current state of all nodes. The WebSocket message handler merges incoming updates into this store. All three visualization components subscribe to the store — the map updates dot colors, the graph highlights edges, the charts append new data points.

**Component decomposition:**
```
App
├── Sidebar
│   ├── NodeList (subscribes to anomaly flags)
│   └── TelemetryCharts (subscribes to selected node history)
├── MapView (Mapbox GL JS canvas)
│   ├── NodeLayer (dots colored by anomaly_score)
│   ├── EdgeLayer (distribution lines, highlighted for reroute)
│   └── CascadeOverlay (sequential highlight animation)
└── GraphNetworkOverlay (D3.js SVG over map)
    └── NodeGraph (mirrors map topology in force-directed layout)
```

---

## Data Flow — End to End

```
[Synthetic Generator]
      │  line protocol write (every 1s)
      ▼
[InfluxDB]
      │  windowed query (last 10s, every 2s)
      ▼
[Inference Engine]
      │  produces NodeInferenceResult per node
      ▼
[asyncio.Queue]
      │  drained by ConnectionManager
      ▼
[FastAPI WebSocket /ws/grid]
      │  JSON push (every ~1s)
      ▼
[React WebSocket client]
      │  merges into useGridStore
      ▼
[Mapbox GL JS] [D3.js Graph] [Recharts Charts]
      (all read from same store, re-render on update)
```

**Storm event injection flow (out-of-band):**
```
[React "Simulate Storm" button]
      │  POST /events/storm
      ▼
[FastAPI POST handler]
      │  sets storm_active flag
      ▼
[Synthetic Generator reads flag]
      │  shifts voltage/frequency distributions
      ▼
(rejoins main data flow at InfluxDB write)
```

---

## Build Order and Dependencies

The build must proceed from infrastructure inward, never the reverse. Each phase must produce a demonstrable artifact before the next phase begins.

### Phase 1 — Static Shell (no dependencies)
Build the React frontend with hardcoded mock data. Mapbox map renders, nodes appear as dots, D3 graph overlays. No backend required. This validates the visual design and unblocks the frontend from day one.

**Deliverable:** Screenshot of dark-themed dashboard with map + nodes.

### Phase 2 — Backend Skeleton (depends on Phase 1 interface contract)
Stand up FastAPI. Implement `GET /nodes` returning static JSON. Wire the frontend to load from this endpoint instead of the hardcoded mock. No InfluxDB yet.

**Deliverable:** Frontend loads real node data from live API.

### Phase 3 — Data Pipeline (depends on Phase 2)
Implement the Synthetic Generator writing to InfluxDB. Implement `GET /nodes/{id}/history` reading from InfluxDB. Connect the Recharts sidebar charts to the history endpoint. At this stage the charts show live-updating time-series data but there is no ML inference yet.

**Deliverable:** Live voltage/frequency charts updating in real time.

### Phase 4 — WebSocket + Static Inference (depends on Phase 3)
Implement the WebSocket endpoint and ConnectionManager. Implement the inference loop with a **dummy model** (rule-based threshold: if voltage < 10kV, flag anomaly). Wire the frontend WebSocket client. Map dots change color when anomaly flags arrive. This proves the real-time push pipeline before any real ML.

**Deliverable:** Map dots pulse red during simulated faults. Storm button works.

### Phase 5 — XGBoost Anomaly Detection (depends on Phase 4)
Train XGBoost offline on synthetic data. Serialize model artifact. Replace the dummy threshold in the inference loop with the XGBoost scorer. The rest of the pipeline is unchanged.

**Deliverable:** ML-powered anomaly flags with probability scores visible in UI.

### Phase 6 — GNN Cascade Prediction (depends on Phase 5)
Add PyTorch Geometric GNN that takes the graph topology + current node states as input and predicts cascade propagation paths and timing. Extend `NodeInferenceResult` to include `cascade_risk_nodes` and `cascade_timing_s`. Add cascade visualization to the frontend (sequential highlight animation).

**Deliverable:** Storm event shows predicted cascade chain with timing.

### Phase 7 — Federated Learning Simulation (depends on Phase 5, independent of Phase 6)
Add Flower FL simulation with 3 synthetic utility clients. This runs as a **separate background process** — not part of the real-time pipeline. It periodically trains updated global model weights and writes a new model checkpoint to disk. The inference loop picks up the new checkpoint on a scheduled reload interval (e.g., every 60 seconds). Add FL panel to frontend showing client training rounds and global accuracy metric.

**Deliverable:** FL panel shows live training updates. Model improves during demo.

### Phase 8 — Deployment (depends on Phases 1-7)
Deploy frontend to Vercel, backend to Railway. Record demo video.

---

## XGBoost to GNN Upgrade Path

The upgrade is designed to be **additive, not replacing**. The pattern used in production ML systems is:

1. **Keep XGBoost as the anomaly detector.** It continues to flag individual nodes. The GNN is not a replacement — it is an additional inference step that runs only when XGBoost flags an anomaly on any node.

2. **GNN input:** Takes the full graph (adjacency matrix of all nodes and edges) plus current node feature vectors. Produces: probability of cascade propagation to each neighbor node, and estimated time-to-fault.

3. **Model registry pattern:** The inference engine loads models by name from a config dict. Adding the GNN means adding a new entry to this dict and adding the GNN inference call after the XGBoost call. The WebSocket message schema already has `cascade_risk_nodes` and `cascade_timing_s` fields (null during XGBoost phase), so the frontend handles both phases without schema changes.

4. **No pipeline changes:** Generator, InfluxDB, WebSocket transport, and React frontend are all unchanged by the XGBoost → GNN transition. The only changed component is the Inference Engine internals.

**Interview talking point:** "XGBoost gives us per-node anomaly detection in O(1) per node. The GNN operates over the graph structure to predict propagation — it activates only when XGBoost fires, which keeps inference latency bounded."

---

## Federated Learning Integration Point

Flower FL simulation is **decoupled from the real-time inference pipeline** by design. The integration point is the **model checkpoint file on disk**.

```
[FL Training Process — separate process]
   3 Flower clients (simulated utility companies)
   Each client trains on its local synthetic data partition
   Flower server aggregates weights (FedAvg)
   → writes updated_model.pkl to /models/checkpoints/
         │
         │ (inference loop polls for new checkpoint every 60s)
         ▼
[Inference Engine — main process]
   if newer checkpoint exists: reload model
   continue inference with updated weights
```

**Why this pattern:**
- FL training is computationally expensive (hundreds of rounds). Running it in the same process as the real-time inference loop would cause latency spikes on the WebSocket stream.
- File-based handoff is the simplest reliable IPC for a single-machine demo. In production, this would be a model registry service (MLflow, Weights & Biases), but file-based is interview-explainable.
- The frontend FL panel reads from a `/fl/status` REST endpoint that polls the Flower server's round state — it is not on the WebSocket stream, because FL round updates happen on a minutes timescale, not seconds.

**Frontend FL panel data source:** REST polling (5-second interval) against `/fl/status`:
```json
{
  "current_round": 12,
  "total_rounds": 50,
  "global_accuracy": 0.847,
  "clients": [
    {"client_id": "utility_a", "last_round": 12, "local_loss": 0.21},
    {"client_id": "utility_b", "last_round": 12, "local_loss": 0.19},
    {"client_id": "utility_c", "last_round": 11, "local_loss": 0.23}
  ]
}
```

---

## Key Architecture Decisions (Confirmed by Research)

| Decision | Canonical Pattern | AegisFlow Implementation |
|---|---|---|
| Time-series storage | Purpose-built TSDB (InfluxDB, TimescaleDB, Prometheus) | InfluxDB — correct choice |
| Real-time push | WebSocket preferred over SSE for bidirectional control | WebSocket /ws/grid — correct |
| ML model handoff | File checkpoint or model registry | File checkpoint for demo simplicity |
| FL decoupling | Separate training process, file/registry handoff | Flower as separate process |
| Frontend state | Single global store, all viz components subscribe | useGridStore (Zustand recommended) |
| XGBoost + GNN | Additive pipeline, not replacement | XGBoost flags → GNN propagates |

---

## Risks and Mitigations

**Risk:** WebSocket message rate overwhelms React render loop at high node counts.
**Mitigation:** Batch updates — inference loop accumulates all node results for one cycle, sends a single JSON array per cycle instead of one message per node. React merges the batch in one store update, triggering one render pass.

**Risk:** InfluxDB query latency spikes block the inference loop.
**Mitigation:** Run InfluxDB queries in a background async task. Use asyncio timeouts. Inference loop skips a cycle rather than blocking if query exceeds 500ms.

**Risk:** GNN inference latency is too high for 1-second cadence.
**Mitigation:** GNN runs only when XGBoost anomaly_flag is true for any node (not every cycle). GNN results are cached for 5 seconds and served stale if the GNN is still computing.

**Risk:** Flower FL training blocks Railway dyno CPU, causing WebSocket latency.
**Mitigation:** FL runs as a separate Railway service (or as a background job scheduled during low-traffic periods for the demo). For the demo, FL can be pre-trained and the panel shows a replay of training rounds.

---

## Sources

This document synthesizes established patterns from:
- FastAPI official WebSocket documentation and real-time examples
- InfluxDB OSS documentation (line protocol, Flux query language, retention policies)
- PyTorch Geometric documentation (graph construction, node classification)
- Flower (flwr) framework documentation (simulation mode, FedAvg strategy)
- Production patterns from energy grid monitoring systems (grid operator dashboards, SCADA-adjacent analytics layers) using architectures published by NREL, EPRI, and EnergyHub
- Common patterns in real-time ML serving systems (Uber Michelangelo, LinkedIn's real-time serving papers) adapted to the portfolio-scale use case

---

*Research complete. This document informs phase structure in the project roadmap.*
