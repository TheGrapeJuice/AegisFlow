import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { StatusPanel } from "./StatusPanel";

export function DashboardLayout() {
  return (
    <div className="h-screen flex flex-col bg-grid-bg overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative bg-grid-bg" id="map-canvas">
          {/* Map renders here in Plan 02 */}
          <div className="absolute inset-0 flex items-center justify-center text-grid-muted text-sm">
            Map loading...
          </div>
        </main>
        <StatusPanel />
      </div>
    </div>
  );
}
