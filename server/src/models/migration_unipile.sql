-- Migration: Integracao com Unipile (API multicanal Instagram/LinkedIn/etc)
-- Substitui Meta API quando nao se tem aprovacao oficial

CREATE TABLE IF NOT EXISTS unipile_config (
  id TEXT PRIMARY KEY,
  api_key TEXT NOT NULL DEFAULT '',
  dsn TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  account_username TEXT NOT NULL DEFAULT '',
  account_provider TEXT NOT NULL DEFAULT 'INSTAGRAM',
  webhook_id TEXT NOT NULL DEFAULT '',
  webhook_url TEXT NOT NULL DEFAULT '',
  webhook_source TEXT NOT NULL DEFAULT 'messaging',
  ativo INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'desconectado'
    CHECK (status IN ('desconectado','conectado','erro')),
  ultimo_erro TEXT,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_unipile_account ON unipile_config(account_id);
