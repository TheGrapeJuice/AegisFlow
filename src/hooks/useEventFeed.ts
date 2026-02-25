import { useEffect, useRef, useState } from 'react';
import type { GridNode } from '../types/grid';

export interface EventEntry {
  id: string;
  nodeId: string;
  nodeName: string;
  from: string;
  to: string;
  timestamp: Date;
}

export function useEventFeed(nodes: GridNode[]): EventEntry[] {
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const [events, setEvents] = useState<EventEntry[]>([]);

  useEffect(() => {
    const newEvents: EventEntry[] = [];
    const prevStatus = prevStatusRef.current;

    for (const node of nodes) {
      const prev = prevStatus.get(node.id);
      if (prev !== undefined && prev !== node.status) {
        newEvents.push({
          id: `${node.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          nodeId: node.id,
          nodeName: node.name,
          from: prev,
          to: node.status,
          timestamp: new Date(),
        });
      }
      prevStatus.set(node.id, node.status);
    }

    if (newEvents.length > 0) {
      setEvents(prev => [...newEvents, ...prev].slice(0, 10));
    }
  }, [nodes]);

  return events;
}
