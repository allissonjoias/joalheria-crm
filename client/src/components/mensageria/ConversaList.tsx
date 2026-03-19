import { Search } from 'lucide-react';
import { useState } from 'react';
import { ConversaItem } from './ConversaItem';
import { FiltroCanal } from './FiltroCanal';
import type { Conversa, Canal } from '../../hooks/useMensageria';

interface ConversaListProps {
  conversas: Conversa[];
  conversaAtualId: string | null;
  filtroCanal: Canal;
  onSelecionar: (id: string) => void;
  onFiltrar: (canal: Canal) => void;
}

export function ConversaList({
  conversas,
  conversaAtualId,
  filtroCanal,
  onSelecionar,
  onFiltrar,
}: ConversaListProps) {
  const [busca, setBusca] = useState('');

  const conversasFiltradas = busca
    ? conversas.filter(c =>
        (c.cliente_nome || c.meta_contato_nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (c.ultima_mensagem || '').toLowerCase().includes(busca.toLowerCase())
      )
    : conversas;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-alisson-600 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-creme-100 text-lg">IAlisson</h2>
          <img src="/leao-branco.svg" alt="" className="w-7 h-7 opacity-70" />
        </div>

        {/* Barra de busca */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar ou comecar uma nova conversa"
            className="w-full pl-10 pr-4 py-2 bg-white rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="px-3 py-2 border-b border-wa-border bg-white">
        <FiltroCanal filtroAtual={filtroCanal} onFiltrar={onFiltrar} />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {conversasFiltradas.map((c) => (
          <ConversaItem
            key={c.id}
            conversa={c}
            selecionada={conversaAtualId === c.id}
            onClick={() => onSelecionar(c.id)}
          />
        ))}
        {conversasFiltradas.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhuma conversa encontrada
          </div>
        )}
      </div>
    </div>
  );
}
