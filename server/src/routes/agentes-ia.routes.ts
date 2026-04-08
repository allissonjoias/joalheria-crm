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

// ===== SKILLS =====
router.get('/:id/skills', adminOnly, (req, res) => controller.listarSkills(req, res));
router.post('/:id/skills', adminOnly, (req, res) => controller.criarSkill(req, res));
router.put('/:id/skills/reorder', adminOnly, (req, res) => controller.reordenarSkills(req, res));
router.put('/:id/skills/:skillId', adminOnly, (req, res) => controller.atualizarSkill(req, res));
router.delete('/:id/skills/:skillId', adminOnly, (req, res) => controller.excluirSkill(req, res));
router.post('/:id/skills/seed', adminOnly, (req, res) => controller.seedSkills(req, res));
router.get('/:id/skills/preview', adminOnly, (req, res) => controller.previewPrompt(req, res));
router.get('/skills/templates', adminOnly, (req, res) => controller.getSkillTemplates(req, res));

// ===== APRENDIZADO =====
router.get('/:id/learnings', adminOnly, (req, res) => controller.listarSugestoes(req, res));
router.post('/:id/learnings/:learningId/aprovar', adminOnly, (req, res) => controller.aprovarSugestao(req, res));
router.post('/:id/learnings/:learningId/rejeitar', adminOnly, (req, res) => controller.rejeitarSugestao(req, res));

// ===== RELATORIOS =====
router.get('/:id/reports', adminOnly, (req, res) => controller.listarRelatorios(req, res));
router.post('/:id/reports/gerar', adminOnly, (req, res) => controller.gerarRelatorio(req, res));

export default router;
