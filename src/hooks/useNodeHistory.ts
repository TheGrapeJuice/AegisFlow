import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const MAX_READINGS = 300; // 5 minutes at 1s interval

export interface NodeReading {
  time: string;  // ISO timestamp
  voltage: number;
  frequency: number;
  load: number;
}

interface UseNodeHistoryOptions {
  selectedNodeId: string | null;
  latestReading?: NodeReading | null;  // from WebSocket (passed by parent)
}

export function useNodeHistory({ selectedNodeId, latestReading }: UseNodeHistoryOptions) {
  const [readings, setReadings] = useState<NodeReading[]>([]);
  const [loading, setLoading] = useState(false);
  const prevNodeId = useRef<string | null>(null);

  // Fetch history when selected node changes
  useEffect(() => {
    if (!selectedNodeId) {
      setReadings([]);
      return;
    }
    if (selectedNodeId === prevNodeId.current) return;
    prevNodeId.current = selectedNodeId;

    setLoading(true);
    setReadings([]);
    fetch(`${API_BASE}/api/nodes/${selectedNodeId}/history?minutes=5`)
      .then(res => res.ok ? res.json() : [])
      .then((data: NodeReading[]) => {
        setReadings(data.slice(-MAX_READINGS));
      })
      .catch(() => setReadings([]))
      .finally(() => setLoading(false));
  }, [selectedNodeId]);

  // Append new live readings from WebSocket
  useEffect(() => {
    if (!latestReading || !selectedNodeId) return;
    setReadings(prev => {
      const next = [...prev, latestReading];
      return next.length > MAX_READINGS ? next.slice(next.length - MAX_READINGS) : next;
    });
  }, [latestReading, selectedNodeId]);

  return { readings, loading };
}
