import type { Canal } from '../../hooks/useMensageria';

interface FiltroCanalProps {
  filtroAtual: Canal;
  onFiltrar: (canal: Canal) => void;
}

const filtros: { canal: Canal; label: string }[] = [
  { canal: 'todos', label: 'Todos' },
  { canal: 'whatsapp', label: 'WhatsApp' },
  { canal: 'instagram_dm', label: 'Instagram' },
  { canal: 'instagram_comment', label: 'Comentarios' },
  { canal: 'interno', label: 'Interno' },
];

export function FiltroCanal({ filtroAtual, onFiltrar }: FiltroCanalProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {filtros.map(({ canal, label }) => (
        <button
          key={canal}
          onClick={() => onFiltrar(canal)}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            filtroAtual === canal
              ? 'bg-alisson-600 text-white'
              : 'bg-wa-search text-gray-600 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
