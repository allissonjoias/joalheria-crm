import { CheckCircle, XCircle, Loader2, Clock, Ban } from 'lucide-react';

interface ImportLog {
  id: string;
  tipo: string;
  total_esperado: number;
  total_importado: number;
  total_erros: number;
  status: string;
  detalhes: string | null;
}

interface ImportProgressProps {
  log: ImportLog | null;
  label: string;
  onCancelar?: () => void;
}

const STATUS_ICONS: Record<string, any> = {
  pendente: Clock,
  rodando: Loader2,
  concluido: CheckCircle,
  erro: XCircle,
  cancelado: Ban,
};

const STATUS_COLORS: Record<string, string> = {
  pendente: 'text-gray-400',
  rodando: 'text-alisson-600 animate-spin',
  concluido: 'text-green-500',
  erro: 'text-red-500',
  cancelado: 'text-yellow-500',
};

const BAR_COLORS: Record<string, string> = {
  pendente: 'bg-gray-300',
  rodando: 'bg-alisson-600',
  concluido: 'bg-green-500',
  erro: 'bg-red-500',
  cancelado: 'bg-yellow-500',
};

export function ImportProgress({ log, label, onCancelar }: ImportProgressProps) {
  if (!log) {
    return (
      <div className="py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-600">{label}</span>
          <span className="text-xs text-gray-400">Aguardando...</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full" />
      </div>
    );
  }

  const percent = log.total_esperado > 0
    ? Math.min(100, Math.round((log.total_importado / log.total_esperado) * 100))
    : 0;

  const Icon = STATUS_ICONS[log.status] || Clock;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon size={16} className={STATUS_COLORS[log.status]} />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {log.total_importado.toLocaleString('pt-BR')} de {log.total_esperado.toLocaleString('pt-BR')} ({percent}%)
          </span>
          {log.status === 'rodando' && onCancelar && (
            <button
              onClick={onCancelar}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[log.status]}`}
          style={{ width: `${log.status === 'rodando' && percent === 0 ? 2 : percent}%` }}
        />
      </div>

      {log.total_erros > 0 && (
        <p className="text-xs text-red-400 mt-1">{log.total_erros} erros</p>
      )}
      {log.detalhes && log.status === 'rodando' && (
        <p className="text-xs text-gray-400 mt-1">{log.detalhes}</p>
      )}
      {log.detalhes && log.status === 'erro' && (
        <p className="text-xs text-red-400 mt-1">{log.detalhes}</p>
      )}
    </div>
  );
}
