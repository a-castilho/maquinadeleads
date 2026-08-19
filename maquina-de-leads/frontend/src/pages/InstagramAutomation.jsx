import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import '../instagram-automation.css';

const STORAGE_KEY = 'maquina-leads-instagram-profile';

const initialProfile = {
  companyName: '',
  segment: '',
  city: '',
  audience: '',
  tone: 'profissional, acolhedor e confiável',
  offer: '',
  objective: 'gerar novos contatos e oportunidades',
  instagram: '',
};

const emptyContent = {
  headline: '',
  caption: '',
  cta: '',
  hashtags: [],
  narration: '',
  imagePrompt: '',
  format: 'reel',
  aspectRatio: '9:16',
  durationSeconds: 15,
};

function Field({ label, children, wide = false }) {
  return (
    <label className={`ia-field ${wide ? 'ia-field-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function StepCard({ number, title, icon, children, className = '' }) {
  return (
    <article className={`ia-card ${className}`}>
      <header className="ia-card-header">
        <span className="ia-step-number">{number}</span>
        <h2>{title}</h2>
        <span className="ia-card-icon" aria-hidden="true">{icon}</span>
      </header>
      <div className="ia-card-body">{children}</div>
    </article>
  );
}

export default function InstagramAutomation() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(initialProfile);
  const [content, setContent] = useState(emptyContent);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [capabilities, setCapabilities] = useState(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') setProfile((current) => ({ ...current, ...saved }));
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }

    api.get('/instagram-automation/capabilities')
      .then((res) => setCapabilities(res.data.capabilities || null))
      .catch(() => setCapabilities(null));
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis?.getVoices?.() || [];
      setVoices(available);
      if (!voiceName && available.length) {
        const preferred = available.find((voice) => voice.lang?.toLowerCase().startsWith('pt-br')) || available[0];
        setVoiceName(preferred?.name || '');
      }
    };
    loadVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis?.cancel?.();
    };
  }, [voiceName]);

  const completion = useMemo(() => {
    const keys = ['companyName', 'segment', 'city', 'audience', 'offer', 'instagram'];
    const filled = keys.filter((key) => String(profile[key] || '').trim()).length;
    return Math.round((filled / keys.length) * 100);
  }, [profile]);

  const hasContent = Boolean(content.headline && content.caption && content.narration);

  function updateProfile(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function saveProfile() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setMessage('Perfil da empresa salvo neste navegador.');
    setError('');
  }

  async function generateContent() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/instagram-automation/generate', { profile });
      setContent(res.data.content || emptyContent);
      setCapabilities(res.data.capabilities || capabilities);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      setMessage('Conteúdo, roteiro e prompt visual gerados com sucesso.');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível gerar o conteúdo.');
    } finally {
      setLoading(false);
    }
  }

  function speakNarration() {
    if (!content.narration || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content.narration);
    const selected = voices.find((voice) => voice.name === voiceName);
    if (selected) utterance.voice = selected;
    utterance.lang = selected?.lang || 'pt-BR';
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopNarration() {
    window.speechSynthesis?.cancel?.();
    setSpeaking(false);
  }

  async function publish(now = false) {
    setPublishing(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/instagram-automation/publish', {
        profile,
        content,
        scheduleAt: now ? null : scheduleAt || null,
      });
      const status = res.data.publication?.status === 'scheduled' ? 'agendada' : 'enfileirada';
      setMessage(`Publicação ${status} com sucesso.`);
    } catch (err) {
      if (err.response?.data?.code === 'INSTAGRAM_INTEGRATION_REQUIRED') {
        setCapabilities(err.response.data.capabilities || capabilities);
        setError('Conteúdo pronto. Falta conectar a conta profissional do Instagram para publicar automaticamente.');
      } else {
        setError(err.response?.data?.error || 'Não foi possível preparar a publicação.');
      }
    } finally {
      setPublishing(false);
    }
  }

  const hashtagText = content.hashtags?.join(' ') || '';
  const profileHandle = profile.instagram ? (profile.instagram.startsWith('@') ? profile.instagram : `@${profile.instagram}`) : '@suaempresa';

  return (
    <div className="ia-shell">
      <aside className="ia-sidebar">
        <Link to="/" className="ia-brand">
          <span className="ia-brand-mark">A</span>
          <span><strong>Máquina</strong><small>de Leads</small></span>
        </Link>
        <nav>
          <Link to="/">⌂ <span>Dashboard</span></Link>
          <a href="#empresa">▦ <span>Empresa</span></a>
          <a className="active" href="#automacao">◎ <span>Instagram Automático</span></a>
          <a href="#conteudo">▤ <span>Conteúdo</span></a>
          <a href="#narracao">◖ <span>Áudio</span></a>
          <a href="#imagem">▧ <span>Imagem</span></a>
          <a href="#publicacao">◫ <span>Agendamento</span></a>
        </nav>
        <div className="ia-sidebar-footer">
          <span>{user?.name || 'Usuário'}</span>
          <button onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="ia-main" id="automacao">
        <header className="ia-topbar">
          <div>
            <span className="ia-breadcrumb">Automação / Redes sociais</span>
            <h1>Instagram Automático</h1>
            <p>Cadastre a empresa, gere o conteúdo, ouça a narração e prepare a publicação em um único fluxo.</p>
          </div>
          <div className="ia-top-actions">
            <span className={`ia-status-pill ${capabilities?.publishConfigured ? 'ready' : ''}`}>
              <i /> {capabilities?.publishConfigured ? 'Instagram conectado' : 'Conteúdo ativo'}
            </span>
            <button className="ia-button secondary" onClick={saveProfile}>Salvar perfil</button>
            <button className="ia-button primary" onClick={generateContent} disabled={loading}>
              {loading ? 'Gerando...' : 'Gerar conteúdo'}
            </button>
          </div>
        </header>

        <div className="ia-tabs">
          <button className="active">Visão geral</button>
          <button>Campanhas</button>
          <button>Agendamentos</button>
          <button>Histórico</button>
        </div>

        {(message || error) && <div className={`ia-alert ${error ? 'error' : 'success'}`}>{error || message}</div>}

        <section className="ia-summary-grid">
          <article><span>Perfil completo</span><strong>{completion}%</strong><small>dados usados pela automação</small></article>
          <article><span>Formato</span><strong>Reel</strong><small>9:16 com narração</small></article>
          <article><span>Duração sugerida</span><strong>{content.durationSeconds || 15}s</strong><small>conteúdo direto ao ponto</small></article>
          <article><span>Publicação</span><strong>{capabilities?.publishConfigured ? 'Pronta' : 'Pendente'}</strong><small>{capabilities?.publishConfigured ? 'integração configurada' : 'conectar conta profissional'}</small></article>
        </section>

        <section className="ia-workflow-grid">
          <StepCard number="1" title="Cadastro da Empresa" icon="▦" className="ia-company-card">
            <div className="ia-form-grid" id="empresa">
              <Field label="Nome da empresa"><input value={profile.companyName} onChange={(e) => updateProfile('companyName', e.target.value)} placeholder="Ex.: Clínica Vitalis" /></Field>
              <Field label="Segmento"><input value={profile.segment} onChange={(e) => updateProfile('segment', e.target.value)} placeholder="Ex.: Saúde / Estética" /></Field>
              <Field label="Cidade ou região"><input value={profile.city} onChange={(e) => updateProfile('city', e.target.value)} placeholder="Ex.: Curitiba - PR" /></Field>
              <Field label="Instagram"><input value={profile.instagram} onChange={(e) => updateProfile('instagram', e.target.value)} placeholder="@clinicavitalis" /></Field>
              <Field label="Público-alvo" wide><input value={profile.audience} onChange={(e) => updateProfile('audience', e.target.value)} placeholder="Ex.: mulheres de 25 a 45 anos" /></Field>
              <Field label="Produto ou serviço" wide><input value={profile.offer} onChange={(e) => updateProfile('offer', e.target.value)} placeholder="Ex.: tratamentos estéticos e bem-estar" /></Field>
              <Field label="Tom da comunicação" wide><input value={profile.tone} onChange={(e) => updateProfile('tone', e.target.value)} /></Field>
              <Field label="Objetivo" wide><input value={profile.objective} onChange={(e) => updateProfile('objective', e.target.value)} /></Field>
            </div>
            <div className="ia-card-footer"><span className="ia-ok-dot">✓</span><span>Perfil alimenta automaticamente texto, imagem e narração.</span></div>
          </StepCard>

          <StepCard number="2" title="Conteúdo Gerado" icon="✦" className="ia-content-card">
            <div id="conteudo" className="ia-generated-fields">
              <Field label="Headline"><input value={content.headline} onChange={(e) => setContent((current) => ({ ...current, headline: e.target.value }))} placeholder="Gere o conteúdo para começar" /></Field>
              <Field label="Legenda" wide><textarea rows="6" value={content.caption} onChange={(e) => setContent((current) => ({ ...current, caption: e.target.value }))} placeholder="Legenda automática" /></Field>
              <Field label="CTA" wide><textarea rows="2" value={content.cta} onChange={(e) => setContent((current) => ({ ...current, cta: e.target.value }))} placeholder="Chamada para ação" /></Field>
              <Field label="Hashtags" wide><textarea rows="2" value={hashtagText} onChange={(e) => setContent((current) => ({ ...current, hashtags: e.target.value.split(/\s+/).filter(Boolean) }))} /></Field>
            </div>
            <button className="ia-inline-action" onClick={generateContent} disabled={loading}>↻ Regenerar conteúdo</button>
          </StepCard>

          <StepCard number="3" title="Imagem de Fundo" icon="▧" className="ia-image-card">
            <div className="ia-artwork" id="imagem">
              <div className="ia-artwork-glow ia-artwork-glow-one" />
              <div className="ia-artwork-glow ia-artwork-glow-two" />
              <span className="ia-artwork-kicker">{profile.segment || 'Sua marca'}</span>
              <strong>{content.headline || 'Sua mensagem principal aparece aqui.'}</strong>
              <small>{profile.companyName || 'Nome da empresa'}</small>
            </div>
            <div className="ia-prompt-box"><span>Prompt visual</span><p>{content.imagePrompt || 'Ao gerar o conteúdo, o sistema cria também um prompt visual 9:16 pronto para um provedor de imagem.'}</p></div>
          </StepCard>

          <StepCard number="4" title="Narração" icon="◖" className="ia-audio-card">
            <div id="narracao">
              <Field label="Texto para narração" wide><textarea rows="5" value={content.narration} onChange={(e) => setContent((current) => ({ ...current, narration: e.target.value }))} placeholder="O roteiro da narração aparecerá aqui." /></Field>
              <Field label="Voz" wide>
                <select value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
                  {voices.length === 0 && <option value="">Voz padrão do navegador</option>}
                  {voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} — {voice.lang}</option>)}
                </select>
              </Field>
              <div className="ia-audio-player">
                <button onClick={speaking ? stopNarration : speakNarration} disabled={!content.narration}>{speaking ? '■' : '▶'}</button>
                <div><strong>{speaking ? 'Reproduzindo narração' : 'Prévia de voz'}</strong><span>Speech Synthesis • pt-BR</span></div>
                <span>{content.durationSeconds || 15}s</span>
              </div>
            </div>
          </StepCard>

          <StepCard number="5" title="Prévia do Reel" icon="◉" className="ia-preview-card">
            <div className="ia-phone">
              <div className="ia-phone-notch" />
              <div className="ia-phone-screen">
                <div className="ia-reel-top"><span>Reels</span><span>◫</span></div>
                <div className="ia-reel-copy">
                  <strong>{content.headline || 'Gere seu primeiro conteúdo'}</strong>
                  <span>{profile.companyName || 'Sua empresa'}</span>
                </div>
                <div className="ia-reel-side"><span>♡<small>256</small></span><span>◯<small>18</small></span><span>➤<small>32</small></span></div>
                <div className="ia-reel-bottom"><strong>{profileHandle}</strong><p>{content.caption || 'A legenda gerada aparecerá nesta prévia.'}</p><span>♫ Áudio original</span></div>
              </div>
            </div>
          </StepCard>

          <StepCard number="6" title="Publicação" icon="➤" className="ia-publish-card">
            <div id="publicacao" className="ia-publish-actions">
              <button className="preview"><span>◉</span><div><strong>Pré-visualizar</strong><small>Revise texto, imagem e áudio.</small></div></button>
              <button className="approve" disabled={!hasContent}><span>✓</span><div><strong>Aprovar</strong><small>Marque o pacote como pronto.</small></div></button>
              <label className="schedule"><span>◫</span><div><strong>Agendar</strong><small>Escolha data e hora.</small><input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} /></div></label>
              <button className="publish" onClick={() => publish(true)} disabled={!hasContent || publishing}><span>➤</span><div><strong>{publishing ? 'Preparando...' : 'Postar agora'}</strong><small>Usa a integração oficial quando configurada.</small></div></button>
            </div>
            <button className="ia-schedule-submit" onClick={() => publish(false)} disabled={!hasContent || !scheduleAt || publishing}>Agendar publicação</button>
            <div className={`ia-integration-box ${capabilities?.publishConfigured ? 'ready' : ''}`}>
              <strong>{capabilities?.publishConfigured ? 'Integração pronta' : 'Integração segura pendente'}</strong>
              <span>{capabilities?.publishConfigured ? 'As credenciais necessárias foram detectadas no servidor.' : 'Conecte uma conta profissional do Instagram para liberar a postagem automática.'}</span>
            </div>
          </StepCard>
        </section>

        <section className="ia-activity-card">
          <div><span className="ia-breadcrumb">EXECUÇÕES</span><h2>Histórico recente</h2></div>
          <div className="ia-activity-table">
            <div className="ia-activity-row header"><span>Conteúdo</span><span>Canal</span><span>Status</span><span>Horário</span></div>
            <div className="ia-activity-row"><span>{content.headline || 'Nenhum conteúdo gerado ainda'}</span><span>Instagram Reel</span><span className="ia-activity-status waiting">Aguardando aprovação</span><span>Agora</span></div>
            <div className="ia-activity-row"><span>Automação configurada</span><span>Sistema</span><span className="ia-activity-status success">Pronto</span><span>Hoje</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
