import { Request, Response } from 'express';
import { getDb, saveDb } from '../config/database';

export class TarefasController {
  listar(req: Request, res: Response) {
    const db = getDb();
    let sql = `
      SELECT t.*,
        c.nome as cliente_nome, c.telefone as cliente_telefone,
        p.titulo as deal_titulo, p.estagio as deal_estagio,
        u.nome as vendedor_nome
      FROM tarefas t
      LEFT JOIN clientes c ON t.cliente_id = c.id
      LEFT JOIN pipeline p ON t.pipeline_id = p.id
      LEFT JOIN usuarios u ON t.vendedor_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.query.status) {
      sql += ' AND t.status = ?';
      params.push(req.query.status);
    }
    if (req.query.pipeline_id) {
      sql += ' AND t.pipeline_id = ?';
      params.push(req.query.pipeline_id);
    }
    if (req.query.cliente_id) {
      sql += ' AND t.cliente_id = ?';
      params.push(req.query.cliente_id);
    }
    if (req.query.prioridade) {
      sql += ' AND t.prioridade = ?';
      params.push(req.query.prioridade);
    }
    if (req.query.vencidas === '1') {
      sql += " AND t.status = 'pendente' AND t.data_vencimento < datetime('now', 'localtime')";
    }

    // Vendedor so ve as suas
    if (req.usuario?.papel === 'vendedor') {
      sql += ' AND t.vendedor_id = ?';
      params.push(req.usuario.id);
    }

    sql += ' ORDER BY CASE t.prioridade WHEN \'urgente\' THEN 0 WHEN \'alta\' THEN 1 WHEN \'media\' THEN 2 ELSE 3 END, t.data_vencimento ASC';

    if (req.query.limite) {
      sql += ' LIMIT ?';
      params.push(Number(req.query.limite));
    }

    const tarefas = db.prepare(sql).all(...params);
    res.json(tarefas);
  }

  obter(req: Request, res: Response) {
    const db = getDb();
    const tarefa = db.prepare(`
      SELECT t.*,
        c.nome as cliente_nome, p.titulo as deal_titulo,
        u.nome as vendedor_nome
      FROM tarefas t
      LEFT JOIN clientes c ON t.cliente_id = c.id
      LEFT JOIN pipeline p ON t.pipeline_id = p.id
      LEFT JOIN usuarios u ON t.vendedor_id = u.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!tarefa) return res.status(404).json({ erro: 'Tarefa nao encontrada' });
    res.json(tarefa);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const { pipeline_id, cliente_id, titulo, descricao, tipo, prioridade, data_vencimento, vendedor_id } = req.body;

    if (!titulo) return res.status(400).json({ erro: 'Titulo e obrigatorio' });

    db.prepare(
      `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      pipeline_id || null,
      cliente_id || null,
      vendedor_id || req.usuario?.id || null,
      titulo,
      descricao || null,
      tipo || 'geral',
      prioridade || 'media',
      data_vencimento || null
    );

    // sql.js: buscar a tarefa recem-criada
    const tarefa = db.prepare(
      'SELECT * FROM tarefas ORDER BY id DESC LIMIT 1'
    ).get();
    res.status(201).json(tarefa);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];
    const permitidos = ['titulo', 'descricao', 'tipo', 'prioridade', 'status', 'data_vencimento', 'vendedor_id', 'pipeline_id', 'cliente_id'];

    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(req.body[campo]);
      }
    }

    // Se marcou como concluida
    if (req.body.status === 'concluida') {
      campos.push("concluida_em = datetime('now', 'localtime')");
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);

    db.prepare(`UPDATE tarefas SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    saveDb();

    const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(id);
    res.json(tarefa);
  }

  concluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare(
      "UPDATE tarefas SET status = 'concluida', concluida_em = datetime('now', 'localtime'), atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(req.params.id);
    saveDb();

    const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(req.params.id);
    res.json(tarefa);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare('DELETE FROM tarefas WHERE id = ?').run(req.params.id);
    saveDb();
    res.json({ sucesso: true });
  }

  criarDeMensagem(req: Request, res: Response) {
    const db = getDb();
    const { mensagem_id, conversa_id, titulo, descricao, prioridade, data_vencimento } = req.body;

    if (!conversa_id) return res.status(400).json({ erro: 'conversa_id e obrigatorio' });

    // Buscar dados da conversa e mensagem
    const conversa = db.prepare(
      'SELECT c.*, cl.nome as cliente_nome FROM conversas c LEFT JOIN clientes cl ON c.cliente_id = cl.id WHERE c.id = ?'
    ).get(conversa_id) as any;

    if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada' });

    let textoMensagem = descricao || '';
    if (mensagem_id) {
      const msg = db.prepare('SELECT conteudo, papel, criado_em FROM mensagens WHERE id = ?').get(mensagem_id) as any;
      if (msg) {
        const remetente = msg.papel === 'user' ? (conversa.cliente_nome || 'Cliente') : 'Agente';
        textoMensagem = `[${remetente}]: "${msg.conteudo}"`;
      }
    }

    const tituloFinal = titulo || (textoMensagem.length > 60 ? textoMensagem.substring(0, 60) + '...' : textoMensagem) || 'Tarefa da conversa';

    db.prepare(
      `INSERT INTO tarefas (pipeline_id, cliente_id, vendedor_id, titulo, descricao, tipo, prioridade, data_vencimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      null,
      conversa.cliente_id || null,
      req.usuario?.id || conversa.vendedor_id || null,
      tituloFinal,
      textoMensagem,
      'followup',
      prioridade || 'media',
      data_vencimento || null
    );

    const tarefa = db.prepare('SELECT * FROM tarefas ORDER BY id DESC LIMIT 1').get();
    saveDb();
    res.status(201).json(tarefa);
  }

  estatisticas(req: Request, res: Response) {
    const db = getDb();
    const stats = {
      total: (db.prepare('SELECT COUNT(*) as c FROM tarefas').get() as any)?.c || 0,
      pendentes: (db.prepare("SELECT COUNT(*) as c FROM tarefas WHERE status = 'pendente'").get() as any)?.c || 0,
      em_andamento: (db.prepare("SELECT COUNT(*) as c FROM tarefas WHERE status = 'em_andamento'").get() as any)?.c || 0,
      concluidas: (db.prepare("SELECT COUNT(*) as c FROM tarefas WHERE status = 'concluida'").get() as any)?.c || 0,
      vencidas: (db.prepare("SELECT COUNT(*) as c FROM tarefas WHERE status = 'pendente' AND data_vencimento < datetime('now', 'localtime')").get() as any)?.c || 0,
    };
    res.json(stats);
  }
}
