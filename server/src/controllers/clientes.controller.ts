import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';

export class ClientesController {
  listar(req: Request, res: Response) {
    const db = getDb();
    const { busca, vendedor_id } = req.query;
    let query = 'SELECT * FROM clientes WHERE 1=1';
    const params: any[] = [];

    if (req.usuario?.papel === 'vendedor') {
      query += ' AND vendedor_id = ?';
      params.push(req.usuario.id);
    } else if (vendedor_id) {
      query += ' AND vendedor_id = ?';
      params.push(vendedor_id);
    }

    if (busca) {
      query += ' AND (nome LIKE ? OR telefone LIKE ? OR email LIKE ?)';
      const term = `%${busca}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY criado_em DESC';
    const clientes = db.prepare(query).all(...params);
    res.json(clientes);
  }

  obter(req: Request, res: Response) {
    const db = getDb();
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ erro: 'Cliente nao encontrado' });
    res.json(cliente);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { nome, telefone, email, tipo_interesse, material_preferido, pedra_preferida, orcamento_min, orcamento_max, ocasiao, tags, notas } = req.body;

    if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' });

    db.prepare(
      `INSERT INTO clientes (id, nome, telefone, email, tipo_interesse, material_preferido, pedra_preferida, orcamento_min, orcamento_max, ocasiao, tags, notas, vendedor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, nome, telefone || null, email || null, tipo_interesse || null, material_preferido || null, pedra_preferida || null, orcamento_min || null, orcamento_max || null, ocasiao || null, JSON.stringify(tags || []), notas || null, req.usuario?.id || null);

    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    res.status(201).json(cliente);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];
    const permitidos = ['nome', 'telefone', 'email', 'tipo_interesse', 'material_preferido', 'pedra_preferida', 'orcamento_min', 'orcamento_max', 'ocasiao', 'notas', 'vendedor_id'];

    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(req.body[campo]);
      }
    }

    if (req.body.tags !== undefined) {
      campos.push('tags = ?');
      valores.push(JSON.stringify(req.body.tags));
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    campos.push("atualizado_em = datetime('now')");
    valores.push(id);

    db.prepare(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    res.json(cliente);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  }

  interacoes(req: Request, res: Response) {
    const db = getDb();
    const interacoes = db.prepare(
      'SELECT * FROM interacoes WHERE cliente_id = ? ORDER BY criado_em DESC'
    ).all(req.params.id);
    res.json(interacoes);
  }

  adicionarInteracao(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { tipo, descricao } = req.body;

    db.prepare(
      'INSERT INTO interacoes (id, cliente_id, vendedor_id, tipo, descricao) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.params.id, req.usuario?.id || null, tipo, descricao);

    res.status(201).json({ id, tipo, descricao });
  }
}
