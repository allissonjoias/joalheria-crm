import { Router } from 'express';
import { AutomacaoController } from '../controllers/automacao.controller';
import { adminOnly } from '../middleware/auth';

const router = Router();
const controller = new AutomacaoController();

// Fluxos
router.get('/fluxos', (req, res) => controller.listarFluxos(req, res));
router.get('/fluxos/:id', (req, res) => controller.obterFluxo(req, res));
router.post('/fluxos', adminOnly, (req, res) => controller.criarFluxo(req, res));
router.put('/fluxos/:id', adminOnly, (req, res) => controller.atualizarFluxo(req, res));
router.delete('/fluxos/:id', adminOnly, (req, res) => controller.excluirFluxo(req, res));
router.post('/fluxos/:id/toggle', adminOnly, (req, res) => controller.toggleFluxo(req, res));
router.get('/fluxos/:id/stats', (req, res) => controller.estatisticasFluxo(req, res));

// Templates
router.get('/templates', (req, res) => controller.listarTemplates(req, res));
router.post('/templates', adminOnly, (req, res) => controller.criarTemplate(req, res));
router.put('/templates/:id', adminOnly, (req, res) => controller.atualizarTemplate(req, res));
router.delete('/templates/:id', adminOnly, (req, res) => controller.excluirTemplate(req, res));

// Campanhas
router.get('/campanhas', (req, res) => controller.listarCampanhas(req, res));
router.post('/campanhas', adminOnly, (req, res) => controller.criarCampanha(req, res));
router.post('/campanhas/preview-segmento', adminOnly, (req, res) => controller.previewSegmento(req, res));

export default router;
