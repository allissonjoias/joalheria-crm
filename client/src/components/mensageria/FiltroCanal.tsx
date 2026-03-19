import { Tooltip } from '../ui/Tooltip';
import type { Canal } from '../../hooks/useMensageria';

interface FiltroCanalProps {
  filtroAtual: Canal;
  onFiltrar: (canal: Canal) => void;
}

const filtros: { canal: Canal; label: string; dica: string }[] = [
  { canal: 'todos', label: 'Todos', dica: 'Todas as conversas com clientes e leads' },
  { canal: 'whatsapp', label: 'WhatsApp', dica: 'Apenas conversas do WhatsApp' },
  { canal: 'instagram_dm', label: 'Instagram', dica: 'Apenas DMs do Instagram' },
  { canal: 'instagram_comment', label: 'Comentarios', dica: 'Apenas comentarios do Instagram' },
];

export function FiltroCanal({ filtroAtual, onFiltrar }: FiltroCanalProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5">
      {filtros.map(({ canal, label, dica }) => (
        <Tooltip key={canal} texto={dica} posicao="bottom">
          <button
            onClick={() => onFiltrar(canal)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filtroAtual === canal
                ? 'bg-alisson-600 text-white'
                : 'bg-wa-search text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
