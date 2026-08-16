const { assertNicheOwnership } = require('../utils/ownership');
const jobService = require('../services/jobService');

async function recover(req, res) {
  const { nicheId } = req.params;
  if (!(await assertNicheOwnership(nicheId, req.user.sub))) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }

  try {
    const staleMinutes = Math.max(1, Number(req.body?.staleMinutes) || Number(process.env.JOB_STALE_MINUTES) || 3);
    const recovered = await jobService.recoverStaleJobs(staleMinutes);
    const owned = recovered.filter((item) => !item.niche_id || item.niche_id === nicheId);

    console.log(
      `[native-recovery] niche=${nicheId} staleMinutes=${staleMinutes} recovered=${owned.length}`
    );

    return res.json({
      nicheId,
      staleMinutes,
      recovered: owned,
      recoveredCount: owned.length,
    });
  } catch (error) {
    console.error(`[native-recovery] niche=${nicheId} erro=${error.message}`);
    return res.status(500).json({ error: 'Erro ao recuperar jobs travados.', details: error.message });
  }
}

module.exports = { recover };
