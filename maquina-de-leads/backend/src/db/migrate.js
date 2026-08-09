const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('✅ Schema aplicado com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao aplicar schema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
