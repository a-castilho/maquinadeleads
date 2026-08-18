require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const nichesRoutes = require('./routes/nichesRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
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
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'maquina-de-leads', orchestration: 'native', worker: process.env.RUN_WORKER !== 'false' }));
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/niches', requireAuth, nichesRoutes);

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Máquina de Leads API nativa rodando na porta ${PORT}`);
  if (process.env.RUN_WORKER !== 'false') {
    require('./worker');
  }
});
