"use client";

import { useEffect, useState, useCallback } from "react";
import type { ConversaCompleta, Mensagem } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { ConversaList } from "./conversa-list";
import { ChatWindow } from "./chat-window";
import { MessageSquare } from "lucide-react";

interface Props {
  conversasIniciais: ConversaCompleta[];
  erroInicial: string | null;
}

export function MensageriaClient({ conversasIniciais, erroInicial }: Props) {
  const [conversas, setConversas] = useState<ConversaCompleta[]>(conversasIniciais);
  const [conversaSelecionadaId, setConversaSelecionadaId] = useState<string | null>(
    conversasIniciais[0]?.id ?? null,
  );
  const [busca, setBusca] = useState("");

  const conversaSelecionada =
    conversas.find((c) => c.id === conversaSelecionadaId) ?? null;

  // Realtime: escuta mudanças em crm.conversas
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("crm-conversas-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "conversas" },
        async () => {
          // Recarrega lista (joins não vêm via realtime payload)
          const { data } = await supabase
            .from("crm_conversas_completas")
            .select("*")
            .neq("status", "arquivada")
            .order("ultima_msg_em", { ascending: false, nullsFirst: false })
            .limit(100);
          if (data) setConversas(data as ConversaCompleta[]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const conversasFiltradas = conversas.filter((c) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      (c.contato_nome?.toLowerCase().includes(q) ?? false) ||
      (c.ultima_msg_resumo?.toLowerCase().includes(q) ?? false)
    );
  });

  const onSelecionar = useCallback((id: string) => {
    setConversaSelecionadaId(id);
  }, []);

  return (
    <div className="flex h-full bg-wa-bg-panel">
      {/* Lista de conversas */}
      <aside className="w-96 bg-white border-r border-wa-border flex flex-col">
        <div className="px-4 py-3 border-b border-wa-border">
          <h1 className="font-semibold text-alisson-700 text-lg">Mensageria</h1>
          <input
            type="text"
            placeholder="Buscar conversa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mt-2 w-full px-3 py-2 bg-wa-search rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-alisson-500"
          />
        </div>

        {erroInicial && (
          <div className="p-3 bg-red-50 text-red-700 text-xs">
            <strong>Erro ao carregar:</strong> {erroInicial}
          </div>
        )}

        <ConversaList
          conversas={conversasFiltradas}
          selecionadaId={conversaSelecionadaId}
          onSelecionar={onSelecionar}
        />
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col">
        {conversaSelecionada ? (
          <ChatWindow conversa={conversaSelecionada} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-alisson-600">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">Selecione uma conversa</p>
              <p className="text-sm opacity-70 mt-1">
                {conversas.length === 0
                  ? "Nenhuma conversa ainda. Webhooks Unipile/Meta são habilitados na Fase 3."
                  : `${conversas.length} conversa${conversas.length > 1 ? "s" : ""} disponível`}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
