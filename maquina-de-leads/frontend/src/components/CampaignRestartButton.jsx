import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';

export default function CampaignRestartButton() {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/campanhas\/([^/]+)/);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!match) return null;

  const campaignId = match[1];

  async function restart() {
    const confirmed = window.confirm(
      'Reiniciar a busca desta campanha? A preparação atual será cancelada e uma nova descoberta começará do zero.'
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post(`/niches/${campaignId}/native/restart`, {
        maxQueries: 30,
        enrichBatchSize: 25,
        scoreBatchSize: 500,
      });
      setMessage(`Busca reiniciada · ${data.cancelledCount || 0} job(s) anterior(es) cancelado(s).`);
      console.info('[native-restart-ui] completed', data);
    } catch (err) {
      const text = err.response?.data?.error || 'Erro ao reiniciar a busca.';
      setMessage(text);
      console.error('[native-restart-ui] failed', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="campaign-restart-control">
      <button type="button" className="campaign-restart-button" onClick={restart} disabled={busy}>
        {busy ? 'Reiniciando...' : '↻ Reiniciar busca'}
      </button>
      {message && <div className="campaign-restart-message">{message}</div>}
    </div>
  );
}
