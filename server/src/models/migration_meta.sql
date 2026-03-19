-- Migration: Integração Meta (WhatsApp + Instagram)
-- Adiciona suporte a mensageria multicanal

-- Novas colunas em conversas
ALTER TABLE conversas ADD COLUMN canal TEXT NOT NULL DEFAULT 'interno' CHECK (canal IN ('whatsapp', 'instagram_dm', 'instagram_comment', 'interno'));
ALTER TABLE conversas ADD COLUMN meta_contato_id TEXT;
ALTER TABLE conversas ADD COLUMN meta_contato_nome TEXT;
ALTER TABLE conversas ADD COLUMN modo_auto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversas ADD COLUMN ultimo_canal_msg_id TEXT;

-- Novas colunas em mensagens
ALTER TABLE mensagens ADD COLUMN canal_origem TEXT DEFAULT 'interno' CHECK (canal_origem IN ('whatsapp', 'instagram_dm', 'instagram_comment', 'interno'));
ALTER TABLE mensagens ADD COLUMN meta_msg_id TEXT;
ALTER TABLE mensagens ADD COLUMN status_envio TEXT DEFAULT 'enviado' CHECK (status_envio IN ('pendente', 'enviado', 'entregue', 'lido', 'falhou'));
ALTER TABLE mensagens ADD COLUMN tipo_midia TEXT DEFAULT 'texto' CHECK (tipo_midia IN ('texto', 'imagem', 'audio', 'video', 'comentario'));
ALTER TABLE mensagens ADD COLUMN midia_url TEXT;

-- Tabela de configuração Meta API
CREATE TABLE IF NOT EXISTS meta_config (
  id TEXT PRIMARY KEY,
  page_id TEXT,
  whatsapp_phone_number_id TEXT,
  instagram_business_account_id TEXT,
  access_token TEXT,
  webhook_verify_token TEXT NOT NULL DEFAULT 'alisson_joalheria_2026',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Tabela para rastrear posts/reels do Instagram (para comentários)
CREATE TABLE IF NOT EXISTS instagram_posts (
  id TEXT PRIMARY KEY,
  ig_media_id TEXT NOT NULL UNIQUE,
  tipo TEXT DEFAULT 'post' CHECK (tipo IN ('post', 'reel', 'story')),
  caption TEXT,
  permalink TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Log de webhooks recebidos (debug)
CREATE TABLE IF NOT EXISTS webhook_log (
  id TEXT PRIMARY KEY,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('whatsapp', 'instagram')),
  payload TEXT NOT NULL,
  processado INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversas_canal ON conversas(canal);
CREATE INDEX IF NOT EXISTS idx_conversas_meta_contato ON conversas(meta_contato_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_meta_msg ON mensagens(meta_msg_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_criado ON webhook_log(criado_em);
