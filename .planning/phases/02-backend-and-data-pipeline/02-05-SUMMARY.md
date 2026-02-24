---
phase: 02-backend-and-data-pipeline
plan: 05
subsystem: frontend-charts
tags: [d3, sparklines, react-hooks, websocket, rest-history, svg]
dependency_graph:
  requires: [02-03]
  provides: [useNodeHistory, NodeCharts, live-sparklines]
  affects: [StatusPanel, DashboardLayout]
tech_stack:
  added: []
  patterns: [d3-svg-sparkline, rolling-buffer, hook-composition, inner-component-for-hooks]
key_files:
  created:
    - src/hooks/useNodeHistory.ts
    - src/components/sidebar/NodeCharts.tsx
  modified:
    - src/components/layout/StatusPanel.tsx
    - src/components/layout/DashboardLayout.tsx
decisions:
  - "NodeChartsWrapper inner component in StatusPanel — React hooks rules require hook calls at component top level; inner component pattern avoids conditional hook calls"
  - "latestReading derived via useMemo from liveSelectedNode in DashboardLayout — keeps hook pure (no direct WebSocket access) while enabling real-time chart extension"
  - "D3 useEffect depends on [data, field, color] — full SVG redraw on each update is correct for a capped 300-point buffer at sparkline scale"
metrics:
  duration: 1min
  completed_date: 2026-02-24
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 2 Plan 5: Node History Sparklines Summary

**One-liner:** useNodeHistory hook (REST fetch + WebSocket rolling buffer) paired with D3 v7 SVG sparklines in NodeCharts, wired into StatusPanel's node detail section for live voltage and frequency visualization.

## What Was Built

Added live voltage and frequency sparkline charts to the sidebar node detail panel:

- **src/hooks/useNodeHistory.ts** — Pure data hook. Fetches last 5 minutes from `GET /api/nodes/{nodeId}/history?minutes=5` when `selectedNodeId` changes. Maintains a rolling buffer capped at 300 readings (5 min at 1s intervals). Appends `latestReading` (passed as prop from parent) via separate `useEffect`. Gracefully falls back to empty array on fetch errors or when InfluxDB is unavailable. Exports `useNodeHistory` and `NodeReading` interface.

- **src/components/sidebar/NodeCharts.tsx** — D3 v7 SVG sparklines. `Sparkline` private component renders area fill + line + current-value dot using `d3.scaleLinear`, `d3.line`, `d3.area`, and `d3.curveMonotoneX`. Shows "Awaiting data..." placeholder text when fewer than 2 data points are available. `NodeCharts` public component renders voltage (blue #60a5fa) and frequency (green #34d399) sparklines or "Loading history..." during the initial REST fetch.

- **src/components/layout/StatusPanel.tsx** — Added `NodeChartsWrapper` inner component that calls `useNodeHistory` (required by React hooks rules — cannot call hooks conditionally). `StatusPanel` now accepts `latestReading?: NodeReading | null` prop. "Live Charts" section appears below existing sensor readings in the selected node detail block.

- **src/components/layout/DashboardLayout.tsx** — Added `latestReading` `useMemo` that derives a `NodeReading` from `liveSelectedNode` (voltage, frequency, load + `new Date().toISOString()`). Passes `latestReading` to `StatusPanel`. This triggers `useNodeHistory`'s append effect on every WebSocket tick while a node is selected.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useNodeHistory hook | b05a08e | src/hooks/useNodeHistory.ts |
| 2 | NodeCharts SVG sparklines and StatusPanel integration | 9372dc3 | src/components/sidebar/NodeCharts.tsx, src/components/layout/StatusPanel.tsx, src/components/layout/DashboardLayout.tsx |

## Verification Results

1. `npm run build` exits 0 with no TypeScript errors — PASSED
2. `ls src/components/sidebar/NodeCharts.tsx src/hooks/useNodeHistory.ts` — both exist — PASSED
3. `grep "NodeCharts\|useNodeHistory" src/components/layout/StatusPanel.tsx` — matches on lines 2, 3, 4, 23, 24, 25, 99 — PASSED
4. D3 v7 used for all SVG rendering — no new charting library added to package.json — PASSED
5. Graceful degradation: "Awaiting data..." shown when data.length < 2 — PASSED

## Deviations from Plan

None — plan executed exactly as written. DashboardLayout.tsx already contained Plan 04's storm button additions (from a concurrent wave 3 plan), which were preserved without conflict.

## Self-Check: PASSED

- src/hooks/useNodeHistory.ts exists: FOUND
- src/components/sidebar/NodeCharts.tsx exists: FOUND
- src/components/layout/StatusPanel.tsx modified: FOUND
- src/components/layout/DashboardLayout.tsx modified: FOUND
- Commit b05a08e exists: FOUND
- Commit 9372dc3 exists: FOUND
