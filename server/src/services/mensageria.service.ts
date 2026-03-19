import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { getDb } from '../config/database';
import { ClaudeService, MensagemChat, BANTResult } from './claude.service';
import { ExtracaoService } from './extracao.service';
import { MetaService } from './meta.service';
import { EvolutionService } from './evolution.service';
import { mimetypeParaTipo } from './media.service';
import {
  WhatsAppIncomingMessage,
  WhatsAppStatusUpdate,
  InstagramDMMessage,
  InstagramCommentEvent,
} from './webhook.service';
import { SdrQualifierService } from './sdr-qualifier.service';
import { InstagramService } from './instagram.service';
import { markBotSent } from './whatsapp-queue.service';

const claudeService = new ClaudeService();
const extracaoService = new ExtracaoService();
const metaService = new MetaService();
const evolutionService = new EvolutionService();
const qualifierService = new SdrQualifierService();
const instagramService = new InstagramService();

type Canal = 'whatsapp' | 'instagram_dm' | 'instagram_comment' | 'interno';

export class MensageriaService {
  async processarWhatsApp(event: WhatsAppIncomingMessage): Promise<void> {
    const db = getDb();

    // Deduplication
    const existente = db.prepare('SELECT id FROM mensagens WHERE meta_msg_id = ?').get(event.messageId);
    if (existente) return;

    // Find or create conversation + client
    const { conversaId, clienteId } = await this.encontrarOuCriarConversa(
      'whatsapp', event.from, event.name
    );

    // Determine media type
    let tipoMidia: string = 'texto';
    let midiaUrl: string | null = null;
    if (event.messageType !== 'text' && event.mediaId) {
      tipoMidia = event.messageType;
      const media = await metaService.baixarMidia(event.mediaId);
      midiaUrl = media?.url || null;
    }

    // Save incoming message
    const msgId = uuidv4();
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio, tipo_midia, midia_url)
       VALUES (?, ?, 'user', ?, 'whatsapp', ?, 'entregue', ?, ?)`
    ).run(msgId, conversaId, event.text || `[${tipoMidia}]`, event.messageId, tipoMidia, midiaUrl);

    // Update conversation
    db.prepare(
      "UPDATE conversas SET ultimo_canal_msg_id = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(event.messageId, conversaId);

    // Mark as read on WhatsApp
    metaService.marcarComoLido(event.messageId).catch(() => {});

    // Log interaction
    db.prepare(
      'INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), clienteId, 'whatsapp', `Mensagem recebida via WhatsApp: ${(event.text || '').substring(0, 100)}`);

    // Auto-respond with Agente IA if modo_auto is active
    const conversa = db.prepare('SELECT modo_auto FROM conversas WHERE id = ?').get(conversaId) as any;
    if (conversa?.modo_auto) {
      await this.autoResponderIA(conversaId, clienteId, 'whatsapp');
    } else {
      // Extração em background mesmo sem modo_auto
      this.extrairDadosBackground(conversaId, clienteId).catch(e =>
        console.error('Erro extracao background WhatsApp:', e)
      );
    }
  }

  async processarInstagramDM(event: InstagramDMMessage, instagramContaId?: string): Promise<void> {
    const db = getDb();

    // Deduplication
    const existente = db.prepare('SELECT id FROM mensagens WHERE meta_msg_id = ?').get(event.messageId);
    if (existente) return;

    // Check if the message is from ourselves (page) - skip if so
    if (instagramContaId) {
      const conta = instagramService.obterConta(instagramContaId);
      if (conta && event.senderId === conta.page_id) return;
    } else {
      const config = await metaService.getConfig();
      if (config && event.senderId === config.page_id) return;
    }

    const { conversaId, clienteId } = await this.encontrarOuCriarConversa(
      'instagram_dm', event.senderId, `IG:${event.senderId}`
    );

    // Salvar instagram_conta_id na conversa
    if (instagramContaId) {
      db.prepare(
        "UPDATE conversas SET instagram_conta_id = ? WHERE id = ? AND instagram_conta_id IS NULL"
      ).run(instagramContaId, conversaId);
    }

    let tipoMidia = 'texto';
    let midiaUrl: string | null = null;
    if (event.attachmentUrl) {
      tipoMidia = event.attachmentType === 'image' ? 'imagem' : event.attachmentType === 'video' ? 'video' : 'imagem';
      midiaUrl = event.attachmentUrl;
    }

    const msgId = uuidv4();
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio, tipo_midia, midia_url)
       VALUES (?, ?, 'user', ?, 'instagram_dm', ?, 'entregue', ?, ?)`
    ).run(msgId, conversaId, event.text || `[${tipoMidia}]`, event.messageId, tipoMidia, midiaUrl);

    db.prepare(
      "UPDATE conversas SET ultimo_canal_msg_id = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(event.messageId, conversaId);

    db.prepare(
      'INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), clienteId, 'chat', `DM recebido via Instagram: ${(event.text || '').substring(0, 100)}`);

    const conversa = db.prepare('SELECT modo_auto FROM conversas WHERE id = ?').get(conversaId) as any;
    if (conversa?.modo_auto) {
      await this.autoResponderIA(conversaId, clienteId, 'instagram_dm');
    } else {
      this.extrairDadosBackground(conversaId, clienteId).catch(e =>
        console.error('Erro extracao background IG DM:', e)
      );
    }
  }

  async processarInstagramComment(event: InstagramCommentEvent, _instagramContaId?: string): Promise<void> {
    const db = getDb();

    // Deduplication
    const existente = db.prepare('SELECT id FROM mensagens WHERE meta_msg_id = ?').get(event.commentId);
    if (existente) return;

    // Track the post
    if (event.mediaId) {
      const postExists = db.prepare('SELECT id FROM instagram_posts WHERE ig_media_id = ?').get(event.mediaId);
      if (!postExists) {
        db.prepare(
          'INSERT INTO instagram_posts (id, ig_media_id) VALUES (?, ?)'
        ).run(uuidv4(), event.mediaId);
      }
    }

    const { conversaId, clienteId } = await this.encontrarOuCriarConversa(
      'instagram_comment', event.senderId, event.senderUsername || `IG:${event.senderId}`
    );

    const msgId = uuidv4();
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio, tipo_midia)
       VALUES (?, ?, 'user', ?, 'instagram_comment', ?, 'entregue', 'comentario')`
    ).run(msgId, conversaId, event.text, event.commentId);

    db.prepare(
      "UPDATE conversas SET ultimo_canal_msg_id = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(event.commentId, conversaId);

    db.prepare(
      'INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), clienteId, 'chat', `Comentário no Instagram: ${event.text.substring(0, 100)}`);

    const conversa = db.prepare('SELECT modo_auto FROM conversas WHERE id = ?').get(conversaId) as any;
    if (conversa?.modo_auto) {
      await this.autoResponderIA(conversaId, clienteId, 'instagram_comment');
    } else {
      this.extrairDadosBackground(conversaId, clienteId).catch(e =>
        console.error('Erro extracao background IG comment:', e)
      );
    }
  }

  async processarStatusWhatsApp(event: WhatsAppStatusUpdate): Promise<void> {
    const db = getDb();

    const statusMap: Record<string, string> = {
      sent: 'enviado',
      delivered: 'entregue',
      read: 'lido',
      failed: 'falhou',
    };

    const statusDb = statusMap[event.status] || 'enviado';

    // Find message by meta_msg_id and update status
    db.prepare(
      'UPDATE mensagens SET status_envio = ? WHERE meta_msg_id = ?'
    ).run(statusDb, event.messageId);
  }

  async enviarMensagemManual(
    conversaId: string,
    texto: string,
    usarDara: boolean,
    vendedorId?: string
  ): Promise<{ resposta: string; dados_extraidos?: any }> {
    const db = getDb();
    const conversa = db.prepare(
      'SELECT * FROM conversas WHERE id = ?'
    ).get(conversaId) as any;
    if (!conversa) throw new Error('Conversa não encontrada');

    let respostaTexto = texto;

    // Se humano está enviando mensagem manual (não IA), desligar modo_auto
    // para que o SDR/auto-responder pare imediatamente
    if (!usarDara && conversa.modo_auto) {
      db.prepare(
        "UPDATE conversas SET modo_auto = 0, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
      ).run(conversaId);
      console.log(`[Mensageria] Humano assumiu conversa ${conversaId} - modo_auto desligado`);
    }

    if (usarDara) {
      // Get history and generate IA response
      const mensagensDb = db.prepare(
        'SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversaId) as any[];

      const historico: MensagemChat[] = mensagensDb.map(m => ({
        role: m.papel as 'user' | 'assistant',
        content: m.conteudo,
      }));

      respostaTexto = await claudeService.enviarMensagem(historico);
    }

    // Save outgoing message
    const msgId = uuidv4();
    const metaMsgId = `out_${Date.now()}`;
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio)
       VALUES (?, ?, 'assistant', ?, ?, ?, 'pendente')`
    ).run(msgId, conversaId, respostaTexto, conversa.canal, metaMsgId);

    db.prepare(
      "UPDATE conversas SET atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(conversaId);

    // Send via appropriate channel
    // Mark as bot-sent so Baileys webhook doesn't trigger human takeover
    if (conversa.canal === 'whatsapp' && conversa.meta_contato_id) {
      markBotSent(conversa.meta_contato_id);
    }
    try {
      if (conversa.canal === 'whatsapp' && conversa.meta_contato_id) {
        const result = await metaService.enviarWhatsApp(conversa.meta_contato_id, respostaTexto);
        const sentMsgId = result?.messages?.[0]?.id;
        if (sentMsgId) {
          db.prepare('UPDATE mensagens SET meta_msg_id = ?, status_envio = ? WHERE id = ?')
            .run(sentMsgId, 'enviado', msgId);
        }
      } else if (conversa.canal === 'instagram_dm' && conversa.meta_contato_id) {
        if (conversa.instagram_conta_id) {
          await instagramService.enviarDM(conversa.instagram_conta_id, conversa.meta_contato_id, respostaTexto);
        } else {
          await metaService.enviarInstagramDM(conversa.meta_contato_id, respostaTexto);
        }
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
      } else if (conversa.canal === 'instagram_comment' && conversa.ultimo_canal_msg_id) {
        if (conversa.instagram_conta_id) {
          await instagramService.responderComentario(conversa.instagram_conta_id, conversa.ultimo_canal_msg_id, respostaTexto);
        } else {
          await metaService.responderComentarioInstagram(conversa.ultimo_canal_msg_id, respostaTexto);
        }
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
      } else {
        // Internal channel - mark as sent
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
      }
    } catch (e: any) {
      console.error('Erro ao enviar mensagem via canal:', e);
      db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('falhou', msgId);
    }

    // Extract data + BANT if using IA
    let dadosExtraidos = null;
    if (usarDara) {
      try {
        const allMsgs = db.prepare(
          'SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
        ).all(conversaId) as any[];
        const hist: MensagemChat[] = allMsgs.map(m => ({
          role: m.papel as 'user' | 'assistant',
          content: m.conteudo,
        }));
        dadosExtraidos = await claudeService.extrairDados(hist);
        if (dadosExtraidos) {
          db.prepare('UPDATE mensagens SET dados_extraidos = ? WHERE id = ?')
            .run(JSON.stringify(dadosExtraidos), msgId);
          if (conversa.cliente_id) {
            extracaoService.atualizarCliente(conversa.cliente_id, dadosExtraidos);
          }
        }

        // Processar BANT
        if (conversa.cliente_id) {
          this.processarBANT(conversaId, conversa.cliente_id, hist).catch(e =>
            console.error('Erro BANT manual:', e)
          );
        }
      } catch (e) {
        console.error('Erro na extração de dados:', e);
      }
    }

    return { resposta: respostaTexto, dados_extraidos: dadosExtraidos };
  }

  async enviarMidiaManual(
    conversaId: string,
    filePath: string,
    fileName: string,
    mimetype: string,
    caption?: string
  ): Promise<{ ok: boolean; mensagem?: any }> {
    const db = getDb();
    const conversa = db.prepare('SELECT * FROM conversas WHERE id = ?').get(conversaId) as any;
    if (!conversa) throw new Error('Conversa não encontrada');

    const tipoMidia = mimetypeParaTipo(mimetype);
    const midiaUrl = `/uploads/${fileName}`;

    // Salvar mensagem no DB
    const msgId = uuidv4();
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio, tipo_midia, midia_url)
       VALUES (?, ?, 'assistant', ?, ?, 'pendente', ?, ?)`
    ).run(msgId, conversaId, caption || `[${tipoMidia}]`, conversa.canal, tipoMidia, midiaUrl);

    db.prepare(
      "UPDATE conversas SET atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(conversaId);

    // Enviar via WhatsApp Baileys
    try {
      if (conversa.canal === 'whatsapp' && conversa.meta_contato_id) {
        const buffer = fs.readFileSync(filePath);
        await evolutionService.enviarMidia(conversa.meta_contato_id, tipoMidia, buffer, mimetype, caption);
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
      } else {
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
      }
    } catch (e: any) {
      console.error('Erro ao enviar mídia:', e);
      db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('falhou', msgId);
    }

    const mensagem = db.prepare('SELECT * FROM mensagens WHERE id = ?').get(msgId);
    return { ok: true, mensagem };
  }

  toggleModoAuto(conversaId: string, modoAuto: boolean): void {
    const db = getDb();
    db.prepare(
      "UPDATE conversas SET modo_auto = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(modoAuto ? 1 : 0, conversaId);
  }

  async encontrarOuCriarConversa(
    canal: Canal,
    metaContatoId: string,
    nome: string
  ): Promise<{ conversaId: string; clienteId: string }> {
    const db = getDb();

    // Find active conversation for this contact + channel
    const conversaExistente = db.prepare(
      'SELECT id, cliente_id FROM conversas WHERE canal = ? AND meta_contato_id = ? AND ativa = 1 ORDER BY atualizado_em DESC LIMIT 1'
    ).get(canal, metaContatoId) as any;

    if (conversaExistente) {
      // Fix orphaned cliente_id: if the client was deleted, find/create a new one
      const clienteExiste = db.prepare('SELECT id FROM clientes WHERE id = ?').get(conversaExistente.cliente_id) as any;
      if (!clienteExiste) {
        // Client was deleted — find or create one for this contact
        let novoClienteId: string | null = null;
        if (canal === 'whatsapp') {
          const phoneNormalized = metaContatoId.replace(/\D/g, '');
          const cliente = db.prepare(
            "SELECT id FROM clientes WHERE REPLACE(REPLACE(telefone, '+', ''), ' ', '') LIKE ?"
          ).get(`%${phoneNormalized.slice(-11)}%`) as any;
          novoClienteId = cliente?.id || null;
        }
        if (!novoClienteId) {
          novoClienteId = uuidv4();
          const telefone = canal === 'whatsapp' ? `+${metaContatoId}` : null;
          db.prepare('INSERT INTO clientes (id, nome, telefone) VALUES (?, ?, ?)').run(novoClienteId, nome, telefone);
        }
        db.prepare('UPDATE conversas SET cliente_id = ?, meta_contato_nome = ? WHERE id = ?').run(novoClienteId, nome, conversaExistente.id);
        console.log(`[Mensageria] Conversa ${conversaExistente.id} re-vinculada ao cliente ${novoClienteId}`);
        return { conversaId: conversaExistente.id, clienteId: novoClienteId };
      }
      return { conversaId: conversaExistente.id, clienteId: conversaExistente.cliente_id };
    }

    // Find client by phone (WhatsApp) or meta contact id
    let clienteId: string | null = null;
    if (canal === 'whatsapp') {
      // Try to find client by phone number (normalize: remove +, spaces)
      const phoneNormalized = metaContatoId.replace(/\D/g, '');
      const cliente = db.prepare(
        "SELECT id FROM clientes WHERE REPLACE(REPLACE(telefone, '+', ''), ' ', '') LIKE ?"
      ).get(`%${phoneNormalized.slice(-11)}%`) as any;
      clienteId = cliente?.id || null;
    }

    if (!clienteId) {
      // Check if there's an existing conversa for this meta contact (any channel)
      const outraConversa = db.prepare(
        'SELECT cliente_id FROM conversas WHERE meta_contato_id = ? LIMIT 1'
      ).get(metaContatoId) as any;
      clienteId = outraConversa?.cliente_id || null;
    }

    // Create client if not found
    if (!clienteId) {
      clienteId = uuidv4();
      const telefone = canal === 'whatsapp' ? `+${metaContatoId}` : null;
      db.prepare(
        'INSERT INTO clientes (id, nome, telefone) VALUES (?, ?, ?)'
      ).run(clienteId, nome, telefone);
    }

    // Create conversation with modo_auto=1 by default
    const conversaId = uuidv4();
    db.prepare(
      'INSERT INTO conversas (id, cliente_id, canal, meta_contato_id, meta_contato_nome, modo_auto) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(conversaId, clienteId, canal, metaContatoId, nome);

    return { conversaId, clienteId };
  }

  private async extrairDadosBackground(conversaId: string, clienteId: string): Promise<void> {
    try {
      const db = getDb();
      const mensagensDb = db.prepare(
        'SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversaId) as any[];

      if (mensagensDb.length < 2) return; // Precisa de pelo menos 2 msgs

      const historico: MensagemChat[] = mensagensDb.map(m => ({
        role: m.papel as 'user' | 'assistant',
        content: m.conteudo,
      }));

      // Extrair dados do cliente + ODV
      const dados = await claudeService.extrairDados(historico);
      if (dados) {
        // Salvar dados_extraidos na ultima mensagem do user
        const ultimaMsg = db.prepare(
          "SELECT id FROM mensagens WHERE conversa_id = ? AND papel = 'user' ORDER BY criado_em DESC LIMIT 1"
        ).get(conversaId) as any;
        if (ultimaMsg) {
          db.prepare('UPDATE mensagens SET dados_extraidos = ? WHERE id = ?')
            .run(JSON.stringify(dados), ultimaMsg.id);
        }
        extracaoService.atualizarCliente(clienteId, dados);
        // Auto-preencher ODV no pipeline com dados da conversa
        extracaoService.atualizarOdv(clienteId, dados, conversaId);
      }

      // Processar BANT
      this.processarBANT(conversaId, clienteId, historico).catch(e =>
        console.error('Erro BANT background:', e)
      );
    } catch (e) {
      console.error('Erro na extracao de dados em background:', e);
    }
  }

  private async processarBANT(conversaId: string, clienteId: string, historico: MensagemChat[]): Promise<void> {
    try {
      const db = getDb();
      const bant = await claudeService.extrairBANT(historico);
      if (!bant) return;

      // Buscar estado anterior
      const conversaAntes = db.prepare(
        'SELECT bant_qualificado, bant_score, cliente_id FROM conversas WHERE id = ?'
      ).get(conversaId) as any;
      const eraQualificado = conversaAntes?.bant_qualificado === 1;

      // Atualizar BANT na conversa
      db.prepare(
        `UPDATE conversas SET
          bant_score = ?, bant_budget = ?, bant_authority = ?,
          bant_need = ?, bant_timeline = ?, bant_qualificado = ?,
          bant_atualizado_em = datetime('now', 'localtime')
        WHERE id = ?`
      ).run(
        bant.score,
        bant.budget,
        bant.authority,
        bant.need,
        bant.timeline,
        bant.qualificado ? 1 : 0,
        conversaId
      );

      console.log(`[BANT] Conversa ${conversaId}: score=${bant.score}/4 qualificado=${bant.qualificado}`);

      // Qualificar lead localmente (mover no funil)
      try {
        const conversa = db.prepare('SELECT * FROM conversas WHERE id = ?').get(conversaId) as any;
        const telefone = conversa?.meta_contato_id?.replace(/\D/g, '') || '';
        if (telefone) {
          const totalMsgs = db.prepare(
            'SELECT COUNT(*) as total FROM mensagens WHERE conversa_id = ?'
          ).get(conversaId) as any;

          // Buscar ODV associada ao cliente
          const odv = clienteId ? db.prepare(
            'SELECT id FROM pipeline WHERE cliente_id = ? ORDER BY atualizado_em DESC LIMIT 1'
          ).get(clienteId) as any : null;

          await qualifierService.qualificarLead({
            telefone,
            clienteId,
            pipelineId: odv?.id,
            bant: {
              budget: bant.budget,
              authority: bant.authority,
              need: bant.need,
              timeline: bant.timeline,
            },
            engajamento: totalMsgs?.total || 0,
          });
        }
      } catch (e) {
        console.error('[BANT] Erro ao qualificar lead:', e);
      }

      // Transicao: nao qualificado → qualificado
      if (bant.qualificado && !eraQualificado) {
        console.log(`[BANT] Lead QUALIFICADO! Criando ODV e notificando admin...`);

        // Buscar dados do cliente
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId) as any;
        const nomeCliente = cliente?.nome || 'Cliente';

        // Calcular valor estimado da ODV a partir do budget
        let valorOdv = 0;
        if (bant.budget) {
          const numeros = bant.budget.match(/\d+/g);
          if (numeros && numeros.length > 0) {
            valorOdv = Math.max(...numeros.map(Number));
          }
        }

        // Criar ODV no pipeline (vinculada a conversa)
        const odvId = uuidv4();
        const titulo = `${nomeCliente} - ${bant.need || 'Interesse em joias'}`;
        db.prepare(
          `INSERT INTO pipeline (id, cliente_id, titulo, valor, estagio, produto_interesse, notas, conversa_id)
           VALUES (?, ?, ?, ?, 'Interessado', ?, ?, ?)`
        ).run(
          odvId,
          clienteId,
          titulo,
          valorOdv,
          bant.need,
          `BANT: Need=${bant.need || '-'}, Budget=${bant.budget || '-'}, Timeline=${bant.timeline || '-'}, Authority=${bant.authority || '-'}`,
          conversaId
        );

        console.log(`[BANT] ODV criada: ${titulo} (R$${valorOdv})`);

        // Notificar admin via WhatsApp
        try {
          const adminPhone = db.prepare(
            "SELECT telefone_admin FROM sdr_agent_config WHERE id = 1"
          ).get() as any;

          if (adminPhone?.telefone_admin) {
            const resumo = `Lead qualificado (BANT ${bant.score}/4):\n` +
              `Cliente: ${nomeCliente}\n` +
              `Telefone: ${cliente?.telefone || '-'}\n` +
              `Necessidade: ${bant.need || '-'}\n` +
              `Orcamento: ${bant.budget || '-'}\n` +
              `Prazo: ${bant.timeline || '-'}\n` +
              `Decisor: ${bant.authority || '-'}`;

            await evolutionService.enviarTexto(adminPhone.telefone_admin, resumo);
            console.log(`[BANT] Admin notificado via WhatsApp`);
          }
        } catch (e) {
          console.error('[BANT] Erro ao notificar admin:', e);
        }
      }
    } catch (e) {
      console.error('Erro no processamento BANT:', e);
    }
  }

  private async autoResponderIA(conversaId: string, clienteId: string, canal: Canal): Promise<void> {
    try {
      const db = getDb();
      const mensagensDb = db.prepare(
        'SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversaId) as any[];

      const historico: MensagemChat[] = mensagensDb.map(m => ({
        role: m.papel as 'user' | 'assistant',
        content: m.conteudo,
      }));

      const resposta = await claudeService.enviarMensagem(historico);

      // Save agent response
      const msgId = uuidv4();
      db.prepare(
        `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio)
         VALUES (?, ?, 'assistant', ?, ?, 'pendente')`
      ).run(msgId, conversaId, resposta, canal);

      db.prepare(
        "UPDATE conversas SET atualizado_em = datetime('now', 'localtime') WHERE id = ?"
      ).run(conversaId);

      // Send response via channel
      const conversa = db.prepare('SELECT * FROM conversas WHERE id = ?').get(conversaId) as any;
      try {
        if (canal === 'whatsapp' && conversa.meta_contato_id) {
          const result = await metaService.enviarWhatsApp(conversa.meta_contato_id, resposta);
          const sentMsgId = result?.messages?.[0]?.id;
          if (sentMsgId) {
            db.prepare('UPDATE mensagens SET meta_msg_id = ?, status_envio = ? WHERE id = ?')
              .run(sentMsgId, 'enviado', msgId);
          }
        } else if (canal === 'instagram_dm' && conversa.meta_contato_id) {
          if (conversa.instagram_conta_id) {
            await instagramService.enviarDM(conversa.instagram_conta_id, conversa.meta_contato_id, resposta);
          } else {
            await metaService.enviarInstagramDM(conversa.meta_contato_id, resposta);
          }
          db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
        } else if (canal === 'instagram_comment' && conversa.ultimo_canal_msg_id) {
          if (conversa.instagram_conta_id) {
            await instagramService.responderComentario(conversa.instagram_conta_id, conversa.ultimo_canal_msg_id, resposta);
          } else {
            await metaService.responderComentarioInstagram(conversa.ultimo_canal_msg_id, resposta);
          }
          db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
        }
      } catch (e) {
        console.error('Erro ao enviar auto-resposta:', e);
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('falhou', msgId);
      }

      // Extract data + BANT
      const allMsgs = db.prepare(
        'SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversaId) as any[];
      const hist: MensagemChat[] = allMsgs.map(m => ({
        role: m.papel as 'user' | 'assistant',
        content: m.conteudo,
      }));

      try {
        const dados = await claudeService.extrairDados(hist);
        if (dados) {
          db.prepare('UPDATE mensagens SET dados_extraidos = ? WHERE id = ?')
            .run(JSON.stringify(dados), msgId);
          extracaoService.atualizarCliente(clienteId, dados);
          // Auto-preencher ODV no pipeline com dados da conversa
          extracaoService.atualizarOdv(clienteId, dados, conversaId);
        }
      } catch (e) {
        console.error('Erro na extração auto:', e);
      }

      // Processar BANT (em paralelo com extração, não bloqueia)
      this.processarBANT(conversaId, clienteId, hist).catch(e =>
        console.error('Erro BANT auto:', e)
      );
    } catch (e) {
      console.error('Erro na auto-resposta IA:', e);
    }
  }
}
