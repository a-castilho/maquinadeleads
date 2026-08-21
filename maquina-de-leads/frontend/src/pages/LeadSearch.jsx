import { useMemo, useState } from 'react';
import api from '../api/client';
import '../lead-search.css';

const INITIAL_FORM = {
  segment: '',
  location: '',
  offer: '',
  objective: '',
  quantity: 10,
};

function safeHref(value) {
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function phoneHref(value) {
  if (!value) return null;
  const normalized = value.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : null;
}

export default function LeadSearch() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState('');

  const leads = result?.leads || [];
  const confirmedPhones = useMemo(() => leads.filter((lead) => lead.phone).length, [leads]);
  const confirmedSites = useMemo(() => leads.filter((lead) => lead.website).length, [leads]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setCopied('');

    try {
      const response = await api.post('/lead-discovery/gpt-search', {
        ...form,
        quantity: Number(form.quantity),
      }, { timeout: 95000 });
      setResult(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Não foi possível concluir a busca de clientes.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLead(lead, index) {
    const text = [
      lead.company_name,
      lead.phone ? `Telefone: ${lead.phone}` : null,
      lead.website ? `Site: ${lead.website}` : null,
      [lead.city, lead.state].filter(Boolean).join(' - ') || null,
      lead.reason || null,
      lead.source_url ? `Fonte: ${lead.source_url}` : null,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(String(index));
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  }

  return (
    <div className="lead-search-page">
      <header className="lead-search-header">
        <div>
          <span className="lead-search-eyebrow">PROSPECÇÃO COM GPT</span>
          <h1>Buscar possíveis clientes</h1>
          <p>Informe o perfil desejado. O GPT pesquisa empresas reais na web e organiza contatos empresariais públicos para revisão.</p>
        </div>
        <div className="lead-search-ai-badge"><span>✦</span><div><strong>GPT + Web</strong><small>Pesquisa com fontes públicas</small></div></div>
      </header>

      <section className="lead-search-layout">
        <form className="lead-search-form" onSubmit={handleSearch}>
          <div className="lead-search-section-title">
            <div><span>1</span><div><strong>Defina quem procurar</strong><small>Quanto mais específico, melhor o resultado.</small></div></div>
          </div>

          <label className="lead-search-field">
            <span>Segmento *</span>
            <input
              value={form.segment}
              onChange={(event) => updateField('segment', event.target.value)}
              placeholder="Ex.: contabilidades, fintechs, indústrias"
              maxLength="180"
              required
            />
          </label>

          <label className="lead-search-field">
            <span>Cidade ou região *</span>
            <input
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              placeholder="Ex.: Sul de Minas, Varginha e região"
              maxLength="180"
              required
            />
          </label>

          <label className="lead-search-field">
            <span>Produto ou serviço oferecido</span>
            <input
              value={form.offer}
              onChange={(event) => updateField('offer', event.target.value)}
              placeholder="Ex.: RegulaAI — monitoramento regulatório"
              maxLength="300"
            />
          </label>

          <label className="lead-search-field">
            <span>Objetivo comercial</span>
            <textarea
              rows="4"
              value={form.objective}
              onChange={(event) => updateField('objective', event.target.value)}
              placeholder="Ex.: encontrar empresas com operação regulada e potencial necessidade de acompanhamento contínuo"
              maxLength="300"
            />
          </label>

          <label className="lead-search-field lead-search-quantity">
            <span>Quantidade</span>
            <select value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)}>
              <option value="5">5 empresas</option>
              <option value="10">10 empresas</option>
              <option value="15">15 empresas</option>
              <option value="20">20 empresas</option>
            </select>
          </label>

          {error && <div className="lead-search-error">{error}</div>}

          <button className="lead-search-submit" type="submit" disabled={loading}>
            <span aria-hidden="true">✦</span>
            {loading ? 'GPT pesquisando empresas...' : 'Buscar clientes com GPT'}
          </button>

          <p className="lead-search-privacy">Somente dados empresariais públicos. Os resultados devem ser revisados antes de qualquer abordagem comercial.</p>
        </form>

        <section className="lead-search-results" aria-live="polite">
          {!result && !loading && (
            <div className="lead-search-empty">
              <div className="lead-search-empty-icon">⌕</div>
              <h2>Pronto para pesquisar</h2>
              <p>Preencha segmento e região. Os resultados aparecerão aqui com site, telefone, fonte e aderência comercial.</p>
              <div className="lead-search-empty-grid">
                <span><strong>Empresa</strong><small>Nome confirmado</small></span>
                <span><strong>Contato</strong><small>Telefone público</small></span>
                <span><strong>Fonte</strong><small>Link para validação</small></span>
              </div>
            </div>
          )}

          {loading && (
            <div className="lead-search-loading">
              <div className="lead-search-spinner" />
              <h2>Pesquisando potenciais clientes</h2>
              <p>O GPT está consultando a web, comparando empresas e verificando fontes públicas.</p>
              <div className="lead-search-loading-lines"><span /><span /><span /></div>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="lead-search-summary">
                <div>
                  <span className="lead-search-eyebrow">RESULTADO DA BUSCA</span>
                  <h2>{leads.length} empresas encontradas</h2>
                  <p>{result.summary || 'Busca concluída. Revise os contatos antes de iniciar a abordagem.'}</p>
                </div>
                <div className="lead-search-metrics">
                  <span><strong>{confirmedPhones}</strong><small>com telefone</small></span>
                  <span><strong>{confirmedSites}</strong><small>com site</small></span>
                  <span><strong>{result.sources?.length || 0}</strong><small>fontes consultadas</small></span>
                </div>
              </div>

              {leads.length === 0 ? (
                <div className="lead-search-no-results"><strong>Nenhuma empresa confirmada.</strong><span>Tente ampliar a região ou ajustar o segmento.</span></div>
              ) : (
                <div className="lead-search-cards">
                  {leads.map((lead, index) => {
                    const website = safeHref(lead.website);
                    const source = safeHref(lead.source_url);
                    const phone = phoneHref(lead.phone);
                    return (
                      <article className="lead-search-card" key={`${lead.company_name}-${index}`}>
                        <div className="lead-search-card-top">
                          <div className="lead-search-company-mark">{lead.company_name?.slice(0, 1)?.toUpperCase() || 'E'}</div>
                          <div className="lead-search-company-copy">
                            <h3>{lead.company_name}</h3>
                            <p>{[lead.city, lead.state].filter(Boolean).join(' • ') || lead.segment || 'Localização não confirmada'}</p>
                          </div>
                          <span className="lead-search-confidence" title="Confiança da análise">{lead.confidence}%</span>
                        </div>

                        <p className="lead-search-reason">{lead.reason}</p>

                        <div className="lead-search-contact-grid">
                          <div><span>Telefone</span>{phone ? <a href={phone}>{lead.phone}</a> : <strong>Não confirmado</strong>}</div>
                          <div><span>Site</span>{website ? <a href={website} target="_blank" rel="noreferrer">Abrir site ↗</a> : <strong>Não confirmado</strong>}</div>
                        </div>

                        <div className="lead-search-card-actions">
                          {source ? <a href={source} target="_blank" rel="noreferrer" className="lead-search-source">Ver fonte ↗</a> : <span className="lead-search-source muted">Fonte não vinculada</span>}
                          <button type="button" onClick={() => copyLead(lead, index)}>{copied === String(index) ? 'Copiado ✓' : 'Copiar contato'}</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {result.sources?.length > 0 && (
                <details className="lead-search-sources">
                  <summary>Fontes adicionais consultadas ({result.sources.length})</summary>
                  <div>{result.sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a>)}</div>
                </details>
              )}
            </>
          )}
        </section>
      </section>
    </div>
  );
}
