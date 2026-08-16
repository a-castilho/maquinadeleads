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
  const [stageFilter, setStageFilter] = useState('');
  const [minScore, setMinScore] = useState('');

  async function load() {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [campaignId, stageFilter, minScore]);

  async function moveLead(leadId, funnelStage) {
    await api.put(`/niches/${campaignId}/leads/${leadId}`, { funnelStage });
    setLeads((current) => current.map((lead) => (
      lead.id === leadId ? { ...lead, funnel_stage: funnelStage } : lead
    )));
    if (onChanged) await onChanged();
  }

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Gestão do funil</h2>
          <p className="hint">Revise score e mova cada lead conforme a evolução comercial.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">Todas as etapas</option>
          {STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={minScore} onChange={(e) => setMinScore(e.target.value)}>
          <option value="">Qualquer score</option>
          <option value="40">40+</option>
          <option value="50">50+</option>
          <option value="60">60+</option>
          <option value="70">70+</option>
          <option value="80">80+</option>
        </select>
      </div>

      {loading && leads.length === 0 ? (
        <p>Carregando...</p>
      ) : leads.length === 0 ? (
        <p className="empty">Nenhum lead encontrado para este filtro.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Lead</th>
                <th style={{ padding: 8 }}>Contato</th>
                <th style={{ padding: 8 }}>Score</th>
                <th style={{ padding: 8 }}>Etapa</th>
                <th style={{ padding: 8 }}>Status técnico</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>
                    <strong>{lead.nome_perfil || 'Sem nome'}</strong>
                    {lead.fonte_url && (
                      <div><a href={lead.fonte_url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>fonte</a></div>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <div>{lead.whatsapp || '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{lead.email || ''}</div>
                  </td>
                  <td style={{ padding: 8 }}>
                    <strong>{lead.lead_score ?? '—'}</strong>
                    {lead.lead_score != null && lead.min_lead_score != null && (
                      <div style={{ fontSize: 10, color: Number(lead.lead_score) >= Number(lead.min_lead_score) ? '#15803d' : '#b45309' }}>
                        mínimo {lead.min_lead_score}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <select value={lead.funnel_stage || 'discovered'} onChange={(e) => moveLead(lead.id, e.target.value)}>
                      {STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 8 }}>{lead.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
