import { useEffect, useState } from 'react';
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

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({ name:'', description:'', location:'', offer:'', targetAudience:'', objective:'' });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await api.get('/niches');
      setCampaigns(res.data.niches || []);
    } finally { setLoading(false); }
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
      await load();
    } catch (err) { alert(err.response?.data?.error || 'Erro ao criar campanha.'); }
    finally { setCreating(false); }
  }

  async function handleDelete(e, id, name) {
    e.preventDefault();
    if (!window.confirm(`Excluir a campanha "${name}"? Todos os leads, jobs e configurações vinculados também serão removidos.`)) return;
    try { await api.delete(`/niches/${id}`); await load(); }
    catch (err) { alert(err.response?.data?.error || 'Erro ao excluir campanha.'); }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div><h1>Máquina de Leads</h1><p className="hint">Campanhas de prospecção executadas pelo motor nativo.</p></div>
        <div className="topbar-user">
          <Link to="/perfil-empresa" className="link-btn">Perfil da empresa</Link>
          <span>{user?.name}</span>
          <button className="link-btn" onClick={logout}>Sair</button>
        </div>
      </header>

      <section className="card">
        <h2>Nova campanha</h2>
        <p className="hint">Defina o perfil comercial agora. Estratégia, leads e execução ficam dentro da campanha.</p>
        <form className="stacked-form" onSubmit={handleCreate}>
          <input placeholder="Nome da campanha *" value={form.name} onChange={e=>change('name',e.target.value)} required />
          <input placeholder="Nicho / descrição curta" value={form.description} onChange={e=>change('description',e.target.value)} />
          <input placeholder="Localização (ex: São Paulo - SP)" value={form.location} onChange={e=>change('location',e.target.value)} />
          <input placeholder="Oferta ou serviço" value={form.offer} onChange={e=>change('offer',e.target.value)} />
          <input placeholder="Público-alvo" value={form.targetAudience} onChange={e=>change('targetAudience',e.target.value)} />
          <textarea placeholder="Objetivo da campanha" value={form.objective} onChange={e=>change('objective',e.target.value)} rows={3} />
          <button type="submit" disabled={creating}>{creating ? 'Criando...' : 'Criar campanha'}</button>
        </form>
      </section>

      <section>
        <h2>Campanhas</h2>
        {loading ? <p>Carregando...</p> : campaigns.length === 0 ? <p className="empty">Nenhuma campanha criada ainda.</p> : (
          <div className="grid">
            {campaigns.map(campaign => (
              <Link to={`/campanhas/${campaign.id}`} key={campaign.id} className="niche-card" style={{position:'relative'}}>
                <h3>{campaign.name}</h3>
                <p>{campaign.description || campaign.offer || 'Sem descrição'}</p>
                {campaign.location && <p className="hint">📍 {campaign.location}</p>}
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
                  <span className={`badge ${campaign.active ? 'badge-active' : 'badge-inactive'}`}>{STATUS_LABELS[campaign.campaign_status] || campaign.campaign_status || 'Rascunho'}</span>
                  <span className="badge">{campaign.leads_count || 0} leads</span>
                  {Number(campaign.active_jobs) > 0 && <span className="badge badge-active">job em execução</span>}
                </div>
                <button onClick={e=>handleDelete(e,campaign.id,campaign.name)} style={{position:'absolute',bottom:10,right:10,background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:4,padding:'4px 8px',cursor:'pointer',fontSize:12}}>Excluir</button>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
