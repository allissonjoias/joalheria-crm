import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';
import { cicloVidaService } from './ciclo-vida.service';

interface ResultadoBrecha {
  acao: 'opt_out' | 'problema' | 'reengajamento' | 'normal';
  resposta_luma?: string;
  brecha_id?: string;
}

interface BrechaResumo {
  total: number;
  abertas: number;
  por_tipo: Record<string, number>;
  recentes: any[];
}

export class BrechasService {

  /**
   * MIDDLEWARE: Intercepta mensagem ANTES da Luma responder.
   * Retorna null se não há brecha (fluxo normal).
   * Retorna ação + resposta se brecha detectada.
   */
  middlewareMensagemRecebida(clienteId: string, mensagem: string): ResultadoBrecha | null {
    if (!mensagem || mensagem.trim().length === 0) return null;

    const msgLower = this.normalizarTexto(mensagem);
    const db = getDb();

    // 1. Verificar OPT-OUT
    const keywordsOptOut = db.prepare(
      "SELECT keyword FROM brechas_keywords WHERE tipo = 'opt_out' AND ativo = 1"
    ).all() as any[];

    for (const kw of keywordsOptOut) {
      if (msgLower.includes(kw.keyword)) {
        const brechaId = this.registrarBrecha(null, clienteId, 'opt_out',
          `Cliente solicitou opt-out: "${mensagem.substring(0, 100)}"`,
          'Desativado modo_auto, criada tarefa para humano'
        );

        // Desativar auto-resposta para este cliente
        const conversas = db.prepare(
          "SELECT id FROM conversas WHERE cliente_id = ? AND modo_auto = 1"
        ).all(clienteId) as any[];
        for (const c of conversas) {
          db.prepare("UPDATE conversas SET modo_auto = 0 WHERE id = ?").run(c.id);
        }

        // Criar tarefa urgente para humano
        this.criarTarefaBrecha(clienteId, 'urgente',
          'Cliente solicitou opt-out',
          `O cliente pediu para parar de receber mensagens. Mensagem: "${mensagem.substring(0, 200)}". Entrar em contato manualmente para entender o motivo.`
        );

        saveDb();
        return {
          acao: 'opt_out',
          resposta_luma: 'Entendo perfeitamente. Vou encaminhar seu atendimento para um de nossos consultores especializados. Desculpe qualquer inconveniente.',
          brecha_id: brechaId,
        };
      }
    }

    // 2. Verificar PROBLEMA/RECLAMAÇÃO
    const keywordsProblema = db.prepare(
      "SELECT keyword FROM brechas_keywords WHERE tipo = 'problema' AND ativo = 1"
    ).all() as any[];

    for (const kw of keywordsProblema) {
      if (msgLower.includes(kw.keyword)) {
        const brechaId = this.registrarBrecha(null, clienteId, 'problema',
          `Possível problema detectado: "${mensagem.substring(0, 100)}"`,
          'Criada tarefa urgente para equipe'
        );

        this.criarTarefaBrecha(clienteId, 'urgente',
          'Reclamação/Problema detectado',
          `Cliente reportou possível problema. Mensagem: "${mensagem.substring(0, 200)}". Tratar com prioridade máxima.`
        );

        saveDb();
        return {
          acao: 'problema',
          resposta_luma: 'Lamento muito saber disso. Vou encaminhar imediatamente para nossa equipe resolver da melhor forma possível. Um de nossos consultores entrará em contato em breve.',
          brecha_id: brechaId,
        };
      }
    }

    // 3. Verificar REENGAJAMENTO (lead perdido voltando)
    const keywordsRetorno = db.prepare(
      "SELECT keyword FROM brechas_keywords WHERE tipo = 'interesse_retorno' AND ativo = 1"
    ).all() as any[];

    const odvPerdido = db.prepare(`
      SELECT p.id, p.estagio, p.titulo, fe.tipo
      FROM pipeline p
      JOIN funil_estagios fe ON fe.nome = p.estagio AND fe.funil_id = COALESCE(p.funil_id, 1)
      WHERE p.cliente_id = ? AND fe.tipo = 'perdido'
      ORDER BY p.atualizado_em DESC LIMIT 1
    `).get(clienteId) as any;

    if (odvPerdido) {
      for (const kw of keywordsRetorno) {
        if (msgLower.includes(kw.keyword)) {
          const brechaId = this.registrarBrecha(odvPerdido.id, clienteId, 'reengajamento',
            `Lead perdido demonstrou interesse novamente: "${mensagem.substring(0, 100)}"`,
            'ODV reaberta, movida para Lead'
          );

          // Reabrir ODV - mover de volta para o início
          db.prepare(
            "UPDATE pipeline SET estagio = 'Lead', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
          ).run(odvPerdido.id);

          // Registrar no histórico
          db.prepare(
            "INSERT INTO pipeline_historico (id, pipeline_id, estagio_anterior, estagio_novo, automatico, criado_em) VALUES (?, ?, ?, 'Lead', 1, datetime('now', 'localtime'))"
          ).run(uuidv4(), odvPerdido.id, odvPerdido.estagio);

          // Reativar modo_auto
          const conversas = db.prepare(
            "SELECT id FROM conversas WHERE cliente_id = ?"
          ).all(clienteId) as any[];
          for (const c of conversas) {
            db.prepare("UPDATE conversas SET modo_auto = 1 WHERE id = ?").run(c.id);
          }

          this.criarTarefaBrecha(clienteId, 'alta',
            'Lead perdido retornou!',
            `Lead que estava perdido demonstrou interesse novamente. Mensagem: "${mensagem.substring(0, 200)}". Aproveitar a oportunidade!`
          );

          saveDb();
          // Retorna null para que a Luma responda normalmente (lead está reengajado)
          return null;
        }
      }
    }

    return null; // Nenhuma brecha - seguir fluxo normal
  }

  /**
   * Processa pagamento aprovado do Mercado Pago.
   * Transição atômica: lead → cliente com pagamento registrado.
   */
  processarGanho(odvId: string, paymentId: string, valor: number, metodo?: string, parcelas?: number): void {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    // Registrar pagamento
    db.prepare(`
      INSERT OR REPLACE INTO mercadopago_pagamentos (id, pipeline_id, cliente_id, payment_id, status, valor, metodo, parcelas, criado_em)
      VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, datetime('now', 'localtime'))
    `).run(uuidv4(), odvId, odv.cliente_id, paymentId, valor, metodo || 'pix', parcelas || 1);

    // Atualizar ODV com dados de pagamento
    db.prepare(`
      UPDATE pipeline SET
        pagamento_status = 'approved',
        pagamento_id = ?,
        pagamento_valor = ?,
        valor = CASE WHEN valor IS NULL OR valor = 0 THEN ? ELSE valor END,
        forma_pagamento = ?,
        parcelas = ?,
        atualizado_em = datetime('now', 'localtime')
      WHERE id = ?
    `).run(paymentId, valor, valor, metodo || 'pix', parcelas || 1, odvId);

    // Buscar estágio de ganho
    const config = db.prepare('SELECT * FROM mercadopago_config WHERE id = 1').get() as any;
    const estagioGanho = db.prepare(
      "SELECT nome FROM funil_estagios WHERE tipo = 'ganho' AND funil_id = COALESCE(?, 1) AND ativo = 1 LIMIT 1"
    ).get(odv.funil_id || 1) as any;

    if (estagioGanho && config?.auto_ganho) {
      const estagioAnterior = odv.estagio;
      db.prepare("UPDATE pipeline SET estagio = ? WHERE id = ?").run(estagioGanho.nome, odvId);

      db.prepare(
        "INSERT INTO pipeline_historico (id, pipeline_id, estagio_anterior, estagio_novo, automatico, criado_em) VALUES (?, ?, ?, ?, 1, datetime('now', 'localtime'))"
      ).run(uuidv4(), odvId, estagioAnterior, estagioGanho.nome);

      // Disparar ciclo de vida pós-venda
      cicloVidaService.onMudancaEstagio(odvId, estagioAnterior, estagioGanho.nome);
    }

    saveDb();
    console.log(`[BRECHAS] Pagamento processado: ODV ${odvId}, R$ ${valor}`);
  }

  /**
   * Agenda follow-ups de coleta/envio após pagamento confirmado.
   */
  agendarFollowupsColetaEnvio(odvId: string): void {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    const tarefas = [
      {
        titulo: 'Confirmar forma de entrega',
        descricao: 'Perguntar ao cliente: retirada na loja, motoqueiro ou Correios?',
        tipo: 'pos_venda',
        prioridade: 'alta',
        dias: 0,
      },
      {
        titulo: 'Confirmar endereço de entrega',
        descricao: 'Se entrega por correio/motoboy, confirmar endereço completo.',
        tipo: 'pos_venda',
        prioridade: 'alta',
        dias: 1,
      },
      {
        titulo: 'Preparar e embalar pedido',
        descricao: 'Preparar a peça, embalagem premium e nota fiscal.',
        tipo: 'pos_venda',
        prioridade: 'media',
        dias: 1,
      },
      {
        titulo: 'Enviar pedido ou agendar retirada',
        descricao: 'Despachar envio ou confirmar data/horário de retirada na loja.',
        tipo: 'pos_venda',
        prioridade: 'alta',
        dias: 2,
      },
      {
        titulo: 'Enviar código de rastreio',
        descricao: 'Se envio por correio, informar código de rastreio ao cliente.',
        tipo: 'pos_venda',
        prioridade: 'media',
        dias: 3,
      },
    ];

    for (const t of tarefas) {
      db.prepare(`
        INSERT INTO tarefas (id, pipeline_id, cliente_id, titulo, descricao, tipo, prioridade, status, data_vencimento, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', datetime('now', 'localtime', '+${t.dias} days'), datetime('now', 'localtime'))
      `).run(uuidv4(), odvId, odv.cliente_id, t.titulo, t.descricao, t.tipo, t.prioridade);
    }

    saveDb();
    console.log(`[BRECHAS] ${tarefas.length} follow-ups de coleta/envio agendados para ODV ${odvId}`);
  }

  /**
   * Agenda nutrição baseada no tipo de lead.
   */
  agendarNutricao(odvId: string, tipo: 'clientes' | 'perdidos_qualificados' | 'perdidos'): void {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    const agendamentos: { tipo_ciclo: string; dias: number }[] = [];

    switch (tipo) {
      case 'clientes':
        agendamentos.push(
          { tipo_ciclo: 'nutricao_30d', dias: 30 },
          { tipo_ciclo: 'nutricao_60d', dias: 60 },
          { tipo_ciclo: 'nutricao_90d', dias: 90 },
          { tipo_ciclo: 'aniversario_compra', dias: 365 },
        );
        break;
      case 'perdidos_qualificados':
        agendamentos.push(
          { tipo_ciclo: 'nutricao_30d', dias: 15 },
          { tipo_ciclo: 'nutricao_60d', dias: 45 },
          { tipo_ciclo: 'nutricao_90d', dias: 75 },
        );
        break;
      case 'perdidos':
        agendamentos.push(
          { tipo_ciclo: 'nutricao_30d', dias: 30 },
          { tipo_ciclo: 'nutricao_60d', dias: 60 },
        );
        break;
    }

    for (const ag of agendamentos) {
      try {
        db.prepare(`
          INSERT INTO ciclo_vida_agendamentos (id, pipeline_id, tipo_ciclo, data_agendada, status, criado_em)
          VALUES (?, ?, ?, datetime('now', 'localtime', '+${ag.dias} days'), 'pendente', datetime('now', 'localtime'))
        `).run(uuidv4(), odvId, ag.tipo_ciclo);
      } catch (e: any) {
        if (!e.message?.includes('UNIQUE')) {
          console.error('[BRECHAS] Erro ao agendar nutrição:', e.message);
        }
      }
    }

    saveDb();
    console.log(`[BRECHAS] Nutrição tipo "${tipo}" agendada para ODV ${odvId}`);
  }

  /**
   * Detecta brechas no funil (chamado pelo cron).
   * Verifica leads sem atividade, sem follow-up, pagamento pendente, etc.
   */
  detectarBrechas(): BrechaResumo {
    const db = getDb();
    const brechas: any[] = [];

    // 1. ODVs sem atividade há mais de 3 dias (em estágios abertos)
    const inativos = db.prepare(`
      SELECT p.id, p.cliente_id, p.titulo, p.estagio, p.atualizado_em,
        c.nome as cliente_nome,
        CAST((julianday('now', 'localtime') - julianday(p.atualizado_em)) AS INTEGER) as dias_inativo
      FROM pipeline p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      JOIN funil_estagios fe ON fe.nome = p.estagio AND fe.funil_id = COALESCE(p.funil_id, 1)
      WHERE fe.tipo = 'aberto'
        AND julianday('now', 'localtime') - julianday(p.atualizado_em) > 3
      ORDER BY p.atualizado_em ASC
      LIMIT 20
    `).all() as any[];

    for (const odv of inativos) {
      // Verificar se já tem brecha aberta
      const jaRegistrada = db.prepare(
        "SELECT id FROM brechas_log WHERE pipeline_id = ? AND tipo = 'inatividade' AND resolvido = 0"
      ).get(odv.id);

      if (!jaRegistrada) {
        const id = this.registrarBrecha(odv.id, odv.cliente_id, 'inatividade',
          `ODV "${odv.titulo}" sem atividade há ${odv.dias_inativo} dias (estágio: ${odv.estagio})`,
          'Detectado automaticamente'
        );
        brechas.push({ id, tipo: 'inatividade', odv });
      }
    }

    // 2. ODVs sem nenhuma tarefa pendente (sem follow-up)
    const semFollowup = db.prepare(`
      SELECT p.id, p.cliente_id, p.titulo, p.estagio,
        c.nome as cliente_nome
      FROM pipeline p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      JOIN funil_estagios fe ON fe.nome = p.estagio AND fe.funil_id = COALESCE(p.funil_id, 1)
      WHERE fe.tipo = 'aberto'
        AND NOT EXISTS (
          SELECT 1 FROM tarefas t
          WHERE t.pipeline_id = p.id AND t.status IN ('pendente', 'em_andamento')
        )
        AND julianday('now', 'localtime') - julianday(p.atualizado_em) > 1
      LIMIT 10
    `).all() as any[];

    for (const odv of semFollowup) {
      const jaRegistrada = db.prepare(
        "SELECT id FROM brechas_log WHERE pipeline_id = ? AND tipo = 'sem_followup' AND resolvido = 0"
      ).get(odv.id);

      if (!jaRegistrada) {
        const id = this.registrarBrecha(odv.id, odv.cliente_id, 'sem_followup',
          `ODV "${odv.titulo}" sem nenhum follow-up agendado (estágio: ${odv.estagio})`,
          'Detectado automaticamente'
        );
        brechas.push({ id, tipo: 'sem_followup', odv });
      }
    }

    // 3. Pagamentos pendentes há mais de 24h
    const pgPendentes = db.prepare(`
      SELECT p.id, p.cliente_id, p.titulo, p.pagamento_status, p.valor,
        c.nome as cliente_nome
      FROM pipeline p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE p.pagamento_status = 'pending'
        AND julianday('now', 'localtime') - julianday(p.atualizado_em) > 1
      LIMIT 10
    `).all() as any[];

    for (const odv of pgPendentes) {
      const jaRegistrada = db.prepare(
        "SELECT id FROM brechas_log WHERE pipeline_id = ? AND tipo = 'pagamento_pendente' AND resolvido = 0"
      ).get(odv.id);

      if (!jaRegistrada) {
        const id = this.registrarBrecha(odv.id, odv.cliente_id, 'pagamento_pendente',
          `Pagamento pendente há mais de 24h para "${odv.titulo}" (R$ ${odv.valor || '?'})`,
          'Detectado automaticamente'
        );
        brechas.push({ id, tipo: 'pagamento_pendente', odv });
      }
    }

    saveDb();

    // Resumo
    const stats = db.prepare(`
      SELECT tipo, COUNT(*) as total FROM brechas_log WHERE resolvido = 0 GROUP BY tipo
    `).all() as any[];

    const por_tipo: Record<string, number> = {};
    let abertas = 0;
    for (const s of stats) {
      por_tipo[s.tipo] = s.total;
      abertas += s.total;
    }

    const recentes = db.prepare(`
      SELECT bl.*, c.nome as cliente_nome, p.titulo as odv_titulo
      FROM brechas_log bl
      LEFT JOIN clientes c ON c.id = bl.cliente_id
      LEFT JOIN pipeline p ON p.id = bl.pipeline_id
      WHERE bl.resolvido = 0
      ORDER BY bl.criado_em DESC
      LIMIT 20
    `).all() as any[];

    return { total: brechas.length, abertas, por_tipo, recentes };
  }

  /**
   * Resolver uma brecha manualmente.
   */
  resolverBrecha(brechaId: string): void {
    const db = getDb();
    db.prepare(
      "UPDATE brechas_log SET resolvido = 1, resolvido_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(brechaId);
    saveDb();
  }

  /**
   * Listar brechas abertas.
   */
  listarBrechas(filtro?: { tipo?: string; pipeline_id?: string }): any[] {
    const db = getDb();
    let sql = `
      SELECT bl.*, c.nome as cliente_nome, p.titulo as odv_titulo, p.estagio, p.valor
      FROM brechas_log bl
      LEFT JOIN clientes c ON c.id = bl.cliente_id
      LEFT JOIN pipeline p ON p.id = bl.pipeline_id
      WHERE bl.resolvido = 0
    `;
    const params: any[] = [];

    if (filtro?.tipo) {
      sql += ' AND bl.tipo = ?';
      params.push(filtro.tipo);
    }
    if (filtro?.pipeline_id) {
      sql += ' AND bl.pipeline_id = ?';
      params.push(filtro.pipeline_id);
    }

    sql += ' ORDER BY bl.criado_em DESC LIMIT 50';
    return db.prepare(sql).all(...params) as any[];
  }

  /**
   * Obter config do Mercado Pago.
   */
  obterConfigMP(): any {
    const db = getDb();
    return db.prepare('SELECT * FROM mercadopago_config WHERE id = 1').get();
  }

  /**
   * Salvar config do Mercado Pago.
   */
  salvarConfigMP(config: { access_token?: string; webhook_secret?: string; ativo?: number; auto_ganho?: number; estagio_pos_pagamento?: string }): void {
    const db = getDb();
    const campos: string[] = [];
    const valores: any[] = [];

    if (config.access_token !== undefined) { campos.push('access_token = ?'); valores.push(config.access_token); }
    if (config.webhook_secret !== undefined) { campos.push('webhook_secret = ?'); valores.push(config.webhook_secret); }
    if (config.ativo !== undefined) { campos.push('ativo = ?'); valores.push(config.ativo); }
    if (config.auto_ganho !== undefined) { campos.push('auto_ganho = ?'); valores.push(config.auto_ganho); }
    if (config.estagio_pos_pagamento !== undefined) { campos.push('estagio_pos_pagamento = ?'); valores.push(config.estagio_pos_pagamento); }

    if (campos.length === 0) return;
    campos.push("atualizado_em = datetime('now', 'localtime')");

    db.prepare(`UPDATE mercadopago_config SET ${campos.join(', ')} WHERE id = 1`).run(...valores);
    saveDb();
  }

  /**
   * Webhook do Mercado Pago: processa notificação de pagamento.
   */
  async processarWebhookMP(body: any): Promise<{ ok: boolean; acao?: string }> {
    const db = getDb();
    const config = this.obterConfigMP() as any;
    if (!config?.ativo || !config?.access_token) {
      return { ok: false, acao: 'mercadopago_desativado' };
    }

    const action = body.action || body.type;
    const dataId = body.data?.id;

    if (!dataId || (!action?.includes('payment') && action !== 'payment')) {
      return { ok: true, acao: 'ignorado' };
    }

    try {
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${dataId}`,
        { headers: { 'Authorization': `Bearer ${config.access_token}` } }
      );

      if (!response.ok) {
        console.error(`[BRECHAS] Erro ao consultar pagamento MP: ${response.status}`);
        return { ok: false, acao: 'erro_consulta' };
      }

      const pagamento = await response.json() as any;
      const externalRef = pagamento.external_reference;

      if (!externalRef) {
        console.warn('[BRECHAS] Pagamento sem external_reference');
        return { ok: true, acao: 'sem_referencia' };
      }

      // Buscar ODV pelo external_reference (pode ser o ID da ODV ou do cliente)
      let odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(externalRef) as any;
      if (!odv) {
        odv = db.prepare(
          'SELECT * FROM pipeline WHERE cliente_id = ? ORDER BY criado_em DESC LIMIT 1'
        ).get(externalRef) as any;
      }

      if (!odv) {
        console.warn(`[BRECHAS] ODV não encontrada para ref: ${externalRef}`);
        return { ok: false, acao: 'odv_nao_encontrada' };
      }

      // Registrar pagamento
      db.prepare(`
        INSERT OR REPLACE INTO mercadopago_pagamentos (id, pipeline_id, cliente_id, payment_id, status, valor, metodo, parcelas, external_reference, raw_data, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(
        uuidv4(), odv.id, odv.cliente_id, String(dataId),
        pagamento.status, pagamento.transaction_amount,
        pagamento.payment_method_id || 'desconhecido',
        pagamento.installments || 1,
        externalRef,
        JSON.stringify({ status: pagamento.status, amount: pagamento.transaction_amount })
      );

      // Atualizar status de pagamento na ODV
      db.prepare(
        "UPDATE pipeline SET pagamento_status = ?, pagamento_id = ?, pagamento_valor = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
      ).run(pagamento.status, String(dataId), pagamento.transaction_amount, odv.id);

      if (pagamento.status === 'approved') {
        this.processarGanho(odv.id, String(dataId), pagamento.transaction_amount,
          pagamento.payment_method_id, pagamento.installments);
        this.agendarFollowupsColetaEnvio(odv.id);
      }

      saveDb();
      return { ok: true, acao: `pagamento_${pagamento.status}` };
    } catch (e: any) {
      console.error('[BRECHAS] Erro no webhook MP:', e.message);
      return { ok: false, acao: 'erro' };
    }
  }

  // ─── Métodos privados ──────────────────────────────────────────────

  private registrarBrecha(pipelineId: string | null, clienteId: string, tipo: string, descricao: string, acao: string): string {
    const db = getDb();
    const id = uuidv4();
    db.prepare(
      "INSERT INTO brechas_log (id, pipeline_id, cliente_id, tipo, descricao, acao_tomada, criado_em) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))"
    ).run(id, pipelineId, clienteId, tipo, descricao, acao);
    return id;
  }

  private criarTarefaBrecha(clienteId: string, prioridade: string, titulo: string, descricao: string): void {
    const db = getDb();
    // Buscar ODV ativa do cliente
    const odv = db.prepare(
      "SELECT id FROM pipeline WHERE cliente_id = ? ORDER BY atualizado_em DESC LIMIT 1"
    ).get(clienteId) as any;

    db.prepare(`
      INSERT INTO tarefas (id, pipeline_id, cliente_id, titulo, descricao, tipo, prioridade, status, data_vencimento, criado_em)
      VALUES (?, ?, ?, ?, ?, 'geral', ?, 'pendente', datetime('now', 'localtime', '+1 hours'), datetime('now', 'localtime'))
    `).run(uuidv4(), odv?.id || null, clienteId, titulo, descricao, prioridade);
  }

  private normalizarTexto(texto: string): string {
    return texto.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const brechasService = new BrechasService();
