const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  const files = ['schema.sql', 'native_campaigns.sql'];
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await pool.query(sql);
      console.log(`✅ Migração aplicada: ${file}`);
    }
  } catch (err) {
    console.error('❌ Erro ao aplicar migrações:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
