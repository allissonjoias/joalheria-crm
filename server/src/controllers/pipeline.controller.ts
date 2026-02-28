import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';

export class PipelineController {
  listar(req: Request, res: Response) {
    const db = getDb();
    let query = `
      SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone
      FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.usuario?.papel === 'vendedor') {
      query += ' AND p.vendedor_id = ?';
      params.push(req.usuario.id);
    }

    query += ' ORDER BY p.criado_em DESC';
    const deals = db.prepare(query).all(...params);
    res.json(deals);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { cliente_id, titulo, valor, estagio, produto_interesse, notas } = req.body;

    if (!cliente_id || !titulo) {
      return res.status(400).json({ erro: 'Cliente e titulo sao obrigatorios' });
    }

    db.prepare(
      `INSERT INTO pipeline (id, cliente_id, vendedor_id, titulo, valor, estagio, produto_interesse, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, cliente_id, req.usuario?.id || null, titulo, valor || null, estagio || 'lead', produto_interesse || null, notas || null);

    const deal = db.prepare(`
      SELECT p.*, c.nome as cliente_nome FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?
    `).get(id);
    res.status(201).json(deal);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];
    const permitidos = ['titulo', 'valor', 'estagio', 'produto_interesse', 'notas', 'vendedor_id'];

    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(req.body[campo]);
      }
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    campos.push("atualizado_em = datetime('now')");
    valores.push(id);

    db.prepare(`UPDATE pipeline SET ${campos.join(', ')} WHERE id = ?`).run(...valores);

    // Auto-create sale when moved to 'vendido'
    if (req.body.estagio === 'vendido') {
      const deal = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(id) as any;
      if (deal) {
        const vendaExistente = db.prepare('SELECT id FROM vendas WHERE pipeline_id = ?').get(id);
        if (!vendaExistente) {
          const vendaId = uuidv4();
          db.prepare(
            `INSERT INTO vendas (id, cliente_id, vendedor_id, pipeline_id, valor)
             VALUES (?, ?, ?, ?, ?)`
          ).run(vendaId, deal.cliente_id, deal.vendedor_id, id, deal.valor || 0);
        }
      }
    }

    const deal = db.prepare(`
      SELECT p.*, c.nome as cliente_nome FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?
    `).get(id);
    res.json(deal);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare('DELETE FROM pipeline WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  }
}
