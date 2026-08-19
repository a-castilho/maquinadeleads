import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const pageLabels = [
  { test: (path) => path.startsWith('/campanhas/'), label: 'Campanha' },
  { test: (path) => path.startsWith('/nichos/'), label: 'Nicho' },
  { test: (path) => path === '/', label: 'Visão geral' },
];

export default function UbuntuShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentPage = pageLabels.find(({ test }) => test(location.pathname))?.label || 'Máquina de Leads';

  return (
    <div className="ubuntu-shell">
      <header className="ubuntu-panel">
        <div className="ubuntu-panel-brand">
          <span className="ubuntu-panel-mark" aria-hidden="true" />
          <strong>Máquina de Leads</strong>
        </div>

        <div className="ubuntu-panel-title" aria-live="polite">{currentPage}</div>

        <div className="ubuntu-panel-session">
          <span className="ubuntu-online" aria-hidden="true" />
          <span className="ubuntu-user-name">{user?.name || 'Usuário'}</span>
          <button type="button" className="ubuntu-session-button" onClick={logout}>Sair</button>
        </div>
      </header>

      <aside className="ubuntu-dock" aria-label="Navegação principal">
        <Link
          to="/"
          className={`ubuntu-launcher${location.pathname === '/' ? ' active' : ''}`}
          aria-label="Abrir visão geral"
          title="Visão geral"
        >
          <span className="ubuntu-launcher-logo">ML</span>
        </Link>
        <span className="ubuntu-dock-separator" aria-hidden="true" />
        <span className="ubuntu-dock-status" title="Sistema conectado" aria-label="Sistema conectado">
          <span className="ubuntu-online" aria-hidden="true" />
        </span>
      </aside>

      <main className="ubuntu-workspace">{children}</main>
    </div>
  );
}
