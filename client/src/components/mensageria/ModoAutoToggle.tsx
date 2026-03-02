import { Bot } from 'lucide-react';

interface ModoAutoToggleProps {
  ativo: boolean;
  onToggle: () => void;
}

export function ModoAutoToggle({ ativo, onToggle }: ModoAutoToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        ativo
          ? 'bg-wa-green-msg text-alisson-600'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title={ativo ? 'Dara respondendo automaticamente' : 'Resposta automatica desativada'}
    >
      <Bot size={14} />
      {ativo ? 'Dara ON' : 'Dara OFF'}
    </button>
  );
}
