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

    return () => {
      m.off('move', render);
      m.off('zoom', render);
      m.off('resize', render);
      timer.stop();
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
