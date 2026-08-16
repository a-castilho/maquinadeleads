# Máquina de Leads

Sistema multi-nicho de prospecção e envio de leads via WhatsApp: raspagem por
Google dorking (Serper/SerpAPI) + envio via Evolution API, orquestrado por
workflows n8n criados/ativados automaticamente pelo dashboard.

## Como os fluxos n8n originais foram generalizados

Os dois fluxos que você já tinha (`SerpDevRaspagem` e `Envio v4 FINAL`) eram
fixos para o nicho de música (TocaAí): a lista de nichos estava hardcoded no
node `Gerador de Matriz`, a mensagem estava hardcoded no `formataCel`, e a
tabela `leads_prospeccao` não distinguia nichos.

Neste projeto:

- `backend/src/templates/scrapingTemplate.js` e `sendingTemplate.js` recriam a
  mesma lógica dos dois workflows, mas como **funções que recebem config** (
  palavras-chave, mensagem, credenciais) vindas do Postgres e devolvem o JSON
  do workflow já parametrizado.
- `backend/src/services/n8nService.js` chama a **API REST do n8n**
  (`/api/v1/workflows`) para criar, atualizar, ativar/desativar e remover
  esses workflows — isso é o que o dashboard aciona quando você clica em
  "Criar agente".
- A tabela `leads` agora tem `niche_id`, então o mesmo Postgres serve
  qualquer nicho, e cada workflow gerado já filtra/grava só os leads do seu
  nicho.

## Setup

### Requisitos
- Node.js 18+
- PostgreSQL 14+
- Uma instância do n8n com a **API REST habilitada** e uma API key gerada
  (Settings → API no n8n)
- Uma conta Serper (ou SerpAPI) e uma instância Evolution API já rodando
  (você já tem ambas, pelos fluxos enviados)

### Backend
```bash
cd backend
cp .env.example .env   # preencha DATABASE_URL, JWT_SECRET, N8N_BASE_URL, N8N_API_KEY
npm install
npm run migrate        # cria as tabelas no Postgres
npm run dev            # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173
```

## Fluxo de uso no dashboard

1. Criar conta / login
2. Criar um **nicho** (ex: "Odontologia", "Imóveis", "Academias")
3. Na aba **Palavras-chave**: adicionar termos de nicho (ex: "dentista",
   "clínica odontológica") e termos de contexto (ex: "whatsapp", "agende sua
   consulta")
4. Na aba **Mensagem**: escrever o template de WhatsApp usando `{{nome}}`
5. Na aba **Credenciais**: cadastrar a chave Serper, a Evolution API
   (base_url + apikey + nome da instância) e, se quiser reaproveitar uma
   credencial Postgres já existente no n8n, o ID dela
6. Na aba **Agentes**: clicar em "Criar agente" para Raspagem e para Envio —
   isso cria os dois workflows no n8n via API e permite ativar/desativar
   direto pelo dashboard
7. Na aba **Leads**: acompanhar o que foi coletado e o status de envio

## Observação sobre a credencial Postgres no n8n

A API pública do n8n não cria *credenciais* (usuário/senha de conexões) por
segurança — só *workflows*. Por isso, a credencial Postgres precisa existir
previamente no n8n (você provavelmente já tem uma, do fluxo original) e você
só informa o **ID dela** no dashboard, na aba Credenciais → provider
"Postgres (credencial do n8n)". O backend referencia esse ID nos nodes
Postgres do workflow gerado.

<!-- DEV-DOCTOR-2026-08-16 -->

## Desenvolvimento local com Docker

O ponto de entrada oficial do ambiente local fica na raiz do repositório.

Para verificar o ambiente:

    ./dev doctor

Para validar a configuração do Docker Compose:

    ./dev config

Para subir a aplicação:

    ./dev up

Para consultar o estado dos containers:

    ./dev status

Para executar smoke tests:

    ./dev smoke

Para acompanhar os logs:

    ./dev logs

Para executar o Quality Gate completo:

    ./dev quality

Para parar os containers preservando os volumes e os dados PostgreSQL:

    ./dev down

### Ambiente local

Na primeira execução, o fluxo pode criar:

    maquina-de-leads/.env

O arquivo .env contém configurações locais e não deve ser versionado.

Quando já existe um PostgreSQL utilizando o volume do projeto, o script
valida se as credenciais presentes no .env correspondem às credenciais
do container existente.

Isso evita iniciar acidentalmente a aplicação com outro usuário, senha
ou banco sobre o mesmo volume.

### Dev Doctor

O comando:

    ./dev doctor

verifica:

- Docker;
- Docker Compose;
- curl;
- openssl;
- existência do .env;
- POSTGRES_PASSWORD;
- JWT_SECRET;
- validade do docker-compose.yml.

### Quality Gate

O comando:

    ./dev quality

executa:

- Dev Doctor;
- validação do Docker Compose;
- build do backend;
- build do frontend;
- inicialização da stack;
- readiness do PostgreSQL;
- migrations;
- validação de sintaxe JavaScript do backend;
- build de produção do frontend;
- health check do backend;
- verificação HTTP do frontend;
- smoke test final.

A aplicação principal deste repositório está localizada em:

    maquina-de-leads/

O wrapper ./dev deve ser utilizado como ponto de entrada para evitar
executar um Docker Compose a partir do diretório incorreto.
