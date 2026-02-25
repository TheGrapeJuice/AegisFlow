# Layout Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redistribute dashboard panels so stat cards move to the left sidebar, nav tabs move to the header, and the floating AnomalyPanel becomes an inline section in the right panel — eliminating overlap and scroll.

**Architecture:** Six targeted file edits. No new files. StatCard component is inlined into Sidebar.tsx (small duplication is acceptable over creating a shared file). AnomalyPanel keeps its component file but loses fixed/overlay styling. DashboardLayout wires anomaly props through StatusPanel instead of rendering a standalone overlay.

**Tech Stack:** React 18, TypeScript, Tailwind CSS

---

### Task 1: Remove blue selection ring from D3Overlay

**Files:**
- Modify: `src/components/map/D3Overlay.tsx:104-121`

**Step 1: Delete the selection ring block**

In `src/components/map/D3Overlay.tsx`, delete lines 104–121 (the `// Selection ring` comment through `rings.exit().remove();`):

```tsx
      // Selection ring
      const rings = selectionLayer.selectAll<SVGCircleElement, GridNode>('circle.selection-ring')
        .data(selectedNodeId ? currentNodes.filter(n => n.id === selectedNodeId) : [], d => d.id);

      rings.enter()
        .append('circle')
        .attr('class', 'selection-ring')
        .style('pointer-events', 'none')
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 2')
        .attr('r', 16)
        .merge(rings as any)
        .attr('cx', d => project(d).x)
        .attr('cy', d => project(d).y);

      rings.exit().remove();
```

Delete only this block. Keep everything before and after it.

**Step 2: Verify build passes**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add src/components/map/D3Overlay.tsx
git commit -m "fix(ui): remove blue selection ring on node click"
```

---

### Task 2: Add tab navigation to Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Add tab buttons between node chips and right section**

The tabs are purely visual (no routing). Add them as a centered flex group using `mx-auto`. Replace the entire `Header` function body's JSX with:

```tsx
  const tabs = ['Grid Map', 'Anomalies', 'ML Status', 'Analytics'];

  return (
    <header className="h-12 bg-grid-surface flex items-center px-4 flex-shrink-0 relative">
      {/* Gradient bottom border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(96,165,250,0.3) 50%, transparent)' }}
      />

      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
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
        <div className="ml-6 flex items-center gap-4 text-xs font-mono flex-shrink-0">
          <span className="text-node-normal">● {normalCount} Normal</span>
          {warningCount > 0 && <span className="text-node-warning">● {warningCount} Warning</span>}
          {criticalCount > 0 && <span className="text-node-critical animate-pulse">● {criticalCount} Critical</span>}
        </div>
      )}

      {/* Center tabs */}
      <nav className="mx-auto flex items-center gap-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`px-3 h-12 text-xs font-medium transition-colors border-b-2 ${
              i === 0
                ? 'text-blue-400 border-blue-400'
                : 'text-grid-muted border-transparent hover:text-grid-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Right: connection status + clock */}
      <div className="flex items-center gap-4 flex-shrink-0">
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
```

**Step 2: Verify build passes**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(ui): add tab navigation to header"
```

---

### Task 3: Restructure Sidebar — remove nav, add stat cards

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Replace Sidebar content**

Remove the `navItems` array and nav rendering. Add `StatCard` component and the 4 stat cards. Replace the entire file with:

```tsx
import { useState } from 'react';

const ACCENT: Record<string, string> = {
  green:  'border-l-4 border-l-green-500',
  yellow: 'border-l-4 border-l-yellow-500',
  red:    'border-l-4 border-l-red-500',
  blue:   'border-l-4 border-l-blue-500',
};

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  valueColor?: string;
  accentColor?: 'green' | 'yellow' | 'red' | 'blue';
  progressValue?: number;
}

function StatCard({ label, value, subtext, valueColor = 'text-grid-text', accentColor, progressValue }: StatCardProps) {
  return (
    <div className={`rounded-lg p-3 border border-grid-border bg-grid-bg/80 backdrop-blur-sm ${accentColor ? ACCENT[accentColor] : ''}`}>
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
      {/* Stat cards */}
      <div className="flex flex-col gap-2 p-2 flex-1">
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
      </div>

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

**Step 2: Verify build passes**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```

Expected: exits 0.

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(ui): move stat cards to sidebar, remove nav items"
```

---

### Task 4: Convert AnomalyPanel from floating overlay to inline component

**Files:**
- Modify: `src/components/layout/AnomalyPanel.tsx`

**Step 1: Remove overlay styling, remove `visible` prop**

The panel is now rendered inline inside StatusPanel — no fixed positioning, no slide animation, no `visible` prop. Replace the entire file with:

```tsx
export interface AnomalyAlert {
  nodeId: string;
  nodeName: string;
  score: number;
  timestamp: Date;
  dismissed: boolean;
}

interface AnomalyPanelProps {
  alerts: AnomalyAlert[];
  onDismiss: (nodeId: string) => void;
  onDismissAll?: () => void;
}

export function AnomalyPanel({ alerts, onDismiss, onDismissAll }: AnomalyPanelProps) {
  return (
    <div className="border border-red-500/30 rounded-lg overflow-hidden bg-grid-bg/60">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-grid-border bg-grid-surface">
        <span className="text-xs uppercase tracking-wide text-red-400 font-semibold">
          ⚠ Anomaly Alerts ({alerts.length})
        </span>
        {alerts.length > 0 && onDismissAll && (
          <button
            onClick={onDismissAll}
            className="text-[10px] text-grid-muted hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Alert rows */}
      <div className="flex flex-col divide-y divide-grid-border max-h-40 overflow-y-auto">
        {alerts.map(alert => (
          <div key={alert.nodeId} className="flex items-center gap-2 px-3 py-2">
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-mono text-grid-text truncate">{alert.nodeId}</span>
              <span className="text-[10px] text-grid-muted font-mono">
                {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            </div>
            <span className="text-xs font-mono text-red-400 flex-shrink-0">
              {alert.score.toFixed(2)}
            </span>
            <button
              onClick={() => onDismiss(alert.nodeId)}
              className="text-grid-muted hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none"
              aria-label={`Dismiss alert for ${alert.nodeId}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build passes**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```

Expected: exits 0, though DashboardLayout will have type errors until Task 6.

**Step 3: Commit**

```bash
git add src/components/layout/AnomalyPanel.tsx
git commit -m "feat(ui): convert AnomalyPanel from floating overlay to inline component"
```

---

### Task 5: Update StatusPanel — remove stat cards, add inline anomaly section

**Files:**
- Modify: `src/components/layout/StatusPanel.tsx`

**Step 1: Replace StatusPanel**

Remove the 4 StatCard renders. Add anomaly props and render AnomalyPanel inline at the top. The new order is: Anomaly Alerts (if any) → Event Log → Node Detail. Replace the entire file with:

```tsx
import type { GridNode } from '../../types/grid';
import { NodeCharts } from '../sidebar/NodeCharts';
import { useNodeHistory } from '../../hooks/useNodeHistory';
import type { NodeReading } from '../../hooks/useNodeHistory';
import type { EventEntry } from '../../hooks/useEventFeed';
import { AnomalyPanel } from './AnomalyPanel';
import type { AnomalyAlert } from './AnomalyPanel';

interface StatusPanelProps {
  selectedNode?: GridNode | null;
  latestReading?: NodeReading | null;
  events?: EventEntry[];
  anomalyAlerts?: AnomalyAlert[];
  onDismissAlert?: (nodeId: string) => void;
  onDismissAll?: () => void;
}

function NodeChartsWrapper({ selectedNodeId, latestReading }: { selectedNodeId: string; latestReading?: NodeReading | null }) {
  const { readings, loading } = useNodeHistory({ selectedNodeId, latestReading });
  return <NodeCharts readings={readings} loading={loading} />;
}

export function StatusPanel({ selectedNode, latestReading, events, anomalyAlerts = [], onDismissAlert, onDismissAll }: StatusPanelProps) {
  return (
    <aside
      className="w-72 bg-grid-surface border-l border-grid-border flex flex-col p-3 gap-3 flex-shrink-0 overflow-y-auto"
      style={{ boxShadow: '-4px 0 24px rgba(59,130,246,0.07)' }}
    >
      {/* Anomaly alerts — only shown when alerts exist */}
      {anomalyAlerts.length > 0 && (
        <AnomalyPanel
          alerts={anomalyAlerts}
          onDismiss={onDismissAlert ?? (() => {})}
          onDismissAll={onDismissAll}
        />
      )}

      {/* Event feed */}
      <div className="border-t border-grid-border pt-3 first:border-t-0 first:pt-0">
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
                  {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-grid-muted italic">No state changes yet</p>
        )}
      </div>

      {/* Node detail section */}
      <div className="border-t border-grid-border pt-3">
        <p className="text-xs font-semibold text-grid-text uppercase tracking-wide mb-2">
          Node Detail
        </p>
        {selectedNode ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-grid-muted uppercase tracking-wider">Node</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedNode.status === 'normal'
                  ? 'bg-green-500/20 text-green-400'
                  : selectedNode.status === 'warning'
                  ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-400/50 animate-pulse'
                  : 'bg-red-500/20 text-red-400 ring-1 ring-red-400/50 animate-pulse'
              }`}>
                {selectedNode.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-semibold text-grid-text">{selectedNode.name}</p>
            <p className="text-xs text-grid-muted capitalize">{selectedNode.type}</p>
            <div className="mt-2 flex flex-col gap-2 border-t border-grid-border pt-2">
              {/* Voltage deviation bar */}
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

              {/* Frequency deviation bar */}
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
                  selectedNode.load >= 90 ? 'text-red-400' :
                  selectedNode.load >= 75 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {selectedNode.load}%
                </span>
              </div>
            </div>
            <div className="mt-2 border-t border-grid-border pt-2">
              <p className="text-xs text-grid-muted uppercase tracking-wide mb-1">Live Charts</p>
              <NodeChartsWrapper selectedNodeId={selectedNode.id} latestReading={latestReading} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-grid-muted italic">Click a node to inspect</p>
        )}
      </div>
    </aside>
  );
}
```

**Step 2: Verify build passes**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```

Expected: exits 0, though DashboardLayout may have unused import warning until Task 6.

**Step 3: Commit**

```bash
git add src/components/layout/StatusPanel.tsx
git commit -m "feat(ui): move anomaly alerts inline to right panel, remove stat cards"
```

---

### Task 6: Update DashboardLayout — wire anomaly props, remove floating AnomalyPanel

**Files:**
- Modify: `src/components/layout/DashboardLayout.tsx`

**Step 1: Pass anomaly props to StatusPanel, remove AnomalyPanel render**

Remove the `AnomalyPanel` import and its JSX render. Pass `anomalyAlerts`, `onDismissAlert`, and `onDismissAll` as props to `StatusPanel`. Replace the entire file with:

```tsx
import { useState, useMemo, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusPanel } from './StatusPanel';
import { GridMap } from '../map/GridMap';
import type { AnomalyAlert } from './AnomalyPanel';
import { useTopology } from '../../hooks/useTopology';
import { useNodeWebSocket } from '../../hooks/useNodeWebSocket';
import { useEventFeed } from '../../hooks/useEventFeed';
import type { GridNode } from '../../types/grid';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export function DashboardLayout() {
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);
  const [stormActive, setStormActive] = useState(false);
  const [epicenterId, setEpicenterId] = useState<string | null>(null);
  const [affectedNodeIds, setAffectedNodeIds] = useState<string[]>([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState<AnomalyAlert[]>([]);
  const [dismissedNodeIds, setDismissedNodeIds] = useState<Set<string>>(new Set());
  const { nodes: topologyNodes, edges, loading } = useTopology();
  const { nodeMap, connected } = useNodeWebSocket();

  const handleStormEvent = async () => {
    if (stormActive) {
      setStormActive(false);
      setEpicenterId(null);
      setAffectedNodeIds([]);
      return;
    }
    const res = await fetch(`${API_BASE}/api/storm`, { method: 'POST' });
    if (!res.ok) throw new Error(`Storm injection failed: ${res.status}`);
    const data = await res.json() as { injected: boolean; epicenter: string; affected: string[] };
    setEpicenterId(data.epicenter);
    setAffectedNodeIds(data.affected);
    setStormActive(true);
    setDismissedNodeIds(new Set());
  };

  const liveNodes = useMemo(() => {
    if (nodeMap.size === 0) return topologyNodes;
    return topologyNodes.map(n => nodeMap.get(n.id) ?? n);
  }, [topologyNodes, nodeMap]);

  const liveSelectedNode = useMemo(() => {
    if (!selectedNode) return null;
    return nodeMap.get(selectedNode.id) ?? selectedNode;
  }, [selectedNode, nodeMap]);

  const latestReading = useMemo(() => {
    if (!liveSelectedNode) return null;
    return {
      time: new Date().toISOString(),
      voltage: liveSelectedNode.voltage,
      frequency: liveSelectedNode.frequency,
      load: liveSelectedNode.load,
    };
  }, [liveSelectedNode]);

  useEffect(() => {
    const anomalousNodes = liveNodes.filter(n => n.is_anomalous === true);
    if (anomalousNodes.length === 0) return;

    setAnomalyAlerts(prev => {
      let next = [...prev];
      for (const node of anomalousNodes) {
        const existingIdx = next.findIndex(a => a.nodeId === node.id && !a.dismissed);
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            score: node.anomaly_score ?? next[existingIdx].score,
            timestamp: new Date(),
          };
        } else if (!dismissedNodeIds.has(node.id)) {
          next = [...next, {
            nodeId: node.id,
            nodeName: node.name,
            score: node.anomaly_score ?? 0,
            timestamp: new Date(),
            dismissed: false,
          }];
        }
      }
      return next;
    });
  }, [liveNodes, dismissedNodeIds]);

  const handleDismissAlert = (nodeId: string) => {
    setAnomalyAlerts(prev => prev.filter(a => a.nodeId !== nodeId));
    setDismissedNodeIds(prev => new Set([...prev, nodeId]));
  };

  const handleDismissAll = () => {
    setAnomalyAlerts([]);
    setDismissedNodeIds(new Set(anomalyAlerts.map(a => a.nodeId)));
  };

  const events = useEventFeed(liveNodes);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-grid-bg">
        <span className="text-grid-muted text-sm">Connecting to backend...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-grid-bg overflow-hidden">
      <Header connected={connected} nodes={liveNodes} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onStormEvent={handleStormEvent} stormActive={stormActive} />
        <main className="flex-1 relative bg-grid-bg" id="map-canvas">
          <GridMap
            nodes={liveNodes}
            edges={edges}
            onNodeClick={setSelectedNode}
            selectedNodeId={liveSelectedNode?.id ?? null}
            stormActive={stormActive}
            epicenterId={epicenterId}
            affectedNodeIds={affectedNodeIds}
          />
        </main>
        <StatusPanel
          selectedNode={liveSelectedNode}
          latestReading={latestReading}
          events={events}
          anomalyAlerts={anomalyAlerts}
          onDismissAlert={handleDismissAlert}
          onDismissAll={handleDismissAll}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify full build passes**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -10
```

Expected: exits 0, no TypeScript errors.

**Step 3: Commit**

```bash
git add src/components/layout/DashboardLayout.tsx
git commit -m "feat(ui): wire anomaly props through StatusPanel, remove floating overlay"
```
