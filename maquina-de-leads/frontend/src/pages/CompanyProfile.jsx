import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './CompanyProfile.css';

const empty = {
  legal_name:'', trade_name:'', cnpj:'', website:'', linkedin_url:'', instagram_url:'', phone:'', email:'',
  headquarters_city:'', headquarters_state:'', service_regions:[], company_size:'', employee_range:'',
  annual_revenue_range:'', founding_year:'', business_model:'', market_segment:'', subsegments:[], cnaes:[],
  description:'', products_services:[], value_proposition:'', differentiators:[], main_competitors:[],
  ideal_customer_profile:{ description:'', min_employees:'', max_employees:'', min_revenue:'', max_revenue:'' },
  target_industries:[], target_company_sizes:[], target_roles:[], buyer_personas:[], customer_pains:[],
  purchase_triggers:[], objections:[], disqualifiers:[], average_ticket:'', sales_cycle:'', sales_channels:[],
  keywords_seed:[], negative_keywords:[], generated_keywords:[], search_notes:'', profile_completeness:0,
};

const listFields = new Set([
  'service_regions','subsegments','cnaes','products_services','differentiators','main_competitors',
  'target_industries','target_company_sizes','target_roles','buyer_personas','customer_pains','purchase_triggers',
  'objections','disqualifiers','sales_channels','keywords_seed','negative_keywords'
]);

function toText(value) { return Array.isArray(value) ? value.join('\n') : ''; }
function toList(value) { return String(value || '').split(/\n|,/).map(v => v.trim()).filter(Boolean); }
function hydrate(data) {
  return { ...empty, ...(data || {}), ideal_customer_profile: { ...empty.ideal_customer_profile, ...(data?.ideal_customer_profile || {}) } };
}

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`company-field ${className}`.trim()}>
      <span className="company-field-label">{label}</span>
      {hint ? <span className="company-field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export default function CompanyProfile() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/company-profile').then(({ data }) => {
      if (data) setForm(hydrate(data));
    }).catch((err) => {
      console.error('[company-profile-ui] load failed', err.response?.data || err.message);
      setMessage(err.response?.data?.error || 'Erro ao carregar perfil.');
    }).finally(() => setLoading(false));
  }, []);

  const completeness = useMemo(() => Number(form.profile_completeness || 0), [form.profile_completeness]);

  function change(field, value) {
    setForm(current => ({ ...current, [field]: listFields.has(field) ? toList(value) : value }));
  }

  function changeIcp(field, value) {
    setForm(current => ({ ...current, ideal_customer_profile: { ...current.ideal_customer_profile, [field]: value } }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    console.info('[company-profile-ui] save started');
    try {
      const { data } = await api.put('/company-profile', form);
      setForm(hydrate(data));
      setMessage('Perfil salvo e palavras-chave recalculadas.');
      console.info('[company-profile-ui] save completed', { completeness: data.profile_completeness });
    } catch (err) {
      console.error('[company-profile-ui] save failed', err.response?.data || err.message);
      setMessage(err.response?.data?.error || 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function generateTestCompany() {
    const hasData = Boolean(form.trade_name || form.legal_name || form.description);
    if (hasData && !window.confirm('Gerar uma empresa de teste substituirá o perfil atual. Continuar?')) return;

    setGeneratingTest(true);
    setMessage('');
    console.info('[company-profile-ui] test generator started');
    try {
      const { data } = await api.post('/company-profile/generate-test');
      setForm(hydrate(data));
      setMessage(`Empresa fictícia gerada: ${data.trade_name || data.legal_name}. Perfil salvo e palavras-chave criadas automaticamente.`);
      console.info('[company-profile-ui] test generator completed', {
        company: data.trade_name || data.legal_name,
        completeness: data.profile_completeness,
      });
    } catch (err) {
      console.error('[company-profile-ui] test generator failed', err.response?.data || err.message);
      setMessage(err.response?.data?.error || 'Erro ao gerar empresa de teste.');
    } finally {
      setGeneratingTest(false);
    }
  }

  if (loading) return <div className="page"><p>Carregando perfil...</p></div>;

  const text = (field, label, placeholder='', className='') => (
    <Field label={label} className={className}>
      <input value={form[field] || ''} placeholder={placeholder} onChange={e => change(field, e.target.value)} />
    </Field>
  );

  const list = (field, label, placeholder='Um item por linha', className='company-field-wide') => (
    <Field label={label} hint="Um item por linha" className={className}>
      <textarea rows={4} value={toText(form[field])} placeholder={placeholder} onChange={e => change(field, e.target.value)} />
    </Field>
  );

  return (
    <div className="page company-profile-page">
      <header className="topbar company-profile-header">
        <div>
          <span className="company-profile-eyebrow">INTELIGÊNCIA COMERCIAL</span>
          <h1>Perfil da empresa</h1>
          <p className="hint">Base estratégica para descoberta, palavras-chave, qualificação e abordagem comercial.</p>
        </div>
        <Link className="secondary-button" to="/">← Campanhas</Link>
      </header>

      <section className="card company-profile-summary">
        <div className="company-profile-summary-row">
          <div>
            <span className="company-profile-kicker">QUALIDADE DO PERFIL</span>
            <h2>Completude: {completeness}%</h2>
            <p className="hint">Quanto mais completo o perfil, melhor a geração automática de termos de busca.</p>
          </div>
          <button className="company-profile-generate" type="button" onClick={generateTestCompany} disabled={generatingTest}>
            {generatingTest ? 'Gerando empresa...' : '⚙ Gerar empresa para teste'}
          </button>
        </div>
        <div className="company-profile-progress" aria-label={`Completude ${completeness}%`}>
          <div style={{ width: `${completeness}%` }} />
        </div>
        <p className="hint company-profile-summary-note">O gerador usa dados sintéticos e nunca consulta ou cadastra uma empresa real.</p>
      </section>

      <form onSubmit={save} className="stacked-form company-profile-form">
        <section className="card company-profile-section">
          <div className="company-profile-section-heading">
            <div><span>01</span><h2>Identificação e presença digital</h2></div>
            <p>Dados institucionais, canais oficiais e localização da empresa.</p>
          </div>
          <div className="company-form-grid company-form-grid-3">
            {text('legal_name','Razão social')}
            {text('trade_name','Nome fantasia')}
            {text('cnpj','CNPJ')}
            {text('website','Website')}
            {text('linkedin_url','LinkedIn')}
            {text('instagram_url','Instagram')}
            {text('phone','Telefone / WhatsApp')}
            {text('email','E-mail comercial')}
            {text('headquarters_city','Cidade sede')}
            {text('headquarters_state','UF')}
            {list('service_regions','Regiões atendidas','Ex.: São Paulo\nMinas Gerais\nBrasil','company-field-span-2')}
          </div>
        </section>

        <section className="card company-profile-section">
          <div className="company-profile-section-heading">
            <div><span>02</span><h2>Características do negócio</h2></div>
            <p>Estrutura, porte, mercado e posicionamento empresarial.</p>
          </div>
          <div className="company-form-grid company-form-grid-3">
            {text('company_size','Porte')}
            {text('employee_range','Faixa de funcionários')}
            {text('annual_revenue_range','Faixa de faturamento')}
            {text('founding_year','Ano de fundação')}
            {text('business_model','Modelo de negócio','B2B, B2C, SaaS, serviços...')}
            {text('market_segment','Segmento principal')}
            {list('subsegments','Subsegmentos','Um item por linha','company-field-span-2')}
            {list('cnaes','CNAEs','Um item por linha')}
            <Field label="Descrição detalhada" className="company-field-wide">
              <textarea rows={5} value={form.description || ''} onChange={e=>change('description',e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="card company-profile-section">
          <div className="company-profile-section-heading">
            <div><span>03</span><h2>Oferta e posicionamento</h2></div>
            <p>O que a empresa vende, como entrega valor e como compete.</p>
          </div>
          <div className="company-form-grid company-form-grid-2">
            {list('products_services','Produtos e serviços')}
            <Field label="Proposta de valor" className="company-field-wide">
              <textarea rows={4} value={form.value_proposition || ''} onChange={e=>change('value_proposition',e.target.value)} />
            </Field>
            {list('differentiators','Diferenciais competitivos')}
            {list('main_competitors','Principais concorrentes')}
            {text('average_ticket','Ticket médio')}
            {text('sales_cycle','Ciclo médio de vendas')}
            {list('sales_channels','Canais de venda')}
          </div>
        </section>

        <section className="card company-profile-section">
          <div className="company-profile-section-heading">
            <div><span>04</span><h2>Cliente ideal (ICP)</h2></div>
            <p>Características das empresas e decisores com maior potencial de conversão.</p>
          </div>
          <div className="company-form-grid company-form-grid-2">
            <Field label="Descrição do ICP" className="company-field-wide">
              <textarea rows={4} value={form.ideal_customer_profile?.description || ''} onChange={e=>changeIcp('description',e.target.value)} />
            </Field>
            {list('target_industries','Setores-alvo')}
            {list('target_company_sizes','Portes de empresa-alvo')}
            {list('target_roles','Cargos / decisores-alvo')}
            {list('buyer_personas','Personas compradoras')}
            {list('customer_pains','Dores que resolvemos')}
            {list('purchase_triggers','Gatilhos de compra')}
            {list('objections','Objeções comuns')}
            {list('disqualifiers','Critérios de desqualificação')}
          </div>
        </section>

        <section className="card company-profile-section">
          <div className="company-profile-section-heading">
            <div><span>05</span><h2>Inteligência de busca</h2></div>
            <p>Termos que orientam descoberta, exclusões e geração automática de consultas.</p>
          </div>
          <div className="company-form-grid company-form-grid-2">
            {list('keywords_seed','Palavras-chave semente','Termos que você já sabe que funcionam')}
            {list('negative_keywords','Palavras-chave negativas','Termos que devem ser excluídos')}
            <Field label="Observações para busca" className="company-field-wide">
              <textarea rows={4} value={form.search_notes || ''} onChange={e=>change('search_notes',e.target.value)} />
            </Field>
            <div className="company-keywords-panel company-field-wide">
              <div className="company-keywords-heading">
                <div>
                  <span>TERMOS GERADOS</span>
                  <h3>Palavras-chave ({form.generated_keywords?.length || 0})</h3>
                </div>
              </div>
              <div className="company-keywords-list">
                {(form.generated_keywords || []).length
                  ? (form.generated_keywords || []).map(k => <span key={k} className="badge">{k}</span>)
                  : <span className="company-keywords-empty">Complete o perfil para gerar termos de descoberta.</span>}
              </div>
            </div>
          </div>
        </section>

        {message && <div className="company-profile-message" role="status">{message}</div>}

        <div className="company-profile-actions">
          <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar perfil e gerar palavras-chave'}</button>
        </div>
      </form>
    </div>
  );
}
