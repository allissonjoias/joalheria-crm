import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';
import { hojeLocal } from '../utils/timezone';

export class PontoController {
  // GET /api/ponto/status - status atual do usuario (esta trabalhando ou nao)
  status(req: Request, res: Response) {
    const db = getDb();
    const hoje = hojeLocal();

    const ultimo = db.prepare(
      "SELECT * FROM ponto WHERE usuario_id = ? AND criado_em >= ? ORDER BY criado_em DESC LIMIT 1"
    ).get(req.usuario!.id, hoje) as any;

    const registrosHoje = db.prepare(
      "SELECT * FROM ponto WHERE usuario_id = ? AND criado_em >= ? ORDER BY criado_em ASC"
    ).all(req.usuario!.id, hoje) as any[];

    // Calcular horas trabalhadas hoje
    let minutosHoje = 0;
    for (let i = 0; i < registrosHoje.length; i += 2) {
      const entrada = registrosHoje[i];
      const saida = registrosHoje[i + 1];
      if (entrada?.tipo === 'entrada') {
        const fim = saida ? new Date(saida.criado_em) : new Date();
        minutosHoje += (fim.getTime() - new Date(entrada.criado_em).getTime()) / 60000;
      }
    }

    res.json({
      trabalhando: ultimo?.tipo === 'entrada',
      ultimo_registro: ultimo || null,
      registros_hoje: registrosHoje,
      minutos_hoje: Math.round(minutosHoje),
    });
  }

  // POST /api/ponto/bater - registrar entrada ou saida
  bater(req: Request, res: Response) {
    const db = getDb();
    const hoje = hojeLocal();
    const { observacao } = req.body;

    const ultimo = db.prepare(
      "SELECT * FROM ponto WHERE usuario_id = ? AND criado_em >= ? ORDER BY criado_em DESC LIMIT 1"
    ).get(req.usuario!.id, hoje) as any;

    const tipo = (!ultimo || ultimo.tipo === 'saida') ? 'entrada' : 'saida';
    const id = uuidv4();

    db.prepare(
      'INSERT INTO ponto (id, usuario_id, tipo, observacao) VALUES (?, ?, ?, ?)'
    ).run(id, req.usuario!.id, tipo, observacao || null);
    saveDb();

    const registro = db.prepare('SELECT * FROM ponto WHERE id = ?').get(id);
    res.status(201).json(registro);
  }

  // GET /api/ponto/historico - historico de pontos do usuario
  historico(req: Request, res: Response) {
    const db = getDb();
    const dias = Number(req.query.dias) || 30;
    const userId = req.query.usuario_id as string || req.usuario!.id;

    // Admin pode ver de qualquer um, vendedor so o seu
    if (req.usuario!.papel !== 'admin' && userId !== req.usuario!.id) {
      return res.status(403).json({ erro: 'Sem permissao' });
    }

    const registros = db.prepare(
      `SELECT p.*, u.nome as usuario_nome
       FROM ponto p
       LEFT JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.usuario_id = ? AND p.criado_em >= datetime('now', 'localtime', ?)
       ORDER BY p.criado_em DESC`
    ).all(userId, `-${dias} days`) as any[];

    res.json(registros);
  }

  // GET /api/ponto/equipe - quem esta trabalhando agora (admin)
  equipe(req: Request, res: Response) {
    const db = getDb();
    const hoje = hojeLocal();

    const usuarios = db.prepare(
      'SELECT id, nome, papel FROM usuarios WHERE ativo = 1'
    ).all() as any[];

    const statusEquipe = usuarios.map((u: any) => {
      const ultimo = db.prepare(
        "SELECT * FROM ponto WHERE usuario_id = ? AND criado_em >= ? ORDER BY criado_em DESC LIMIT 1"
      ).get(u.id, hoje) as any;

      const registrosHoje = db.prepare(
        "SELECT * FROM ponto WHERE usuario_id = ? AND criado_em >= ? ORDER BY criado_em ASC"
      ).all(u.id, hoje) as any[];

      let minutosHoje = 0;
      for (let i = 0; i < registrosHoje.length; i += 2) {
        const entrada = registrosHoje[i];
        const saida = registrosHoje[i + 1];
        if (entrada?.tipo === 'entrada') {
          const fim = saida ? new Date(saida.criado_em) : new Date();
          minutosHoje += (fim.getTime() - new Date(entrada.criado_em).getTime()) / 60000;
        }
      }

      return {
        id: u.id,
        nome: u.nome,
        papel: u.papel,
        trabalhando: ultimo?.tipo === 'entrada',
        entrada_em: registrosHoje.find((r: any) => r.tipo === 'entrada')?.criado_em || null,
        minutos_hoje: Math.round(minutosHoje),
      };
    });

    res.json(statusEquipe);
  }

  // GET /api/ponto/relatorio - relatorio mensal (admin)
  relatorio(req: Request, res: Response) {
    const db = getDb();
    const mes = req.query.mes as string; // formato: 2026-03
    if (!mes) return res.status(400).json({ erro: 'Parametro mes e obrigatorio (ex: 2026-03)' });

    const inicioMes = `${mes}-01`;
    const fimMes = `${mes}-31 23:59:59`;

    const usuarios = db.prepare(
      'SELECT id, nome, papel FROM usuarios WHERE ativo = 1'
    ).all() as any[];

    const relatorio = usuarios.map((u: any) => {
      const registros = db.prepare(
        "SELECT * FROM ponto WHERE usuario_id = ? AND criado_em >= ? AND criado_em <= ? ORDER BY criado_em ASC"
      ).all(u.id, inicioMes, fimMes) as any[];

      // Agrupar por dia
      const porDia: Record<string, any[]> = {};
      for (const r of registros) {
        const dia = r.criado_em.split(' ')[0].split('T')[0];
        if (!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(r);
      }

      let totalMinutos = 0;
      let diasTrabalhados = 0;
      const dias: any[] = [];

      for (const [dia, regs] of Object.entries(porDia)) {
        let minutoDia = 0;
        for (let i = 0; i < regs.length; i += 2) {
          const entrada = regs[i];
          const saida = regs[i + 1];
          if (entrada?.tipo === 'entrada') {
            const fim = saida ? new Date(saida.criado_em) : new Date(entrada.criado_em);
            minutoDia += (fim.getTime() - new Date(entrada.criado_em).getTime()) / 60000;
          }
        }
        totalMinutos += minutoDia;
        if (minutoDia > 0) diasTrabalhados++;
        dias.push({
          data: dia,
          minutos: Math.round(minutoDia),
          registros: regs.length,
        });
      }

      return {
        usuario_id: u.id,
        nome: u.nome,
        papel: u.papel,
        dias_trabalhados: diasTrabalhados,
        total_minutos: Math.round(totalMinutos),
        total_horas: (totalMinutos / 60).toFixed(1),
        dias,
      };
    });

    res.json(relatorio);
  }
}
