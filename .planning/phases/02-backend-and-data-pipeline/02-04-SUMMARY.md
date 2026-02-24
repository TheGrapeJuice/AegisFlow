---
phase: 02-backend-and-data-pipeline
plan: 04
subsystem: frontend-storm-simulation
tags: [react, websocket, storm-simulation, fetch, loading-state, maplibre]
dependency_graph:
  requires: [02-03]
  provides: [storm-event-button, live-map-color-updates]
  affects: [frontend-sidebar, dashboard-layout, frontend-map]
tech_stack:
  added: []
  patterns: [async-loading-state, env-var-api-base, geojson-setData-live-update]
key_files:
  created: []
  modified:
    - src/components/layout/Sidebar.tsx
    - src/components/layout/DashboardLayout.tsx
decisions:
  - "handleStormEvent defined in DashboardLayout (not Sidebar) — keeps fetch logic colocated with other API calls and keeps Sidebar as a pure UI component"
  - "VITE_API_BASE reused in DashboardLayout — consistent with useTopology.ts pattern established in Plan 03"
  - "GridMap live setData useEffect was already complete from Plan 03 — no changes required to GridMap.tsx in this plan"
metrics:
  duration: 1min
  completed_date: 2026-02-24
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 2 Plan 4: Live Map Updates and Storm Simulation Summary

**One-liner:** Storm Event button with async loading/success/error states wired to POST /api/storm in Sidebar, with DashboardLayout handling the fetch; GridMap live-color useEffect already complete from Plan 03.

## What Was Built

- **src/components/layout/Sidebar.tsx** — Added `SidebarProps` interface with `onStormEvent?: () => Promise<void>`. Added `loading` and `lastResult` state. Storm Event button renders above the version badge with three visual states: orange default, orange/cursor-wait "Injecting..." during flight, green "Storm Injected" on success (resets after 3s), red "Failed" on error (resets after 3s).

- **src/components/layout/DashboardLayout.tsx** — Added `API_BASE` constant using `import.meta.env.VITE_API_BASE` with `http://localhost:8000` fallback. Added `handleStormEvent` async function that POSTs to `/api/storm` and throws on non-ok response. Passes `handleStormEvent` to `<Sidebar onStormEvent={handleStormEvent} />`.

- **src/components/map/GridMap.tsx** — No changes required. The live `setData` useEffect watching `[nodes, edges, mapLoaded]` was already implemented in Plan 03 and fully satisfies Task 1's requirements.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Live map node color updates from WebSocket | (Plan 03 commit 7740587) | src/components/map/GridMap.tsx |
| 2 | Storm Event button in Sidebar | 0f3e350 | src/components/layout/Sidebar.tsx, src/components/layout/DashboardLayout.tsx |

## Verification Results

1. `npm run build` exits 0 — PASSED
2. `grep "setData" src/components/map/GridMap.tsx` — matches (nodesSource?.setData, edgesSource?.setData) — PASSED
3. `grep "api/storm" src/components/layout/DashboardLayout.tsx` — matches — PASSED
4. `grep "onStormEvent" src/components/layout/Sidebar.tsx` — matches (prop interface, destructure, guard, await call) — PASSED

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. Task 1 was already complete from Plan 03 (the `mapLoaded` guard and second `useEffect` for `setData` were implemented there). Task 2 was implemented per spec.

## Self-Check: PASSED

- src/components/layout/Sidebar.tsx modified (onStormEvent prop, loading/error states, Storm button): FOUND
- src/components/layout/DashboardLayout.tsx modified (API_BASE, handleStormEvent, Sidebar prop): FOUND
- GridMap.tsx setData useEffect present: CONFIRMED (from Plan 03)
- Commit 0f3e350 exists: FOUND
- npm run build exits 0: CONFIRMED
