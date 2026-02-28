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
}
