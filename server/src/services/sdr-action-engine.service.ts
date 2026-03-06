import { KommoService } from './kommo.service';
import { SdrPollingService } from './sdr-polling.service';
import { SdrEvento } from './sdr-event-detector.service';
import { getDb } from '../config/database';
import { EvolutionService } from './evolution.service';
import { ClaudeService } from './claude.service';

export class SdrActionEngineService {
  private kommo = new KommoService();
  private polling = new SdrPollingService();
  private whatsapp = new EvolutionService();
  private claude = new ClaudeService();

  async processarEventos(eventos: SdrEvento[]): Promise<void> {
    const config = this.polling.getConfig();

    for (const evento of eventos) {
      try {
        switch (evento.tipo) {
          case 'novo_lead':
            if (evento.leadId) {
              // Envia mensagem imediata via IA (Dara) pelo WhatsApp
              await this.enviarPrimeiroContatoIA(evento);
              // Também cria task no Kommo para rastreamento
              if (config.auto_criar_tasks) {
                await this.criarTaskPrimeiroContato(evento, config.deadline_primeiro_contato);
              }
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

  private async enviarPrimeiroContatoIA(evento: SdrEvento): Promise<void> {
    if (!evento.leadId) return;

    try {
      // 1. Verificar se já foi contatado (evitar duplicatas)
      const db = getDb();
      const jaContatado = db.prepare(
        "SELECT id FROM sdr_agent_log WHERE lead_id = ? AND tipo = 'novo_lead' AND acao_tomada LIKE '%WhatsApp enviado%'"
      ).get(evento.leadId);
      if (jaContatado) {
        console.log(`[SDR] Lead ${evento.leadId} ja foi contatado via WhatsApp, pulando.`);
        return;
      }

      // 2. Buscar telefone do lead no Kommo
      const telefone = await this.kommo.buscarTelefoneDoLead(evento.leadId);
      if (!telefone) {
        console.log(`[SDR] Lead ${evento.leadId} sem telefone cadastrado no Kommo.`);
        this.registrarAcao(evento, 'Sem telefone no Kommo - contato nao enviado');
        return;
      }

      // 3. Gerar mensagem personalizada com Claude (Dara)
      const nomeCliente = evento.leadNome || 'cliente';
      const prompt = `Voce e Dara, consultora da Alisson Joias, joalheria premium especializada em ouro 18k.

Um novo lead acabou de entrar com o nome "${nomeCliente}". Gere uma mensagem de primeiro contato para enviar pelo WhatsApp.

REGRAS OBRIGATORIAS:
- Seja elegante, acolhedora e profissional
- Cumprimente pelo nome se disponivel
- Apresente-se como Dara, da equipe Alisson
- Demonstre disponibilidade para ajudar
- Faça UMA pergunta para entender o que o cliente busca (tipo de joia ou ocasiao)
- NUNCA use emojis
- NUNCA mencione que e uma IA
- Maximo 3 paragrafos curtos, adequados para WhatsApp
- Responda APENAS com o texto da mensagem, sem JSON, sem aspas, sem formatacao extra`;

      const mensagem = await this.claude.gerarTexto(prompt, 200);

      // 4. Enviar via WhatsApp Baileys
      await this.whatsapp.enviarTexto(telefone, mensagem);
      console.log(`[SDR] Primeiro contato IA enviado para lead ${evento.leadId} (${telefone.slice(-4).padStart(telefone.length, '*')})`);

      // 5. Registrar nota no Kommo
      await this.kommo.adicionarNotaLead(
        evento.leadId,
        `[Dara - IA] Primeiro contato enviado automaticamente via WhatsApp.\n\nMensagem enviada:\n"${mensagem}"`
      );

      // 6. Mover para "Primeiro contato" no Funil de Vendas
      await this.kommo.moverLead(evento.leadId, 56202403, 6641943);

      this.registrarAcao(evento, `WhatsApp enviado para ${telefone.slice(-4).padStart(8, '*')} + nota no Kommo + lead movido para "Primeiro contato"`);

    } catch (e) {
      console.error(`[SDR] Erro ao enviar primeiro contato IA para lead ${evento.leadId}:`, e);
      this.registrarAcao(evento, `Erro ao enviar WhatsApp: ${(e as any)?.message || e}`);
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
    const row = db.prepare(
      "SELECT id FROM sdr_agent_log WHERE lead_id = ? AND tipo = ? AND acao_tomada IS NULL ORDER BY criado_em DESC LIMIT 1"
    ).get(evento.leadId, evento.tipo) as any;
    if (row) {
      db.prepare("UPDATE sdr_agent_log SET acao_tomada = ? WHERE id = ?").run(acao, row.id);
    }
  }
}
