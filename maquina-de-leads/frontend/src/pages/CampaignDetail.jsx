import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';

const stages = ['descoberto','qualificado','pronto_contato','contatado','respondeu','interessado','convertido','descartado'];

export default function CampaignDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.get(`/campaigns/${id}`);
      setData(res.data);
    } catch (err) { setError(err.response?.data?.error || 'Erro ao carregar campanha.'); }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const active = data?.jobs?.some(j => ['queued','running','retry'].includes(j.status));
    if (!active) return undefined;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [id, data?.jobs]);

  async function runCampaign() {
    setRunning(true); setError('');
    try {
      await api.post(`/campaigns/${id}/run`);
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Falha ao enfileirar a busca.'); }
    finally { setRunning(false); }
  }

  async function setStage(leadId, stage) {
    await api.patch(`/campaigns/${id}/leads/${leadId}/stage`, { stage });
    await load();
  }

  async function saveStrategy() {
    const campaign = data.campaign;
    await api.put(`/campaigns/${id}`, { strategy: campaign.strategy, message_template: campaign.message_template, status: 'ready' });
    await load();
  }

  if (!data) return <div className="page">{error || 'Carregando...'}</div>;
  const { campaign, leads, jobs } = data;
  const hasActiveJob = jobs.some(j => ['queued','running','retry'].includes(j.status));

  return (
    <div className="page">
      <header className="topbar">
        <div><Link className="back-link" to="/">← Campanhas</Link><h1>{campaign.name}</h1></div>
        <span className={`badge badge-${campaign.status}`}>{campaign.status}</span>
      </header>
      {error && <div className="error-box">{error}</div>}

      <section className="card">
        <h2>1. Estratégia</h2>
        <p className="hint">{campaign.niche}{campaign.location ? ` • ${campaign.location}` : ''}</p>
        <label>Palavras-chave</label>
        <textarea rows="4" value={(campaign.strategy?.keywords || []).join('\n')} onChange={e => setData({...data, campaign:{...campaign, strategy:{...campaign.strategy, keywords:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)}}})} />
        <label>Mensagem inicial</label>
        <textarea rows="5" value={campaign.message_template || ''} onChange={e => setData({...data, campaign:{...campaign, message_template:e.target.value}})} />
        <div className="actions"><button onClick={saveStrategy}>Salvar preparação</button><button onClick={runCampaign} disabled={running || hasActiveJob}>{hasActiveJob ? 'Execução em andamento...' : running ? 'Enfileirando...' : 'Executar busca agora'}</button></div>
      </section>

      <section className="card">
        <h2>2. Funil de leads</h2>
        <div className="funnel-summary">{stages.map(stage => <span key={stage}><strong>{leads.filter(l => l.stage === stage).length}</strong>{stage.replace('_',' ')}</span>)}</div>
        {leads.length === 0 ? <p className="empty">Ainda não há leads. Revise a estratégia e execute a busca.</p> : (
          <div className="table-scroll"><table className="leads-table"><thead><tr><th>Lead</th><th>Contato</th><th>Score</th><th>Fonte</th><th>Etapa</th></tr></thead><tbody>
            {leads.map(lead => <tr key={lead.id}>
              <td>{lead.nome_perfil || 'Sem nome'}</td><td>{lead.whatsapp || 'não identificado'}</td><td>{lead.score}</td>
              <td>{lead.fonte_url ? <a href={lead.fonte_url} target="_blank" rel="noreferrer">abrir</a> : '-'}</td>
              <td><select value={lead.stage} onChange={e => setStage(lead.id,e.target.value)}>{stages.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>

      <section className="card">
        <h2>3. Execuções</h2>
        {jobs.length === 0 ? <p className="empty">Nenhuma execução registrada.</p> : jobs.map(job => <div className="job-row" key={job.id}><span>{job.type}</span><span>{job.status}</span><span>{job.error || (job.result?.inserted != null ? `${job.result.inserted} novos leads` : '')}</span></div>)}
      </section>
    </div>
  );
}
