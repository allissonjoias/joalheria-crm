-- Migration: Agente SDR (Sales Development Representative)
-- Monitora Kommo CRM e envia relatorios via WhatsApp

-- Configuracao do agente SDR
CREATE TABLE IF NOT EXISTS sdr_agent_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ativo INTEGER DEFAULT 0,
  telefone_admin TEXT DEFAULT '',
  intervalo_polling INTEGER DEFAULT 5,
  cron_resumo_manha TEXT DEFAULT '0 8 * * 1-6',
  cron_resumo_tarde TEXT DEFAULT '0 17 * * 1-6',
  auto_criar_tasks INTEGER DEFAULT 0,
  auto_followup INTEGER DEFAULT 0,
  auto_mover_leads INTEGER DEFAULT 0,
  dias_inatividade INTEGER DEFAULT 7,
  deadline_primeiro_contato INTEGER DEFAULT 4,
  deadline_followup INTEGER DEFAULT 24,
  deadline_pos_venda INTEGER DEFAULT 168,
  prompt_personalizado TEXT DEFAULT '',
  ultimo_polling TEXT,
  criado_em TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);

-- Snapshot do estado de cada lead no Kommo (para detectar deltas)
CREATE TABLE IF NOT EXISTS sdr_agent_lead_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kommo_lead_id INTEGER NOT NULL UNIQUE,
  nome TEXT,
  pipeline_id INTEGER,
  status_id INTEGER,
  responsavel_id INTEGER,
  valor REAL DEFAULT 0,
  updated_at INTEGER,
  criado_em TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshot_kommo_lead_id ON sdr_agent_lead_snapshot(kommo_lead_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_updated_at ON sdr_agent_lead_snapshot(updated_at);

-- Log de eventos detectados e acoes tomadas
CREATE TABLE IF NOT EXISTS sdr_agent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  prioridade TEXT DEFAULT 'media',
  lead_id INTEGER,
  lead_nome TEXT,
  descricao TEXT NOT NULL,
  acao_tomada TEXT,
  notificado INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sdr_log_tipo ON sdr_agent_log(tipo);
CREATE INDEX IF NOT EXISTS idx_sdr_log_criado_em ON sdr_agent_log(criado_em);

-- Inserir config padrao se nao existir
INSERT OR IGNORE INTO sdr_agent_config (id) VALUES (1);
