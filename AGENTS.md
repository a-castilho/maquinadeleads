# AGENTS.md — Máquina de Leads

## Objetivo

Evoluir o Máquina de Leads para uma plataforma autônoma de prospecção e gestão de campanhas, reduzindo dependências externas e removendo o n8n do fluxo principal.

## Diretriz principal

O n8n não deve ser necessário para executar uma campanha.

A orquestração deve ser implementada nativamente no backend da aplicação.

O sistema deve reaproveitar ao máximo a arquitetura, entidades, telas e serviços existentes, evitando reescritas desnecessárias.

## Fluxo de produto

O conceito principal apresentado ao usuário deve ser **Campanha**.

O modelo atual de nichos pode continuar existindo internamente quando isso evitar migrações ou refatorações desnecessárias.

Fluxo esperado:

1. Criar campanha.
2. Informar nicho, localização, oferta e objetivo.
3. Gerar estratégia de prospecção.
4. Gerar palavras-chave e mensagem inicial.
5. Buscar potenciais leads.
6. Exibir uma prévia antes da execução.
7. Permitir revisão e ajustes.
8. Ativar a campanha.
9. Processar leads automaticamente.
10. Exibir resultados em um funil.
11. Permitir pausar, continuar ou encerrar a campanha.

## Experiência do usuário

Transformar o fluxo atual em um wizard simples.

### Etapa 1 — Campanha

Coletar:

- nome;
- nicho;
- cidade/região;
- produto ou serviço;
- objetivo da campanha.

### Etapa 2 — Estratégia

Gerar automaticamente:

- palavras-chave;
- critérios de busca;
- abordagem;
- mensagem inicial.

Todo conteúdo gerado deve ser editável.

### Etapa 3 — Leads

Executar uma busca inicial e apresentar uma prévia dos leads encontrados.

O usuário deve conseguir revisar os dados antes de ativar automações.

### Etapa 4 — Preparação

Validar:

- integrações necessárias;
- configuração do WhatsApp;
- parâmetros da campanha;
- existência de leads;
- mensagem de abordagem.

### Etapa 5 — Ativação

Ativar a campanha e iniciar o processamento pelo backend.

## Remoção do n8n

Identificar todos os pontos onde o n8n participa atualmente.

Migrar gradualmente essas responsabilidades para serviços internos.

Não remover código existente antes de existir uma implementação nativa equivalente e funcional.

O n8n poderá permanecer temporariamente como integração legada, mas nenhuma nova funcionalidade central deverá depender dele.

## Orquestração nativa

Criar um mecanismo interno responsável por:

- criação de jobs;
- execução;
- retries;
- controle de estado;
- agendamento;
- prevenção de processamento duplicado;
- registro de erros;
- histórico de execução.

Preferir inicialmente uma solução simples baseada em Node.js e PostgreSQL.

Evitar adicionar infraestrutura desnecessária ao MVP.

## Serviços

Separar responsabilidades em serviços claros, por exemplo:

- CampaignService
- LeadDiscoveryService
- LeadScoringService
- MessagingService
- CampaignRunner
- JobService

Adaptar os nomes à arquitetura já existente quando houver serviços equivalentes.

## Descoberta de leads

Reaproveitar as integrações de busca existentes.

O serviço deve:

- receber parâmetros da campanha;
- executar buscas;
- normalizar resultados;
- remover duplicados;
- persistir leads;
- associar cada lead à campanha.

## Qualificação

Criar score de lead quando houver dados suficientes.

O score pode considerar:

- aderência ao nicho;
- localização;
- presença digital;
- dados de contato;
- qualidade das informações encontradas.

Começar simples e permitir evolução posterior.

## Mensagens

Centralizar o envio em um serviço próprio.

Esse serviço deve controlar:

- envio;
- status;
- erros;
- retries;
- timestamps;
- associação entre mensagem, lead e campanha.

Nenhum segredo ou credential deve ser enviado ao frontend.

## Funil

Apresentar estados claros para os leads, por exemplo:

- descoberto;
- qualificado;
- pronto para contato;
- contatado;
- respondeu;
- interessado;
- convertido;
- descartado.

Reutilizar os estados existentes quando forem equivalentes.

## Dashboard

O Dashboard deve priorizar campanhas e resultados.

Exibir informações como:

- campanhas ativas;
- leads encontrados;
- leads contatados;
- respostas;
- interessados;
- conversões;
- erros relevantes.

Evitar expor detalhes técnicos de infraestrutura na experiência principal.

## Segurança

Nunca:

- commitar `.env`;
- expor tokens no frontend;
- hardcodar credenciais;
- registrar secrets em logs.

Mover configurações sensíveis para variáveis de ambiente.

Se forem encontradas credenciais reais versionadas, sinalizar o problema antes de removê-las e recomendar rotação.

## Compatibilidade

Antes de alterar uma funcionalidade existente:

1. localizar quem a utiliza;
2. verificar impacto no frontend, backend e banco;
3. preservar contratos quando possível;
4. criar migração quando necessário;
5. evitar breaking changes sem necessidade.

## Banco de dados

Reaproveitar o schema existente sempre que possível.

Adicionar migrations para alterações estruturais.

Não apagar dados existentes automaticamente.

## Implementação

Trabalhar incrementalmente.

Para cada etapa:

1. analisar o código existente;
2. identificar o menor conjunto de alterações;
3. implementar;
4. executar testes;
5. corrigir regressões;
6. somente então avançar.

Não reescrever módulos funcionais apenas por preferência arquitetural.

## Testes

Adicionar ou atualizar testes para os fluxos críticos.

Prioridades:

- criação de campanha;
- descoberta de leads;
- deduplicação;
- processamento de jobs;
- retries;
- mudança de estado;
- envio de mensagens;
- pausa e retomada de campanha.

## Critério de pronto

A implementação principal estará pronta quando for possível:

**criar → configurar → revisar → ativar → executar → acompanhar uma campanha sem depender do n8n.**

## Regra para agentes de código

Antes de modificar o projeto, leia a estrutura do repositório e identifique as implementações existentes.

Não presuma que um componente precisa ser criado antes de verificar se já existe algo equivalente.

Prefira alterações pequenas, testáveis e compatíveis com o código atual.

Ao encontrar divergência entre este documento e a implementação real, preserve dados e funcionalidades existentes e escolha a migração de menor risco.
