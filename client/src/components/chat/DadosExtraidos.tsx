import { User, Phone, Mail, Tag, DollarSign, Heart, Gem, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { Tooltip } from '../ui/Tooltip';

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
  scoring?: {
    nota: number;
    detalhes: string[];
    pontos_positivos: string[];
    pontos_melhorar: string[];
  } | null;
  onSoliciarScoring?: () => void;
  scoringLoading?: boolean;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function BarraCompletude({ percentual }: { percentual: number }) {
  const cor = percentual >= 80 ? 'bg-green-500' : percentual >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  const corTexto = percentual >= 80 ? 'text-green-600' : percentual >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-500">Dados coletados</span>
        <span className={`text-xs font-bold ${corTexto}`}>{percentual}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${cor} rounded-full transition-all duration-500`} style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}

function NotaScoring({ nota }: { nota: number }) {
  const cor = nota >= 80 ? 'text-green-600 border-green-500' : nota >= 50 ? 'text-yellow-600 border-yellow-500' : 'text-red-600 border-red-500';
  const bg = nota >= 80 ? 'bg-green-50' : nota >= 50 ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <div className={`w-14 h-14 rounded-full border-3 ${cor} ${bg} flex items-center justify-center flex-shrink-0`} style={{ borderWidth: 3 }}>
      <span className={`text-lg font-bold ${cor}`}>{nota}</span>
    </div>
  );
}

export function DadosExtraidos({ dados, scoring, onSoliciarScoring, scoringLoading }: DadosExtraidosProps) {
  const [scoringAberto, setScoringAberto] = useState(false);

  if (!dados) {
    return (
      <div className="p-6 text-center text-gray-400">
        <img src="/leao.svg" alt="" className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Os dados do cliente serao extraidos automaticamente da conversa</p>
      </div>
    );
  }

  const campos = [
    { icon: User, label: 'Nome', valor: dados.nome, obrigatorio: true },
    { icon: Phone, label: 'Telefone', valor: dados.telefone, obrigatorio: true },
    { icon: Mail, label: 'Email', valor: dados.email, obrigatorio: false },
    { icon: Tag, label: 'Interesse', valor: dados.tipo_interesse, obrigatorio: true },
    { icon: Gem, label: 'Material', valor: dados.material_preferido, obrigatorio: false },
    { icon: Gem, label: 'Pedra', valor: dados.pedra_preferida, obrigatorio: false },
    { icon: DollarSign, label: 'Orcamento', valor: dados.orcamento_min || dados.orcamento_max ? `${dados.orcamento_min ? formatarMoeda(dados.orcamento_min) : '?'} - ${dados.orcamento_max ? formatarMoeda(dados.orcamento_max) : '?'}` : null, obrigatorio: true },
    { icon: Heart, label: 'Ocasiao', valor: dados.ocasiao, obrigatorio: true },
  ];

  const camposPreenchidos = campos.filter(c => !!c.valor).length;
  const percentual = Math.round((camposPreenchidos / campos.length) * 100);
  const camposFaltantes = campos.filter(c => c.obrigatorio && !c.valor);

  return (
    <div>
      {/* Barra de completude */}
      <BarraCompletude percentual={percentual} />

      {/* Alerta de campos faltantes */}
      {camposFaltantes.length > 0 && (
        <div className="mx-3 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-700">Dados faltando</span>
          </div>
          <div className="space-y-0.5">
            {camposFaltantes.map(c => (
              <p key={c.label} className="text-xs text-amber-600 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-amber-400" />
                {c.label}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Campos */}
      <div className="p-4 space-y-3">
        {campos.map((campo) => (
          <div key={campo.label} className="flex items-start gap-3">
            <div className="mt-0.5">
              {campo.valor ? (
                <campo.icon size={16} className="text-alisson-600" />
              ) : campo.obrigatorio ? (
                <campo.icon size={16} className="text-amber-400" />
              ) : (
                <campo.icon size={16} className="text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-500">{campo.label}</p>
                {campo.valor && <CheckCircle size={10} className="text-green-500" />}
              </div>
              <p className={`text-sm ${campo.valor ? 'text-alisson-600 font-medium' : campo.obrigatorio ? 'text-amber-400 italic' : 'text-gray-300 italic'}`}>
                {campo.valor || (campo.obrigatorio ? 'Pendente' : 'Nao informado')}
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

      {/* Scoring da vendedora */}
      <div className="border-t border-gray-100">
        <Tooltip texto="Avaliar a qualidade do atendimento da vendedora nesta conversa com nota de 0 a 100" posicao="left">
        <button
          onClick={() => {
            if (!scoring && onSoliciarScoring) onSoliciarScoring();
            setScoringAberto(!scoringAberto);
          }}
          disabled={scoringLoading}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-alisson-600" />
            <span className="text-xs font-semibold text-gray-700">Nota do Atendimento</span>
          </div>
          {scoringLoading ? (
            <div className="w-4 h-4 border-2 border-alisson-600 border-t-transparent rounded-full animate-spin" />
          ) : scoring ? (
            <span className={`text-sm font-bold ${scoring.nota >= 80 ? 'text-green-600' : scoring.nota >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {scoring.nota}/100
            </span>
          ) : (
            <span className="text-xs text-alisson-500">Avaliar</span>
          )}
        </button>
        </Tooltip>

        {scoringAberto && scoring && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-3">
              <NotaScoring nota={scoring.nota} />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {scoring.nota >= 80 ? 'Excelente' : scoring.nota >= 60 ? 'Bom' : scoring.nota >= 40 ? 'Regular' : 'Precisa melhorar'}
                </p>
                <p className="text-xs text-gray-500">Qualidade do atendimento</p>
              </div>
            </div>

            {scoring.pontos_positivos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-600 mb-1">Pontos positivos</p>
                {scoring.pontos_positivos.map((p, i) => (
                  <p key={i} className="text-xs text-gray-600 flex items-start gap-1 mb-0.5">
                    <CheckCircle size={10} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {p}
                  </p>
                ))}
              </div>
            )}

            {scoring.pontos_melhorar.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-1">Pontos a melhorar</p>
                {scoring.pontos_melhorar.map((p, i) => (
                  <p key={i} className="text-xs text-gray-600 flex items-start gap-1 mb-0.5">
                    <AlertTriangle size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    {p}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
