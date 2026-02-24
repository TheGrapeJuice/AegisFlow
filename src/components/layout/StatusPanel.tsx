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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-grid-muted uppercase tracking-wider">Node</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedNode.status === 'normal' ? 'bg-green-500/20 text-green-400' :
                selectedNode.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {selectedNode.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-semibold text-grid-text">{selectedNode.name}</p>
            <p className="text-xs text-grid-muted capitalize">{selectedNode.type}</p>
            <div className="mt-2 flex flex-col gap-1.5 border-t border-grid-border pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-grid-muted">Voltage</span>
                <span className="text-grid-text font-mono">{selectedNode.voltage} kV</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-grid-muted">Frequency</span>
                <span className="text-grid-text font-mono">{selectedNode.frequency.toFixed(2)} Hz</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-grid-muted">Load</span>
                <span className={`font-mono text-xs ${
                  selectedNode.load > 90 ? 'text-red-400' :
                  selectedNode.load > 75 ? 'text-yellow-400' : 'text-green-400'
                }`}>{selectedNode.load}%</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-grid-muted italic">Click a node to inspect</p>
        )}
      </div>
    </aside>
  );
}
