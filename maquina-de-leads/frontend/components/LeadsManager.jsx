import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';

export default function LeadsManager({ nicheId }) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [fontesStats, setFontesStats] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [fonteFilter, setFonteFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fontes, setFontes] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modais
  const [detailLead, setDetailLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [deleteLead, setDeleteLead] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        api.get(`/niches/${nicheId}/leads`, {
          params: {
            status: statusFilter || undefined,
            fonte: fonteFilter || undefined,
            search: search || undefined,
            page,
            pageSize
          }
        }),
        api.get(`/niches/${nicheId}/leads/stats`)
      ]);

      setLeads(leadsRes.data.leads || []);
      setTotal(leadsRes.data.total || 0);
      setTotalPages(leadsRes.data.totalPages || 1);
      setFontes(leadsRes.data.fontes || []);
      setStats(statsRes.data.stats || []);
      setTimeline(statsRes.data.timeline || []);
      setFontesStats(statsRes.data.fontes || []);
    } catch (err) {
      console.error('Erro ao carregar leads:', err);
    } finally {
      setLoading(false);
    }
  }, [nicheId, statusFilter, fonteFilter, search, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map((l) => l.id));
    }
  }

  async function handleBulkUpdate(status) {
    if (selectedIds.length === 0) return;
    await api.post(`/niches/${nicheId}/leads/bulk`, { ids: selectedIds, status });
    setSelectedIds([]);
    load();
  }

  async function handleDelete(id) {
    await api.delete(`/niches/${nicheId}/leads/${id}`);
    setDeleteLead(null);
    load();
  }

  async function handleSaveEdit() {
    if (!editLead) return;
    await api.put(`/niches/${nicheId}/leads/${editLead.id}`, {
      nome_perfil: editLead.nome_perfil,
      whatsapp: editLead.whatsapp,
      status: editLead.status,
      observacao: editLead.observacao
    });
    setEditLead(null);
    load();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '-';
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    if (hours < 1) return 'Agora';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  function statusColor(status) {
    switch (status) {
      case 'pendente': return { bg: '#fef3c7', text: '#92400e', label: 'Pendente' };
      case 'enviado': return { bg: '#d1fae5', text: '#065f46', label: 'Enviado' };
      case 'erro': return { bg: '#fee2e2', text: '#991b1b', label: 'Erro' };
      case 'sem_telefone': return { bg: '#f3f4f6', text: '#4b5563', label: 'Sem telefone' };
      default: return { bg: '#f3f4f6', text: '#374151', label: status };
    }
  }

  return (
    <div>
      {/* Estatisticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        {stats.map((s) => {
          const sc = statusColor(s.status);
          return (
            <div key={s.status} style={{
              padding: '12px 16px', borderRadius: '10px', background: sc.bg,
              border: `1px solid ${sc.text}20`, cursor: 'pointer'
            }} onClick={() => setStatusFilter(s.status === statusFilter ? '' : s.status)}>
              <div style={{ fontSize: '22px', fontWeight: 600, color: sc.text }}>{s.total}</div>
              <div style={{ fontSize: '12px', color: sc.text, opacity: 0.8 }}>{sc.label}</div>
            </div>
          );
        })}
        <div style={{
          padding: '12px 16px', borderRadius: '10px', background: '#f0f9ff',
          border: '1px solid #bae6fd', cursor: 'pointer'
        }} onClick={() => { setStatusFilter(''); setSearch(''); setFonteFilter(''); }}>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#0369a1' }}>{total}</div>
          <div style={{ fontSize: '12px', color: '#0369a1', opacity: 0.8 }}>Total</div>
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
            Leads nos ultimos 30 dias
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px' }}>
            {timeline.slice(0, 14).reverse().map((t) => (
              <div key={t.data} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%', background: '#3b82f6', borderRadius: '3px 3px 0 0',
                  height: `${Math.min(50, Math.max(4, (t.total / Math.max(...timeline.map(x => x.total))) * 50))}px`
                }} />
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                  {new Date(t.data).getDate()}/{new Date(t.data).getMonth() + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fontes */}
      {fontesStats.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {fontesStats.map((f) => (
            <span key={f.fonte} style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
              background: '#f1f5f9', color: '#475569'
            }}>
              {f.fonte}: <strong>{f.total}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="erro">Erro</option>
          <option value="sem_telefone">Sem telefone</option>
        </select>
        <select value={fonteFilter} onChange={(e) => { setFonteFilter(e.target.value); setPage(1); }}>
          <option value="">Todas as fontes</option>
          {fontes.map((f) => (
            <option key={f} value={f}>{f?.slice(0, 60)}...</option>
          ))}
        </select>
        <input
          placeholder="Buscar nome, whatsapp, texto..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          <option value={10}>10 por pagina</option>
          <option value={25}>25 por pagina</option>
          <option value={50}>50 por pagina</option>
          <option value={100}>100 por pagina</option>
        </select>
      </div>

      {/* Acoes em lote */}
      {selectedIds.length > 0 && (
        <div style={{
          padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: '8px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'center'
        }}>
          <span style={{ fontSize: '13px', color: '#1e40af' }}>
            <strong>{selectedIds.length}</strong> leads selecionados
          </span>
          <button onClick={() => handleBulkUpdate('pendente')} style={{
            fontSize: '12px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #d1d5db',
            background: 'white', cursor: 'pointer'
          }}>Marcar Pendente</button>
          <button onClick={() => handleBulkUpdate('enviado')} style={{
            fontSize: '12px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #d1d5db',
            background: 'white', cursor: 'pointer'
          }}>Marcar Enviado</button>
          <button onClick={() => handleBulkUpdate('erro')} style={{
            fontSize: '12px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #d1d5db',
            background: 'white', cursor: 'pointer'
          }}>Marcar Erro</button>
          <button onClick={() => setSelectedIds([])} style={{
            fontSize: '12px', padding: '4px 10px', borderRadius: '4px', border: 'none',
            background: 'transparent', color: '#6b7280', cursor: 'pointer', marginLeft: 'auto'
          }}>Limpar selecao</button>
        </div>
      )}

      {/* Tabela */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '10px 8px', width: '30px' }}>
                <input type="checkbox" checked={selectedIds.length === leads.length && leads.length > 0} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: '10px 8px' }}>Nome</th>
              <th style={{ padding: '10px 8px' }}>WhatsApp</th>
              <th style={{ padding: '10px 8px' }}>Status</th>
              <th style={{ padding: '10px 8px' }}>Query</th>
              <th style={{ padding: '10px 8px' }}>Fonte</th>
              <th style={{ padding: '10px 8px' }}>Data</th>
              <th style={{ padding: '10px 8px', width: '100px' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const sc = statusColor(l.status);
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px' }}>
                    <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggleSelect(l.id)} />
                  </td>
                  <td style={{ padding: '8px', fontWeight: 500 }}>{l.nome_perfil || '—'}</td>
                  <td style={{ padding: '8px' }}>
                    {l.whatsapp ? (
                      <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {l.whatsapp}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                      background: sc.bg, color: sc.text
                    }}>
                      {sc.label}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.original_query || '—'}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {l.fonte_url ? (
                      <a href={l.fonte_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '12px' }}>link</a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '8px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {formatDate(l.created_at)}
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{timeAgo(l.created_at)}</div>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => setDetailLead(l)} style={{
                        fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #d1d5db',
                        background: 'white', cursor: 'pointer'
                      }}>Ver</button>
                      <button onClick={() => setEditLead({ ...l })} style={{
                        fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #d1d5db',
                        background: 'white', cursor: 'pointer'
                      }}>Editar</button>
                      <button onClick={() => setDeleteLead(l)} style={{
                        fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fecaca',
                        background: '#fef2f2', color: '#dc2626', cursor: 'pointer'
                      }}>Excluir</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {leads.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          Nenhum lead encontrado.
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
          Carregando...
        </div>
      )}

      {/* Paginacao */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '13px' }}>
        <span style={{ color: '#64748b' }}>
          Mostrando {leads.length} de {total} leads
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{
            padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
            background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1
          }}>Anterior</button>
          <span style={{ padding: '6px 12px', color: '#475569' }}>
            Pagina {page} de {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{
            padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
            background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1
          }}>Proxima</button>
        </div>
      </div>

      {/* Modal: Detalhes */}
      {detailLead && (
        <Modal onClose={() => setDetailLead(null)} title="Detalhes do Lead">
          <div style={{ fontSize: '14px' }}>
            <DetailRow label="Nome" value={detailLead.nome_perfil} />
            <DetailRow label="WhatsApp" value={detailLead.whatsapp} />
            <DetailRow label="Link WhatsApp" value={detailLead.link_whatsapp} isLink />
            <DetailRow label="Status" value={detailLead.status} />
            <DetailRow label="Query de busca" value={detailLead.original_query} />
            <DetailRow label="Snippet" value={detailLead.snippet} />
            <DetailRow label="Fonte" value={detailLead.fonte_url} isLink />
            <DetailRow label="Criado em" value={formatDate(detailLead.created_at)} />
            <DetailRow label="Ultima atualizacao" value={formatDate(detailLead.updated_at)} />
            {detailLead.observacao && <DetailRow label="Observacao" value={detailLead.observacao} />}
          </div>
        </Modal>
      )}

      {/* Modal: Editar */}
      {editLead && (
        <Modal onClose={() => setEditLead(null)} title="Editar Lead">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#475569' }}>
              Nome do perfil
              <input
                value={editLead.nome_perfil || ''}
                onChange={(e) => setEditLead({ ...editLead, nome_perfil: e.target.value })}
                style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </label>
            <label style={{ fontSize: '13px', color: '#475569' }}>
              WhatsApp
              <input
                value={editLead.whatsapp || ''}
                onChange={(e) => setEditLead({ ...editLead, whatsapp: e.target.value })}
                style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </label>
            <label style={{ fontSize: '13px', color: '#475569' }}>
              Status
              <select
                value={editLead.status || 'pendente'}
                onChange={(e) => setEditLead({ ...editLead, status: e.target.value })}
                style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              >
                <option value="pendente">Pendente</option>
                <option value="enviado">Enviado</option>
                <option value="erro">Erro</option>
                <option value="sem_telefone">Sem telefone</option>
              </select>
            </label>
            <label style={{ fontSize: '13px', color: '#475569' }}>
              Observacao
              <textarea
                value={editLead.observacao || ''}
                onChange={(e) => setEditLead({ ...editLead, observacao: e.target.value })}
                rows={3}
                style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={handleSaveEdit} style={{
                padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontWeight: 500
              }}>Salvar</button>
              <button onClick={() => setEditLead(null)} style={{
                padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db',
                borderRadius: '8px', cursor: 'pointer'
              }}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Confirmar exclusao */}
      {deleteLead && (
        <Modal onClose={() => setDeleteLead(null)} title="Confirmar exclusao">
          <p style={{ fontSize: '14px', color: '#475569' }}>
            Tem certeza que deseja excluir o lead <strong>{deleteLead.nome_perfil || 'sem nome'}</strong>?
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={() => handleDelete(deleteLead.id)} style={{
              padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none',
              borderRadius: '8px', cursor: 'pointer', fontWeight: 500
            }}>Sim, excluir</button>
            <button onClick={() => setDeleteLead(null)} style={{
              padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db',
              borderRadius: '8px', cursor: 'pointer'
            }}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DetailRow({ label, value, isLink }) {
  if (!value) return null;
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: '#1e293b', marginTop: '2px' }}>
        {isLink ? (
          <a href={value} target="_blank" rel="noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>{value}</a>
        ) : (
          <span style={{ wordBreak: 'break-word' }}>{value}</span>
        )}
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%',
        maxHeight: '80vh', overflow: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8'
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
