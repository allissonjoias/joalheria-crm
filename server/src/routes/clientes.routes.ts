import { Router } from 'express';
import { ClientesController } from '../controllers/clientes.controller';

const router = Router();
const controller = new ClientesController();

router.get('/', (req, res) => controller.listar(req, res));
router.get('/:id', (req, res) => controller.obter(req, res));
router.post('/', (req, res) => controller.criar(req, res));
router.put('/:id', (req, res) => controller.atualizar(req, res));
router.delete('/:id', (req, res) => controller.excluir(req, res));
router.get('/:id/interacoes', (req, res) => controller.interacoes(req, res));
router.post('/:id/interacoes', (req, res) => controller.adicionarInteracao(req, res));

export default router;
