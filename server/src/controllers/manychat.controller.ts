import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { manyChatService } from '../services/manychat.service';

export class ManyChatController {

  // POST /api/manychat/webhook - publico (sem auth)
  async receberWebhook(req: Request, res: Response) {
    // Responder 200 imediato (ManyChat precisa de resposta rapida)
    res.status(200).json({ status: 'ok' });

    const db = getDb();
    const logId = uuidv4();

    try {
      const config = manyChatService.obterConfig();

      // Verificar webhook_secret se configurado
      if (config.webhook_secret) {
        const secret = req.query.secret || req.headers['x-manychat-secret'] || req.headers['authorization'];
        if (secret !== config.webhook_secret && secret !== `Bearer ${config.webhook_secret}`) {
          console.warn('[ManyChat] Webhook recebido com secret invalido');
          db.prepare(
            'INSERT INTO webhook_log (id, plataforma, payload, erro) VALUES (?, ?, ?, ?)'
          ).run(logId, 'manychat', JSON.stringify(req.body), 'Secret invalido');
          return;
        }
      }

      // Verificar se integracao esta ativa
      if (!config.ativo) {
        console.log('[ManyChat] Webhook recebido mas integracao inativa');
        return;
      }

      // Logar webhook
      db.prepare(
        'INSERT INTO webhook_log (id, plataforma, payload) VALUES (?, ?, ?)'
      ).run(logId, 'manychat', JSON.stringify(req.body));

      // Processar payload
      const subscriber = manyChatService.parsePayload(req.body);
      const resultado = manyChatService.processarSubscriber(subscriber);

      // Marcar como processado
      db.prepare(
        'UPDATE webhook_log SET processado = 1 WHERE id = ?'
      ).run(logId);

      console.log(`[ManyChat] Webhook processado: ${resultado.criado ? 'novo lead' : 'atualizado'} - ${subscriber.name}`);
    } catch (e: any) {
      console.error('[ManyChat] Erro ao processar webhook:', e);
      try {
        db.prepare(
          'UPDATE webhook_log SET erro = ? WHERE id = ?'
        ).run(e.message, logId);
      } catch { /* ignore */ }
    }
  }

  // GET /api/manychat/config - protegido
  async obterConfig(_req: Request, res: Response) {
    try {
      const config = manyChatService.obterConfig();
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // PUT /api/manychat/config - protegido (admin)
  async salvarConfig(req: Request, res: Response) {
    try {
      const config = manyChatService.salvarConfig(req.body);
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/manychat/status - protegido
  async status(_req: Request, res: Response) {
    try {
      const status = manyChatService.obterStatus();
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/manychat/test - protegido (admin)
  async testarWebhook(req: Request, res: Response) {
    try {
      const subscriber = manyChatService.parsePayload(req.body);
      const resultado = manyChatService.processarSubscriber(subscriber);
      res.json({
        sucesso: true,
        ...resultado,
        subscriber: {
          name: subscriber.name,
          phone: subscriber.phone,
          email: subscriber.email,
          tags: subscriber.tags,
        },
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }
}
