const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token nao fornecido.' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token invalido.' });
  }
}

module.exports = { requireAuth };
