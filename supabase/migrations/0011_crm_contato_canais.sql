-- =====================================================================
-- 0011 — Tabela crm.contato_canais (substitui uso de complementos_contatos)
-- =====================================================================
-- Mapeia: cliente do CRM → identidade dele em cada canal (IG, WA, etc).
-- Necessário porque public.complementos_contatos.contato_id_api referencia
-- public.contatos.id_api_contato (ID externo Tiny), não id_contato (PK).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS crm.contato_canais (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id      bigint NOT NULL REFERENCES public.contatos(id_contato) ON DELETE CASCADE,
  canal           text NOT NULL
                  CHECK (canal IN ('instagram_dm','instagram','whatsapp','telegram','email','outro')),
  canal_id        text NOT NULL,    -- IGSID / numero WhatsApp / etc
  username        text,             -- @username instagram, etc
  nome_canal      text,             -- nome de exibição no canal
  foto_url        text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal, canal_id)
);

CREATE INDEX IF NOT EXISTS idx_contato_canais_contato ON crm.contato_canais(contato_id);
CREATE INDEX IF NOT EXISTS idx_contato_canais_username ON crm.contato_canais(canal, lower(username))
  WHERE username IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON crm.contato_canais TO authenticated, service_role;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_contato_canais_updated ON crm.contato_canais;
CREATE TRIGGER trg_contato_canais_updated BEFORE UPDATE ON crm.contato_canais
  FOR EACH ROW EXECUTE FUNCTION crm.set_updated_at();

-- View pública
DROP VIEW IF EXISTS public.crm_contato_canais CASCADE;
CREATE VIEW public.crm_contato_canais
  WITH (security_invoker = true) AS
  SELECT * FROM crm.contato_canais;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contato_canais TO authenticated, service_role;

-- ============================================================
-- Reescreve crm.buscar_ou_criar_contato_dm pra usar contato_canais
-- ============================================================
CREATE OR REPLACE FUNCTION crm.buscar_ou_criar_contato_dm(
  p_canal           text,
  p_canal_id        text,
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
  -- 1) Procura por canal_id (mais preciso)
  SELECT contato_id INTO v_contato_id
  FROM crm.contato_canais
  WHERE canal = p_canal AND canal_id = p_canal_id
  LIMIT 1;
  IF v_contato_id IS NOT NULL THEN
    -- atualiza foto/nome se mudou
    UPDATE crm.contato_canais SET
      foto_url = COALESCE(p_foto_url, foto_url),
      nome_canal = COALESCE(p_nome, nome_canal),
      username = COALESCE(p_username, username)
    WHERE canal = p_canal AND canal_id = p_canal_id;
    RETURN v_contato_id;
  END IF;

  -- 2) Procura por username em outras conexoes (mesmo cliente, canal diferente)
  IF p_username IS NOT NULL AND length(p_username) > 0 THEN
    SELECT contato_id INTO v_contato_id
    FROM crm.contato_canais
    WHERE lower(username) = lower(p_username)
    LIMIT 1;
    IF v_contato_id IS NOT NULL THEN
      INSERT INTO crm.contato_canais (contato_id, canal, canal_id, username, nome_canal, foto_url)
      VALUES (v_contato_id, p_canal, p_canal_id, p_username, p_nome, p_foto_url)
      ON CONFLICT (canal, canal_id) DO NOTHING;
      RETURN v_contato_id;
    END IF;
  END IF;

  -- 3) Procura por nome normalizado em public.contatos
  IF length(v_nome_normalizado) > 3 THEN
    SELECT id_contato INTO v_contato_id
    FROM public.contatos
    WHERE crm.normalizar_nome(nome) = v_nome_normalizado
    LIMIT 1;
    IF v_contato_id IS NOT NULL THEN
      INSERT INTO crm.contato_canais (contato_id, canal, canal_id, username, nome_canal, foto_url)
      VALUES (v_contato_id, p_canal, p_canal_id, p_username, p_nome, p_foto_url)
      ON CONFLICT (canal, canal_id) DO NOTHING;
      RETURN v_contato_id;
    END IF;
  END IF;

  -- 4) Cria novo
  INSERT INTO public.contatos (id_contato, nome, telefone, data_atualizacao)
  VALUES (
    COALESCE((SELECT max(id_contato) FROM public.contatos), 0) + 1,
    p_nome, p_telefone, now()
  )
  RETURNING id_contato INTO v_contato_id;

  INSERT INTO crm.contato_canais (contato_id, canal, canal_id, username, nome_canal, foto_url)
  VALUES (v_contato_id, p_canal, p_canal_id, p_username, p_nome, p_foto_url);

  RETURN v_contato_id;
END;
$$;

-- ============================================================
-- Refaz crm_processar_webhook_unipile com BEGIN/EXCEPTION aninhado
-- (log persiste mesmo em erro)
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_processar_webhook_unipile(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, crm, pg_temp
AS $$
DECLARE
  v_log_id uuid;
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
  v_is_sender boolean := coalesce(nullif(p_payload->>'is_sender', '')::boolean, false);

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
  v_att_type text := lower(coalesce(v_attachment->>'attachment_type', v_attachment->>'type', ''));
  v_voice_note boolean := coalesce(nullif(v_attachment->>'voice_note', '')::boolean, false);
  v_tipo_midia text;
  v_midia_url text := coalesce(v_attachment->>'attachment_url', v_attachment->>'url');

  v_canal text;
  v_contato_id bigint;
  v_conversa_id uuid;
  v_msg_id uuid;
  v_cfg_account_id text;
BEGIN
  -- LOG (escopo principal — persiste sempre)
  INSERT INTO crm.webhook_log (source, event, payload)
  VALUES ('unipile', v_event, p_payload)
  RETURNING id INTO v_log_id;

  -- ============================================================
  -- BLOCO ANINHADO: processamento (em caso de erro, só ele é revertido)
  -- ============================================================
  BEGIN
    -- Filtros
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

    -- Confere conta cadastrada
    SELECT account_id INTO v_cfg_account_id
    FROM crm.unipile_config WHERE ativo ORDER BY created_at DESC LIMIT 1;

    IF v_cfg_account_id IS NOT NULL AND v_cfg_account_id <> ''
       AND v_account_id IS NOT NULL AND v_cfg_account_id <> v_account_id THEN
      UPDATE crm.webhook_log SET processado = true, processado_em = now(),
        resultado = jsonb_build_object('ignored', 'wrong_account')
      WHERE id = v_log_id;
      RETURN jsonb_build_object('ok', true, 'ignored', 'wrong_account', 'log_id', v_log_id);
    END IF;

    -- Tipo mídia + canal
    v_tipo_midia := CASE
      WHEN v_voice_note THEN 'audio'
      WHEN v_att_type = 'image' THEN 'imagem'
      WHEN v_att_type = 'document' THEN 'documento'
      WHEN v_att_type IN ('audio','video','imagem','documento','sticker') THEN v_att_type
      ELSE NULL
    END;

    v_canal := CASE
      WHEN v_account_type = 'INSTAGRAM' THEN 'instagram_dm'
      WHEN v_account_type IN ('WHATSAPP','WHATSAPP_BUSINESS') THEN 'whatsapp'
      ELSE 'instagram_dm'
    END;

    -- Cria contato + conversa + mensagem
    v_contato_id := crm.buscar_ou_criar_contato_dm(
      v_canal, v_sender_provider_id, v_sender_name, v_sender_username
    );

    v_conversa_id := crm.criar_conversa_se_necessario(
      v_canal,
      coalesce(v_chat_id, v_message_id),
      v_sender_provider_id,
      v_contato_id
    );

    v_msg_id := crm.adicionar_mensagem(
      v_conversa_id, 'user', v_text, v_message_id,
      v_tipo_midia, v_midia_url, NULL, NULL,
      jsonb_build_object('sender', v_sender, 'attachment', v_attachment)
    );

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
    -- Erro no bloco de processamento — log permanece
    UPDATE crm.webhook_log SET
      erro = SQLERRM,
      processado = false,
      resultado = jsonb_build_object('exception', SQLERRM, 'state', SQLSTATE)
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'ok', false,
      'erro', SQLERRM,
      'log_id', v_log_id
    );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_processar_webhook_unipile(jsonb)
  TO anon, authenticated, service_role;

COMMIT;
