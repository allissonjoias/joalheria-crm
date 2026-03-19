import { getDb } from '../config/database';
import { automacaoEngine, FlowDefinition } from './automacao-engine.service';

/**
 * Servico de Triggers de Automacao
 * Intercepta eventos do CRM e dispara fluxos correspondentes
 */
export class AutomacaoTriggerService {

  /**
   * Busca fluxos ativos que possuem trigger do tipo especificado
   */
  private buscarFluxosComTrigger(subtipo: string, canal?: string): any[] {
    const db = getDb();
    const fluxos = db.prepare(
      "SELECT * FROM automacao_fluxos WHERE ativo = 1"
    ).all() as any[];

    return fluxos.filter(f => {
      try {
        const flow: FlowDefinition = JSON.parse(f.fluxo_json);
        const trigger = flow.nodes.find(n => n.tipo === 'trigger' && n.subtipo === subtipo);
        if (!trigger) return false;

        // Verificar canal se especificado
        if (canal && f.canal !== 'todos' && f.canal !== canal) return false;

        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Trigger: Novo lead criado no pipeline
   */
  onNovoLead(clienteId: string, odvId: string, estagio: string) {
    const fluxos = this.buscarFluxosComTrigger('novo_lead');

    for (const fluxo of fluxos) {
      try {
        const flow: FlowDefinition = JSON.parse(fluxo.fluxo_json);
        const trigger = flow.nodes.find(n => n.tipo === 'trigger' && n.subtipo === 'novo_lead');
        if (!trigger) continue;

        // Filtro de estagio (se configurado)
        if (trigger.config.estagios && trigger.config.estagios.length > 0) {
          if (!trigger.config.estagios.includes(estagio)) continue;
        }

        automacaoEngine.iniciarFluxo(fluxo.id, clienteId, undefined, { odv_id: odvId, estagio });
      } catch (e: any) {
        console.error(`[TRIGGER] Erro ao disparar novo_lead para fluxo ${fluxo.id}:`, e.message);
      }
    }
  }

  /**
   * Trigger: Mensagem recebida do cliente
   */
  onMensagemRecebida(clienteId: string, texto: string, canal: string, conversaId?: string) {
    // Trigger por mensagem recebida
    const fluxosMsgRecebida = this.buscarFluxosComTrigger('mensagem_recebida', canal);
    for (const fluxo of fluxosMsgRecebida) {
      automacaoEngine.iniciarFluxo(fluxo.id, clienteId, conversaId, { canal, mensagem: texto });
    }

    // Trigger por palavra-chave
    const fluxosPalavraChave = this.buscarFluxosComTrigger('palavra_chave', canal);
    for (const fluxo of fluxosPalavraChave) {
      try {
        const flow: FlowDefinition = JSON.parse(fluxo.fluxo_json);
        const trigger = flow.nodes.find(n => n.tipo === 'trigger' && n.subtipo === 'palavra_chave');
        if (!trigger) continue;

        const palavras: string[] = trigger.config.palavras || [];
        const textoLower = texto.toLowerCase();
        const match = palavras.some(p => textoLower.includes(p.toLowerCase()));

        if (match) {
          automacaoEngine.iniciarFluxo(fluxo.id, clienteId, conversaId, { canal, mensagem: texto, palavra_match: true });
        }
      } catch {}
    }
  }

  /**
   * Trigger: Mudanca de estagio no pipeline
   */
  onMudancaEstagio(clienteId: string, odvId: string, estagioAnterior: string, estagioNovo: string) {
    const fluxos = this.buscarFluxosComTrigger('mudanca_estagio');

    for (const fluxo of fluxos) {
      try {
        const flow: FlowDefinition = JSON.parse(fluxo.fluxo_json);
        const trigger = flow.nodes.find(n => n.tipo === 'trigger' && n.subtipo === 'mudanca_estagio');
        if (!trigger) continue;

        // Filtro por estagio especifico
        if (trigger.config.estagio_destino && trigger.config.estagio_destino !== estagioNovo) continue;

        automacaoEngine.iniciarFluxo(fluxo.id, clienteId, undefined, {
          odv_id: odvId,
          estagio_anterior: estagioAnterior,
          estagio_novo: estagioNovo,
        });
      } catch {}
    }
  }

  /**
   * Trigger: Tag adicionada a um cliente
   */
  onTagAdicionada(clienteId: string, tag: string) {
    const fluxos = this.buscarFluxosComTrigger('tag_adicionada');

    for (const fluxo of fluxos) {
      try {
        const flow: FlowDefinition = JSON.parse(fluxo.fluxo_json);
        const trigger = flow.nodes.find(n => n.tipo === 'trigger' && n.subtipo === 'tag_adicionada');
        if (!trigger) continue;

        if (trigger.config.tag && trigger.config.tag !== tag) continue;

        automacaoEngine.iniciarFluxo(fluxo.id, clienteId, undefined, { tag });
      } catch {}
    }
  }
}

export const automacaoTrigger = new AutomacaoTriggerService();
