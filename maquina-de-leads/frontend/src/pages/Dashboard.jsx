import { useEffect, useState } from 'react';
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
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível carregar as campanhas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/campaigns', form);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar campanha.');
    } finally { setSaving(false); }
  }

  const totals = campaigns.reduce((acc, c) => ({
    leads: acc.leads + Number(c.leads_total || 0),
    contacted: acc.contacted + Number(c.leads_contatados || 0),
    interested: acc.interested + Number(c.interessados || 0),
    converted: acc.converted + Number(c.convertidos || 0),
  }), { leads: 0, contacted: 0, interested: 0, converted: 0 });

  return (
    <div className="page">
      <header className="topbar">
        <div><h1>Máquina de Leads</h1><span className="hint">Prospecção autônoma sem n8n</span></div>
        <div className="topbar-user"><span>{user?.name}</span><button className="link-btn" onClick={logout}>Sair</button></div>
      </header>

      <div className="metrics-grid">
        <div className="metric"><strong>{campaigns.filter(c => c.status === 'running').length}</strong><span>Campanhas ativas</span></div>
        <div className="metric"><strong>{totals.leads}</strong><span>Leads encontrados</span></div>
        <div className="metric"><strong>{totals.interested}</strong><span>Interessados</span></div>
        <div className="metric"><strong>{totals.converted}</strong><span>Conversões</span></div>
      </div>

      <section className="card">
        <h2>Nova campanha</h2>
        <p className="hint">Informe o objetivo comercial. A estratégia e as palavras-chave são geradas automaticamente e podem ser revisadas antes da execução.</p>
        {error && <div className="error-box">{error}</div>}
        <form className="campaign-form" onSubmit={handleCreate}>
          <input placeholder="Nome da campanha" value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
          <input placeholder="Nicho (ex: clínicas odontológicas)" value={form.niche} onChange={e => setForm({...form, niche:e.target.value})} required />
          <input placeholder="Cidade/região" value={form.location} onChange={e => setForm({...form, location:e.target.value})} />
          <input placeholder="Produto ou serviço oferecido" value={form.offer} onChange={e => setForm({...form, offer:e.target.value})} />
          <textarea rows="3" placeholder="Objetivo da campanha" value={form.objective} onChange={e => setForm({...form, objective:e.target.value})} />
          <button disabled={saving}>{saving ? 'Criando...' : 'Criar e gerar estratégia'}</button>
        </form>
      </section>

      <section>
        <h2>Campanhas</h2>
        {loading ? <p>Carregando...</p> : campaigns.length === 0 ? <p className="empty">Nenhuma campanha criada.</p> : (
          <div className="grid">
            {campaigns.map(c => (
              <Link to={`/campanhas/${c.id}`} key={c.id} className="niche-card">
                <div className="card-title-row"><h3>{c.name}</h3><span className={`badge badge-${c.status}`}>{c.status}</span></div>
                <p>{c.niche}{c.location ? ` • ${c.location}` : ''}</p>
                <div className="campaign-stats"><span>{c.leads_total || 0} leads</span><span>{c.interessados || 0} interessados</span><span>{c.convertidos || 0} conversões</span></div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
