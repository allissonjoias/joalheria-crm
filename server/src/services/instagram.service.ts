import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../config/database';
import { env } from '../config/env';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

export interface InstagramConta {
  id: string;
  nome: string;
  username: string | null;
  ig_user_id: string | null;
  page_id: string | null;
  page_name: string | null;
  access_token: string;
  token_expira_em: string | null;
  ativo: number;
  criado_em: string;
  atualizado_em: string;
}

export class InstagramService {
  // Gera a URL de OAuth do Facebook
  getAuthUrl(redirectUri: string): string {
    const scopes = [
      'business_management',
      'pages_show_list',
      'pages_messaging',
      'pages_manage_metadata',
      'pages_read_engagement',
    ].join(',');

    return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${env.META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
  }

  // Troca o code do OAuth por um access token
  async trocarCodePorToken(code: string, redirectUri: string): Promise<string> {
    const url = `${GRAPH_API}/oauth/access_token?client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json() as any;
      throw new Error(`Erro ao trocar code: ${err.error?.message || JSON.stringify(err)}`);
    }
    const data = await res.json() as any;
    return data.access_token;
  }

  // Troca token de curta duracao por longa duracao (60 dias)
  async obterLongLivedToken(shortToken: string): Promise<{ token: string; expires_in: number }> {
    const url = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&fb_exchange_token=${shortToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json() as any;
      throw new Error(`Erro ao obter long-lived token: ${err.error?.message || JSON.stringify(err)}`);
    }
    const data = await res.json() as any;
    return { token: data.access_token, expires_in: data.expires_in || 5184000 };
  }

  // Descobre as paginas do Facebook + contas Instagram vinculadas
  async descobrirContas(accessToken: string): Promise<Array<{
    page_id: string;
    page_name: string;
    page_access_token: string;
    ig_user_id: string | null;
    ig_username: string | null;
  }>> {
    // Buscar paginas do usuario
    const pagesUrl = `${GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`;
    const pagesRes = await fetch(pagesUrl);
    if (!pagesRes.ok) {
      const err = await pagesRes.json() as any;
      throw new Error(`Erro ao buscar páginas: ${err.error?.message || JSON.stringify(err)}`);
    }
    const pagesData = await pagesRes.json() as any;
    const pages = pagesData.data || [];

    const contas: Array<{
      page_id: string;
      page_name: string;
      page_access_token: string;
      ig_user_id: string | null;
      ig_username: string | null;
    }> = [];

    for (const page of pages) {
      let igUserId: string | null = null;
      let igUsername: string | null = null;

      if (page.instagram_business_account?.id) {
        igUserId = page.instagram_business_account.id;
        // Buscar username do Instagram
        try {
          const igUrl = `${GRAPH_API}/${igUserId}?fields=username&access_token=${page.access_token}`;
          const igRes = await fetch(igUrl);
          if (igRes.ok) {
            const igData = await igRes.json() as any;
            igUsername = igData.username || null;
          }
        } catch { /* ignore */ }
      }

      // Obter long-lived page token
      let pageToken = page.access_token;
      try {
        const ltUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&fb_exchange_token=${page.access_token}`;
        const ltRes = await fetch(ltUrl);
        if (ltRes.ok) {
          const ltData = await ltRes.json() as any;
          pageToken = ltData.access_token || page.access_token;
        }
      } catch { /* use short-lived */ }

      contas.push({
        page_id: page.id,
        page_name: page.name,
        page_access_token: pageToken,
        ig_user_id: igUserId,
        ig_username: igUsername,
      });
    }

    return contas;
  }

  // Salva uma conta Instagram no banco
  salvarConta(conta: {
    page_id: string;
    page_name: string;
    page_access_token: string;
    ig_user_id: string | null;
    ig_username: string | null;
    expires_in?: number;
  }): InstagramConta {
    const db = getDb();

    // Verificar se ja existe essa conta (por page_id)
    const existente = db.prepare(
      'SELECT id FROM instagram_contas WHERE page_id = ?'
    ).get(conta.page_id) as any;

    const tokenExpira = conta.expires_in
      ? new Date(Date.now() + conta.expires_in * 1000).toISOString()
      : null;

    if (existente) {
      db.prepare(
        `UPDATE instagram_contas SET
          nome = ?, username = ?, ig_user_id = ?, page_name = ?,
          access_token = ?, token_expira_em = ?, ativo = 1,
          atualizado_em = datetime('now', 'localtime')
        WHERE id = ?`
      ).run(
        conta.ig_username || conta.page_name,
        conta.ig_username,
        conta.ig_user_id,
        conta.page_name,
        conta.page_access_token,
        tokenExpira,
        existente.id
      );
      return db.prepare('SELECT * FROM instagram_contas WHERE id = ?').get(existente.id) as InstagramConta;
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO instagram_contas (id, nome, username, ig_user_id, page_id, page_name, access_token, token_expira_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      conta.ig_username || conta.page_name,
      conta.ig_username,
      conta.ig_user_id,
      conta.page_id,
      conta.page_name,
      conta.page_access_token,
      tokenExpira
    );

    return db.prepare('SELECT * FROM instagram_contas WHERE id = ?').get(id) as InstagramConta;
  }

  // Lista todas as contas
  listarContas(): InstagramConta[] {
    const db = getDb();
    return db.prepare('SELECT * FROM instagram_contas ORDER BY criado_em DESC').all() as InstagramConta[];
  }

  // Busca conta por ID
  obterConta(id: string): InstagramConta | null {
    const db = getDb();
    const conta = db.prepare('SELECT * FROM instagram_contas WHERE id = ?').get(id) as InstagramConta | undefined;
    return conta || null;
  }

  // Busca conta por page_id (para rotear webhooks)
  obterContaPorPageId(pageId: string): InstagramConta | null {
    const db = getDb();
    const conta = db.prepare(
      'SELECT * FROM instagram_contas WHERE page_id = ? AND ativo = 1'
    ).get(pageId) as InstagramConta | undefined;
    return conta || null;
  }

  // Busca conta por ig_user_id
  obterContaPorIgUserId(igUserId: string): InstagramConta | null {
    const db = getDb();
    const conta = db.prepare(
      'SELECT * FROM instagram_contas WHERE ig_user_id = ? AND ativo = 1'
    ).get(igUserId) as InstagramConta | undefined;
    return conta || null;
  }

  // Atualizar configuracoes de eventos da conta
  atualizarConfig(id: string, config: {
    receber_dm?: number;
    receber_comentarios?: number;
    receber_mencoes?: number;
    responder_comentarios_auto?: number;
    responder_mencoes_auto?: number;
  }): void {
    const db = getDb();
    const campos: string[] = [];
    const valores: any[] = [];

    for (const [campo, valor] of Object.entries(config)) {
      if (valor !== undefined) {
        campos.push(`${campo} = ?`);
        valores.push(valor);
      }
    }
    if (campos.length === 0) return;

    campos.push("atualizado_em = datetime('now', 'localtime')");
    valores.push(id);
    db.prepare(`UPDATE instagram_contas SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
  }

  // Obter config de eventos de uma conta
  obterConfigEventos(id: string): any {
    const db = getDb();
    return db.prepare(
      'SELECT receber_dm, receber_comentarios, receber_mencoes, responder_comentarios_auto, responder_mencoes_auto FROM instagram_contas WHERE id = ?'
    ).get(id) || { receber_dm: 1, receber_comentarios: 1, receber_mencoes: 1, responder_comentarios_auto: 0, responder_mencoes_auto: 0 };
  }

  // Ativar/desativar conta
  toggleConta(id: string, ativo: boolean): void {
    const db = getDb();
    db.prepare(
      "UPDATE instagram_contas SET ativo = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(ativo ? 1 : 0, id);
  }

  // Remover conta
  removerConta(id: string): void {
    const db = getDb();
    db.prepare('DELETE FROM instagram_contas WHERE id = ?').run(id);
  }

  // Enviar DM via conta especifica
  async enviarDM(contaId: string, recipientId: string, text: string): Promise<any> {
    const conta = this.obterConta(contaId);
    if (!conta) throw new Error('Conta Instagram não encontrada');

    const url = `${GRAPH_API}/${conta.page_id}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conta.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      throw new Error(`Erro ao enviar DM: ${err.error?.message || JSON.stringify(err)}`);
    }

    return res.json();
  }

  // Responder comentario via conta especifica
  async responderComentario(contaId: string, commentId: string, text: string): Promise<any> {
    const conta = this.obterConta(contaId);
    if (!conta) throw new Error('Conta Instagram não encontrada');

    const url = `${GRAPH_API}/${commentId}/replies`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conta.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) {
      const err = await res.json() as any;
      throw new Error(`Erro ao responder comentário: ${err.error?.message || JSON.stringify(err)}`);
    }

    return res.json();
  }

  // Testar conexao de uma conta
  async testarConta(id: string): Promise<{ ok: boolean; username?: string; erro?: string }> {
    const conta = this.obterConta(id);
    if (!conta) return { ok: false, erro: 'Conta não encontrada' };

    try {
      if (conta.ig_user_id) {
        const url = `${GRAPH_API}/${conta.ig_user_id}?fields=id,username,name,profile_picture_url&access_token=${conta.access_token}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as any;
          // Atualizar username se mudou
          if (data.username && data.username !== conta.username) {
            const db = getDb();
            db.prepare("UPDATE instagram_contas SET username = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?")
              .run(data.username, id);
          }
          return { ok: true, username: data.username };
        }
        const err = await res.json() as any;
        return { ok: false, erro: err.error?.message || 'Token inválido' };
      }

      // Se nao tem ig_user_id, tentar buscar via page_id
      if (conta.page_id) {
        const pageUrl = `${GRAPH_API}/${conta.page_id}?fields=id,name,instagram_business_account&access_token=${conta.access_token}`;
        const pageRes = await fetch(pageUrl);
        if (pageRes.ok) {
          const pageData = await pageRes.json() as any;
          if (pageData.instagram_business_account?.id) {
            const igUserId = pageData.instagram_business_account.id;
            // Buscar username
            const igUrl = `${GRAPH_API}/${igUserId}?fields=id,username,name,profile_picture_url&access_token=${conta.access_token}`;
            const igRes = await fetch(igUrl);
            let igUsername: string | null = null;
            if (igRes.ok) {
              const igData = await igRes.json() as any;
              igUsername = igData.username || null;
            }
            // Atualizar no banco
            const db = getDb();
            db.prepare(
              "UPDATE instagram_contas SET ig_user_id = ?, username = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
            ).run(igUserId, igUsername, id);
            console.log(`[INSTAGRAM] ig_user_id encontrado e salvo: ${igUserId} (@${igUsername})`);
            return { ok: true, username: igUsername || pageData.name };
          }
          return { ok: true, username: pageData.name || conta.page_name || undefined };
        }
        const err = await pageRes.json() as any;
        return { ok: false, erro: err.error?.message || 'Token inválido' };
      }

      return { ok: false, erro: 'Sem ig_user_id ou page_id' };
    } catch (e: any) {
      return { ok: false, erro: e.message };
    }
  }

  // Renovar token de uma conta
  async renovarToken(id: string): Promise<void> {
    const conta = this.obterConta(id);
    if (!conta) throw new Error('Conta não encontrada');

    const result = await this.obterLongLivedToken(conta.access_token);
    const tokenExpira = new Date(Date.now() + result.expires_in * 1000).toISOString();

    const db = getDb();
    db.prepare(
      "UPDATE instagram_contas SET access_token = ?, token_expira_em = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?"
    ).run(result.token, tokenExpira, id);
  }
}
