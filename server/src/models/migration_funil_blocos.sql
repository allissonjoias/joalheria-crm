-- Migration: Funil em Blocos (6 blocos, 19 etapas)
-- Adiciona coluna bloco em funil_estagios
-- Renomeia etapas existentes e cria novas

-- 1. Adicionar coluna bloco
ALTER TABLE funil_estagios ADD COLUMN bloco TEXT DEFAULT NULL;

-- 2. Limpar etapas antigas do funil 10
DELETE FROM funil_estagios WHERE funil_id = 10;

-- 3. Inserir novas etapas com blocos
-- Bloco: Qualificacao (roxo)
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Contato', 1, 'aberto', 'qualificacao', 'Qualificacao', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'BANT', 2, 'aberto', 'qualificacao', 'Qualificacao', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Qualificado', 3, 'aberto', 'qualificacao', 'Qualificacao', 1);

-- Bloco: Fechamento (ambar)
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Orcamento', 4, 'aberto', 'fechamento', 'Fechamento', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Negociacao', 5, 'aberto', 'fechamento', 'Fechamento', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Aguardando Pagamento', 6, 'aberto', 'fechamento', 'Fechamento', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Ganho', 7, 'ganho', 'fechamento', 'Fechamento', 1);

-- Bloco: Logistica (azul)
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Aguardando Envio', 8, 'aberto', 'logistica', 'Logistica', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Enviado', 9, 'aberto', 'logistica', 'Logistica', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Aguardando Retirada', 10, 'aberto', 'logistica', 'Logistica', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Entregue', 11, 'aberto', 'logistica', 'Logistica', 1);

-- Bloco: Sucesso do Cliente (verde)
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Sucesso', 12, 'aberto', 'sucesso', 'Sucesso do Cliente', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Pos-venda', 13, 'aberto', 'sucesso', 'Sucesso do Cliente', 1);

-- Bloco: Nutricao (rosa)
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Recompra', 14, 'aberto', 'nutricao', 'Nutricao', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Reconversao', 15, 'aberto', 'nutricao', 'Nutricao', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Reengajamento', 16, 'aberto', 'nutricao', 'Nutricao', 1);

-- Bloco: Arquivo (cinza)
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Perdido', 17, 'perdido', 'perdido', 'Arquivo', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Opt-out', 18, 'perdido', 'perdido', 'Arquivo', 1);
INSERT INTO funil_estagios (funil_id, nome, ordem, tipo, fase, bloco, ativo) VALUES (10, 'Completo', 19, 'perdido', 'perdido', 'Arquivo', 1);

-- 4. Migrar ODVs existentes para novos nomes de etapa
UPDATE pipeline SET estagio = 'Contato' WHERE estagio = 'Primeiro Contato' AND funil_id = 10;
UPDATE pipeline SET estagio = 'Ganho' WHERE estagio = 'Pagamento Confirmado' AND funil_id = 10;
UPDATE pipeline SET estagio = 'Aguardando Envio' WHERE estagio IN ('Coleta de Envio', 'Producao', 'Preparacao') AND funil_id = 10;
UPDATE pipeline SET estagio = 'Enviado' WHERE estagio IN ('Envio', 'Em Transito') AND funil_id = 10;
UPDATE pipeline SET estagio = 'Sucesso' WHERE estagio IN ('Satisfacao', 'Sucesso do Cliente') AND funil_id = 10;
UPDATE pipeline SET estagio = 'Pos-venda' WHERE estagio = 'Pos-Venda' AND funil_id = 10;
UPDATE pipeline SET estagio = 'Recompra' WHERE estagio = 'Nutricao Clientes' AND funil_id = 10;
UPDATE pipeline SET estagio = 'Reconversao' WHERE estagio = 'Nutricao Perdidos Qualificados' AND funil_id = 10;
UPDATE pipeline SET estagio = 'Reengajamento' WHERE estagio = 'Nutricao Perdidos' AND funil_id = 10;

-- 5. Migrar historico tambem
UPDATE pipeline_historico SET estagio_novo = 'Contato' WHERE estagio_novo = 'Primeiro Contato';
UPDATE pipeline_historico SET estagio_anterior = 'Contato' WHERE estagio_anterior = 'Primeiro Contato';
UPDATE pipeline_historico SET estagio_novo = 'Ganho' WHERE estagio_novo = 'Pagamento Confirmado';
UPDATE pipeline_historico SET estagio_anterior = 'Ganho' WHERE estagio_anterior = 'Pagamento Confirmado';
UPDATE pipeline_historico SET estagio_novo = 'Aguardando Envio' WHERE estagio_novo IN ('Coleta de Envio', 'Producao', 'Preparacao');
UPDATE pipeline_historico SET estagio_anterior = 'Aguardando Envio' WHERE estagio_anterior IN ('Coleta de Envio', 'Producao', 'Preparacao');
UPDATE pipeline_historico SET estagio_novo = 'Enviado' WHERE estagio_novo IN ('Envio', 'Em Transito');
UPDATE pipeline_historico SET estagio_anterior = 'Enviado' WHERE estagio_anterior IN ('Envio', 'Em Transito');
UPDATE pipeline_historico SET estagio_novo = 'Sucesso' WHERE estagio_novo IN ('Satisfacao', 'Sucesso do Cliente');
UPDATE pipeline_historico SET estagio_anterior = 'Sucesso' WHERE estagio_anterior IN ('Satisfacao', 'Sucesso do Cliente');
UPDATE pipeline_historico SET estagio_novo = 'Pos-venda' WHERE estagio_novo = 'Pos-Venda';
UPDATE pipeline_historico SET estagio_anterior = 'Pos-venda' WHERE estagio_anterior = 'Pos-Venda';
UPDATE pipeline_historico SET estagio_novo = 'Recompra' WHERE estagio_novo = 'Nutricao Clientes';
UPDATE pipeline_historico SET estagio_anterior = 'Recompra' WHERE estagio_anterior = 'Nutricao Clientes';
UPDATE pipeline_historico SET estagio_novo = 'Reconversao' WHERE estagio_novo = 'Nutricao Perdidos Qualificados';
UPDATE pipeline_historico SET estagio_anterior = 'Reconversao' WHERE estagio_anterior = 'Nutricao Perdidos Qualificados';
UPDATE pipeline_historico SET estagio_novo = 'Reengajamento' WHERE estagio_novo = 'Nutricao Perdidos';
UPDATE pipeline_historico SET estagio_anterior = 'Reengajamento' WHERE estagio_anterior = 'Nutricao Perdidos';

-- 6. Migrar automacoes
UPDATE automacao_etapas SET estagio_origem = 'Contato' WHERE estagio_origem = 'Primeiro Contato';
UPDATE automacao_etapas SET estagio_destino = 'Contato' WHERE estagio_destino = 'Primeiro Contato';
UPDATE automacao_etapas SET estagio_origem = 'Ganho' WHERE estagio_origem = 'Pagamento Confirmado';
UPDATE automacao_etapas SET estagio_destino = 'Ganho' WHERE estagio_destino = 'Pagamento Confirmado';
UPDATE automacao_etapas SET estagio_origem = 'Aguardando Envio' WHERE estagio_origem IN ('Coleta de Envio', 'Producao', 'Preparacao');
UPDATE automacao_etapas SET estagio_destino = 'Aguardando Envio' WHERE estagio_destino IN ('Coleta de Envio', 'Producao', 'Preparacao');
UPDATE automacao_etapas SET estagio_origem = 'Enviado' WHERE estagio_origem IN ('Envio', 'Em Transito');
UPDATE automacao_etapas SET estagio_destino = 'Enviado' WHERE estagio_destino IN ('Envio', 'Em Transito');
UPDATE automacao_etapas SET estagio_origem = 'Sucesso' WHERE estagio_origem IN ('Satisfacao', 'Sucesso do Cliente');
UPDATE automacao_etapas SET estagio_destino = 'Sucesso' WHERE estagio_destino IN ('Satisfacao', 'Sucesso do Cliente');
UPDATE automacao_etapas SET estagio_origem = 'Recompra' WHERE estagio_origem = 'Nutricao Clientes';
UPDATE automacao_etapas SET estagio_destino = 'Recompra' WHERE estagio_destino = 'Nutricao Clientes';
UPDATE automacao_etapas SET estagio_origem = 'Reconversao' WHERE estagio_origem = 'Nutricao Perdidos Qualificados';
UPDATE automacao_etapas SET estagio_destino = 'Reconversao' WHERE estagio_destino = 'Nutricao Perdidos Qualificados';
UPDATE automacao_etapas SET estagio_origem = 'Reengajamento' WHERE estagio_origem = 'Nutricao Perdidos';
UPDATE automacao_etapas SET estagio_destino = 'Reengajamento' WHERE estagio_destino = 'Nutricao Perdidos';
