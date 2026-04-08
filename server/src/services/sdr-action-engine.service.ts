import { SdrPollingService } from './sdr-polling.service';
import { SdrEvento } from './sdr-event-detector.service';
import { getDb, saveDb } from '../config/database';
import { EvolutionService } from './evolution.service';
import { ClaudeService } from './claude.service';
import { agoraLocal } from '../utils/timezone';

export class SdrActionEngineService {
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
              await this.enviarPrimeiroContatoIA(evento);
              if (config.auto_criar_tasks) {
                await this.criarTarefaPrimeiroContato(evento, config.deadline_primeiro_contato);
              }
            }
            break;

          case 'lead_inativo':
            if (config.auto_followup && evento.leadId) {
              await this.criarTarefaFollowUp(evento, config.deadline_followup);
            }
            break;

          case 'venda_fechada':
            if (config.auto_mover_leads && evento.leadId) {
              await this.criarTarefaPosVenda(evento, config.deadline_pos_venda);
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
      const db = getDb();

      // 1. Verificar se ja foi contatado
      const jaContatado = db.prepare(
        "SELECT id FROM sdr_agent_log WHERE lead_id = ? AND tipo = 'novo_lead' AND acao_tomada LIKE '%WhatsApp enviado%'"
      ).get(evento.leadId);
      if (jaContatado) {
        console.log(`[SDR] Lead ${evento.leadId} ja foi contatado via WhatsApp, pulando.`);
        return;
      }

      // 2. Buscar telefone do deal localmente
      const deal = db.prepare(`
        SELECT p.*, c.telefone, c.nome as cliente_nome
        FROM pipeline p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE p.id = ?
      `).get(evento.leadId) as any;

      const telefone = deal?.telefone?.replace(/\D/g, '') || '';
      if (!telefone || telefone.length < 10) {
        console.log(`[SDR] Lead ${evento.leadId} sem telefone cadastrado.`);
        this.registrarAcao(evento, 'Sem telefone - contato nao enviado');
        return;
      }

      // 3. Gerar mensagem personalizada com IA (agente de agentes_ia)
      const nomeCliente = deal?.cliente_nome || evento.leadNome || 'cliente';
      let agenteNome = 'Agente IA';
      let promptAgente = '';
      try {
        let agente = db.prepare("SELECT nome, prompt_sistema FROM agentes_ia WHERE ativo = 1 AND area = 'sdr' LIMIT 1").get() as any;
        if (!agente) {
          agente = db.prepare("SELECT nome, prompt_sistema FROM agentes_ia WHERE ativo = 1 ORDER BY id ASC LIMIT 1").get() as any;
        }
        if (agente?.nome) agenteNome = agente.nome;
        if (agente?.prompt_sistema) promptAgente = agente.prompt_sistema;
      } catch { /* tabela pode nao existir */ }

      let prompt: string;
      if (promptAgente) {
        prompt = promptAgente + `\n\n[INSTRUCAO ATUAL]\nUm novo lead acabou de entrar com o nome "${nomeCliente}". Gere uma mensagem de primeiro contato para enviar pelo WhatsApp.\nCumprimente pelo nome. Faca UMA pergunta para entender o que busca. Max 3 paragrafos curtos.\nResponda APENAS com o texto da mensagem, sem JSON.`;
      } else {
        prompt = `Voce e uma consultora da Alisson Joias, joalheria premium especializada em ouro 18k.

Um novo lead acabou de entrar com o nome "${nomeCliente}". Gere uma mensagem de primeiro contato para enviar pelo WhatsApp.

REGRAS OBRIGATORIAS:
- Seja elegante, acolhedora e profissional
- Cumprimente pelo nome se disponivel
- Apresente-se como parte da equipe Alisson
- Demonstre disponibilidade para ajudar
- Faca UMA pergunta para entender o que o cliente busca (tipo de joia ou ocasiao)
- NUNCA use emojis
- NUNCA mencione que e uma IA
- Maximo 3 paragrafos curtos, adequados para WhatsApp
- Responda APENAS com o texto da mensagem, sem JSON, sem aspas, sem formatacao extra`;
      }

      const mensagem = await this.claude.gerarTexto(prompt, 200);

      // 4. Enviar via WhatsApp Baileys
      await this.whatsapp.enviarTexto(telefone, mensagem);
      console.log(`[SDR] Primeiro contato IA enviado para lead ${evento.leadId}`);

      // 5. Registrar interacao no CRM local
      if (deal?.cliente_id) {
        const { v4: uuidv4 } = require('uuid');
        db.prepare(
          `INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, 'whatsapp', ?)`
        ).run(uuidv4(), deal.cliente_id, `[${agenteNome} - IA] Primeiro contato automatico:\n${mensagem}`);
        saveDb();
      }

      this.registrarAcao(evento, `WhatsApp enviado para ***${telefone.slice(-4)}`);

    } catch (e) {
      console.error(`[SDR] Erro ao enviar primeiro contato IA para lead ${evento.leadId}:`, e);
      this.registrarAcao(evento, `Erro ao enviar WhatsApp: ${(e as any)?.message || e}`);
    }
  }

  private async criarTarefaPrimeiroContato(evento: SdrEvento, deadlineHoras: number): Promise<void> {
    if (!evento.leadId) return;

    try {
      const db = getDb();
      const d = new Date(Date.now() + deadlineHoras * 3600000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const vencimento = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      db.prepare(
        `INSERT INTO tarefas (pipeline_id, titulo, descricao, tipo, prioridade, data_vencimento)
         VALUES (?, ?, ?, 'primeiro_contato', 'alta', ?)`
      ).run(
        evento.leadId,
        `Primeiro contato - ${evento.leadNome || 'Lead'}`,
        `Fazer primeiro contato com o lead ${evento.leadNome || ''}`,
        vencimento
      );
      saveDb();

      this.registrarAcao(evento, `Tarefa "Primeiro contato" criada (deadline: ${deadlineHoras}h)`);
      console.log(`[SDR] Tarefa "Primeiro contato" criada para deal ${evento.leadId}`);
    } catch (e) {
      console.error(`[SDR] Erro ao criar tarefa primeiro contato:`, e);
    }
  }

  private async criarTarefaFollowUp(evento: SdrEvento, deadlineHoras: number): Promise<void> {
    if (!evento.leadId) return;

    try {
      const db = getDb();
      const d = new Date(Date.now() + deadlineHoras * 3600000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const vencimento = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      db.prepare(
        `INSERT INTO tarefas (pipeline_id, titulo, descricao, tipo, prioridade, data_vencimento)
         VALUES (?, ?, ?, 'followup', 'media', ?)`
      ).run(
        evento.leadId,
        `Follow-up - Lead inativo (${evento.leadNome || 'Lead'})`,
        `Lead detectado como inativo. Fazer follow-up.`,
        vencimento
      );
      saveDb();

      this.registrarAcao(evento, `Tarefa follow-up criada (deadline: ${deadlineHoras}h)`);
      console.log(`[SDR] Follow-up criado para lead inativo ${evento.leadId}`);
    } catch (e) {
      console.error(`[SDR] Erro ao criar follow-up:`, e);
    }
  }

  private async criarTarefaPosVenda(evento: SdrEvento, deadlineHoras: number): Promise<void> {
    if (!evento.leadId) return;

    try {
      const db = getDb();
      const d = new Date(Date.now() + deadlineHoras * 3600000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const vencimento = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      db.prepare(
        `INSERT INTO tarefas (pipeline_id, titulo, descricao, tipo, prioridade, data_vencimento)
         VALUES (?, ?, ?, 'pos_venda', 'media', ?)`
      ).run(
        evento.leadId,
        `Pos-venda - ${evento.leadNome || 'Lead'} (acompanhamento)`,
        `Venda fechada! Fazer acompanhamento pos-venda.`,
        vencimento
      );
      saveDb();

      this.registrarAcao(evento, `Tarefa pos-venda criada (deadline: ${deadlineHoras}h)`);
      console.log(`[SDR] Tarefa pos-venda criada para lead ${evento.leadId}`);
    } catch (e) {
      console.error(`[SDR] Erro ao criar tarefa pos-venda:`, e);
    }
  }

  private registrarAcao(evento: SdrEvento, acao: string): void {
    const db = getDb();
    const row = db.prepare(
      "SELECT id FROM sdr_agent_log WHERE lead_id = ? AND tipo = ? AND acao_tomada IS NULL ORDER BY criado_em DESC LIMIT 1"
    ).get(evento.leadId, evento.tipo) as any;
    if (row) {
      db.prepare("UPDATE sdr_agent_log SET acao_tomada = ? WHERE id = ?").run(acao, row.id);
      saveDb();
    }
  }
}
