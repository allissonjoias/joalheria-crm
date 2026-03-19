import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';

export class ProdutosController {
  listar(req: Request, res: Response) {
    const db = getDb();
    const { categoria, busca, ativo } = req.query;
    let query = 'SELECT * FROM produtos WHERE 1=1';
    const params: any[] = [];

    if (ativo !== undefined) {
      query += ' AND ativo = ?';
      params.push(ativo === 'true' ? 1 : 0);
    } else {
      query += ' AND ativo = 1';
    }

    if (categoria) {
      query += ' AND categoria = ?';
      params.push(categoria);
    }

    if (busca) {
      query += ' AND (nome LIKE ? OR descricao LIKE ?)';
      const term = `%${busca}%`;
      params.push(term, term);
    }

    query += ' ORDER BY categoria, nome';
    const produtos = db.prepare(query).all(...params);
    res.json(produtos);
  }

  obter(req: Request, res: Response) {
    const db = getDb();
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado' });
    res.json(produto);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { nome, descricao, categoria, material, pedra, preco, preco_custo, estoque, foto_url } = req.body;

    if (!nome || !categoria || preco === undefined) {
      return res.status(400).json({ erro: 'Nome, categoria e preco sao obrigatorios' });
    }

    db.prepare(
      `INSERT INTO produtos (id, nome, descricao, categoria, material, pedra, preco, preco_custo, estoque, foto_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, nome, descricao || null, categoria, material || 'Ouro 18k', pedra || null, preco, preco_custo || null, estoque || 0, foto_url || null);

    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
    res.status(201).json(produto);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];
    const permitidos = ['nome', 'descricao', 'categoria', 'material', 'pedra', 'preco', 'preco_custo', 'estoque', 'foto_url', 'ativo'];

    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(req.body[campo]);
      }
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);

    db.prepare(`UPDATE produtos SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
    res.json(produto);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare('UPDATE produtos SET ativo = 0 WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  }
}
