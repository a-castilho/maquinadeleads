# Máquina de Leads — Arquitetura, padrões e uso de IA

**Data de referência:** 21/08/2026

Este documento descreve a arquitetura efetivamente observada no repositório e diferencia o fluxo operacional principal de integrações auxiliares ou legadas.

## 1. Visão geral

A Máquina de Leads é uma plataforma de prospecção orientada a campanhas, com descoberta, qualificação, deduplicação e acompanhamento de leads.

A aplicação principal está em `maquina-de-leads/`.

## 2. Stack principal

### Backend

- Node.js
- Express 4
- PostgreSQL via `pg`
- Axios
- JWT
- bcryptjs
- Helmet
- CORS
- express-rate-limit
- express-validator

### Frontend

- React 18
- React Router 6
- Vite 4
- Axios

### Infraestrutura

- PostgreSQL 15
- SearXNG
- backend Express
- worker nativo
- frontend Vite
- Docker Compose

O fluxo operacional principal não depende de n8n. Arquivos e workflows relacionados a n8n permanecem como legado/compatibilidade.

## 3. Arquitetura operacional principal

```text
Frontend React
      ↓
Express API
      ↓
PostgreSQL
      ↓
Campaign Jobs
      ↓
Worker nativo
      ↓
SearXNG
      ↓
Normalização + score + deduplicação
      ↓
Leads persistidos
```

O worker usa uma fila persistida em PostgreSQL e realiza claim de jobs com `FOR UPDATE SKIP LOCKED`, permitindo concorrência segura entre consumidores.

## 4. Descoberta principal de leads

O fluxo executado pelo worker é predominantemente determinístico.

`campaignService.js`:

1. gera palavras-chave a partir de nicho, localização e oferta;
2. consulta o SearXNG;
3. extrai telefone com regex;
4. calcula score por regras;
5. gera uma chave SHA-256 de deduplicação;
6. persiste os leads no PostgreSQL com proteção contra duplicidade.

Não há LLM obrigatório nesse caminho.

## 5. Uso de GPT

Existe, paralelamente, uma rota autenticada específica de descoberta com GPT:

```text
POST /api/lead-discovery/gpt-search
```

Essa rota chama `gptLeadDiscoveryService.js`.

### Modelo

O modelo padrão é:

- `gpt-5.4-mini`

Pode ser alterado pela variável `OPENAI_LEAD_SEARCH_MODEL`.

### API

A integração usa a OpenAI Responses API:

```text
POST https://api.openai.com/v1/responses
```

### Ferramenta de busca

O request habilita:

- `web_search`;
- contexto de busca médio;
- localização aproximada no Brasil;
- inclusão das fontes retornadas pela busca.

### Saída estruturada

A resposta é forçada para um JSON Schema estrito com campos como:

- empresa;
- website;
- telefone;
- cidade;
- estado;
- segmento;
- motivo de aderência;
- URL de fonte;
- confiança.

O prompt também determina que o modelo não invente contatos e use apenas informações empresariais publicamente verificáveis.

## 6. Dois caminhos distintos de descoberta

É importante não descrever toda a Máquina de Leads como “GPT-driven”.

Hoje existem dois caminhos:

### Caminho A — campanha/worker

```text
Campanha → SearXNG → regras → deduplicação → PostgreSQL
```

Esse é o fluxo nativo principal executado pelo worker.

### Caminho B — busca GPT

```text
Requisição autenticada → OpenAI Responses API → web_search → JSON Schema → resultado
```

Esse é um recurso adicional e explicitamente baseado em modelo generativo.

## 7. RAG

**A busca GPT com `web_search` não deve ser classificada como RAG clássico.**

Há retrieval de informação da web dentro da chamada ao modelo, mas não foi observado um pipeline próprio com:

- embeddings;
- vector database;
- indexação de documentos internos;
- recuperação semântica de chunks;
- composição desses chunks em um prompt próprio.

Logo, a classificação mais precisa é **LLM com ferramenta de web search e structured output**.

## 8. Orquestração

A orquestração principal é nativa no backend.

O worker:

- busca jobs `queued` ou `retry`;
- usa lock transacional;
- incrementa tentativas;
- executa a descoberta;
- registra resultado ou erro;
- agenda retry com atraso;
- marca a campanha como erro após esgotar tentativas.

Esse desenho reduz dependência de orquestradores externos para o fluxo central.

## 9. Segurança observada

- JWT obrigatório nas rotas de negócio;
- Helmet;
- rate limit;
- CORS configurável;
- validação mínima de `JWT_SECRET`;
- rate limit específico para buscas GPT;
- uso de variáveis de ambiente para segredos;
- recomendação explícita de não versionar `.env`.

## 10. Padrões técnicos relevantes

- jobs persistentes em PostgreSQL;
- worker independente;
- `SKIP LOCKED` para concorrência;
- deduplicação por hash;
- separação entre descoberta determinística e busca generativa;
- structured output para reduzir ambiguidades do LLM;
- pesquisa com fontes verificáveis;
- fallback operacional sem depender de n8n.

## 11. Resumo executivo

A Máquina de Leads combina automação determinística e IA generativa sem tornar o LLM obrigatório para todo o produto. O fluxo principal de campanha é baseado em SearXNG, regras e PostgreSQL; a busca GPT é um caminho adicional com OpenAI Responses API, `web_search` e saída estruturada. Essa separação é importante para custo, previsibilidade, auditabilidade e resiliência.
