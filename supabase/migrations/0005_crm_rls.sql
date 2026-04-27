-- =====================================================================
-- 0005 — Row Level Security (RLS) — segurança por linha
-- =====================================================================
-- Regras:
--   • admin (alissonerp.usuarios.role IN 'admin','superadmin') → vê tudo
--   • vendedor → vê só conversas/tarefas atribuídas a ele
--   • notificações → cada user só vê as suas
--   • configs → só admin
-- =====================================================================
--
-- ⚠️ PRÉ-REQUISITO: public.vendedores.user_id (uuid) precisa estar
-- preenchido pra ligar vendedor ↔ auth.users. Hoje a maioria está NULL.
-- Migration 0007 lida com isso.
-- =====================================================================

BEGIN;

-- Liga RLS em todas as tabelas
ALTER TABLE crm.config_geral         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.unipile_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.meta_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.kommo_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.conversas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.mensagens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.instagram_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.funil_blocos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.funil_etapas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.funil_movimentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.prompt_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.agentes_ia           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.agente_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.sdr_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.brechas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.ciclo_vida_eventos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.automacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.automacao_gatilhos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.automacao_execucoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.tarefas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.notificacoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.webhook_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.webhook_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.audit_log            ENABLE ROW LEVEL SECURITY;

-- Helper: drop policy se existir (idempotente)
DO $$ BEGIN END $$;  -- placeholder
-- Macros pra reduzir duplicação
-- (Postgres não tem macro real, então repetimos as policies)

-- ====================================================================
-- CONFIGS — só admin
-- ====================================================================

DROP POLICY IF EXISTS p_config_geral_select ON crm.config_geral;
CREATE POLICY p_config_geral_select ON crm.config_geral
  FOR SELECT TO authenticated USING (crm.user_eh_admin());

DROP POLICY IF EXISTS p_config_geral_all ON crm.config_geral;
CREATE POLICY p_config_geral_all ON crm.config_geral
  FOR ALL TO authenticated
  USING (crm.user_eh_admin())
  WITH CHECK (crm.user_eh_admin());

-- mesma regra pra unipile / meta / kommo
DROP POLICY IF EXISTS p_unipile_admin ON crm.unipile_config;
CREATE POLICY p_unipile_admin ON crm.unipile_config
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_meta_admin ON crm.meta_config;
CREATE POLICY p_meta_admin ON crm.meta_config
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_kommo_admin ON crm.kommo_config;
CREATE POLICY p_kommo_admin ON crm.kommo_config
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

-- ====================================================================
-- CONVERSAS — admin vê tudo, vendedor só as suas
-- ====================================================================

DROP POLICY IF EXISTS p_conversas_select ON crm.conversas;
CREATE POLICY p_conversas_select ON crm.conversas
  FOR SELECT TO authenticated
  USING (
    crm.user_eh_admin() OR
    vendedor_id = crm.user_vendedor_id() OR
    vendedor_id IS NULL  -- não atribuída — visível pra todos vendedores
  );

DROP POLICY IF EXISTS p_conversas_insert ON crm.conversas;
CREATE POLICY p_conversas_insert ON crm.conversas
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- qualquer authenticated pode criar (webhook entra como service_role)

DROP POLICY IF EXISTS p_conversas_update ON crm.conversas;
CREATE POLICY p_conversas_update ON crm.conversas
  FOR UPDATE TO authenticated
  USING (
    crm.user_eh_admin() OR
    vendedor_id = crm.user_vendedor_id() OR
    vendedor_id IS NULL
  );

DROP POLICY IF EXISTS p_conversas_delete ON crm.conversas;
CREATE POLICY p_conversas_delete ON crm.conversas
  FOR DELETE TO authenticated USING (crm.user_eh_admin());

-- ====================================================================
-- MENSAGENS — herda da conversa
-- ====================================================================

DROP POLICY IF EXISTS p_mensagens_select ON crm.mensagens;
CREATE POLICY p_mensagens_select ON crm.mensagens
  FOR SELECT TO authenticated USING (
    crm.user_eh_admin() OR EXISTS (
      SELECT 1 FROM crm.conversas c
      WHERE c.id = mensagens.conversa_id
        AND (c.vendedor_id = crm.user_vendedor_id() OR c.vendedor_id IS NULL)
    )
  );

DROP POLICY IF EXISTS p_mensagens_insert ON crm.mensagens;
CREATE POLICY p_mensagens_insert ON crm.mensagens
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS p_mensagens_update ON crm.mensagens;
CREATE POLICY p_mensagens_update ON crm.mensagens
  FOR UPDATE TO authenticated USING (
    crm.user_eh_admin() OR EXISTS (
      SELECT 1 FROM crm.conversas c
      WHERE c.id = mensagens.conversa_id
        AND c.vendedor_id = crm.user_vendedor_id()
    )
  );

DROP POLICY IF EXISTS p_mensagens_delete ON crm.mensagens;
CREATE POLICY p_mensagens_delete ON crm.mensagens
  FOR DELETE TO authenticated USING (crm.user_eh_admin());

-- ====================================================================
-- INSTAGRAM POSTS — leitura aberta (cache público), escrita admin
-- ====================================================================

DROP POLICY IF EXISTS p_ig_posts_select ON crm.instagram_posts;
CREATE POLICY p_ig_posts_select ON crm.instagram_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_ig_posts_write ON crm.instagram_posts;
CREATE POLICY p_ig_posts_write ON crm.instagram_posts
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

-- ====================================================================
-- FUNIL — leitura todos, escrita admin
-- ====================================================================

DROP POLICY IF EXISTS p_funil_blocos_read ON crm.funil_blocos;
CREATE POLICY p_funil_blocos_read ON crm.funil_blocos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_funil_blocos_admin ON crm.funil_blocos;
CREATE POLICY p_funil_blocos_admin ON crm.funil_blocos
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_funil_etapas_read ON crm.funil_etapas;
CREATE POLICY p_funil_etapas_read ON crm.funil_etapas
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_funil_etapas_admin ON crm.funil_etapas;
CREATE POLICY p_funil_etapas_admin ON crm.funil_etapas
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_funil_mov_read ON crm.funil_movimentos;
CREATE POLICY p_funil_mov_read ON crm.funil_movimentos
  FOR SELECT TO authenticated USING (
    crm.user_eh_admin() OR EXISTS (
      SELECT 1 FROM crm.conversas c
      WHERE c.id = funil_movimentos.conversa_id
        AND (c.vendedor_id = crm.user_vendedor_id() OR c.vendedor_id IS NULL)
    )
  );
DROP POLICY IF EXISTS p_funil_mov_insert ON crm.funil_movimentos;
CREATE POLICY p_funil_mov_insert ON crm.funil_movimentos
  FOR INSERT TO authenticated WITH CHECK (true);

-- ====================================================================
-- IA: prompts/agentes admin, runs leitura todos com filtro
-- ====================================================================

DROP POLICY IF EXISTS p_prompts_read ON crm.prompt_templates;
CREATE POLICY p_prompts_read ON crm.prompt_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_prompts_admin ON crm.prompt_templates;
CREATE POLICY p_prompts_admin ON crm.prompt_templates
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_agentes_read ON crm.agentes_ia;
CREATE POLICY p_agentes_read ON crm.agentes_ia
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_agentes_admin ON crm.agentes_ia;
CREATE POLICY p_agentes_admin ON crm.agentes_ia
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_agente_runs_read ON crm.agente_runs;
CREATE POLICY p_agente_runs_read ON crm.agente_runs
  FOR SELECT TO authenticated USING (
    crm.user_eh_admin() OR EXISTS (
      SELECT 1 FROM crm.conversas c
      WHERE c.id = agente_runs.conversa_id
        AND (c.vendedor_id = crm.user_vendedor_id() OR c.vendedor_id IS NULL)
    )
  );

DROP POLICY IF EXISTS p_sdr_read ON crm.sdr_runs;
CREATE POLICY p_sdr_read ON crm.sdr_runs
  FOR SELECT TO authenticated USING (
    crm.user_eh_admin() OR EXISTS (
      SELECT 1 FROM crm.conversas c
      WHERE c.id = sdr_runs.conversa_id
        AND (c.vendedor_id = crm.user_vendedor_id() OR c.vendedor_id IS NULL)
    )
  );

-- ====================================================================
-- BRECHAS / CICLO VIDA — vendedor vê do seu cliente
-- ====================================================================

DROP POLICY IF EXISTS p_brechas_read ON crm.brechas;
CREATE POLICY p_brechas_read ON crm.brechas
  FOR SELECT TO authenticated USING (
    crm.user_eh_admin() OR EXISTS (
      SELECT 1 FROM crm.conversas c
      WHERE c.id = brechas.conversa_id
        AND (c.vendedor_id = crm.user_vendedor_id() OR c.vendedor_id IS NULL)
    )
  );

DROP POLICY IF EXISTS p_brechas_write ON crm.brechas;
CREATE POLICY p_brechas_write ON crm.brechas
  FOR ALL TO authenticated USING (crm.user_eh_admin())
  WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_ciclo_read ON crm.ciclo_vida_eventos;
CREATE POLICY p_ciclo_read ON crm.ciclo_vida_eventos
  FOR SELECT TO authenticated USING (
    crm.user_eh_admin() OR EXISTS (
      SELECT 1 FROM crm.conversas c
      WHERE c.id = ciclo_vida_eventos.conversa_id
        AND (c.vendedor_id = crm.user_vendedor_id() OR c.vendedor_id IS NULL)
    )
  );

-- ====================================================================
-- AUTOMAÇÕES — admin
-- ====================================================================

DROP POLICY IF EXISTS p_aut_admin ON crm.automacoes;
CREATE POLICY p_aut_admin ON crm.automacoes
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_aut_gat_admin ON crm.automacao_gatilhos;
CREATE POLICY p_aut_gat_admin ON crm.automacao_gatilhos
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_aut_exec_read ON crm.automacao_execucoes;
CREATE POLICY p_aut_exec_read ON crm.automacao_execucoes
  FOR SELECT TO authenticated USING (crm.user_eh_admin());

-- ====================================================================
-- TAREFAS — vendedor vê suas
-- ====================================================================

DROP POLICY IF EXISTS p_tarefas_read ON crm.tarefas;
CREATE POLICY p_tarefas_read ON crm.tarefas
  FOR SELECT TO authenticated USING (
    crm.user_eh_admin() OR responsavel_id = auth.uid() OR criado_por = auth.uid()
  );

DROP POLICY IF EXISTS p_tarefas_write ON crm.tarefas;
CREATE POLICY p_tarefas_write ON crm.tarefas
  FOR ALL TO authenticated USING (
    crm.user_eh_admin() OR responsavel_id = auth.uid() OR criado_por = auth.uid()
  ) WITH CHECK (true);

-- ====================================================================
-- NOTIFICAÇÕES — só do próprio user
-- ====================================================================

DROP POLICY IF EXISTS p_notif_select ON crm.notificacoes;
CREATE POLICY p_notif_select ON crm.notificacoes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR crm.user_eh_admin());

DROP POLICY IF EXISTS p_notif_update ON crm.notificacoes;
CREATE POLICY p_notif_update ON crm.notificacoes
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS p_notif_insert ON crm.notificacoes;
CREATE POLICY p_notif_insert ON crm.notificacoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- ====================================================================
-- WEBHOOKS / AUDIT — só admin
-- ====================================================================

DROP POLICY IF EXISTS p_wh_cfg ON crm.webhook_config;
CREATE POLICY p_wh_cfg ON crm.webhook_config
  FOR ALL TO authenticated USING (crm.user_eh_admin()) WITH CHECK (crm.user_eh_admin());

DROP POLICY IF EXISTS p_wh_log ON crm.webhook_log;
CREATE POLICY p_wh_log ON crm.webhook_log
  FOR SELECT TO authenticated USING (crm.user_eh_admin());

DROP POLICY IF EXISTS p_audit ON crm.audit_log;
CREATE POLICY p_audit ON crm.audit_log
  FOR SELECT TO authenticated USING (crm.user_eh_admin());

COMMIT;
