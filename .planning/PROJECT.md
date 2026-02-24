# AegisFlow

## What This Is

AegisFlow is a portfolio project that simulates an AI-powered smart grid management system. It presents a live, dark-themed dashboard where power nodes across a simulated city are monitored in real time — anomalies flicker, cascade failures are predicted before they happen, and an AI model reroutes load automatically. Three simulated federated learning clients train a shared model without exchanging raw data. The project demonstrates breadth across ML engineering, real-time backend systems, and data visualization in a single deployable artifact.

## Core Value

A live, visually compelling dashboard that makes AI-powered grid intelligence *feel* real — the kind of demo that gets paused during an interview so the interviewer can ask how it works.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Dark-themed React dashboard with sidebar, header, and status panel
- [ ] Mapbox GL JS map with power node dots and distribution edge lines
- [ ] D3.js graph network overlay on top of the map
- [ ] FastAPI backend serving node and edge data
- [ ] InfluxDB storing time-series sensor readings
- [ ] XGBoost anomaly detection model flagging abnormal voltage/frequency
- [ ] WebSocket connection for real-time frontend updates
- [ ] "Simulate Storm Event" button that injects fault into the data stream
- [ ] Live voltage/frequency charts in sidebar (Recharts or D3)
- [ ] PyTorch Geometric GNN predicting cascade failure propagation
- [ ] Cascade failure visualization: chain of at-risk nodes highlighting in sequence with predicted timing
- [ ] Optimal rerouting path highlighted in blue on the map
- [ ] Flower federated learning simulation with 3 local "utility" clients
- [ ] FL panel showing each client's training rounds and global model accuracy
- [ ] Frontend deployed on Vercel, backend deployed on Railway
- [ ] 2-minute demo video recording the storm simulation flow
- [ ] README with architecture diagrams

### Out of Scope

- Real utility grid integration — this is synthetic data only, not a production control system
- Mobile app — web-first, desktop viewport only
- Real-time NOAA weather data in v1 — storm events are simulated via button, not live weather feed
- Multi-user auth — this is a demo, not a SaaS product
- Native mobile app — portfolio context makes this unnecessary

## Context

This is a portfolio project designed to demonstrate generalist engineering depth — ML pipelines, real-time systems, and frontend visualization — in a single artifact. The visual impact of the dashboard is the primary hire signal; everything under the hood exists to make that demo moment undeniable.

The build follows a layered approach: get something on screen fast (static map + fake data), then wire in real data, then upgrade the ML from XGBoost to GNN, then add federated learning on top. Each layer is independently demonstrable.

Both a live deployment URL and a demo video are required — the URL proves it's real when someone checks your resume; the video tells the story in interviews and applications.

## Constraints

- **Tech Stack**: React + Vite + TailwindCSS + Mapbox GL JS + D3.js + Recharts (frontend); Python + FastAPI + WebSockets (backend); InfluxDB (time-series); XGBoost → PyTorch Geometric + Flower (ML) — already decided, not negotiable
- **Data**: Synthetic data from NREL/OPSD datasets — no real utility infrastructure access
- **Deployment**: Vercel (frontend), Railway (backend) — must support a live URL for the portfolio
- **Solo build**: Single developer — scope must be achievable incrementally, with each phase producing a demonstrable state
- **Portfolio framing**: The architecture must be explainable in an interview; complexity for complexity's sake is a liability

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| XGBoost before GNN | Baseline model first — proves the pipeline works before upgrading to the impressive piece | — Pending |
| Mapbox GL JS for map | Industry-standard, visually polished, good React integration | — Pending |
| Flower for federated learning | Most widely adopted FL framework, good simulation support, recognizable on a resume | — Pending |
| InfluxDB over PostgreSQL | Purpose-built for time-series sensor data; shows domain-appropriate tooling choice | — Pending |
| Recharts for charts | Simpler React integration than full D3 for charts; D3 reserved for the graph network | — Pending |

---
*Last updated: 2026-02-23 after initialization*
