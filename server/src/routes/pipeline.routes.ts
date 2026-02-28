import { Router } from 'express';
import { PipelineController } from '../controllers/pipeline.controller';

const router = Router();
const controller = new PipelineController();

router.get('/', (req, res) => controller.listar(req, res));
router.post('/', (req, res) => controller.criar(req, res));
router.put('/:id', (req, res) => controller.atualizar(req, res));
router.delete('/:id', (req, res) => controller.excluir(req, res));

export default router;
