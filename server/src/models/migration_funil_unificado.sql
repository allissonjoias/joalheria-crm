-- Migration: Funil Unificado - 17 etapas, 1 pipeline unico
-- Ciclo completo: Lead -> Venda -> Coleta -> Logistica -> Sucesso -> Nutricao -> Perdidos

-- Criar funil unificado
INSERT OR IGNORE INTO funis (id, nome, cor, ordem, ativo) VALUES (10, 'Funil Principal', '#1e1b4b', 0, 1);

-- Desativar funis antigos (manter dados)
UPDATE funis SET ativo = 0 WHERE id IN (1, 2, 3, 4);

-- Desativar estagios antigos
UPDATE funil_estagios SET ativo = 0 WHERE funil_id IN (1, 2, 3, 4);

-- ═══ 17 ETAPAS DO FUNIL UNIFICADO ═══

-- FASE: Qualificacao (1-3)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (1001, 'Primeiro Contato',       '#6b7280', 10,  'aberto', 10, 'qualificacao', 1),
  (1002, 'BANT',                   '#3b82f6', 20,  'aberto', 10, 'qualificacao', 1),
  (1003, 'Qualificado',            '#22c55e', 30,  'aberto', 10, 'qualificacao', 1);

-- FASE: Fechamento (4-7)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (1004, 'Orcamento',              '#f59e0b', 40,  'aberto', 10, 'fechamento', 1),
  (1005, 'Negociacao',             '#f97316', 50,  'aberto', 10, 'fechamento', 1),
  (1006, 'Aguardando Pagamento',   '#a855f7', 60,  'aberto', 10, 'fechamento', 1),
  (1007, 'Pagamento Confirmado',   '#16a34a', 70,  'ganho',  10, 'ganho', 1);

-- FASE: Coleta (8)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (1008, 'Coleta de Envio',        '#0ea5e9', 80,  'aberto', 10, 'coleta', 1);

-- FASE: Logistica (9-13)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (1009, 'Logistica Pendente',     '#6366f1', 90,  'aberto', 10, 'logistica', 1),
  (1010, 'Preparando Pedido',      '#8b5cf6', 100, 'aberto', 10, 'logistica', 1),
  (1011, 'Aguardando Envio',       '#a78bfa', 110, 'aberto', 10, 'logistica', 1),
  (1012, 'Enviado',                '#c084fc', 120, 'aberto', 10, 'logistica', 1),
  (1013, 'Entregue',               '#10b981', 130, 'ganho',  10, 'logistica', 1);

-- FASE: Sucesso do Cliente (14-15)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (1014, 'Sucesso do Cliente',     '#14b8a6', 140, 'aberto', 10, 'sucesso', 1),
  (1015, 'Pos-Venda',              '#f43f5e', 150, 'aberto', 10, 'sucesso', 1);

-- FASE: Nutricao (16)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (1016, 'Nutricao Clientes',      '#d946ef', 160, 'aberto', 10, 'nutricao', 1);

-- FASE: Perdidos (17)
INSERT OR REPLACE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id, fase, ativo) VALUES
  (1017, 'Perdido',                '#ef4444', 170, 'perdido', 10, 'perdido', 1);

-- ═══ MIGRAR ODVs DOS FUNIS ANTIGOS ═══

-- Pipeline 1 (Leads) -> Funil 10
UPDATE pipeline SET funil_id = 10, estagio = 'Primeiro Contato' WHERE funil_id = 1 AND estagio = 'Primeiro Contato';
UPDATE pipeline SET funil_id = 10, estagio = 'BANT' WHERE funil_id = 1 AND estagio = 'BANT';
UPDATE pipeline SET funil_id = 10, estagio = 'Qualificado' WHERE funil_id = 1 AND estagio = 'Qualificado';
UPDATE pipeline SET funil_id = 10, estagio = 'Orcamento' WHERE funil_id = 1 AND estagio = 'Orcamento';
UPDATE pipeline SET funil_id = 10, estagio = 'Negociacao' WHERE funil_id = 1 AND estagio = 'Negociacao';
UPDATE pipeline SET funil_id = 10, estagio = 'Aguardando Pagamento' WHERE funil_id = 1 AND estagio = 'Aguardando Pagamento';
UPDATE pipeline SET funil_id = 10, estagio = 'Pagamento Confirmado' WHERE funil_id = 1 AND estagio = 'Pagamento Confirmado';
UPDATE pipeline SET funil_id = 10, estagio = 'Coleta de Envio' WHERE funil_id = 1 AND estagio = 'Coleta de Envio';
UPDATE pipeline SET funil_id = 10, estagio = 'Perdido' WHERE funil_id = 1 AND estagio = 'Perdido';

-- Pipeline 2 (Logistica) -> Funil 10
UPDATE pipeline SET funil_id = 10, estagio = 'Logistica Pendente' WHERE funil_id = 2 AND estagio = 'Producao';
UPDATE pipeline SET funil_id = 10, estagio = 'Preparando Pedido' WHERE funil_id = 2 AND estagio = 'Preparacao';
UPDATE pipeline SET funil_id = 10, estagio = 'Aguardando Envio' WHERE funil_id = 2 AND estagio = 'Envio';
UPDATE pipeline SET funil_id = 10, estagio = 'Enviado' WHERE funil_id = 2 AND estagio = 'Em Transito';
UPDATE pipeline SET funil_id = 10, estagio = 'Entregue' WHERE funil_id = 2 AND estagio = 'Entregue';

-- Pipeline 3 (Clientes) -> Funil 10
UPDATE pipeline SET funil_id = 10, estagio = 'Sucesso do Cliente' WHERE funil_id = 3 AND estagio = 'Satisfacao';
UPDATE pipeline SET funil_id = 10, estagio = 'Pos-Venda' WHERE funil_id = 3 AND estagio = 'Pos-venda';

-- Pipeline 4 (Nutricao) -> Funil 10
UPDATE pipeline SET funil_id = 10, estagio = 'Nutricao Clientes' WHERE funil_id = 4 AND estagio = 'Nutricao Clientes';
UPDATE pipeline SET funil_id = 10, estagio = 'Perdido' WHERE funil_id = 4 AND estagio = 'Nutricao Perdidos Qualificados';
UPDATE pipeline SET funil_id = 10, estagio = 'Perdido' WHERE funil_id = 4 AND estagio = 'Nutricao Perdidos';

-- Qualquer ODV sobrando nos funis antigos -> mover para Primeiro Contato no funil 10
UPDATE pipeline SET funil_id = 10, estagio = 'Primeiro Contato' WHERE funil_id IN (1, 2, 3, 4);

-- Indice para o funil unificado
CREATE INDEX IF NOT EXISTS idx_pipeline_funil10 ON pipeline(funil_id, estagio) WHERE funil_id = 10;
