/**
 * GET  /api/unipile/config — retorna config (api_key mascarada)
 * POST /api/unipile/config — salva/atualiza config
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function mask(k?: string | null): string {
  if (!k) return "";
  if (k.length <= 14) return "***";
  return k.substring(0, 8) + "..." + k.substring(k.length - 4);
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_unipile_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!data) return NextResponse.json(null);

  return NextResponse.json({
    ...data,
    api_key: mask(data.api_key),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = await createClient();

  // Pega config existente
  const { data: existing } = await supabase
    .from("crm_unipile_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Se api_key vier mascarada, mantém a antiga
  const apiKey =
    body.api_key && !body.api_key.includes("...")
      ? body.api_key
      : existing?.api_key || "";

  if (existing) {
    const { data, error } = await supabase
      .from("crm_unipile_config")
      .update({
        api_key: apiKey,
        dsn: body.dsn ?? existing.dsn,
        account_id: body.account_id ?? existing.account_id,
        account_username: body.account_username ?? existing.account_username,
        account_provider: body.account_provider ?? existing.account_provider,
      })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      config: { ...data, api_key: mask(data?.api_key) },
    });
  }

  const { data, error } = await supabase
    .from("crm_unipile_config")
    .insert({
      api_key: apiKey,
      dsn: body.dsn || "",
      account_id: body.account_id || "",
      account_username: body.account_username || "",
      account_provider: body.account_provider || "INSTAGRAM",
      ativo: true,
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    config: { ...data, api_key: mask(data?.api_key) },
  });
}
