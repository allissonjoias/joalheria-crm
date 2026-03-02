-- Migration: Adicionar coluna transcricao na tabela mensagens
ALTER TABLE mensagens ADD COLUMN transcricao TEXT;
