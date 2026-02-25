import { useState } from 'react';

const ACCENT: Record<string, string> = {
  green:  'border-l-4 border-l-green-500',
  yellow: 'border-l-4 border-l-yellow-500',
  red:    'border-l-4 border-l-red-500',
  blue:   'border-l-4 border-l-blue-500',
};

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  valueColor?: string;
  accentColor?: 'green' | 'yellow' | 'red' | 'blue';
  progressValue?: number;
}

function StatCard({ label, value, subtext, valueColor = 'text-grid-text', accentColor, progressValue }: StatCardProps) {
  return (
    <div className={`rounded-lg p-3 border border-grid-border bg-grid-bg/80 backdrop-blur-sm ${accentColor ? ACCENT[accentColor] : ''}`}>
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

interface SidebarProps {
  onStormEvent?: () => Promise<void>;
  stormActive?: boolean;
}

export function Sidebar({ onStormEvent, stormActive }: SidebarProps) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<'idle' | 'success' | 'error'>('idle');

  const handleStorm = async () => {
    if (!onStormEvent || loading) return;
    setLoading(true);
    setLastResult('idle');
    try {
      await onStormEvent();
      setLastResult('success');
      setTimeout(() => setLastResult('idle'), 3000);
    } catch {
      setLastResult('error');
      setTimeout(() => setLastResult('idle'), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      className="w-56 border-r border-grid-border flex flex-col flex-shrink-0"
      style={{ background: 'linear-gradient(to bottom, #1a2130, #161b27)' }}
    >
      {/* Stat cards */}
      <div className="flex flex-col gap-2 p-2 flex-1">
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
      </div>

      {/* Storm Event button */}
      <div className="p-3 border-t border-grid-border">
        <button
          onClick={handleStorm}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
            ${loading
              ? 'bg-orange-500/20 text-orange-300 cursor-wait'
              : stormActive
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              : lastResult === 'error'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/20'
            }`}
        >
          {loading
            ? (stormActive ? 'Stopping...' : 'Injecting...')
            : stormActive
            ? '⚡ Stop Storm'
            : lastResult === 'error'
            ? 'Failed'
            : '⚡ Simulate Storm Event'}
        </button>
      </div>

      {/* Bottom: version badge */}
      <div className="p-3 border-t border-grid-border">
        <span className="text-xs text-grid-muted font-mono">v1.0-shell</span>
      </div>
    </aside>
  );
}
