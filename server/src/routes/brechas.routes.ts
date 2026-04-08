import { Router } from 'express';
import { BrechasController } from '../controllers/brechas.controller';

const router = Router();
const controller = new BrechasController();

// Brechas
router.get('/', (req, res) => controller.listar(req, res));
router.post('/detectar', (req, res) => controller.detectar(req, res));
router.put('/:id/resolver', (req, res) => controller.resolver(req, res));

// Mercado Pago config (protegido)
router.get('/mercadopago/config', (req, res) => controller.obterConfigMP(req, res));
router.put('/mercadopago/config', (req, res) => controller.salvarConfigMP(req, res));

export default router;

// Rota pública separada para webhook do Mercado Pago
export const mercadoPagoWebhookRouter = Router();
mercadoPagoWebhookRouter.post('/webhook', (req, res) => controller.webhookMP(req, res));
