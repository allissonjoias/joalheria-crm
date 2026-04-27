import { Router } from 'express';
import { PipelineController } from '../controllers/pipeline.controller';

const router = Router();
const controller = new PipelineController();

router.get('/', (req, res) => controller.listar(req, res));
router.get('/metricas', (req, res) => controller.metricas(req, res));
router.post('/', (req, res) => controller.criar(req, res));
router.put('/:id', (req, res) => controller.atualizar(req, res));
router.get('/:id/historico', (req, res) => controller.historico(req, res));
router.get('/:id/ciclo-vida', (req, res) => controller.cicloVida(req, res));
router.post('/:id/recompra', (req, res) => controller.criarRecompra(req, res));
router.delete('/:id', (req, res) => controller.excluir(req, res));

export default router;
