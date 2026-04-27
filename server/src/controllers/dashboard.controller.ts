import { Request, Response } from 'express';
import { getDb } from '../config/database';

export class DashboardController {
  resumo(req: Request, res: Response) {
    const db = getDb();
    const vendedorFilter = req.usuario?.papel === 'vendedor' ? req.usuario.id : null;

    // Total sales
    let vendasQuery = 'SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM vendas';
    const vendasParams: any[] = [];
    if (vendedorFilter) {
      vendasQuery += ' WHERE vendedor_id = ?';
      vendasParams.push(vendedorFilter);
    }
    const vendas = db.prepare(vendasQuery).get(...vendasParams) as any;

    // Sales this month
    let mesQuery = `SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM vendas
      WHERE strftime('%Y-%m', data_venda) = strftime('%Y-%m', 'now')`;
    if (vendedorFilter) {
      mesQuery += ' AND vendedor_id = ?';
    }
    const vendasMes = db.prepare(mesQuery).get(...(vendedorFilter ? [vendedorFilter] : [])) as any;

    // Clients count
    let clientesQuery = 'SELECT COUNT(*) as total FROM clientes';
    if (vendedorFilter) {
      clientesQuery += ' WHERE vendedor_id = ?';
    }
    const clientes = db.prepare(clientesQuery).get(...(vendedorFilter ? [vendedorFilter] : [])) as any;

    // Pipeline by stage
    let pipelineQuery = `SELECT estagio, COUNT(*) as total, COALESCE(SUM(valor), 0) as valor
      FROM pipeline GROUP BY estagio`;
    const pipeline = db.prepare(pipelineQuery).all() as any[];

    // Pending reminders
    let lembretesQuery = `SELECT COUNT(*) as total FROM lembretes
      WHERE concluido = 0 AND date(data_lembrete) <= date('now')`;
    if (vendedorFilter) {
      lembretesQuery += ' AND vendedor_id = ?';
    }
    const lembretes = db.prepare(lembretesQuery).get(...(vendedorFilter ? [vendedorFilter] : [])) as any;

    const ticketMedio = vendas.total > 0 ? vendas.valor_total / vendas.total : 0;

    res.json({
      vendas_total: vendas.total,
      vendas_valor: vendas.valor_total,
      vendas_mes_total: vendasMes.total,
      vendas_mes_valor: vendasMes.valor_total,
      ticket_medio: ticketMedio,
      clientes_total: clientes.total,
      pipeline,
      lembretes_pendentes: lembretes.total,
    });
  }

  vendasPorPeriodo(req: Request, res: Response) {
    const db = getDb();
    const { dias = 30 } = req.query;
    const vendedorFilter = req.usuario?.papel === 'vendedor' ? req.usuario.id : null;

    let query = `
      SELECT date(data_venda) as data, COUNT(*) as total, SUM(valor) as valor
      FROM vendas
      WHERE date(data_venda) >= date('now', '-${Number(dias)} days')
    `;
    if (vendedorFilter) {
      query += ' AND vendedor_id = ?';
    }
    query += ' GROUP BY date(data_venda) ORDER BY data';

    const dados = db.prepare(query).all(...(vendedorFilter ? [vendedorFilter] : []));
    res.json(dados);
  }

  vendasPorCategoria(req: Request, res: Response) {
    const db = getDb();
    const query = `
      SELECT p.categoria, COUNT(*) as total, SUM(v.valor) as valor
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE p.categoria IS NOT NULL
      GROUP BY p.categoria
      ORDER BY valor DESC
    `;
    const dados = db.prepare(query).all();
    res.json(dados);
  }

  topProdutos(req: Request, res: Response) {
    const db = getDb();
    const query = `
      SELECT p.nome, p.categoria, COUNT(*) as vendas, SUM(v.valor) as valor_total
      FROM vendas v
      JOIN produtos p ON v.produto_id = p.id
      GROUP BY p.id
      ORDER BY vendas DESC
      LIMIT 10
    `;
    const dados = db.prepare(query).all();
    res.json(dados);
  }

  rankingClientes(req: Request, res: Response) {
    const db = getDb();
    const ordem = (req.query.ordem as string) || 'valor_total';
    const limite = Number(req.query.limite) || 20;

    const ordensValidas: Record<string, string> = {
      valor_total: 'valor_total DESC',
      quantidade: 'total_compras DESC',
      ticket_medio: 'ticket_medio DESC',
      recente: 'ultima_compra DESC',
    };

    const orderBy = ordensValidas[ordem] || 'valor_total DESC';

    const query = `
      SELECT
        c.id,
        c.nome,
        c.telefone,
        c.email,
        c.cidade,
        c.estado,
        COUNT(v.id) as total_compras,
        COALESCE(SUM(v.valor), 0) as valor_total,
        COALESCE(AVG(v.valor), 0) as ticket_medio,
        MAX(v.data_venda) as ultima_compra,
        MIN(v.data_venda) as primeira_compra
      FROM clientes c
      JOIN vendas v ON v.cliente_id = c.id
      WHERE v.estornada IS NULL OR v.estornada = 0
      GROUP BY c.id
      ORDER BY ${orderBy}
      LIMIT ?
    `;

    const dados = db.prepare(query).all(limite);
    res.json(dados);
  }

  indicadoresClientes(_req: Request, res: Response) {
    const db = getDb();

    const totais = db.prepare(`
      SELECT
        COUNT(DISTINCT v.cliente_id) as clientes_compradores,
        COUNT(v.id) as total_vendas,
        COALESCE(SUM(v.valor), 0) as valor_total,
        COALESCE(AVG(v.valor), 0) as ticket_medio_geral
      FROM vendas v
      WHERE v.estornada IS NULL OR v.estornada = 0
    `).get() as any;

    const recorrentes = db.prepare(`
      SELECT COUNT(*) as total FROM (
        SELECT cliente_id FROM vendas
        WHERE estornada IS NULL OR estornada = 0
        GROUP BY cliente_id
        HAVING COUNT(*) > 1
      )
    `).get() as any;

    const porMes = db.prepare(`
      SELECT
        strftime('%Y-%m', v.data_venda) as mes,
        COUNT(DISTINCT v.cliente_id) as clientes_unicos,
        COUNT(v.id) as vendas,
        COALESCE(SUM(v.valor), 0) as valor
      FROM vendas v
      WHERE v.estornada IS NULL OR v.estornada = 0
        AND v.data_venda >= date('now', '-12 months')
      GROUP BY mes
      ORDER BY mes
    `).all();

    const faixas = db.prepare(`
      SELECT
        CASE
          WHEN total <= 1000 THEN 'Ate R$1.000'
          WHEN total <= 5000 THEN 'R$1.000 - R$5.000'
          WHEN total <= 15000 THEN 'R$5.000 - R$15.000'
          WHEN total <= 50000 THEN 'R$15.000 - R$50.000'
          ELSE 'Acima de R$50.000'
        END as faixa,
        COUNT(*) as clientes,
        SUM(total) as valor_total
      FROM (
        SELECT cliente_id, SUM(valor) as total
        FROM vendas
        WHERE estornada IS NULL OR estornada = 0
        GROUP BY cliente_id
      )
      GROUP BY faixa
      ORDER BY MIN(total)
    `).all();

    res.json({
      clientes_compradores: totais.clientes_compradores,
      total_vendas: totais.total_vendas,
      valor_total: totais.valor_total,
      ticket_medio_geral: totais.ticket_medio_geral,
      clientes_recorrentes: recorrentes.total,
      taxa_recorrencia: totais.clientes_compradores > 0
        ? (recorrentes.total / totais.clientes_compradores * 100).toFixed(1)
        : 0,
      vendas_por_mes: porMes,
      faixas_valor: faixas,
    });
  }
}
