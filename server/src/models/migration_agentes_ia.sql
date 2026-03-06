-- Tabela de agentes de IA
CREATE TABLE IF NOT EXISTS agentes_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'sdr',
  prompt_sistema TEXT NOT NULL DEFAULT '',
  foto_url TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT '',
  atualizado_em TEXT NOT NULL DEFAULT ''
);
