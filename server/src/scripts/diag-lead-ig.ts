/**
 * Diagnóstico do lead Instagram com nome IG:* (sem nome/foto enriquecidos).
 * Uso:  npx tsx server/src/scripts/diag-lead-ig.ts [senderId]
 */
import { setupDatabase, getDb, saveDb } from '../config/database';

async function main() {
  const senderId = process.argv[2] || '6640856579354509';
  await setupDatabase();
  const db = getDb();

  console.log(`\n=== DIAG LEAD IG senderId=${senderId} ===\n`);

  console.log('--- conversa(s) por meta_contato_id ---');
  const conversas = db.prepare(
    'SELECT id, canal, meta_contato_id, meta_contato_nome, instagram_conta_id, cliente_id, criado_em, atualizado_em FROM conversas WHERE meta_contato_id = ?'
  ).all(senderId);
  console.log(JSON.stringify(conversas, null, 2));

  console.log('\n--- cliente(s) vinculados ---');
  for (const c of conversas as any[]) {
    if (!c.cliente_id) continue;
    const cli = db.prepare(
      'SELECT id, nome, telefone, instagram_username, foto_perfil, criado_em FROM clientes WHERE id = ?'
    ).get(c.cliente_id);
    console.log(JSON.stringify(cli, null, 2));
  }

  console.log('\n--- ultimas mensagens (papel=user) dessa conversa ---');
  for (const c of conversas as any[]) {
    const msgs = db.prepare(
      "SELECT id, canal_origem, tipo_midia, conteudo, meta_msg_id, criado_em FROM mensagens WHERE conversa_id = ? AND papel = 'user' ORDER BY criado_em DESC LIMIT 5"
    ).all(c.id);
    console.log(`[conversa ${c.id}]`);
    console.log(JSON.stringify(msgs, null, 2));
  }

  console.log('\n--- contas Instagram ativas ---');
  const contas = db.prepare(
    'SELECT id, username, ig_user_id, page_id, ativo, token_expira_em, length(access_token) AS tok_len FROM instagram_contas'
  ).all();
  console.log(JSON.stringify(contas, null, 2));

  console.log('\n--- webhook_log instagram (ultimos 5 com esse senderId) ---');
  const logs = db.prepare(
    "SELECT id, plataforma, processado, erro, criado_em, substr(payload, 1, 500) AS payload_head FROM webhook_log WHERE plataforma LIKE 'instagram%' AND payload LIKE ? ORDER BY criado_em DESC LIMIT 5"
  ).all(`%${senderId}%`);
  console.log(JSON.stringify(logs, null, 2));

  console.log('\n--- TODAS conversas com nome IG:* (placeholder pendente) ---');
  const pendentes = db.prepare(
    "SELECT id, canal, meta_contato_id, meta_contato_nome, criado_em FROM conversas WHERE meta_contato_nome LIKE 'IG:%' ORDER BY criado_em DESC LIMIT 30"
  ).all();
  console.log(JSON.stringify(pendentes, null, 2));

  // Tentativa de Graph API com cada token disponível para ver o que retorna
  console.log('\n--- Testando Graph API com cada token ativo ---');
  for (const c of contas as any[]) {
    const conta = db.prepare('SELECT access_token FROM instagram_contas WHERE id = ?').get(c.id) as any;
    if (!conta?.access_token) continue;
    const variantes = [
      `https://graph.facebook.com/v22.0/${senderId}?fields=name,username,profile_pic`,
      `https://graph.facebook.com/v22.0/${senderId}?fields=name,profile_pic`,
      `https://graph.facebook.com/v22.0/${senderId}?fields=name`,
    ];
    for (const u of variantes) {
      try {
        const res = await fetch(`${u}&access_token=${conta.access_token}`);
        const text = await res.text();
        console.log(`[conta ${c.username || c.id}] ${u.split('?')[1]} → ${res.status} ${text.substring(0, 300)}`);
      } catch (e: any) {
        console.log(`[conta ${c.username || c.id}] erro fetch:`, e.message);
      }
    }
  }

  saveDb();
}

main().catch(e => { console.error(e); process.exit(1); });
