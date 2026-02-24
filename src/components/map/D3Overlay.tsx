import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type maplibregl from 'maplibre-gl';
import type { GridNode } from '../../types/grid';

interface D3OverlayProps {
  map: maplibregl.Map | null;
  selectedNodeId: string | null;
  nodes: GridNode[];
}

export function D3Overlay({ map, selectedNodeId, nodes }: D3OverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!map || !svgRef.current) return;

    const m = map; // narrow to non-null for use inside nested functions
    const svg = d3.select(svgRef.current);

    function project(node: GridNode) {
      const point = m.project([node.lng, node.lat]);
      return { x: point.x, y: point.y };
    }

    function render() {
      const canvas = m.getCanvas();
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      svg.attr('width', width).attr('height', height);

      // Node ID labels — appear above node circles
      const labels = svg.selectAll<SVGTextElement, GridNode>('text.node-label')
        .data(nodes, d => d.id);

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
        .text(d => d.name.split(' ')[0]); // First word of name to keep it short

      labels.exit().remove();

      // Selection ring for selected node
      const rings = svg.selectAll<SVGCircleElement, GridNode>('circle.selection-ring')
        .data(selectedNodeId ? nodes.filter(n => n.id === selectedNodeId) : [], d => d.id);

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

    // Re-render on every map viewport change
    m.on('move', render);
    m.on('zoom', render);
    m.on('resize', render);

    return () => {
      m.off('move', render);
      m.off('zoom', render);
      m.off('resize', render);
    };
  }, [map, selectedNodeId, nodes]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
