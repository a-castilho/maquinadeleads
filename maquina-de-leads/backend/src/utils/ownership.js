const db = require('../config/db');

async function assertNicheOwnership(nicheId, userId) {
  const r = await db.query('SELECT id FROM niches WHERE id = $1 AND user_id = $2', [nicheId, userId]);
  return r.rows.length > 0;
}

module.exports = { assertNicheOwnership };
