import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../reports.css';

const IDEA_URL = 'https://github.com/a-castilho/maquinadeleads/issues/new?template=idea.yml';

function ReportBody({ content }) {
  let inCode = false;
  const code = [];
  const blocks = [];
  String(content || '').split('\n').forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (inCode) { blocks.push(<pre key={`c-${index}`}><code>{code.splice(0).join('\n')}</code></pre>); }
      inCode = !inCode; return;
    }
    if (inCode) { code.push(line); return; }
    if (line.startsWith('### ')) blocks.push(<h4 key={index}>{line.slice(4)}</h4>);
    else if (line.startsWith('## ')) blocks.push(<h3 key={index}>{line.slice(3)}</h3>);
    else if (line.startsWith('# ')) blocks.push(<h2 key={index}>{line.slice(2)}</h2>);
    else if (/^[-*] /.test(line)) blocks.push(<div className="report-bullet" key={index}><span>•</span><p>{line.slice(2)}</p></div>);
    else if (line.trim()) blocks.push(<p key={index}>{line}</p>);
  });
  return <div className="report-markdown">{blocks}</div>;
}

export default function Reports() {
  const [report, setReport] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/project-report.json', { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error('Relatório ainda não disponível nesta versão.'); return res.json(); })
      .then(data => { setReport(data); setSelectedId(data.documents?.[0]?.id || ''); })
      .catch(err => setError(err.message));
  }, []);

  const categories = useMemo(() => ['Todos', ...new Set((report?.documents || []).map(item => item.category).filter(Boolean))], [report]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (report?.documents || []).filter(item => (category === 'Todos' || item.category === category) && (!needle || `${item.title} ${item.source} ${item.content}`.toLowerCase().includes(needle)));
  }, [report, query, category]);
  const selected = (report?.documents || []).find(item => item.id === selectedId) || filtered[0];

  async function copy() {
    if (!selected) return;
    await navigator.clipboard.writeText(`[Máquina de Leads · ${selected.category}] ${selected.title}\nFonte: ${selected.source}\n\n${selected.content}`);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  }

  return <div className="reports-page">
    <header className="reports-topbar"><div><span className="eyebrow">HOMOLOGAÇÃO · DOCUMENTAÇÃO VIVA</span><h1>Relatórios do projeto</h1><p>Compare a intenção, o desenvolvimento e o que realmente está funcionando na experiência.</p></div><div className="reports-actions"><Link className="ghost-button" to="/">← Painel</Link><button className="primary-action" onClick={copy} disabled={!selected}>{copied ? 'Copiado' : 'Copiar para conversa'}</button><a className="ghost-button" href={IDEA_URL} target="_blank" rel="noreferrer">+ Nova ideia</a></div></header>
    {error ? <div className="error-box">{error}</div> : !report ? <div className="report-empty">Carregando documentação sanitizada...</div> : <>
      <div className="reports-privacy"><span>✓</span><div><strong>Visualização sanitizada</strong><p>{report.privacy?.notice}</p></div></div>
      <div className="reports-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar em relatórios, issues e ideias..."/><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(item=><option key={item}>{item}</option>)}</select></div>
      <div className="reports-layout"><aside className="report-index">{filtered.map(item=><button key={item.id} className={selected?.id===item.id?'report-item active':'report-item'} onClick={()=>setSelectedId(item.id)}><span>{item.category}</span><strong>{item.title}</strong><small>{item.source}</small></button>)}{!filtered.length&&<div className="report-empty">Nenhum documento encontrado.</div>}</aside><article className="report-reader">{selected?<><div className="report-reader-head"><div><span>{selected.category}</span><h2>{selected.title}</h2></div><code>{selected.source}</code></div><ReportBody content={selected.content}/></>:<div className="report-empty">Selecione um documento.</div>}</article></div>
    </>}
  </div>;
}
