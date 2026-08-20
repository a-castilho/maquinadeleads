import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import NicheDetail from './pages/NicheDetail.jsx';
import Reports from './pages/Reports.jsx';
import InstagramAutomation from './pages/InstagramAutomation.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import AppShell from './components/AppShell.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<PrivateRoute><AppShell /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/instagram-automatico" element={<InstagramAutomation />} />
        <Route path="/campanhas/:id" element={<CampaignDetail />} />
        <Route path="/nichos/:id" element={<NicheDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
