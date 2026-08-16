import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import LeadsManager from '../components/LeadsManager';

const TABS = ['Visão geral', 'Estratégia', 'Leads', 'Execução', 'Integrações'];

const JOB_LABELS = {
  'campaign.discover_leads': 'Descoberta de leads',
  'campaign.enrich_leads': 'Enriquecimento',
  'campaign.send_messages': 'Envio de mensagens',
};

const STATUS_LABELS = {
  pending: 'Pendente',
  processing: 'Processando',
  retry: 'Nova tentativa',
  completed: 'Concluído',
  failed: 'Falhou',
};

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [leadStats, setLeadStats] = useState({});
  const [tab, setTab] = useState(TABS[0]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/niches/${id}`);
      setCampaign(res.data.niche);
      setCredentials(res.data.credentials || []);
      setJobs(res.data.jobs || []);
      setLeadStats(res.data.leadStats || {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading && !campaign) return <div className="page">Carregando campanha...</div>;
  if (!campaign) return <div className="page">Campanha não encontrada.</div>;

  return (
    <div className="page">
      <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link to="/" className="back-link">← Campanhas</Link>
          <h1>{campaign.name}</h1>
          <p className="hint">{campaign.description || campaign.objective || 'Campanha de prospecção'}</p>
        </div>
        <span className="badge badge-active">{campaign.campaign_status || 'draft'}</span>
      </header>

      <nav className="tabs">
        {TABS.map((item) => (
          <button key={item} className={item === tab ? 'tab active' : 'tab'} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === 'Visão geral' && (
          <OverviewTab campaign={campaign} leadStats={leadStats} onSaved={load} />
        )}
        {tab === 'Estratégia' && <StrategyTab campaignId={id} />}
        {tab === 'Leads' && <LeadsManager nicheId={id} />}
        {tab === 'Execução' && (
          <ExecutionTab campaignId={id} jobs={jobs} leadStats={leadStats} onChanged={load} />
        )}
        {tab === 'Integrações' && (
          <IntegrationsTab campaignId={id} credentials={credentials} onChanged={load} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ campaign, leadStats, onSaved }) {
  const [form, setForm] = useState({
    name: campaign.name || '',
    description: campaign.description || '',
    location: campaign.location || '',
    offer: campaign.offer || '',
    targetAudience: campaign.target_audience || '',
    objective: campaign.objective || '',
  });
  const [saving, setSaving] = useState(false);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/niches/${campaign.id}`, form);
      await onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar campanha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid" style={{ marginBottom: 20 }}>
        <Metric label="Leads" value={leadStats.total || 0} />
        <Metric label="Com WhatsApp" value={leadStats.com_whatsapp || 0} />
        <Metric label="Pendentes" value={leadStats.pendentes || 0} />
        <Metric label="Enviados" value={leadStats.enviados || 0} />
      </div>

      <section className="card">
        <h2>Perfil da campanha</h2>
        <form className="stacked-form" onSubmit={save}>
          <input value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="Nome" required />
          <input value={form.description} onChange={(e) => change('description', e.target.value)} placeholder="Nicho / descrição" />
          <input value={form.location} onChange={(e) => change('location', e.target.value)} placeholder="Localização" />
          <input value={form.offer} onChange={(e) => change('offer', e.target.value)} placeholder="Oferta ou serviço" />
          <input value={form.targetAudience} onChange={(e) => change('targetAudience', e.target.value)} placeholder="Público-alvo" />
          <textarea value={form.objective} onChange={(e) => change('objective', e.target.value)} placeholder="Objetivo" rows={4} />
          <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar perfil'}</button>
        </form>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="card">
      <div className="hint">{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function StrategyTab({ campaignId }) {
  const [keywords, setKeywords] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [termText, setTermText] = useState('');
  const [kind, setKind] = useState('nicho');
  const [message, setMessage] = useState('');

  async function load() {
    const [keywordsRes, templatesRes] = await Promise.all([
      api.get(`/niches/${campaignId}/keywords`),
      api.get(`/niches/${campaignId}/templates`),
    ]);
    setKeywords(keywordsRes.data.keywords || []);
    setTemplates(templatesRes.data.templates || []);
  }

  useEffect(() => {
    load();
  }, [campaignId]);

  async function addKeywords(e) {
    e.preventDefault();
    const terms = termText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    if (!terms.length) return;
    await api.post(`/niches/${campaignId}/keywords`, { terms, kind });
    setTermText('');
    await load();
  }

  async function removeKeyword(id) {
    await api.delete(`/niches/${campaignId}/keywords/${id}`);
    await load();
  }

  async function saveMessage(e) {
    e.preventDefault();
    if (!message.trim()) return;
    const created = await api.post(`/niches/${campaignId}/templates`, { name: 'Mensagem principal', body: message });
    const templateId = created.data.template?.id;
    if (templateId) {
      await Promise.all(
        templates.filter((item) => item.active).map((item) =>
          api.put(`/niches/${campaignId}/templates/${item.id}`, { active: false })
        )
      );
      await api.put(`/niches/${campaignId}/templates/${templateId}`, { active: true });
    }
    setMessage('');
    await load();
  }

  const principal = keywords.filter((item) => item.kind === 'nicho');
  const contexto = keywords.filter((item) => item.kind === 'contexto');
  const activeTemplate = templates.find((item) => item.active);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <h2>Termos de descoberta</h2>
        <p className="hint">Os termos principais definem quem procurar. Contexto aumenta a chance de encontrar telefone ou WhatsApp.</p>
        <form className="inline-form" onSubmit={addKeywords}>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="nicho">Principal</option>
            <option value="contexto">Contexto</option>
          </select>
          <textarea value={termText} onChange={(e) => setTermText(e.target.value)} rows={3} placeholder="Um termo por linha ou separado por vírgula" />
          <button type="submit">Adicionar</button>
        </form>
        <h3>Principais</h3>
        <div className="chip-list">
          {principal.map((item) => <span className="chip" key={item.id}>{item.term} <button onClick={() => removeKeyword(item.id)}>×</button></span>)}
        </div>
        <h3>Contexto</h3>
        <div className="chip-list">
          {contexto.map((item) => <span className="chip" key={item.id}>{item.term} <button onClick={() => removeKeyword(item.id)}>×</button></span>)}
        </div>
      </section>

      <section className="card">
        <h2>Mensagem inicial</h2>
        <p className="hint">Use <code>{'{{nome}}'}</code> para personalizar o contato.</p>
        {activeTemplate && (
          <div style={{ marginBottom: 16 }}>
            <strong>Mensagem ativa</strong>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{activeTemplate.body}</pre>
          </div>
        )}
        <form className="stacked-form" onSubmit={saveMessage}>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Olá, {{nome}}! ..." />
          <button type="submit">Salvar como mensagem ativa</button>
        </form>
      </section>
    </div>
  );
}

function ExecutionTab({ campaignId, jobs, leadStats, onChanged }) {
  const [running, setRunning] = useState('');

  async function run(type) {
    setRunning(type);
    try {
      const endpoints = {
        discover: `/niches/${campaignId}/native/discover`,
        enrich: `/niches/${campaignId}/native/enrich`,
        send: `/niches/${campaignId}/native/send`,
      };
      await api.post(endpoints[type], {});
      await onChanged();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao iniciar execução.');
    } finally {
      setRunning('');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <h2>Motor nativo</h2>
        <p className="hint">Este fluxo roda diretamente no backend e no worker. Não depende de n8n.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => run('discover')} disabled={Boolean(running)}>1. Descobrir leads</button>
          <button onClick={() => run('enrich')} disabled={Boolean(running) || Number(leadStats.total || 0) === 0}>2. Enriquecer</button>
          <button onClick={() => run('send')} disabled={Boolean(running) || Number(leadStats.pendentes || 0) === 0}>3. Enviar mensagens</button>
        </div>
      </section>

      <section className="card">
        <h2>Histórico de execução</h2>
        {jobs.length === 0 ? (
          <p className="empty">Nenhuma execução registrada.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th align="left">Ação</th><th align="left">Status</th><th align="left">Tentativas</th><th align="left">Criado</th><th align="left">Erro</th></tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{JOB_LABELS[job.job_type] || job.job_type}</td>
                    <td>{STATUS_LABELS[job.status] || job.status}</td>
                    <td>{job.attempts}/{job.max_attempts}</td>
                    <td>{new Date(job.created_at).toLocaleString('pt-BR')}</td>
                    <td>{job.last_error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function IntegrationsTab({ campaignId, credentials, onChanged }) {
  const [serperKey, setSerperKey] = useState('');
  const [evolutionKey, setEvolutionKey] = useState('');
  const [evolutionUrl, setEvolutionUrl] = useState('http://host.docker.internal:8081');
  const [instance, setInstance] = useState('');

  const byProvider = Object.fromEntries(credentials.map((item) => [item.provider, item]));

  async function saveSerper(e) {
    e.preventDefault();
    await api.put(`/niches/${campaignId}/credentials`, {
      provider: 'serper',
      apiKey: serperKey,
      baseUrl: null,
      extraConfig: {},
    });
    setSerperKey('');
    await onChanged();
  }

  async function saveEvolution(e) {
    e.preventDefault();
    await api.put(`/niches/${campaignId}/credentials`, {
      provider: 'evolution_api',
      apiKey: evolutionKey,
      baseUrl: evolutionUrl,
      extraConfig: { instance },
    });
    setEvolutionKey('');
    await onChanged();
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <h2>Descoberta</h2>
        <p className="hint">SearXNG já faz parte da infraestrutura. Serper é opcional e aumenta cobertura.</p>
        <p>Status Serper: <strong>{byProvider.serper?.has_api_key ? 'configurado' : 'não configurado'}</strong></p>
        <form className="stacked-form" onSubmit={saveSerper}>
          <input type="password" value={serperKey} onChange={(e) => setSerperKey(e.target.value)} placeholder="API key Serper" />
          <button type="submit">Salvar Serper</button>
        </form>
      </section>

      <section className="card">
        <h2>WhatsApp</h2>
        <p>Status Evolution API: <strong>{byProvider.evolution_api?.has_api_key && byProvider.evolution_api?.base_url ? 'configurada' : 'não configurada'}</strong></p>
        <form className="stacked-form" onSubmit={saveEvolution}>
          <input value={evolutionUrl} onChange={(e) => setEvolutionUrl(e.target.value)} placeholder="URL da Evolution API" />
          <input type="password" value={evolutionKey} onChange={(e) => setEvolutionKey(e.target.value)} placeholder="API key" />
          <input value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="Nome da instância" />
          <button type="submit">Salvar Evolution API</button>
        </form>
      </section>
    </div>
  );
}
