import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

export function webhookSignature(req: Request, res: Response, next: NextFunction) {
  // Skip signature check if no app secret configured
  if (!env.META_APP_SECRET) {
    return next();
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    console.warn('Webhook recebido sem assinatura x-hub-signature-256');
    return res.status(401).json({ erro: 'Assinatura ausente' });
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    // If rawBody not available, skip check (fallback)
    return next();
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.warn('Webhook com assinatura inválida');
    return res.status(401).json({ erro: 'Assinatura inválida' });
  }

  next();
}
