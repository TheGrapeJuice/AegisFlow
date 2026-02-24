interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  valueColor?: string;
}

function StatCard({ label, value, subtext, valueColor = "text-grid-text" }: StatCardProps) {
  return (
    <div className="bg-grid-bg rounded-lg p-3 border border-grid-border">
      <p className="text-xs text-grid-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-grid-muted mt-1">{subtext}</p>
    </div>
  );
}

export function StatusPanel() {
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
        <p className="text-xs text-grid-muted italic">Click a node to inspect</p>
      </div>
    </aside>
  );
}
