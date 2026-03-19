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
    const { nome, telefone, email, tipo_interesse, material_preferido, pedra_preferida, orcamento_min, orcamento_max, ocasiao, tags, notas, cpf, data_nascimento, cep, endereco, numero_endereco, complemento, bairro, cidade, estado, origem, forma_atendimento } = req.body;

    if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' });

    db.prepare(
      `INSERT INTO clientes (id, nome, telefone, email, tipo_interesse, material_preferido, pedra_preferida, orcamento_min, orcamento_max, ocasiao, tags, notas, vendedor_id, cpf, data_nascimento, cep, endereco, numero_endereco, complemento, bairro, cidade, estado, origem, forma_atendimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, nome, telefone || null, email || null, tipo_interesse || null, material_preferido || null, pedra_preferida || null, orcamento_min || null, orcamento_max || null, ocasiao || null, JSON.stringify(tags || []), notas || null, req.usuario?.id || null, cpf || null, data_nascimento || null, cep || null, endereco || null, numero_endereco || null, complemento || null, bairro || null, cidade || null, estado || null, origem || null, forma_atendimento || null);

    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    res.status(201).json(cliente);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];
    const permitidos = ['nome', 'telefone', 'email', 'tipo_interesse', 'material_preferido', 'pedra_preferida', 'orcamento_min', 'orcamento_max', 'ocasiao', 'notas', 'vendedor_id', 'cpf', 'data_nascimento', 'cep', 'endereco', 'numero_endereco', 'complemento', 'bairro', 'cidade', 'estado', 'origem', 'forma_atendimento'];

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

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);

    db.prepare(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    res.json(cliente);
  }

  /**
   * Retorna todas as ODVs de um cliente com status da venda
   * Permite ver historico completo: ganhou, perdeu, estornos etc
   */
  odvs(req: Request, res: Response) {
    const db = getDb();
    const clienteId = req.params.id;

    const odvs = db.prepare(`
      SELECT p.id, p.titulo, p.valor, p.estagio, p.criado_em, p.atualizado_em,
        p.produto_interesse, p.motivo_perda, p.funil_id, p.origem_lead,
        u.nome as vendedor_nome,
        fe.tipo as estagio_tipo, fe.fase as estagio_fase,
        CASE WHEN v.id IS NOT NULL AND v.estornada = 0 THEN 1 ELSE 0 END as venda_ativa,
        CASE WHEN v.id IS NOT NULL AND v.estornada = 1 THEN 1 ELSE 0 END as venda_estornada,
        v.data_venda, v.data_estorno, v.motivo_estorno
      FROM pipeline p
      LEFT JOIN usuarios u ON p.vendedor_id = u.id
      LEFT JOIN funil_estagios fe ON fe.nome = p.estagio AND fe.funil_id = p.funil_id
      LEFT JOIN vendas v ON v.pipeline_id = p.id
      WHERE p.cliente_id = ?
      ORDER BY p.criado_em DESC
    `).all(clienteId);

    // Resumo: total ODVs, ganhas, perdidas, valor total, se e cliente ou lead
    const totalGanhas = odvs.filter((o: any) => o.venda_ativa).length;
    const totalEstornadas = odvs.filter((o: any) => o.venda_estornada).length;
    const totalPerdidas = odvs.filter((o: any) => o.estagio_tipo === 'perdido' && !o.venda_estornada).length;
    const totalAbertas = odvs.filter((o: any) => o.estagio_tipo === 'aberto' || o.estagio_tipo === 'ganho' && !o.venda_estornada).length;
    const valorTotalVendas = odvs.filter((o: any) => o.venda_ativa).reduce((acc: number, o: any) => acc + (o.valor || 0), 0);

    res.json({
      odvs,
      resumo: {
        total: odvs.length,
        ganhas: totalGanhas,
        perdidas: totalPerdidas,
        estornadas: totalEstornadas,
        abertas: totalAbertas,
        valor_total: valorTotalVendas,
        classificacao: totalGanhas > 0 ? 'cliente' : 'lead',
      },
    });
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
