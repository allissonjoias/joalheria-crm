import { getDb, saveDb } from '../config/database';

/**
 * Servico de Ciclo de Vida Unificado
 *
 * Automatiza a transicao da ODV pelas fases:
 * VENDA -> POS-VENDA -> NUTRICAO -> RECOMPRA
 *
 * Triggers:
 * - Ganho (Vendido) -> auto-move para "Preparando Pedido" + cria tarefas
 * - Enviado -> cria tarefa de confirmacao de entrega
 * - Entregue -> agenda nutricao 30/60/90 dias + feedback
 * - Nutricao 90d -> avalia se cliente engajou para criar oportunidade de recompra
 * - Recompra Fechada -> auto-cria nova venda + reinicia ciclo
 */
export class CicloVidaService {

  /**
   * Chamado quando uma ODV atinge estagio tipo "ganho" (ex: Vendido)
   * Auto-move para Preparando Pedido e cria tarefas de pos-venda
   */
  onGanho(odvId: string, usuarioId?: string) {
    const db = getDb();

    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    // Verificar se o estagio de destino existe
    const estagioPreparando = db.prepare(
      "SELECT nome FROM funil_estagios WHERE nome = 'Preparando Pedido' AND funil_id = ? AND ativo = 1"
    ).get(odv.funil_id || 1) as any;

    if (!estagioPreparando) return;

    // Auto-mover para "Preparando Pedido"
    db.prepare(
      "UPDATE pipeline SET estagio = 'Preparando Pedido', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(odvId);

    // Registrar no historico como automatico
    db.prepare(
      `INSERT INTO pipeline_historico (pipeline_id, estagio_anterior, estagio_novo, usuario_id, automatico, motivo)
       VALUES (?, 'Vendido', 'Preparando Pedido', ?, 1, 'Ciclo de vida: pos-venda automatico')`
    ).run(odvId, usuarioId || null);

    // Criar tarefas de pos-venda
    const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(odv.cliente_id) as any;
    const nomeCliente = cliente?.nome || 'Cliente';

    const tarefasPosVenda = [
      {
        titulo: `Preparar pedido - ${nomeCliente}`,
        descricao: `Separar e embalar o pedido de ${nomeCliente}. ${odv.itens_pedido && odv.itens_pedido !== '[]' ? 'Itens: ' + odv.itens_pedido : ''}`,
        tipo: 'pos_venda',
        prioridade: 'alta',
        dias_vencimento: 1,
      },
      {
        titulo: `Enviar comprovante/NF - ${nomeCliente}`,
        descricao: `Enviar nota fiscal e comprovante de pagamento para ${nomeCliente} via WhatsApp`,
        tipo: 'pos_venda',
        prioridade: 'media',
        dias_vencimento: 1,
      },
      {
        titulo: `Confirmar endereco de entrega - ${nomeCliente}`,
        descricao: odv.endereco_entrega
          ? `Confirmar endereco: ${odv.endereco_entrega}`
          : `Solicitar endereco de entrega para ${nomeCliente}`,
        tipo: 'pos_venda',
        prioridade: 'alta',
        dias_vencimento: 0,
      },
    ];

    for (const t of tarefasPosVenda) {
      db.prepare(
        `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime', '+${t.dias_vencimento} days'))`
      ).run(odvId, odv.cliente_id, odv.vendedor_id, t.titulo, t.descricao, t.tipo, t.prioridade);
    }

    saveDb();
    console.log(`[CICLO-VIDA] ODV ${odvId} ganha -> Preparando Pedido. ${tarefasPosVenda.length} tarefas criadas.`);
  }

  /**
   * Chamado quando ODV move para "Enviado"
   * Cria tarefa de confirmar entrega
   */
  onEnviado(odvId: string, usuarioId?: string) {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(odv.cliente_id) as any;
    const nomeCliente = cliente?.nome || 'Cliente';

    // Atualizar data de envio
    db.prepare(
      "UPDATE pipeline SET data_envio = datetime('now', 'localtime'), atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(odvId);

    // Tarefa para acompanhar entrega
    db.prepare(
      `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
       VALUES (?, ?, ?, ?, ?, 'pos_venda', 'alta', datetime('now', 'localtime', '+3 days'))`
    ).run(
      odvId, odv.cliente_id, odv.vendedor_id,
      `Confirmar entrega - ${nomeCliente}`,
      `Verificar se ${nomeCliente} recebeu o pedido. ${odv.transportador ? 'Transportador: ' + odv.transportador : ''}`
    );

    // Tarefa para enviar mensagem de acompanhamento
    db.prepare(
      `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
       VALUES (?, ?, ?, ?, ?, 'pos_venda', 'media', datetime('now', 'localtime', '+1 day'))`
    ).run(
      odvId, odv.cliente_id, odv.vendedor_id,
      `Enviar codigo de rastreio - ${nomeCliente}`,
      `Enviar informacoes de rastreio para ${nomeCliente} via WhatsApp`
    );

    saveDb();
    console.log(`[CICLO-VIDA] ODV ${odvId} enviada. Tarefas de acompanhamento criadas.`);
  }

  /**
   * Chamado quando ODV move para "Entregue"
   * Agenda nutricao em 30, 60 e 90 dias
   */
  onEntregue(odvId: string, usuarioId?: string) {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(odv.cliente_id) as any;
    const nomeCliente = cliente?.nome || 'Cliente';

    // Marcar data de entrega confirmada
    db.prepare(
      "UPDATE pipeline SET data_entrega_confirmada = datetime('now', 'localtime'), atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(odvId);

    // Tarefa imediata: pedir feedback
    db.prepare(
      `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
       VALUES (?, ?, ?, ?, ?, 'pos_venda', 'media', datetime('now', 'localtime', '+2 days'))`
    ).run(
      odvId, odv.cliente_id, odv.vendedor_id,
      `Pedir feedback - ${nomeCliente}`,
      `Perguntar se ${nomeCliente} gostou da peca, pedir foto usando, solicitar avaliacao`
    );

    // Agendar nutricoes futuras
    const agendamentos = [
      { tipo: 'nutricao_30d', dias: 30 },
      { tipo: 'nutricao_60d', dias: 60 },
      { tipo: 'nutricao_90d', dias: 90 },
      { tipo: 'aniversario_compra', dias: 365 },
    ];

    for (const ag of agendamentos) {
      db.prepare(
        `INSERT INTO ciclo_vida_agendamentos (pipeline_id, tipo, data_agendada)
         VALUES (?, ?, datetime('now', 'localtime', '+${ag.dias} days'))`
      ).run(odvId, ag.tipo);
    }

    db.prepare(
      "UPDATE pipeline SET proxima_nutricao = datetime('now', 'localtime', '+30 days'), ciclo_nutricao = 0 WHERE id = ?"
    ).run(odvId);

    saveDb();
    console.log(`[CICLO-VIDA] ODV ${odvId} entregue. Nutricao agendada: 30d, 60d, 90d, aniversario.`);
  }

  /**
   * Executado pelo cron - verifica agendamentos de nutricao pendentes
   * Move ODVs para o estagio correto e cria tarefas de contato
   */
  processarNutricoes() {
    const db = getDb();

    const pendentes = db.prepare(`
      SELECT a.*, p.cliente_id, p.vendedor_id, p.titulo as odv_titulo, p.estagio, p.funil_id,
             c.nome as cliente_nome, c.telefone as cliente_telefone
      FROM ciclo_vida_agendamentos a
      JOIN pipeline p ON a.pipeline_id = p.id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE a.executado = 0 AND a.data_agendada <= datetime('now', 'localtime')
      ORDER BY a.data_agendada ASC
    `).all() as any[];

    if (pendentes.length === 0) return;

    console.log(`[CICLO-VIDA] Processando ${pendentes.length} agendamentos de nutricao...`);

    for (const ag of pendentes) {
      try {
        this.executarAgendamento(ag);
      } catch (e: any) {
        console.error(`[CICLO-VIDA] Erro ao processar agendamento ${ag.id}:`, e.message);
      }
    }

    saveDb();
  }

  private executarAgendamento(ag: any) {
    const db = getDb();
    const nomeCliente = ag.cliente_nome || 'Cliente';

    let novoEstagio = '';
    let tituloTarefa = '';
    let descricaoTarefa = '';
    let cicloNum = 0;

    switch (ag.tipo) {
      case 'nutricao_30d':
        novoEstagio = 'Recompra';
        cicloNum = 1;
        tituloTarefa = `Nutricao 30 dias - ${nomeCliente}`;
        descricaoTarefa = `Faz 30 dias que ${nomeCliente} recebeu o pedido. Enviar mensagem perguntando como esta a peca, se precisa de ajuste, e apresentar novidades.`;
        break;

      case 'nutricao_60d':
        novoEstagio = 'Recompra';
        cicloNum = 2;
        tituloTarefa = `Nutricao 60 dias - ${nomeCliente}`;
        descricaoTarefa = `Faz 60 dias da compra de ${nomeCliente}. Enviar conteudo exclusivo, lancamentos ou promocao personalizada.`;
        break;

      case 'nutricao_90d':
        novoEstagio = 'Recompra';
        cicloNum = 3;
        tituloTarefa = `Nutricao 90 dias - ${nomeCliente}`;
        descricaoTarefa = `Faz 90 dias da compra de ${nomeCliente}. Momento ideal para sondar recompra. Verificar interesse em novas pecas, presentear alguem, datas comemorativas proximas.`;
        break;

      case 'aniversario_compra':
        tituloTarefa = `Aniversario de compra - ${nomeCliente}`;
        descricaoTarefa = `Faz 1 ano que ${nomeCliente} comprou! Enviar mensagem especial de agradecimento e oferta exclusiva de fidelidade.`;
        break;

      case 'feedback':
        tituloTarefa = `Solicitar feedback - ${nomeCliente}`;
        descricaoTarefa = `Pedir feedback sobre a experiencia de compra e avaliacao.`;
        break;

      case 'acompanhamento_perdido':
        // Tarefas ja foram criadas em onPerdido(), apenas marcar como executado
        break;
    }

    // Mover ODV para novo estagio (se aplicavel)
    if (novoEstagio) {
      const estagioExiste = db.prepare(
        "SELECT id FROM funil_estagios WHERE nome = ? AND funil_id = ? AND ativo = 1"
      ).get(novoEstagio, ag.funil_id || 1);

      if (estagioExiste) {
        const estagioAnterior = ag.estagio;

        db.prepare(
          "UPDATE pipeline SET estagio = ?, ciclo_nutricao = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(novoEstagio, cicloNum, ag.pipeline_id);

        db.prepare(
          `INSERT INTO pipeline_historico (pipeline_id, estagio_anterior, estagio_novo, automatico, motivo)
           VALUES (?, ?, ?, 1, ?)`
        ).run(ag.pipeline_id, estagioAnterior, novoEstagio, `Ciclo de vida: ${ag.tipo}`);
      }
    }

    // Criar tarefa
    if (tituloTarefa) {
      db.prepare(
        `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
         VALUES (?, ?, ?, ?, ?, 'followup', 'media', datetime('now', 'localtime', '+2 days'))`
      ).run(ag.pipeline_id, ag.cliente_id, ag.vendedor_id, tituloTarefa, descricaoTarefa);
    }

    // Marcar como executado
    db.prepare(
      "UPDATE ciclo_vida_agendamentos SET executado = 1, executado_em = datetime('now', 'localtime'), resultado = 'ok' WHERE id = ?"
    ).run(ag.id);

    console.log(`[CICLO-VIDA] Agendamento ${ag.tipo} executado para ODV ${ag.pipeline_id} (${nomeCliente})`);
  }

  /**
   * Cria nova ODV de recompra vinculada ao mesmo cliente
   */
  criarOportunidadeRecompra(odvId: string, usuarioId?: string) {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return null;

    const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(odv.cliente_id) as any;
    const nomeCliente = cliente?.nome || 'Cliente';

    // Criar nova ODV de recompra
    const { v4: uuidv4 } = require('uuid');
    const novoId = uuidv4();

    db.prepare(
      `INSERT INTO pipeline (id, cliente_id, vendedor_id, titulo, valor, estagio, funil_id, tipo_cliente, origem_lead)
       VALUES (?, ?, ?, ?, 0, 'Oportunidade Recompra', ?, 'recompra', 'Reativacao de Perdido')`
    ).run(novoId, odv.cliente_id, odv.vendedor_id || usuarioId, `${nomeCliente} - Recompra`, odv.funil_id || 1);

    // Historico
    db.prepare(
      `INSERT INTO pipeline_historico (pipeline_id, estagio_novo, automatico, motivo)
       VALUES (?, 'Oportunidade Recompra', 1, 'Ciclo de vida: recompra apos nutricao 90d')`
    ).run(novoId);

    // Tarefa
    db.prepare(
      `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
       VALUES (?, ?, ?, ?, ?, 'followup', 'alta', datetime('now', 'localtime', '+1 day'))`
    ).run(
      novoId, odv.cliente_id, odv.vendedor_id || usuarioId,
      `Abordar recompra - ${nomeCliente}`,
      `Cliente ${nomeCliente} completou o ciclo de nutricao (90 dias). Sondar interesse em nova compra, apresentar lancamentos e ofertas exclusivas de fidelidade.`
    );

    saveDb();
    console.log(`[CICLO-VIDA] Oportunidade de recompra criada: ${novoId} para ${nomeCliente}`);
    return novoId;
  }

  /**
   * Chamado quando ODV move para "Cancelado/Devolvido"
   * Estorna a venda, cancela nutricoes e cria tarefas de devolucao
   */
  onEstorno(odvId: string, motivoEstorno: string, usuarioId?: string) {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(odv.cliente_id) as any;
    const nomeCliente = cliente?.nome || 'Cliente';

    // Marcar venda como estornada (nao deleta, so marca)
    const venda = db.prepare('SELECT id FROM vendas WHERE pipeline_id = ? AND estornada = 0').get(odvId) as any;
    if (venda) {
      db.prepare(
        "UPDATE vendas SET estornada = 1, motivo_estorno = ?, data_estorno = datetime('now', 'localtime') WHERE id = ?"
      ).run(motivoEstorno || 'Cancelamento/Devolucao', venda.id);
      console.log(`[CICLO-VIDA] Venda ${venda.id} estornada para ODV ${odvId}`);
    }

    // Cancelar todos os agendamentos de nutricao pendentes
    db.prepare(
      "UPDATE ciclo_vida_agendamentos SET executado = 1, resultado = 'cancelado_estorno', executado_em = datetime('now', 'localtime') WHERE pipeline_id = ? AND executado = 0"
    ).run(odvId);

    // Cancelar tarefas pendentes vinculadas a esta ODV
    db.prepare(
      "UPDATE tarefas SET status = 'cancelada', atualizado_em = datetime('now', 'localtime') WHERE pipeline_id = ? AND status IN ('pendente', 'em_andamento')"
    ).run(odvId);

    // Criar tarefas de estorno/devolucao
    const tarefasEstorno = [
      {
        titulo: `Processar estorno - ${nomeCliente}`,
        descricao: `Processar reembolso para ${nomeCliente}. Motivo: ${motivoEstorno || 'Nao informado'}. Valor: R$${odv.valor || 0}. ${odv.forma_pagamento ? 'Pagamento original: ' + odv.forma_pagamento : ''}`,
        prioridade: 'urgente',
      },
      {
        titulo: `Contatar cliente sobre cancelamento - ${nomeCliente}`,
        descricao: `Entrar em contato com ${nomeCliente} para alinhar processo de devolucao/estorno e tentar entender o motivo para evitar futuramente.`,
        prioridade: 'alta',
      },
    ];

    for (const t of tarefasEstorno) {
      db.prepare(
        `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
         VALUES (?, ?, ?, ?, ?, 'pos_venda', ?, datetime('now', 'localtime', '+1 day'))`
      ).run(odvId, odv.cliente_id, odv.vendedor_id, t.titulo, t.descricao, t.prioridade);
    }

    saveDb();
    console.log(`[CICLO-VIDA] Estorno processado para ODV ${odvId} (${nomeCliente}). Motivo: ${motivoEstorno}`);
  }

  /**
   * Chamado quando ODV move para estagio tipo "perdido" na fase de venda
   * Agenda acompanhamento diferenciado: lead vs cliente
   */
  onPerdido(odvId: string, motivoPerda: string, usuarioId?: string) {
    const db = getDb();
    const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(odvId) as any;
    if (!odv) return;

    const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(odv.cliente_id) as any;
    const nomeCliente = cliente?.nome || 'Cliente';

    // Verificar se e cliente (ja comprou antes) ou lead (nunca comprou)
    const vendasAnteriores = db.prepare(
      'SELECT COUNT(*) as total FROM vendas WHERE cliente_id = ? AND estornada = 0'
    ).get(odv.cliente_id) as any;
    const ehCliente = vendasAnteriores?.total > 0;
    const tipo = ehCliente ? 'cliente' : 'lead';

    console.log(`[CICLO-VIDA] ODV ${odvId} perdida. ${nomeCliente} classificado como: ${tipo}`);

    if (ehCliente) {
      // CLIENTE PERDIDO: ciclo curto e mais pessoal (ja tem relacionamento)
      const agendamentos = [
        { tipo: 'acompanhamento_perdido', dias: 3, titulo: `Acompanhar cliente perdido - ${nomeCliente}`, desc: `${nomeCliente} ja e cliente mas perdemos esta ODV (motivo: ${motivoPerda || 'nao informado'}). Entrar em contato para entender o que aconteceu e manter o relacionamento. Nao insistir na venda, focar no relacionamento.` },
        { tipo: 'acompanhamento_perdido', dias: 15, titulo: `Reativar cliente - ${nomeCliente}`, desc: `Faz 15 dias que perdemos a ODV de ${nomeCliente}. Enviar novidade ou oferta personalizada baseada no historico de compras anteriores.` },
        { tipo: 'acompanhamento_perdido', dias: 45, titulo: `Reconquistar cliente - ${nomeCliente}`, desc: `45 dias desde a perda. Se ${nomeCliente} nao reengajou, avaliar se vale criar uma nova ODV com abordagem diferente ou condicao especial.` },
      ];

      for (const ag of agendamentos) {
        db.prepare(
          `INSERT INTO ciclo_vida_agendamentos (pipeline_id, tipo, data_agendada)
           VALUES (?, ?, datetime('now', 'localtime', '+${ag.dias} days'))`
        ).run(odvId, ag.tipo);

        db.prepare(
          `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
           VALUES (?, ?, ?, ?, ?, 'followup', ?, datetime('now', 'localtime', '+${ag.dias} days'))`
        ).run(odvId, odv.cliente_id, odv.vendedor_id, ag.titulo, ag.desc, ag.dias <= 3 ? 'alta' : 'media');
      }
    } else {
      // LEAD PERDIDO: ciclo mais longo e educativo (ainda nao tem confianca)
      const agendamentos = [
        { tipo: 'acompanhamento_perdido', dias: 7, titulo: `Acompanhar lead perdido - ${nomeCliente}`, desc: `${nomeCliente} era um lead que perdemos (motivo: ${motivoPerda || 'nao informado'}). Enviar mensagem leve, sem pressao. Perguntar se ainda tem interesse ou se pode ajudar de outra forma.` },
        { tipo: 'acompanhamento_perdido', dias: 30, titulo: `Reativar lead - ${nomeCliente}`, desc: `Faz 30 dias que perdemos o lead ${nomeCliente}. Enviar conteudo de valor: novidades, lancamentos, depoimentos de clientes. Nao insistir na venda direta.` },
        { tipo: 'acompanhamento_perdido', dias: 60, titulo: `Ultima tentativa lead - ${nomeCliente}`, desc: `60 dias desde a perda do lead ${nomeCliente}. Enviar oferta especial ou condicao exclusiva. Se nao engajar, manter apenas em campanhas de massa.` },
        { tipo: 'acompanhamento_perdido', dias: 90, titulo: `Avaliar reativacao - ${nomeCliente}`, desc: `90 dias desde a perda. Avaliar se vale manter ${nomeCliente} na base ativa ou apenas em campanhas sazonais (Natal, Dia das Maes, etc).` },
      ];

      for (const ag of agendamentos) {
        db.prepare(
          `INSERT INTO ciclo_vida_agendamentos (pipeline_id, tipo, data_agendada)
           VALUES (?, ?, datetime('now', 'localtime', '+${ag.dias} days'))`
        ).run(odvId, ag.tipo);

        db.prepare(
          `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
           VALUES (?, ?, ?, ?, ?, 'followup', 'media', datetime('now', 'localtime', '+${ag.dias} days'))`
        ).run(odvId, odv.cliente_id, odv.vendedor_id, ag.titulo, ag.desc);
      }
    }

    saveDb();
    console.log(`[CICLO-VIDA] Acompanhamento de perdido agendado: ${tipo}, ${ehCliente ? 3 : 4} tarefas para ${nomeCliente}`);
  }

  /**
   * Detecta automaticamente qual acao tomar com base na mudanca de estagio
   */
  onMudancaEstagio(odvId: string, estagioAnterior: string, estagioNovo: string, usuarioId?: string, motivoPerda?: string) {
    const db = getDb();

    // Verificar se e estagio perdido
    const estagioPerdido = db.prepare(
      "SELECT id, fase FROM funil_estagios WHERE nome = ? AND tipo = 'perdido'"
    ).get(estagioNovo) as any;

    if (estagioPerdido) {
      if (estagioPerdido.fase === 'pos_venda') {
        // Estorno: perdido na fase pos-venda
        this.onEstorno(odvId, motivoPerda || '', usuarioId);
      } else {
        // Perdido normal: agendar acompanhamento diferenciado
        this.onPerdido(odvId, motivoPerda || '', usuarioId);
      }
      return;
    }

    // Verificar se e estagio ganho
    const estagioGanho = db.prepare(
      "SELECT id, fase FROM funil_estagios WHERE nome = ? AND tipo = 'ganho'"
    ).get(estagioNovo) as any;

    if (estagioGanho) {
      if (estagioGanho.fase === 'recompra') {
        console.log(`[CICLO-VIDA] Recompra fechada para ODV ${odvId}`);
      } else {
        // Ganho normal - iniciar pos-venda
        this.onGanho(odvId, usuarioId);
      }
      return;
    }

    // Triggers por nome de estagio
    switch (estagioNovo) {
      case 'Enviado':
        this.onEnviado(odvId, usuarioId);
        break;
      case 'Entregue':
        this.onEntregue(odvId, usuarioId);
        break;
    }

    // Executar automacoes configuradas para esta transicao de estagio
    this.executarAutomacoesEtapa(odvId, estagioAnterior, estagioNovo);
  }

  /**
   * Executa automacoes configuradas para transicao de estagio
   */
  public executarAutomacoesEtapa(odvId: string, estagioAnterior: string, estagioNovo: string) {
    const db = getDb();
    try {
      // Buscar automacoes ativas para este estagio destino
      const automacoes = db.prepare(
        `SELECT * FROM automacao_etapas
         WHERE estagio_destino = ? AND ativo = 1
         AND (estagio_origem IS NULL OR estagio_origem = ?)
         ORDER BY ordem`
      ).all(estagioNovo, estagioAnterior) as any[];

      if (!automacoes.length) return;

      const odv = db.prepare(
        'SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone FROM pipeline p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?'
      ).get(odvId) as any;
      if (!odv) return;

      for (const auto of automacoes) {
        try {
          const config = JSON.parse(auto.config || '{}');
          this.executarAcao(auto, config, odv);

          // Log de sucesso
          db.prepare(
            `INSERT INTO automacao_etapas_log (automacao_id, pipeline_id, cliente_id, status, resultado)
             VALUES (?, ?, ?, 'executado', ?)`
          ).run(auto.id, odvId, odv.cliente_id, `${auto.tipo_acao}: ${auto.descricao || estagioNovo}`);
        } catch (e: any) {
          console.error(`[AUTOMACAO-ETAPA] Erro ao executar #${auto.id}:`, e.message);
          db.prepare(
            `INSERT INTO automacao_etapas_log (automacao_id, pipeline_id, cliente_id, status, resultado)
             VALUES (?, ?, ?, 'erro', ?)`
          ).run(auto.id, odvId, odv.cliente_id, e.message);
        }
      }
      saveDb();
    } catch (e: any) {
      console.error('[AUTOMACAO-ETAPA] Erro geral:', e.message);
    }
  }

  /**
   * Executa uma acao individual de automacao
   */
  private executarAcao(automacao: any, config: any, odv: any) {
    const db = getDb();

    switch (automacao.tipo_acao) {
      case 'enviar_whatsapp': {
        if (!odv.cliente_telefone || !config.mensagem) break;
        // Substituir variaveis na mensagem
        let msg = config.mensagem
          .replace(/\{nome\}/g, odv.cliente_nome || 'Cliente')
          .replace(/\{titulo\}/g, odv.titulo || '')
          .replace(/\{valor\}/g, odv.valor ? `R$ ${Number(odv.valor).toFixed(2).replace('.', ',')}` : '')
          .replace(/\{estagio\}/g, automacao.estagio_destino)
          .replace(/\{rastreio\}/g, odv.codigo_rastreio || '')
          .replace(/\{endereco\}/g, odv.endereco_entrega || '');
        // Agendar envio via fila (async, nao bloqueia)
        try {
          const { whatsappQueueService } = require('./whatsapp-queue.service');
          whatsappQueueService.enviarMensagemDireta(odv.cliente_id, odv.cliente_telefone, msg);
        } catch (e: any) {
          console.error('[AUTOMACAO] Erro WhatsApp:', e.message);
        }
        console.log(`[AUTOMACAO-ETAPA] WhatsApp enviado para ${odv.cliente_nome}: ${msg.substring(0, 50)}...`);
        break;
      }

      case 'criar_tarefa': {
        const titulo = (config.titulo || `Tarefa automatica - ${automacao.estagio_destino}`)
          .replace(/\{nome\}/g, odv.cliente_nome || 'Cliente');
        const descricao = (config.descricao || '')
          .replace(/\{nome\}/g, odv.cliente_nome || 'Cliente');
        const dias = config.dias_vencimento || 1;
        db.prepare(
          `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
           VALUES (?, ?, ?, ?, ?, 'geral', ?, datetime('now', 'localtime', '+${dias} days'))`
        ).run(odv.id, odv.cliente_id, odv.vendedor_id, titulo, descricao, config.prioridade || 'media');
        console.log(`[AUTOMACAO-ETAPA] Tarefa criada: ${titulo}`);
        break;
      }

      case 'mover_estagio': {
        if (!config.estagio_alvo) break;
        db.prepare(
          "UPDATE pipeline SET estagio = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(config.estagio_alvo, odv.id);
        db.prepare(
          `INSERT INTO pipeline_historico (pipeline_id, estagio_anterior, estagio_novo, automatico, motivo)
           VALUES (?, ?, ?, 1, ?)`
        ).run(odv.id, automacao.estagio_destino, config.estagio_alvo, `Automacao: ${automacao.descricao || 'mover automatico'}`);
        console.log(`[AUTOMACAO-ETAPA] ODV movida para ${config.estagio_alvo}`);
        break;
      }

      case 'notificar_equipe': {
        const msg = (config.mensagem || `ODV ${odv.titulo} chegou em ${automacao.estagio_destino}`)
          .replace(/\{nome\}/g, odv.cliente_nome || 'Cliente')
          .replace(/\{titulo\}/g, odv.titulo || '')
          .replace(/\{estagio\}/g, automacao.estagio_destino);
        console.log(`[AUTOMACAO-ETAPA] Notificacao equipe: ${msg}`);
        break;
      }

      case 'atualizar_campo': {
        if (!config.campo || config.valor === undefined) break;
        const camposPermitidos = ['forma_envio', 'tipo_pedido', 'forma_atendimento', 'observacao_pedido', 'classificacao'];
        if (camposPermitidos.includes(config.campo)) {
          db.prepare(
            `UPDATE pipeline SET ${config.campo} = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`
          ).run(config.valor, odv.id);
          console.log(`[AUTOMACAO-ETAPA] Campo ${config.campo} atualizado para ${config.valor}`);
        }
        break;
      }
    }
  }

  /**
   * Executa automações baseadas em gatilho (ao_cliente_responder, por_lead_score, etc.)
   * Chamado de outros serviços quando eventos ocorrem
   */
  public executarAutomacoesGatilho(gatilho: string, clienteId: string, dados?: { score?: number; conversaId?: string }) {
    const db = getDb();
    try {
      // Buscar ODVs ativas do cliente no funil 10
      const odvs = db.prepare(
        "SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone FROM pipeline p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.cliente_id = ? AND p.funil_id = 10"
      ).all(clienteId) as any[];

      if (!odvs.length) return;

      for (const odv of odvs) {
        // Buscar automacoes com este gatilho onde o ODV esta no estagio_origem
        const automacoes = db.prepare(
          `SELECT * FROM automacao_etapas
           WHERE gatilho = ? AND estagio_origem = ? AND ativo = 1 AND funil_id = 10
           ORDER BY ordem`
        ).all(gatilho, odv.estagio) as any[];

        for (const auto of automacoes) {
          try {
            const config = JSON.parse(auto.config || '{}');

            // Verificar condicoes especificas do gatilho
            if (gatilho === 'por_lead_score') {
              const scoreMinimo = config.score_minimo || 0;
              const scoreMaximo = config.score_maximo || 999;
              const scoreAtual = dados?.score || 0;
              if (scoreAtual < scoreMinimo || scoreAtual > scoreMaximo) continue;
            }

            // Executar a acao
            this.executarAcao(auto, config, odv);

            // Log de sucesso
            db.prepare(
              `INSERT INTO automacao_etapas_log (automacao_id, pipeline_id, cliente_id, status, resultado)
               VALUES (?, ?, ?, 'executado', ?)`
            ).run(auto.id, odv.id, odv.cliente_id, `Gatilho ${gatilho}: ${auto.descricao || auto.tipo_acao}`);

            console.log(`[AUTOMACAO-GATILHO] ${gatilho} → ${auto.tipo_acao} para ODV ${odv.id} (${odv.estagio})`);
          } catch (e: any) {
            console.error(`[AUTOMACAO-GATILHO] Erro #${auto.id}:`, e.message);
            db.prepare(
              `INSERT INTO automacao_etapas_log (automacao_id, pipeline_id, cliente_id, status, resultado)
               VALUES (?, ?, ?, 'erro', ?)`
            ).run(auto.id, odv.id, odv.cliente_id, e.message);
          }
        }
      }
      saveDb();
    } catch (e: any) {
      console.error('[AUTOMACAO-GATILHO] Erro geral:', e.message);
    }
  }

  /**
   * Retorna resumo do ciclo de vida de uma ODV
   */
  obterResumoCiclo(odvId: string) {
    const db = getDb();

    const agendamentos = db.prepare(`
      SELECT * FROM ciclo_vida_agendamentos
      WHERE pipeline_id = ? ORDER BY data_agendada ASC
    `).all(odvId) as any[];

    const historico = db.prepare(`
      SELECT * FROM pipeline_historico
      WHERE pipeline_id = ? AND automatico = 1
      ORDER BY criado_em ASC
    `).all(odvId) as any[];

    return { agendamentos, historico };
  }
}

export const cicloVidaService = new CicloVidaService();
