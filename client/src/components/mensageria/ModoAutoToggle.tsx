import { Bot } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface ModoAutoToggleProps {
  ativo: boolean;
  onToggle: () => void;
}

export function ModoAutoToggle({ ativo, onToggle }: ModoAutoToggleProps) {
  return (
    <Tooltip
      texto={ativo
        ? 'IA esta respondendo automaticamente. Clique para desativar e responder manualmente'
        : 'Resposta automatica desativada. Clique para ativar a IA para responder automaticamente'}
      posicao="bottom"
    >
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          ativo
            ? 'bg-wa-green-msg text-alisson-600'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        <Bot size={14} />
        {ativo ? 'IA ATIVO' : 'IA INATIVO'}
      </button>
    </Tooltip>
  );
}
