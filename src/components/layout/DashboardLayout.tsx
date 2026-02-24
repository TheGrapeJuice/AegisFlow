import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusPanel } from './StatusPanel';
import { GridMap } from '../map/GridMap';
import { useTopology } from '../../hooks/useTopology';
import { useNodeWebSocket } from '../../hooks/useNodeWebSocket';
import type { GridNode } from '../../types/grid';

export function DashboardLayout() {
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);
  const { nodes: topologyNodes, edges, loading } = useTopology();
  const { nodeMap, connected } = useNodeWebSocket();

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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-grid-bg">
        <span className="text-grid-muted text-sm">Connecting to backend...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-grid-bg overflow-hidden">
      <Header connected={connected} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative bg-grid-bg" id="map-canvas">
          <GridMap
            nodes={liveNodes}
            edges={edges}
            onNodeClick={setSelectedNode}
            selectedNodeId={liveSelectedNode?.id ?? null}
          />
        </main>
        <StatusPanel selectedNode={liveSelectedNode} />
      </div>
    </div>
  );
}
