import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';

const subtipoLabels: Record<string, string> = {
  novo_lead: 'Novo Lead',
  mensagem_recebida: 'Mensagem Recebida',
  mudanca_estagio: 'Mudanca de Estagio',
  palavra_chave: 'Palavra-chave',
  tag_adicionada: 'Tag Adicionada',
};

export default function TriggerNode({ data }: { data: any }) {
  return (
    <div className="bg-white border-2 border-green-400 rounded-xl shadow-md px-4 py-3 min-w-[180px]">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
          <Zap size={14} className="text-green-600" />
        </div>
        <span className="text-xs font-medium text-green-600 uppercase">Gatilho</span>
      </div>
      <p className="text-sm font-semibold text-gray-800">
        {data.label || subtipoLabels[data.subtipo] || data.subtipo}
      </p>
      {data.config?.palavras && data.config.palavras.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          {data.config.palavras.join(', ')}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}
