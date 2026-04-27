import { createClient } from "@/lib/supabase/server";
import { MensageriaClient } from "./mensageria-client";
import type { ConversaCompleta } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MensageriaPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("crm_conversas_completas")
    .select("*")
    .neq("status", "arquivada")
    .order("ultima_msg_em", { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <MensageriaClient
      conversasIniciais={(data ?? []) as ConversaCompleta[]}
      erroInicial={error?.message ?? null}
    />
  );
}
