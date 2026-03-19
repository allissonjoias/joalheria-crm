import { getDb, saveDb } from '../config/database';
import { SdrEventDetectorService, SdrEvento } from './sdr-event-detector.service';

interface SdrConfig {
  ativo: number;
  telefone_admin: string;
  intervalo_polling: number;
  dias_inatividade: number;
  auto_criar_tasks: number;
  auto_followup: number;
  auto_mover_leads: number;
  deadline_primeiro_contato: number;
  deadline_followup: number;
  deadline_pos_venda: number;
  cron_resumo_manha: string;
  cron_resumo_tarde: string;
  prompt_personalizado: string;
  ultimo_polling: string | null;
}

export class SdrPollingService {
  private detector = new SdrEventDetectorService();

  getConfig(): SdrConfig {
    const db = getDb();
    return db.prepare('SELECT * FROM sdr_agent_config WHERE id = 1').get() as SdrConfig;
  }

  salvarConfig(dados: Partial<SdrConfig>): void {
    const db = getDb();
    const campos: string[] = [];
    const valores: any[] = [];

    const permitidos: (keyof SdrConfig)[] = [
      'ativo', 'telefone_admin', 'intervalo_polling', 'dias_inatividade',
      'auto_criar_tasks', 'auto_followup', 'auto_mover_leads',
      'deadline_primeiro_contato', 'deadline_followup', 'deadline_pos_venda',
      'cron_resumo_manha', 'cron_resumo_tarde', 'prompt_personalizado',
    ];

    for (const campo of permitidos) {
      if (dados[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(dados[campo]);
      }
    }

    if (campos.length === 0) return;

    campos.push("atualizado_em = datetime('now', 'localtime')");
    db.prepare(`UPDATE sdr_agent_config SET ${campos.join(', ')} WHERE id = 1`).run(...valores);
    saveDb();
  }

  async executarPolling(): Promise<SdrEvento[]> {
    const db = getDb();
    const config = this.getConfig();
    const todosEventos: SdrEvento[] = [];

    try {
      // 1. Buscar deals atualizados desde ultimo polling
      let filtroData = '';
      const params: any[] = [];
      if (config.ultimo_polling) {
        filtroData = " AND p.atualizado_em > ?";
        params.push(config.ultimo_polling);
      } else {
        // Primeira vez: deals das ultimas 24h
        filtroData = " AND p.atualizado_em > datetime('now', '-24 hours')";
      }

      const dealsAtualizados = db.prepare(`
        SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone
        FROM pipeline p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE 1=1 ${filtroData}
        ORDER BY p.atualizado_em DESC
      `).all(...params) as any[];

      // 2. Carregar snapshots existentes
      const snapshotMap = new Map<string, any>();
      if (dealsAtualizados.length > 0) {
        const ids = dealsAtualizados.map(d => d.id);
        const placeholders = ids.map(() => '?').join(',');
        const snapshots = db.prepare(
          `SELECT * FROM sdr_agent_lead_snapshot WHERE deal_id IN (${placeholders})`
        ).all(...ids);
        for (const s of snapshots) {
          snapshotMap.set((s as any).deal_id, s);
        }
      }

      // 3. Buscar estagios do tipo 'ganho' para detectar vendas
      const estagiosGanho = db.prepare(
        "SELECT nome FROM funil_estagios WHERE tipo = 'ganho' AND ativo = 1"
      ).all().map((e: any) => e.nome);

      // 4. Detectar eventos
      const eventosDeals = this.detector.detectarEventos(dealsAtualizados, snapshotMap, estagiosGanho);
      todosEventos.push(...eventosDeals);

      // 5. Atualizar snapshots locais
      for (const deal of dealsAtualizados) {
        db.prepare(`
          INSERT INTO sdr_agent_lead_snapshot (deal_id, nome, estagio, valor, atualizado_em)
          VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
          ON CONFLICT(deal_id) DO UPDATE SET
            nome = excluded.nome,
            estagio = excluded.estagio,
            valor = excluded.valor,
            atualizado_em = datetime('now', 'localtime')
        `).run(
          deal.id,
          deal.cliente_nome || deal.titulo || '',
          deal.estagio || '',
          deal.valor || 0
        );
      }

      // 6. Buscar tarefas vencidas
      try {
        const tarefasVencidas = db.prepare(`
          SELECT t.*, c.nome as cliente_nome, p.titulo as deal_titulo
          FROM tarefas t
          LEFT JOIN clientes c ON t.cliente_id = c.id
          LEFT JOIN pipeline p ON t.pipeline_id = p.id
          WHERE t.status = 'pendente' AND t.data_vencimento < datetime('now', 'localtime')
        `).all();
        const eventosTarefas = this.detector.classificarTarefasVencidas(tarefasVencidas);
        todosEventos.push(...eventosTarefas);
      } catch (e) {
        console.error('[SDR] Erro ao buscar tarefas vencidas:', e);
      }

      // 7. Salvar log de cada evento
      for (const evento of todosEventos) {
        db.prepare(
          `INSERT INTO sdr_agent_log (tipo, prioridade, lead_id, lead_nome, descricao) VALUES (?, ?, ?, ?, ?)`
        ).run(evento.tipo, evento.prioridade, evento.leadId || null, evento.leadNome || null, evento.descricao);
      }

      // 8. Atualizar timestamp do ultimo polling
      db.prepare(
        "UPDATE sdr_agent_config SET ultimo_polling = datetime('now', 'localtime'), atualizado_em = datetime('now', 'localtime') WHERE id = 1"
      ).run();
      saveDb();

      console.log(`[SDR] Polling completo: ${dealsAtualizados.length} deals verificados, ${todosEventos.length} eventos detectados`);
    } catch (e) {
      console.error('[SDR] Erro no polling:', e);
    }

    return todosEventos;
  }

  async verificarInativos(): Promise<SdrEvento[]> {
    const db = getDb();
    const config = this.getConfig();

    // Buscar deals que nao foram atualizados ha mais de X dias (excluir ganhos/perdidos)
    const estagiosFinais = db.prepare(
      "SELECT nome FROM funil_estagios WHERE tipo IN ('ganho', 'perdido') AND ativo = 1"
    ).all().map((e: any) => e.nome);

    let filtroEstagios = '';
    if (estagiosFinais.length > 0) {
      const placeholders = estagiosFinais.map(() => '?').join(',');
      filtroEstagios = ` AND p.estagio NOT IN (${placeholders})`;
    }

    const dealsInativos = db.prepare(`
      SELECT p.*, c.nome as cliente_nome
      FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.atualizado_em < datetime('now', '-${config.dias_inatividade} days')
      ${filtroEstagios}
    `).all(...estagiosFinais) as any[];

    const eventos = this.detector.detectarInativos(dealsInativos, config.dias_inatividade);

    for (const evento of eventos) {
      const recente = db.prepare(
        "SELECT id FROM sdr_agent_log WHERE tipo = 'lead_inativo' AND lead_id = ? AND criado_em > datetime('now', '-24 hours')"
      ).get(evento.leadId);

      if (!recente) {
        db.prepare(
          `INSERT INTO sdr_agent_log (tipo, prioridade, lead_id, lead_nome, descricao) VALUES (?, ?, ?, ?, ?)`
        ).run(evento.tipo, evento.prioridade, evento.leadId || null, evento.leadNome || null, evento.descricao);
      }
    }

    saveDb();
    console.log(`[SDR] Verificacao de inativos: ${eventos.length} leads inativos detectados`);
    return eventos;
  }

  obterLogs(filtros: { tipo?: string; limite?: number; offset?: number } = {}): any[] {
    const db = getDb();
    let sql = 'SELECT * FROM sdr_agent_log';
    const params: any[] = [];

    if (filtros.tipo) {
      sql += ' WHERE tipo = ?';
      params.push(filtros.tipo);
    }

    sql += ' ORDER BY criado_em DESC';
    sql += ` LIMIT ? OFFSET ?`;
    params.push(filtros.limite || 50, filtros.offset || 0);

    return db.prepare(sql).all(...params);
  }

  obterStats(): any {
    const db = getDb();

    const total = db.prepare('SELECT COUNT(*) as total FROM sdr_agent_log').get() as any;
    const hoje = db.prepare(
      "SELECT COUNT(*) as total FROM sdr_agent_log WHERE criado_em > datetime('now', '-24 hours')"
    ).get() as any;

    const porTipo = db.prepare(
      "SELECT tipo, COUNT(*) as total FROM sdr_agent_log WHERE criado_em > datetime('now', '-24 hours') GROUP BY tipo"
    ).all() as any[];

    const porPrioridade = db.prepare(
      "SELECT prioridade, COUNT(*) as total FROM sdr_agent_log WHERE criado_em > datetime('now', '-24 hours') GROUP BY prioridade"
    ).all() as any[];

    // Stats locais
    const totalDeals = (db.prepare('SELECT COUNT(*) as c FROM pipeline').get() as any)?.c || 0;
    const tarefasPendentes = (db.prepare("SELECT COUNT(*) as c FROM tarefas WHERE status = 'pendente'").get() as any)?.c || 0;
    const tarefasVencidas = (db.prepare("SELECT COUNT(*) as c FROM tarefas WHERE status = 'pendente' AND data_vencimento < datetime('now', 'localtime')").get() as any)?.c || 0;

    return {
      total_logs: total?.total || 0,
      logs_hoje: hoje?.total || 0,
      por_tipo: porTipo,
      por_prioridade: porPrioridade,
      total_deals: totalDeals,
      tarefas_pendentes: tarefasPendentes,
      tarefas_vencidas: tarefasVencidas,
    };
  }
}
