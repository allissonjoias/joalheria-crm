import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

const logger = pino({ level: 'silent' });

type OnMessageCallback = (instanceId: string, instanceNome: string, payload: any) => void;

interface InstanceState {
  sock: ReturnType<typeof makeWASocket> | null;
  qr: string | null;
  connecting: boolean;
  reconnectAttempts: number;
}

// Estado em memoria de cada instancia
const instances = new Map<string, InstanceState>();
let onMessageCallback: OnMessageCallback | null = null;

const BASE_AUTH_DIR = path.resolve(__dirname, '../../../whatsapp-auth');

function getAuthDir(instanceId: string): string {
  return path.join(BASE_AUTH_DIR, instanceId);
}

/**
 * Resolve a WhatsApp LID to a real phone number using lid-mapping files.
 * Searches instance-specific dir first, then base auth dir.
 */
export function resolveLid(lidId: string, instanceId?: string): string | null {
  const filename = `lid-mapping-${lidId}_reverse.json`;
  const candidates: string[] = [];
  if (instanceId) candidates.push(path.join(BASE_AUTH_DIR, instanceId, filename));
  candidates.push(path.join(BASE_AUTH_DIR, filename));

  for (const filepath of candidates) {
    try {
      if (fs.existsSync(filepath)) {
        const raw = fs.readFileSync(filepath, 'utf-8');
        const phone = JSON.parse(raw);
        if (phone) return String(phone).replace(/\D/g, '');
      }
    } catch {}
  }
  return null;
}

function getState(instanceId: string): InstanceState {
  if (!instances.has(instanceId)) {
    instances.set(instanceId, { sock: null, qr: null, connecting: false, reconnectAttempts: 0 });
  }
  return instances.get(instanceId)!;
}

export class EvolutionService {
  setOnMessage(callback: OnMessageCallback) {
    onMessageCallback = callback;
  }

  // --- Gerenciamento de instancias ---

  criarInstancia(nome: string): any {
    const db = getDb();
    const id = uuidv4();
    db.prepare(
      "INSERT INTO whatsapp_instances (id, nome) VALUES (?, ?)"
    ).run(id, nome);
    return { id, nome, status: 'desconectado' };
  }

  listarInstancias(): any[] {
    const db = getDb();
    const instancias = db.prepare(
      'SELECT * FROM whatsapp_instances ORDER BY criado_em ASC'
    ).all() as any[];

    return instancias.map(inst => {
      const state = instances.get(inst.id);
      const statusLive = state?.sock && !state?.connecting
        ? 'conectado'
        : state?.connecting
          ? 'conectando'
          : 'desconectado';
      return {
        ...inst,
        status: statusLive,
        tem_qr: !!state?.qr,
      };
    });
  }

  obterInstancia(id: string): any | null {
    const db = getDb();
    const inst = db.prepare('SELECT * FROM whatsapp_instances WHERE id = ?').get(id) as any;
    if (!inst) return null;
    const state = instances.get(id);
    return {
      ...inst,
      status: state?.sock && !state?.connecting
        ? 'conectado'
        : state?.connecting ? 'conectando' : 'desconectado',
      tem_qr: !!state?.qr,
    };
  }

  removerInstancia(id: string): void {
    const state = instances.get(id);
    if (state?.sock) {
      try { state.sock.logout(); } catch {}
      state.sock = null;
    }
    instances.delete(id);

    const authDir = getAuthDir(id);
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }

    const db = getDb();
    db.prepare('DELETE FROM whatsapp_instances WHERE id = ?').run(id);
  }

  // --- Conexao por instancia ---

  async conectar(inputInstanceId?: string): Promise<{ qrcode?: string; status: string }> {
    // Se nao passar ID, tenta a primeira instancia
    let instanceId: string;
    if (!inputInstanceId) {
      const db = getDb();
      const first = db.prepare('SELECT id FROM whatsapp_instances LIMIT 1').get() as any;
      if (!first) throw new Error('Nenhuma instancia configurada');
      instanceId = first.id;
    } else {
      instanceId = inputInstanceId;
    }

    const state = getState(instanceId);

    if (state.sock && !state.connecting) {
      return { status: 'conectado' };
    }
    if (state.connecting) {
      return { qrcode: state.qr || undefined, status: 'conectando' };
    }

    state.connecting = true;
    this.updateInstanceStatus(instanceId, 'conectando');

    const authDir = getAuthDir(instanceId);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    try {
      const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const instancia = this.obterInstancia(instanceId);
      const nomeInstancia = instancia?.nome || instanceId;
      const capturedInstanceId = instanceId;

      const sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys, logger),
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: false,
        browser: [nomeInstancia, 'Chrome', '120.0'],
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
      });

      state.sock = sock;

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            state.qr = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          } catch {
            state.qr = qr;
          }
          console.log(`[WA:${nomeInstancia}] QR Code gerado`);
        }

        if (connection === 'open') {
          state.connecting = false;
          state.qr = null;
          state.reconnectAttempts = 0;
          this.updateInstanceStatus(capturedInstanceId, 'conectado');
          console.log(`[WA:${nomeInstancia}] Conectado!`);
        }

        if (connection === 'close') {
          state.connecting = false;
          state.qr = null;
          state.sock = null;

          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          const errMsg = (lastDisconnect?.error as any)?.message || 'desconhecido';
          console.log(`[WA:${nomeInstancia}] Desconectado - statusCode: ${statusCode}, motivo: ${errMsg}`);

          if (loggedOut) {
            this.updateInstanceStatus(capturedInstanceId, 'desconectado');
            console.log(`[WA:${nomeInstancia}] Deslogado pelo usuario`);
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true });
            }
          } else if (statusCode === 440) {
            // Conflito: outra sessão ativa. Esperar mais tempo antes de reconectar
            const tentativas = state.reconnectAttempts || 0;
            state.reconnectAttempts = tentativas + 1;
            if (tentativas >= 5) {
              // Parar de tentar após 5 tentativas de conflito
              this.updateInstanceStatus(capturedInstanceId, 'desconectado');
              console.log(`[WA:${nomeInstancia}] Conflito persistente (outra sessao ativa). Desconectado. Remova sessoes duplicadas em Dispositivos Conectados no celular.`);
            } else {
              this.updateInstanceStatus(capturedInstanceId, 'conectando');
              const delay = Math.min(15000 * Math.pow(2, tentativas), 120000);
              console.log(`[WA:${nomeInstancia}] Conflito de sessao, reconectando em ${delay/1000}s... (tentativa ${tentativas + 1}/5)`);
              setTimeout(() => {
                this.conectar(capturedInstanceId).catch(console.error);
              }, delay);
            }
          } else {
            this.updateInstanceStatus(capturedInstanceId, 'conectando');
            // Backoff progressivo: 5s, 10s, 20s, max 60s
            const tentativas = state.reconnectAttempts || 0;
            state.reconnectAttempts = tentativas + 1;
            const delay = Math.min(5000 * Math.pow(2, tentativas), 60000);
            console.log(`[WA:${nomeInstancia}] Reconectando em ${delay/1000}s... (tentativa ${tentativas + 1})`);
            setTimeout(() => {
              this.conectar(capturedInstanceId).catch(console.error);
            }, delay);
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // Handler de mensagens
      sock.ev.on('messages.upsert', async ({ messages: msgs }) => {
        for (const msg of msgs) {
          if (!msg.message) continue;

          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') continue;

          // Handle both @s.whatsapp.net and @lid (Linked ID) formats
          let telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');

          // For LID format: resolve real phone number from lid-mapping files
          if (remoteJid.endsWith('@lid')) {
            const lidId = telefone;
            const resolved = resolveLid(lidId, capturedInstanceId);
            if (resolved) {
              telefone = resolved;
              console.log(`[WA:${nomeInstancia}] LID ${lidId} -> telefone real: ${telefone}`);
            } else {
              console.log(`[WA:${nomeInstancia}] LID ${lidId} sem mapeamento de telefone`);
            }
          }
          const texto =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            '';
          const nome = msg.pushName || telefone;
          const fromMe = msg.key.fromMe || false;

          // Detectar se tem mídia
          const temMidia = !!(
            msg.message.imageMessage ||
            msg.message.audioMessage ||
            msg.message.videoMessage ||
            msg.message.stickerMessage ||
            msg.message.documentMessage ||
            msg.message.documentWithCaptionMessage
          );

          // Pular se não tem texto NEM mídia
          if (!texto && !temMidia) continue;

          const direcao = fromMe ? 'enviada' : 'recebida';
          const descMidia = temMidia ? ' [mídia]' : '';
          console.log(`[WA:${nomeInstancia}] Msg ${direcao}${descMidia} - ${nome}: ${(texto || '[sem texto]').substring(0, 50)}`);

          if (onMessageCallback) {
            try {
              onMessageCallback(capturedInstanceId, nomeInstancia, {
                event: 'messages.upsert',
                data: {
                  messages: [{
                    key: msg.key,
                    message: msg.message,
                    pushName: nome,
                    _rawMsg: msg, // Passa msg completa para download de mídia
                    _resolvedPhone: telefone, // Telefone já resolvido (LID -> real)
                    _instanceId: capturedInstanceId,
                  }],
                },
              });
            } catch (e) {
              console.error(`[WA:${nomeInstancia}] Erro no callback:`, e);
            }
          }
        }
      });

      return { qrcode: state.qr || undefined, status: 'conectando' };
    } catch (e: any) {
      state.connecting = false;
      state.sock = null;
      this.updateInstanceStatus(instanceId, 'erro');
      throw e;
    }
  }

  async desconectar(instanceId: string): Promise<void> {
    const state = instances.get(instanceId);
    if (state?.sock) {
      try { await state.sock.logout(); } catch {}
      state.sock = null;
    }
    if (state) {
      state.connecting = false;
      state.qr = null;
    }
    this.updateInstanceStatus(instanceId, 'desconectado');

    const authDir = getAuthDir(instanceId);
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
  }

  async obterQRCode(inputInstanceId?: string): Promise<any> {
    let instanceId: string;
    if (!inputInstanceId) {
      const db = getDb();
      const first = db.prepare('SELECT id FROM whatsapp_instances LIMIT 1').get() as any;
      if (!first) return { base64: null, status: 'sem_instancia' };
      instanceId = first.id;
    } else {
      instanceId = inputInstanceId;
    }

    const state = getState(instanceId);

    if (!state.sock && !state.connecting) {
      await this.conectar(instanceId);
    }

    for (let i = 0; i < 20; i++) {
      if (state.qr) {
        return { base64: state.qr };
      }
      if (state.sock && !state.connecting) {
        return { base64: null, status: 'conectado' };
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { base64: null, status: 'aguardando_qr' };
  }

  obterStatusInstancia(instanceId: string): any {
    const state = instances.get(instanceId);
    if (state?.sock && !state?.connecting) return { state: 'open' };
    if (state?.connecting) return { state: 'connecting' };
    return { state: 'close' };
  }

  // --- Enviar via qualquer instancia conectada ou uma especifica ---

  async enviarTexto(telefone: string, texto: string, instanceId?: string): Promise<any> {
    const sock = this.getSock(instanceId);

    // If telefone already contains @ (it's a full JID), use directly
    if (telefone.includes('@')) {
      return await sock.sendMessage(telefone, { text: texto });
    }

    const numero = this.normalizarTelefone(telefone);
    const jid = `${numero}@s.whatsapp.net`;
    return await sock.sendMessage(jid, { text: texto });
  }

  private getSock(instanceId?: string): ReturnType<typeof makeWASocket> {
    let sock: ReturnType<typeof makeWASocket> | null = null;

    if (instanceId) {
      const state = instances.get(instanceId);
      if (!state?.sock || state.connecting) {
        throw new Error('Instancia nao esta conectada');
      }
      sock = state.sock;
    } else {
      for (const [, state] of instances) {
        if (state.sock && !state.connecting) {
          sock = state.sock;
          break;
        }
      }
    }

    if (!sock) {
      throw new Error('Nenhum WhatsApp conectado');
    }
    return sock;
  }

  async enviarMidia(
    telefone: string,
    tipo: 'imagem' | 'audio' | 'video' | 'sticker' | 'documento',
    buffer: Buffer,
    mimetype: string,
    caption?: string,
    instanceId?: string
  ): Promise<any> {
    const sock = this.getSock(instanceId);

    // If telefone already contains @ (full JID), use directly
    let jid: string;
    if (telefone.includes('@')) {
      jid = telefone;
    } else {
      const numero = this.normalizarTelefone(telefone);
      jid = `${numero}@s.whatsapp.net`;
    }

    if (tipo === 'sticker') {
      return await sock.sendMessage(jid, { sticker: buffer, mimetype });
    } else if (tipo === 'documento') {
      const ext = mimetype.split('/').pop() || 'file';
      return await sock.sendMessage(jid, { document: buffer, mimetype, fileName: caption || `documento.${ext}` });
    } else if (tipo === 'imagem') {
      return await sock.sendMessage(jid, { image: buffer, mimetype, caption });
    } else if (tipo === 'audio') {
      return await sock.sendMessage(jid, { audio: buffer, mimetype, ptt: true });
    } else if (tipo === 'video') {
      return await sock.sendMessage(jid, { video: buffer, mimetype, caption });
    }
  }

  isConnected(): boolean {
    for (const [, state] of instances) {
      if (state.sock && !state.connecting) return true;
    }
    return false;
  }

  // --- Compatibilidade ---

  async obterStatus(): Promise<any> {
    if (this.isConnected()) {
      return { state: 'open', instance: { state: 'open' } };
    }
    const connecting = [...instances.values()].some(s => s.connecting);
    if (connecting) {
      return { state: 'connecting', instance: { state: 'connecting' } };
    }
    return { state: 'close', instance: { state: 'close' } };
  }

  updateStatus(status: 'desconectado' | 'conectando' | 'conectado' | 'erro') {
    const db = getDb();
    const first = db.prepare('SELECT id FROM whatsapp_instances LIMIT 1').get() as any;
    if (first) {
      this.updateInstanceStatus(first.id, status);
    }
  }

  getConfig() { return null; }

  saveConfig(_data: any) { /* noop */ }

  async criarInstanciaLegacy(): Promise<any> {
    const db = getDb();
    const first = db.prepare('SELECT id FROM whatsapp_instances LIMIT 1').get() as any;
    if (first) return this.conectar(first.id);
    const inst = this.criarInstancia('WhatsApp Principal');
    return this.conectar(inst.id);
  }

  async configurarWebhook(_url: string): Promise<any> {
    return { ok: true, mensagem: 'Baileys usa callback interno' };
  }

  normalizarTelefone(telefone: string): string {
    let num = telefone.replace(/\D/g, '');
    if (num.startsWith('0')) num = num.substring(1);
    if (!num.startsWith('55')) num = '55' + num;
    return num;
  }

  // Auto-conectar TODAS as instancias com credenciais salvas
  async autoConectar(): Promise<void> {
    const db = getDb();
    const instancias = db.prepare('SELECT id, nome FROM whatsapp_instances').all() as any[];

    for (const inst of instancias) {
      const authDir = getAuthDir(inst.id);
      const credsFile = path.join(authDir, 'creds.json');
      if (fs.existsSync(credsFile)) {
        console.log(`[WA:${inst.nome}] Credenciais encontradas, reconectando...`);
        try {
          await this.conectar(inst.id);
        } catch (e) {
          console.error(`[WA:${inst.nome}] Erro ao auto-conectar:`, e);
        }
      }
    }
  }

  async buscarFotoPerfil(telefone: string): Promise<string | null> {
    try {
      const sock = this.getSock();
      const numero = this.normalizarTelefone(telefone);
      const jid = `${numero}@s.whatsapp.net`;
      const url = await sock.profilePictureUrl(jid, 'image');
      return url || null;
    } catch {
      return null;
    }
  }

  private updateInstanceStatus(instanceId: string, status: string) {
    const db = getDb();
    db.prepare(
      "UPDATE whatsapp_instances SET status = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(status, instanceId);
  }
}
