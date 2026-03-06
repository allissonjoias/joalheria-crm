import { Router } from 'express';
import { AgentesIaController } from '../controllers/agentes-ia.controller';
import { adminOnly } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
const controller = new AgentesIaController();

// CRUD de agentes
router.get('/', adminOnly, (req, res) => controller.listar(req, res));
router.get('/:id', adminOnly, (req, res) => controller.obter(req, res));
router.post('/', adminOnly, (req, res) => controller.criar(req, res));
router.put('/:id', adminOnly, (req, res) => controller.atualizar(req, res));
router.delete('/:id', adminOnly, (req, res) => controller.excluir(req, res));

// Upload de foto
router.post('/:id/foto', adminOnly, (req, res) => controller.uploadFoto(req, res));

// Simular conversa com agente
router.post('/:id/simular', adminOnly, (req, res) => controller.simular(req, res));

// Analisar prompt (detectar erros, incoerencias, duplicatas)
router.post('/:id/analisar-prompt', adminOnly, (req, res) => controller.analisarPrompt(req, res));

// Melhorar prompt com IA (retorna plano sem salvar)
router.post('/:id/melhorar-prompt', adminOnly, (req, res) => controller.melhorarPrompt(req, res));

// Aplicar melhoria aprovada (salva o prompt)
router.post('/:id/aplicar-melhoria', adminOnly, (req, res) => controller.aplicarMelhoria(req, res));

// Upload de midia para simulador
router.post('/:id/upload-midia', adminOnly, upload.single('arquivo'), (req, res) => controller.uploadMidia(req, res));

export default router;
