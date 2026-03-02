import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { webhookSignature } from '../middleware/webhookSignature';

const router = Router();
const controller = new WebhookController();

// Public routes (no auth) - Meta needs to access these
router.get('/meta', (req, res) => controller.verificar(req, res));
router.post('/meta', webhookSignature, (req, res) => controller.receber(req, res));

export default router;
