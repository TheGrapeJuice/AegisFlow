import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusPanel } from './StatusPanel';
import { GridMap } from '../map/GridMap';
import { useTopology } from '../../hooks/useTopology';
import { useNodeWebSocket } from '../../hooks/useNodeWebSocket';
import type { GridNode } from '../../types/grid';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export function DashboardLayout() {
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);
  const [stormActive, setStormActive] = useState(false);
  const [epicenterId, setEpicenterId] = useState<string | null>(null);
  const [affectedNodeIds, setAffectedNodeIds] = useState<string[]>([]);
  const { nodes: topologyNodes, edges, loading } = useTopology();
  const { nodeMap, connected } = useNodeWebSocket();

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

  // Merge: use WebSocket state if available, fall back to topology
  const liveNodes = useMemo(() => {
    if (nodeMap.size === 0) return topologyNodes;
    return topologyNodes.map(n => nodeMap.get(n.id) ?? n);
  }, [topologyNodes, nodeMap]);

  // Keep selectedNode in sync with live updates
  const liveSelectedNode = useMemo(() => {
    if (!selectedNode) return null;
    return nodeMap.get(selectedNode.id) ?? selectedNode;
  }, [selectedNode, nodeMap]);

  // Derive latest reading from the WebSocket node state for chart updates
  const latestReading = useMemo(() => {
    if (!liveSelectedNode) return null;
    return {
      time: new Date().toISOString(),
      voltage: liveSelectedNode.voltage,
      frequency: liveSelectedNode.frequency,
      load: liveSelectedNode.load,
    };
  }, [liveSelectedNode]);

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
        <StatusPanel selectedNode={liveSelectedNode} latestReading={latestReading} />
      </div>
    </div>
  );
}
