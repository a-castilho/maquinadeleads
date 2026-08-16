import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AiKeywordAssistant({ campaignId, onGenerated }) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-5-mini');
  const [instruction, setInstruction] = useState('Priorize termos que encontrem empresas brasileiras compatíveis com o ICP e sinais claros de operação/comercial.');
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState([]);

  async function load() {
    try {
      const [credRes, runRes] = await Promise.all([
        api.get(`/niches/${campaignId}/credentials`),
        api.get(`/niches/${campaignId}/ai/keyword-runs`),
      ]);
      const openai = (credRes.data.credentials || []).find((item) => item.provider === 'openai');
      setConfigured(Boolean(openai?.has_api_key));
      if (openai?.extra_config?.model) setModel(openai.extra_config.model);
      if (openai?.extra_config?.promptInstruction) setInstruction(openai.extra_config.promptInstruction);
      setRuns(runRes.data.runs || []);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Não foi possível carregar o módulo de IA.');
    }
  }

  useEffect(() => { load(); }, [campaignId]);

  async function saveKey(e) {
    e.preventDefault();
    setSaving(true); setMessage('');
    try {
      await api.put(`/niches/${campaignId}/credentials`, {
        provider: 'openai',
        apiKey: apiKey.trim() || undefined,
        extraConfig: { model: model.trim() || 'gpt-5-mini', promptInstruction: instruction.trim() },
      });
      setApiKey('');
      setConfigured(true);
      setMessage('Configuração da IA salva. A chave não é exibida novamente.');
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao salvar configuração de IA.');
    } finally { setSaving(false); }
  }

  async function generate() {
    setGenerating(true); setMessage('');
    try {
      const { data } = await api.post(`/niches/${campaignId}/ai/keywords/generate`, { instruction });
      const mode = data.fallback ? 'fallback local' : `IA (${data.model})`;
      setMessage(`Termos gerados via ${mode}: ${data.principal.length} principais, ${data.contexto.length} de contexto, ${data.inserted} novos.`);
      await load();
      if (onGenerated) await onGenerated();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao gerar termos de descoberta.');
    } finally { setGenerating(false); }
  }

  return (
    <section className="card" style={{ background: 'rgba(37,99,235,.12)', borderColor: 'rgba(96,165,250,.28)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>IA para termos de descoberta</h2>
          <p className="hint">Usa o Perfil da Empresa + ICP + campanha para criar termos prontos para prospecção.</p>
        </div>
        <span className="badge">{configured ? 'IA configurada' : 'Fallback disponível'}</span>
      </div>

      <form className="stacked-form" onSubmit={saveKey} style={{ marginTop: 14 }}>
        <label><strong>OpenAI API key</strong>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={configured ? 'Deixe vazio para manter a chave atual' : 'sk-...'} autoComplete="off" />
        </label>
        <label><strong>Modelo</strong>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-5-mini" />
        </label>
        <label><strong>Prompt / instrução complementar</strong>
          <textarea rows={4} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex.: priorizar clínicas de MG com sinais de expansão..." />
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar configuração da IA'}</button>
          <button type="button" onClick={generate} disabled={generating}>{generating ? 'Gerando termos...' : 'Gerar termos pelo perfil'}</button>
        </div>
      </form>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}

      <div style={{ marginTop: 16 }}>
        <h3>Últimas execuções</h3>
        {!runs.length ? <p className="hint">Nenhuma geração registrada ainda.</p> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {runs.slice(0, 5).map((run) => (
              <div key={run.id} style={{ padding: 10, borderRadius: 10, background: 'rgba(15,23,42,.45)', border: '1px solid rgba(148,163,184,.18)' }}>
                <strong>{run.provider === 'openai' ? `OpenAI · ${run.model}` : 'Fallback local'}</strong>
                <div className="hint">{run.principal_count} principais · {run.context_count} contexto · perfil {run.profile_completeness || 0}% · {new Date(run.created_at).toLocaleString('pt-BR')}</div>
                {run.error_message && <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 4 }}>IA falhou e houve fallback: {run.error_message}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
