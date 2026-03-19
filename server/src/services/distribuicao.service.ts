import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';

export class DistribuicaoService {
  // Distribuir um lead automaticamente para a proxima vendedora
  distribuirLead(clienteId: string, titulo: string, valor?: number, origemLead?: string, funilId?: number): { dealId: string; vendedorId: string } | null {
    const db = getDb();

    // Verificar se distribuicao esta ativa
    const config = db.prepare('SELECT * FROM distribuicao_config WHERE id = 1').get() as any;
    if (!config || !config.ativo) return null;

    // Buscar proximo vendedor
    let vendedorId: string | null = null;

    if (config.modo === 'round_robin') {
      vendedorId = this.roundRobin();
    } else if (config.modo === 'menos_ocupado') {
      vendedorId = this.menosOcupado();
    }

    if (!vendedorId) return null;

    // Criar deal no pipeline
    const dealId = uuidv4();
    const estagioDestino = config.estagio_destino || 'Lead';
    const funilDestino = funilId || config.funil_destino_id || 1;

    db.prepare(
      `INSERT INTO pipeline (id, cliente_id, vendedor_id, titulo, valor, estagio, funil_id, origem_lead)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(dealId, clienteId, vendedorId, titulo, valor || null, estagioDestino, funilDestino, origemLead || null);

    // Registrar no historico
    db.prepare(
      `INSERT INTO pipeline_historico (pipeline_id, estagio_novo, usuario_id, automatico, motivo) VALUES (?, ?, ?, 1, 'Distribuicao automatica')`
    ).run(dealId, estagioDestino, vendedorId);

    // Registrar no log de distribuicao
    db.prepare(
      `INSERT INTO distribuicao_log (lead_id, usuario_id, modo) VALUES (?, ?, ?)`
    ).run(dealId, vendedorId, config.modo);

    // Atualizar fila
    db.prepare(
      "UPDATE distribuicao_fila SET ultimo_lead_em = datetime('now', 'localtime'), leads_hoje = leads_hoje + 1 WHERE usuario_id = ?"
    ).run(vendedorId);

    // Auto-criar tarefa se configurado
    if (config.auto_criar_tarefa) {
      const minutos = config.minutos_deadline_tarefa || 30;
      db.prepare(
        `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, tipo, prioridade, data_vencimento)
         VALUES (?, ?, ?, ?, 'primeiro_contato', 'alta', datetime('now', 'localtime', '+${minutos} minutes'))`
      ).run(dealId, clienteId, vendedorId, `Primeiro contato - ${titulo}`);
    }

    saveDb();
    return { dealId, vendedorId };
  }

  private roundRobin(): string | null {
    const db = getDb();

    // Buscar vendedores ativos na fila, ordenados por ultimo_lead_em (quem recebeu ha mais tempo primeiro)
    const proximo = db.prepare(`
      SELECT df.usuario_id FROM distribuicao_fila df
      JOIN usuarios u ON df.usuario_id = u.id
      WHERE df.ativo = 1 AND u.ativo = 1
      ORDER BY df.ultimo_lead_em ASC NULLS FIRST, df.ordem ASC
      LIMIT 1
    `).get() as any;

    return proximo?.usuario_id || null;
  }

  private menosOcupado(): string | null {
    const db = getDb();

    // Buscar vendedor com menos deals em aberto
    const proximo = db.prepare(`
      SELECT df.usuario_id, COUNT(p.id) as deals_abertos
      FROM distribuicao_fila df
      JOIN usuarios u ON df.usuario_id = u.id
      LEFT JOIN pipeline p ON p.vendedor_id = df.usuario_id
        AND p.estagio NOT IN (SELECT nome FROM funil_estagios WHERE tipo IN ('ganho', 'perdido'))
      WHERE df.ativo = 1 AND u.ativo = 1
      GROUP BY df.usuario_id
      ORDER BY deals_abertos ASC, df.ordem ASC
      LIMIT 1
    `).get() as any;

    return proximo?.usuario_id || null;
  }

  // Configurar a fila de distribuicao com vendedores
  configurarFila() {
    const db = getDb();

    // Pegar todos vendedores ativos
    const vendedores = db.prepare(
      "SELECT id FROM usuarios WHERE ativo = 1 AND papel = 'vendedor'"
    ).all() as any[];

    for (let i = 0; i < vendedores.length; i++) {
      const existe = db.prepare(
        'SELECT id FROM distribuicao_fila WHERE usuario_id = ?'
      ).get(vendedores[i].id);

      if (!existe) {
        db.prepare(
          'INSERT INTO distribuicao_fila (usuario_id, ordem) VALUES (?, ?)'
        ).run(vendedores[i].id, i * 10);
      }
    }
    saveDb();
  }

  // Obter config + fila
  obterConfig() {
    const db = getDb();
    const config = db.prepare('SELECT * FROM distribuicao_config WHERE id = 1').get();
    const fila = db.prepare(`
      SELECT df.*, u.nome as vendedor_nome
      FROM distribuicao_fila df
      JOIN usuarios u ON df.usuario_id = u.id
      WHERE u.ativo = 1
      ORDER BY df.ordem ASC
    `).all();
    return { config, fila };
  }
}

export const distribuicaoService = new DistribuicaoService();
