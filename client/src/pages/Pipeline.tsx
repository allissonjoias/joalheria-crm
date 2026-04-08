import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, DollarSign, User, Trash2, Settings, CheckSquare, Clock, History, ChevronDown, ChevronUp, X, AlertTriangle, Bot, ShoppingBag, CreditCard, Truck, Package, RefreshCw, Sparkles, Heart, ShieldCheck, TrendingUp, TrendingDown, Target, Eye, ArrowRight, LayoutGrid, Filter } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';
import api from '../services/api';

interface Estagio {
  id: number;
  nome: string;
  cor: string;
  ordem: number;
  tipo: string;
  funil_id: number;
  fase?: string;
}

interface Odv {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  vendedor_nome?: string;
  titulo: string;
  valor: number;
  estagio: string;
  produto_interesse?: string;
  notas?: string;
  criado_em?: string;
  funil_id?: number;
  motivo_perda?: string;
  origem_lead?: string;
  // Campos auto-preenchidos pela IA
  tipo_pedido?: string;
  itens_pedido?: string;
  desconto?: string;
  parcelas?: number;
  forma_pagamento?: string;
  valor_frete?: number;
  endereco_entrega?: string;
  data_prevista_entrega?: string;
  observacao_pedido?: string;
  forma_atendimento?: string;
  tipo_cliente?: string;
  campos_ia?: string; // JSON array de campos preenchidos pela IA
  venda_registrada?: number; // 1 se venda ja foi criada na tabela vendas
  data_venda?: string;
  pagamento_status?: string;
  pagamento_valor?: number;
}

interface BrechaItem {
  id: string;
  pipeline_id?: string;
  cliente_id?: string;
  tipo: string;
  descricao: string;
  acao_tomada: string;
  cliente_nome?: string;
  odv_titulo?: string;
  estagio?: string;
  valor?: number;
  criado_em: string;
}

interface Tarefa {
  id: number;
  pipeline_id?: string;
  cliente_id?: string;
  cliente_nome?: string;
  odv_titulo?: string;
  vendedor_nome?: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  prioridade: string;
  status: string;
  data_vencimento?: string;
  concluida_em?: string;
}

interface HistoricoItem {
  id: number;
  estagio_anterior?: string;
  estagio_novo: string;
  usuario_nome?: string;
  criado_em: string;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const CORES_DISPONIVEIS = [
  '#9ca3af', '#60a5fa', '#fbbf24', '#f97316', '#22c55e', '#a855f7',
  '#ef4444', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f43f5e',
];

const PRIORIDADE_CORES: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};

export default function Pipeline() {
  const [odvs, setOdvs] = useState<Odv[]>([]);
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [motivosPerda, setMotivosPerda] = useState<{ id: number; nome: string }[]>([]);
  const [visao, setVisao] = useState<'kanban' | 'funil'>('kanban');
  const [origensLead, setOrigensLead] = useState<{ id: number; nome: string }[]>([]);

  // Modal motivo de perda
  const [modalMotivo, setModalMotivo] = useState<string | null>(null);
  const [motivoSelecionado, setMotivoSelecionado] = useState('');

  // Modal estorno (pos-venda)
  const [modalEstorno, setModalEstorno] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');

  // Modais
  const [modalOdv, setModalOdv] = useState(false);
  const [modalTarefa, setModalTarefa] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalHistorico, setModalHistorico] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  // Painel lateral
  const [painelTarefas, setPainelTarefas] = useState(false);

  // Forms
  const [formOdv, setFormOdv] = useState({ cliente_id: '', titulo: '', valor: '', produto_interesse: '', notas: '', origem_lead: '' });
  const [formTarefa, setFormTarefa] = useState({ pipeline_id: '', cliente_id: '', titulo: '', descricao: '', tipo: 'geral', prioridade: 'media', data_vencimento: '' });
  const [formEstagio, setFormEstagio] = useState({ nome: '', cor: '#6b7280', tipo: 'aberto' });

  // Stats tarefas
  const [tarefaStats, setTarefaStats] = useState({ total: 0, pendentes: 0, vencidas: 0, concluidas: 0, em_andamento: 0 });

  // Brechas
  const [brechas, setBrechas] = useState<BrechaItem[]>([]);
  const [mostrarBrechas, setMostrarBrechas] = useState(false);

  useEffect(() => {
    api.get('/funil/motivos-perda').then(({ data }) => setMotivosPerda(data)).catch(() => {});
    api.get('/funil/origens-lead').then(({ data }) => setOrigensLead(data)).catch(() => {});
    carregar();
  }, []);

  const carregar = async () => {
    try {
      const [odvsRes, estagiosRes, clientesRes, tarefasRes, statsRes, brechasRes] = await Promise.all([
        api.get('/pipeline', { params: { funil_id: 1 } }),
        api.get('/funil/estagios', { params: { funil_id: 1 } }),
        api.get('/clientes'),
        api.get('/tarefas?limite=50'),
        api.get('/tarefas/estatisticas'),
        api.get('/brechas').catch(() => ({ data: [] })),
      ]);
      setOdvs(odvsRes.data);
      setEstagios(estagiosRes.data);
      setClientes(clientesRes.data);
      setTarefas(tarefasRes.data);
      setTarefaStats(statsRes.data);
      setBrechas(brechasRes.data);
    } catch (e) {
      console.error('Erro ao carregar pipeline:', e);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const odvId = result.draggableId;
    const novoEstagio = result.destination.droppableId;

    // Verificar se o estagio destino e do tipo 'perdido' -> pedir motivo
    const estagioDestino = estagios.find(e => e.nome === novoEstagio);
    if (estagioDestino?.tipo === 'perdido') {
      // Guardar estagio destino temporariamente
      setOdvs(prev => prev.map(d => d.id === odvId ? { ...d, _estagioDestino: novoEstagio } as any : d));

      // Se e pos-venda, mostrar modal de estorno
      if (estagioDestino.fase === 'pos_venda') {
        setModalEstorno(odvId);
        setMotivoEstorno('');
        return;
      }

      // Perda normal
      setModalMotivo(odvId);
      setMotivoSelecionado('');
      return;
    }

    setOdvs(prev => prev.map(d => d.id === odvId ? { ...d, estagio: novoEstagio } : d));

    try {
      await api.put(`/pipeline/${odvId}`, { estagio: novoEstagio });
      // Recarregar para refletir auto-transicoes do ciclo de vida
      // (ex: Vendido -> auto-move para Preparando Pedido)
      setTimeout(() => carregar(), 500);
    } catch {
      carregar();
    }
  };

  const handleConfirmarPerda = async () => {
    if (!modalMotivo) return;
    const odv = odvs.find(d => d.id === modalMotivo) as any;
    const estagioDestino = odv?._estagioDestino || estagios.find(e => e.tipo === 'perdido')?.nome || 'Perdido';

    try {
      await api.put(`/pipeline/${modalMotivo}`, {
        estagio: estagioDestino,
        motivo_perda: motivoSelecionado || 'Outro',
      });
    } catch {}

    setModalMotivo(null);
    setMotivoSelecionado('');
    carregar();
  };

  const handleConfirmarEstorno = async () => {
    if (!modalEstorno) return;
    const odv = odvs.find(d => d.id === modalEstorno) as any;
    const estagioDestino = odv?._estagioDestino || 'Cancelado/Devolvido';

    try {
      await api.put(`/pipeline/${modalEstorno}`, {
        estagio: estagioDestino,
        motivo_perda: motivoEstorno || 'Estorno solicitado',
      });
    } catch {}

    setModalEstorno(null);
    setMotivoEstorno('');
    carregar();
  };

  const handleCriarOdv = async () => {
    try {
      await api.post('/pipeline', {
        ...formOdv,
        valor: formOdv.valor ? parseFloat(formOdv.valor) : null,
        estagio: estagios[0]?.nome || 'Lead',
        funil_id: 1,
      });
      setModalOdv(false);
      setFormOdv({ cliente_id: '', titulo: '', valor: '', produto_interesse: '', notas: '', origem_lead: '' });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar ODV');
    }
  };

  const handleExcluirOdv = async (id: string) => {
    if (!confirm('Excluir esta oportunidade de venda?')) return;
    await api.delete(`/pipeline/${id}`);
    carregar();
  };

  const handleVerHistorico = async (odvId: string) => {
    const { data } = await api.get(`/pipeline/${odvId}/historico`);
    setHistorico(data);
    setModalHistorico(odvId);
  };

  // Tarefas
  const handleCriarTarefa = async () => {
    try {
      await api.post('/tarefas', formTarefa);
      setModalTarefa(false);
      setFormTarefa({ pipeline_id: '', cliente_id: '', titulo: '', descricao: '', tipo: 'geral', prioridade: 'media', data_vencimento: '' });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar tarefa');
    }
  };

  const handleConcluirTarefa = async (id: number) => {
    await api.post(`/tarefas/${id}/concluir`);
    carregar();
  };

  const handleExcluirTarefa = async (id: number) => {
    await api.delete(`/tarefas/${id}`);
    carregar();
  };

  // Estagios
  const handleCriarEstagio = async () => {
    if (!formEstagio.nome) return;
    await api.post('/funil/estagios', { ...formEstagio, funil_id: 1 });
    setFormEstagio({ nome: '', cor: '#6b7280', tipo: 'aberto' });
    carregar();
  };

  const handleExcluirEstagio = async (id: number) => {
    try {
      await api.delete(`/funil/estagios/${id}`);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao excluir estagio');
    }
  };

  const tarefasPendentes = tarefas.filter(t => t.status === 'pendente' || t.status === 'em_andamento');
  const tarefasDaOdv = (odvId: string) => tarefas.filter(t => t.pipeline_id === odvId && t.status !== 'concluida' && t.status !== 'cancelada');

  // Agrupar estagios por fase para separadores visuais
  const FASE_CONFIG: Record<string, { label: string; cor: string; icone: any }> = {
    venda: { label: 'Venda', cor: 'alisson', icone: DollarSign },
    pos_venda: { label: 'Pos-Venda', cor: 'violet', icone: Truck },
    nutricao: { label: 'Nutricao', cor: 'amber', icone: Heart },
    recompra: { label: 'Recompra', cor: 'pink', icone: RefreshCw },
  };

  // Detectar fases unicas presentes (na ordem)
  const fasesPresentes: string[] = [];
  for (const e of estagios) {
    const fase = e.fase || 'venda';
    if (!fasesPresentes.includes(fase)) fasesPresentes.push(fase);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-lg md:text-2xl font-bold text-gray-800">Funil</h1>
          {/* Toggle Kanban / Funil */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setVisao('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                visao === 'kanban' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button
              onClick={() => setVisao('funil')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                visao === 'funil' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Filter size={14} /> Funil
            </button>
          </div>
          {tarefaStats.vencidas > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
              <AlertTriangle size={12} /> {tarefaStats.vencidas} vencida{tarefaStats.vencidas > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          {brechas.length > 0 && (
            <Tooltip texto="Ver brechas detectadas no funil - leads que precisam de atencao" posicao="bottom">
              <Button variante="secundario" tamanho="sm" onClick={() => setMostrarBrechas(!mostrarBrechas)} className="border-orange-200 text-orange-600 hover:bg-orange-50">
                <AlertTriangle size={14} /> <span className="hidden sm:inline">Brechas</span> ({brechas.length})
              </Button>
            </Tooltip>
          )}
          <Tooltip texto="Abrir painel lateral com tarefas pendentes e vencidas" posicao="bottom">
            <Button variante="secundario" tamanho="sm" onClick={() => setPainelTarefas(!painelTarefas)}>
              <CheckSquare size={14} /> <span className="hidden sm:inline">Tarefas</span> ({tarefaStats.pendentes})
            </Button>
          </Tooltip>
          <Tooltip texto="Configurar estagios do funil" posicao="bottom">
            <Button variante="secundario" tamanho="sm" onClick={() => setModalConfig(true)}>
              <Settings size={14} />
            </Button>
          </Tooltip>
          <Tooltip texto="Criar tarefa" posicao="bottom">
            <Button tamanho="sm" onClick={() => setModalTarefa(true)}>
              <Plus size={14} /> <span className="hidden sm:inline">Tarefa</span>
            </Button>
          </Tooltip>
          <Tooltip texto="Nova ODV" posicao="bottom">
            <Button tamanho="sm" onClick={() => setModalOdv(true)}>
              <Plus size={14} /> <span className="hidden sm:inline">Nova</span> ODV
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Visao Kanban */}
      {visao === 'kanban' && (
        <div className="flex gap-4 flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-3 h-full pb-4 snap-x snap-mandatory md:snap-none overflow-x-auto md:overflow-x-visible">
                {estagios.map((estagio, idx) => {
                  const estagioOdvs = odvs.filter(d => d.estagio === estagio.nome);
                  const valorTotal = estagioOdvs.reduce((acc, d) => acc + (d.valor || 0), 0);
                  const fase = estagio.fase || 'venda';
                  const faseAnterior = idx > 0 ? (estagios[idx - 1].fase || 'venda') : null;
                  const mostrarSeparador = fasesPresentes.length > 1 && faseAnterior !== null && faseAnterior !== fase;
                  const faseConfig = FASE_CONFIG[fase];

                  return (
                    <div key={estagio.nome} className="flex-shrink-0 flex">
                      {mostrarSeparador && faseConfig && (
                        <div className="flex flex-col items-center justify-start mr-3 pt-1">
                          <div className={`w-8 h-8 rounded-full bg-${faseConfig.cor}-100 flex items-center justify-center mb-1`}>
                            <faseConfig.icone size={14} className={`text-${faseConfig.cor}-600`} />
                          </div>
                          <div className={`writing-mode-vertical text-[10px] font-bold text-${faseConfig.cor}-500 uppercase tracking-wider whitespace-nowrap`}
                            style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}>
                            {faseConfig.label}
                          </div>
                          <div className={`flex-1 w-px bg-${faseConfig.cor}-200 mt-1`} />
                        </div>
                      )}
                      <div className="w-[80vw] md:w-72 flex-shrink-0 snap-center flex flex-col">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: estagio.cor }} />
                          <h3 className="font-semibold text-gray-700 text-sm">{estagio.nome}</h3>
                          <span className="text-xs text-gray-400 ml-auto">{estagioOdvs.length}</span>
                        </div>
                        <p className="text-xs text-gray-500">{formatarMoeda(valorTotal)}</p>
                      </div>

                      <Droppable droppableId={estagio.nome}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 min-h-[120px] rounded-xl p-2 space-y-2 transition-colors overflow-y-auto ${snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-gray-50'}`}
                          >
                            {estagioOdvs.map((odv, index) => {
                              const odvTarefas = tarefasDaOdv(odv.id);
                              return (
                                <Draggable key={odv.id} draggableId={odv.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-white rounded-lg p-3 border border-gray-100 shadow-sm cursor-grab ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''}`}
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <h4 className="text-sm font-medium text-gray-800 flex-1">{odv.titulo}</h4>
                                        <div className="flex gap-1">
                                          <Tooltip texto="Ver historico de movimentacao desta ODV entre estagios" posicao="left">
                                            <button onClick={() => handleVerHistorico(odv.id)} className="p-0.5 hover:bg-gray-100 rounded">
                                              <History size={12} className="text-gray-400" />
                                            </button>
                                          </Tooltip>
                                          <Tooltip texto="Excluir esta ODV permanentemente" posicao="left">
                                            <button onClick={() => handleExcluirOdv(odv.id)} className="p-0.5 hover:bg-red-50 rounded">
                                              <Trash2 size={12} className="text-gray-300" />
                                            </button>
                                          </Tooltip>
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                                        <User size={12} /> {odv.cliente_nome}
                                      </p>
                                      {odv.valor > 0 && (
                                        <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                                          <DollarSign size={14} /> {formatarMoeda(odv.valor)}
                                        </p>
                                      )}
                                      {!!odv.venda_registrada && (
                                        <div className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-md w-fit">
                                          <ShieldCheck size={11} className="text-green-600" />
                                          <span className="text-[10px] font-semibold text-green-700">Venda registrada</span>
                                        </div>
                                      )}
                                      {odv.pagamento_status && (
                                        <div className={`flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md w-fit ${
                                          odv.pagamento_status === 'approved' ? 'bg-emerald-50 border border-emerald-200' :
                                          odv.pagamento_status === 'pending' ? 'bg-yellow-50 border border-yellow-200' :
                                          'bg-red-50 border border-red-200'
                                        }`}>
                                          <CreditCard size={11} className={
                                            odv.pagamento_status === 'approved' ? 'text-emerald-600' :
                                            odv.pagamento_status === 'pending' ? 'text-yellow-600' :
                                            'text-red-600'
                                          } />
                                          <span className={`text-[10px] font-semibold ${
                                            odv.pagamento_status === 'approved' ? 'text-emerald-700' :
                                            odv.pagamento_status === 'pending' ? 'text-yellow-700' :
                                            'text-red-700'
                                          }`}>
                                            {odv.pagamento_status === 'approved' ? 'Pago' :
                                             odv.pagamento_status === 'pending' ? 'Pgto pendente' :
                                             'Pgto ' + odv.pagamento_status}
                                            {odv.pagamento_valor ? ` R$ ${odv.pagamento_valor.toFixed(2).replace('.', ',')}` : ''}
                                          </span>
                                        </div>
                                      )}
                                      {brechas.some(b => b.pipeline_id === odv.id) && (
                                        <div className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-orange-50 border border-orange-200 rounded-md w-fit">
                                          <AlertTriangle size={11} className="text-orange-500" />
                                          <span className="text-[10px] font-semibold text-orange-600">
                                            {brechas.filter(b => b.pipeline_id === odv.id).length} brecha{brechas.filter(b => b.pipeline_id === odv.id).length > 1 ? 's' : ''}
                                          </span>
                                        </div>
                                      )}
                                      {odv.produto_interesse && (
                                        <p className="text-xs text-gray-400 mt-1">{odv.produto_interesse}</p>
                                      )}
                                      {(() => {
                                        const camposIa: string[] = (() => { try { return JSON.parse(odv.campos_ia || '[]'); } catch { return []; } })();
                                        const itens: string[] = (() => { try { return JSON.parse(odv.itens_pedido || '[]'); } catch { return []; } })();
                                        const temDadosIa = camposIa.length > 0;
                                        if (!temDadosIa) return null;
                                        return (
                                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center gap-0.5">
                                                <Bot size={9} /> IA
                                              </span>
                                              {itens.length > 0 && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-0.5">
                                                  <Package size={9} /> {itens.map(i => i.replace(/_/g, ' ')).join(', ')}
                                                </span>
                                              )}
                                              {odv.parcelas && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">
                                                  {odv.parcelas}x
                                                </span>
                                              )}
                                              {odv.forma_pagamento && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-0.5">
                                                  <CreditCard size={9} /> {odv.forma_pagamento}
                                                </span>
                                              )}
                                              {odv.forma_atendimento && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                  {odv.forma_atendimento}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      {odvTarefas.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                          <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <CheckSquare size={10} /> {odvTarefas.length} tarefa{odvTarefas.length > 1 ? 's' : ''}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
          </div>

          {/* Painel lateral de tarefas */}
          {painelTarefas && (
            <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Tarefas Pendentes</h3>
                <Tooltip texto="Fechar painel de tarefas" posicao="left">
                  <button onClick={() => setPainelTarefas(false)}><X size={16} className="text-gray-400" /></button>
                </Tooltip>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-yellow-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-yellow-600">{tarefaStats.pendentes}</p>
                  <p className="text-xs text-gray-500">Pendentes</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-red-600">{tarefaStats.vencidas}</p>
                  <p className="text-xs text-gray-500">Vencidas</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{tarefaStats.concluidas}</p>
                  <p className="text-xs text-gray-500">Feitas</p>
                </div>
              </div>

              <div className="space-y-2">
                {tarefasPendentes.map(t => (
                  <div key={t.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-gray-800">{t.titulo}</p>
                      <Tooltip texto="Marcar tarefa como concluida" posicao="left">
                        <button onClick={() => handleConcluirTarefa(t.id)} className="p-0.5 hover:bg-green-100 rounded">
                          <CheckSquare size={14} className="text-green-500" />
                        </button>
                      </Tooltip>
                    </div>
                    {t.odv_titulo && <p className="text-xs text-gray-500">ODV: {t.odv_titulo}</p>}
                    {t.cliente_nome && <p className="text-xs text-gray-500">Cliente: {t.cliente_nome}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORIDADE_CORES[t.prioridade]}`}>{t.prioridade}</span>
                      {t.data_vencimento && (
                        <span className={`text-xs flex items-center gap-1 ${new Date(t.data_vencimento) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                          <Clock size={10} /> {formatarData(t.data_vencimento)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {tarefasPendentes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhuma tarefa pendente</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Brechas */}
      {mostrarBrechas && (
        <Modal aberto={true} onFechar={() => setMostrarBrechas(false)} titulo="Brechas no Funil" largura="max-w-2xl">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {brechas.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Nenhuma brecha detectada. Tudo fluindo bem!</p>
            )}
            {brechas.map(b => {
              const tipoCores: Record<string, string> = {
                inatividade: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                sem_followup: 'bg-orange-50 border-orange-200 text-orange-700',
                opt_out: 'bg-red-50 border-red-200 text-red-700',
                problema: 'bg-red-50 border-red-200 text-red-700',
                reengajamento: 'bg-blue-50 border-blue-200 text-blue-700',
                pagamento_pendente: 'bg-purple-50 border-purple-200 text-purple-700',
              };
              const tipoLabels: Record<string, string> = {
                inatividade: 'Inatividade',
                sem_followup: 'Sem follow-up',
                opt_out: 'Opt-out',
                problema: 'Problema',
                reengajamento: 'Reengajamento',
                pagamento_pendente: 'Pgto pendente',
              };
              return (
                <div key={b.id} className={`p-3 rounded-lg border ${tipoCores[b.tipo] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/60">
                          {tipoLabels[b.tipo] || b.tipo}
                        </span>
                        {b.odv_titulo && <span className="text-xs opacity-75">{b.odv_titulo}</span>}
                      </div>
                      <p className="text-sm">{b.descricao}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {b.cliente_nome && <span className="text-xs opacity-60"><User size={10} className="inline mr-0.5" />{b.cliente_nome}</span>}
                        {b.estagio && <span className="text-xs opacity-60">{b.estagio}</span>}
                        <span className="text-xs opacity-50">{b.criado_em?.substring(0, 16)}</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await api.put(`/brechas/${b.id}/resolver`);
                        setBrechas(prev => prev.filter(x => x.id !== b.id));
                      }}
                      className="p-1 hover:bg-white/50 rounded text-xs font-medium opacity-60 hover:opacity-100"
                      title="Marcar como resolvida"
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 pt-3 border-t border-gray-100">
            <Button variante="secundario" tamanho="sm" onClick={async () => {
              const { data } = await api.post('/brechas/detectar');
              if (data.recentes) setBrechas(data.recentes);
            }}>
              <RefreshCw size={14} /> Escanear agora
            </Button>
            <Button variante="secundario" tamanho="sm" onClick={() => setMostrarBrechas(false)}>Fechar</Button>
          </div>
        </Modal>
      )}

      {/* Visao Funil */}
      {visao === 'funil' && (() => {
        const totalOdvs = odvs.length;
        const valorTotalGeral = odvs.reduce((acc, o) => acc + (o.valor || 0), 0);
        const ticketMedioGeral = totalOdvs > 0 ? valorTotalGeral / totalOdvs : 0;

        const estagioStats = estagios.map(e => {
          const odvsEst = odvs.filter(o => o.estagio === e.nome);
          const qtd = odvsEst.length;
          const val = odvsEst.reduce((acc, o) => acc + (o.valor || 0), 0);
          return { ...e, quantidade: qtd, valor: val, ticketMedio: qtd > 0 ? val / qtd : 0, conversao: totalOdvs > 0 ? (qtd / totalOdvs) * 100 : 0 };
        });

        const ganhos = estagioStats.filter(s => s.tipo === 'ganho');
        const perdidos = estagioStats.filter(s => s.tipo === 'perdido');
        const totalGanhos = ganhos.reduce((a, s) => a + s.quantidade, 0);
        const valorGanho = ganhos.reduce((a, s) => a + s.valor, 0);
        const totalPerdidos = perdidos.reduce((a, s) => a + s.quantidade, 0);
        const totalAbertos = estagioStats.filter(s => s.tipo === 'aberto').reduce((a, s) => a + s.quantidade, 0);
        const valorAberto = estagioStats.filter(s => s.tipo === 'aberto').reduce((a, s) => a + s.valor, 0);
        const taxaConversao = totalOdvs > 0 ? (totalGanhos / totalOdvs) * 100 : 0;
        const maxQtd = Math.max(...estagioStats.map(s => s.quantidade), 1);

        // Motivos de perda
        const motivosPerdaMap: Record<string, number> = {};
        odvs.filter(o => estagios.find(e => e.nome === o.estagio)?.tipo === 'perdido').forEach(o => {
          const motivo = o.motivo_perda || 'Nao informado';
          motivosPerdaMap[motivo] = (motivosPerdaMap[motivo] || 0) + 1;
        });
        const motivosOrdenados = Object.entries(motivosPerdaMap).sort((a, b) => b[1] - a[1]);

        return (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Cards de metricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Eye size={16} className="text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-500">Total ODVs</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{totalOdvs}</p>
                <p className="text-xs text-gray-400 mt-1">{totalAbertos} em aberto</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign size={16} className="text-green-600" />
                  </div>
                  <span className="text-sm text-gray-500">Valor Total</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{formatarMoeda(valorTotalGeral)}</p>
                <p className="text-xs text-green-600 mt-1">{formatarMoeda(valorGanho)} ganho</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Target size={16} className="text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-500">Taxa de Conversao</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{taxaConversao.toFixed(1)}%</p>
                <p className="text-xs text-gray-400 mt-1">{totalGanhos} ganho{totalGanhos !== 1 ? 's' : ''} de {totalOdvs}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <TrendingUp size={16} className="text-amber-600" />
                  </div>
                  <span className="text-sm text-gray-500">Ticket Medio</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{formatarMoeda(ticketMedioGeral)}</p>
                <p className="text-xs text-red-500 mt-1">{totalPerdidos} perdido{totalPerdidos !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Funil visual */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-6">Visualizacao do Funil</h2>
                <div className="space-y-2">
                  {estagioStats.filter(s => s.tipo !== 'perdido').map((est, idx, arr) => {
                    const widthPercent = maxQtd > 0 ? Math.max((est.quantidade / maxQtd) * 100, 15) : 15;
                    const nextEst = arr[idx + 1];
                    const taxaEntre = nextEst && est.quantidade > 0
                      ? ((nextEst.quantidade / est.quantidade) * 100).toFixed(0)
                      : null;

                    return (
                      <div key={est.nome}>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 relative">
                            <div
                              className="rounded-lg py-3 px-4 flex items-center justify-between transition-all duration-300 mx-auto"
                              style={{
                                backgroundColor: est.cor + '20',
                                borderLeft: `4px solid ${est.cor}`,
                                width: `${widthPercent}%`,
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: est.cor }} />
                                <span className="text-sm font-medium text-gray-800 truncate">{est.nome}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 flex-shrink-0 w-72">
                            <div className="text-right w-16">
                              <p className="text-lg font-bold text-gray-800">{est.quantidade}</p>
                              <p className="text-[10px] text-gray-400">ODVs</p>
                            </div>
                            <div className="text-right w-28">
                              <p className="text-sm font-semibold text-gray-700">{formatarMoeda(est.valor)}</p>
                              <p className="text-[10px] text-gray-400">valor total</p>
                            </div>
                            <div className="text-right w-16">
                              <p className="text-sm font-semibold" style={{ color: est.cor }}>{est.conversao.toFixed(0)}%</p>
                              <p className="text-[10px] text-gray-400">do total</p>
                            </div>
                          </div>
                        </div>
                        {taxaEntre && (
                          <div className="flex items-center gap-2 py-1 pl-8">
                            <ArrowRight size={12} className="text-gray-300" />
                            <span className={`text-xs font-medium ${
                              Number(taxaEntre) >= 50 ? 'text-green-600' : Number(taxaEntre) >= 25 ? 'text-amber-600' : 'text-red-500'
                            }`}>
                              {taxaEntre}% avancam
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Resumo ganhos/perdidos */}
                <div className="flex gap-4 mt-6 pt-4 border-t border-gray-100 flex-wrap">
                  {ganhos.map(g => (
                    <div key={g.nome} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                      <TrendingUp size={14} className="text-green-600" />
                      <div>
                        <p className="text-xs font-medium text-green-800">{g.nome}</p>
                        <p className="text-sm font-bold text-green-700">{g.quantidade} ({formatarMoeda(g.valor)})</p>
                      </div>
                    </div>
                  ))}
                  {perdidos.map(p => (
                    <div key={p.nome} className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                      <TrendingDown size={14} className="text-red-600" />
                      <div>
                        <p className="text-xs font-medium text-red-800">{p.nome}</p>
                        <p className="text-sm font-bold text-red-700">{p.quantidade} ({formatarMoeda(p.valor)})</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Painel lateral */}
              <div className="space-y-6">
                {/* Motivos de perda */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Motivos de Perda</h3>
                  {motivosOrdenados.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma perda registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {motivosOrdenados.slice(0, 6).map(([motivo, qtd]) => {
                        const maxMotivo = motivosOrdenados[0][1];
                        const percent = (qtd / maxMotivo) * 100;
                        return (
                          <div key={motivo}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 truncate flex-1">{motivo}</span>
                              <span className="text-xs font-bold text-gray-800 ml-2">{qtd}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Detalhamento por estagio */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Detalhamento por Estagio</h3>
                  <div className="space-y-2">
                    {estagioStats.map(s => (
                      <div key={s.nome} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.cor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{s.nome}</p>
                          <p className="text-[10px] text-gray-400">{s.quantidade} ODV{s.quantidade !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-700">{formatarMoeda(s.valor)}</p>
                          <p className="text-[10px] text-gray-400">TM: {formatarMoeda(s.ticketMedio)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Nova ODV */}
      <Modal aberto={modalOdv} onFechar={() => setModalOdv(false)} titulo="Nova Oportunidade de Venda">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select value={formOdv.cliente_id} onChange={(e) => setFormOdv({...formOdv, cliente_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Selecionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <Input label="Titulo" value={formOdv.titulo} onChange={(e) => setFormOdv({...formOdv, titulo: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor" type="number" step="0.01" value={formOdv.valor} onChange={(e) => setFormOdv({...formOdv, valor: e.target.value})} />
            <Input label="Produto de Interesse" value={formOdv.produto_interesse} onChange={(e) => setFormOdv({...formOdv, produto_interesse: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem do Lead</label>
            <select value={formOdv.origem_lead} onChange={(e) => setFormOdv({...formOdv, origem_lead: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Selecionar</option>
              {origensLead.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalOdv(false)}>Cancelar</Button>
            <Button onClick={handleCriarOdv}>Criar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Nova Tarefa */}
      <Modal aberto={modalTarefa} onFechar={() => setModalTarefa(false)} titulo="Nova Tarefa">
        <div className="space-y-4">
          <Input label="Titulo" value={formTarefa.titulo} onChange={(e) => setFormTarefa({...formTarefa, titulo: e.target.value})} required />
          <Input label="Descricao" value={formTarefa.descricao} onChange={(e) => setFormTarefa({...formTarefa, descricao: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ODV (opcional)</label>
              <select value={formTarefa.pipeline_id} onChange={(e) => setFormTarefa({...formTarefa, pipeline_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Nenhum</option>
                {odvs.map(d => <option key={d.id} value={d.id}>{d.titulo} - {d.cliente_nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
              <select value={formTarefa.cliente_id} onChange={(e) => setFormTarefa({...formTarefa, cliente_id: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Nenhum</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={formTarefa.tipo} onChange={(e) => setFormTarefa({...formTarefa, tipo: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="geral">Geral</option>
                <option value="primeiro_contato">Primeiro Contato</option>
                <option value="followup">Follow-up</option>
                <option value="pos_venda">Pos-venda</option>
                <option value="ligacao">Ligacao</option>
                <option value="reuniao">Reuniao</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select value={formTarefa.prioridade} onChange={(e) => setFormTarefa({...formTarefa, prioridade: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="baixa">Baixa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <Input label="Vencimento" type="datetime-local" value={formTarefa.data_vencimento} onChange={(e) => setFormTarefa({...formTarefa, data_vencimento: e.target.value})} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variante="secundario" onClick={() => setModalTarefa(false)}>Cancelar</Button>
            <Button onClick={handleCriarTarefa}>Criar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Configurar Estagios */}
      <Modal aberto={modalConfig} onFechar={() => setModalConfig(false)} titulo="Configurar Estagios do Funil">
        <div className="space-y-4">
          <div className="space-y-2">
            {estagios.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: e.cor }} />
                <span className="text-sm font-medium flex-1">{e.nome}</span>
                {e.fase && e.fase !== 'venda' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    e.fase === 'pos_venda' ? 'bg-violet-100 text-violet-600' :
                    e.fase === 'nutricao' ? 'bg-amber-100 text-amber-600' :
                    e.fase === 'recompra' ? 'bg-pink-100 text-pink-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>{FASE_CONFIG[e.fase]?.label || e.fase}</span>
                )}
                <span className="text-xs text-gray-400">{e.tipo}</span>
                <Tooltip texto="Remover este estagio do funil" posicao="left">
                  <button onClick={() => handleExcluirEstagio(e.id)} className="p-1 hover:bg-red-100 rounded">
                    <Trash2 size={14} className="text-gray-400" />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Adicionar Estagio</h4>
            <div className="flex gap-2">
              <Input label="" placeholder="Nome" value={formEstagio.nome} onChange={(e) => setFormEstagio({...formEstagio, nome: e.target.value})} />
              <div>
                <select value={formEstagio.tipo} onChange={(e) => setFormEstagio({...formEstagio, tipo: e.target.value})} className="px-2 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="aberto">Aberto</option>
                  <option value="ganho">Ganho</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>
              <div className="flex gap-1 items-center">
                {CORES_DISPONIVEIS.slice(0, 6).map(cor => (
                  <button key={cor} onClick={() => setFormEstagio({...formEstagio, cor})} className={`w-5 h-5 rounded-full border-2 ${formEstagio.cor === cor ? 'border-gray-800' : 'border-transparent'}`} style={{ backgroundColor: cor }} />
                ))}
              </div>
              <Tooltip texto="Adicionar novo estagio ao funil" posicao="top">
                <Button onClick={handleCriarEstagio}>+</Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Motivo de Perda */}
      <Modal aberto={!!modalMotivo} onFechar={() => { setModalMotivo(null); carregar(); }} titulo="Motivo da Perda">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Por que esta ODV foi perdida?</p>
          <div className="grid grid-cols-2 gap-2">
            {motivosPerda.map(m => (
              <button
                key={m.id}
                onClick={() => setMotivoSelecionado(m.nome)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  motivoSelecionado === m.nome
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {m.nome}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variante="secundario" onClick={() => { setModalMotivo(null); carregar(); }}>Cancelar</Button>
            <Button onClick={handleConfirmarPerda}>Confirmar Perda</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Estorno / Cancelamento Pos-Venda */}
      <Modal aberto={!!modalEstorno} onFechar={() => { setModalEstorno(null); carregar(); }} titulo="Estorno / Cancelamento">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Esta ODV ja tem uma venda registrada</p>
              <p className="text-xs text-red-600 mt-1">
                A venda sera marcada como estornada. Todas as automacoes de nutricao e tarefas pendentes serao canceladas.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo do estorno/cancelamento</label>
            <div className="grid grid-cols-1 gap-2">
              {['Cliente desistiu', 'Produto com defeito', 'Troca solicitada', 'Arrependimento (7 dias)', 'Pagamento nao confirmado', 'Erro no pedido'].map(motivo => (
                <button
                  key={motivo}
                  onClick={() => setMotivoEstorno(motivo)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    motivoEstorno === motivo
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {motivo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Input
              label="Outro motivo (opcional)"
              value={motivoEstorno.startsWith('Outro:') ? motivoEstorno.slice(6) : (
                ['Cliente desistiu', 'Produto com defeito', 'Troca solicitada', 'Arrependimento (7 dias)', 'Pagamento nao confirmado', 'Erro no pedido'].includes(motivoEstorno) ? '' : motivoEstorno
              )}
              onChange={(e) => setMotivoEstorno(e.target.value ? `Outro: ${e.target.value}` : '')}
              placeholder="Descreva o motivo..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variante="secundario" onClick={() => { setModalEstorno(null); carregar(); }}>Cancelar</Button>
            <Button onClick={handleConfirmarEstorno}>
              Confirmar Estorno
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Historico */}
      <Modal aberto={!!modalHistorico} onFechar={() => setModalHistorico(null)} titulo="Historico de Movimentacao">
        <div className="space-y-3">
          {historico.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sem historico</p>}
          {historico.map(h => (
            <div key={h.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <History size={14} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm">
                  {h.estagio_anterior ? (
                    <><span className="text-gray-500">{h.estagio_anterior}</span> <span className="text-gray-400">→</span> <span className="font-medium">{h.estagio_novo}</span></>
                  ) : (
                    <span className="font-medium">Criado em {h.estagio_novo}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  {(h as any).automatico ? <><Bot size={10} className="text-violet-400" /> Automatico</> : (h.usuario_nome || 'Sistema')} - {formatarData(h.criado_em)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
