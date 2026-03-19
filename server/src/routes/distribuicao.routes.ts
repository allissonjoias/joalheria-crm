import { Router } from 'express';
import { DistribuicaoController } from '../controllers/distribuicao.controller';
import { adminOnly } from '../middleware/auth';

const router = Router();
const controller = new DistribuicaoController();

router.get('/config', (req, res) => controller.obterConfig(req, res));
router.put('/config', adminOnly, (req, res) => controller.atualizarConfig(req, res));
router.put('/fila', adminOnly, (req, res) => controller.atualizarFila(req, res));
router.post('/distribuir', adminOnly, (req, res) => controller.distribuirManual(req, res));
router.get('/historico', (req, res) => controller.historico(req, res));

export default router;
