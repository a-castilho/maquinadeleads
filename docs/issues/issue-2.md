# Issue #2 — homologação: validar central de Relatórios na tela

> Documento gerado automaticamente. Edite a issue; este arquivo será sincronizado.

## Metadados

- **Status:** open
- **Autor:** @acastilho
- **Responsáveis:** —
- **Labels:** —
- **Atualizada em:** 2026-08-19T17:26:40Z
- **Fonte:** https://github.com/a-castilho/maquinadeleads/issues/2

## Planejado / descrição

## Objetivo
Validar em homologação a nova área **Relatórios** da Máquina de Leads e registrar evidência da interface entregue.

## Implementado
- [x] botão Relatórios no painel
- [x] rota `/relatorios` dentro de `PrivateRoute`
- [x] leitura por categorias e busca
- [x] Copiar para conversa
- [x] atalho Nova ideia
- [x] projeção gerada automaticamente por allowlist
- [x] sanitização de padrões sensíveis

## Segurança
O repositório e a documentação de origem são públicos, mas a aplicação exibe somente a projeção sanitizada. Arquivos `.env`, credenciais, secrets, tokens, connection strings e logs brutos não entram na allowlist.

## Critérios pendentes
- [ ] abrir `/relatorios` na homologação real
- [ ] registrar screenshot/evidência visual desktop
- [ ] registrar screenshot/evidência visual mobile
- [ ] testar busca e categorias
- [ ] testar Copiar para conversa
- [ ] comparar planejado x implementado x tela real

Referência: `docs/ideas/RELATORIOS_HOMOLOGACAO_VALIDACAO.md`.

## Regra de revisão

A PR deve comparar **planejado x implementado x tela/resultado real** e registrar evidência.
