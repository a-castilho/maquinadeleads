/**
 * Relatório completo de um (ou todos os) nicho(s), impresso no terminal.
 *
 * Uso:
 *   node src/scripts/report.js                  -> mostra o nicho mais recente
 *   node src/scripts/report.js --all             -> mostra todos os nichos
 *   node src/scripts/report.js --id=<uuid>        -> mostra um nicho específico
 */
require('dotenv').config();
const { pool } = require('../config/db');

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const idArg = args.find((a) => a.startsWith('--id='));
const targetId = idArg ? idArg.split('=')[1] : null;

function linha(char = '─', len = 70) {
  console.log(char.repeat(len));
}

function titulo(texto) {
  console.log('\n' + '='.repeat(70));
  console.log(texto.toUpperCase());
  console.log('='.repeat(70));
}

function tabela(rows, colunas) {
  if (rows.length === 0) {
    console.log('  (nenhum registro)');
    return;
  }
  console.table(rows.map((r) => {
    const obj = {};
    colunas.forEach((c) => (obj[c] = r[c]));
    return obj;
  }));
}

async function getNiches() {
  if (targetId) {
    const r = await pool.query('SELECT * FROM niches WHERE id = $1', [targetId]);
    return r.rows;
  }
  if (showAll) {
    const r = await pool.query('SELECT * FROM niches ORDER BY created_at DESC');
    return r.rows;
  }
  const r = await pool.query('SELECT * FROM niches ORDER BY created_at DESC LIMIT 1');
  return r.rows;
}

async function reportNiche(niche) {
  titulo(`Nicho: ${niche.name}`);
  console.log(`ID:          ${niche.id}`);
  console.log(`Slug:        ${niche.slug}`);
  console.log(`Descrição:   ${niche.description || '(sem descrição)'}`);
  console.log(`Ativo:       ${niche.active ? 'Sim' : 'Não'}`);
  console.log(`Criado em:   ${niche.created_at.toISOString()}`);

  linha();
  console.log('PALAVRAS-CHAVE');
  const keywords = (await pool.query(
    'SELECT term, kind, active FROM keywords WHERE niche_id = $1 ORDER BY kind, term',
    [niche.id]
  )).rows;
  tabela(keywords, ['term', 'kind', 'active']);

  linha();
  console.log('TEMPLATES DE MENSAGEM');
  const templates = (await pool.query(
    'SELECT name, body, active FROM message_templates WHERE niche_id = $1 ORDER BY created_at DESC',
    [niche.id]
  )).rows;
  templates.forEach((t) => {
    console.log(`\n  [${t.active ? 'ATIVO' : 'inativo'}] ${t.name}`);
    console.log('  ' + t.body.replace(/\n/g, '\n  '));
  });
  if (templates.length === 0) console.log('  (nenhum template cadastrado)');

  linha();
  console.log('CREDENCIAIS (api_key oculta por segurança)');
  const creds = (await pool.query(
    'SELECT provider, base_url, extra_config, created_at FROM credentials WHERE niche_id = $1',
    [niche.id]
  )).rows;
  tabela(creds, ['provider', 'base_url', 'extra_config']);

  linha();
  console.log('AGENTES N8N');
  const agents = (await pool.query(
    'SELECT agent_type, n8n_workflow_id, active, last_sync_at FROM n8n_agents WHERE niche_id = $1',
    [niche.id]
  )).rows;
  tabela(agents, ['agent_type', 'n8n_workflow_id', 'active', 'last_sync_at']);

  linha();
  console.log('LEADS — RESUMO POR STATUS');
  const stats = (await pool.query(
    'SELECT status, COUNT(*)::int AS total FROM leads WHERE niche_id = $1 GROUP BY status',
    [niche.id]
  )).rows;
  tabela(stats, ['status', 'total']);

  linha();
  console.log('LEADS — ÚLTIMOS 20');
  const leads = (await pool.query(
    `SELECT nome_perfil, whatsapp, status, ultima_mensagem_enviada, created_at
     FROM leads WHERE niche_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [niche.id]
  )).rows;
  tabela(leads, ['nome_perfil', 'whatsapp', 'status', 'ultima_mensagem_enviada']);
}

async function main() {
  try {
    const niches = await getNiches();
    if (niches.length === 0) {
      console.log('Nenhum nicho encontrado.');
      return;
    }
    for (const niche of niches) {
      await reportNiche(niche);
    }
    console.log('\n');
  } catch (err) {
    console.error('❌ Erro ao gerar relatório:', err.message);
  } finally {
    await pool.end();
  }
}

main();
