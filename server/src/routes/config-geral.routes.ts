import { Router, Request, Response } from 'express';
import { adminOnly } from '../middleware/auth';
import { getDb, saveDb } from '../config/database';

const router = Router();

// GET /api/config-geral - Obter todas as configuracoes gerais
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT chave, valor FROM config_geral').all() as any[];
    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.chave] = row.valor;
    }
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

// PUT /api/config-geral/fuso-horario - Atualizar fuso horario
router.put('/fuso-horario', adminOnly, (req: Request, res: Response) => {
  try {
    const { fuso_horario } = req.body;
    if (!fuso_horario) {
      return res.status(400).json({ erro: 'Fuso horario e obrigatorio' });
    }

    // Validar que e um fuso brasileiro valido
    const fusosValidos = [
      'America/Noronha',
      'America/Belem',
      'America/Fortaleza',
      'America/Recife',
      'America/Araguaina',
      'America/Maceio',
      'America/Bahia',
      'America/Sao_Paulo',
      'America/Campo_Grande',
      'America/Cuiaba',
      'America/Porto_Velho',
      'America/Manaus',
      'America/Boa_Vista',
      'America/Rio_Branco',
      'America/Eirunepe',
    ];

    if (!fusosValidos.includes(fuso_horario)) {
      return res.status(400).json({ erro: 'Fuso horario invalido' });
    }

    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO config_geral (chave, valor, atualizado_em) VALUES ('fuso_horario', ?, datetime('now', 'localtime'))"
    ).run(fuso_horario);
    saveDb();

    // Aplicar imediatamente no processo
    process.env.TZ = fuso_horario;

    console.log(`[CONFIG] Fuso horario alterado para: ${fuso_horario}`);
    res.json({ ok: true, fuso_horario });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

export default router;
