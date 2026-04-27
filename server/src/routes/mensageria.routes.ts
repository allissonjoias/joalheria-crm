import { Router } from 'express';
import { MensageriaController } from '../controllers/mensageria.controller';
import { upload } from '../middleware/upload';

const router = Router();
const controller = new MensageriaController();

router.post('/sync-fotos', (req, res) => controller.syncFotosPerfil(req, res));
router.post('/sync-instagram-unipile', (req, res) => controller.sincronizarInstagramViaUnipile(req, res));
router.post('/sync-instagram-meta', (req, res) => controller.sincronizarInstagramViaMeta(req, res));
router.post('/backfill-ig-media-id', (req, res) => controller.backfillInstagramMediaId(req, res));
router.post('/mesclar-duplicadas', (req, res) => controller.mesclarConversasDuplicadas(req, res));
router.post('/cachear-midias-ig', (req, res) => controller.cachearMidiasInstagram(req, res));

router.get('/conversas', (req, res) => controller.listarConversas(req, res));
router.delete('/conversas', (req, res) => controller.excluirTodasConversas(req, res));
router.post('/conversas/interna', (req, res) => controller.criarConversaInterna(req, res));
router.get('/conversas/:id', (req, res) => controller.obterConversa(req, res));
router.delete('/conversas/:id', (req, res) => controller.excluirConversa(req, res));
router.delete('/conversas/:id/mensagens', (req, res) => controller.limparMensagens(req, res));
router.post('/conversas/:id/mensagens', (req, res) => controller.enviarMensagem(req, res));
router.post('/conversas/:id/midia', upload.single('arquivo'), (req, res) => controller.enviarMidia(req, res));
router.put('/conversas/:id/modo-auto', (req, res) => controller.toggleModoAuto(req, res));
router.put('/conversas/:id/atribuir', (req, res) => controller.atribuirVendedor(req, res));
router.post('/conversas/:id/scoring', (req, res) => controller.scoringAtendimento(req, res));
router.get('/estatisticas', (req, res) => controller.estatisticas(req, res));
router.get('/conversas/:id/sdr-info', (req, res) => controller.obterSdrInfo(req, res));
// backward compat alias
router.get('/conversas/:id/kommo-sdr', (req, res) => controller.obterSdrInfo(req, res));

export default router;
