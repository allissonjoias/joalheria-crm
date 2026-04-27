-- =====================================================================
-- 0008 — Views em public expondo crm.* (workaround pra não restartar PostgREST)
-- =====================================================================
-- PostgREST self-hosted só expõe schemas em PGRST_DB_SCHEMAS.
-- Em vez de mexer no EasyPanel, criamos views em public com prefixo crm_.
-- Real-time via ALTER PUBLICATION (não precisa restart).
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. Garantir permissões nas tabelas existentes (DEFAULT só pega novas)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA crm TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA crm TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA crm TO authenticated, service_role;

-- ============================================================
-- 2. Criar view public.crm_<tabela> pra cada tabela crm.*
--    security_invoker=true → RLS aplica baseado no auth.uid() do caller
-- ============================================================
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='crm' AND table_type='BASE TABLE'
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'DROP VIEW IF EXISTS public.crm_%I CASCADE;',
      t.table_name
    );
    EXECUTE format(
      'CREATE VIEW public.crm_%I WITH (security_invoker = true) AS SELECT * FROM crm.%I;',
      t.table_name, t.table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_%I TO authenticated, service_role;',
      t.table_name
    );
  END LOOP;
END $$;

-- ============================================================
-- 3. Wrappers RPC em public chamando funções de crm
--    Permite supabase.rpc('crm_adicionar_mensagem', { ... })
-- ============================================================

CREATE OR REPLACE FUNCTION public.crm_buscar_ou_criar_contato_dm(
  p_canal     text,
  p_canal_id  text,
  p_nome      text,
  p_username  text DEFAULT NULL,
  p_foto_url  text DEFAULT NULL,
  p_telefone  text DEFAULT NULL
) RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT crm.buscar_ou_criar_contato_dm(p_canal, p_canal_id, p_nome, p_username, p_foto_url, p_telefone);
$$;

CREATE OR REPLACE FUNCTION public.crm_criar_conversa_se_necessario(
  p_canal             text,
  p_canal_thread_id   text,
  p_canal_contato_id  text,
  p_contato_id        bigint
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT crm.criar_conversa_se_necessario(p_canal, p_canal_thread_id, p_canal_contato_id, p_contato_id);
$$;

CREATE OR REPLACE FUNCTION public.crm_adicionar_mensagem(
  p_conversa_id           uuid,
  p_papel                 text,
  p_conteudo              text,
  p_canal_message_id      text  DEFAULT NULL,
  p_tipo_midia            text  DEFAULT NULL,
  p_midia_url             text  DEFAULT NULL,
  p_midia_storage_path    text  DEFAULT NULL,
  p_instagram_media_id    text  DEFAULT NULL,
  p_metadata              jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT crm.adicionar_mensagem(
    p_conversa_id, p_papel, p_conteudo, p_canal_message_id,
    p_tipo_midia, p_midia_url, p_midia_storage_path,
    p_instagram_media_id, p_metadata
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_marcar_conversa_lida(p_conversa_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT crm.marcar_conversa_lida(p_conversa_id);
$$;

CREATE OR REPLACE FUNCTION public.crm_atribuir_vendedor(
  p_conversa_id uuid,
  p_vendedor_id bigint
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT crm.atribuir_vendedor(p_conversa_id, p_vendedor_id);
$$;

CREATE OR REPLACE FUNCTION public.crm_mover_etapa_funil(
  p_conversa_id   uuid,
  p_etapa_para_id uuid,
  p_motivo        text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT crm.mover_etapa_funil(p_conversa_id, p_etapa_para_id, p_motivo);
$$;

CREATE OR REPLACE FUNCTION public.crm_user_eh_admin()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT crm.user_eh_admin();
$$;

CREATE OR REPLACE FUNCTION public.crm_user_vendedor_id()
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT crm.user_vendedor_id();
$$;

GRANT EXECUTE ON FUNCTION public.crm_buscar_ou_criar_contato_dm     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_criar_conversa_se_necessario   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_adicionar_mensagem             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_marcar_conversa_lida           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_atribuir_vendedor              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_mover_etapa_funil              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_user_eh_admin                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_user_vendedor_id               TO authenticated, service_role;

-- ============================================================
-- 4. Real-time: adicionar tabelas crm.* na publicação supabase_realtime
--    Permite supabase.channel().on('postgres_changes', { schema: 'crm', table: '...' }, ...)
-- ============================================================
DO $$
DECLARE
  t record;
  v_already boolean;
BEGIN
  -- Garante que a publicação existe (Supabase cria por default)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime;';
  END IF;

  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='crm' AND table_type='BASE TABLE'
      AND table_name IN ('conversas','mensagens','notificacoes','tarefas','brechas','funil_movimentos','ciclo_vida_eventos')
  LOOP
    -- Confere se já está adicionada
    SELECT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='crm' AND tablename=t.table_name
    ) INTO v_already;

    IF NOT v_already THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE crm.%I;', t.table_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
