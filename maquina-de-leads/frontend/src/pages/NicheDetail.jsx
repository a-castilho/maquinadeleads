import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

const TABS = ['Palavras-chave', 'Mensagem', 'Credenciais', 'Agentes', 'Leads'];

export default function NicheDetail() {
  const { id } = useParams();
  const [niche, setNiche] = useState(null);
  const [tab, setTab] = useState(TABS[0]);

  useEffect(() => {
    api.get(`/niches/${id}`).then((res) => setNiche(res.data.niche));
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
        {tab === 'Credenciais' && <CredentialsTab nicheId={id} />}
        {tab === 'Agentes' && <AgentsTab nicheId={id} nicheName={niche.name} />}
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
        "Nicho" são os termos principais do seu mercado (ex: "dentista", "clínica odontológica").
        "Contexto" são termos que aumentam a chance de achar contato (ex: "whatsapp", "agende sua consulta").
      </p>
      <form className="inline-form" onSubmit={handleAdd}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="nicho">Nicho</option>
          <option value="contexto">Contexto</option>
        </select>
        <textarea
          placeholder="Uma palavra por linha ou separada por vírgula"
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
  const [name, setName] = useState('Padrão');

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
          placeholder="Fala, {{nome}}! 👋 ..."
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
function CredentialsTab({ nicheId }) {
  const [credentials, setCredentials] = useState([]);
  const [provider, setProvider] = useState('serper');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [n8nCredentialId, setN8nCredentialId] = useState('');

  function load() {
    api.get(`/niches/${nicheId}/credentials`).then((res) => setCredentials(res.data.credentials));
  }
  useEffect(load, [nicheId]);

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

  return (
    <div className="card">
      <h2>Credenciais de integração</h2>
      <p className="hint">
        Cadastre por nicho: a chave da API de busca (Serper/SerpAPI), a instância/URL/apikey da
        Evolution API (WhatsApp) e, opcionalmente, o ID da credencial Postgres já criada no n8n.
      </p>
      <form className="stacked-form" onSubmit={handleSave}>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="serper">Serper / SerpAPI (busca)</option>
          <option value="evolution_api">Evolution API (WhatsApp)</option>
          <option value="postgres_n8n">Postgres (credencial do n8n)</option>
        </select>
        <input placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <input placeholder="Base URL (se aplicável)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        {provider === 'evolution_api' && (
          <input
            placeholder="Nome da instância Evolution"
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
      <ul>
        {credentials.map((c) => (
          <li key={c.id}>
            <strong>{c.provider}</strong> — {c.base_url || 'sem base_url'}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------- Agentes -------------------
function AgentsTab({ nicheId, nicheName }) {
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
      setError(err.response?.data?.error || 'Erro ao criar agente.');
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
      setError(err.response?.data?.error || 'Erro ao ressincronizar agente.');
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
        Cada agente é um workflow criado automaticamente no n8n a partir da sua configuração de
        palavras-chave, mensagem e credenciais deste nicho.
      </p>
      {error && <div className="error-box">{error}</div>}

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
          <p>Workflow: <code>{agent.n8n_workflow_id || 'Não sincronizado'}</code></p>
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
