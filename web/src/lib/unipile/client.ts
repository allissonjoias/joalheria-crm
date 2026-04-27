/**
 * Cliente Unipile (REST API).
 * https://developer.unipile.com/reference
 */

export interface UnipileConfig {
  api_key: string;
  dsn: string;
  account_id?: string;
  account_username?: string;
  account_provider?: string;
}

function buildBaseUrl(dsn: string): string {
  const cleaned = dsn.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (cleaned.includes(":")) return `https://${cleaned}/api/v1`;
  return `https://${cleaned}:443/api/v1`;
}

export class UnipileClient {
  constructor(private cfg: UnipileConfig) {}

  private async request<T = any>(
    method: string,
    pathSuffix: string,
    body?: any,
  ): Promise<T> {
    const url = buildBaseUrl(this.cfg.dsn) + pathSuffix;
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-KEY": this.cfg.api_key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = (data && (data.message || data.title)) || `HTTP ${res.status}`;
      throw new Error(`Unipile ${method} ${pathSuffix}: ${msg}`);
    }
    return data as T;
  }

  async listarContas(): Promise<any[]> {
    const data = await this.request<any>("GET", "/accounts");
    return data?.items || data?.accounts || data || [];
  }

  async testarConexao(): Promise<boolean> {
    await this.listarContas();
    return true;
  }

  async registrarWebhook(callbackUrl: string, source = "messaging"): Promise<any> {
    return this.request("POST", "/webhooks", {
      request_url: callbackUrl,
      source,
      name: "CRM Alisson — Instagram messaging",
    });
  }

  async removerWebhook(webhookId: string): Promise<void> {
    await this.request("DELETE", `/webhooks/${webhookId}`);
  }

  async enviarMensagem(chatId: string, texto: string): Promise<any> {
    return this.request(
      "POST",
      `/chats/${encodeURIComponent(chatId)}/messages`,
      { text: texto },
    );
  }

  async iniciarChat(
    accountId: string,
    attendeeId: string,
    texto: string,
  ): Promise<any> {
    return this.request("POST", "/chats", {
      account_id: accountId,
      attendees_ids: [attendeeId],
      text: texto,
    });
  }

  async listarAttendees(chatId: string): Promise<any[]> {
    const data = await this.request<any>(
      "GET",
      `/chats/${encodeURIComponent(chatId)}/attendees`,
    );
    return data?.items || data?.attendees || data || [];
  }

  async buscarFotoSender(
    chatId: string,
    senderProviderId: string,
  ): Promise<string | null> {
    try {
      const attendees = await this.listarAttendees(chatId);
      const match = attendees.find(
        (a: any) =>
          a.provider_id === senderProviderId ||
          a.attendee_provider_id === senderProviderId ||
          a.id === senderProviderId,
      );
      return (
        match?.picture_url ||
        match?.profile_picture_url ||
        match?.profile_picture ||
        match?.picture ||
        null
      );
    } catch {
      return null;
    }
  }

  /**
   * Baixa um attachment (URLs `att://` precisam de API com auth).
   * Retorna { buffer, contentType, ext }.
   */
  async baixarAttachment(
    attachmentId: string,
    tipoHint?: string,
  ): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
    const url =
      buildBaseUrl(this.cfg.dsn) +
      `/messages/attachments/${encodeURIComponent(attachmentId)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-API-KEY": this.cfg.api_key, Accept: "*/*" },
    });
    if (!res.ok)
      throw new Error(`Unipile attachment ${attachmentId}: HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    const buffer = Buffer.from(await res.arrayBuffer());

    let ext = ".bin";
    if (tipoHint === "audio" || contentType.includes("audio") || contentType.includes("ogg"))
      ext = ".ogg";
    else if (contentType.includes("mp4") || tipoHint === "video") ext = ".mp4";
    else if (
      contentType.includes("jpeg") ||
      contentType.includes("jpg") ||
      tipoHint === "image"
    )
      ext = ".jpg";
    else if (contentType.includes("png")) ext = ".png";
    else if (contentType.includes("webp")) ext = ".webp";

    return { buffer, contentType, ext };
  }
}

/**
 * Lê config do banco e retorna cliente pronto.
 */
export async function getUnipileClient(supabase: any): Promise<UnipileClient | null> {
  const { data } = await supabase
    .from("crm_unipile_config")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || !data.api_key || !data.dsn) return null;
  return new UnipileClient({
    api_key: data.api_key,
    dsn: data.dsn,
    account_id: data.account_id,
    account_username: data.account_username,
    account_provider: data.account_provider,
  });
}
