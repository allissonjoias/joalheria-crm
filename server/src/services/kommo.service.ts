import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';

interface KommoConfig {
  id: string;
  subdomain: string;
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  redirect_uri: string;
  ativo: number;
}

// Rate limiter: max 5 req/s (200ms between requests)
let lastRequestTime = 0;
const MIN_INTERVAL = 200;
const FETCH_TIMEOUT = 30000; // 30s timeout
const MAX_RETRIES = 3;

async function rateLimitedFetch(url: string, options: RequestInit = {}, attempt = 0): Promise<Response> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - timeSinceLast));
  }
  lastRequestTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    // Retry on 429 with exponential backoff
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '2', 10);
      console.log(`Kommo rate limit hit, aguardando ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return rateLimitedFetch(url, options, 0);
    }

    return res;
  } catch (e: any) {
    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Kommo fetch falhou (tentativa ${attempt + 1}/${MAX_RETRIES}), retry em ${delay}ms: ${e.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return rateLimitedFetch(url, options, attempt + 1);
    }
    throw e;
  }
}

export class KommoService {
  getConfig(): KommoConfig | null {
    const db = getDb();
    return db.prepare('SELECT * FROM kommo_config WHERE ativo = 1 LIMIT 1').get() as KommoConfig | null;
  }

  saveConfig(data: { client_id: string; client_secret: string; redirect_uri?: string; subdomain?: string }) {
    const db = getDb();
    const existing = this.getConfig();

    if (existing) {
      db.prepare(
        `UPDATE kommo_config SET client_id = ?, client_secret = ?, redirect_uri = ?, subdomain = ?, atualizado_em = datetime('now') WHERE id = ?`
      ).run(
        data.client_id,
        data.client_secret,
        data.redirect_uri || existing.redirect_uri,
        data.subdomain || existing.subdomain,
        existing.id
      );
    } else {
      db.prepare(
        `INSERT INTO kommo_config (id, client_id, client_secret, redirect_uri, subdomain) VALUES (?, ?, ?, ?, ?)`
      ).run(
        uuidv4(),
        data.client_id,
        data.client_secret,
        data.redirect_uri || 'https://localhost/kommo/callback',
        data.subdomain || 'alissonjoiass'
      );
    }
  }

  private baseUrl(): string {
    const config = this.getConfig();
    return `https://${config?.subdomain || 'alissonjoiass'}.kommo.com`;
  }

  getAuthUrl(): string {
    const config = this.getConfig();
    if (!config?.client_id) throw new Error('client_id nao configurado');

    return `${this.baseUrl()}/oauth?client_id=${config.client_id}&state=kommo_auth&mode=post_message`;
  }

  async exchangeCode(code: string): Promise<void> {
    const config = this.getConfig();
    if (!config) throw new Error('Kommo nao configurado');

    const res = await fetch(`${this.baseUrl()}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.client_id,
        client_secret: config.client_secret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirect_uri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Erro ao trocar code: ${res.status} - ${err}`);
    }

    const data = await res.json() as any;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    const db = getDb();
    db.prepare(
      `UPDATE kommo_config SET access_token = ?, refresh_token = ?, token_expires_at = ?, atualizado_em = datetime('now') WHERE id = ?`
    ).run(data.access_token, data.refresh_token, expiresAt, config.id);
  }

  async refreshToken(): Promise<string> {
    const config = this.getConfig();
    if (!config?.refresh_token) throw new Error('Sem refresh_token disponivel');

    const res = await fetch(`${this.baseUrl()}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.client_id,
        client_secret: config.client_secret,
        grant_type: 'refresh_token',
        refresh_token: config.refresh_token,
        redirect_uri: config.redirect_uri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Erro ao refresh token: ${res.status} - ${err}`);
    }

    const data = await res.json() as any;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    const db = getDb();
    db.prepare(
      `UPDATE kommo_config SET access_token = ?, refresh_token = ?, token_expires_at = ?, atualizado_em = datetime('now') WHERE id = ?`
    ).run(data.access_token, data.refresh_token, expiresAt, config.id);

    return data.access_token;
  }

  async getAccessToken(): Promise<string> {
    const config = this.getConfig();
    if (!config?.access_token) throw new Error('Sem access_token. Faca a autorizacao primeiro.');

    // Check if token is expired (with 5 min margin)
    if (config.token_expires_at) {
      const expiresAt = new Date(config.token_expires_at).getTime();
      if (Date.now() > expiresAt - 5 * 60 * 1000) {
        return this.refreshToken();
      }
    }

    return config.access_token;
  }

  private async apiGet(endpoint: string, params: Record<string, string | number> = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = new URL(`${this.baseUrl()}/api/v4${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const res = await rateLimitedFetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 204) return null;

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Kommo API error: ${res.status} - ${err}`);
    }

    return res.json();
  }

  private async apiPost(endpoint: string, body: any): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl()}/api/v4${endpoint}`;

    const res = await rateLimitedFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 204) return null;

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Kommo API POST error: ${res.status} - ${err}`);
    }

    return res.json();
  }

  private async apiPatch(endpoint: string, body: any): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl()}/api/v4${endpoint}`;

    const res = await rateLimitedFetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 204) return null;

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Kommo API PATCH error: ${res.status} - ${err}`);
    }

    return res.json();
  }

  async testarConexao(): Promise<any> {
    const data = await this.apiGet('/contacts', { limit: '1' });
    const total = data?._embedded?.contacts?.length || 0;
    return { ok: true, total_contatos_amostra: total, amostra: data?._embedded?.contacts?.[0] || null };
  }

  async fetchContatos(page: number, idFrom?: number, idTo?: number): Promise<any> {
    const params: Record<string, string | number> = {
      limit: 250,
      page,
      with: 'leads,tags',
    };
    if (idFrom !== undefined) params['filter[id][from]'] = idFrom;
    if (idTo !== undefined) params['filter[id][to]'] = idTo;

    return this.apiGet('/contacts', params);
  }

  async fetchLeads(page: number, idFrom?: number, idTo?: number): Promise<any> {
    const params: Record<string, string | number> = {
      limit: 250,
      page,
      with: 'contacts',
    };
    if (idFrom !== undefined) params['filter[id][from]'] = idFrom;
    if (idTo !== undefined) params['filter[id][to]'] = idTo;

    return this.apiGet('/leads', params);
  }

  async fetchNotas(entityType: 'contacts' | 'leads', entityId: number, page: number): Promise<any> {
    return this.apiGet(`/${entityType}/${entityId}/notes`, { limit: 250, page });
  }

  async fetchCustomFields(entityType: 'contacts' | 'leads'): Promise<any> {
    return this.apiGet(`/${entityType}/custom_fields`);
  }

  async fetchPipelines(): Promise<any> {
    return this.apiGet('/leads/pipelines');
  }

  async fetchLeadsAtualizados(updatedSince: number): Promise<any> {
    const params: Record<string, string | number> = {
      limit: 250,
      with: 'contacts',
      'filter[updated_at][from]': updatedSince,
    };
    return this.apiGet('/leads', params);
  }

  async fetchTasksVencidas(): Promise<any> {
    return this.apiGet('/tasks', {
      'filter[is_completed]': 0,
      limit: 250,
    });
  }

  async criarTask(leadId: number, texto: string, deadlineHoras: number): Promise<any> {
    const completeTill = Math.floor(Date.now() / 1000) + deadlineHoras * 3600;
    return this.apiPost('/tasks', [
      {
        text: texto,
        entity_id: leadId,
        entity_type: 'leads',
        complete_till: completeTill,
        task_type_id: 1,
      },
    ]);
  }

  async moverLead(leadId: number, statusId: number, pipelineId?: number): Promise<any> {
    const body: any = { status_id: statusId };
    if (pipelineId) body.pipeline_id = pipelineId;
    return this.apiPatch(`/leads/${leadId}`, body);
  }

  async adicionarNotaLead(leadId: number, texto: string): Promise<any> {
    return this.apiPost(`/leads/${leadId}/notes`, [
      {
        note_type: 'common',
        params: { text: texto },
      },
    ]);
  }
}
