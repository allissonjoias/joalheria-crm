-- Registro de ponto dos funcionarios
CREATE TABLE IF NOT EXISTS ponto (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  observacao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_ponto_usuario ON ponto(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ponto_criado ON ponto(criado_em);
