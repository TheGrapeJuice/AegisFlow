# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A live, visually compelling dashboard that makes AI-powered grid intelligence feel real — the kind of demo that gets paused during an interview so the interviewer can ask how it works.
**Current focus:** Phase 1 — Frontend Shell

## Current Position

Phase: 1 of 7 (Frontend Shell)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-02-24 — Completed Plan 03 (D3 SVG overlay, node detail panel, map legend)

Progress: [███░░░░░░░] 11%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 7 min
- Total execution time: 0.33 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-frontend-shell | 3/4 | 20min | 7min |

**Recent Trend:**
- Last 5 plans: 01-01 (15min), 01-02 (3min), 01-03 (2min)
- Trend: improving

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Use MapLibre GL JS (not Mapbox) — eliminates billing risk on a public portfolio URL; API-compatible drop-in replacement
- [Init]: XGBoost before GNN — proves the full pipeline end-to-end with a fast interpretable model before adding GNN complexity
- [Init]: FL via file checkpoint handoff — decoupled from real-time path; inference loop reloads weights on 60-second interval
- [01-01]: Tailwind v3 over v4 — v4 has different config API and limited ecosystem support as of early 2026
- [01-01]: tailwind.config.js (not .ts) — Tailwind v3 init generates .js by default; functionally equivalent
- [01-01]: Named exports for all layout components — enables selective imports and easier testing
- [01-01]: lucide-react for icons — consistent icon set, tree-shakeable, sizes cleanly with Tailwind
- [01-02]: Direct MapLibre API (not react-map-gl) — avoids wrapper complexity for D3 overlay integration in Plan 03
- [01-02]: maplibre-gl@4.7.1 ships own types — @types/maplibre-gl not needed, would cause conflicts
- [01-02]: CARTO Dark Matter basemap — free, no API key, visually correct dark style for ops dashboard
- [01-03]: map.project() anti-drift: recalculate SVG positions from world coordinates on every map move/zoom/resize event
- [01-03]: D3 SVG as decorative layer only (pointer-events: none) — MapLibre circle layer handles all click events
- [01-03]: null narrowing via const m = map: required by TypeScript strict mode for closures inside useEffect

### Pending Todos

None.

### Blockers/Concerns

- [Pre-build]: Verify PyTorch / PyG / CUDA version compatibility matrix before any Python environment creation (single highest-risk step)
- [Pre-build]: Verify InfluxDB 3.x OSS GA status — safe fallback is OSS 2.7.x
- [Pre-build]: Verify deck.gl 9.x + MapLibre 4.x peer dependencies before installing (deck.gl 9.x blocker now less relevant — plan uses D3 SVG overlay, not deck.gl)
- [Phase 4]: GNN architecture selection (GraphSAGE vs GATConv) benefits from a research-phase during planning
- [Phase 5]: Flower 1.x ClientApp/ServerApp API is a major redesign from 0.x — benefits from a research-phase during planning

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 01-03-PLAN.md — D3 overlay, node detail panel, map legend; ready for Plan 04
Resume file: None
