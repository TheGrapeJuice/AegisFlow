# UI Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cohesive visual uplift — header glow + node summary, sidebar depth, stat card accents + glassmorphism, node detail bars, live event feed.

**Architecture:** All changes are purely presentational and confined to layout components + one new hook. No new backend routes. Event feed derives from `liveNodes` (already computed in DashboardLayout from existing WebSocket stream). Each task is a self-contained commit.

**Tech Stack:** React, Tailwind CSS v3 (custom `grid-*`/`node-*` colors in `tailwind.config.js`), inline `style` props for non-Tailwind CSS (text-shadow, box-shadow, gradients).

---

## Task 1: Header — logo glow + gradient border + node summary chips

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/DashboardLayout.tsx` (pass `nodes` prop)

**Context:** Header currently has no data — just a name and a dot. We add a `nodes` prop so it can show live status counts, replace the flat bottom border with a centered gradient line, and add a text-shadow glow to the logo.

**Step 1: Replace Header.tsx entirely**

```tsx
import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import type { GridNode } from "../../types/grid";

interface HeaderProps {
  connected?: boolean;
  nodes?: GridNode[];
}

export function Header({ connected = true, nodes = [] }: HeaderProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const normalCount = nodes.filter(n => n.status === 'normal').length;
  const warningCount = nodes.filter(n => n.status === 'warning').length;
  const criticalCount = nodes.filter(n => n.status === 'critical').length;

  return (
    <header className="h-12 bg-grid-surface flex items-center px-4 flex-shrink-0 relative">
      {/* Gradient bottom border replacing flat border-b */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(96,165,250,0.3) 50%, transparent)' }}
      />

      {/* Logo */}
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-blue-400" />
        <span
          className="text-white font-bold text-lg tracking-tight"
          style={{ textShadow: '0 0 12px rgba(96,165,250,0.4)' }}
        >
          AegisFlow
        </span>
      </div>

      {/* Live node summary chips */}
      {nodes.length > 0 && (
        <div className="ml-8 flex items-center gap-4 text-xs font-mono">
          <span className="text-node-normal">● {normalCount} Normal</span>
          {warningCount > 0 && <span className="text-node-warning">● {warningCount} Warning</span>}
          {criticalCount > 0 && <span className="text-node-critical animate-pulse">● {criticalCount} Critical</span>}
        </div>
      )}

      {/* Right: connection status + clock */}
      <div className="ml-auto flex items-center gap-4">
        {connected ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-node-normal animate-pulse" />
            <span className="text-node-normal text-sm font-medium">LIVE</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-sm font-medium">RECONNECTING</span>
          </div>
        )}
        <span className="text-grid-muted text-sm font-mono">{time}</span>
      </div>
    </header>
  );
}
```

**Step 2: Pass `nodes` to Header in DashboardLayout.tsx**

Find line 69: `<Header connected={connected} />`
Replace with:
```tsx
<Header connected={connected} nodes={liveNodes} />
```

**Step 3: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```
Expected: `✓ built in` with no TypeScript errors.

**Step 4: Commit**

```bash
cd "C:/Users/saads/Documents/Aegis Flow"
git add src/components/layout/Header.tsx src/components/layout/DashboardLayout.tsx
git commit -m "feat(ui): header logo glow, gradient border, live node status chips"
```

---

## Task 2: Sidebar — left-glow active state + storm button border + panel depth

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Context:** Active nav item needs a left-edge glow (can't do inset box-shadow in Tailwind alone — use inline `style`). Storm button gets a thin border at rest. The aside gets a subtle top-to-bottom gradient.

**Step 1: Update Sidebar.tsx**

Full replacement:

```tsx
import { useState } from 'react';
import { Map, Activity, Cpu, BarChart2 } from "lucide-react";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}

const navItems: NavItem[] = [
  { icon: Map, label: "Grid Map", active: true },
  { icon: Activity, label: "Anomalies" },
  { icon: Cpu, label: "ML Status" },
  { icon: BarChart2, label: "Analytics" },
];

interface SidebarProps {
  onStormEvent?: () => Promise<void>;
  stormActive?: boolean;
}

export function Sidebar({ onStormEvent, stormActive }: SidebarProps) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<'idle' | 'success' | 'error'>('idle');

  const handleStorm = async () => {
    if (!onStormEvent || loading) return;
    setLoading(true);
    setLastResult('idle');
    try {
      await onStormEvent();
      setLastResult('success');
      setTimeout(() => setLastResult('idle'), 3000);
    } catch {
      setLastResult('error');
      setTimeout(() => setLastResult('idle'), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      className="w-56 border-r border-grid-border flex flex-col flex-shrink-0"
      style={{ background: 'linear-gradient(to bottom, #1a2130, #161b27)' }}
    >
      {/* Nav items */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              style={item.active ? { boxShadow: 'inset 3px 0 10px rgba(59,130,246,0.2)' } : undefined}
              className={
                item.active
                  ? "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-blue-500/10 text-blue-400 border-r-2 border-blue-500 w-full text-left"
                  : "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-grid-muted hover:text-grid-text hover:bg-white/5 w-full text-left transition-colors"
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Storm Event button */}
      <div className="p-3 border-t border-grid-border">
        <button
          onClick={handleStorm}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
            ${loading
              ? 'bg-orange-500/20 text-orange-300 cursor-wait'
              : stormActive
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              : lastResult === 'error'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/20'
            }`}
        >
          {loading
            ? (stormActive ? 'Stopping...' : 'Injecting...')
            : stormActive
            ? '⚡ Stop Storm'
            : lastResult === 'error'
            ? 'Failed'
            : '⚡ Simulate Storm Event'}
        </button>
      </div>

      {/* Bottom: version badge */}
      <div className="p-3 border-t border-grid-border">
        <span className="text-xs text-grid-muted font-mono">v1.0-shell</span>
      </div>
    </aside>
  );
}
```

**Step 2: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```
Expected: `✓ built in` with no errors.

**Step 3: Commit**

```bash
cd "C:/Users/saads/Documents/Aegis Flow"
git add src/components/layout/Sidebar.tsx
git commit -m "feat(ui): sidebar active glow, storm button border, panel depth gradient"
```

---

## Task 3: useEventFeed hook — detect node status transitions

**Files:**
- Create: `src/hooks/useEventFeed.ts`

**Context:** Compares current `liveNodes` array to previous frame. When a node's status changes, pushes an event entry to a capped ring buffer (10 max). No backend calls — purely derived from existing WebSocket state.

**Step 1: Create `src/hooks/useEventFeed.ts`**

```typescript
import { useEffect, useRef, useState } from 'react';
import type { GridNode } from '../types/grid';

export interface EventEntry {
  id: string;
  nodeId: string;
  nodeName: string;
  from: string;
  to: string;
  timestamp: Date;
}

export function useEventFeed(nodes: GridNode[]): EventEntry[] {
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const [events, setEvents] = useState<EventEntry[]>([]);

  useEffect(() => {
    if (nodes.length === 0) return;

    const newEvents: EventEntry[] = [];
    const prevStatus = prevStatusRef.current;

    for (const node of nodes) {
      const prev = prevStatus.get(node.id);
      if (prev !== undefined && prev !== node.status) {
        newEvents.push({
          id: `${node.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          nodeId: node.id,
          nodeName: node.name,
          from: prev,
          to: node.status,
          timestamp: new Date(),
        });
      }
      prevStatus.set(node.id, node.status);
    }

    if (newEvents.length > 0) {
      setEvents(prev => [...newEvents, ...prev].slice(0, 10));
    }
  }, [nodes]);

  return events;
}
```

**Step 2: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```
Expected: `✓ built in` with no errors.

**Step 3: Commit**

```bash
cd "C:/Users/saads/Documents/Aegis Flow"
git add src/hooks/useEventFeed.ts
git commit -m "feat(ui): useEventFeed hook — ring buffer of last 10 node status transitions"
```

---

## Task 4: StatusPanel — stat card accents, glassmorphism, progress bar, panel glow

**Files:**
- Modify: `src/components/layout/StatusPanel.tsx`

**Context:** StatCard gets a `accentColor` prop (left border), optional `progressValue` (thin fill bar), optional `pulse`. The aside gets a right-side neon glow via inline `style`. Cards go glassy with `backdrop-blur-sm bg-grid-bg/80`. Note: `backdrop-filter` won't visually blur anything here since cards sit on a solid background — it will create a very slight translucency effect that looks good.

**Step 1: Update StatCard component in StatusPanel.tsx**

Replace the `StatCard` interface and component (lines 6–21):

```tsx
const ACCENT: Record<string, string> = {
  green:  'border-l-4 border-green-500',
  yellow: 'border-l-4 border-yellow-500',
  red:    'border-l-4 border-red-500',
  blue:   'border-l-4 border-blue-500',
};

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  valueColor?: string;
  accentColor?: 'green' | 'yellow' | 'red' | 'blue';
  progressValue?: number;
  pulse?: boolean;
}

function StatCard({ label, value, subtext, valueColor = 'text-grid-text', accentColor, progressValue, pulse }: StatCardProps) {
  return (
    <div className={`rounded-lg p-3 border border-grid-border bg-grid-bg/80 backdrop-blur-sm ${accentColor ? ACCENT[accentColor] : ''} ${pulse ? 'animate-pulse' : ''}`}>
      <p className="text-xs text-grid-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-grid-muted mt-1">{subtext}</p>
      {progressValue !== undefined && (
        <div className="mt-2 h-1 bg-grid-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressValue >= 90 ? 'bg-red-500' : progressValue >= 75 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update the four StatCard usages and aside glow**

Replace the `aside` opening tag and all four StatCard calls (lines 35–59 in StatusPanel.tsx):

```tsx
  return (
    <aside
      className="w-72 bg-grid-surface border-l border-grid-border flex flex-col p-3 gap-3 flex-shrink-0 overflow-y-auto"
      style={{ boxShadow: '-4px 0 24px rgba(59,130,246,0.07)' }}
    >
      <StatCard
        label="Active Nodes"
        value="24"
        subtext="Total nodes online"
        accentColor="green"
      />
      <StatCard
        label="Anomalies"
        value="0"
        subtext="Last 5 minutes"
        valueColor="text-node-normal"
        accentColor="green"
      />
      <StatCard
        label="Grid Load"
        value="87%"
        subtext="System capacity"
        valueColor="text-node-warning"
        accentColor="yellow"
        progressValue={87}
      />
      <StatCard
        label="FL Round"
        value="--"
        subtext="Training inactive"
        valueColor="text-grid-muted"
        accentColor="blue"
      />
```

**Step 3: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```
Expected: `✓ built in` with no errors.

**Step 4: Commit**

```bash
cd "C:/Users/saads/Documents/Aegis Flow"
git add src/components/layout/StatusPanel.tsx
git commit -m "feat(ui): stat card accent borders, glassmorphism, grid load progress bar, panel glow"
```

---

## Task 5: Node detail — load progress bar + voltage/frequency deviation bars + status badge ring

**Files:**
- Modify: `src/components/layout/StatusPanel.tsx`

**Context:** The three metric rows inside the selected-node section get visual encoding. Load becomes a fill bar. Voltage and frequency get centered deviation bars (colored by distance from nominal: voltage 120kV nominal, frequency 60Hz nominal). Status badge gets a pulsing ring when warning/critical.

**Step 1: Replace the status badge span** (currently lines ~70–76 in StatusPanel.tsx)

Find:
```tsx
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedNode.status === 'normal' ? 'bg-green-500/20 text-green-400' :
                selectedNode.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {selectedNode.status.toUpperCase()}
              </span>
```

Replace with:
```tsx
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedNode.status === 'normal'
                  ? 'bg-green-500/20 text-green-400'
                  : selectedNode.status === 'warning'
                  ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-400/50 animate-pulse'
                  : 'bg-red-500/20 text-red-400 ring-1 ring-red-400/50 animate-pulse'
              }`}>
                {selectedNode.status.toUpperCase()}
              </span>
```

**Step 2: Replace the three metric rows** (currently the div with `flex flex-col gap-1.5 border-t` at ~line 80)

Find:
```tsx
            <div className="mt-2 flex flex-col gap-1.5 border-t border-grid-border pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-grid-muted">Voltage</span>
                <span className="text-grid-text font-mono">{selectedNode.voltage} kV</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-grid-muted">Frequency</span>
                <span className="text-grid-text font-mono">{selectedNode.frequency.toFixed(2)} Hz</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-grid-muted">Load</span>
                <span className={`font-mono text-xs ${
                  selectedNode.load > 90 ? 'text-red-400' :
                  selectedNode.load > 75 ? 'text-yellow-400' : 'text-green-400'
                }`}>{selectedNode.load}%</span>
              </div>
            </div>
```

Replace with:
```tsx
            <div className="mt-2 flex flex-col gap-2 border-t border-grid-border pt-2">
              {/* Voltage deviation bar — nominal 120kV, ±20kV range */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-grid-muted w-16 flex-shrink-0">Voltage</span>
                <div className="flex-1 h-1 bg-grid-border rounded-full overflow-hidden relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-grid-muted/40" />
                  <div
                    className={`absolute top-0 bottom-0 rounded-full ${
                      Math.abs(selectedNode.voltage - 120) > 12 ? 'bg-red-500' :
                      Math.abs(selectedNode.voltage - 120) > 6  ? 'bg-yellow-500' : 'bg-blue-400'
                    }`}
                    style={{
                      left: selectedNode.voltage < 120
                        ? `${Math.max(0, 50 - ((120 - selectedNode.voltage) / 20) * 50)}%`
                        : '50%',
                      width: `${Math.min(50, (Math.abs(selectedNode.voltage - 120) / 20) * 50)}%`,
                    }}
                  />
                </div>
                <span className="text-grid-text font-mono text-xs w-16 text-right flex-shrink-0">
                  {selectedNode.voltage} kV
                </span>
              </div>

              {/* Frequency deviation bar — nominal 60Hz, ±1Hz range */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-grid-muted w-16 flex-shrink-0">Frequency</span>
                <div className="flex-1 h-1 bg-grid-border rounded-full overflow-hidden relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-grid-muted/40" />
                  <div
                    className={`absolute top-0 bottom-0 rounded-full ${
                      Math.abs(selectedNode.frequency - 60) > 0.5  ? 'bg-red-500' :
                      Math.abs(selectedNode.frequency - 60) > 0.25 ? 'bg-yellow-500' : 'bg-green-400'
                    }`}
                    style={{
                      left: selectedNode.frequency < 60
                        ? `${Math.max(0, 50 - ((60 - selectedNode.frequency) / 1) * 50)}%`
                        : '50%',
                      width: `${Math.min(50, (Math.abs(selectedNode.frequency - 60) / 1) * 50)}%`,
                    }}
                  />
                </div>
                <span className="text-grid-text font-mono text-xs w-20 text-right flex-shrink-0">
                  {selectedNode.frequency.toFixed(2)} Hz
                </span>
              </div>

              {/* Load progress bar */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-grid-muted w-16 flex-shrink-0">Load</span>
                <div className="flex-1 h-1.5 bg-grid-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedNode.load >= 90 ? 'bg-red-500' :
                      selectedNode.load >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${selectedNode.load}%` }}
                  />
                </div>
                <span className={`font-mono text-xs w-8 text-right flex-shrink-0 ${
                  selectedNode.load > 90 ? 'text-red-400' :
                  selectedNode.load > 75 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {selectedNode.load}%
                </span>
              </div>
            </div>
```

**Step 3: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```
Expected: `✓ built in` with no TypeScript errors.

**Step 4: Commit**

```bash
cd "C:/Users/saads/Documents/Aegis Flow"
git add src/components/layout/StatusPanel.tsx
git commit -m "feat(ui): node detail deviation bars for voltage/frequency, load progress bar, status badge ring"
```

---

## Task 6: Event feed — wire into StatusPanel and DashboardLayout

**Files:**
- Modify: `src/components/layout/StatusPanel.tsx`
- Modify: `src/components/layout/DashboardLayout.tsx`

**Context:** StatusPanel gets an `events` prop. DashboardLayout calls `useEventFeed(liveNodes)` and passes result down. Event feed renders at the bottom of the right panel.

**Step 1: Add EventEntry import + events prop to StatusPanel.tsx**

At the top of the file, add after existing imports:
```tsx
import type { EventEntry } from '../../hooks/useEventFeed';
```

Change `StatusPanelProps` interface:
```tsx
interface StatusPanelProps {
  selectedNode?: GridNode | null;
  latestReading?: NodeReading | null;
  events?: EventEntry[];
}
```

Change function signature:
```tsx
export function StatusPanel({ selectedNode, latestReading, events }: StatusPanelProps) {
```

**Step 2: Add event feed section at end of the aside, after the node detail section**

Just before the closing `</aside>` tag, add:

```tsx
      {/* Event feed */}
      <div className="border-t border-grid-border pt-3">
        <p className="text-xs font-semibold text-grid-text uppercase tracking-wide mb-2">
          Event Log
        </p>
        {events && events.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {events.map((event, i) => (
              <div
                key={event.id}
                className="flex items-center justify-between text-xs gap-1"
                style={{ opacity: Math.max(0.3, 1 - i * 0.08) }}
              >
                <span className="text-grid-muted truncate w-14 flex-shrink-0">
                  {event.nodeName.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className={`flex-shrink-0 ${
                  event.to === 'critical' ? 'text-red-400' :
                  event.to === 'warning'  ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {event.from} → {event.to}
                </span>
                <span className="text-grid-muted font-mono text-[10px] flex-shrink-0">
                  {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-grid-muted italic">No state changes yet</p>
        )}
      </div>
```

**Step 3: Wire useEventFeed in DashboardLayout.tsx**

Add import at top (after existing hook imports):
```tsx
import { useEventFeed } from '../../hooks/useEventFeed';
```

Add hook call after the `latestReading` useMemo (around line 57):
```tsx
  const events = useEventFeed(liveNodes);
```

Update StatusPanel render call:
```tsx
        <StatusPanel selectedNode={liveSelectedNode} latestReading={latestReading} events={events} />
```

**Step 4: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```
Expected: `✓ built in` with no TypeScript errors.

**Step 5: Commit**

```bash
cd "C:/Users/saads/Documents/Aegis Flow"
git add src/components/layout/StatusPanel.tsx src/components/layout/DashboardLayout.tsx
git commit -m "feat(ui): live event feed — last 10 node status transitions in right panel"
```

---

## Final Verification

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```

Then run the app (`npm run dev` + `python -m backend.main`) and manually verify:

- [ ] Header: AegisFlow logo has a subtle blue glow; bottom border fades to transparent on both sides; node counts appear (e.g. "● 20 Normal · ● 4 Warning") and update as WebSocket data changes
- [ ] Sidebar: active "Grid Map" item has a visible left-edge blue glow; storm button has a visible orange border at rest; panel has subtle depth gradient
- [ ] Stat cards: each has its color left border; Grid Load card shows an 87% fill bar colored yellow; cards have slight translucency/glassmorphism
- [ ] Right panel has a faint blue glow on its left edge
- [ ] Clicking a node: status badge pulses (ring animation) if warning/critical; load shows a fill bar; voltage and frequency show deviation bars relative to their center
- [ ] After triggering a storm (button), wait for node status changes — event log populates with timestamped rows that fade in opacity from newest to oldest
