-- =====================================================================
-- 0012 — Pipeline completo (Funis múltiplos + Oportunidades + Histórico)
-- =====================================================================
-- Reproduz o modelo do Pipeline antigo (sqlite tables: pipeline, funis,
-- funil_estagios, pipeline_historico, motivos_perda, origens_lead).
-- Mantém compatibilidade com crm.conversas (conversa pode gerar oportunidade).
-- =====================================================================

BEGIN;

-- ============================================================
-- crm.funis — múltiplos pipelines (Vendas, Pós-venda, Recompra, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm.funis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       integer UNIQUE,           -- ID antigo do SQLite (pra dedup)
  nome            text NOT NULL,
  cor             text DEFAULT '#184036',
  ordem           integer NOT NULL DEFAULT 1,
  ativo           boolean NOT NULL DEFAULT true,
  descricao       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funis_ordem ON crm.funis(ordem) WHERE ativo;

-- ============================================================
-- Expande crm.funil_etapas com funil_id, tipo, fase
-- ============================================================
ALTER TABLE crm.funil_etapas
  ADD COLUMN IF NOT EXISTS legacy_id integer UNIQUE;
ALTER TABLE crm.funil_etapas
  ADD COLUMN IF NOT EXISTS funil_id uuid REFERENCES crm.funis(id) ON DELETE CASCADE;
ALTER TABLE crm.funil_etapas
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'aberto'
    CHECK (tipo IN ('aberto','ganho','perdido','arquivo','pos_venda','nutrir'));
ALTER TABLE crm.funil_etapas
  ADD COLUMN IF NOT EXISTS fase text;

CREATE INDEX IF NOT EXISTS idx_funil_etapas_funil ON crm.funil_etapas(funil_id, ordem);

-- ============================================================
-- crm.oportunidades — Odv (deal). Entidade central do pipeline.
-- ============================================================
CREATE TABLE IF NOT EXISTS crm.oportunidades (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                   text UNIQUE,                                    -- pipeline.id (TEXT) do SQLite
  -- Relações principais
  contato_id                  bigint REFERENCES public.contatos(id_contato) ON DELETE SET NULL,
  vendedor_id                 bigint REFERENCES public.vendedores(id_vendedor) ON DELETE SET NULL,
  conversa_id                 uuid REFERENCES crm.conversas(id) ON DELETE SET NULL,
  funil_id                    uuid NOT NULL REFERENCES crm.funis(id) ON DELETE CASCADE,
  etapa_id                    uuid REFERENCES crm.funil_etapas(id) ON DELETE SET NULL,
  -- Dados básicos
  titulo                      text NOT NULL,
  valor                       numeric(12,2),
  produto_interesse           text,
  notas                       text,
  tags                        jsonb DEFAULT '[]'::jsonb,
  -- Origem / classificação
  origem_lead                 text,
  canal_origem                text,
  motivo_perda                text,
  -- Pedido / comercial
  tipo_pedido                 text,
  forma_atendimento           text,
  tipo_cliente                text,
  itens_pedido                jsonb,
  desconto                    text,
  parcelas                    integer,
  forma_pagamento             text,
  valor_frete                 numeric(12,2),
  endereco_entrega            text,
  data_prevista_entrega       date,
  data_envio                  date,
  transportador               text,
  observacao_pedido           text,
  forma_envio                 text,
  codigo_rastreio             text,
  data_entrega                date,
  entrega_confirmada          boolean DEFAULT false,
  -- BANT (resumido — detalhe vem de crm.sdr_runs)
  score_bant                  smallint,
  classificacao               text CHECK (classificacao IS NULL OR classificacao IN ('frio','morno','quente','muito_quente')),
  perfil                      text,
  decisor                     text,
  orcamento_declarado         text,
  ocasiao                     text,
  prazo                       text,
  -- Pós-venda / nutrição
  motivo_pos_venda            text,
  data_entrada_pos_venda      timestamptz,
  opt_out                     boolean DEFAULT false,
  opt_out_data                timestamptz,
  tentativas_reabordagem      integer DEFAULT 0,
  -- Campos preenchidos por IA (lista de campos pra UI mostrar destacado)
  campos_ia                   jsonb DEFAULT '[]'::jsonb,
  -- Auditoria
  metadata                    jsonb DEFAULT '{}'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oport_funil ON crm.oportunidades(funil_id, etapa_id);
CREATE INDEX IF NOT EXISTS idx_oport_contato ON crm.oportunidades(contato_id);
CREATE INDEX IF NOT EXISTS idx_oport_vendedor ON crm.oportunidades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_oport_conversa ON crm.oportunidades(conversa_id) WHERE conversa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oport_classif ON crm.oportunidades(classificacao) WHERE classificacao IS NOT NULL;

-- ============================================================
-- crm.oportunidade_historico — mudanças de etapa (substitui pipeline_historico)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm.oportunidade_historico (
  id                  bigserial PRIMARY KEY,
  oportunidade_id     uuid NOT NULL REFERENCES crm.oportunidades(id) ON DELETE CASCADE,
  etapa_anterior_id   uuid REFERENCES crm.funil_etapas(id),
  etapa_nova_id       uuid REFERENCES crm.funil_etapas(id),
  etapa_anterior_nome text,
  etapa_nova_nome     text,
  motivo              text,
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata            jsonb DEFAULT '{}'::jsonb,
  ocorrido_em         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oport_hist_op ON crm.oportunidade_historico(oportunidade_id, ocorrido_em DESC);

-- ============================================================
-- crm.motivos_perda — catálogo de motivos
-- ============================================================
CREATE TABLE IF NOT EXISTS crm.motivos_perda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       integer UNIQUE,
  nome            text NOT NULL,
  ativo           boolean DEFAULT true,
  ordem           integer DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- crm.origens_lead — catálogo de origens
-- ============================================================
CREATE TABLE IF NOT EXISTS crm.origens_lead (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       integer UNIQUE,
  nome            text NOT NULL,
  ativo           boolean DEFAULT true,
  ordem           integer DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- crm.automacao_etapas — automações entre etapas (substitui automacao_etapas SQLite)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm.automacao_etapas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id           integer UNIQUE,
  funil_id            uuid REFERENCES crm.funis(id) ON DELETE CASCADE,
  gatilho             text NOT NULL,        -- 'ao_entrar_etapa','ao_sair_etapa','tempo_em_etapa','manual'
  estagio_origem_id   uuid REFERENCES crm.funil_etapas(id) ON DELETE CASCADE,
  estagio_destino_id  uuid REFERENCES crm.funil_etapas(id) ON DELETE CASCADE,
  tipo_acao           text NOT NULL,        -- 'mover_estagio','enviar_msg','criar_tarefa','etc'
  config              jsonb DEFAULT '{}'::jsonb,
  descricao           text,
  ativo               boolean DEFAULT true,
  total_execucoes     bigint DEFAULT 0,
  ultima_execucao     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Triggers updated_at
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['funis','oportunidades','automacao_etapas']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON crm.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON crm.%I FOR EACH ROW EXECUTE FUNCTION crm.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- Permissões
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA crm TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA crm TO authenticated, service_role;

-- ============================================================
-- Views públicas (PostgREST expõe)
-- ============================================================
DROP VIEW IF EXISTS public.crm_funis CASCADE;
CREATE VIEW public.crm_funis WITH (security_invoker = true) AS SELECT * FROM crm.funis;

DROP VIEW IF EXISTS public.crm_oportunidades CASCADE;
CREATE VIEW public.crm_oportunidades WITH (security_invoker = true) AS SELECT * FROM crm.oportunidades;

DROP VIEW IF EXISTS public.crm_oportunidade_historico CASCADE;
CREATE VIEW public.crm_oportunidade_historico WITH (security_invoker = true) AS SELECT * FROM crm.oportunidade_historico;

DROP VIEW IF EXISTS public.crm_motivos_perda CASCADE;
CREATE VIEW public.crm_motivos_perda WITH (security_invoker = true) AS SELECT * FROM crm.motivos_perda;

DROP VIEW IF EXISTS public.crm_origens_lead CASCADE;
CREATE VIEW public.crm_origens_lead WITH (security_invoker = true) AS SELECT * FROM crm.origens_lead;

DROP VIEW IF EXISTS public.crm_automacao_etapas CASCADE;
CREATE VIEW public.crm_automacao_etapas WITH (security_invoker = true) AS SELECT * FROM crm.automacao_etapas;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_funis,
  public.crm_oportunidades, public.crm_oportunidade_historico,
  public.crm_motivos_perda, public.crm_origens_lead,
  public.crm_automacao_etapas
  TO authenticated, service_role;

-- ============================================================
-- View completa: oportunidades + cliente + vendedor + etapa + bloco + venda + BANT detalhado
-- ============================================================
DROP VIEW IF EXISTS public.crm_oportunidades_completas CASCADE;
CREATE VIEW public.crm_oportunidades_completas
  WITH (security_invoker = true) AS
SELECT
  o.*,
  ct.nome              AS cliente_nome,
  ct.telefone          AS cliente_telefone,
  ct.celular           AS cliente_celular,
  ct.email             AS cliente_email,
  v.nome               AS vendedor_nome,
  v.foto               AS vendedor_foto,
  e.nome               AS etapa_nome,
  e.cor                AS etapa_cor,
  e.tipo               AS etapa_tipo,
  e.ordem              AS etapa_ordem,
  b.nome               AS bloco_nome,
  b.cor                AS bloco_cor,
  -- Venda registrada?
  CASE WHEN ve.id IS NOT NULL THEN 1 ELSE 0 END AS venda_registrada,
  ve.id                AS venda_id,
  ve.data_venda        AS data_venda,
  ve.total_venda       AS venda_total,
  -- BANT detalhado (último sdr_run da conversa associada)
  sdr.score_total      AS bant_lead_score,
  sdr.classificacao    AS bant_classificacao,
  sdr.score_budget     AS bant_budget_score,
  sdr.score_authority  AS bant_authority_score,
  sdr.score_need       AS bant_need_score,
  sdr.score_timing     AS bant_timeline_score,
  sdr.bonus_engajamento AS bant_bonus_score
FROM crm.oportunidades o
LEFT JOIN public.contatos ct ON ct.id_contato = o.contato_id
LEFT JOIN public.vendedores v ON v.id_vendedor = o.vendedor_id
LEFT JOIN crm.funil_etapas e ON e.id = o.etapa_id
LEFT JOIN crm.funil_blocos b ON b.id = e.bloco_id
LEFT JOIN alissonerp.vendas_erp ve ON ve.cliente_id = o.contato_id
  AND ve.created_at >= o.created_at - interval '7 days'
  AND ve.created_at <= o.created_at + interval '90 days'
LEFT JOIN LATERAL (
  SELECT * FROM crm.sdr_runs
  WHERE conversa_id = o.conversa_id
  ORDER BY created_at DESC LIMIT 1
) sdr ON true;

GRANT SELECT ON public.crm_oportunidades_completas TO authenticated, service_role;

-- ============================================================
-- Função: criar oportunidade
-- ============================================================
CREATE OR REPLACE FUNCTION crm.criar_oportunidade(
  p_contato_id        bigint,
  p_titulo            text,
  p_funil_id          uuid,
  p_etapa_id          uuid DEFAULT NULL,
  p_vendedor_id       bigint DEFAULT NULL,
  p_valor             numeric DEFAULT NULL,
  p_produto_interesse text DEFAULT NULL,
  p_notas             text DEFAULT NULL,
  p_origem_lead       text DEFAULT NULL,
  p_conversa_id       uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_op_id uuid;
  v_etapa_id uuid := p_etapa_id;
  v_etapa_nome text;
BEGIN
  -- Se não informou etapa, pega a primeira do funil
  IF v_etapa_id IS NULL THEN
    SELECT id INTO v_etapa_id FROM crm.funil_etapas
    WHERE funil_id = p_funil_id AND ativo
    ORDER BY ordem LIMIT 1;
  END IF;

  INSERT INTO crm.oportunidades
    (contato_id, vendedor_id, funil_id, etapa_id, titulo, valor,
     produto_interesse, notas, origem_lead, conversa_id)
  VALUES
    (p_contato_id, p_vendedor_id, p_funil_id, v_etapa_id, p_titulo, p_valor,
     p_produto_interesse, p_notas, p_origem_lead, p_conversa_id)
  RETURNING id INTO v_op_id;

  -- Histórico inicial
  SELECT nome INTO v_etapa_nome FROM crm.funil_etapas WHERE id = v_etapa_id;
  INSERT INTO crm.oportunidade_historico
    (oportunidade_id, etapa_nova_id, etapa_nova_nome, user_id)
  VALUES (v_op_id, v_etapa_id, v_etapa_nome, auth.uid());

  RETURN v_op_id;
END;
$$;

-- ============================================================
-- Função: mover etapa de oportunidade (gera histórico + dispara automações)
-- ============================================================
CREATE OR REPLACE FUNCTION crm.mover_oportunidade_etapa(
  p_oportunidade_id   uuid,
  p_etapa_destino_id  uuid,
  p_motivo            text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_etapa_atual_id   uuid;
  v_etapa_atual_nome text;
  v_etapa_destino_nome text;
  v_destino_tipo     text;
BEGIN
  SELECT etapa_id INTO v_etapa_atual_id FROM crm.oportunidades
  WHERE id = p_oportunidade_id FOR UPDATE;

  SELECT nome INTO v_etapa_atual_nome FROM crm.funil_etapas WHERE id = v_etapa_atual_id;
  SELECT nome, tipo INTO v_etapa_destino_nome, v_destino_tipo
  FROM crm.funil_etapas WHERE id = p_etapa_destino_id;

  UPDATE crm.oportunidades
  SET etapa_id = p_etapa_destino_id,
      motivo_perda = CASE WHEN v_destino_tipo = 'perdido' THEN COALESCE(p_motivo, motivo_perda) ELSE motivo_perda END,
      data_entrada_pos_venda = CASE WHEN v_destino_tipo = 'pos_venda' THEN now() ELSE data_entrada_pos_venda END
  WHERE id = p_oportunidade_id;

  INSERT INTO crm.oportunidade_historico
    (oportunidade_id, etapa_anterior_id, etapa_anterior_nome,
     etapa_nova_id, etapa_nova_nome, motivo, user_id)
  VALUES
    (p_oportunidade_id, v_etapa_atual_id, v_etapa_atual_nome,
     p_etapa_destino_id, v_etapa_destino_nome, p_motivo, auth.uid());
END;
$$;

-- Wrappers em public pra RPC
CREATE OR REPLACE FUNCTION public.crm_criar_oportunidade(
  p_contato_id bigint, p_titulo text, p_funil_id uuid,
  p_etapa_id uuid DEFAULT NULL, p_vendedor_id bigint DEFAULT NULL,
  p_valor numeric DEFAULT NULL, p_produto_interesse text DEFAULT NULL,
  p_notas text DEFAULT NULL, p_origem_lead text DEFAULT NULL,
  p_conversa_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE sql SECURITY INVOKER AS $$
  SELECT crm.criar_oportunidade(p_contato_id, p_titulo, p_funil_id, p_etapa_id,
    p_vendedor_id, p_valor, p_produto_interesse, p_notas, p_origem_lead, p_conversa_id);
$$;

CREATE OR REPLACE FUNCTION public.crm_mover_oportunidade_etapa(
  p_oportunidade_id uuid, p_etapa_destino_id uuid, p_motivo text DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY INVOKER AS $$
  SELECT crm.mover_oportunidade_etapa(p_oportunidade_id, p_etapa_destino_id, p_motivo);
$$;

GRANT EXECUTE ON FUNCTION public.crm_criar_oportunidade TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_mover_oportunidade_etapa TO authenticated, service_role;

-- ============================================================
-- Realtime: adiciona oportunidades + historico na publication
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='crm' AND tablename='oportunidades') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE crm.oportunidades;';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='crm' AND tablename='oportunidade_historico') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE crm.oportunidade_historico;';
  END IF;
END $$;

COMMIT;
