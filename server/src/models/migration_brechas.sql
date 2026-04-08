-- Migration: Brechas Engine
-- Detecta e trata gaps no funil de vendas automaticamente

-- Tabela de log de brechas detectadas
CREATE TABLE IF NOT EXISTS brechas_log (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT,
  cliente_id TEXT,
  tipo TEXT NOT NULL CHECK(tipo IN ('opt_out', 'problema', 'reengajamento', 'inatividade', 'sem_followup', 'pagamento_pendente')),
  descricao TEXT,
  acao_tomada TEXT,
  resolvido INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  resolvido_em TEXT
);

-- Config do Mercado Pago
CREATE TABLE IF NOT EXISTS mercadopago_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  access_token TEXT DEFAULT '',
  webhook_secret TEXT DEFAULT '',
  ativo INTEGER DEFAULT 0,
  auto_ganho INTEGER DEFAULT 1,
  estagio_pos_pagamento TEXT DEFAULT 'Preparando Pedido',
  criado_em TEXT DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO mercadopago_config (id) VALUES (1);

-- Pagamentos recebidos
CREATE TABLE IF NOT EXISTS mercadopago_pagamentos (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT,
  cliente_id TEXT,
  payment_id TEXT,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'refunded', 'cancelled')),
  valor REAL,
  metodo TEXT,
  parcelas INTEGER DEFAULT 1,
  external_reference TEXT,
  raw_data TEXT,
  criado_em TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Adicionar colunas de pagamento no pipeline
ALTER TABLE pipeline ADD COLUMN pagamento_status TEXT DEFAULT NULL;
ALTER TABLE pipeline ADD COLUMN pagamento_id TEXT DEFAULT NULL;
ALTER TABLE pipeline ADD COLUMN pagamento_valor REAL DEFAULT NULL;

-- Palavras-chave para detecção de brechas
CREATE TABLE IF NOT EXISTS brechas_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK(tipo IN ('opt_out', 'problema', 'interesse_retorno')),
  keyword TEXT NOT NULL,
  ativo INTEGER DEFAULT 1
);

-- Keywords padrão de opt-out
INSERT OR IGNORE INTO brechas_keywords (tipo, keyword) VALUES
  ('opt_out', 'nao quero mais'),
  ('opt_out', 'pare de mandar'),
  ('opt_out', 'nao me mande'),
  ('opt_out', 'cancele'),
  ('opt_out', 'parar de receber'),
  ('opt_out', 'nao tenho interesse'),
  ('opt_out', 'remover meu numero'),
  ('opt_out', 'sair da lista'),
  ('opt_out', 'desinscrever');

-- Keywords de problema/reclamação
INSERT OR IGNORE INTO brechas_keywords (tipo, keyword) VALUES
  ('problema', 'reclamacao'),
  ('problema', 'problema com'),
  ('problema', 'defeito'),
  ('problema', 'quebrou'),
  ('problema', 'errado'),
  ('problema', 'insatisfeito'),
  ('problema', 'insatisfeita'),
  ('problema', 'devolver'),
  ('problema', 'devolucao'),
  ('problema', 'troca'),
  ('problema', 'estragou'),
  ('problema', 'decepcionado'),
  ('problema', 'decepcionada'),
  ('problema', 'pessimo'),
  ('problema', 'horrivel');

-- Keywords de interesse de retorno (lead perdido voltando)
INSERT OR IGNORE INTO brechas_keywords (tipo, keyword) VALUES
  ('interesse_retorno', 'ainda tem'),
  ('interesse_retorno', 'mudei de ideia'),
  ('interesse_retorno', 'quero comprar'),
  ('interesse_retorno', 'vou levar'),
  ('interesse_retorno', 'me interessei'),
  ('interesse_retorno', 'quanto custa'),
  ('interesse_retorno', 'qual o preco'),
  ('interesse_retorno', 'tem disponivel'),
  ('interesse_retorno', 'posso ver'),
  ('interesse_retorno', 'gostaria de ver');

-- Índices
CREATE INDEX IF NOT EXISTS idx_brechas_log_pipeline ON brechas_log(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_brechas_log_tipo ON brechas_log(tipo, resolvido);
CREATE INDEX IF NOT EXISTS idx_mp_pagamentos_pipeline ON mercadopago_pagamentos(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_brechas_keywords_tipo ON brechas_keywords(tipo, ativo);
