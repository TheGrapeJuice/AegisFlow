import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GridNode, GridEdge } from '../../types/grid';
import { D3Overlay } from './D3Overlay';
import { MapLegend } from './MapLegend';

const STATUS_COLORS: Record<string, string> = {
  normal: '#22c55e',
  warning: '#eab308',
  critical: '#ef4444',
};

interface GridMapProps {
  nodes: GridNode[];
  edges: GridEdge[];
  onNodeClick?: (node: GridNode) => void;
  selectedNodeId?: string | null;
}

function nodesToGeoJSON(nodes: GridNode[]) {
  return {
    type: 'FeatureCollection' as const,
    features: nodes.map(node => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [node.lng, node.lat],
      },
      properties: {
        id: node.id,
        name: node.name,
        type: node.type,
        status: node.status,
        voltage: node.voltage,
        frequency: node.frequency,
        load: node.load,
        color: STATUS_COLORS[node.status],
      },
    })),
  };
}

function edgesToGeoJSON(nodes: GridNode[], edges: GridEdge[]) {
  return {
    type: 'FeatureCollection' as const,
    features: edges.map(edge => {
      const src = nodes.find(n => n.id === edge.source)!;
      const tgt = nodes.find(n => n.id === edge.target)!;
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [src.lng, src.lat],
            [tgt.lng, tgt.lat],
          ],
        },
        properties: { id: edge.id, capacity: edge.capacity },
      };
    }),
  };
}

export function GridMap({ nodes, edges, onNodeClick, selectedNodeId }: GridMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-87.63, 41.88],
      zoom: 11,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Add edge lines source and layer
      map.addSource('grid-edges', {
        type: 'geojson',
        data: edgesToGeoJSON(nodes, edges),
      });

      map.addLayer({
        id: 'grid-edges-layer',
        type: 'line',
        source: 'grid-edges',
        paint: {
          'line-color': '#334155',
          'line-width': 1.5,
          'line-opacity': 0.8,
        },
      });

      // Add nodes source and layer
      map.addSource('grid-nodes', {
        type: 'geojson',
        data: nodesToGeoJSON(nodes),
      });

      map.addLayer({
        id: 'grid-nodes-layer',
        type: 'circle',
        source: 'grid-nodes',
        paint: {
          'circle-radius': [
            'match',
            ['get', 'type'],
            'generator',
            10,
            'substation',
            8,
            6,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f1117',
          'circle-opacity': 0.95,
        },
      });

      // Node click handler
      map.on('click', 'grid-nodes-layer', e => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties as GridNode;
        onNodeClick?.(props);
      });

      // Pointer cursor on hover
      map.on('mouseenter', 'grid-nodes-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'grid-nodes-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Expose map instance to React state for D3Overlay
      setMapInstance(map);
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
      setMapLoaded(false);
    };
  }, []);

  // Update GeoJSON sources when nodes change (live WebSocket updates)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const nodesSource = map.getSource('grid-nodes') as maplibregl.GeoJSONSource | undefined;
    const edgesSource = map.getSource('grid-edges') as maplibregl.GeoJSONSource | undefined;
    nodesSource?.setData(nodesToGeoJSON(nodes));
    edgesSource?.setData(edgesToGeoJSON(nodes, edges));
  }, [nodes, edges, mapLoaded]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainerRef} className="w-full h-full" />
      {mapInstance && (
        <D3Overlay
          map={mapInstance}
          selectedNodeId={selectedNodeId ?? null}
          nodes={nodes}
        />
      )}
      <MapLegend />
    </div>
  );
}
