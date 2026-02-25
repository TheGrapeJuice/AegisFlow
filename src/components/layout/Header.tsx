import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import type { GridNode } from "../../types/grid";

interface HeaderProps {
  connected?: boolean;
  nodes?: GridNode[];
}

const tabs = ['Grid Map', 'Anomalies', 'ML Status', 'Analytics'];

export function Header({ connected = true, nodes = [] }: HeaderProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const normalCount = nodes.filter(n => n.status === 'normal').length;
  const warningCount = nodes.filter(n => n.status === 'warning').length;
  const criticalCount = nodes.filter(n => n.status === 'critical').length;

  return (
    <header className="h-12 bg-grid-surface flex items-center px-4 flex-shrink-0 relative">
      {/* Gradient bottom border replacing flat border-b */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(96,165,250,0.3) 50%, transparent)' }}
      />

      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Zap className="w-5 h-5 text-blue-400" />
        <span
          className="text-white font-bold text-lg tracking-tight"
          style={{ textShadow: '0 0 12px rgba(96,165,250,0.4)' }}
        >
          AegisFlow
        </span>
      </div>

      {/* Live node summary chips */}
      {nodes.length > 0 && (
        <div className="ml-8 flex items-center gap-4 text-xs font-mono flex-shrink-0">
          <span className="text-node-normal">● {normalCount} Normal</span>
          {warningCount > 0 && <span className="text-node-warning">● {warningCount} Warning</span>}
          {criticalCount > 0 && <span className="text-node-critical animate-pulse">● {criticalCount} Critical</span>}
        </div>
      )}

      {/* Tab navigation */}
      <nav className="mx-auto flex items-center gap-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`px-3 h-12 text-xs font-medium transition-colors border-b-2 ${
              i === 0
                ? 'text-blue-400 border-blue-400'
                : 'text-grid-muted border-transparent hover:text-grid-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Right: connection status + clock */}
      <div className="flex-shrink-0 flex items-center gap-4">
        {connected ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-node-normal animate-pulse" />
            <span className="text-node-normal text-sm font-medium">LIVE</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-sm font-medium">RECONNECTING</span>
          </div>
        )}
        <span className="text-grid-muted text-sm font-mono">{time}</span>
      </div>
    </header>
  );
}
