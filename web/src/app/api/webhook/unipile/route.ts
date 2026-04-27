/**
 * POST /api/webhook/unipile
 *
 * Recebe webhooks da Unipile (Instagram DMs).
 * Usa SECURITY DEFINER function no Postgres — não precisa de service_role.
 * Idempotente: dedupe por canal_message_id dentro da função.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // Em Next.js handlers, background tasks após Response.return são killed.
  // A função SECURITY DEFINER no Postgres é rápida (<1s, idempotente),
  // então faz await antes de responder. Unipile aceita até 5s.
  try {
    await processar(payload);
  } catch (e) {
    console.error("[webhook/unipile] erro:", e);
  }

  return NextResponse.json({ ok: true });
}

async function processar(payload: any) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("[webhook/unipile] env Supabase faltando");
    return;
  }

  // Cliente sem sessão (anon) — só precisa porque a função é SECURITY DEFINER
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc(
    "crm_processar_webhook_unipile",
    { p_payload: payload },
  );

  if (error) {
    console.error("[webhook/unipile] RPC erro:", error.message);
    return;
  }

  if (data && !data.ok) {
    console.warn("[webhook/unipile] processado com erro:", data);
  } else if (data?.ignored) {
    console.log(`[webhook/unipile] ignorado (${data.ignored})`);
  } else {
    console.log(
      `[webhook/unipile] OK — conversa=${data?.conversa_id} msg=${data?.mensagem_id}`,
    );
  }
}
