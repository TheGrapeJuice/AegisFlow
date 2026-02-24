import type { GridNode } from '../../types/grid';

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  valueColor?: string;
}

function StatCard({ label, value, subtext, valueColor = 'text-grid-text' }: StatCardProps) {
  return (
    <div className="bg-grid-bg rounded-lg p-3 border border-grid-border">
      <p className="text-xs text-grid-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-grid-muted mt-1">{subtext}</p>
    </div>
  );
}

interface StatusPanelProps {
  selectedNode?: GridNode | null;
}

export function StatusPanel({ selectedNode }: StatusPanelProps) {
  return (
    <aside className="w-72 bg-grid-surface border-l border-grid-border flex flex-col p-3 gap-3 flex-shrink-0 overflow-y-auto">
      <StatCard
        label="Active Nodes"
        value="24"
        subtext="Total nodes online"
        valueColor="text-grid-text"
      />
      <StatCard
        label="Anomalies"
        value="0"
        subtext="Last 5 minutes"
        valueColor="text-node-normal"
      />
      <StatCard
        label="Grid Load"
        value="87%"
        subtext="System capacity"
        valueColor="text-node-warning"
      />
      <StatCard
        label="FL Round"
        value="--"
        subtext="Training inactive"
        valueColor="text-grid-muted"
      />

      {/* Node detail section */}
      <div className="border-t border-grid-border pt-3">
        <p className="text-xs font-semibold text-grid-text uppercase tracking-wide mb-2">
          Node Detail
        </p>
        {selectedNode ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-grid-text">{selectedNode.name}</p>
            <p className="text-xs text-grid-muted capitalize">{selectedNode.type}</p>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-grid-muted">
                Status:{' '}
                <span
                  className={
                    selectedNode.status === 'normal'
                      ? 'text-node-normal'
                      : selectedNode.status === 'warning'
                        ? 'text-node-warning'
                        : 'text-node-critical'
                  }
                >
                  {selectedNode.status}
                </span>
              </p>
              <p className="text-xs text-grid-muted">
                Voltage: <span className="text-grid-text">{selectedNode.voltage} kV</span>
              </p>
              <p className="text-xs text-grid-muted">
                Frequency: <span className="text-grid-text">{selectedNode.frequency} Hz</span>
              </p>
              <p className="text-xs text-grid-muted">
                Load: <span className="text-grid-text">{selectedNode.load}%</span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-grid-muted italic">Click a node to inspect</p>
        )}
      </div>
    </aside>
  );
}
