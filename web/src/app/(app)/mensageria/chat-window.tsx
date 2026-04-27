"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversaCompleta, Mensagem } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getIniciais, corCanal } from "@/lib/helpers";
import { MensagemBubble } from "./mensagem-bubble";
import { MensagemInput } from "./mensagem-input";
import { Loader2, Phone, MoreVertical } from "lucide-react";

interface Props {
  conversa: ConversaCompleta;
}

export function ChatWindow({ conversa }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canalInfo = corCanal(conversa.canal);

  // Carrega mensagens da conversa selecionada
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    const supabase = createClient();
    supabase
      .from("crm_mensagens")
      .select("*")
      .eq("conversa_id", conversa.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        else setMensagens((data ?? []) as Mensagem[]);
        setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [conversa.id]);

  // Realtime: novas mensagens
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`crm-mensagens-${conversa.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "crm",
          table: "mensagens",
          filter: `conversa_id=eq.${conversa.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMensagens((prev) => {
              if (prev.some((m) => m.id === (payload.new as Mensagem).id)) return prev;
              return [...prev, payload.new as Mensagem];
            });
          } else if (payload.eventType === "UPDATE") {
            setMensagens((prev) =>
              prev.map((m) => (m.id === (payload.new as Mensagem).id ? (payload.new as Mensagem) : m)),
            );
          } else if (payload.eventType === "DELETE") {
            setMensagens((prev) => prev.filter((m) => m.id !== (payload.old as Mensagem).id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversa.id]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Marca como lida quando abre
  useEffect(() => {
    if (conversa.nao_lidas_count > 0) {
      const supabase = createClient();
      supabase.rpc("crm_marcar_conversa_lida", { p_conversa_id: conversa.id });
    }
  }, [conversa.id, conversa.nao_lidas_count]);

  return (
    <>
      {/* Header */}
      <div className="bg-wa-header text-white px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-alisson-700 flex items-center justify-center font-medium">
          {getIniciais(conversa.contato_nome)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {conversa.contato_nome || "Cliente sem nome"}
          </div>
          <div className="text-xs text-creme-100/80 flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded-full ${canalInfo.bg} ${canalInfo.texto}`}>
              {canalInfo.label}
            </span>
            {conversa.contato_telefone && (
              <span className="flex items-center gap-1">
                <Phone size={10} /> {conversa.contato_telefone}
              </span>
            )}
          </div>
        </div>
        <button className="p-2 rounded-full hover:bg-alisson-700">
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Mensagens */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-4 bg-wa-bg-chat"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80' opacity='0.04'><circle cx='40' cy='40' r='20' fill='%23184036'/></svg>\")",
        }}
      >
        {carregando && (
          <div className="flex items-center justify-center h-full text-alisson-600">
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}
        {erro && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            Erro: {erro}
          </div>
        )}
        {!carregando && !erro && mensagens.length === 0 && (
          <div className="text-center text-alisson-600 mt-12">
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-xs mt-1 opacity-70">Mande a primeira abaixo.</p>
          </div>
        )}
        <div className="space-y-1">
          {mensagens.map((m) => (
            <MensagemBubble key={m.id} mensagem={m} />
          ))}
        </div>
      </div>

      {/* Input */}
      <MensagemInput conversaId={conversa.id} />
    </>
  );
}
