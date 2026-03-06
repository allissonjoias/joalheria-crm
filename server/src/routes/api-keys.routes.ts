import { Router } from 'express';
import { adminOnly } from '../middleware/auth';
import { ApiKeysController } from '../controllers/api-keys.controller';

const router = Router();
const controller = new ApiKeysController();

router.get('/', (req, res) => controller.obterKeys(req, res));
router.put('/:provider/selecionar', adminOnly, (req, res) => controller.selecionarProvider(req, res));
router.put('/:provider', adminOnly, (req, res) => controller.salvarKey(req, res));
router.post('/:provider/testar', adminOnly, (req, res) => controller.testarKey(req, res));

export default router;
