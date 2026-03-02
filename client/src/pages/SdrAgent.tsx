import { useState } from 'react';
import { Bot, Play, Square, RefreshCw, Send, Bell, Settings, Activity, Clock, Zap } from 'lucide-react';
import { useSdrAgent } from '../hooks/useSdrAgent';

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

export default function SdrAgent() {
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
    try {
      await fn();
    } catch {}
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="text-alisson-500" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Agente SDR</h1>
            <p className="text-sm text-gray-500">Monitoramento automatico do Kommo CRM via WhatsApp</p>
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Status */}
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
                {status?.ultimo_polling
                  ? new Date(status.ultimo_polling).toLocaleString('pt-BR')
                  : 'Nunca'}
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

        {/* Card 2: Configuracao */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={20} />
              Configuracao
            </h2>
            {!editando ? (
              <button
                onClick={handleIniciarEditar}
                className="text-sm text-alisson-500 hover:text-alisson-600 font-medium"
              >
                Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditando(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarConfig}
                  className="text-sm bg-alisson-500 hover:bg-alisson-600 text-white px-3 py-1 rounded"
                >
                  Salvar
                </button>
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
                    min={1}
                    max={60}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-alisson-500 focus:border-alisson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dias p/ Inatividade</label>
                  <input
                    type="number"
                    value={formConfig.dias_inatividade || 7}
                    onChange={(e) => setFormConfig({ ...formConfig, dias_inatividade: parseInt(e.target.value) })}
                    min={1}
                    max={90}
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
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Acoes Automaticas</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!formConfig.auto_criar_tasks}
                      onChange={(e) => setFormConfig({ ...formConfig, auto_criar_tasks: e.target.checked ? 1 : 0 })}
                      className="rounded border-gray-300 text-alisson-500 focus:ring-alisson-500"
                    />
                    Criar task "Primeiro contato" para novos leads
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!formConfig.auto_followup}
                      onChange={(e) => setFormConfig({ ...formConfig, auto_followup: e.target.checked ? 1 : 0 })}
                      className="rounded border-gray-300 text-alisson-500 focus:ring-alisson-500"
                    />
                    Criar follow-up para leads inativos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!formConfig.auto_mover_leads}
                      onChange={(e) => setFormConfig({ ...formConfig, auto_mover_leads: e.target.checked ? 1 : 0 })}
                      className="rounded border-gray-300 text-alisson-500 focus:ring-alisson-500"
                    />
                    Criar task pos-venda ao fechar venda
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Telefone Admin:</span>
                <span className="text-gray-800">{config?.telefone_admin || 'Nao configurado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Polling:</span>
                <span className="text-gray-800">A cada {config?.intervalo_polling || 5} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resumo manha:</span>
                <span className="text-gray-800 font-mono text-xs">{config?.cron_resumo_manha || '0 8 * * 1-6'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resumo tarde:</span>
                <span className="text-gray-800 font-mono text-xs">{config?.cron_resumo_tarde || '0 17 * * 1-6'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Inatividade:</span>
                <span className="text-gray-800">{config?.dias_inatividade || 7} dias</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-medium text-gray-600 mb-1">Acoes Automaticas</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${config?.auto_criar_tasks ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    Criar Tasks {config?.auto_criar_tasks ? 'ON' : 'OFF'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${config?.auto_followup ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    Follow-up {config?.auto_followup ? 'ON' : 'OFF'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${config?.auto_mover_leads ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    Pos-venda {config?.auto_mover_leads ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Atividade Recente */}
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
                    filtroTipo === t.valor
                      ? 'bg-alisson-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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

        {/* Card 4: Acoes Manuais */}
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
