# Visual Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add animated node glows, cinematic storm weather effects (canvas rain + D3 SVG shockwave/wind/fog), and proper node selection UX (blue highlight + deselect on background click).

**Architecture:** D3Overlay gets a `d3.timer()` continuous animation loop for node glow halos (positioned on map move/zoom, animated independently). A new `StormCanvas` canvas layer handles 150-particle rain. Storm state (active/epicenterId/affectedIds) is lifted to DashboardLayout and flows down as props. MapLibre paint expressions handle selected-node blue highlight.

**Tech Stack:** D3 v7 (d3.timer, SVG manipulation), HTML Canvas (requestAnimationFrame), MapLibre GL (setPaintProperty, queryRenderedFeatures), React (useState, useRef, useMemo)

---

## Task 1: Node Glow — D3Overlay animated halos

**Files:**
- Modify: `src/components/map/D3Overlay.tsx`

**Context:** D3Overlay already renders labels and a selection ring via a `render()` function called on map move/zoom. We need to add:
1. Pulsing glow SVG circles per node (positioned by `render()`, animated by `d3.timer()`)
2. Refs to share latest `nodes` data with the timer (avoids stale closure)

**Step 1: Add status animation config**

At the top of `D3Overlay.tsx`, after the imports, add:

```typescript
const STATUS_GLOW: Record<string, { color: string; minOpacity: number; maxOpacity: number; minR: number; maxR: number; period: number }> = {
  normal:   { color: '#22c55e', minOpacity: 0.06, maxOpacity: 0.18, minR: 2, maxR: 5,  period: 3000 },
  warning:  { color: '#eab308', minOpacity: 0.12, maxOpacity: 0.32, minR: 3, maxR: 8,  period: 2000 },
  critical: { color: '#ef4444', minOpacity: 0.20, maxOpacity: 0.50, minR: 4, maxR: 11, period: 1000 },
};

const BASE_RADIUS: Record<string, number> = {
  generator:   10,
  substation:  8,
  junction:    6,
  transformer: 6,
};
```

**Step 2: Add refs and timer in the useEffect**

Replace the existing `useEffect` body. Key changes:
- Add `nodesRef` to share live node state with the timer
- Keep the `render()` function for positioning (called on map move/zoom)
- Add a `d3.timer()` that only updates `r` and `fill-opacity` on existing glow circles
- Glow circles are in a `<g class="glow-layer">` rendered BEFORE labels and selection ring

```typescript
export function D3Overlay({ map, selectedNodeId, nodes, stormActive, epicenterId, affectedNodeIds }: D3OverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef(nodes);
  const stormActiveRef = useRef(stormActive);
  const epicenterIdRef = useRef(epicenterId);
  const affectedNodeIdsRef = useRef(affectedNodeIds ?? []);

  // Keep refs in sync with props
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { stormActiveRef.current = stormActive; }, [stormActive]);
  useEffect(() => { epicenterIdRef.current = epicenterId ?? null; }, [epicenterId]);
  useEffect(() => { affectedNodeIdsRef.current = affectedNodeIds ?? []; }, [affectedNodeIds]);

  useEffect(() => {
    if (!map || !svgRef.current) return;
    const m = map;
    const svg = d3.select(svgRef.current);

    // Ensure layer order: glow → labels → selection → storm
    if (svg.select('g.glow-layer').empty()) svg.append('g').attr('class', 'glow-layer');
    if (svg.select('g.label-layer').empty()) svg.append('g').attr('class', 'label-layer');
    if (svg.select('g.selection-layer').empty()) svg.append('g').attr('class', 'selection-layer');
    if (svg.select('g.storm-layer').empty()) svg.append('g').attr('class', 'storm-layer');

    const glowLayer = svg.select<SVGGElement>('g.glow-layer');
    const labelLayer = svg.select<SVGGElement>('g.label-layer');
    const selectionLayer = svg.select<SVGGElement>('g.selection-layer');

    function project(node: GridNode) {
      const point = m.project([node.lng, node.lat]);
      return { x: point.x, y: point.y };
    }

    function render() {
      const canvas = m.getCanvas();
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      svg.attr('width', width).attr('height', height);

      const currentNodes = nodesRef.current;

      // Glow circles (positioned here, animated by timer)
      const glows = glowLayer.selectAll<SVGCircleElement, GridNode>('circle.glow')
        .data(currentNodes, d => d.id);

      glows.enter()
        .append('circle')
        .attr('class', 'glow')
        .style('pointer-events', 'none')
        .merge(glows as any)
        .attr('cx', d => project(d).x)
        .attr('cy', d => project(d).y)
        .attr('fill', d => STATUS_GLOW[d.status]?.color ?? '#22c55e');

      glows.exit().remove();

      // Labels
      const labels = labelLayer.selectAll<SVGTextElement, GridNode>('text.node-label')
        .data(currentNodes, d => d.id);

      labels.enter()
        .append('text')
        .attr('class', 'node-label')
        .style('font-size', '10px')
        .style('fill', '#94a3b8')
        .style('pointer-events', 'none')
        .style('font-family', 'Inter, system-ui, sans-serif')
        .style('user-select', 'none')
        .merge(labels as any)
        .attr('x', d => project(d).x)
        .attr('y', d => project(d).y - 14)
        .attr('text-anchor', 'middle')
        .text(d => d.name.split(' ')[0]);

      labels.exit().remove();

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
    }

    render();
    m.on('move', render);
    m.on('zoom', render);
    m.on('resize', render);

    // Continuous glow animation via d3.timer
    const timer = d3.timer((elapsed) => {
      const currentNodes = nodesRef.current;
      glowLayer.selectAll<SVGCircleElement, GridNode>('circle.glow')
        .each(function(d) {
          const cfg = STATUS_GLOW[d.status] ?? STATUS_GLOW.normal;
          const t = (Math.sin((elapsed / cfg.period) * 2 * Math.PI) + 1) / 2; // 0..1 sine wave
          const r = BASE_RADIUS[d.type] ?? 6;
          d3.select(this)
            .attr('r', r + cfg.minR + t * (cfg.maxR - cfg.minR))
            .attr('fill-opacity', cfg.minOpacity + t * (cfg.maxOpacity - cfg.minOpacity));
        });
    });

    return () => {
      m.off('move', render);
      m.off('zoom', render);
      m.off('resize', render);
      timer.stop();
      svg.selectAll('*').remove();
    };
  }, [map, selectedNodeId]);
  // NOTE: nodes/stormActive/etc intentionally NOT in deps — timer and render() read from refs

  // ... rest of component (storm layer handled in Task 3)
```

**Step 3: Update D3OverlayProps interface**

```typescript
interface D3OverlayProps {
  map: maplibregl.Map | null;
  selectedNodeId: string | null;
  nodes: GridNode[];
  stormActive?: boolean;
  epicenterId?: string | null;
  affectedNodeIds?: string[];
}
```

**Step 4: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -8
```
Expected: exits 0, no TypeScript errors.

**Step 5: Commit**

```bash
git add src/components/map/D3Overlay.tsx
git commit -m "feat(visuals): animated node glow halos via d3.timer — status-based pulse speed/intensity"
```

---

## Task 2: StormCanvas — canvas rain particle system

**Files:**
- Create: `src/components/map/StormCanvas.tsx`

**Context:** A `<canvas>` element absolutely positioned on the map, same size as the map container. 150 rain particles fall diagonally (20° tilt from vertical = slight wind). Only animates when `stormActive` is true. On deactivate, clears and cancels the `requestAnimationFrame` loop.

**Step 1: Create StormCanvas.tsx**

```typescript
import { useEffect, useRef } from 'react';

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

interface StormCanvasProps {
  stormActive: boolean;
  width: number;
  height: number;
}

const PARTICLE_COUNT = 150;
const WIND_ANGLE = 0.35; // radians from vertical (~20°)
const BASE_SPEED = 7;

function createDrop(width: number, height: number): RainDrop {
  return {
    x: Math.random() * (width + 100) - 50,
    y: Math.random() * height - height,
    speed: BASE_SPEED + Math.random() * 4,
    length: 12 + Math.random() * 8,
    opacity: 0.2 + Math.random() * 0.5,
  };
}

export function StormCanvas({ stormActive, width, height }: StormCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<RainDrop[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!stormActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Initialize drops
    dropsRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createDrop(canvas.width, canvas.height)
    );

    const dx = Math.sin(WIND_ANGLE); // x-component of fall direction
    const dy = Math.cos(WIND_ANGLE); // y-component of fall direction

    function tick() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.strokeStyle = '#a8c8e8';
      ctx.lineWidth = 1;

      for (const drop of dropsRef.current) {
        ctx.globalAlpha = drop.opacity;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(
          drop.x + dx * drop.length,
          drop.y + dy * drop.length
        );
        ctx.stroke();

        // Move drop
        drop.x += dx * drop.speed;
        drop.y += dy * drop.speed;

        // Reset if off screen
        if (drop.y > canvas.height + 20 || drop.x > canvas.width + 50) {
          drop.x = Math.random() * canvas.width - 50;
          drop.y = -drop.length;
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [stormActive]);

  if (!stormActive) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
}
```

**Step 2: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -8
```
Expected: exits 0.

**Step 3: Commit**

```bash
git add src/components/map/StormCanvas.tsx
git commit -m "feat(visuals): StormCanvas canvas rain particle system — 150 drops, diagonal wind"
```

---

## Task 3: Storm D3 SVG elements — shockwave, wind arrows, fog

**Files:**
- Modify: `src/components/map/D3Overlay.tsx`

**Context:** Add storm visual elements to the `storm-layer` group in D3Overlay. These appear only when `stormActive` is true. The elements are:
- **Fog ellipse**: soft blurred ellipse centered on epicenter
- **Wind arrows**: 8 arrow glyphs near the epicenter, pointing in wind direction
- **Shockwave ring**: expanding ring from epicenter, animated by d3.timer

All elements read from refs (stormActiveRef, epicenterIdRef, nodesRef) so they update without re-mounting the effect.

**Step 1: Add storm SVG elements in D3Overlay**

Add a `<defs>` block for the blur filter and arrow marker. Add this INSIDE the main `useEffect`, after the glow timer setup, before the `return` cleanup:

```typescript
    // --- Storm layer elements (managed separately from render()) ---

    // Ensure defs exist for filters + markers
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) defs = svg.insert('defs', ':first-child');

    // Fog blur filter
    if (defs.select('#storm-fog-filter').empty()) {
      const filter = defs.append('filter').attr('id', 'storm-fog-filter').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', '18');
    }

    const stormLayer = svg.select<SVGGElement>('g.storm-layer');

    // Shockwave: single circle that we transition repeatedly
    const shockwaveCircle = stormLayer.append('circle')
      .attr('class', 'shockwave')
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('r', 0)
      .attr('opacity', 0)
      .style('pointer-events', 'none');

    // Fog ellipse
    const fogEllipse = stormLayer.append('ellipse')
      .attr('class', 'storm-fog')
      .attr('rx', 90).attr('ry', 60)
      .attr('fill', 'rgba(80, 100, 160, 0.13)')
      .attr('filter', 'url(#storm-fog-filter)')
      .style('pointer-events', 'none')
      .attr('opacity', 0);

    // Wind arrows (8 arrows near epicenter)
    const ARROW_PATH = 'M0,-10 L4,-2 L1.5,-2 L1.5,10 L-1.5,10 L-1.5,-2 L-4,-2 Z';
    const WIND_DEG = 20; // degrees from vertical
    const arrowOffsets = [
      [-60, -40], [0, -55], [60, -40],
      [-80, 0],             [80, 0],
      [-60, 40],  [0, 55],  [60, 40],
    ];
    const windArrows = stormLayer.selectAll<SVGPathElement, number[]>('path.wind-arrow')
      .data(arrowOffsets)
      .enter()
      .append('path')
      .attr('class', 'wind-arrow')
      .attr('d', ARROW_PATH)
      .attr('fill', 'rgba(160,200,240,0.35)')
      .attr('opacity', 0)
      .style('pointer-events', 'none');

    let shockwaveActive = false;
    function triggerShockwave(cx: number, cy: number) {
      if (shockwaveActive) return;
      shockwaveActive = true;
      shockwaveCircle.attr('cx', cx).attr('cy', cy).attr('r', 0).attr('opacity', 0.9);
      shockwaveCircle.transition().duration(1500).ease(d3.easeQuadOut)
        .attr('r', 130).attr('opacity', 0)
        .on('end', () => {
          shockwaveActive = false;
          // Repeat while storm is active
          if (stormActiveRef.current) setTimeout(() => {
            const eNode = nodesRef.current.find(n => n.id === epicenterIdRef.current);
            if (eNode && m) {
              const p = m.project([eNode.lng, eNode.lat]);
              triggerShockwave(p.x, p.y);
            }
          }, 800);
        });
    }

    // Storm elements animation via timer
    const stormTimer = d3.timer(() => {
      const active = stormActiveRef.current;
      const eId = epicenterIdRef.current;
      const epicenterNode = nodesRef.current.find(n => n.id === eId);

      if (!active || !epicenterNode) {
        fogEllipse.attr('opacity', 0);
        windArrows.attr('opacity', 0);
        return;
      }

      const ePos = m.project([epicenterNode.lng, epicenterNode.lat]);

      // Position fog
      fogEllipse.attr('cx', ePos.x).attr('cy', ePos.y).attr('opacity', 1);

      // Position and animate wind arrows
      windArrows
        .attr('transform', (offset, i) => {
          const ox = (arrowOffsets[i][0]);
          const oy = (arrowOffsets[i][1]);
          return `translate(${ePos.x + ox}, ${ePos.y + oy}) rotate(${WIND_DEG})`;
        })
        .attr('opacity', (_d, i) => {
          // Stagger opacity so they pulse in sequence
          return 0.2 + 0.25 * Math.abs(Math.sin(Date.now() / 700 + i * 0.8));
        });

      // Trigger shockwave if not already running
      if (!shockwaveActive) triggerShockwave(ePos.x, ePos.y);
    });

    // Add storm timer to cleanup
    // (add to existing return cleanup below)
```

**Step 2: Update the return cleanup to stop the storm timer**

In the existing `return () => { ... }` at the end of the `useEffect`, add:
```typescript
      stormTimer.stop();
      shockwaveCircle.remove();
      fogEllipse.remove();
      windArrows.remove();
```

**Step 3: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -8
```

**Step 4: Commit**

```bash
git add src/components/map/D3Overlay.tsx
git commit -m "feat(visuals): storm D3 SVG elements — shockwave ring, wind arrows, fog ellipse on epicenter"
```

---

## Task 4: Storm state + toggle in DashboardLayout and Sidebar

**Files:**
- Modify: `src/components/layout/DashboardLayout.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/map/GridMap.tsx`

**Context:** Lift storm state up to DashboardLayout. `handleStormEvent` becomes a toggle: if storm is active, stop it (no network call); if inactive, POST /api/storm and activate with returned epicenter/affected data. Pass `stormActive`, `epicenterId`, `affectedNodeIds` down through GridMap to D3Overlay and StormCanvas. Sidebar button shows "Stop Storm" when active.

**Step 1: Update DashboardLayout.tsx**

Replace the `handleStormEvent` function and add storm state:

```typescript
  const [stormActive, setStormActive] = useState(false);
  const [epicenterId, setEpicenterId] = useState<string | null>(null);
  const [affectedNodeIds, setAffectedNodeIds] = useState<string[]>([]);

  const handleStormEvent = async () => {
    if (stormActive) {
      // Toggle off — no network call needed
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
  };
```

Update the JSX to pass `stormActive` to Sidebar and storm props to GridMap:
```tsx
        <Sidebar onStormEvent={handleStormEvent} stormActive={stormActive} />
        ...
          <GridMap
            nodes={liveNodes}
            edges={edges}
            onNodeClick={setSelectedNode}
            selectedNodeId={liveSelectedNode?.id ?? null}
            stormActive={stormActive}
            epicenterId={epicenterId}
            affectedNodeIds={affectedNodeIds}
          />
```

**Step 2: Update Sidebar.tsx**

Add `stormActive?: boolean` prop. Change button label and color when storm is active:

```typescript
interface SidebarProps {
  onStormEvent?: () => Promise<void>;
  stormActive?: boolean;
}

export function Sidebar({ onStormEvent, stormActive }: SidebarProps) {
```

Update the button inside the component:
```tsx
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
              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
            }`}
        >
          {loading
            ? (stormActive ? 'Stopping...' : 'Injecting...')
            : stormActive
            ? '⚡ Stop Storm'
            : lastResult === 'error'
            ? 'Failed'
            : 'Simulate Storm Event'}
        </button>
```

**Step 3: Update GridMap.tsx — add storm props to interface and pass to overlays**

Add to `GridMapProps`:
```typescript
interface GridMapProps {
  nodes: GridNode[];
  edges: GridEdge[];
  onNodeClick?: (node: GridNode | null) => void;
  selectedNodeId?: string | null;
  stormActive?: boolean;
  epicenterId?: string | null;
  affectedNodeIds?: string[];
}
```

In the JSX, pass storm props to D3Overlay and add StormCanvas:
```tsx
  return (
    <div className="absolute inset-0">
      <div ref={mapContainerRef} className="w-full h-full" />
      {mapInstance && (
        <>
          <D3Overlay
            map={mapInstance}
            selectedNodeId={selectedNodeId ?? null}
            nodes={nodes}
            stormActive={stormActive}
            epicenterId={epicenterId}
            affectedNodeIds={affectedNodeIds}
          />
          <StormCanvas
            stormActive={stormActive ?? false}
            width={mapContainerRef.current?.clientWidth ?? window.innerWidth}
            height={mapContainerRef.current?.clientHeight ?? window.innerHeight}
          />
        </>
      )}
      <MapLegend />
    </div>
  );
```

Add import at top: `import { StormCanvas } from './StormCanvas';`

**Step 4: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -8
```
Expected: exits 0.

**Step 5: Commit**

```bash
git add src/components/layout/DashboardLayout.tsx src/components/layout/Sidebar.tsx src/components/map/GridMap.tsx
git commit -m "feat(visuals): storm state toggle — DashboardLayout owns stormActive, Sidebar shows Stop Storm when active"
```

---

## Task 5: Node blue selection + deselect on background click

**Files:**
- Modify: `src/components/map/GridMap.tsx`

**Context:** Two changes:
1. When a node is selected, its MapLibre circle turns blue (using `setPaintProperty` with a `case` expression)
2. Clicking anywhere on the map that isn't a node calls `onNodeClick(null)` to deselect

**Step 1: Add selected-node blue highlight useEffect**

Add after the existing `useEffect` that updates GeoJSON sources:

```typescript
  // Update circle color for selected node — blue when selected, status color otherwise
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    map.setPaintProperty('grid-nodes-layer', 'circle-color', [
      'case',
      ['==', ['get', 'id'], selectedNodeId ?? '___none___'],
      '#3b82f6',
      ['get', 'color'],
    ]);
    map.setPaintProperty('grid-nodes-layer', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], selectedNodeId ?? '___none___'],
      '#93c5fd',
      '#0f1117',
    ]);
    map.setPaintProperty('grid-nodes-layer', 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], selectedNodeId ?? '___none___'],
      3,
      2,
    ]);
  }, [selectedNodeId, mapLoaded]);
```

**Step 2: Add deselect on background click**

Inside the `map.on('load', ...)` callback, AFTER the existing node click handler, add:

```typescript
      // Deselect when clicking map background (not on a node)
      map.on('click', e => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['grid-nodes-layer'] });
        if (features.length === 0) {
          onNodeClick?.(null);
        }
      });
```

**Step 3: Update onNodeClick type in GridMapProps**

Change:
```typescript
  onNodeClick?: (node: GridNode) => void;
```
To:
```typescript
  onNodeClick?: (node: GridNode | null) => void;
```

Note: `DashboardLayout` passes `setSelectedNode` which already accepts `GridNode | null` — no change needed there.

**Step 4: Build check**

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -8
```
Expected: exits 0, no TypeScript errors.

**Step 5: Commit**

```bash
git add src/components/map/GridMap.tsx
git commit -m "feat(visuals): blue node highlight on selection + deselect on background click"
```

---

## Final Verification

```bash
cd "C:/Users/saads/Documents/Aegis Flow" && npm run build 2>&1 | tail -5
```

Manual checks with `python -m backend.main` + `npm run dev`:
- [ ] All nodes have visible pulsing glow halos (green slow, no fast pulse unless warning/critical)
- [ ] Storm button triggers rain canvas + fog + shockwave on epicenter
- [ ] Affected nodes pulse red/yellow faster after storm injection
- [ ] Storm button changes to "⚡ Stop Storm" (red) when active; clicking stops all effects
- [ ] Clicking a node turns it blue on the map
- [ ] Clicking map background deselects node (node returns to status color)
