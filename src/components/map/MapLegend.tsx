export function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-grid-surface/90 backdrop-blur-sm border border-grid-border rounded-lg p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-grid-text mb-2 uppercase tracking-wider">Legend</p>

      {/* Status colors */}
      <div className="mb-3">
        <p className="text-[10px] text-grid-muted mb-1 uppercase tracking-wide">Node Status</p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-node-normal flex-shrink-0" />
            <span className="text-xs text-grid-text">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-node-warning flex-shrink-0" />
            <span className="text-xs text-grid-text">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-node-critical flex-shrink-0" />
            <span className="text-xs text-grid-text">Critical</span>
          </div>
        </div>
      </div>

      {/* Node types */}
      <div>
        <p className="text-[10px] text-grid-muted mb-1 uppercase tracking-wide">Node Type</p>
        <div className="flex flex-col gap-1">
          {[
            { label: 'Generator', size: 10 },
            { label: 'Substation', size: 8 },
            { label: 'Transformer', size: 6 },
            { label: 'Junction', size: 6 },
          ].map(({ label, size }) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="rounded-full bg-grid-muted flex-shrink-0"
                style={{ width: size, height: size }}
              />
              <span className="text-xs text-grid-text">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
