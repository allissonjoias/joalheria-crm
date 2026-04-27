-- =====================================================================
-- 0002 — Tabelas do schema crm
-- =====================================================================
-- Convenção:
--   • PK uuid (gen_random_uuid)
--   • created_at + updated_at
--   • FK pra public.contatos / public.vendedores / public.leads / auth.users
-- =====================================================================

BEGIN;

-- ============================================================
-- CONFIGURAÇÕES (canais, integrações)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.config_geral (
  chave           text PRIMARY KEY,
  valor           jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao       text,
  atualizado_por  uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE crm.config_geral IS 'Configs key-value (system prompts, defaults, feature flags).';

CREATE TABLE IF NOT EXISTS crm.unipile_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key             text NOT NULL,
  dsn                 text NOT NULL,
  account_id          text,
  account_username    text,
  account_provider    text DEFAULT 'INSTAGRAM',
  webhook_id          text,
  webhook_url         text,
  webhook_source      text DEFAULT 'messaging',
  ativo               boolean NOT NULL DEFAULT true,
  status              text NOT NULL DEFAULT 'desconectado'
                      CHECK (status IN ('desconectado','conectado','erro')),
  ultimo_erro         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.meta_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id              text,
  app_secret          text,
  page_id             text,
  page_access_token   text,
  ig_business_id      text,
  verify_token        text,
  webhook_url         text,
  ativo               boolean NOT NULL DEFAULT true,
  status              text NOT NULL DEFAULT 'desconectado'
                      CHECK (status IN ('desconectado','conectado','erro')),
  ultimo_erro         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.kommo_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain       text,
  client_id       text,
  client_secret   text,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONVERSAS / MENSAGENS
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.conversas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- liga ao cliente (fonte: public.contatos)
  contato_id              bigint REFERENCES public.contatos(id_contato) ON DELETE SET NULL,
  -- opcionalmente lead Kommo (FK pra id_lead que é UNIQUE; PK de leads é composta (id, id_lead))
  lead_id                 bigint REFERENCES public.leads(id_lead) ON DELETE SET NULL,
  -- vendedor responsável
  vendedor_id             bigint REFERENCES public.vendedores(id_vendedor) ON DELETE SET NULL,
  -- canal de origem
  canal                   text NOT NULL
                          CHECK (canal IN ('instagram_dm','instagram_comment','whatsapp','telegram','email','interna')),
  -- ID do cliente no canal (Meta IGSID, Unipile IGSID, número WhatsApp, etc)
  canal_contato_id        text,
  -- ID do thread/chat no canal (chat_id Unipile, thread_id Meta)
  canal_thread_id         text,
  -- metadata
  status                  text NOT NULL DEFAULT 'aberta'
                          CHECK (status IN ('aberta','aguardando','fechada','arquivada')),
  modo_auto               boolean NOT NULL DEFAULT false,  -- IA respondendo sozinha?
  ultima_msg_em           timestamptz,
  ultima_msg_resumo       text,
  nao_lidas_count         integer NOT NULL DEFAULT 0,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  -- evita duplicação por (canal, thread_id) — idempotência de webhook
  UNIQUE (canal, canal_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_conversas_contato ON crm.conversas(contato_id);
CREATE INDEX IF NOT EXISTS idx_conversas_vendedor ON crm.conversas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_conversas_canal_contatoid ON crm.conversas(canal, canal_contato_id);
CREATE INDEX IF NOT EXISTS idx_conversas_status ON crm.conversas(status) WHERE status <> 'arquivada';
CREATE INDEX IF NOT EXISTS idx_conversas_ultima_msg ON crm.conversas(ultima_msg_em DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS crm.mensagens (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id             uuid NOT NULL REFERENCES crm.conversas(id) ON DELETE CASCADE,
  -- ID externo (Meta msg_id, Unipile msg_id) — pra dedupe
  canal_message_id        text,
  papel                   text NOT NULL
                          CHECK (papel IN ('user','assistant','system','vendedor','interno')),
  conteudo                text,
  tipo_midia              text
                          CHECK (tipo_midia IS NULL OR tipo_midia IN ('imagem','video','audio','documento','sticker')),
  midia_url               text,         -- URL pública (Supabase Storage ou CDN)
  midia_storage_path      text,         -- caminho no Supabase Storage (pra deletar depois)
  duracao_segundos        integer,      -- pra áudio/vídeo
  -- vincula a um post do Instagram (story/feed) que o cliente comentou/respondeu
  instagram_media_id      text,
  -- estado de envio
  status                  text NOT NULL DEFAULT 'enviada'
                          CHECK (status IN ('pendente','enviando','enviada','entregue','lida','erro')),
  erro                    text,
  enviado_em              timestamptz,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversa_id, canal_message_id)  -- idempotência
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON crm.mensagens(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_instagram_media ON crm.mensagens(instagram_media_id) WHERE instagram_media_id IS NOT NULL;

-- ============================================================
-- INSTAGRAM POSTS (cache local de stories/feed)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.instagram_posts (
  id                      text PRIMARY KEY,        -- IG media_id
  tipo                    text                      -- IMAGE, VIDEO, CAROUSEL_ALBUM, STORY
                          CHECK (tipo IS NULL OR tipo IN ('IMAGE','VIDEO','CAROUSEL_ALBUM','STORY','REEL')),
  caption                 text,
  permalink               text,
  thumbnail_url           text,    -- URL Instagram (expira em 24h se story)
  media_url               text,
  thumbnail_storage_path  text,    -- caminho no Supabase Storage (cópia local)
  media_storage_path      text,
  thumbnail_url_local     text,    -- URL pública do Storage
  media_url_local         text,
  timestamp_post          timestamptz,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- FUNIL DE MENSAGERIA (diferente das etapas Kommo em public.leads)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.funil_blocos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  ordem         integer NOT NULL,
  cor           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.funil_etapas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id      uuid NOT NULL REFERENCES crm.funil_blocos(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  ordem         integer NOT NULL,
  cor           text,
  ativo         boolean NOT NULL DEFAULT true,
  -- regras automáticas (ex: gatilho ao entrar)
  acao_entrada  jsonb,
  acao_saida    jsonb,
  sla_horas     integer,   -- SLA pra próximo movimento
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funil_etapas_bloco ON crm.funil_etapas(bloco_id, ordem);

CREATE TABLE IF NOT EXISTS crm.funil_movimentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id   uuid NOT NULL REFERENCES crm.conversas(id) ON DELETE CASCADE,
  etapa_de      uuid REFERENCES crm.funil_etapas(id),
  etapa_para    uuid REFERENCES crm.funil_etapas(id),
  motivo        text,
  movido_por    uuid REFERENCES auth.users(id),
  movido_em     timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_funil_movimentos_conversa ON crm.funil_movimentos(conversa_id, movido_em DESC);

-- Adiciona etapa atual na conversa
ALTER TABLE crm.conversas
  ADD COLUMN IF NOT EXISTS etapa_atual_id uuid REFERENCES crm.funil_etapas(id) ON DELETE SET NULL;

-- ============================================================
-- IA: Agentes, prompts, runs, SDR
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.prompt_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text UNIQUE NOT NULL,           -- 'sdr.qualifier', 'atendimento.respostas', etc
  nome            text NOT NULL,
  descricao       text,
  modelo          text,                           -- 'claude-3-5-sonnet', 'gpt-4o', etc
  temperatura     numeric(3,2) DEFAULT 0.7,
  system_prompt   text NOT NULL,
  variaveis       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ['cliente.nome', 'mensagens.ultimas_5', ...]
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.agentes_ia (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              text UNIQUE NOT NULL,           -- 'sdr', 'atendimento', 'closer'
  nome                text NOT NULL,
  descricao           text,
  prompt_template_id  uuid REFERENCES crm.prompt_templates(id),
  parametros          jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo               boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.agente_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id       uuid REFERENCES crm.agentes_ia(id) ON DELETE SET NULL,
  conversa_id     uuid REFERENCES crm.conversas(id) ON DELETE CASCADE,
  prompt_final    text,
  resposta        text,
  modelo          text,
  tokens_input    integer,
  tokens_output   integer,
  custo_usd       numeric(10,6),
  elapsed_ms      integer,
  erro            text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agente_runs_conversa ON crm.agente_runs(conversa_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm.sdr_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id         uuid NOT NULL REFERENCES crm.conversas(id) ON DELETE CASCADE,
  -- BANT scoring
  score_budget        smallint CHECK (score_budget BETWEEN 0 AND 100),
  score_authority     smallint CHECK (score_authority BETWEEN 0 AND 100),
  score_need          smallint CHECK (score_need BETWEEN 0 AND 100),
  score_timing        smallint CHECK (score_timing BETWEEN 0 AND 100),
  score_total         smallint CHECK (score_total BETWEEN 0 AND 100),
  bonus_engajamento   smallint DEFAULT 0,
  classificacao       text CHECK (classificacao IN ('frio','morno','quente','muito_quente')),
  resumo              text,
  proximos_passos     text,
  agente_run_id       uuid REFERENCES crm.agente_runs(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_runs_conversa ON crm.sdr_runs(conversa_id, created_at DESC);

-- ============================================================
-- BRECHAS (oportunidades comerciais detectadas)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.brechas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id     uuid REFERENCES crm.conversas(id) ON DELETE CASCADE,
  contato_id      bigint REFERENCES public.contatos(id_contato) ON DELETE CASCADE,
  tipo            text NOT NULL,                      -- 'aniversario', 'data_casamento', 'follow_up_pos_venda', etc
  titulo          text NOT NULL,
  descricao       text,
  prioridade      text NOT NULL DEFAULT 'media'
                  CHECK (prioridade IN ('baixa','media','alta','urgente')),
  status          text NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta','em_andamento','fechada','descartada')),
  vencimento      timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  detectada_em    timestamptz NOT NULL DEFAULT now(),
  fechada_em      timestamptz,
  fechada_por     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brechas_status ON crm.brechas(status, vencimento);
CREATE INDEX IF NOT EXISTS idx_brechas_contato ON crm.brechas(contato_id);

-- ============================================================
-- CICLO DE VIDA (eventos do cliente: primeira_msg, qualificou, ghost, comprou, etc)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.ciclo_vida_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id     uuid REFERENCES crm.conversas(id) ON DELETE CASCADE,
  contato_id      bigint REFERENCES public.contatos(id_contato) ON DELETE CASCADE,
  evento          text NOT NULL,
                  -- 'primeira_mensagem', 'qualificou', 'ghost', 'recuperado',
                  -- 'cotacao_enviada', 'venda_fechada', 'pos_venda_iniciado'
  detalhes        jsonb,
  ocorrido_em     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ciclo_vida_conversa ON crm.ciclo_vida_eventos(conversa_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_ciclo_vida_contato ON crm.ciclo_vida_eventos(contato_id, evento, ocorrido_em DESC);

-- ============================================================
-- AUTOMAÇÕES (regras gatilho → ação)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.automacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  descricao       text,
  ativa           boolean NOT NULL DEFAULT true,
  prioridade      smallint NOT NULL DEFAULT 100,
  condicoes       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- regras JSON
  acoes           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- lista de ações
  total_execucoes bigint NOT NULL DEFAULT 0,
  ultima_execucao timestamptz,
  criado_por      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.automacao_gatilhos (
  automacao_id    uuid NOT NULL REFERENCES crm.automacoes(id) ON DELETE CASCADE,
  gatilho         text NOT NULL,
                  -- 'mensagem_recebida','conversa_criada','etapa_mudou','sdr_qualificou','sla_estourou','timer'
  parametros      jsonb,
  PRIMARY KEY (automacao_id, gatilho)
);

CREATE TABLE IF NOT EXISTS crm.automacao_execucoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automacao_id    uuid NOT NULL REFERENCES crm.automacoes(id) ON DELETE CASCADE,
  conversa_id     uuid REFERENCES crm.conversas(id) ON DELETE SET NULL,
  gatilho         text,
  payload         jsonb,
  resultado       jsonb,
  sucesso         boolean,
  erro            text,
  elapsed_ms      integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aut_execucoes_automacao ON crm.automacao_execucoes(automacao_id, created_at DESC);

-- ============================================================
-- TAREFAS DO CRM (separado das alissonerp.tarefas que é produção)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.tarefas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descricao       text,
  conversa_id     uuid REFERENCES crm.conversas(id) ON DELETE SET NULL,
  contato_id      bigint REFERENCES public.contatos(id_contato) ON DELETE SET NULL,
  brecha_id       uuid REFERENCES crm.brechas(id) ON DELETE SET NULL,
  responsavel_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prioridade      text NOT NULL DEFAULT 'media'
                  CHECK (prioridade IN ('baixa','media','alta','urgente')),
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  data_limite     timestamptz,
  concluida_em    timestamptz,
  criado_por      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_resp ON crm.tarefas(responsavel_id, status, data_limite);
CREATE INDEX IF NOT EXISTS idx_tarefas_conversa ON crm.tarefas(conversa_id);

-- ============================================================
-- NOTIFICAÇÕES (próprias do CRM)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.notificacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            text NOT NULL,    -- 'mensagem_nova', 'sdr_qualificou', 'tarefa_atribuida', etc
  titulo          text NOT NULL,
  mensagem        text,
  link            text,             -- ex: '/mensageria/<conversa_id>'
  conversa_id     uuid REFERENCES crm.conversas(id) ON DELETE CASCADE,
  contato_id      bigint REFERENCES public.contatos(id_contato) ON DELETE SET NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  lida            boolean NOT NULL DEFAULT false,
  lida_em         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON crm.notificacoes(user_id, lida, created_at DESC);

-- ============================================================
-- WEBHOOKS (próprios do CRM)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.webhook_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL UNIQUE,
  source          text NOT NULL,    -- 'unipile','meta','kommo','n8n','generico'
  url_callback    text,             -- onde a fonte chama (recebimento)
  ativo           boolean NOT NULL DEFAULT true,
  total_eventos   bigint NOT NULL DEFAULT 0,
  ultimo_evento   timestamptz,
  ultimo_erro     text,
  configuracao    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm.webhook_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL,
  event           text,
  payload         jsonb,
  processado      boolean NOT NULL DEFAULT false,
  resultado       jsonb,
  erro            text,
  conversa_id     uuid REFERENCES crm.conversas(id) ON DELETE SET NULL,
  mensagem_id     uuid REFERENCES crm.mensagens(id) ON DELETE SET NULL,
  recebido_em     timestamptz NOT NULL DEFAULT now(),
  processado_em   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webhook_log_source ON crm.webhook_log(source, recebido_em DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_pendente ON crm.webhook_log(processado, recebido_em) WHERE NOT processado;

-- ============================================================
-- AUDITORIA
-- ============================================================

CREATE TABLE IF NOT EXISTS crm.audit_log (
  id              bigserial PRIMARY KEY,
  schema_name     text NOT NULL,
  table_name      text NOT NULL,
  operacao        text NOT NULL CHECK (operacao IN ('INSERT','UPDATE','DELETE')),
  registro_id     text,
  user_id         uuid,
  dados_antes     jsonb,
  dados_depois    jsonb,
  diff            jsonb,
  ocorrido_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_id ON crm.audit_log(schema_name, table_name, registro_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON crm.audit_log(user_id, ocorrido_em DESC);

COMMIT;
