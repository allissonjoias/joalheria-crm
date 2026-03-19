import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();
const controller = new AuthController();

router.post('/login', (req, res) => controller.login(req, res));
router.post('/registrar', authMiddleware, adminOnly, (req, res) => controller.registrar(req, res));
router.get('/me', authMiddleware, (req, res) => controller.me(req, res));
router.put('/alterar-senha', authMiddleware, (req, res) => controller.alterarSenha(req, res));
router.get('/usuarios', authMiddleware, adminOnly, (req, res) => controller.listarUsuarios(req, res));
router.get('/equipe', authMiddleware, (req, res) => controller.listarEquipe(req, res));
router.put('/usuarios/:id', authMiddleware, adminOnly, (req, res) => controller.atualizarUsuario(req, res));

export default router;
