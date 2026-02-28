import type { CascadeResult } from '../../types/grid';

interface CascadePanelProps {
  cascadeResult: CascadeResult;
}

export function CascadePanel({ cascadeResult }: CascadePanelProps) {
  const { cascade_chain, rerouting_summary } = cascadeResult;

  return (
    <div className="border border-grid-border rounded-lg bg-grid-surface/50 p-2.5">
      {/* Header */}
      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1.5">
        Cascade Risk
      </p>

      {cascade_chain.length === 0 ? (
        <p className="text-xs text-grid-muted italic">No cascade risk detected</p>
      ) : (
        <>
          {/* Ranked node list — sorted by confidence desc (already sorted by backend) */}
          <div className="flex flex-col gap-1 mb-2 max-h-32 overflow-y-auto">
            {cascade_chain.map((item) => (
              <div key={item.node_id} className="flex items-center justify-between text-xs gap-1">
                <span className="text-grid-muted font-mono flex-shrink-0 w-16 truncate">
                  {item.node_id}
                </span>
                {/* Confidence badge — three-tier color matching D3 overlay */}
                <span className={`font-semibold flex-shrink-0 ${
                  item.confidence > 0.75 ? 'text-amber-400' :
                  item.confidence > 0.5  ? 'text-amber-600' : 'text-amber-800'
                }`}>
                  {Math.round(item.confidence * 100)}%
                </span>
                <span className="text-grid-muted flex-shrink-0">
                  ~{item.time_to_cascade_min.toFixed(0)} min
                </span>
              </div>
            ))}
          </div>

          {/* Rerouting summary */}
          {rerouting_summary && (
            <div className="border-t border-grid-border pt-1.5">
              <p className="text-[10px] text-blue-400 leading-tight">
                <span className="font-semibold">Rerouting:</span> {rerouting_summary}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
