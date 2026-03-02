import { Request, Response } from 'express';
import path from 'path';
import { getDb } from '../config/database';
import { MensageriaService } from '../services/mensageria.service';

const mensageriaService = new MensageriaService();
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

export class MensageriaController {
  // GET /api/mensageria/conversas
  listarConversas(req: Request, res: Response) {
    const db = getDb();
    const canal = req.query.canal as string | undefined;
    const modo_auto = req.query.modo_auto as string | undefined;
    const vendedor_id = req.query.vendedor_id as string | undefined;

    let query = `
      SELECT c.*, cl.nome as cliente_nome, cl.telefone as cliente_telefone,
        (SELECT COUNT(*) FROM mensagens WHERE conversa_id = c.id) as total_mensagens,
        (SELECT conteudo FROM mensagens WHERE conversa_id = c.id ORDER BY criado_em DESC LIMIT 1) as ultima_mensagem,
        (SELECT criado_em FROM mensagens WHERE conversa_id = c.id ORDER BY criado_em DESC LIMIT 1) as ultima_msg_em
      FROM conversas c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (canal && canal !== 'todos') {
      query += ' AND c.canal = ?';
      params.push(canal);
    }

    if (modo_auto !== undefined && modo_auto !== '') {
      query += ' AND c.modo_auto = ?';
      params.push(modo_auto === 'true' || modo_auto === '1' ? 1 : 0);
    }

    if (vendedor_id) {
      query += ' AND c.vendedor_id = ?';
      params.push(vendedor_id);
    } else if (req.usuario?.papel === 'vendedor') {
      // Vendedores veem todas as conversas externas + as suas internas
      query += ' AND (c.canal != ? OR c.vendedor_id = ?)';
      params.push('interno', req.usuario.id);
    }

    query += ' ORDER BY c.atualizado_em DESC';
    const conversas = db.prepare(query).all(...params);
    res.json(conversas);
  }

  // GET /api/mensageria/conversas/:id
  obterConversa(req: Request, res: Response) {
    const db = getDb();
    const conversa = db.prepare(
      `SELECT c.*, cl.nome as cliente_nome, cl.telefone as cliente_telefone,
        cl.email as cliente_email, cl.tipo_interesse, cl.material_preferido,
        cl.pedra_preferida, cl.orcamento_min, cl.orcamento_max, cl.ocasiao,
        c.bant_score, c.bant_budget, c.bant_authority, c.bant_need,
        c.bant_timeline, c.bant_qualificado, c.bant_atualizado_em
       FROM conversas c
       LEFT JOIN clientes cl ON c.cliente_id = cl.id
       WHERE c.id = ?`
    ).get(req.params.id);

    if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

    const mensagens = db.prepare(
      `SELECT id, conversa_id, papel, conteudo, dados_extraidos, canal_origem,
              meta_msg_id, status_envio, tipo_midia, midia_url, transcricao, criado_em
       FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC`
    ).all(req.params.id);

    // Get latest extracted data
    const ultimaDadosMsg = db.prepare(
      `SELECT dados_extraidos FROM mensagens
       WHERE conversa_id = ? AND dados_extraidos IS NOT NULL
       ORDER BY criado_em DESC LIMIT 1`
    ).get(req.params.id) as any;

    let dadosExtraidos = null;
    if (ultimaDadosMsg?.dados_extraidos) {
      try {
        dadosExtraidos = JSON.parse(ultimaDadosMsg.dados_extraidos);
      } catch {}
    }

    res.json({ conversa, mensagens, dadosExtraidos });
  }

  // POST /api/mensageria/conversas/:id/mensagens
  async enviarMensagem(req: Request, res: Response) {
    try {
      const { texto, usar_dara } = req.body;
      if (!texto && !usar_dara) {
        return res.status(400).json({ erro: 'Texto é obrigatório para envio manual' });
      }

      const conversaId = req.params.id as string;
      const result = await mensageriaService.enviarMensagemManual(
        conversaId,
        texto || '',
        !!usar_dara,
        req.usuario?.id
      );

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  // POST /api/mensageria/conversas/:id/midia
  async enviarMidia(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
      }

      const conversaId = req.params.id as string;
      const caption = req.body.caption || '';
      const filePath = req.file.path;
      const fileName = req.file.filename;
      const mimetype = req.file.mimetype;

      const result = await mensageriaService.enviarMidiaManual(
        conversaId,
        filePath,
        fileName,
        mimetype,
        caption
      );

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  // PUT /api/mensageria/conversas/:id/modo-auto
  toggleModoAuto(req: Request, res: Response) {
    try {
      const { modo_auto } = req.body;
      mensageriaService.toggleModoAuto(req.params.id as string, !!modo_auto);
      res.json({ modo_auto: !!modo_auto });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  // PUT /api/mensageria/conversas/:id/atribuir
  atribuirVendedor(req: Request, res: Response) {
    try {
      const db = getDb();
      const { vendedor_id } = req.body;
      db.prepare(
        "UPDATE conversas SET vendedor_id = ?, atualizado_em = datetime('now') WHERE id = ?"
      ).run(vendedor_id, req.params.id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  // GET /api/mensageria/estatisticas
  estatisticas(req: Request, res: Response) {
    const db = getDb();

    const porCanal = db.prepare(`
      SELECT canal, COUNT(*) as total,
        SUM(CASE WHEN ativa = 1 THEN 1 ELSE 0 END) as ativas
      FROM conversas GROUP BY canal
    `).all();

    const totalMensagens = db.prepare(`
      SELECT canal_origem, COUNT(*) as total
      FROM mensagens GROUP BY canal_origem
    `).all();

    const modoAutoAtivo = db.prepare(
      'SELECT COUNT(*) as total FROM conversas WHERE modo_auto = 1 AND ativa = 1'
    ).get() as any;

    const hoje = new Date().toISOString().split('T')[0];
    const mensagensHoje = db.prepare(
      "SELECT COUNT(*) as total FROM mensagens WHERE criado_em >= ?"
    ).get(hoje) as any;

    res.json({
      conversas_por_canal: porCanal,
      mensagens_por_canal: totalMensagens,
      modo_auto_ativo: modoAutoAtivo?.total || 0,
      mensagens_hoje: mensagensHoje?.total || 0,
    });
  }
}
