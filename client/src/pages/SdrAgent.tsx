import { useState, useRef, useEffect } from 'react';
import {
  Bot, Play, Square, RefreshCw, Send, Bell, Settings, Activity, Clock,
  Zap, User, RotateCcw, ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react';
import { useSdrAgent } from '../hooks/useSdrAgent';
import { useAuth } from '../contexts/AuthContext';

// --- Tipos e constantes do painel SDR ---
const TIPOS_EVENTO = [
  { valor: '', label: 'Todos' },
  { valor: 'novo_lead', label: 'Novos Leads' },
  { valor: 'mudanca_estagio', label: 'Mudanca Estagio' },
  { valor: 'lead_inativo', label: 'Inativos' },
  { valor: 'venda_fechada', label: 'Vendas' },
  { valor: 'task_vencida', label: 'Tasks Vencidas' },
];

const BADGE_CORES: Record<string, string> = {
  novo_lead: 'bg-blue-100 text-blue-800',
  mudanca_estagio: 'bg-yellow-100 text-yellow-800',
  lead_inativo: 'bg-gray-100 text-gray-800',
  venda_fechada: 'bg-green-100 text-green-800',
  task_vencida: 'bg-red-100 text-red-800',
};

const PRIORIDADE_CORES: Record<string, string> = {
  critica: 'bg-red-500 text-white',
  alta: 'bg-orange-100 text-orange-800',
  media: 'bg-blue-100 text-blue-800',
  baixa: 'bg-gray-100 text-gray-600',
};

// --- Tipos e constantes do simulador ---
interface Mensagem {
  papel: 'lead' | 'dara';
  conteudo: string;
  timestamp: Date;
}

interface Bant {
  nome?: string | null;
  need?: string | null;
  budget?: string | null;
  timeline?: string | null;
  authority?: string | null;
}

interface ScoreBreakdown {
  need: number;
  budget: number;
  authority: number;
  timeline: number;
  bonus: number;
  total: number;
}

const MENSAGENS_RAPIDAS = [
  'Oi, quero ver alianças de casamento',
  'Quanto custa um anel de ouro?',
  'Preciso de um presente para minha namorada',
  'Tem brincos de ouro?',
  'Quero fazer um colar personalizado',
  'Qual o prazo de entrega?',
];

// --- Componente principal ---
interface SdrAgentProps {
  initialTab?: 'painel' | 'simulador';
  hideHeader?: boolean;
}

export default function SdrAgent({ initialTab = 'painel', hideHeader = false }: SdrAgentProps) {
  const [aba, setAba] = useState<'painel' | 'simulador'>(initialTab);

  if (hideHeader) {
    return (
      <div className="flex flex-col h-full">
        {aba === 'painel' ? <PainelSdr /> : <SimuladorDara />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header com abas */}
      <div className="flex items-center gap-6 mb-6 border-b border-gray-200 pb-0">
        <div className="flex items-center gap-3 pb-4">
          <Bot className="text-alisson-500" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-800">Agente SDR — Dara</h1>
            <p className="text-xs text-gray-500">Monitoramento automatico do Kommo CRM</p>
          </div>
        </div>
        <div className="flex gap-1 ml-auto pb-0">
          <button
            onClick={() => setAba('painel')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              aba === 'painel'
                ? 'border-alisson-500 text-alisson-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} />
            Painel
          </button>
          <button
            onClick={() => setAba('simulador')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              aba === 'simulador'
                ? 'border-alisson-500 text-alisson-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare size={16} />
            Simulador Dara
          </button>
        </div>
      </div>

      {aba === 'painel' ? <PainelSdr /> : <SimuladorDara />}
    </div>
  );
}

// --- Painel de controle do SDR ---
function PainelSdr() {
  const {
    config, status, logs, stats, carregando, erro,
    salvarConfig, iniciar, parar, executarPolling, enviarResumo, testarNotificacao, carregarLogs,
  } = useSdrAgent();

  const [filtroTipo, setFiltroTipo] = useState('');
  const [editando, setEditando] = useState(false);
  const [formConfig, setFormConfig] = useState<any>({});
  const [acao, setAcao] = useState<string | null>(null);

  const handleIniciarEditar = () => {
    if (config) setFormConfig({ ...config });
    setEditando(true);
  };

  const handleSalvarConfig = async () => {
    try {
      await salvarConfig(formConfig);
      setEditando(false);
    } catch {}
  };

  const handleAcao = async (nome: string, fn: () => Promise<any>) => {
    setAcao(nome);
    try { await fn(); } catch {}
    setAcao(null);
  };

  const handleFiltro = (tipo: string) => {
    setFiltroTipo(tipo);
    carregarLogs({ tipo: tipo || undefined, limite: 30 });
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-alisson-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pb-6">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Activity size={20} />
              Status
            </h2>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              status?.rodando ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {status?.rodando ? 'Ativo' : 'Inativo'}
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ultimo polling:</span>
              <span className="text-gray-800">
                {status?.ultimo_polling ? new Date(status.ultimo_polling).toLocaleString('pt-BR') : 'Nunca'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Intervalo:</span>
              <span className="text-gray-800">A cada {status?.intervalo_polling || 5} min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Jobs ativos:</span>
              <span className="text-gray-800">{status?.jobs?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Admin:</span>
              <span className="text-gray-800">{status?.telefone_admin || 'Nao configurado'}</span>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.logs_hoje}</p>
                <p className="text-xs text-blue-500">Eventos hoje</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.total_logs}</p>
                <p className="text-xs text-green-500">Total de logs</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {status?.rodando ? (
              <button
                onClick={() => handleAcao('parar', parar)}
                disabled={acao === 'parar'}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Square size={16} />
                {acao === 'parar' ? 'Parando...' : 'Parar Agente'}
              </button>
            ) : (
              <button
                onClick={() => handleAcao('iniciar', iniciar)}
                disabled={acao === 'iniciar'}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Play size={16} />
                {acao === 'iniciar' ? 'Iniciando...' : 'Iniciar Agente'}
              </button>
            )}
          </div>
        </div>

        {/* Configuracao */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={20} />
              Configuracao
            </h2>
            {!editando ? (
              <button onClick={handleIniciarEditar} className="text-sm text-alisson-500 hover:text-alisson-600 font-medium">
                Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditando(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                <button onClick={handleSalvarConfig} className="text-sm bg-alisson-500 hover:bg-alisson-600 text-white px-3 py-1 rounded">Salvar</button>
              </div>
            )}
          </div>

          {editando ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefone Admin (com DDD)</label>
                <input
                  type="text"
                  value={formConfig.telefone_admin || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, telefone_admin: e.target.value })}
                  placeholder="5511999999999"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Intervalo Polling (min)</label>
                  <input
                    type="number"
                    value={formConfig.intervalo_polling || 5}
                    onChange={(e) => setFormConfig({ ...formConfig, intervalo_polling: parseInt(e.target.value) })}
                    min={1} max={60}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dias p/ Inatividade</label>
                  <input
                    type="number"
                    value={formConfig.dias_inatividade || 7}
                    onChange={(e) => setFormConfig({ ...formConfig, dias_inatividade: parseInt(e.target.value) })}
                    min={1} max={90}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cron Resumo Manha</label>
                  <input
                    type="text"
                    value={formConfig.cron_resumo_manha || '0 8 * * 1-6'}
                    onChange={(e) => setFormConfig({ ...formConfig, cron_resumo_manha: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cron Resumo Tarde</label>
                  <input
                    type="text"
                    value={formConfig.cron_resumo_tarde || '0 17 * * 1-6'}
                    onChange={(e) => setFormConfig({ ...formConfig, cron_resumo_tarde: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prompt Personalizado</label>
                <textarea
                  value={formConfig.prompt_personalizado || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, prompt_personalizado: e.target.value })}
                  placeholder="Instrucoes adicionais para o agente SDR ao gerar resumos..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500 resize-y"
                />
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Acoes Automaticas</p>
                <div className="space-y-2">
                  {[
                    { key: 'auto_criar_tasks', label: 'Criar task "Primeiro contato" para novos leads' },
                    { key: 'auto_followup', label: 'Criar follow-up para leads inativos' },
                    { key: 'auto_mover_leads', label: 'Criar task pos-venda ao fechar venda' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!formConfig[key]}
                        onChange={(e) => setFormConfig({ ...formConfig, [key]: e.target.checked ? 1 : 0 })}
                        className="rounded border-gray-300 text-alisson-500 focus:ring-alisson-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Telefone Admin:</span><span className="text-gray-800">{config?.telefone_admin || 'Nao configurado'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Polling:</span><span className="text-gray-800">A cada {config?.intervalo_polling || 5} min</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Resumo manha:</span><span className="text-gray-800 font-mono text-xs">{config?.cron_resumo_manha || '0 8 * * 1-6'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Resumo tarde:</span><span className="text-gray-800 font-mono text-xs">{config?.cron_resumo_tarde || '0 17 * * 1-6'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Inatividade:</span><span className="text-gray-800">{config?.dias_inatividade || 7} dias</span></div>
              {config?.prompt_personalizado && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-medium text-gray-600 mb-1">Prompt Personalizado</p>
                  <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 whitespace-pre-wrap">{config.prompt_personalizado}</p>
                </div>
              )}
              <div className="border-t pt-2 mt-2 flex flex-wrap gap-2">
                {[
                  { key: 'auto_criar_tasks', label: 'Tasks' },
                  { key: 'auto_followup', label: 'Follow-up' },
                  { key: 'auto_mover_leads', label: 'Pos-venda' },
                ].map(({ key, label }) => (
                  <span key={key} className={`px-2 py-0.5 rounded text-xs ${(config as any)?.[key] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {label} {(config as any)?.[key] ? 'ON' : 'OFF'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Atividade Recente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={20} />
              Atividade Recente
            </h2>
            <div className="flex gap-1 flex-wrap">
              {TIPOS_EVENTO.map(t => (
                <button
                  key={t.valor}
                  onClick={() => handleFiltro(t.valor)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    filtroTipo === t.valor ? 'bg-alisson-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Bot size={40} className="mx-auto mb-2 opacity-50" />
              <p>Nenhum evento registrado ainda</p>
              <p className="text-xs mt-1">Inicie o agente para comecar a monitorar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Tipo</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Prioridade</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Descricao</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Acao</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_CORES[log.tipo] || 'bg-gray-100'}`}>
                          {log.tipo.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORIDADE_CORES[log.prioridade] || ''}`}>
                          {log.prioridade}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-700 max-w-md truncate">{log.descricao}</td>
                      <td className="py-2 px-2 text-gray-500 text-xs">{log.acao_tomada || '-'}</td>
                      <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(log.criado_em).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Acoes Manuais */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Zap size={20} />
            Acoes Manuais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => handleAcao('polling', executarPolling)}
              disabled={!!acao}
              className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 px-4 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={16} className={acao === 'polling' ? 'animate-spin' : ''} />
              {acao === 'polling' ? 'Executando...' : 'Executar Polling'}
            </button>
            <button
              onClick={() => handleAcao('resumo_manha', () => enviarResumo('manha'))}
              disabled={!!acao}
              className="flex items-center justify-center gap-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-3 px-4 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
              {acao === 'resumo_manha' ? 'Enviando...' : 'Resumo Manha'}
            </button>
            <button
              onClick={() => handleAcao('resumo_tarde', () => enviarResumo('tarde'))}
              disabled={!!acao}
              className="flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 py-3 px-4 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
              {acao === 'resumo_tarde' ? 'Enviando...' : 'Resumo Tarde'}
            </button>
            <button
              onClick={() => handleAcao('testar', testarNotificacao)}
              disabled={!!acao}
              className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 py-3 px-4 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Bell size={16} />
              {acao === 'testar' ? 'Enviando...' : 'Testar Notificacao'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Simulador da Dara ---
function SimuladorDara() {
  const { token } = useAuth();
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [bant, setBant] = useState<Bant>({});
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [leadScore, setLeadScore] = useState(0);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [transferirHumano, setTransferirHumano] = useState(false);
  const [promptChars, setPromptChars] = useState<number | null>(null);
  const [mostrarBant, setMostrarBant] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [historico]);

  const enviar = async (mensagemTexto?: string) => {
    const msg = mensagemTexto || texto.trim();
    if (!msg || carregando) return;

    const novaMensagem: Mensagem = { papel: 'lead', conteudo: msg, timestamp: new Date() };
    const novoHistorico = [...historico, novaMensagem];
    setHistorico(novoHistorico);
    setTexto('');
    setCarregando(true);

    try {
      const resp = await fetch('/api/sdr-agent/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          historico: novoHistorico.map(m => ({ papel: m.papel, conteudo: m.conteudo })),
          bant,
          leadScore,
        }),
      });

      const data = await resp.json();
      if (data.erro) throw new Error(data.erro);

      setHistorico(prev => [...prev, { papel: 'dara', conteudo: data.resposta, timestamp: new Date() }]);
      if (data.bant) setBant(data.bant);
      if (data.score_breakdown) setScoreBreakdown(data.score_breakdown);
      if (data.lead_score !== undefined) setLeadScore(data.lead_score);
      if (data.transferir_humano) setTransferirHumano(true);
      if (data._debug_prompt_chars !== undefined) setPromptChars(data._debug_prompt_chars);
    } catch (e: any) {
      setHistorico(prev => [...prev, { papel: 'dara', conteudo: `[Erro: ${e.message}]`, timestamp: new Date() }]);
    } finally {
      setCarregando(false);
    }
  };

  const reiniciar = () => {
    setHistorico([]);
    setBant({});
    setScoreBreakdown(null);
    setLeadScore(0);
    setTransferirHumano(false);
    setPromptChars(null);
    setTexto('');
  };

  const bantFields = [
    { key: 'nome',      label: 'Nome',        pts: scoreBreakdown ? null : null },
    { key: 'need',      label: 'Necessidade', pts: scoreBreakdown?.need },
    { key: 'budget',    label: 'Orcamento',   pts: scoreBreakdown?.budget },
    { key: 'timeline',  label: 'Prazo',       pts: scoreBreakdown?.timeline },
    { key: 'authority', label: 'Decisor',     pts: scoreBreakdown?.authority },
  ];

  const bantPreenchido = ['nome','need','budget','timeline','authority'].filter(k => (bant as any)[k]).length;
  const scoreColor    = leadScore >= 80 ? 'text-green-600' : leadScore >= 55 ? 'text-yellow-600' : 'text-red-500';
  const scoreBarColor = leadScore >= 80 ? 'bg-green-500'   : leadScore >= 55 ? 'bg-yellow-400'   : 'bg-red-400';

  return (
    <div className="flex gap-4 flex-1 min-h-0">
      {/* Chat */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header do chat */}
        <div className="bg-alisson-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-alisson-400 flex items-center justify-center">
              <Bot size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm">Dara — Alisson Joias</p>
              <p className={`text-xs ${promptChars === 0 ? 'text-red-300' : 'text-alisson-200'}`}>
                {promptChars === null ? 'Modo Simulacao' : promptChars === 0 ? 'Prompt vazio — configure em Prompt Lab' : `Prompt ativo: ${promptChars} chars`}
              </p>
            </div>
          </div>
          <button
            onClick={reiniciar}
            title="Reiniciar conversa"
            className="p-1.5 hover:bg-alisson-500 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
          >
            <RotateCcw size={14} />
            Reiniciar
          </button>
        </div>

        {/* Mensagens */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {historico.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <Bot size={44} className="mb-3 opacity-25" />
              <p className="font-medium text-gray-500">Simule uma conversa com a Dara</p>
              <p className="text-sm mt-1">Digite como se fosse um lead chegando pelo WhatsApp</p>
              <p className="text-xs mt-3">ou use um dos atalhos abaixo</p>
            </div>
          )}

          {historico.map((msg, i) => (
            <div key={i} className={`flex ${msg.papel === 'lead' ? 'justify-end' : 'justify-start'}`}>
              {msg.papel === 'dara' && (
                <div className="w-7 h-7 rounded-full bg-alisson-500 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.papel === 'lead'
                  ? 'bg-alisson-500 text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                <p className={`text-xs mt-1 ${msg.papel === 'lead' ? 'text-alisson-200' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.papel === 'lead' && (
                <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                  <User size={14} className="text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {carregando && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-alisson-500 flex items-center justify-center mr-2 flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {transferirHumano && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 flex items-center gap-2">
              <Zap size={16} />
              <span>Dara solicitou transferencia para atendente humano</span>
            </div>
          )}
        </div>

        {/* Mensagens rapidas */}
        <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
          {MENSAGENS_RAPIDAS.map((m, i) => (
            <button
              key={i}
              onClick={() => enviar(m)}
              disabled={carregando}
              className="flex-shrink-0 text-xs bg-alisson-50 hover:bg-alisson-100 text-alisson-700 border border-alisson-200 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
            >
              {m}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-200 flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Digite como se fosse o lead..."
              disabled={carregando}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-alisson-400 focus:border-alisson-400 disabled:opacity-50"
            />
            <button
              onClick={() => enviar()}
              disabled={carregando || !texto.trim()}
              className="bg-alisson-500 hover:bg-alisson-600 text-white rounded-xl px-4 py-2.5 disabled:opacity-40 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Painel de qualificacao */}
      <div className="w-64 flex flex-col gap-3">
        {/* Score */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lead Score</p>
          <div className="flex items-end gap-2 mb-2">
            <span className={`text-4xl font-bold ${scoreColor}`}>{leadScore}</span>
            <span className="text-gray-400 text-sm mb-1">/100</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${scoreBarColor}`}
              style={{ width: `${leadScore}%` }}
            />
          </div>
          <p className={`text-xs font-medium ${scoreColor}`}>
            {leadScore >= 80 ? 'Quente — transferir consultora' : leadScore >= 55 ? 'Morno — qualificando' : 'Frio — inicio da conversa'}
          </p>
          {scoreBreakdown && (
            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-5 gap-1 text-center">
              {[
                { label: 'N', val: scoreBreakdown.need,      max: 30, title: 'Need' },
                { label: 'B', val: scoreBreakdown.budget,    max: 30, title: 'Budget' },
                { label: 'A', val: scoreBreakdown.authority, max: 15, title: 'Authority' },
                { label: 'T', val: scoreBreakdown.timeline,  max: 20, title: 'Timeline' },
                { label: '+', val: scoreBreakdown.bonus,     max: 5,  title: 'Bonus' },
              ].map(({ label, val, max, title }) => (
                <div key={label} title={`${title}: ${val}/${max}`} className="flex flex-col items-center">
                  <span className={`text-xs font-bold ${val > 0 ? 'text-alisson-600' : 'text-gray-300'}`}>{val}</span>
                  <span className="text-[10px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BANT */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1">
          <button
            onClick={() => setMostrarBant(!mostrarBant)}
            className="flex items-center justify-between w-full mb-3"
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Qualificacao ({bantPreenchido}/5)
            </p>
            {mostrarBant ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {mostrarBant && (
            <div className="space-y-2">
              {bantFields.map(({ key, label, pts }) => {
                const valor = (bant as any)[key];
                const preenchido = !!valor;
                return (
                  <div key={key} className={`rounded-lg p-2.5 border ${preenchido ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-medium text-gray-600">{label}</p>
                      {preenchido && <span className="text-green-500 text-xs">✓</span>}
                      {pts !== undefined && pts !== null && pts > 0 && (
                        <span className="ml-auto text-xs font-semibold text-alisson-600">{pts}pts</span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${preenchido ? 'text-green-700 font-medium' : 'text-gray-400 italic'}`}>
                      {valor || 'Nao coletado'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dica */}
        <div className="bg-alisson-50 border border-alisson-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-alisson-700 mb-1">Como usar</p>
          <ul className="text-xs text-alisson-600 space-y-0.5">
            <li>• Escreva como um cliente real</li>
            <li>• Veja o BANT sendo preenchido</li>
            <li>• Teste objecoes e precos</li>
            <li>• Reinicie para nova conversa</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
