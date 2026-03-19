import { Router } from 'express';
import { SdrAgentController } from '../controllers/sdr-agent.controller';
import { adminOnly } from '../middleware/auth';

const router = Router();
const controller = new SdrAgentController();

// Config
router.get('/config', adminOnly, (req, res) => controller.obterConfig(req, res));
router.post('/config', adminOnly, (req, res) => controller.salvarConfig(req, res));

// Controle do agente
router.post('/iniciar', adminOnly, (req, res) => controller.iniciar(req, res));
router.post('/parar', adminOnly, (req, res) => controller.parar(req, res));
router.get('/status', adminOnly, (req, res) => controller.obterStatus(req, res));

// Logs e stats
router.get('/logs', adminOnly, (req, res) => controller.obterLogs(req, res));
router.get('/logs/stats', adminOnly, (req, res) => controller.obterStats(req, res));

// Acoes manuais
router.post('/polling', adminOnly, (req, res) => controller.executarPolling(req, res));
router.post('/resumo', adminOnly, (req, res) => controller.enviarResumo(req, res));
router.post('/testar-notificacao', adminOnly, (req, res) => controller.testarNotificacao(req, res));
router.post('/simular', adminOnly, (req, res) => controller.simularConversa(req, res));
router.get('/prompt-dara', adminOnly, (req, res) => controller.obterPromptDara(req, res));
router.put('/prompt-dara', adminOnly, (req, res) => controller.salvarPromptDara(req, res));

// Qualificacao local
router.get('/qualificacao/estagios', adminOnly, (req, res) => controller.listarEstagiosFunil(req, res));
router.get('/qualificacao/leads', adminOnly, (req, res) => controller.listarLeadsQualificados(req, res));

export default router;
