import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';

const router = Router();
const controller = new ChatController();

router.get('/conversas', (req, res) => controller.listarConversas(req, res));
router.get('/conversas/:id', (req, res) => controller.obterConversa(req, res));
router.post('/conversas', (req, res) => controller.iniciarConversa(req, res));
router.post('/conversas/:conversa_id/mensagens', (req, res) => controller.enviarMensagem(req, res));

export default router;
