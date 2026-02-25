export interface AnomalyAlert {
  nodeId: string;
  nodeName: string;
  score: number;       // anomaly_score value at time of detection
  timestamp: Date;     // when this alert was created/last updated
  dismissed: boolean;  // used for filtering, not for filtering out from state
}

interface AnomalyPanelProps {
  alerts: AnomalyAlert[];        // only non-dismissed alerts are passed in from parent
  onDismiss: (nodeId: string) => void;
  onDismissAll?: () => void;
  visible: boolean;              // controls slide-in/out
}

export function AnomalyPanel({ alerts, onDismiss, onDismissAll, visible }: AnomalyPanelProps) {
  return (
    <div
      className={`fixed top-16 right-4 w-72 max-h-96 overflow-y-auto z-50 bg-grid-surface border border-grid-border rounded-lg shadow-xl transition-transform duration-300 ${
        visible ? 'translate-x-0' : 'translate-x-[110%]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-grid-border sticky top-0 bg-grid-surface">
        <span className="text-xs uppercase tracking-wide text-red-400 font-semibold">
          Anomaly Alerts
        </span>
        {alerts.length > 0 && onDismissAll && (
          <button
            onClick={onDismissAll}
            className="text-[10px] text-grid-muted hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Alert rows */}
      <div className="flex flex-col divide-y divide-grid-border">
        {alerts.length === 0 ? (
          <p className="text-xs text-grid-muted italic px-3 py-2">No active anomalies</p>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.nodeId}
              className="flex items-center gap-2 px-3 py-2"
            >
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
                onClick={() => onDismiss(alert.nodeId)}
                className="text-grid-muted hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none"
                aria-label={`Dismiss alert for ${alert.nodeId}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
