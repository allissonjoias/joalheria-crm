import { Router } from 'express';
import { ProdutosController } from '../controllers/produtos.controller';

const router = Router();
const controller = new ProdutosController();

router.get('/', (req, res) => controller.listar(req, res));
router.get('/:id', (req, res) => controller.obter(req, res));
router.post('/', (req, res) => controller.criar(req, res));
router.put('/:id', (req, res) => controller.atualizar(req, res));
router.delete('/:id', (req, res) => controller.excluir(req, res));

export default router;
