import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { ClaudeService, MensagemChat } from '../services/claude.service';
import { ExtracaoService } from '../services/extracao.service';
import { agoraLocal } from '../utils/timezone';

const claudeService = new ClaudeService();
const extracaoService = new ExtracaoService();

export class ChatController {
  listarConversas(req: Request, res: Response) {
    const db = getDb();
    let query = `
      SELECT c.*, cl.nome as cliente_nome,
        (SELECT COUNT(*) FROM mensagens WHERE conversa_id = c.id) as total_mensagens
      FROM conversas c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (req.usuario?.papel === 'vendedor') {
      query += ' AND c.vendedor_id = ?';
      params.push(req.usuario.id);
    }

    query += ' ORDER BY c.atualizado_em DESC';
    const conversas = db.prepare(query).all(...params);
    res.json(conversas);
  }

  obterConversa(req: Request, res: Response) {
    const db = getDb();
    const conversa = db.prepare('SELECT * FROM conversas WHERE id = ?').get(req.params.id);
    if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada' });

    const mensagens = db.prepare(
      'SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
    ).all(req.params.id);

    res.json({ conversa, mensagens });
  }

  async iniciarConversa(req: Request, res: Response) {
    try {
      const db = getDb();
      const { cliente_id, nome_cliente } = req.body;
      let clienteId = cliente_id;

      // Create client if needed
      if (!clienteId && nome_cliente) {
        clienteId = uuidv4();
        db.prepare(
          'INSERT INTO clientes (id, nome, vendedor_id) VALUES (?, ?, ?)'
        ).run(clienteId, nome_cliente, req.usuario?.id || null);
      } else if (!clienteId) {
        clienteId = uuidv4();
        db.prepare(
          'INSERT INTO clientes (id, nome, vendedor_id) VALUES (?, ?, ?)'
        ).run(clienteId, 'Novo Cliente', req.usuario?.id || null);
      }

      const conversaId = uuidv4();
      db.prepare(
        'INSERT INTO conversas (id, cliente_id, vendedor_id) VALUES (?, ?, ?)'
      ).run(conversaId, clienteId, req.usuario?.id || null);

      // Add interaction log
      db.prepare(
        'INSERT INTO interacoes (id, cliente_id, vendedor_id, tipo, descricao) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), clienteId, req.usuario?.id || null, 'chat', 'Nova conversa iniciada');

      res.status(201).json({ conversa_id: conversaId, cliente_id: clienteId });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  async enviarMensagem(req: Request, res: Response) {
    try {
      const db = getDb();
      const { conversa_id } = req.params;
      const { mensagem } = req.body;

      if (!mensagem) return res.status(400).json({ erro: 'Mensagem e obrigatoria' });

      // Save user message
      const userMsgId = uuidv4();
      db.prepare(
        'INSERT INTO mensagens (id, conversa_id, papel, conteudo, criado_em) VALUES (?, ?, ?, ?, ?)'
      ).run(userMsgId, conversa_id, 'user', mensagem, agoraLocal());

      // Get conversation history
      const mensagensDb = db.prepare(
        'SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversa_id) as any[];

      const historico: MensagemChat[] = mensagensDb.map(m => ({
        role: m.papel as 'user' | 'assistant',
        content: m.conteudo,
      }));

      // Get Dara's response
      const resposta = await claudeService.enviarMensagem(historico);

      // Save assistant response
      const assistantMsgId = uuidv4();
      db.prepare(
        'INSERT INTO mensagens (id, conversa_id, papel, conteudo, criado_em) VALUES (?, ?, ?, ?, ?)'
      ).run(assistantMsgId, conversa_id, 'assistant', resposta, agoraLocal());

      // Update conversation timestamp
      db.prepare("UPDATE conversas SET atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(conversa_id);

      // Extract data asynchronously
      let dadosExtraidos = null;
      try {
        dadosExtraidos = await claudeService.extrairDados(historico);
        if (dadosExtraidos) {
          // Save extracted data on message
          db.prepare('UPDATE mensagens SET dados_extraidos = ? WHERE id = ?')
            .run(JSON.stringify(dadosExtraidos), assistantMsgId);

          // Update client with extracted data
          const conversa = db.prepare('SELECT cliente_id FROM conversas WHERE id = ?').get(conversa_id) as any;
          if (conversa) {
            extracaoService.atualizarCliente(conversa.cliente_id, dadosExtraidos);
          }
        }
      } catch (e) {
        console.error('Erro na extracao de dados:', e);
      }

      res.json({
        resposta,
        dados_extraidos: dadosExtraidos,
      });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  // --- Dara IA Config ---

  obterDaraConfig(_req: Request, res: Response) {
    try {
      const db = getDb();
      const config = db.prepare('SELECT * FROM dara_config LIMIT 1').get() as any;
      res.json({
        prompt_personalizado: config?.prompt_personalizado || '',
      });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  salvarDaraConfig(req: Request, res: Response) {
    try {
      const db = getDb();
      const { prompt_personalizado } = req.body;

      const existing = db.prepare('SELECT id FROM dara_config LIMIT 1').get() as any;
      if (existing) {
        db.prepare(
          "UPDATE dara_config SET prompt_personalizado = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(prompt_personalizado || '', existing.id);
      } else {
        db.prepare(
          'INSERT INTO dara_config (id, prompt_personalizado) VALUES (?, ?)'
        ).run(uuidv4(), prompt_personalizado || '');
      }

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ erro: error.message });
    }
  }

  // --- Testar Prompt (simula atendimento ao cliente) ---

  async testarPrompt(req: Request, res: Response) {
    try {
      const { historico } = req.body;
      if (!historico || !Array.isArray(historico) || historico.length === 0) {
        return res.status(400).json({ erro: 'Historico e obrigatorio' });
      }

      const messages: MensagemChat[] = historico.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const resposta = await claudeService.enviarMensagem(messages);
      res.json({ resposta });
    } catch (error: any) {
      console.error('Erro ao testar prompt:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  // --- Ajuda CRM (assistente para duvidas do sistema) ---

  async ajudaCrm(req: Request, res: Response) {
    try {
      const { pergunta, historico } = req.body;

      if (!pergunta) return res.status(400).json({ erro: 'Pergunta e obrigatoria' });

      const messages: MensagemChat[] = [];

      if (historico && Array.isArray(historico)) {
        for (const msg of historico) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }

      messages.push({ role: 'user', content: pergunta });

      const resposta = await claudeService.ajudaCrm(messages);
      res.json({ resposta });
    } catch (error: any) {
      console.error('Erro na ajuda CRM:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  // --- Consultar IA (Q&A para consultoras) ---

  async consultarDara(req: Request, res: Response) {
    try {
      const { pergunta, historico } = req.body;

      if (!pergunta) return res.status(400).json({ erro: 'Pergunta e obrigatoria' });

      const messages: MensagemChat[] = [];

      // Include conversation history if provided
      if (historico && Array.isArray(historico)) {
        for (const msg of historico) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }

      // Add current question
      messages.push({ role: 'user', content: pergunta });

      const resposta = await claudeService.consultarDara(messages);
      res.json({ resposta });
    } catch (error: any) {
      console.error('Erro ao consultar Dara:', error);
      res.status(500).json({ erro: error.message });
    }
  }
}
