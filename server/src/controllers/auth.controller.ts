import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export class AuthController {
  login(req: Request, res: Response) {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha sao obrigatorios' });
      }
      const resultado = authService.login(email, senha);
      res.json(resultado);
    } catch (error: any) {
      res.status(401).json({ erro: error.message });
    }
  }

  registrar(req: Request, res: Response) {
    try {
      const { nome, email, senha, papel } = req.body;
      if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Nome, email e senha sao obrigatorios' });
      }
      const usuario = authService.registrar(nome, email, senha, papel);
      res.status(201).json(usuario);
    } catch (error: any) {
      res.status(400).json({ erro: error.message });
    }
  }

  me(req: Request, res: Response) {
    res.json(req.usuario);
  }

  listarUsuarios(req: Request, res: Response) {
    try {
      const usuarios = authService.listarUsuarios();
      res.json(usuarios);
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  atualizarUsuario(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      authService.atualizarUsuario(id, req.body);
      res.json({ sucesso: true });
    } catch (error: any) {
      res.status(400).json({ erro: error.message });
    }
  }

  listarEquipe(req: Request, res: Response) {
    try {
      const usuarios = authService.listarUsuarios();
      // Retorna apenas id, nome e papel (sem dados sensíveis)
      const equipe = usuarios.map((u: any) => ({
        id: u.id,
        nome: u.nome,
        papel: u.papel,
      }));
      res.json(equipe);
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  alterarSenha(req: Request, res: Response) {
    try {
      const { senha_atual, nova_senha } = req.body;
      if (!senha_atual || !nova_senha) {
        return res.status(400).json({ erro: 'Senha atual e nova senha sao obrigatorias' });
      }
      if (nova_senha.length < 6) {
        return res.status(400).json({ erro: 'Nova senha deve ter pelo menos 6 caracteres' });
      }
      authService.alterarSenha(req.usuario!.id, senha_atual, nova_senha);
      res.json({ sucesso: true });
    } catch (error: any) {
      res.status(400).json({ erro: error.message });
    }
  }
}
