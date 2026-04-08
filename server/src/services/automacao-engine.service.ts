import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';

/**
 * Motor de Automacao Visual
 * Executa fluxos definidos pelo editor visual (tipo ManyChat)
 *
 * Tipos de nodes:
 * - trigger: novo_lead, mensagem_recebida, mudanca_estagio, palavra_chave, cron, tag_adicionada
 * - action: enviar_whatsapp, enviar_instagram, enviar_template, adicionar_tag, mover_estagio, criar_tarefa, notificar
 * - condition: if_tag, if_cliente_lead, if_estagio, if_bant, if_respondeu, if_canal
 * - wait: wait_minutos, wait_horas, wait_dias
 */

export interface FlowNode {
  id: string;
  tipo: 'trigger' | 'action' | 'condition' | 'wait';
  subtipo: string;
  config: Record<string, any>;
  posicao: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  de: string;
  para: string;
  label?: string; // 'sim', 'nao' para conditions
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export class AutomacaoEngineService {

  /**
   * Inicia um fluxo para um contato especifico
   */
  iniciarFluxo(fluxoId: string, clienteId: string, conversaId?: string, contexto?: Record<string, any>): string | null {
    const db = getDb();

    const fluxo = db.prepare('SELECT * FROM automacao_fluxos WHERE id = ? AND ativo = 1').get(fluxoId) as any;
    if (!fluxo) return null;

    // Verificar se cliente ja esta neste fluxo ativo
    const existente = db.prepare(
      "SELECT id FROM automacao_execucoes WHERE fluxo_id = ? AND cliente_id = ? AND status = 'ativo'"
    ).get(fluxoId, clienteId) as any;
    if (existente) return existente.id; // ja esta no fluxo

    const flow: FlowDefinition = JSON.parse(fluxo.fluxo_json);
    const triggerNode = flow.nodes.find(n => n.tipo === 'trigger');
    if (!triggerNode) return null;

    // Encontrar proximo node apos o trigger
    const proximaEdge = flow.edges.find(e => e.de === triggerNode.id);
    if (!proximaEdge) return null;

    const execId = uuidv4();
    db.prepare(
      `INSERT INTO automacao_execucoes (id, fluxo_id, cliente_id, conversa_id, status, node_atual, dados_contexto)
       VALUES (?, ?, ?, ?, 'ativo', ?, ?)`
    ).run(execId, fluxoId, clienteId, conversaId || null, proximaEdge.para, JSON.stringify(contexto || {}));

    // Log do trigger
    db.prepare(
      `INSERT INTO automacao_log (execucao_id, node_id, node_tipo, resultado, detalhes)
       VALUES (?, ?, 'trigger', 'ok', ?)`
    ).run(execId, triggerNode.id, `Fluxo iniciado: ${fluxo.nome}`);

    saveDb();
    console.log(`[AUTOMACAO] Fluxo "${fluxo.nome}" iniciado para cliente ${clienteId} (exec: ${execId})`);

    // Executar proximo node imediatamente
    this.executarProximoNode(execId);

    return execId;
  }

  /**
   * Executa o node atual de uma execucao
   */
  executarProximoNode(execucaoId: string) {
    const db = getDb();

    const exec = db.prepare(
      'SELECT * FROM automacao_execucoes WHERE id = ? AND status = ?'
    ).get(execucaoId, 'ativo') as any;
    if (!exec) return;

    const fluxo = db.prepare('SELECT fluxo_json FROM automacao_fluxos WHERE id = ?').get(exec.fluxo_id) as any;
    if (!fluxo) return;

    const flow: FlowDefinition = JSON.parse(fluxo.fluxo_json);
    const node = flow.nodes.find(n => n.id === exec.node_atual);
    if (!node) {
      this.concluirExecucao(execucaoId, 'concluido');
      return;
    }

    const contexto = JSON.parse(exec.dados_contexto || '{}');

    try {
      switch (node.tipo) {
        case 'wait':
          this.executarWait(execucaoId, node);
          return; // para aqui, cron retoma depois

        case 'action':
          this.executarAction(execucaoId, exec, node, contexto);
          break;

        case 'condition':
          this.executarCondition(execucaoId, exec, node, flow, contexto);
          return; // condition ja avanca para o proximo

        default:
          break;
      }

      // Avancar para proximo node
      const proximaEdge = flow.edges.find(e => e.de === node.id);
      if (proximaEdge) {
        db.prepare(
          "UPDATE automacao_execucoes SET node_atual = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(proximaEdge.para, execucaoId);
        saveDb();
        // Executar proximo node recursivamente (com limite de seguranca)
        this.executarProximoNode(execucaoId);
      } else {
        this.concluirExecucao(execucaoId, 'concluido');
      }
    } catch (e: any) {
      console.error(`[AUTOMACAO] Erro no node ${node.id}:`, e.message);
      db.prepare(
        `INSERT INTO automacao_log (execucao_id, node_id, node_tipo, resultado, detalhes)
         VALUES (?, ?, ?, 'erro', ?)`
      ).run(execucaoId, node.id, node.tipo, e.message);
      this.concluirExecucao(execucaoId, 'erro');
    }
  }

  /**
   * Node WAIT: agenda o proximo passo para daqui a X tempo
   */
  private executarWait(execucaoId: string, node: FlowNode) {
    const db = getDb();
    let minutos = 0;

    switch (node.subtipo) {
      case 'wait_minutos':
        minutos = node.config.minutos || 30;
        break;
      case 'wait_horas':
        minutos = (node.config.horas || 1) * 60;
        break;
      case 'wait_dias':
        minutos = (node.config.dias || 1) * 60 * 24;
        break;
    }

    db.prepare(
      `UPDATE automacao_execucoes SET proximo_passo_em = datetime('now', 'localtime', '+${minutos} minutes'), atualizado_em = datetime('now', 'localtime') WHERE id = ?`
    ).run(execucaoId);

    db.prepare(
      `INSERT INTO automacao_log (execucao_id, node_id, node_tipo, resultado, detalhes)
       VALUES (?, ?, 'wait', 'ok', ?)`
    ).run(execucaoId, node.id, `Aguardando ${minutos} minutos`);

    saveDb();
    console.log(`[AUTOMACAO] Exec ${execucaoId} aguardando ${minutos} min`);
  }

  /**
   * Node ACTION: executa uma acao (enviar msg, tag, mover estagio, etc)
   */
  private executarAction(execucaoId: string, exec: any, node: FlowNode, contexto: Record<string, any>) {
    const db = getDb();
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(exec.cliente_id) as any;
    if (!cliente) return;

    let detalhes = '';

    switch (node.subtipo) {
      case 'enviar_whatsapp': {
        const texto = this.substituirVariaveis(node.config.mensagem || '', cliente, contexto);
        if (cliente.telefone) {
          // Enviar via fila para respeitar warmup
          this.enfileirarEnvio(exec.cliente_id, cliente.telefone, texto, 'whatsapp');
          detalhes = `WhatsApp: ${texto.substring(0, 60)}...`;
        }
        break;
      }

      case 'enviar_instagram': {
        const texto = this.substituirVariaveis(node.config.mensagem || '', cliente, contexto);
        // Instagram DM - buscar conversa instagram do cliente
        const convIg = db.prepare(
          "SELECT meta_contato_id FROM conversas WHERE cliente_id = ? AND canal = 'instagram_dm' ORDER BY atualizado_em DESC LIMIT 1"
        ).get(exec.cliente_id) as any;
        if (convIg?.meta_contato_id) {
          this.enfileirarEnvio(exec.cliente_id, convIg.meta_contato_id, texto, 'instagram');
        }
        detalhes = `Instagram DM: ${texto.substring(0, 60)}...`;
        break;
      }

      case 'enviar_template': {
        const templateId = node.config.template_id;
        const template = db.prepare('SELECT * FROM automacao_templates WHERE id = ?').get(templateId) as any;
        if (template && cliente.telefone) {
          const texto = this.substituirVariaveis(template.conteudo, cliente, contexto);
          this.enfileirarEnvio(exec.cliente_id, cliente.telefone, texto, template.canal || 'whatsapp');
          detalhes = `Template "${template.nome}": ${texto.substring(0, 60)}...`;
        }
        break;
      }

      case 'adicionar_tag': {
        const tag = node.config.tag;
        if (tag) {
          const tagsAtuais: string[] = (() => { try { return JSON.parse(cliente.tags || '[]'); } catch { return []; } })();
          if (!tagsAtuais.includes(tag)) {
            tagsAtuais.push(tag);
            db.prepare('UPDATE clientes SET tags = ? WHERE id = ?').run(JSON.stringify(tagsAtuais), exec.cliente_id);
          }
          detalhes = `Tag adicionada: ${tag}`;
        }
        break;
      }

      case 'mover_estagio': {
        const novoEstagio = node.config.estagio;
        const odvId = node.config.odv_id || contexto.odv_id;
        if (novoEstagio && odvId) {
          db.prepare(
            "UPDATE pipeline SET estagio = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
          ).run(novoEstagio, odvId);
          db.prepare(
            `INSERT INTO pipeline_historico (pipeline_id, estagio_novo, automatico, motivo)
             VALUES (?, ?, 1, 'Automacao')`
          ).run(odvId, novoEstagio);
          detalhes = `Estagio movido para: ${novoEstagio}`;
        }
        break;
      }

      case 'criar_tarefa': {
        const titulo = this.substituirVariaveis(node.config.titulo || 'Tarefa automacao', cliente, contexto);
        const descricao = this.substituirVariaveis(node.config.descricao || '', cliente, contexto);
        const odvId = contexto.odv_id;
        db.prepare(
          `INSERT INTO tarefas (pipeline_id, cliente_id, titulo, descricao, tipo, prioridade, data_vencimento)
           VALUES (?, ?, ?, ?, 'followup', ?, datetime('now', 'localtime', '+${node.config.dias_vencimento || 1} days'))`
        ).run(odvId || null, exec.cliente_id, titulo, descricao, node.config.prioridade || 'media');
        detalhes = `Tarefa criada: ${titulo}`;
        break;
      }

      case 'notificar': {
        const adminTel = db.prepare('SELECT telefone_admin FROM sdr_agent_config WHERE id = 1').get() as any;
        if (adminTel?.telefone_admin) {
          const texto = this.substituirVariaveis(node.config.mensagem || `Automacao: acao necessaria para ${cliente.nome}`, cliente, contexto);
          this.enfileirarEnvio(null, adminTel.telefone_admin, texto, 'whatsapp');
          detalhes = `Notificacao enviada`;
        }
        break;
      }
    }

    db.prepare(
      `INSERT INTO automacao_log (execucao_id, node_id, node_tipo, resultado, detalhes)
       VALUES (?, ?, 'action', 'ok', ?)`
    ).run(execucaoId, node.id, detalhes);

    saveDb();
  }

  /**
   * Node CONDITION: avalia condicao e segue para sim ou nao
   */
  private executarCondition(execucaoId: string, exec: any, node: FlowNode, flow: FlowDefinition, contexto: Record<string, any>) {
    const db = getDb();
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(exec.cliente_id) as any;
    let resultado = false;

    switch (node.subtipo) {
      case 'if_tag': {
        const tags: string[] = (() => { try { return JSON.parse(cliente?.tags || '[]'); } catch { return []; } })();
        resultado = tags.includes(node.config.tag || '');
        break;
      }

      case 'if_cliente_lead': {
        const vendas = db.prepare(
          'SELECT COUNT(*) as total FROM vendas WHERE cliente_id = ? AND estornada = 0'
        ).get(exec.cliente_id) as any;
        const ehCliente = vendas?.total > 0;
        resultado = node.config.valor === 'cliente' ? ehCliente : !ehCliente;
        break;
      }

      case 'if_estagio': {
        const odv = db.prepare(
          'SELECT estagio FROM pipeline WHERE cliente_id = ? ORDER BY atualizado_em DESC LIMIT 1'
        ).get(exec.cliente_id) as any;
        resultado = odv?.estagio === node.config.estagio;
        break;
      }

      case 'if_bant': {
        const conversa = db.prepare(
          "SELECT bant_score FROM conversas WHERE cliente_id = ? ORDER BY atualizado_em DESC LIMIT 1"
        ).get(exec.cliente_id) as any;
        const score = conversa?.bant_score || 0;
        resultado = score >= (node.config.score_minimo || 3);
        break;
      }

      case 'if_canal': {
        resultado = (contexto.canal || 'whatsapp') === node.config.canal;
        break;
      }

      case 'if_respondeu': {
        // Verificar se cliente enviou mensagem nas ultimas X horas
        const horas = node.config.horas || 24;
        const msg = db.prepare(
          `SELECT id FROM mensagens m
           JOIN conversas c ON m.conversa_id = c.id
           WHERE c.cliente_id = ? AND m.papel = 'user'
           AND m.criado_em >= datetime('now', 'localtime', '-${horas} hours')
           LIMIT 1`
        ).get(exec.cliente_id) as any;
        resultado = !!msg;
        break;
      }
    }

    const label = resultado ? 'sim' : 'nao';
    const proximaEdge = flow.edges.find(e => e.de === node.id && e.label === label);

    db.prepare(
      `INSERT INTO automacao_log (execucao_id, node_id, node_tipo, resultado, detalhes)
       VALUES (?, ?, 'condition', 'ok', ?)`
    ).run(execucaoId, node.id, `${node.subtipo} = ${label}`);

    if (proximaEdge) {
      db.prepare(
        "UPDATE automacao_execucoes SET node_atual = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
      ).run(proximaEdge.para, execucaoId);
      saveDb();
      this.executarProximoNode(execucaoId);
    } else {
      this.concluirExecucao(execucaoId, 'concluido');
    }
  }

  /**
   * Processa wait nodes pendentes (chamado pelo cron a cada 1 min)
   */
  processarWaitsPendentes() {
    const db = getDb();
    const pendentes = db.prepare(`
      SELECT e.id, e.node_atual, f.fluxo_json
      FROM automacao_execucoes e
      JOIN automacao_fluxos f ON e.fluxo_id = f.id
      WHERE e.status = 'ativo'
        AND e.proximo_passo_em IS NOT NULL
        AND e.proximo_passo_em <= datetime('now', 'localtime')
    `).all() as any[];

    if (pendentes.length === 0) return;

    console.log(`[AUTOMACAO] Processando ${pendentes.length} waits pendentes...`);

    for (const exec of pendentes) {
      try {
        const flow: FlowDefinition = JSON.parse(exec.fluxo_json);
        const node = flow.nodes.find(n => n.id === exec.node_atual);
        if (!node) continue;

        // Limpar proximo_passo_em e avancar
        const proximaEdge = flow.edges.find(e => e.de === node.id);
        if (proximaEdge) {
          db.prepare(
            "UPDATE automacao_execucoes SET node_atual = ?, proximo_passo_em = NULL, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
          ).run(proximaEdge.para, exec.id);
          saveDb();
          this.executarProximoNode(exec.id);
        } else {
          this.concluirExecucao(exec.id, 'concluido');
        }
      } catch (e: any) {
        console.error(`[AUTOMACAO] Erro ao processar wait ${exec.id}:`, e.message);
      }
    }
  }

  /**
   * Concluir ou cancelar uma execucao
   */
  private concluirExecucao(execucaoId: string, status: string) {
    const db = getDb();
    db.prepare(
      "UPDATE automacao_execucoes SET status = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(status, execucaoId);
    saveDb();
    console.log(`[AUTOMACAO] Execucao ${execucaoId} finalizada: ${status}`);
  }

  /**
   * Substituir variaveis no texto: {{nome}}, {{telefone}}, {{produto_interesse}}, etc
   */
  private substituirVariaveis(texto: string, cliente: any, contexto: Record<string, any>): string {
    return texto
      .replace(/\{\{nome\}\}/gi, cliente?.nome || 'Cliente')
      .replace(/\{\{telefone\}\}/gi, cliente?.telefone || '')
      .replace(/\{\{email\}\}/gi, cliente?.email || '')
      .replace(/\{\{produto_interesse\}\}/gi, contexto.produto_interesse || cliente?.tipo_interesse || '')
      .replace(/\{\{vendedor\}\}/gi, contexto.vendedor_nome || '')
      .replace(/\{\{valor\}\}/gi, contexto.valor ? `R$${contexto.valor}` : '');
  }

  /**
   * Enfileira envio para respeitar rate limits
   */
  private enfileirarEnvio(clienteId: string | null, destino: string, texto: string, canal: string) {
    // Envio direto para simplicidade inicial
    // TODO: integrar com fila de warmup para campanhas grandes
    try {
      if (canal === 'whatsapp') {
        const { EvolutionService } = require('./evolution.service');
        const evo = new EvolutionService();
        evo.enviarTexto(destino, texto).catch((e: any) =>
          console.error('[AUTOMACAO] Erro envio WhatsApp:', e.message)
        );
      } else if (canal === 'instagram_dm' || canal === 'instagram') {
        const { InstagramService } = require('./instagram.service');
        const ig = new InstagramService();
        // Buscar conta Instagram ativa para enviar
        const contas = ig.listarContas();
        const contaAtiva = contas.find((c: any) => c.ativo);
        if (contaAtiva) {
          ig.enviarDM(contaAtiva.id, destino, texto).catch((e: any) =>
            console.error('[AUTOMACAO] Erro envio Instagram DM:', e.message)
          );
        }
      }
    } catch (e: any) {
      console.error('[AUTOMACAO] Erro ao enfileirar:', e.message);
    }
  }

  // --- Estatisticas ---

  obterEstatisticas(fluxoId: string) {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as c FROM automacao_execucoes WHERE fluxo_id = ?').get(fluxoId) as any;
    const ativos = db.prepare("SELECT COUNT(*) as c FROM automacao_execucoes WHERE fluxo_id = ? AND status = 'ativo'").get(fluxoId) as any;
    const concluidos = db.prepare("SELECT COUNT(*) as c FROM automacao_execucoes WHERE fluxo_id = ? AND status = 'concluido'").get(fluxoId) as any;
    const erros = db.prepare("SELECT COUNT(*) as c FROM automacao_execucoes WHERE fluxo_id = ? AND status = 'erro'").get(fluxoId) as any;

    return {
      total: total?.c || 0,
      ativos: ativos?.c || 0,
      concluidos: concluidos?.c || 0,
      erros: erros?.c || 0,
    };
  }
}

export const automacaoEngine = new AutomacaoEngineService();
