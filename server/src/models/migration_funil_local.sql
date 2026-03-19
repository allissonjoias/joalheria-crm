-- Migration: Funil Local (estagios configuráveis, tarefas, histórico)

-- Estagios do funil configuráveis
CREATE TABLE IF NOT EXISTS funil_estagios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6b7280',
  ordem INTEGER NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'aberto' CHECK (tipo IN ('aberto', 'ganho', 'perdido')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Estagios padrão
INSERT OR IGNORE INTO funil_estagios (id, nome, cor, ordem, tipo) VALUES
  (1, 'Lead', '#9ca3af', 0, 'aberto'),
  (2, 'Contatado', '#60a5fa', 10, 'aberto'),
  (3, 'Interessado', '#fbbf24', 20, 'aberto'),
  (4, 'Negociacao', '#f97316', 30, 'aberto'),
  (5, 'Vendido', '#22c55e', 40, 'ganho'),
  (6, 'Pos-venda', '#a855f7', 50, 'aberto'),
  (7, 'Perdido', '#ef4444', 60, 'perdido');

-- Tarefas vinculadas a deals/clientes
CREATE TABLE IF NOT EXISTS tarefas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT,
  cliente_id TEXT,
  vendedor_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'geral' CHECK (tipo IN ('geral', 'primeiro_contato', 'followup', 'pos_venda', 'ligacao', 'reuniao')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  data_vencimento TEXT,
  concluida_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (pipeline_id) REFERENCES pipeline(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_tarefas_pipeline ON tarefas(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_vendedor ON tarefas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_vencimento ON tarefas(data_vencimento);

-- Histórico de movimentação do pipeline
CREATE TABLE IF NOT EXISTS pipeline_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT NOT NULL,
  estagio_anterior TEXT,
  estagio_novo TEXT NOT NULL,
  usuario_id TEXT,
  automatico INTEGER NOT NULL DEFAULT 0,
  motivo TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (pipeline_id) REFERENCES pipeline(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_historico_pipeline ON pipeline_historico(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_historico_data ON pipeline_historico(criado_em);

-- Recriar snapshot local (substituir kommo_lead_id por deal_id)
DROP TABLE IF EXISTS sdr_agent_lead_snapshot;
CREATE TABLE IF NOT EXISTS sdr_agent_lead_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  estagio TEXT NOT NULL DEFAULT '',
  valor REAL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_snapshot_deal ON sdr_agent_lead_snapshot(deal_id);
