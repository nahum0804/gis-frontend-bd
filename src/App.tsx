import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import RoutesViewer from './components/RoutesViewer';
import MonitoringPanel from './components/MonitoringPanel';

const App: React.FC = () => (
  <BrowserRouter>
    <nav style={{ padding: 10, background: '#eee' }}>
      <Link to='/' style={{ marginRight: 10 }}>Rutas</Link>
      <Link to='/monitor'>Monitoreo</Link>
    </nav>
    <Routes>
      <Route path='/' element={<RoutesViewer />} />
      <Route path='/monitor' element={<MonitoringPanel />} />
    </Routes>
  </BrowserRouter>
);

export default App;