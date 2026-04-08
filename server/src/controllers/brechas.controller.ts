import { Request, Response } from 'express';
import { brechasService } from '../services/brechas.service';

export class BrechasController {
  // Listar brechas abertas
  listar(req: Request, res: Response) {
    try {
      const tipo = req.query.tipo as string | undefined;
      const pipeline_id = req.query.pipeline_id as string | undefined;
      const brechas = brechasService.listarBrechas({ tipo, pipeline_id });
      res.json(brechas);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // Detectar brechas (scan manual)
  detectar(_req: Request, res: Response) {
    try {
      const resumo = brechasService.detectarBrechas();
      res.json(resumo);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // Resolver uma brecha
  resolver(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      brechasService.resolverBrecha(id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // ─── Mercado Pago ──────────────────────────────────────────────────

  // Webhook público do Mercado Pago
  async webhookMP(req: Request, res: Response) {
    // Responder 200 imediatamente (Mercado Pago exige resposta rápida)
    res.status(200).send('OK');

    try {
      const resultado = await brechasService.processarWebhookMP(req.body);
      console.log(`[MP Webhook] ${resultado.acao}`);
    } catch (e: any) {
      console.error('[MP Webhook] Erro:', e.message);
    }
  }

  // Obter config do Mercado Pago
  obterConfigMP(_req: Request, res: Response) {
    try {
      const config = brechasService.obterConfigMP();
      // Não retornar access_token completo por segurança
      if (config?.access_token) {
        config.access_token_masked = config.access_token.substring(0, 10) + '***';
        config.access_token_existe = true;
      }
      res.json(config || {});
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // Salvar config do Mercado Pago
  salvarConfigMP(req: Request, res: Response) {
    try {
      brechasService.salvarConfigMP(req.body);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }
}
