const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter no minimo 6 caracteres.' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ja existe uma conta com este email.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('[register] Erro:', err.message);
    return res.status(500).json({ error: 'Erro ao registrar usuario.' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    const token = signToken(user);
    delete user.password_hash;
    return res.json({ user, token });
  } catch (err) {
    console.error('[login] Erro:', err.message);
    return res.status(500).json({ error: 'Erro ao autenticar.' });
  }
}

async function me(req, res) {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.sub]
    );
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[me] Erro:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar usuario.' });
  }
}

module.exports = { register, login, me };
