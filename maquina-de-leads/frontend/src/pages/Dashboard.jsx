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
              <Link to={`/nichos/${n.id}`} key={n.id} className="niche-card">
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
