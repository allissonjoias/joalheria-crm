import { Request, Response } from 'express';
import { getDb, saveDb } from '../config/database';

export class FunilController {
  // Listar funis disponiveis
  listarFunis(req: Request, res: Response) {
    const db = getDb();
    const funis = db.prepare(
      'SELECT * FROM funis WHERE ativo = 1 ORDER BY ordem ASC'
    ).all();
    res.json(funis);
  }

  listarEstagios(req: Request, res: Response) {
    const db = getDb();
    const { funil_id } = req.query;
    let sql = 'SELECT * FROM funil_estagios WHERE ativo = 1';
    const params: any[] = [];

    if (funil_id) {
      sql += ' AND funil_id = ?';
      params.push(Number(funil_id));
    }

    sql += ' ORDER BY funil_id ASC, ordem ASC';
    const estagios = db.prepare(sql).all(...params);
    res.json(estagios);
  }

  // Listar motivos de perda
  listarMotivosPerda(req: Request, res: Response) {
    const db = getDb();
    const motivos = db.prepare(
      'SELECT * FROM motivos_perda WHERE ativo = 1 ORDER BY ordem ASC'
    ).all();
    res.json(motivos);
  }

  // Listar origens de lead
  listarOrigensLead(req: Request, res: Response) {
    const db = getDb();
    const origens = db.prepare(
      'SELECT * FROM origens_lead WHERE ativo = 1 ORDER BY ordem ASC'
    ).all();
    res.json(origens);
  }

  criarEstagio(req: Request, res: Response) {
    const db = getDb();
    const { nome, cor, ordem, tipo, funil_id } = req.body;

    if (!nome) return res.status(400).json({ erro: 'Nome e obrigatorio' });

    const { fase } = req.body;
    const funilId = funil_id || 1;

    // Pegar maior ordem se nao informada
    let ordemFinal = ordem;
    if (ordemFinal === undefined) {
      const max = db.prepare('SELECT MAX(ordem) as max FROM funil_estagios WHERE funil_id = ?').get(funilId) as any;
      ordemFinal = (max?.max || 0) + 10;
    }

    db.prepare(
      `INSERT INTO funil_estagios (nome, cor, ordem, tipo, funil_id, fase) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(nome, cor || '#6b7280', ordemFinal, tipo || 'aberto', funilId, fase || 'venda');
    saveDb();

    const estagios = db.prepare('SELECT * FROM funil_estagios WHERE ativo = 1 AND funil_id = ? ORDER BY ordem ASC').all(funilId);
    res.status(201).json(estagios);
  }

  atualizarEstagio(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;
    const { nome, cor, ordem, tipo, fase } = req.body;

    const campos: string[] = [];
    const valores: any[] = [];

    if (nome !== undefined) { campos.push('nome = ?'); valores.push(nome); }
    if (cor !== undefined) { campos.push('cor = ?'); valores.push(cor); }
    if (ordem !== undefined) { campos.push('ordem = ?'); valores.push(ordem); }
    if (tipo !== undefined) { campos.push('tipo = ?'); valores.push(tipo); }
    if (fase !== undefined) { campos.push('fase = ?'); valores.push(fase); }

    if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);

    db.prepare(`UPDATE funil_estagios SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
    saveDb();

    const estagios = db.prepare('SELECT * FROM funil_estagios WHERE ativo = 1 ORDER BY ordem ASC').all();
    res.json(estagios);
  }

  reordenarEstagios(req: Request, res: Response) {
    const db = getDb();
    const { ordem } = req.body; // [{ id: 1, ordem: 0 }, { id: 2, ordem: 10 }, ...]

    if (!Array.isArray(ordem)) return res.status(400).json({ erro: 'Formato invalido' });

    for (const item of ordem) {
      db.prepare('UPDATE funil_estagios SET ordem = ? WHERE id = ?').run(item.ordem, item.id);
    }
    saveDb();

    const estagios = db.prepare('SELECT * FROM funil_estagios WHERE ativo = 1 ORDER BY ordem ASC').all();
    res.json(estagios);
  }

  excluirEstagio(req: Request, res: Response) {
    const db = getDb();
    const { id } = req.params;

    // Nao permitir excluir se tem deals nesse estagio
    const estagio = db.prepare('SELECT nome FROM funil_estagios WHERE id = ?').get(id) as any;
    if (!estagio) return res.status(404).json({ erro: 'Estagio nao encontrado' });

    const deals = db.prepare('SELECT COUNT(*) as total FROM pipeline WHERE estagio = ?').get(estagio.nome) as any;
    if (deals?.total > 0) {
      return res.status(400).json({ erro: `Nao e possivel excluir: ${deals.total} deals neste estagio` });
    }

    // Soft delete
    db.prepare("UPDATE funil_estagios SET ativo = 0, atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(id);
    saveDb();

    const estagios = db.prepare('SELECT * FROM funil_estagios WHERE ativo = 1 ORDER BY ordem ASC').all();
    res.json(estagios);
  }
}
