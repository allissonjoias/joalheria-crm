# IAlisson - CRM Joalheria

## Stack
- **Server**: Express + TypeScript + sql.js (porta 3001)
- **Client**: React + Vite + Tailwind (porta 5173)
- **Banco**: SQLite via sql.js (arquivo: `data.db` na raiz). O banco roda EM MEMORIA - o servidor carrega o arquivo ao iniciar e salva periodicamente.
- **IA (Luma)**: Claude/OpenAI/Gemini via `api_keys` no banco. Prompt SDR retorna JSON com campo `resposta`.

## Regras criticas do sql.js
- O banco roda em memoria. Editar `data.db` com o servidor rodando NAO tem efeito - o servidor vai sobrescrever.
- Para editar o banco: 1) Parar o servidor 2) Editar data.db 3) Iniciar o servidor
- `saveDb()` persiste o banco em memoria para o disco.

## Timezone
- Timezone configuravel pelo usuario em Configuracoes > Fuso Horario (tabela `config_geral`, chave `fuso_horario`)
- Padrao: America/Fortaleza. Carregado do banco ao iniciar o servidor em `server/src/index.ts`
- `process.env.TZ` e atualizado ao salvar novo fuso (aplica imediatamente)
- SQLite usa `datetime('now', 'localtime')` que depende do TZ do processo Node
- **NUNCA use `new Date().toISOString()`** para gerar timestamps — sempre retorna UTC independente do TZ
- No server: usar `agoraLocal()` ou `hojeLocal()` de `server/src/utils/timezone.ts`
- No client: usar `agoraLocal()` de `client/src/utils/timezone.ts`
- Para cron jobs: usar `fusoAtual()` de `server/src/utils/timezone.ts`
- No frontend, extrair hora direto do string do banco (regex) sem usar `new Date()` para evitar conversao de timezone

## Reiniciar servidor
- Ao reiniciar, SEMPRE iniciar server E client (ambos sao node.exe)
- Servidor: `cd server && TZ=America/Fortaleza npm run dev`
- Client: `cd client && npm run dev`
- Ngrok: `ngrok http 3001` (URL publica para webhooks da Meta)
- Verificar: `curl http://localhost:3001/api/webhook/meta?hub.mode=subscribe&hub.verify_token=alisson_joalheria_2026&hub.challenge=OK`

## Instagram
- Conta: @alissonjoias (ig_user_id: 17841402060087765, page_id: 108982134674035)
- Webhook: `/api/webhook/meta` (POST recebe eventos, GET verifica token)
- Meta envia 2 webhooks por DM (IGSID diferentes). Deduplicacao via cache em memoria (`marcarProcessando`) + banco (`meta_msg_id`).
- Ignorar webhooks de contas nao reconhecidas (evita duplicacao)
- `is_echo` e `message_edit` sao filtrados no parser de webhook
- Token expira em ~60 dias. Renovacao manual via painel.

## Resposta da IA
- O prompt SDR (dara_config.prompt_personalizado) instrui a IA a responder em JSON.
- `ClaudeService.enviarMensagem()` automaticamente extrai o campo `resposta` do JSON e limpa o historico.
- No frontend, `MensagemItem.tsx` e `ConversaItem.tsx` tambem extraem `resposta` de JSONs antigos.

## Comunicacao
- Sempre responder em Portugues do Brasil (pt-BR)
- Usuario: Alisson, dono da joalheria, em Fortaleza/CE
