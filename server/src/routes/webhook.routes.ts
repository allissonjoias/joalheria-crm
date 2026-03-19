import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { webhookSignature } from '../middleware/webhookSignature';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const controller = new WebhookController();

// Public routes (no auth) - Meta needs to access these
router.get('/meta', (req, res) => controller.verificar(req, res));
router.post('/meta', webhookSignature, (req, res) => controller.receber(req, res));

// Status e teste (protegido por auth)
router.get('/status', authMiddleware, (req, res) => controller.status(req, res));
router.post('/test/instagram-dm', authMiddleware, (req, res) => controller.testInstagramDM(req, res));
router.post('/test/instagram-comment', authMiddleware, (req, res) => controller.testInstagramComment(req, res));

export default router;
