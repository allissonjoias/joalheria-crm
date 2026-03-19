import { Router } from 'express';
import { PontoController } from '../controllers/ponto.controller';
import { adminOnly } from '../middleware/auth';

const router = Router();
const controller = new PontoController();

router.get('/status', (req, res) => controller.status(req, res));
router.post('/bater', (req, res) => controller.bater(req, res));
router.get('/historico', (req, res) => controller.historico(req, res));
router.get('/equipe', (req, res) => controller.equipe(req, res));
router.get('/relatorio', adminOnly, (req, res) => controller.relatorio(req, res));

export default router;
