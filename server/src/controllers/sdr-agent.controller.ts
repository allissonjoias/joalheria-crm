import { Request, Response } from 'express';
import { SdrPollingService } from '../services/sdr-polling.service';
import { SdrNotificationService } from '../services/sdr-notification.service';
import { SdrActionEngineService } from '../services/sdr-action-engine.service';
import { sdrScheduler } from '../services/sdr-scheduler.service';

const polling = new SdrPollingService();
const notificacao = new SdrNotificationService();
const acoes = new SdrActionEngineService();

export class SdrAgentController {
  obterConfig(_req: Request, res: Response) {
    try {
      const config = polling.getConfig();
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  salvarConfig(req: Request, res: Response) {
    try {
      polling.salvarConfig(req.body);
      // Se mudou config e agente esta rodando, reiniciar
      if (sdrScheduler.isRodando()) {
        sdrScheduler.reiniciar();
      }
      res.json({ ok: true, mensagem: 'Configuracao salva' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  iniciar(_req: Request, res: Response) {
    try {
      const config = polling.getConfig();
      if (!config.telefone_admin) {
        return res.status(400).json({ erro: 'Configure o telefone do admin antes de iniciar' });
      }

      polling.salvarConfig({ ativo: 1 });
      sdrScheduler.iniciar();
      res.json({ ok: true, mensagem: 'Agente SDR iniciado' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  parar(_req: Request, res: Response) {
    try {
      polling.salvarConfig({ ativo: 0 });
      sdrScheduler.parar();
      res.json({ ok: true, mensagem: 'Agente SDR parado' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterStatus(_req: Request, res: Response) {
    try {
      const status = sdrScheduler.obterStatus();
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterLogs(req: Request, res: Response) {
    try {
      const { tipo, limite, offset } = req.query;
      const logs = polling.obterLogs({
        tipo: tipo as string | undefined,
        limite: limite ? parseInt(limite as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterStats(_req: Request, res: Response) {
    try {
      const stats = polling.obterStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async executarPolling(_req: Request, res: Response) {
    try {
      const eventos = await polling.executarPolling();
      if (eventos.length > 0) {
        await notificacao.notificarEventos(eventos);
        await acoes.processarEventos(eventos);
      }
      res.json({ ok: true, eventos_detectados: eventos.length, eventos });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async enviarResumo(req: Request, res: Response) {
    try {
      const tipo = (req.body.tipo as 'manha' | 'tarde') || 'manha';
      const msg = await notificacao.enviarResumo(tipo);
      res.json({ ok: true, mensagem: msg });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  async testarNotificacao(_req: Request, res: Response) {
    try {
      await notificacao.testarNotificacao();
      res.json({ ok: true, mensagem: 'Notificacao de teste enviada' });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }
}
