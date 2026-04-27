-- Migration: Automacoes entre etapas do funil
-- Permite configurar acoes automaticas quando ODV entra/sai de uma etapa

CREATE TABLE IF NOT EXISTS automacao_etapas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estagio_origem TEXT,
  estagio_destino TEXT NOT NULL,
  tipo_acao TEXT NOT NULL CHECK (tipo_acao IN (
    'enviar_whatsapp',
    'criar_tarefa',
    'mover_estagio',
    'aguardar_tempo',
    'notificar_equipe',
    'atualizar_campo',
    'enviar_template'
  )),
  config TEXT NOT NULL DEFAULT '{}',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  funil_id INTEGER NOT NULL DEFAULT 10,
  descricao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Log de execucao das automacoes
CREATE TABLE IF NOT EXISTS automacao_etapas_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automacao_id INTEGER NOT NULL,
  pipeline_id TEXT NOT NULL,
  cliente_id TEXT,
  status TEXT NOT NULL DEFAULT 'executado' CHECK (status IN ('executado', 'erro', 'agendado', 'cancelado')),
  resultado TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_automacao_etapas_destino ON automacao_etapas(estagio_destino, ativo);
CREATE INDEX IF NOT EXISTS idx_automacao_etapas_log_pipeline ON automacao_etapas_log(pipeline_id);
