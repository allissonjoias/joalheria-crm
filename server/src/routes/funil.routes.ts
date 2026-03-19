import { Router } from 'express';
import { FunilController } from '../controllers/funil.controller';

const router = Router();
const controller = new FunilController();

router.get('/funis', (req, res) => controller.listarFunis(req, res));
router.get('/estagios', (req, res) => controller.listarEstagios(req, res));
router.get('/motivos-perda', (req, res) => controller.listarMotivosPerda(req, res));
router.get('/origens-lead', (req, res) => controller.listarOrigensLead(req, res));
router.post('/estagios', (req, res) => controller.criarEstagio(req, res));
router.put('/estagios/reordenar', (req, res) => controller.reordenarEstagios(req, res));
router.put('/estagios/:id', (req, res) => controller.atualizarEstagio(req, res));
router.delete('/estagios/:id', (req, res) => controller.excluirEstagio(req, res));

export default router;
