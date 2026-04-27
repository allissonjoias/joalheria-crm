import { getDb } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export interface UnipileConfig {
  id: string;
  api_key: string;
  dsn: string;
  account_id: string;
  account_username: string;
  account_provider: string;
  webhook_id: string;
  webhook_url: string;
  webhook_source: string;
  ativo: number;
  status: 'desconectado' | 'conectado' | 'erro';
  ultimo_erro?: string | null;
}

export interface UnipileMessageWebhook {
  event: string;
  account_id: string;
  account_type?: string;
  message_id?: string;
  chat_id?: string;
  provider_chat_id?: string;
  provider_message_id?: string;
  sender?: {
    attendee_id?: string;
    attendee_name?: string;
    attendee_provider_id?: string;
    attendee_profile_url?: string;
    attendee_specifics?: { provider?: string; public_identifier?: string };
  };
  attendees?: Array<{
    attendee_id?: string;
    attendee_provider_id?: string;
    attendee_name?: string;
    attendee_specifics?: { public_identifier?: string };
  }>;
  text?: string;
  message?: string;
  subject?: string;
  attachments?: Array<{ type: string; url?: string; mimetype?: string }>;
  is_sender?: boolean | number;
  timestamp?: string;
}

export class UnipileService {
  getConfig(): UnipileConfig | null {
    const db = getDb();
    return (db.prepare(
      'SELECT * FROM unipile_config WHERE ativo = 1 ORDER BY criado_em DESC LIMIT 1'
    ).get() as UnipileConfig) || null;
  }

  saveConfig(input: {
    api_key?: string;
    dsn?: string;
    account_id?: string;
    account_username?: string;
    account_provider?: string;
  }): UnipileConfig {
    const db = getDb();
    const existing = this.getConfig();

    if (existing) {
      const apiKey = input.api_key && !input.api_key.includes('...') ? input.api_key : existing.api_key;
      db.prepare(
        `UPDATE unipile_config SET
          api_key = ?, dsn = ?, account_id = ?, account_username = ?, account_provider = ?,
          atualizado_em = datetime('now', 'localtime')
        WHERE id = ?`
      ).run(
        apiKey,
        input.dsn ?? existing.dsn,
        input.account_id ?? existing.account_id,
        input.account_username ?? existing.account_username,
        input.account_provider ?? existing.account_provider,
        existing.id
      );
      return this.getConfig()!;
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO unipile_config
        (id, api_key, dsn, account_id, account_username, account_provider)
        VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.api_key || '',
      input.dsn || '',
      input.account_id || '',
      input.account_username || '',
      input.account_provider || 'INSTAGRAM'
    );
    return this.getConfig()!;
  }

  setStatus(status: 'desconectado' | 'conectado' | 'erro', erro?: string) {
    const db = getDb();
    const cfg = this.getConfig();
    if (!cfg) return;
    db.prepare(
      `UPDATE unipile_config SET status = ?, ultimo_erro = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`
    ).run(status, erro || null, cfg.id);
  }

  setWebhook(webhookId: string, webhookUrl: string, source = 'messaging') {
    const db = getDb();
    const cfg = this.getConfig();
    if (!cfg) return;
    db.prepare(
      `UPDATE unipile_config SET webhook_id = ?, webhook_url = ?, webhook_source = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`
    ).run(webhookId, webhookUrl, source, cfg.id);
  }

  // ----- HTTP client -----

  private buildBaseUrl(dsn: string): string {
    const cleaned = dsn.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (cleaned.includes(':')) return `https://${cleaned}/api/v1`;
    return `https://${cleaned}:443/api/v1`;
  }

  private async request<T = any>(method: string, pathSuffix: string, body?: any): Promise<T> {
    const cfg = this.getConfig();
    if (!cfg || !cfg.api_key || !cfg.dsn) {
      throw new Error('Unipile nao configurado (api_key/dsn faltando)');
    }
    const url = this.buildBaseUrl(cfg.dsn) + pathSuffix;
    const res = await fetch(url, {
      method,
      headers: {
        'X-API-KEY': cfg.api_key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.message || data.title)) || `HTTP ${res.status}`;
      throw new Error(`Unipile ${method} ${pathSuffix}: ${msg}`);
    }
    return data as T;
  }

  // ----- Endpoints -----

  async listarContas(): Promise<any[]> {
    const data = await this.request<any>('GET', '/accounts');
    return data?.items || data?.accounts || data || [];
  }

  async testarConexao(): Promise<{ ok: boolean; contas?: any[]; erro?: string }> {
    try {
      const contas = await this.listarContas();
      this.setStatus('conectado');
      return { ok: true, contas };
    } catch (e: any) {
      this.setStatus('erro', e.message);
      return { ok: false, erro: e.message };
    }
  }

  async registrarWebhook(callbackUrl: string, source = 'messaging'): Promise<any> {
    // Remove webhook anterior se houver
    const cfg = this.getConfig();
    if (cfg?.webhook_id) {
      try { await this.request('DELETE', `/webhooks/${cfg.webhook_id}`); } catch {}
    }
    const created = await this.request<any>('POST', '/webhooks', {
      request_url: callbackUrl,
      source,
      name: 'CRM Alisson - Instagram messaging',
    });
    const webhookId = created?.id || created?.webhook_id || '';
    if (webhookId) this.setWebhook(webhookId, callbackUrl, source);
    return created;
  }

  async enviarMensagem(chatId: string, texto: string): Promise<any> {
    return this.request('POST', `/chats/${encodeURIComponent(chatId)}/messages`, { text: texto });
  }

  /**
   * Busca attendees de um chat — inclui profile_picture_url.
   * Usado para enriquecer cliente com foto do Instagram.
   */
  async listarAttendeesDoChat(chatId: string): Promise<any[]> {
    const data = await this.request<any>('GET', `/chats/${encodeURIComponent(chatId)}/attendees`);
    return data?.items || data?.attendees || data || [];
  }

  /**
   * Acha o attendee de um sender específico no chat e retorna profile_picture_url.
   */
  async buscarFotoSender(chatId: string, senderProviderId: string): Promise<string | null> {
    try {
      const attendees = await this.listarAttendeesDoChat(chatId);
      const match = attendees.find((a: any) =>
        a.provider_id === senderProviderId ||
        a.attendee_provider_id === senderProviderId ||
        a.id === senderProviderId
      );
      return match?.picture_url ||
        match?.profile_picture_url ||
        match?.profile_picture ||
        match?.picture ||
        null;
    } catch (e: any) {
      console.warn('[Unipile] Falha ao buscar foto:', e.message);
      return null;
    }
  }

  async listarTodosChats(accountId?: string, cursor?: string): Promise<{ items: any[]; cursor?: string }> {
    const params = new URLSearchParams();
    if (accountId) params.set('account_id', accountId);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    const data = await this.request<any>('GET', `/chats${qs ? '?' + qs : ''}`);
    return { items: data?.items || [], cursor: data?.cursor };
  }

  async iniciarChat(accountId: string, attendeeId: string, texto: string): Promise<any> {
    return this.request('POST', '/chats', {
      account_id: accountId,
      attendees_ids: [attendeeId],
      text: texto,
    });
  }

  /**
   * Baixa um attachment (áudio, imagem, etc) do Unipile.
   * URLs `att://` dos webhooks da Unipile não são públicas — precisam ser
   * baixadas via API com auth. Salva localmente em uploads/unipile/ e retorna
   * a URL pública local.
   */
  async baixarAttachment(attachmentId: string, tipo: string): Promise<string> {
    const cfg = this.getConfig();
    if (!cfg || !cfg.api_key || !cfg.dsn) {
      throw new Error('Unipile nao configurado');
    }
    const url = this.buildBaseUrl(cfg.dsn) + `/messages/attachments/${encodeURIComponent(attachmentId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-KEY': cfg.api_key, 'Accept': '*/*' },
    });
    if (!res.ok) throw new Error(`Unipile attachment ${attachmentId}: HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    let ext = '.bin';
    if (tipo === 'audio' || contentType.includes('audio') || contentType.includes('ogg')) ext = '.ogg';
    else if (contentType.includes('mp4') || tipo === 'video') ext = '.mp4';
    else if (contentType.includes('jpeg') || contentType.includes('jpg') || tipo === 'image') ext = '.jpg';
    else if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';

    const uploadsDir = path.resolve(__dirname, '../../../uploads/unipile');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const safeId = String(attachmentId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeId}${ext}`;
    const filepath = path.join(uploadsDir, filename);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buf);

    return `/uploads/unipile/${filename}`;
  }
}

export const unipileService = new UnipileService();
