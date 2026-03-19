import { Router } from 'express';
import { MetaApiController } from '../controllers/meta-api.controller';
import { adminOnly } from '../middleware/auth';

const router = Router();
const controller = new MetaApiController();

// Configuracao
router.get('/config', (req, res) => controller.obterConfig(req, res));
router.post('/config', adminOnly, (req, res) => controller.salvarConfig(req, res));
router.get('/verificar-token', adminOnly, (req, res) => controller.verificarToken(req, res));

// Numeros de telefone
router.get('/numeros', adminOnly, (req, res) => controller.listarNumeros(req, res));
router.post('/numeros/adicionar', adminOnly, (req, res) => controller.adicionarNumero(req, res));
router.post('/numeros/solicitar-codigo', adminOnly, (req, res) => controller.solicitarCodigo(req, res));
router.post('/numeros/verificar-codigo', adminOnly, (req, res) => controller.verificarCodigo(req, res));
router.post('/numeros/registrar', adminOnly, (req, res) => controller.registrarNumero(req, res));
router.post('/numeros/selecionar', adminOnly, (req, res) => controller.selecionarNumero(req, res));

// Templates
router.get('/templates', (req, res) => controller.listarTemplates(req, res));

// Envio direto
router.post('/enviar-texto', (req, res) => controller.enviarTexto(req, res));
router.post('/enviar-template', (req, res) => controller.enviarTemplate(req, res));

// Campanhas
router.post('/campanhas', adminOnly, (req, res) => controller.criarCampanha(req, res));
router.get('/campanhas', (req, res) => controller.listarCampanhas(req, res));
router.get('/campanhas/:id', (req, res) => controller.obterCampanha(req, res));
router.post('/campanhas/:id/iniciar', adminOnly, (req, res) => controller.iniciarCampanha(req, res));
router.post('/campanhas/:id/pausar', adminOnly, (req, res) => controller.pausarCampanha(req, res));
router.post('/campanhas/:id/cancelar', adminOnly, (req, res) => controller.cancelarCampanha(req, res));

export default router;
