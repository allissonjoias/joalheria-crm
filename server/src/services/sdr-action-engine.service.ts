import { KommoService } from './kommo.service';
import { SdrPollingService } from './sdr-polling.service';
import { SdrEvento } from './sdr-event-detector.service';
import { getDb } from '../config/database';

export class SdrActionEngineService {
  private kommo = new KommoService();
  private polling = new SdrPollingService();

  async processarEventos(eventos: SdrEvento[]): Promise<void> {
    const config = this.polling.getConfig();

    for (const evento of eventos) {
      try {
        switch (evento.tipo) {
          case 'novo_lead':
            if (config.auto_criar_tasks && evento.leadId) {
              await this.criarTaskPrimeiroContato(evento, config.deadline_primeiro_contato);
            }
            break;

          case 'lead_inativo':
            if (config.auto_followup && evento.leadId) {
              await this.criarFollowUp(evento, config.deadline_followup);
            }
            break;

          case 'venda_fechada':
            if (config.auto_mover_leads && evento.leadId) {
              await this.criarTaskPosVenda(evento, config.deadline_pos_venda);
            }
            break;
        }
      } catch (e) {
        console.error(`[SDR] Erro ao processar acao para evento ${evento.tipo}:`, e);
      }
    }
  }

  private async criarTaskPrimeiroContato(evento: SdrEvento, deadlineHoras: number): Promise<void> {
    if (!evento.leadId) return;

    try {
      await this.kommo.criarTask(
        evento.leadId,
        `Primeiro contato - ${evento.leadNome || 'Lead'}`,
        deadlineHoras
      );
      this.registrarAcao(evento, `Task "Primeiro contato" criada (deadline: ${deadlineHoras}h)`);
      console.log(`[SDR] Task "Primeiro contato" criada para lead ${evento.leadId}`);
    } catch (e) {
      console.error(`[SDR] Erro ao criar task primeiro contato:`, e);
    }
  }

  private async criarFollowUp(evento: SdrEvento, deadlineHoras: number): Promise<void> {
    if (!evento.leadId) return;

    try {
      await this.kommo.criarTask(
        evento.leadId,
        `Follow-up - Lead inativo (${evento.leadNome || 'Lead'})`,
        deadlineHoras
      );

      await this.kommo.adicionarNotaLead(
        evento.leadId,
        `[SDR Automatico] Lead detectado como inativo. Follow-up agendado.`
      );

      this.registrarAcao(evento, `Task follow-up criada + nota adicionada (deadline: ${deadlineHoras}h)`);
      console.log(`[SDR] Follow-up criado para lead inativo ${evento.leadId}`);
    } catch (e) {
      console.error(`[SDR] Erro ao criar follow-up:`, e);
    }
  }

  private async criarTaskPosVenda(evento: SdrEvento, deadlineHoras: number): Promise<void> {
    if (!evento.leadId) return;

    try {
      await this.kommo.criarTask(
        evento.leadId,
        `Pos-venda - ${evento.leadNome || 'Lead'} (acompanhamento)`,
        deadlineHoras
      );

      this.registrarAcao(evento, `Task pos-venda criada (deadline: ${deadlineHoras}h)`);
      console.log(`[SDR] Task pos-venda criada para lead ${evento.leadId}`);
    } catch (e) {
      console.error(`[SDR] Erro ao criar task pos-venda:`, e);
    }
  }

  private registrarAcao(evento: SdrEvento, acao: string): void {
    const db = getDb();
    db.prepare(
      "UPDATE sdr_agent_log SET acao_tomada = ? WHERE lead_id = ? AND tipo = ? AND acao_tomada IS NULL ORDER BY criado_em DESC LIMIT 1"
    ).run(acao, evento.leadId, evento.tipo);
  }
}
