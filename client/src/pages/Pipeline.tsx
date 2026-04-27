import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, DollarSign, User, Users, Trash2, Settings, CheckSquare, Clock, History, ChevronDown, ChevronUp, X, AlertTriangle, Bot, ShoppingBag, CreditCard, Truck, Package, RefreshCw, Sparkles, Heart, ShieldCheck, TrendingUp, TrendingDown, Target, Eye, ArrowRight, LayoutGrid, Filter, Search, MessageSquare, Instagram, Phone, Flame, Thermometer, Snowflake, Archive, Zap, Bell, FileText, ArrowRightLeft, Edit3, Send, Loader2, Save, Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';
import api from '../services/api';

const ClientesPage = lazy(() => import('./Clientes'));

interface Estagio {
  id: number;
  nome: string;
  cor: string;
  ordem: number;
  tipo: string;
  funil_id: number;
  fase?: string;
  bloco?: string;
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
  venda_registrada?: number;
  data_venda?: string;
  pagamento_status?: string;
  pagamento_valor?: number;
  // Funil V3
  score_bant?: number;
  classificacao?: string;
  canal_origem?: string;
  perfil?: string;
  forma_envio?: string;
  codigo_rastreio?: string;
  opt_out?: number;
  // BANT detalhado (vem do sdr_lead_qualificacao)
  bant_lead_score?: number;
  bant_classificacao?: string;
  bant_budget?: string;
  bant_budget_score?: number;
  bant_authority?: string;
  bant_authority_score?: number;
  bant_need?: string;
  bant_need_score?: number;
  bant_timeline?: string;
  bant_timeline_score?: number;
  bant_bonus_score?: number;
  ocasiao?: string;
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

const CARDS_POR_COLUNA = 30;

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

interface Funil {
  id: number;
  nome: string;
  cor: string;
  ordem: number;
}

export default function Pipeline() {
  const [odvs, setOdvs] = useState<Odv[]>([]);
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [motivosPerda, setMotivosPerda] = useState<{ id: number; nome: string }[]>([]);
  const [visao, setVisao] = useState<'kanban' | 'funil'>('kanban');
  const [funis, setFunis] = useState<Funil[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'funil' | 'clientes'>('funil');
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
  const [clientesCarregados, setClientesCarregados] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalHistorico, setModalHistorico] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  // Automacoes entre etapas
  const [automacoes, setAutomacoes] = useState<any[]>([]);
  const [configTab, setConfigTab] = useState<'etapas' | 'automacoes'>('etapas');
  const [formAuto, setFormAuto] = useState({ gatilho: 'ao_entrar_etapa', estagio_origem: '', estagio_destino: '', tipo_acao: 'mover_estagio', descricao: '', config: {} as any });
  // IA Automacao
  const [iaTexto, setIaTexto] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  const [iaPreview, setIaPreview] = useState<any[]>([]);
  const [iaSalvando, setIaSalvando] = useState<Record<number, boolean>>({});
  // Modal automacao por etapa
  const [modalAutoEtapa, setModalAutoEtapa] = useState<string | null>(null);
  const [autoExpandida, setAutoExpandida] = useState<number | null>(null);
  const [autoEditando, setAutoEditando] = useState<any | null>(null);

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

  // Metricas
  const [metricas, setMetricas] = useState<any>(null);

  // Filtros
  const [filtros, setFiltros] = useState({ busca: '', classificacao: '', canal: '', produto: '' });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Controle de cards expandidos por coluna
  const [colunasExpandidas, setColunasExpandidas] = useState<Record<string, number>>({});

  // Painel lateral do lead
  const [odvSelecionado, setOdvSelecionado] = useState<string | null>(null);
  const [odvDetalhe, setOdvDetalhe] = useState<any>(null);
  const [odvHistoricoDetalhe, setOdvHistoricoDetalhe] = useState<HistoricoItem[]>([]);

  // Carregar apenas estagios na inicializacao (leve)
  useEffect(() => {
    api.get('/funil/estagios', { params: { funil_id: 10 } }).then(({ data }) => setEstagios(data)).catch(() => {});
    api.get('/funil/funis').then(({ data }) => setFunis(data)).catch(() => {});
    carregarAutomacoes();
  }, []);

  // Carregar ODVs e dados pesados so quando aba funil estiver ativa
  useEffect(() => {
    if (abaAtiva === 'funil') carregar(10);
  }, [abaAtiva]);

  const carregar = async (funilId: number) => {
    try {
      const [odvsRes, tarefasRes, statsRes, brechasRes, metricasRes] = await Promise.all([
        api.get('/pipeline', { params: { funil_id: funilId } }),
        api.get('/tarefas?limite=50'),
        api.get('/tarefas/estatisticas'),
        api.get('/brechas').catch(() => ({ data: [] })),
        api.get('/pipeline/metricas', { params: { funil_id: funilId } }).catch(() => ({ data: null })),
      ]);
      setOdvs(odvsRes.data);
      setTarefas(tarefasRes.data);
      setTarefaStats(statsRes.data);
      setBrechas(brechasRes.data);
      setMetricas(metricasRes.data);
    } catch (e) {
      console.error('Erro ao carregar pipeline:', e);
    }
  };

  const carregarClientes = async () => {
    if (clientesCarregados) return;
    try {
      const { data } = await api.get('/clientes');
      setClientes(data);
      setClientesCarregados(true);
    } catch {}
  };

  const carregarAutomacoes = async () => {
    try {
      const { data } = await api.get('/automacao-etapas', { params: { funil_id: 10 } });
      setAutomacoes(data);
    } catch {}
  };

  const criarAutomacao = async () => {
    if (!formAuto.tipo_acao) return;
    // Validacoes por tipo de gatilho
    if (formAuto.gatilho === 'ao_entrar_etapa' && !formAuto.estagio_destino) return;
    if (formAuto.gatilho !== 'ao_entrar_etapa' && !formAuto.estagio_origem) return;
    try {
      await api.post('/automacao-etapas', {
        ...formAuto,
        funil_id: 10,
      });
      setFormAuto({ gatilho: 'ao_entrar_etapa', estagio_origem: '', estagio_destino: '', tipo_acao: 'mover_estagio', descricao: '', config: {} });
      carregarAutomacoes();
    } catch {}
  };

  const excluirAutomacao = async (id: number) => {
    try {
      await api.delete(`/automacao-etapas/${id}`);
      carregarAutomacoes();
    } catch {}
  };

  const toggleAutomacao = async (id: number, ativo: boolean) => {
    try {
      await api.put(`/automacao-etapas/${id}`, { ativo: ativo ? 1 : 0 });
      carregarAutomacoes();
    } catch {}
  };

  // IA: gerar automacoes a partir de texto
  const gerarAutomacaoIA = async () => {
    if (!iaTexto.trim() || iaLoading) return;
    setIaLoading(true);
    setIaPreview([]);
    try {
      const { data } = await api.post('/automacao-etapas/ia', { mensagem: iaTexto });
      if (data.erro) {
        setIaPreview([{ erro: data.erro }]);
      } else if (data.automacoes?.length) {
        setIaPreview(data.automacoes);
      } else {
        setIaPreview([{ erro: 'Nao entendi. Tente descrever de forma mais clara.' }]);
      }
    } catch (e: any) {
      setIaPreview([{ erro: 'Erro ao gerar automacao. Verifique sua API key.' }]);
    }
    setIaLoading(false);
  };

  // IA: salvar uma automacao gerada
  const salvarAutomacaoIA = async (auto: any, index: number) => {
    setIaSalvando(prev => ({...prev, [index]: true}));
    try {
      await api.post('/automacao-etapas', {
        gatilho: auto.gatilho,
        estagio_origem: auto.estagio_origem || null,
        estagio_destino: auto.estagio_destino || null,
        tipo_acao: auto.tipo_acao,
        config: auto.config || {},
        descricao: auto.descricao || '',
        funil_id: 10,
      });
      // Marcar como salva
      setIaPreview(prev => prev.map((a, i) => i === index ? {...a, _salva: true} : a));
      carregarAutomacoes();
    } catch {}
    setIaSalvando(prev => ({...prev, [index]: false}));
  };

  // IA: salvar todas automacoes geradas
  const salvarTodasIA = async () => {
    const pendentes = iaPreview.filter((a, i) => !a.erro && !a._salva);
    for (let i = 0; i < iaPreview.length; i++) {
      if (!iaPreview[i].erro && !iaPreview[i]._salva) {
        await salvarAutomacaoIA(iaPreview[i], i);
      }
    }
  };

  // Editar automacao existente
  const salvarEdicaoAutomacao = async () => {
    if (!autoEditando) return;
    try {
      await api.put(`/automacao-etapas/${autoEditando.id}`, {
        gatilho: autoEditando.gatilho,
        estagio_origem: autoEditando.estagio_origem || null,
        estagio_destino: autoEditando.estagio_destino || null,
        tipo_acao: autoEditando.tipo_acao,
        config: autoEditando.config || {},
        descricao: autoEditando.descricao || '',
      });
      setAutoEditando(null);
      carregarAutomacoes();
    } catch {}
  };

  const abrirModalOdv = () => { carregarClientes(); setModalOdv(true); };
  const abrirModalTarefa = () => { carregarClientes(); setModalTarefa(true); };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const odvId = result.draggableId;
    const destino = result.destination.droppableId;

    // Resolver bloco → primeira sub-etapa do bloco
    let novoEstagio = destino;
    if (destino.startsWith('bloco:')) {
      const blocoNome = destino.replace('bloco:', '');
      const blocoInfo = blocos.find(b => b.nome === blocoNome);
      if (blocoInfo && blocoInfo.etapas.length > 0) {
        novoEstagio = blocoInfo.etapas[0].nome;
      }
    }

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
      setTimeout(() => carregar(10), 500);
    } catch {
      carregar(10);
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
    carregar(10);
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
    carregar(10);
  };

  const handleCriarOdv = async () => {
    try {
      await api.post('/pipeline', {
        ...formOdv,
        valor: formOdv.valor ? parseFloat(formOdv.valor) : null,
        estagio: estagios[0]?.nome || 'Lead',
        funil_id: 10,
      });
      setModalOdv(false);
      setFormOdv({ cliente_id: '', titulo: '', valor: '', produto_interesse: '', notas: '', origem_lead: '' });
      carregar(10);
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar ODV');
    }
  };

  const handleExcluirOdv = async (id: string) => {
    if (!confirm('Excluir esta oportunidade de venda?')) return;
    await api.delete(`/pipeline/${id}`);
    carregar(10);
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
      carregar(10);
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao criar tarefa');
    }
  };

  const handleConcluirTarefa = async (id: number) => {
    await api.post(`/tarefas/${id}/concluir`);
    carregar(10);
  };

  const handleExcluirTarefa = async (id: number) => {
    await api.delete(`/tarefas/${id}`);
    carregar(10);
  };

  // Estagios
  const handleCriarEstagio = async () => {
    if (!formEstagio.nome) return;
    await api.post('/funil/estagios', { ...formEstagio, funil_id: 10 });
    setFormEstagio({ nome: '', cor: '#6b7280', tipo: 'aberto' });
    carregar(10);
  };

  const handleExcluirEstagio = async (id: number) => {
    try {
      await api.delete(`/funil/estagios/${id}`);
      carregar(10);
    } catch (e: any) {
      alert(e.response?.data?.erro || 'Erro ao excluir estagio');
    }
  };

  const tarefasPendentes = tarefas.filter(t => t.status === 'pendente' || t.status === 'em_andamento');
  const tarefasDaOdv = (odvId: string) => tarefas.filter(t => t.pipeline_id === odvId && t.status !== 'concluida' && t.status !== 'cancelada');

  // Filtrar ODVs
  const odvsFiltrados = useMemo(() => {
    let resultado = odvs;
    if (filtros.busca) {
      const termo = filtros.busca.toLowerCase();
      resultado = resultado.filter(o =>
        o.titulo.toLowerCase().includes(termo) ||
        o.cliente_nome?.toLowerCase().includes(termo) ||
        o.cliente_telefone?.includes(termo) ||
        o.produto_interesse?.toLowerCase().includes(termo)
      );
    }
    if (filtros.classificacao) {
      resultado = resultado.filter(o => o.classificacao === filtros.classificacao);
    }
    if (filtros.canal) {
      resultado = resultado.filter(o => o.canal_origem === filtros.canal);
    }
    if (filtros.produto) {
      resultado = resultado.filter(o => o.produto_interesse?.toLowerCase().includes(filtros.produto.toLowerCase()));
    }
    return resultado;
  }, [odvs, filtros]);

  // Abrir painel lateral do lead
  const handleAbrirDetalhe = async (odvId: string) => {
    setOdvSelecionado(odvId);
    const odv = odvs.find(o => o.id === odvId);
    setOdvDetalhe(odv);
    try {
      const { data } = await api.get(`/pipeline/${odvId}/historico`);
      setOdvHistoricoDetalhe(data);
    } catch { setOdvHistoricoDetalhe([]); }
  };

  // Helper: tempo na etapa
  const tempoNaEtapa = (criadoEm?: string) => {
    if (!criadoEm) return '';
    const diff = Date.now() - new Date(criadoEm).getTime();
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(horas / 24);
    if (dias > 0) return `${dias}d ${horas % 24}h`;
    if (horas > 0) return `${horas}h`;
    return `${Math.floor(diff / 60000)}min`;
  };

  // Helper: cor do score BANT
  const corScore = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-500';
    if (score >= 70) return 'bg-green-100 text-green-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  // Helper: icone classificacao
  const iconeClassificacao = (c?: string) => {
    if (c === 'QUENTE') return <Flame size={12} className="text-red-500" />;
    if (c === 'MORNO') return <Thermometer size={12} className="text-amber-500" />;
    if (c === 'FRIO') return <Snowflake size={12} className="text-blue-500" />;
    return null;
  };

  // Configuracao dos blocos visuais do Kanban
  const BLOCO_CONFIG: Record<string, { cor: string; corBg: string; corHead: string; corText: string; icone: any }> = {
    'Qualificacao': { cor: 'indigo', corBg: 'bg-indigo-50', corHead: 'bg-indigo-100', corText: 'text-indigo-800', icone: Target },
    'Fechamento': { cor: 'amber', corBg: 'bg-amber-50', corHead: 'bg-amber-100', corText: 'text-amber-800', icone: DollarSign },
    'Logistica': { cor: 'blue', corBg: 'bg-blue-50', corHead: 'bg-sky-100', corText: 'text-sky-800', icone: Truck },
    'Sucesso do Cliente': { cor: 'emerald', corBg: 'bg-emerald-50', corHead: 'bg-emerald-100', corText: 'text-emerald-800', icone: Heart },
    'Nutricao': { cor: 'pink', corBg: 'bg-pink-50', corHead: 'bg-pink-100', corText: 'text-pink-800', icone: RefreshCw },
    'Arquivo': { cor: 'gray', corBg: 'bg-gray-50', corHead: 'bg-gray-200', corText: 'text-gray-700', icone: Archive },
  };

  // Agrupar etapas por bloco
  const blocos = useMemo(() => {
    const blocoMap: Record<string, Estagio[]> = {};
    const ordem = ['Qualificacao', 'Fechamento', 'Logistica', 'Sucesso do Cliente', 'Nutricao', 'Arquivo'];
    for (const e of estagios) {
      const bloco = e.bloco || 'Qualificacao';
      if (!blocoMap[bloco]) blocoMap[bloco] = [];
      blocoMap[bloco].push(e);
    }
    return ordem.filter(b => blocoMap[b]).map(b => ({ nome: b, etapas: blocoMap[b] }));
  }, [estagios]);

  // Estagios kanban = todos exceto arquivo (a menos que filtrado)
  const estagiosKanban = estagios.filter(e => e.bloco !== 'Arquivo');

  // Automacoes agrupadas por etapa (para mostrar indicador no kanban)
  const automacoesPorEtapa = useMemo(() => {
    const mapa: Record<string, any[]> = {};
    for (const a of automacoes) {
      // Etapa de referencia: estagio_origem (para gatilhos de evento) ou estagio_destino (para ao_entrar)
      const etapa = a.gatilho === 'ao_entrar_etapa' ? a.estagio_destino : a.estagio_origem;
      if (etapa) {
        if (!mapa[etapa]) mapa[etapa] = [];
        mapa[etapa].push(a);
      }
    }
    return mapa;
  }, [automacoes]);

  // Badge de sub-etapa
  const badgeSubEtapa = (nome: string) => {
    const cores: Record<string, string> = {
      'Contato': 'bg-indigo-100 text-indigo-700',
      'BANT': 'bg-violet-100 text-violet-700',
      'Qualificado': 'bg-green-100 text-green-700',
      'Orcamento': 'bg-amber-100 text-amber-700',
      'Negociacao': 'bg-orange-100 text-orange-700',
      'Aguardando Pagamento': 'bg-yellow-100 text-yellow-700',
      'Ganho': 'bg-emerald-100 text-emerald-700',
      'Aguardando Envio': 'bg-sky-100 text-sky-700',
      'Enviado': 'bg-blue-100 text-blue-700',
      'Aguardando Retirada': 'bg-cyan-100 text-cyan-700',
      'Entregue': 'bg-teal-100 text-teal-700',
      'Sucesso': 'bg-green-100 text-green-700',
      'Pos-venda': 'bg-rose-100 text-rose-700',
      'Recompra': 'bg-pink-100 text-pink-700',
      'Reconversao': 'bg-fuchsia-100 text-fuchsia-700',
      'Reengajamento': 'bg-purple-100 text-purple-700',
      'Perdido': 'bg-red-100 text-red-700',
      'Opt-out': 'bg-gray-200 text-gray-600',
      'Completo': 'bg-gray-100 text-gray-500',
    };
    return cores[nome] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-3 md:mb-4">
        {/* Abas Funil / Clientes */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAbaAtiva('funil')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                abaAtiva === 'funil'
                  ? 'bg-gradient-to-r from-indigo-900 to-indigo-700 text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Filter size={14} />
              Funil
              {abaAtiva === 'funil' && odvs.length > 0 && (
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{odvs.length}</span>
              )}
            </button>
            <button
              onClick={() => setAbaAtiva('clientes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                abaAtiva === 'clientes'
                  ? 'bg-gradient-to-r from-teal-700 to-teal-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Users size={14} />
              Clientes
            </button>
          </div>

          {abaAtiva === 'funil' && (
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
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
              {brechas.length > 0 && (
                <Tooltip texto="Ver brechas detectadas no funil" posicao="bottom">
                  <Button variante="secundario" tamanho="sm" onClick={() => setMostrarBrechas(!mostrarBrechas)} className="border-orange-200 text-orange-600 hover:bg-orange-50">
                    <AlertTriangle size={14} /> ({brechas.length})
                  </Button>
                </Tooltip>
              )}
              <Tooltip texto="Tarefas pendentes" posicao="bottom">
                <Button variante="secundario" tamanho="sm" onClick={() => setPainelTarefas(!painelTarefas)}>
                  <CheckSquare size={14} /> ({tarefaStats.pendentes})
                </Button>
              </Tooltip>
              <Tooltip texto="Editar etapas do funil" posicao="bottom">
                <Button variante="secundario" tamanho="sm" onClick={() => setModalConfig(true)}>
                  <Settings size={14} />
                </Button>
              </Tooltip>
              <Tooltip texto="Nova ODV" posicao="bottom">
                <Button tamanho="sm" onClick={abrirModalOdv}>
                  <Plus size={14} /> ODV
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Metricas do Funil */}
      {abaAtiva === 'funil' && metricas && visao === 'kanban' && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
            <p className="text-lg md:text-xl font-bold text-gray-800">{metricas.total_ativos}</p>
            <p className="text-[10px] text-gray-400">ODVs Ativas</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
            <p className="text-lg md:text-xl font-bold text-green-600">{metricas.taxa_conversao}%</p>
            <p className="text-[10px] text-gray-400">Conversao</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
            <p className="text-lg md:text-xl font-bold text-gray-800">{formatarMoeda(metricas.ticket_medio)}</p>
            <p className="text-[10px] text-gray-400">Ticket Medio</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center hidden md:block">
            <p className="text-lg md:text-xl font-bold text-gray-800">{metricas.tempo_medio_fechamento ? `${metricas.tempo_medio_fechamento}d` : '-'}</p>
            <p className="text-[10px] text-gray-400">Tempo Medio</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center hidden md:block">
            <p className={`text-lg md:text-xl font-bold ${metricas.leads_em_risco > 0 ? 'text-red-600' : 'text-gray-800'}`}>{metricas.leads_em_risco}</p>
            <p className="text-[10px] text-gray-400">Em Risco</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-2 text-center hidden md:block">
            <p className="text-lg md:text-xl font-bold text-purple-600">{metricas.reengajamentos_semana}</p>
            <p className="text-[10px] text-gray-400">Reengajados</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      {abaAtiva === 'funil' && visao === 'kanban' && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar lead..."
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                mostrarFiltros || filtros.classificacao || filtros.canal
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Filter size={12} /> Filtros
              {(filtros.classificacao || filtros.canal) && (
                <span className="bg-blue-500 text-white text-[10px] px-1 rounded-full">
                  {[filtros.classificacao, filtros.canal].filter(Boolean).length}
                </span>
              )}
            </button>
            {(filtros.busca || filtros.classificacao || filtros.canal || filtros.produto) && (
              <button
                onClick={() => setFiltros({ busca: '', classificacao: '', canal: '', produto: '' })}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Limpar
              </button>
            )}
          </div>
          {mostrarFiltros && (
            <div className="flex gap-2 mt-2 flex-wrap">
              <select
                value={filtros.classificacao}
                onChange={(e) => setFiltros({ ...filtros, classificacao: e.target.value })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              >
                <option value="">Classificacao</option>
                <option value="QUENTE">Quente</option>
                <option value="MORNO">Morno</option>
                <option value="FRIO">Frio</option>
                <option value="DESCARTE">Descarte</option>
              </select>
              <select
                value={filtros.canal}
                onChange={(e) => setFiltros({ ...filtros, canal: e.target.value })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              >
                <option value="">Canal</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="site">Site</option>
                <option value="trafego">Trafego</option>
              </select>
              <input
                type="text"
                placeholder="Produto..."
                value={filtros.produto}
                onChange={(e) => setFiltros({ ...filtros, produto: e.target.value })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-32"
              />
            </div>
          )}
        </div>
      )}

      {/* Clientes */}
      {abaAtiva === 'clientes' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-alisson-600" /></div>}>
            <ClientesPage />
          </Suspense>
        </div>
      )}

      {/* Visao Kanban - Blocos */}
      {abaAtiva === 'funil' && visao === 'kanban' && (
        <div className="flex gap-4 flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-3 h-full pb-4 snap-x snap-mandatory md:snap-none overflow-x-auto md:overflow-x-visible">
                {blocos.filter(b => b.nome !== 'Arquivo').map((bloco) => {
                  const cfg = BLOCO_CONFIG[bloco.nome] || BLOCO_CONFIG['Arquivo'];
                  const BlocoIcone = cfg.icone;
                  const blocoOdvs = odvsFiltrados.filter(d => bloco.etapas.some(e => e.nome === d.estagio));
                  const valorTotal = blocoOdvs.reduce((acc, d) => acc + (d.valor || 0), 0);
                  const autoTotal = bloco.etapas.reduce((acc, e) => acc + (automacoesPorEtapa[e.nome]?.length || 0), 0);

                  return (
                    <div key={bloco.nome} className={`${bloco.nome === 'Arquivo' ? 'w-[160px] min-w-[160px] max-w-[180px]' : 'w-[80vw] md:w-72'} flex-shrink-0 snap-center flex flex-col`}>
                      {/* Header do bloco */}
                      <div className={`${cfg.corHead} rounded-t-xl px-3 py-2 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <BlocoIcone size={14} className={cfg.corText} />
                          <h3 className={`font-semibold text-sm ${cfg.corText}`}>{bloco.nome}</h3>
                        </div>
                        <span className={`text-xs font-bold ${cfg.corText}`}>{blocoOdvs.length}</span>
                      </div>

                      {/* Metricas do bloco */}
                      <div className="border-x border-gray-200 px-3 py-1.5 bg-white text-[10px] space-y-0.5">
                        <div className="flex justify-between"><span className="text-gray-400">Valor total</span><span className="font-medium text-gray-600">{formatarMoeda(valorTotal)}</span></div>
                        {bloco.etapas.map(e => {
                          const cnt = odvsFiltrados.filter(d => d.estagio === e.nome).length;
                          return cnt > 0 ? (
                            <div key={e.nome} className="flex justify-between">
                              <span className="text-gray-400">{e.nome}</span>
                              <span className="font-medium text-gray-600">{cnt}</span>
                            </div>
                          ) : null;
                        })}
                        {autoTotal > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400 flex items-center gap-0.5"><Zap size={8} /> Automacoes</span>
                            <span className="font-medium text-indigo-600">{autoTotal}</span>
                          </div>
                        )}
                      </div>

                      {/* Sub-etapas com automacao */}
                      <div className="border-x border-gray-200 px-2 py-1 bg-white flex flex-wrap gap-1">
                        {bloco.etapas.map(e => (
                          <button
                            key={e.nome}
                            onClick={() => { setModalAutoEtapa(e.nome); setIaPreview([]); setIaTexto(''); }}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors ${badgeSubEtapa(e.nome)} hover:opacity-80`}
                            title={`Automacoes: ${e.nome}`}
                          >
                            {e.nome}
                            {(automacoesPorEtapa[e.nome]?.length || 0) > 0 && (
                              <Zap size={7} className="text-indigo-500" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Droppable: todas as sub-etapas do bloco mapeiam para esta coluna */}
                      <Droppable droppableId={`bloco:${bloco.nome}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 min-h-[120px] rounded-b-xl border border-t-0 border-gray-200 p-2 space-y-2 transition-colors overflow-y-auto ${snapshot.isDraggingOver ? 'bg-blue-50' : cfg.corBg}`}
                          >
                            {(() => {
                              const limiteColuna = colunasExpandidas[bloco.nome] || CARDS_POR_COLUNA;
                              const odvsVisiveis = blocoOdvs.slice(0, limiteColuna);
                              const temMais = blocoOdvs.length > limiteColuna;
                              return (<>
                            {odvsVisiveis.map((odv, index) => {
                              const odvTarefas = tarefasDaOdv(odv.id);
                              return (
                                <Draggable key={odv.id} draggableId={odv.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-white rounded-lg p-3 border border-gray-100 shadow-sm cursor-grab hover:shadow-md transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''}`}
                                      onClick={() => handleAbrirDetalhe(odv.id)}
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                                            {(odv.cliente_nome || odv.titulo).substring(0, 2).toUpperCase()}
                                          </div>
                                          <h4 className="text-sm font-medium text-gray-800 truncate">{odv.titulo}</h4>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0 items-center">
                                          {/* Lead Score com classificacao */}
                                          {(odv.bant_lead_score != null && odv.bant_lead_score > 0) ? (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                                              odv.bant_lead_score >= 80 ? 'bg-red-100 text-red-700' :
                                              odv.bant_lead_score >= 55 ? 'bg-orange-100 text-orange-700' :
                                              odv.bant_lead_score >= 25 ? 'bg-blue-100 text-blue-700' :
                                              'bg-gray-100 text-gray-500'
                                            }`}>
                                              {odv.bant_lead_score >= 80 ? <Flame size={9} /> :
                                               odv.bant_lead_score >= 55 ? <Thermometer size={9} /> :
                                               <Snowflake size={9} />}
                                              {odv.bant_lead_score}
                                            </span>
                                          ) : odv.score_bant ? (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${corScore(odv.score_bant)}`}>
                                              {odv.score_bant}
                                            </span>
                                          ) : null}
                                          <button onClick={(e) => { e.stopPropagation(); handleVerHistorico(odv.id); }} className="p-0.5 hover:bg-gray-100 rounded">
                                            <History size={12} className="text-gray-400" />
                                          </button>
                                          <button onClick={(e) => { e.stopPropagation(); handleExcluirOdv(odv.id); }} className="p-0.5 hover:bg-red-50 rounded">
                                            <Trash2 size={12} className="text-gray-300" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 mb-1">
                                        <p className="text-xs text-gray-500 flex items-center gap-1 flex-1">
                                          <User size={11} /> {odv.cliente_nome}
                                        </p>
                                        {(odv.bant_classificacao || odv.classificacao) && iconeClassificacao(odv.bant_classificacao || odv.classificacao)}
                                      </div>
                                      {odv.cliente_telefone && (
                                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                                          {odv.canal_origem === 'instagram' ? <Instagram size={10} /> : <Phone size={10} />}
                                          {odv.cliente_telefone}
                                        </p>
                                      )}

                                      {/* Sub-etapa badge */}
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badgeSubEtapa(odv.estagio)}`}>
                                          {odv.estagio}
                                        </span>
                                      </div>

                                      {/* BANT Score Bars - so nas etapas de qualificacao */}
                                      {['Contato', 'BANT', 'Qualificado'].includes(odv.estagio) && odv.bant_lead_score != null && odv.bant_lead_score > 0 && (
                                        <div className="mb-1.5 space-y-1">
                                          {/* Barra geral */}
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] text-gray-400 w-8">Score</span>
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all ${
                                                  odv.bant_lead_score >= 80 ? 'bg-red-500' :
                                                  odv.bant_lead_score >= 55 ? 'bg-orange-500' :
                                                  odv.bant_lead_score >= 25 ? 'bg-blue-500' : 'bg-gray-400'
                                                }`}
                                                style={{ width: `${Math.min((odv.bant_lead_score / 100) * 100, 100)}%` }}
                                              />
                                            </div>
                                            <span className="text-[9px] font-bold text-gray-500 w-9 text-right">{odv.bant_lead_score}/100</span>
                                          </div>
                                          {/* BANT individual */}
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                            {[
                                              { label: 'B', score: odv.bant_budget_score || 0, max: 30, cor: 'bg-amber-400', title: 'Orcamento' },
                                              { label: 'A', score: odv.bant_authority_score || 0, max: 15, cor: 'bg-green-400', title: 'Decisor' },
                                              { label: 'N', score: odv.bant_need_score || 0, max: 30, cor: 'bg-blue-400', title: 'Necessidade' },
                                              { label: 'T', score: odv.bant_timeline_score || 0, max: 20, cor: 'bg-red-400', title: 'Prazo' },
                                              { label: '+', score: odv.bant_bonus_score || 0, max: 5, cor: 'bg-purple-400', title: 'Bonus' },
                                            ].map(b => (
                                              <div key={b.label} className="flex items-center gap-1" title={`${b.title}: ${b.score}/${b.max}`}>
                                                <span className="text-[8px] font-bold text-gray-400 w-2.5">{b.label}</span>
                                                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                                  <div className={`h-full rounded-full ${b.cor}`} style={{ width: `${(b.score / b.max) * 100}%` }} />
                                                </div>
                                                <span className="text-[8px] text-gray-400 w-5 text-right">{b.score}</span>
                                              </div>
                                            ))}
                                          </div>
                                          {/* Campos BANT preenchidos e Classificacao */}
                                          <div className="flex items-center justify-between mt-1">
                                            <span className="text-[8px] text-gray-400">
                                              Campos: {[odv.produto_interesse, odv.ocasiao, odv.bant_timeline, odv.bant_budget, odv.bant_authority].filter(Boolean).length}/5
                                            </span>
                                            {(odv.bant_classificacao || odv.classificacao) && (
                                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                                (odv.bant_classificacao || odv.classificacao) === 'QUENTE' ? 'bg-red-100 text-red-700' :
                                                (odv.bant_classificacao || odv.classificacao) === 'MORNO' ? 'bg-orange-100 text-orange-700' :
                                                (odv.bant_classificacao || odv.classificacao) === 'FRIO' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-600'
                                              }`}>
                                                {odv.bant_classificacao || odv.classificacao}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex items-center gap-2 flex-wrap">
                                        {odv.valor > 0 && (
                                          <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                                            <DollarSign size={12} /> {formatarMoeda(odv.valor)}
                                          </span>
                                        )}
                                        {odv.criado_em && (
                                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                            <Clock size={9} /> {tempoNaEtapa(odv.criado_em)}
                                          </span>
                                        )}
                                      </div>
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
                            {temMais && (
                              <button
                                onClick={() => setColunasExpandidas(prev => ({
                                  ...prev,
                                  [bloco.nome]: limiteColuna + CARDS_POR_COLUNA
                                }))}
                                className="w-full py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                              >
                                Ver mais {blocoOdvs.length - limiteColuna} cards
                              </button>
                            )}
                            </>);
                            })()}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
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
      {abaAtiva === 'funil' && visao === 'funil' && (() => {
        const totalOdvs = odvs.length;
        const valorTotalGeral = odvs.reduce((acc, o) => acc + (o.valor || 0), 0);
        const ticketMedioGeral = totalOdvs > 0 ? valorTotalGeral / totalOdvs : 0;

        const estagioStats = estagiosKanban.map(e => {
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

      {/* Painel Lateral: Detalhes do Lead */}
      {odvSelecionado && odvDetalhe && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOdvSelecionado(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
              <h3 className="font-semibold text-gray-800 truncate">{odvDetalhe.titulo}</h3>
              <button onClick={() => setOdvSelecionado(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Info principal */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                    {(odvDetalhe.cliente_nome || '??').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{odvDetalhe.cliente_nome}</p>
                    <p className="text-xs text-gray-500">{odvDetalhe.cliente_telefone || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400">Valor</p>
                    <p className="text-sm font-bold text-green-600">{odvDetalhe.valor ? formatarMoeda(odvDetalhe.valor) : '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400">Estagio</p>
                    <p className="text-sm font-medium text-gray-700">{odvDetalhe.estagio}</p>
                  </div>
                  {(odvDetalhe.bant_lead_score != null && odvDetalhe.bant_lead_score > 0) ? (
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-400">Score BANT</p>
                      <p className={`text-sm font-bold ${odvDetalhe.bant_lead_score >= 80 ? 'text-red-600' : odvDetalhe.bant_lead_score >= 55 ? 'text-orange-600' : odvDetalhe.bant_lead_score >= 25 ? 'text-blue-600' : 'text-gray-500'}`}>
                        {odvDetalhe.bant_lead_score}/100
                      </p>
                    </div>
                  ) : null}
                  {(odvDetalhe.bant_classificacao || odvDetalhe.classificacao) && (
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-400">Classificacao</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        {iconeClassificacao(odvDetalhe.bant_classificacao || odvDetalhe.classificacao)} {odvDetalhe.bant_classificacao || odvDetalhe.classificacao}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Qualificacao BANT detalhada */}
              {(odvDetalhe.bant_lead_score != null && odvDetalhe.bant_lead_score > 0) && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                    <Target size={12} /> Qualificacao BANT
                  </h4>
                  {/* Score total + classificacao */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-end gap-1">
                      <span className={`text-2xl font-bold ${
                        odvDetalhe.bant_lead_score >= 80 ? 'text-red-600' :
                        odvDetalhe.bant_lead_score >= 55 ? 'text-orange-600' :
                        odvDetalhe.bant_lead_score >= 25 ? 'text-blue-600' : 'text-gray-500'
                      }`}>{odvDetalhe.bant_lead_score}</span>
                      <span className="text-gray-400 text-sm mb-0.5">/100</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      (odvDetalhe.bant_classificacao || odvDetalhe.classificacao) === 'QUENTE' ? 'bg-red-100 text-red-700' :
                      (odvDetalhe.bant_classificacao || odvDetalhe.classificacao) === 'MORNO' ? 'bg-orange-100 text-orange-700' :
                      (odvDetalhe.bant_classificacao || odvDetalhe.classificacao) === 'FRIO' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {odvDetalhe.bant_classificacao || odvDetalhe.classificacao || '-'}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      Campos: {[odvDetalhe.produto_interesse, odvDetalhe.ocasiao, odvDetalhe.bant_timeline, odvDetalhe.bant_budget, odvDetalhe.bant_authority].filter(Boolean).length}/5
                    </span>
                  </div>
                  {/* Barras individuais com texto */}
                  <div className="space-y-2.5">
                    {[
                      { label: 'Orcamento', key: 'B', score: odvDetalhe.bant_budget_score || 0, max: 30, cor: 'bg-amber-400', texto: odvDetalhe.bant_budget },
                      { label: 'Decisor', key: 'A', score: odvDetalhe.bant_authority_score || 0, max: 15, cor: 'bg-green-400', texto: odvDetalhe.bant_authority },
                      { label: 'Necessidade', key: 'N', score: odvDetalhe.bant_need_score || 0, max: 30, cor: 'bg-blue-400', texto: odvDetalhe.bant_need },
                      { label: 'Prazo', key: 'T', score: odvDetalhe.bant_timeline_score || 0, max: 20, cor: 'bg-red-400', texto: odvDetalhe.bant_timeline },
                      { label: 'Bonus', key: '+', score: odvDetalhe.bant_bonus_score || 0, max: 5, cor: 'bg-purple-400', texto: null },
                    ].map(b => (
                      <div key={b.key}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase">{b.label}</span>
                          <span className="text-[10px] font-bold text-gray-500">{b.score}/{b.max}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-0.5">
                          <div className={`h-full rounded-full ${b.cor} transition-all`} style={{ width: `${(b.score / b.max) * 100}%` }} />
                        </div>
                        {b.texto && (
                          <p className="text-[10px] text-gray-500 italic truncate" title={b.texto}>"{b.texto}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalhes do pedido */}
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Detalhes</h4>
                <div className="space-y-1.5 text-sm">
                  {odvDetalhe.produto_interesse && (
                    <div className="flex justify-between"><span className="text-gray-500">Produto</span><span className="font-medium">{odvDetalhe.produto_interesse}</span></div>
                  )}
                  {odvDetalhe.canal_origem && (
                    <div className="flex justify-between"><span className="text-gray-500">Canal</span><span className="font-medium">{odvDetalhe.canal_origem}</span></div>
                  )}
                  {odvDetalhe.perfil && (
                    <div className="flex justify-between"><span className="text-gray-500">Perfil</span><span className="font-medium">{odvDetalhe.perfil}</span></div>
                  )}
                  {odvDetalhe.origem_lead && (
                    <div className="flex justify-between"><span className="text-gray-500">Origem</span><span className="font-medium">{odvDetalhe.origem_lead}</span></div>
                  )}
                  {odvDetalhe.forma_pagamento && (
                    <div className="flex justify-between"><span className="text-gray-500">Pagamento</span><span className="font-medium">{odvDetalhe.forma_pagamento} {odvDetalhe.parcelas ? `${odvDetalhe.parcelas}x` : ''}</span></div>
                  )}
                  {odvDetalhe.forma_envio && (
                    <div className="flex justify-between"><span className="text-gray-500">Envio</span><span className="font-medium">{odvDetalhe.forma_envio}</span></div>
                  )}
                  {odvDetalhe.codigo_rastreio && (
                    <div className="flex justify-between"><span className="text-gray-500">Rastreio</span><span className="font-medium text-blue-600">{odvDetalhe.codigo_rastreio}</span></div>
                  )}
                  {odvDetalhe.vendedor_nome && (
                    <div className="flex justify-between"><span className="text-gray-500">Consultora</span><span className="font-medium">{odvDetalhe.vendedor_nome}</span></div>
                  )}
                  {odvDetalhe.criado_em && (
                    <div className="flex justify-between"><span className="text-gray-500">Criado em</span><span className="font-medium">{formatarData(odvDetalhe.criado_em)}</span></div>
                  )}
                </div>
              </div>

              {/* Badges de status */}
              {(odvDetalhe.pagamento_status || odvDetalhe.venda_registrada || odvDetalhe.opt_out) && (
                <div className="border-t pt-3 flex flex-wrap gap-2">
                  {odvDetalhe.pagamento_status === 'approved' && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md flex items-center gap-1">
                      <CreditCard size={11} /> Pago {odvDetalhe.pagamento_valor ? formatarMoeda(odvDetalhe.pagamento_valor) : ''}
                    </span>
                  )}
                  {!!odvDetalhe.venda_registrada && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-md flex items-center gap-1">
                      <ShieldCheck size={11} /> Venda registrada
                    </span>
                  )}
                  {odvDetalhe.opt_out === 1 && (
                    <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md flex items-center gap-1">
                      <Archive size={11} /> Opt-out
                    </span>
                  )}
                </div>
              )}

              {/* Tarefas da ODV */}
              {tarefasDaOdv(odvDetalhe.id).length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tarefas ({tarefasDaOdv(odvDetalhe.id).length})</h4>
                  <div className="space-y-2">
                    {tarefasDaOdv(odvDetalhe.id).map(t => (
                      <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <button onClick={() => handleConcluirTarefa(t.id)} className="flex-shrink-0">
                          <CheckSquare size={14} className="text-green-500" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{t.titulo}</p>
                          <span className={`text-[10px] px-1 py-0.5 rounded ${PRIORIDADE_CORES[t.prioridade]}`}>{t.prioridade}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline / Historico */}
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Timeline</h4>
                <div className="space-y-2">
                  {odvHistoricoDetalhe.length === 0 && <p className="text-xs text-gray-400">Sem historico</p>}
                  {odvHistoricoDetalhe.map(h => (
                    <div key={h.id} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs">
                          {h.estagio_anterior ? (
                            <><span className="text-gray-400">{h.estagio_anterior}</span> → <span className="font-medium">{h.estagio_novo}</span></>
                          ) : (
                            <span className="font-medium">Criado em {h.estagio_novo}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {(h as any).automatico ? 'Automatico' : (h as any).usuario_nome || 'Sistema'} - {formatarData(h.criado_em)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notas */}
              {odvDetalhe.notas && (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notas</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{odvDetalhe.notas}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                <option value="contato">Contato</option>
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

      {/* Modal: Editor de Etapas e Automacoes */}
      <Modal aberto={modalConfig} onFechar={() => setModalConfig(false)} titulo="Configurar Funil">
        <div className="space-y-4">
          {/* Abas: Etapas / Automacoes */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setConfigTab('etapas')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors flex-1 justify-center ${
                configTab === 'etapas' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings size={14} /> Etapas ({estagios.length})
            </button>
            <button
              onClick={() => { setConfigTab('automacoes'); carregarAutomacoes(); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors flex-1 justify-center ${
                configTab === 'automacoes' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Zap size={14} /> Automacoes ({automacoes.length})
            </button>
          </div>

          {/* ═══ ABA ETAPAS ═══ */}
          {configTab === 'etapas' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-1.5">
                {estagios.map((e, i) => {
                  const FASE_LABELS: Record<string, string> = { qualificacao: 'Qualificacao', fechamento: 'Fechamento', logistica: 'Logistica', sucesso: 'Sucesso', nutricao: 'Nutricao', perdido: 'Arquivo' };
                  const faseAnterior = i > 0 ? (estagios[i - 1].fase || 'qualificacao') : null;
                  const novaFase = e.fase !== faseAnterior;

                  return (
                    <div key={e.id}>
                      {novaFase && (
                        <div className="flex items-center gap-2 mt-3 mb-1.5 px-1">
                          <div className="w-2 h-2 rounded-full bg-gray-400" />
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{FASE_LABELS[e.fase || 'qualificacao'] || e.fase}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 rounded-lg p-2.5 group transition-colors">
                        <span className="text-[10px] font-bold text-gray-300 w-5 text-center flex-shrink-0">{i + 1}</span>
                        <input type="color" value={e.cor} onChange={async (ev) => { await api.put(`/funil/estagios/${e.id}`, { cor: ev.target.value }); carregar(10); }} className="w-5 h-5 rounded-full cursor-pointer border-0 p-0" style={{ backgroundColor: e.cor }} />
                        <input type="text" defaultValue={e.nome} onBlur={async (ev) => { const n = ev.target.value.trim(); if (n && n !== e.nome) { await api.put(`/funil/estagios/${e.id}`, { nome: n }); carregar(10); } }} onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }} className="text-sm font-medium flex-1 bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 rounded px-1 py-0.5 min-w-0" />
                        <select value={e.fase || 'qualificacao'} onChange={async (ev) => { await api.put(`/funil/estagios/${e.id}`, { fase: ev.target.value }); carregar(10); }} className="text-[10px] px-1.5 py-0.5 rounded-full border-0 bg-gray-200 text-gray-600 cursor-pointer">
                          {Object.entries(FASE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                        </select>
                        <select value={e.tipo} onChange={async (ev) => { await api.put(`/funil/estagios/${e.id}`, { tipo: ev.target.value }); carregar(10); }} className="text-[10px] px-1.5 py-0.5 rounded border-0 bg-gray-200 text-gray-500 cursor-pointer">
                          <option value="aberto">Aberto</option>
                          <option value="ganho">Ganho</option>
                          <option value="perdido">Perdido</option>
                        </select>
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                          {i > 0 && (<button onClick={async () => { const o = estagios.map((est, idx) => ({ id: est.id, ordem: idx * 10 })); const t = o[i].ordem; o[i].ordem = o[i-1].ordem; o[i-1].ordem = t; await api.put('/funil/estagios/reordenar', { ordem: o }); carregar(10); }} className="p-0.5 hover:bg-gray-300 rounded"><ChevronUp size={12} className="text-gray-400" /></button>)}
                          {i < estagios.length - 1 && (<button onClick={async () => { const o = estagios.map((est, idx) => ({ id: est.id, ordem: idx * 10 })); const t = o[i].ordem; o[i].ordem = o[i+1].ordem; o[i+1].ordem = t; await api.put('/funil/estagios/reordenar', { ordem: o }); carregar(10); }} className="p-0.5 hover:bg-gray-300 rounded"><ChevronDown size={12} className="text-gray-400" /></button>)}
                        </div>
                        <button onClick={() => handleExcluirEstagio(e.id)} className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} className="text-red-400" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Adicionar Etapa</h4>
                <div className="flex gap-2">
                  <Input label="" placeholder="Nome da etapa" value={formEstagio.nome} onChange={(e) => setFormEstagio({...formEstagio, nome: e.target.value})} />
                  <select value={formEstagio.tipo} onChange={(e) => setFormEstagio({...formEstagio, tipo: e.target.value})} className="px-2 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="aberto">Aberto</option>
                    <option value="ganho">Ganho</option>
                    <option value="perdido">Perdido</option>
                  </select>
                  <div className="flex gap-1 items-center">
                    {CORES_DISPONIVEIS.slice(0, 6).map(cor => (
                      <button key={cor} onClick={() => setFormEstagio({...formEstagio, cor})} className={`w-5 h-5 rounded-full border-2 ${formEstagio.cor === cor ? 'border-gray-800 scale-125' : 'border-transparent'}`} style={{ backgroundColor: cor }} />
                    ))}
                  </div>
                  <Button onClick={handleCriarEstagio}><Plus size={14} /></Button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ABA AUTOMACOES ═══ */}
          {configTab === 'automacoes' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">

              {/* IA Chat - Input principal */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <Bot size={15} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">IA de Automacoes</h4>
                    <p className="text-[10px] text-gray-500">Descreva a automacao que deseja e eu crio para voce</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={iaTexto}
                    onChange={(e) => setIaTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gerarAutomacaoIA(); } }}
                    placeholder="Ex: quando o cliente responder no primeiro contato, mover para BANT. Quando o score passar de 70 no BANT, mover para qualificado..."
                    className="flex-1 px-3 py-2.5 border border-indigo-200 rounded-lg text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    disabled={iaLoading}
                  />
                  <button
                    onClick={gerarAutomacaoIA}
                    disabled={iaLoading || !iaTexto.trim()}
                    className="px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end h-10"
                  >
                    {iaLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>

              {/* Preview das automacoes geradas pela IA */}
              {iaPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-500" /> Automacoes Geradas
                    </h4>
                    {iaPreview.filter(a => !a.erro && !a._salva).length > 1 && (
                      <button onClick={salvarTodasIA} className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-1 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                        <Save size={11} /> Salvar Todas
                      </button>
                    )}
                  </div>

                  {iaPreview.map((auto, i) => {
                    if (auto.erro) {
                      return (
                        <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-700">{auto.erro}</p>
                        </div>
                      );
                    }

                    const GATILHO_LABELS: Record<string, string> = {
                      ao_entrar_etapa: 'Ao entrar na etapa',
                      ao_cliente_responder: 'Cliente respondeu',
                      por_lead_score: 'Por lead score',
                    };
                    const GATILHO_COLORS: Record<string, string> = {
                      ao_entrar_etapa: 'bg-blue-100 text-blue-700',
                      ao_cliente_responder: 'bg-green-100 text-green-700',
                      por_lead_score: 'bg-orange-100 text-orange-700',
                    };
                    const TIPO_LABELS: Record<string, string> = {
                      enviar_whatsapp: 'WhatsApp',
                      criar_tarefa: 'Tarefa',
                      mover_estagio: 'Mover',
                      notificar_equipe: 'Notificar',
                      atualizar_campo: 'Campo',
                    };

                    return (
                      <div key={i} className={`border rounded-xl p-3.5 transition-all ${auto._salva ? 'bg-green-50 border-green-200' : 'bg-white border-indigo-200 shadow-sm'}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            {/* Fluxo visual */}
                            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${GATILHO_COLORS[auto.gatilho] || 'bg-gray-100 text-gray-700'}`}>
                                {GATILHO_LABELS[auto.gatilho] || auto.gatilho}
                              </span>
                              {auto.estagio_origem && (
                                <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{auto.estagio_origem}</span>
                              )}
                              <ArrowRight size={12} className="text-gray-300" />
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                {TIPO_LABELS[auto.tipo_acao] || auto.tipo_acao}
                              </span>
                              {auto.config?.estagio_alvo && (
                                <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{auto.config.estagio_alvo}</span>
                              )}
                              {auto.estagio_destino && !auto.config?.estagio_alvo && (
                                <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{auto.estagio_destino}</span>
                              )}
                              {auto.config?.score_minimo && (
                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">≥ {auto.config.score_minimo}</span>
                              )}
                            </div>
                            {/* Explicacao da IA */}
                            <p className="text-xs text-gray-600 leading-relaxed">{auto.explicacao || auto.descricao}</p>
                            {auto.config?.mensagem && (
                              <div className="mt-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                <p className="text-[10px] text-gray-500 italic">"{auto.config.mensagem}"</p>
                              </div>
                            )}
                          </div>
                          {/* Botao salvar */}
                          <div className="flex-shrink-0">
                            {auto._salva ? (
                              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                <Check size={16} className="text-green-600" />
                              </div>
                            ) : (
                              <button
                                onClick={() => salvarAutomacaoIA(auto, i)}
                                disabled={iaSalvando[i]}
                                className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors disabled:opacity-50"
                              >
                                {iaSalvando[i] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => { setIaPreview([]); setIaTexto(''); }}
                    className="text-[11px] text-gray-400 hover:text-gray-600 w-full text-center py-1"
                  >
                    Limpar preview
                  </button>
                </div>
              )}

              {/* Separador */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-[10px] text-gray-400 font-medium">AUTOMACOES ATIVAS ({automacoes.length})</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Lista de automacoes existentes */}
              {automacoes.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  <p className="text-xs">Nenhuma automacao configurada ainda</p>
                </div>
              )}

              {automacoes.map(auto => {
                const config = typeof auto.config === 'string' ? JSON.parse(auto.config) : auto.config;
                const TIPO_ICONS: Record<string, any> = {
                  enviar_whatsapp: MessageSquare,
                  criar_tarefa: CheckSquare,
                  mover_estagio: ArrowRightLeft,
                  notificar_equipe: Bell,
                  atualizar_campo: Edit3,
                };
                const TIPO_LABELS: Record<string, string> = {
                  enviar_whatsapp: 'WhatsApp',
                  criar_tarefa: 'Tarefa',
                  mover_estagio: 'Mover',
                  notificar_equipe: 'Notificar',
                  atualizar_campo: 'Campo',
                };
                const GATILHO_LABELS: Record<string, string> = {
                  ao_entrar_etapa: 'Ao entrar',
                  ao_cliente_responder: 'Respondeu',
                  por_lead_score: 'Score',
                };
                const GATILHO_COLORS: Record<string, string> = {
                  ao_entrar_etapa: 'bg-blue-50 text-blue-700',
                  ao_cliente_responder: 'bg-green-50 text-green-700',
                  por_lead_score: 'bg-orange-50 text-orange-700',
                };
                const Icon = TIPO_ICONS[auto.tipo_acao] || Zap;
                const gatilhoLabel = GATILHO_LABELS[auto.gatilho || 'ao_entrar_etapa'] || auto.gatilho;
                const gatilhoCor = GATILHO_COLORS[auto.gatilho || 'ao_entrar_etapa'] || 'bg-gray-50 text-gray-700';

                return (
                  <div key={auto.id} className={`border rounded-lg p-3 transition-colors ${auto.ativo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Icon size={14} className="text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gatilhoCor}`}>{gatilhoLabel}</span>
                          {auto.estagio_origem && <span className="text-[10px] text-gray-500">{auto.estagio_origem}</span>}
                          <ArrowRight size={10} className="text-gray-300" />
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{TIPO_LABELS[auto.tipo_acao] || auto.tipo_acao}</span>
                          {auto.estagio_destino && <span className="text-[10px] text-gray-500">{auto.estagio_destino}</span>}
                          {config.estagio_alvo && <span className="text-[10px] text-gray-500">→ {config.estagio_alvo}</span>}
                          {config.score_minimo && <span className="text-[10px] text-orange-600">≥{config.score_minimo}</span>}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{auto.descricao || config.mensagem?.substring(0, 60) || config.titulo || '-'}</p>
                      </div>
                      <button onClick={() => toggleAutomacao(auto.id, !auto.ativo)} className={`text-[10px] px-2 py-1 rounded-full font-medium ${auto.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {auto.ativo ? 'ON' : 'OFF'}
                      </button>
                      <button onClick={() => excluirAutomacao(auto.id)} className="p-1 hover:bg-red-100 rounded"><Trash2 size={12} className="text-red-400" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Automacao por Etapa */}
      <Modal aberto={!!modalAutoEtapa} onFechar={() => setModalAutoEtapa(null)} titulo={`Automacoes: ${modalAutoEtapa}`}>
        {modalAutoEtapa && (() => {
          const etapaAutomacoes = automacoes.filter(a => {
            const etapa = a.gatilho === 'ao_entrar_etapa' ? a.estagio_destino : a.estagio_origem;
            return etapa === modalAutoEtapa;
          });
          const ativas = etapaAutomacoes.filter(a => a.ativo);
          const inativas = etapaAutomacoes.filter(a => !a.ativo);

          const TIPO_ICONS: Record<string, any> = {
            enviar_whatsapp: MessageSquare,
            criar_tarefa: CheckSquare,
            mover_estagio: ArrowRightLeft,
            notificar_equipe: Bell,
            atualizar_campo: Edit3,
          };
          const TIPO_LABELS: Record<string, string> = {
            enviar_whatsapp: 'WhatsApp',
            criar_tarefa: 'Tarefa',
            mover_estagio: 'Mover',
            notificar_equipe: 'Notificar',
            atualizar_campo: 'Campo',
          };
          const GATILHO_LABELS: Record<string, string> = {
            ao_entrar_etapa: 'Ao entrar',
            ao_cliente_responder: 'Cliente respondeu',
            por_lead_score: 'Por lead score',
          };
          const GATILHO_COLORS: Record<string, string> = {
            ao_entrar_etapa: 'bg-blue-50 text-blue-700',
            ao_cliente_responder: 'bg-green-50 text-green-700',
            por_lead_score: 'bg-orange-50 text-orange-700',
          };

          const renderAutoCard = (auto: any) => {
            const config = typeof auto.config === 'string' ? JSON.parse(auto.config) : auto.config;
            const Icon = TIPO_ICONS[auto.tipo_acao] || Zap;
            const expandida = autoExpandida === auto.id;

            // Montar texto legivel do que a automacao faz
            const gatilhoTexto = auto.gatilho === 'ao_cliente_responder'
              ? `Quando o cliente responder em "${auto.estagio_origem || modalAutoEtapa}"`
              : auto.gatilho === 'por_lead_score'
              ? `Quando o lead score ${config.score_minimo ? `atingir ≥ ${config.score_minimo}` : 'mudar'}${config.score_maximo ? ` e ≤ ${config.score_maximo}` : ''} em "${auto.estagio_origem || modalAutoEtapa}"`
              : `Quando a ODV entrar em "${auto.estagio_destino || modalAutoEtapa}"`;

            const acaoTexto = auto.tipo_acao === 'mover_estagio'
              ? `Mover automaticamente para "${config.estagio_alvo}"`
              : auto.tipo_acao === 'enviar_whatsapp'
              ? `Enviar WhatsApp: "${config.mensagem || ''}"`
              : auto.tipo_acao === 'criar_tarefa'
              ? `Criar tarefa "${config.titulo || ''}" com vencimento em ${config.dias_vencimento || 1} dia(s)`
              : auto.tipo_acao === 'notificar_equipe'
              ? `Notificar equipe: "${config.mensagem || ''}"`
              : auto.tipo_acao === 'atualizar_campo'
              ? `Atualizar campo "${config.campo}" para "${config.valor}"`
              : auto.tipo_acao;

            return (
              <div key={auto.id} className={`border rounded-xl overflow-hidden transition-all ${auto.ativo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                {/* Header clicavel */}
                <div
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setAutoExpandida(expandida ? null : auto.id)}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${auto.ativo ? 'bg-indigo-100' : 'bg-gray-200'}`}>
                    <Icon size={14} className={auto.ativo ? 'text-indigo-600' : 'text-gray-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${GATILHO_COLORS[auto.gatilho || 'ao_entrar_etapa']}`}>
                        {GATILHO_LABELS[auto.gatilho || 'ao_entrar_etapa']}
                      </span>
                      <ArrowRight size={10} className="text-gray-300" />
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {TIPO_LABELS[auto.tipo_acao] || auto.tipo_acao}
                      </span>
                      {config.estagio_alvo && <span className="text-[10px] text-gray-500">→ {config.estagio_alvo}</span>}
                      {config.score_minimo && <span className="text-[10px] text-orange-600 font-bold">≥{config.score_minimo}</span>}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                      {auto.descricao || config.mensagem?.substring(0, 80) || config.titulo || '-'}
                    </p>
                  </div>
                  {expandida ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>

                {/* Detalhes expandidos */}
                {expandida && (
                  <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-3">
                    {/* O que faz */}
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Gatilho</p>
                      <p className="text-xs text-gray-700">{gatilhoTexto}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Acao</p>
                      <p className="text-xs text-gray-700">{acaoTexto}</p>
                    </div>

                    {/* Detalhes tecnicos */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                        <span className="text-gray-400 block">Etapa origem</span>
                        <span className="text-gray-700 font-medium">{auto.estagio_origem || '-'}</span>
                      </div>
                      <div className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                        <span className="text-gray-400 block">Etapa destino</span>
                        <span className="text-gray-700 font-medium">{auto.estagio_destino || config.estagio_alvo || '-'}</span>
                      </div>
                      {config.score_minimo && (
                        <div className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                          <span className="text-gray-400 block">Score minimo</span>
                          <span className="text-orange-600 font-bold">{config.score_minimo}/100</span>
                        </div>
                      )}
                      {config.dias_vencimento && (
                        <div className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                          <span className="text-gray-400 block">Vencimento</span>
                          <span className="text-gray-700 font-medium">{config.dias_vencimento} dia(s)</span>
                        </div>
                      )}
                    </div>

                    {/* Mensagem completa se tiver */}
                    {config.mensagem && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Mensagem</p>
                        <div className="bg-white rounded-lg px-3 py-2 border border-gray-100 text-xs text-gray-600 italic">
                          "{config.mensagem}"
                        </div>
                      </div>
                    )}

                    {/* Data criacao */}
                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                      <span>Criada em: {auto.criado_em ? new Date(auto.criado_em).toLocaleDateString('pt-BR') : '-'}</span>
                      <span>ID: #{auto.id}</span>
                    </div>

                    {/* Formulario de edicao inline */}
                    {autoEditando?.id === auto.id ? (
                      <div className="space-y-2 bg-white rounded-lg p-3 border border-indigo-200">
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">Gatilho:</label>
                          <select value={autoEditando.gatilho} onChange={(e) => setAutoEditando({...autoEditando, gatilho: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
                            <option value="ao_entrar_etapa">Ao entrar na etapa</option>
                            <option value="ao_cliente_responder">Cliente responder</option>
                            <option value="por_lead_score">Por lead score</option>
                          </select>
                        </div>
                        {autoEditando.gatilho !== 'ao_entrar_etapa' && (
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Etapa origem:</label>
                            <select value={autoEditando.estagio_origem || ''} onChange={(e) => setAutoEditando({...autoEditando, estagio_origem: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
                              <option value="">Selecione</option>
                              {estagios.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </select>
                          </div>
                        )}
                        {autoEditando.gatilho === 'ao_entrar_etapa' && (
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Quando entrar em:</label>
                            <select value={autoEditando.estagio_destino || ''} onChange={(e) => setAutoEditando({...autoEditando, estagio_destino: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
                              <option value="">Selecione</option>
                              {estagios.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">Acao:</label>
                          <select value={autoEditando.tipo_acao} onChange={(e) => setAutoEditando({...autoEditando, tipo_acao: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
                            <option value="mover_estagio">Mover para Etapa</option>
                            <option value="enviar_whatsapp">Enviar WhatsApp</option>
                            <option value="criar_tarefa">Criar Tarefa</option>
                            <option value="notificar_equipe">Notificar Equipe</option>
                            <option value="atualizar_campo">Atualizar Campo</option>
                          </select>
                        </div>
                        {autoEditando.tipo_acao === 'mover_estagio' && (
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Mover para:</label>
                            <select value={autoEditando.config?.estagio_alvo || ''} onChange={(e) => setAutoEditando({...autoEditando, config: {...autoEditando.config, estagio_alvo: e.target.value}})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
                              <option value="">Selecione</option>
                              {estagios.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                            </select>
                          </div>
                        )}
                        {autoEditando.tipo_acao === 'enviar_whatsapp' && (
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Mensagem:</label>
                            <textarea value={autoEditando.config?.mensagem || ''} onChange={(e) => setAutoEditando({...autoEditando, config: {...autoEditando.config, mensagem: e.target.value}})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs resize-none h-16" placeholder="Ola {nome}..." />
                          </div>
                        )}
                        {autoEditando.tipo_acao === 'criar_tarefa' && (
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-500 mb-0.5 block">Titulo:</label>
                              <input value={autoEditando.config?.titulo || ''} onChange={(e) => setAutoEditando({...autoEditando, config: {...autoEditando.config, titulo: e.target.value}})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
                            </div>
                            <div className="w-16">
                              <label className="text-[10px] text-gray-500 mb-0.5 block">Dias:</label>
                              <input type="number" value={autoEditando.config?.dias_vencimento || 1} onChange={(e) => setAutoEditando({...autoEditando, config: {...autoEditando.config, dias_vencimento: Number(e.target.value)}})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" min={0} />
                            </div>
                          </div>
                        )}
                        {autoEditando.tipo_acao === 'notificar_equipe' && (
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Mensagem:</label>
                            <input value={autoEditando.config?.mensagem || ''} onChange={(e) => setAutoEditando({...autoEditando, config: {...autoEditando.config, mensagem: e.target.value}})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
                          </div>
                        )}
                        {autoEditando.gatilho === 'por_lead_score' && (
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-500 mb-0.5 block">Score minimo:</label>
                              <input type="number" value={autoEditando.config?.score_minimo || ''} onChange={(e) => setAutoEditando({...autoEditando, config: {...autoEditando.config, score_minimo: Number(e.target.value)}})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" min={0} max={150} />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-500 mb-0.5 block">Score maximo:</label>
                              <input type="number" value={autoEditando.config?.score_maximo || ''} onChange={(e) => setAutoEditando({...autoEditando, config: {...autoEditando.config, score_maximo: Number(e.target.value) || undefined}})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" min={0} max={150} />
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] text-gray-500 mb-0.5 block">Descricao:</label>
                          <input value={autoEditando.descricao || ''} onChange={(e) => setAutoEditando({...autoEditando, descricao: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={salvarEdicaoAutomacao} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
                            <Save size={12} /> Salvar
                          </button>
                          <button onClick={() => setAutoEditando(null)} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Botoes de acao */
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const cfg = typeof auto.config === 'string' ? JSON.parse(auto.config) : auto.config;
                            setAutoEditando({ ...auto, config: cfg });
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAutomacao(auto.id, !auto.ativo); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            auto.ativo
                              ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                              : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                          }`}
                        >
                          {auto.ativo ? <><Eye size={12} /> Desativar</> : <><Zap size={12} /> Ativar</>}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); excluirAutomacao(auto.id); setAutoExpandida(null); }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* IA - criar com texto */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-3 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={14} className="text-indigo-600" />
                  <span className="text-xs font-bold text-gray-700">Criar com IA</span>
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={iaTexto}
                    onChange={(e) => setIaTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gerarAutomacaoIA(); } }}
                    placeholder={`Ex: quando cliente responder em ${modalAutoEtapa}, mover para a proxima etapa...`}
                    className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm resize-none h-14 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    disabled={iaLoading}
                  />
                  <button
                    onClick={gerarAutomacaoIA}
                    disabled={iaLoading || !iaTexto.trim()}
                    className="px-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors self-end h-9"
                  >
                    {iaLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>

              {/* Preview IA */}
              {iaPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600 flex items-center gap-1"><Sparkles size={12} className="text-indigo-500" /> Geradas pela IA</span>
                    {iaPreview.filter(a => !a.erro && !a._salva).length > 1 && (
                      <button onClick={salvarTodasIA} className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-1 bg-indigo-50 rounded-lg">
                        <Save size={10} /> Salvar Todas
                      </button>
                    )}
                  </div>
                  {iaPreview.map((auto, i) => {
                    if (auto.erro) return <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2.5"><p className="text-xs text-red-700">{auto.erro}</p></div>;
                    return (
                      <div key={i} className={`border rounded-lg p-3 transition-all ${auto._salva ? 'bg-green-50 border-green-200' : 'bg-white border-indigo-200 shadow-sm'}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${GATILHO_COLORS[auto.gatilho] || 'bg-gray-100 text-gray-700'}`}>
                                {GATILHO_LABELS[auto.gatilho] || auto.gatilho}
                              </span>
                              {auto.estagio_origem && <span className="text-[10px] text-gray-500">{auto.estagio_origem}</span>}
                              <ArrowRight size={10} className="text-gray-300" />
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                {TIPO_LABELS[auto.tipo_acao] || auto.tipo_acao}
                              </span>
                              {auto.config?.estagio_alvo && <span className="text-[10px] text-gray-500">{auto.config.estagio_alvo}</span>}
                              {auto.config?.score_minimo && <span className="text-[10px] font-bold text-orange-600">≥{auto.config.score_minimo}</span>}
                            </div>
                            <p className="text-xs text-gray-600">{auto.explicacao || auto.descricao}</p>
                          </div>
                          {auto._salva ? (
                            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                              <Check size={14} className="text-green-600" />
                            </div>
                          ) : (
                            <button
                              onClick={() => salvarAutomacaoIA(auto, i)}
                              disabled={iaSalvando[i]}
                              className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors flex-shrink-0 disabled:opacity-50"
                            >
                              {iaSalvando[i] ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => setIaPreview([])} className="text-[10px] text-gray-400 hover:text-gray-600 w-full text-center py-1">Limpar</button>
                </div>
              )}

              {/* Automacoes Ativas */}
              {ativas.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs font-bold text-gray-700">Ativas ({ativas.length})</span>
                  </div>
                  <div className="space-y-2">
                    {ativas.map(renderAutoCard)}
                  </div>
                </div>
              )}

              {/* Automacoes Inativas */}
              {inativas.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                    <span className="text-xs font-bold text-gray-500">Inativas ({inativas.length})</span>
                  </div>
                  <div className="space-y-2">
                    {inativas.map(renderAutoCard)}
                  </div>
                </div>
              )}

              {/* Vazio */}
              {etapaAutomacoes.length === 0 && iaPreview.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Zap size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma automacao nesta etapa</p>
                  <p className="text-[11px] mt-1 text-gray-400">Use a IA acima para criar automacoes</p>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Modal: Motivo de Perda */}
      <Modal aberto={!!modalMotivo} onFechar={() => { setModalMotivo(null); carregar(10); }} titulo="Motivo da Perda">
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
            <Button variante="secundario" onClick={() => { setModalMotivo(null); carregar(10); }}>Cancelar</Button>
            <Button onClick={handleConfirmarPerda}>Confirmar Perda</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Estorno / Cancelamento Pos-Venda */}
      <Modal aberto={!!modalEstorno} onFechar={() => { setModalEstorno(null); carregar(10); }} titulo="Estorno / Cancelamento">
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
            <Button variante="secundario" onClick={() => { setModalEstorno(null); carregar(10); }}>Cancelar</Button>
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
