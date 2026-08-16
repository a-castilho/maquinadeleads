import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = {
  draft: 'Rascunho',
  preparing: 'Preparando',
  ready: 'Pronta',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  failed: 'Com erro',
};

const STATUS_ORDER = ['running', 'ready', 'preparing', 'draft', 'paused', 'completed', 'failed'];

function number(value) {
  return Number(value || 0);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({ name:'', description:'', location:'', offer:'', targetAudience:'', objective:'' });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    try {
      const res = await api.get('/niches');
      setCampaigns(res.data.niches || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  function change(field, value) { setForm(current => ({ ...current, [field]: value })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await api.post('/niches', form);
      setForm({ name:'', description:'', location:'', offer:'', targetAudience:'', objective:'' });
      setShowCreate(false);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar campanha.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e, id, name) {
    e.preventDefault();
    if (!window.confirm(`Excluir a campanha "${name}"? Todos os leads, jobs e configurações vinculados também serão removidos.`)) return;
    try {
      await api.delete(`/niches/${id}`);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir campanha.');
    }
  }

  const stats = useMemo(() => {
    const totalLeads = campaigns.reduce((sum, item) => sum + number(item.leads_count), 0);
    const qualified = campaigns.reduce((sum, item) => sum + number(item.qualified_leads_count), 0);
    const activeJobs = campaigns.reduce((sum, item) => sum + number(item.active_jobs), 0);
    const running = campaigns.filter(item => item.campaign_status === 'running').length;
    const qualificationRate = totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0;
    return { totalLeads, qualified, activeJobs, running, qualificationRate };
  }, [campaigns]);

  const statusDistribution = useMemo(() => STATUS_ORDER
    .map(status => ({ status, value: campaigns.filter(item => item.campaign_status === status).length }))
    .filter(item => item.value > 0), [campaigns]);

  const maxLeads = Math.max(1, ...campaigns.map(item => number(item.leads_count)));
  const topCampaigns = [...campaigns].sort((a, b) => number(b.leads_count) - number(a.leads_count)).slice(0, 6);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">M</div>
          <div><strong>Máquina de Leads</strong><span>Motor de prospecção</span></div>
        </div>

        <nav className="sidebar-nav">
          <a href="#visao-geral" className="sidebar-link active"><span>⌂</span> Visão geral</a>
          <a href="#campanhas" className="sidebar-link"><span>◎</span> Campanhas</a>
          <Link to="/perfil-empresa" className="sidebar-link"><span>◇</span> Perfil da empresa</Link>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <span className="status-dot" />
          <div><strong>Sistema online</strong><small>Backend e worker ativos</small></div>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div>
          <div><strong>{user?.name || 'Usuário'}</strong><span>Conta ativa</span></div>
          <button className="icon-button" onClick={logout} title="Sair">↗</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header fade-up">
          <div>
            <span className="eyebrow">PAINEL OPERACIONAL</span>
            <h1>Visão geral</h1>
            <p>Acompanhe aquisição, qualificação e execução das campanhas em tempo real.</p>
          </div>
          <div className="header-actions">
            <Link to="/perfil-empresa" className="secondary-button">Perfil da empresa</Link>
            <button onClick={() => setShowCreate(current => !current)}>+ Nova campanha</button>
          </div>
        </header>

        {showCreate && (
          <section className="create-panel fade-up">
            <div className="section-heading">
              <div><span className="eyebrow">NOVA CAMPANHA</span><h2>Configuração inicial</h2></div>
              <button className="icon-button" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form className="campaign-form" onSubmit={handleCreate}>
              <input placeholder="Nome da campanha *" value={form.name} onChange={e=>change('name',e.target.value)} required />
              <input placeholder="Nicho / descrição curta" value={form.description} onChange={e=>change('description',e.target.value)} />
              <input placeholder="Localização" value={form.location} onChange={e=>change('location',e.target.value)} />
              <input placeholder="Oferta ou serviço" value={form.offer} onChange={e=>change('offer',e.target.value)} />
              <input placeholder="Público-alvo" value={form.targetAudience} onChange={e=>change('targetAudience',e.target.value)} />
              <textarea placeholder="Objetivo da campanha" value={form.objective} onChange={e=>change('objective',e.target.value)} rows={3} />
              <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" disabled={creating}>{creating ? 'Criando...' : 'Criar campanha'}</button></div>
            </form>
          </section>
        )}

        <section id="visao-geral" className="metric-grid fade-up stagger-1">
          <MetricCard label="Campanhas" value={campaigns.length} note={`${stats.running} em execução`} icon="◎" />
          <MetricCard label="Leads encontrados" value={stats.totalLeads} note={`${stats.qualified} qualificados`} icon="↗" />
          <MetricCard label="Taxa de qualificação" value={`${stats.qualificationRate}%`} note="leads acima do score" icon="◔" />
          <MetricCard label="Jobs ativos" value={stats.activeJobs} note={stats.activeJobs ? 'processando agora' : 'fila tranquila'} icon="⚡" pulse={stats.activeJobs > 0} />
        </section>

        <section className="dashboard-grid fade-up stagger-2">
          <article className="dashboard-card chart-card">
            <div className="section-heading">
              <div><span className="eyebrow">PERFORMANCE</span><h2>Leads por campanha</h2></div>
              <span className="soft-badge">Top {Math.min(6, campaigns.length)}</span>
            </div>
            {loading ? <div className="skeleton chart-skeleton" /> : topCampaigns.length === 0 ? <EmptyMini text="Crie uma campanha para começar." /> : (
              <div className="bar-chart">
                {topCampaigns.map((campaign, index) => {
                  const total = number(campaign.leads_count);
                  const qualified = number(campaign.qualified_leads_count);
                  const width = Math.max(4, (total / maxLeads) * 100);
                  const qualifiedWidth = total > 0 ? (qualified / total) * width : 0;
                  return (
                    <div className="bar-row" key={campaign.id} style={{ '--delay': `${index * 70}ms` }}>
                      <div className="bar-label"><span>{campaign.name}</span><strong>{total}</strong></div>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${width}%` }}><div className="bar-qualified" style={{ width: `${qualifiedWidth}%` }} /></div></div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="chart-legend"><span><i className="legend-dot total" /> Leads</span><span><i className="legend-dot qualified" /> Qualificados</span></div>
          </article>

          <article className="dashboard-card distribution-card">
            <div className="section-heading"><div><span className="eyebrow">PIPELINE</span><h2>Status das campanhas</h2></div></div>
            <div className="distribution-wrap">
              <div className="donut" style={{ '--value': `${campaigns.length ? Math.round((stats.running / campaigns.length) * 100) : 0}%` }}>
                <div><strong>{campaigns.length}</strong><span>campanhas</span></div>
              </div>
              <div className="status-list">
                {statusDistribution.length === 0 ? <span className="hint">Sem campanhas.</span> : statusDistribution.map(item => (
                  <div className="status-item" key={item.status}><span><i className={`status-swatch status-${item.status}`} />{STATUS_LABELS[item.status] || item.status}</span><strong>{item.value}</strong></div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section id="campanhas" className="dashboard-card campaigns-panel fade-up stagger-3">
          <div className="section-heading">
            <div><span className="eyebrow">CAMPANHAS</span><h2>Operações recentes</h2><p>Entre em uma campanha para revisar estratégia, leads, funil e execução.</p></div>
            <button className="secondary-button" onClick={() => setShowCreate(true)}>+ Criar campanha</button>
          </div>

          {loading ? <div className="campaign-list"><div className="skeleton row-skeleton" /><div className="skeleton row-skeleton" /></div> : campaigns.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">◎</div><h3>Nenhuma campanha ainda</h3><p>Crie a primeira campanha e acompanhe todo o processo neste painel.</p><button onClick={() => setShowCreate(true)}>Criar primeira campanha</button></div>
          ) : (
            <div className="campaign-list">
              {campaigns.map((campaign, index) => (
                <Link to={`/campanhas/${campaign.id}`} key={campaign.id} className="campaign-row" style={{ '--delay': `${index * 50}ms` }}>
                  <div className="campaign-icon">{campaign.name.slice(0, 1).toUpperCase()}</div>
                  <div className="campaign-main"><strong>{campaign.name}</strong><span>{campaign.description || campaign.offer || campaign.objective || 'Campanha de prospecção'}</span></div>
                  <div className="campaign-location">{campaign.location || '—'}</div>
                  <div className="campaign-number"><strong>{number(campaign.leads_count)}</strong><span>leads</span></div>
                  <div className="campaign-number"><strong>{number(campaign.qualified_leads_count)}</strong><span>qualificados</span></div>
                  <span className={`status-badge status-${campaign.campaign_status || 'draft'}`}>{STATUS_LABELS[campaign.campaign_status] || 'Rascunho'}</span>
                  {number(campaign.active_jobs) > 0 && <span className="live-dot" title="Job ativo" />}
                  <button className="row-delete" onClick={e => handleDelete(e, campaign.id, campaign.name)} title="Excluir campanha">×</button>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, note, icon, pulse = false }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${pulse ? 'pulse' : ''}`}>{icon}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

function EmptyMini({ text }) {
  return <div className="mini-empty"><span>◌</span><p>{text}</p></div>;
}
