import { useState, useEffect } from 'react';
import { ConversaList } from '../components/mensageria/ConversaList';
import { MensageriaWindow } from '../components/mensageria/MensageriaWindow';
import { DadosExtraidos } from '../components/chat/DadosExtraidos';
import { useMensageria } from '../hooks/useMensageria';
import { Target, CheckCircle, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import api from '../services/api';

// Nomes dos estagios locais do SDR
const STAGE_NAMES: Record<number, string> = {
  0: 'Novo',
  1: 'Primeiro contato',
  2: 'Qualificacao',
  3: 'Qualificado',
};

const STAGE_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-green-100 text-green-700',
};

interface SdrData {
  nome_contato: string;
  telefone: string;
  estagio_atual: number;
  bant_score: number;
  bant_need: string | null;
  bant_budget: string | null;
  bant_timeline: string | null;
  bant_authority: string | null;
  // Novos campos Luma
  estado_sdr: string;
  classificacao: string | null;
  score_total: number;
  score_orcamento: number;
  score_decisor: number;
  score_necessidade: number;
  score_prazo: number;
  score_bonus: number;
  bant_produto: string | null;
  bant_ocasiao: string | null;
  bant_decisor: string | null;
  perfil_lido: string | null;
  tipo_cliente: string;
  atualizado_em: string;
  conversas_sdr: { papel: string; conteudo: string; criado_em: string }[];
}

function BarraScore({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = Math.min((score / max) * 100, 100);
  const cor = pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-yellow-400' : pct >= 25 ? 'bg-blue-400' : 'bg-gray-300';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
        <span>{label}</span>
        <span className="font-bold text-gray-700">{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BadgeClassificacao({ cls }: { cls: string | null }) {
  const mapa: Record<string, string> = {
    QUENTE: 'bg-red-100 text-red-700',
    MORNO: 'bg-yellow-100 text-yellow-700',
    FRIO: 'bg-blue-100 text-blue-700',
    DESCARTE: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mapa[cls || ''] || 'bg-gray-100 text-gray-400'}`}>
      {cls || 'N/A'}
    </span>
  );
}

function BadgeEstado({ estado }: { estado: string }) {
  const mapa: Record<string, string> = {
    COLETA_NOME: 'bg-gray-100 text-gray-600',
    BANT_NEED: 'bg-blue-100 text-blue-700',
    BANT_TIMELINE: 'bg-blue-100 text-blue-700',
    BANT_BUDGET: 'bg-yellow-100 text-yellow-700',
    BANT_AUTHORITY: 'bg-yellow-100 text-yellow-700',
    QUALIFICADO: 'bg-green-100 text-green-700',
    TRANSFERIDO: 'bg-alisson-100 text-alisson-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${mapa[estado] || 'bg-gray-100 text-gray-500'}`}>
      {estado || '---'}
    </span>
  );
}

function CampoBant({ label, valor }: { label: string; valor: string | null }) {
  const preenchido = valor && valor !== 'null';
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      {preenchido ? (
        <CheckCircle size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
      ) : (
        <div className="w-3 h-3 rounded-full border-2 border-gray-200 mt-0.5 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className={`text-xs truncate ${preenchido ? 'font-semibold text-gray-800' : 'text-gray-300 italic'}`}>
          {preenchido ? valor : '---'}
        </p>
      </div>
    </div>
  );
}

function SdrPanel({ conversaId }: { conversaId: string }) {
  const [dados, setDados] = useState<SdrData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarBant, setMostrarBant] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api.get(`/mensageria/conversas/${conversaId}/sdr-info`)
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [conversaId]);

  // Polling a cada 10s para atualizar dados em tempo real
  useEffect(() => {
    if (!dados) return;
    const interval = setInterval(() => {
      api.get(`/mensageria/conversas/${conversaId}/sdr-info`)
        .then(({ data }) => { if (data) setDados(data); })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [conversaId, !!dados]);

  if (carregando) {
    return (
      <div className="p-4 text-center">
        <div className="w-5 h-5 border-2 border-alisson-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!dados) return null;

  const score = dados.score_total || 0;
  const scorePct = Math.min(score / 100, 1) * 100;
  const scoreColor = scorePct >= 80 ? 'text-green-600' : scorePct >= 55 ? 'text-yellow-600' : scorePct >= 25 ? 'text-blue-600' : 'text-gray-400';
  const scoreBarColor = scorePct >= 80 ? 'stroke-green-500' : scorePct >= 55 ? 'stroke-yellow-400' : scorePct >= 25 ? 'stroke-blue-400' : 'stroke-gray-300';

  const stageName = STAGE_NAMES[dados.estagio_atual] || `Estagio ${dados.estagio_atual}`;
  const stageColor = STAGE_COLORS[dados.estagio_atual] || 'bg-gray-100 text-gray-600';

  const bantCampos = [
    { label: 'Produto', valor: dados.bant_produto },
    { label: 'Ocasiao', valor: dados.bant_ocasiao },
    { label: 'Prazo', valor: dados.bant_timeline },
    { label: 'Orcamento', valor: dados.bant_budget },
    { label: 'Decisor', valor: dados.bant_decisor },
  ];
  const bantCompleto = bantCampos.filter(c => c.valor && c.valor !== 'null').length;

  return (
    <div>
      {/* Header */}
      <div className="bg-alisson-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-creme-100" />
          <h2 className="font-medium text-creme-100 text-sm">Qualificacao SDR</h2>
        </div>
      </div>

      {/* Score circular /100 */}
      <div className="p-4 border-b border-gray-100 text-center">
        <div className="relative w-16 h-16 mx-auto">
          <svg width="64" height="64" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" className={scoreBarColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 264} 264`}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-extrabold ${scoreColor}`}>{score}</span>
            <span className="text-[9px] text-gray-400">/100</span>
          </div>
        </div>
        <div className="mt-2">
          <BadgeClassificacao cls={dados.classificacao} />
        </div>
      </div>

      {/* Estado + Dados */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-gray-500">Estado</span>
          <BadgeEstado estado={dados.estado_sdr} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-gray-500">Nome</span>
          <span className={`text-xs font-semibold ${dados.nome_contato ? 'text-alisson-600' : 'text-gray-300'}`}>
            {dados.nome_contato || '---'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-gray-500">Perfil</span>
          <span className={`text-[11px] ${dados.perfil_lido ? 'text-gray-700' : 'text-gray-300'}`}>
            {dados.perfil_lido || '---'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-gray-500">Tipo</span>
          <span className={`text-[11px] font-medium ${dados.tipo_cliente === 'cliente_por_grama' ? 'text-orange-600' : 'text-gray-400'}`}>
            {dados.tipo_cliente === 'cliente_por_grama' ? 'POR GRAMA' : 'normal'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-gray-500">Funil</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${stageColor}`}>
            {stageName}
          </span>
        </div>
      </div>

      {/* Score BANT breakdown */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Score BANT</p>
        <BarraScore score={dados.score_necessidade} max={30} label="N. Necessidade" />
        <BarraScore score={dados.score_orcamento} max={30} label="B. Orcamento" />
        <BarraScore score={dados.score_prazo} max={20} label="T. Prazo" />
        <BarraScore score={dados.score_decisor} max={15} label="A. Decisor" />
        <BarraScore score={dados.score_bonus} max={5} label="Bonus" />
      </div>

      {/* Campos BANT */}
      <div className="px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => setMostrarBant(!mostrarBant)}
          className="flex items-center justify-between w-full mb-1"
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Campos BANT</span>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] ${bantCompleto >= 5 ? 'text-green-600 font-bold' : 'text-gray-400'}`}>{bantCompleto}/5</span>
            {mostrarBant ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
          </div>
        </button>
        {mostrarBant && bantCampos.map(c => (
          <CampoBant key={c.label} label={c.label} valor={c.valor} />
        ))}
      </div>

      {/* Alertas (se existir campo no futuro via API) */}

      {/* Histórico SDR (colapsável) */}
      {dados.conversas_sdr.length > 0 && (
        <div className="border-b border-gray-100">
          <button
            onClick={() => setMostrarHistorico(!mostrarHistorico)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Historico SDR ({dados.conversas_sdr.length})
            </span>
            {mostrarHistorico ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
          </button>

          {mostrarHistorico && (
            <div className="px-4 pb-3 space-y-2 max-h-60 overflow-y-auto">
              {dados.conversas_sdr.map((msg, i) => (
                <div key={i} className={`p-2 rounded-lg text-xs ${msg.papel === 'user' ? 'bg-gray-100 text-gray-700' : 'bg-alisson-50 text-alisson-800'}`}>
                  <div className="flex justify-between mb-0.5">
                    <span className="font-semibold">{msg.papel === 'user' ? 'Cliente' : 'Agente'}</span>
                    <span className="text-gray-400 text-[10px]">
                      {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="line-clamp-3">{(() => {
                    if (msg.papel === 'user') return msg.conteudo;
                    // Agent messages may be stored as JSON — extract "resposta" field
                    try {
                      const parsed = JSON.parse(msg.conteudo);
                      if (parsed.resposta) return parsed.resposta;
                    } catch {}
                    return msg.conteudo;
                  })()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Última atualização */}
      <div className="px-4 py-2">
        <p className="text-[10px] text-gray-400">
          Atualizado: {dados.atualizado_em ? new Date(dados.atualizado_em).toLocaleString('pt-BR') : 'N/A'}
        </p>
      </div>
    </div>
  );
}

export default function Mensageria() {
  const {
    conversas,
    mensagens,
    dadosExtraidos,
    enviando,
    conversaAtual,
    filtroCanal,
    scoring,
    scoringLoading,
    setFiltroCanal,
    selecionarConversa,
    enviarMensagem,
    enviarComDara,
    enviarMidia,
    toggleModoAuto,
    solicitarScoring,
    excluirConversa,
  } = useMensageria();

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Painel esquerdo - Lista de conversas (estilo WhatsApp) */}
        <div className="w-[380px] flex-shrink-0 border-r border-wa-border flex flex-col">
          <ConversaList
            conversas={conversas}
            conversaAtualId={conversaAtual?.id || null}
            filtroCanal={filtroCanal}
            onSelecionar={selecionarConversa}
            onFiltrar={setFiltroCanal}
          />
        </div>

        {/* Painel central - Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <MensageriaWindow
            conversa={conversaAtual}
            mensagens={mensagens}
            enviando={enviando}
            onEnviar={enviarMensagem}
            onEnviarComDara={enviarComDara}
            onEnviarMidia={enviarMidia}
            onToggleModoAuto={toggleModoAuto}
            onExcluir={excluirConversa}
          />
        </div>

        {/* Painel direito - Dados do cliente + Qualificacao SDR */}
        {conversaAtual && (
          <div className="w-[280px] flex-shrink-0 bg-white border-l border-wa-border overflow-y-auto">
            {/* Qualificacao SDR */}
            <SdrPanel conversaId={conversaAtual.id} />

            {/* Dados extraídos da conversa */}
            <div className="border-t border-gray-200">
              <div className="bg-gray-100 px-4 py-3">
                <h2 className="font-medium text-gray-700 text-sm">Dados do Cliente</h2>
              </div>
              <DadosExtraidos
                dados={dadosExtraidos}
                scoring={scoring}
                onSoliciarScoring={solicitarScoring}
                scoringLoading={scoringLoading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
