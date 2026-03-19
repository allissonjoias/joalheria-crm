import { Router } from 'express';
import { PerformanceController } from '../controllers/performance.controller';

const router = Router();
const controller = new PerformanceController();

router.get('/vendedoras', (req, res) => controller.vendedoras(req, res));
router.get('/tarefas-equipe', (req, res) => controller.tarefasEquipe(req, res));

export default router;
