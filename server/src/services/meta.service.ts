import { getDb } from '../config/database';
import { env } from '../config/env';

const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';

interface MetaConfig {
  id: string;
  page_id: string;
  whatsapp_phone_number_id: string;
  instagram_business_account_id: string;
  access_token: string;
  webhook_verify_token: string;
}

export class MetaService {
  async getConfig(): Promise<MetaConfig | null> {
    const db = getDb();
    const config = db.prepare(
      'SELECT * FROM meta_config WHERE ativo = 1 ORDER BY criado_em DESC LIMIT 1'
    ).get() as MetaConfig | undefined;
    return config || null;
  }

  async enviarWhatsApp(to: string, text: string): Promise<any> {
    const config = await this.getConfig();
    if (!config) throw new Error('Meta API não configurada');

    const url = `${GRAPH_API_BASE}/${config.whatsapp_phone_number_id}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  async enviarInstagramDM(recipientId: string, text: string): Promise<any> {
    const config = await this.getConfig();
    if (!config) throw new Error('Meta API não configurada');

    const url = `${GRAPH_API_BASE}/${config.page_id}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram DM API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  async responderComentarioInstagram(commentId: string, text: string): Promise<any> {
    const config = await this.getConfig();
    if (!config) throw new Error('Meta API não configurada');

    const url = `${GRAPH_API_BASE}/${commentId}/replies`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram Comment API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  async marcarComoLido(messageId: string): Promise<void> {
    const config = await this.getConfig();
    if (!config) return;

    const url = `${GRAPH_API_BASE}/${config.whatsapp_phone_number_id}/messages`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    }).catch(e => console.error('Erro ao marcar como lido:', e));
  }

  async baixarMidia(mediaId: string): Promise<{ url: string; mime_type: string } | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const url = `${GRAPH_API_BASE}/${mediaId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    });

    if (!response.ok) return null;
    const data = await response.json() as any;
    return { url: data.url, mime_type: data.mime_type };
  }

  async renovarToken(): Promise<string> {
    const config = await this.getConfig();
    if (!config) throw new Error('Meta API não configurada');

    const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&fb_exchange_token=${config.access_token}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token renewal error: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as any;
    const newToken = data.access_token;

    // Update token in database
    const db = getDb();
    db.prepare(
      "UPDATE meta_config SET access_token = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(newToken, config.id);

    return newToken;
  }

  async testarConexao(): Promise<{ whatsapp: boolean; instagram: boolean; erros: string[] }> {
    const config = await this.getConfig();
    if (!config) throw new Error('Meta API não configurada');

    const erros: string[] = [];
    let whatsapp = false;
    let instagram = false;

    // Test WhatsApp
    if (config.whatsapp_phone_number_id) {
      try {
        const url = `${GRAPH_API_BASE}/${config.whatsapp_phone_number_id}`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${config.access_token}` },
        });
        whatsapp = res.ok;
        if (!res.ok) {
          const err = await res.json() as any;
          erros.push(`WhatsApp: ${err.error?.message || 'Erro desconhecido'}`);
        }
      } catch (e: any) {
        erros.push(`WhatsApp: ${e.message}`);
      }
    }

    // Test Instagram
    if (config.instagram_business_account_id) {
      try {
        const url = `${GRAPH_API_BASE}/${config.instagram_business_account_id}?fields=id,username`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${config.access_token}` },
        });
        instagram = res.ok;
        if (!res.ok) {
          const err = await res.json() as any;
          erros.push(`Instagram: ${err.error?.message || 'Erro desconhecido'}`);
        }
      } catch (e: any) {
        erros.push(`Instagram: ${e.message}`);
      }
    }

    return { whatsapp, instagram, erros };
  }
}
