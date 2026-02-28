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
      <div className="p-4 text-center text-charcoal-400">
        <Gem size={32} className="mx-auto mb-2 text-charcoal-300" />
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
      <h3 className="text-sm font-semibold text-charcoal-900 uppercase tracking-wider">Dados Extraidos</h3>
      {campos.map((campo) => (
        <div key={campo.label} className="flex items-start gap-3">
          <campo.icon size={16} className={`mt-0.5 ${campo.valor ? 'text-gold-400' : 'text-charcoal-300'}`} />
          <div>
            <p className="text-xs text-charcoal-500">{campo.label}</p>
            <p className={`text-sm ${campo.valor ? 'text-charcoal-900 font-medium' : 'text-charcoal-300 italic'}`}>
              {campo.valor || 'Nao informado'}
            </p>
          </div>
        </div>
      ))}
      {dados.resumo && (
        <div className="mt-4 pt-4 border-t border-charcoal-100">
          <p className="text-xs text-charcoal-500 mb-1">Resumo</p>
          <p className="text-sm text-charcoal-700">{dados.resumo}</p>
        </div>
      )}
    </div>
  );
}
