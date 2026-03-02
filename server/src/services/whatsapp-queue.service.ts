import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { EvolutionService } from './evolution.service';
import { detectarTipoMidia, baixarMidiaBaileys, transcreverAudio } from './media.service';

const evolutionService = new EvolutionService();

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
      "UPDATE whatsapp_campanhas SET status = 'rodando', atualizado_em = datetime('now') WHERE id = ?"
    ).run(campanhaId);

    campanhaAtualId = campanhaId;
    this.processarFila(campanhaId);
  }

  pausarCampanha(campanhaId: string): void {
    const db = getDb();
    db.prepare(
      "UPDATE whatsapp_campanhas SET status = 'pausada', atualizado_em = datetime('now') WHERE id = ?"
    ).run(campanhaId);
    if (campanhaAtualId === campanhaId) {
      processandoFila = false;
      campanhaAtualId = null;
    }
  }

  cancelarCampanha(campanhaId: string): void {
    const db = getDb();
    db.prepare(
      "UPDATE whatsapp_campanhas SET status = 'cancelada', atualizado_em = datetime('now') WHERE id = ?"
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
          "UPDATE whatsapp_campanhas SET status = 'pausada', atualizado_em = datetime('now') WHERE id = ?"
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
          "UPDATE whatsapp_campanhas SET status = 'concluida', atualizado_em = datetime('now') WHERE id = ?"
        ).run(campanhaId);
        processandoFila = false;
        break;
      }

      // Marcar como enviando
      db.prepare("UPDATE whatsapp_fila SET status = 'enviando' WHERE id = ?").run(item.id);

      try {
        await evolutionService.enviarTexto(item.telefone, item.mensagem);

        db.prepare(
          "UPDATE whatsapp_fila SET status = 'enviado', enviado_em = datetime('now') WHERE id = ?"
        ).run(item.id);

        db.prepare(
          "UPDATE whatsapp_campanhas SET total_enviados = total_enviados + 1, atualizado_em = datetime('now') WHERE id = ?"
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
          "UPDATE whatsapp_campanhas SET total_erros = total_erros + 1, atualizado_em = datetime('now') WHERE id = ?"
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

        const telefone = remoteJid.replace('@s.whatsapp.net', '');
        const texto = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.imageMessage?.caption
          || msg.message?.videoMessage?.caption
          || '';
        const nome = msg.pushName || telefone;
        const fromMe = msg.key?.fromMe || false;

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

        await this.registrarMensagem(telefone, nome, texto || `[${tipoMidia}]`, fromMe, tipoMidia, midiaUrl, transcricao);
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
    transcricao: string | null = null
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
    }

    // Salvar mensagem - 'user' para recebida, 'assistant' para enviada
    const papel = fromMe ? 'assistant' : 'user';
    const statusEnvio = fromMe ? 'enviado' : 'entregue';
    db.prepare(
      `INSERT INTO mensagens (id, conversa_id, papel, conteudo, canal_origem, status_envio, tipo_midia, midia_url, transcricao)
       VALUES (?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?)`
    ).run(uuidv4(), conversa.id, papel, texto, statusEnvio, tipoMidia, midiaUrl, transcricao);

    db.prepare(
      "UPDATE conversas SET atualizado_em = datetime('now') WHERE id = ?"
    ).run(conversa.id);

    // Registrar interacao
    const prefixo = fromMe ? 'Enviado' : 'Recebido';
    const descMidia = tipoMidia !== 'texto' ? ` [${tipoMidia}]` : '';
    db.prepare(
      "INSERT INTO interacoes (id, cliente_id, tipo, descricao) VALUES (?, ?, 'whatsapp', ?)"
    ).run(uuidv4(), cliente.id, `${prefixo} via WhatsApp${descMidia}: ${texto.substring(0, 100)}`);

    console.log(`[WhatsApp] ${prefixo}${descMidia} registrado no CRM - ${nome}: ${texto.substring(0, 50)}`);
  }
}
