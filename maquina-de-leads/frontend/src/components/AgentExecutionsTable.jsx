import { useState, useEffect } from 'react';
import api from '../api/client';

export function AgentExecutionsTable({ nicheId, agentId }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    async function fetchExecutions() {
      if (!nicheId || !agentId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg(null);
        
        // Chamada para a rota do backend
        const response = await api.get(`/niches/${nicheId}/agents/${agentId}/executions`);
        console.log('Dados de execuções recebidos:', response.data);
        
        setExecutions(response.data.executions || []);
      } catch (error) {
        console.error('Erro ao buscar execuções no frontend:', error);
        setErrorMsg('Erro ao carregar histórico');
      } finally {
        setLoading(false);
      }
    }

    fetchExecutions();

    // Atualiza a cada 5 segundos para acompanhar execuções ativas
    const interval = setInterval(fetchExecutions, 5000);
    return () => clearInterval(interval);
  }, [nicheId, agentId]);

  if (loading && executions.length === 0) {
    return <div style={{ fontSize: '12px', color: '#9ca3af', padding: '8px 0' }}>Carregando histórico...</div>;
  }

  if (errorMsg) {
    return <div style={{ fontSize: '12px', color: '#ef4444', padding: '8px 0' }}>{errorMsg}</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', color: '#d1d5db', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af' }}>
            <th style={{ padding: '6px 8px' }}>Status</th>
            <th style={{ padding: '6px 8px' }}>Início</th>
            <th style={{ padding: '6px 8px' }}>Duração</th>
            <th style={{ padding: '6px 8px' }}>Exec. ID</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((exec) => (
            <tr key={exec.id} style={{ borderBottom: '1px solid #1f2937' }}>
              <td style={{ padding: '6px 8px' }}>
                <span style={{ 
                  fontWeight: 500, 
                  color: exec.status === 'success' ? '#4ade80' : exec.status === 'running' ? '#c084fc' : '#f87171' 
                }}>
                  {exec.status}
                </span>
              </td>
              <td style={{ padding: '6px 8px' }}>
                {exec.startedAt ? new Date(exec.startedAt).toLocaleTimeString() : '-'}
              </td>
              <td style={{ padding: '6px 8px' }}>
                {exec.runningTime ? `${(exec.runningTime / 1000).toFixed(1)}s` : 'Em curso...'}
              </td>
              <td style={{ padding: '6px 8px', color: '#6b7280' }}>{exec.id}</td>
            </tr>
          ))}

          {executions.length === 0 && (
            <tr>
              <td colSpan="4" style={{ padding: '12px 8px', textAlign: 'center', color: '#6b7280' }}>
                Nenhuma execução registrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
