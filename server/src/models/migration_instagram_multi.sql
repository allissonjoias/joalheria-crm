-- Migration: Instagram Multi-conta via OAuth
CREATE TABLE IF NOT EXISTS instagram_contas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  username TEXT,
  ig_user_id TEXT,
  page_id TEXT,
  page_name TEXT,
  access_token TEXT NOT NULL,
  token_expira_em TEXT,
  ativo INTEGER DEFAULT 1,
  receber_dm INTEGER DEFAULT 1,
  receber_comentarios INTEGER DEFAULT 1,
  receber_mencoes INTEGER DEFAULT 1,
  responder_comentarios_auto INTEGER DEFAULT 0,
  responder_mencoes_auto INTEGER DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
