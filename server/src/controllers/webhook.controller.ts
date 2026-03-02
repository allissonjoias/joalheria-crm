import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { env } from '../config/env';
import { WebhookService } from '../services/webhook.service';
import { MensageriaService } from '../services/mensageria.service';
import { MetaService } from '../services/meta.service';

const webhookService = new WebhookService();
const mensageriaService = new MensageriaService();
const metaService = new MetaService();

export class WebhookController {
  // GET /api/webhook/meta - Webhook verification
  verificar(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check token against DB config or env fallback
    const verifyToken = env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook Meta verificado com sucesso');
      return res.status(200).send(challenge);
    }

    // Also check DB config
    metaService.getConfig().then(config => {
      if (config && token === config.webhook_verify_token) {
        return res.status(200).send(challenge);
      }
      console.warn('Webhook verification failed - token inválido');
      return res.status(403).send('Token inválido');
    }).catch(() => {
      res.status(403).send('Token inválido');
    });
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
        // Log webhook
        db.prepare(
          'INSERT INTO webhook_log (id, plataforma, payload) VALUES (?, ?, ?)'
        ).run(uuidv4(), 'instagram', JSON.stringify(body));

        const events = webhookService.parseInstagramPayload(body);
        for (const event of events) {
          try {
            if (event.type === 'instagram_dm') {
              await mensageriaService.processarInstagramDM(event);
            } else if (event.type === 'instagram_comment') {
              await mensageriaService.processarInstagramComment(event);
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
