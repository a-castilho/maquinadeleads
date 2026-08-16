import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import LeadsManager from '../components/LeadsManager';

const TABS = ['Campanha', 'Estratégia', 'Leads', 'Preparação', 'Funil', 'Execução', 'Integrações'];

const JOB_LABELS = {
  'campaign.discover_leads': 'Descoberta de leads',
  'campaign.enrich_leads': 'Enriquecimento',
  'campaign.score_leads': 'Scoring de leads',
  'campaign.send_messages': 'Envio de mensagens',
  'campaign.process_batch': 'Processamento da campanha',
};

const JOB_STATUS_LABELS = {
  pending: 'Pendente',
  processing: 'Processando',
  retry: 'Nova tentativa',
  completed: 'Concluído',
  failed: 'Falhou',
};

const CAMPAIGN_STATUS_LABELS = {
  draft: 'Rascunho',
  preparing: 'Preparando',
  ready: 'Pronta',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  failed: 'Com erro',
};

const FUNNEL_LABELS = {
  discovered: 'Descobertos',
  qualified: 'Qualificados',
  ready_for_contact: 'Prontos para contato',
  contacted: 'Contatados',
  responded: 'Responderam',
  interested: 'Interessados',
  converted: 'Convertidos',
  discarded: 'Descartados',
};

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [leadStats, setLeadStats] = useState({});
  const [readiness, setReadiness] = useState({});
  const [tab, setTab] = useState(TABS[0]);
  const [loading, setLoading] = useState(true);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/niches/${id}`);
      setCampaign(res.data.niche);
      setCredentials(res.data.credentials || []);
      setJobs(res.data.jobs || []);
      setLeadStats(res.data.leadStats || {});
      setReadiness(res.data.readiness || {});
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const hasActiveJob = jobs.some((job) => ['pending', 'processing', 'retry'].includes(job.status));
  useEffect(() => {
    if (!hasActiveJob) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveJob, id]);

  async function lifecycle(action) {
    setLifecycleBusy(true);
    try {
      await api.post(`/niches/${id}/native/${action}`, {});
      await load({ silent: true });
    } catch (err) {
      alert(err.response?.data?.error || `Erro ao executar ${action}.`);
    } finally {
      setLifecycleBusy(false);
    }
  }

  if (loading && !campaign) return <div className="page">Carregando campanha...</div>;
  if (!campaign) return <div className="page">Campanha não encontrada.</div>;

  return (
    <div className="page">
      <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
        <div>
          <Link to="/" className="back-link">← Campanhas</Link>
          <h1>{campaign.name}</h1>
          <p className="hint">{campaign.description || campaign.objective || 'Campanha de prospecção'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`badge ${campaign.campaign_status === 'running' ? 'badge-active' : 'badge-inactive'}`}>
            {CAMPAIGN_STATUS_LABELS[campaign.campaign_status] || campaign.campaign_status}
          </span>
          {campaign.campaign_status === 'running' && (
            <button disabled={lifecycleBusy} onClick={() => lifecycle('pause')}>Pausar</button>
          )}
          {campaign.campaign_status === 'paused' && (
            <button disabled={lifecycleBusy} onClick={() => lifecycle('resume')}>Retomar</button>
          )}
        </div>
      </header>

      <WizardHeader readiness={readiness} campaignStatus={campaign.campaign_status} onNavigate={setTab} />

      <nav className="tabs" style={{ overflowX: 'auto' }}>
        {TABS.map((item) => (
          <button key={item} className={item === tab ? 'tab active' : 'tab'} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === 'Campanha' && (
          <OverviewTab campaign={campaign} leadStats={leadStats} onSaved={() => load({ silent: true })} />
        )}
        {tab === 'Estratégia' && (
          <StrategyTab campaignId={id} onChanged={() => load({ silent: true })} />
        )}
        {tab === 'Leads' && <LeadsManager nicheId={id} />}
        {tab === 'Preparação' && (
          <PreparationTab
            campaign={campaign}
            readiness={readiness}
            leadStats={leadStats}
            busy={lifecycleBusy}
            setBusy={setLifecycleBusy}
            onChanged={() => load({ silent: true })}
          />
        )}
        {tab === 'Funil' && <FunnelTab leadStats={leadStats} />}
        {tab === 'Execução' && (
          <ExecutionTab
            campaign={campaign}
            jobs={jobs}
            leadStats={leadStats}
            onChanged={() => load({ silent: true })}
          />
        )}
        {tab === 'Integrações' && (
          <IntegrationsTab campaignId={id} credentials={credentials} onChanged={() => load({ silent: true })} />
        )}
      </div>
    </div>
  );
}

function WizardHeader({ readiness, campaignStatus, onNavigate }) {
  const steps = [
    { number: 1, label: 'Campanha', done: readiness.profileComplete, tab: 'Campanha' },
    { number: 2, label: 'Estratégia', done: readiness.hasKeywords && readiness.hasMessage, tab: 'Estratégia' },
    { number: 3, label: 'Leads', done: readiness.hasLeads, tab: 'Leads' },
    { number: 4, label: 'Preparação', done: readiness.hasScoredLeads && readiness.hasEvolution, tab: 'Preparação' },
    { number: 5, label: 'Ativação', done: ['running', 'paused', 'completed'].includes(campaignStatus), tab: 'Preparação' },
  ];

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {steps.map((step) => (
          <button
            key={step.number}
            type="button"
            onClick={() => onNavigate(step.tab)}
            style={{
              textAlign: 'left',
              padding: 12,
              border: `1px solid ${step.done ? '#86efac' : '#e2e8f0'}`,
              background: step.done ? '#f0fdf4' : '#fff',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.65 }}>ETAPA {step.number}</div>
            <strong>{step.done ? '✓ ' : ''}{step.label}</strong>
          </button>
        ))}
      </div>
    </section>
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
    minLeadScore: campaign.min_lead_score ?? 55,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: campaign.name || '',
      description: campaign.description || '',
      location: campaign.location || '',
      offer: campaign.offer || '',
      targetAudience: campaign.target_audience || '',
      objective: campaign.objective || '',
      minLeadScore: campaign.min_lead_score ?? 55,
    });
  }, [campaign]);

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
        <Metric label="Qualificados" value={leadStats.qualified || 0} />
        <Metric label="Score médio" value={leadStats.average_score || 0} />
        <Metric label="Contatados" value={leadStats.contacted || leadStats.enviados || 0} />
      </div>

      <section className="card">
        <h2>Perfil da campanha</h2>
        <p className="hint">Essas informações orientam descoberta e qualificação. O score mínimo define quem pode entrar na fila de contato.</p>
        <form className="stacked-form" onSubmit={save}>
          <input value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="Nome da campanha" required />
          <input value={form.description} onChange={(e) => change('description', e.target.value)} placeholder="Nicho / descrição" />
          <input value={form.location} onChange={(e) => change('location', e.target.value)} placeholder="Cidade / região" />
          <input value={form.offer} onChange={(e) => change('offer', e.target.value)} placeholder="Oferta ou serviço" />
          <input value={form.targetAudience} onChange={(e) => change('targetAudience', e.target.value)} placeholder="Público-alvo" />
          <textarea value={form.objective} onChange={(e) => change('objective', e.target.value)} placeholder="Objetivo da campanha" rows={4} />
          <label>
            Score mínimo para contato: <strong>{form.minLeadScore}</strong>
            <input type="range" min="0" max="100" step="5" value={form.minLeadScore} onChange={(e) => change('minLeadScore', Number(e.target.value))} style={{ width: '100%' }} />
          </label>
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

function StrategyTab({ campaignId, onChanged }) {
  const [keywords, setKeywords] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [termText, setTermText] = useState('');
  const [kind, setKind] = useState('nicho');
  const [message, setMessage] = useState('');
  const [savingMessage, setSavingMessage] = useState(false);

  async function load() {
    const [keywordsRes, templatesRes] = await Promise.all([
      api.get(`/niches/${campaignId}/keywords`),
      api.get(`/niches/${campaignId}/templates`),
    ]);
    const nextKeywords = keywordsRes.data.keywords || [];
    const nextTemplates = templatesRes.data.templates || [];
    setKeywords(nextKeywords);
    setTemplates(nextTemplates);
    const active = nextTemplates.find((item) => item.active);
    if (active) setMessage(active.body || '');
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
    await onChanged();
  }

  async function removeKeyword(id) {
    await api.delete(`/niches/${campaignId}/keywords/${id}`);
    await load();
    await onChanged();
  }

  async function saveMessage(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSavingMessage(true);
    try {
      const activeTemplate = templates.find((item) => item.active);
      if (activeTemplate) {
        await api.put(`/niches/${campaignId}/templates/${activeTemplate.id}`, { body: message.trim(), active: true });
      } else {
        await api.post(`/niches/${campaignId}/templates`, { name: 'Mensagem principal', body: message.trim() });
      }
      await load();
      await onChanged();
    } finally {
      setSavingMessage(false);
    }
  }

  const principal = keywords.filter((item) => item.kind === 'nicho');
  const contexto = keywords.filter((item) => item.kind === 'contexto');

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <h2>Termos de descoberta</h2>
        <p className="hint">Termos principais definem quem procurar. Termos de contexto aumentam a chance de encontrar dados de contato.</p>
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
          {!principal.length && <span className="hint">Nenhum termo principal.</span>}
        </div>
        <h3>Contexto</h3>
        <div className="chip-list">
          {contexto.map((item) => <span className="chip" key={item.id}>{item.term} <button onClick={() => removeKeyword(item.id)}>×</button></span>)}
        </div>
      </section>

      <section className="card">
        <h2>Mensagem inicial</h2>
        <p className="hint">Use <code>{'{{nome}}'}</code> para inserir o primeiro nome do lead.</p>
        <form className="stacked-form" onSubmit={saveMessage}>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} placeholder="Olá, {{nome}}! ..." />
          <button type="submit" disabled={savingMessage}>{savingMessage ? 'Salvando...' : 'Salvar mensagem ativa'}</button>
        </form>
      </section>
    </div>
  );
}

function PreparationTab({ campaign, readiness, leadStats, busy, setBusy, onChanged }) {
  const checklist = [
    ['Perfil da campanha', readiness.profileComplete],
    ['Palavras-chave', readiness.hasKeywords],
    ['Mensagem inicial', readiness.hasMessage],
    ['Prévia de leads', readiness.hasLeads],
    ['Leads avaliados por score', readiness.hasScoredLeads],
    ['Leads acima do score mínimo', readiness.hasQualifiedLeads],
    ['WhatsApp / Evolution API', readiness.hasEvolution],
  ];

  async function action(endpoint, body = {}) {
    setBusy(true);
    try {
      const res = await api.post(`/niches/${campaign.id}/native/${endpoint}`, body);
      if (res.data?.message) alert(res.data.message);
      await onChanged();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao executar ação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <h2>Checklist antes da ativação</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {checklist.map(([label, done]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{label}</span>
              <strong style={{ color: done ? '#15803d' : '#b45309' }}>{done ? '✓ pronto' : 'pendente'}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Qualificação</h2>
        <p className="hint">Score mínimo: <strong>{campaign.min_lead_score ?? 55}</strong>. O score usa contato disponível, enriquecimento, identificação, presença digital, termos da campanha e localização.</p>
        <div className="grid" style={{ marginBottom: 16 }}>
          <Metric label="Avaliados" value={leadStats.scored || 0} />
          <Metric label="Qualificados" value={leadStats.qualified || 0} />
          <Metric label="Score médio" value={leadStats.average_score || 0} />
          <Metric label="Pendência ambígua" value={leadStats.outbox_unknown || 0} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button disabled={busy || !readiness.hasLeads} onClick={() => action('score', { batchSize: 500, force: true })}>
            {busy ? 'Processando...' : 'Recalcular scores'}
          </button>
          <button disabled={busy || !readiness.readyToActivate || !readiness.hasScoredLeads || !readiness.hasQualifiedLeads || campaign.campaign_status === 'running'} onClick={() => action('activate', { sendBatchSize: 25 })}>
            Ativar campanha
          </button>
        </div>
        {!readiness.hasQualifiedLeads && readiness.hasScoredLeads && (
          <p className="hint" style={{ marginTop: 12 }}>Nenhum lead atingiu o score mínimo. Ajuste o score no perfil ou revise os leads antes de ativar.</p>
        )}
      </section>
    </div>
  );
}

function FunnelTab({ leadStats }) {
  const funnel = [
    ['discovered', leadStats.discovered || 0],
    ['qualified', leadStats.funnel_qualified || 0],
    ['ready_for_contact', leadStats.ready_for_contact || 0],
    ['contacted', leadStats.contacted || 0],
    ['responded', leadStats.responded || 0],
    ['interested', leadStats.interested || 0],
    ['converted', leadStats.converted || 0],
    ['discarded', leadStats.discarded || 0],
  ];
  const max = Math.max(1, ...funnel.map(([, value]) => Number(value || 0)));

  return (
    <section className="card">
      <h2>Funil da campanha</h2>
      <p className="hint">As etapas comerciais podem ser atualizadas na ficha do lead. O envio nativo move automaticamente o lead para Contatado.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {funnel.map(([stage, value]) => (
          <div key={stage}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{FUNNEL_LABELS[stage]}</span>
              <strong>{value}</strong>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(2, (Number(value || 0) / max) * 100)}%`, background: '#2563eb' }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExecutionTab({ campaign, jobs, leadStats, onChanged }) {
  const [running, setRunning] = useState('');

  async function run(type, body = {}) {
    setRunning(type);
    try {
      await api.post(`/niches/${campaign.id}/native/${type}`, body);
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
        <p className="hint">Descoberta e enriquecimento preparam os dados. Depois da ativação, Processar próximo lote recalcula scores alterados e envia somente aos leads qualificados.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => run('discover', { maxQueries: 50 })} disabled={Boolean(running) || ['paused', 'completed', 'failed'].includes(campaign.campaign_status)}>Descobrir leads</button>
          <button onClick={() => run('enrich', { batchSize: 25 })} disabled={Boolean(running) || Number(leadStats.total || 0) === 0 || ['paused', 'completed', 'failed'].includes(campaign.campaign_status)}>Enriquecer lote</button>
          <button onClick={() => run('score', { batchSize: 500 })} disabled={Boolean(running) || Number(leadStats.total || 0) === 0 || ['paused', 'completed', 'failed'].includes(campaign.campaign_status)}>Avaliar scores</button>
          <button onClick={() => run('process', { sendBatchSize: 25 })} disabled={Boolean(running) || campaign.campaign_status !== 'running'}>Processar próximo lote</button>
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
                  <tr key={job.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '9px 4px' }}>{JOB_LABELS[job.job_type] || job.job_type}</td>
                    <td>{JOB_STATUS_LABELS[job.status] || job.status}</td>
                    <td>{job.attempts}/{job.max_attempts}</td>
                    <td>{new Date(job.created_at).toLocaleString('pt-BR')}</td>
                    <td style={{ maxWidth: 320 }}>{job.last_error || '—'}</td>
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
  const byProvider = useMemo(() => Object.fromEntries(credentials.map((item) => [item.provider, item])), [credentials]);
  const [serperKey, setSerperKey] = useState('');
  const [evolutionKey, setEvolutionKey] = useState('');
  const [evolutionUrl, setEvolutionUrl] = useState('http://host.docker.internal:8081');
  const [instance, setInstance] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (byProvider.evolution_api?.base_url) setEvolutionUrl(byProvider.evolution_api.base_url);
    const existingInstance = byProvider.evolution_api?.extra_config?.instanceName || byProvider.evolution_api?.extra_config?.instance;
    if (existingInstance) setInstance(existingInstance);
  }, [byProvider.evolution_api?.base_url, byProvider.evolution_api?.extra_config]);

  async function saveSerper(e) {
    e.preventDefault();
    if (!serperKey.trim()) return;
    setSaving(true);
    try {
      await api.put(`/niches/${campaignId}/credentials`, { provider: 'serper', apiKey: serperKey.trim() });
      setSerperKey('');
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function saveEvolution(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/niches/${campaignId}/credentials`, {
        provider: 'evolution_api',
        apiKey: evolutionKey.trim() || undefined,
        baseUrl: evolutionUrl.trim(),
        extraConfig: { instance: instance.trim() },
      });
      setEvolutionKey('');
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <h2>Descoberta</h2>
        <p className="hint">SearXNG já faz parte da infraestrutura. Serper é opcional e aumenta a cobertura das buscas.</p>
        <p>Status Serper: <strong>{byProvider.serper?.has_api_key ? 'configurado' : 'não configurado'}</strong></p>
        <form className="stacked-form" onSubmit={saveSerper}>
          <input type="password" value={serperKey} onChange={(e) => setSerperKey(e.target.value)} placeholder="Nova API key Serper" />
          <button type="submit" disabled={saving || !serperKey.trim()}>Salvar Serper</button>
        </form>
      </section>

      <section className="card">
        <h2>WhatsApp</h2>
        <p>Status Evolution API: <strong>{byProvider.evolution_api?.has_api_key && byProvider.evolution_api?.base_url ? 'configurada' : 'não configurada'}</strong></p>
        <form className="stacked-form" onSubmit={saveEvolution}>
          <input value={evolutionUrl} onChange={(e) => setEvolutionUrl(e.target.value)} placeholder="URL da Evolution API" />
          <input type="password" value={evolutionKey} onChange={(e) => setEvolutionKey(e.target.value)} placeholder={byProvider.evolution_api?.has_api_key ? 'Deixe vazio para manter a API key atual' : 'API key'} />
          <input value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="Nome da instância" />
          <button type="submit" disabled={saving || !evolutionUrl.trim()}>Salvar Evolution API</button>
        </form>
      </section>
    </div>
  );
}
