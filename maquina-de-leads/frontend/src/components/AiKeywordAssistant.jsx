import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

export default function AiKeywordAssistant({ campaignId, onGenerated }) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-5-mini');
  const [country, setCountry] = useState('Brasil');
  const [language, setLanguage] = useState('pt-BR');
  const [instruction, setInstruction] = useState('Priorize empresas brasileiras compatíveis com o ICP e sinais claros de operação comercial.');
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [runs, setRuns] = useState([]);
  const [messages, setMessages] = useState([]);

  async function load() {
    try {
      const [credRes, runRes, chatRes] = await Promise.all([
        api.get(`/niches/${campaignId}/credentials`),
        api.get(`/niches/${campaignId}/ai/keyword-runs`),
        api.get(`/niches/${campaignId}/ai/keywords/chat`),
      ]);
      const openai = (credRes.data.credentials || []).find((item) => item.provider === 'openai');
      setConfigured(Boolean(openai?.has_api_key));
      if (openai?.extra_config?.model) setModel(openai.extra_config.model);
      if (openai?.extra_config?.country) setCountry(openai.extra_config.country);
      if (openai?.extra_config?.language) setLanguage(openai.extra_config.language);
      if (openai?.extra_config?.specialistInstruction) setInstruction(openai.extra_config.specialistInstruction);
      else if (openai?.extra_config?.promptInstruction) setInstruction(openai.extra_config.promptInstruction);
      setRuns(runRes.data.runs || []);
      setMessages(chatRes.data.messages || []);
      console.info('[ai-keyword-ui] loaded', { campaignId, configured: Boolean(openai?.has_api_key), messages: chatRes.data.messages?.length || 0 });
    } catch (err) {
      console.error('[ai-keyword-ui] load failed', err);
      setStatus(err.response?.data?.error || 'Não foi possível carregar o módulo de IA.');
    }
  }

  useEffect(() => { load(); }, [campaignId]);

  const lastSuggestion = useMemo(() => [...messages].reverse().find((item) => item.role === 'assistant'), [messages]);

  async function saveKey(e) {
    e.preventDefault();
    setSaving(true); setStatus('');
    try {
      console.info('[ai-keyword-ui] saving configuration', { campaignId, model, country, language, replacingKey: Boolean(apiKey.trim()) });
      await api.put(`/niches/${campaignId}/credentials`, {
        provider: 'openai',
        apiKey: apiKey.trim() || undefined,
        extraConfig: {
          model: model.trim() || 'gpt-5-mini',
          country: country.trim() || 'Brasil',
          language: language.trim() || 'pt-BR',
          specialistInstruction: instruction.trim(),
          promptInstruction: instruction.trim(),
        },
      });
      setApiKey('');
      setConfigured(true);
      setStatus('Configuração da IA salva. A chave não é exibida novamente.');
      await load();
    } catch (err) {
      console.error('[ai-keyword-ui] configuration save failed', err);
      setStatus(err.response?.data?.error || 'Erro ao salvar configuração de IA.');
    } finally { setSaving(false); }
  }

  async function generate() {
    setGenerating(true); setStatus('');
    try {
      console.info('[ai-keyword-ui] automatic generation started', { campaignId });
      const { data } = await api.post(`/niches/${campaignId}/ai/keywords/generate`, { instruction });
      const mode = data.fallback ? 'fallback local' : `IA (${data.model})`;
      setStatus(`Termos gerados via ${mode}: ${data.principal.length} principais, ${data.contexto.length} de contexto, ${data.inserted} novos.`);
      await load();
      if (onGenerated) await onGenerated();
    } catch (err) {
      console.error('[ai-keyword-ui] automatic generation failed', err);
      setStatus(err.response?.data?.error || 'Erro ao gerar termos de descoberta.');
    } finally { setGenerating(false); }
  }

  async function sendChat(e) {
    e?.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSending(true); setStatus('');
    try {
      console.info('[ai-keyword-ui] chat send', { campaignId, chars: text.length });
      const { data } = await api.post(`/niches/${campaignId}/ai/keywords/chat`, { message: text });
      setMessage('');
      setMessages((current) => [...current,
        { id: `local-user-${Date.now()}`, role: 'user', content: text, principal: [], contexto: [], negativas: [] },
        data.message,
      ]);
      if (data.message?.fallback) setStatus('A resposta foi gerada pelo fallback local. Cadastre uma chave válida para conversar com o modelo de IA.');
    } catch (err) {
      console.error('[ai-keyword-ui] chat failed', err);
      setStatus(err.response?.data?.error || 'Erro ao conversar com o especialista.');
    } finally { setSending(false); }
  }

  async function applySuggestion(suggestion = lastSuggestion) {
    if (!suggestion) return;
    const principal = suggestion.principal || [];
    const contexto = suggestion.contexto || [];
    if (!principal.length && !contexto.length) return;
    setStatus('Aplicando sugestões...');
    try {
      if (principal.length) await api.post(`/niches/${campaignId}/keywords`, { terms: principal, kind: 'nicho' });
      if (contexto.length) await api.post(`/niches/${campaignId}/keywords`, { terms: contexto, kind: 'contexto' });
      console.info('[ai-keyword-ui] suggestions applied', { campaignId, principal: principal.length, contexto: contexto.length });
      setStatus(`${principal.length} termos principais e ${contexto.length} termos de contexto enviados para a estratégia da campanha.`);
      if (onGenerated) await onGenerated();
    } catch (err) {
      console.error('[ai-keyword-ui] apply suggestions failed', err);
      setStatus(err.response?.data?.error || 'Erro ao aplicar sugestões.');
    }
  }

  async function clearChat() {
    if (!messages.length) return;
    if (!window.confirm('Limpar o histórico desta conversa com o especialista?')) return;
    try {
      await api.delete(`/niches/${campaignId}/ai/keywords/chat`);
      setMessages([]);
      setStatus('Conversa limpa.');
    } catch (err) {
      setStatus(err.response?.data?.error || 'Erro ao limpar conversa.');
    }
  }

  const suggestionChips = (items = [], className = '') => (
    <div className="chip-list">
      {items.map((item) => <span className={`chip ${className}`} key={item}>{item}</span>)}
    </div>
  );

  return (
    <section className="card ai-specialist-card">
      <div className="ai-specialist-header">
        <div>
          <span className="eyebrow">IA ESPECIALISTA</span>
          <h2>Especialista em palavras-chave e descoberta</h2>
          <p className="hint">Converse com a IA usando o Perfil da Empresa, ICP e objetivo desta campanha como contexto.</p>
        </div>
        <span className={`status-badge ${configured ? 'status-running' : 'status-paused'}`}>
          {configured ? 'Chave configurada' : 'Fallback local'}
        </span>
      </div>

      <details className="ai-config-panel" open={!configured}>
        <summary>Configuração da IA</summary>
        <form onSubmit={saveKey} className="ai-config-grid">
          <label className="ai-field ai-span-2"><span>OpenAI API key</span>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={configured ? 'Deixe vazio para manter a chave atual' : 'Cole a chave da API'} autoComplete="off" />
            <small>A chave é enviada ao backend e não é retornada pela API da aplicação.</small>
          </label>
          <label className="ai-field"><span>Modelo</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-5-mini" />
          </label>
          <label className="ai-field"><span>País / mercado</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Brasil" />
          </label>
          <label className="ai-field"><span>Idioma</span>
            <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="pt-BR" />
          </label>
          <label className="ai-field ai-span-2"><span>Instrução permanente do especialista</span>
            <textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex.: priorize clínicas de MG, empresas com WhatsApp e sinais de expansão..." />
          </label>
          <div className="ai-config-actions ai-span-2">
            <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar configuração'}</button>
            <button type="button" className="secondary-button" onClick={generate} disabled={generating}>{generating ? 'Gerando...' : 'Gerar estratégia automaticamente'}</button>
          </div>
        </form>
      </details>

      <div className="ai-chat-shell">
        <div className="ai-chat-toolbar">
          <div><strong>Conversa com especialista</strong><span>{messages.length} mensagens</span></div>
          <button type="button" className="secondary-button" onClick={clearChat} disabled={!messages.length}>Limpar conversa</button>
        </div>

        <div className="ai-chat-messages">
          {!messages.length && (
            <div className="ai-chat-empty">
              <strong>Comece pela estratégia de busca</strong>
              <p>Exemplos: “Quero encontrar clínicas odontológicas em MG com WhatsApp”, “Quais termos estão genéricos demais?” ou “Refine o contexto para encontrar CNPJ e telefone”.</p>
            </div>
          )}
          {messages.map((item) => (
            <div key={item.id} className={`ai-chat-message ${item.role}`}>
              <div className="ai-message-role">{item.role === 'assistant' ? 'Especialista IA' : 'Você'}</div>
              <div className="ai-message-content">{item.content}</div>
              {item.role === 'assistant' && ((item.principal || []).length > 0 || (item.contexto || []).length > 0) && (
                <div className="ai-message-suggestions">
                  {(item.principal || []).length > 0 && <><strong>Principais</strong>{suggestionChips(item.principal, 'ai-chip-principal')}</>}
                  {(item.contexto || []).length > 0 && <><strong>Contexto</strong>{suggestionChips(item.contexto, 'ai-chip-context')}</>}
                  {(item.negativas || []).length > 0 && <><strong>Evitar</strong>{suggestionChips(item.negativas, 'ai-chip-negative')}</>}
                  <button type="button" onClick={() => applySuggestion(item)}>Aplicar estes termos na campanha</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <form className="ai-chat-composer" onSubmit={sendChat}>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Converse com o especialista sobre nicho, região, ICP, palavras-chave, contexto, WhatsApp, CNPJ, telefone..." />
          <button type="submit" disabled={sending || !message.trim()}>{sending ? 'Analisando...' : 'Enviar para especialista'}</button>
        </form>
      </div>

      {status && <div className="ai-status-message">{status}</div>}

      {runs.length > 0 && (
        <details className="ai-run-history">
          <summary>Últimas gerações automáticas</summary>
          <div className="ai-run-list">
            {runs.slice(0, 5).map((run) => (
              <div key={run.id} className="ai-run-row">
                <strong>{run.provider === 'openai' ? `OpenAI · ${run.model}` : 'Fallback local'}</strong>
                <span>{run.principal_count} principais · {run.context_count} contexto · perfil {run.profile_completeness || 0}% · {new Date(run.created_at).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
