-- Migration: WhatsApp via Evolution API (QR Code)
-- Adiciona suporte a WhatsApp por QR code com envio em massa

-- Configuracao da Evolution API
CREATE TABLE IF NOT EXISTS evolution_config (
  id TEXT PRIMARY KEY,
  api_url TEXT NOT NULL DEFAULT 'http://localhost:8080',
  api_key TEXT NOT NULL DEFAULT '',
  instance_name TEXT NOT NULL DEFAULT 'ialisson',
  status TEXT NOT NULL DEFAULT 'desconectado'
    CHECK (status IN ('desconectado','conectando','conectado','erro')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Fila de mensagens para envio em massa (anti-ban)
CREATE TABLE IF NOT EXISTS whatsapp_fila (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  telefone TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviando','enviado','erro','cancelado')),
  erro_detalhe TEXT,
  campanha_id TEXT,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  enviado_em TEXT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- Campanhas de envio em massa
CREATE TABLE IF NOT EXISTS whatsapp_campanhas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  mensagem_template TEXT NOT NULL,
  total_contatos INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','rodando','pausada','concluida','cancelada')),
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Controle de warmup anti-ban
CREATE TABLE IF NOT EXISTS whatsapp_warmup (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL UNIQUE,
  mensagens_enviadas INTEGER DEFAULT 0,
  limite_diario INTEGER DEFAULT 20,
  criado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_fila_status ON whatsapp_fila(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_fila_campanha ON whatsapp_fila(campanha_id);
