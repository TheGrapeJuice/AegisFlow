import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { NodeReading } from '../../hooks/useNodeHistory';

interface SparklineProps {
  data: NodeReading[];
  field: 'voltage' | 'frequency';
  color: string;
  label: string;
  unit: string;
}

function Sparkline({ data, field, color, label, unit }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth || 200;
    const height = 48;
    const margin = { top: 4, right: 4, bottom: 4, left: 4 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    if (data.length < 2) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#64748b').attr('font-size', '10')
        .text('Awaiting data...');
      return;
    }

    const values = data.map(d => d[field] as number);

    const xScale = d3.scaleLinear().domain([0, data.length - 1]).range([0, innerW]);
    const [minV, maxV] = d3.extent(values) as [number, number];
    const padding = (maxV - minV) * 0.1 || 0.5;
    const yScale = d3.scaleLinear().domain([minV - padding, maxV + padding]).range([innerH, 0]);

    const line = d3.line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Area fill
    const area = d3.area<number>()
      .x((_, i) => xScale(i))
      .y0(innerH)
      .y1(d => yScale(d))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(values)
      .attr('fill', color).attr('fill-opacity', 0.1)
      .attr('d', area);

    // Line
    g.append('path').datum(values)
      .attr('fill', 'none').attr('stroke', color)
      .attr('stroke-width', 1.5).attr('d', line);

    // Current value dot
    const lastVal = values[values.length - 1];
    g.append('circle')
      .attr('cx', xScale(data.length - 1)).attr('cy', yScale(lastVal))
      .attr('r', 3).attr('fill', color);
  }, [data, field, color]);

  const lastValue = data.length > 0 ? data[data.length - 1][field] : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-grid-muted">{label}</span>
        <span className="text-xs font-mono text-grid-text">
          {lastValue !== null ? `${typeof lastValue === 'number' ? lastValue.toFixed(field === 'frequency' ? 2 : 0) : lastValue} ${unit}` : '--'}
        </span>
      </div>
      <svg ref={svgRef} className="w-full" style={{ height: 48 }} />
    </div>
  );
}

interface NodeChartsProps {
  readings: NodeReading[];
  loading: boolean;
}

export function NodeCharts({ readings, loading }: NodeChartsProps) {
  if (loading) {
    return <div className="text-xs text-grid-muted italic">Loading history...</div>;
  }
  return (
    <div className="flex flex-col gap-3 mt-2">
      <Sparkline data={readings} field="voltage" color="#60a5fa" label="Voltage" unit="kV" />
      <Sparkline data={readings} field="frequency" color="#34d399" label="Frequency" unit="Hz" />
    </div>
  );
}
