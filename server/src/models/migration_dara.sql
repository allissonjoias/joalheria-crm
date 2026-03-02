-- Configuracao da Dara IA (prompt personalizado)
CREATE TABLE IF NOT EXISTS dara_config (
  id TEXT PRIMARY KEY,
  prompt_personalizado TEXT DEFAULT '',
  atualizado_em TEXT DEFAULT (datetime('now'))
);
