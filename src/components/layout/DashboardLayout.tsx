import { useState, useMemo, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusPanel } from './StatusPanel';
import { GridMap } from '../map/GridMap';
import { AnomalyPanel } from './AnomalyPanel';
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
  const [anomalyPanelVisible, setAnomalyPanelVisible] = useState(false);
  const [dismissedNodeIds, setDismissedNodeIds] = useState<Set<string>>(new Set());
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
    // Reset dismissed set on new storm so re-alert works correctly after second storm
    setDismissedNodeIds(new Set());
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

  // Anomaly alert lifecycle: upsert on re-detection, append on new detection
  useEffect(() => {
    const anomalousNodes = liveNodes.filter(n => n.is_anomalous === true);
    if (anomalousNodes.length === 0) return;

    setAnomalyAlerts(prev => {
      let next = [...prev];
      for (const node of anomalousNodes) {
        const existingIdx = next.findIndex(a => a.nodeId === node.id && !a.dismissed);
        if (existingIdx >= 0) {
          // Update in place — deduplication: update score + timestamp, do not append
          next[existingIdx] = {
            ...next[existingIdx],
            score: node.anomaly_score ?? next[existingIdx].score,
            timestamp: new Date(),
          };
        } else if (!dismissedNodeIds.has(node.id)) {
          // New alert — append (respects dismissed set for re-alert behavior)
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

    // Auto-open panel on first anomaly
    setAnomalyPanelVisible(true);
  }, [liveNodes, dismissedNodeIds]);

  const handleDismissAlert = (nodeId: string) => {
    setAnomalyAlerts(prev => prev.filter(a => a.nodeId !== nodeId));
    // Add to dismissed set so the node can re-alert if it becomes anomalous again after next storm
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
        <StatusPanel selectedNode={liveSelectedNode} latestReading={latestReading} events={events} />
      </div>
      <AnomalyPanel
        alerts={anomalyAlerts}
        onDismiss={handleDismissAlert}
        onDismissAll={handleDismissAll}
        visible={anomalyPanelVisible}
      />
    </div>
  );
}
