import { Router } from 'express';
import { automacaoEtapasController } from '../controllers/automacao-etapas.controller';

const router = Router();

router.get('/', (req, res) => automacaoEtapasController.listar(req, res));
router.post('/', (req, res) => automacaoEtapasController.criar(req, res));
router.put('/:id', (req, res) => automacaoEtapasController.atualizar(req, res));
router.delete('/:id', (req, res) => automacaoEtapasController.excluir(req, res));
router.get('/log', (req, res) => automacaoEtapasController.listarLog(req, res));
router.post('/ia', (req, res) => automacaoEtapasController.gerarComIA(req, res));

export default router;
