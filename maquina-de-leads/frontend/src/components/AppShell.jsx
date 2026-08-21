import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: '⌂', end: true },
  { to: '/buscar-clientes', label: 'Buscar clientes', icon: '⌕' },
  { to: '/instagram-automatico', label: 'Instagram Automático', icon: '◎' },
  { to: '/relatorios', label: 'Relatórios', icon: '▤' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('ml.sidebar.collapsed');
    return saved === null ? true : saved === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('ml.sidebar.collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    if (mobileOpen) {
      document.body.classList.add('ml-mobile-nav-lock');
      window.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.body.classList.remove('ml-mobile-nav-lock');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const sidebarClass = `ml-sidebar${collapsed ? ' is-collapsed' : ''}`;
  const initial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();

  function renderNavigation(mobile = false) {
    return (
      <nav className={mobile ? 'ml-nav ml-nav-mobile' : 'ml-nav'} aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `ml-nav-item${isActive ? ' active' : ''}`}
            title={!mobile && collapsed ? item.label : undefined}
            aria-label={!mobile && collapsed ? item.label : undefined}
          >
            <span className="ml-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="ml-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <div className={`ml-app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className={sidebarClass}>
        <div className="ml-sidebar-head">
          <NavLink to="/" className="ml-brand" aria-label="Máquina de Leads - início">
            <span className="ml-brand-mark">ML</span>
            <span className="ml-brand-copy">
              <strong>Máquina de Leads</strong>
              <small>Automação comercial</small>
            </span>
          </NavLink>

          <button
            type="button"
            className="ml-collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span aria-hidden="true">{collapsed ? '☰' : '‹'}</span>
          </button>
        </div>

        <div className="ml-sidebar-nav-wrap">
          <div className="ml-nav-section-label">Navegação</div>
          {renderNavigation(false)}
        </div>

        <div className="ml-sidebar-footer">
          <div className="ml-account" title={collapsed ? (user?.name || user?.email || 'Conta') : undefined}>
            <span className="ml-account-avatar">{initial}</span>
            <span className="ml-account-copy">
              <strong>{user?.name || 'Conta ativa'}</strong>
              <small>{user?.email || 'Máquina de Leads'}</small>
            </span>
          </div>
          <button type="button" className="ml-logout-button" onClick={logout} title={collapsed ? 'Sair' : undefined}>
            <span aria-hidden="true">↪</span>
            <span className="ml-logout-label">Sair</span>
          </button>
        </div>
      </aside>

      <header className="ml-mobile-header">
        <button type="button" className="ml-mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">☰</button>
        <NavLink to="/" className="ml-mobile-brand">
          <span className="ml-brand-mark">ML</span>
          <strong>Máquina de Leads</strong>
        </NavLink>
      </header>

      <button
        type="button"
        className={`ml-mobile-backdrop${mobileOpen ? ' visible' : ''}`}
        aria-label="Fechar menu"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      <div className={`ml-mobile-drawer${mobileOpen ? ' open' : ''}`}>
        <div className="ml-mobile-drawer-head">
          <div className="ml-mobile-brand">
            <span className="ml-brand-mark">ML</span>
            <strong>Máquina de Leads</strong>
          </div>
          <button type="button" className="ml-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">×</button>
        </div>
        {renderNavigation(true)}
        <div className="ml-mobile-drawer-footer">
          <div className="ml-account">
            <span className="ml-account-avatar">{initial}</span>
            <span className="ml-account-copy">
              <strong>{user?.name || 'Conta ativa'}</strong>
              <small>{user?.email || 'Máquina de Leads'}</small>
            </span>
          </div>
          <button type="button" className="ml-logout-button" onClick={logout}><span aria-hidden="true">↪</span><span>Sair</span></button>
        </div>
      </div>

      <main className="ml-main-content"><Outlet /></main>
    </div>
  );
}
