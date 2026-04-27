/**
 * POST /api/unipile/webhook/registrar
 * Body: { callback_url: string, source?: string }
 *
 * Registra um webhook na Unipile apontando pra https://<dominio>/api/webhook/unipile
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UnipileClient } from "@/lib/unipile/client";

export async function POST(request: NextRequest) {
  const { callback_url, source = "messaging" } = await request.json();

  if (!callback_url) {
    return NextResponse.json({ erro: "callback_url obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("crm_unipile_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cfg) {
    return NextResponse.json({ erro: "Unipile não configurada" }, { status: 400 });
  }

  const unipile = new UnipileClient({ api_key: cfg.api_key, dsn: cfg.dsn });

  try {
    // Remove webhook anterior
    if (cfg.webhook_id) {
      try {
        await unipile.removerWebhook(cfg.webhook_id);
      } catch {
        // ignora se falhar
      }
    }

    const created = await unipile.registrarWebhook(callback_url, source);
    const webhookId = created?.id || created?.webhook_id || "";

    if (webhookId) {
      await supabase
        .from("crm_unipile_config")
        .update({
          webhook_id: webhookId,
          webhook_url: callback_url,
          webhook_source: source,
        })
        .eq("id", cfg.id);
    }

    return NextResponse.json({ ok: true, webhook: created });
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
