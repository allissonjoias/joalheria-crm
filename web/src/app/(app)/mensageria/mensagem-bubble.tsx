"use client";

import type { Mensagem } from "@/lib/types";
import { formatTime } from "@/lib/helpers";
import { Check, CheckCheck, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  mensagem: Mensagem;
}

export function MensagemBubble({ mensagem }: Props) {
  const eUser = mensagem.papel === "user";
  const eSystem = mensagem.papel === "system" || mensagem.papel === "interno";

  if (eSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1 rounded-full bg-alisson-100 text-alisson-700 text-xs">
          {mensagem.conteudo}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${eUser ? "justify-start" : "justify-end"} my-1`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm
                    ${eUser ? "bg-wa-bubble-in" : "bg-wa-bubble-out"}`}
      >
        {/* Mídia */}
        {mensagem.tipo_midia === "imagem" && mensagem.midia_url && (
          <img
            src={mensagem.midia_url}
            alt=""
            className="rounded-md mb-1 max-w-full max-h-72 object-cover"
          />
        )}
        {mensagem.tipo_midia === "audio" && mensagem.midia_url && (
          <audio controls src={mensagem.midia_url} className="my-1 max-w-full" />
        )}
        {mensagem.tipo_midia === "video" && mensagem.midia_url && (
          <video controls src={mensagem.midia_url} className="my-1 max-w-full rounded-md" />
        )}
        {mensagem.tipo_midia === "documento" && mensagem.midia_url && (
          <a
            href={mensagem.midia_url}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-alisson-700 underline my-1"
          >
            📎 Ver documento
          </a>
        )}

        {/* Texto */}
        {mensagem.conteudo && (
          <p className="text-sm text-alisson-800 whitespace-pre-wrap break-words">
            {mensagem.conteudo}
          </p>
        )}

        {/* Footer: hora + status */}
        <div className="flex items-center gap-1 justify-end mt-1 -mb-0.5">
          <span className="text-[10px] text-wa-time">
            {formatTime(mensagem.created_at)}
          </span>
          {!eUser && <StatusIcon status={mensagem.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: Mensagem["status"] }) {
  if (status === "pendente" || status === "enviando")
    return <Loader2 size={12} className="text-wa-time animate-spin" />;
  if (status === "erro")
    return <AlertCircle size={12} className="text-red-500" />;
  if (status === "lida")
    return <CheckCheck size={12} className="text-wa-tick" />;
  if (status === "entregue") return <CheckCheck size={12} className="text-wa-time" />;
  return <Check size={12} className="text-wa-time" />;
}
