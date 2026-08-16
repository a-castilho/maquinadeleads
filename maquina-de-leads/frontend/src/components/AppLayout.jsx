import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import CampaignRestartButton from './CampaignRestartButton';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (location.pathname === '/') return <Outlet />;

  return (
    <div className="app-shell route-shell">
      <AppSidebar user={user} onLogout={logout} />
      <main className="route-content">
        <CampaignRestartButton />
        <Outlet />
      </main>
    </div>
  );
}
