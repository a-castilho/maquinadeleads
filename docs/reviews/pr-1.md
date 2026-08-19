# Revisão PR #1 — feat: motor nativo para substituir n8n

> Baseline criado na adoção da nova regra de revisão.

- **Estado:** aberta / declarada como draft
- **Fonte:** https://github.com/a-castilho/maquinadeleads/pull/1
- **Issue relacionada detectada:** NÃO
- **Mudança de UI provável:** SIM
- **Evidência visual detectada na descrição:** NÃO

## Entrega declarada
Motor nativo com fila/auditoria, descoberta e enriquecimento, scoring, funil, Evolution API, ciclo de vida da campanha e dashboard convertido para Campanhas com fluxo em cinco etapas.

## Pendências já declaradas
- validar contra o PostgreSQL real;
- validar worker e descoberta real;
- validar Evolution API/WhatsApp;
- revisar pausa durante lote de envio;
- decidir remoção definitiva do legado n8n.

## Lacuna crítica de revisão
A descrição detalha várias mudanças de produto e frontend, mas não contém evidência visual. Antes do merge, comparar o fluxo real Campanha → Estratégia → Leads → Preparação → Ativação, o funil, métricas e estados de execução com o escopo declarado. A própria PR afirma que o teste end-to-end real ainda é pendente, portanto não deve ser tratada como validada na tela.
