import { Router } from 'express';
import { MensageriaController } from '../controllers/mensageria.controller';
import { upload } from '../middleware/upload';

const router = Router();
const controller = new MensageriaController();

router.get('/conversas', (req, res) => controller.listarConversas(req, res));
router.get('/conversas/:id', (req, res) => controller.obterConversa(req, res));
router.post('/conversas/:id/mensagens', (req, res) => controller.enviarMensagem(req, res));
router.post('/conversas/:id/midia', upload.single('arquivo'), (req, res) => controller.enviarMidia(req, res));
router.put('/conversas/:id/modo-auto', (req, res) => controller.toggleModoAuto(req, res));
router.put('/conversas/:id/atribuir', (req, res) => controller.atribuirVendedor(req, res));
router.get('/estatisticas', (req, res) => controller.estatisticas(req, res));

export default router;
