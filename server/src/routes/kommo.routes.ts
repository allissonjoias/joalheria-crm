import { Router } from 'express';
import { KommoController } from '../controllers/kommo.controller';
import { adminOnly } from '../middleware/auth';

const router = Router();
const controller = new KommoController();

// All routes require admin
router.use(adminOnly);

router.get('/config', (req, res) => controller.obterConfig(req, res));
router.post('/config', (req, res) => controller.salvarConfig(req, res));
router.get('/auth-url', (req, res) => controller.obterAuthUrl(req, res));
router.post('/callback', (req, res) => controller.callback(req, res));
router.post('/testar', (req, res) => controller.testar(req, res));
router.post('/importar', (req, res) => controller.importar(req, res));
router.get('/importar', (req, res) => controller.listarImports(req, res));
router.get('/importar/:id', (req, res) => controller.statusImport(req, res));
router.delete('/importar/:id', (req, res) => controller.cancelarImport(req, res));

export default router;
