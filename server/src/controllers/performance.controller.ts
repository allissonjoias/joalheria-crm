import { Request, Response } from 'express';
import { getDb } from '../config/database';

export class PerformanceController {
  // Performance das vendedoras - dados do CRM
  vendedoras(req: Request, res: Response) {
    const db = getDb();
    const { periodo = 'mes' } = req.query;

    // Buscar vendedores
    const vendedores = db.prepare(
      "SELECT id, nome, papel FROM usuarios WHERE ativo = 1 AND papel = 'vendedor'"
    ).all() as any[];

    const resultado = vendedores.map((v: any) => {
      // Vendas no periodo
      let vendasSql = 'SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM vendas WHERE vendedor_id = ?';
      if (periodo === 'semana') {
        vendasSql += " AND date(data_venda) >= date('now', '-7 days')";
      } else if (periodo === 'mes') {
        vendasSql += " AND strftime('%Y-%m', data_venda) = strftime('%Y-%m', 'now')";
      } else if (periodo === 'trimestre') {
        vendasSql += " AND date(data_venda) >= date('now', '-90 days')";
      }
      const vendas = db.prepare(vendasSql).get(v.id) as any;

      // Vendas mes atual (sempre)
      const vendasMes = db.prepare(`
        SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total
        FROM vendas WHERE vendedor_id = ? AND strftime('%Y-%m', data_venda) = strftime('%Y-%m', 'now')
      `).get(v.id) as any;

      // Vendas mes anterior
      const vendasMesAnterior = db.prepare(`
        SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total
        FROM vendas WHERE vendedor_id = ? AND strftime('%Y-%m', data_venda) = strftime('%Y-%m', 'now', '-1 month')
      `).get(v.id) as any;

      // Leads atendidos (conversas ativas no periodo)
      const leadsAtendidos = db.prepare(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM conversas c
        WHERE c.vendedor_id = ?
        AND c.canal IS NULL OR c.canal != 'interno'
      `).get(v.id) as any;

      // Pipeline ativo
      const pipelineAtivo = db.prepare(`
        SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_potencial
        FROM pipeline WHERE vendedor_id = ? AND estagio NOT IN ('vendido', 'pos_venda')
      `).get(v.id) as any;

      // Conversao pipeline -> venda (ultimos 90 dias)
      const pipelineTotal = db.prepare(`
        SELECT COUNT(*) as total FROM pipeline WHERE vendedor_id = ? AND date(criado_em) >= date('now', '-90 days')
      `).get(v.id) as any;
      const pipelineVendido = db.prepare(`
        SELECT COUNT(*) as total FROM pipeline WHERE vendedor_id = ? AND estagio = 'vendido' AND date(criado_em) >= date('now', '-90 days')
      `).get(v.id) as any;
      const taxaConversao = pipelineTotal.total > 0 ? Math.round((pipelineVendido.total / pipelineTotal.total) * 100) : 0;

      // Total de clientes
      const totalClientes = db.prepare(
        'SELECT COUNT(*) as total FROM clientes WHERE vendedor_id = ?'
      ).get(v.id) as any;

      // Tarefas pendentes e vencidas
      const tarefasPendentes = db.prepare(
        "SELECT COUNT(*) as total FROM tarefas WHERE vendedor_id = ? AND status = 'pendente'"
      ).get(v.id) as any;
      const tarefasVencidas = db.prepare(
        "SELECT COUNT(*) as total FROM tarefas WHERE vendedor_id = ? AND status = 'pendente' AND data_vencimento < datetime('now', 'localtime')"
      ).get(v.id) as any;

      // Mensagens enviadas hoje
      const msgHoje = db.prepare(`
        SELECT COUNT(*) as total FROM mensagens m
        JOIN conversas c ON m.conversa_id = c.id
        WHERE c.vendedor_id = ? AND m.papel = 'assistant' AND date(m.criado_em) = date('now', 'localtime')
      `).get(v.id) as any;

      // Horas trabalhadas hoje (ponto)
      let minutosPonto = 0;
      try {
        const registrosHoje = db.prepare(`
          SELECT tipo, criado_em FROM ponto
          WHERE usuario_id = ? AND date(criado_em) = date('now', 'localtime')
          ORDER BY criado_em ASC
        `).all(v.id) as any[];

        let ultimaEntrada: Date | null = null;
        for (const r of registrosHoje) {
          if (r.tipo === 'entrada') {
            ultimaEntrada = new Date(r.criado_em);
          } else if (r.tipo === 'saida' && ultimaEntrada) {
            minutosPonto += Math.round((new Date(r.criado_em).getTime() - ultimaEntrada.getTime()) / 60000);
            ultimaEntrada = null;
          }
        }
        if (ultimaEntrada) {
          minutosPonto += Math.round((Date.now() - ultimaEntrada.getTime()) / 60000);
        }
      } catch { /* tabela ponto pode nao existir */ }

      // Variacao vendas mes vs mes anterior
      const variacaoVendas = vendasMesAnterior.valor_total > 0
        ? Math.round(((vendasMes.valor_total - vendasMesAnterior.valor_total) / vendasMesAnterior.valor_total) * 100)
        : vendasMes.valor_total > 0 ? 100 : 0;

      return {
        id: v.id,
        nome: v.nome,
        vendas: {
          total: vendas?.total || 0,
          valor: vendas?.valor_total || 0,
          mes_total: vendasMes.total,
          mes_valor: vendasMes.valor_total,
          variacao: variacaoVendas,
          ticket_medio: vendas?.total > 0 ? Math.round(vendas.valor_total / vendas.total) : 0,
        },
        leads_atendidos: leadsAtendidos.total,
        pipeline: {
          ativo: pipelineAtivo.total,
          valor_potencial: pipelineAtivo.valor_potencial,
          taxa_conversao: taxaConversao,
        },
        clientes_total: totalClientes.total,
        tarefas: {
          pendentes: tarefasPendentes.total,
          vencidas: tarefasVencidas.total,
        },
        mensagens_hoje: msgHoje.total,
        minutos_ponto_hoje: minutosPonto,
      };
    });

    // Ordenar por valor vendido no periodo (melhor performance primeiro)
    resultado.sort((a: any, b: any) => b.vendas.valor - a.vendas.valor);
    res.json(resultado);
  }

  // Tarefas da equipe com foco em atrasos
  tarefasEquipe(req: Request, res: Response) {
    const db = getDb();
    const { usuario_id, periodo = 'todas' } = req.query;

    let sql = `
      SELECT t.*,
        c.nome as cliente_nome,
        u.nome as vendedor_nome,
        CASE
          WHEN t.status = 'pendente' AND t.data_vencimento < datetime('now', 'localtime')
          THEN CAST(julianday('now', 'localtime') - julianday(t.data_vencimento) AS INTEGER)
          ELSE 0
        END as dias_atraso
      FROM tarefas t
      LEFT JOIN clientes c ON t.cliente_id = c.id
      LEFT JOIN usuarios u ON t.vendedor_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (usuario_id) {
      sql += ' AND t.vendedor_id = ?';
      params.push(usuario_id);
    }

    if (periodo === 'hoje') {
      sql += " AND date(t.data_vencimento) = date('now', 'localtime')";
    } else if (periodo === 'semana') {
      sql += " AND date(t.data_vencimento) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')";
    } else if (periodo === 'vencidas') {
      sql += " AND t.status = 'pendente' AND t.data_vencimento < datetime('now', 'localtime')";
    }

    // Nao mostrar concluidas/canceladas por padrao (exceto se pediu todas)
    if (periodo !== 'todas') {
      sql += " AND t.status IN ('pendente', 'em_andamento')";
    }

    sql += ` ORDER BY
      CASE WHEN t.status = 'pendente' AND t.data_vencimento < datetime('now', 'localtime') THEN 0 ELSE 1 END,
      CASE t.prioridade WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      t.data_vencimento ASC`;

    const tarefas = db.prepare(sql).all(...params);

    // Resumo por pessoa
    const resumoPorPessoa = db.prepare(`
      SELECT
        u.id, u.nome,
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN t.status = 'pendente' AND t.data_vencimento < datetime('now', 'localtime') THEN 1 ELSE 0 END) as vencidas,
        SUM(CASE WHEN t.status = 'concluida' AND date(t.concluida_em) >= date('now', '-7 days') THEN 1 ELSE 0 END) as concluidas_semana
      FROM tarefas t
      JOIN usuarios u ON t.vendedor_id = u.id
      WHERE t.status != 'cancelada'
      GROUP BY u.id
      ORDER BY vencidas DESC
    `).all();

    res.json({ tarefas, resumo_equipe: resumoPorPessoa });
  }
}
