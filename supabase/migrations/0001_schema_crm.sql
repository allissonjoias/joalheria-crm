-- =====================================================================
-- 0001 — Cria schema `crm` e configura permissões/extensões
-- =====================================================================
-- Idempotente: roda múltiplas vezes sem erro.
-- =====================================================================

BEGIN;

-- Extensões (já devem existir no Supabase, mas garante)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Schema isolado pro CRM
CREATE SCHEMA IF NOT EXISTS crm;

COMMENT ON SCHEMA crm IS
  'Schema isolado para o CRM (mensageria Instagram/WhatsApp, IA, automações). '
  'Compartilha dados-mestres via FK em public.contatos / public.vendedores / public.leads / auth.users / alissonerp.usuarios.';

-- Permissões: PostgREST expõe via roles do Supabase
GRANT USAGE ON SCHEMA crm TO postgres, anon, authenticated, service_role;

-- Defaults: novas tabelas/sequencias/funções já nascem com permissão correta
ALTER DEFAULT PRIVILEGES IN SCHEMA crm
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA crm
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA crm
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- ======== Função utilitária: updated_at automático ========
CREATE OR REPLACE FUNCTION crm.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION crm.set_updated_at() IS
  'Trigger BEFORE UPDATE para atualizar updated_at automaticamente.';

-- ======== Função utilitária: normalizar nome (NFD + lower + alphanumeric) ========
CREATE OR REPLACE FUNCTION crm.normalizar_nome(p_nome text)
RETURNS text AS $$
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN RETURN ''; END IF;
  RETURN regexp_replace(lower(unaccent(p_nome)), '[^a-z0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION crm.normalizar_nome(text) IS
  'Normaliza nome (sem acento, lowercase, só alfanumérico) para deduplicação de clientes.';

COMMIT;
