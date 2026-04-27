-- Migration: Adicionar gatilhos configuráveis nas automações
-- Permite configurar QUANDO a automação dispara (não só ao entrar na etapa)

-- Adicionar coluna gatilho
ALTER TABLE automacao_etapas ADD COLUMN gatilho TEXT NOT NULL DEFAULT 'ao_entrar_etapa';

-- Remover constraint antiga do tipo_acao (SQLite não suporta ALTER CONSTRAINT, mas o CHECK original é flexível)
-- Criar indice para busca por gatilho
CREATE INDEX IF NOT EXISTS idx_automacao_etapas_gatilho ON automacao_etapas(gatilho, estagio_origem, ativo);
