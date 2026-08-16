import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

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

export default function CompanyProfile() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/company-profile').then(({ data }) => {
      if (data) setForm({ ...empty, ...data, ideal_customer_profile: { ...empty.ideal_customer_profile, ...(data.ideal_customer_profile || {}) } });
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
    setSaving(true); setMessage('');
    try {
      const { data } = await api.put('/company-profile', form);
      setForm({ ...empty, ...data, ideal_customer_profile: { ...empty.ideal_customer_profile, ...(data.ideal_customer_profile || {}) } });
      setMessage('Perfil salvo e palavras-chave recalculadas.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao salvar perfil.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="page"><p>Carregando perfil...</p></div>;

  const text = (field, label, placeholder='') => (
    <label><strong>{label}</strong><input value={form[field] || ''} placeholder={placeholder} onChange={e => change(field, e.target.value)} /></label>
  );
  const list = (field, label, placeholder='Um item por linha') => (
    <label><strong>{label}</strong><textarea rows={4} value={toText(form[field])} placeholder={placeholder} onChange={e => change(field, e.target.value)} /></label>
  );

  return <div className="page">
    <header className="topbar">
      <div><h1>Perfil da empresa</h1><p className="hint">Base estratégica para descoberta, palavras-chave, qualificação e abordagem comercial.</p></div>
      <Link to="/">← Campanhas</Link>
    </header>

    <section className="card">
      <h2>Completude: {completeness}%</h2>
      <div style={{height:10,background:'#e5e7eb',borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:`${completeness}%`,background:'#111827'}} /></div>
      <p className="hint">Quanto mais completo o perfil, melhor a geração automática de termos de busca.</p>
    </section>

    <form onSubmit={save} className="stacked-form">
      <section className="card"><h2>Identificação e presença digital</h2>
        {text('legal_name','Razão social')}{text('trade_name','Nome fantasia')}{text('cnpj','CNPJ')}{text('website','Website')}
        {text('linkedin_url','LinkedIn')}{text('instagram_url','Instagram')}{text('phone','Telefone / WhatsApp')}{text('email','E-mail comercial')}
        {text('headquarters_city','Cidade sede')}{text('headquarters_state','UF')}{list('service_regions','Regiões atendidas','Ex.: São Paulo\nMinas Gerais\nBrasil')}
      </section>

      <section className="card"><h2>Características do negócio</h2>
        {text('company_size','Porte')}{text('employee_range','Faixa de funcionários')}{text('annual_revenue_range','Faixa de faturamento')}
        {text('founding_year','Ano de fundação')}{text('business_model','Modelo de negócio','B2B, B2C, SaaS, serviços...')}{text('market_segment','Segmento principal')}
        {list('subsegments','Subsegmentos')}{list('cnaes','CNAEs')}
        <label><strong>Descrição detalhada</strong><textarea rows={5} value={form.description || ''} onChange={e=>change('description',e.target.value)} /></label>
      </section>

      <section className="card"><h2>Oferta e posicionamento</h2>
        {list('products_services','Produtos e serviços')}
        <label><strong>Proposta de valor</strong><textarea rows={4} value={form.value_proposition || ''} onChange={e=>change('value_proposition',e.target.value)} /></label>
        {list('differentiators','Diferenciais competitivos')}{list('main_competitors','Principais concorrentes')}
        {text('average_ticket','Ticket médio')}{text('sales_cycle','Ciclo médio de vendas')}{list('sales_channels','Canais de venda')}
      </section>

      <section className="card"><h2>Cliente ideal (ICP)</h2>
        <label><strong>Descrição do ICP</strong><textarea rows={4} value={form.ideal_customer_profile?.description || ''} onChange={e=>changeIcp('description',e.target.value)} /></label>
        {list('target_industries','Setores-alvo')}{list('target_company_sizes','Portes de empresa-alvo')}{list('target_roles','Cargos / decisores-alvo')}
        {list('buyer_personas','Personas compradoras')}{list('customer_pains','Dores que resolvemos')}{list('purchase_triggers','Gatilhos de compra')}
        {list('objections','Objeções comuns')}{list('disqualifiers','Critérios de desqualificação')}
      </section>

      <section className="card"><h2>Inteligência de busca</h2>
        {list('keywords_seed','Palavras-chave semente','Termos que você já sabe que funcionam')}
        {list('negative_keywords','Palavras-chave negativas','Termos que devem ser excluídos')}
        <label><strong>Observações para busca</strong><textarea rows={4} value={form.search_notes || ''} onChange={e=>change('search_notes',e.target.value)} /></label>
        <h3>Palavras-chave geradas ({form.generated_keywords?.length || 0})</h3>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{(form.generated_keywords || []).map(k => <span key={k} className="badge">{k}</span>)}</div>
      </section>

      {message && <p>{message}</p>}
      <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar perfil e gerar palavras-chave'}</button>
    </form>
  </div>;
}
