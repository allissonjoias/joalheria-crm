import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

const subtipoLabels: Record<string, string> = {
  if_tag: 'Se tem Tag',
  if_cliente_lead: 'Se Cliente/Lead',
  if_estagio: 'Se Estagio',
  if_respondeu: 'Se Respondeu',
  if_bant: 'Se BANT Score',
  if_canal: 'Se Canal',
};

export default function ConditionNode({ data }: { data: any }) {
  return (
    <div className="bg-white border-2 border-amber-400 rounded-xl shadow-md px-4 py-3 min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 bg-amber-100 rounded flex items-center justify-center">
          <GitBranch size={14} className="text-amber-600" />
        </div>
        <span className="text-xs font-medium text-amber-600 uppercase">Condicao</span>
      </div>
      <p className="text-sm font-semibold text-gray-800">
        {data.label || subtipoLabels[data.subtipo] || data.subtipo}
      </p>
      {data.config?.tag && (
        <p className="text-xs text-amber-500 mt-1">Tag: {data.config.tag}</p>
      )}
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-green-500 font-medium">Sim</span>
        <span className="text-[10px] text-red-500 font-medium">Nao</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="sim" className="!bg-green-500 !w-3 !h-3 !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="nao" className="!bg-red-500 !w-3 !h-3 !left-[70%]" />
    </div>
  );
}
