import { useEffect, useState } from 'react';
import api from '../api/client';
import AiKeywordAssistant from '../components/AiKeywordAssistant';

export default function AiKeywordsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadCampaigns() {
    setLoading(true);
    try {
      const { data } = await api.get('/niches');
      const items = data.niches || [];
      setCampaigns(items);
      if (!campaignId && items[0]?.id) setCampaignId(items[0].id);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao carregar campanhas.');
    } finally { setLoading(false); }
  }

  async function loadKeywords(id = campaignId) {
    if (!id) return;
    try {
      const { data } = await api.get(`/niches/${id}/keywords`);
      setKeywords(data.keywords || []);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erro ao carregar termos.');
    }
  }

  useEffect(() => { loadCampaigns(); }, []);
  useEffect(() => { if (campaignId) loadKeywords(campaignId); }, [campaignId]);

  const principal = keywords.filter((item) => item.kind === 'nicho');
  const contexto = keywords.filter((item) => item.kind === 'contexto');

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>IA · Termos de descoberta</h1>
          <p className="hint">Gere palavras-chave prontas para prospecção usando o Perfil da Empresa, ICP e objetivo da campanha.</p>
        </div>
      </header>

      <section className="card" style={{ background: 'rgba(16,185,129,.10)', borderColor: 'rgba(52,211,153,.25)' }}>
        <h2>Campanha</h2>
        {loading ? <p>Carregando...</p> : campaigns.length === 0 ? (
          <p className="hint">Crie uma campanha antes de gerar termos.</p>
        ) : (
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ width: '100%' }}>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        )}
        {message && <p>{message}</p>}
      </section>

      {campaignId && (
        <>
          <AiKeywordAssistant campaignId={campaignId} onGenerated={() => loadKeywords(campaignId)} />

          <section className="card" style={{ marginTop: 18 }}>
            <h2>Termos prontos para busca</h2>
            <p className="hint">Os termos gerados são salvos diretamente na estratégia da campanha e usados pelo motor de descoberta.</p>
            <h3>Principais ({principal.length})</h3>
            <div className="chip-list">
              {principal.map((item) => <span className="chip" key={item.id}>{item.term}</span>)}
              {!principal.length && <span className="hint">Nenhum termo principal ainda.</span>}
            </div>
            <h3>Contexto ({contexto.length})</h3>
            <div className="chip-list">
              {contexto.map((item) => <span className="chip" key={item.id}>{item.term}</span>)}
              {!contexto.length && <span className="hint">Nenhum termo de contexto ainda.</span>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
