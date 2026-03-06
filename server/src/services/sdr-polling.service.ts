import { getDb } from '../config/database';
import { KommoService } from './kommo.service';
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

const STATUS_VENDA_IDS = [142, 143]; // IDs tipicos de "venda fechada" no Kommo - configuravel

export class SdrPollingService {
  private kommo = new KommoService();
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

    campos.push("atualizado_em = datetime('now')");
    db.prepare(`UPDATE sdr_agent_config SET ${campos.join(', ')} WHERE id = 1`).run(...valores);
  }

  async executarPolling(): Promise<SdrEvento[]> {
    const db = getDb();
    const config = this.getConfig();

    // Determinar timestamp do ultimo polling
    let updatedSince: number;
    if (config.ultimo_polling) {
      updatedSince = Math.floor(new Date(config.ultimo_polling).getTime() / 1000);
    } else {
      // Primeira vez: buscar leads das ultimas 24h
      updatedSince = Math.floor(Date.now() / 1000) - 86400;
    }

    const todosEventos: SdrEvento[] = [];

    try {
      // 1. Buscar leads atualizados
      const leadsData = await this.kommo.fetchLeadsAtualizados(updatedSince);
      const leadsKommo = leadsData?._embedded?.leads || [];

      // 2. Carregar snapshots existentes
      const snapshotMap = new Map<number, any>();
      if (leadsKommo.length > 0) {
        const ids = leadsKommo.map((l: any) => l.id);
        const placeholders = ids.map(() => '?').join(',');
        const snapshots = db.prepare(
          `SELECT * FROM sdr_agent_lead_snapshot WHERE kommo_lead_id IN (${placeholders})`
        ).all(...ids);
        for (const s of snapshots) {
          snapshotMap.set((s as any).kommo_lead_id, s);
        }
      }

      // 3. Detectar eventos
      const eventosLeads = this.detector.detectarEventos(leadsKommo, snapshotMap, STATUS_VENDA_IDS);
      todosEventos.push(...eventosLeads);

      // 4. Atualizar snapshots
      for (const lead of leadsKommo) {
        db.prepare(`
          INSERT INTO sdr_agent_lead_snapshot (kommo_lead_id, nome, pipeline_id, status_id, responsavel_id, valor, updated_at, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(kommo_lead_id) DO UPDATE SET
            nome = excluded.nome,
            pipeline_id = excluded.pipeline_id,
            status_id = excluded.status_id,
            responsavel_id = excluded.responsavel_id,
            valor = excluded.valor,
            updated_at = excluded.updated_at,
            atualizado_em = datetime('now')
        `).run(
          lead.id,
          lead.name || '',
          lead.pipeline_id || 0,
          lead.status_id || 0,
          lead.responsible_user_id || 0,
          lead.price || 0,
          lead.updated_at || 0
        );
      }

      // 5. Buscar tasks vencidas
      try {
        const tasksData = await this.kommo.fetchTasksVencidas();
        const tasks = tasksData?._embedded?.tasks || [];
        const eventosTasksVencidas = this.detector.classificarTasksVencidas(tasks);
        todosEventos.push(...eventosTasksVencidas);
      } catch (e) {
        console.error('[SDR] Erro ao buscar tasks vencidas:', e);
      }

      // 6. Salvar log de cada evento
      for (const evento of todosEventos) {
        db.prepare(
          `INSERT INTO sdr_agent_log (tipo, prioridade, lead_id, lead_nome, descricao) VALUES (?, ?, ?, ?, ?)`
        ).run(evento.tipo, evento.prioridade, evento.leadId || null, evento.leadNome || null, evento.descricao);
      }

      // 7. Atualizar timestamp do ultimo polling
      db.prepare(
        "UPDATE sdr_agent_config SET ultimo_polling = datetime('now'), atualizado_em = datetime('now') WHERE id = 1"
      ).run();

      console.log(`[SDR] Polling completo: ${leadsKommo.length} leads verificados, ${todosEventos.length} eventos detectados`);
    } catch (e) {
      console.error('[SDR] Erro no polling:', e);
    }

    return todosEventos;
  }

  async verificarInativos(): Promise<SdrEvento[]> {
    const db = getDb();
    const config = this.getConfig();

    const snapshots = db.prepare('SELECT * FROM sdr_agent_lead_snapshot').all() as any[];
    const eventos = this.detector.detectarInativos(snapshots, config.dias_inatividade);

    for (const evento of eventos) {
      // Evitar duplicatas: so loga se nao houver log recente do mesmo lead inativo
      const recente = db.prepare(
        "SELECT id FROM sdr_agent_log WHERE tipo = 'lead_inativo' AND lead_id = ? AND criado_em > datetime('now', '-24 hours')"
      ).get(evento.leadId);

      if (!recente) {
        db.prepare(
          `INSERT INTO sdr_agent_log (tipo, prioridade, lead_id, lead_nome, descricao) VALUES (?, ?, ?, ?, ?)`
        ).run(evento.tipo, evento.prioridade, evento.leadId || null, evento.leadNome || null, evento.descricao);
      }
    }

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

    return {
      total_logs: total?.total || 0,
      logs_hoje: hoje?.total || 0,
      por_tipo: porTipo,
      por_prioridade: porPrioridade,
    };
  }
}
