import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type maplibregl from 'maplibre-gl';
import type { GridNode } from '../../types/grid';

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

interface D3OverlayProps {
  map: maplibregl.Map | null;
  selectedNodeId: string | null;
  nodes: GridNode[];
  stormActive?: boolean;
  epicenterId?: string | null;
  affectedNodeIds?: string[];
}

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
        .attr('transform', (_d, i) => {
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

    return () => {
      m.off('move', render);
      m.off('zoom', render);
      m.off('resize', render);
      timer.stop();
      stormTimer.stop();
      shockwaveCircle.remove();
      fogEllipse.remove();
      windArrows.remove();
      svg.selectAll('*').remove();
    };
  }, [map, selectedNodeId]);
  // NOTE: nodes/stormActive/etc intentionally NOT in deps — timer and render() read from refs

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
