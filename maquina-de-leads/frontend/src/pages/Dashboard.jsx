import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [niches, setNiches] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api.get('/niches');
    setNiches(res.data.niches);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post('/niches', { name, description });
    setName('');
    setDescription('');
    load();
  }

  // --- NOVA FUNÇÃO ADICIONADA ---
  async function handleDelete(e, id, nicheName) {
    e.preventDefault(); // Impede a navegação do Link
    
    // Pede confirmação antes de excluir
    const confirmed = window.confirm(`Tem certeza que deseja excluir o nicho "${nicheName}"? Isso também apagará todos os leads e agentes vinculados.`);
    
    if (confirmed) {
      try {
        await api.delete(`/niches/${id}`);
        load(); // Recarrega a lista após exclusão
      } catch (err) {
        console.error("Erro ao excluir nicho:", err);
        alert("Erro ao excluir o nicho. Verifique o console.");
      }
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Máquina de Leads</h1>
        <div className="topbar-user">
          <span>{user?.name}</span>
          <button className="link-btn" onClick={logout}>Sair</button>
        </div>
      </header>

      <section className="card">
        <h2>Novo nicho de mercado</h2>
        <form className="inline-form" onSubmit={handleCreate}>
          <input
            placeholder="Ex: Odontologia, Imóveis, Academias..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit">Criar nicho</button>
        </form>
      </section>

      <section>
        <h2>Seus nichos</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : niches.length === 0 ? (
          <p className="empty">Nenhum nicho cadastrado ainda. Crie o primeiro acima.</p>
        ) : (
          <div className="grid">
            {niches.map((n) => (
              <Link to={`/nichos/${n.id}`} key={n.id} className="niche-card" style={{ position: 'relative' }}>
                
                {/* --- NOVO BOTÃO DE EXCLUSÃO ADICIONADO --- */}
                <button 
                  onClick={(e) => handleDelete(e, n.id, n.name)}
                  style={{
                   position: 'absolute',
		    bottom: '10px', /* <-- Mudamos de 'top' para 'bottom' */
		    right: '10px',
		    background: '#fef2f2',
		    color: '#dc2626',
		    border: '1px solid #fecaca',
		    borderRadius: '4px',
		    padding: '4px 8px',
		    cursor: 'pointer',
		    fontSize: '12px'
                  }}
                  title="Excluir nicho"
                >
                  Excluir
                </button>
                {/* -------------------------------------- */}

                <h3>{n.name}</h3>
                <p>{n.description || 'Sem descrição'}</p>
                <span className={`badge ${n.active ? 'badge-active' : 'badge-inactive'}`}>
                  {n.active ? 'Ativo' : 'Inativo'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
