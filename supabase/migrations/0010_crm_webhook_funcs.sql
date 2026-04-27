-- =====================================================================
-- 0010 — Funções de ingestão de webhook (SECURITY DEFINER)
-- =====================================================================
-- Permite que a Next.js API chame com `anon` (sem service_role).
-- A função roda como o owner (postgres) e bypassa RLS internamente.
-- =====================================================================

BEGIN;

-- ============================================================
-- public.crm_processar_webhook_unipile
--   Recebe payload completo da Unipile, valida, dedupe, persiste.
--   Retorna jsonb com resultado.
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_processar_webhook_unipile(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm, pg_temp
AS $$
DECLARE
  v_event text := p_payload->>'event';
  v_account_id text := p_payload->>'account_id';
  v_account_type text := upper(coalesce(p_payload->>'account_type', ''));
  v_chat_id text := p_payload->>'chat_id';
  v_message_id text := coalesce(
    p_payload->>'message_id',
    p_payload->>'provider_message_id',
    'unipile-' || extract(epoch from now())::text
  );
  v_text text := coalesce(p_payload->>'message', p_payload->>'text', '');
  v_is_sender boolean := coalesce(
    nullif(p_payload->>'is_sender', '')::boolean,
    false
  );

  v_sender jsonb := p_payload->'sender';
  v_sender_provider_id text := coalesce(
    v_sender->>'attendee_provider_id',
    v_sender->>'attendee_id'
  );
  v_sender_username text := v_sender->'attendee_specifics'->>'public_identifier';
  v_sender_name text := coalesce(
    v_sender->>'attendee_name',
    v_sender_username,
    'Unipile:' || coalesce(v_sender_provider_id, '?')
  );

  v_attachment jsonb := (p_payload->'attachments')->0;
  v_att_type text := lower(coalesce(
    v_attachment->>'attachment_type',
    v_attachment->>'type',
    ''
  ));
  v_voice_note boolean := coalesce(
    nullif(v_attachment->>'voice_note', '')::boolean,
    false
  );
  v_tipo_midia text;
  v_midia_url text := coalesce(v_attachment->>'attachment_url', v_attachment->>'url');

  v_canal text;
  v_contato_id bigint;
  v_conversa_id uuid;
  v_msg_id uuid;
  v_log_id uuid;
  v_cfg_account_id text;
BEGIN
  -- 1) Loga sempre
  INSERT INTO crm.webhook_log (source, event, payload)
  VALUES ('unipile', v_event, p_payload)
  RETURNING id INTO v_log_id;

  -- 2) Filtros
  IF v_event !~* 'message_(received|created|new)|new_message' THEN
    UPDATE crm.webhook_log SET processado = true, processado_em = now(),
      resultado = jsonb_build_object('ignored', 'event_type')
    WHERE id = v_log_id;
    RETURN jsonb_build_object('ok', true, 'ignored', 'event', 'log_id', v_log_id);
  END IF;

  IF v_is_sender THEN
    UPDATE crm.webhook_log SET processado = true, processado_em = now(),
      resultado = jsonb_build_object('ignored', 'is_sender')
    WHERE id = v_log_id;
    RETURN jsonb_build_object('ok', true, 'ignored', 'is_sender', 'log_id', v_log_id);
  END IF;

  IF v_sender_provider_id IS NULL OR v_sender_provider_id = '' THEN
    UPDATE crm.webhook_log SET processado = true, processado_em = now(),
      resultado = jsonb_build_object('ignored', 'no_sender'), erro = 'sem sender_provider_id'
    WHERE id = v_log_id;
    RETURN jsonb_build_object('ok', true, 'ignored', 'no_sender', 'log_id', v_log_id);
  END IF;

  -- 3) Confere conta cadastrada (se houver)
  SELECT account_id INTO v_cfg_account_id
  FROM crm.unipile_config WHERE ativo ORDER BY created_at DESC LIMIT 1;

  IF v_cfg_account_id IS NOT NULL AND v_cfg_account_id <> ''
     AND v_account_id IS NOT NULL AND v_cfg_account_id <> v_account_id THEN
    UPDATE crm.webhook_log SET processado = true, processado_em = now(),
      resultado = jsonb_build_object('ignored', 'wrong_account')
    WHERE id = v_log_id;
    RETURN jsonb_build_object('ok', true, 'ignored', 'wrong_account', 'log_id', v_log_id);
  END IF;

  -- 4) Tipo de mídia
  v_tipo_midia := CASE
    WHEN v_voice_note THEN 'audio'
    WHEN v_att_type = 'image' THEN 'imagem'
    WHEN v_att_type = 'document' THEN 'documento'
    WHEN v_att_type IN ('audio','video','imagem','documento','sticker') THEN v_att_type
    ELSE NULL
  END;

  -- 5) Canal
  v_canal := CASE
    WHEN v_account_type = 'INSTAGRAM' THEN 'instagram_dm'
    WHEN v_account_type IN ('WHATSAPP','WHATSAPP_BUSINESS') THEN 'whatsapp'
    ELSE 'instagram_dm'
  END;

  -- 6) Cria contato
  v_contato_id := crm.buscar_ou_criar_contato_dm(
    v_canal, v_sender_provider_id, v_sender_name, v_sender_username
  );

  -- 7) Cria conversa
  v_conversa_id := crm.criar_conversa_se_necessario(
    v_canal,
    coalesce(v_chat_id, v_message_id),
    v_sender_provider_id,
    v_contato_id
  );

  -- 8) Adiciona mensagem (idempotente por canal_message_id)
  v_msg_id := crm.adicionar_mensagem(
    v_conversa_id, 'user', v_text, v_message_id,
    v_tipo_midia, v_midia_url, NULL, NULL,
    jsonb_build_object('sender', v_sender, 'attachment', v_attachment)
  );

  -- 9) Marca processado
  UPDATE crm.webhook_log SET
    processado = true, processado_em = now(),
    conversa_id = v_conversa_id, mensagem_id = v_msg_id,
    resultado = jsonb_build_object(
      'contato_id', v_contato_id,
      'conversa_id', v_conversa_id,
      'mensagem_id', v_msg_id
    )
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'ok', true,
    'log_id', v_log_id,
    'contato_id', v_contato_id,
    'conversa_id', v_conversa_id,
    'mensagem_id', v_msg_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Loga o erro mas não falha (webhook deve retornar 200 sempre)
  UPDATE crm.webhook_log SET
    erro = SQLERRM, processado = false
  WHERE id = v_log_id;
  RETURN jsonb_build_object(
    'ok', false,
    'erro', SQLERRM,
    'log_id', v_log_id
  );
END;
$$;

-- Permite anon e authenticated executarem
GRANT EXECUTE ON FUNCTION public.crm_processar_webhook_unipile(jsonb)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.crm_processar_webhook_unipile IS
  'Ingestão completa de webhook Unipile sem precisar de service_role. SECURITY DEFINER.';

COMMIT;
