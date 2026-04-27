-- Migration: Limpar Funil - Arquivar vendas finalizadas

-- Criar funil de arquivo
INSERT OR IGNORE INTO funis (id, nome, cor, ordem, ativo) VALUES (99, 'Arquivo', '#6b7280', 999, 0);

-- Mover TODAS as ODVs finalizadas para funil arquivo (99)
-- Pagamento Confirmado com venda registrada
UPDATE pipeline SET funil_id = 99, estagio = 'Arquivado'
WHERE funil_id = 10
  AND estagio = 'Pagamento Confirmado'
  AND id IN (SELECT p.id FROM pipeline p INNER JOIN vendas v ON v.pipeline_id = p.id);

-- Pagamento Confirmado sem venda (importadas)
UPDATE pipeline SET funil_id = 99, estagio = 'Arquivado'
WHERE funil_id = 10
  AND estagio = 'Pagamento Confirmado';

-- Sucesso do Cliente (ja finalizadas)
UPDATE pipeline SET funil_id = 99, estagio = 'Arquivado'
WHERE funil_id = 10
  AND estagio = 'Sucesso do Cliente';

-- Nutricao Clientes antigos
UPDATE pipeline SET funil_id = 99, estagio = 'Arquivado'
WHERE funil_id = 10
  AND estagio = 'Nutricao Clientes';

-- Perdidos antigos
UPDATE pipeline SET funil_id = 99, estagio = 'Arquivado'
WHERE funil_id = 10
  AND estagio = 'Perdido';
