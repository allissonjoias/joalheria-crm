import { Router } from 'express';
import { TarefasController } from '../controllers/tarefas.controller';

const router = Router();
const controller = new TarefasController();

router.get('/', (req, res) => controller.listar(req, res));
router.get('/estatisticas', (req, res) => controller.estatisticas(req, res));
router.get('/:id', (req, res) => controller.obter(req, res));
router.post('/', (req, res) => controller.criar(req, res));
router.post('/from-mensagem', (req, res) => controller.criarDeMensagem(req, res));
router.put('/:id', (req, res) => controller.atualizar(req, res));
router.post('/:id/concluir', (req, res) => controller.concluir(req, res));
router.delete('/:id', (req, res) => controller.excluir(req, res));

export default router;
