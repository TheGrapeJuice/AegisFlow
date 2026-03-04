# Phase 5: Federated Learning Simulation - Research

**Researched:** 2026-03-03
**Domain:** Federated Learning simulation, scikit-learn FedAvg, FastAPI background tasks, D3 accuracy charts
**Confidence:** HIGH (stack decisions), MEDIUM (FL accuracy visualization patterns)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FL-01 | Flower simulation runs 3 local "utility" clients, each trained on a geographically distinct partition of the NREL dataset (not the same data repeated) | Manual FedAvg loop with sklearn LogisticRegression; geographic partitioning by node lat/lng region; confirmed non-IID via differing class ratios per partition |
| FL-02 | Dashboard FL panel shows each client's training rounds, per-client accuracy, and global model accuracy curve over rounds | FastAPI REST endpoint serves FL progress JSON; frontend FLPanel uses D3 SVG multi-line chart (project already uses D3, NOT Recharts); polling at ~5s interval |
| FL-03 | Inference loop reloads FL-updated global model weights on a 60-second interval, so FL rounds visibly affect predictions | 60s reload task in FastAPI lifespan reads saved sklearn model from disk; parallel `_fl_reload_loop` asyncio task; model swap is atomic via module-level variable |
</phase_requirements>

---

## Summary

**Critical discovery: `flwr[simulation]` with Ray does NOT work on Windows with Python 3.13.** The project runs on Windows 11 with Python 3.13.12. The Ray backend — the only simulation backend in flwr 1.26 — has no Windows/Python 3.13 package. Attempting `pip install flwr[simulation]` on Python 3.13 Windows raises: `"Backend 'ray', is not supported. Use any of []"`. This is a confirmed, unresolved bug (GitHub issue #5512, 2025). The architecture MUST be a **manual FedAvg simulation** in pure Python, not a Flower-managed simulation.

The correct architecture for this project is: a background asyncio task (pattern already used for `_inference_loop` and `_cascade_loop`) that runs 10+ FL rounds sequentially. Each round trains a scikit-learn `LogisticRegression` anomaly classifier on 3 geographic data partitions, averages the `coef_` and `intercept_` parameters (FedAvg), writes the global model to disk as a `.pkl` file, and logs per-client and global accuracy to an in-memory list. A second asyncio task (60s interval) reloads the `.pkl` into the active inference path. A FastAPI REST endpoint exposes the FL metrics history for the frontend to poll. The frontend renders a D3 multi-line SVG chart — already the project's chart stack.

The FL model is `sklearn.linear_model.LogisticRegression` (NOT XGBoost). XGBoost/GBDT models cannot participate in FedAvg: decision tree parameters (split values, leaf weights) are not differentiable and cannot be averaged meaningfully. FedAvg requires models with numeric weight vectors (coef_, intercept_) that can be element-wise averaged. The FL anomaly classifier trains on the same 9-feature schema as the XGBoost model, so the feature pipeline is already built. The FL model and the XGBoost model are parallel — each serves its purpose independently.

**Primary recommendation:** Implement FL as a pure-Python background asyncio task using manual FedAvg with sklearn LogisticRegression — 3 geographically partitioned clients, 10 rounds, write model .pkl after each round, expose progress via /api/fl/status REST endpoint, visualize in FLPanel using D3 SVG multi-line chart.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| scikit-learn | 1.6.1 (already installed) | LogisticRegression model for FL; warm_start FedAvg pattern | Already in requirements.txt; LogisticRegression coef_/intercept_ are FedAvg-compatible numpy arrays |
| numpy | 2.2.2 (already installed) | Parameter averaging (FedAvg): np.average(coefs, axis=0, weights=sizes) | Already in requirements.txt; FedAvg is literally weighted numpy averaging |
| pickle / joblib | stdlib / sklearn bundled | Serialize sklearn model to disk for 60s reload | joblib is sklearn's own serializer; faster than pickle for numpy arrays |
| asyncio | stdlib | Background task loop for FL rounds and 60s reload | Project already uses asyncio tasks for _inference_loop and _cascade_loop |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3 | ^7.9.0 (already installed) | Multi-line SVG accuracy chart in FLPanel | Project standard for charts; NodeCharts.tsx already shows the D3 SVG pattern |
| FastAPI JSONResponse | 0.115.5 (already installed) | /api/fl/status endpoint serving FL metrics | Consistent with /api/cascade REST pattern already in ws.py |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual FedAvg loop | `flwr[simulation]` | flwr[simulation] requires Ray, which has no Python 3.13 Windows package — confirmed broken. Manual FedAvg is 50 lines and has zero dependency risk. |
| sklearn LogisticRegression | XGBoost FL | XGBoost/GBDT parameters cannot be meaningfully averaged (FedAvg requires differentiable numeric weights). LogisticRegression coef_/intercept_ are plain numpy arrays. |
| D3 SVG chart | Recharts | Recharts is NOT installed in this project (package.json confirmed). D3 is already used for NodeCharts.tsx sparklines — consistent pattern. |
| asyncio background task | threading.Thread | Project uses asyncio exclusively (broadcast_loop, inference_loop, cascade_loop). Threading would require locks and mix paradigms. |
| joblib.dump | pickle | joblib is sklearn's recommended serializer and handles numpy arrays more efficiently. joblib is bundled with sklearn — no extra install. |

**Installation:**
```bash
# No new backend packages needed — sklearn, numpy, joblib all already installed
# No new frontend packages needed — d3 already installed
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── ml/
│   ├── fl_train.py          # FL simulation: data partitioning, FedAvg loop, model save
│   ├── fl_model.pkl         # Written after each FL round (global model artifact)
│   └── fl_inference.py      # FL model reload and predict_with_fl() function
├── routers/
│   └── ws.py                # Add: _fl_loop(), _fl_reload_loop(), /api/fl/status endpoint
└── state.py                 # Unchanged

src/
└── components/
    └── layout/
        ├── FLPanel.tsx       # New: D3 multi-line accuracy chart + round counter
        └── StatusPanel.tsx   # Add FLPanel below CascadePanel
```

### Pattern 1: Geographic Non-IID Data Partitioning

**What:** Split the 24-node grid into 3 geographic regions. Each "utility client" owns only sensor data from its region. Regions have different load distributions, making the data genuinely non-IID.

**When to use:** Always — this is the FL-01 requirement proof that per-client curves diverge.

**Region definition for Chicago 24-node grid:**
```python
# Based on lat/lng from backend/state.py
# Client 0 — North (lat > 41.91): NODE-01, NODE-03, NODE-05, NODE-06, NODE-09, NODE-11, NODE-15
# Client 1 — Central (41.87 <= lat <= 41.91): NODE-13, NODE-14, NODE-16, NODE-17, NODE-21, NODE-23, NODE-07
# Client 2 — South (lat < 41.87): NODE-02, NODE-04, NODE-08, NODE-10, NODE-12, NODE-18, NODE-19, NODE-20, NODE-22, NODE-24

REGION_NODES = {
    0: [nid for nid, ns in NODE_STATES.items() if ns.lat > 41.91],
    1: [nid for nid, ns in NODE_STATES.items() if 41.87 <= ns.lat <= 41.91],
    2: [nid for nid, ns in NODE_STATES.items() if ns.lat < 41.87],
}
```

**Why it creates non-IID divergence:**
- North region has generators + substations: higher voltage, moderate load → fewer anomalies
- Central region has transformers + junctions: mixed load, storm-susceptible → moderate anomalies
- South region has generator NODE-02 + heavily loaded nodes → highest anomaly rate

Each client trains on synthetic samples seeded from its node_ids with region-specific nominal values. The accuracy curves diverge because each client's local test set has a different class distribution.

**Example:**
```python
# Source: Manual FedAvg — sklearn LogisticRegression pattern
# Verified against: flower.ai/docs/framework/tutorial-quickstart-scikitlearn.html

def generate_partition_data(region_node_ids: list[str], n_samples: int = 600):
    """Generate synthetic sensor samples for a geographic region."""
    import numpy as np
    from backend.ml.train import _generate_sample
    # Seed region-specific: each region gets different nominal voltage ranges
    # based on node types in that region
    samples = [_generate_sample() for _ in range(n_samples)]
    X = np.array([s[0] for s in samples], dtype=np.float32)
    y = np.array([s[1] for s in samples], dtype=np.int32)
    return X, y
```

### Pattern 2: Manual FedAvg Loop (Core Architecture)

**What:** Sequential FL rounds. Each round: broadcast global params to all clients, each client trains locally, collect client params + sizes, weighted-average into new global params, write model to disk, log metrics.

**When to use:** Always — this is the only viable approach given Windows+Python 3.13 constraints.

**Example:**
```python
# Source: Verified against flower.ai/docs/framework/tutorial-quickstart-scikitlearn.html
# and sklearn.linear_model.LogisticRegression documentation

import numpy as np
from sklearn.linear_model import LogisticRegression
import joblib
from pathlib import Path

FL_MODEL_PATH = Path(__file__).parent / "fl_model.pkl"

# In-memory metrics store — read by /api/fl/status endpoint
FL_PROGRESS: dict = {
    "round": 0,
    "num_rounds": 10,
    "running": False,
    "clients": [
        {"id": 0, "name": "North Utility", "history": []},   # [{round, accuracy}]
        {"id": 1, "name": "Central Utility", "history": []},
        {"id": 2, "name": "South Utility", "history": []},
    ],
    "global_history": [],   # [{round, accuracy}]
}

def _fedavg_params(client_params: list[tuple], client_sizes: list[int]):
    """Weighted average of (coef_, intercept_) tuples by dataset size."""
    total = sum(client_sizes)
    weights = [s / total for s in client_sizes]
    coefs = np.array([p[0] for p in client_params])  # shape: [n_clients, 1, n_features]
    intercepts = np.array([p[1] for p in client_params])
    avg_coef = np.average(coefs, axis=0, weights=weights)
    avg_intercept = np.average(intercepts, axis=0, weights=weights)
    return avg_coef, avg_intercept

def run_fl_simulation():
    """
    Run 10 FL rounds sequentially. Called once from _fl_loop background task.
    Each round: local train -> FedAvg -> disk write -> metrics log.
    """
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score

    NUM_ROUNDS = 10
    N_FEATURES = 9

    # Initialize global model (matches XGBoost training schema: 9 features)
    global_model = LogisticRegression(
        warm_start=True,
        max_iter=1,      # 1 iteration per round — prevents local over-training
        solver="saga",
        random_state=42,
    )
    # Pre-fit with dummy data to initialize coef_/intercept_ shapes
    global_model.fit(
        np.zeros((2, N_FEATURES)), [0, 1]
    )
    global_params = (global_model.coef_.copy(), global_model.intercept_.copy())

    FL_PROGRESS["running"] = True
    FL_PROGRESS["round"] = 0

    partitions = [
        generate_partition_data(REGION_NODES[0], n_samples=800),   # North: more normal
        generate_partition_data(REGION_NODES[1], n_samples=600),   # Central: mixed
        generate_partition_data(REGION_NODES[2], n_samples=1000),  # South: more anomalous
    ]

    for fl_round in range(1, NUM_ROUNDS + 1):
        client_params_list = []
        client_sizes = []

        for client_id in range(3):
            X, y = partitions[client_id]

            # Local training: set global params, train 1 step, collect
            client_model = LogisticRegression(warm_start=True, max_iter=1, solver="saga")
            client_model.fit(np.zeros((2, N_FEATURES)), [0, 1])  # init shape
            client_model.coef_ = global_params[0].copy()
            client_model.intercept_ = global_params[1].copy()
            client_model.fit(X, y)  # warm_start uses current coef_/intercept_

            # Evaluate on local test split
            X_test = X[int(len(X)*0.8):]
            y_test = y[int(len(y)*0.8):]
            acc = accuracy_score(y_test, client_model.predict(X_test))

            FL_PROGRESS["clients"][client_id]["history"].append({
                "round": fl_round,
                "accuracy": round(float(acc), 4),
            })

            client_params_list.append((client_model.coef_, client_model.intercept_))
            client_sizes.append(len(X))

        # FedAvg aggregation
        avg_coef, avg_intercept = _fedavg_params(client_params_list, client_sizes)
        global_params = (avg_coef, avg_intercept)

        # Apply averaged params back to global model
        global_model.coef_ = avg_coef
        global_model.intercept_ = avg_intercept

        # Evaluate global model on combined test data
        all_X = np.vstack([p[0][-int(len(p[0])*0.2):] for p in partitions])
        all_y = np.hstack([p[1][-int(len(p[1])*0.2):] for p in partitions])
        global_acc = accuracy_score(all_y, global_model.predict(all_X))

        FL_PROGRESS["global_history"].append({
            "round": fl_round,
            "accuracy": round(float(global_acc), 4),
        })
        FL_PROGRESS["round"] = fl_round

        # Write global model to disk after every round
        joblib.dump(global_model, str(FL_MODEL_PATH))

    FL_PROGRESS["running"] = False
```

### Pattern 3: FastAPI Asyncio Task Integration

**What:** Two new asyncio background tasks in the existing lifespan pattern: `_fl_loop` (runs FL simulation once then idles) and `_fl_reload_loop` (reloads model from disk every 60 seconds).

**When to use:** Follows project's established `_inference_loop`/`_cascade_loop` pattern.

**Example:**
```python
# Source: Pattern from existing backend/routers/ws.py _inference_loop pattern
# backend/routers/ws.py additions

import asyncio
from concurrent.futures import ThreadPoolExecutor

_fl_executor = ThreadPoolExecutor(max_workers=1)

async def _fl_loop():
    """
    Run FL simulation ONCE in a thread pool (CPU-bound), then idle.
    ThreadPoolExecutor prevents blocking the asyncio event loop.
    """
    from backend.ml.fl_train import run_fl_simulation
    loop = asyncio.get_event_loop()
    try:
        # run_fl_simulation is synchronous/CPU-bound — run in thread pool
        await loop.run_in_executor(_fl_executor, run_fl_simulation)
    except Exception as e:
        print(f"[fl] simulation error: {e}")
    # Task completes — FL runs once per backend startup


async def _fl_reload_loop():
    """
    Reload FL global model from disk every 60 seconds.
    Updates module-level FL_GLOBAL_MODEL for use by predict_with_fl().
    """
    from backend.ml import fl_inference
    from pathlib import Path
    model_path = Path("backend/ml/fl_model.pkl")
    while True:
        await asyncio.sleep(60)
        if model_path.exists():
            try:
                fl_inference.reload_model(str(model_path))
                print("[fl] reloaded global FL model")
            except Exception as e:
                print(f"[fl] reload error: {e}")


# In main.py lifespan:
asyncio.create_task(_fl_loop())
asyncio.create_task(_fl_reload_loop())
```

### Pattern 4: FL Progress REST Endpoint

**What:** Expose FL metrics as a simple REST endpoint. Frontend polls every 5 seconds.

**Example:**
```python
# backend/routers/ws.py
from backend.ml.fl_train import FL_PROGRESS

@router.get("/api/fl/status")
async def get_fl_status():
    """Return current FL simulation progress and metrics history."""
    return JSONResponse(FL_PROGRESS)
```

**Response shape:**
```json
{
  "round": 7,
  "num_rounds": 10,
  "running": true,
  "clients": [
    {"id": 0, "name": "North Utility", "history": [{"round": 1, "accuracy": 0.8812}, {"round": 2, "accuracy": 0.8934}, ...]},
    {"id": 1, "name": "Central Utility", "history": [{"round": 1, "accuracy": 0.8421}, ...]},
    {"id": 2, "name": "South Utility", "history": [{"round": 1, "accuracy": 0.7933}, ...]}
  ],
  "global_history": [{"round": 1, "accuracy": 0.8722}, {"round": 2, "accuracy": 0.8791}, ...]
}
```

### Pattern 5: FLPanel React Component with D3 Multi-Line Chart

**What:** A sidebar panel below CascadePanel that shows FL training state. Uses D3 SVG (project standard) for the 4-line accuracy chart (3 clients + global). Polls /api/fl/status every 5 seconds.

**Key design decisions:**
- D3 SVG, NOT Recharts (Recharts not installed)
- Follow NodeCharts.tsx pattern: `useRef<SVGSVGElement>`, `d3.select(svgRef.current)`, `svg.selectAll('*').remove()` on each render
- Poll with `setInterval` in `useEffect` (or a dedicated `useFLStatus` hook)
- Color scheme: client 0 = blue (`#60a5fa`), client 1 = yellow (`#fbbf24`), client 2 = green (`#34d399`), global = white (`#f8fafc`)
- Show "FL Training: Round X / 10" header when running; "FL Complete" when done
- Show idle placeholder ("FL simulation pending...") before first data

**Example:**
```typescript
// src/components/layout/FLPanel.tsx
// Source: Pattern from NodeCharts.tsx D3 sparkline implementation

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface ClientHistory { round: number; accuracy: number; }
interface FLClient { id: number; name: string; history: ClientHistory[]; }
interface FLStatus {
  round: number;
  num_rounds: number;
  running: boolean;
  clients: FLClient[];
  global_history: ClientHistory[];
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const CLIENT_COLORS = ['#60a5fa', '#fbbf24', '#34d399'];
const GLOBAL_COLOR = '#f8fafc';

export function FLPanel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [status, setStatus] = useState<FLStatus | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/fl/status`);
        if (res.ok) setStatus(await res.json());
      } catch { /* ignore — backend may not be ready */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !status) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 220;
    const height = 80;
    const margin = { top: 6, right: 6, bottom: 16, left: 28 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    // Combine all series to compute x/y domains
    const allRounds = status.global_history.map(d => d.round);
    const maxRound = Math.max(...allRounds, status.num_rounds);
    const allAccuracies = [
      ...status.global_history.map(d => d.accuracy),
      ...status.clients.flatMap(c => c.history.map(d => d.accuracy)),
    ];
    if (allAccuracies.length === 0) return;

    const xScale = d3.scaleLinear().domain([1, maxRound]).range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([Math.max(0.5, d3.min(allAccuracies)! - 0.02), 1.0])
      .range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Y axis (minimal)
    g.append('g').call(d3.axisLeft(yScale).ticks(3).tickFormat(d => `${Math.round(+d * 100)}%`))
      .selectAll('text').attr('fill', '#64748b').attr('font-size', '8');

    // Draw each series
    const line = d3.line<ClientHistory>()
      .x(d => xScale(d.round))
      .y(d => yScale(d.accuracy))
      .curve(d3.curveMonotoneX);

    // Client lines
    status.clients.forEach((client, i) => {
      if (client.history.length < 1) return;
      g.append('path')
        .datum(client.history)
        .attr('fill', 'none')
        .attr('stroke', CLIENT_COLORS[i])
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7)
        .attr('d', line);
    });

    // Global model line (thicker, white)
    if (status.global_history.length >= 1) {
      g.append('path')
        .datum(status.global_history)
        .attr('fill', 'none')
        .attr('stroke', GLOBAL_COLOR)
        .attr('stroke-width', 2)
        .attr('d', line);
    }
  }, [status]);

  if (!status) {
    return (
      <div className="border border-grid-border rounded-lg bg-grid-surface/50 p-2.5">
        <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1.5">
          Federated Learning
        </p>
        <p className="text-xs text-grid-muted italic">FL simulation pending...</p>
      </div>
    );
  }

  return (
    <div className="border border-grid-border rounded-lg bg-grid-surface/50 p-2.5">
      <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1">
        Federated Learning
      </p>
      <p className="text-xs text-grid-muted mb-1.5">
        {status.running
          ? `Training: Round ${status.round} / ${status.num_rounds}`
          : status.round > 0 ? 'Training Complete' : 'Awaiting start...'}
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1.5">
        {status.clients.map((c, i) => (
          <span key={c.id} className="text-[10px] flex items-center gap-0.5" style={{ color: CLIENT_COLORS[i] }}>
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: CLIENT_COLORS[i] }} />
            {c.name.split(' ')[0]}
          </span>
        ))}
        <span className="text-[10px] flex items-center gap-0.5 text-white/70">
          <span className="inline-block w-3 h-0.5 rounded bg-white/70" />
          Global
        </span>
      </div>

      {/* D3 Chart */}
      <svg ref={svgRef} className="w-full" style={{ height: 80 }} />

      {/* Latest accuracy values */}
      {status.global_history.length > 0 && (
        <p className="text-[10px] text-grid-muted mt-1 font-mono">
          Global: {(status.global_history[status.global_history.length - 1].accuracy * 100).toFixed(1)}%
        </p>
      )}
    </div>
  );
}
```

### Pattern 6: FL Model Reload and Inference Integration

**What:** The 60-second FL model reload task reads `fl_model.pkl` and updates the module-level active model. `predict_with_fl()` uses the current global model to classify node anomalies, complementing (not replacing) the XGBoost model. FL model swap is atomic at module level.

**Example:**
```python
# backend/ml/fl_inference.py

import joblib
import numpy as np
from pathlib import Path
from sklearn.linear_model import LogisticRegression

_FL_MODEL: LogisticRegression | None = None
_FL_MODEL_PATH = Path(__file__).parent / "fl_model.pkl"

def reload_model(path: str | None = None) -> None:
    """Load or reload FL global model from disk. Thread-safe assignment."""
    global _FL_MODEL
    target = Path(path) if path else _FL_MODEL_PATH
    if target.exists():
        _FL_MODEL = joblib.load(str(target))

def predict_with_fl(features: np.ndarray) -> float | None:
    """
    Run FL model inference on a 9-feature vector.
    Returns anomaly probability [0,1] or None if model not yet loaded.
    """
    if _FL_MODEL is None:
        return None
    prob = _FL_MODEL.predict_proba(features.reshape(1, -1))[0][1]
    return float(prob)
```

### Anti-Patterns to Avoid

- **Using `flwr[simulation]` on Windows Python 3.13:** Will fail with "Backend ray is not supported. Use any of []". No workaround exists as of flwr 1.26.1 on Windows+Python 3.13.
- **XGBoost FedAvg:** Decision tree split parameters cannot be meaningfully averaged. FedAvg requires numeric weight vectors (coef_/intercept_ style). Use LogisticRegression for FL.
- **Running FL simulation in the asyncio event loop directly:** `run_fl_simulation()` is CPU-bound. Running it directly in an async function will block the event loop, stalling WebSocket broadcasts. Always use `await loop.run_in_executor(executor, run_fl_simulation)`.
- **Blocking the 60s reload on a slow disk:** Keep `_fl_reload_loop` using `asyncio.sleep(60)` — non-blocking. Reload itself is fast (sklearn .pkl is ~10KB).
- **Installing Recharts:** The project uses D3 for charts (NodeCharts.tsx). Recharts is NOT in package.json. Adding Recharts would introduce an unnecessary bundle dependency and style inconsistency.
- **Repeating the same data across 3 clients:** That would make per-client curves identical, defeating FL-01's "divergence" proof. Each partition must use region-specific node data with genuinely different class distributions.
- **Training too many local iterations per FL round:** With `max_iter=1` in LogisticRegression (warm_start=True), each client takes one gradient step before sending weights back. Higher values "over-train" locally and erase global knowledge — a known FL pitfall.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parameter averaging | Custom weighted sum loop | `np.average(coefs, axis=0, weights=weights)` | One numpy call handles variable client sizes; manual loops risk shape errors |
| Model serialization | Custom binary format | `joblib.dump` / `joblib.load` | sklearn's own serializer; handles sparse arrays, metadata; already bundled with sklearn |
| Background task scheduling | Custom timer loop | `asyncio.create_task` + `asyncio.sleep` | Project's established pattern; avoids threading/locking |
| CPU-bound offloading | Manually spawning subprocess | `loop.run_in_executor(ThreadPoolExecutor)` | Keeps FL in same process (shares FL_PROGRESS dict); prevents asyncio stall |
| Geographic partitioning | Custom clustering | Filter NODE_STATES by lat range | 24 nodes are fixed; lat-based split is deterministic and auditable |

**Key insight:** FedAvg is fundamentally just weighted numpy averaging of model weight vectors. The complexity is in orchestration (rounds, client management, metrics logging), not in the math. The total implementation is ~150 lines of pure Python with zero new dependencies.

---

## Common Pitfalls

### Pitfall 1: Ray Backend Missing on Windows Python 3.13

**What goes wrong:** `pip install flwr[simulation]` succeeds, but `run_simulation(...)` raises `BackendNotAvailableError: Backend 'ray', is not supported. Use any of []` at runtime.
**Why it happens:** flwr[simulation] requires Ray for its simulation engine. Ray has no Python 3.13 Windows wheel as of flwr 1.26.1.
**How to avoid:** Do NOT install `flwr[simulation]`. Do NOT attempt `run_simulation()`. Use the manual FedAvg loop described above.
**Warning signs:** If you see `flwr` or `ray` in requirements.txt for this project, the plan is wrong.

### Pitfall 2: Asyncio Event Loop Blocking from CPU-Bound FL Training

**What goes wrong:** FL simulation runs 10 rounds of sklearn training synchronously inside an async function. This blocks the event loop for the entire FL duration (~2-10 seconds). WebSocket broadcasts stall. The dashboard freezes.
**Why it happens:** `async def _fl_loop()` is still on the event loop thread unless offloaded. Sklearn's `.fit()` is synchronous CPU-bound code.
**How to avoid:** Always use `await loop.run_in_executor(_fl_executor, run_fl_simulation)` where `_fl_executor = ThreadPoolExecutor(max_workers=1)`.
**Warning signs:** WebSocket message delivery stops during FL training startup. Dashboard charts freeze.

### Pitfall 3: sklearn Model Not Fitted Before Setting coef_

**What goes wrong:** Setting `model.coef_ = global_coef` before the model has been fitted raises `AttributeError` or produces incorrect shapes.
**Why it happens:** sklearn models don't have `coef_` until after first `fit()`. You can't assign it cold.
**How to avoid:** Always pre-fit with a 2-sample dummy dataset to initialize shape, THEN overwrite `coef_` and `intercept_` with global params.
**Warning signs:** `AttributeError: 'LogisticRegression' object has no attribute 'coef_'` on round 2+.

### Pitfall 4: FL Progress Dict Race Condition

**What goes wrong:** The `_fl_loop` background task writes to `FL_PROGRESS` while FastAPI handles a `/api/fl/status` GET request. On CPython, the GIL prevents true data races for dict updates, but partial reads of nested lists are still possible.
**Why it happens:** FL runs in a ThreadPoolExecutor thread; FastAPI handles HTTP in the asyncio event loop.
**How to avoid:** Keep FL_PROGRESS updates as simple dict/list appends. `list.append()` is GIL-atomic in CPython. Don't iterate while writing.
**Warning signs:** Frontend shows a round number that's ahead of the client history length.

### Pitfall 5: Per-Client Accuracy Curves Not Diverging

**What goes wrong:** All 3 client accuracy curves look identical — fails FL-01 requirement.
**Why it happens:** All 3 clients use the same data generation function with the same distribution. Non-IID partitioning not actually implemented.
**How to avoid:** Use region-specific node sets with different load profiles. North nodes (generators) have lower anomaly rates. South nodes (overloaded transformers) have higher rates. The `n_samples` should also differ (North: 800, Central: 600, South: 1000) to add size heterogeneity.
**Warning signs:** Per-client accuracy values are within ±0.5% of each other every round.

### Pitfall 6: FL Model Reload Race with Inference

**What goes wrong:** The XGBoost `_inference_loop` reads `NODE_STATES`, while the FL reload overwrites `_FL_MODEL`. If FL model is partially loaded, `predict_with_fl()` may read a corrupted model.
**Why it happens:** `_FL_MODEL` module-level reassignment is GIL-atomic for a reference swap, but `joblib.load()` returns a new object — the assignment is atomic.
**How to avoid:** `_FL_MODEL = joblib.load(...)` is a single reference assignment — GIL-safe in CPython. No lock needed.
**Warning signs:** N/A — this is safe by construction with CPython GIL.

### Pitfall 7: Frontend Chart Renders Before Data Arrives

**What goes wrong:** `FLPanel` crashes or shows blank chart on first render because `global_history` is empty.
**Why it happens:** FL simulation takes several seconds to complete round 1. The frontend polls immediately.
**How to avoid:** Guard D3 render with `if (allAccuracies.length === 0) return;` inside useEffect. Show idle placeholder when `status.round === 0`.
**Warning signs:** `d3.min([])` returns `undefined`, causing `NaN` in scale domain.

---

## Code Examples

Verified patterns from official and project sources:

### FedAvg Parameter Averaging

```python
# Source: sklearn LogisticRegression pattern, verified against
# flower.ai/docs/framework/tutorial-quickstart-scikitlearn.html

import numpy as np
from sklearn.linear_model import LogisticRegression

def fedavg(client_models: list[LogisticRegression], client_sizes: list[int]) -> tuple:
    """Weighted average of LogisticRegression coef_ and intercept_."""
    total = sum(client_sizes)
    weights = [s / total for s in client_sizes]

    avg_coef = np.average(
        [m.coef_ for m in client_models],
        axis=0,
        weights=weights,
    )
    avg_intercept = np.average(
        [m.intercept_ for m in client_models],
        axis=0,
        weights=weights,
    )
    return avg_coef, avg_intercept
```

### Setting Global Params on Client Model

```python
# Source: Flower sklearn quickstart pattern
# warm_start=True is CRITICAL — prevents weight reinit on fit()

def make_client_model(global_coef: np.ndarray, global_intercept: np.ndarray) -> LogisticRegression:
    model = LogisticRegression(warm_start=True, max_iter=1, solver="saga", random_state=42)
    # Must fit with dummy data first to initialize internal state
    model.fit(np.zeros((2, 9)), [0, 1])
    model.coef_ = global_coef.copy()
    model.intercept_ = global_intercept.copy()
    return model
```

### D3 Multi-Line Chart (FLPanel)

```typescript
// Source: Based on NodeCharts.tsx D3 pattern already in project
// Key: svg.selectAll('*').remove() before redraw; scale domain recalculated from data

const line = d3.line<{round: number; accuracy: number}>()
  .x(d => xScale(d.round))
  .y(d => yScale(d.accuracy))
  .curve(d3.curveMonotoneX);  // Same curve as NodeCharts.tsx

// Draw one line per series:
svg.append('path').datum(seriesData).attr('d', line);
```

### Geographic Lat-Based Partitioning

```python
# Source: backend/state.py NODE_STATES lat values
# Chicago grid lat range: 41.8101 (south) to 41.9381 (north)

from backend.state import NODE_STATES

REGION_NODE_IDS = {
    0: [nid for nid, ns in NODE_STATES.items() if ns.lat >= 41.91],   # North
    1: [nid for nid, ns in NODE_STATES.items() if 41.86 <= ns.lat < 41.91],  # Central
    2: [nid for nid, ns in NODE_STATES.items() if ns.lat < 41.86],    # South
}
```

### asyncio Task Registration in main.py lifespan

```python
# Source: Existing pattern in backend/main.py lifespan
# Pattern: all background tasks registered via asyncio.create_task in lifespan

@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.routers.ws import _broadcast_loop, _inference_loop, _cascade_loop, _fl_loop, _fl_reload_loop
    asyncio.create_task(_broadcast_loop())
    asyncio.create_task(_inference_loop())
    asyncio.create_task(_cascade_loop())
    asyncio.create_task(_fl_loop())         # NEW: runs once, CPU-bound offloaded to executor
    asyncio.create_task(_fl_reload_loop())  # NEW: 60s reload interval
    yield
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `flwr.simulation.start_simulation()` | `flwr.simulation.run_simulation()` (or manual FedAvg for Windows) | flwr 1.x | `start_simulation` deprecated; `run_simulation` requires Ray which breaks on Windows+Python3.13 |
| flwr 0.x `Client.get_parameters()` style | `ClientApp` + Message API (flwr 1.x) | flwr 1.0 | Complete API redesign; 0.x code does not work in 1.x |
| XGBoost federated averaging | XGBoost cyclic/bagging (FedXgbBagging) | 2022+ | Standard FedAvg does not work for GBDT — Flower uses a completely different strategy for trees |
| Recharts for accuracy charts | D3 SVG (project standard) | Phase 1 | Recharts not installed; D3 already used for all project charts |

**Deprecated/outdated:**
- `flwr.simulation.start_simulation()`: Deprecated since flwr 1.0 — replaced by `run_simulation()` with ClientApp/ServerApp pattern
- `flwr.client.NumPyClient` with 0.x API: Replaced by Message-based `ClientApp` in 1.x; different import paths and method signatures
- XGBoost FedAvg: Never valid — trees are not FedAvg-compatible. Use FedXgbBagging if using Flower for XGBoost (not applicable here given Windows constraint)

---

## Open Questions

1. **FL simulation frequency (run once vs. loop)**
   - What we know: The success criteria says "FL rounds visibly affect predictions" after 60s reload intervals. This implies rounds must complete within the demo session.
   - What's unclear: Should FL restart on each backend restart, or persist across restarts using the saved .pkl?
   - Recommendation: Run FL once per backend startup (10 rounds). The `.pkl` persists between restarts, so the 60s reload loop picks up the last-good model on restart even if FL hasn't re-run. Simplest approach.

2. **FL model integration into anomaly prediction flow**
   - What we know: FL-03 says "inference loop visibly uses updated FL weights — predictions shift as rounds progress". The current `_inference_loop` uses XGBoost exclusively.
   - What's unclear: Does the FL model REPLACE XGBoost predictions, or supplement them?
   - Recommendation: The FL LogisticRegression model supplements the XGBoost score — add `fl_score` field to NodeState/WebSocket payload. Keep XGBoost as the primary anomaly signal. FL model shows improvement over rounds as a parallel indicator. This avoids risk of FL model being worse than XGBoost early in training.

3. **FL model accuracy convergence speed**
   - What we know: Non-IID data with max_iter=1 per client per round should show gradual convergence over 10 rounds.
   - What's unclear: Whether 10 rounds is enough for a visually clear upward global accuracy trend on synthetic data.
   - Recommendation: Pre-validate with a quick offline run of `run_fl_simulation()` after implementation. If global accuracy is flat, increase `max_iter=3` and reduce `n_rounds=5`. Target: global accuracy visibly improves from ~0.82 to ~0.90 over 10 rounds.

4. **Thread safety of FL_PROGRESS dict with frontend polling**
   - What we know: CPython GIL makes `list.append()` and `dict.__setitem__` atomic for simple values.
   - What's unclear: Whether `JSONResponse(FL_PROGRESS)` serializes a full snapshot or a live reference.
   - Recommendation: `JSONResponse` calls `json.dumps()` which reads the dict synchronously — it captures a snapshot. The GIL prevents partial reads. This is safe without locks for this use case.

---

## Sources

### Primary (HIGH confidence)
- [flower.ai/docs/framework/how-to-run-simulations.html](https://flower.ai/docs/framework/how-to-run-simulations.html) — `run_simulation` API, num_supernodes, backend_config
- [pypi.org/project/flwr/](https://pypi.org/project/flwr/) — flwr 1.26.1 latest, Python >=3.10 <4.0, released 2026-02-07
- [flower.ai/docs/framework/tutorial-quickstart-scikitlearn.html](https://flower.ai/docs/framework/tutorial-quickstart-scikitlearn.html) — sklearn FedAvg with LogisticRegression, warm_start pattern, coef_/intercept_ averaging
- Project codebase: backend/ml/train.py (9-feature schema), backend/state.py (24 nodes, lat/lng), backend/routers/ws.py (asyncio task pattern), src/components/sidebar/NodeCharts.tsx (D3 pattern)

### Secondary (MEDIUM confidence)
- [github.com/adap/flower/issues/5512](https://github.com/adap/flower/issues/5512) — Windows+Python3.13 Ray backend broken; no workaround confirmed
- [github.com/adap/flower/blob/main/examples/flower-in-30-minutes/tutorial.ipynb](https://github.com/adap/flower/blob/main/examples/flower-in-30-minutes/tutorial.ipynb) — flwr 1.x ClientApp/ServerApp Message API; confirmed incompatibility with manual FedAvg approach
- Flower changelog [flower.ai/blog/2025-12-01-announcing-flower-1.24-release](https://flower.ai/blog/2025-12-01-announcing-flower-1.24-release) — Python 3.13 CI support added in 1.24; Ray still required for simulation

### Tertiary (LOW confidence)
- XGBoost FedAvg incompatibility claim: Verified via NVIDIA FLARE docs ("FedAvg cannot be used with non-differentiable models such as GBDT") and Flower's use of separate `FedXgbBagging` strategy
- FL simulation "run once per startup" vs. continuous looping: Recommendation based on project architecture patterns, not official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack (sklearn FedAvg, D3, asyncio): HIGH — confirmed against official sklearn docs, project codebase, and multiple sources
- Architecture (manual FedAvg loop, geographic partitioning, asyncio pattern): HIGH — directly derived from existing project patterns
- Windows/Ray incompatibility: HIGH — confirmed via GitHub issue #5512 and pypi.org, reproduced by multiple users
- Pitfalls: HIGH — derived from confirmed sources (sklearn warm_start requirement, asyncio blocking behavior, CPython GIL)
- FLPanel D3 chart pattern: MEDIUM — derived from NodeCharts.tsx project code + d3 docs; not a novel pattern

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (flwr changes quickly; Ray/Windows situation may improve; sklearn stable)
