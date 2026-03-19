-- Migration: CRM Avancado (campos cliente, multiplos funis, motivo perda, origem lead, distribuicao)

-- 1. Campos avancados de cliente
ALTER TABLE clientes ADD COLUMN cpf TEXT;
ALTER TABLE clientes ADD COLUMN data_nascimento TEXT;
ALTER TABLE clientes ADD COLUMN cep TEXT;
ALTER TABLE clientes ADD COLUMN endereco TEXT;
ALTER TABLE clientes ADD COLUMN numero_endereco TEXT;
ALTER TABLE clientes ADD COLUMN complemento TEXT;
ALTER TABLE clientes ADD COLUMN bairro TEXT;
ALTER TABLE clientes ADD COLUMN cidade TEXT;
ALTER TABLE clientes ADD COLUMN estado TEXT;
ALTER TABLE clientes ADD COLUMN origem TEXT;
ALTER TABLE clientes ADD COLUMN forma_atendimento TEXT;

CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
CREATE INDEX IF NOT EXISTS idx_clientes_nascimento ON clientes(data_nascimento);
CREATE INDEX IF NOT EXISTS idx_clientes_origem ON clientes(origem);

-- 2. Multiplos funis - adicionar funil_id nos estagios e deals
ALTER TABLE funil_estagios ADD COLUMN funil_id INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS funis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT '#184036',
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Funis padrao baseados no Kommo
INSERT OR IGNORE INTO funis (id, nome, descricao, cor, ordem) VALUES
  (1, 'Vendas', 'Funil principal de vendas', '#184036', 0),
  (2, 'Qualificacao', 'Qualificacao de leads novos', '#2563eb', 10),
  (3, 'Pos-venda', 'Acompanhamento pos-venda', '#7c3aed', 20);

-- Adicionar funil_id no pipeline (deals)
ALTER TABLE pipeline ADD COLUMN funil_id INTEGER DEFAULT 1;

-- 3. Motivo de perda e origem do lead no deal
ALTER TABLE pipeline ADD COLUMN motivo_perda TEXT;
ALTER TABLE pipeline ADD COLUMN origem_lead TEXT;
ALTER TABLE pipeline ADD COLUMN tipo_pedido TEXT;
ALTER TABLE pipeline ADD COLUMN forma_atendimento TEXT;
ALTER TABLE pipeline ADD COLUMN tags TEXT DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_pipeline_funil ON pipeline(funil_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_origem ON pipeline(origem_lead);
CREATE INDEX IF NOT EXISTS idx_pipeline_motivo ON pipeline(motivo_perda);

-- Tabela de motivos de perda configuráveis
CREATE TABLE IF NOT EXISTS motivos_perda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

-- Motivos padrao (baseados nos 28 do Kommo)
INSERT OR IGNORE INTO motivos_perda (nome, ordem) VALUES
  ('Achou caro', 10),
  ('Parou de responder', 20),
  ('Comprou no concorrente', 30),
  ('Sem dinheiro', 40),
  ('Forma de pagamento nao atende', 50),
  ('Prazo de entrega nao atende', 60),
  ('Nao tinha produto a pronta entrega', 70),
  ('Desistiu da compra', 80),
  ('Nao retornou primeiro contato', 90),
  ('Nao entendeu a negociacao', 100),
  ('Cartao nao autorizado', 110),
  ('Pagamento nao realizado', 120),
  ('Compra de metal', 130),
  ('Estava somente pesquisando', 140),
  ('Sem dados de contato', 150),
  ('Cancelado com estorno', 160),
  ('Outro', 999);

-- Tabela de origens de lead configuráveis
CREATE TABLE IF NOT EXISTS origens_lead (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

-- Origens padrao (baseadas no Kommo)
INSERT OR IGNORE INTO origens_lead (nome, ordem) VALUES
  ('Instagram Feed', 10),
  ('Instagram Stories', 20),
  ('Instagram DM', 30),
  ('Instagram Reels', 35),
  ('Facebook', 40),
  ('WhatsApp Organico', 50),
  ('WhatsApp API', 55),
  ('Google', 60),
  ('Indicacao de Cliente', 70),
  ('Indicacao Networking', 75),
  ('Passante Shopping', 80),
  ('Loja Virtual', 90),
  ('Midia Paga', 100),
  ('Prospeccao Ativa', 110),
  ('Reativacao de Perdido', 120),
  ('Formulario Site', 130),
  ('Outro', 999);

-- 4. Distribuicao automatica de leads
CREATE TABLE IF NOT EXISTS distribuicao_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ativo INTEGER NOT NULL DEFAULT 0,
  modo TEXT NOT NULL DEFAULT 'round_robin' CHECK (modo IN ('round_robin', 'menos_ocupado', 'manual')),
  funil_destino_id INTEGER DEFAULT 1,
  estagio_destino TEXT DEFAULT 'Lead',
  auto_criar_tarefa INTEGER NOT NULL DEFAULT 1,
  minutos_deadline_tarefa INTEGER NOT NULL DEFAULT 30,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO distribuicao_config (id, ativo, modo) VALUES (1, 0, 'round_robin');

CREATE TABLE IF NOT EXISTS distribuicao_fila (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  ultimo_lead_em TEXT,
  leads_hoje INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS distribuicao_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  modo TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_dist_log_data ON distribuicao_log(criado_em);

-- Estagios para funil Qualificacao
INSERT OR IGNORE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id) VALUES
  (8, 'Incoming', '#94a3b8', 0, 'aberto', 2),
  (9, 'Contato Inicial', '#60a5fa', 10, 'aberto', 2),
  (10, 'Oferta Feita', '#fbbf24', 20, 'aberto', 2),
  (11, 'Em Negociacao', '#f97316', 30, 'aberto', 2),
  (12, 'Qualificado', '#22c55e', 40, 'ganho', 2),
  (13, 'Descartado', '#ef4444', 50, 'perdido', 2);

-- Estagios para funil Pos-venda
INSERT OR IGNORE INTO funil_estagios (id, nome, cor, ordem, tipo, funil_id) VALUES
  (14, 'Aguardando', '#94a3b8', 0, 'aberto', 3),
  (15, 'Em Andamento', '#60a5fa', 10, 'aberto', 3),
  (16, 'Entregue', '#22c55e', 20, 'aberto', 3),
  (17, 'Finalizado', '#10b981', 30, 'ganho', 3),
  (18, 'Cancelado', '#ef4444', 40, 'perdido', 3);

-- Marcar estagios existentes como funil 1
UPDATE funil_estagios SET funil_id = 1 WHERE funil_id IS NULL OR (id <= 7 AND funil_id = 1);
