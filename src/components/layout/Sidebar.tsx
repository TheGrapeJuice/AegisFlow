import { useState } from 'react';
import { Map, Activity, Cpu, BarChart2 } from "lucide-react";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}

const navItems: NavItem[] = [
  { icon: Map, label: "Grid Map", active: true },
  { icon: Activity, label: "Anomalies" },
  { icon: Cpu, label: "ML Status" },
  { icon: BarChart2, label: "Analytics" },
];

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
      {/* Nav items */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              style={item.active ? { boxShadow: 'inset -3px 0 10px rgba(59,130,246,0.2)' } : undefined}
              className={
                item.active
                  ? "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-blue-500/10 text-blue-400 border-r-2 border-blue-500 w-full text-left"
                  : "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-grid-muted hover:text-grid-text hover:bg-white/5 w-full text-left transition-colors"
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

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
