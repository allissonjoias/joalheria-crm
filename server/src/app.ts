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
import whatsappRoutes from './routes/whatsapp.routes';
import sdrAgentRoutes from './routes/sdr-agent.routes';
import apiKeysRoutes from './routes/api-keys.routes';
import agentesIaRoutes from './routes/agentes-ia.routes';
import funilRoutes from './routes/funil.routes';
import tarefasRoutes from './routes/tarefas.routes';
import pontoRoutes from './routes/ponto.routes';
import performanceRoutes from './routes/performance.routes';
import distribuicaoRoutes from './routes/distribuicao.routes';
import instagramRoutes from './routes/instagram.routes';
import metaApiRoutes from './routes/meta-api.routes';
import automacaoRoutes from './routes/automacao.routes';
import automacaoEtapasRoutes from './routes/automacao-etapas.routes';
import configGeralRoutes from './routes/config-geral.routes';
import brechasRoutes, { mercadoPagoWebhookRouter } from './routes/brechas.routes';
import unipileRoutes from './routes/unipile.routes';
import { UnipileController } from './controllers/unipile.controller';
import { WhatsAppController } from './controllers/whatsapp.controller';
import { EvolutionService } from './services/evolution.service';
import { sdrScheduler } from './services/sdr-scheduler.service';

const app = express();

app.use(cors());

// Capture raw body for webhook signature verification
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Servir arquivos de mídia (uploads)
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Paginas publicas (privacidade, termos, exclusao de dados - exigidas pela Meta)
app.use('/public', express.static(path.resolve(__dirname, '../../server/public')));
app.get('/privacidade', (_req, res) => res.sendFile(path.resolve(__dirname, '../../server/public/privacidade.html')));
app.get('/politica-privacidade', (_req, res) => res.sendFile(path.resolve(__dirname, '../../server/public/privacidade.html')));
app.get('/termos-servico', (_req, res) => res.sendFile(path.resolve(__dirname, '../../server/public/termos-servico.html')));
app.get('/exclusao-dados', (_req, res) => res.sendFile(path.resolve(__dirname, '../../server/public/exclusao-dados.html')));

// Endpoint de exclusao de dados (callback da Meta)
app.post('/api/meta/data-deletion', (req, res) => {
  const { signed_request } = req.body;
  console.log('[META] Solicitação de exclusão de dados recebida:', signed_request ? 'com signed_request' : 'sem signed_request');
  // Retornar confirmação conforme documentação da Meta
  const confirmationCode = `del_${Date.now()}`;
  res.json({
    url: `${req.protocol}://${req.get('host')}/exclusao-dados`,
    confirmation_code: confirmationCode,
  });
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);

// Webhook Evolution API (publico - sem auth)
const whatsappCtrl = new WhatsAppController();
app.post('/api/whatsapp/webhook/receive', (req, res) => whatsappCtrl.receberWebhook(req, res));

// Webhook Unipile (publico - sem auth)
// A Unipile envia Content-Type: application/x-www-form-urlencoded mas body em JSON
// usamos express.text para capturar bruto e parsear manualmente
const unipileCtrl = new UnipileController();
app.post(
  '/api/unipile/webhook',
  express.text({ type: '*/*', limit: '5mb' }),
  (req, res, next) => {
    if (typeof req.body === 'string' && req.body.length) {
      try { req.body = JSON.parse(req.body); } catch { /* deixa string */ }
    }
    next();
  },
  (req, res) => unipileCtrl.receberWebhook(req, res)
);

// Mercado Pago webhook (publico - sem auth)
app.use('/api/mercadopago', mercadoPagoWebhookRouter);

// Instagram OAuth callback (publico - redirect do Facebook)
app.use('/api/instagram', instagramRoutes);

// Rota alternativa de callback OAuth Instagram (para compatibilidade com Meta)
const instagramController = new (require('./controllers/instagram.controller').InstagramController)();
app.get('/api/auth/callback/instagram', (req: any, res: any) => instagramController.callback(req, res));

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
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);
app.use('/api/sdr-agent', authMiddleware, sdrAgentRoutes);
app.use('/api/api-keys', authMiddleware, apiKeysRoutes);
app.use('/api/agentes-ia', authMiddleware, agentesIaRoutes);
app.use('/api/funil', authMiddleware, funilRoutes);
app.use('/api/tarefas', authMiddleware, tarefasRoutes);
app.use('/api/ponto', authMiddleware, pontoRoutes);
app.use('/api/performance', authMiddleware, performanceRoutes);
app.use('/api/distribuicao', authMiddleware, distribuicaoRoutes);
app.use('/api/meta-api', authMiddleware, metaApiRoutes);
app.use('/api/automacao', authMiddleware, automacaoRoutes);
app.use('/api/automacao-etapas', authMiddleware, automacaoEtapasRoutes);
app.use('/api/config-geral', authMiddleware, configGeralRoutes);
app.use('/api/brechas', authMiddleware, brechasRoutes);
app.use('/api/unipile', authMiddleware, unipileRoutes);

// Em producao, servir o frontend buildado
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Em dev, redirecionar acessos diretos ao backend para o frontend Vite
  app.get('/', (req, res) => {
    const host = (req.headers.host || 'localhost:3001').split(':')[0];
    res.redirect(`http://${host}:5174/`);
  });
}

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
