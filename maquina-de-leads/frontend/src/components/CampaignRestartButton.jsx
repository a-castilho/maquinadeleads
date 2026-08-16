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
    <div style={{ position: 'sticky', top: 8, zIndex: 25, display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center', pointerEvents: 'none', padding: '8px 18px 0' }}>
      {message && (
        <div style={{ pointerEvents: 'auto', maxWidth: 420, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(98,215,255,.24)', background: 'rgba(20,31,46,.94)', color: '#dcefff', fontSize: 12 }}>
          {message}
        </div>
      )}
      <button
        type="button"
        onClick={restart}
        disabled={busy}
        style={{ pointerEvents: 'auto', background: 'rgba(246,185,77,.14)', border: '1px solid rgba(246,185,77,.32)', color: '#ffd88a', boxShadow: '0 8px 28px rgba(0,0,0,.22)' }}
      >
        {busy ? 'Reiniciando...' : '↻ Reiniciar busca'}
      </button>
    </div>
  );
}
