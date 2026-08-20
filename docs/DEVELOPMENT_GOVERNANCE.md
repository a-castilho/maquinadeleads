# Regra de rastreabilidade, revisão e documentação

Esta regra é obrigatória para mudanças funcionais, correções, novas ideias e alterações visuais do projeto.

## Fonte de verdade

- **Issue = intenção:** problema, objetivo, comportamento atual, esperado e critérios de aceite.
- **PR = execução:** o que foi implementado, arquivos alterados, testes e evidência.
- **Relatório = evidência:** `docs/issues/` e `docs/reviews/` são gerados automaticamente e ficam versionados.

## Cada issue

Toda issue deve registrar contexto/problema, objetivo, estado atual, resultado esperado, critérios de aceite, impacto visual quando existir e riscos/dependências. O workflow `issue-documentation.yml` gera/atualiza `docs/issues/issue-<numero>.md`.

## Novas ideias

Use o template **Nova ideia**. Registre hipótese, valor esperado, experiência/tela imaginada, como validar, riscos e alternativas antes de assumir implementação.

## Revisão

Toda PR deve referenciar uma issue, explicar o que mudou e como validar, registrar testes e, para UI, incluir evidência antes/depois. Divergências entre solicitado e entregue devem ser explícitas.

O workflow `review-documentation.yml` gera `docs/reviews/pr-<numero>.md` com arquivos alterados, sinais automáticos de rastreabilidade e o conteúdo da PR.

## Comparação obrigatória

1. **Planejado:** issue e critérios de aceite.
2. **Implementado:** diff, arquivos e descrição da PR.
3. **Real:** tela, rota, fluxo, resposta de API, log, teste ou outra evidência observável.
4. **Divergências:** registrar antes do merge.

## Definition of Done

Só considerar concluído quando existir rastreabilidade, critérios verificados, testes, comparação do resultado real com o esperado, divergências registradas e documentação atualizada.

<!-- COMPROMISSO-GERAL-A-CASTILHO -->

---

## Compromisso Geral

**Sempre na melhor prática. No caminho do bem maior.**

**Ir até o fim sem sair do caminho, seja ele qual for.**

