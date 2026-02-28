import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';

export class LembretesController {
  listar(req: Request, res: Response) {
    const db = getDb();
    let query = `
      SELECT l.*, c.nome as cliente_nome
      FROM lembretes l
      LEFT JOIN clientes c ON l.cliente_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.usuario?.papel === 'vendedor') {
      query += ' AND l.vendedor_id = ?';
      params.push(req.usuario.id);
    }

    if (req.query.pendentes === 'true') {
      query += ' AND l.concluido = 0';
    }

    query += ' ORDER BY l.data_lembrete ASC';
    const lembretes = db.prepare(query).all(...params);
    res.json(lembretes);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { cliente_id, titulo, descricao, data_lembrete } = req.body;

    if (!cliente_id || !titulo || !data_lembrete) {
      return res.status(400).json({ erro: 'Cliente, titulo e data sao obrigatorios' });
    }

    db.prepare(
      `INSERT INTO lembretes (id, cliente_id, vendedor_id, titulo, descricao, data_lembrete)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, cliente_id, req.usuario?.id || null, titulo, descricao || null, data_lembrete);

    const lembrete = db.prepare(`
      SELECT l.*, c.nome as cliente_nome FROM lembretes l
      LEFT JOIN clientes c ON l.cliente_id = c.id WHERE l.id = ?
    `).get(id);
    res.status(201).json(lembrete);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];

    if (req.body.titulo !== undefined) { campos.push('titulo = ?'); valores.push(req.body.titulo); }
    if (req.body.descricao !== undefined) { campos.push('descricao = ?'); valores.push(req.body.descricao); }
    if (req.body.data_lembrete !== undefined) { campos.push('data_lembrete = ?'); valores.push(req.body.data_lembrete); }
    if (req.body.concluido !== undefined) { campos.push('concluido = ?'); valores.push(req.body.concluido ? 1 : 0); }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    valores.push(id);

    db.prepare(`UPDATE lembretes SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    const lembrete = db.prepare(`
      SELECT l.*, c.nome as cliente_nome FROM lembretes l
      LEFT JOIN clientes c ON l.cliente_id = c.id WHERE l.id = ?
    `).get(id);
    res.json(lembrete);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare('DELETE FROM lembretes WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  }

  pendentes(req: Request, res: Response) {
    const db = getDb();
    let query = `
      SELECT COUNT(*) as total FROM lembretes
      WHERE concluido = 0 AND date(data_lembrete) <= date('now')
    `;
    const params: any[] = [];
    if (req.usuario?.papel === 'vendedor') {
      query += ' AND vendedor_id = ?';
      params.push(req.usuario.id);
    }
    const result = db.prepare(query).get(...params) as any;
    res.json({ total: result.total });
  }
}
