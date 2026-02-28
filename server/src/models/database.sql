CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'vendedor' CHECK (papel IN ('admin', 'vendedor')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  tipo_interesse TEXT,
  material_preferido TEXT,
  pedra_preferida TEXT,
  orcamento_min REAL,
  orcamento_max REAL,
  ocasiao TEXT,
  tags TEXT DEFAULT '[]',
  notas TEXT,
  vendedor_id TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL CHECK (categoria IN ('aliancas', 'aneis', 'colares', 'brincos', 'pulseiras', 'sob_encomenda')),
  material TEXT NOT NULL DEFAULT 'Ouro 18k',
  pedra TEXT,
  preco REAL NOT NULL,
  preco_custo REAL,
  estoque INTEGER NOT NULL DEFAULT 0,
  foto_url TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pipeline (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  vendedor_id TEXT,
  titulo TEXT NOT NULL,
  valor REAL,
  estagio TEXT NOT NULL DEFAULT 'lead' CHECK (estagio IN ('lead', 'contatado', 'interessado', 'negociacao', 'vendido', 'pos_venda')),
  produto_interesse TEXT,
  notas TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  vendedor_id TEXT,
  produto_id TEXT,
  pipeline_id TEXT,
  valor REAL NOT NULL,
  metodo_pagamento TEXT CHECK (metodo_pagamento IN ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'transferencia', 'parcelado')),
  parcelas INTEGER DEFAULT 1,
  notas TEXT,
  data_venda TEXT NOT NULL DEFAULT (datetime('now')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id),
  FOREIGN KEY (pipeline_id) REFERENCES pipeline(id)
);

CREATE TABLE IF NOT EXISTS conversas (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  vendedor_id TEXT,
  ativa INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY,
  conversa_id TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('user', 'assistant')),
  conteudo TEXT NOT NULL,
  dados_extraidos TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversa_id) REFERENCES conversas(id)
);

CREATE TABLE IF NOT EXISTS lembretes (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  vendedor_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_lembrete TEXT NOT NULL,
  concluido INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS interacoes (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  vendedor_id TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('chat', 'ligacao', 'email', 'visita', 'nota', 'whatsapp')),
  descricao TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
);
