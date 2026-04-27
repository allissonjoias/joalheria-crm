-- =====================================================================
-- 0003 — Funções de negócio (substituem código do backend Node)
-- =====================================================================

BEGIN;

-- ============================================================
-- crm.buscar_ou_criar_contato_dm
--   Procura cliente por:
--     1) public.complementos_contatos.instagram (username)
--     2) Nome normalizado em public.contatos
--   Se não achar, cria novo public.contatos + public.complementos_contatos.
--   Retorna id_contato (bigint).
-- ============================================================
CREATE OR REPLACE FUNCTION crm.buscar_ou_criar_contato_dm(
  p_canal           text,        -- 'instagram_dm', 'whatsapp', etc
  p_canal_id        text,        -- IGSID, número WhatsApp
  p_nome            text,
  p_username        text DEFAULT NULL,
  p_foto_url        text DEFAULT NULL,
  p_telefone        text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_contato_id bigint;
  v_nome_normalizado text := crm.normalizar_nome(p_nome);
BEGIN
  -- 1) tenta achar pelo username Instagram (se canal_id corresponder)
  IF p_username IS NOT NULL AND length(p_username) > 0 THEN
    SELECT cc.contato_id_api INTO v_contato_id
    FROM public.complementos_contatos cc
    WHERE lower(cc.instagram) = lower(p_username)
    LIMIT 1;
    IF v_contato_id IS NOT NULL THEN RETURN v_contato_id; END IF;
  END IF;

  -- 2) tenta achar por nome normalizado
  IF length(v_nome_normalizado) > 3 THEN
    SELECT id_contato INTO v_contato_id
    FROM public.contatos
    WHERE crm.normalizar_nome(nome) = v_nome_normalizado
    LIMIT 1;
    IF v_contato_id IS NOT NULL THEN
      -- enriquece com instagram se ainda não tiver
      IF p_username IS NOT NULL THEN
        INSERT INTO public.complementos_contatos (id, contato_id_api, instagram)
        VALUES (
          COALESCE((SELECT max(id) FROM public.complementos_contatos), 0) + 1,
          v_contato_id, p_username
        )
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN v_contato_id;
    END IF;
  END IF;

  -- 3) cria novo
  INSERT INTO public.contatos (
    id_contato, nome, telefone, data_atualizacao
  ) VALUES (
    COALESCE((SELECT max(id_contato) FROM public.contatos), 0) + 1,
    p_nome, p_telefone, now()
  )
  RETURNING id_contato INTO v_contato_id;

  -- complemento (instagram)
  IF p_username IS NOT NULL THEN
    INSERT INTO public.complementos_contatos (id, contato_id_api, instagram)
    VALUES (
      COALESCE((SELECT max(id) FROM public.complementos_contatos), 0) + 1,
      v_contato_id, p_username
    );
  END IF;

  RETURN v_contato_id;
END;
$$;

COMMENT ON FUNCTION crm.buscar_ou_criar_contato_dm IS
  'Busca cliente em public.contatos por username IG ou nome. Se não achar, cria. Garante 1 cliente único.';

-- ============================================================
-- crm.criar_conversa_se_necessario
--   Idempotente: 1 conversa por (canal, canal_thread_id).
--   Se contato_id mudar (ex: merge de cliente), atualiza.
-- ============================================================
CREATE OR REPLACE FUNCTION crm.criar_conversa_se_necessario(
  p_canal             text,
  p_canal_thread_id   text,
  p_canal_contato_id  text,
  p_contato_id        bigint
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversa_id uuid;
BEGIN
  -- tenta achar conversa por (canal, thread)
  SELECT id INTO v_conversa_id
  FROM crm.conversas
  WHERE canal = p_canal AND canal_thread_id = p_canal_thread_id
  LIMIT 1;

  IF v_conversa_id IS NOT NULL THEN
    -- atualiza contato_id se necessário (merge)
    UPDATE crm.conversas
    SET contato_id = COALESCE(p_contato_id, contato_id)
    WHERE id = v_conversa_id AND (contato_id IS NULL OR contato_id <> p_contato_id);
    RETURN v_conversa_id;
  END IF;

  -- cria nova
  INSERT INTO crm.conversas (canal, canal_thread_id, canal_contato_id, contato_id, status)
  VALUES (p_canal, p_canal_thread_id, p_canal_contato_id, p_contato_id, 'aberta')
  RETURNING id INTO v_conversa_id;

  RETURN v_conversa_id;
END;
$$;

COMMENT ON FUNCTION crm.criar_conversa_se_necessario IS
  '1 conversa por (canal, thread) — UPSERT idempotente para webhooks.';

-- ============================================================
-- crm.adicionar_mensagem
--   Insere msg, atualiza ultima_msg_em da conversa, dispara ciclo_vida e notificações.
--   Idempotente por canal_message_id (dedup webhooks).
-- ============================================================
CREATE OR REPLACE FUNCTION crm.adicionar_mensagem(
  p_conversa_id           uuid,
  p_papel                 text,
  p_conteudo              text,
  p_canal_message_id      text DEFAULT NULL,
  p_tipo_midia            text DEFAULT NULL,
  p_midia_url             text DEFAULT NULL,
  p_midia_storage_path    text DEFAULT NULL,
  p_instagram_media_id    text DEFAULT NULL,
  p_metadata              jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_msg_id uuid;
  v_existe uuid;
  v_resumo text;
  v_eh_primeira boolean;
  v_vendedor_user uuid;
BEGIN
  -- dedupe
  IF p_canal_message_id IS NOT NULL THEN
    SELECT id INTO v_existe
    FROM crm.mensagens
    WHERE conversa_id = p_conversa_id AND canal_message_id = p_canal_message_id
    LIMIT 1;
    IF v_existe IS NOT NULL THEN
      -- enriquece se chegou attachment depois
      UPDATE crm.mensagens SET
        midia_url = COALESCE(midia_url, p_midia_url),
        midia_storage_path = COALESCE(midia_storage_path, p_midia_storage_path),
        instagram_media_id = COALESCE(instagram_media_id, p_instagram_media_id)
      WHERE id = v_existe;
      RETURN v_existe;
    END IF;
  END IF;

  -- conta msgs anteriores pra detectar primeira
  SELECT NOT EXISTS (SELECT 1 FROM crm.mensagens WHERE conversa_id = p_conversa_id)
    INTO v_eh_primeira;

  INSERT INTO crm.mensagens (
    conversa_id, papel, conteudo, canal_message_id, tipo_midia,
    midia_url, midia_storage_path, instagram_media_id, metadata
  ) VALUES (
    p_conversa_id, p_papel, p_conteudo, p_canal_message_id, p_tipo_midia,
    p_midia_url, p_midia_storage_path, p_instagram_media_id, COALESCE(p_metadata,'{}'::jsonb)
  )
  RETURNING id INTO v_msg_id;

  v_resumo := substring(COALESCE(p_conteudo, ''), 1, 120);
  IF v_resumo = '' AND p_tipo_midia IS NOT NULL THEN
    v_resumo := '[' || p_tipo_midia || ']';
  END IF;

  -- atualiza conversa
  UPDATE crm.conversas SET
    ultima_msg_em = now(),
    ultima_msg_resumo = v_resumo,
    nao_lidas_count = CASE WHEN p_papel = 'user' THEN nao_lidas_count + 1 ELSE nao_lidas_count END,
    status = CASE WHEN status = 'arquivada' AND p_papel = 'user' THEN 'aberta' ELSE status END
  WHERE id = p_conversa_id;

  -- ciclo de vida: primeira_mensagem
  IF v_eh_primeira THEN
    INSERT INTO crm.ciclo_vida_eventos (conversa_id, contato_id, evento, detalhes)
    SELECT id, contato_id, 'primeira_mensagem', jsonb_build_object('mensagem_id', v_msg_id)
    FROM crm.conversas WHERE id = p_conversa_id;
  END IF;

  -- notificação: se msg do cliente, notifica vendedor responsável
  IF p_papel = 'user' THEN
    SELECT au.id INTO v_vendedor_user
    FROM crm.conversas conv
    JOIN public.vendedores vd ON vd.id_vendedor = conv.vendedor_id
    JOIN auth.users au ON au.id = vd.user_id
    WHERE conv.id = p_conversa_id;

    IF v_vendedor_user IS NOT NULL THEN
      INSERT INTO crm.notificacoes (user_id, tipo, titulo, mensagem, link, conversa_id)
      VALUES (
        v_vendedor_user,
        'mensagem_nova',
        'Nova mensagem',
        v_resumo,
        '/mensageria/' || p_conversa_id::text,
        p_conversa_id
      );
    END IF;
  END IF;

  RETURN v_msg_id;
END;
$$;

COMMENT ON FUNCTION crm.adicionar_mensagem IS
  'Insere mensagem com dedup, atualiza conversa, dispara ciclo_vida e notificações.';

-- ============================================================
-- crm.marcar_conversa_lida
-- ============================================================
CREATE OR REPLACE FUNCTION crm.marcar_conversa_lida(p_conversa_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE crm.conversas SET nao_lidas_count = 0 WHERE id = p_conversa_id;
$$;

-- ============================================================
-- crm.atribuir_vendedor
-- ============================================================
CREATE OR REPLACE FUNCTION crm.atribuir_vendedor(
  p_conversa_id uuid,
  p_vendedor_id bigint
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE crm.conversas SET vendedor_id = p_vendedor_id WHERE id = p_conversa_id;
$$;

-- ============================================================
-- crm.mover_etapa_funil
-- ============================================================
CREATE OR REPLACE FUNCTION crm.mover_etapa_funil(
  p_conversa_id   uuid,
  p_etapa_para_id uuid,
  p_motivo        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_etapa_de uuid;
  v_user uuid := auth.uid();
BEGIN
  SELECT etapa_atual_id INTO v_etapa_de FROM crm.conversas WHERE id = p_conversa_id;

  INSERT INTO crm.funil_movimentos (conversa_id, etapa_de, etapa_para, motivo, movido_por)
  VALUES (p_conversa_id, v_etapa_de, p_etapa_para_id, p_motivo, v_user);

  UPDATE crm.conversas SET etapa_atual_id = p_etapa_para_id WHERE id = p_conversa_id;
END;
$$;

-- ============================================================
-- crm.user_eh_admin (helper pra RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION crm.user_eh_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin','superadmin') FROM alissonerp.usuarios WHERE id = p_user_id),
    false
  );
$$;

-- ============================================================
-- crm.user_vendedor_id (helper pra RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION crm.user_vendedor_id(p_user_id uuid DEFAULT auth.uid())
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT vendedor_id FROM alissonerp.usuarios WHERE id = p_user_id;
$$;

COMMIT;
