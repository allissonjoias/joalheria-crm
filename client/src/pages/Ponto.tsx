import { useState, useEffect, useCallback } from 'react';
import { Clock, LogIn, LogOut, Users, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface Registro {
  id: string;
  usuario_id: string;
  tipo: 'entrada' | 'saida';
  observacao: string | null;
  criado_em: string;
}

interface StatusPonto {
  trabalhando: boolean;
  ultimo_registro: Registro | null;
  registros_hoje: Registro[];
  minutos_hoje: number;
}

interface MembroEquipe {
  id: string;
  nome: string;
  papel: string;
  trabalhando: boolean;
  entrada_em: string | null;
  minutos_hoje: number;
}

interface RelatorioUsuario {
  usuario_id: string;
  nome: string;
  papel: string;
  dias_trabalhados: number;
  total_minutos: number;
  total_horas: string;
  dias: { data: string; minutos: number; registros: number }[];
}

function formatarMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function formatarHora(data: string): string {
  return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Relogio em tempo real
function RelogioAtual() {
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center">
      <p className="text-5xl font-light text-gray-800 tabular-nums">
        {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-sm text-gray-400 mt-1">
        {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}

// Botao principal de bater ponto
function BotaoPonto({
  status,
  onBater,
  batendo,
}: {
  status: StatusPonto | null;
  onBater: () => void;
  batendo: boolean;
}) {
  const trabalhando = status?.trabalhando || false;

  return (
    <button
      onClick={onBater}
      disabled={batendo}
      className={`w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
        trabalhando
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : 'bg-green-500 hover:bg-green-600 text-white'
      } ${batendo ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {trabalhando ? (
        <>
          <LogOut size={36} />
          <span className="text-sm font-bold mt-2">SAIDA</span>
        </>
      ) : (
        <>
          <LogIn size={36} />
          <span className="text-sm font-bold mt-2">ENTRADA</span>
        </>
      )}
    </button>
  );
}

// Timeline dos registros do dia
function TimelineHoje({ registros }: { registros: Registro[] }) {
  if (registros.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Nenhum registro hoje</p>;
  }

  return (
    <div className="space-y-2">
      {registros.map((r) => (
        <div key={r.id} className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            r.tipo === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}>
            {r.tipo === 'entrada' ? <LogIn size={14} /> : <LogOut size={14} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {r.tipo === 'entrada' ? 'Entrada' : 'Saida'}
            </p>
            {r.observacao && <p className="text-xs text-gray-400">{r.observacao}</p>}
          </div>
          <span className="text-sm font-mono text-gray-500">{formatarHora(r.criado_em)}</span>
        </div>
      ))}
    </div>
  );
}

// Painel da equipe
function PainelEquipe({ equipe }: { equipe: MembroEquipe[] }) {
  const online = equipe.filter(m => m.trabalhando);
  const offline = equipe.filter(m => !m.trabalhando);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-gray-600" />
        <h3 className="font-semibold text-gray-700">Equipe Hoje</h3>
        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          {online.length} online
        </span>
      </div>

      {online.length > 0 && (
        <div className="space-y-2 mb-4">
          {online.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{m.nome.charAt(0)}</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{m.nome}</p>
                <p className="text-xs text-gray-400">
                  Desde {m.entrada_em ? formatarHora(m.entrada_em) : '--:--'}
                </p>
              </div>
              <span className="text-xs font-mono text-green-700 bg-green-100 px-2 py-0.5 rounded">
                {formatarMinutos(m.minutos_hoje)}
              </span>
            </div>
          ))}
        </div>
      )}

      {offline.length > 0 && (
        <div className="space-y-2">
          {offline.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{m.nome.charAt(0)}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-400 truncate">{m.nome}</p>
              </div>
              {m.minutos_hoje > 0 && (
                <span className="text-xs font-mono text-gray-400">
                  {formatarMinutos(m.minutos_hoje)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Relatorio mensal
function RelatorioMensal() {
  const agora = new Date();
  const [mes, setMes] = useState(`${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`);
  const [dados, setDados] = useState<RelatorioUsuario[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/ponto/relatorio', { params: { mes } });
      setDados(data);
    } catch {
      setDados([]);
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const mudarMes = (delta: number) => {
    const [ano, m] = mes.split('-').map(Number);
    const d = new Date(ano, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nomeMes = new Date(Number(mes.split('-')[0]), Number(mes.split('-')[1]) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-600" />
          <h3 className="font-semibold text-gray-700">Relatorio Mensal</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => mudarMes(-1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-600 capitalize min-w-32 text-center">{nomeMes}</span>
          <button onClick={() => mudarMes(1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-alisson-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : dados.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Sem dados para este mes</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Funcionario</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Dias</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Horas</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Media/dia</th>
              </tr>
            </thead>
            <tbody>
              {dados.map(u => {
                const mediaDia = u.dias_trabalhados > 0 ? u.total_minutos / u.dias_trabalhados : 0;
                return (
                  <tr key={u.usuario_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-alisson-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{u.nome.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-gray-800">{u.nome}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{u.dias_trabalhados}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-gray-700">{u.total_horas}h</td>
                    <td className="py-2.5 px-3 text-center font-mono text-gray-500">{formatarMinutos(Math.round(mediaDia))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Ponto() {
  const [status, setStatus] = useState<StatusPonto | null>(null);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [batendo, setBatendo] = useState(false);

  const carregarStatus = useCallback(async () => {
    try {
      const [statusRes, equipeRes] = await Promise.all([
        api.get('/ponto/status'),
        api.get('/ponto/equipe'),
      ]);
      setStatus(statusRes.data);
      setEquipe(equipeRes.data);
    } catch (e) {
      console.error('Erro ao carregar ponto:', e);
    }
  }, []);

  useEffect(() => {
    carregarStatus();
    const interval = setInterval(carregarStatus, 30000);
    return () => clearInterval(interval);
  }, [carregarStatus]);

  const baterPonto = async () => {
    setBatendo(true);
    try {
      await api.post('/ponto/bater');
      await carregarStatus();
    } catch (e) {
      console.error('Erro ao bater ponto:', e);
    } finally {
      setBatendo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock size={24} className="text-alisson-600" />
        <h1 className="text-2xl font-bold text-gray-800">Ponto</h1>
        {status?.trabalhando && (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full animate-pulse">
            TRABALHANDO
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal - Bater ponto */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card relogio + botao */}
          <div className="bg-white rounded-xl shadow-sm border p-8">
            <div className="flex flex-col items-center gap-8">
              <RelogioAtual />
              <BotaoPonto status={status} onBater={baterPonto} batendo={batendo} />
              {status && (
                <div className="text-center">
                  <p className="text-lg font-mono text-alisson-600 font-bold">
                    {formatarMinutos(status.minutos_hoje)}
                  </p>
                  <p className="text-xs text-gray-400">trabalhado hoje</p>
                </div>
              )}
            </div>
          </div>

          {/* Registros de hoje */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-gray-600" />
              <h3 className="font-semibold text-gray-700">Registros de Hoje</h3>
            </div>
            <TimelineHoje registros={status?.registros_hoje || []} />
          </div>

          {/* Relatorio mensal */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <RelatorioMensal />
          </div>
        </div>

        {/* Coluna lateral - Equipe */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <PainelEquipe equipe={equipe} />
          </div>
        </div>
      </div>
    </div>
  );
}
