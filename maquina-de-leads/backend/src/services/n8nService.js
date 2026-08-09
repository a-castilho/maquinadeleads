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

/**
 * Remove campos read-only que o n8n rejeita em POST/PUT de workflows.
 */
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

  // 1. Cria o workflow
  const { data: created } = await client.post('/api/v1/workflows', cleanPayload);

  // 2. O n8n cria workflows via API sem salvar uma "active version".
  //    Fazemos um PUT para forcar a criacao de uma versao.
  const { data: updated } = await client.put(`/api/v1/workflows/${created.id}`, cleanPayload);

  // 3. Ativa e desativa para criar a versao ativa
  try {
    await client.post(`/api/v1/workflows/${created.id}/activate`);
    await client.post(`/api/v1/workflows/${created.id}/deactivate`);
  } catch (activationErr) {
    console.warn('Aviso: nao foi possivel criar versao ativa do workflow:', activationErr.message);
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

module.exports = {
  createWorkflow,
  updateWorkflow,
  setActive,
  deleteWorkflow,
  getWorkflow,
};
