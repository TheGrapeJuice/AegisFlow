export interface AnomalyAlert {
  nodeId: string;
  nodeName: string;
  score: number;
  timestamp: Date;
  dismissed: boolean;
}

interface AnomalyPanelProps {
  alerts: AnomalyAlert[];
  onDismiss: (nodeId: string) => void;
  onDismissAll?: () => void;
}

export function AnomalyPanel({ alerts, onDismiss, onDismissAll }: AnomalyPanelProps) {
  return (
    <div className="border border-red-500/30 rounded-lg overflow-hidden bg-grid-bg/60">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-grid-border bg-grid-surface">
        <span className="text-xs uppercase tracking-wide text-red-400 font-semibold">
          ⚠ Anomaly Alerts ({alerts.length})
        </span>
        {alerts.length > 0 && onDismissAll && (
          <button
            type="button"
            onClick={onDismissAll}
            className="text-[10px] text-grid-muted hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Alert rows */}
      <div className="flex flex-col divide-y divide-grid-border max-h-40 overflow-y-auto">
        {alerts.map(alert => (
          <div key={alert.nodeId} className="flex items-center gap-2 px-3 py-2">
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-mono text-grid-text truncate">{alert.nodeId}</span>
              <span className="text-[10px] text-grid-muted font-mono">
                {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            </div>
            <span className="text-xs font-mono text-red-400 flex-shrink-0">
              {alert.score.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(alert.nodeId)}
              className="text-grid-muted hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none"
              aria-label={`Dismiss alert for ${alert.nodeId}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
