import { useState, useEffect } from 'react';
import type { GridNode, GridEdge } from '../types/grid';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

interface UseTopologyResult {
  nodes: GridNode[];
  edges: GridEdge[];
  loading: boolean;
  error: string | null;
}

export function useTopology(): UseTopologyResult {
  const [nodes, setNodes] = useState<GridNode[]>([]);
  const [edges, setEdges] = useState<GridEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/topology`)
      .then(res => {
        if (!res.ok) throw new Error(`Topology fetch failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setNodes(data.nodes);
          setEdges(data.edges);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { nodes, edges, loading, error };
}
