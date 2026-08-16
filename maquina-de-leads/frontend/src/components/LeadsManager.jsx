import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const STATUS_META = {
  pendente: { label: 'Pendente', tone: 'pending', card: 'warning' },
  enviado: { label: 'Enviado', tone: 'sent', card: 'success' },
  erro: { label: 'Erro', tone: 'error', card: 'danger' },
  sem_telefone: { label: 'Sem telefone', tone: 'neutral', card: '' },
};

function meta(status) {
  return STATUS_META[status] || { label: status || 'Sem status', tone: 'neutral', card: '' };
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function LeadsManager({ nicheId }) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [sourceStats, setSourceStats] = useState([]);
  const [sources, setSources] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [deleteLead, setDeleteLead] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get(`/niches/${nicheId}/leads`, {
          params: { status: statusFilter || undefined, fonte: sourceFilter || undefined, search: search || undefined, page, pageSize },
        }),
        api.get(`/niches/${nicheId}/leads/stats`),
      ]);
      setLeads(listRes.data.leads || []);
      setTotal(Number(listRes.data.total || 0));
      setTotalPages(Math.max(1, Number(listRes.data.totalPages || 1)));
      setSources(listRes.data.fontes || []);
      setStats(statsRes.data.stats || []);
      setTimeline(statsRes.data.timeline || []);
      setSourceStats(statsRes.data.fontes || []);
      setSelectedIds((current) => current.filter((id) => (listRes.data.leads || []).some((lead) => lead.id === id)));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Não foi possível carregar os leads.' });
    } finally {
      setLoading(false);
    }
  }, [nicheId, statusFilter, sourceFilter, search, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const maxTimeline = useMemo(() => Math.max(1, ...timeline.map((item) => Number(item.total || 0))), [timeline]);

  function toggle(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds((current) => current.length === leads.length ? [] : leads.map((lead) => lead.id));
  }

  async function bulkUpdate(status) {
    if (!selectedIds.length) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/niches/${nicheId}/leads/bulk`, { ids: selectedIds, status });
      setSelectedIds([]);
      setMessage({ type: 'success', text: 'Leads atualizados com sucesso.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao atualizar leads.' });
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editLead) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.put(`/niches/${nicheId}/leads/${editLead.id}`, {
        nome_perfil: editLead.nome_perfil,
        phone: editLead.phone,
        whatsapp: editLead.whatsapp,
        status: editLead.status,
        observacao: editLead.observacao,
      });
      setEditLead(null);
      setMessage({ type: 'success', text: 'Lead salvo.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao salvar lead.' });
    } finally { setBusy(false); }
  }

  async function removeLead() {
    if (!deleteLead) return;
    setBusy(true);
    try {
      await api.delete(`/niches/${nicheId}/leads/${deleteLead.id}`);
      setDeleteLead(null);
      setMessage({ type: 'success', text: 'Lead excluído.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erro ao excluir lead.' });
    } finally { setBusy(false); }
  }

  function clearFilters() {
    setStatusFilter(''); setSourceFilter(''); setSearch(''); setPage(1);
  }

  return (
    <div>
      {message && <div className={`ui-message ${message.type}`}>{message.text}</div>}

      <div className="leads-stats-grid">
        {stats.map((item) => {
          const info = meta(item.status);
          return (
            <button key={item.status} type="button" className={`lead-stat-card ${info.card} ${statusFilter === item.status ? 'active' : ''}`} onClick={() => { setStatusFilter(statusFilter === item.status ? '' : item.status); setPage(1); }}>
              <strong>{item.total}</strong><span>{info.label}</span>
            </button>
          );
        })}
        <button type="button" className={`lead-stat-card ${!statusFilter && !sourceFilter && !search ? 'active' : ''}`} onClick={clearFilters}>
          <strong>{total}</strong><span>Total</span>
        </button>
      </div>

      {timeline.length > 0 && (
        <section className="leads-timeline">
          <strong>Leads nos últimos 30 dias</strong>
          <div className="timeline-bars">
            {timeline.slice(0, 14).reverse().map((item) => (
              <div className="timeline-column" key={item.data} title={`${item.data}: ${item.total}`}>
                <div className="timeline-bar" style={{ height: `${Math.max(6, (Number(item.total || 0) / maxTimeline) * 52)}px` }} />
                <small>{new Date(item.data).getDate()}/{new Date(item.data).getMonth() + 1}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {sourceStats.length > 0 && (
        <div className="source-chips">
          {sourceStats.map((item) => <span className="source-chip" key={item.fonte}>{item.fonte}: <strong>{item.total}</strong></span>)}
        </div>
      )}

      <div className="leads-toolbar">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option><option value="pendente">Pendente</option><option value="enviado">Enviado</option><option value="erro">Erro</option><option value="sem_telefone">Sem telefone</option>
        </select>
        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
          <option value="">Todas as fontes</option>
          {sources.map((source) => <option key={source} value={source}>{String(source).slice(0, 70)}</option>)}
        </select>
        <input type="search" placeholder="Buscar nome, telefone, WhatsApp ou texto..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[10,25,50,100].map((value) => <option key={value} value={value}>{value} por página</option>)}
        </select>
        <button type="button" className="compact-button" onClick={load} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-actions">
          <strong>{selectedIds.length} selecionado(s)</strong>
          <button className="compact-button" disabled={busy} onClick={() => bulkUpdate('pendente')}>Pendente</button>
          <button className="compact-button" disabled={busy} onClick={() => bulkUpdate('enviado')}>Enviado</button>
          <button className="compact-button danger-soft" disabled={busy} onClick={() => bulkUpdate('erro')}>Erro</button>
          <span className="spacer" />
          <button className="compact-button" onClick={() => setSelectedIds([])}>Limpar</button>
        </div>
      )}

      <div className="table-shell">
        <table className="data-table">
          <thead><tr>
            <th><input type="checkbox" checked={leads.length > 0 && selectedIds.length === leads.length} onChange={toggleAll} /></th>
            <th>Nome</th><th>Contato</th><th>Score</th><th>Status</th><th>Query</th><th>Fonte</th><th>Data</th><th>Ações</th>
          </tr></thead>
          <tbody>
            {loading && leads.length === 0 ? <tr><td colSpan="9">Carregando...</td></tr> : leads.length === 0 ? <tr><td colSpan="9">Nenhum lead encontrado.</td></tr> : leads.map((lead) => {
              const info = meta(lead.status);
              return <tr key={lead.id}>
                <td><input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggle(lead.id)} /></td>
                <td><strong>{lead.nome_perfil || 'Sem nome'}</strong>{lead.source_category === 'google_maps' && <small style={{display:'block',color:'var(--accent-2)'}}>Google Maps</small>}</td>
                <td>{lead.whatsapp ? <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noreferrer">{lead.whatsapp}</a> : (lead.phone || '—')}</td>
                <td><strong>{lead.lead_score ?? '—'}</strong></td>
                <td><span className={`status-token ${info.tone}`}>{info.label}</span></td>
                <td title={lead.original_query || ''}>{String(lead.original_query || '—').slice(0, 45)}</td>
                <td>{lead.google_maps_url ? <a href={lead.google_maps_url} target="_blank" rel="noreferrer">Maps</a> : lead.fonte_url ? <a href={lead.fonte_url} target="_blank" rel="noreferrer">abrir</a> : '—'}</td>
                <td>{formatDate(lead.created_at)}</td>
                <td><div style={{display:'flex',gap:5}}>
                  <button className="compact-button" onClick={() => setDetailLead(lead)}>Ver</button>
                  <button className="compact-button" onClick={() => setEditLead({ ...lead })}>Editar</button>
                  <button className="compact-button danger-soft" onClick={() => setDeleteLead(lead)}>Excluir</button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <span>{total} lead(s) • página {page} de {totalPages}</span>
        <div><button className="compact-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><button className="compact-button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima</button></div>
      </div>

      {detailLead && <Modal title="Detalhes do lead" onClose={() => setDetailLead(null)}>
        <div className="detail-grid">
          <Detail label="Nome" value={detailLead.nome_perfil} /><Detail label="Telefone" value={detailLead.phone} /><Detail label="WhatsApp" value={detailLead.whatsapp} /><Detail label="E-mail" value={detailLead.email} /><Detail label="Score" value={detailLead.lead_score} /><Detail label="Etapa" value={detailLead.funnel_stage} /><Detail label="Status" value={meta(detailLead.status).label} /><Detail label="Fonte" value={detailLead.source_category} /><Detail label="Nota Google" value={detailLead.google_rating} /><Detail label="Avaliações Google" value={detailLead.google_reviews} /><Detail label="Query" value={detailLead.original_query} /><Detail label="Observação" value={detailLead.observacao} />
        </div>
      </Modal>}

      {editLead && <Modal title="Editar lead" onClose={() => setEditLead(null)}>
        <div className="stacked-form">
          <input value={editLead.nome_perfil || ''} onChange={(e) => setEditLead({ ...editLead, nome_perfil: e.target.value })} placeholder="Nome" />
          <input value={editLead.phone || ''} onChange={(e) => setEditLead({ ...editLead, phone: e.target.value })} placeholder="Telefone" />
          <input value={editLead.whatsapp || ''} onChange={(e) => setEditLead({ ...editLead, whatsapp: e.target.value })} placeholder="WhatsApp" />
          <select value={editLead.status || 'pendente'} onChange={(e) => setEditLead({ ...editLead, status: e.target.value })}><option value="pendente">Pendente</option><option value="enviado">Enviado</option><option value="erro">Erro</option><option value="sem_telefone">Sem telefone</option></select>
          <textarea rows="4" value={editLead.observacao || ''} onChange={(e) => setEditLead({ ...editLead, observacao: e.target.value })} placeholder="Observação" />
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setEditLead(null)}>Cancelar</button><button onClick={saveEdit} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button></div>
      </Modal>}

      {deleteLead && <Modal title="Excluir lead" onClose={() => setDeleteLead(null)}>
        <p>Confirma a exclusão de <strong>{deleteLead.nome_perfil || 'este lead'}</strong>?</p>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setDeleteLead(null)}>Cancelar</button><button className="danger" onClick={removeLead} disabled={busy}>{busy ? 'Excluindo...' : 'Excluir'}</button></div>
      </Modal>}
    </div>
  );
}

function Detail({ label, value }) {
  return <div><small>{label}</small><strong>{value ?? '—'}</strong></div>;
}

function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal-card"><div className="section-heading"><h3>{title}</h3><button className="icon-button" onClick={onClose}>×</button></div>{children}</section></div>;
}
