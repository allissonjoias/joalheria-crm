import { Router } from 'express';
import { ManyChatController } from '../controllers/manychat.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const controller = new ManyChatController();

// Publico (sem auth) - ManyChat envia webhooks aqui
router.post('/webhook', (req, res) => controller.receberWebhook(req, res));

// Protegido (auth necessario)
router.get('/config', authMiddleware, (req, res) => controller.obterConfig(req, res));
router.put('/config', authMiddleware, (req, res) => controller.salvarConfig(req, res));
router.get('/status', authMiddleware, (req, res) => controller.status(req, res));
router.post('/test', authMiddleware, (req, res) => controller.testarWebhook(req, res));

export default router;
