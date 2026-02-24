import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusPanel } from './StatusPanel';
import { GridMap } from '../map/GridMap';
import type { GridNode } from '../../types/grid';

export function DashboardLayout() {
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);

  return (
    <div className="h-screen flex flex-col bg-grid-bg overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative bg-grid-bg" id="map-canvas">
          <GridMap onNodeClick={setSelectedNode} />
        </main>
        <StatusPanel selectedNode={selectedNode} />
      </div>
    </div>
  );
}
