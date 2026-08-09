import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

const TABS = ['Palavras-chave', 'Mensagem', 'Credenciais', 'Agentes', 'Leads'];

export default function NicheDetail() {
  const { id } = useParams();
  const [niche, setNiche] = useState(null);
  const [agents, setAgents] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [tab, setTab] = useState(TABS[0]);

  useEffect(() => {
    api.get(`/niches/${id}`).then((res) => {
      setNiche(res.data.niche);
      setAgents(res.data.agents || []);
      setCredentials(res.data.credentials || []);
    });
  }, [id]);

  if (!niche) return <div className="page">Carregando...</div>;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <Link to="/" className="back-link">← Nichos</Link>
          <h1>{niche.name}</h1>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === 'Palavras-chave' && <KeywordsTab nicheId={id} />}
        {tab === 'Mensagem' && <MessageTab nicheId={id} />}
        {tab === 'Credenciais' && <CredentialsTab nicheId={id} onSaved={(creds) => setCredentials(creds)} />}
        {tab === 'Agentes' && (
          <AgentsTab
            nicheId={id}
            nicheName={niche.name}
            credentials={credentials}
            onTabChange={setTab}
          />
        )}
        {tab === 'Leads' && <LeadsTab nicheId={id} />}
      </div>
    </div>
  );
}

// ------------------- Palavras-chave -------------------
function KeywordsTab({ nicheId }) {
  const [keywords, setKeywords] = useState([]);
  const [bulkText, setBulkText] = useState('');
  const [kind, setKind] = useState('nicho');

  function load() {
    api.get(`/niches/${nicheId}/keywords`).then((res) => setKeywords(res.data.keywords));
  }
  useEffect(load, [nicheId]);

  async function handleAdd(e) {
    e.preventDefault();
    const terms = bulkText.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
    if (terms.length === 0) return;
    await api.post(`/niches/${nicheId}/keywords`, { terms, kind });
    setBulkText('');
    load();
  }

  async function handleRemove(kw) {
    await api.delete(`/niches/${nicheId}/keywords/${kw.id}`);
    load();
  }

  const porTipo = (k) => keywords.filter((kw) => kw.kind === k);

  return (
    <div className="card">
      <h2>Palavras-chave de busca</h2>
      <p className="hint">
        "Nicho" sao os termos principais do seu mercado (ex: "dentista", "clinica odontologica").
        "Contexto" sao termos que aumentam a chance de achar contato (ex: "whatsapp", "agende sua consulta").
      </p>
      <form className="inline-form" onSubmit={handleAdd}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="nicho">Nicho</option>
          <option value="contexto">Contexto</option>
        </select>
        <textarea
          placeholder="Uma palavra por linha ou separada por virgula"
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={3}
        />
        <button type="submit">Adicionar</button>
      </form>

      <h3>Termos de nicho ({porTipo('nicho').length})</h3>
      <div className="chip-list">
        {porTipo('nicho').map((kw) => (
          <span className="chip" key={kw.id}>
            {kw.term} <button onClick={() => handleRemove(kw)}>×</button>
          </span>
        ))}
      </div>

      <h3>Termos de contexto ({porTipo('contexto').length})</h3>
      <div className="chip-list">
        {porTipo('contexto').map((kw) => (
          <span className="chip" key={kw.id}>
            {kw.term} <button onClick={() => handleRemove(kw)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------- Template de mensagem -------------------
function MessageTab({ nicheId }) {
  const [templates, setTemplates] = useState([]);
  const [body, setBody] = useState('');
  const [name, setName] = useState('Padrao');

  function load() {
    api.get(`/niches/${nicheId}/templates`).then((res) => setTemplates(res.data.templates));
  }
  useEffect(load, [nicheId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!body.trim()) return;
    await api.post(`/niches/${nicheId}/templates`, { name, body });
    setBody('');
    load();
  }

  return (
    <div className="card">
      <h2>Mensagem de WhatsApp</h2>
      <p className="hint">Use <code>{'{{nome}}'}</code> para inserir o nome do lead automaticamente.</p>
      <form className="stacked-form" onSubmit={handleCreate}>
        <input placeholder="Nome do template" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          placeholder="Fala, {{nome}}! ..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
        />
        <button type="submit">Salvar template</button>
      </form>

      <h3>Templates cadastrados</h3>
      <ul className="template-list">
        {templates.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong> {t.active && <span className="badge badge-active">ativo</span>}
            <pre>{t.body}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------- Credenciais -------------------
function CredentialsTab({ nicheId, onSaved }) {
  const [credentials, setCredentials] = useState([]);
  const [allNiches, setAllNiches] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [sourceNicheId, setSourceNicheId] = useState('');
  const [importing, setImporting] = useState(false);
  const [provider, setProvider] = useState('serper');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [n8nCredentialId, setN8nCredentialId] = useState('');

  function load() {
    api.get(`/niches/${nicheId}/credentials`).then((res) => {
      setCredentials(res.data.credentials);
      if (onSaved) onSaved(res.data.credentials);
    });
  }

  function loadNiches() {
    api.get('/niches').then((res) => setAllNiches(res.data.niches || []));
  }

  useEffect(() => {
    load();
    loadNiches();
  }, [nicheId]);

  async function handleSave(e) {
    e.preventDefault();
    const extraConfig = {};
    if (instanceName) extraConfig.instanceName = instanceName;
    if (n8nCredentialId) extraConfig.n8nCredentialId = n8nCredentialId;

    await api.put(`/niches/${nicheId}/credentials`, { provider, apiKey, baseUrl, extraConfig });
    setApiKey('');
    setBaseUrl('');
    setInstanceName('');
    setN8nCredentialId('');
    load();
  }

  async function handleImport() {
    if (!sourceNicheId) return;
    setImporting(true);
    try {
      const res = await api.get(`/niches/${sourceNicheId}/credentials`);
      const sourceCreds = res.data.credentials || [];
      for (const cred of sourceCreds) {
        await api.put(`/niches/${nicheId}/credentials`, {
          provider: cred.provider,
          apiKey: cred.api_key,
          baseUrl: cred.base_url,
          extraConfig: cred.extra_config || {},
        });
      }
      load();
      setShowImport(false);
      setSourceNicheId('');
    } catch (err) {
      alert('Erro ao importar credenciais: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  }

  const credMap = Object.fromEntries(credentials.map((c) => [c.provider, c]));

  const n8nCred = credMap['postgres_n8n'];
  const serperCred = credMap['serper'];
  const evoCred = credMap['evolution_api'];

  return (
    <div className="card">
      <h2>Credenciais de integracao</h2>

      {/* Painel dedicado do n8n */}
      <div style={{ marginBottom: '20px', padding: '16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0369a1' }}>🔧 Credencial n8n Postgres</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#0c4a6e' }}>
          Esta credencial e obrigatoria para todos os agentes. Copie o ID da credencial Postgres do seu n8n.
        </p>
        {n8nCred?.extra_config?.n8nCredentialId ? (
          <div style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>
            ✅ Configurado: <code>{n8nCred.extra_config.n8nCredentialId}</code>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 500 }}>
            ❌ Nao configurado
          </div>
        )}
        <form className="inline-form" style={{ marginTop: '10px' }} onSubmit={(e) => {
          e.preventDefault();
          api.put(`/niches/${nicheId}/credentials`, {
            provider: 'postgres_n8n',
            apiKey: null,
            baseUrl: null,
            extraConfig: { n8nCredentialId }
          }).then(() => { setN8nCredentialId(''); load(); });
        }}>
          <input
            placeholder="ID da credencial Postgres no n8n"
            value={n8nCredentialId}
            onChange={(e) => setN8nCredentialId(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit">Salvar n8n</button>
        </form>
      </div>

      {/* Importar de outro nicho */}
      <div style={{ marginBottom: '20px' }}>
        {!showImport ? (
          <button
            onClick={() => setShowImport(true)}
            style={{
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#374151'
            }}
          >
            📥 Importar credenciais de outro nicho
          </button>
        ) : (
          <div style={{ padding: '14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Importar credenciais</h4>
            <select
              value={sourceNicheId}
              onChange={(e) => setSourceNicheId(e.target.value)}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginRight: '8px', minWidth: '200px' }}
            >
              <option value="">Selecione um nicho...</option>
              {allNiches.filter((n) => n.id !== nicheId).map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button
              onClick={handleImport}
              disabled={importing || !sourceNicheId}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: importing ? 'not-allowed' : 'pointer',
                opacity: importing ? 0.6 : 1
              }}
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
            <button
              onClick={() => setShowImport(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                marginLeft: '8px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Status geral */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
        <strong>Status geral:</strong>
        <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { key: 'postgres_n8n', label: 'Postgres n8n', check: (c) => c?.extra_config?.n8nCredentialId },
            { key: 'serper', label: 'Serper API', check: (c) => c?.api_key },
            { key: 'evolution_api', label: 'Evolution API', check: (c) => c?.api_key && c?.base_url },
          ].map((item) => {
            const c = credMap[item.key];
            const ok = item.check(c);
            return (
              <span key={item.key} style={{
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                background: ok ? '#dcfce7' : '#fef2f2',
                color: ok ? '#166534' : '#991b1b',
                border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`
              }}>
                {item.label} {ok ? '✓' : '✗'}
              </span>
            );
          })}
        </div>
      </div>

      {/* Formulario geral */}
      <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Cadastrar / Editar credencial</h3>
      <form className="stacked-form" onSubmit={handleSave}>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="serper">Serper / SerpAPI (busca)</option>
          <option value="evolution_api">Evolution API (WhatsApp)</option>
          <option value="postgres_n8n">Postgres (credencial do n8n)</option>
        </select>
        <input placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <input placeholder="Base URL (se aplicavel)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        {provider === 'evolution_api' && (
          <input
            placeholder="Nome da instancia Evolution"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
          />
        )}
        {provider === 'postgres_n8n' && (
          <input
            placeholder="ID da credencial Postgres no n8n"
            value={n8nCredentialId}
            onChange={(e) => setN8nCredentialId(e.target.value)}
          />
        )}
        <button type="submit">Salvar credencial</button>
      </form>

      <h3>Credenciais cadastradas</h3>
      <ul style={{ fontSize: '13px' }}>
        {credentials.map((c) => (
          <li key={c.id} style={{ marginBottom: '6px' }}>
            <strong>{c.provider}</strong>
            {c.api_key && <span style={{ color: '#166534' }}> — API key configurada</span>}
            {c.base_url && <span style={{ color: '#6b7280' }}> — {c.base_url}</span>}
            {c.extra_config?.n8nCredentialId && (
              <span style={{ color: '#0369a1' }}> — n8n ID: {c.extra_config.n8nCredentialId}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------- Alerta de credenciais -------------------
function CredentialsAlert({ credentials, onGoToCredentials }) {
  const credMap = Object.fromEntries(credentials.map((c) => [c.provider, c]));

  const missing = [];
  if (!credMap['postgres_n8n']?.extra_config?.n8nCredentialId) {
    missing.push({ name: 'Postgres n8n', critical: true, desc: 'Necessario para salvar leads no banco' });
  }
  if (!credMap['serper']?.api_key) {
    missing.push({ name: 'Serper API', critical: false, desc: 'Necessario para agente de raspagem' });
  }
  if (!credMap['evolution_api']?.api_key) {
    missing.push({ name: 'Evolution API', critical: false, desc: 'Necessario para agente de envio' });
  }

  if (missing.length === 0) return null;

  const critical = missing.filter((m) => m.critical);
  const optional = missing.filter((m) => !m.critical);

  return (
    <div style={{
      background: critical.length > 0 ? '#fef2f2' : '#fffbeb',
      border: `1px solid ${critical.length > 0 ? '#fecaca' : '#fde68a'}`,
      borderRadius: '10px',
      padding: '16px 18px',
      marginBottom: '20px',
      fontSize: '14px'
    }}>
      <div style={{
        fontWeight: 600,
        color: critical.length > 0 ? '#991b1b' : '#92400e',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        Credenciais pendentes
      </div>

      <p style={{ margin: '0 0 12px 0', color: critical.length > 0 ? '#7f1d1d' : '#78350f', fontSize: '13px' }}>
        Para criar agentes n8n, configure as credenciais deste nicho primeiro.
      </p>

      {critical.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
            Obrigatorias:
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#7f1d1d', fontSize: '13px' }}>
            {critical.map((c) => (
              <li key={c.name}>{c.name} — <span style={{ opacity: 0.8 }}>{c.desc}</span></li>
            ))}
          </ul>
        </div>
      )}

      {optional.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#b45309', marginBottom: '4px' }}>
            Opcionais (por tipo de agente):
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#78350f', fontSize: '13px' }}>
            {optional.map((c) => (
              <li key={c.name}>{c.name} — <span style={{ opacity: 0.8 }}>{c.desc}</span></li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onGoToCredentials}
        style={{
          background: critical.length > 0 ? '#dc2626' : '#d97706',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          marginTop: '4px'
        }}
      >
        Ir para Credenciais →
      </button>
    </div>
  );
}

// ------------------- Agentes -------------------
function AgentsTab({ nicheId, nicheName, credentials, onTabChange }) {
  const [agents, setAgents] = useState([]);
  const [creating, setCreating] = useState(null);
  const [resyncing, setResyncing] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    api.get(`/niches/${nicheId}/agents`).then((res) => setAgents(res.data.agents));
  }
  useEffect(load, [nicheId]);

  async function handleCreate(agentType) {
    setCreating(agentType);
    setError(null);
    try {
      await api.post(`/niches/${nicheId}/agents`, { agentType });
      load();
    } catch (err) {
      const data = err.response?.data || {};
      setError({
        message: data.error || 'Erro ao criar agente.',
        action: data.action || null,
        missing: data.missing || null,
      });
    } finally {
      setCreating(null);
    }
  }

  async function handleResync(agent) {
    setResyncing(agent.id);
    setError(null);
    try {
      await api.post(`/niches/${nicheId}/agents/${agent.id}/resync`);
      load();
    } catch (err) {
      const data = err.response?.data || {};
      setError({
        message: data.error || 'Erro ao ressincronizar agente.',
        action: data.action || null,
      });
    } finally {
      setResyncing(null);
    }
  }

  async function handleToggle(agent) {
    await api.patch(`/niches/${nicheId}/agents/${agent.id}/active`, { active: !agent.active });
    load();
  }

  async function handleDelete(agent) {
    await api.delete(`/niches/${nicheId}/agents/${agent.id}`);
    load();
  }

  const raspagem = agents.find((a) => a.agent_type === 'raspagem');
  const envio = agents.find((a) => a.agent_type === 'envio');

  return (
    <div className="card">
      <h2>Agentes n8n — {nicheName}</h2>
      <p className="hint">
        Cada agente e um workflow criado automaticamente no n8n a partir da sua configuracao de
        palavras-chave, mensagem e credenciais deste nicho.
      </p>

      {/* Alerta de credenciais pendentes */}
      <CredentialsAlert
        credentials={credentials}
        onGoToCredentials={() => onTabChange('Credenciais')}
      />

      {/* Erro com acao */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '4px' }}>
            {error.message}
          </div>
          {error.action && (
            <div style={{ color: '#7f1d1d', fontSize: '13px', marginBottom: '8px' }}>
              💡 {error.action}
            </div>
          )}
          {error.missing && (
            <button
              onClick={() => onTabChange('Credenciais')}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Configurar {error.missing} →
            </button>
          )}
        </div>
      )}

      <div className="agent-row">
        <AgentBox
          label="Raspagem (scraping de leads)"
          agent={raspagem}
          onCreate={() => handleCreate('raspagem')}
          onResync={() => raspagem && handleResync(raspagem)}
          onToggle={() => raspagem && handleToggle(raspagem)}
          onDelete={() => raspagem && handleDelete(raspagem)}
          creating={creating === 'raspagem'}
          resyncing={resyncing === raspagem?.id}
        />
        <AgentBox
          label="Envio (mensagens WhatsApp)"
          agent={envio}
          onCreate={() => handleCreate('envio')}
          onResync={() => envio && handleResync(envio)}
          onToggle={() => envio && handleToggle(envio)}
          onDelete={() => envio && handleDelete(envio)}
          creating={creating === 'envio'}
          resyncing={resyncing === envio?.id}
        />
      </div>
    </div>
  );
}

function AgentBox({ label, agent, onCreate, onResync, onToggle, onDelete, creating, resyncing }) {
  return (
    <div className="agent-box">
      <h3>{label}</h3>
      {!agent ? (
        <button onClick={onCreate} disabled={creating}>
          {creating ? 'Criando...' : 'Criar agente'}
        </button>
      ) : (
        <>
          <p>Workflow: <code>{agent.n8n_workflow_id || 'Nao sincronizado'}</code></p>
          <span className={`badge ${agent.active ? 'badge-active' : 'badge-inactive'}`}>
            {agent.active ? 'Ativo' : 'Inativo'}
          </span>
          <div className="agent-actions">
            <button onClick={onToggle}>{agent.active ? 'Desativar' : 'Ativar'}</button>
            <button onClick={onResync} disabled={resyncing}>
              {resyncing ? 'Sincronizando...' : 'Ressincronizar'}
            </button>
            <button className="danger" onClick={onDelete}>Remover</button>
          </div>
        </>
      )}
    </div>
  );
}

// ------------------- Leads -------------------
function LeadsTab({ nicheId }) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState([]);
  const [status, setStatus] = useState('');

  function load() {
    api.get(`/niches/${nicheId}/leads`, { params: { status: status || undefined } }).then((res) => setLeads(res.data.leads));
    api.get(`/niches/${nicheId}/leads/stats`).then((res) => setStats(res.data.stats));
  }
  useEffect(load, [nicheId, status]);

  return (
    <div className="card">
      <h2>Leads</h2>
      <div className="stats-row">
        {stats.map((s) => (
          <div key={s.status} className="stat-pill">
            <strong>{s.total}</strong> {s.status}
          </div>
        ))}
      </div>

      <div className="filter-row">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="erro">Erro</option>
        </select>
      </div>

      <table className="leads-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>WhatsApp</th>
            <th>Status</th>
            <th>Fonte</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id}>
              <td>{l.nome_perfil}</td>
              <td>{l.whatsapp}</td>
              <td>{l.status}</td>
              <td><a href={l.fonte_url} target="_blank" rel="noreferrer">link</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
