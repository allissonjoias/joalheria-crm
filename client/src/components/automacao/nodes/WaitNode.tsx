import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';

const unidadeLabels: Record<string, string> = {
  minutos: 'min',
  horas: 'h',
  dias: 'dias',
};

export default function WaitNode({ data }: { data: any }) {
  const valor = data.config?.valor || '?';
  const unidade = data.config?.unidade || 'minutos';

  return (
    <div className="bg-white border-2 border-purple-400 rounded-xl shadow-md px-4 py-3 min-w-[160px]">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
          <Clock size={14} className="text-purple-600" />
        </div>
        <span className="text-xs font-medium text-purple-600 uppercase">Espera</span>
      </div>
      <p className="text-sm font-semibold text-gray-800">
        {valor} {unidadeLabels[unidade] || unidade}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
}
