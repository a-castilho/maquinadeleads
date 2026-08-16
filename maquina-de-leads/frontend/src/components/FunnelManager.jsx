import { useEffect, useState } from 'react';
import api from '../api/client';

const STAGES = [
  ['discovered', 'Descoberto'],
  ['qualified', 'Qualificado'],
  ['ready_for_contact', 'Pronto para contato'],
  ['contacted', 'Contatado'],
  ['responded', 'Respondeu'],
  ['interested', 'Interessado'],
  ['converted', 'Convertido'],
  ['discarded', 'Descartado'],
];

export default function FunnelManager({ campaignId, onChanged }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [message, setMessage] = useState(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get(`/niches/${campaignId}/leads`, {
        params: {
          page: 1,
          pageSize: 100,
          funnelStage: stageFilter || undefined,
          minScore: minScore === '' ? undefined : minScore,
        },
      });
      setLeads(res.data.leads || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao carregar o funil.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [campaignId, stageFilter, minScore]);

  async function moveLead(leadId, funnelStage) {
    setMoving(leadId);
    setMessage(null);
    try {
      await api.put(`/niches/${campaignId}/leads/${leadId}`, { funnelStage });
      setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, funnel_stage: funnelStage } : lead));
      setMessage({ type: 'success', text: 'Etapa do lead atualizada.' });
      if (onChanged) await onChanged();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao mover o lead.' });
      await load();
    } finally {
      setMoving('');
    }
  }

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="section-heading">
        <div><h2 style={{ marginBottom: 4 }}>Gestão do funil</h2><p className="hint">Revise score e mova cada lead conforme a evolução comercial.</p></div>
        <button type="button" className="secondary-button" onClick={load} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
      </div>

      {message && <div className={`ui-message ${message.type}`}>{message.text}</div>}

      <div className="funnel-toolbar">
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">Todas as etapas</option>
          {STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={minScore} onChange={(e) => setMinScore(e.target.value)}>
          <option value="">Qualquer score</option>
          {[40,50,60,70,80].map((value) => <option key={value} value={value}>{value}+</option>)}
        </select>
      </div>

      <div className="table-shell">
        <table className="data-table">
          <thead><tr><th>Lead</th><th>Contato</th><th>Score</th><th>Etapa</th><th>Status técnico</th></tr></thead>
          <tbody>
            {loading && leads.length === 0 ? <tr><td colSpan="5">Carregando...</td></tr> : leads.length === 0 ? <tr><td colSpan="5">Nenhum lead encontrado para este filtro.</td></tr> : leads.map((lead) => (
              <tr key={lead.id}>
                <td><strong>{lead.nome_perfil || 'Sem nome'}</strong>{lead.fonte_url && <div><a href={lead.fonte_url} target="_blank" rel="noreferrer">fonte</a></div>}</td>
                <td><div>{lead.whatsapp || '—'}</div><small className="hint">{lead.email || ''}</small></td>
                <td><strong>{lead.lead_score ?? '—'}</strong>{lead.min_lead_score != null && <div className="hint">mínimo {lead.min_lead_score}</div>}</td>
                <td>
                  <select disabled={moving === lead.id} value={lead.funnel_stage || 'discovered'} onChange={(e) => moveLead(lead.id, e.target.value)}>
                    {STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </td>
                <td><span className={`status-token ${lead.status === 'erro' ? 'error' : lead.status === 'enviado' ? 'sent' : 'pending'}`}>{lead.status || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
