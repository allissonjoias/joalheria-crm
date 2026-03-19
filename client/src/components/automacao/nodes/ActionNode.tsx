import { Handle, Position } from '@xyflow/react';
import { MessageSquare, Tag, GitBranch, Bell, Play } from 'lucide-react';

const subtipoConfig: Record<string, { label: string; icon: any }> = {
  enviar_whatsapp: { label: 'Enviar WhatsApp', icon: MessageSquare },
  enviar_instagram: { label: 'Enviar Instagram', icon: MessageSquare },
  enviar_template: { label: 'Enviar Template', icon: MessageSquare },
  adicionar_tag: { label: 'Adicionar Tag', icon: Tag },
  mover_estagio: { label: 'Mover Estagio', icon: GitBranch },
  criar_tarefa: { label: 'Criar Tarefa', icon: Play },
  notificar: { label: 'Notificar', icon: Bell },
};

export default function ActionNode({ data }: { data: any }) {
  const cfg = subtipoConfig[data.subtipo] || { label: data.subtipo, icon: Play };
  const Icon = cfg.icon;

  return (
    <div className="bg-white border-2 border-blue-400 rounded-xl shadow-md px-4 py-3 min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
          <Icon size={14} className="text-blue-600" />
        </div>
        <span className="text-xs font-medium text-blue-600 uppercase">Acao</span>
      </div>
      <p className="text-sm font-semibold text-gray-800">
        {data.label || cfg.label}
      </p>
      {data.config?.mensagem && (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{data.config.mensagem}</p>
      )}
      {data.config?.tag && (
        <p className="text-xs text-blue-400 mt-1">#{data.config.tag}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}
