/**
 * POST /api/unipile/testar — testa conexão Unipile
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UnipileClient } from "@/lib/unipile/client";

export async function POST() {
  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("crm_unipile_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cfg) {
    return NextResponse.json({ ok: false, erro: "Unipile não configurada" });
  }

  const unipile = new UnipileClient({
    api_key: cfg.api_key,
    dsn: cfg.dsn,
  });

  try {
    const contas = await unipile.listarContas();
    await supabase
      .from("crm_unipile_config")
      .update({ status: "conectado", ultimo_erro: null })
      .eq("id", cfg.id);
    return NextResponse.json({ ok: true, contas });
  } catch (e: any) {
    await supabase
      .from("crm_unipile_config")
      .update({ status: "erro", ultimo_erro: e.message })
      .eq("id", cfg.id);
    return NextResponse.json({ ok: false, erro: e.message });
  }
}
