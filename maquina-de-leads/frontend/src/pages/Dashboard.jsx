import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', niche: '', location: '', offer: '', objective: '' };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data.campaigns || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível carregar as campanhas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/campaigns', form);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar campanha.');
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => campaigns.reduce((acc, c) => ({
    leads: acc.leads + Number(c.leads_total || 0),
    contacted: acc.contacted + Number(c.leads_contatados || 0),
    interested: acc.interested + Number(c.interessados || 0),
    converted: acc.converted + Number(c.convertidos || 0),
  }), { leads: 0, contacted: 0, interested: 0, converted: 0 }), [campaigns]);

  const activeCampaigns = campaigns.filter(c => ['ready', 'running'].includes(c.status)).length;
  const conversionRate = totals.leads > 0 ? Math.round((totals.converted / totals.leads) * 100) : 0;

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">MÁQUINA DE LEADS</span>
          <h1>Seu painel de prospecção</h1>
          <p>Crie campanhas, acompanhe leads e evolua oportunidades em um só lugar.</p>
        </div>
        <div className="dashboard-user">
          <div className="user-avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="user-copy">
            <strong>{user?.name || 'Usuário'}</strong>
            <span>Conta ativa</span>
          </div>
          <Link className="ghost-button" to="/instagram-automatico">Instagram Automático</Link>
          <Link className="ghost-button" to="/relatorios">Relatórios</Link>
          <button className="ghost-button" onClick={logout}>Sair</button>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <span className="hero-kicker">PROSPECÇÃO AUTÔNOMA</span>
          <h2>Transforme um objetivo comercial em campanha, estratégia e leads.</h2>
          <p>Defina o nicho, a região e sua oferta. A Máquina de Leads prepara a estratégia e organiza o funil para você.</p>
        </div>
        <div className="hero-status">
          <span className="status-dot" />
          <div>
            <strong>Sistema operacional</strong>
            <span>API, banco e motor nativo conectados</span>
          </div>
        </div>
      </section>

      <section className="metric-grid dashboard-metrics">
        <article className="metric-card"><span>Campanhas ativas</span><strong>{activeCampaigns}</strong><small>{campaigns.length} no total</small></article>
        <article className="metric-card"><span>Leads encontrados</span><strong>{totals.leads}</strong><small>{totals.contacted} contatados</small></article>
        <article className="metric-card"><span>Interessados</span><strong>{totals.interested}</strong><small>no funil atual</small></article>
        <article className="metric-card"><span>Conversões</span><strong>{totals.converted}</strong><small>{conversionRate}% de conversão</small></article>
      </section>

      <section className="dashboard-grid">
        <article className="card campaign-create-card">
          <div className="section-heading"><div><span className="eyebrow">NOVA CAMPANHA</span><h2>Comece pela oportunidade</h2></div><span className="step-pill">Etapa 1 de 3</span></div>
          <p className="section-copy">Preencha as informações abaixo. A estratégia inicial e as palavras-chave serão montadas automaticamente e poderão ser revisadas antes da execução.</p>
          {error && <div className="error-box">{error}</div>}
          <form className="campaign-form dashboard-form" onSubmit={handleCreate}>
            <div className="field-group"><label>Nome da campanha</label><input placeholder="Ex.: Software sob medida para indústrias" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required /></div>
            <div className="field-group"><label>Nicho</label><input placeholder="Ex.: indústrias, clínicas, imobiliárias" value={form.niche} onChange={e => setForm({...form, niche:e.target.value})} required /></div>
            <div className="field-group"><label>Cidade ou região</label><input placeholder="Ex.: São Paulo" value={form.location} onChange={e => setForm({...form, location:e.target.value})} /></div>
            <div className="field-group"><label>Produto ou serviço</label><input placeholder="Ex.: desenvolvimento de software" value={form.offer} onChange={e => setForm({...form, offer:e.target.value})} /></div>
            <div className="field-group field-wide"><label>Objetivo comercial</label><textarea rows="5" placeholder="Descreva o perfil de cliente ideal, sua oferta e o resultado que deseja alcançar." value={form.objective} onChange={e => setForm({...form, objective:e.target.value})} /></div>
            <button className="primary-action field-wide" disabled={saving}>{saving ? 'Criando campanha...' : 'Criar e gerar estratégia'}</button>
          </form>
        </article>

        <aside className="card quick-guide-card">
          <span className="eyebrow">COMO FUNCIONA</span><h2>Fluxo simples, com controle.</h2>
          <div className="guide-step"><span>1</span><div><strong>Defina a campanha</strong><p>Informe nicho, região, oferta e objetivo.</p></div></div>
          <div className="guide-step"><span>2</span><div><strong>Revise a estratégia</strong><p>Ajuste palavras-chave e mensagem antes de executar.</p></div></div>
          <div className="guide-step"><span>3</span><div><strong>Execute e acompanhe</strong><p>Os leads entram no funil e ficam organizados por etapa.</p></div></div>
        </aside>
      </section>

      <section className="campaigns-section">
        <div className="section-heading"><div><span className="eyebrow">CAMPANHAS</span><h2>Operações em andamento</h2></div><span className="count-pill">{campaigns.length}</span></div>
        {loading ? <div className="empty-state">Carregando campanhas...</div> : campaigns.length === 0 ? <div className="empty-state"><strong>Nenhuma campanha criada ainda.</strong><span>Crie a primeira campanha acima para começar a prospecção.</span></div> : <div className="campaign-grid">{campaigns.map(c => <Link to={`/campanhas/${c.id}`} key={c.id} className="campaign-card"><div className="campaign-card-top"><div><span className="campaign-label">{c.niche}</span><h3>{c.name}</h3></div><span className={`badge badge-${c.status}`}>{c.status}</span></div><p>{c.location || 'Região não definida'}{c.offer ? ` • ${c.offer}` : ''}</p><div className="campaign-stat-grid"><span><strong>{c.leads_total || 0}</strong> leads</span><span><strong>{c.interessados || 0}</strong> interessados</span><span><strong>{c.convertidos || 0}</strong> conversões</span></div><span className="campaign-open">Abrir campanha →</span></Link>)}</div>}
      </section>
    </div>
  );
}
