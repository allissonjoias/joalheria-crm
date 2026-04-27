"use client";

import Link from "next/link";
import { MessageSquare, Phone, User } from "lucide-react";
import type { ConversaCompleta } from "@/lib/types";
import { formatRelativeTime, getIniciais, corCanal } from "@/lib/helpers";

export function PipelineCard({ conversa }: { conversa: ConversaCompleta }) {
  const canalInfo = corCanal(conversa.canal);

  return (
    <Link
      href={`/mensageria?id=${conversa.id}`}
      className="block bg-white border border-alisson-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-alisson-600 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
          {getIniciais(conversa.contato_nome)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-alisson-800 truncate">
            {conversa.contato_nome || "Cliente sem nome"}
          </div>
          {conversa.vendedor_nome && (
            <div className="text-xs text-alisson-500 flex items-center gap-1 mt-0.5">
              <User size={10} /> {conversa.vendedor_nome}
            </div>
          )}
        </div>
        {conversa.nao_lidas_count > 0 && (
          <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium flex-shrink-0">
            {conversa.nao_lidas_count > 9 ? "9+" : conversa.nao_lidas_count}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full ${canalInfo.bg} ${canalInfo.texto}`}
        >
          {canalInfo.label}
        </span>
        {conversa.contato_telefone && (
          <span className="text-[10px] text-alisson-500 flex items-center gap-0.5">
            <Phone size={9} /> {conversa.contato_telefone}
          </span>
        )}
      </div>

      {conversa.ultima_msg_resumo && (
        <p className="text-xs text-alisson-600 line-clamp-2 mb-1">
          {conversa.ultima_msg_resumo}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-alisson-500">
        <span className="flex items-center gap-1">
          <MessageSquare size={10} />
          {formatRelativeTime(conversa.ultima_msg_em)}
        </span>
        {conversa.modo_auto && (
          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
            🤖 Auto
          </span>
        )}
      </div>
    </Link>
  );
}
