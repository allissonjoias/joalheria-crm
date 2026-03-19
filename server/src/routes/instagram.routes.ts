import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { InstagramController } from '../controllers/instagram.controller';

const router = Router();
const controller = new InstagramController();

// Publico - callback do OAuth do Facebook
router.get('/callback', (req, res) => controller.callback(req, res));

// Protegido - requer auth
router.get('/auth-url', authMiddleware, (req, res) => controller.authUrl(req, res));
router.get('/contas', authMiddleware, (req, res) => controller.listar(req, res));
router.post('/contas/:id/testar', authMiddleware, (req, res) => controller.testar(req, res));
router.get('/contas/:id/config', authMiddleware, (req, res) => controller.obterConfig(req, res));
router.put('/contas/:id/config', authMiddleware, adminOnly, (req, res) => controller.atualizarConfig(req, res));
router.put('/contas/:id/toggle', authMiddleware, adminOnly, (req, res) => controller.toggle(req, res));
router.delete('/contas/:id', authMiddleware, adminOnly, (req, res) => controller.remover(req, res));
router.post('/contas/:id/renovar-token', authMiddleware, adminOnly, (req, res) => controller.renovarToken(req, res));

export default router;
