import express from 'express';
import cors from 'cors';
import path from 'path';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import clientesRoutes from './routes/clientes.routes';
import produtosRoutes from './routes/produtos.routes';
import chatRoutes from './routes/chat.routes';
import pipelineRoutes from './routes/pipeline.routes';
import vendasRoutes from './routes/vendas.routes';
import dashboardRoutes from './routes/dashboard.routes';
import lembretesRoutes from './routes/lembretes.routes';
import webhookRoutes from './routes/webhook.routes';
import mensageriaRoutes from './routes/mensageria.routes';
import metaConfigRoutes from './routes/meta-config.routes';
import kommoRoutes from './routes/kommo.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import sdrAgentRoutes from './routes/sdr-agent.routes';
import { WhatsAppController } from './controllers/whatsapp.controller';
import { EvolutionService } from './services/evolution.service';
import { sdrScheduler } from './services/sdr-scheduler.service';

const app = express();

app.use(cors());

// Capture raw body for webhook signature verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Servir arquivos de mídia (uploads)
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);

// Webhook Evolution API (publico - sem auth)
const whatsappCtrl = new WhatsAppController();
app.post('/api/whatsapp/webhook/receive', (req, res) => whatsappCtrl.receberWebhook(req, res));

// Protected routes
app.use('/api/clientes', authMiddleware, clientesRoutes);
app.use('/api/produtos', authMiddleware, produtosRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/pipeline', authMiddleware, pipelineRoutes);
app.use('/api/vendas', authMiddleware, vendasRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/lembretes', authMiddleware, lembretesRoutes);
app.use('/api/mensageria', authMiddleware, mensageriaRoutes);
app.use('/api/config', authMiddleware, metaConfigRoutes);
app.use('/api/kommo', authMiddleware, kommoRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);
app.use('/api/sdr-agent', authMiddleware, sdrAgentRoutes);

// Error handler
app.use(errorHandler);

// Auto-conectar WhatsApp se tiver credenciais salvas
setTimeout(() => {
  const whatsService = new EvolutionService();
  whatsService.autoConectar().catch(console.error);
}, 3000);

// Auto-iniciar agente SDR se estiver ativo
setTimeout(() => {
  sdrScheduler.autoIniciar();
}, 5000);

export default app;
