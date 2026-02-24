import { useState, useEffect } from "react";
import { Zap } from "lucide-react";

interface HeaderProps {
  connected?: boolean;
}

export function Header({ connected = true }: HeaderProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-12 bg-grid-surface border-b border-grid-border flex items-center px-4 flex-shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-blue-400" />
        <span className="text-white font-bold text-lg tracking-tight">AegisFlow</span>
      </div>

      {/* Right: Connection status + timestamp */}
      <div className="ml-auto flex items-center gap-4">
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
