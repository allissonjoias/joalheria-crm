-- Migration: Funil V2 - 18 etapas, 4 pipelines
-- Leads (1-8), Logistica (9-13), Clientes (14-15), Nutricao (16-18)

-- Atualizar pipelines existentes
UPDATE funis SET nome = 'Leads', cor = '#1e1b4b', ordem = 0 WHERE id = 1;
UPDATE funis SET nome = 'Logistica', cor = '#0c4a6e', ordem = 10 WHERE id = 2;
UPDATE funis SET nome = 'Clientes', cor = '#115e59', ordem = 20 WHERE id = 3;

-- Criar pipeline Nutricao se nao existir
INSERT OR IGNORE INTO funis (id, nome, cor, ordem, ativo) VALUES (4, 'Nutricao', '#4a044e', 30, 1);

-- Desativar todos os estagios antigos
UPDATE funil_estagios SET ativo = 0;

-- ═══ PIPELINE 1: LEADS (Etapas 1-8) ═══

-- Fase: Qualificacao (etapas 1-3)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (101, 'Primeiro Contato', '#6b7280', 10, 'aberto', 1, 'qualificacao', 1),
  (102, 'BANT', '#3b82f6', 20, 'aberto', 1, 'qualificacao', 1),
  (103, 'Qualificado', '#22c55e', 30, 'aberto', 1, 'qualificacao', 1);

-- Fase: Fechamento (etapas 4-6)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (104, 'Orcamento', '#f59e0b', 40, 'aberto', 1, 'fechamento', 1),
  (105, 'Negociacao', '#f97316', 50, 'aberto', 1, 'fechamento', 1),
  (106, 'Aguardando Pagamento', '#a855f7', 60, 'aberto', 1, 'fechamento', 1);

-- Fase: Ganho (etapas 7-8)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (107, 'Pagamento Confirmado', '#16a34a', 70, 'ganho', 1, 'ganho', 1),
  (108, 'Coleta de Envio', '#059669', 80, 'aberto', 1, 'ganho', 1);

-- Perdido (leads)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (109, 'Perdido', '#ef4444', 90, 'perdido', 1, 'qualificacao', 1);

-- ═══ PIPELINE 2: LOGISTICA (Etapas 9-13) ═══
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (201, 'Producao', '#0ea5e9', 10, 'aberto', 2, 'logistica', 1),
  (202, 'Preparacao', '#6366f1', 20, 'aberto', 2, 'logistica', 1),
  (203, 'Envio', '#8b5cf6', 30, 'aberto', 2, 'logistica', 1),
  (204, 'Em Transito', '#a78bfa', 40, 'aberto', 2, 'logistica', 1),
  (205, 'Entregue', '#22c55e', 50, 'ganho', 2, 'logistica', 1);

-- ═══ PIPELINE 3: CLIENTES (Etapas 14-15) ═══
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (301, 'Satisfacao', '#14b8a6', 10, 'aberto', 3, 'sucesso', 1),
  (302, 'Pos-venda', '#f43f5e', 20, 'aberto', 3, 'sucesso', 1);

-- ═══ PIPELINE 4: NUTRICAO (Etapas 16-18) ═══
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (401, 'Nutricao Clientes', '#d946ef', 10, 'aberto', 4, 'nutricao', 1),
  (402, 'Nutricao Perdidos Qualificados', '#c026d3', 20, 'aberto', 4, 'nutricao', 1),
  (403, 'Nutricao Perdidos', '#a21caf', 30, 'aberto', 4, 'nutricao', 1);

-- ═══ MIGRAR ODVs EXISTENTES para novos estagios ═══
-- Mapear estagios antigos para novos
UPDATE pipeline SET estagio = 'Primeiro Contato' WHERE estagio = 'Lead' AND funil_id = 1;
UPDATE pipeline SET estagio = 'BANT' WHERE estagio = 'Contatado' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Qualificado' WHERE estagio = 'Interessado' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Negociacao' WHERE estagio = 'Negociacao' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Pagamento Confirmado' WHERE estagio = 'Vendido' AND funil_id = 1;

-- Pos-venda -> Logistica (pipeline 2)
UPDATE pipeline SET estagio = 'Preparacao', funil_id = 2 WHERE estagio = 'Preparando Pedido' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Envio', funil_id = 2 WHERE estagio = 'Enviado' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Entregue', funil_id = 2 WHERE estagio = 'Entregue' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Perdido', funil_id = 1 WHERE estagio = 'Cancelado/Devolvido' AND funil_id = 1;

-- Nutricao -> Pipeline 4
UPDATE pipeline SET estagio = 'Nutricao Clientes', funil_id = 4 WHERE estagio = 'Nutricao 30d' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Nutricao Clientes', funil_id = 4 WHERE estagio = 'Nutricao 60d' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Nutricao Clientes', funil_id = 4 WHERE estagio = 'Nutricao 90d' AND funil_id = 1;

-- Recompra -> volta para Leads como Negociacao
UPDATE pipeline SET estagio = 'Negociacao', funil_id = 1 WHERE estagio = 'Oportunidade Recompra' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Negociacao', funil_id = 1 WHERE estagio = 'Negociacao Recompra' AND funil_id = 1;
UPDATE pipeline SET estagio = 'Pagamento Confirmado', funil_id = 1 WHERE estagio = 'Recompra Fechada' AND funil_id = 1;

-- Indices
CREATE INDEX IF NOT EXISTS idx_pipeline_funil_estagio ON pipeline(funil_id, estagio);
