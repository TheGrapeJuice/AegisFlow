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
  cascade_risk?: number;  // Phase 4: GCN cascade probability [0,1]; from WebSocket payload; undefined before first cascade cycle
}

export interface GridEdge {
  id: string;
  source: string;       // GridNode.id
  target: string;       // GridNode.id
  capacity: number;     // MW
}

// Phase 4: GNN cascade prediction types

export interface CascadeNode {
  node_id: string;
  confidence: number;       // GCN output probability [0, 1]
  time_to_cascade_min: number;  // derived: (1 - confidence) * 10, range [1, 10]
  hop_distance: number;     // BFS hops from nearest anomalous node
}

export interface CascadeResult {
  cascade_chain: CascadeNode[];
  rerouting_path: string[];    // ordered node IDs for the blue overlay path
  rerouting_summary: string;   // e.g. "via Lincoln Park → River North, +12% margin"
}

export const EMPTY_CASCADE: CascadeResult = {
  cascade_chain: [],
  rerouting_path: [],
  rerouting_summary: '',
};

export interface GridTopology {
  nodes: GridNode[];
  edges: GridEdge[];
}

export interface TopologyResponse {
  nodes: GridNode[];
  edges: GridEdge[];
}
