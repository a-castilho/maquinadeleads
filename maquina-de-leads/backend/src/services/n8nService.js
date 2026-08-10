const axios = require('axios');

function n8nClient() {
  return axios.create({
    baseURL: process.env.N8N_BASE_URL,
    headers: {
      'X-N8N-API-KEY': process.env.N8N_API_KEY,
      'Content-Type': 'application/json',
    },
  });
}

function cleanWorkflowPayload(workflowJson) {
  const readOnlyFields = [
    'id', 'active', 'createdAt', 'updatedAt', 'meta', 'staticData',
    'activeVersionId', 'versionId', 'shared', 'tags', 'activeVersion',
    'versionCounter', 'triggerCount', 'sourceWorkflowId', 'isArchived',
    'nextCursor', 'nodeGroups', 'pinData', 'binaryMode',
  ];
  const cleaned = { ...workflowJson };
  for (const field of readOnlyFields) {
    delete cleaned[field];
  }
  if (cleaned.settings) {
    const { binaryMode, ...settingsRest } = cleaned.settings;
    cleaned.settings = settingsRest;
  }
  return cleaned;
}

async function createWorkflow(workflowJson) {
  const client = n8nClient();
  const cleanPayload = cleanWorkflowPayload(workflowJson);

  const { data: created } = await client.post('/api/v1/workflows', cleanPayload);
  const { data: updated } = await client.put(`/api/v1/workflows/${created.id}`, cleanPayload);

  try {
    await client.post(`/api/v1/workflows/${created.id}/activate`);
  } catch (activationErr) {
    console.warn('Aviso: nao foi possivel ativar o workflow apos criacao:', activationErr.message);
  }

  return updated;
}

async function updateWorkflow(workflowId, workflowJson) {
  const client = n8nClient();
  const cleanPayload = cleanWorkflowPayload(workflowJson);
  const { data } = await client.put(`/api/v1/workflows/${workflowId}`, cleanPayload);
  return data;
}

async function setActive(workflowId, active) {
  const client = n8nClient();
  const path = active
    ? `/api/v1/workflows/${workflowId}/activate`
    : `/api/v1/workflows/${workflowId}/deactivate`;
  const { data } = await client.post(path);
  return data;
}

async function deleteWorkflow(workflowId) {
  const client = n8nClient();
  await client.delete(`/api/v1/workflows/${workflowId}`);
}

async function getWorkflow(workflowId) {
  const client = n8nClient();
  const { data } = await client.get(`/api/v1/workflows/${workflowId}`);
  return data;
}

/**
 * Dispara a execucao de um workflow chamando seu Webhook Trigger.
 * So funciona se o workflow estiver ATIVO (webhook de producao).
 */
async function triggerWebhook(webhookUrl) {
  return axios.get(webhookUrl, { timeout: 15000 });
}

/**
 * Lista as ultimas execucoes de um workflow especifico (usado para
 * mostrar historico/status na tela de agentes).
 */
async function getExecutions(workflowId, limit = 10) {
  const client = n8nClient();
  const { data } = await client.get('/api/v1/executions', {
    params: { workflowId, limit },
  });
  return data.data || data || [];
}

module.exports = {
  createWorkflow,
  updateWorkflow,
  setActive,
  deleteWorkflow,
  getWorkflow,
  triggerWebhook,
  getExecutions,
};
