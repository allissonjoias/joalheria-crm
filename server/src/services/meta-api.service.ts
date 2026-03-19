import { getDb, saveDb } from '../config/database';

/**
 * Servico da API oficial do WhatsApp Business (Meta Cloud API)
 *
 * Usado para:
 * - Envio de templates aprovados (mensagens fora da janela de 24h)
 * - Campanhas em massa (mais confiavel que Baileys, sem risco de ban)
 * - Mensagens interativas (botoes, listas)
 *
 * O Baileys continua sendo usado para:
 * - Receber mensagens
 * - Conversas individuais dentro da janela de 24h
 * - Auto-resposta IA
 */

const META_API_VERSION = 'v22.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaConfig {
  access_token: string;
  phone_number_id: string;
  waba_id: string;
}

interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: { type: string; text?: string; image?: { link: string } }[];
  sub_type?: string;
  index?: number;
}

interface EnvioResult {
  ok: boolean;
  message_id?: string;
  erro?: string;
}

export class MetaApiService {

  private getConfig(): MetaConfig | null {
    const db = getDb();
    try {
      const config = db.prepare(
        'SELECT access_token, phone_number_id, waba_id FROM meta_api_config WHERE id = 1'
      ).get() as any;
      if (!config?.access_token || !config?.phone_number_id) return null;
      return config;
    } catch {
      return null;
    }
  }

  isConfigurado(): boolean {
    return this.getConfig() !== null;
  }

  obterConfig(): any {
    const db = getDb();
    try {
      const config = db.prepare(
        'SELECT phone_number_id, waba_id, token_tipo, token_expira_em, criado_em, atualizado_em FROM meta_api_config WHERE id = 1'
      ).get() as any;
      return config || null;
    } catch {
      return null;
    }
  }

  salvarConfig(data: { access_token: string; phone_number_id: string; waba_id: string; token_tipo?: string }) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM meta_api_config WHERE id = 1').get();
    if (existing) {
      db.prepare(
        `UPDATE meta_api_config SET
          access_token = ?, phone_number_id = ?, waba_id = ?,
          token_tipo = ?, atualizado_em = datetime('now', 'localtime')
        WHERE id = 1`
      ).run(data.access_token, data.phone_number_id, data.waba_id, data.token_tipo || 'temporario');
    } else {
      db.prepare(
        `INSERT INTO meta_api_config (id, access_token, phone_number_id, waba_id, token_tipo)
         VALUES (1, ?, ?, ?, ?)`
      ).run(data.access_token, data.phone_number_id, data.waba_id, data.token_tipo || 'temporario');
    }
    saveDb();
  }

  /**
   * Enviar mensagem de texto simples (apenas dentro da janela de 24h)
   */
  async enviarTexto(telefone: string, texto: string): Promise<EnvioResult> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    const phoneFormatted = this.formatarTelefone(telefone);

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneFormatted,
      type: 'text',
      text: { body: texto },
    };

    return this.chamarApi(`${META_API_BASE}/${config.phone_number_id}/messages`, body, config.access_token);
  }

  /**
   * Enviar template aprovado (funciona fora da janela de 24h)
   * Essencial para campanhas e primeiro contato
   */
  async enviarTemplate(
    telefone: string,
    templateName: string,
    language: string = 'pt_BR',
    components?: TemplateComponent[]
  ): Promise<EnvioResult> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    const phoneFormatted = this.formatarTelefone(telefone);

    const template: any = {
      name: templateName,
      language: { code: language },
    };
    if (components && components.length > 0) {
      template.components = components;
    }

    const body = {
      messaging_product: 'whatsapp',
      to: phoneFormatted,
      type: 'template',
      template,
    };

    return this.chamarApi(`${META_API_BASE}/${config.phone_number_id}/messages`, body, config.access_token);
  }

  /**
   * Enviar imagem
   */
  async enviarImagem(telefone: string, imageUrl: string, caption?: string): Promise<EnvioResult> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    const body = {
      messaging_product: 'whatsapp',
      to: this.formatarTelefone(telefone),
      type: 'image',
      image: { link: imageUrl, caption: caption || '' },
    };

    return this.chamarApi(`${META_API_BASE}/${config.phone_number_id}/messages`, body, config.access_token);
  }

  /**
   * Enviar mensagem interativa com botoes
   */
  async enviarBotoes(
    telefone: string,
    bodyText: string,
    botoes: { id: string; titulo: string }[],
    headerText?: string
  ): Promise<EnvioResult> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    const interactive: any = {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: botoes.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.titulo.substring(0, 20) },
        })),
      },
    };
    if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }

    const body = {
      messaging_product: 'whatsapp',
      to: this.formatarTelefone(telefone),
      type: 'interactive',
      interactive,
    };

    return this.chamarApi(`${META_API_BASE}/${config.phone_number_id}/messages`, body, config.access_token);
  }

  /**
   * Listar templates aprovados da conta
   */
  async listarTemplates(): Promise<{ ok: boolean; templates?: any[]; erro?: string }> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    try {
      const resp = await fetch(
        `${META_API_BASE}/${config.waba_id}/message_templates?limit=100`,
        {
          headers: { Authorization: `Bearer ${config.access_token}` },
        }
      );
      const data = await resp.json() as any;
      if (data.error) {
        return { ok: false, erro: data.error.message };
      }
      return { ok: true, templates: data.data || [] };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  /**
   * Verificar se o token ainda e valido
   */
  async verificarToken(): Promise<{ valido: boolean; erro?: string; info?: any }> {
    const config = this.getConfig();
    if (!config) return { valido: false, erro: 'Meta API nao configurada' };

    try {
      const resp = await fetch(
        `${META_API_BASE}/${config.phone_number_id}`,
        {
          headers: { Authorization: `Bearer ${config.access_token}` },
        }
      );
      const data = await resp.json() as any;
      if (data.error) {
        return { valido: false, erro: data.error.message };
      }
      return { valido: true, info: data };
    } catch (e: any) {
      return { valido: false, erro: e.message };
    }
  }

  /**
   * Listar numeros de telefone conectados a conta WABA
   */
  async listarNumeros(): Promise<{ ok: boolean; numeros?: any[]; erro?: string }> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    try {
      const resp = await fetch(
        `${META_API_BASE}/${config.waba_id}/phone_numbers?fields=id,verified_name,code_verification_status,display_phone_number,quality_rating,status,name_status,messaging_limit_tier`,
        { headers: { Authorization: `Bearer ${config.access_token}` } }
      );
      const data = await resp.json() as any;
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true, numeros: data.data || [] };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  /**
   * Adicionar novo numero de telefone a conta WABA
   */
  async adicionarNumero(telefone: string, nomeExibicao: string): Promise<{ ok: boolean; phone_number_id?: string; erro?: string }> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    const phoneFormatted = this.formatarTelefone(telefone);

    try {
      const resp = await fetch(
        `${META_API_BASE}/${config.waba_id}/phone_numbers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cc: phoneFormatted.substring(0, 2),
            phone_number: phoneFormatted.substring(2),
            verified_name: nomeExibicao,
            migrate_phone_number: false,
          }),
        }
      );
      const data = await resp.json() as any;
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true, phone_number_id: data.id };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  /**
   * Solicitar codigo de verificacao para um numero
   */
  async solicitarCodigo(phoneNumberId: string, metodo: 'SMS' | 'VOICE' = 'SMS'): Promise<{ ok: boolean; erro?: string }> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    try {
      const resp = await fetch(
        `${META_API_BASE}/${phoneNumberId}/request_code`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code_method: metodo, language: 'pt_BR' }),
        }
      );
      const data = await resp.json() as any;
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  /**
   * Verificar codigo recebido por SMS/ligacao
   */
  async verificarCodigo(phoneNumberId: string, codigo: string): Promise<{ ok: boolean; erro?: string }> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    try {
      const resp = await fetch(
        `${META_API_BASE}/${phoneNumberId}/verify_code`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: codigo }),
        }
      );
      const data = await resp.json() as any;
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  /**
   * Registrar numero na Cloud API (necessario apos verificacao)
   */
  async registrarNumero(phoneNumberId: string): Promise<{ ok: boolean; erro?: string }> {
    const config = this.getConfig();
    if (!config) return { ok: false, erro: 'Meta API nao configurada' };

    try {
      const resp = await fetch(
        `${META_API_BASE}/${phoneNumberId}/register`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', pin: '123456' }),
        }
      );
      const data = await resp.json() as any;
      if (data.error) return { ok: false, erro: data.error.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  // --- Privados ---

  private formatarTelefone(telefone: string): string {
    // Remover tudo que nao e numero
    let phone = telefone.replace(/\D/g, '');
    // Garantir prefixo do pais
    if (phone.startsWith('0')) phone = '55' + phone.slice(1);
    if (phone.length === 11) phone = '55' + phone; // DDD + 9 digitos
    if (phone.length === 10) phone = '55' + phone; // DDD + 8 digitos (fixo)
    return phone;
  }

  private async chamarApi(url: string, body: any, token: string): Promise<EnvioResult> {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await resp.json() as any;

      if (data.error) {
        console.error('[META-API] Erro:', data.error.message, data.error.code);
        return { ok: false, erro: `${data.error.message} (code: ${data.error.code})` };
      }

      const messageId = data.messages?.[0]?.id;
      return { ok: true, message_id: messageId };
    } catch (e: any) {
      console.error('[META-API] Erro de rede:', e.message);
      return { ok: false, erro: e.message };
    }
  }
}

export const metaApiService = new MetaApiService();
