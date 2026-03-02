import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { adminOnly } from '../middleware/auth';

const router = Router();
const controller = new WhatsAppController();

// Multi-instancia (admin)
router.get('/instancias', (req, res) => controller.listarInstancias(req, res));
router.post('/instancias', adminOnly, (req, res) => controller.criarNovaInstancia(req, res));
router.delete('/instancias/:id', adminOnly, (req, res) => controller.removerInstancia(req, res));
router.post('/instancias/:id/conectar', adminOnly, (req, res) => controller.conectarInstancia(req, res));
router.post('/instancias/:id/desconectar', adminOnly, (req, res) => controller.desconectarInstancia(req, res));
router.get('/instancias/:id/qrcode', adminOnly, (req, res) => controller.obterQRCodeInstancia(req, res));
router.get('/instancias/:id/status', (req, res) => controller.obterStatusInstancia(req, res));

// Compatibilidade
router.get('/config', (req, res) => controller.obterConfig(req, res));
router.post('/config', adminOnly, (req, res) => controller.salvarConfig(req, res));
router.post('/instancia', adminOnly, (req, res) => controller.criarInstancia(req, res));
router.get('/qrcode', adminOnly, (req, res) => controller.obterQRCode(req, res));
router.get('/status', (req, res) => controller.obterStatus(req, res));
router.post('/desconectar', adminOnly, (req, res) => controller.desconectar(req, res));
router.post('/webhook/config', adminOnly, (req, res) => controller.configurarWebhook(req, res));

// Warmup
router.get('/warmup', (req, res) => controller.obterWarmup(req, res));

// Envio direto
router.post('/enviar', (req, res) => controller.enviarMensagem(req, res));

// Campanhas
router.post('/campanhas', adminOnly, (req, res) => controller.criarCampanha(req, res));
router.get('/campanhas', (req, res) => controller.listarCampanhas(req, res));
router.get('/campanhas/:id', (req, res) => controller.obterCampanha(req, res));
router.post('/campanhas/:id/iniciar', adminOnly, (req, res) => controller.iniciarCampanha(req, res));
router.post('/campanhas/:id/pausar', adminOnly, (req, res) => controller.pausarCampanha(req, res));
router.post('/campanhas/:id/cancelar', adminOnly, (req, res) => controller.cancelarCampanha(req, res));

export default router;
