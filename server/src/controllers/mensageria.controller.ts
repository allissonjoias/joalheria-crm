import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { getDb, saveDb } from '../config/database';
import { MensageriaService } from '../services/mensageria.service';
import { ClaudeService, MensagemChat } from '../services/claude.service';
import { hojeLocal } from '../utils/timezone';
import { EvolutionService } from '../services/evolution.service';

const mensageriaService = new MensageriaService();
const claudeService = new ClaudeService();
const evolutionService = new EvolutionService();
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');
const AVATARS_DIR = path.resolve(UPLOADS_DIR, 'avatars');

// Garantir que a pasta de avatars existe
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

function downloadImage(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
      file.on('error', () => { file.close(); try { fs.unlinkSync(dest); } catch {} resolve(false); });
    }).on('error', () => { file.close(); try { fs.unlinkSync(dest); } catch {} resolve(false); });
  });
}

export class MensageriaController {
  // GET /api/mensageria/conversas
  listarConversas(req: Request, res: Response) {
    const db = getDb();
    const canal = req.query.canal as string | undefined;
    const modo_auto = req.query.modo_auto as string | undefined;
    const vendedor_id = req.query.vendedor_id as string | undefined;

    let query = `
      SELECT c.*, cl.nome as cliente_nome, cl.telefone as cliente_telefone, cl.foto_perfil,
        (SELECT COUNT(*) FROM mensagens WHERE conversa_id = c.id) as total_mensagens,
        (SELECT conteudo FROM mensagens WHERE conversa_id = c.id ORDER BY criado_em DESC LIMIT 1) as ultima_mensagem,
        (SELECT criado_em FROM mensagens WHERE conversa_id = c.id ORDER BY criado_em DESC LIMIT 1) as ultima_msg_em,
        (SELECT COUNT(*) FROM mensagens WHERE conversa_id = c.id AND papel = 'user' AND criado_em > COALESCE(c.ultima_leitura, '1970-01-01')) as nao_lidas
      FROM conversas c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (canal && canal !== 'todos') {
      query += ' AND c.canal = ?';
      params.push(canal);
    }

    // Excluir conversas internas quando vendo leads/clientes
    const excluirInterno = req.query.excluir_interno as string | undefined;
    if (excluirInterno === '1') {
      query += " AND c.canal != 'interno'";
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
      `SELECT c.*, cl.nome as cliente_nome, cl.telefone as cliente_telefone, cl.foto_perfil,
        cl.email as cliente_email, cl.tipo_interesse, cl.material_preferido,
        cl.pedra_preferida, cl.orcamento_min, cl.orcamento_max, cl.ocasiao,
        c.bant_score, c.bant_budget, c.bant_authority, c.bant_need,
        c.bant_timeline, c.bant_qualificado, c.bant_atualizado_em
       FROM conversas c
       LEFT JOIN clientes cl ON c.cliente_id = cl.id
       WHERE c.id = ?`
    ).get(req.params.id);

    if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

    // Marcar conversa como lida
    db.prepare(
      "UPDATE conversas SET ultima_leitura = datetime('now', 'localtime') WHERE id = ?"
    ).run(req.params.id);

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
        "UPDATE conversas SET vendedor_id = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
      ).run(vendedor_id, req.params.id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  // POST /api/mensageria/conversas/:id/scoring
  async scoringAtendimento(req: Request, res: Response) {
    try {
      const db = getDb();
      const conversaId = req.params.id as string;

      const mensagens = db.prepare(
        'SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversaId) as any[];

      if (mensagens.length < 2) {
        return res.status(400).json({ erro: 'Conversa precisa ter pelo menos 2 mensagens para avaliar' });
      }

      const historico: MensagemChat[] = mensagens.map(m => ({
        role: m.papel as 'user' | 'assistant',
        content: m.conteudo,
      }));

      const scoring = await claudeService.scoringAtendimento(historico);
      if (!scoring) {
        return res.status(500).json({ erro: 'Erro ao gerar scoring' });
      }

      res.json(scoring);
    } catch (error: any) {
      console.error('Erro no scoring:', error);
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

    const hoje = hojeLocal();
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

  // POST /api/mensageria/conversas/interna
  criarConversaInterna(req: Request, res: Response) {
    try {
      const db = getDb();
      const { destinatario_id } = req.body;
      const remetente_id = req.usuario?.id;

      if (!destinatario_id) return res.status(400).json({ erro: 'destinatario_id e obrigatorio' });
      if (!remetente_id) return res.status(401).json({ erro: 'Usuario nao autenticado' });

      // Buscar destinatário
      const destinatario = db.prepare('SELECT id, nome FROM usuarios WHERE id = ? AND ativo = 1').get(destinatario_id) as any;
      if (!destinatario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

      // Verificar se já existe conversa interna entre esses dois
      const existente = db.prepare(`
        SELECT c.id FROM conversas c
        WHERE c.canal = 'interno'
          AND (
            (c.vendedor_id = ? AND c.cliente_id = ?)
            OR (c.vendedor_id = ? AND c.cliente_id = ?)
          )
        LIMIT 1
      `).get(remetente_id, destinatario_id, destinatario_id, remetente_id) as any;

      if (existente) {
        return res.json({ conversa_id: existente.id, existente: true });
      }

      // Criar cliente placeholder para o destinatário (necessário por FK)
      // Usamos o ID do usuario como cliente_id para conversas internas
      const clienteExiste = db.prepare('SELECT id FROM clientes WHERE id = ?').get(destinatario_id);
      if (!clienteExiste) {
        db.prepare(
          "INSERT INTO clientes (id, nome, telefone) VALUES (?, ?, ?)"
        ).run(destinatario_id, destinatario.nome, 'interno');
      }

      // Criar conversa interna
      const conversaId = require('uuid').v4();
      db.prepare(
        `INSERT INTO conversas (id, cliente_id, vendedor_id, canal, modo_auto, ativa)
         VALUES (?, ?, ?, 'interno', 0, 1)`
      ).run(conversaId, destinatario_id, remetente_id);

      res.status(201).json({ conversa_id: conversaId, existente: false });
    } catch (e: any) {
      console.error('Erro ao criar conversa interna:', e);
      res.status(500).json({ erro: e.message });
    }
  }

  // DELETE /api/mensageria/conversas/:id
  excluirConversa(req: Request, res: Response) {
    try {
      const db = getDb();
      const conversaId = req.params.id;

      const conversa = db.prepare(
        'SELECT meta_contato_id, cliente_id FROM conversas WHERE id = ?'
      ).get(conversaId) as any;

      if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada' });

      // Get phone to reset SDR
      const cliente = db.prepare('SELECT telefone FROM clientes WHERE id = ?').get(conversa.cliente_id) as any;
      const telefone = (cliente?.telefone || conversa.meta_contato_id || '').replace(/\D/g, '');

      // Delete messages
      db.prepare('DELETE FROM mensagens WHERE conversa_id = ?').run(conversaId);
      // Delete conversation
      db.prepare('DELETE FROM conversas WHERE id = ?').run(conversaId);

      // Reset SDR data for this phone
      if (telefone) {
        try {
          const { sdrService } = require('../services/sdr.service');
          sdrService.resetarAtendimento(telefone);
        } catch {}
      }

      saveDb();
      console.log(`[Mensageria] Conversa ${conversaId} excluida e atendimento SDR resetado para ${telefone}`);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // DELETE /api/mensageria/conversas/:id/mensagens - Limpa mensagens de uma conversa
  limparMensagens(req: Request, res: Response) {
    try {
      const db = getDb();
      const conversaId = req.params.id;
      const conversa = db.prepare('SELECT id FROM conversas WHERE id = ?').get(conversaId) as any;
      if (!conversa) return res.status(404).json({ erro: 'Conversa não encontrada' });

      const result = db.prepare('DELETE FROM mensagens WHERE conversa_id = ?').run(conversaId);
      db.prepare("UPDATE conversas SET atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(conversaId);
      saveDb();
      console.log(`[Mensageria] ${result.changes} mensagens apagadas da conversa ${conversaId}`);
      res.json({ ok: true, apagadas: result.changes });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  obterSdrInfo(req: Request, res: Response) {
    try {
      const db = getDb();
      const conversaId = req.params.id;

      // Get conversation to find the phone number
      const conversa = db.prepare(
        'SELECT meta_contato_id, cliente_id FROM conversas WHERE id = ?'
      ).get(conversaId) as any;

      if (!conversa) return res.json(null);

      // Get client phone
      const cliente = db.prepare(
        'SELECT telefone FROM clientes WHERE id = ?'
      ).get(conversa.cliente_id) as any;

      const telefone = (cliente?.telefone || conversa.meta_contato_id || '').replace(/\D/g, '');
      if (!telefone) return res.json(null);

      // Search SDR lead tracking by phone (try last 11 digits)
      const telefoneShort = telefone.slice(-11);
      const record = db.prepare(
        "SELECT * FROM kommo_telefone_lead WHERE telefone LIKE ? AND ativo = 1"
      ).get(`%${telefoneShort}`) as any;

      if (!record) return res.json(null);

      // Get recent SDR conversations
      const conversas_sdr = db.prepare(
        'SELECT papel, conteudo, criado_em FROM kommo_sdr_conversas WHERE kommo_lead_id = ? ORDER BY criado_em DESC LIMIT 20'
      ).all(record.kommo_lead_id) as any[];

      res.json({
        kommo_lead_id: record.kommo_lead_id,
        kommo_contact_id: record.kommo_contact_id,
        nome_contato: record.nome_contato,
        telefone: record.telefone,
        estagio_atual: record.estagio_atual,
        bant_score: record.bant_score || 0,
        bant_need: record.bant_need,
        bant_budget: record.bant_budget,
        bant_timeline: record.bant_timeline,
        bant_authority: record.bant_authority,
        // New Luma fields
        estado_sdr: record.estado_sdr || 'COLETA_NOME',
        classificacao: record.classificacao || null,
        score_total: record.score_total || 0,
        score_orcamento: record.score_orcamento || 0,
        score_decisor: record.score_decisor || 0,
        score_necessidade: record.score_necessidade || 0,
        score_prazo: record.score_prazo || 0,
        score_bonus: record.score_bonus || 0,
        bant_produto: record.bant_produto || null,
        bant_ocasiao: record.bant_ocasiao || null,
        bant_decisor: record.bant_decisor || null,
        perfil_lido: record.perfil_lido || null,
        tipo_cliente: record.tipo_cliente || 'normal',
        atualizado_em: record.atualizado_em,
        conversas_sdr: conversas_sdr.reverse(),
      });
    } catch (e: any) {
      res.status(500).json({ erro: e.message });
    }
  }

  // POST /api/mensageria/sync-fotos
  async syncFotosPerfil(req: Request, res: Response) {
    if (!evolutionService.isConnected()) {
      return res.status(400).json({ erro: 'WhatsApp nao conectado' });
    }

    const db = getDb();
    // Buscar clientes sem foto local ou com foto de URL externa (pps.whatsapp.net)
    const clientes = db.prepare(
      `SELECT id, telefone, foto_perfil FROM clientes
       WHERE telefone IS NOT NULL AND telefone != ''
       AND (foto_perfil IS NULL OR foto_perfil = '' OR foto_perfil LIKE '%pps.whatsapp.net%')`
    ).all() as any[];

    let atualizados = 0;
    const total = clientes.length;

    for (const cliente of clientes) {
      try {
        const telefone = cliente.telefone.replace(/\D/g, '');
        if (telefone.length < 10) continue;

        const url = await evolutionService.buscarFotoPerfil(telefone);
        if (url) {
          // Baixar imagem para pasta local
          const filename = `avatar_${cliente.id}.jpg`;
          const filepath = path.join(AVATARS_DIR, filename);
          const ok = await downloadImage(url, filepath);
          if (ok) {
            const localUrl = `/uploads/avatars/${filename}`;
            db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(localUrl, cliente.id);
            atualizados++;
          }
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 300));
      } catch {}
    }

    saveDb();
    res.json({ total, atualizados });
  }
}
