import * as cron from 'node-cron';
import { SdrPollingService } from './sdr-polling.service';
import { SdrNotificationService } from './sdr-notification.service';
import { SdrActionEngineService } from './sdr-action-engine.service';

interface ScheduledJob {
  nome: string;
  task: cron.ScheduledTask;
}

export class SdrSchedulerService {
  private polling = new SdrPollingService();
  private notificacao = new SdrNotificationService();
  private acoes = new SdrActionEngineService();
  private jobs: ScheduledJob[] = [];
  private rodando = false;

  isRodando(): boolean {
    return this.rodando;
  }

  iniciar(): void {
    if (this.rodando) {
      console.log('[SDR] Scheduler ja esta rodando');
      return;
    }

    const config = this.polling.getConfig();

    // Job 1: Polling de leads (a cada N minutos)
    const intervaloCron = `*/${config.intervalo_polling} * * * *`;
    const pollingJob = cron.schedule(intervaloCron, async () => {
      try {
        console.log('[SDR] Executando polling agendado...');
        const eventos = await this.polling.executarPolling();
        if (eventos.length > 0) {
          await this.notificacao.notificarEventos(eventos);
          await this.acoes.processarEventos(eventos);
        }
      } catch (e) {
        console.error('[SDR] Erro no polling agendado:', e);
      }
    }, { timezone: 'America/Sao_Paulo' });

    this.jobs.push({ nome: 'polling', task: pollingJob });

    // Job 2: Resumo da manha
    if (config.cron_resumo_manha) {
      const manhaJob = cron.schedule(config.cron_resumo_manha, async () => {
        try {
          console.log('[SDR] Enviando resumo da manha...');
          await this.notificacao.enviarResumo('manha');
        } catch (e) {
          console.error('[SDR] Erro no resumo da manha:', e);
        }
      }, { timezone: 'America/Sao_Paulo' });

      this.jobs.push({ nome: 'resumo_manha', task: manhaJob });
    }

    // Job 3: Resumo da tarde
    if (config.cron_resumo_tarde) {
      const tardeJob = cron.schedule(config.cron_resumo_tarde, async () => {
        try {
          console.log('[SDR] Enviando resumo da tarde...');
          await this.notificacao.enviarResumo('tarde');
        } catch (e) {
          console.error('[SDR] Erro no resumo da tarde:', e);
        }
      }, { timezone: 'America/Sao_Paulo' });

      this.jobs.push({ nome: 'resumo_tarde', task: tardeJob });
    }

    // Job 4: Verificacao de inativos (a cada 1 hora)
    const inativosJob = cron.schedule('0 * * * *', async () => {
      try {
        console.log('[SDR] Verificando leads inativos...');
        const eventos = await this.polling.verificarInativos();
        if (eventos.length > 0) {
          await this.acoes.processarEventos(eventos);
        }
      } catch (e) {
        console.error('[SDR] Erro na verificacao de inativos:', e);
      }
    }, { timezone: 'America/Sao_Paulo' });

    this.jobs.push({ nome: 'inativos', task: inativosJob });

    this.rodando = true;
    console.log(`[SDR] Scheduler iniciado com ${this.jobs.length} jobs (polling a cada ${config.intervalo_polling}min)`);
  }

  parar(): void {
    for (const job of this.jobs) {
      job.task.stop();
    }
    this.jobs = [];
    this.rodando = false;
    console.log('[SDR] Scheduler parado');
  }

  reiniciar(): void {
    this.parar();
    this.iniciar();
  }

  autoIniciar(): void {
    try {
      const config = this.polling.getConfig();
      if (config.ativo) {
        console.log('[SDR] Auto-iniciando agente SDR...');
        this.iniciar();
      } else {
        console.log('[SDR] Agente SDR desativado, nao auto-iniciando');
      }
    } catch (e) {
      console.error('[SDR] Erro ao auto-iniciar:', e);
    }
  }

  obterStatus(): any {
    const config = this.polling.getConfig();
    return {
      rodando: this.rodando,
      ativo: !!config.ativo,
      jobs: this.jobs.map(j => j.nome),
      ultimo_polling: config.ultimo_polling,
      intervalo_polling: config.intervalo_polling,
      telefone_admin: config.telefone_admin ? '***' + config.telefone_admin.slice(-4) : null,
    };
  }
}

// Singleton para ser compartilhado entre controller e app.ts
export const sdrScheduler = new SdrSchedulerService();
