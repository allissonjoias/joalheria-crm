import { Request, Response } from 'express';
import { unipileService, UnipileMessageWebhook } from '../services/unipile.service';
import { MensageriaService } from '../services/mensageria.service';
import { InstagramDMMessage } from '../services/webhook.service';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';

const mensageriaService = new MensageriaService();

function maskKey(k?: string): string {
  if (!k) return '';
  if (k.length <= 14) return '***';
  return k.substring(0, 8) + '...' + k.substring(k.length - 4);
}

export class UnipileController {
  // GET /api/unipile/config
  obterConfig(_req: Request, res: Response) {
    const cfg = unipileService.getConfig();
    if (!cfg) return res.json(null);
    res.json({
      ...cfg,
      api_key: maskKey(cfg.api_key),
    });
  }

  // POST /api/unipile/config
  salvarConfig(req: Request, res: Response) {
    try {
      const { api_key, dsn, account_id, account_username, account_provider } = req.body;
      const cfg = unipileService.saveConfig({
        api_key,
        dsn,
        account_id,
        account_username,
        account_provider,
      });
      res.json({ ok: true, config: { ...cfg, api_key: maskKey(cfg.api_key) } });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/unipile/testar
  async testar(_req: Request, res: Response) {
    const r = await unipileService.testarConexao();
    res.json(r);
  }

  // GET /api/unipile/contas
  async listarContas(_req: Request, res: Response) {
    try {
      const contas = await unipileService.listarContas();
      res.json({ ok: true, contas });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/unipile/webhook/registrar
  async registrarWebhook(req: Request, res: Response) {
    try {
      const { callback_url, source } = req.body;
      if (!callback_url) return res.status(400).json({ erro: 'callback_url obrigatorio' });
      const r = await unipileService.registrarWebhook(callback_url, source || 'messaging');
      res.json({ ok: true, webhook: r });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/unipile/webhook (publica - recebe Unipile)
  async receberWebhook(req: Request, res: Response) {
    // Responder rapido para a Unipile (ela espera ack < 5s)
    res.status(200).json({ ok: true });

    try {
      const db = getDb();
      const payload: UnipileMessageWebhook = req.body || {};

      // Log do webhook (auditoria)
      try {
        db.prepare(
          'INSERT INTO webhook_log (id, plataforma, payload) VALUES (?, ?, ?)'
        ).run(uuidv4(), 'unipile', JSON.stringify(payload));
      } catch {}

      const event = payload.event || '';
      // Eventos relevantes: message_received, message.created
      const isNewMessage = /message_(received|created|new)|new_message/i.test(event);
      if (!isNewMessage) {
        console.log(`[Unipile] Evento ignorado: ${event}`);
        return;
      }

      // Ignorar mensagens enviadas pela propria conta conectada
      if (payload.is_sender === true || payload.is_sender === 1) {
        console.log('[Unipile] Mensagem outbound (is_sender=true), ignorando');
        return;
      }

      const cfg = unipileService.getConfig();
      // Se webhook chegou de outra conta, ignorar
      if (cfg && payload.account_id && cfg.account_id && cfg.account_id !== payload.account_id) {
        console.log('[Unipile] Webhook de conta diferente, ignorando');
        return;
      }

      const accountType = (payload.account_type || cfg?.account_provider || '').toString().toUpperCase();
      const senderId = payload.sender?.attendee_provider_id || payload.sender?.attendee_id || '';
      const senderUsername = payload.sender?.attendee_specifics?.public_identifier;
      const senderName = payload.sender?.attendee_name || senderUsername || `Unipile:${senderId}`;
      // IMPORTANTE: NUNCA usar `subject` como conteúdo da mensagem — Unipile usa subject pro
      // nome do contato, não pra texto. Áudio/imagem sem texto deve manter conteúdo vazio.
      const text = payload.message || payload.text || '';
      const messageId = payload.message_id || payload.provider_message_id || `unipile-${Date.now()}`;
      const timestamp = payload.timestamp || new Date().toISOString();

      // Unipile usa nomes com underscore: attachment_type, attachment_url, attachment_id
      // (e .type/.url tb funcionam em alguns providers — aceita ambos)
      const att = (payload.attachments || [])[0] as any;
      const rawAttachType = att?.attachment_type || att?.type || '';
      const attachType = String(rawAttachType).toLowerCase();
      const isVoiceNote = !!att?.voice_note;
      // URL pode ser http (CDN) ou att:// (Unipile proprietary — precisa baixar via API)
      const attachUrlRaw = att?.attachment_url || att?.url || '';
      let attachUrl = attachUrlRaw;
      if (attachUrlRaw && attachUrlRaw.startsWith('att://') && att?.attachment_id) {
        // URL proprietária — baixa via API e salva localmente
        try {
          attachUrl = await unipileService.baixarAttachment(att.attachment_id, attachType || 'audio');
        } catch (e: any) {
          console.warn('[Unipile] falha baixar attachment:', e.message);
          attachUrl = '';
        }
      }
      const tipoNormalizado = isVoiceNote ? 'audio' : attachType;

      // Buscar foto de perfil via Unipile (nao bloqueia)
      let fotoPerfil: string | null = null;
      if (payload.chat_id && senderId) {
        try {
          fotoPerfil = await unipileService.buscarFotoSender(payload.chat_id, senderId);
        } catch {}
      }

      if (!senderId) {
        console.log('[Unipile] Webhook sem sender_id, ignorando');
        return;
      }

      // Persistir chat_id na conversa (necessario para responder via Unipile)
      const chatId = payload.chat_id || '';

      if (accountType === 'INSTAGRAM') {
        const event: InstagramDMMessage = {
          type: 'instagram_dm',
          messageId,
          senderId,
          recipientId: cfg?.account_id || '',
          timestamp,
          text,
          attachmentUrl: attachUrl || undefined,
          attachmentType: tipoNormalizado || undefined,
          senderName,
          senderUsername,
          senderProfilePicUrl: fotoPerfil || undefined,
        };
        await mensageriaService.processarInstagramDM(event);

        // Salvar chat_id na conversa para enviar respostas depois
        if (chatId) {
          try {
            db.prepare(
              `UPDATE conversas SET ultimo_canal_msg_id = ?
               WHERE meta_contato_id = ? AND canal = 'instagram_dm'`
            ).run(chatId, senderId);
          } catch {}
        }

        console.log(`[Unipile] Instagram DM recebido: sender=${senderName} (${senderId}) text="${text.substring(0, 50)}"`);
      } else {
        console.log(`[Unipile] Tipo de conta nao suportado ainda: ${accountType}`);
      }
    } catch (e: any) {
      console.error('[Unipile] Erro processando webhook:', e);
    }
  }
}
