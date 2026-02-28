import express from 'express';
import cors from 'cors';
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

const app = express();

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/clientes', authMiddleware, clientesRoutes);
app.use('/api/produtos', authMiddleware, produtosRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/pipeline', authMiddleware, pipelineRoutes);
app.use('/api/vendas', authMiddleware, vendasRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/lembretes', authMiddleware, lembretesRoutes);

// Error handler
app.use(errorHandler);

export default app;
