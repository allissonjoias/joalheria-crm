import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb, saveDb } from '../config/database';
import { ClaudeService, MensagemChat, MensagemMultimodal, ContentBlock, BANTResult } from './claude.service';
import { ExtracaoService } from './extracao.service';
import { MetaService } from './meta.service';
import { EvolutionService } from './evolution.service';
import { mimetypeParaTipo, extrairFrameVideo } from './media.service';
import { agoraLocal } from '../utils/timezone';
import {
  WhatsAppIncomingMessage,
  WhatsAppStatusUpdate,
  InstagramDMMessage,
  InstagramCommentEvent,
} from './webhook.service';
import { SdrQualifierService } from './sdr-qualifier.service';
import { InstagramService } from './instagram.service';
import { markBotSent } from './whatsapp-queue.service';
import { skillService } from './skill.service';
import { getProdutosFormatados } from '../utils/prompt';
import { brechasService } from './brechas.service';
import { unipileService } from './unipile.service';

const claudeService = new ClaudeService();
const extracaoService = new ExtracaoService();
const metaService = new MetaService();
const evolutionService = new EvolutionService();
const qualifierService = new SdrQualifierService();
const instagramService = new InstagramService();

/**
 * Envia DM Instagram preferindo Unipile quando configurado.
 * Fallback: instagramService (multi-conta) ou metaService.
 * `chatId` (ultimo_canal_msg_id da conversa) eh requerido para Unipile.
 */
async function enviarInstagramDM(
  recipientId: string,
  texto: string,
  igContaId?: string | null,
  chatId?: string | null
): Promise<void> {
  const cfgUnipile = unipileService.getConfig();
  if (cfgUnipile && cfgUnipile.ativo && cfgUnipile.api_key && cfgUnipile.dsn && chatId) {
    try {
      await unipileService.enviarMensagem(chatId, texto);
      return;
    } catch (e: any) {
      console.warn('[Unipile] Falha ao enviar, tentando fallback Meta:', e.message);
    }
  }
  if (igContaId) {
    await instagramService.enviarDM(igContaId, recipientId, texto);
    return;
  }
  await metaService.enviarInstagramDM(recipientId, texto);
}

type Canal = 'whatsapp' | 'instagram_dm' | 'instagram_comment' | 'interno';

const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

// Monta mensagens multimodais com imagens/vídeos reais do disco
async function montarMensagensComVisao(mensagensDb: any[]): Promise<MensagemMultimodal[]> {
  const result: MensagemMultimodal[] = [];

  for (const m of mensagensDb) {
    const textoLimpo = limparConteudoParaIAStatic(m.conteudo);
    const temImagem = (m.tipo_midia === 'imagem' || m.tipo_midia === 'sticker') && m.midia_url;
    const temVideo = m.tipo_midia === 'video' && m.midia_url;

    if (m.papel === 'user' && (temImagem || temVideo)) {
      try {
        const fileName = m.midia_url.replace('/uploads/', '');
        const filePath = path.join(UPLOADS_DIR, fileName);
        let buffer: Buffer | null = null;
        let mediaType = 'image/jpeg';

        if (temImagem && fs.existsSync(filePath)) {
          buffer = fs.readFileSync(filePath);
          const ext = path.extname(fileName).toLowerCase();
          mediaType = ext === '.png' ? 'image/png'
            : ext === '.webp' ? 'image/webp'
            : ext === '.gif' ? 'image/gif'
            : 'image/jpeg';
        } else if (temVideo && fs.existsSync(filePath)) {
          // Extrair frame do vídeo via ffmpeg
          buffer = await extrairFrameVideo(filePath);
          mediaType = 'image/jpeg';
        }

        if (buffer && buffer.length <= 2 * 1024 * 1024) {
          const blocks: ContentBlock[] = [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
          ];
          const prompt = temVideo
            ? 'O cliente enviou este vídeo. Esta é uma captura do vídeo. Descreva o que vê e responda de forma relevante.'
            : 'O cliente enviou esta imagem. Descreva o que vê e responda de forma relevante.';
          blocks.push({ type: 'text', text: textoLimpo && !textoLimpo.startsWith('[') ? textoLimpo : prompt });
          result.push({ role: 'user', content: blocks });
          continue;
        }
      } catch (e) {
        // Fallback para texto
      }
    }

    result.push({ role: m.papel, content: textoLimpo });
  }

  return result;
}

// Versão estática do limparConteudoParaIA (para usar fora da classe)
function limparConteudoParaIAStatic(conteudo: string): string {
  try {
    if (conteudo?.startsWith('{') || conteudo?.startsWith('{\n')) {
      const parsed = JSON.parse(conteudo);
      if (parsed.resposta) return parsed.resposta;
    }
  } catch {}
  const match = conteudo?.match(/"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (match) return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  return conteudo;
}

// Cache em memória para deduplicação de webhooks (evita race condition)
const processandoMsgIds = new Set<string>();
function marcarProcessando(msgId: string): boolean {
  if (processandoMsgIds.has(msgId)) return false; // já está sendo processado
  processandoMsgIds.add(msgId);
  // Limpar após 30s para não crescer infinitamente
  setTimeout(() => processandoMsgIds.delete(msgId), 30000);
  return true;
}

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
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio, tipo_midia, midia_url, criado_em)
       VALUES (?, ?, 'user', ?, 'whatsapp', ?, 'entregue', ?, ?, ?)`
    ).run(msgId, conversaId, event.text || `[${tipoMidia}]`, event.messageId, tipoMidia, midiaUrl, agoraLocal());

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

    // ═══ AUTO-MOVE: Contato → BANT quando cliente responde ═══
    this.executarGatilhoClienteRespondeu(clienteId);

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

    // Deduplication (cache em memória + banco)
    if (!marcarProcessando(event.messageId)) return;
    const existente = db.prepare('SELECT id FROM mensagens WHERE meta_msg_id = ?').get(event.messageId);
    if (existente) return;

    // Check if the message is from ourselves (page/ig_user_id) - skip if so
    if (instagramContaId) {
      const conta = instagramService.obterConta(instagramContaId);
      if (conta && (event.senderId === conta.page_id || event.senderId === conta.ig_user_id)) return;
    } else {
      const config = await metaService.getConfig();
      if (config && (event.senderId === config.page_id || event.senderId === config.instagram_business_account_id)) return;
    }

    // Se o evento veio com nome/foto preenchidos (Unipile), usar direto
    let nomeContato = event.senderName || event.senderUsername || `IG:${event.senderId}`;
    let fotoPerfil: string | null = event.senderProfilePicUrl || null;
    if (!event.senderName && !event.senderUsername && instagramContaId) {
      const conta = instagramService.obterConta(instagramContaId);
      if (conta?.access_token) {
        try {
          const res = await fetch(`https://graph.facebook.com/v22.0/${event.senderId}?fields=name,username,profile_pic&access_token=${conta.access_token}`);
          if (res.ok) {
            const userData = await res.json() as any;
            nomeContato = userData.username || userData.name || nomeContato;
            fotoPerfil = userData.profile_pic || null;
          }
        } catch { /* fallback para ID */ }
      }
    }

    const { conversaId, clienteId } = await this.encontrarOuCriarConversa(
      'instagram_dm', event.senderId, nomeContato
    );

    // Atualizar nome do cliente se for melhor que o existente (substitui "IG:xxx" por nome real)
    if (clienteId && (event.senderName || event.senderUsername)) {
      const clienteInfo = db.prepare('SELECT nome, foto_perfil FROM clientes WHERE id = ?').get(clienteId) as any;
      const nomeAtual = clienteInfo?.nome || '';
      const nomeBom = event.senderName || event.senderUsername || '';
      if (nomeBom && (nomeAtual.startsWith('IG:') || nomeAtual.startsWith('Unipile:') || !nomeAtual)) {
        db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(nomeBom, clienteId);
      }
      if (fotoPerfil && !clienteInfo?.foto_perfil) {
        db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(fotoPerfil, clienteId);
      }
    } else if (fotoPerfil && clienteId) {
      const clienteInfo = db.prepare('SELECT foto_perfil FROM clientes WHERE id = ?').get(clienteId) as any;
      if (!clienteInfo?.foto_perfil) {
        db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(fotoPerfil, clienteId);
      }
    }

    // Salvar instagram_conta_id na conversa
    if (instagramContaId) {
      db.prepare(
        "UPDATE conversas SET instagram_conta_id = ? WHERE id = ? AND instagram_conta_id IS NULL"
      ).run(instagramContaId, conversaId);
    }

    // Se a DM é resposta a um story/post, salvar mediaId e sincronizar post
    if (event.replyToMediaId) {
      try {
        db.prepare("UPDATE conversas SET instagram_media_id = ? WHERE id = ?").run(event.replyToMediaId, conversaId);
        // Garantir registro do post + sincronizar background
        const postExists = db.prepare('SELECT id FROM instagram_posts WHERE ig_media_id = ?').get(event.replyToMediaId);
        if (!postExists) {
          db.prepare(
            'INSERT INTO instagram_posts (id, ig_media_id, tipo) VALUES (?, ?, ?)'
          ).run(uuidv4(), event.replyToMediaId, event.replyToType === 'story' ? 'story' : 'post');
        }
        instagramService.sincronizarPost(event.replyToMediaId, instagramContaId).catch(() => {});
      } catch {
        // coluna pode nao existir, ignorar
      }
    }

    let tipoMidia = 'texto';
    let midiaUrl: string | null = null;
    if (event.attachmentUrl) {
      const t = String(event.attachmentType || '').toLowerCase();
      tipoMidia =
        t === 'audio' || t === 'voice' || t === 'voice_note' ? 'audio' :
        t === 'video' ? 'video' :
        t === 'image' || t === 'photo' || t === 'imagem' ? 'imagem' :
        t === 'document' || t === 'documento' || t === 'file' ? 'documento' :
        'imagem'; // fallback
      midiaUrl = event.attachmentUrl;

      // URLs do CDN da Meta (lookaside.fbsbx.com) expiram e exigem auth — baixa local
      if (midiaUrl && /lookaside\.fbsbx\.com/i.test(midiaUrl)) {
        try {
          const localUrl = await this._baixarMidiaMetaLocal(midiaUrl, event.messageId, tipoMidia);
          if (localUrl) midiaUrl = localUrl;
        } catch (e: any) {
          console.warn('[Mensageria] falha baixar mídia Meta:', e.message);
        }
      }
    }

    // Deduplicação inter-canais (Meta + Unipile mandam IDs diferentes pra mesma msg).
    // Se já existe uma msg na MESMA conversa com mesmo conteúdo+tipo nos últimos 60s, pula.
    const conteudoFinal = event.text || `[${tipoMidia}]`;
    const duplicada = db.prepare(
      `SELECT id, instagram_media_id, midia_url FROM mensagens
       WHERE conversa_id = ?
         AND papel = 'user'
         AND tipo_midia = ?
         AND conteudo = ?
         AND criado_em > datetime('now','localtime','-60 seconds')
       LIMIT 1`
    ).get(conversaId, tipoMidia, conteudoFinal) as any;
    if (duplicada) {
      // ENRIQUECE a já-salva com dados que ela não tinha mas o webhook duplicado tem
      // (ex: Meta tem reply_to.story, Unipile não tem; ou vice-versa)
      if (event.replyToMediaId && !duplicada.instagram_media_id) {
        db.prepare('UPDATE mensagens SET instagram_media_id = ? WHERE id = ?').run(event.replyToMediaId, duplicada.id);
      }
      if (midiaUrl && !duplicada.midia_url) {
        db.prepare('UPDATE mensagens SET midia_url = ? WHERE id = ?').run(midiaUrl, duplicada.id);
      }
      console.log(`[Mensageria] DM duplicada ignorada: "${conteudoFinal.substring(0, 30)}" (msg ${duplicada.id})`);
      return;
    }

    const msgId = uuidv4();
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio, tipo_midia, midia_url, instagram_media_id, criado_em)
       VALUES (?, ?, 'user', ?, 'instagram_dm', ?, 'entregue', ?, ?, ?, ?)`
    ).run(msgId, conversaId, conteudoFinal, event.messageId, tipoMidia, midiaUrl, event.replyToMediaId || null, agoraLocal());

    db.prepare(
      "UPDATE conversas SET ultimo_canal_msg_id = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(event.messageId, conversaId);

    db.prepare(
      'INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), clienteId, 'chat', `DM recebido via Instagram: ${(event.text || '').substring(0, 100)}`);

    // ═══ AUTO-MOVE: Contato → BANT quando cliente responde ═══
    this.executarGatilhoClienteRespondeu(clienteId);

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

    // Deduplication (cache em memória + banco)
    if (!marcarProcessando(event.commentId)) return;
    const existente = db.prepare('SELECT id FROM mensagens WHERE meta_msg_id = ?').get(event.commentId);
    if (existente) return;

    // Track the post + sincronizar metadados via Graph API (background)
    if (event.mediaId) {
      const postExists = db.prepare('SELECT id FROM instagram_posts WHERE ig_media_id = ?').get(event.mediaId);
      if (!postExists) {
        db.prepare(
          'INSERT INTO instagram_posts (id, ig_media_id, media_product_type) VALUES (?, ?, ?)'
        ).run(uuidv4(), event.mediaId, event.mediaProductType || null);
      }
      // Buscar permalink/thumbnail/caption sem bloquear (atualiza no banco quando volta)
      instagramService.sincronizarPost(event.mediaId, _instagramContaId).catch(err =>
        console.warn('[Mensageria] sincronizarPost falhou:', err?.message)
      );
    }

    const { conversaId, clienteId } = await this.encontrarOuCriarConversa(
      'instagram_comment', event.senderId, event.senderUsername || `IG:${event.senderId}`
    );

    // Vincular mediaId à conversa (campo já usado: ultimo_canal_msg_id guarda commentId, então usamos meta_contato_id alternativo? não — usamos campo dedicado se possível, senão coluna existente)
    if (event.mediaId) {
      try {
        db.prepare("UPDATE conversas SET instagram_media_id = ? WHERE id = ?").run(event.mediaId, conversaId);
      } catch {
        // coluna pode nao existir, ignorar
      }
    }

    const msgId = uuidv4();
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio, tipo_midia, instagram_media_id, criado_em)
       VALUES (?, ?, 'user', ?, 'instagram_comment', ?, 'entregue', 'comentario', ?, ?)`
    ).run(msgId, conversaId, event.text, event.commentId, event.mediaId || null, agoraLocal());

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
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, meta_msg_id, status_envio, criado_em)
       VALUES (?, ?, 'assistant', ?, ?, ?, 'pendente', ?)`
    ).run(msgId, conversaId, respostaTexto, conversa.canal, metaMsgId, agoraLocal());

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
        // Usar instagram_conta_id da conversa ou buscar conta ativa como fallback
        let igContaId = conversa.instagram_conta_id;
        if (!igContaId) {
          const contas = instagramService.listarContas();
          const contaAtiva = contas.find((c: any) => c.ativo);
          igContaId = contaAtiva?.id;
          // Atualizar conversa com a conta encontrada
          if (igContaId) {
            db.prepare('UPDATE conversas SET instagram_conta_id = ? WHERE id = ?').run(igContaId, conversaId);
          }
        }
        await enviarInstagramDM(conversa.meta_contato_id, respostaTexto, igContaId, conversa.ultimo_canal_msg_id);
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
      } else if (conversa.canal === 'instagram_comment' && conversa.ultimo_canal_msg_id) {
        let igContaId = conversa.instagram_conta_id;
        if (!igContaId) {
          const contas = instagramService.listarContas();
          const contaAtiva = contas.find((c: any) => c.ativo);
          igContaId = contaAtiva?.id;
        }
        if (igContaId) {
          await instagramService.responderComentario(igContaId, conversa.ultimo_canal_msg_id, respostaTexto);
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
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio, tipo_midia, midia_url, criado_em)
       VALUES (?, ?, 'assistant', ?, ?, 'pendente', ?, ?, ?)`
    ).run(msgId, conversaId, caption || `[${tipoMidia}]`, conversa.canal, tipoMidia, midiaUrl, agoraLocal());

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

  /**
   * Mescla conversas duplicadas em uma única por:
   *  - mesmo cliente_id (canal diferente do mesmo contato)
   *  - mesmo meta_contato_nome (case-insensitive, nomes "reais", não IG:xxx)
   * Preserva mensagens (move para a mestre) e marca duplicadas como inativas.
   */
  async mesclarConversasDuplicadas(): Promise<{ mestres: number; mescladas: number; mensagensMovidas: number }> {
    const db = getDb();

    let mestres = 0;
    let mescladas = 0;
    let mensagensMovidas = 0;

    // PASS 1: agrupar por cliente_id
    const gruposPorCliente = db.prepare(
      `SELECT cliente_id, GROUP_CONCAT(id) as ids, COUNT(*) as n
       FROM conversas
       WHERE ativa = 1 AND cliente_id IS NOT NULL
       GROUP BY cliente_id
       HAVING n > 1`
    ).all() as any[];

    for (const grupo of gruposPorCliente) {
      const ids = String(grupo.ids).split(',');
      const r = this._mesclarGrupoPorIds(ids);
      mestres += r.mestre;
      mescladas += r.mescladas;
      mensagensMovidas += r.mensagensMovidas;
    }

    // PASS 2: agrupar por nome (cliente.nome OU meta_contato_nome) normalizado.
    // Faz "Allisson Ranyel" e "allissonranyel" baterem como mesma pessoa.
    const todasConversas = db.prepare(
      `SELECT c.id, c.meta_contato_nome, cl.nome as cliente_nome
       FROM conversas c
       LEFT JOIN clientes cl ON c.cliente_id = cl.id
       WHERE c.ativa = 1`
    ).all() as any[];

    const grupos = new Map<string, string[]>();
    for (const c of todasConversas) {
      const nomeBom =
        (c.cliente_nome && !String(c.cliente_nome).startsWith('IG:') && !String(c.cliente_nome).startsWith('Unipile:'))
          ? c.cliente_nome
          : (c.meta_contato_nome && !String(c.meta_contato_nome).startsWith('IG:') && !String(c.meta_contato_nome).startsWith('Unipile:'))
            ? c.meta_contato_nome
            : null;
      if (!nomeBom) continue;
      const norm = String(nomeBom)
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''); // só letras/números
      if (norm.length < 3) continue; // ignora "ok", "a", etc.
      if (!grupos.has(norm)) grupos.set(norm, []);
      grupos.get(norm)!.push(c.id);
    }

    for (const [, ids] of grupos) {
      if (ids.length < 2) continue;
      const r = this._mesclarGrupoPorIds(ids);
      mestres += r.mestre;
      mescladas += r.mescladas;
      mensagensMovidas += r.mensagensMovidas;
    }

    // PASS 3: agrupar por mensagens IDÊNTICAS em janela curta (Meta + Unipile mandam
    // a mesma msg via IGSIDs diferentes — sem nome real bom, só dá pra detectar pelo conteúdo)
    const grupoPorMsg = db.prepare(
      `SELECT GROUP_CONCAT(DISTINCT m.conversa_id) as ids, COUNT(DISTINCT m.conversa_id) as n,
              m.tipo_midia, m.conteudo
       FROM mensagens m
       JOIN conversas c ON m.conversa_id = c.id
       WHERE c.ativa = 1
         AND c.canal IN ('instagram_dm','instagram_comment')
         AND m.papel = 'user'
         AND length(m.conteudo) > 4
         AND m.conteudo NOT LIKE '[%]'
       GROUP BY m.tipo_midia, m.conteudo
       HAVING n > 1`
    ).all() as any[];

    for (const g of grupoPorMsg) {
      const ids = String(g.ids).split(',').filter(Boolean);
      if (ids.length < 2) continue;
      // Confirma que as mensagens estão em janela próxima (≤120s) entre as conversas
      const placeholders = ids.map(() => '?').join(',');
      const horarios = db.prepare(
        `SELECT conversa_id, MIN(criado_em) as primeiro
         FROM mensagens
         WHERE conversa_id IN (${placeholders}) AND tipo_midia = ? AND conteudo = ?
         GROUP BY conversa_id`
      ).all(...ids, g.tipo_midia, g.conteudo) as any[];
      const tempos = horarios.map((h: any) => new Date(h.primeiro.replace(' ', 'T') + 'Z').getTime()).sort();
      const diffMaxMs = tempos[tempos.length - 1] - tempos[0];
      if (diffMaxMs > 120000) continue; // diferença maior que 2min, provavelmente coincidência

      const r = this._mesclarGrupoPorIds(ids);
      mestres += r.mestre;
      mescladas += r.mescladas;
      mensagensMovidas += r.mensagensMovidas;
    }

    saveDb();
    console.log(`[Mesclar] ${mestres} grupos, ${mescladas} conversas mescladas, ${mensagensMovidas} mensagens movidas`);
    return { mestres, mescladas, mensagensMovidas };
  }

  private _mesclarGrupoPorIds(ids: string[]): { mestre: number; mescladas: number; mensagensMovidas: number } {
    const db = getDb();
    let mescladas = 0;
    let mensagensMovidas = 0;

    if (ids.length < 2) return { mestre: 0, mescladas: 0, mensagensMovidas: 0 };

    const placeholders = ids.map(() => '?').join(',');
    const conversas = db.prepare(
      `SELECT * FROM conversas WHERE id IN (${placeholders}) AND ativa = 1 ORDER BY criado_em ASC`
    ).all(...ids) as any[];

    if (conversas.length < 2) return { mestre: 0, mescladas: 0, mensagensMovidas: 0 };

    const mestre = conversas[0];
    const outras = conversas.slice(1);

    for (const outra of outras) {
      const moveResult = db.prepare(
        'UPDATE mensagens SET conversa_id = ? WHERE conversa_id = ?'
      ).run(mestre.id, outra.id);
      mensagensMovidas += moveResult.changes || 0;

      if (outra.instagram_media_id && !mestre.instagram_media_id) {
        db.prepare('UPDATE conversas SET instagram_media_id = ? WHERE id = ?').run(outra.instagram_media_id, mestre.id);
      }
      if (outra.instagram_conta_id && !mestre.instagram_conta_id) {
        db.prepare('UPDATE conversas SET instagram_conta_id = ? WHERE id = ?').run(outra.instagram_conta_id, mestre.id);
      }
      const nomeOutra = outra.meta_contato_nome || '';
      const nomeMestre = mestre.meta_contato_nome || '';
      const nomeOutraBom = !nomeOutra.startsWith('IG:') && !nomeOutra.startsWith('Unipile:') && nomeOutra;
      const nomeMestreRuim = nomeMestre.startsWith('IG:') || nomeMestre.startsWith('Unipile:') || !nomeMestre;
      if (nomeOutraBom && nomeMestreRuim) {
        db.prepare('UPDATE conversas SET meta_contato_nome = ? WHERE id = ?').run(nomeOutra, mestre.id);
      }
      // Propagar nome bom para o registro do CLIENTE (que aparece na lista de conversas)
      if (mestre.cliente_id) {
        const clienteAtual = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(mestre.cliente_id) as any;
        const clienteNomeRuim = !clienteAtual?.nome ||
          String(clienteAtual.nome).startsWith('IG:') ||
          String(clienteAtual.nome).startsWith('Unipile:');
        // Pega o melhor nome disponível: outra > mestre (qualquer um que não seja placeholder)
        const melhorNome = nomeOutraBom ? nomeOutra : (!nomeMestreRuim ? nomeMestre : null);
        if (melhorNome && clienteNomeRuim) {
          db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(melhorNome, mestre.cliente_id);
        }
      }

      // Repointar a conversa mesclada para o cliente_id da mestre.
      // Importante: webhooks futuros que vierem com `meta_contato_id` da mesclada
      // (Meta API + Unipile dão IGSIDs diferentes pra mesma pessoa) precisam achar
      // a conversa mestre via cliente_id — só funciona se a mesclada apontar pra ele.
      if (outra.cliente_id && mestre.cliente_id && outra.cliente_id !== mestre.cliente_id) {
        // ANTES de repointar: transferir nome/foto do cliente "filho" pro mestre se este faltar
        try {
          const clienteOutro = db.prepare('SELECT nome, foto_perfil FROM clientes WHERE id = ?').get(outra.cliente_id) as any;
          const clienteMestre = db.prepare('SELECT nome, foto_perfil FROM clientes WHERE id = ?').get(mestre.cliente_id) as any;
          if (clienteOutro && clienteMestre) {
            // Foto: copia do filho pro mestre se mestre não tem
            if (clienteOutro.foto_perfil && !clienteMestre.foto_perfil) {
              db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(clienteOutro.foto_perfil, mestre.cliente_id);
            }
            // Nome: copia do filho pro mestre se mestre tem placeholder
            const nomeFilhoBom = clienteOutro.nome && !String(clienteOutro.nome).startsWith('IG:') && !String(clienteOutro.nome).startsWith('Unipile:');
            const nomeMestreRuim = !clienteMestre.nome || String(clienteMestre.nome).startsWith('IG:') || String(clienteMestre.nome).startsWith('Unipile:');
            if (nomeFilhoBom && nomeMestreRuim) {
              db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(clienteOutro.nome, mestre.cliente_id);
            }
          }
        } catch {}
        // Atualiza a própria conversa mesclada pra apontar pro cliente da mestre
        db.prepare('UPDATE conversas SET cliente_id = ? WHERE id = ?').run(mestre.cliente_id, outra.id);
        // Move interações do cliente antigo pro mestre
        try {
          db.prepare('UPDATE interacoes SET cliente_id = ? WHERE cliente_id = ?').run(mestre.cliente_id, outra.cliente_id);
        } catch {}
      }

      db.prepare("UPDATE conversas SET ativa = 0, atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(outra.id);
      mescladas++;
    }

    const ultimaMsg = db.prepare(
      "SELECT criado_em FROM mensagens WHERE conversa_id = ? ORDER BY criado_em DESC LIMIT 1"
    ).get(mestre.id) as any;
    if (ultimaMsg?.criado_em) {
      db.prepare("UPDATE conversas SET atualizado_em = ? WHERE id = ?").run(ultimaMsg.criado_em, mestre.id);
    }

    return { mestre: 1, mescladas, mensagensMovidas };
  }

  /**
   * Backfill: popula instagram_media_id em conversas e mensagens antigas
   * varrendo webhook_log para extrair media.id de comentários e reply_to de DMs.
   */
  async backfillInstagramMediaId(): Promise<{
    conversasAtualizadas: number;
    conversasTotal: number;
    mensagensAtualizadas: number;
    mensagensTotal: number;
  }> {
    const db = getDb();

    // ─────────── PASS 1: conversas instagram_comment sem media_id ───────────
    const conversas = db.prepare(
      `SELECT id, meta_contato_id, ultimo_canal_msg_id, canal
       FROM conversas
       WHERE canal = 'instagram_comment' AND (instagram_media_id IS NULL OR instagram_media_id = '')`
    ).all() as any[];

    let conversasAtualizadas = 0;

    for (const conv of conversas) {
      const logs = db.prepare(
        `SELECT payload FROM webhook_log
         WHERE plataforma = 'instagram' AND payload LIKE ?
         ORDER BY criado_em DESC LIMIT 5`
      ).all(`%${conv.meta_contato_id}%`) as any[];

      let mediaId: string | null = null;
      let mediaProductType: string | null = null;
      for (const l of logs) {
        try {
          const j = JSON.parse(l.payload);
          for (const entry of j.entry || []) {
            for (const change of entry.changes || []) {
              if (change.field !== 'comments') continue;
              const v = change.value;
              if (v.from?.id === conv.meta_contato_id && v.media?.id) {
                mediaId = v.media.id;
                mediaProductType = v.media.media_product_type || null;
                break;
              }
            }
            if (mediaId) break;
          }
        } catch {}
        if (mediaId) break;
      }

      if (mediaId) {
        db.prepare("UPDATE conversas SET instagram_media_id = ? WHERE id = ?").run(mediaId, conv.id);
        const exists = db.prepare('SELECT id FROM instagram_posts WHERE ig_media_id = ?').get(mediaId);
        if (!exists) {
          db.prepare(
            'INSERT INTO instagram_posts (id, ig_media_id, media_product_type) VALUES (?, ?, ?)'
          ).run(uuidv4(), mediaId, mediaProductType);
        }
        instagramService.sincronizarPost(mediaId).catch(() => {});
        conversasAtualizadas++;
      }
    }

    // ─────────── PASS 2: mensagens individuais sem instagram_media_id ───────────
    const mensagens = db.prepare(
      `SELECT m.id, m.conversa_id, m.canal_origem, m.meta_msg_id, c.instagram_media_id as conv_media_id
       FROM mensagens m
       JOIN conversas c ON m.conversa_id = c.id
       WHERE (m.instagram_media_id IS NULL OR m.instagram_media_id = '')
         AND (m.canal_origem = 'instagram_comment' OR m.canal_origem = 'instagram_dm')`
    ).all() as any[];

    let mensagensAtualizadas = 0;

    for (const msg of mensagens) {
      let mediaId: string | null = null;

      // 2a. Tenta achar pelo meta_msg_id (commentId/messageId) no webhook_log
      if (msg.meta_msg_id) {
        const logs = db.prepare(
          `SELECT payload FROM webhook_log
           WHERE plataforma = 'instagram' AND payload LIKE ?
           ORDER BY criado_em DESC LIMIT 3`
        ).all(`%${msg.meta_msg_id}%`) as any[];

        for (const l of logs) {
          try {
            const j = JSON.parse(l.payload);
            for (const entry of j.entry || []) {
              // Comentário
              for (const change of entry.changes || []) {
                if (change.field !== 'comments') continue;
                const v = change.value;
                if (v.id === msg.meta_msg_id && v.media?.id) {
                  mediaId = v.media.id;
                  break;
                }
              }
              if (mediaId) break;
              // DM com reply_to
              for (const m of entry.messaging || []) {
                if (m.message?.mid === msg.meta_msg_id) {
                  const r = m.message?.reply_to;
                  if (r?.story?.id) { mediaId = r.story.id; break; }
                  if (r?.post?.id) { mediaId = r.post.id; break; }
                }
              }
              if (mediaId) break;
            }
          } catch {}
          if (mediaId) break;
        }
      }

      // 2b. Fallback: usa o media_id da conversa (legado, antes da unificação)
      if (!mediaId && msg.conv_media_id && msg.canal_origem === 'instagram_comment') {
        mediaId = msg.conv_media_id;
      }

      if (mediaId) {
        db.prepare('UPDATE mensagens SET instagram_media_id = ? WHERE id = ?').run(mediaId, msg.id);
        const exists = db.prepare('SELECT id FROM instagram_posts WHERE ig_media_id = ?').get(mediaId);
        if (!exists) {
          db.prepare(
            'INSERT INTO instagram_posts (id, ig_media_id) VALUES (?, ?)'
          ).run(uuidv4(), mediaId);
        }
        instagramService.sincronizarPost(mediaId).catch(() => {});
        mensagensAtualizadas++;
      }
    }

    saveDb();
    console.log(
      `[Backfill IG MediaId] conversas: ${conversasAtualizadas}/${conversas.length}, ` +
      `mensagens: ${mensagensAtualizadas}/${mensagens.length}`
    );
    return {
      conversasAtualizadas,
      conversasTotal: conversas.length,
      mensagensAtualizadas,
      mensagensTotal: mensagens.length,
    };
  }

  /**
   * Sincroniza nome/foto das conversas IG resolvendo IGSIDs via Meta Graph API.
   * Usa o token da conta Instagram cadastrada. Pula conversas já com nome real.
   */
  async sincronizarContatosInstagramViaMeta(): Promise<{ atualizados: number; total: number; erros: number }> {
    const db = getDb();
    const conversas = db.prepare(
      `SELECT c.id, c.cliente_id, c.meta_contato_id, c.meta_contato_nome, c.instagram_conta_id
       FROM conversas c
       WHERE c.canal IN ('instagram_dm','instagram_comment')
         AND (c.meta_contato_nome LIKE 'IG:%' OR c.meta_contato_nome LIKE 'Unipile:%' OR c.meta_contato_nome IS NULL)`
    ).all() as any[];

    // Pega o primeiro access_token disponivel (multi-conta) ou meta_config
    let accessToken: string | null = null;
    const contaAtiva = db.prepare("SELECT access_token FROM instagram_contas WHERE ativo = 1 ORDER BY criado_em DESC LIMIT 1").get() as any;
    accessToken = contaAtiva?.access_token || null;
    if (!accessToken) {
      const cfg = await metaService.getConfig();
      accessToken = cfg?.access_token || null;
    }
    if (!accessToken) throw new Error('Nenhum access_token Instagram disponivel');

    let atualizados = 0;
    let erros = 0;

    for (const conv of conversas) {
      const senderId = conv.meta_contato_id;
      if (!senderId) continue;
      try {
        const url = `https://graph.facebook.com/v22.0/${senderId}?fields=name,username,profile_pic&access_token=${accessToken}`;
        const res = await fetch(url);
        if (!res.ok) {
          erros++;
          continue;
        }
        const data = await res.json() as any;
        const nome = data.username || data.name;
        if (!nome) { erros++; continue; }

        db.prepare('UPDATE conversas SET meta_contato_nome = ? WHERE id = ?').run(nome, conv.id);
        if (conv.cliente_id) {
          const cl = db.prepare('SELECT nome, foto_perfil FROM clientes WHERE id = ?').get(conv.cliente_id) as any;
          if (cl) {
            if (cl.nome?.startsWith('IG:') || cl.nome?.startsWith('Unipile:') || !cl.nome) {
              db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(nome, conv.cliente_id);
            }
            if (data.profile_pic && !cl.foto_perfil) {
              db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(data.profile_pic, conv.cliente_id);
            }
          }
        }
        atualizados++;
      } catch {
        erros++;
      }
    }

    saveDb();
    console.log(`[Sync IG Meta] ${atualizados}/${conversas.length} resolvidos (${erros} erros)`);
    return { atualizados, total: conversas.length, erros };
  }

  /**
   * Sincroniza nome e foto de perfil das conversas Instagram via Unipile.
   * Percorre todos os chats da Unipile, pega attendees (não-self) e atualiza
   * conversas onde meta_contato_nome começa com "IG:" e clientes correspondentes.
   */
  async sincronizarContatosInstagramViaUnipile(): Promise<{ atualizados: number; total: number }> {
    const cfg = unipileService.getConfig();
    if (!cfg || !cfg.api_key || !cfg.dsn) {
      throw new Error('Unipile não configurado');
    }

    const db = getDb();
    let atualizados = 0;
    let total = 0;
    let cursor: string | undefined;
    let paginas = 0;
    const MAX_PAGINAS = 20;

    do {
      const { items, cursor: next } = await unipileService.listarTodosChats(cfg.account_id || undefined, cursor);
      paginas++;
      cursor = next;

      for (const chat of items) {
        const chatId = chat.id;
        if (!chatId) continue;
        try {
          const attendees = await unipileService.listarAttendeesDoChat(chatId);
          for (const att of attendees) {
            if (att.is_self === 1 || att.is_self === true) continue;
            const providerId = att.provider_id || att.attendee_provider_id;
            const nome = att.name || att.specifics?.public_identifier;
            const foto = att.picture_url || att.profile_picture_url;
            if (!providerId || !nome) continue;
            total++;

            // Atualiza meta_contato_nome em conversas IG quando estiver com "IG:..."
            const conversas = db.prepare(
              `SELECT id, cliente_id, meta_contato_nome FROM conversas
               WHERE canal IN ('instagram_dm','instagram_comment') AND meta_contato_id = ?`
            ).all(providerId) as any[];

            for (const conv of conversas) {
              const nomeAtual = conv.meta_contato_nome || '';
              if (nomeAtual.startsWith('IG:') || nomeAtual.startsWith('Unipile:') || !nomeAtual) {
                db.prepare('UPDATE conversas SET meta_contato_nome = ? WHERE id = ?').run(nome, conv.id);
                atualizados++;
              }
              // Atualiza cliente também
              if (conv.cliente_id) {
                const cl = db.prepare('SELECT nome, foto_perfil FROM clientes WHERE id = ?').get(conv.cliente_id) as any;
                if (cl) {
                  if (cl.nome?.startsWith('IG:') || cl.nome?.startsWith('Unipile:') || !cl.nome) {
                    db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(nome, conv.cliente_id);
                  }
                  if (foto && !cl.foto_perfil) {
                    db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(foto, conv.cliente_id);
                  }
                }
              }
            }
          }
        } catch (e: any) {
          console.warn(`[Sync IG] Falha no chat ${chatId}:`, e.message);
        }
      }
    } while (cursor && paginas < MAX_PAGINAS);

    saveDb();
    console.log(`[Sync IG] ${atualizados} conversas atualizadas de ${total} attendees vistos`);
    return { atualizados, total };
  }

  /**
   * Baixa uma mídia de URL CDN da Meta (lookaside.fbsbx.com) e salva localmente.
   * Essas URLs expiram e exigem autenticação no <img> direto, então cacheamos.
   */
  private async _baixarMidiaMetaLocal(url: string, messageId: string, tipoMidia: string): Promise<string | null> {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      let ext = '.bin';
      if (tipoMidia === 'audio' || ct.includes('audio') || ct.includes('ogg') || ct.includes('mp4a')) ext = '.ogg';
      else if (tipoMidia === 'video' || ct.includes('video')) ext = '.mp4';
      else if (ct.includes('jpeg') || ct.includes('jpg') || tipoMidia === 'imagem') ext = '.jpg';
      else if (ct.includes('png')) ext = '.png';
      else if (ct.includes('webp')) ext = '.webp';

      const dir = path.resolve(__dirname, '../../../uploads/meta');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const safeId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
      const filename = `${safeId}${ext}`;
      const filepath = path.join(dir, filename);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) return null;
      fs.writeFileSync(filepath, buf);
      return `/uploads/meta/${filename}`;
    } catch (e: any) {
      console.warn('[Meta media] erro:', e.message);
      return null;
    }
  }

  /**
   * Normaliza nome para matching: remove acentos, converte minúsculas, mantém só
   * letras+números. Permite que "Allisson Ranyel" e "allissonranyel" sejam iguais.
   */
  private normalizarNome(s?: string | null): string {
    if (!s) return '';
    return String(s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  async encontrarOuCriarConversa(
    canal: Canal,
    metaContatoId: string,
    nome: string
  ): Promise<{ conversaId: string; clienteId: string }> {
    const db = getDb();

    // 1) Tentar encontrar conversa do MESMO contato em qualquer canal (match exato por meta_contato_id)
    let conversaExistente = db.prepare(
      'SELECT id, cliente_id FROM conversas WHERE meta_contato_id = ? AND ativa = 1 ORDER BY atualizado_em DESC LIMIT 1'
    ).get(metaContatoId) as any;

    // 1b) Se não achou ATIVA, mas existe conversa MESCLADA (ativa=0) com esse meta_contato_id,
    //     redireciona para a conversa mestre do mesmo cliente_id (que absorveu).
    if (!conversaExistente) {
      const mesclada = db.prepare(
        'SELECT cliente_id FROM conversas WHERE meta_contato_id = ? AND ativa = 0 ORDER BY atualizado_em DESC LIMIT 1'
      ).get(metaContatoId) as any;
      if (mesclada?.cliente_id) {
        const mestre = db.prepare(
          `SELECT id, cliente_id FROM conversas
           WHERE cliente_id = ? AND ativa = 1
             AND canal IN ('instagram_dm','instagram_comment')
           ORDER BY atualizado_em DESC LIMIT 1`
        ).get(mesclada.cliente_id) as any;
        if (mestre) {
          conversaExistente = mestre;
          console.log(`[Mensageria] meta_contato_id=${metaContatoId} estava em conversa mesclada — redirecionando p/ mestre ${mestre.id}`);
        }
      }
    }

    // 2) Para canais Instagram: IGSIDs sao app-scoped (Meta API e Unipile geram IDs diferentes
    //    pra mesma pessoa). Tentar matching por NOME NORMALIZADO em conversas IG ativas existentes.
    if (!conversaExistente && (canal === 'instagram_dm' || canal === 'instagram_comment')) {
      const nomeNorm = this.normalizarNome(nome);
      // Só faz match se nome tem ao menos 3 chars E nao começa com IG:/Unipile: (nomes placeholder)
      const nomeReal = nome && !nome.startsWith('IG:') && !nome.startsWith('Unipile:');
      if (nomeReal && nomeNorm.length >= 3) {
        const candidatas = db.prepare(
          `SELECT c.id, c.cliente_id, c.meta_contato_nome, cl.nome as cliente_nome
           FROM conversas c LEFT JOIN clientes cl ON c.cliente_id = cl.id
           WHERE c.canal IN ('instagram_dm','instagram_comment') AND c.ativa = 1`
        ).all() as any[];
        for (const c of candidatas) {
          const candNorm = this.normalizarNome(c.cliente_nome) || this.normalizarNome(c.meta_contato_nome);
          if (candNorm && candNorm === nomeNorm) {
            conversaExistente = { id: c.id, cliente_id: c.cliente_id };
            console.log(`[Mensageria] Unificou IG por nome normalizado: "${nome}" -> conversa ${c.id}`);
            break;
          }
        }
      }
    }

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

  /**
   * Executa automacoes de gatilho "ao_cliente_responder" para o cliente
   */
  private executarGatilhoClienteRespondeu(clienteId: string) {
    try {
      const { cicloVidaService } = require('./ciclo-vida.service');
      cicloVidaService.executarAutomacoesGatilho?.('ao_cliente_responder', clienteId);
    } catch (e: any) {
      console.error('[AUTO-FUNIL] Erro ao executar gatilho ao_cliente_responder:', e.message);
    }
  }

  private async processarBANT(conversaId: string, clienteId: string, historico: MensagemChat[]): Promise<void> {
    try {
      const db = getDb();

      // Verificar se a ODV do cliente esta em etapa de qualificacao
      // Score BANT so e calculado nas etapas iniciais (economiza IA)
      const ETAPAS_BANT = ['Contato', 'BANT', 'Qualificado'];
      const odvAtual = clienteId ? db.prepare(
        `SELECT id, estagio FROM pipeline
         WHERE cliente_id = ? AND funil_id = 10
         ORDER BY atualizado_em DESC LIMIT 1`
      ).get(clienteId) as any : null;

      if (odvAtual && !ETAPAS_BANT.includes(odvAtual.estagio)) {
        // ODV em etapa pos-qualificacao, nao precisa calcular BANT
        return;
      }

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

          const resultadoQualificacao = await qualifierService.qualificarLead({
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

          // Executar automacoes de gatilho por_lead_score
          if (resultadoQualificacao && clienteId) {
            try {
              const { cicloVidaService } = require('./ciclo-vida.service');
              cicloVidaService.executarAutomacoesGatilho?.('por_lead_score', clienteId, {
                score: resultadoQualificacao.score,
                conversaId,
              });
            } catch (e) {
              console.error('[BANT] Erro ao executar automacoes por_lead_score:', e);
            }
          }
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
           VALUES (?, ?, ?, ?, 'Contato', ?, ?, ?)`
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

      // MIDDLEWARE DE BRECHAS: verificar opt-out, problema, reengajamento ANTES da Luma
      const ultimaMsgUser = db.prepare(
        "SELECT conteudo FROM mensagens WHERE conversa_id = ? AND papel = 'user' ORDER BY criado_em DESC LIMIT 1"
      ).get(conversaId) as any;

      if (ultimaMsgUser?.conteudo) {
        const brecha = brechasService.middlewareMensagemRecebida(clienteId, ultimaMsgUser.conteudo);
        if (brecha && brecha.resposta_luma) {
          // Brecha detectada: enviar resposta da brecha, NÃO da Luma
          const msgId = uuidv4();
          db.prepare(
            `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio, criado_em)
             VALUES (?, ?, 'assistant', ?, ?, 'pendente', ?)`
          ).run(msgId, conversaId, brecha.resposta_luma, canal, agoraLocal());

          // Enviar pelo canal
          const conversa = db.prepare('SELECT * FROM conversas WHERE id = ?').get(conversaId) as any;
          try {
            if (canal === 'whatsapp' && conversa.meta_contato_id) {
              await metaService.enviarWhatsApp(conversa.meta_contato_id, brecha.resposta_luma);
              db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
            } else if (canal === 'instagram_dm' && conversa.meta_contato_id) {
              let igContaId = conversa.instagram_conta_id;
              if (!igContaId) {
                const contas = instagramService.listarContas();
                const contaAtiva = contas.find((c: any) => c.ativo);
                igContaId = contaAtiva?.id;
              }
              if (igContaId) {
                await instagramService.enviarDM(igContaId, conversa.meta_contato_id, brecha.resposta_luma);
              }
              db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
            }
          } catch (e) {
            console.error('[BRECHAS] Erro ao enviar resposta de brecha:', e);
            db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('falhou', msgId);
          }

          console.log(`[BRECHAS] Brecha "${brecha.acao}" detectada para cliente ${clienteId}`);
          return; // Não continuar com Luma
        }
      }

      const mensagensDb = db.prepare(
        'SELECT papel, conteudo, tipo_midia, midia_url FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversaId) as any[];

      // Limitar histórico: últimas 15 mensagens para economizar tokens
      const ultimas = mensagensDb.slice(-15);
      const historico: MensagemChat[] = ultimas.map(m => ({
        role: m.papel as 'user' | 'assistant',
        content: this.limparConteudoParaIA(m.conteudo),
      }));

      // Verificar se há imagens ou vídeos recentes para usar Vision
      const temImagemRecente = ultimas.some(m =>
        m.papel === 'user' && (m.tipo_midia === 'imagem' || m.tipo_midia === 'sticker' || m.tipo_midia === 'video') && m.midia_url
      );

      // Tentar usar sistema multi-agente com skills (mais eficiente em tokens)
      let resposta: string;
      const agenteAtivo = db.prepare(
        "SELECT id FROM agentes_ia WHERE ativo = 1 ORDER BY id ASC LIMIT 1"
      ).get() as any;

      if (agenteAtivo && skillService.isMultiAgente(agenteAtivo.id)) {
        const ultimaMsg = historico[historico.length - 1]?.content || '';
        // Buscar dados do cliente para contexto
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId) as any;
        const contextoLead = cliente
          ? `[CONTEXTO] Nome: ${cliente.nome || 'desconhecido'}, Tel: ${cliente.telefone || '-'}`
          : '[CONTEXTO] Novo lead';
        const produtos = getProdutosFormatados();

        // Chamada 1: Router (50 tokens) - decide sub-agente
        const subAgente = await skillService.routeMessage(agenteAtivo.id, ultimaMsg, contextoLead, historico.slice(-4));

        // Chamada 2: Sub-agente gera resposta (com visão se houver imagens)
        if (temImagemRecente) {
          const mensagensVision = await montarMensagensComVisao(ultimas.slice(-8));
          const subPrompt = skillService.getSubAgentePrompt(agenteAtivo.id, subAgente);
          const systemPrompt = subPrompt
            ? subPrompt.replace('{{PRODUTOS}}', produtos)
            : `Voce e uma consultora de joalheria premium. Produtos:\n${produtos}`;
          const respostaRaw = await claudeService.enviarMensagemComVisao(
            `${systemPrompt}\n\n${contextoLead}`,
            mensagensVision, 1024
          );
          resposta = this.extrairRespostaTexto(respostaRaw);
        } else {
          const respostaRaw = await skillService.gerarResposta(agenteAtivo.id, subAgente, historico.slice(-8), contextoLead, produtos);
          resposta = this.extrairRespostaTexto(respostaRaw);
        }
      } else if (temImagemRecente) {
        // Sem multi-agente mas com imagens: usar Vision
        const { getSystemPrompt } = require('../utils/prompt');
        const mensagensVision = await montarMensagensComVisao(ultimas);
        const respostaRaw = await claudeService.enviarMensagemComVisao(getSystemPrompt(), mensagensVision, 1024);
        resposta = this.extrairRespostaTexto(respostaRaw);
      } else {
        const respostaRaw = await claudeService.enviarMensagem(historico);
        resposta = this.extrairRespostaTexto(respostaRaw);
      }

      // Save agent response
      const msgId = uuidv4();
      db.prepare(
        `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio, criado_em)
         VALUES (?, ?, 'assistant', ?, ?, 'pendente', ?)`
      ).run(msgId, conversaId, resposta, canal, agoraLocal());

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
          let igContaId = conversa.instagram_conta_id;
          if (!igContaId) {
            const contas = instagramService.listarContas();
            const contaAtiva = contas.find((c: any) => c.ativo);
            igContaId = contaAtiva?.id;
            if (igContaId) {
              db.prepare('UPDATE conversas SET instagram_conta_id = ? WHERE id = ?').run(igContaId, conversaId);
            }
          }
          await enviarInstagramDM(conversa.meta_contato_id, resposta, igContaId, conversa.ultimo_canal_msg_id);
          db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
        } else if (canal === 'instagram_comment' && conversa.ultimo_canal_msg_id) {
          let igContaId = conversa.instagram_conta_id;
          if (!igContaId) {
            const contas = instagramService.listarContas();
            const contaAtiva = contas.find((c: any) => c.ativo);
            igContaId = contaAtiva?.id;
          }
          if (igContaId) {
            await instagramService.responderComentario(igContaId, conversa.ultimo_canal_msg_id, resposta);
          } else {
            await metaService.responderComentarioInstagram(conversa.ultimo_canal_msg_id, resposta);
          }
          db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
        }
      } catch (e) {
        console.error('Erro ao enviar auto-resposta:', e);
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('falhou', msgId);
      }

      // Extract data + BANT (pular para comentários do Instagram - são muito curtos)
      if (canal !== 'instagram_comment') {
        // Só extrair dados a cada 3 mensagens do user para economizar API
        const totalUser = db.prepare(
          "SELECT COUNT(*) as c FROM mensagens WHERE conversa_id = ? AND papel = 'user'"
        ).get(conversaId) as any;
        const deveFazerExtracao = (totalUser?.c || 0) % 3 === 0 || (totalUser?.c || 0) <= 2;

        if (deveFazerExtracao) {
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
              extracaoService.atualizarOdv(clienteId, dados, conversaId);
            }
          } catch (e) {
            console.error('Erro na extração auto:', e);
          }

          // BANT junto com extração
          this.processarBANT(conversaId, clienteId, hist).catch(e =>
            console.error('Erro BANT auto:', e)
          );
        }
      }
    } catch (e) {
      console.error('Erro na auto-resposta IA:', e);
    }
  }

  // Extrai apenas o texto de resposta se a IA retornou JSON
  private extrairRespostaTexto(resposta: string): string {
    // Tentar parse direto primeiro
    try {
      const parsed = JSON.parse(resposta.trim());
      if (parsed.resposta) return parsed.resposta;
    } catch {}

    // Tentar encontrar primeiro objeto JSON válido (non-greedy)
    try {
      const jsonMatch = resposta.match(/\{[^{}]*"resposta"\s*:\s*"[^"]*"[^{}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.resposta) return parsed.resposta;
      }
    } catch {}

    // Fallback: extrair valor de "resposta" por regex direto
    const respostaMatch = resposta.match(/"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (respostaMatch) {
      return respostaMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
    }

    // Limpar aspas e chaves residuais se nenhum JSON válido
    let limpo = resposta.replace(/^\s*\{?\s*"resposta"\s*:\s*"?/i, '').replace(/"?\s*,?\s*"nome_lead"[\s\S]*$/i, '').replace(/"\s*\}\s*$/,'');
    if (limpo !== resposta && limpo.length > 10) return limpo;

    return resposta;
  }

  // Limpa conteúdo JSON salvo anteriormente para não poluir o histórico da IA
  private limparConteudoParaIA(conteudo: string): string {
    try {
      if (conteudo.startsWith('{') || conteudo.startsWith('{\n')) {
        const parsed = JSON.parse(conteudo);
        if (parsed.resposta) return parsed.resposta;
      }
    } catch {}
    // Fallback regex para JSON malformado
    const match = conteudo.match(/"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match) return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
    return conteudo;
  }
}
