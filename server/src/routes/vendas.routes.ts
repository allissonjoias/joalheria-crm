import { Router } from 'express';
import { VendasController } from '../controllers/vendas.controller';

const router = Router();
const controller = new VendasController();

router.get('/', (req, res) => controller.listar(req, res));
router.get('/:id', (req, res) => controller.obter(req, res));
router.post('/', (req, res) => controller.criar(req, res));
router.delete('/:id', (req, res) => controller.excluir(req, res));

export default router;
