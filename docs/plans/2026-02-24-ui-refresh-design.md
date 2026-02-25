# AegisFlow UI Refresh — Design Document

**Date:** 2026-02-24
**Status:** Approved
**Goal:** Cohesive visual uplift across all panels — surgical polish + mission-control data density + selective visual drama. No layout changes; no new backend routes required except leveraging existing WebSocket stream for the event feed.

---

## Approved Design

### 1. Header

- **Logo glow:** AegisFlow text gets a subtle `text-shadow: 0 0 12px rgba(96,165,250,0.4)` — low-key blue glow
- **Bottom border:** Replace flat `border-b` with a center-fading gradient line (`transparent → blue-400/30 → transparent`) via a pseudo-element or inner div
- **Live node summary:** New center element showing `● 12 Normal  ● 3 Warning  ● 1 Critical` as color-coded inline chips, derived from the live `nodes` array passed down from DashboardLayout
- **LIVE dot + clock:** Unchanged

### 2. Left Sidebar

- **Active nav item:** Add `box-shadow: inset 3px 0 10px rgba(59,130,246,0.2)` for a left-edge glow on top of the existing blue tint + right border
- **Inactive hover:** More visible — slightly lighter background glow rather than just text color change
- **Storm button:** Add `⚡` icon when inactive; existing "⚡ Stop Storm" label stays for active state. Add a thin border at rest (`border border-orange-500/20`)
- **Panel depth:** Subtle top-to-bottom gradient on the sidebar background (lighter at top, darker at bottom) to break up flat `grid-surface`

### 3. Right Panel — Stat Cards

- **Left-border accent (3px):** Each card gets a semantic color strip:
  - Active Nodes → `border-l-4 border-green-500`
  - Anomalies → dynamic: `border-green-500` if 0, `border-red-500` if >0. Card pulses subtly (`animate-pulse` on border) when anomaly count >0
  - Grid Load → `border-yellow-500`; plus a thin fill bar at card bottom (% width, color by threshold: <75% green, <90% yellow, ≥90% red)
  - FL Round → `border-blue-500`
- **Glassmorphism:** Cards get `backdrop-filter: blur(4px)` + `bg-grid-bg/80` (slight translucency)
- **Panel glow:** Right panel container gets `box-shadow: -4px 0 24px rgba(59,130,246,0.07)` — faint left-side neon leak

### 4. Node Detail Panel

- **Load %:** Replace `{selectedNode.load}%` text with a horizontal progress bar — thin (h-1.5), color-coded by threshold (<75% green, <90% yellow, ≥90% red), with `%` label inline on the right
- **Voltage:** Row becomes: label | small deviation bar (centered, left = low, right = high, red if >±10% from nominal 120kV) | value
- **Frequency:** Same treatment (60 Hz nominal, ±0.5 Hz tolerance)
- **Status badge:** Add a `ring-2 ring-offset-1 animate-pulse` ring around the badge when status is `warning` or `critical`

### 5. Live Event Feed (new component)

- **Location:** Bottom of right panel, below Node Detail, separated by a border
- **Data source:** WebSocket node updates already flowing through `useNodeWebSocket` — detect status transitions (previous status ≠ new status) and push to a local event ring buffer
- **Display:** Last 10 events, each row: `[node name]  [old] → [new]  [HH:MM:SS]`
- **Styling:** Color-coded by new status; older entries have reduced opacity; container has `overflow-y-auto max-h-40`; newest entry slides in from top
- **Implementation note:** Event buffer lives in `DashboardLayout` (or a new `useEventFeed` hook) — no backend changes needed

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/Header.tsx` | Logo glow, gradient border, node summary chips |
| `src/components/layout/Sidebar.tsx` | Nav glow, storm button border, panel gradient |
| `src/components/layout/StatusPanel.tsx` | Stat card accents + progress bar, node detail bars, status badge ring, event feed section |
| `src/components/layout/DashboardLayout.tsx` | Pass `nodes` to Header; add event feed state/hook; pass to StatusPanel |
| `src/hooks/useEventFeed.ts` (new) | Track node status transitions, maintain ring buffer of last 10 events |

---

## Constraints

- No new backend API calls
- No layout dimension changes (sidebar widths, header height unchanged)
- Glassmorphism only on stat cards (not full panels — panels are fixed-width, not map overlays)
- Event feed populated purely from existing WebSocket state
- Keep changes within the 5 files above — no new component files except `useEventFeed.ts`
