-- Migration: Ciclo de Vida Unificado
-- Adiciona fases ao funil para agrupar estagios em: venda, pos_venda, nutricao, recompra
-- Adiciona novos estagios pos-venda/nutricao/recompra ao funil principal (id=1)

-- Coluna fase nos estagios
ALTER TABLE funil_estagios ADD COLUMN fase TEXT DEFAULT 'venda';

-- Coluna no pipeline para rastrear data de entrega confirmada e proximo contato nutricao
ALTER TABLE pipeline ADD COLUMN data_entrega_confirmada TEXT;
ALTER TABLE pipeline ADD COLUMN proxima_nutricao TEXT;
ALTER TABLE pipeline ADD COLUMN ciclo_nutricao INTEGER DEFAULT 0;

-- Atualizar fases dos estagios existentes do funil 1 (Vendas)
UPDATE funil_estagios SET fase = 'venda' WHERE funil_id = 1 AND nome IN ('Lead', 'Contatado', 'Interessado', 'Negociacao');
UPDATE funil_estagios SET fase = 'venda' WHERE funil_id = 1 AND nome = 'Vendido';
UPDATE funil_estagios SET fase = 'venda' WHERE funil_id = 1 AND nome = 'Perdido';

-- Remover estagio "Pos-venda" antigo do funil 1 (vai ser substituido pelos novos)
UPDATE funil_estagios SET ativo = 0 WHERE funil_id = 1 AND nome = 'Pos-venda';

-- Novos estagios de Pos-venda (funil 1)
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Preparando Pedido', '#8b5cf6', 100, 'aberto', 1, 'pos_venda');
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Enviado', '#3b82f6', 110, 'aberto', 1, 'pos_venda');
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Entregue', '#10b981', 120, 'aberto', 1, 'pos_venda');

-- Novos estagios de Nutricao (funil 1)
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Nutricao 30d', '#f59e0b', 200, 'aberto', 1, 'nutricao');
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Nutricao 60d', '#f97316', 210, 'aberto', 1, 'nutricao');
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Nutricao 90d', '#ef4444', 220, 'aberto', 1, 'nutricao');

-- Novos estagios de Recompra (funil 1)
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Oportunidade Recompra', '#ec4899', 300, 'aberto', 1, 'recompra');
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Negociacao Recompra', '#f43f5e', 310, 'aberto', 1, 'recompra');
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Recompra Fechada', '#22c55e', 320, 'ganho', 1, 'recompra');

-- Tabela para agendar acoes automaticas do ciclo de vida
CREATE TABLE IF NOT EXISTS ciclo_vida_agendamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nutricao_30d', 'nutricao_60d', 'nutricao_90d', 'recompra', 'feedback', 'aniversario_compra')),
  data_agendada TEXT NOT NULL,
  executado INTEGER DEFAULT 0,
  resultado TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  executado_em TEXT,
  FOREIGN KEY (pipeline_id) REFERENCES pipeline(id)
);
