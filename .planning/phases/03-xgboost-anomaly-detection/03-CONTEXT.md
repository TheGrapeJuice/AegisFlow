# Phase 3: XGBoost Anomaly Detection - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

ML pipeline end-to-end: InfluxDB sensor data → XGBoost inference → anomaly alerts surfaced in the dashboard UI. This phase moves the system from rule-based node status thresholds to an actual trained model. Scope is detection and alerting only — cascade failure prediction and rerouting belong in Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Anomaly Alert Panel
- **Location**: Dedicated overlay/drawer — not embedded in StatusPanel
- **Trigger**: Auto-open on first anomaly detected (no manual toggle needed)
- **Alert row content**: Node ID + timestamp + anomaly score (probability value from XGBoost)
- **Dismiss**: X button per row; clicking removes that row from the panel
- Panel auto-opens; can presumably be closed/re-opened by the user

### Model Training & Features
- **Training strategy**: Pre-train on synthetic data offline; commit model artifact to the repo. Server loads artifact at startup — no training at runtime
- **Feature set**: Raw sensor readings (voltage, frequency, load) + rolling statistics (rolling mean and std over last N readings per node). Rolling stats provide temporal context for detecting gradual drift
- **Training labels**: Rule-based threshold labels on synthetic data (e.g., voltage outside nominal range → anomalous). Simple, reproducible, transparent
- **Artifact location**: `backend/ml/` — training script at `backend/ml/train.py`, model artifact at `backend/ml/model.json` (or `.pkl`), committed to repo

### Inference Loop Integration
- **Execution**: Separate async background task on a ~5s timer — decoupled from the WebSocket 1s broadcast loop (same pattern as the InfluxDB writer)
- **Data source**: Latest readings from the shared `NODE_STATES` dict (already in memory from the existing data generator)
- **Result delivery**: Inline in existing WebSocket node messages — add `anomaly_score` (float) and `is_anomalous` (bool) fields to the existing per-node payload. No new message type, no frontend reconnect needed
- **Anomaly threshold**: XGBoost probability > 0.5 (standard binary classification threshold)

### Alert Lifecycle
- **Recovery behavior**: Alerts stay in the panel until manually dismissed — they are a log of what happened, not a live mirror of node state
- **Re-alert**: If a dismissed node becomes anomalous again (e.g., after a second storm), a fresh alert row appears
- **Deduplication**: If a node is already in the panel and remains anomalous on the next inference cycle, update its score and timestamp in place — do not append a duplicate row
- **Persistence**: Frontend state only (React state) — alerts clear on page reload. No backend storage needed

### Claude's Discretion
- Exact overlay/drawer styling and animation (slide-in direction, backdrop, z-index)
- Rolling window size for rolling stats features
- Number of training samples and exact threshold values used for labels in the training script
- Whether to expose a "Clear all" button in addition to per-row X buttons

</decisions>

<specifics>
## Specific Ideas

- The anomaly score displayed in the panel should feel quantitative — showing "0.87" is more compelling in a demo than just a colored badge
- The auto-open behavior on first anomaly is intentional for demo impact: storm fires → nodes turn red → panel slides in automatically

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-xgboost-anomaly-detection*
*Context gathered: 2026-02-25*
