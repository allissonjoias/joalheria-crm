"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Search, Filter, KanbanSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ConversaCompleta } from "@/lib/types";
import { PipelineCard } from "./pipeline-card";

interface Bloco {
  id: string;
  nome: string;
  ordem: number;
  cor: string | null;
}

interface EtapaCompleta {
  id: string;
  bloco_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  ativo: boolean;
  bloco_nome: string;
  bloco_ordem: number;
  bloco_cor: string | null;
}

interface Vendedor {
  id_vendedor: number;
  nome: string;
  foto: string | null;
}

interface Props {
  blocos: Bloco[];
  etapas: EtapaCompleta[];
  conversasIniciais: ConversaCompleta[];
  vendedores: Vendedor[];
  erro: string | null;
}

const SEM_ETAPA = "__sem_etapa__";

export function PipelineBoard({
  blocos,
  etapas,
  conversasIniciais,
  vendedores,
  erro,
}: Props) {
  const [conversas, setConversas] = useState<ConversaCompleta[]>(conversasIniciais);
  const [busca, setBusca] = useState("");
  const [vendedorFiltro, setVendedorFiltro] = useState<number | null>(null);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("crm-pipeline-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "crm", table: "conversas" },
        async () => {
          const { data } = await supabase
            .from("crm_conversas_completas")
            .select("*")
            .neq("status", "arquivada")
            .order("ultima_msg_em", { ascending: false, nullsFirst: false })
            .limit(500);
          if (data) setConversas(data as ConversaCompleta[]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtra conversas
  const conversasFiltradas = useMemo(() => {
    return conversas.filter((c) => {
      if (vendedorFiltro && c.vendedor_id !== vendedorFiltro) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !(c.contato_nome?.toLowerCase().includes(q) ?? false) &&
          !(c.ultima_msg_resumo?.toLowerCase().includes(q) ?? false)
        )
          return false;
      }
      return true;
    });
  }, [conversas, busca, vendedorFiltro]);

  // Agrupa por etapa
  const porEtapa = useMemo(() => {
    const map: Record<string, ConversaCompleta[]> = { [SEM_ETAPA]: [] };
    etapas.forEach((e) => (map[e.id] = []));
    conversasFiltradas.forEach((c) => {
      const etapaId = c.etapa_atual_id || SEM_ETAPA;
      if (!map[etapaId]) map[etapaId] = [];
      map[etapaId].push(c);
    });
    return map;
  }, [conversasFiltradas, etapas]);

  // Drag-drop handler
  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const novaEtapaId = destination.droppableId === SEM_ETAPA ? null : destination.droppableId;

    // Update otimista
    setConversas((prev) =>
      prev.map((c) =>
        c.id === draggableId ? { ...c, etapa_atual_id: novaEtapaId } : c,
      ),
    );

    // Persiste
    const supabase = createClient();
    if (novaEtapaId) {
      await supabase.rpc("crm_mover_etapa_funil", {
        p_conversa_id: draggableId,
        p_etapa_para_id: novaEtapaId,
      });
    } else {
      // Remove etapa
      await supabase
        .from("crm_conversas")
        .update({ etapa_atual_id: null })
        .eq("id", draggableId);
    }
  }

  // Agrupa etapas por bloco
  const blocosComEtapas = useMemo(() => {
    return blocos.map((b) => ({
      ...b,
      etapas: etapas
        .filter((e) => e.bloco_id === b.id && e.ativo)
        .sort((a, b) => a.ordem - b.ordem),
    }));
  }, [blocos, etapas]);

  const semEtapaCount = porEtapa[SEM_ETAPA]?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-alisson-200 px-6 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold text-alisson-700 flex items-center gap-2">
          <KanbanSquare size={20} /> Pipeline
        </h1>

        <div className="flex-1 flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-alisson-400"
            />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-alisson-200 text-sm focus:outline-none focus:ring-2 focus:ring-alisson-500"
            />
          </div>

          <select
            value={vendedorFiltro ?? ""}
            onChange={(e) =>
              setVendedorFiltro(e.target.value ? parseInt(e.target.value) : null)
            }
            className="px-3 py-1.5 rounded-lg border border-alisson-200 text-sm focus:outline-none focus:ring-2 focus:ring-alisson-500"
          >
            <option value="">Todos vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id_vendedor} value={v.id_vendedor}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-alisson-600">
          {conversasFiltradas.length} conversa{conversasFiltradas.length === 1 ? "" : "s"}
        </div>
      </div>

      {erro && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erro}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto bg-creme-200 p-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-max">
            {/* Coluna "Sem etapa" — só aparece se tiver alguém */}
            {semEtapaCount > 0 && (
              <Coluna
                etapaId={SEM_ETAPA}
                titulo="Sem etapa"
                cor="#9ca3af"
                bloco={null}
                conversas={porEtapa[SEM_ETAPA]}
              />
            )}

            {/* Colunas dos blocos */}
            {blocosComEtapas.map((bloco) => (
              <div key={bloco.id} className="flex flex-col">
                <div
                  className="font-semibold text-xs uppercase tracking-wide text-white px-3 py-1.5 rounded-t-lg mb-2"
                  style={{ background: bloco.cor || "#184036" }}
                >
                  {bloco.nome}
                </div>
                <div className="flex gap-3">
                  {bloco.etapas.map((etapa) => (
                    <Coluna
                      key={etapa.id}
                      etapaId={etapa.id}
                      titulo={etapa.nome}
                      cor={etapa.cor || "#9ca3af"}
                      bloco={bloco.nome}
                      conversas={porEtapa[etapa.id] ?? []}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

function Coluna({
  etapaId,
  titulo,
  cor,
  bloco,
  conversas,
}: {
  etapaId: string;
  titulo: string;
  cor: string;
  bloco: string | null;
  conversas: ConversaCompleta[];
}) {
  return (
    <Droppable droppableId={etapaId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`w-72 flex-shrink-0 rounded-lg p-2 transition-colors ${
            snapshot.isDraggingOver ? "bg-alisson-50" : "bg-white"
          }`}
          style={{
            borderTop: `3px solid ${cor}`,
          }}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <h3 className="font-medium text-sm text-alisson-700">{titulo}</h3>
            <span className="text-xs bg-alisson-100 text-alisson-700 rounded-full w-5 h-5 flex items-center justify-center">
              {conversas.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[100px] max-h-[calc(100vh-220px)] overflow-y-auto">
            {conversas.map((c, idx) => (
              <Draggable key={c.id} draggableId={c.id} index={idx}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`${snapshot.isDragging ? "opacity-90 rotate-1" : ""}`}
                  >
                    <PipelineCard conversa={c} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {conversas.length === 0 && (
              <div className="text-center text-xs text-alisson-400 py-4">
                Vazia
              </div>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}
