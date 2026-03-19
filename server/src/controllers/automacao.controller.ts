import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';
import { automacaoEngine } from '../services/automacao-engine.service';

export class AutomacaoController {

  // === FLUXOS ===

  listarFluxos(req: Request, res: Response) {
    const db = getDb();
    const fluxos = db.prepare(
      'SELECT id, nome, descricao, ativo, canal, criado_em, atualizado_em FROM automacao_fluxos ORDER BY atualizado_em DESC'
    ).all() as any[];

    // Adicionar estatisticas a cada fluxo
    const resultado = fluxos.map(f => ({
      ...f,
      stats: automacaoEngine.obterEstatisticas(f.id),
    }));

    res.json(resultado);
  }

  obterFluxo(req: Request, res: Response) {
    const db = getDb();
    const fluxo = db.prepare('SELECT * FROM automacao_fluxos WHERE id = ?').get(req.params.id);
    if (!fluxo) return res.status(404).json({ erro: 'Fluxo nao encontrado' });
    res.json(fluxo);
  }

  criarFluxo(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { nome, descricao, canal, fluxo_json } = req.body;

    if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' });

    db.prepare(
      `INSERT INTO automacao_fluxos (id, nome, descricao, canal, fluxo_json, criado_por)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, nome, descricao || null, canal || 'todos', fluxo_json || '{"nodes":[],"edges":[]}', req.usuario?.id || null);

    saveDb();
    const fluxo = db.prepare('SELECT * FROM automacao_fluxos WHERE id = ?').get(id);
    res.status(201).json(fluxo);
  }

  atualizarFluxo(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const campos: string[] = [];
    const valores: any[] = [];

    for (const campo of ['nome', 'descricao', 'canal', 'fluxo_json', 'ativo']) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(req.body[campo]);
      }
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);

    db.prepare(`UPDATE automacao_fluxos SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    saveDb();

    const fluxo = db.prepare('SELECT * FROM automacao_fluxos WHERE id = ?').get(id);
    res.json(fluxo);
  }

  excluirFluxo(req: Request, res: Response) {
    const db = getDb();
    db.prepare("UPDATE automacao_execucoes SET status = 'cancelado' WHERE fluxo_id = ? AND status = 'ativo'").run(req.params.id);
    db.prepare('DELETE FROM automacao_fluxos WHERE id = ?').run(req.params.id);
    saveDb();
    res.json({ sucesso: true });
  }

  toggleFluxo(req: Request, res: Response) {
    const db = getDb();
    const fluxo = db.prepare('SELECT ativo FROM automacao_fluxos WHERE id = ?').get(req.params.id) as any;
    if (!fluxo) return res.status(404).json({ erro: 'Fluxo nao encontrado' });

    const novoStatus = fluxo.ativo ? 0 : 1;
    db.prepare("UPDATE automacao_fluxos SET ativo = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(novoStatus, req.params.id);

    if (!novoStatus) {
      // Desativou: cancelar execucoes ativas
      db.prepare("UPDATE automacao_execucoes SET status = 'cancelado' WHERE fluxo_id = ? AND status = 'ativo'").run(req.params.id);
    }

    saveDb();
    res.json({ ativo: novoStatus });
  }

  estatisticasFluxo(req: Request, res: Response) {
    const fluxoId = req.params.id as string;
    const stats = automacaoEngine.obterEstatisticas(fluxoId);
    const db = getDb();
    const logs = db.prepare(`
      SELECT l.*, e.cliente_id FROM automacao_log l
      JOIN automacao_execucoes e ON l.execucao_id = e.id
      WHERE e.fluxo_id = ?
      ORDER BY l.criado_em DESC LIMIT 50
    `).all(fluxoId);

    res.json({ stats, logs });
  }

  // === TEMPLATES ===

  listarTemplates(req: Request, res: Response) {
    const db = getDb();
    const templates = db.prepare('SELECT * FROM automacao_templates WHERE ativo = 1 ORDER BY criado_em DESC').all();
    res.json(templates);
  }

  criarTemplate(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { nome, canal, tipo, conteudo, midia_url, whatsapp_template_name } = req.body;

    if (!nome || !conteudo) return res.status(400).json({ erro: 'Nome e conteudo sao obrigatorios' });

    db.prepare(
      `INSERT INTO automacao_templates (id, nome, canal, tipo, conteudo, midia_url, whatsapp_template_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, nome, canal || 'whatsapp', tipo || 'texto', conteudo, midia_url || null, whatsapp_template_name || null);

    saveDb();
    const template = db.prepare('SELECT * FROM automacao_templates WHERE id = ?').get(id);
    res.status(201).json(template);
  }

  atualizarTemplate(req: Request, res: Response) {
    const db = getDb();
    const campos: string[] = [];
    const valores: any[] = [];

    for (const campo of ['nome', 'canal', 'tipo', 'conteudo', 'midia_url', 'whatsapp_template_name']) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(req.body[campo]);
      }
    }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo' });
    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(req.params.id);

    db.prepare(`UPDATE automacao_templates SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    saveDb();
    res.json(db.prepare('SELECT * FROM automacao_templates WHERE id = ?').get(req.params.id));
  }

  excluirTemplate(req: Request, res: Response) {
    const db = getDb();
    db.prepare('UPDATE automacao_templates SET ativo = 0 WHERE id = ?').run(req.params.id);
    saveDb();
    res.json({ sucesso: true });
  }

  // === CAMPANHAS ===

  listarCampanhas(req: Request, res: Response) {
    const db = getDb();
    const campanhas = db.prepare('SELECT * FROM automacao_campanhas ORDER BY criado_em DESC').all();
    res.json(campanhas);
  }

  criarCampanha(req: Request, res: Response) {
    const db = getDb();
    const id = uuidv4();
    const { nome, template_id, canal, segmento_json, agendado_para, fluxo_id } = req.body;

    if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' });

    // Buscar contatos do segmento
    const segmento = segmento_json ? JSON.parse(segmento_json) : {};
    const contatos = this.buscarContatosSegmento(segmento);

    db.prepare(
      `INSERT INTO automacao_campanhas (id, nome, fluxo_id, template_id, canal, segmento_json, agendado_para, total_contatos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, nome, fluxo_id || null, template_id || null, canal || 'whatsapp', JSON.stringify(segmento), agendado_para || null, contatos.length);

    // Criar fila
    const template = template_id ? db.prepare('SELECT * FROM automacao_templates WHERE id = ?').get(template_id) as any : null;

    for (const c of contatos) {
      const mensagem = template
        ? template.conteudo.replace(/\{\{nome\}\}/gi, c.nome || 'Cliente').replace(/\{\{telefone\}\}/gi, c.telefone || '')
        : null;

      db.prepare(
        `INSERT INTO automacao_fila (id, campanha_id, cliente_id, telefone, mensagem, canal, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pendente')`
      ).run(uuidv4(), id, c.id, c.telefone, mensagem, canal || 'whatsapp');
    }

    saveDb();
    res.status(201).json({
      ...db.prepare('SELECT * FROM automacao_campanhas WHERE id = ?').get(id) as any,
      preview_contatos: contatos.length,
    });
  }

  previewSegmento(req: Request, res: Response) {
    const segmento = req.body.segmento || {};
    const contatos = this.buscarContatosSegmento(segmento);
    res.json({ total: contatos.length, amostra: contatos.slice(0, 10) });
  }

  private buscarContatosSegmento(segmento: any): any[] {
    const db = getDb();
    let query = 'SELECT id, nome, telefone, email, tags, origem FROM clientes WHERE 1=1';
    const params: any[] = [];

    if (segmento.tags && segmento.tags.length > 0) {
      for (const tag of segmento.tags) {
        query += ' AND tags LIKE ?';
        params.push(`%${tag}%`);
      }
    }

    if (segmento.origem) {
      query += ' AND origem = ?';
      params.push(segmento.origem);
    }

    if (segmento.data_criado_de) {
      query += ' AND criado_em >= ?';
      params.push(segmento.data_criado_de);
    }

    if (segmento.data_criado_ate) {
      query += ' AND criado_em <= ?';
      params.push(segmento.data_criado_ate);
    }

    if (segmento.tem_telefone) {
      query += " AND telefone IS NOT NULL AND telefone != ''";
    }

    if (segmento.estagio) {
      query += ' AND id IN (SELECT cliente_id FROM pipeline WHERE estagio = ?)';
      params.push(segmento.estagio);
    }

    if (segmento.classificacao === 'cliente') {
      query += ' AND id IN (SELECT cliente_id FROM vendas WHERE estornada = 0)';
    } else if (segmento.classificacao === 'lead') {
      query += ' AND id NOT IN (SELECT cliente_id FROM vendas WHERE estornada = 0)';
    }

    return db.prepare(query + ' ORDER BY criado_em DESC').all(...params) as any[];
  }
}
