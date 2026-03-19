import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { MetaService } from '../services/meta.service';

const metaService = new MetaService();

export class MetaConfigController {
  // GET /api/config/meta
  obterConfig(req: Request, res: Response) {
    const db = getDb();
    const config = db.prepare(
      'SELECT * FROM meta_config WHERE ativo = 1 ORDER BY criado_em DESC LIMIT 1'
    ).get() as any;

    if (!config) {
      return res.json(null);
    }

    // Mask access token
    const masked = {
      ...config,
      access_token: config.access_token
        ? config.access_token.substring(0, 10) + '...' + config.access_token.substring(config.access_token.length - 5)
        : '',
    };

    res.json(masked);
  }

  // POST /api/config/meta
  salvarConfig(req: Request, res: Response) {
    try {
      const db = getDb();
      const {
        page_id,
        whatsapp_phone_number_id,
        instagram_business_account_id,
        access_token,
        webhook_verify_token,
      } = req.body;

      // Check if config already exists
      const existing = db.prepare(
        'SELECT id, access_token FROM meta_config WHERE ativo = 1 LIMIT 1'
      ).get() as any;

      if (existing) {
        // Update existing - only update access_token if provided (not masked)
        const tokenToSave = access_token && !access_token.includes('...')
          ? access_token
          : existing.access_token;

        db.prepare(
          `UPDATE meta_config SET
            page_id = ?, whatsapp_phone_number_id = ?,
            instagram_business_account_id = ?, access_token = ?,
            webhook_verify_token = ?, atualizado_em = datetime('now', 'localtime')
           WHERE id = ?`
        ).run(
          page_id, whatsapp_phone_number_id,
          instagram_business_account_id, tokenToSave,
          webhook_verify_token || 'alisson_joalheria_2026',
          existing.id
        );
      } else {
        // Create new
        db.prepare(
          `INSERT INTO meta_config (id, page_id, whatsapp_phone_number_id, instagram_business_account_id, access_token, webhook_verify_token)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          uuidv4(), page_id, whatsapp_phone_number_id,
          instagram_business_account_id, access_token,
          webhook_verify_token || 'alisson_joalheria_2026'
        );
      }

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  // POST /api/config/meta/testar
  async testarConexao(req: Request, res: Response) {
    try {
      const result = await metaService.testarConexao();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }
}
