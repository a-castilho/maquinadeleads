# Menu lateral — padrão ChatGPT / RegulaAI

## Objetivo
Padronizar a navegação autenticada da Máquina de Leads com o mesmo comportamento adotado no RegulaAI e inspirado no ChatGPT.

## Comportamento implementado
- menu lateral em todas as rotas autenticadas;
- desktop inicia recolhido na primeira visita;
- botão para expandir e recolher;
- preferência persistida no `localStorage`;
- altura total da viewport (`100dvh`);
- navegação com estado ativo;
- conta e ação de sair no rodapé;
- layout responsivo sem reduzir a área principal de forma incorreta;
- mobile com barra superior, drawer lateral, backdrop e fechamento por `Esc`;
- animações suaves com fallback para `prefers-reduced-motion`.

## Rotas exibidas
- `/` — Início;
- `/instagram-automatico` — Instagram Automático;
- `/relatorios` — Relatórios.

Campanhas e nichos continuam acessíveis pelas telas de negócio e são renderizados dentro do mesmo shell autenticado.

## Arquivos
- `maquina-de-leads/frontend/src/components/AppShell.jsx`
- `maquina-de-leads/frontend/src/app-shell.css`
- `maquina-de-leads/frontend/src/App.jsx`
- `maquina-de-leads/frontend/src/main.jsx`

## Rollback
A versão imediatamente anterior sobre a `main` mais recente foi preservada na branch:

`backup/pre-menu-chatgpt-20260819-v2`
