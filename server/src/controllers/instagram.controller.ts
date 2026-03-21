import { Request, Response } from 'express';
import { InstagramService } from '../services/instagram.service';
import { env } from '../config/env';

const instagramService = new InstagramService();

export class InstagramController {
  // GET /api/instagram/auth-url
  authUrl(req: Request, res: Response) {
    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      return res.status(400).json({ erro: 'META_APP_ID e META_APP_SECRET não configurados no .env' });
    }

    const protocol = String(req.headers['x-forwarded-proto'] || req.protocol);
    const host = String(req.headers['x-forwarded-host'] || req.get('host'));
    const redirectUri = `${protocol}://${host}/api/auth/callback/instagram`;

    const url = instagramService.getAuthUrl(redirectUri);
    res.json({ url, redirect_uri: redirectUri });
  }

  // GET /api/instagram/callback (publico - redirect do Facebook)
  async callback(req: Request, res: Response) {
    const code = String(req.query.code || '');
    const error = String(req.query.error || '');
    const error_description = String(req.query.error_description || '');

    if (error) {
      const frontUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
      return res.redirect(`${frontUrl}/configuracoes?instagram_erro=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      return res.status(400).json({ erro: 'Código de autorização não recebido' });
    }

    try {
      const protocol = String(req.headers['x-forwarded-proto'] || req.protocol);
      const host = String(req.headers['x-forwarded-host'] || req.get('host'));
      const redirectUri = `${protocol}://${host}/api/auth/callback/instagram`;

      // 1. Trocar code por short-lived token
      const shortToken = await instagramService.trocarCodePorToken(code, redirectUri);

      // 2. Trocar por long-lived token
      const { token: longToken, expires_in } = await instagramService.obterLongLivedToken(shortToken);

      // 3. Descobrir paginas + contas Instagram
      const contas = await instagramService.descobrirContas(longToken);

      if (contas.length === 0) {
        const frontUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
        return res.redirect(`${frontUrl}/configuracoes?instagram_erro=${encodeURIComponent('Nenhuma página do Facebook encontrada. Verifique se sua conta tem páginas vinculadas.')}`);
      }

      // 4. Salvar todas as contas encontradas e inscrever páginas para webhooks
      let contasSalvas = 0;
      for (const conta of contas) {
        instagramService.salvarConta({ ...conta, expires_in });
        // Inscrever a página para receber webhooks (DMs, mensagens, etc.)
        await instagramService.inscreverPaginaWebhook(conta.page_id, conta.page_access_token);
        contasSalvas++;
      }

      const frontUrl2 = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
      res.redirect(`${frontUrl2}/configuracoes?instagram_ok=${contasSalvas}`);
    } catch (e: any) {
      console.error('Erro no callback Instagram OAuth:', e);
      const frontUrl3 = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
      res.redirect(`${frontUrl3}/configuracoes?instagram_erro=${encodeURIComponent(e.message)}`);
    }
  }

  // GET /api/instagram/contas
  listar(_req: Request, res: Response) {
    const contas = instagramService.listarContas().map(c => ({
      ...c,
      access_token: c.access_token
        ? c.access_token.substring(0, 8) + '...' + c.access_token.substring(c.access_token.length - 4)
        : '',
    }));
    res.json(contas);
  }

  // POST /api/instagram/contas/:id/testar
  async testar(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await instagramService.testarConta(id);
      // Também inscrever a página para webhooks ao testar
      const conta = instagramService.obterConta(id);
      if (conta?.page_id && conta?.access_token) {
        await instagramService.inscreverPaginaWebhook(conta.page_id, conta.access_token);
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/instagram/contas/:id/config
  obterConfig(req: Request, res: Response) {
    const id = req.params.id as string;
    const config = instagramService.obterConfigEventos(id);
    res.json(config);
  }

  // PUT /api/instagram/contas/:id/config
  atualizarConfig(req: Request, res: Response) {
    const id = req.params.id as string;
    const { receber_dm, receber_comentarios, receber_mencoes, responder_comentarios_auto, responder_mencoes_auto } = req.body;
    instagramService.atualizarConfig(id, {
      receber_dm,
      receber_comentarios,
      receber_mencoes,
      responder_comentarios_auto,
      responder_mencoes_auto,
    });
    res.json({ ok: true });
  }

  // PUT /api/instagram/contas/:id/toggle
  toggle(req: Request, res: Response) {
    const id = req.params.id as string;
    const { ativo } = req.body;
    instagramService.toggleConta(id, ativo);
    res.json({ ok: true });
  }

  // DELETE /api/instagram/contas/:id
  remover(req: Request, res: Response) {
    const id = req.params.id as string;
    instagramService.removerConta(id);
    res.json({ ok: true });
  }

  // POST /api/instagram/contas/:id/renovar-token
  async renovarToken(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await instagramService.renovarToken(id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }
}
