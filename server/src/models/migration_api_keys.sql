-- Migration: Tabela para armazenar API Keys dos provedores de IA
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL DEFAULT '',
  modelo TEXT DEFAULT '',
  ativo INTEGER DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);

-- Inserir registros para cada provedor (modelos mais recentes - Mar 2026)
INSERT OR IGNORE INTO api_keys (id, provider, api_key, modelo) VALUES ('anthropic', 'anthropic', '', 'claude-sonnet-4-6');
INSERT OR IGNORE INTO api_keys (id, provider, api_key, modelo) VALUES ('openai', 'openai', '', 'gpt-4o');
INSERT OR IGNORE INTO api_keys (id, provider, api_key, modelo) VALUES ('gemini', 'gemini', '', 'gemini-2.5-flash');
