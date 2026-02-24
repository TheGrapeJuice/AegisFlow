---
phase: 01-frontend-shell
plan: 03
subsystem: ui
tags: [d3, d3v7, maplibre-gl, react, typescript, svg-overlay, tailwindcss]

# Dependency graph
requires:
  - 01-frontend-shell/01-01 (Vite + React + TailwindCSS layout shell with grid-* color tokens)
  - 01-frontend-shell/01-02 (MapLibre map with GRID_TOPOLOGY 24 nodes, selectedNode state in DashboardLayout)
provides:
  - D3 v7 SVG overlay on top of MapLibre: node name labels and selection ring that track viewport with zero drift
  - map.project() anti-drift technique: all SVG positions recalculated from world coords on every move/zoom/resize event
  - MapLegend component: floating bottom-left panel explaining status colors (green/yellow/red) and node type sizes
  - Expanded StatusPanel node detail: status badge (colored pill), node name/type, voltage/frequency/load with color-coded load
  - All Phase 1 visual requirements addressed across Plans 01-03
affects: [04-frontend-shell]

# Tech tracking
tech-stack:
  added:
    - d3@^7 (D3.js v7 — SVG manipulation, data binding, enter/update/exit pattern)
    - "@types/d3 (TypeScript type declarations for D3 v7)"
  patterns:
    - D3 overlay pattern: SVG absolutely positioned over MapLibre canvas, pointer-events none
    - Anti-drift projection: map.project([lng, lat]) called inside render() on every map move/zoom/resize event
    - D3 enter/update/exit: labels.enter().merge(labels) for efficient SVG DOM updates
    - Null narrowing: capture prop as const inside useEffect to narrow type for closures

key-files:
  created:
    - src/components/map/D3Overlay.tsx
    - src/components/map/MapLegend.tsx
  modified:
    - src/components/map/GridMap.tsx
    - src/components/layout/StatusPanel.tsx
    - src/components/layout/DashboardLayout.tsx
    - package.json

key-decisions:
  - "map.project() on every move event: the correct anti-drift technique — SVG positions recalculated from world coords, not translated"
  - "D3 SVG is pointer-events: none: MapLibre circle layer handles clicks, D3 is decorative/labeling only"
  - "Null narrowing via const m = map: TypeScript strict mode requires capturing narrowed map ref inside useEffect before nested functions"

patterns-established:
  - "D3/MapLibre integration pattern: SVG absolutely positioned, z-index:1, pointer-events:none; positions updated on map.on('move'/'zoom'/'resize')"
  - "Selection ring pattern: D3 circle with stroke-dasharray='4 2', r=16, only bound to nodes matching selectedNodeId"
  - "Load color pattern: green < 75%, yellow 75-90%, red > 90%"

requirements-completed: [MAP-02, MAP-03, SHELL-02, SHELL-03]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 1 Plan 03: D3 Overlay, Node Detail Panel, and Map Legend Summary

**D3 v7 SVG overlay synchronized to MapLibre viewport using map.project() on every move event (zero drift); floating map legend with status colors and node types; expanded node detail panel showing name, type, voltage, frequency, and color-coded load**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-24T02:53:29Z
- **Completed:** 2026-02-24T02:55:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- D3 v7 installed (d3@^7, @types/d3) and integrated with MapLibre GL JS 4.7.1 without react-map-gl wrapper
- D3Overlay.tsx created: SVG overlay that repositions all labels and the selection ring via `map.project()` on every `move`, `zoom`, and `resize` event — anti-drift technique that recalculates pixel positions from world coordinates on every frame
- Node name labels (first word, slate-400 color, 10px Inter) appear 14px above each node dot and track pan/zoom with zero drift
- Blue dashed selection ring (r=16, stroke-dasharray 4-2) appears around selected node and tracks viewport
- MapLegend.tsx created: floating bottom-left panel with CARTO-dark-compatible glass styling showing 3 status color swatches and 4 node type size circles
- StatusPanel node detail expanded: status badge (colored pill), node name/type, voltage (kV), frequency (2 decimal Hz), load% with color coding (green/yellow/red by threshold)
- All 4 Phase 1 requirements addressed: MAP-01 (Plan 02), MAP-02, MAP-03, SHELL-02 (Plan 02), SHELL-03
- `npm run build` passes with zero TypeScript errors

## D3 Version and Overlay Synchronization Technique

- **D3 version:** d3@7.x (v7 API, enter/update/exit pattern, d3.select)
- **Overlay technique:** SVG is `position: absolute; inset: 0; pointer-events: none; z-index: 1` inside the map container div
- **Anti-drift:** Each `render()` call invokes `map.project([node.lng, node.lat])` for every node — converting WGS84 world coordinates to current pixel positions. No CSS transforms or translation — positions are recalculated fresh on every map `move`/`zoom`/`resize` event
- **Why this works:** MapLibre's `map.project()` accounts for the current viewport transform, camera angle, zoom, and projection; SVG elements are repositioned absolutely, so they track the map exactly regardless of how far you pan or zoom

## Node Detail Panel Data Fields

When a node is selected:
- Status badge: colored pill (green-500/20 bg for normal, yellow-500/20 for warning, red-500/20 for critical)
- Node name (text-sm font-semibold)
- Node type (capitalized, text-xs muted)
- Voltage: value in kV (font-mono)
- Frequency: value to 2 decimal places in Hz (font-mono)
- Load: percentage with color coding — green < 75%, yellow 75-90%, red > 90%

## MapLibre/D3 Integration Notes

**TypeScript null narrowing issue:** The `map` prop is typed as `maplibregl.Map | null`. Despite the early `if (!map) return` guard, TypeScript strict mode does not narrow the type inside nested function closures (`project()` and `render()`). Fix: assign `const m = map` immediately after the guard check — TypeScript narrows `m` to `maplibregl.Map` (non-null) and closures capture the narrowed type.

**Pointer events:** D3 SVG must be `pointer-events: none`. MapLibre's `grid-nodes-layer` circle layer handles all click events. If pointer events were enabled on the SVG, map interactions would be intercepted.

**Event listener cleanup:** Each `render` function is created inside useEffect. The cleanup function captures the same `render` reference via closure, so `map.off('move', render)` correctly removes the exact function that was registered. This prevents memory leaks and double-render on React StrictMode double-mount.

## Task Commits

Each task was committed atomically:

1. **Task 1: D3 SVG overlay synchronized with MapLibre viewport** - `c2218ff` (feat)
2. **Task 2: Node detail panel and map legend** - `bc8d793` (feat)

## Files Created/Modified

- `src/components/map/D3Overlay.tsx` - SVG overlay with node labels and selection ring, synchronized via map.project() on every viewport change (79 lines)
- `src/components/map/MapLegend.tsx` - Floating legend panel with status colors and node type size indicators (51 lines)
- `src/components/map/GridMap.tsx` - Added mapInstance useState, D3Overlay render, MapLegend render, selectedNodeId prop (145 lines)
- `src/components/layout/StatusPanel.tsx` - Expanded node detail: status badge, sensor readings, color-coded load (85 lines)
- `src/components/layout/DashboardLayout.tsx` - Pass selectedNodeId prop to GridMap
- `package.json` / `package-lock.json` - d3@^7 and @types/d3 added

## Decisions Made

- **map.project() anti-drift technique:** Recalculate SVG positions from world coordinates on every map event — not translate/transform. This is the canonical approach for D3-on-MapLibre; the alternative (CSS transform updates) drifts at non-integer zoom levels and projection edges.
- **D3 as decorative layer:** MapLibre's GeoJSON circle layer handles all hit detection and click events. D3 SVG is labels + selection indicator only — no interaction logic in D3.
- **Null narrowing via `const m = map`:** Required by TypeScript strict mode for the D3Overlay `render` closure. Guards at the top of useEffect are not carried into nested function bodies without explicit variable capture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript null narrowing in D3Overlay nested closures**
- **Found during:** Task 1 (D3Overlay.tsx creation)
- **Issue:** `map` prop is typed `maplibregl.Map | null`; early `if (!map) return` guard does not narrow the type inside `project()` and `render()` closure functions — TypeScript strict mode (TS18047) reported `'map' is possibly 'null'` at `map.project()` and `map.getCanvas()` call sites
- **Fix:** Added `const m = map` immediately after the null guard; replaced all uses of `map` inside nested functions with `m` — TypeScript narrows `m: maplibregl.Map` (non-null) via definite assignment
- **Files modified:** src/components/map/D3Overlay.tsx
- **Verification:** `npm run build` exits 0 with zero TypeScript errors after fix
- **Committed in:** c2218ff (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript null narrowing bug)
**Impact on plan:** Minor — required one-line local variable addition to satisfy TypeScript strict mode. No logic change, no scope change.

## Issues Encountered

None beyond the TypeScript null narrowing fix documented above.

## User Setup Required

None - D3 v7 is a build-time dependency. No external services, API keys, or environment variables required.

## Next Phase Readiness

- All 4 Phase 1 requirements (MAP-01, MAP-02, MAP-03, SHELL-01, SHELL-02, SHELL-03, SHELL-04) are now addressed across Plans 01-03
- Phase 1 visual feature set is complete — the dashboard is visually compelling with interactive map, node detail, and legend
- Plan 04 can extend D3Overlay or MapLibre layers with live data (websocket/polling) — the selectedNode state and map instance are wired and ready
- `npm run build` passes clean — TypeScript baseline solid for Plan 04

## Self-Check: PASSED

- FOUND: src/components/map/D3Overlay.tsx
- FOUND: src/components/map/MapLegend.tsx
- FOUND: src/components/map/GridMap.tsx (updated)
- FOUND: src/components/layout/StatusPanel.tsx (updated)
- FOUND commit c2218ff (Task 1)
- FOUND commit bc8d793 (Task 2)
- npm run build: exits 0, DETAIL_LEGEND_OK

---
*Phase: 01-frontend-shell*
*Completed: 2026-02-24*
