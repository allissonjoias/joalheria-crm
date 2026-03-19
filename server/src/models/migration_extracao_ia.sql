-- Migration: Campos de venda auto-preenchidos pela IA a partir da conversa
-- Novos campos no deal (pipeline) para dados extraidos automaticamente

ALTER TABLE pipeline ADD COLUMN itens_pedido TEXT DEFAULT '[]';
ALTER TABLE pipeline ADD COLUMN desconto TEXT;
ALTER TABLE pipeline ADD COLUMN parcelas INTEGER;
ALTER TABLE pipeline ADD COLUMN forma_pagamento TEXT;
ALTER TABLE pipeline ADD COLUMN valor_frete REAL;
ALTER TABLE pipeline ADD COLUMN endereco_entrega TEXT;
ALTER TABLE pipeline ADD COLUMN data_prevista_entrega TEXT;
ALTER TABLE pipeline ADD COLUMN data_envio TEXT;
ALTER TABLE pipeline ADD COLUMN transportador TEXT;
ALTER TABLE pipeline ADD COLUMN observacao_pedido TEXT;
ALTER TABLE pipeline ADD COLUMN tipo_cliente TEXT DEFAULT 'primeiro_contato';
ALTER TABLE pipeline ADD COLUMN campos_ia TEXT DEFAULT '[]';

-- campos_ia guarda quais campos foram preenchidos pela IA (ex: ["valor","itens_pedido","parcelas"])
-- Isso permite mostrar badge "IA" nos campos auto-detectados e a vendedora pode confirmar/editar

-- Vincular conversa ao deal para auto-preencher
ALTER TABLE pipeline ADD COLUMN conversa_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pipeline_conversa ON pipeline(conversa_id);
