-- Migration: Configuracao da API oficial do WhatsApp (Meta Cloud API)
-- Armazena credenciais e configuracoes para envio via API oficial

CREATE TABLE IF NOT EXISTS meta_api_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  access_token TEXT,
  phone_number_id TEXT,
  waba_id TEXT,
  token_tipo TEXT DEFAULT 'temporario',
  token_expira_em TEXT,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Tabela para campanhas via API oficial (separada das campanhas Baileys)
CREATE TABLE IF NOT EXISTS meta_campanhas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  template_name TEXT,
  template_language TEXT DEFAULT 'pt_BR',
  mensagem_template TEXT,
  canal TEXT DEFAULT 'meta_api',
  total_contatos INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  status TEXT DEFAULT 'rascunho',
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Fila de envio via API oficial
CREATE TABLE IF NOT EXISTS meta_fila (
  id TEXT PRIMARY KEY,
  cliente_id TEXT,
  telefone TEXT NOT NULL,
  template_name TEXT,
  mensagem TEXT,
  status TEXT DEFAULT 'pendente',
  erro_detalhe TEXT,
  meta_message_id TEXT,
  campanha_id TEXT,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  enviado_em TEXT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (campanha_id) REFERENCES meta_campanhas(id)
);

CREATE INDEX IF NOT EXISTS idx_meta_fila_status ON meta_fila(status);
CREATE INDEX IF NOT EXISTS idx_meta_fila_campanha ON meta_fila(campanha_id);
