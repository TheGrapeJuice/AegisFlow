# AegisFlow — AI-Powered Smart Grid Analytics

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/PyTorch-2.6-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" />
  <img src="https://img.shields.io/badge/XGBoost-2.1-189AB4?style=for-the-badge" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/InfluxDB-2-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white" />
</p>

<p align="center">
  Real-time power grid monitoring dashboard with ML anomaly detection and Graph Neural Network cascade failure prediction — built as a utility control center simulation.
</p>

---

## Overview

AegisFlow simulates an electric utility's control center. It streams live sensor data from 24 power grid nodes, classifies anomalies using XGBoost, and predicts cascade failure propagation paths using a Graph Convolutional Network — all visualized on a dark-themed interactive map dashboard.

**The core challenge:** grid failures don't happen in isolation. A fault at one generator can cascade through substations and transformers in seconds. AegisFlow models this propagation and recommends load-shedding reroutes before the cascade spreads.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│  MapLibre GL map  │  D3 graph overlay  │  live charts       │
│  Node detail panel │ Anomaly alerts   │ Cascade risk panel  │
└────────────────────────────┬────────────────────────────────┘
                             │ WebSocket (1s tick)
┌────────────────────────────▼────────────────────────────────┐
│                       FastAPI Backend                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Synthetic  │  │   XGBoost    │  │  PyTorch Geometric │  │
│  │  Data Gen   │→ │  Anomaly Det │→ │  GCN Cascade Pred  │  │
│  │  (1s tick)  │  │  (5s cycle)  │  │  + Dijkstra Route  │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│                             │                               │
│                     ┌───────▼───────┐                       │
│                     │   InfluxDB    │                       │
│                     │ (time-series) │                       │
│                     └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Real-Time Grid Visualization
- **Interactive map** of 24 Chicago-area power grid nodes rendered with MapLibre GL and a synchronized D3 graph overlay that stays locked during pan and zoom
- **Node types**: generators, substations, transformers, and junctions — each color-coded by health status
- **Live sensor charts** for voltage, frequency, and load on any selected node, streamed over WebSocket
- **Storm simulation** — inject a fault at a random generator and watch anomaly detection and cascade prediction activate in real time

### ML Anomaly Detection (XGBoost)
- Binary classifier trained on 5,000 synthetic samples with **9 engineered features**: raw readings plus a 5-step rolling mean and standard deviation per sensor channel
- Inference runs on a per-node rolling buffer every 5 seconds; anomaly flags feed directly into the GNN as node features
- ~15% positive class, balanced to reflect realistic grid fault rates

### Cascade Failure Prediction (Graph Neural Network)
- **CascadeGCN**: 2-layer Graph Convolutional Network built with PyTorch Geometric on the 24-node grid topology
- **5-dimensional node features**: normalized load, frequency deviation, XGBoost anomaly flag, node type encoding, and normalized graph degree
- Outputs a per-node confidence score; nodes above 0.35 threshold are flagged with an estimated time-to-cascade
- **Dijkstra rerouting**: identifies an alternate load-shedding path around high-risk nodes, weighted by inverse line capacity

### Data Pipeline
- Three concurrent async loops managed by FastAPI lifespan: sensor tick (1s), ML inference (5s), WebSocket broadcast (1s)
- InfluxDB stores time-series history; `/api/nodes/{id}/history` serves 30-minute windows for chart rendering
- WebSocket clients reconnect with exponential backoff (1s → 30s cap)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7 |
| Map & Graph | MapLibre GL 4.7, D3.js 7.9 |
| Styling | Tailwind CSS 3.4 |
| API | FastAPI 0.115, WebSockets |
| ML — Anomaly | XGBoost 2.1, scikit-learn 1.6 |
| ML — Cascade | PyTorch 2.6, PyTorch Geometric 2.6 |
| Time-Series DB | InfluxDB 2 |
| Runtime | Python 3.x (asyncio), Node.js |

---

## Getting Started

### Backend

```bash
# Create and activate virtual environment
python -m venv venv
source venv/Scripts/activate   # Windows: .\venv\Scripts\activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Train ML models (required before first run)
python -m backend.ml.train
python -m backend.ml.gnn_train

# Start the FastAPI server (http://localhost:8000)
python backend/main.py
```

### Frontend

```bash
npm install
npm run dev   # http://localhost:5173
```

### InfluxDB (optional — enables historical charts)

```bash
docker run -p 8086:8086 influxdb:2
python backend/generator.py   # writes sensor data every 5s
```

### Environment Variables

**Backend** (`backend/.env`):
```
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-token
INFLUXDB_ORG=aegisflow
INFLUXDB_BUCKET=grid_metrics
```

**Frontend** (`.env`):
```
VITE_API_BASE=http://localhost:8000
VITE_WS_BASE=ws://localhost:8000
```

---

## Project Structure

```
aegis-flow/
├── backend/
│   ├── main.py              # FastAPI app, lifespan, async loops
│   ├── state.py             # 24-node topology + live NODE_STATES dict
│   ├── generator.py         # Synthetic sensor data → InfluxDB
│   ├── influx_client.py     # InfluxDB client wrapper
│   ├── models.py            # Pydantic schemas
│   ├── routers/
│   │   ├── topology.py      # REST: /api/topology, /api/nodes/{id}/history
│   │   └── ws.py            # WebSocket broadcast + storm endpoint
│   └── ml/
│       ├── train.py         # XGBoost training
│       ├── inference.py     # XGBoost inference (rolling buffer)
│       ├── gnn_train.py     # GCN architecture + training
│       ├── gnn_inference.py # GCN inference + Dijkstra rerouting
│       ├── model.json       # Trained XGBoost weights
│       └── gnn_model.pt     # Trained GCN weights
└── src/
    ├── components/
    │   ├── layout/          # Dashboard shell, sidebar, anomaly & cascade panels
    │   └── map/             # GridMap, D3Overlay, StormCanvas, MapLegend
    ├── hooks/               # useNodeWebSocket, useTopology, useNodeHistory
    └── types/               # TypeScript interfaces (GridNode, GridEdge, CascadeResult)
```

---

## Demo Walkthrough

1. Open the dashboard — 24 nodes appear on a dark Chicago-area map
2. Click any node to open its detail panel with live voltage, frequency, and load charts
3. Click **Simulate Storm Event** — a fault is injected at a random generator node
4. Red anomaly alerts appear in the sidebar as XGBoost flags affected nodes
5. The cascade panel activates showing the GNN's predicted failure chain with confidence scores and a recommended rerouting path

---

## Roadmap

- [x] Phase 1 — Dashboard shell (React, MapLibre GL, D3 overlay)
- [x] Phase 2 — FastAPI backend + InfluxDB time-series pipeline
- [x] Phase 3 — XGBoost anomaly detection (integrated + verified)
- [x] Phase 4 — GCN cascade failure prediction + Dijkstra rerouting
- [ ] Phase 5 — Federated Learning simulation (Flower framework)
- [ ] Phase 6 — Production deployment (Vercel + Railway)

---

## License

MIT
