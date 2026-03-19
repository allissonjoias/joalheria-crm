import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';
import { cicloVidaService } from '../services/ciclo-vida.service';

export class PipelineController {
  listar(req: Request, res: Response) {
    const db = getDb();
    let query = `
      SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
        u.nome as vendedor_nome,
        CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END as venda_registrada,
        v.data_venda as data_venda
      FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN usuarios u ON p.vendedor_id = u.id
      LEFT JOIN vendas v ON v.pipeline_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.query.funil_id) {
      query += ' AND p.funil_id = ?';
      params.push(Number(req.query.funil_id));
    }

    if (req.usuario?.papel === 'vendedor') {
      query += ' AND p.vendedor_id = ?';
      params.push(req.usuario.id);
    }

    query += ' ORDER BY p.criado_em DESC';
    const odvs = db.prepare(query).all(...params);
    res.json(odvs);
  }

  criar(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { cliente_id, titulo, valor, estagio, produto_interesse, notas, funil_id, origem_lead, tipo_pedido, forma_atendimento, tags } = req.body;

    if (!cliente_id || !titulo) {
      return res.status(400).json({ erro: 'Cliente e titulo sao obrigatorios' });
    }

    const estagioFinal = estagio || 'Lead';

    db.prepare(
      `INSERT INTO pipeline (id, cliente_id, vendedor_id, titulo, valor, estagio, produto_interesse, notas, funil_id, origem_lead, tipo_pedido, forma_atendimento, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, cliente_id, req.usuario?.id || null, titulo, valor || null, estagioFinal, produto_interesse || null, notas || null, funil_id || 1, origem_lead || null, tipo_pedido || null, forma_atendimento || null, JSON.stringify(tags || []));

    // Registrar no historico
    db.prepare(
      `INSERT INTO pipeline_historico (pipeline_id, estagio_novo, usuario_id) VALUES (?, ?, ?)`
    ).run(id, estagioFinal, req.usuario?.id || null);
    saveDb();

    const odv = db.prepare(`
      SELECT p.*, c.nome as cliente_nome FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?
    `).get(id);
    res.status(201).json(odv);
  }

  atualizar(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;

    // Capturar estagio anterior para historico
    const odvAntes = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(id) as any;
    if (!odvAntes) return res.status(404).json({ erro: 'ODV nao encontrada' });

    const campos: string[] = [];
    const valores: any[] = [];
    const permitidos = [
      'titulo', 'valor', 'estagio', 'produto_interesse', 'notas', 'vendedor_id',
      'funil_id', 'motivo_perda', 'origem_lead', 'tipo_pedido', 'forma_atendimento',
      'desconto', 'parcelas', 'forma_pagamento', 'valor_frete',
      'endereco_entrega', 'data_prevista_entrega', 'data_envio', 'transportador',
      'observacao_pedido', 'tipo_cliente',
    ];

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

    if (req.body.itens_pedido !== undefined) {
      campos.push('itens_pedido = ?');
      valores.push(JSON.stringify(req.body.itens_pedido));
    }

    // Ao editar manualmente, remover campo da lista de campos_ia (indica que vendedora confirmou/editou)
    if (req.body.campos_ia !== undefined) {
      campos.push('campos_ia = ?');
      valores.push(JSON.stringify(req.body.campos_ia));
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);

    db.prepare(`UPDATE pipeline SET ${campos.join(', ')} WHERE id = ?`).run(...valores);

    // Registrar mudanca de estagio no historico
    const mudouEstagio = req.body.estagio && req.body.estagio !== odvAntes.estagio;
    if (mudouEstagio) {
      db.prepare(
        `INSERT INTO pipeline_historico (pipeline_id, estagio_anterior, estagio_novo, usuario_id) VALUES (?, ?, ?, ?)`
      ).run(id, odvAntes.estagio, req.body.estagio, req.usuario?.id || null);
    }

    // Auto-criar venda quando o estagio for do tipo 'ganho'
    if (req.body.estagio) {
      const estagioGanho = db.prepare(
        "SELECT id FROM funil_estagios WHERE nome = ? AND tipo = 'ganho'"
      ).get(req.body.estagio);

      if (estagioGanho) {
        const vendaExistente = db.prepare('SELECT id FROM vendas WHERE pipeline_id = ?').get(id);
        if (!vendaExistente) {
          const odv = db.prepare('SELECT * FROM pipeline WHERE id = ?').get(id) as any;
          if (odv) {
            const vendaId = uuidv4();
            db.prepare(
              `INSERT INTO vendas (id, cliente_id, vendedor_id, pipeline_id, valor)
               VALUES (?, ?, ?, ?, ?)`
            ).run(vendaId, odv.cliente_id, odv.vendedor_id, id, odv.valor || 0);
          }
        }
      }
    }

    saveDb();

    // Disparar automacoes do ciclo de vida (apos salvar no banco)
    if (mudouEstagio) {
      try {
        cicloVidaService.onMudancaEstagio(id as string, odvAntes.estagio, req.body.estagio, req.usuario?.id, req.body.motivo_perda);
      } catch (e: any) {
        console.error('[CICLO-VIDA] Erro na automacao:', e.message);
      }
    }

    const odv = db.prepare(`
      SELECT p.*, c.nome as cliente_nome FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?
    `).get(id);
    res.json(odv);
  }

  historico(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const historico = db.prepare(`
      SELECT h.*, u.nome as usuario_nome
      FROM pipeline_historico h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.pipeline_id = ?
      ORDER BY h.criado_em DESC
    `).all(id);
    res.json(historico);
  }

  cicloVida(req: Request, res: Response) {
    const id = req.params.id as string;
    const resumo = cicloVidaService.obterResumoCiclo(id);
    res.json(resumo);
  }

  criarRecompra(req: Request, res: Response) {
    const id = req.params.id as string;
    const novoId = cicloVidaService.criarOportunidadeRecompra(id, req.usuario?.id);
    if (!novoId) return res.status(404).json({ erro: 'ODV nao encontrada' });

    const db = getDb();
    const odv = db.prepare(`
      SELECT p.*, c.nome as cliente_nome FROM pipeline p
      LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?
    `).get(novoId);
    res.status(201).json(odv);
  }

  excluir(req: Request, res: Response) {
    const db = getDb();
    db.prepare('DELETE FROM ciclo_vida_agendamentos WHERE pipeline_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pipeline_historico WHERE pipeline_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tarefas WHERE pipeline_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pipeline WHERE id = ?').run(req.params.id);
    saveDb();
    res.json({ sucesso: true });
  }
}
