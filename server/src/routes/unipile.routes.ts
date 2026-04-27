import { Router } from 'express';
import { UnipileController } from '../controllers/unipile.controller';

const router = Router();
const controller = new UnipileController();

router.get('/config', (req, res) => controller.obterConfig(req, res));
router.post('/config', (req, res) => controller.salvarConfig(req, res));
router.post('/testar', (req, res) => controller.testar(req, res));
router.get('/contas', (req, res) => controller.listarContas(req, res));
router.post('/webhook/registrar', (req, res) => controller.registrarWebhook(req, res));

export default router;
