# Instagram Automático — Máquina de Leads

## Objetivo

Transformar o cadastro da empresa em um pacote de conteúdo pronto para Instagram, reduzindo o trabalho manual entre estratégia, texto, imagem, narração, prévia e publicação.

## Fluxo implementado

1. Cadastro do perfil da empresa: nome, segmento, região, público, oferta, tom, objetivo e Instagram.
2. Geração de conteúdo pela API: headline, legenda, CTA, hashtags, roteiro de narração e prompt visual.
3. Prévia visual em formato Reel 9:16.
4. Narração no navegador usando `SpeechSynthesis`, priorizando vozes pt-BR disponíveis no dispositivo.
5. Edição manual do texto antes da aprovação.
6. Agendamento de data/hora ou tentativa de publicação imediata.
7. Bloqueio seguro quando as credenciais oficiais do Instagram ainda não estão configuradas.

## Endpoints

Todos os endpoints abaixo exigem autenticação.

- `GET /api/instagram-automation/capabilities`
- `POST /api/instagram-automation/generate`
- `POST /api/instagram-automation/publish`

## Variáveis de ambiente

A geração de texto e a prévia não dependem das credenciais abaixo. A publicação automática só é liberada quando todas estão presentes no servidor.

- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `PUBLIC_MEDIA_BASE_URL`

## Segurança

- Credenciais não ficam no frontend.
- A UI nunca recebe ou exibe o token da conta.
- A rota de publicação retorna `409` com `INSTAGRAM_INTEGRATION_REQUIRED` enquanto a integração não estiver completa.
- Nenhuma postagem é simulada como concluída quando a Meta ainda não está conectada.

## Estado atual

### Implementado

- Página protegida `/instagram-automatico`.
- Acesso pelo dashboard.
- Persistência local do perfil para reduzir retrabalho do usuário.
- Geração de texto no backend.
- Prompt visual 9:16.
- Narração e escolha de voz pelo navegador.
- Prévia de Reel.
- Fluxo de aprovação, agendamento e publicação.
- Detecção de capacidades da integração.
- Layout responsivo.

### Próxima evolução

- Renderização real do vídeo vertical com imagem + áudio.
- Armazenamento do arquivo em URL pública.
- Adaptador oficial de criação/publicação de mídia da Meta.
- Persistência de campanhas sociais e histórico no PostgreSQL.
- Métricas reais de publicação e leads atribuídos.
- Provedor de geração de imagem configurável.

## Critérios de aceite do MVP

- O usuário autenticado acessa o módulo sem sair da Máquina de Leads.
- O sistema não permite gerar pacote sem nome da empresa e segmento.
- O texto retornado usa os dados do perfil informado.
- O roteiro pode ser ouvido no navegador.
- O usuário consegue alterar texto e data antes de publicar.
- Sem credenciais de Instagram, a publicação é bloqueada com mensagem clara e sem falso positivo.
- A versão anterior permanece preservada na branch `backup/pre-instagram-automatico-20260819`.
