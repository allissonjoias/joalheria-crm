import { Request, Response } from 'express';
import { EvolutionService } from '../services/evolution.service';
import { WhatsAppQueueService } from '../services/whatsapp-queue.service';

const evolutionService = new EvolutionService();
const queueService = new WhatsAppQueueService();

export class WhatsAppController {
  // --- Multi-instancia ---

  // GET /api/whatsapp/instancias
  listarInstancias(_req: Request, res: Response) {
    try {
      res.json(evolutionService.listarInstancias());
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/whatsapp/instancias
  criarNovaInstancia(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' });
      const inst = evolutionService.criarInstancia(nome);
      res.status(201).json(inst);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // DELETE /api/whatsapp/instancias/:id
  removerInstancia(req: Request, res: Response) {
    try {
      evolutionService.removerInstancia(req.params.id as string);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/whatsapp/instancias/:id/conectar
  async conectarInstancia(req: Request, res: Response) {
    try {
      const result = await evolutionService.conectar(req.params.id as string);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/whatsapp/instancias/:id/desconectar
  async desconectarInstancia(req: Request, res: Response) {
    try {
      await evolutionService.desconectar(req.params.id as string);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/whatsapp/instancias/:id/qrcode
  async obterQRCodeInstancia(req: Request, res: Response) {
    try {
      const result = await evolutionService.obterQRCode(req.params.id as string);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // GET /api/whatsapp/instancias/:id/status
  obterStatusInstancia(req: Request, res: Response) {
    try {
      res.json(evolutionService.obterStatusInstancia(req.params.id as string));
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // --- Compatibilidade (legacy) ---

  obterConfig(_req: Request, res: Response) {
    try {
      const instancias = evolutionService.listarInstancias();
      const conectada = instancias.find(i => i.status === 'conectado');
      res.json({
        status: conectada ? 'conectado' : 'desconectado',
        instancias: instancias.length,
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  salvarConfig(_req: Request, res: Response) {
    res.json({ ok: true });
  }

  async criarInstancia(_req: Request, res: Response) {
    try {
      const result = await evolutionService.criarInstanciaLegacy();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async obterQRCode(_req: Request, res: Response) {
    try {
      const result = await evolutionService.obterQRCode();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async obterStatus(_req: Request, res: Response) {
    try {
      const result = await evolutionService.obterStatus();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async desconectar(req: Request, res: Response) {
    try {
      const { instance_id } = req.body;
      if (instance_id) {
        await evolutionService.desconectar(instance_id);
      }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async configurarWebhook(req: Request, res: Response) {
    try {
      const result = await evolutionService.configurarWebhook(req.body.webhook_url || '');
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // --- Envio e campanhas ---

  async enviarMensagem(req: Request, res: Response) {
    try {
      const { cliente_id, telefone, texto, instance_id } = req.body;
      if (!telefone || !texto) {
        return res.status(400).json({ erro: 'telefone e texto sao obrigatorios' });
      }
      const result = await queueService.enviarMensagemDireta(
        cliente_id || 'manual',
        telefone,
        texto
      );
      if (!result.ok) {
        return res.status(400).json({ erro: result.erro });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterWarmup(_req: Request, res: Response) {
    try {
      res.json(queueService.getStatusWarmup());
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  criarCampanha(req: Request, res: Response) {
    try {
      const { nome, mensagem_template, cliente_ids } = req.body;
      if (!nome || !mensagem_template || !cliente_ids?.length) {
        return res.status(400).json({ erro: 'nome, mensagem_template e cliente_ids sao obrigatorios' });
      }
      const campanha = queueService.criarCampanha(nome, mensagem_template, cliente_ids);
      res.json(campanha);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  listarCampanhas(_req: Request, res: Response) {
    try {
      res.json(queueService.listarCampanhas());
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterCampanha(req: Request, res: Response) {
    try {
      const campanha = queueService.obterCampanha(req.params.id as string as string);
      if (!campanha) return res.status(404).json({ erro: 'Campanha nao encontrada' });
      res.json(campanha);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async iniciarCampanha(req: Request, res: Response) {
    try {
      queueService.iniciarCampanha(req.params.id as string as string);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  pausarCampanha(req: Request, res: Response) {
    try {
      queueService.pausarCampanha(req.params.id as string as string);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  cancelarCampanha(req: Request, res: Response) {
    try {
      queueService.cancelarCampanha(req.params.id as string as string);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async receberWebhook(req: Request, res: Response) {
    try {
      await queueService.processarWebhook(req.body);
      res.json({ ok: true });
    } catch (e: any) {
      console.error('Erro webhook WhatsApp:', e);
      res.json({ ok: true });
    }
  }
}
