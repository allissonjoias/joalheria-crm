import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../config/database';
import { DistribuicaoService } from './distribuicao.service';

export interface ManyChatSubscriber {
  subscriber_id: string;
  first_name: string;
  last_name: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  profile_pic?: string;
  locale?: string;
  timezone?: string;
  last_interaction?: string;
  source?: string;
}

interface ManyChatConfig {
  id: string;
  webhook_secret: string | null;
  api_key: string | null;
  ativo: number;
  auto_distribuir: number;
  funil_destino_id: number | null;
  estagio_destino: string;
  origem_padrao: string;
  criado_em: string;
  atualizado_em: string;
}

const distribuicaoService = new DistribuicaoService();

export class ManyChatService {

  // Normaliza payload do ManyChat para interface padronizada
  parsePayload(body: any): ManyChatSubscriber {
    // ManyChat envia via External Request - pode ter formatos variados
    // Suporta tanto payload direto quanto aninhado em "subscriber"
    const data = body.subscriber || body;

    const firstName = data.first_name || data.firstName || data.nome || '';
    const lastName = data.last_name || data.lastName || data.sobrenome || '';
    const name = data.name || data.full_name || `${firstName} ${lastName}`.trim() || 'Lead ManyChat';

    // Normalizar telefone
    let phone = data.phone || data.telefone || data.whatsapp || null;
    if (phone) {
      phone = phone.replace(/\D/g, '');
      // Garantir codigo do pais
      if (phone.length === 11 || phone.length === 10) {
        phone = '55' + phone;
      }
    }

    // Tags podem vir como array, string separada por virgula, ou campo unico
    let tags: string[] = [];
    if (Array.isArray(data.tags)) {
      tags = data.tags.map((t: any) => typeof t === 'string' ? t : t.name || t.tag || '').filter(Boolean);
    } else if (typeof data.tags === 'string') {
      tags = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    // Custom fields - pode estar em custom_fields ou espalhado no body
    const custom_fields: Record<string, any> = {};
    if (data.custom_fields && typeof data.custom_fields === 'object') {
      Object.assign(custom_fields, data.custom_fields);
    }
    // Campos extras comuns do ManyChat
    const extraFields = ['opt_in_email', 'opt_in_sms', 'last_input_text', 'last_seen',
      'signed_up', 'status', 'live_chat_url', 'ig_username', 'ig_id', 'fb_id'];
    for (const field of extraFields) {
      if (data[field] !== undefined) {
        custom_fields[field] = data[field];
      }
    }

    return {
      subscriber_id: String(data.id || data.subscriber_id || data.manychat_id || uuidv4()),
      first_name: firstName,
      last_name: lastName,
      name,
      phone,
      email: data.email || null,
      gender: data.gender || null,
      tags,
      custom_fields,
      profile_pic: data.profile_pic || data.avatar || null,
      locale: data.locale || null,
      timezone: data.timezone || null,
      last_interaction: data.last_interaction || data.last_seen || null,
      source: data.source || data.ref || null,
    };
  }

  // Processa um subscriber do ManyChat - cria ou atualiza cliente
  processarSubscriber(subscriber: ManyChatSubscriber): { clienteId: string; criado: boolean } {
    const db = getDb();
    const config = this.obterConfig();

    // 1. Verificar mapeamento existente (por subscriber_id)
    const mapeamento = db.prepare(
      'SELECT * FROM manychat_mapeamento WHERE manychat_subscriber_id = ?'
    ).get(subscriber.subscriber_id) as any;

    if (mapeamento) {
      // Atualizar cliente existente
      this.atualizarCliente(mapeamento.cliente_id, subscriber);
      // Atualizar dados extras no mapeamento
      db.prepare(
        'UPDATE manychat_mapeamento SET dados_extra = ?, atualizado_em = datetime(\'now\', \'localtime\') WHERE manychat_subscriber_id = ?'
      ).run(JSON.stringify(subscriber.custom_fields), subscriber.subscriber_id);
      return { clienteId: mapeamento.cliente_id, criado: false };
    }

    // 2. Buscar por telefone (dedup cross-channel)
    if (subscriber.phone) {
      const phoneNorm = subscriber.phone.slice(-11);
      const clientePorTel = db.prepare(
        "SELECT id FROM clientes WHERE REPLACE(REPLACE(REPLACE(telefone, '+', ''), '-', ''), ' ', '') LIKE ?"
      ).get(`%${phoneNorm}`) as any;

      if (clientePorTel) {
        this.criarMapeamento(subscriber.subscriber_id, clientePorTel.id, subscriber.custom_fields);
        this.atualizarCliente(clientePorTel.id, subscriber);
        return { clienteId: clientePorTel.id, criado: false };
      }
    }

    // 3. Buscar por email (dedup cross-channel)
    if (subscriber.email) {
      const clientePorEmail = db.prepare(
        'SELECT id FROM clientes WHERE LOWER(email) = LOWER(?)'
      ).get(subscriber.email) as any;

      if (clientePorEmail) {
        this.criarMapeamento(subscriber.subscriber_id, clientePorEmail.id, subscriber.custom_fields);
        this.atualizarCliente(clientePorEmail.id, subscriber);
        return { clienteId: clientePorEmail.id, criado: false };
      }
    }

    // 4. Criar novo cliente
    const clienteId = uuidv4();
    const tagsJson = subscriber.tags.length > 0 ? JSON.stringify(subscriber.tags) : '[]';

    // Montar notas com dados extras
    const notasParts: string[] = [];
    if (subscriber.source) notasParts.push(`Origem: ${subscriber.source}`);
    if (subscriber.custom_fields.ig_username) notasParts.push(`Instagram: @${subscriber.custom_fields.ig_username}`);
    if (subscriber.gender) notasParts.push(`Genero: ${subscriber.gender}`);
    if (Object.keys(subscriber.custom_fields).length > 0) {
      notasParts.push(`Dados ManyChat: ${JSON.stringify(subscriber.custom_fields)}`);
    }

    db.prepare(
      `INSERT INTO clientes (id, nome, telefone, email, tags, notas, origem, forma_atendimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manychat')`
    ).run(
      clienteId,
      subscriber.name,
      subscriber.phone,
      subscriber.email,
      tagsJson,
      notasParts.join('\n') || null,
      config.origem_padrao || 'manychat'
    );

    // Criar mapeamento
    this.criarMapeamento(subscriber.subscriber_id, clienteId, subscriber.custom_fields);

    // Registrar interacao
    db.prepare(
      `INSERT INTO interacoes (cliente_id, tipo, descricao) VALUES (?, 'nota', ?)`
    ).run(clienteId, `Lead capturado via ManyChat (subscriber: ${subscriber.subscriber_id})`);

    // Auto-distribuir se configurado
    if (config.auto_distribuir) {
      try {
        distribuicaoService.distribuirLead(
          clienteId,
          `Lead ManyChat - ${subscriber.name}`,
          undefined,
          'manychat',
          config.funil_destino_id || undefined
        );
      } catch (e) {
        console.error('[ManyChat] Erro na auto-distribuicao:', e);
      }
    }

    console.log(`[ManyChat] Novo lead criado: ${subscriber.name} (${clienteId})`);
    return { clienteId, criado: true };
  }

  private atualizarCliente(clienteId: string, subscriber: ManyChatSubscriber) {
    const db = getDb();
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId) as any;
    if (!cliente) return;

    const updates: string[] = [];
    const params: any[] = [];

    // Atualizar nome se estava vazio
    if (!cliente.nome || cliente.nome === 'Lead ManyChat') {
      updates.push('nome = ?');
      params.push(subscriber.name);
    }

    // Atualizar telefone se nao tinha
    if (!cliente.telefone && subscriber.phone) {
      updates.push('telefone = ?');
      params.push(subscriber.phone);
    }

    // Atualizar email se nao tinha
    if (!cliente.email && subscriber.email) {
      updates.push('email = ?');
      params.push(subscriber.email);
    }

    // Merge tags
    if (subscriber.tags.length > 0) {
      let existingTags: string[] = [];
      try { existingTags = JSON.parse(cliente.tags || '[]'); } catch { }
      const mergedTags = [...new Set([...existingTags, ...subscriber.tags])];
      updates.push('tags = ?');
      params.push(JSON.stringify(mergedTags));
    }

    if (updates.length > 0) {
      updates.push("atualizado_em = datetime('now', 'localtime')");
      params.push(clienteId);
      db.prepare(`UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    // Registrar interacao de atualizacao
    db.prepare(
      `INSERT INTO interacoes (cliente_id, tipo, descricao) VALUES (?, 'nota', ?)`
    ).run(clienteId, `Dados atualizados via ManyChat (subscriber: ${subscriber.subscriber_id})`);
  }

  private criarMapeamento(subscriberId: string, clienteId: string, customFields: Record<string, any>) {
    const db = getDb();
    db.prepare(
      `INSERT INTO manychat_mapeamento (id, manychat_subscriber_id, cliente_id, dados_extra)
       VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), subscriberId, clienteId, JSON.stringify(customFields));
  }

  // Obter configuracao
  obterConfig(): ManyChatConfig {
    const db = getDb();
    let config = db.prepare('SELECT * FROM manychat_config WHERE id = ?').get('1') as ManyChatConfig | undefined;

    if (!config) {
      // Criar config padrao
      db.prepare(
        `INSERT INTO manychat_config (id) VALUES ('1')`
      ).run();
      config = db.prepare('SELECT * FROM manychat_config WHERE id = ?').get('1') as ManyChatConfig;
    }

    return config;
  }

  // Salvar configuracao
  salvarConfig(data: Partial<ManyChatConfig>) {
    const db = getDb();

    // Garantir que existe
    this.obterConfig();

    const fields: string[] = [];
    const params: any[] = [];

    if (data.webhook_secret !== undefined) { fields.push('webhook_secret = ?'); params.push(data.webhook_secret); }
    if (data.api_key !== undefined) { fields.push('api_key = ?'); params.push(data.api_key); }
    if (data.ativo !== undefined) { fields.push('ativo = ?'); params.push(data.ativo); }
    if (data.auto_distribuir !== undefined) { fields.push('auto_distribuir = ?'); params.push(data.auto_distribuir); }
    if (data.funil_destino_id !== undefined) { fields.push('funil_destino_id = ?'); params.push(data.funil_destino_id); }
    if (data.estagio_destino !== undefined) { fields.push('estagio_destino = ?'); params.push(data.estagio_destino); }
    if (data.origem_padrao !== undefined) { fields.push('origem_padrao = ?'); params.push(data.origem_padrao); }

    if (fields.length > 0) {
      fields.push("atualizado_em = datetime('now', 'localtime')");
      params.push('1');
      db.prepare(`UPDATE manychat_config SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }

    return this.obterConfig();
  }

  // Obter status (para dashboard)
  obterStatus() {
    const db = getDb();
    const config = this.obterConfig();

    const totalMapeados = db.prepare(
      'SELECT COUNT(*) as total FROM manychat_mapeamento'
    ).get() as any;

    const ultimoWebhook = db.prepare(
      "SELECT * FROM webhook_log WHERE plataforma = 'manychat' ORDER BY criado_em DESC LIMIT 1"
    ).get() as any;

    const webhooksHoje = db.prepare(
      "SELECT COUNT(*) as total FROM webhook_log WHERE plataforma = 'manychat' AND criado_em >= date('now', 'localtime')"
    ).get() as any;

    const ultimosLogs = db.prepare(
      "SELECT * FROM webhook_log WHERE plataforma = 'manychat' ORDER BY criado_em DESC LIMIT 10"
    ).all() as any[];

    return {
      config,
      totalSubscribers: totalMapeados?.total || 0,
      ultimoWebhook: ultimoWebhook?.criado_em || null,
      webhooksHoje: webhooksHoje?.total || 0,
      ultimosLogs,
    };
  }
}

export const manyChatService = new ManyChatService();
