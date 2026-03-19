-- Migration: Estorno e Cancelamento pos-venda
-- Permite reverter vendas em qualquer ponto do ciclo de vida

-- Colunas de estorno na tabela vendas
ALTER TABLE vendas ADD COLUMN estornada INTEGER DEFAULT 0;
ALTER TABLE vendas ADD COLUMN motivo_estorno TEXT;
ALTER TABLE vendas ADD COLUMN data_estorno TEXT;

-- Estagio "Cancelado/Devolvido" no pos-venda (funil 1)
INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES ('Cancelado/Devolvido', '#dc2626', 130, 'perdido', 1, 'pos_venda');
