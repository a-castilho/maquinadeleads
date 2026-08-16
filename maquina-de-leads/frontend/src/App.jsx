import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import CompanyProfile from './pages/CompanyProfile.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/perfil-empresa"
        element={
          <PrivateRoute>
            <CompanyProfile />
          </PrivateRoute>
        }
      />
      <Route
        path="/campanhas/:id"
        element={
          <PrivateRoute>
            <CampaignDetail />
          </PrivateRoute>
        }
      />
      <Route path="/nichos/:id" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
