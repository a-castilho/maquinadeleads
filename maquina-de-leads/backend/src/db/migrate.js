const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  const migrationFiles = ['schema.sql', 'native_engine.sql', 'company_profile.sql'];

  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await pool.query(sql);
      console.log(`✅ Migration aplicada: ${file}`);
    }

    console.log('✅ Schema aplicado com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao aplicar schema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
