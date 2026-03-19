import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { env } from '../config/env';
import { WebhookService } from '../services/webhook.service';
import { MensageriaService } from '../services/mensageria.service';
import { MetaService } from '../services/meta.service';
import { InstagramService } from '../services/instagram.service';

const webhookService = new WebhookService();
const mensageriaService = new MensageriaService();
const metaService = new MetaService();
const instagramService = new InstagramService();

export class WebhookController {
  // POST /api/webhook/test/instagram-dm - Simula DM do Instagram
  async testInstagramDM(req: Request, res: Response) {
    try {
      const {
        sender_id = 'test_user_' + Date.now(),
        sender_name = 'Teste Instagram',
        text = 'Oi! Vi suas joias no Instagram e amei! Tem aliança de ouro?',
        page_id,
      } = req.body;

      const msgId = 'mid_test_' + Date.now();
      const timestamp = Math.floor(Date.now() / 1000);

      // Montar payload idêntico ao que a Meta envia
      const payload = {
        object: 'instagram',
        entry: [{
          id: page_id || 'test_page_123',
          time: timestamp,
          messaging: [{
            sender: { id: sender_id },
            recipient: { id: page_id || 'test_page_123' },
            timestamp: timestamp * 1000,
            message: {
              mid: msgId,
              text,
            },
          }],
        }],
      };

      // Processar como se fosse um webhook real
      const db = getDb();
      const entryId = payload.entry[0].id;
      const conta = instagramService.obterContaPorPageId(entryId) || instagramService.obterContaPorIgUserId(entryId);

      db.prepare(
        'INSERT INTO webhook_log (id, plataforma, payload) VALUES (?, ?, ?)'
      ).run(uuidv4(), 'instagram_test', JSON.stringify(payload));

      const events = webhookService.parseInstagramPayload(payload);
      const resultados: any[] = [];

      for (const event of events) {
        if (event.type === 'instagram_dm') {
          await mensageriaService.processarInstagramDM(event, conta?.id);
          resultados.push({ tipo: 'instagram_dm', sender_id, text, processado: true });
        }
      }

      console.log(`[WEBHOOK TEST] Instagram DM simulado: sender=${sender_id}, text="${text.substring(0, 50)}"`);

      res.json({
        ok: true,
        mensagem: 'DM do Instagram simulado com sucesso',
        payload_enviado: payload,
        eventos_processados: resultados.length,
        detalhes: resultados,
        conta_instagram: conta ? { id: conta.id, username: conta.username, page_id: conta.page_id } : null,
      });
    } catch (e: any) {
      console.error('[WEBHOOK TEST] Erro ao simular DM:', e);
      res.status(500).json({ ok: false, erro: e.message });
    }
  }

  // POST /api/webhook/test/instagram-comment - Simula comentário do Instagram
  async testInstagramComment(req: Request, res: Response) {
    try {
      const {
        sender_id = 'test_commenter_' + Date.now(),
        sender_username = 'cliente_teste',
        text = 'Quanto custa essa aliança? 😍',
        media_id = 'media_test_' + Date.now(),
        page_id,
      } = req.body;

      const commentId = 'comment_test_' + Date.now();
      const timestamp = Math.floor(Date.now() / 1000);

      const payload = {
        object: 'instagram',
        entry: [{
          id: page_id || 'test_page_123',
          time: timestamp,
          changes: [{
            field: 'comments',
            value: {
              id: commentId,
              text,
              from: { id: sender_id, username: sender_username },
              media: { id: media_id },
            },
          }],
        }],
      };

      const db = getDb();
      const entryId = payload.entry[0].id;
      const conta = instagramService.obterContaPorPageId(entryId) || instagramService.obterContaPorIgUserId(entryId);

      db.prepare(
        'INSERT INTO webhook_log (id, plataforma, payload) VALUES (?, ?, ?)'
      ).run(uuidv4(), 'instagram_test', JSON.stringify(payload));

      const events = webhookService.parseInstagramPayload(payload);
      const resultados: any[] = [];

      for (const event of events) {
        if (event.type === 'instagram_comment') {
          await mensageriaService.processarInstagramComment(event, conta?.id);
          resultados.push({ tipo: 'instagram_comment', sender_username, text, processado: true });
        }
      }

      console.log(`[WEBHOOK TEST] Instagram Comment simulado: @${sender_username}: "${text.substring(0, 50)}"`);

      res.json({
        ok: true,
        mensagem: 'Comentário do Instagram simulado com sucesso',
        payload_enviado: payload,
        eventos_processados: resultados.length,
        detalhes: resultados,
        conta_instagram: conta ? { id: conta.id, username: conta.username, page_id: conta.page_id } : null,
      });
    } catch (e: any) {
      console.error('[WEBHOOK TEST] Erro ao simular comentário:', e);
      res.status(500).json({ ok: false, erro: e.message });
    }
  }

  // GET /api/webhook/status - Verifica status do webhook e contas Instagram
  async status(_req: Request, res: Response) {
    try {
      const db = getDb();

      // Contas Instagram ativas
      const contas = db.prepare(
        'SELECT id, nome, username, ig_user_id, page_id, ativo, token_expira_em FROM instagram_contas WHERE ativo = 1'
      ).all();

      // Últimos webhooks recebidos
      const ultimosWebhooks = db.prepare(
        "SELECT id, plataforma, processado, erro, criado_em FROM webhook_log ORDER BY criado_em DESC LIMIT 10"
      ).all();

      // Conversas por canal
      const conversasPorCanal = db.prepare(
        "SELECT canal, COUNT(*) as total FROM conversas WHERE ativa = 1 GROUP BY canal"
      ).all();

      // Meta config
      const metaConfig = await metaService.getConfig();

      res.json({
        webhook_url: '/api/webhook/meta',
        verify_token_configurado: !!env.META_WEBHOOK_VERIFY_TOKEN,
        meta_app_id_configurado: !!env.META_APP_ID,
        meta_app_secret_configurado: !!env.META_APP_SECRET,
        meta_config_db: metaConfig ? {
          page_id: metaConfig.page_id,
          instagram_business_account_id: metaConfig.instagram_business_account_id,
          tem_token: !!metaConfig.access_token,
        } : null,
        contas_instagram: contas,
        conversas_por_canal: conversasPorCanal,
        ultimos_webhooks: ultimosWebhooks,
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/webhook/meta - Webhook verification
  async verificar(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'] as string;

    console.log('[WEBHOOK] Verificação recebida:', { mode, token: token ? '***' : 'vazio', challenge: challenge ? 'presente' : 'ausente' });

    // Check token against env
    const verifyToken = env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WEBHOOK] Verificado com sucesso (env token)');
      return res.status(200).type('text/plain').send(challenge);
    }

    // Also check DB config
    try {
      const config = await metaService.getConfig();
      if (config && token === config.webhook_verify_token) {
        console.log('[WEBHOOK] Verificado com sucesso (db token)');
        return res.status(200).type('text/plain').send(challenge);
      }
    } catch { /* ignore */ }

    console.warn('[WEBHOOK] Verificação falhou - token inválido');
    return res.status(403).send('Token inválido');
  }

  // POST /api/webhook/meta - Receive events
  async receber(req: Request, res: Response) {
    // Respond 200 immediately (Meta requires fast response)
    res.status(200).json({ status: 'ok' });

    const body = req.body;
    const db = getDb();

    // Determine platform
    const object = body.object;

    try {
      if (object === 'whatsapp_business_account') {
        // Log webhook
        db.prepare(
          'INSERT INTO webhook_log (id, plataforma, payload) VALUES (?, ?, ?)'
        ).run(uuidv4(), 'whatsapp', JSON.stringify(body));

        const events = webhookService.parseWhatsAppPayload(body);
        for (const event of events) {
          try {
            if (event.type === 'whatsapp_message') {
              await mensageriaService.processarWhatsApp(event);
            } else if (event.type === 'whatsapp_status') {
              await mensageriaService.processarStatusWhatsApp(event);
            }
            // Mark as processed
            db.prepare(
              "UPDATE webhook_log SET processado = 1 WHERE payload LIKE ? AND processado = 0 ORDER BY criado_em DESC LIMIT 1"
            ).run(`%${body.entry?.[0]?.id || ''}%`);
          } catch (e: any) {
            console.error('Erro processando evento WhatsApp:', e);
            db.prepare(
              "UPDATE webhook_log SET erro = ? WHERE payload LIKE ? AND processado = 0 ORDER BY criado_em DESC LIMIT 1"
            ).run(e.message, `%${body.entry?.[0]?.id || ''}%`);
          }
        }
      } else if (object === 'instagram') {
        // Identificar qual conta Instagram recebeu o evento
        const entryId = body.entry?.[0]?.id;
        const conta = entryId ? instagramService.obterContaPorPageId(entryId) || instagramService.obterContaPorIgUserId(entryId) : null;

        // Log webhook
        db.prepare(
          'INSERT INTO webhook_log (id, plataforma, payload) VALUES (?, ?, ?)'
        ).run(uuidv4(), 'instagram', JSON.stringify(body));

        // Obter config de eventos da conta
        const igConfig = conta ? instagramService.obterConfigEventos(conta.id) : { receber_dm: 1, receber_comentarios: 1, receber_mencoes: 1 };

        const events = webhookService.parseInstagramPayload(body);
        for (const event of events) {
          try {
            if (event.type === 'instagram_dm' && igConfig.receber_dm) {
              await mensageriaService.processarInstagramDM(event, conta?.id);
            } else if (event.type === 'instagram_comment' && igConfig.receber_comentarios) {
              await mensageriaService.processarInstagramComment(event, conta?.id);
            } else if (event.type === 'instagram_mention' && igConfig.receber_mencoes) {
              // Registrar mencao como interacao
              const igDb = getDb();
              igDb.prepare(
                "INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, 'instagram', ?)"
              ).run(uuidv4(), null, `Mencao de @${(event as any).senderUsername}: ${(event as any).text?.substring(0, 200) || 'story/post'}`);
              console.log(`[INSTAGRAM] Mencao recebida de @${(event as any).senderUsername}`);
            }
          } catch (e: any) {
            console.error('Erro processando evento Instagram:', e);
          }
        }
      }
    } catch (e) {
      console.error('Erro geral ao processar webhook:', e);
    }
  }
}
