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

export function Sidebar() {
  return (
    <aside className="w-56 bg-grid-surface border-r border-grid-border flex flex-col flex-shrink-0">
      {/* Nav items */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
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

      {/* Bottom: version badge */}
      <div className="p-3 border-t border-grid-border">
        <span className="text-xs text-grid-muted font-mono">v1.0-shell</span>
      </div>
    </aside>
  );
}
