# Revisão PR #6 — feat(ui): menu lateral ChatGPT / RegulaAI

## Metadados

- **Estado:** Aberta
- **Autor:** @acastilho
- **Base/Head:** `main` ← `feature/menu-chatgpt-regulaai-v2`
- **Fonte:** https://github.com/a-castilho/maquinadeleads/pull/6

## Sinais automáticos

- **Issue detectada:** SIM
- **Mudança de UI provável:** SIM
- **Evidência visual detectada:** NÃO
- **Arquivos:** 5

> UI provável sem evidência deve ser justificada ou receber screenshot/registro antes do merge.

## Arquivos alterados

- `docs/menu-lateral-chatgpt-regulaai.md` (+34/-0)
- `maquina-de-leads/frontend/src/App.jsx` (+10/-5)
- `maquina-de-leads/frontend/src/app-shell.css` (+140/-0)
- `maquina-de-leads/frontend/src/components/AppShell.jsx` (+151/-0)
- `maquina-de-leads/frontend/src/main.jsx` (+1/-0)

## Descrição/evidências da PR

Implementa o menu lateral recolhível da Máquina de Leads seguindo o comportamento já usado no RegulaAI e inspirado no ChatGPT.

- shell único para todas as rotas autenticadas;
- desktop inicia recolhido e persiste preferência;
- navegação ativa com Início, Instagram Automático e Relatórios;
- conta e logout no rodapé;
- menu ocupa 100dvh;
- drawer mobile com backdrop e fechamento por Esc;
- animações respeitam prefers-reduced-motion;
- documentação em docs/menu-lateral-chatgpt-regulaai.md;
- rollback em backup/pre-menu-chatgpt-20260819-v2.

Closes #5

## Comparação

Conferir issue → diff → resultado real/tela → divergências.
