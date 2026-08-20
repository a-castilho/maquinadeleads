# Máquina de Leads (Code Nome - Equipe de Vendas)

Plataforma de prospecção autônoma orientada a **campanhas**. O fluxo principal não depende de n8n.

## Arquitetura atual

- Frontend: React + Vite
- Backend: Node.js + Express
- Banco: PostgreSQL
- Descoberta de leads: SearXNG
- Orquestração: nativa no backend
- Estado de execução: `campaign_jobs` no PostgreSQL
- Leads: deduplicação, score e funil por campanha

O código antigo de integração com n8n permanece apenas como legado para compatibilidade e não participa do fluxo principal nem do Docker Compose.

## Subir o ambiente inteiro

```bash
cd ~/Documents/maquinadeleads/maquina-de-leads
docker compose down --remove-orphans
docker compose up -d --build
docker compose ps
```

URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health: http://localhost:4000/health
- SearXNG: http://localhost:8080
- PostgreSQL: localhost:5432

O container `migrate` deve terminar como `Exited (0)`; isso significa que as migrações foram aplicadas com sucesso.

## Fluxo do produto

1. Criar conta e entrar.
2. Criar uma campanha informando nome, nicho, região, oferta e objetivo.
3. O backend gera estratégia e palavras-chave iniciais.
4. Revisar palavras-chave e mensagem.
5. Executar a campanha.
6. O backend consulta o SearXNG, normaliza resultados, extrai contatos, calcula score e deduplica leads.
7. Acompanhar os leads no funil.
8. Alterar cada lead entre: descoberto, qualificado, pronto para contato, contatado, respondeu, interessado, convertido ou descartado.
9. Acompanhar o histórico de jobs e erros da campanha.

## Banco de dados

O schema legado é preservado. A migração `native_campaigns.sql` acrescenta:

- `campaigns`
- `campaign_jobs`
- `campaign_messages`
- `campaign_id`, `score`, `stage` e `dedupe_key` em `leads`

As migrações são idempotentes e executadas pelo serviço `migrate` antes do backend iniciar.

## Segurança

Nunca versionar `.env` ou credenciais reais. Em produção defina pelo menos:

```env
JWT_SECRET=<segredo aleatorio com 32+ caracteres>
POSTGRES_USER=leads_user
POSTGRES_PASSWORD=<senha forte>
POSTGRES_DB=maquina_de_leads
FRONTEND_URL=https://seu-frontend
```

O backend usa Helmet, limite de payload, CORS e rate limiting nos endpoints de autenticação.

## Desenvolvimento local sem Docker

Backend:

```bash
cd backend
npm ci
npm run migrate
npm start
```

Frontend:

```bash
cd frontend
npm ci
npm run dev -- --host 0.0.0.0
```

## CI

O workflow `.github/workflows/ci.yml` valida:

- instalação limpa do backend;
- migrações PostgreSQL;
- sintaxe dos módulos críticos;
- instalação limpa do frontend;
- build de produção do Vite.

<!-- COMPROMISSO-GERAL-A-CASTILHO -->

---

## Compromisso Geral

**Sempre na melhor prática. No caminho do bem maior.**

**Ir até o fim sem sair do caminho, seja ele qual for.**

