-- =====================================================================
-- 0009 — Views de conveniência com JOINs (otimiza chamadas do front)
-- =====================================================================

BEGIN;

-- ============================================================
-- crm_conversas_completas — conversa + nome cliente + foto + última msg
-- ============================================================
DROP VIEW IF EXISTS public.crm_conversas_completas CASCADE;
CREATE VIEW public.crm_conversas_completas
  WITH (security_invoker = true) AS
SELECT
  c.id,
  c.contato_id,
  c.lead_id,
  c.vendedor_id,
  c.canal,
  c.canal_contato_id,
  c.canal_thread_id,
  c.status,
  c.modo_auto,
  c.ultima_msg_em,
  c.ultima_msg_resumo,
  c.nao_lidas_count,
  c.etapa_atual_id,
  c.metadata,
  c.created_at,
  c.updated_at,
  -- Cliente
  ct.nome           AS contato_nome,
  ct.telefone       AS contato_telefone,
  ct.celular        AS contato_celular,
  ct.email          AS contato_email,
  -- Vendedor
  v.nome            AS vendedor_nome,
  v.foto            AS vendedor_foto,
  -- Etapa atual do funil
  fe.nome           AS etapa_nome,
  fe.cor            AS etapa_cor,
  fb.nome           AS bloco_nome,
  fb.cor            AS bloco_cor
FROM crm.conversas c
LEFT JOIN public.contatos ct ON ct.id_contato = c.contato_id
LEFT JOIN public.vendedores v ON v.id_vendedor = c.vendedor_id
LEFT JOIN crm.funil_etapas fe ON fe.id = c.etapa_atual_id
LEFT JOIN crm.funil_blocos fb ON fb.id = fe.bloco_id;

GRANT SELECT ON public.crm_conversas_completas TO authenticated, service_role;

COMMENT ON VIEW public.crm_conversas_completas IS
  'Conversas com nome do cliente, vendedor e etapa do funil. Read-only.';

-- ============================================================
-- crm_funil_etapas_completas — etapa + nome do bloco
-- ============================================================
DROP VIEW IF EXISTS public.crm_funil_etapas_completas CASCADE;
CREATE VIEW public.crm_funil_etapas_completas
  WITH (security_invoker = true) AS
SELECT
  fe.id,
  fe.bloco_id,
  fe.nome,
  fe.ordem,
  fe.cor,
  fe.ativo,
  fb.nome  AS bloco_nome,
  fb.ordem AS bloco_ordem,
  fb.cor   AS bloco_cor
FROM crm.funil_etapas fe
LEFT JOIN crm.funil_blocos fb ON fb.id = fe.bloco_id
ORDER BY fb.ordem, fe.ordem;

GRANT SELECT ON public.crm_funil_etapas_completas TO authenticated, service_role;

-- ============================================================
-- crm_user_perfil — junta auth.users + alissonerp.usuarios + vendedor
-- ============================================================
DROP VIEW IF EXISTS public.crm_user_perfil CASCADE;
CREATE VIEW public.crm_user_perfil
  WITH (security_invoker = true) AS
SELECT
  au.id           AS user_id,
  au.email,
  eu.nome,
  eu.role,
  eu.vendedor_id,
  v.nome          AS vendedor_nome,
  v.foto          AS vendedor_foto,
  v.email         AS vendedor_email
FROM auth.users au
LEFT JOIN alissonerp.usuarios eu ON eu.id = au.id
LEFT JOIN public.vendedores v ON v.id_vendedor = eu.vendedor_id;

GRANT SELECT ON public.crm_user_perfil TO authenticated, service_role;

COMMENT ON VIEW public.crm_user_perfil IS
  'Perfil completo do user logado: email + nome ERP + role + vendedor ligado.';

COMMIT;
