const db = require('../config/db');
const { generateStrategy, runCampaign } = require('../services/campaignService');

function slugify(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function ensureNiche(userId, nicheName) {
  const existing = await db.query('SELECT * FROM niches WHERE user_id=$1 AND lower(name)=lower($2) LIMIT 1', [userId, nicheName]);
  if (existing.rows[0]) return existing.rows[0];
  const slug = `${slugify(nicheName)}-${Date.now().toString(36)}`;
  return (await db.query(
    'INSERT INTO niches (user_id,name,slug,description) VALUES ($1,$2,$3,$4) RETURNING *',
    [userId, nicheName, slug, 'Criado automaticamente por uma campanha.']
  )).rows[0];
}

async function list(req, res) {
  try {
    const result = await db.query(
      `SELECT c.*,
        COUNT(l.id)::int AS leads_total,
        COUNT(l.id) FILTER (WHERE l.stage='contatado')::int AS leads_contatados,
        COUNT(l.id) FILTER (WHERE l.stage='interessado')::int AS interessados,
        COUNT(l.id) FILTER (WHERE l.stage='convertido')::int AS convertidos
       FROM campaigns c LEFT JOIN leads l ON l.campaign_id=c.id
       WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.created_at DESC`, [req.user.sub]
    );
    res.json({ campaigns: result.rows });
  } catch (err) {
    console.error('[campaigns.list]', err);
    res.status(500).json({ error: 'Erro ao listar campanhas.' });
  }
}

async function create(req, res) {
  const { name, niche, location, offer, objective } = req.body;
  if (!name?.trim() || !niche?.trim()) return res.status(400).json({ error: 'Nome e nicho são obrigatórios.' });
  try {
    const nicheRow = await ensureNiche(req.user.sub, niche.trim());
    const draft = { niche: niche.trim(), location: location?.trim(), offer: offer?.trim(), objective: objective?.trim() };
    const strategy = generateStrategy(draft);
    const result = await db.query(
      `INSERT INTO campaigns (user_id,niche_id,name,niche,location,offer,objective,strategy,message_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.sub, nicheRow.id, name.trim(), niche.trim(), location || null, offer || null, objective || null, JSON.stringify(strategy), strategy.initialMessage]
    );
    res.status(201).json({ campaign: result.rows[0] });
  } catch (err) {
    console.error('[campaigns.create]', err);
    res.status(500).json({ error: 'Erro ao criar campanha.' });
  }
}

async function getOne(req, res) {
  try {
    const campaign = (await db.query('SELECT * FROM campaigns WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub])).rows[0];
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const [leads, jobs] = await Promise.all([
      db.query('SELECT * FROM leads WHERE campaign_id=$1 ORDER BY score DESC, created_at DESC LIMIT 200', [campaign.id]),
      db.query('SELECT * FROM campaign_jobs WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT 20', [campaign.id]),
    ]);
    res.json({ campaign, leads: leads.rows, jobs: jobs.rows });
  } catch (err) {
    console.error('[campaigns.getOne]', err);
    res.status(500).json({ error: 'Erro ao carregar campanha.' });
  }
}

async function update(req, res) {
  const allowedStatus = ['draft','ready','running','paused','completed','error'];
  const { name, location, offer, objective, strategy, message_template, status } = req.body;
  if (status && !allowedStatus.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  try {
    const result = await db.query(
      `UPDATE campaigns SET name=COALESCE($1,name),location=COALESCE($2,location),offer=COALESCE($3,offer),
       objective=COALESCE($4,objective),strategy=COALESCE($5,strategy),message_template=COALESCE($6,message_template),status=COALESCE($7,status)
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [name, location, offer, objective, strategy ? JSON.stringify(strategy) : null, message_template, status, req.params.id, req.user.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campanha não encontrada.' });
    res.json({ campaign: result.rows[0] });
  } catch (err) {
    console.error('[campaigns.update]', err);
    res.status(500).json({ error: 'Erro ao atualizar campanha.' });
  }
}

async function run(req, res) {
  try {
    const result = await runCampaign(req.params.id, req.user.sub);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[campaigns.run]', err);
    res.status(err.status || 502).json({ error: err.message || 'Falha ao executar campanha.' });
  }
}

async function updateLeadStage(req, res) {
  const stages = ['descoberto','qualificado','pronto_contato','contatado','respondeu','interessado','convertido','descartado'];
  if (!stages.includes(req.body.stage)) return res.status(400).json({ error: 'Etapa inválida.' });
  try {
    const result = await db.query(
      `UPDATE leads SET stage=$1 WHERE id=$2 AND campaign_id IN (SELECT id FROM campaigns WHERE id=$3 AND user_id=$4) RETURNING *`,
      [req.body.stage, req.params.leadId, req.params.id, req.user.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead não encontrado.' });
    res.json({ lead: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar lead.' });
  }
}

async function remove(req, res) {
  const result = await db.query('DELETE FROM campaigns WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.sub]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Campanha não encontrada.' });
  res.status(204).send();
}

module.exports = { list, create, getOne, update, run, updateLeadStage, remove };
