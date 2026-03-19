import { useState, useEffect, useCallback } from 'react';
import {
  Users, Trophy, AlertTriangle, CheckCircle, Clock, TrendingUp,
  TrendingDown, Target, MessageSquare, DollarSign, ChevronDown,
  ListTodo, Filter,
} from 'lucide-react';
import api from '../services/api';

// === Tipos ===

interface VendedoraPerformance {
  id: string;
  nome: string;
  vendas: {
    total: number;
    valor: number;
    mes_total: number;
    mes_valor: number;
    variacao: number;
    ticket_medio: number;
  };
  leads_atendidos: number;
  pipeline: {
    ativo: number;
    valor_potencial: number;
    taxa_conversao: number;
  };
  clientes_total: number;
  tarefas: { pendentes: number; vencidas: number };
  mensagens_hoje: number;
  minutos_ponto_hoje: number;
}

interface TarefaEquipe {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  data_vencimento: string | null;
  vendedor_nome: string | null;
  cliente_nome: string | null;
  dias_atraso: number;
  criado_em: string;
}

interface ResumoEquipe {
  id: string;
  nome: string;
  total: number;
  pendentes: number;
  vencidas: number;
  concluidas_semana: number;
}

// === Utils ===

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

const PRIORIDADE_COR: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta: 'bg-orange-100 text-orange-700',
  media: 'bg-yellow-100 text-yellow-700',
  baixa: 'bg-gray-100 text-gray-500',
};

const PRIORIDADE_LABEL: Record<string, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Media',
  baixa: 'Baixa',
};

// === Componentes ===

function CardVendedora({ v, posicao }: { v: VendedoraPerformance; posicao: number }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Posicao */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
          posicao === 1 ? 'bg-yellow-400 text-yellow-900' :
          posicao === 2 ? 'bg-gray-300 text-gray-700' :
          posicao === 3 ? 'bg-amber-600 text-white' :
          'bg-gray-100 text-gray-500'
        }`}>
          {posicao}
        </div>

        {/* Avatar + Nome */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-alisson-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">{v.nome.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate">{v.nome}</p>
            <p className="text-xs text-gray-400">
              {v.minutos_ponto_hoje > 0 ? `Online ${formatarMinutos(v.minutos_ponto_hoje)}` : 'Offline'}
            </p>
          </div>
        </div>

        {/* Metricas rapidas */}
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-bold text-alisson-600">{formatarMoeda(v.vendas.mes_valor)}</p>
            <p className="text-xs text-gray-400">este mes</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-700">{v.vendas.mes_total}</p>
            <p className="text-xs text-gray-400">vendas</p>
          </div>
          <div className="text-center">
            <p className={`font-bold flex items-center gap-1 ${v.vendas.variacao >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {v.vendas.variacao >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {v.vendas.variacao > 0 ? '+' : ''}{v.vendas.variacao}%
            </p>
            <p className="text-xs text-gray-400">variacao</p>
          </div>
          {v.tarefas.vencidas > 0 && (
            <div className="text-center">
              <p className="font-bold text-red-500 flex items-center gap-1">
                <AlertTriangle size={14} /> {v.tarefas.vencidas}
              </p>
              <p className="text-xs text-gray-400">atrasadas</p>
            </div>
          )}
        </div>

        <ChevronDown size={18} className={`text-gray-400 transition-transform flex-shrink-0 ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="border-t p-4 bg-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricaMini icon={DollarSign} label="Vendas (periodo)" valor={formatarMoeda(v.vendas.valor)} sub={`${v.vendas.total} vendas`} />
            <MetricaMini icon={Target} label="Ticket medio" valor={formatarMoeda(v.vendas.ticket_medio)} />
            <MetricaMini icon={Users} label="Clientes" valor={String(v.clientes_total)} />
            <MetricaMini icon={MessageSquare} label="Msgs hoje" valor={String(v.mensagens_hoje)} />
            <MetricaMini icon={TrendingUp} label="Pipeline ativo" valor={String(v.pipeline.ativo)} sub={formatarMoeda(v.pipeline.valor_potencial)} />
            <MetricaMini icon={Trophy} label="Conversao" valor={`${v.pipeline.taxa_conversao}%`} sub="ultimos 90 dias" />
            <MetricaMini icon={ListTodo} label="Tarefas pend." valor={String(v.tarefas.pendentes)} cor={v.tarefas.vencidas > 0 ? 'text-red-600' : undefined} />
            <MetricaMini icon={Clock} label="Ponto hoje" valor={formatarMinutos(v.minutos_ponto_hoje)} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricaMini({ icon: Icon, label, valor, sub, cor }: {
  icon: any; label: string; valor: string; sub?: string; cor?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon size={14} className="text-alisson-600" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${cor || 'text-gray-800'}`}>{valor}</p>
        <p className="text-[11px] text-gray-400 truncate">{label}</p>
        {sub && <p className="text-[10px] text-gray-300">{sub}</p>}
      </div>
    </div>
  );
}

function TarefaItem({ t, onConcluir }: { t: TarefaEquipe; onConcluir: (id: number) => void }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      t.dias_atraso > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'
    }`}>
      <button
        onClick={() => onConcluir(t.id)}
        className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 hover:bg-green-50 hover:border-green-400 transition-colors border-gray-300"
      >
        {t.status === 'concluida' && <CheckCircle size={14} className="text-green-500" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${t.status === 'concluida' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {t.titulo}
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORIDADE_COR[t.prioridade] || ''}`}>
            {PRIORIDADE_LABEL[t.prioridade] || t.prioridade}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {t.vendedor_nome && (
            <span className="text-xs text-gray-400">{t.vendedor_nome}</span>
          )}
          {t.cliente_nome && (
            <span className="text-xs text-gray-300">• {t.cliente_nome}</span>
          )}
        </div>
      </div>

      {t.dias_atraso > 0 ? (
        <div className="flex items-center gap-1 text-red-500 flex-shrink-0">
          <AlertTriangle size={14} />
          <span className="text-xs font-bold">{t.dias_atraso}d atrasada</span>
        </div>
      ) : t.data_vencimento ? (
        <span className="text-xs text-gray-400 flex-shrink-0">
          {new Date(t.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </span>
      ) : null}
    </div>
  );
}

function ResumoEquipeCard({ dados }: { dados: ResumoEquipe[] }) {
  if (dados.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Users size={18} />
        Resumo por Pessoa
      </h3>
      <div className="space-y-2">
        {dados.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-alisson-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{p.nome.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{p.nome}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {p.vencidas > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">
                  {p.vencidas} atrasadas
                </span>
              )}
              <span className="text-gray-400">{p.pendentes} pend.</span>
              <span className="text-green-600">{p.concluidas_semana} feitas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Pagina Principal ===

export default function Equipe() {
  const [aba, setAba] = useState<'vendedoras' | 'tarefas'>('vendedoras');
  const [periodo, setPeriodo] = useState('mes');
  const [vendedoras, setVendedoras] = useState<VendedoraPerformance[]>([]);
  const [tarefas, setTarefas] = useState<TarefaEquipe[]>([]);
  const [resumoEquipe, setResumoEquipe] = useState<ResumoEquipe[]>([]);
  const [filtroTarefa, setFiltroTarefa] = useState('vencidas');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregarVendedoras = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/performance/vendedoras', { params: { periodo } });
      setVendedoras(data);
    } catch { setVendedoras([]); }
    finally { setCarregando(false); }
  }, [periodo]);

  const carregarTarefas = useCallback(async () => {
    setCarregando(true);
    try {
      const params: any = { periodo: filtroTarefa };
      if (filtroUsuario) params.usuario_id = filtroUsuario;
      const { data } = await api.get('/performance/tarefas-equipe', { params });
      setTarefas(data.tarefas);
      setResumoEquipe(data.resumo_equipe);
    } catch { setTarefas([]); setResumoEquipe([]); }
    finally { setCarregando(false); }
  }, [filtroTarefa, filtroUsuario]);

  useEffect(() => {
    if (aba === 'vendedoras') carregarVendedoras();
    else carregarTarefas();
  }, [aba, carregarVendedoras, carregarTarefas]);

  const concluirTarefa = async (id: number) => {
    try {
      await api.post(`/tarefas/${id}/concluir`);
      carregarTarefas();
    } catch {}
  };

  // Totais rapidos
  const totalVendasMes = vendedoras.reduce((s, v) => s + v.vendas.mes_valor, 0);
  const totalVencidas = resumoEquipe.reduce((s, p) => s + p.vencidas, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-alisson-600" />
          <h1 className="text-2xl font-bold text-gray-800">Equipe</h1>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setAba('vendedoras')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            aba === 'vendedoras' ? 'bg-white text-alisson-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Trophy size={16} />
          Performance Vendedoras
        </button>
        <button
          onClick={() => setAba('tarefas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            aba === 'tarefas' ? 'bg-white text-alisson-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListTodo size={16} />
          Tarefas da Equipe
          {totalVencidas > 0 && aba !== 'tarefas' && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">{totalVencidas}</span>
          )}
        </button>
      </div>

      {/* Loading */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-alisson-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : aba === 'vendedoras' ? (
        /* === ABA VENDEDORAS === */
        <div className="space-y-4">
          {/* Filtro periodo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-alisson-600">{formatarMoeda(totalVendasMes)}</span> vendidos este mes por{' '}
                <span className="font-bold">{vendedoras.length}</span> vendedoras
              </p>
            </div>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="text-sm border rounded-lg px-3 py-1.5 text-gray-600 focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500"
            >
              <option value="semana">Esta semana</option>
              <option value="mes">Este mes</option>
              <option value="trimestre">Trimestre</option>
            </select>
          </div>

          {/* Ranking */}
          {vendedoras.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Trophy size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma vendedora cadastrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vendedoras.map((v, i) => (
                <CardVendedora key={v.id} v={v} posicao={i + 1} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* === ABA TAREFAS === */
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {[
                { v: 'vencidas', l: 'Atrasadas', cor: 'text-red-600' },
                { v: 'hoje', l: 'Hoje' },
                { v: 'semana', l: 'Semana' },
                { v: 'todas', l: 'Todas' },
              ].map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFiltroTarefa(f.v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filtroTarefa === f.v
                      ? `bg-white shadow-sm ${f.cor || 'text-gray-800'}`
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>

            {resumoEquipe.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="text-sm border rounded-lg px-2 py-1.5 text-gray-600"
                >
                  <option value="">Todos</option>
                  {resumoEquipe.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lista de tarefas */}
            <div className="lg:col-span-2 space-y-2">
              {tarefas.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
                  <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma tarefa encontrada</p>
                  <p className="text-sm mt-1">
                    {filtroTarefa === 'vencidas' ? 'Otimo! Nenhuma tarefa atrasada' : 'Sem tarefas para este filtro'}
                  </p>
                </div>
              ) : (
                tarefas.map((t) => (
                  <TarefaItem key={t.id} t={t} onConcluir={concluirTarefa} />
                ))
              )}
            </div>

            {/* Resumo lateral */}
            <div>
              <ResumoEquipeCard dados={resumoEquipe} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
