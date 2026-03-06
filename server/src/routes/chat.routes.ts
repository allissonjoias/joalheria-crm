import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';

const router = Router();
const controller = new ChatController();

// Dara IA config
router.get('/config', (req, res) => controller.obterDaraConfig(req, res));
router.put('/config', (req, res) => controller.salvarDaraConfig(req, res));

// Consultar Dara (Q&A para consultoras)
router.post('/consultar', (req, res) => controller.consultarDara(req, res));

// Testar prompt (simula atendimento ao cliente)
router.post('/conversas/test-prompt', (req, res) => controller.testarPrompt(req, res));

// Conversas (atendimentos)
router.get('/conversas', (req, res) => controller.listarConversas(req, res));
router.get('/conversas/:id', (req, res) => controller.obterConversa(req, res));
router.post('/conversas', (req, res) => controller.iniciarConversa(req, res));
router.post('/conversas/:conversa_id/mensagens', (req, res) => controller.enviarMensagem(req, res));

export default router;
