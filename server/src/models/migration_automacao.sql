-- Migration: Motor de Automacao Visual (tipo ManyChat)
-- Fluxos visuais, campanhas com segmentacao, templates multi-canal

-- Fluxos de automacao (o JSON do editor visual)
CREATE TABLE IF NOT EXISTS automacao_fluxos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo INTEGER DEFAULT 0,
  canal TEXT DEFAULT 'todos',
  fluxo_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  criado_em TEXT DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT DEFAULT (datetime('now','localtime')),
  criado_por TEXT,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- Execucoes: cada contato dentro de um fluxo
CREATE TABLE IF NOT EXISTS automacao_execucoes (
  id TEXT PRIMARY KEY,
  fluxo_id TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  conversa_id TEXT,
  status TEXT DEFAULT 'ativo',
  node_atual TEXT,
  dados_contexto TEXT DEFAULT '{}',
  proximo_passo_em TEXT,
  criado_em TEXT DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (fluxo_id) REFERENCES automacao_fluxos(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE INDEX IF NOT EXISTS idx_exec_status ON automacao_execucoes(status);
CREATE INDEX IF NOT EXISTS idx_exec_proximo ON automacao_execucoes(proximo_passo_em);
CREATE INDEX IF NOT EXISTS idx_exec_fluxo ON automacao_execucoes(fluxo_id);

-- Log de cada passo executado
CREATE TABLE IF NOT EXISTS automacao_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execucao_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_tipo TEXT NOT NULL,
  resultado TEXT DEFAULT 'ok',
  detalhes TEXT,
  criado_em TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (execucao_id) REFERENCES automacao_execucoes(id)
);

-- Templates de mensagem reutilizaveis
CREATE TABLE IF NOT EXISTS automacao_templates (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  canal TEXT DEFAULT 'whatsapp',
  tipo TEXT DEFAULT 'texto',
  conteudo TEXT NOT NULL,
  midia_url TEXT,
  whatsapp_template_name TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT DEFAULT (datetime('now','localtime'))
);

-- Campanhas com segmentacao
CREATE TABLE IF NOT EXISTS automacao_campanhas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  fluxo_id TEXT,
  template_id TEXT,
  canal TEXT DEFAULT 'whatsapp',
  segmento_json TEXT DEFAULT '{}',
  agendado_para TEXT,
  status TEXT DEFAULT 'rascunho',
  total_contatos INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_entregues INTEGER DEFAULT 0,
  total_lidos INTEGER DEFAULT 0,
  total_respondidos INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (fluxo_id) REFERENCES automacao_fluxos(id),
  FOREIGN KEY (template_id) REFERENCES automacao_templates(id)
);

-- Fila de envio da campanha
CREATE TABLE IF NOT EXISTS automacao_fila (
  id TEXT PRIMARY KEY,
  campanha_id TEXT NOT NULL,
  cliente_id TEXT,
  telefone TEXT,
  instagram_id TEXT,
  mensagem TEXT,
  canal TEXT DEFAULT 'whatsapp',
  status TEXT DEFAULT 'pendente',
  erro_detalhe TEXT,
  criado_em TEXT DEFAULT (datetime('now','localtime')),
  enviado_em TEXT,
  FOREIGN KEY (campanha_id) REFERENCES automacao_campanhas(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE INDEX IF NOT EXISTS idx_auto_fila_status ON automacao_fila(status);
CREATE INDEX IF NOT EXISTS idx_auto_fila_campanha ON automacao_fila(campanha_id);
