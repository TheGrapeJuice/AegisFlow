import type { GridNode } from '../../types/grid';
import { NodeCharts } from '../sidebar/NodeCharts';
import { useNodeHistory } from '../../hooks/useNodeHistory';
import type { NodeReading } from '../../hooks/useNodeHistory';

const ACCENT: Record<string, string> = {
  green:  'border-l-4 border-green-500',
  yellow: 'border-l-4 border-yellow-500',
  red:    'border-l-4 border-red-500',
  blue:   'border-l-4 border-blue-500',
};

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  valueColor?: string;
  accentColor?: 'green' | 'yellow' | 'red' | 'blue';
  progressValue?: number;
  pulse?: boolean;
}

function StatCard({ label, value, subtext, valueColor = 'text-grid-text', accentColor, progressValue, pulse }: StatCardProps) {
  return (
    <div className={`rounded-lg p-3 border border-grid-border bg-grid-bg/80 backdrop-blur-sm ${accentColor ? ACCENT[accentColor] : ''} ${pulse ? 'animate-pulse' : ''}`}>
      <p className="text-xs text-grid-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-grid-muted mt-1">{subtext}</p>
      {progressValue !== undefined && (
        <div className="mt-2 h-1 bg-grid-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressValue >= 90 ? 'bg-red-500' : progressValue >= 75 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}
    </div>
  );
}

function NodeChartsWrapper({ selectedNodeId, latestReading }: { selectedNodeId: string; latestReading?: NodeReading | null }) {
  const { readings, loading } = useNodeHistory({ selectedNodeId, latestReading });
  return <NodeCharts readings={readings} loading={loading} />;
}

interface StatusPanelProps {
  selectedNode?: GridNode | null;
  latestReading?: NodeReading | null;
}

export function StatusPanel({ selectedNode, latestReading }: StatusPanelProps) {
  return (
    <aside
      className="w-72 bg-grid-surface border-l border-grid-border flex flex-col p-3 gap-3 flex-shrink-0 overflow-y-auto"
      style={{ boxShadow: '-4px 0 24px rgba(59,130,246,0.07)' }}
    >
      <StatCard
        label="Active Nodes"
        value="24"
        subtext="Total nodes online"
        accentColor="green"
      />
      <StatCard
        label="Anomalies"
        value="0"
        subtext="Last 5 minutes"
        valueColor="text-node-normal"
        accentColor="green"
      />
      <StatCard
        label="Grid Load"
        value="87%"
        subtext="System capacity"
        valueColor="text-node-warning"
        accentColor="yellow"
        progressValue={87}
      />
      <StatCard
        label="FL Round"
        value="--"
        subtext="Training inactive"
        valueColor="text-grid-muted"
        accentColor="blue"
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
            <div className="mt-2 border-t border-grid-border pt-2">
              <p className="text-xs text-grid-muted uppercase tracking-wide mb-1">Live Charts</p>
              <NodeChartsWrapper selectedNodeId={selectedNode.id} latestReading={latestReading} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-grid-muted italic">Click a node to inspect</p>
        )}
      </div>
    </aside>
  );
}
