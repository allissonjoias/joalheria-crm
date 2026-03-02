import { EvolutionService } from './evolution.service';
import { SdrEvento } from './sdr-event-detector.service';
import { SdrPollingService } from './sdr-polling.service';
import { getDb } from '../config/database';
import { env } from '../config/env';
import Anthropic from '@anthropic-ai/sdk';
import { getResumoManhaPrompt, getResumoTardePrompt } from '../utils/sdr-prompt';

export class SdrNotificationService {
  private whatsapp = new EvolutionService();
  private polling = new SdrPollingService();

  private getTelefoneAdmin(): string {
    const config = this.polling.getConfig();
    if (!config.telefone_admin) throw new Error('Telefone do admin nao configurado');
    return config.telefone_admin;
  }

  async enviarTextoAdmin(texto: string): Promise<void> {
    const telefone = this.getTelefoneAdmin();
    try {
      await this.whatsapp.enviarTexto(telefone, texto);
      console.log(`[SDR] Notificacao enviada para ${telefone}`);
    } catch (e) {
      console.error('[SDR] Erro ao enviar notificacao WhatsApp:', e);
      throw e;
    }
  }

  async notificarEventos(eventos: SdrEvento[]): Promise<void> {
    if (eventos.length === 0) return;

    // Agrupar por prioridade
    const criticos = eventos.filter(e => e.prioridade === 'critica');
    const altos = eventos.filter(e => e.prioridade === 'alta');
    const medios = eventos.filter(e => e.prioridade === 'media');

    // Enviar criticos imediatamente (um por um)
    for (const evento of criticos) {
      const msg = `🚨 *ALERTA SDR*\n\n${evento.descricao}`;
      await this.enviarTextoAdmin(msg);
      this.marcarNotificado(evento);
      await this.delay(2000);
    }

    // Agrupar altos e medios num unico resumo
    const outros = [...altos, ...medios];
    if (outros.length > 0) {
      let msg = `📊 *SDR - ${outros.length} atualizacao(es)*\n\n`;
      for (const evento of outros) {
        msg += `• ${evento.descricao}\n`;
        this.marcarNotificado(evento);
      }
      await this.enviarTextoAdmin(msg);
    }
  }

  async enviarResumo(tipo: 'manha' | 'tarde'): Promise<string> {
    const db = getDb();
    const stats = this.polling.obterStats();

    // Dados para o resumo
    const logsRecentes = db.prepare(
      "SELECT tipo, prioridade, lead_nome, descricao FROM sdr_agent_log WHERE criado_em > datetime('now', '-12 hours') ORDER BY criado_em DESC LIMIT 20"
    ).all() as any[];

    const totalSnapshots = db.prepare('SELECT COUNT(*) as total FROM sdr_agent_lead_snapshot').get() as any;

    const dadosResumo = `
Leads monitorados: ${totalSnapshots?.total || 0}
Eventos nas ultimas 12h: ${stats.logs_hoje}
Por tipo: ${stats.por_tipo.map((t: any) => `${t.tipo}=${t.total}`).join(', ') || 'nenhum'}
Por prioridade: ${stats.por_prioridade.map((p: any) => `${p.prioridade}=${p.total}`).join(', ') || 'nenhum'}

Ultimos eventos:
${logsRecentes.map((l: any) => `- [${l.tipo}] ${l.descricao}`).join('\n') || 'Nenhum evento recente'}
`.trim();

    let resumoTexto: string;

    try {
      if (!env.CLAUDE_API_KEY) throw new Error('Sem API key');

      const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
      const prompt = tipo === 'manha' ? getResumoManhaPrompt(dadosResumo) : getResumoTardePrompt(dadosResumo);

      const response = await anthropic.messages.create({
        model: env.CLAUDE_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      resumoTexto = textBlock?.text || this.gerarResumoFallback(tipo, stats, logsRecentes);
    } catch (e) {
      console.error('[SDR] Erro ao gerar resumo via Claude, usando fallback:', e);
      resumoTexto = this.gerarResumoFallback(tipo, stats, logsRecentes);
    }

    const header = tipo === 'manha' ? '☀️ *Bom dia! Resumo SDR*' : '🌙 *Resumo SDR do dia*';
    const msgFinal = `${header}\n\n${resumoTexto}`;

    await this.enviarTextoAdmin(msgFinal);
    return msgFinal;
  }

  async testarNotificacao(): Promise<void> {
    await this.enviarTextoAdmin('✅ *Teste SDR* - Notificacao funcionando! O agente SDR esta configurado e pronto para monitorar seus leads.');
  }

  private gerarResumoFallback(tipo: string, stats: any, logs: any[]): string {
    const titulo = tipo === 'manha' ? 'Resumo da manha' : 'Resumo do dia';
    let msg = `*${titulo}*\n\n`;
    msg += `📈 ${stats.logs_hoje} eventos nas ultimas 12h\n`;

    if (stats.por_tipo.length > 0) {
      for (const t of stats.por_tipo) {
        const emoji = t.tipo === 'venda_fechada' ? '💰' : t.tipo === 'novo_lead' ? '🆕' : t.tipo === 'lead_inativo' ? '😴' : '📋';
        msg += `${emoji} ${t.tipo}: ${t.total}\n`;
      }
    } else {
      msg += 'Nenhum evento registrado.\n';
    }

    if (logs.length > 0) {
      msg += `\n*Destaques:*\n`;
      for (const l of logs.slice(0, 5)) {
        msg += `• ${l.descricao}\n`;
      }
    }

    return msg;
  }

  private marcarNotificado(evento: SdrEvento): void {
    if (!evento.leadId) return;
    const db = getDb();
    db.prepare(
      "UPDATE sdr_agent_log SET notificado = 1 WHERE lead_id = ? AND tipo = ? AND notificado = 0 ORDER BY criado_em DESC LIMIT 1"
    ).run(evento.leadId, evento.tipo);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
