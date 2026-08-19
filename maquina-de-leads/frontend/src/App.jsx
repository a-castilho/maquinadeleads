import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import NicheDetail from './pages/NicheDetail.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import UbuntuShell from './components/UbuntuShell.jsx';

function ProtectedPage({ children }) {
  return (
    <PrivateRoute>
      <UbuntuShell>{children}</UbuntuShell>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
      <Route path="/campanhas/:id" element={<ProtectedPage><CampaignDetail /></ProtectedPage>} />
      <Route path="/nichos/:id" element={<ProtectedPage><NicheDetail /></ProtectedPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
