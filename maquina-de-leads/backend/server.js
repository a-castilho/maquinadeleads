require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const nichesRoutes = require('./routes/nichesRoutes');
const { requireAuth } = require('./middleware/auth');

const app = express();

// Helmet - headers de segurança
app.use(helmet());

// CORS restrito
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Tente novamente mais tarde.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de autenticacao. Tente novamente em 15 minutos.' }
});
app.use(limiter);
app.use('/api/auth', authLimiter);

// Limite de tamanho do JSON
app.use(express.json({ limit: '50kb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/niches', requireAuth, nichesRoutes);

// Handler de erro - nao vaza stack trace em producao
app.use((err, req, res, next) => {
  console.error('Erro:', err.message, 'Rota:', req.path, 'IP:', req.ip);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor.',
    ...(isDev && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Máquina de Leads API rodando na porta ${PORT}`);
});
