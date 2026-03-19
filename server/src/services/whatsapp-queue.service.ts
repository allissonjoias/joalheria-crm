import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';
import { EvolutionService, resolveLid } from './evolution.service';
import { ClaudeService, MensagemChat } from './claude.service';
import { ExtracaoService } from './extracao.service';
import { SdrQualifierService } from './sdr-qualifier.service';
import { detectarTipoMidia, baixarMidiaBaileys, transcreverAudio } from './media.service';

const evolutionService = new EvolutionService();
const claudeService = new ClaudeService();
const extracaoService = new ExtracaoService();
const qualifierService = new SdrQualifierService();

// Track recent bot-sent messages to distinguish from human-sent messages
// Key: phone number, Value: timestamp of last bot message
const recentBotMessages = new Map<string, number>();

/** Mark a phone as having received a bot message (expires after 30s) */
export function markBotSent(telefone: string): void {
  const phoneNorm = telefone.replace(/\D/g, '').replace(/@.*/, '');
  recentBotMessages.set(phoneNorm, Date.now());
  // Auto-cleanup after 30 seconds
  setTimeout(() => recentBotMessages.delete(phoneNorm), 30000);
}

/**
 * Limpa resposta da IA que pode vir como JSON ou markdown.
 * Extrai apenas o texto legível para enviar ao cliente.
 */
function limparRespostaIA(raw: string): string {
  let text = raw.trim();
  // Remove markdown code blocks
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed.resposta) return String(parsed.resposta).trim();
  } catch { /* not JSON */ }
  // Try to find JSON object in the middle of text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed.resposta) return String(parsed.resposta).trim();
    } catch { /* not valid JSON */ }
  }
  // Last resort: if it looks like raw JSON, don't send it
  if (text.startsWith('{') && text.includes('"resposta"')) {
    console.warn('[limparRespostaIA] JSON detected but unparseable, attempting extraction');
    const respostaMatch = text.match(/"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (respostaMatch) return respostaMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return text;
}

// Registrar callback para mensagens recebidas (multi-instancia)
evolutionService.setOnMessage(async (instanceId: string, instanceNome: string, payload: any) => {
  try {
    const queueService = new WhatsAppQueueService();
    await queueService.processarWebhook(payload);
  } catch (e) {
    console.error(`[WA:${instanceNome}] Erro ao processar mensagem:`, e);
  }
});

// Warmup progressivo: dia 1=20, dia 2=50, dia 3=100, dia 4+=200
const WARMUP_LIMITES = [20, 50, 100, 200];
const DELAY_MIN = 8000;  // 8 segundos
const DELAY_MAX = 15000; // 15 segundos
const HORA_INICIO = 8;   // 8h
const HORA_FIM = 20;     // 20h

function randomDelay(): number {
  return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
}

function dentroHorarioComercial(): boolean {
  const agora = new Date();
  const hora = agora.getHours();
  return hora >= HORA_INICIO && hora < HORA_FIM;
}

function hoje(): string {
  return new Date().toISOString().split('T')[0];
}

interface Campanha {
  id: string;
  nome: string;
  mensagem_template: string;
  total_contatos: number;
  total_enviados: number;
  total_erros: number;
  status: string;
}

interface FilaItem {
  id: string;
  cliente_id: string;
  telefone: string;
  mensagem: string;
  status: string;
  campanha_id: string | null;
}

// Flag global para parar processamento
let processandoFila = false;
let campanhaAtualId: string | null = null;

export class WhatsAppQueueService {

  // --- Warmup ---

  getLimiteDiario(): number {
    const db = getDb();
    const registros = db.prepare(
      "SELECT COUNT(*) as dias FROM whatsapp_warmup"
    ).get() as any;
    const dias = registros?.dias || 0;
    const idx = Math.min(dias, WARMUP_LIMITES.length - 1);
    return WARMUP_LIMITES[idx];
  }

  getEnviadosHoje(): number {
    const db = getDb();
    const registro = db.prepare(
      'SELECT mensagens_enviadas FROM whatsapp_warmup WHERE data = ?'
    ).get(hoje()) as any;
    return registro?.mensagens_enviadas || 0;
  }

  private incrementarEnviados() {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM whatsapp_warmup WHERE data = ?').get(hoje()) as any;
    if (existing) {
      db.prepare(
        'UPDATE whatsapp_warmup SET mensagens_enviadas = mensagens_enviadas + 1 WHERE data = ?'
      ).run(hoje());
    } else {
      db.prepare(
        'INSERT INTO whatsapp_warmup (id, data, mensagens_enviadas, limite_diario) VALUES (?, ?, 1, ?)'
      ).run(uuidv4(), hoje(), this.getLimiteDiario());
    }
  }

  podeEnviar(): boolean {
    if (!dentroHorarioComercial()) return false;
    return this.getEnviadosHoje() < this.getLimiteDiario();
  }

  getStatusWarmup(): { enviados: number; limite: number; dia: number; dentroHorario: boolean } {
    const db = getDb();
    const dias = (db.prepare("SELECT COUNT(*) as dias FROM whatsapp_warmup").get() as any)?.dias || 0;
    return {
      enviados: this.getEnviadosHoje(),
      limite: this.getLimiteDiario(),
      dia: dias + 1,
      dentroHorario: dentroHorarioComercial(),
    };
  }

  // --- Campanhas ---

  criarCampanha(nome: string, template: string, clienteIds: string[]): Campanha {
    const db = getDb();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO whatsapp_campanhas (id, nome, mensagem_template, total_contatos, status)
       VALUES (?, ?, ?, ?, 'rascunho')`
    ).run(id, nome, template, clienteIds.length);

    // Criar itens na fila para cada cliente
    for (const clienteId of clienteIds) {
      const cliente = db.prepare('SELECT nome, telefone FROM clientes WHERE id = ?').get(clienteId) as any;
      if (!cliente?.telefone) continue;

      // Personalizar mensagem
      const mensagem = template
        .replace(/\{\{nome\}\}/gi, cliente.nome || 'Cliente')
        .replace(/\{\{telefone\}\}/gi, cliente.telefone || '');

      db.prepare(
        `INSERT INTO whatsapp_fila (id, cliente_id, telefone, mensagem, status, campanha_id)
         VALUES (?, ?, ?, ?, 'pendente', ?)`
      ).run(uuidv4(), clienteId, cliente.telefone, mensagem, id);
    }

    return this.obterCampanha(id)!;
  }

  obterCampanha(id: string): Campanha | null {
    const db = getDb();
    return db.prepare('SELECT * FROM whatsapp_campanhas WHERE id = ?').get(id) as Campanha | null;
  }

  listarCampanhas(): Campanha[] {
    const db = getDb();
    return db.prepare('SELECT * FROM whatsapp_campanhas ORDER BY criado_em DESC').all() as Campanha[];
  }

  // --- Envio individual ---

  async enviarMensagemDireta(clienteId: string, telefone: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
    if (!this.podeEnviar()) {
      return { ok: false, erro: 'Fora do horario comercial ou limite diario atingido' };
    }

    try {
      await evolutionService.enviarTexto(telefone, texto);
      this.incrementarEnviados();

      // Registrar como interacao
      const db = getDb();
      db.prepare(
        "INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, 'whatsapp', ?)"
      ).run(uuidv4(), clienteId, `WhatsApp enviado: ${texto.substring(0, 100)}`);

      return { ok: true };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  // --- Processamento da fila ---

  async iniciarCampanha(campanhaId: string): Promise<void> {
    const db = getDb();
    db.prepare(
      "UPDATE whatsapp_campanhas SET status = 'rodando', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(campanhaId);

    campanhaAtualId = campanhaId;
    this.processarFila(campanhaId);
  }

  pausarCampanha(campanhaId: string): void {
    const db = getDb();
    db.prepare(
      "UPDATE whatsapp_campanhas SET status = 'pausada', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(campanhaId);
    if (campanhaAtualId === campanhaId) {
      processandoFila = false;
      campanhaAtualId = null;
    }
  }

  cancelarCampanha(campanhaId: string): void {
    const db = getDb();
    db.prepare(
      "UPDATE whatsapp_campanhas SET status = 'cancelada', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(campanhaId);
    db.prepare(
      "UPDATE whatsapp_fila SET status = 'cancelado' WHERE campanha_id = ? AND status = 'pendente'"
    ).run(campanhaId);
    if (campanhaAtualId === campanhaId) {
      processandoFila = false;
      campanhaAtualId = null;
    }
  }

  private async processarFila(campanhaId: string): Promise<void> {
    if (processandoFila) return;
    processandoFila = true;

    const db = getDb();

    while (processandoFila) {
      // Verificar se campanha foi cancelada/pausada
      const campanha = this.obterCampanha(campanhaId);
      if (!campanha || campanha.status !== 'rodando') {
        processandoFila = false;
        break;
      }

      // Verificar limites
      if (!this.podeEnviar()) {
        // Pausar automaticamente - fora do horario ou limite atingido
        db.prepare(
          "UPDATE whatsapp_campanhas SET status = 'pausada', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(campanhaId);
        console.log('Campanha pausada: fora do horario ou limite diario atingido');
        processandoFila = false;
        break;
      }

      // Pegar proximo item da fila
      const item = db.prepare(
        "SELECT * FROM whatsapp_fila WHERE campanha_id = ? AND status = 'pendente' ORDER BY criado_em ASC LIMIT 1"
      ).get(campanhaId) as FilaItem | undefined;

      if (!item) {
        // Fila vazia - campanha concluida
        db.prepare(
          "UPDATE whatsapp_campanhas SET status = 'concluida', atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(campanhaId);
        processandoFila = false;
        break;
      }

      // Marcar como enviando
      db.prepare("UPDATE whatsapp_fila SET status = 'enviando' WHERE id = ?").run(item.id);

      try {
        await evolutionService.enviarTexto(item.telefone, item.mensagem);

        db.prepare(
          "UPDATE whatsapp_fila SET status = 'enviado', enviado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(item.id);

        db.prepare(
          "UPDATE whatsapp_campanhas SET total_enviados = total_enviados + 1, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(campanhaId);

        this.incrementarEnviados();

        // Registrar interacao
        db.prepare(
          "INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, 'whatsapp', ?)"
        ).run(uuidv4(), item.cliente_id, `Campanha "${campanha.nome}": ${item.mensagem.substring(0, 100)}`);

      } catch (e: any) {
        db.prepare(
          "UPDATE whatsapp_fila SET status = 'erro', erro_detalhe = ? WHERE id = ?"
        ).run(e.message, item.id);

        db.prepare(
          "UPDATE whatsapp_campanhas SET total_erros = total_erros + 1, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
        ).run(campanhaId);
      }

      // Delay aleatorio anti-ban (8-15 segundos)
      const delay = randomDelay();
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    campanhaAtualId = null;
  }

  // --- Webhook (mensagem recebida/enviada) ---

  async processarWebhook(payload: any): Promise<void> {
    // CONNECTION_UPDATE
    if (payload.event === 'connection.update') {
      const state = payload.data?.state || payload.data?.instance?.state;
      if (state === 'open') {
        evolutionService.updateStatus('conectado');
      } else if (state === 'close') {
        evolutionService.updateStatus('desconectado');
      }
      return;
    }

    // MESSAGES_UPSERT - mensagem recebida ou enviada
    if (payload.event === 'messages.upsert') {
      const messages = payload.data?.messages || payload.data || [];
      for (const msg of (Array.isArray(messages) ? messages : [messages])) {
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') continue;

        // Use pre-resolved phone from evolution.service if available
        let telefone = msg._resolvedPhone || remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');

        // Fallback: resolve LID if evolution didn't provide resolved phone
        if (!msg._resolvedPhone && remoteJid.endsWith('@lid')) {
          const resolved = resolveLid(telefone, msg._instanceId);
          if (resolved) {
            telefone = resolved;
          }
        }
        const texto = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.imageMessage?.caption
          || msg.message?.videoMessage?.caption
          || '';
        const fromMe = msg.key?.fromMe || false;
        // pushName em mensagens fromMe é o nome da dona do WhatsApp, nao do cliente
        const nome = fromMe ? telefone : (msg.pushName || telefone);

        // Detectar mídia
        const mediaInfo = msg.message ? detectarTipoMidia(msg.message) : null;
        let tipoMidia: string = 'texto';
        let midiaUrl: string | null = null;
        let transcricao: string | null = null;

        if (mediaInfo && msg._rawMsg) {
          tipoMidia = mediaInfo.tipo;
          const resultado = await baixarMidiaBaileys(msg._rawMsg);
          if (resultado) {
            midiaUrl = `/uploads/${resultado.fileName}`;

            // Transcrever áudio recebido (não enviado por nós)
            if (mediaInfo.tipo === 'audio' && !fromMe) {
              transcricao = await transcreverAudio(resultado.filePath);
            }
          }
        }

        // Pular se não tem texto NEM mídia
        if (!texto && !mediaInfo) continue;

        await this.registrarMensagem(telefone, nome, texto || `[${tipoMidia}]`, fromMe, tipoMidia, midiaUrl, transcricao, remoteJid);
      }
    }
  }

  private async registrarMensagem(
    telefone: string,
    nome: string,
    texto: string,
    fromMe: boolean,
    tipoMidia: string = 'texto',
    midiaUrl: string | null = null,
    transcricao: string | null = null,
    remoteJid?: string
  ): Promise<void> {
    const db = getDb();

    // Encontrar cliente pelo telefone
    const phoneNorm = telefone.replace(/\D/g, '');
    let cliente = db.prepare(
      "SELECT id, nome FROM clientes WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, '+', ''), ' ', ''), '-', ''), '(', '') LIKE ?"
    ).get(`%${phoneNorm.slice(-11)}%`) as any;

    if (!cliente) {
      // Criar cliente novo
      const clienteId = uuidv4();
      db.prepare(
        'INSERT INTO clientes (id, nome, telefone) VALUES (?, ?, ?)'
      ).run(clienteId, nome, `+${telefone}`);
      cliente = { id: clienteId, nome };
      console.log(`[WhatsApp] Novo cliente criado: ${nome} (+${telefone})`);

      // Buscar foto de perfil do WhatsApp (async, nao bloqueia)
      evolutionService.buscarFotoPerfil(telefone).then(url => {
        if (url) {
          db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(url, clienteId);
          saveDb();
        }
      }).catch(() => {});
    } else if (!fromMe) {
      // Atualizar foto se ainda nao tem
      const clienteInfo = db.prepare('SELECT foto_perfil FROM clientes WHERE id = ?').get(cliente.id) as any;
      if (!clienteInfo?.foto_perfil) {
        evolutionService.buscarFotoPerfil(telefone).then(url => {
          if (url) {
            db.prepare('UPDATE clientes SET foto_perfil = ? WHERE id = ?').run(url, cliente.id);
            saveDb();
          }
        }).catch(() => {});
      }
    }

    // Encontrar ou criar conversa
    let conversa = db.prepare(
      "SELECT id FROM conversas WHERE canal = 'whatsapp' AND meta_contato_id = ? AND ativa = 1 LIMIT 1"
    ).get(telefone) as any;

    if (!conversa) {
      const conversaId = uuidv4();
      db.prepare(
        "INSERT INTO conversas (id, cliente_id, canal, meta_contato_id, meta_contato_nome, modo_auto) VALUES (?, ?, 'whatsapp', ?, ?, 1)"
      ).run(conversaId, cliente.id, telefone, nome);
      conversa = { id: conversaId };
      console.log(`[WhatsApp] Nova conversa criada com modo_auto=1 para ${nome}`);
    } else {
      // Fix orphaned cliente_id: if the conversation's client was deleted, re-link to current client
      const conversaData = db.prepare('SELECT cliente_id FROM conversas WHERE id = ?').get(conversa.id) as any;
      if (conversaData) {
        const clienteExiste = db.prepare('SELECT id FROM clientes WHERE id = ?').get(conversaData.cliente_id) as any;
        if (!clienteExiste) {
          db.prepare('UPDATE conversas SET cliente_id = ?, meta_contato_nome = ? WHERE id = ?').run(cliente.id, nome, conversa.id);
          console.log(`[WhatsApp] Conversa ${conversa.id} re-vinculada ao cliente ${cliente.id} (cliente anterior deletado)`);
        }
      }
    }

    // Salvar mensagem - 'user' para recebida, 'assistant' para enviada
    const papel = fromMe ? 'assistant' : 'user';
    const statusEnvio = fromMe ? 'enviado' : 'entregue';
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio, tipo_midia, midia_url, transcricao)
       VALUES (?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?)`
    ).run(uuidv4(), conversa.id, papel, texto, statusEnvio, tipoMidia, midiaUrl, transcricao);

    // Atualizar timestamp sempre, mas nome do contato SOMENTE quando a mensagem veio do cliente (não fromMe)
    // pushName em mensagens fromMe é o nome da dona do WhatsApp, não do cliente
    if (!fromMe) {
      db.prepare(
        "UPDATE conversas SET atualizado_em = datetime('now', 'localtime'), meta_contato_nome = ? WHERE id = ?"
      ).run(nome, conversa.id);
    } else {
      db.prepare(
        "UPDATE conversas SET atualizado_em = datetime('now', 'localtime') WHERE id = ?"
      ).run(conversa.id);
    }

    // Registrar interacao
    const prefixo = fromMe ? 'Enviado' : 'Recebido';
    const descMidia = tipoMidia !== 'texto' ? ` [${tipoMidia}]` : '';
    db.prepare(
      "INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, 'whatsapp', ?)"
    ).run(uuidv4(), cliente.id, `${prefixo} via WhatsApp${descMidia}: ${texto.substring(0, 100)}`);

    saveDb();
    console.log(`[WhatsApp] ${prefixo}${descMidia} registrado no CRM - ${nome}: ${texto.substring(0, 50)}`);

    // Se mensagem enviada por nós (fromMe) e NAO foi enviada pelo bot, humano assumiu
    const phoneKey = telefone.replace(/\D/g, '').replace(/@.*/, '');
    if (fromMe && !recentBotMessages.has(phoneKey)) {
      const conversaData = db.prepare('SELECT modo_auto FROM conversas WHERE id = ?').get(conversa.id) as any;
      if (conversaData?.modo_auto) {
        db.prepare("UPDATE conversas SET modo_auto = 0, atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(conversa.id);
        console.log(`[WhatsApp] Humano assumiu conversa ${conversa.id} (${nome}) - modo_auto desligado automaticamente`);
      }
    }

    // Se mensagem recebida (nao enviada por nos), disparar auto-resposta IA
    if (!fromMe) {
      const conversaData = db.prepare('SELECT modo_auto, cliente_id FROM conversas WHERE id = ?').get(conversa.id) as any;

      // Só responde automaticamente se modo_auto estiver ativo
      if (conversaData?.modo_auto) {
        // Verificar se SDR deve assumir a conversa
        let sdrAssumiu = false;
        try {
          const { sdrService } = require('./sdr.service');
          const sdrAtendeu = await sdrService.processarRespostaCliente(telefone, texto, remoteJid);
          if (sdrAtendeu) {
            console.log(`[WhatsApp] SDR assumiu atendimento (${telefone})`);
            sdrAssumiu = true;
          }
        } catch (e: any) {
          console.error(`[WhatsApp] Erro no SDR para ${telefone}:`, e.message || e);
        }

        // Se SDR nao assumiu, usar auto-resposta IA geral
        if (!sdrAssumiu) {
          this.autoResponderESincronizar(conversa.id, conversaData.cliente_id, telefone, transcricao, remoteJid).catch(e =>
            console.error('[WhatsApp] Erro na auto-resposta/sync:', e)
          );
        }
      } else {
        console.log(`[WhatsApp] modo_auto desligado para conversa ${conversa.id} - aguardando humano`);
      }
    }
  }

  // Agente IA responde automaticamente + qualifica lead
  private async autoResponderESincronizar(
    conversaId: string,
    clienteId: string,
    telefone: string,
    transcricaoAudio: string | null,
    remoteJid?: string
  ): Promise<void> {
    const db = getDb();

    try {
      // 1. Carregar historico da conversa
      const mensagensDb = db.prepare(
        'SELECT papel, conteudo, transcricao FROM mensagens WHERE conversa_id = ? ORDER BY criado_em ASC'
      ).all(conversaId) as any[];

      const historico: MensagemChat[] = mensagensDb.map((m: any) => ({
        role: m.papel as 'user' | 'assistant',
        content: m.transcricao ? `${m.conteudo} (transcricao: ${m.transcricao})` : m.conteudo,
      }));

      // 2. Carregar agente IA ativo — se nenhum ativo, nao responder
      let agente: any = null;
      try {
        agente = db.prepare("SELECT nome, prompt_sistema FROM agentes_ia WHERE ativo = 1 AND area = 'sdr' LIMIT 1").get() as any;
        if (!agente) {
          agente = db.prepare("SELECT nome, prompt_sistema FROM agentes_ia WHERE ativo = 1 ORDER BY id ASC LIMIT 1").get() as any;
        }
      } catch { /* tabela pode nao existir */ }

      if (!agente?.prompt_sistema) {
        console.log('[WhatsApp] Nenhum agente IA ativo, nao respondendo automaticamente');
        return;
      }

      const agenteNome = agente.nome || 'Agente IA';
      const respostaRaw = await claudeService.simularDara(agente.prompt_sistema, historico, 1024);
      let resposta = limparRespostaIA(respostaRaw);

      // Safety: never send raw JSON to the client
      if (resposta.trim().startsWith('{') || resposta.trim().startsWith('[')) {
        console.warn(`[WhatsApp] ${agenteNome} respondeu com JSON, tentando limpar`);
        resposta = limparRespostaIA(resposta);
        if (resposta.trim().startsWith('{') || resposta.trim().startsWith('[')) {
          console.error(`[WhatsApp] Impossivel extrair texto do JSON, nao enviando`);
          return;
        }
      }

      // 3. Salvar resposta no CRM
      const msgId = uuidv4();
      db.prepare(
        `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio)
         VALUES (?, ?, 'assistant', ?, 'whatsapp', 'pendente')`
      ).run(msgId, conversaId, resposta);

      db.prepare(
        "UPDATE conversas SET atualizado_em = datetime('now', 'localtime') WHERE id = ?"
      ).run(conversaId);

      saveDb();

      // 4. Enviar via WhatsApp
      try {
        markBotSent(telefone); // Mark as bot message
        await evolutionService.enviarTexto(remoteJid || telefone, resposta);
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('enviado', msgId);
        saveDb();
        console.log(`[WhatsApp] ${agenteNome} respondeu automaticamente para ${telefone.slice(-4).padStart(8, '*')}`);
      } catch (e) {
        console.error('[WhatsApp] Erro ao enviar auto-resposta:', e);
        db.prepare('UPDATE mensagens SET status_envio = ? WHERE id = ?').run('falhou', msgId);
        saveDb();
      }

      // 5. Extrair dados do cliente
      const historicoAtualizado: MensagemChat[] = [
        ...historico,
        { role: 'assistant' as const, content: resposta },
      ];

      try {
        const dados = await claudeService.extrairDados(historicoAtualizado);
        if (dados) {
          db.prepare('UPDATE mensagens SET dados_extraidos = ? WHERE id = ?')
            .run(JSON.stringify(dados), msgId);
          extracaoService.atualizarCliente(clienteId, dados);
        }
      } catch (e) {
        console.error('[WhatsApp] Erro na extracao de dados:', e);
      }

      // 6. Processar BANT + qualificar localmente
      try {
        const bant = await claudeService.extrairBANT(historicoAtualizado);
        if (bant) {
          // Atualizar BANT na conversa local
          db.prepare(
            `UPDATE conversas SET
              bant_score = ?, bant_budget = ?, bant_authority = ?,
              bant_need = ?, bant_timeline = ?, bant_qualificado = ?,
              bant_atualizado_em = datetime('now', 'localtime')
            WHERE id = ?`
          ).run(bant.score, bant.budget, bant.authority, bant.need, bant.timeline, bant.qualificado ? 1 : 0, conversaId);

          // Buscar deal associado ao cliente
          const deal = db.prepare(
            'SELECT id FROM pipeline WHERE cliente_id = ? ORDER BY atualizado_em DESC LIMIT 1'
          ).get(clienteId) as any;

          // Qualificar e mover no funil local
          const totalMsgs = mensagensDb.length + 1;
          const resultado = await qualifierService.qualificarLead({
            telefone,
            clienteId,
            pipelineId: deal?.id,
            bant: {
              budget: bant.budget,
              authority: bant.authority,
              need: bant.need,
              timeline: bant.timeline,
            },
            engajamento: totalMsgs,
          });

          console.log(`[WhatsApp] BANT: score=${bant.score}/4 qualificado=${bant.qualificado} | Local: ${resultado.classificacao} (${resultado.score}pts) movido=${resultado.movido}`);

          // Se qualificado, notificar admin
          if (bant.qualificado) {
            await this.notificarLeadQualificado(clienteId, telefone, bant);
          }
        }
      } catch (e) {
        console.error('[WhatsApp] Erro no BANT:', e);
      }
    } catch (e) {
      console.error('[WhatsApp] Erro geral na auto-resposta:', e);
    }
  }

  // Notificar admin quando lead qualifica
  private async notificarLeadQualificado(clienteId: string, telefone: string, bant: any): Promise<void> {
    try {
      const db = getDb();
      const cliente = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(clienteId) as any;
      const adminConfig = db.prepare('SELECT telefone_admin FROM sdr_agent_config WHERE id = 1').get() as any;

      if (!adminConfig?.telefone_admin) return;

      const resumo = `Lead QUALIFICADO (BANT ${bant.score}/4)!\n` +
        `Cliente: ${cliente?.nome || '-'}\n` +
        `Tel: +${telefone}\n` +
        `Need: ${bant.need || '-'}\n` +
        `Budget: ${bant.budget || '-'}\n` +
        `Timeline: ${bant.timeline || '-'}\n` +
        `Authority: ${bant.authority || '-'}`;

      await evolutionService.enviarTexto(adminConfig.telefone_admin, resumo);
      console.log(`[WhatsApp] Admin notificado: lead ${cliente?.nome} qualificado`);
    } catch (e) {
      console.error('[WhatsApp] Erro ao notificar admin:', e);
    }
  }
}
