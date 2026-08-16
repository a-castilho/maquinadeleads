import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'maquina-leads.sidebar.collapsed';

function NavIcon({ children }) {
  return <span className="sidebar-nav-icon" aria-hidden="true">{children}</span>;
}

export default function AppSidebar({ user, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 820) setMobileOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="mobile-sidebar-trigger"
        aria-label="Abrir menu"
        onClick={() => setMobileOpen(true)}
      >
        ☰
      </button>

      {mobileOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={closeMobile} />}

      <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar-topline">
          <Link to="/" className="brand-lockup" onClick={closeMobile} title="Máquina de Leads">
            <div className="brand-mark">M</div>
            <div className="sidebar-copy">
              <strong>Máquina de Leads</strong>
              <span>Motor de prospecção</span>
            </div>
          </Link>

          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? '›' : '‹'}
          </button>

          <button type="button" className="sidebar-mobile-close" onClick={closeMobile} aria-label="Fechar menu">×</button>
        </div>

        <button type="button" className="sidebar-new-action" onClick={() => {
          closeMobile();
          document.querySelector('#campanhas')?.scrollIntoView({ behavior: 'smooth' });
        }} title="Nova campanha">
          <NavIcon>＋</NavIcon>
          <span className="sidebar-copy">Nova campanha</span>
        </button>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <a href="#visao-geral" className="sidebar-link active" onClick={closeMobile} title="Visão geral">
            <NavIcon>⌂</NavIcon><span className="sidebar-copy">Visão geral</span>
          </a>
          <a href="#campanhas" className="sidebar-link" onClick={closeMobile} title="Campanhas">
            <NavIcon>◎</NavIcon><span className="sidebar-copy">Campanhas</span>
          </a>
          <Link to="/perfil-empresa" className="sidebar-link" onClick={closeMobile} title="Perfil da empresa">
            <NavIcon>◇</NavIcon><span className="sidebar-copy">Perfil da empresa</span>
          </Link>
        </nav>

        <div className="sidebar-section sidebar-copy">
          <span className="sidebar-section-title">SEU ESPAÇO</span>
          <div className="sidebar-mini-item"><span className="status-dot" /> Sistema online</div>
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-status sidebar-copy">
          <span className="status-dot" />
          <div><strong>Sistema online</strong><small>Backend e worker ativos</small></div>
        </div>

        <div className="sidebar-user">
          <div className="avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="sidebar-copy"><strong>{user?.name || 'Usuário'}</strong><span>Conta ativa</span></div>
          <button className="icon-button sidebar-logout" onClick={onLogout} title="Sair" aria-label="Sair">↗</button>
        </div>
      </aside>
    </>
  );
}
