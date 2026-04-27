import { Search, Trash2, AlertTriangle, X } from 'lucide-react';
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
  onApagarTodas?: () => Promise<unknown> | void;
}

export function ConversaList({
  conversas,
  conversaAtualId,
  filtroCanal,
  onSelecionar,
  onFiltrar,
  onApagarTodas,
}: ConversaListProps) {
  const [busca, setBusca] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);

  const conversasFiltradas = busca
    ? conversas.filter(c =>
        (c.cliente_nome || c.meta_contato_nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (c.ultima_mensagem || '').toLowerCase().includes(busca.toLowerCase())
      )
    : conversas;

  const handleConfirmarApagar = async () => {
    if (!onApagarTodas) return;
    setApagando(true);
    try {
      await onApagarTodas();
      setConfirmando(false);
    } catch {
      // erro já é logado no hook
    } finally {
      setApagando(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-alisson-600 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-creme-100 text-lg">IAlisson</h2>
          <div className="flex items-center gap-2">
            {onApagarTodas && conversas.length > 0 && (
              <button
                onClick={() => setConfirmando(true)}
                title="Apagar todas as conversas"
                className="p-1.5 rounded-md text-creme-100/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
            <img src="/leao-branco.svg" alt="" className="w-7 h-7 opacity-70" />
          </div>
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

      {/* Modal de confirmação */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !apagando && setConfirmando(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <button
              onClick={() => !apagando && setConfirmando(false)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              disabled={apagando}
            >
              <X size={18} />
            </button>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Apagar todas as conversas?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Esta ação irá excluir <strong>{conversas.length}</strong> conversa{conversas.length === 1 ? '' : 's'} e todas as mensagens. Não é possível desfazer.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setConfirmando(false)}
                disabled={apagando}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarApagar}
                disabled={apagando}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {apagando && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {apagando ? 'Apagando...' : 'Sim, apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
