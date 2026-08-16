import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // A home já possui o shell do dashboard para preservar o layout atual.
  if (location.pathname === '/') return <Outlet />;

  return (
    <div className="app-shell route-shell">
      <AppSidebar user={user} onLogout={logout} />
      <main className="route-content">
        <Outlet />
      </main>
    </div>
  );
}
