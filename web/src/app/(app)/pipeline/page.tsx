import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "./pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();

  // Carrega blocos + etapas + conversas em paralelo
  const [blocosRes, etapasRes, conversasRes, vendedoresRes] = await Promise.all([
    supabase.from("crm_funil_blocos").select("*").order("ordem"),
    supabase.from("crm_funil_etapas_completas").select("*"),
    supabase
      .from("crm_conversas_completas")
      .select("*")
      .neq("status", "arquivada")
      .order("ultima_msg_em", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase
      .from("vendedores")
      .select("id_vendedor, nome, foto")
      .order("nome"),
  ]);

  return (
    <PipelineBoard
      blocos={blocosRes.data ?? []}
      etapas={etapasRes.data ?? []}
      conversasIniciais={conversasRes.data ?? []}
      vendedores={vendedoresRes.data ?? []}
      erro={blocosRes.error?.message || etapasRes.error?.message || conversasRes.error?.message || null}
    />
  );
}
