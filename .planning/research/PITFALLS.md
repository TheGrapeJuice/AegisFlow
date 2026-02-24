# PITFALLS — AegisFlow Smart Grid ML Dashboard

**Research type:** Project Research — Pitfalls dimension
**Milestone:** Greenfield
**Date:** 2026-02-23
**Confidence:** High (domain-specific, stack-specific)

---

## Overview

This document catalogs the most likely failure modes for AegisFlow across its full stack. Each pitfall is specific to the intersection of smart grid simulation, real-time ML pipelines, and portfolio presentation. Generic "write tests" advice is excluded. Every pitfall is drawn from the specific tools in use: NREL/OPSD data, XGBoost, PyTorch Geometric, Flower FL, InfluxDB, FastAPI WebSockets, Mapbox GL JS, and D3.js.

Pitfalls are grouped by domain and tagged with the phase most likely to encounter them.

---

## Domain 1: Synthetic Data Generation (NREL/OPSD)

### P1.1 — Temporal leakage across train/test splits on time-series data

**What goes wrong:** Splitting NREL or OPSD time-series randomly (train_test_split with shuffle=True) instead of by time boundary. Features engineered from rolling windows (e.g., 15-minute rolling mean voltage) will contain future information in training samples, producing artificially inflated anomaly detection accuracy that collapses in production-like evaluation.

**Warning signs:**
- XGBoost anomaly detector accuracy > 95% on "test" set with no apparent effort
- Model performs perfectly on holdout but poorly when you shift the holdout window forward by a month
- Rolling-mean features computed before the split, not after

**Prevention:**
- Always split time-series by timestamp cutoff: all data before date X is train, after is test
- Compute all rolling/lag features inside a time-aware pipeline (e.g., sklearn `TimeSeriesSplit`) so features never look forward
- Log the train/test date boundaries in the model card; reviewers will ask

**Phase:** Phase 2 (XGBoost pipeline setup)

---

### P1.2 — Synthetic data that "looks" like grid data but has no physical constraints

**What goes wrong:** Generating voltage, frequency, and load readings by sampling distributions without enforcing grid physics (e.g., Kirchhoff's laws, load balance). The result is data where nodes fluctuate independently, making it trivially easy for ML models and producing visualizations that look wrong to any grid engineer.

**Warning signs:**
- Node voltages vary without correlation to neighboring nodes
- Frequency deviates at a single node while adjacent nodes stay at 60 Hz
- Load readings go negative without corresponding generation source

**Prevention:**
- Use NREL's SMART-DS synthetic grid topology datasets as the graph structure; generate readings that respect that topology
- Propagate fault injection: when injecting a storm event, voltage sag should ripple outward through the edge structure with realistic attenuation (e.g., 20% drop at source, 8% at two hops, 3% at three hops)
- For portfolio: include one diagram in the README showing how fault propagation was physically constrained — this is the question every smart grid interviewer will ask

**Phase:** Phase 1 (static data generation) and Phase 3 (GNN training data)

---

### P1.3 — OPSD data timezone and daylight-saving discontinuities

**What goes wrong:** OPSD datasets are in CET/CEST with DST transitions. Loading with `pd.read_csv()` and ignoring timezone creates duplicate timestamps (clock fallback) and missing hours (clock spring-forward). InfluxDB will either reject duplicates or silently overwrite them, corrupting the time-series.

**Warning signs:**
- InfluxDB write count doesn't match DataFrame row count
- Gaps in Recharts time-axis charts near late March or late October
- `df.index.is_monotonic_increasing` returns False after loading OPSD data

**Prevention:**
- Always localize OPSD data: `df.index = df.index.tz_localize('Europe/Berlin', ambiguous='infer').tz_convert('UTC')`
- Store everything in UTC in InfluxDB; convert to local time only at display layer
- Add an assertion: `assert df.index.is_monotonic_increasing` after loading

**Phase:** Phase 1 (data ingestion)

---

## Domain 2: XGBoost Anomaly Detection

### P2.1 — Treating anomaly detection as supervised classification when labels don't exist

**What goes wrong:** Framing the XGBoost model as binary classification (normal=0, anomaly=1) and generating balanced synthetic labels, then training on them. The resulting model learns to predict the synthetic label generation rule, not actual anomaly patterns. Portfolio reviewers who understand ML will immediately see through this if they ask "where did your labels come from?"

**Warning signs:**
- Labels are 50/50 balanced in a domain where anomalies should be <5% of readings
- The only anomaly source is the "Simulate Storm Event" button (no organic anomalies in historical data)
- Cannot explain the labeling methodology in an interview

**Prevention:**
- Use an isolation forest or ECOD as the unsupervised baseline for labeling, then use XGBoost on those pseudo-labels as a calibrated scorer
- OR: define rule-based labels (voltage deviation > 3σ from rolling 1-hour window = anomaly) and be explicit that XGBoost is learning a calibrated, feature-rich version of that rule
- Document the labeling strategy in the README; it's a feature not a bug to show you reasoned about it

**Phase:** Phase 2 (XGBoost model training)

---

### P2.2 — Feature engineering that ignores temporal autocorrelation

**What goes wrong:** Feeding raw instantaneous readings (voltage_t, frequency_t, load_t) to XGBoost without lag features, rolling statistics, or rate-of-change features. Grid anomalies manifest as temporal patterns (rapid sag + recovery, oscillation), not single-point outliers. A model without temporal features will miss the most interesting fault modes.

**Warning signs:**
- Model feature importance shows only raw readings, no lag or derivative features
- Anomaly detection triggers on isolated spikes but misses slow voltage sag (most common real fault type)
- Demo storm event injection (which should be detectable 2-5 steps after injection) isn't detected until peak deviation

**Prevention:**
- Minimum feature set: `[v_t, v_t-1, v_t-2, rolling_mean_15m, rolling_std_15m, dv/dt, load_v_ratio]` per node
- Add a "cascade risk" compound feature: number of neighbors with simultaneous deviation > 1σ
- Test detection latency: how many timesteps after fault injection does the model flag? Aim for ≤ 3 steps (15 min data)

**Phase:** Phase 2

---

### P2.3 — No model serialization or versioning strategy

**What goes wrong:** Saving the XGBoost model with `pickle` and loading it in the FastAPI endpoint with no version check. When you later upgrade scikit-learn or XGBoost, the pickle breaks silently or raises cryptic errors during the demo.

**Warning signs:**
- Model loading code has no try/except or version validation
- Model file is not committed to git (so live deployment uses a stale model)
- No model metadata (training date, feature list, hyperparameters) stored alongside the model file

**Prevention:**
- Use `model.save_model('xgb_model.ubj')` (XGBoost's native format) instead of pickle — it's version-stable
- Store a `model_meta.json` alongside: `{"trained_at": "...", "features": [...], "xgb_version": "...", "n_estimators": 100}`
- FastAPI startup: load model once into app state (`app.state.xgb_model`), not on every request

**Phase:** Phase 2 (model serving)

---

## Domain 3: PyTorch Geometric GNN for Graph-Structured Data

### P3.1 — GNN overfitting on a tiny synthetic graph with no regularization

**What goes wrong:** Training a GCN or GraphSAGE on a synthetic grid topology with 50–200 nodes for 200 epochs with no dropout, weight decay, or early stopping. The model achieves 100% training accuracy and generalizes to nothing. For cascade failure prediction, the model will always predict "high risk" or always predict "no cascade" depending on class imbalance.

**Warning signs:**
- Training loss reaches near-zero; validation loss diverges after epoch 20–30
- Model predicts the same class for all test nodes regardless of input
- `torch.unique(model(data).argmax(dim=1))` returns a single value

**Prevention:**
- Add dropout between GNN layers: `F.dropout(x, p=0.5, training=self.training)`
- Use weight decay in optimizer: `optimizer = Adam(model.parameters(), lr=0.01, weight_decay=5e-4)`
- Implement early stopping on validation loss with patience=10
- Use node-level cross-entropy with class weights to handle imbalanced cascade labels
- For portfolio: a learning curve plot (train vs. val loss over epochs) in the README shows you understand the problem

**Phase:** Phase 3 (GNN training)

---

### P3.2 — Wrong graph data object construction for heterogeneous grid topology

**What goes wrong:** Constructing the PyG `Data` object incorrectly — specifically, using edge indices that mix 0-indexed and 1-indexed node IDs (common when loading from NREL topology CSVs), or building directed edges when the grid is bidirectional. Message passing then fails silently: nodes at the periphery receive no messages from upstream neighbors.

**Warning signs:**
- Isolated nodes in the graph (node degree = 0 after building edge_index)
- `torch_geometric.utils.is_undirected(data.edge_index)` returns False for a bidirectional grid
- Cascade predictions show no spatial correlation — high-risk nodes are scattered randomly rather than clustered around the fault origin

**Prevention:**
- After building edge_index: `assert data.edge_index.max() < data.num_nodes`
- Explicitly add reverse edges: `data.edge_index = torch_geometric.utils.to_undirected(data.edge_index)`
- Visualize the graph before training: `networkx.draw(to_networkx(data))` — any isolated nodes are a data bug, not a model bug
- Add `edge_attr` with line impedance from the grid topology; it's a free signal that improves predictions and looks thorough on a resume

**Phase:** Phase 3

---

### P3.3 — Using GNN output directly as a deterministic cascade sequence without uncertainty

**What goes wrong:** The GNN outputs node-level cascade risk scores, and the frontend displays these as certain predictions ("Node 47 will fail at T+3 minutes"). This is both technically wrong (GNNs produce probability estimates, not deterministic predictions) and visually misleading. Interviewers with ML backgrounds will flag this as a fundamental misunderstanding.

**Warning signs:**
- Frontend displays exact failure times derived from a single forward pass
- No confidence interval or probability score shown alongside predictions
- "Cascade failure visualization" highlights nodes in a fixed sequence that never varies

**Prevention:**
- Display GNN outputs as risk probabilities, not binary predictions: "Node 47: 87% cascade risk"
- Use Monte Carlo dropout (keep `model.train()` during inference, run 30 forward passes, compute mean + std) for uncertainty quantification — this is a differentiating feature
- The cascade sequence should be stochastic: highest-probability nodes highlighted first, with slight randomness in tied-probability nodes to show it's probabilistic

**Phase:** Phase 3 + Phase 4 (frontend integration)

---

### P3.4 — Training on the same graph structure used for inference with no inductive generalization test

**What goes wrong:** The GNN trains and evaluates on the exact same grid topology it will inference on (transductive setting). This means the model has seen all nodes during training, which is fine operationally but is misleading in the portfolio if presented as a generalizable model. If an interviewer asks "what happens with a new grid topology?" and the answer is "retrain from scratch," that's a weakness.

**Warning signs:**
- No train/val split at the graph level (only node-level splits)
- Model architecture uses node ID embeddings (directly overfits to node identity)
- README claims the model "generalizes to new grids" with no evidence

**Prevention:**
- Use GraphSAGE (inductive) rather than vanilla GCN (transductive) — GraphSAGE aggregates neighborhood features without memorizing node IDs
- For the README: be precise. "Trained inductively on our synthetic ERCOT-topology grid; node features are physics-based so the architecture generalizes to same-feature-space topologies."
- Do NOT claim generalization you haven't tested

**Phase:** Phase 3

---

## Domain 4: Flower Federated Learning Simulation

### P4.1 — FL simulation that doesn't actually partition data across clients

**What goes wrong:** Implementing Flower FL where all three "utility clients" train on the same full dataset, just in parallel. The federated averaging then produces a model identical to centralized training. This is the most common FL simulation mistake and is immediately obvious to anyone familiar with FL.

**Warning signs:**
- Each client's training loss curve is identical to the others
- Global model accuracy equals what you'd get from centralized training
- Data partitioning code doesn't appear anywhere in the codebase

**Prevention:**
- Partition by geography or temporal region: Client 1 gets nodes 1–33 (Northeast region), Client 2 gets 34–66 (Southeast), Client 3 gets 67–100 (West)
- Use heterogeneous (non-IID) partitioning to simulate real-world data silos: clients have different load profiles and fault frequencies
- Show divergence: client 2 (Southeast, hurricane-prone) should have higher anomaly rate in local data
- Log per-client metrics separately in the FL panel; identical curves across clients is a red flag

**Phase:** Phase 4 (Flower FL integration)

---

### P4.2 — Flower strategy configuration that produces meaningless aggregation

**What goes wrong:** Using `FedAvg` with default settings where all clients send the full model every round regardless of data quantity. Clients with 10x more data than others contribute equally to the aggregate, violating the fundamental promise of federated averaging (weighted by client dataset size).

**Warning signs:**
- `FedAvg` strategy initialized with no `min_fit_clients`, `min_evaluate_clients`, or `fraction_fit` configuration
- All clients complete rounds in exactly the same time (suspicious for heterogeneous data sizes)
- Global model accuracy doesn't improve monotonically; it oscillates because small clients overwrite large-client updates

**Prevention:**
- Use `FedAvg` with weighted averaging: pass `num_examples` in client `fit()` return so Flower weights aggregation by data size
- Set `fraction_fit=1.0` (all clients participate every round) since you only have 3 — simulating dropouts requires more clients
- Add `FedProx` instead of pure `FedAvg` to handle client heterogeneity — it's a 2-line change in Flower and demonstrates awareness of FL literature

**Phase:** Phase 4

---

### P4.3 — FL panel in the UI that shows fake or pre-computed metrics

**What goes wrong:** The FL dashboard panel displays training round progress and accuracy that is either hardcoded or pre-computed from a previous run, not from a live Flower simulation. This is detectable during a demo if the interviewer asks to refresh or restart, and it fundamentally undermines the project's claim to be a real-time system.

**Warning signs:**
- FL metrics update at suspiciously regular intervals (every 5.000 seconds exactly)
- Restarting the backend resets FL panel to the same starting values immediately
- Accuracy always converges to the exact same value in the exact same number of rounds

**Prevention:**
- Run the Flower simulation in a FastAPI background task (`asyncio` task or `BackgroundTasks`) and stream round results via the existing WebSocket connection
- Store per-round metrics in InfluxDB with a `fl_round` tag; the frontend queries history on load and subscribes to new rounds via WebSocket
- Accept that FL simulation will be slow (3 clients × N rounds); cap rounds at 10 for demo purposes and make the round count configurable via a UI slider

**Phase:** Phase 4

---

### P4.4 — Confusing Flower simulation mode with actual distributed training

**What goes wrong:** Running all Flower clients in threads on the same machine (which is correct for simulation) but not understanding or explaining this distinction. If asked in an interview "is this actually federated?", an answer of "yes, each client runs independently" is misleading. Reviewers who know FL will ask about communication costs, differential privacy, and network topology.

**Warning signs:**
- README says "federated learning with 3 utility clients" without clarifying simulation context
- No mention of what would differ in a real deployment (separate machines, network latency, secure aggregation)
- Cannot explain why you chose simulation over actual distributed processes

**Prevention:**
- README and demo script must say: "Simulates federated learning using Flower's in-process simulation mode — in production, each client would run on a separate utility company's infrastructure"
- Add a "Limitations" section to the README that lists: no differential privacy, no secure aggregation, same machine simulation
- This honesty reads as engineering maturity, not weakness

**Phase:** Phase 4 + README/documentation

---

## Domain 5: InfluxDB Time-Series Storage

### P5.1 — Writing to InfluxDB synchronously in the FastAPI hot path

**What goes wrong:** Every incoming sensor reading triggers a synchronous `write_api.write()` call in the FastAPI request handler. At 100 nodes × 1 reading/second, this creates 100 sequential blocking writes per second, introducing latency that causes WebSocket message queuing and visible frontend lag.

**Warning signs:**
- WebSocket message delivery latency increases as simulation runs longer
- FastAPI `/metrics` endpoint response time > 200ms during active simulation
- InfluxDB CPU shows periodic spikes rather than smooth write throughput

**Prevention:**
- Use the InfluxDB Python client's batching write API: `write_api = client.write_api(write_options=ASYNCHRONOUS)` — this buffers writes and flushes in background threads
- Set batch size and flush interval appropriate to your throughput: `WriteOptions(batch_size=500, flush_interval=1000)` (500 points or 1 second, whichever comes first)
- Never block the FastAPI event loop on InfluxDB writes; use `asyncio.get_event_loop().run_in_executor()` if using the synchronous client

**Phase:** Phase 2 (data pipeline) and Phase 3 (live streaming)

---

### P5.2 — InfluxDB query returning raw line protocol instead of structured data

**What goes wrong:** Querying InfluxDB with Flux and returning the raw CSV response to the frontend without parsing. The frontend then tries to parse InfluxDB's multi-line CSV format (with annotation rows starting with `#`) as regular CSV, resulting in NaN values or parsing errors in Recharts.

**Warning signs:**
- Recharts time-axis charts show NaN or undefined data points
- Console errors: "Cannot read property 'value' of undefined" in chart components
- InfluxDB query response contains lines starting with `#datatype`, `#group`, `#default`

**Prevention:**
- Use the InfluxDB Python client's `query_api.query_data_frame()` which returns a clean pandas DataFrame, not raw CSV
- Or parse with `query_api.query()` and iterate records: `[{"time": r.get_time(), "value": r.get_value()} for r in result]`
- Write a single InfluxDB utility function used everywhere — never write raw Flux query strings in route handlers

**Phase:** Phase 2

---

### P5.3 — No retention policy causing InfluxDB to grow unboundedly during demo

**What goes wrong:** Running the simulation for a demo with no InfluxDB retention policy. At 100 nodes × 1 Hz for a 2-hour demo session, InfluxDB accumulates ~720,000 data points per session. Railway's persistent volume limit (512MB free tier) can be hit within days of running the demo, causing Railway deployment to fail.

**Warning signs:**
- `docker stats` or Railway metrics show InfluxDB container memory growing continuously
- InfluxDB data directory size > 100MB after a few demo sessions
- Railway deployment starts failing with disk space errors

**Prevention:**
- Set a retention policy at bucket creation: 7 days is sufficient for a demo (`retention_rules=[BucketRetentionRules(type="expire", every_seconds=604800)]`)
- Downsample: raw 1-second data kept for 24 hours, then aggregated to 1-minute averages for 7 days
- Document the retention policy in the README's architecture section — it shows operational awareness

**Phase:** Phase 1 (infrastructure setup)

---

## Domain 6: WebSocket Streaming Architecture

### P6.1 — WebSocket memory leak from unreleased connections on client disconnect

**What goes wrong:** FastAPI WebSocket handler adds each connection to a global `connections: list[WebSocket]` but never removes it when the client disconnects (browser tab close, network drop). Broadcasting to a dead connection raises `WebSocketDisconnect` or hangs, then the dead connection stays in the list forever. After 50+ disconnections, the list is full of zombie connections consuming memory.

**Warning signs:**
- Server memory usage grows monotonically over time with no natural ceiling
- Broadcasting latency increases as the demo runs longer
- `WebSocketDisconnect` exceptions in server logs that are caught but the connection is not removed
- Refreshing the browser adds a new connection without removing the old one

**Prevention:**
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.add(ws)

    def disconnect(self, ws: WebSocket):
        self.active_connections.discard(ws)  # discard never raises on missing

    async def broadcast(self, data: dict):
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        self.active_connections -= dead  # purge dead connections after broadcast
```
- Use a `set` not a `list` — O(1) discard vs O(n) list.remove
- Test by opening 10 browser tabs, closing them one by one, and verifying the connection count in the manager drops correctly

**Phase:** Phase 2 (WebSocket setup)

---

### P6.2 — Broadcasting full grid state every tick instead of delta updates

**What goes wrong:** Every second, the backend serializes all 100+ node readings plus edge states into JSON and broadcasts the full payload to every connected client. At 100 nodes × 15 fields × 1 Hz, that's ~15KB/second per client. With 2 clients connected, that's 30KB/s sustained. Over a 5-minute demo, this pushes 9MB of WebSocket traffic, causing visible chart lag on slower connections.

**Warning signs:**
- Network DevTools shows WebSocket frame size > 5KB for each message
- Recharts charts stutter or update with visible delay
- Frontend React component re-renders entire grid visualization on every message (not just changed nodes)

**Prevention:**
- Send only changed nodes: compare current readings to last-sent readings, broadcast only deltas where deviation > threshold
- Use binary MessagePack instead of JSON for the payload (msgpack-python on server, msgpack-js on client): ~60% size reduction
- Frontend: store full grid state in a Zustand store or useRef; WebSocket messages patch the store, not replace it
- For the portfolio demo specifically: 100 nodes is manageable with full updates if you keep the payload lean (3 fields per node: id, voltage, status)

**Phase:** Phase 2 (WebSocket) and Phase 4 (frontend optimization)

---

### P6.3 — WebSocket reconnection logic absent from the frontend

**What goes wrong:** The React frontend opens a WebSocket connection once at mount and never handles disconnection. When Railway cold-starts the backend (free tier sleeps after 5 minutes of inactivity), the WebSocket drops and the dashboard shows stale data with no indication to the user. Interviewers seeing the demo after the backend has been sleeping will see a broken dashboard.

**Warning signs:**
- WebSocket `onclose` handler is empty or missing
- Dashboard goes blank or shows last-known data indefinitely after network interruption
- No visual indicator of connection status (connected/reconnecting/disconnected)

**Prevention:**
- Implement exponential backoff reconnection:
```javascript
const connectWebSocket = (retryDelay = 1000) => {
  const ws = new WebSocket(WS_URL);
  ws.onclose = () => {
    setConnectionStatus('reconnecting');
    setTimeout(() => connectWebSocket(Math.min(retryDelay * 2, 30000)), retryDelay);
  };
  ws.onopen = () => setConnectionStatus('connected');
  return ws;
};
```
- Show a connection status badge in the header: green dot (connected), yellow (reconnecting), red (disconnected)
- This is a portfolio differentiator: most portfolio WebSocket demos have no reconnection logic

**Phase:** Phase 2 (frontend)

---

### P6.4 — Synchronous ML inference blocking the WebSocket broadcast loop

**What goes wrong:** The backend broadcast loop calls XGBoost inference and GNN inference synchronously inside the async WebSocket send loop. GNN inference on PyTorch Geometric can take 50–500ms depending on graph size. This blocks the event loop, causing all WebSocket clients to receive updates at 0.5–1 second intervals instead of the target 1 Hz, and FastAPI's other routes become unresponsive during inference.

**Warning signs:**
- WebSocket messages arrive in bursts (several at once) rather than smoothly
- FastAPI `/health` endpoint times out during active simulation
- `asyncio` warning: "coroutine took X seconds, consider using run_in_executor"

**Prevention:**
- Run all ML inference in a ThreadPoolExecutor (CPU-bound work):
```python
loop = asyncio.get_event_loop()
xgb_result = await loop.run_in_executor(executor, xgb_model.predict, features)
gnn_result = await loop.run_in_executor(executor, run_gnn_inference, graph_data)
```
- Decouple the inference loop from the broadcast loop: inference writes results to an in-memory buffer; broadcast loop reads from that buffer at its own cadence
- For portfolio demo: pre-compute GNN inference results for the storm event sequence and cache them — real-time GNN inference at 1 Hz on a Railway free-tier container is unrealistic

**Phase:** Phase 3 (GNN integration) and Phase 4 (optimization)

---

## Domain 7: Mapbox GL JS + D3.js Visualization

### P7.1 — Mapbox billing surprise from a public-facing deployment with no token restrictions

**What goes wrong:** Deploying the Vercel frontend with an unrestricted Mapbox public token. Mapbox's free tier is 50,000 map loads/month. A portfolio link shared on LinkedIn or in a resume can exceed this in hours if it goes viral or is crawled. Mapbox charges $0.50 per 1,000 loads over the free tier — a crawled deployment can incur hundreds of dollars overnight.

**Warning signs:**
- Mapbox token is committed to the git repo (public or private)
- Token has no URL restrictions in Mapbox account settings
- No Mapbox usage alert configured in the Mapbox account dashboard

**Prevention:**
- In Mapbox account settings: restrict the public token to `https://your-vercel-deployment.vercel.app` — requests from any other origin will be rejected
- Set a spending limit of $0 in Mapbox billing settings (this disables the account after free tier, but prevents surprise charges)
- Add the token to Vercel environment variables, NOT to the frontend code or git repo
- Monitor: set up a Mapbox monthly budget alert at 80% of free tier

**Phase:** Phase 1 (infrastructure), before any deployment

---

### P7.2 — D3.js graph overlay desynchronized from Mapbox map during pan/zoom

**What goes wrong:** Rendering the D3.js grid network overlay as an SVG positioned absolutely over the Mapbox canvas. When the user pans or zooms the map, Mapbox moves the underlying tiles but the D3 SVG stays fixed, causing nodes and edges to drift away from their geographic positions. This is visually broken and immediately obvious.

**Warning signs:**
- Panning the map causes the node dots to stay in place while map tiles move
- After zoom, edge lines no longer connect the nodes they should
- D3 SVG element has `position: absolute; top: 0; left: 0` with no transform on pan/zoom

**Prevention:**
- Use Mapbox's custom layer API for the D3 overlay, not absolute positioning:
```javascript
map.on('render', () => {
  nodes.attr('cx', d => map.project([d.lng, d.lat]).x)
       .attr('cy', d => map.project([d.lng, d.lat]).y);
});
```
- Re-project all D3 elements on every `map.on('render')` event — this fires after pan, zoom, and rotation
- Alternatively: use Mapbox GL's built-in GeoJSON source + circle/line layers for static nodes/edges, reserve D3 only for dynamic chart elements (voltage sparklines, risk indicators)

**Phase:** Phase 1 (map setup)

---

### P7.3 — Mapbox style causing node/edge layers to render under tile labels

**What goes wrong:** Adding custom Mapbox layers (for power nodes and distribution lines) without specifying a `before` layer ID. By default, custom layers render at the top of the layer stack, above all tile labels. Grid node dots appear on top of city name labels, making the map illegible in urban grid regions.

**Warning signs:**
- City and street name labels are hidden under grid node circles
- Edge lines cut across POI labels
- Map looks "dirty" — nodes appear to float over text

**Prevention:**
- Always insert custom layers before the first symbol layer:
```javascript
const firstSymbolLayer = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
map.addLayer(edgeLayer, firstSymbolLayer);
map.addLayer(nodeLayer, firstSymbolLayer);
```
- Use semi-transparent fills for node circles so underlying labels remain readable
- Test at multiple zoom levels; the layer ordering issue is most visible at zoom 10–13 (city scale)

**Phase:** Phase 1 (map setup)

---

### P7.4 — Cascade failure animation that runs to completion on every WebSocket message

**What goes wrong:** The cascade failure visualization re-triggers the full D3 animation sequence (sequential node highlighting with timing) on every incoming WebSocket message, even messages that don't change the cascade state. Result: the animation restarts every second, nodes flicker, and the visualization never actually builds up the "chain of failure" narrative that makes it compelling.

**Warning signs:**
- Node highlight animation resets every ~1 second
- Cannot see the cascade "spread" — it appears to teleport rather than propagate
- D3 `transition()` calls are nested inside the WebSocket `onmessage` handler

**Prevention:**
- Gate cascade animation on state change, not on message receipt:
```javascript
ws.onmessage = (event) => {
  const newState = JSON.parse(event.data);
  if (newState.cascadeSequence !== prevCascadeSequence) {
    runCascadeAnimation(newState.cascadeSequence);
    prevCascadeSequence = newState.cascadeSequence;
  }
  updateNodeColors(newState.nodeRisks); // this can run every tick
};
```
- Separate concerns: high-frequency node risk updates (every tick) vs. low-frequency cascade sequence updates (only on storm event trigger)
- The cascade animation should run once per storm event, not continuously

**Phase:** Phase 3 (GNN integration) and Phase 4 (visualization)

---

## Domain 8: Portfolio-Specific Pitfalls (Reviewer Perception)

### P8.1 — Architecture diagram that doesn't match the actual implementation

**What goes wrong:** Drawing an architecture diagram at the start of the project showing the ideal system, then building something different (simpler, or differently connected), but never updating the diagram. Reviewers who look at both the README and the code will notice the mismatch and mark it as a red flag — it signals either poor documentation hygiene or deliberate obfuscation.

**Warning signs:**
- Architecture diagram shows "Kafka message queue" but codebase has no Kafka
- Diagram shows "3 separate FL client services" but all FL runs in one Python process
- Component names in the diagram don't match component names in the code

**Prevention:**
- Build the architecture diagram last, or update it at the end of each phase
- Diagram should show what's actually built, not what was planned — add a "Possible Extensions" section for aspirational components
- Use draw.io or Excalidraw and commit the source file, not just the export

**Phase:** All phases; final check before demo recording

---

### P8.2 — Demo video that shows the happy path without explaining any decisions

**What goes wrong:** A 2-minute demo video that only shows the visual output — clicking "Simulate Storm Event," watching nodes turn red, watching the cascade animation — without any narration about why the system is built the way it is. Interviewers who watch the video get visuals but no signal about engineering depth. The video is most useful as a conversation starter; it should raise questions the interviewer wants to ask.

**Warning signs:**
- Demo script has no voiceover or text callouts explaining decisions
- Video doesn't mention the tech stack at all
- No moment where a design trade-off is acknowledged (e.g., "I used GraphSAGE here because it supports inductive inference, which is important if this scaled to new grid topologies")

**Prevention:**
- Structure the demo video: 30s visual hook → 60s technical walkthrough (mention 3 specific technical decisions) → 30s "what I'd do next" (shows self-awareness)
- Include one moment that shows something "going wrong" and being handled: the reconnection badge appearing when the backend is paused, for example
- Record at 1920x1080, use OBS or Loom, keep narration concise

**Phase:** Final phase (demo recording)

---

### P8.3 — Deploying on free tiers with no cold-start mitigation

**What goes wrong:** Railway free tier spins down after 5 minutes of inactivity. When a recruiter or interviewer clicks the live URL after it's been idle, the backend takes 30–60 seconds to cold-start, WebSocket connection fails, and the dashboard shows a broken state. This creates a terrible first impression that undermines the entire project.

**Warning signs:**
- Live URL works during active development but shows broken dashboard when accessed fresh
- WebSocket status badge shows "disconnected" on initial load before reconnecting
- InfluxDB container also needs to restart (adds additional latency)

**Prevention:**
- Add a `/health` endpoint to FastAPI and a simple cron job (cron-job.org, free tier) that pings it every 4 minutes to prevent Railway sleep
- Alternatively: deploy the backend on Railway's Starter plan ($5/month) which doesn't sleep — the cost is worth it for a portfolio project that's actively being shared
- Add a loading state to the dashboard that says "Connecting to grid..." with a spinner while the WebSocket handshake completes — this makes the cold-start feel intentional rather than broken

**Phase:** Phase 5 (deployment)

---

### P8.4 — Claiming "real-time" without defining what real-time means

**What goes wrong:** The README and demo script say "real-time ML anomaly detection" and "real-time cascade failure prediction." If the system actually runs inference every 5 seconds, has 2-second WebSocket latency, and the GNN takes 500ms per forward pass, a technically literate reviewer will ask what "real-time" means here. Without a clear answer, this erodes trust.

**Warning signs:**
- README uses "real-time" more than twice without defining the latency target
- No measurement of end-to-end latency (sensor reading → anomaly flag → WebSocket → frontend update)
- System cannot maintain 1 Hz update rate consistently

**Prevention:**
- Define it in the README: "Real-time here means end-to-end latency from synthetic sensor update to UI visualization under 500ms at 1 Hz update rate, measured over a 5-minute simulation run."
- Add a simple latency measurement: timestamp on the outgoing WebSocket message; frontend logs receipt time and logs the delta
- If actual latency is 2 seconds, say "near real-time" — honesty is better than a claim you can't defend

**Phase:** Phase 4 (integration testing) and README

---

## Summary: Pitfall Priority by Phase

| Phase | Highest-Priority Pitfalls |
|-------|--------------------------|
| Phase 1 (Foundation) | P1.3 (OPSD timezones), P5.3 (InfluxDB retention), P7.1 (Mapbox billing), P7.2 (D3/Mapbox sync), P7.3 (layer ordering) |
| Phase 2 (XGBoost + WebSocket) | P1.1 (temporal leakage), P2.1 (labeling strategy), P2.2 (feature engineering), P5.1 (async InfluxDB writes), P6.1 (WebSocket memory leak), P6.3 (reconnection logic) |
| Phase 3 (GNN) | P1.2 (grid physics), P3.1 (GNN overfitting), P3.2 (graph data construction), P3.3 (deterministic predictions), P3.4 (inductive vs. transductive), P6.4 (ML inference blocking) |
| Phase 4 (Flower FL) | P4.1 (data partitioning), P4.2 (FedAvg configuration), P4.3 (fake FL metrics), P4.4 (simulation honesty), P6.2 (delta updates), P7.4 (cascade animation) |
| Phase 5 (Deployment + Demo) | P2.3 (model serialization), P5.2 (InfluxDB query parsing), P8.1 (architecture diagram), P8.2 (demo video depth), P8.3 (cold-start mitigation), P8.4 (real-time claims) |

---

*Generated: 2026-02-23 | Stack: NREL/OPSD + XGBoost + PyTorch Geometric + Flower + InfluxDB + FastAPI + WebSocket + Mapbox GL JS + D3.js*
