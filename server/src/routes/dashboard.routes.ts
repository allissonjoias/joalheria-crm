import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();
const controller = new DashboardController();

router.get('/resumo', (req, res) => controller.resumo(req, res));
router.get('/vendas-periodo', (req, res) => controller.vendasPorPeriodo(req, res));
router.get('/vendas-categoria', (req, res) => controller.vendasPorCategoria(req, res));
router.get('/top-produtos', (req, res) => controller.topProdutos(req, res));
router.get('/ranking-clientes', (req, res) => controller.rankingClientes(req, res));
router.get('/indicadores-clientes', (req, res) => controller.indicadoresClientes(req, res));

export default router;
