import './App.css';
import NearbyRoutes from './components/NearbyRoutes';
import RoutesViewer from './components/RoutesViewer';
import MonitoringPanel from './components/MonitoringPanel';
import { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';

export default function App() {
  const [selectedRoute, setSelectedRoute] = useState<number|undefined>();

  return (
    <div className="App">
      <nav className="Sidebar">
        <div className="Card Hero">
          <h1 className="Hero-title">La inteligencia detrás de cada viaje</h1>
          <p className="Hero-subtitle">Sistema de transporte en San Carlos</p>
        </div>
        <NearbyRoutes onSelect={r => setSelectedRoute(r.id)} />
        <Link to="/monitor" className="Button">Panel de Monitoreo</Link>
      </nav>
      <div className="MapWrapper">
        <Routes>
          <Route path="/" element={<RoutesViewer selectedRoute={selectedRoute} />} />
          <Route path="/monitor" element={<MonitoringPanel />} />
        </Routes>
      </div>
    </div>
  );
}