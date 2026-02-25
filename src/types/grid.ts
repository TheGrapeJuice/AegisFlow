export type NodeStatus = 'normal' | 'warning' | 'critical';
export type NodeType = 'substation' | 'transformer' | 'junction' | 'generator';

export interface GridNode {
  id: string;           // e.g., "NODE-01"
  name: string;         // e.g., "North Substation"
  type: NodeType;
  status: NodeStatus;
  lng: number;          // WGS84 longitude
  lat: number;          // WGS84 latitude
  voltage: number;      // kV (hardcoded, realistic: 110-345 kV for substations)
  frequency: number;    // Hz (hardcoded, ~60.0 ± 0.5 Hz)
  load: number;         // % capacity (0-100)
  anomaly_score?: number;   // XGBoost positive-class probability [0, 1]; undefined before first inference cycle
  is_anomalous?: boolean;   // true when anomaly_score > 0.5
}

export interface GridEdge {
  id: string;
  source: string;       // GridNode.id
  target: string;       // GridNode.id
  capacity: number;     // MW
}

export interface GridTopology {
  nodes: GridNode[];
  edges: GridEdge[];
}

export interface TopologyResponse {
  nodes: GridNode[];
  edges: GridEdge[];
}
