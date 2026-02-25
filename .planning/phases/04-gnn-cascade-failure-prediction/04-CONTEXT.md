# Phase 4: GNN Cascade Failure Prediction - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

When XGBoost flags a grid anomaly, a GNN predicts how the fault propagates through the grid topology — visualizing cascade-at-risk nodes in sequence on the map with timing labels and confidence scores, plus a recommended rerouting path. This phase covers: GNN model training and inference, cascade visualization on the map, confidence score display, and the rerouting overlay. New ML capabilities (e.g., additional model types) belong in later phases.

</domain>

<decisions>
## Implementation Decisions

### Cascade Animation Style
- Nodes highlight **sequentially** in a pulse, following the propagation timeline (most dramatic, communicates the spread)
- Cascade nodes turn **orange/amber** — distinct from Phase 3's red anomaly nodes; conveys "at risk but not yet failed"
- Timing labels (e.g., "~4 min") appear **floating above each node** on the map — always visible, no hover required
- Cascade visualization **auto-fades after ~30 seconds**, then re-triggers if the anomaly state persists

### GNN Model Architecture & Training
- Use a **real Graph Convolutional Network (GCN)** — actual PyTorch Geometric inference, not a rule-based simulation
- **Static topology, dynamic features**: grid wiring is fixed; node features (load, anomaly flag, voltage readings) update live from the simulator
- **Synthetic training data** generated from the existing grid simulator: run many iterations with injected anomalies, record which nodes subsequently failed as supervised labels
- Training is done offline; model weights are bundled and loaded at inference time

### Confidence Score Display
- Each cascade-at-risk node shows a **floating percentage badge below the node name** on the map (e.g., "87% cascade risk") — always visible during active cascade
- **Three-tier visual thresholds**:
  - >75%: bright amber + pulsing animation
  - 50–75%: steady amber
  - <50%: faded amber
- **Dedicated "Cascade Risk" panel** in the right sidebar (alongside anomaly alerts) — ranked list of at-risk nodes ordered by confidence score with timing
- When no cascade is active, panel shows: **"No cascade risk detected"**

### Rerouting Overlay
- Rerouting computed by a **separate shortest-path algorithm (Dijkstra/A*)** on the graph, avoiding nodes flagged as high-risk by the GNN — clean separation from GNN prediction
- **Sequential reveal**: cascade animation plays first (1–2s), then the blue rerouting path draws in after a short delay — tells a story: problem detected → solution computed
- Rerouting path drawn as a **blue highlighted overlay on existing grid edge geometry** (not a floating line) — respects actual grid topology
- The cascade risk panel surfaces a **brief rerouting summary**: e.g., "Rerouting: via Node 12 → Node 7, +15% capacity margin"

### Claude's Discretion
- Exact delay timing between cascade animation and rerouting reveal
- Specific node feature normalization and GCN layer count/hidden dimensions
- Animation easing curves for the sequential pulse
- Exact edge highlight thickness and opacity for the rerouting overlay

</decisions>

<specifics>
## Specific Ideas

- The phase should feel like a real operational tool: anomaly detected → cascade predicted → system proposes a fix. The sequential cascade-then-rerouting reveal is the core narrative beat.
- Confidence badge position (below node name) + timing label position (above node) keeps both pieces of info visible simultaneously without overlap.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-gnn-cascade-failure-prediction*
*Context gathered: 2026-02-25*
