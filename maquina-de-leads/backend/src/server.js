require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const nichesRoutes = require('./routes/nichesRoutes');
const { requireAuth } = require('./middleware/auth');

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
  console.error(`ERRO CRITICO: variaveis de ambiente ausentes: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('ERRO CRITICO: JWT_SECRET deve ter pelo menos 32 caracteres.');
  process.exit(1);
}

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/niches', requireAuth, nichesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Handler de erro genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Máquina de Leads API rodando na porta ${PORT}`);
});
