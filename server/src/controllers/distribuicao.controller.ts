import { Request, Response } from 'express';
import { getDb, saveDb } from '../config/database';
import { distribuicaoService } from '../services/distribuicao.service';

export class DistribuicaoController {
  obterConfig(req: Request, res: Response) {
    distribuicaoService.configurarFila(); // garantir que fila esta atualizada
    const dados = distribuicaoService.obterConfig();
    res.json(dados);
  }

  atualizarConfig(req: Request, res: Response) {
    const db = getDb();
    const { ativo, modo, funil_destino_id, estagio_destino, auto_criar_tarefa, minutos_deadline_tarefa } = req.body;
    const campos: string[] = [];
    const valores: any[] = [];

    if (ativo !== undefined) { campos.push('ativo = ?'); valores.push(ativo ? 1 : 0); }
    if (modo) { campos.push('modo = ?'); valores.push(modo); }
    if (funil_destino_id !== undefined) { campos.push('funil_destino_id = ?'); valores.push(funil_destino_id); }
    if (estagio_destino) { campos.push('estagio_destino = ?'); valores.push(estagio_destino); }
    if (auto_criar_tarefa !== undefined) { campos.push('auto_criar_tarefa = ?'); valores.push(auto_criar_tarefa ? 1 : 0); }
    if (minutos_deadline_tarefa !== undefined) { campos.push('minutos_deadline_tarefa = ?'); valores.push(minutos_deadline_tarefa); }

    if (campos.length > 0) {
      campos.push("atualizado_em = datetime('now', 'localtime')");
      db.prepare(`UPDATE distribuicao_config SET ${campos.join(', ')} WHERE id = 1`).run(...valores);
      saveDb();
    }

    const dados = distribuicaoService.obterConfig();
    res.json(dados);
  }

  atualizarFila(req: Request, res: Response) {
    const db = getDb();
    const { usuario_id, ativo, ordem } = req.body;

    if (!usuario_id) return res.status(400).json({ erro: 'usuario_id obrigatorio' });

    const campos: string[] = [];
    const valores: any[] = [];

    if (ativo !== undefined) { campos.push('ativo = ?'); valores.push(ativo ? 1 : 0); }
    if (ordem !== undefined) { campos.push('ordem = ?'); valores.push(ordem); }

    if (campos.length > 0) {
      valores.push(usuario_id);
      db.prepare(`UPDATE distribuicao_fila SET ${campos.join(', ')} WHERE usuario_id = ?`).run(...valores);
      saveDb();
    }

    const dados = distribuicaoService.obterConfig();
    res.json(dados);
  }

  // Distribuir manualmente um lead
  distribuirManual(req: Request, res: Response) {
    const { cliente_id, titulo, valor, origem_lead, funil_id } = req.body;

    if (!cliente_id || !titulo) {
      return res.status(400).json({ erro: 'cliente_id e titulo obrigatorios' });
    }

    const resultado = distribuicaoService.distribuirLead(cliente_id, titulo, valor, origem_lead, funil_id);
    if (!resultado) {
      return res.status(400).json({ erro: 'Distribuicao nao ativa ou sem vendedores disponiveis' });
    }

    res.json(resultado);
  }

  // Historico de distribuicoes
  historico(req: Request, res: Response) {
    const db = getDb();
    const { limite = 50 } = req.query;
    const logs = db.prepare(`
      SELECT dl.*, u.nome as vendedor_nome, p.titulo as deal_titulo, c.nome as cliente_nome
      FROM distribuicao_log dl
      JOIN usuarios u ON dl.usuario_id = u.id
      LEFT JOIN pipeline p ON dl.lead_id = p.id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      ORDER BY dl.criado_em DESC
      LIMIT ?
    `).all(Number(limite));
    res.json(logs);
  }
}
