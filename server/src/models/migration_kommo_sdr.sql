-- Mapeamento telefone -> lead do Kommo (para SDR)
CREATE TABLE IF NOT EXISTS kommo_telefone_lead (
  telefone TEXT PRIMARY KEY,
  kommo_lead_id INTEGER NOT NULL,
  kommo_contact_id INTEGER,
  nome_contato TEXT,
  bant_need TEXT,
  bant_budget TEXT,
  bant_timeline TEXT,
  bant_authority TEXT,
  bant_score INTEGER DEFAULT 0,
  estagio_atual INTEGER,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Historico de conversas SDR com leads do Kommo
CREATE TABLE IF NOT EXISTS kommo_sdr_conversas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kommo_lead_id INTEGER NOT NULL,
  telefone TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('user', 'assistant')),
  conteudo TEXT NOT NULL,
  criado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_kommo_sdr_conv_lead ON kommo_sdr_conversas(kommo_lead_id);
CREATE INDEX IF NOT EXISTS idx_kommo_sdr_conv_tel ON kommo_sdr_conversas(telefone);
