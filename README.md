# Máquina de Leads

Plataforma de prospecção autônoma orientada a campanhas, com descoberta, qualificação, deduplicação e acompanhamento de leads.

A aplicação principal está em [`maquina-de-leads/`](./maquina-de-leads/) e possui documentação técnica detalhada em [`maquina-de-leads/README.md`](./maquina-de-leads/README.md).

## Arquitetura

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Banco de dados:** PostgreSQL
- **Descoberta de leads:** SearXNG
- **Orquestração:** nativa no backend
- **Execução:** jobs persistidos no PostgreSQL
- **Infraestrutura local:** Docker Compose

O fluxo principal atual não depende de n8n. Arquivos e workflows relacionados a n8n permanecem no repositório como legado/compatibilidade.

## Estrutura do repositório

```text
maquinadeleads/
├── maquina-de-leads/              # aplicação principal
│   ├── backend/                    # API e orquestração
│   ├── frontend/                   # interface React/Vite
│   ├── searxng/                    # configuração de busca
│   ├── docker-compose.yml          # ambiente principal
│   └── README.md                   # documentação técnica completa
├── .github/                        # automações e CI
├── AGENTS.md                       # instruções para agentes de desenvolvimento
├── docker-compose.n8n.yml          # infraestrutura n8n legada/auxiliar
├── render.yaml                     # configuração de deploy
├── vercel.json                     # configuração de deploy
└── *.json                          # workflows/artefatos legados
```

## Executar localmente

Pré-requisito: Docker com Docker Compose.

```bash
git clone https://github.com/a-castilho/maquinadeleads.git
cd maquinadeleads/maquina-de-leads
docker compose up -d --build
docker compose ps
```

Serviços locais esperados:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- SearXNG: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

O serviço `migrate` deve finalizar com código `0`, indicando que as migrações foram aplicadas corretamente.

## Fluxo principal

1. Criar uma campanha com nicho, região, oferta e objetivo.
2. Gerar e revisar estratégia, palavras-chave e mensagem.
3. Executar a campanha.
4. Descobrir empresas e contatos via SearXNG.
5. Normalizar, pontuar e deduplicar leads.
6. Acompanhar os leads pelo funil comercial.
7. Consultar histórico de execuções e erros da campanha.

## Segurança

Não versione arquivos `.env`, senhas, tokens ou outras credenciais reais. Em produção, use segredos fortes, CORS restritivo e variáveis de ambiente específicas para cada ambiente.

## Documentação completa

Consulte **[maquina-de-leads/README.md](./maquina-de-leads/README.md)** para detalhes de banco de dados, desenvolvimento sem Docker, segurança, CI e operação da aplicação.
