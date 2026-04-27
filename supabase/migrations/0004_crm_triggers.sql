-- =====================================================================
-- 0004 — Triggers
-- =====================================================================

BEGIN;

-- ===== updated_at automático em todas as tabelas que tem a coluna =====

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'crm'
      AND c.column_name = 'updated_at'
    GROUP BY c.table_name
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated ON crm.%I;',
      t.table_name, t.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON crm.%I
       FOR EACH ROW EXECUTE FUNCTION crm.set_updated_at();',
      t.table_name, t.table_name
    );
  END LOOP;
END $$;

-- ===== Trigger de auditoria genérico =====

CREATE OR REPLACE FUNCTION crm.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_id := COALESCE(v_old->>'id', v_old->>'chave', v_old->>'codigo');
    INSERT INTO crm.audit_log (schema_name, table_name, operacao, registro_id, user_id, dados_antes)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, 'DELETE', v_id, v_user, v_old);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id := COALESCE(v_new->>'id', v_new->>'chave', v_new->>'codigo');
    INSERT INTO crm.audit_log (schema_name, table_name, operacao, registro_id, user_id, dados_antes, dados_depois)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, 'UPDATE', v_id, v_user, v_old, v_new);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_id := COALESCE(v_new->>'id', v_new->>'chave', v_new->>'codigo');
    INSERT INTO crm.audit_log (schema_name, table_name, operacao, registro_id, user_id, dados_depois)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, 'INSERT', v_id, v_user, v_new);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Aplica auditoria em tabelas-chave (não em log/audit/notificacoes pra não inflar)
DO $$
DECLARE
  t text;
  alvos text[] := ARRAY[
    'unipile_config','meta_config','kommo_config','config_geral',
    'conversas','funil_etapas','funil_blocos',
    'agentes_ia','prompt_templates',
    'automacoes','tarefas','brechas'
  ];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON crm.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%s
         AFTER INSERT OR UPDATE OR DELETE ON crm.%I
         FOR EACH ROW EXECUTE FUNCTION crm.audit_trigger();',
      t, t
    );
  END LOOP;
END $$;

-- ===== Trigger: ao registrar venda em alissonerp.vendas_erp,
--       fechar conversa relacionada e gravar evento ciclo_vida =====
-- (opcional, comentado por padrão — descomente quando vendedor.user_id estiver linkado)

-- CREATE OR REPLACE FUNCTION crm.on_venda_inserida()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- DECLARE
--   v_conv_id uuid;
-- BEGIN
--   SELECT id INTO v_conv_id
--   FROM crm.conversas
--   WHERE contato_id = NEW.cliente_id AND status = 'aberta'
--   ORDER BY ultima_msg_em DESC NULLS LAST LIMIT 1;
--
--   IF v_conv_id IS NOT NULL THEN
--     INSERT INTO crm.ciclo_vida_eventos (conversa_id, contato_id, evento, detalhes)
--     VALUES (v_conv_id, NEW.cliente_id, 'venda_fechada',
--             jsonb_build_object('venda_id', NEW.id, 'total', NEW.total_venda));
--     UPDATE crm.conversas SET status = 'fechada' WHERE id = v_conv_id;
--   END IF;
--   RETURN NEW;
-- END;
-- $$;
-- DROP TRIGGER IF EXISTS trg_venda_inserida_crm ON alissonerp.vendas_erp;
-- CREATE TRIGGER trg_venda_inserida_crm
--   AFTER INSERT ON alissonerp.vendas_erp
--   FOR EACH ROW EXECUTE FUNCTION crm.on_venda_inserida();

COMMIT;
