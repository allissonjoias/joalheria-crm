import { Request, Response } from 'express';
import { KommoService } from '../services/kommo.service';
import { KommoImportService } from '../services/kommo-import.service';

const kommoService = new KommoService();
const importService = new KommoImportService();

export class KommoController {
  // GET /api/kommo/config
  obterConfig(_req: Request, res: Response) {
    try {
      const config = kommoService.getConfig();
      if (!config) return res.json(null);

      res.json({
        ...config,
        access_token: config.access_token
          ? config.access_token.substring(0, 8) + '***'
          : '',
        refresh_token: config.refresh_token ? '***' : '',
        client_secret: config.client_secret
          ? config.client_secret.substring(0, 4) + '***'
          : '',
        conectado: !!config.access_token,
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/kommo/config
  salvarConfig(req: Request, res: Response) {
    try {
      const { client_id, client_secret, redirect_uri, subdomain } = req.body;
      if (!client_id || !client_secret) {
        return res.status(400).json({ erro: 'client_id e client_secret sao obrigatorios' });
      }

      kommoService.saveConfig({ client_id, client_secret, redirect_uri, subdomain });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/kommo/auth-url
  obterAuthUrl(_req: Request, res: Response) {
    try {
      const url = kommoService.getAuthUrl();
      res.json({ url });
    } catch (e: any) {
      res.status(400).json({ erro: e.message });
    }
  }

  // POST /api/kommo/callback
  async callback(req: Request, res: Response) {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ erro: 'Authorization code obrigatorio' });

      await kommoService.exchangeCode(code);
      res.json({ ok: true, mensagem: 'Tokens obtidos com sucesso' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/kommo/token
  salvarToken(req: Request, res: Response) {
    try {
      const { access_token, expires_at } = req.body;
      if (!access_token) return res.status(400).json({ erro: 'access_token obrigatorio' });

      kommoService.saveToken(access_token, expires_at);
      res.json({ ok: true, mensagem: 'Token salvo com sucesso' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/kommo/testar
  async testar(_req: Request, res: Response) {
    try {
      const resultado = await kommoService.testarConexao();
      res.json(resultado);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/kommo/importar
  importar(_req: Request, res: Response) {
    try {
      // Verificar se ja existe importacao rodando
      const existentes = importService.listarImports();
      const rodando = existentes.find(i => i.status === 'rodando' || i.status === 'pendente');
      if (rodando) {
        return res.status(400).json({ erro: 'Ja existe uma importacao em andamento. Aguarde ou cancele antes de iniciar outra.' });
      }

      const ids = importService.criarImportLogs();

      // Run import in background (don't await)
      importService.importarTudo(ids).catch(e => {
        console.error('Erro na importacao Kommo:', e);
      });

      res.json({
        ok: true,
        mensagem: 'Importacao iniciada',
        imports: ids,
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/kommo/importar/:id
  statusImport(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const log = importService.obterImport(id);
      if (!log) return res.status(404).json({ erro: 'Importacao nao encontrada' });
      res.json(log);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/kommo/importar
  listarImports(_req: Request, res: Response) {
    try {
      const imports = importService.listarImports();
      res.json(imports);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // DELETE /api/kommo/importar/:id
  cancelarImport(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const ok = importService.cancelar(id);
      if (!ok) return res.status(400).json({ erro: 'Importacao nao pode ser cancelada' });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }
}
