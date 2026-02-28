import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GridNode, GridEdge, CascadeResult } from '../../types/grid';
import { D3Overlay } from './D3Overlay';
import { MapLegend } from './MapLegend';
import { StormCanvas } from './StormCanvas';

const STATUS_COLORS: Record<string, string> = {
  normal: '#22c55e',
  warning: '#eab308',
  critical: '#ef4444',
};

interface GridMapProps {
  nodes: GridNode[];
  edges: GridEdge[];
  onNodeClick?: (node: GridNode | null) => void;
  selectedNodeId?: string | null;
  stormActive?: boolean;
  epicenterId?: string | null;
  affectedNodeIds?: string[];
  cascadeResult?: CascadeResult;
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

export function GridMap({ nodes, edges, onNodeClick, selectedNodeId, stormActive, epicenterId, affectedNodeIds, cascadeResult }: GridMapProps) {
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

      // Rerouting overlay source and layer (blue dashed path)
      map.addSource('rerouting-edges', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'rerouting-edges-layer',
        type: 'line',
        source: 'rerouting-edges',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.85,
          'line-dasharray': [2, 1],
        },
      });

      // Node click handler
      map.on('click', 'grid-nodes-layer', e => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties as GridNode;
        onNodeClick?.(props);
      });

      // Deselect when clicking map background (not on a node)
      map.on('click', e => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['grid-nodes-layer'] });
        if (features.length === 0) {
          onNodeClick?.(null);
        }
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

  // Enlarge selected node radius, keep status color
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const baseRadius: maplibregl.ExpressionSpecification = ['match', ['get', 'type'], 'generator', 10, 'substation', 8, 6];
    map.setPaintProperty('grid-nodes-layer', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedNodeId ?? '___none___'],
      ['+', baseRadius, 6],
      baseRadius,
    ]);
    map.setPaintProperty('grid-nodes-layer', 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], selectedNodeId ?? '___none___'],
      3,
      2,
    ]);
    // Always use status color (no blue override)
    map.setPaintProperty('grid-nodes-layer', 'circle-color', ['get', 'color']);
    map.setPaintProperty('grid-nodes-layer', 'circle-stroke-color', '#0f1117');
  }, [selectedNodeId, mapLoaded]);

  // Update rerouting overlay whenever cascadeResult changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const reroutingSource = map.getSource('rerouting-edges') as maplibregl.GeoJSONSource | undefined;
    if (!reroutingSource) return;
    const path = cascadeResult?.rerouting_path ?? [];
    if (path.length < 2) {
      reroutingSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    // Build LineString features from path node IDs using current nodes prop
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const src = nodes.find(n => n.id === path[i]);
      const tgt = nodes.find(n => n.id === path[i + 1]);
      if (src && tgt) {
        features.push({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: [[src.lng, src.lat], [tgt.lng, tgt.lat]] },
          properties: {},
        });
      }
    }
    // Delay rerouting reveal by 1500ms — cascade animation plays first
    const timeoutId = setTimeout(() => {
      reroutingSource.setData({ type: 'FeatureCollection', features });
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [cascadeResult, nodes, mapLoaded]);

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
            cascadeResult={cascadeResult}
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
}
