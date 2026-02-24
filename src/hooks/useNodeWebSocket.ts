import { useState, useEffect, useRef, useCallback } from 'react';
import type { GridNode } from '../types/grid';

const WS_BASE = import.meta.env.VITE_WS_BASE ?? 'ws://localhost:8000';
const MAX_BACKOFF_MS = 30_000;

export function useNodeWebSocket() {
  // Map of node id → latest GridNode state
  const [nodeMap, setNodeMap] = useState<Map<string, GridNode>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000); // start at 1s
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const ws = new WebSocket(`${WS_BASE}/ws/nodes`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      backoffRef.current = 1000; // reset on successful connect
    };

    ws.onmessage = (evt: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const nodes: GridNode[] = JSON.parse(evt.data as string);
        setNodeMap(prev => {
          const next = new Map(prev);
          for (const n of nodes) next.set(n.id, n);
          return next;
        });
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Exponential backoff reconnect
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → reconnect loop
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);

  return { nodeMap, connected };
}
