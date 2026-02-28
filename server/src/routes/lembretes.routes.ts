import { Router } from 'express';
import { LembretesController } from '../controllers/lembretes.controller';

const router = Router();
const controller = new LembretesController();

router.get('/', (req, res) => controller.listar(req, res));
router.get('/pendentes', (req, res) => controller.pendentes(req, res));
router.post('/', (req, res) => controller.criar(req, res));
router.put('/:id', (req, res) => controller.atualizar(req, res));
router.delete('/:id', (req, res) => controller.excluir(req, res));

export default router;
