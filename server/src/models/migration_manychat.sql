-- Migration: Integracao ManyChat
-- Recebe leads do ManyChat via webhook

-- Configuracao da integracao ManyChat
CREATE TABLE IF NOT EXISTS manychat_config (
  id TEXT PRIMARY KEY DEFAULT '1',
  webhook_secret TEXT,
  api_key TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  auto_distribuir INTEGER NOT NULL DEFAULT 1,
  funil_destino_id INTEGER,
  estagio_destino TEXT DEFAULT 'Lead',
  origem_padrao TEXT DEFAULT 'manychat',
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Mapeamento ManyChat subscriber_id <-> cliente_id (evita duplicatas)
CREATE TABLE IF NOT EXISTS manychat_mapeamento (
  id TEXT PRIMARY KEY,
  manychat_subscriber_id TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  dados_extra TEXT,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manychat_subscriber ON manychat_mapeamento(manychat_subscriber_id);

-- Expandir CHECK constraint do webhook_log para incluir 'manychat'
-- SQLite nao suporta ALTER CHECK, entao recriamos a tabela
CREATE TABLE IF NOT EXISTS webhook_log_new (
  id TEXT PRIMARY KEY,
  plataforma TEXT NOT NULL,
  payload TEXT NOT NULL,
  processado INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO webhook_log_new SELECT * FROM webhook_log;

DROP TABLE IF EXISTS webhook_log;

ALTER TABLE webhook_log_new RENAME TO webhook_log;

CREATE INDEX IF NOT EXISTS idx_webhook_log_criado ON webhook_log(criado_em);
