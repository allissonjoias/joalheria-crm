import { Router } from 'express';
import { adminOnly } from '../middleware/auth';
import { MetaConfigController } from '../controllers/meta-config.controller';

const router = Router();
const controller = new MetaConfigController();

router.get('/meta', (req, res) => controller.obterConfig(req, res));
router.post('/meta', adminOnly, (req, res) => controller.salvarConfig(req, res));
router.post('/meta/testar', adminOnly, (req, res) => controller.testarConexao(req, res));

export default router;
