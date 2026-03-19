-- Migration: Importacao Kommo CRM
-- Adiciona suporte a importacao de dados do Kommo

-- Credenciais OAuth2 do Kommo
CREATE TABLE IF NOT EXISTS kommo_config (
  id TEXT PRIMARY KEY,
  subdomain TEXT NOT NULL DEFAULT 'alissonjoiass',
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  redirect_uri TEXT DEFAULT 'https://localhost/kommo/callback',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Log de progresso das importacoes
CREATE TABLE IF NOT EXISTS kommo_import_log (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('contatos','leads','notas','conversas')),
  total_esperado INTEGER DEFAULT 0,
  total_importado INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','rodando','concluido','erro','cancelado')),
  detalhes TEXT,
  iniciado_em TEXT,
  finalizado_em TEXT,
  criado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Mapeamento Kommo ID <-> IAlisson ID (evita duplicatas)
CREATE TABLE IF NOT EXISTS kommo_mapeamento (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('contato','lead','conversa','nota')),
  kommo_id INTEGER NOT NULL,
  local_id TEXT NOT NULL,
  criado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kommo_map ON kommo_mapeamento(tipo, kommo_id);
