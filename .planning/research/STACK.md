# STACK.md — Aegis Flow: AI-Powered Smart Grid Management Dashboard

**Research Type:** Stack Dimension — Greenfield Project
**Date:** 2026-02-23
**Researcher:** GSD Project Researcher (Claude Sonnet 4.6)
**Knowledge Cutoff:** August 2025
**Downstream Consumer:** Roadmap creation (ROADMAP.md)

---

> **Version Verification Notice:** All versions below are sourced from training data (cutoff August 2025). Before pinning to `package.json` / `pyproject.toml`, verify against PyPI, npm, and GitHub releases. Flagged with [VERIFY] where drift risk is highest.

---

## Executive Summary

The proposed stack (Mapbox GL JS, D3.js, PyTorch Geometric, Flower, InfluxDB, FastAPI) is **well-chosen and defensible** for a 2025 smart grid ML dashboard. Most choices remain the dominant solution in their category. Key recommendations:

- **Keep:** FastAPI, InfluxDB 3.x, PyTorch Geometric, Flower 1.x, React 19, D3.js v7
- **Reconsider:** Mapbox GL JS (licensing cost — evaluate MapLibre GL JS as a zero-cost alternative)
- **Add:** React Query v5 (server-state), Zustand (client-state), Celery + Redis (async ML jobs), Pydantic v2 (API validation)
- **Watch:** PyTorch 2.x + PyG compatibility matrix is the highest-risk compatibility surface in this stack

---

## 1. Frontend Layer

### 1.1 Core Framework

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| React | 19.x | HIGH | Stable as of Dec 2024 |
| TypeScript | 5.4.x | HIGH | Stable |
| Vite | 5.x | HIGH | De-facto React build tool |
| React Router | 6.x | HIGH | Stable |

**React 19** — WHY: Concurrent rendering, server actions, and the new `use()` hook are relevant for streaming real-time WebSocket data into UI trees without cascading re-renders. The upgrade from 18 → 19 is the correct greenfield choice.

**TypeScript 5.4** — WHY: Strict mode catches the inevitable `undefined` bugs in real-time sensor data pipelines. Mandatory for a production grid system.

**Vite 5** — WHY: Rollup-based, substantially faster than CRA (dead) or Webpack for dev iteration. Native ESM. Use `vite-plugin-pwa` if progressive loading of the map during poor connectivity is needed.

**AVOID:** Create React App (unmaintained since 2023), Next.js (SSR overhead is unnecessary for a dashboard that is fully auth-gated and data-driven client-side — adds deployment complexity with no user benefit).

---

### 1.2 Map Visualization

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| MapLibre GL JS | 4.x | HIGH | Recommended over Mapbox |
| Mapbox GL JS | 3.x | MEDIUM | Viable but costly |
| deck.gl | 9.x | HIGH | For high-density grid overlays |

**PRIMARY RECOMMENDATION: MapLibre GL JS 4.x** — WHY: MapLibre is the open-source fork of Mapbox GL JS v1, maintained by a Linux Foundation project. For a grid monitoring dashboard with potentially thousands of sensor nodes rendered as overlays, the Mapbox pricing model (pay-per-tile-load) creates unpredictable production costs. MapLibre is API-compatible with Mapbox GL JS (same WebGL renderer architecture), uses open tile sources (OpenMapTiles, self-hosted PMTiles), and version 4.x introduced significant performance improvements for large datasets. The migration cost from Mapbox → MapLibre is minimal at greenfield.

**IF MAPBOX GL JS IS REQUIRED** (e.g., client mandates Mapbox Studio workflows or specific Mapbox-hosted tilesets): Use 3.x. Be aware of the proprietary license change from v2 onward — commercial use requires a paid account. [VERIFY current pricing tier]

**deck.gl 9.x** — WHY: Layer on top of MapLibre/Mapbox for rendering 10,000+ grid nodes, transmission lines, and anomaly heatmaps without performance degradation. The `ScatterplotLayer`, `ArcLayer`, and `HeatmapLayer` are directly applicable to grid topology visualization. deck.gl is the right tool for the data-density this project will hit; D3 alone will struggle above ~1,000 SVG elements.

**AVOID:** Leaflet.js (Canvas/SVG, not WebGL — inadequate for real-time animated grid overlays at scale), Google Maps API (cost, proprietary, less control over tile styling for utility aesthetics).

---

### 1.3 Charting and Data Visualization

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| D3.js | 7.9.x | HIGH | Stable, no v8 yet |
| Recharts | 2.x | MEDIUM | For standard time-series panels |
| Visx | 3.x | MEDIUM | Airbnb's D3+React wrapper |

**D3.js v7.x** — WHY: Mandatory for custom grid topology graphs (force-directed network layouts of substations and feeders), custom anomaly overlays, and bespoke time-series brushing. D3 v7 is the current stable major; no v8 has been released as of Aug 2025. Use D3 only for custom visualizations — for standard line/bar charts in dashboard panels, use a React-native chart library instead to avoid the D3-DOM/React-DOM reconciliation conflict.

**Recharts 2.x** — WHY: When you need standard time-series power-flow charts (voltage, frequency, load curves) inside React component trees, Recharts is the lowest-friction option. It is a thin React wrapper around D3 scales, fully declarative, and handles responsive sizing automatically.

**AVOID:** Chart.js (Canvas-only, poor React integration), Highcharts (commercial license for non-open-source use), Victory (performance issues at update rates needed for real-time grid data).

---

### 1.4 State Management and Data Fetching

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| Zustand | 4.x | HIGH | Lightweight client state |
| TanStack Query (React Query) | 5.x | HIGH | Server state + WebSocket |
| Immer | 10.x | MEDIUM | Immutable state helpers |

**Zustand 4.x** — WHY: For a real-time dashboard, Redux's boilerplate-to-value ratio is poor. Zustand provides a minimal, hook-based store with zero boilerplate. Critical for managing WebSocket connection state, alert queues, and UI preferences without Redux overhead.

**TanStack Query 5.x** — WHY: The `useQuery` / `useMutation` pattern cleanly separates REST API calls (model inference results, historical data) from the WebSocket streaming layer. v5 introduced a reworked API that is more TypeScript-friendly and supports streaming queries natively.

**AVOID:** Redux Toolkit (viable but over-engineered for a dashboard — use only if team already has Redux expertise and a multi-app state-sharing requirement), MobX (reactive paradigm conflicts with React's mental model in large teams), SWR (less feature-complete than TanStack Query for this use case).

---

### 1.5 WebSocket Client

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| Native WebSocket API | Browser native | HIGH | Sufficient |
| Socket.IO client | 4.x | LOW | Avoid — see below |

**Native WebSocket API** — WHY: FastAPI's WebSocket support is built on the native protocol. Socket.IO adds a proprietary handshake layer that complicates the FastAPI integration (requires `python-socketio` and `uvicorn` coordination that is friction-heavy). For a controlled dashboard (no public client diversity), native WebSocket is simpler, faster, and fully sufficient.

**Reconnect handling:** Use a thin custom hook (`useWebSocket`) or the `reconnecting-websocket` library for exponential backoff. This is a ~50-line solution that avoids a full Socket.IO dependency.

---

## 2. Backend Layer

### 2.1 API Framework

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| FastAPI | 0.111.x | HIGH | Stable |
| Uvicorn | 0.30.x | HIGH | ASGI server |
| Pydantic | 2.7.x | HIGH | Data validation — v2 mandatory |
| Gunicorn | 22.x | MEDIUM | Production process manager |

**FastAPI 0.111.x** — WHY: The correct choice for this stack. ASGI-native means WebSocket support is first-class, not bolted on. Automatic OpenAPI documentation reduces integration friction. Performance is competitive with Go for I/O-bound workloads (which grid telemetry ingestion is). The async ecosystem (`asyncio`, `anyio`) aligns with InfluxDB's async client.

**Pydantic v2** — CRITICAL: Pydantic v1 is EOL. FastAPI 0.100+ requires Pydantic v2. The v2 rewrite (Rust-backed core) provides 5-50x validation speedup, which matters for high-frequency telemetry ingestion. Do not use Pydantic v1 — it will create dependency conflicts with FastAPI 0.100+.

**AVOID:** Django REST Framework (synchronous WSGI by default — requires ASGI adapter for WebSocket; heavy ORM adds complexity when the primary datastore is InfluxDB, not a relational DB), Flask (no native async, WebSocket requires Flask-SocketIO workarounds).

---

### 2.2 Async Task Queue (ML Inference Jobs)

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| Celery | 5.4.x | HIGH | Async ML job queue |
| Redis | 7.x | HIGH | Celery broker + result backend |
| Flower (Celery monitor) | 2.x | LOW | Name collision — see note |

**WHY a task queue is needed:** XGBoost and GNN inference jobs are CPU/GPU-bound and must not block the FastAPI event loop. The pattern is: WebSocket receives telemetry → FastAPI dispatches inference task to Celery → Celery worker runs model → result published back via Redis pub/sub → FastAPI WebSocket pushes result to frontend. Without this, a single slow inference call blocks all WebSocket connections.

**Note on naming:** "Flower" the Celery monitoring tool (`flower` on PyPI) is different from "Flower" the federated learning framework (`flwr` on PyPI). Both are in this stack — use distinct references.

**AVOID:** FastAPI BackgroundTasks for ML inference (runs in the same process, blocks event loop under load), Dramatiq (smaller ecosystem, less mature than Celery for ML pipelines), RQ (simpler but lacks Celery's retry policies and routing needed for GPU-aware task dispatch).

---

### 2.3 ML — Anomaly Detection (Tabular)

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| XGBoost | 2.1.x | HIGH | Stable |
| scikit-learn | 1.5.x | HIGH | Preprocessing pipelines |
| SHAP | 0.45.x | MEDIUM | Explainability |
| joblib | 1.4.x | HIGH | Model serialization |

**XGBoost 2.1.x** — WHY: The right choice for tabular anomaly detection on grid sensor data (voltage deviation, frequency deviation, load imbalance). GPU support via `device='cuda'` is native in XGBoost 2.x (no separate `xgboost-gpu` package needed). The `hist` tree method with GPU acceleration is 10-50x faster than CPU for the dataset sizes expected in a city-scale grid deployment. XGBoost 2.x also introduced multi-output support, useful for simultaneously predicting multiple fault types.

**SHAP 0.45.x** — WHY: Explainability is non-negotiable for utility operators. SHAP TreeExplainer works natively with XGBoost and provides fast Shapley values for real-time feature attribution (explaining WHY an anomaly was flagged). This is a regulatory and operational requirement in grid management contexts.

**AVOID:** LightGBM (viable alternative but XGBoost has better ecosystem integration and GPU performance for this use case; mixing both creates maintenance overhead), CatBoost (slower GPU training, smaller community).

---

### 2.4 ML — Graph Neural Network (Grid Topology)

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| PyTorch | 2.3.x | HIGH | Base framework |
| PyTorch Geometric | 2.5.x | HIGH | GNN library |
| torch-scatter | 2.1.x | HIGH | Required PyG dependency |
| torch-sparse | 0.6.x | HIGH | Required PyG dependency |
| NetworkX | 3.3.x | HIGH | Graph preprocessing |

**PyTorch 2.3.x + PyTorch Geometric 2.5.x** — WHY: GNNs are the correct architecture for grid fault propagation modeling. Grid topology is inherently a graph (nodes = substations/buses, edges = transmission lines), and message-passing neural networks (MPNN) naturally encode the electrical adjacency relationships. PyG's `GCNConv`, `GATConv` (Graph Attention Network), and `GraphSAGE` are all applicable depending on whether the grid graph is homogeneous or heterogeneous.

**CRITICAL COMPATIBILITY WARNING — HIGHEST RISK IN THIS STACK:**

PyTorch Geometric has a strict dependency on specific PyTorch versions. As of PyG 2.5.x:
- Requires PyTorch 2.1.x, 2.2.x, or 2.3.x (NOT 2.4+ without corresponding PyG update)
- `torch-scatter` and `torch-sparse` must be built against the EXACT same PyTorch version and CUDA version
- Installation must use the PyG-specific index: `pip install pyg_lib torch_scatter torch_sparse -f https://data.pyg.org/whl/torch-{VERSION}+{CUDA}.html`

**Failure mode:** Installing PyG with `pip install torch-geometric` alone will install a version without pre-compiled C++ extensions, causing silent fallback to slow pure-Python scatter operations that make GNN training 10-100x slower. Always install from the PyG wheel index.

**[VERIFY]** Check https://pytorch-geometric.readthedocs.io/en/latest/notes/installation.html for the current compatibility matrix before pinning versions.

**AVOID:** DGL (Deep Graph Library — viable alternative but smaller community for power systems research; most published grid GNN papers use PyG), Spektral (Keras/TensorFlow-based; mixing PyTorch + TensorFlow in one backend is a maintenance burden).

---

### 2.5 ML — Federated Learning

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| Flower (flwr) | 1.8.x | HIGH | Stable production release |
| flwr-nightly | — | AVOID | Unstable |

**Flower (flwr) 1.8.x** — WHY: Flower is the dominant federated learning framework for production deployments in 2025. The key features for a grid deployment:

1. **Strategy flexibility:** Built-in `FedAvg`, `FedProx`, `FedOpt` strategies. `FedProx` is particularly relevant for grid deployments where regional substations may have heterogeneous data distributions (non-IID) — it adds a proximal term to handle client drift.
2. **Framework agnosticism:** Flower wraps XGBoost AND PyTorch models with the same client interface, allowing federated training of both the anomaly detector and the GNN.
3. **gRPC communication:** Flower uses gRPC for server-client communication, which is more efficient than HTTP/1.1 for the parameter exchange volumes in GNN federated training.

**Architectural note:** In the Aegis Flow context, "federated clients" likely represent regional grid operators or utility companies sharing anomaly detection models without sharing raw grid data (privacy-preserving). Each client trains locally on their subregion's telemetry; Flower aggregates model weights on a central server. This is the correct use case for Flower.

**COMPATIBILITY NOTE:** Flower 1.x introduced a significant API redesign (the `ClientApp` / `ServerApp` abstraction) compared to 0.x. Ensure all tutorials and examples are sourced from Flower 1.x documentation — 0.x examples are widely indexed but incompatible.

**AVOID:** PySyft (OpenMined — less stable, more research-oriented, API has changed frequently), TensorFlow Federated (TFF — requires TensorFlow, conflicts with PyTorch; no cross-framework support).

---

### 2.6 Data Layer — Time-Series Database

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| InfluxDB | 3.x (Cloud or OSS) | HIGH | Correct choice |
| influxdb-client-python | 1.44.x | HIGH | Python client |
| influxdb3-python | 0.x | MEDIUM | New v3-native client [VERIFY] |

**InfluxDB 3.x** — WHY: InfluxDB is the correct choice for grid telemetry. Key reasons:
- **Native time-series compression:** 10-100x compression vs PostgreSQL for time-stamped float data (voltage, current, frequency readings every 100ms per node)
- **Flux / InfluxQL query language:** Purpose-built for time-range queries, downsampling, and moving-window aggregations needed for anomaly baseline computation
- **Continuous queries / Tasks:** Built-in scheduled downsampling (e.g., raw 100ms → 1s → 1min retention tiers) without external cron jobs
- **InfluxDB 3.x (Apache Arrow / DataFusion):** The v3 rewrite uses Apache Arrow for storage (columnar) and DataFusion for query execution, giving SQL support alongside InfluxQL and dramatically better performance for analytical queries (e.g., training data extraction for ML)

**IMPORTANT — OSS vs Cloud:**
- **InfluxDB OSS 2.x** is the current self-hosted stable release (v3 OSS may be in limited availability as of Aug 2025 — [VERIFY])
- **InfluxDB Cloud Serverless** runs on v3 architecture
- If self-hosting, use InfluxDB OSS 2.7.x as the safe choice; plan migration to v3 when OSS v3 stabilizes

**Python client:** `influxdb-client-python` for InfluxDB 2.x, `influxdb3-python` for v3. Do not mix — they use different APIs and authentication methods.

**AVOID:** TimescaleDB (PostgreSQL extension — correct for relational+time-series hybrid but adds PostgreSQL management overhead when pure time-series is needed; better fit if the project had complex relational joins), ClickHouse (excellent OLAP performance but no native time-series semantics; would require manual retention policy management), Prometheus (pull-based metrics system designed for infrastructure monitoring, not high-frequency industrial sensor data).

---

### 2.7 Message Broker / Streaming

| Library | Recommended Version | Confidence | Status |
|---------|-------------------|------------|--------|
| Redis | 7.x | HIGH | Primary broker |
| Apache Kafka | 3.7.x | MEDIUM | If scale demands it |

**Redis 7.x (primary recommendation)** — WHY: Redis serves dual purpose in this stack: (1) Celery broker for ML job queuing, (2) pub/sub channel for WebSocket fan-out (when multiple FastAPI workers need to broadcast the same anomaly alert to all connected dashboard clients). Redis Streams (native in Redis 5+) provide a lightweight Kafka-like log for sensor data buffering without Kafka's operational overhead.

**Apache Kafka 3.7.x (scale threshold)** — WHY to consider: If the deployment reaches >10,000 grid nodes pushing 100ms telemetry (= 100,000 messages/second), Redis pub/sub will become a bottleneck. Kafka provides durable, partitioned, replicated event streaming at that scale. Kafka Connect has native InfluxDB sink connectors. The decision point: start with Redis; add Kafka if throughput profiling shows Redis saturation.

**AVOID:** RabbitMQ (AMQP — correct for microservices but Redis is simpler for this tightly-coupled architecture), AWS Kinesis / Azure Event Hubs (vendor lock-in; acceptable if deployment is cloud-native).

---

## 3. Infrastructure and DevOps

### 3.1 Containerization and Orchestration

| Tool | Recommended Version | Confidence |
|------|-------------------|------------|
| Docker | 26.x | HIGH |
| Docker Compose | 2.27.x | HIGH |
| Kubernetes | 1.30.x | MEDIUM |
| Helm | 3.x | MEDIUM |

**Docker Compose** for development and small deployments. Kubernetes for production multi-region grid deployments (where federated learning clients map to separate k8s clusters per regional operator). Helm charts for standardized deployment of the FastAPI + Celery + Redis + InfluxDB + Flower server components.

---

### 3.2 ML Model Serving

| Tool | Recommended Version | Confidence |
|------|-------------------|------------|
| MLflow | 2.13.x | HIGH |
| BentoML | 1.2.x | MEDIUM |

**MLflow 2.13.x** — WHY: Model registry, experiment tracking, and artifact storage for XGBoost and PyG models. Critical for tracking which model version is deployed to production and rolling back if a federated round produces a degraded model. MLflow's built-in model serving (`mlflow models serve`) is acceptable for initial deployment; replace with BentoML or Triton for production inference throughput requirements.

---

## 4. Full Stack Version Pinning Reference

### 4.1 Frontend `package.json` (key dependencies)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.4.0",
    "maplibre-gl": "^4.0.0",
    "@deck.gl/core": "^9.0.0",
    "@deck.gl/layers": "^9.0.0",
    "d3": "^7.9.0",
    "recharts": "^2.12.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.40.0",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@types/react": "^19.0.0",
    "@types/d3": "^7.4.0"
  }
}
```

### 4.2 Backend `pyproject.toml` (key dependencies)

```toml
[tool.poetry.dependencies]
python = "^3.11"

# API
fastapi = "^0.111.0"
uvicorn = {extras = ["standard"], version = "^0.30.0"}
pydantic = "^2.7.0"
gunicorn = "^22.0.0"

# Database
influxdb-client = "^1.44.0"
redis = "^5.0.0"

# Task Queue
celery = {extras = ["redis"], version = "^5.4.0"}

# ML — Tabular
xgboost = "^2.1.0"
scikit-learn = "^1.5.0"
shap = "^0.45.0"
joblib = "^1.4.0"

# ML — GNN (install separately via PyG wheel index — see note)
# torch = "2.3.0"
# torch-geometric = "2.5.0"
# torch-scatter = "2.1.0"  # Must match torch version
# torch-sparse = "0.6.18"  # Must match torch version

# Federated Learning
flwr = {extras = ["simulation"], version = "^1.8.0"}

# Utilities
numpy = "^1.26.0"
pandas = "^2.2.0"
mlflow = "^2.13.0"
httpx = "^0.27.0"  # Async HTTP client for internal service calls
```

**PyTorch / PyG installation note — must be separate step:**
```bash
# Install PyTorch first with CUDA support
pip install torch==2.3.0 torchvision==0.18.0 --index-url https://download.pytorch.org/whl/cu121

# Then install PyG extensions from the PyG wheel index
pip install torch-scatter torch-sparse torch-cluster torch-spline-conv \
  -f https://data.pyg.org/whl/torch-2.3.0+cu121.html

# Then install PyG itself
pip install torch-geometric==2.5.0
```

---

## 5. Compatibility Matrix and Known Issues

### 5.1 Critical Compatibility Constraints

| Constraint | Risk Level | Notes |
|------------|-----------|-------|
| PyTorch ↔ PyG ↔ CUDA version triangle | CRITICAL | All three must match exactly; verify at https://pytorch-geometric.readthedocs.io |
| Pydantic v1 vs v2 in FastAPI | HIGH | FastAPI 0.100+ requires Pydantic v2; pydantic v1 imports will silently break |
| Python version for Flower | MEDIUM | Flower 1.x requires Python 3.8+; recommended 3.11 for performance |
| InfluxDB 2.x vs 3.x client API | MEDIUM | `influxdb-client` and `influxdb3-python` are not interchangeable |
| React 19 breaking changes | MEDIUM | React 19 removed several deprecated APIs; audit any third-party component libraries |
| deck.gl + MapLibre peer dependency | LOW | deck.gl 9.x supports MapLibre 4.x; verify in deck.gl peerDependencies |

### 5.2 Dependency Conflict Scenarios

**Scenario 1: XGBoost + PyTorch in same process**
XGBoost and PyTorch can coexist in the same Python environment. However, if using XGBoost GPU (`device='cuda'`), both will compete for GPU memory. Recommendation: run XGBoost and GNN inference in separate Celery worker pools with different GPU memory limits, or use CPU for XGBoost (it is fast enough on CPU for anomaly detection inference, reserving GPU for GNN training).

**Scenario 2: Flower (flwr) + PyTorch Geometric**
Flower wraps PyG models via the `flwr.client.NumPyClient` interface. The wrapping requires serializing model weights to NumPy arrays for transmission. PyG models with dynamic graph structures require careful weight serialization — use `model.state_dict()` + `torch.save()` patterns, not direct NumPy conversion of sparse tensors.

**Scenario 3: Celery + asyncio (FastAPI)**
Celery workers are synchronous by default. Do NOT use `async def` Celery tasks — Celery does not run an event loop in workers. The correct pattern is: FastAPI async endpoint → `celery_app.send_task()` (non-blocking) → Celery sync worker runs inference → Redis pub/sub publishes result → FastAPI async WebSocket handler receives and pushes to client.

---

## 6. What NOT to Use (and Why)

| Technology | Category | Reason to Avoid |
|-----------|----------|----------------|
| Next.js | Frontend framework | SSR/SSG overhead irrelevant for auth-gated dashboard; adds Vercel lock-in risk |
| Socket.IO | WebSocket | Proprietary handshake incompatible with FastAPI native WebSocket; use native WS |
| Django REST Framework | Backend | Sync-first WSGI; WebSocket requires ASGI adapter; ORM is overkill for InfluxDB primary store |
| TensorFlow / Keras | ML framework | PyTorch is the research standard for GNNs; mixing frameworks creates dependency hell |
| TensorFlow Federated | Federated learning | TF-only; incompatible with PyTorch GNN |
| PySyft | Federated learning | Research-grade; API unstable; production deployments favor Flower |
| Leaflet.js | Map library | Canvas/SVG renderer; inadequate for real-time animated overlays at grid scale |
| Chart.js | Charting | Canvas-only; poor React integration; insufficient for custom grid visualizations |
| PostgreSQL (alone) | Database | Relational model wrong for time-series; use InfluxDB; add Postgres if relational data needed |
| Prometheus | Metrics | Pull-based; designed for infra metrics, not 100ms industrial sensor telemetry |
| Redux Toolkit | State management | Excessive boilerplate for dashboard use case; Zustand is sufficient |
| Mapbox GL JS v3 | Map library | Proprietary license (v2+); cost unpredictable at scale; MapLibre is free drop-in |
| flwr-nightly | Federated learning | Unstable API; breaking changes between nightly builds |
| Create React App | Build tool | Unmaintained; use Vite |

---

## 7. Alternative Considerations (Ranked)

### If MapLibre Is Insufficient:
1. **Mapbox GL JS 3.x** — Full Mapbox ecosystem access; pay-per-use pricing
2. **Google Maps Platform (Maps JS API)** — Familiar to stakeholders; higher cost; less WebGL control
3. **Cesium.js** — 3D globe rendering; relevant only if the grid spans continental scale

### If InfluxDB OSS Proves Complex to Self-Host:
1. **TimescaleDB** — PostgreSQL extension; familiar SQL; slightly worse compression than InfluxDB
2. **QuestDB** — High-performance time-series; SQL native; smaller ecosystem
3. **InfluxDB Cloud** — Fully managed; removes ops burden; adds cost and data residency concerns

### If Flower Federated Learning Is Over-Engineered at MVP Stage:
The federated learning component adds significant complexity. If the MVP timeline is constrained, consider deferring Flower to Phase 2 and implementing a centralized training pipeline first. The XGBoost + GNN training can be centralized initially, with Flower added when multiple regional operators need to be federated.

---

## 8. Confidence Summary

| Component | Confidence | Basis |
|-----------|-----------|-------|
| React 19 + TypeScript 5.4 + Vite 5 | HIGH | Stable major releases; established by mid-2025 |
| MapLibre GL JS 4.x | HIGH | Active LF project; v4 stable |
| deck.gl 9.x | HIGH | Uber/vis.gl project; v9 stable |
| D3.js v7 | HIGH | No major release since v7; stable |
| FastAPI 0.111 + Pydantic v2 | HIGH | Production-proven; widely deployed |
| XGBoost 2.1 | HIGH | Stable; GPU native in v2 |
| PyTorch 2.3 | HIGH | Stable release |
| PyTorch Geometric 2.5 | MEDIUM-HIGH | Correct direction; verify version compatibility matrix [VERIFY] |
| Flower (flwr) 1.8 | MEDIUM-HIGH | 1.x series stable; verify latest patch [VERIFY] |
| InfluxDB 3.x OSS | MEDIUM | v3 OSS availability uncertain as of Aug 2025 [VERIFY]; use 2.7.x if v3 OSS unavailable |
| Celery 5.4 + Redis 7 | HIGH | Battle-tested combination |
| MLflow 2.13 | HIGH | Stable; widely used in ML ops |

---

## 9. Immediate Actions Before Development Begins

1. **[VERIFY] PyG compatibility matrix:** Go to https://pytorch-geometric.readthedocs.io/en/latest/notes/installation.html and confirm the PyTorch 2.3 + PyG 2.5 + CUDA version triple matches your target GPU hardware.

2. **[VERIFY] Flower 1.x latest patch:** Check https://pypi.org/project/flwr/ for current 1.x patch version and read the 1.x migration guide if team has any 0.x experience.

3. **[VERIFY] InfluxDB 3.x OSS status:** Check https://github.com/influxdata/influxdb for whether InfluxDB 3.x OSS is GA or still in preview. If preview, use InfluxDB OSS 2.7.x for the initial development environment.

4. **[VERIFY] Mapbox vs MapLibre decision:** Confirm with stakeholders whether Mapbox-specific features (Mapbox Studio tilesets, Mapbox Atlas) are required. If not, commit to MapLibre from day one to avoid a costly migration later.

5. **[VERIFY] deck.gl + MapLibre peer dependency:** Run `npm info @deck.gl/core peerDependencies` to confirm deck.gl 9.x lists MapLibre 4.x as a supported peer.

---

*This document was produced using training knowledge (cutoff August 2025). All version numbers should be verified against live package registries before project initialization. Items marked [VERIFY] carry the highest drift risk given the training cutoff date.*
