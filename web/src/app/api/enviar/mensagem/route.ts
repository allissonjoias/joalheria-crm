/**
 * POST /api/enviar/mensagem
 * Body: { conversaId: string, conteudo: string }
 *
 * 1. Persiste no banco com status='enviando'
 * 2. Envia via canal externo (Unipile/Meta) baseado em crm.conversas.canal
 * 3. Atualiza status='enviada' ou 'erro'
 *
 * Roda como user autenticado (RLS aplica).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUnipileClient } from "@/lib/unipile/client";

export async function POST(request: NextRequest) {
  const { conversaId, conteudo } = await request.json();
  if (!conversaId || !conteudo?.trim()) {
    return NextResponse.json(
      { erro: "conversaId e conteudo são obrigatórios" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Confere autenticação
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  // Lê conversa pra saber canal e thread_id
  const { data: conversa, error: errConv } = await supabase
    .from("crm_conversas")
    .select("id, canal, canal_thread_id")
    .eq("id", conversaId)
    .maybeSingle();

  if (errConv || !conversa) {
    return NextResponse.json(
      { erro: errConv?.message || "conversa não encontrada" },
      { status: 404 },
    );
  }

  // 1) Persiste mensagem com status pendente
  const { data: msgId, error: errInsert } = await supabase.rpc(
    "crm_adicionar_mensagem",
    {
      p_conversa_id: conversaId,
      p_papel: "vendedor",
      p_conteudo: conteudo.trim(),
    },
  );

  if (errInsert) {
    return NextResponse.json({ erro: errInsert.message }, { status: 500 });
  }

  // 2) Marca como "enviando"
  await supabase
    .from("crm_mensagens")
    .update({ status: "enviando" })
    .eq("id", msgId);

  // 3) Envia via canal apropriado
  let erroEnvio: string | null = null;

  try {
    if (conversa.canal === "instagram_dm" || conversa.canal === "whatsapp") {
      // Via Unipile
      const unipile = await getUnipileClient(supabase);
      if (!unipile) {
        throw new Error("Unipile não configurada");
      }
      if (!conversa.canal_thread_id) {
        throw new Error("Conversa sem canal_thread_id (chat_id Unipile)");
      }
      await unipile.enviarMensagem(conversa.canal_thread_id, conteudo.trim());
    } else if (conversa.canal === "interna") {
      // Conversa interna — só persiste, não tem destinatário externo
    } else {
      throw new Error(`Canal "${conversa.canal}" não suportado`);
    }

    // Sucesso
    await supabase
      .from("crm_mensagens")
      .update({
        status: "enviada",
        enviado_em: new Date().toISOString(),
      })
      .eq("id", msgId);
  } catch (e: any) {
    erroEnvio = e.message;
    await supabase
      .from("crm_mensagens")
      .update({ status: "erro", erro: erroEnvio })
      .eq("id", msgId);
  }

  return NextResponse.json({
    ok: !erroEnvio,
    mensagem_id: msgId,
    erro: erroEnvio,
  });
}
