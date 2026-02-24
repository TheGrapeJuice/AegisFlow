---
phase: 02-backend-and-data-pipeline
plan: 03
subsystem: frontend-data-layer
tags: [react-hooks, websocket, rest, exponential-backoff, maplibre, live-data]
dependency_graph:
  requires: [02-01]
  provides: [useTopology, useNodeWebSocket, live-map-updates]
  affects: [frontend-map, dashboard-layout]
tech_stack:
  added: []
  patterns: [custom-react-hooks, exponential-backoff-reconnect, useMemo-merge, geojson-setData]
key_files:
  created:
    - src/hooks/useTopology.ts
    - src/hooks/useNodeWebSocket.ts
  modified:
    - src/types/grid.ts
    - src/components/layout/DashboardLayout.tsx
    - src/components/map/GridMap.tsx
    - src/components/map/D3Overlay.tsx
    - src/components/layout/Header.tsx
decisions:
  - "mapLoaded boolean guard prevents setData() calls before GeoJSON sources exist in MapLibre"
  - "D3Overlay updated to accept nodes as prop — removes last GRID_TOPOLOGY reference from components tree"
  - "VITE_API_BASE / VITE_WS_BASE env vars with localhost fallbacks allow prod override without hardcoding"
metrics:
  duration: 7min
  completed_date: 2026-02-24
  tasks_completed: 2
  files_created: 2
  files_modified: 5
---

# Phase 2 Plan 3: Frontend Live Data Hooks Summary

**One-liner:** Two focused React hooks (useTopology for REST fetch, useNodeWebSocket for WebSocket with exponential backoff) wired into DashboardLayout to replace the hardcoded GRID_TOPOLOGY import with live backend data.

## What Was Built

Replaced all hardcoded `GRID_TOPOLOGY` references with live backend data:

- **src/hooks/useTopology.ts** — Fetches `GET /api/topology` on mount using `VITE_API_BASE` env var (fallback: `http://localhost:8000`). Returns `{ nodes, edges, loading, error }`. Cancels in-flight fetch on unmount via cancelled flag.

- **src/hooks/useNodeWebSocket.ts** — Manages WebSocket lifecycle to `VITE_WS_BASE/ws/nodes`. Maintains a `Map<string, GridNode>` keyed by node id. Reconnects on close/error with exponential backoff: 1s → 2s → 4s → 8s → ... → 30s max. Resets backoff to 1s on successful open.

- **src/types/grid.ts** — Added `TopologyResponse` interface (nodes + edges) to match backend Pydantic model.

- **src/components/layout/DashboardLayout.tsx** — Uses `useTopology` for initial data and `useNodeWebSocket` for live overrides. Merges them via `useMemo`: if nodeMap has a version of a node, it wins; otherwise topology version is used. selectedNode is also kept in sync with live updates.

- **src/components/map/GridMap.tsx** — Now accepts `nodes: GridNode[]` and `edges: GridEdge[]` as props. GRID_TOPOLOGY import removed. `mapLoaded` state boolean guards the `setData` effect so sources are never updated before they exist. GeoJSON helper functions `nodesToGeoJSON` and `edgesToGeoJSON` extracted for reuse between initial load and updates.

- **src/components/map/D3Overlay.tsx** — Updated to accept `nodes: GridNode[]` prop instead of importing GRID_TOPOLOGY. This removes the last hardcoded reference from the component tree.

- **src/components/layout/Header.tsx** — Accepts optional `connected?: boolean` prop (defaults to true). Shows green "LIVE" indicator when connected, yellow "RECONNECTING" indicator with animate-pulse when WebSocket is disconnected.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useTopology and useNodeWebSocket hooks | bb69529 | src/hooks/useTopology.ts, src/hooks/useNodeWebSocket.ts, src/types/grid.ts |
| 2 | Wire hooks into DashboardLayout | 7740587 | src/components/layout/DashboardLayout.tsx, src/components/map/GridMap.tsx, src/components/map/D3Overlay.tsx, src/components/layout/Header.tsx |

## Verification Results

1. `npm run build` exits 0 — PASSED
2. `grep -r "GRID_TOPOLOGY" src/components/` → no matches — PASSED
3. Both useTopology and useNodeWebSocket imported and used in DashboardLayout — PASSED
4. useTopology fetches from REST with loading/error states and cleanup — PASSED
5. useNodeWebSocket reconnects with exponential backoff (1s→2s→4s→8s→30s max) — PASSED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated D3Overlay to accept nodes as prop**
- **Found during:** Task 2
- **Issue:** D3Overlay also imported GRID_TOPOLOGY directly. The plan said to remove GRID_TOPOLOGY from GridMap.tsx but did not explicitly mention D3Overlay. Leaving D3Overlay importing the hardcoded data would mean labels would not update with live node positions on WebSocket pushes.
- **Fix:** Added `nodes: GridNode[]` prop to D3OverlayProps. Removed GRID_TOPOLOGY import. GridMap passes its `nodes` prop down to D3Overlay. D3Overlay render and useEffect dependency array include nodes.
- **Files modified:** src/components/map/D3Overlay.tsx, src/components/map/GridMap.tsx
- **Commit:** 7740587

## Self-Check: PASSED

- src/hooks/useTopology.ts exists: FOUND
- src/hooks/useNodeWebSocket.ts exists: FOUND
- src/types/grid.ts modified (TopologyResponse added): FOUND
- src/components/layout/DashboardLayout.tsx modified: FOUND
- src/components/map/GridMap.tsx modified: FOUND
- src/components/map/D3Overlay.tsx modified: FOUND
- src/components/layout/Header.tsx modified: FOUND
- Commit bb69529 exists: FOUND
- Commit 7740587 exists: FOUND
- GRID_TOPOLOGY not present in src/components/: CONFIRMED
