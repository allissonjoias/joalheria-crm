-- Migration: Permitir estagio_destino NULL para gatilhos que usam estagio_origem
-- (ao_cliente_responder, por_lead_score nao precisam de estagio_destino)

CREATE TABLE IF NOT EXISTS automacao_etapas_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estagio_origem TEXT,
  estagio_destino TEXT,
  tipo_acao TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  funil_id INTEGER NOT NULL DEFAULT 10,
  descricao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  gatilho TEXT NOT NULL DEFAULT 'ao_entrar_etapa'
);

INSERT INTO automacao_etapas_new SELECT * FROM automacao_etapas;

DROP TABLE automacao_etapas;

ALTER TABLE automacao_etapas_new RENAME TO automacao_etapas;

CREATE INDEX IF NOT EXISTS idx_automacao_etapas_destino ON automacao_etapas(estagio_destino, ativo);
CREATE INDEX IF NOT EXISTS idx_automacao_etapas_gatilho ON automacao_etapas(gatilho, estagio_origem, ativo);
