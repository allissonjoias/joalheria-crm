import { User, Phone, Mail, Tag, DollarSign, Heart, Gem } from 'lucide-react';

interface DadosExtraidosProps {
  dados: {
    nome?: string;
    telefone?: string;
    email?: string;
    tipo_interesse?: string;
    material_preferido?: string;
    pedra_preferida?: string;
    orcamento_min?: number;
    orcamento_max?: number;
    ocasiao?: string;
    resumo?: string;
  } | null;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function DadosExtraidos({ dados }: DadosExtraidosProps) {
  if (!dados) {
    return (
      <div className="p-6 text-center text-gray-400">
        <img src="/leao.svg" alt="" className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Os dados do cliente serao extraidos automaticamente da conversa</p>
      </div>
    );
  }

  const campos = [
    { icon: User, label: 'Nome', valor: dados.nome },
    { icon: Phone, label: 'Telefone', valor: dados.telefone },
    { icon: Mail, label: 'Email', valor: dados.email },
    { icon: Tag, label: 'Interesse', valor: dados.tipo_interesse },
    { icon: Gem, label: 'Material', valor: dados.material_preferido },
    { icon: Gem, label: 'Pedra', valor: dados.pedra_preferida },
    { icon: DollarSign, label: 'Orcamento', valor: dados.orcamento_min || dados.orcamento_max ? `${dados.orcamento_min ? formatarMoeda(dados.orcamento_min) : '?'} - ${dados.orcamento_max ? formatarMoeda(dados.orcamento_max) : '?'}` : null },
    { icon: Heart, label: 'Ocasiao', valor: dados.ocasiao },
  ];

  return (
    <div className="p-4 space-y-3">
      {campos.map((campo) => (
        <div key={campo.label} className="flex items-start gap-3">
          <campo.icon size={16} className={`mt-0.5 ${campo.valor ? 'text-alisson-600' : 'text-gray-300'}`} />
          <div>
            <p className="text-xs text-gray-500">{campo.label}</p>
            <p className={`text-sm ${campo.valor ? 'text-alisson-600 font-medium' : 'text-gray-300 italic'}`}>
              {campo.valor || 'Nao informado'}
            </p>
          </div>
        </div>
      ))}
      {dados.resumo && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Resumo</p>
          <p className="text-sm text-gray-700">{dados.resumo}</p>
        </div>
      )}
    </div>
  );
}
