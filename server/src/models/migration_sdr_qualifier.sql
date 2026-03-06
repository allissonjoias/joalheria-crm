-- Migration: SDR Qualificador Ativo de Leads
-- Tabela para armazenar qualificacao BANT por lead

CREATE TABLE IF NOT EXISTS sdr_lead_qualificacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kommo_lead_id INTEGER,
  cliente_id TEXT,
  telefone TEXT,
  lead_score INTEGER DEFAULT 0,
  classificacao TEXT DEFAULT 'FRIO',
  bant_budget TEXT,
  bant_budget_score INTEGER DEFAULT 0,
  bant_authority TEXT,
  bant_authority_score INTEGER DEFAULT 0,
  bant_need TEXT,
  bant_need_score INTEGER DEFAULT 0,
  bant_timeline TEXT,
  bant_timeline_score INTEGER DEFAULT 0,
  kommo_pipeline_id INTEGER,
  kommo_status_id INTEGER,
  ultima_interacao TEXT,
  criado_em TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sdr_qual_telefone ON sdr_lead_qualificacao(telefone);
CREATE INDEX IF NOT EXISTS idx_sdr_qual_kommo_lead ON sdr_lead_qualificacao(kommo_lead_id);
CREATE INDEX IF NOT EXISTS idx_sdr_qual_cliente ON sdr_lead_qualificacao(cliente_id);
