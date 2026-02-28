import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';

export class VendasController {
  listar(req: Request, res: Response) {
    const db = getDb();
    let query = `
      SELECT v.*, c.nome as cliente_nome, p.nome as produto_nome, u.nome as vendedor_nome
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN produtos p ON v.produto_id = p.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.usuario?.papel === 'vendedor') {
      query += ' AND v.vendedor_id = ?';
      params.push(req.usuario.id);
    }

    query += ' ORDER BY v.data_venda DESC';
    const vendas = db.prepare(query).all(...params);
    res.json(vendas);
  }

  obter(req: Request, res: Response) {
    const db = getDb();
    const id = req.params.id as string;
    const venda = db.prepare(`
      SELECT v.*, c.nome as cliente_nome, p.nome as produto_nome, u.nome as vendedor_nome
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN produtos p ON v.produto_id = p.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE v.id = ?
    `).get(id);

    if (!venda) {
      return res.status(404).json({ erro: 'Venda nao encontrada' });
    }
    res.json(venda);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { cliente_id, produto_id, pipeline_id, valor, metodo_pagamento, parcelas, notas } = req.body;

    if (!cliente_id || !valor) {
      return res.status(400).json({ erro: 'Cliente e valor sao obrigatorios' });
    }

    db.prepare(
      `INSERT INTO vendas (id, cliente_id, vendedor_id, produto_id, pipeline_id, valor, metodo_pagamento, parcelas, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, cliente_id, req.usuario?.id || null, produto_id || null, pipeline_id || null, valor, metodo_pagamento || null, parcelas || 1, notas || null);

    // Update stock if product specified
    if (produto_id) {
      db.prepare('UPDATE produtos SET estoque = MAX(0, estoque - 1) WHERE id = ?').run(produto_id);
    }

    const venda = db.prepare(`
      SELECT v.*, c.nome as cliente_nome, p.nome as produto_nome
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE v.id = ?
    `).get(id);

    res.status(201).json(venda);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    const id = req.params.id as string;

    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(id) as any;
    if (!venda) {
      return res.status(404).json({ erro: 'Venda nao encontrada' });
    }

    // Restore stock if product was linked
    if (venda.produto_id) {
      db.prepare('UPDATE produtos SET estoque = estoque + 1 WHERE id = ?').run(venda.produto_id);
    }

    db.prepare('DELETE FROM vendas WHERE id = ?').run(id);
    res.json({ sucesso: true });
  }
}
