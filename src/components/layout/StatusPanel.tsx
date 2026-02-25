import type { GridNode } from '../../types/grid';
import { NodeCharts } from '../sidebar/NodeCharts';
import { useNodeHistory } from '../../hooks/useNodeHistory';
import type { NodeReading } from '../../hooks/useNodeHistory';
import type { EventEntry } from '../../hooks/useEventFeed';
import { AnomalyPanel } from './AnomalyPanel';
import type { AnomalyAlert } from './AnomalyPanel';

interface StatusPanelProps {
  selectedNode?: GridNode | null;
  latestReading?: NodeReading | null;
  events?: EventEntry[];
  anomalyAlerts?: AnomalyAlert[];
  onDismissAlert?: (nodeId: string) => void;
  onDismissAll?: () => void;
}

function NodeChartsWrapper({ selectedNodeId, latestReading }: { selectedNodeId: string; latestReading?: NodeReading | null }) {
  const { readings, loading } = useNodeHistory({ selectedNodeId, latestReading });
  return <NodeCharts readings={readings} loading={loading} />;
}

export function StatusPanel({ selectedNode, latestReading, events, anomalyAlerts = [], onDismissAlert, onDismissAll }: StatusPanelProps) {
  return (
    <aside
      className="w-72 bg-grid-surface border-l border-grid-border flex flex-col p-3 gap-2 flex-shrink-0 overflow-y-auto"
      style={{ boxShadow: '-4px 0 24px rgba(59,130,246,0.07)' }}
    >
      {/* Anomaly alerts — only shown when alerts exist */}
      {anomalyAlerts.length > 0 && (
        <AnomalyPanel
          alerts={anomalyAlerts}
          onDismiss={onDismissAlert ?? (() => {})}
          onDismissAll={onDismissAll}
        />
      )}

      {/* Event feed */}
      <div className="border-t border-grid-border pt-2 first:border-t-0 first:pt-0">
        <p className="text-xs font-semibold text-grid-text uppercase tracking-wide mb-1.5">
          Event Log
        </p>
        {events && events.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {events.map((event, i) => (
              <div
                key={event.id}
                className="flex items-center justify-between text-xs gap-1"
                style={{ opacity: Math.max(0.3, 1 - i * 0.08) }}
              >
                <span className="text-grid-muted truncate w-14 flex-shrink-0">
                  {event.nodeName.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className={`flex-shrink-0 ${
                  event.to === 'critical' ? 'text-red-400' :
                  event.to === 'warning'  ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {event.from} → {event.to}
                </span>
                <span className="text-grid-muted font-mono text-[10px] flex-shrink-0">
                  {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-grid-muted italic">No state changes yet</p>
        )}
      </div>

      {/* Node detail section */}
      <div className="border-t border-grid-border pt-2">
        <p className="text-xs font-semibold text-grid-text uppercase tracking-wide mb-1.5">
          Node Detail
        </p>
        {selectedNode ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-grid-muted uppercase tracking-wider">Node</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                selectedNode.status === 'normal'
                  ? 'bg-green-500/20 text-green-400'
                  : selectedNode.status === 'warning'
                  ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-400/50 animate-pulse'
                  : 'bg-red-500/20 text-red-400 ring-1 ring-red-400/50 animate-pulse'
              }`}>
                {selectedNode.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-semibold text-grid-text">{selectedNode.name}</p>
            <p className="text-xs text-grid-muted capitalize">{selectedNode.type}</p>
            <div className="mt-2 flex flex-col gap-2 border-t border-grid-border pt-2">
              {/* Voltage deviation bar */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-grid-muted w-16 flex-shrink-0">Voltage</span>
                <div className="flex-1 h-1 bg-grid-border rounded-full overflow-hidden relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-grid-muted/40" />
                  <div
                    className={`absolute top-0 bottom-0 rounded-full ${
                      Math.abs(selectedNode.voltage - 120) > 12 ? 'bg-red-500' :
                      Math.abs(selectedNode.voltage - 120) > 6  ? 'bg-yellow-500' : 'bg-blue-400'
                    }`}
                    style={{
                      left: selectedNode.voltage < 120
                        ? `${Math.max(0, 50 - ((120 - selectedNode.voltage) / 20) * 50)}%`
                        : '50%',
                      width: `${Math.min(50, (Math.abs(selectedNode.voltage - 120) / 20) * 50)}%`,
                    }}
                  />
                </div>
                <span className="text-grid-text font-mono text-xs w-20 text-right flex-shrink-0">
                  {selectedNode.voltage.toFixed(1)} kV
                </span>
              </div>

              {/* Frequency deviation bar */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-grid-muted w-16 flex-shrink-0">Frequency</span>
                <div className="flex-1 h-1 bg-grid-border rounded-full overflow-hidden relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-grid-muted/40" />
                  <div
                    className={`absolute top-0 bottom-0 rounded-full ${
                      Math.abs(selectedNode.frequency - 60) > 0.5  ? 'bg-red-500' :
                      Math.abs(selectedNode.frequency - 60) > 0.25 ? 'bg-yellow-500' : 'bg-green-400'
                    }`}
                    style={{
                      left: selectedNode.frequency < 60
                        ? `${Math.max(0, 50 - ((60 - selectedNode.frequency) / 1) * 50)}%`
                        : '50%',
                      width: `${Math.min(50, (Math.abs(selectedNode.frequency - 60) / 1) * 50)}%`,
                    }}
                  />
                </div>
                <span className="text-grid-text font-mono text-xs w-20 text-right flex-shrink-0">
                  {selectedNode.frequency.toFixed(2)} Hz
                </span>
              </div>

              {/* Load progress bar */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-grid-muted w-16 flex-shrink-0">Load</span>
                <div className="flex-1 h-1.5 bg-grid-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedNode.load >= 90 ? 'bg-red-500' :
                      selectedNode.load >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${selectedNode.load}%` }}
                  />
                </div>
                <span className={`font-mono text-xs w-12 text-right flex-shrink-0 ${
                  selectedNode.load >= 90 ? 'text-red-400' :
                  selectedNode.load >= 75 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {selectedNode.load.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="mt-1 border-t border-grid-border pt-2">
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
