-- Migration: Funil V3 - Campos avancados para kanban enriquecido
-- Adiciona classificacao, perfil, score_bant, canal, e campos de controle

-- Campos de qualificacao e perfil
ALTER TABLE pipeline ADD COLUMN score_bant INTEGER DEFAULT 0;
ALTER TABLE pipeline ADD COLUMN classificacao TEXT;
ALTER TABLE pipeline ADD COLUMN canal_origem TEXT;
ALTER TABLE pipeline ADD COLUMN perfil TEXT;
ALTER TABLE pipeline ADD COLUMN decisor TEXT;
ALTER TABLE pipeline ADD COLUMN orcamento_declarado TEXT;
ALTER TABLE pipeline ADD COLUMN ocasiao TEXT;
ALTER TABLE pipeline ADD COLUMN prazo TEXT;

-- Campos de opt-out e reabordagem
ALTER TABLE pipeline ADD COLUMN opt_out INTEGER DEFAULT 0;
ALTER TABLE pipeline ADD COLUMN opt_out_data TEXT;
ALTER TABLE pipeline ADD COLUMN tentativas_reabordagem INTEGER DEFAULT 0;

-- Campos de logistica detalhada
ALTER TABLE pipeline ADD COLUMN forma_envio TEXT;
ALTER TABLE pipeline ADD COLUMN codigo_rastreio TEXT;
ALTER TABLE pipeline ADD COLUMN data_entrega TEXT;
ALTER TABLE pipeline ADD COLUMN entrega_confirmada INTEGER DEFAULT 0;

-- Campos de pos-venda
ALTER TABLE pipeline ADD COLUMN motivo_pos_venda TEXT;
ALTER TABLE pipeline ADD COLUMN data_entrada_pos_venda TEXT;

-- Tabela de logistica detalhada
CREATE TABLE IF NOT EXISTS logistica (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT NOT NULL,
  forma_envio TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  codigo_rastreio TEXT,
  data_estimada_entrega TEXT,
  data_entrega TEXT,
  entrega_confirmada INTEGER DEFAULT 0,
  perguntou_cliente INTEGER DEFAULT 0,
  data_pergunta TEXT,
  endereco_entrega TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logistica_pipeline ON logistica(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_logistica_status ON logistica(status);

-- Tabela de follow-ups automaticos (coleta de envio)
CREATE TABLE IF NOT EXISTS followups_auto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  agendar_para TEXT NOT NULL,
  enviado INTEGER DEFAULT 0,
  enviado_em TEXT,
  cancelado INTEGER DEFAULT 0,
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_followups_auto_pendentes ON followups_auto(enviado, agendar_para);

-- Tabela de tickets de pos-venda
CREATE TABLE IF NOT EXISTS tickets_pos_venda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT NOT NULL,
  cliente_id TEXT,
  cliente_nome TEXT,
  problema_reportado TEXT NOT NULL,
  palavra_chave TEXT,
  status TEXT DEFAULT 'aberto',
  resolucao TEXT,
  resolvido_em TEXT,
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_pv_pipeline ON tickets_pos_venda(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_tickets_pv_status ON tickets_pos_venda(status);

-- Indices para campos novos na pipeline
CREATE INDEX IF NOT EXISTS idx_pipeline_classificacao ON pipeline(classificacao);
CREATE INDEX IF NOT EXISTS idx_pipeline_canal ON pipeline(canal_origem);
CREATE INDEX IF NOT EXISTS idx_pipeline_opt_out ON pipeline(opt_out);
CREATE INDEX IF NOT EXISTS idx_pipeline_score ON pipeline(score_bant);
