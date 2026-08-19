# Revisão PR #4 — feat: Instagram Automático

## Metadados

- **Estado:** Aberta
- **Autor:** @acastilho
- **Base/Head:** `main` ← `feature/instagram-automatico`
- **Fonte:** https://github.com/a-castilho/maquinadeleads/pull/4

## Sinais automáticos

- **Issue detectada:** SIM
- **Mudança de UI provável:** SIM
- **Evidência visual detectada:** NÃO
- **Arquivos:** 11

> UI provável sem evidência deve ser justificada ou receber screenshot/registro antes do merge.

## Arquivos alterados

- `.github/workflows/ci.yml` (+3/-0)
- `docs/instagram-automatico.md` (+72/-0)
- `maquina-de-leads/backend/.env.example` (+7/-0)
- `maquina-de-leads/backend/src/controllers/instagramAutomationController.js` (+74/-0)
- `maquina-de-leads/backend/src/routes/instagramAutomationRoutes.js` (+10/-0)
- `maquina-de-leads/backend/src/server.js` (+2/-0)
- `maquina-de-leads/backend/src/services/instagramAutomationService.js` (+84/-0)
- `maquina-de-leads/frontend/src/App.jsx` (+3/-1)
- `maquina-de-leads/frontend/src/instagram-automation.css` (+1/-0)
- `maquina-de-leads/frontend/src/pages/Dashboard.jsx` (+2/-1)
- `maquina-de-leads/frontend/src/pages/InstagramAutomation.jsx` (+330/-0)

## Descrição/evidências da PR

Implementa o MVP do Instagram Automático com cadastro da empresa, geração de conteúdo, roteiro de narração, prévia 9:16, TTS no navegador, agendamento e gate seguro para publicação oficial.

Principais pontos:
- nova página protegida `/instagram-automatico`;
- acesso pelo dashboard;
- endpoints autenticados `/api/instagram-automation/*`;
- detecção de credenciais sem exposição de tokens;
- documentação em `docs/instagram-automatico.md`;
- rollback preservado em `backup/pre-instagram-automatico-20260819`.

Closes #3

## Comparação

Conferir issue → diff → resultado real/tela → divergências.
