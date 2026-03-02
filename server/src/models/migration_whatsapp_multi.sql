-- Instancias WhatsApp (multiplas conexoes)
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'desconectado',
  criado_em TEXT DEFAULT (datetime('now')),
  atualizado_em TEXT DEFAULT (datetime('now'))
);
