"use client";

import type { ConversaCompleta } from "@/lib/types";
import { formatRelativeTime, getIniciais, corCanal } from "@/lib/helpers";

interface Props {
  conversas: ConversaCompleta[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}

export function ConversaList({ conversas, selecionadaId, onSelecionar }: Props) {
  if (conversas.length === 0) {
    return (
      <div className="p-6 text-center text-alisson-600 text-sm">
        Nenhuma conversa.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversas.map((c) => {
        const ativa = c.id === selecionadaId;
        const canalInfo = corCanal(c.canal);

        return (
          <button
            key={c.id}
            onClick={() => onSelecionar(c.id)}
            className={`w-full px-3 py-3 flex gap-3 items-start text-left
                       border-b border-wa-border/50 transition-colors
                       ${ativa ? "bg-alisson-50" : "hover:bg-creme-50"}`}
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center
                       flex-shrink-0 bg-alisson-600 text-white text-sm font-medium"
            >
              {getIniciais(c.contato_nome)}
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-alisson-800 truncate">
                  {c.contato_nome || "Cliente sem nome"}
                </span>
                <span className="text-xs text-wa-time flex-shrink-0">
                  {formatRelativeTime(c.ultima_msg_em)}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${canalInfo.bg} ${canalInfo.texto}`}
                >
                  {canalInfo.label}
                </span>
                {c.etapa_nome && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: c.etapa_cor ? `${c.etapa_cor}20` : "#e5e7eb",
                      color: c.etapa_cor ?? "#374151",
                    }}
                  >
                    {c.etapa_nome}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-wa-time truncate flex-1">
                  {c.ultima_msg_resumo || "—"}
                </p>
                {c.nao_lidas_count > 0 && (
                  <span
                    className="ml-2 bg-alisson-600 text-white text-xs
                              w-5 h-5 rounded-full flex items-center justify-center
                              flex-shrink-0 font-medium"
                  >
                    {c.nao_lidas_count > 9 ? "9+" : c.nao_lidas_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
