import { useState, useRef, useEffect } from 'react';
import {
  Bot, Plus, Send, RotateCcw, Trash2, Save, Image, Settings,
  ChevronDown, ChevronUp, ArrowLeft, Loader2, Pencil, X,
  Paperclip, Camera, Video, Mic, FileText, Play, Pause, Download,
  Target, Flame, ThermometerSun, Snowflake, List,
  Brain, Zap,
} from 'lucide-react';
import api from '../services/api';
import { SkillsPanel } from '../components/agentes/SkillsPanel';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Agente {
  id: number;
  nome: string;
  area: string;
  prompt_sistema?: string;
  foto_url: string | null;
  ativo: number;
  max_tokens?: number;
  temperatura?: number;
}

type TipoMidia = 'imagem' | 'video' | 'audio' | 'documento';

interface MidiaSim {
  tipo: TipoMidia;
  url: string;
  nome_arquivo: string;
  tamanho?: number;
  mimetype?: string;
  transcricao?: string | null;
}

interface MensagemSim {
  papel: 'lead' | 'agente';
  texto: string;
  hora: Date;
  json?: any;
  midia?: MidiaSim;
}

interface EstadoLead {
  nome: string;
  estado: string;
  score: number;
  classificacao: string;
  tentativas_nome: number;
  campos: {
    produto: string | null;
    ocasiao: string | null;
    prazo: string | null;
    orcamento: string | null;
    decisor: string | null;
  };
  perfil: string | null;
  tipo_cliente: string;
  alertas: string | null;
  data_estrategica: string | null;
  proxima_acao: string | null;
  pontuacao_detalhe: {
    total: number;
    orcamento: number;
    decisor: number;
    necessidade: number;
    prazo: number;
    bonus: number;
    justificativa: string;
  } | null;
}

const ESTADO_INICIAL: EstadoLead = {
  nome: 'nao coletado',
  estado: 'COLETA_NOME',
  score: 0,
  classificacao: 'nao classificado',
  tentativas_nome: 0,
  campos: { produto: null, ocasiao: null, prazo: null, orcamento: null, decisor: null },
  perfil: null,
  tipo_cliente: 'normal',
  alertas: null,
  data_estrategica: null,
  proxima_acao: null,
  pontuacao_detalhe: null,
};

const AREAS = [
  { valor: 'sdr', label: 'SDR' },
  { valor: 'vendas', label: 'Vendas' },
  { valor: 'pos_venda', label: 'Pos-Venda' },
  { valor: 'sucesso_cliente', label: 'Sucesso do Cliente' },
];

const AREA_CORES: Record<string, string> = {
  sdr: 'bg-blue-100 text-blue-700',
  vendas: 'bg-green-100 text-green-700',
  pos_venda: 'bg-purple-100 text-purple-700',
  sucesso_cliente: 'bg-orange-100 text-orange-700',
};

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function BarraScore({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = Math.min((score / max) * 100, 100);
  const cor = pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-yellow-400' : pct >= 25 ? 'bg-blue-400' : 'bg-gray-300';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-bold text-gray-700">{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BadgeClassificacao({ cls }: { cls: string }) {
  const mapa: Record<string, string> = {
    QUENTE: 'bg-red-100 text-red-700',
    MORNO: 'bg-yellow-100 text-yellow-700',
    FRIO: 'bg-blue-100 text-blue-700',
    DESCARTE: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${mapa[cls] || 'bg-gray-100 text-gray-500'}`}>
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
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${mapa[estado] || 'bg-gray-100 text-gray-500'}`}>
      {estado || '---'}
    </span>
  );
}

function CampoBant({ label, valor }: { label: string; valor: string | null }) {
  const preenchido = valor && valor !== 'null';
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs max-w-[160px] text-right truncate ${preenchido ? 'font-semibold text-gray-800' : 'text-gray-300'}`}>
        {preenchido ? valor : '---'}
      </span>
    </div>
  );
}

function buildContexto(state: EstadoLead, historico: MensagemSim[]): string {
  const hist = historico.length > 0
    ? historico.slice(-6).map(m => `${m.papel === 'lead' ? 'Lead' : 'Agente'}: ${m.texto}`).join('\n  ')
    : 'primeira interacao';

  return `[CONTEXTO DO LEAD]
Nome: ${state.nome}
Estado: ${state.estado}
Score atual: ${state.score}
Classificacao: ${state.classificacao}
Tentativas de coleta de nome: ${state.tentativas_nome}
Campos coletados:
  produto: ${state.campos.produto || 'nao coletado'}
  ocasiao: ${state.campos.ocasiao || 'nao coletado'}
  prazo: ${state.campos.prazo || 'nao coletado'}
  orcamento: ${state.campos.orcamento || 'nao coletado'}
  decisor: ${state.campos.decisor || 'nao coletado'}
Historico resumido:
  ${hist}
[FIM DO CONTEXTO]`;
}

// ─── Pagina principal ────────────────────────────────────────────────────────

export default function AgentesIA() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [agenteSelecionado, setAgenteSelecionado] = useState<Agente | null>(null);
  const [tela, setTela] = useState<'lista' | 'criar' | 'editar' | 'simular'>('lista');
  const [abaGlobal, setAbaGlobal] = useState<'agentes' | 'qualificacao'>('agentes');

  useEffect(() => {
    carregarAgentes();
  }, []);

  const carregarAgentes = async () => {
    try {
      const { data } = await api.get('/agentes-ia');
      setAgentes(data);
    } catch {}
    setCarregando(false);
  };

  const abrirCriar = () => {
    setAgenteSelecionado(null);
    setTela('criar');
  };

  const abrirEditar = (ag: Agente) => {
    setAgenteSelecionado(ag);
    setTela('editar');
  };

  const abrirSimular = (ag: Agente) => {
    setAgenteSelecionado(ag);
    setTela('simular');
  };

  const voltar = () => {
    setTela('lista');
    setAgenteSelecionado(null);
    carregarAgentes();
  };

  const excluirAgente = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;
    try {
      await api.delete(`/agentes-ia/${id}`);
      carregarAgentes();
    } catch {}
  };

  const toggleAtivoAgente = async (ag: Agente) => {
    try {
      await api.put(`/agentes-ia/${ag.id}`, { ativo: ag.ativo ? 0 : 1 });
      carregarAgentes();
    } catch {}
  };

  if (tela === 'criar' || tela === 'editar') {
    return <FormAgente agente={agenteSelecionado} onVoltar={voltar} onSalvo={voltar} />;
  }

  if (tela === 'simular' && agenteSelecionado) {
    return <Simulador agente={agenteSelecionado} onVoltar={voltar} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header com abas */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <Bot className="text-alisson-500" size={20} />
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800">Agentes IA</h1>
            <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block">Arquitetura Multi-Agente com Skills Inteligentes</p>
          </div>
        </div>
        {abaGlobal === 'agentes' && (
          <button
            onClick={abrirCriar}
            className="flex items-center gap-2 px-4 py-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            Novo Agente
          </button>
        )}
      </div>

      {/* Abas globais */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setAbaGlobal('agentes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            abaGlobal === 'agentes' ? 'border-alisson-500 text-alisson-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bot size={16} />
          Agentes
        </button>
        <button
          onClick={() => setAbaGlobal('qualificacao')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            abaGlobal === 'qualificacao' ? 'border-alisson-500 text-alisson-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target size={16} />
          Qualificacao
        </button>
      </div>

      {abaGlobal === 'qualificacao' ? (
        <QualificacaoLocalPanel />
      ) : (
        <>
          {/* Lista de agentes */}
          {carregando ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-alisson-500" size={32} />
            </div>
          ) : agentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Bot size={48} className="mb-3 opacity-30" />
              <p className="font-medium text-gray-500">Nenhum agente criado</p>
              <p className="text-sm mt-1">Clique em "Novo Agente" para comecar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentes.map(ag => (
                <div key={ag.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      {ag.foto_url ? (
                        <img src={ag.foto_url} alt={ag.nome} className={`w-12 h-12 rounded-full object-cover border-2 ${ag.ativo ? 'border-alisson-200' : 'border-gray-300 opacity-50'}`} />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${ag.ativo ? 'bg-alisson-100' : 'bg-gray-100'}`}>
                          <Bot size={22} className={ag.ativo ? 'text-alisson-500' : 'text-gray-400'} />
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${ag.ativo ? 'bg-green-400' : 'bg-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${ag.ativo ? 'text-gray-800' : 'text-gray-400'}`}>{ag.nome}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${AREA_CORES[ag.area] || 'bg-gray-100 text-gray-600'}`}>
                          {AREAS.find(a => a.valor === ag.area)?.label || ag.area}
                        </span>
                        <span className={`text-xs ${ag.ativo ? 'text-green-600' : 'text-gray-400'}`}>
                          {ag.ativo ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-600 text-xs font-medium">
                      <Brain size={12} />
                      Multi-Agente
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-gray-500 text-xs">
                      <Zap size={12} />
                      Skills
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirSimular(ag)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-alisson-50 hover:bg-alisson-100 text-alisson-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Send size={14} />
                      Simular
                    </button>
                    <button
                      onClick={() => toggleAtivoAgente(ag)}
                      title={ag.ativo ? 'Pausar agente' : 'Ativar agente'}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                        ag.ativo
                          ? 'bg-green-50 hover:bg-orange-50 text-green-600 hover:text-orange-500'
                          : 'bg-orange-50 hover:bg-green-50 text-orange-500 hover:text-green-600'
                      }`}
                    >
                      {ag.ativo ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => abrirEditar(ag)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => excluirAgente(ag.id)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Formulario de criar/editar agente ───────────────────────────────────────

function FormAgente({ agente, onVoltar, onSalvo }: { agente: Agente | null; onVoltar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState(agente?.nome || '');
  const [area, setArea] = useState(agente?.area || 'sdr');
  const [maxTokens, setMaxTokens] = useState(agente?.max_tokens ?? 500);
  const [temperatura, setTemperatura] = useState(agente?.temperatura ?? 0.7);
  const [fotoPreview, setFotoPreview] = useState<string | null>(agente?.foto_url || null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFotoPreview(result);
      setFotoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    if (!nome.trim()) return alert('Nome e obrigatorio');
    setSalvando(true);
    try {
      let id = agente?.id;
      if (agente) {
        await api.put(`/agentes-ia/${agente.id}`, { nome, area, max_tokens: maxTokens, temperatura });
      } else {
        const { data } = await api.post('/agentes-ia', { nome, area, max_tokens: maxTokens, temperatura });
        id = data.id;
      }

      if (fotoBase64 && id) {
        await api.post(`/agentes-ia/${id}/foto`, { foto_base64: fotoBase64 });
      }

      onSalvo();
    } catch (e: any) {
      alert('Erro ao salvar: ' + (e.response?.data?.erro || e.message));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onVoltar} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{agente ? 'Editar Agente' : 'Novo Agente'}</h1>
          <p className="text-xs text-gray-500">Configure o agente e suas skills multi-agente</p>
        </div>
        <button
          onClick={salvar}
          disabled={salvando}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Coluna esquerda: configs */}
        <div className="w-80 flex-shrink-0 space-y-5">
          {/* Foto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Foto do Atendente</p>
            <div className="flex items-center gap-4">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Foto" className="w-16 h-16 rounded-full object-cover border-2 border-alisson-200" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-alisson-100 flex items-center justify-center">
                  <Bot size={28} className="text-alisson-400" />
                </div>
              )}
              <div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                >
                  <Image size={14} />
                  {fotoPreview ? 'Trocar foto' : 'Enviar foto'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />
                <p className="text-[10px] text-gray-400 mt-1">JPG ou PNG, max 10MB</p>
              </div>
            </div>
          </div>

          {/* Nome */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nome do Agente</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Luma, Sofia, Ana..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-alisson-400 focus:border-alisson-400"
            />
          </div>

          {/* Area */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Area de Atuacao</label>
            <div className="grid grid-cols-2 gap-2">
              {AREAS.map(a => (
                <button
                  key={a.valor}
                  onClick={() => setArea(a.valor)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-colors border ${
                    area === a.valor
                      ? 'bg-alisson-50 border-alisson-300 text-alisson-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Configuracao de IA */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Configuracao da IA</label>

            {/* Max Tokens */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-600">Max Tokens (resposta)</span>
                <span className="text-xs font-bold text-alisson-600">{maxTokens}</span>
              </div>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={maxTokens}
                onChange={e => setMaxTokens(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-alisson-500"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>100 (rapida)</span>
                <span>2000 (detalhada)</span>
              </div>
            </div>

            {/* Temperatura */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-600">Temperatura (criatividade)</span>
                <span className="text-xs font-bold text-alisson-600">{temperatura.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperatura}
                onChange={e => setTemperatura(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-alisson-500"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0.0 (precisa)</span>
                <span>1.0 (criativa)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita: Skills (cerebro do agente) */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden min-h-0">
          <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <h2 className="font-semibold text-alisson-600 text-sm flex items-center gap-2">
              <Settings size={16} className="text-alisson-500" />
              Cerebro do Agente - Multi-Agente
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Agente mestre + sub-agentes especializados</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {agente?.id ? (
              <SkillsPanel agentId={agente.id} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Salve o agente primeiro para configurar as skills</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente de midia no chat ─────────────────────────────────────────────

function formatarTamanho(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MidiaChat({ midia, isLead }: { midia: MidiaSim; isLead: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  if (midia.tipo === 'imagem') {
    return (
      <div className="mb-1.5 rounded-lg overflow-hidden max-w-[260px]">
        <img src={midia.url} alt={midia.nome_arquivo} className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(midia.url, '_blank')} />
      </div>
    );
  }

  if (midia.tipo === 'video') {
    return (
      <div className="mb-1.5 rounded-lg overflow-hidden max-w-[280px]">
        <video src={midia.url} controls className="w-full rounded-lg" preload="metadata" />
      </div>
    );
  }

  if (midia.tipo === 'audio') {
    return (
      <div className="mb-1.5">
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl min-w-[200px] ${isLead ? 'bg-alisson-600/30' : 'bg-gray-100'}`}>
          <button onClick={toggleAudio} className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isLead ? 'bg-white/20 hover:bg-white/30' : 'bg-alisson-500 hover:bg-alisson-600'}`}>
            {playing ? <Pause size={16} className={isLead ? 'text-white' : 'text-white'} /> : <Play size={16} className={isLead ? 'text-white' : 'text-white'} />}
          </button>
          <div className="flex-1">
            <div className={`h-1 rounded-full ${isLead ? 'bg-white/30' : 'bg-gray-300'}`}>
              <div className={`h-full rounded-full w-0 ${isLead ? 'bg-white' : 'bg-alisson-500'}`} />
            </div>
            {midia.transcricao && (
              <p className={`text-[10px] mt-1.5 italic leading-relaxed ${isLead ? 'text-alisson-100' : 'text-gray-400'}`}>
                "{midia.transcricao}"
              </p>
            )}
          </div>
          <Mic size={14} className={isLead ? 'text-alisson-200' : 'text-gray-400'} />
        </div>
        <audio ref={audioRef} src={midia.url} onEnded={() => setPlaying(false)} preload="metadata" />
      </div>
    );
  }

  // documento
  const extMap: Record<string, string> = {
    '.pdf': 'PDF', '.doc': 'DOC', '.docx': 'DOCX', '.xls': 'XLS', '.xlsx': 'XLSX', '.txt': 'TXT', '.csv': 'CSV',
  };
  const ext = midia.nome_arquivo.substring(midia.nome_arquivo.lastIndexOf('.')).toLowerCase();
  const tipoLabel = extMap[ext] || ext.replace('.', '').toUpperCase();

  return (
    <div className="mb-1.5">
      <a href={midia.url} target="_blank" rel="noopener noreferrer"
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl min-w-[200px] transition-colors ${
          isLead ? 'bg-alisson-600/30 hover:bg-alisson-600/40' : 'bg-gray-100 hover:bg-gray-150'
        }`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isLead ? 'bg-white/20' : 'bg-red-50'}`}>
          <FileText size={20} className={isLead ? 'text-white' : 'text-red-500'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${isLead ? 'text-white' : 'text-gray-800'}`}>{midia.nome_arquivo}</p>
          <p className={`text-[10px] ${isLead ? 'text-alisson-200' : 'text-gray-400'}`}>
            {tipoLabel} {midia.tamanho ? `· ${formatarTamanho(midia.tamanho)}` : ''}
          </p>
        </div>
        <Download size={14} className={isLead ? 'text-alisson-200' : 'text-gray-400'} />
      </a>
    </div>
  );
}

// ─── Qualificacao Panel (Local) ───────────────────────────────────────────────

const CLS_CORES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  QUENTE: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: <Flame size={14} className="text-red-500" /> },
  MORNO: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: <ThermometerSun size={14} className="text-yellow-500" /> },
  FRIO: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: <Snowflake size={14} className="text-blue-500" /> },
  DESCARTE: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', icon: <Trash2 size={14} className="text-gray-400" /> },
};

function QualificacaoLocalPanel() {
  const [leads, setLeads] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroClass, setFiltroClass] = useState('');

  useEffect(() => { carregarLeads(); }, []);

  const carregarLeads = async (cls?: string) => {
    setCarregando(true);
    try {
      const p = cls ? `?classificacao=${cls}&limite=100` : '?limite=100';
      const res = await api.get(`/sdr-agent/qualificacao/leads${p}`);
      setLeads(res.data);
    } catch {}
    finally { setCarregando(false); }
  };

  const classificacoes = ['QUENTE', 'MORNO', 'FRIO', 'DESCARTE'];
  const totalPorCls = classificacoes.reduce((acc, c) => { acc[c] = leads.filter(l => l.classificacao === c).length; return acc; }, {} as Record<string, number>);

  if (carregando) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-alisson-500" size={32} /></div>;

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pb-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {classificacoes.map(c => {
          const cor = CLS_CORES[c];
          return (
            <button key={c} onClick={() => { setFiltroClass(filtroClass === c ? '' : c); carregarLeads(filtroClass === c ? undefined : c); }}
              className={`rounded-xl border p-4 text-left transition-all ${filtroClass === c ? 'ring-2 ring-alisson-500' : ''} ${cor.bg}`}>
              <div className="flex items-center gap-2 mb-1">{cor.icon}<span className={`text-xs font-semibold uppercase ${cor.text}`}>{c}</span></div>
              <p className={`text-2xl font-bold ${cor.text}`}>{totalPorCls[c] || 0}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><List size={20} className="text-alisson-500" /> Clientes Qualificados</h3>
          <div className="flex gap-1">
            <button onClick={() => { setFiltroClass(''); carregarLeads(); }} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${!filtroClass ? 'bg-alisson-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todos</button>
            {classificacoes.map(c => {
              const cor = CLS_CORES[c];
              return <button key={c} onClick={() => { setFiltroClass(c); carregarLeads(c); }} className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${filtroClass === c ? 'bg-alisson-500 text-white' : `${cor.bg} ${cor.text} hover:opacity-80`}`}>{cor.icon}{c}</button>;
            })}
          </div>
        </div>
        {leads.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Target size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum lead qualificado ainda</p>
            <p className="text-xs mt-1">Os leads serao qualificados automaticamente durante as conversas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Telefone</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Nota</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Class.</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Necessidade</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Orcamento</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Prazo</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Decisor</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l: any) => {
                  const cor = CLS_CORES[l.classificacao] || CLS_CORES.FRIO;
                  const sc = l.lead_score >= 80 ? 'text-green-600' : l.lead_score >= 55 ? 'text-yellow-600' : 'text-red-500';
                  return (
                    <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-2 font-mono text-xs text-gray-700">{l.telefone ? `...${l.telefone.slice(-4)}` : '-'}</td>
                      <td className="py-2.5 px-2"><span className={`font-bold ${sc}`}>{l.lead_score}</span><span className="text-gray-400 text-xs">/100</span></td>
                      <td className="py-2.5 px-2"><span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cor.bg} ${cor.text}`}>{cor.icon}{l.classificacao}</span></td>
                      <td className="py-2.5 px-2 text-xs text-gray-600 max-w-[120px] truncate">{l.bant_need || <span className="text-gray-300">-</span>}{l.bant_need_score > 0 && <span className="text-alisson-500 ml-1">({l.bant_need_score})</span>}</td>
                      <td className="py-2.5 px-2 text-xs text-gray-600">{l.bant_budget || <span className="text-gray-300">-</span>}{l.bant_budget_score > 0 && <span className="text-alisson-500 ml-1">({l.bant_budget_score})</span>}</td>
                      <td className="py-2.5 px-2 text-xs text-gray-600">{l.bant_timeline || <span className="text-gray-300">-</span>}{l.bant_timeline_score > 0 && <span className="text-alisson-500 ml-1">({l.bant_timeline_score})</span>}</td>
                      <td className="py-2.5 px-2 text-xs text-gray-600">{l.bant_authority || <span className="text-gray-300">-</span>}{l.bant_authority_score > 0 && <span className="text-alisson-500 ml-1">({l.bant_authority_score})</span>}</td>
                      <td className="py-2.5 px-2 text-xs text-gray-400 whitespace-nowrap">{l.atualizado_em ? new Date(l.atualizado_em).toLocaleString('pt-BR') : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Simulador ───────────────────────────────────────────────────────────────

function Simulador({ agente: agenteInicial, onVoltar }: { agente: Agente; onVoltar: () => void }) {
  const [agente, setAgente] = useState<Agente>(agenteInicial);
  const [mensagens, setMensagens] = useState<MensagemSim[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [estado, setEstado] = useState<EstadoLead>({ ...ESTADO_INICIAL });
  const [jsonBruto, setJsonBruto] = useState<any>(null);
  const [mostrarJson, setMostrarJson] = useState(false);
  const [mostrarBant, setMostrarBant] = useState(true);
  const [apiMsgs, setApiMsgs] = useState<{ role: string; content: string }[]>([]);
  const [menuAnexo, setMenuAnexo] = useState(false);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [uploadando, setUploadando] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuAnexoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [mensagens, carregando]);

  // Fechar menu de anexo ao clicar fora
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuAnexoRef.current && !menuAnexoRef.current.contains(e.target as Node)) {
        setMenuAnexo(false);
      }
    };
    if (menuAnexo) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuAnexo]);

  const uploadArquivo = async (file: globalThis.File, tipoEsperado?: string) => {
    setUploadando(true);
    setMenuAnexo(false);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      // NAO setar Content-Type manualmente - axios gera o boundary automaticamente
      const { data } = await api.post(`/agentes-ia/${agente.id}/upload-midia`, formData);

      const midia: MidiaSim = {
        tipo: data.tipo,
        url: data.url,
        nome_arquivo: data.nome_arquivo,
        tamanho: data.tamanho,
        mimetype: data.mimetype,
        transcricao: data.transcricao,
      };

      // Texto descritivo para a IA entender o que o lead enviou
      const descricoes: Record<string, string> = {
        imagem: `[Cliente enviou uma FOTO: ${file.name}]`,
        video: `[Cliente enviou um VIDEO: ${file.name}]`,
        audio: data.transcricao
          ? `[Cliente enviou um AUDIO. Transcricao: "${data.transcricao}"]`
          : `[Cliente enviou um AUDIO de ${formatarTamanho(file.size)}]`,
        documento: `[Cliente enviou um DOCUMENTO: ${file.name} (${formatarTamanho(file.size)})]`,
      };
      const textoMidia = descricoes[data.tipo] || `[Cliente enviou um arquivo: ${file.name}]`;

      await enviarComMidia(textoMidia, midia);
    } catch (e: any) {
      alert('Erro no upload: ' + (e.response?.data?.erro || e.message));
    } finally {
      setUploadando(false);
    }
  };

  const selecionarArquivo = (accept: string) => {
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (file) await uploadArquivo(file);
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Detectar melhor mimeType suportado pelo navegador
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else mimeType = ''; // deixar o browser decidir
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      const usedMime = recorder.mimeType || mimeType || 'audio/webm';
      const ext = usedMime.includes('ogg') ? '.ogg' : usedMime.includes('mp4') ? '.m4a' : '.webm';

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: usedMime });
        const file = new globalThis.File([blob], `audio-gravado${ext}`, { type: usedMime });
        await uploadArquivo(file, 'audio');
      };

      recorder.start();
      setMediaRecorder(recorder);
      setGravandoAudio(true);
    } catch (e) {
      console.error('Erro ao acessar microfone:', e);
      alert('Nao foi possivel acessar o microfone. Verifique as permissoes do navegador.');
    }
  };

  const pararGravacao = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setGravandoAudio(false);
    setMediaRecorder(null);
  };

  // Enviar mensagem com midia
  const enviarComMidia = async (textoParaIA: string, midia: MidiaSim) => {
    const novaMsg: MensagemSim = {
      papel: 'lead',
      texto: midia.tipo === 'audio' && midia.transcricao ? midia.transcricao : '',
      hora: new Date(),
      midia,
    };
    setMensagens(prev => [...prev, novaMsg]);
    setCarregando(true);

    const contexto = buildContexto(estado, mensagens);
    const conteudoUser = `${contexto}\n\n${textoParaIA}`;
    const msgObj: any = { role: 'user', content: conteudoUser };
    // Enviar URL da mídia para o backend poder usar Vision
    if ((midia.tipo === 'imagem' || midia.tipo === 'video') && midia.url) {
      msgObj.midia_url = midia.url;
      msgObj.tipo_midia = midia.tipo;
    }
    const novasApiMsgs = [...apiMsgs, msgObj];

    try {
      const { data } = await api.post(`/agentes-ia/${agente.id}/simular`, {
        mensagens: novasApiMsgs,
      });

      const raw = data.resposta || '';
      const parsed = data.dados;

      if (parsed && parsed.resposta) {
        setJsonBruto(parsed);
        setEstado(prev => ({
          ...prev,
          estado: parsed.estado_novo || prev.estado,
          score: parsed.pontuacao?.total ?? prev.score,
          classificacao: parsed.classificacao || prev.classificacao,
          perfil: parsed.perfil_lido || prev.perfil,
          tipo_cliente: parsed.tipo_cliente || prev.tipo_cliente,
          alertas: parsed.alertas_consultora || prev.alertas,
          data_estrategica: parsed.data_estrategica || prev.data_estrategica,
          proxima_acao: parsed.proxima_acao || prev.proxima_acao,
          pontuacao_detalhe: parsed.pontuacao || prev.pontuacao_detalhe,
          nome: parsed.nome_lead || prev.nome,
          tentativas_nome: parsed.nome_lead ? prev.tentativas_nome : (prev.estado === 'COLETA_NOME' ? prev.tentativas_nome + 1 : prev.tentativas_nome),
          campos: {
            produto: parsed.campos_bant?.produto || prev.campos.produto,
            ocasiao: parsed.campos_bant?.ocasiao || prev.campos.ocasiao,
            prazo: parsed.campos_bant?.prazo || prev.campos.prazo,
            orcamento: parsed.campos_bant?.orcamento || prev.campos.orcamento,
            decisor: parsed.campos_bant?.decisor || prev.campos.decisor,
          },
        }));
        const msgAgente: MensagemSim = { papel: 'agente', texto: parsed.resposta, hora: new Date(), json: parsed };
        setMensagens(prev => [...prev, msgAgente]);
        setApiMsgs([...novasApiMsgs, { role: 'assistant', content: JSON.stringify(parsed) }]);
      } else {
        const msgAgente: MensagemSim = { papel: 'agente', texto: raw, hora: new Date() };
        setMensagens(prev => [...prev, msgAgente]);
        setApiMsgs([...novasApiMsgs, { role: 'assistant', content: raw }]);
      }
    } catch (e: any) {
      const erro = e.response?.data?.erro || e.message || 'Erro desconhecido';
      setMensagens(prev => [...prev, { papel: 'agente', texto: `[Erro: ${erro}]`, hora: new Date() }]);
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const enviar = async () => {
    if (!input.trim() || carregando) return;
    const texto = input.trim();
    setInput('');

    const novaMsg: MensagemSim = { papel: 'lead', texto, hora: new Date() };
    setMensagens(prev => [...prev, novaMsg]);
    setCarregando(true);

    const contexto = buildContexto(estado, mensagens);
    const conteudoUser = `${contexto}\n\nMensagem do lead: "${texto}"`;
    const novasApiMsgs = [...apiMsgs, { role: 'user', content: conteudoUser }];

    try {
      const { data } = await api.post(`/agentes-ia/${agente.id}/simular`, {
        mensagens: novasApiMsgs,
      });

      const raw = data.resposta || '';
      const parsed = data.dados;

      if (parsed && parsed.resposta) {
        setJsonBruto(parsed);

        setEstado(prev => ({
          ...prev,
          estado: parsed.estado_novo || prev.estado,
          score: parsed.pontuacao?.total ?? prev.score,
          classificacao: parsed.classificacao || prev.classificacao,
          perfil: parsed.perfil_lido || prev.perfil,
          tipo_cliente: parsed.tipo_cliente || prev.tipo_cliente,
          alertas: parsed.alertas_consultora || prev.alertas,
          data_estrategica: parsed.data_estrategica || prev.data_estrategica,
          proxima_acao: parsed.proxima_acao || prev.proxima_acao,
          pontuacao_detalhe: parsed.pontuacao || prev.pontuacao_detalhe,
          nome: parsed.nome_lead || prev.nome,
          tentativas_nome: parsed.nome_lead
            ? prev.tentativas_nome
            : (prev.estado === 'COLETA_NOME' ? prev.tentativas_nome + 1 : prev.tentativas_nome),
          campos: {
            produto: parsed.campos_bant?.produto || prev.campos.produto,
            ocasiao: parsed.campos_bant?.ocasiao || prev.campos.ocasiao,
            prazo: parsed.campos_bant?.prazo || prev.campos.prazo,
            orcamento: parsed.campos_bant?.orcamento || prev.campos.orcamento,
            decisor: parsed.campos_bant?.decisor || prev.campos.decisor,
          },
        }));

        const msgAgente: MensagemSim = { papel: 'agente', texto: parsed.resposta, hora: new Date(), json: parsed };
        setMensagens(prev => [...prev, msgAgente]);
        setApiMsgs([...novasApiMsgs, { role: 'assistant', content: JSON.stringify(parsed) }]);
      } else {
        // Resposta sem JSON estruturado
        const msgAgente: MensagemSim = { papel: 'agente', texto: raw, hora: new Date() };
        setMensagens(prev => [...prev, msgAgente]);
        setApiMsgs([...novasApiMsgs, { role: 'assistant', content: raw }]);
      }
    } catch (e: any) {
      const erro = e.response?.data?.erro || e.message || 'Erro desconhecido';
      setMensagens(prev => [...prev, { papel: 'agente', texto: `[Erro: ${erro}]`, hora: new Date() }]);
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const reiniciar = () => {
    setMensagens([]);
    setApiMsgs([]);
    setEstado({ ...ESTADO_INICIAL });
    setJsonBruto(null);
    setMostrarJson(false);
  };

  const bantCompleto = [
    estado.campos.produto,
    estado.campos.ocasiao,
    estado.campos.prazo,
    estado.campos.orcamento,
    estado.campos.decisor,
  ].filter(Boolean).length;

  const scoreColor = estado.score >= 80 ? 'text-green-600' : estado.score >= 55 ? 'text-yellow-600' : estado.score >= 25 ? 'text-blue-500' : 'text-gray-400';
  const scoreBarColor = estado.score >= 80 ? 'stroke-green-500' : estado.score >= 55 ? 'stroke-yellow-400' : estado.score >= 25 ? 'stroke-blue-400' : 'stroke-gray-300';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={onVoltar} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          {agente.foto_url ? (
            <img src={agente.foto_url} alt={agente.nome} className="w-10 h-10 rounded-full object-cover border-2 border-alisson-200" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-alisson-100 flex items-center justify-center">
              <Bot size={20} className="text-alisson-500" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-800">Simulador - {agente.nome}</h1>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${AREA_CORES[agente.area] || 'bg-gray-100'}`}>
                {AREAS.find(a => a.valor === agente.area)?.label || agente.area}
              </span>
              <span className="text-xs text-gray-400">Modo Simulacao</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chat estilo WhatsApp */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Barra do chat */}
          <div className="bg-alisson-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              {agente.foto_url ? (
                <img src={agente.foto_url} alt="" className="w-9 h-9 rounded-full object-cover border border-alisson-400" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-alisson-400 flex items-center justify-center">
                  <Bot size={18} />
                </div>
              )}
              <div>
                <p className="font-semibold text-sm">{agente.nome}</p>
                <p className="text-xs text-alisson-200">online</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-violet-400/20 text-violet-200 text-xs font-semibold">
                <Brain size={12} />
                Multi-Agente
              </span>
              <button
                onClick={() => setMostrarJson(!mostrarJson)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  mostrarJson ? 'bg-white/20 text-white' : 'text-alisson-200 hover:text-white'
                }`}
              >
                JSON {mostrarJson ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={reiniciar}
                className="p-1.5 hover:bg-alisson-500 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-alisson-200 hover:text-white"
              >
                <RotateCcw size={14} />
                Reiniciar
              </button>
            </div>
          </div>

          {/* Mensagens */}
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {mensagens.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                    {agente.foto_url ? (
                      <img src={agente.foto_url} alt="" className="w-16 h-16 rounded-full object-cover mb-3 opacity-40" />
                    ) : (
                      <Bot size={48} className="mb-3 opacity-25" />
                    )}
                    <p className="font-medium text-gray-500">Simulador do {agente.nome}</p>
                    <p className="text-sm mt-1">Digite como se fosse um lead no WhatsApp</p>
                  </div>
                )}

                {mensagens.map((m, i) => (
                  <div key={i}>
                    <div className={`flex ${m.papel === 'lead' ? 'justify-end' : 'justify-start'}`}>
                      {m.papel === 'agente' && (
                        agente.foto_url ? (
                          <img src={agente.foto_url} alt="" className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0 mt-1" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-alisson-500 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                            <Bot size={14} className="text-white" />
                          </div>
                        )
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        m.papel === 'lead'
                          ? 'bg-alisson-500 text-white rounded-tr-sm'
                          : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                      }`}>
                        {/* Midia */}
                        {m.midia && <MidiaChat midia={m.midia} isLead={m.papel === 'lead'} />}
                        {/* Texto (nao mostrar se for midia sem texto) */}
                        {m.texto && <p className="whitespace-pre-wrap leading-relaxed">{m.texto}</p>}
                        <p className={`text-xs mt-1 ${m.papel === 'lead' ? 'text-alisson-200' : 'text-gray-400'}`}>
                          {m.hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    {/* JSON inline */}
                    {mostrarJson && m.json && (
                      <div className="mt-1 mx-9 p-2.5 bg-gray-100 rounded-lg border border-gray-200 text-xs font-mono text-gray-500 max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {JSON.stringify(m.json, null, 2)}
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
              </div>

              {/* Input com anexos */}
              <div className="p-3 border-t border-gray-200 flex-shrink-0">
                {/* Indicador de upload */}
                {uploadando && (
                  <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-alisson-50 rounded-lg">
                    <Loader2 size={14} className="animate-spin text-alisson-500" />
                    <span className="text-xs text-alisson-600">Enviando arquivo...</span>
                  </div>
                )}
                {/* Indicador de gravacao */}
                {gravandoAudio && (
                  <div className="flex items-center gap-3 mb-2 px-3 py-2.5 bg-red-50 rounded-xl">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-red-600 font-medium flex-1">Gravando audio...</span>
                    <button onClick={pararGravacao} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors">
                      <Send size={14} /> Enviar
                    </button>
                    <button onClick={() => { if (mediaRecorder) mediaRecorder.stream.getTracks().forEach(t => t.stop()); setGravandoAudio(false); setMediaRecorder(null); }}
                      className="p-1.5 hover:bg-red-100 rounded-lg transition-colors">
                      <X size={16} className="text-red-400" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  {/* Botao de anexo */}
                  <div className="relative" ref={menuAnexoRef}>
                    <button
                      onClick={() => setMenuAnexo(!menuAnexo)}
                      disabled={carregando || uploadando || gravandoAudio}
                      className="p-2.5 text-gray-400 hover:text-alisson-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-40"
                      title="Anexar arquivo"
                    >
                      <Paperclip size={20} />
                    </button>
                    {/* Menu dropdown de tipos */}
                    {menuAnexo && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-48 z-10">
                        <button onClick={() => selecionarArquivo('image/*')}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Camera size={16} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Foto</p>
                            <p className="text-[10px] text-gray-400">JPG, PNG, WebP, GIF</p>
                          </div>
                        </button>
                        <button onClick={() => selecionarArquivo('video/*')}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Video size={16} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Video</p>
                            <p className="text-[10px] text-gray-400">MP4, WebM</p>
                          </div>
                        </button>
                        <button onClick={() => selecionarArquivo('audio/*')}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                            <Mic size={16} className="text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Audio</p>
                            <p className="text-[10px] text-gray-400">MP3, OGG, M4A</p>
                          </div>
                        </button>
                        <button onClick={() => selecionarArquivo('.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv')}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                            <FileText size={16} className="text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Documento</p>
                            <p className="text-[10px] text-gray-400">PDF, DOC, XLS, TXT</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Input de texto */}
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
                    placeholder="Digite como se fosse o lead..."
                    disabled={carregando || gravandoAudio}
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-alisson-400 focus:border-alisson-400 disabled:opacity-50"
                  />
                  {/* Botao de audio / enviar */}
                  {input.trim() ? (
                    <button
                      onClick={enviar}
                      disabled={carregando}
                      className="bg-alisson-500 hover:bg-alisson-600 text-white rounded-xl px-4 py-2.5 disabled:opacity-40 transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={gravandoAudio ? pararGravacao : iniciarGravacao}
                      disabled={carregando || uploadando}
                      className={`rounded-xl px-4 py-2.5 transition-colors disabled:opacity-40 ${
                        gravandoAudio
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}
                      title={gravandoAudio ? 'Parar e enviar' : 'Gravar audio'}
                    >
                      <Mic size={18} />
                    </button>
                  )}
                  {/* Input de arquivo oculto */}
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
                </div>
              </div>
        </div>

        {/* Painel lateral - Score e BANT */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {/* Score circular */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pontuacao</p>
            <div className="relative w-24 h-24 mx-auto">
              <svg width="96" height="96" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" className={scoreBarColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(estado.score / 100) * 264} 264`}
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-extrabold ${scoreColor}`}>{estado.score}</span>
                <span className="text-[10px] text-gray-400">/100</span>
              </div>
            </div>
            <div className="mt-3">
              <BadgeClassificacao cls={estado.classificacao !== 'nao classificado' ? estado.classificacao : ''} />
            </div>
          </div>

          {/* Estado e dados */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Estado</span>
              <BadgeEstado estado={estado.estado} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Nome</span>
              <span className={`text-xs font-semibold ${estado.nome !== 'nao coletado' ? 'text-alisson-600' : 'text-gray-300'}`}>
                {estado.nome}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Perfil</span>
              <span className={`text-xs ${estado.perfil ? 'text-gray-700' : 'text-gray-300'}`}>
                {estado.perfil || '---'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Tipo</span>
              <span className={`text-xs font-medium ${estado.tipo_cliente === 'cliente_por_grama' ? 'text-orange-600' : 'text-gray-400'}`}>
                {estado.tipo_cliente === 'cliente_por_grama' ? 'POR GRAMA' : 'normal'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Acao</span>
              <span className={`text-xs ${estado.proxima_acao === 'transferir' ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                {estado.proxima_acao || '---'}
              </span>
            </div>
          </div>

          {/* Score BANT breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Score BANT</p>
            <BarraScore score={estado.pontuacao_detalhe?.orcamento ?? 0} max={30} label="B. Orcamento" />
            <BarraScore score={estado.pontuacao_detalhe?.decisor ?? 0} max={15} label="A. Decisor" />
            <BarraScore score={estado.pontuacao_detalhe?.necessidade ?? 0} max={30} label="N. Necessidade" />
            <BarraScore score={estado.pontuacao_detalhe?.prazo ?? 0} max={20} label="T. Prazo" />
            <BarraScore score={estado.pontuacao_detalhe?.bonus ?? 0} max={5} label="Bonus" />
            {estado.pontuacao_detalhe?.justificativa && (
              <p className="text-[11px] text-gray-400 mt-2 italic leading-relaxed">
                {estado.pontuacao_detalhe.justificativa}
              </p>
            )}
          </div>

          {/* Campos BANT */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <button
              onClick={() => setMostrarBant(!mostrarBant)}
              className="flex items-center justify-between w-full mb-2"
            >
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Campos BANT</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${bantCompleto >= 5 ? 'text-green-600' : 'text-gray-400'}`}>{bantCompleto}/5</span>
                {mostrarBant ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
              </div>
            </button>
            {mostrarBant && (
              <>
                <CampoBant label="Produto" valor={estado.campos.produto} />
                <CampoBant label="Ocasiao" valor={estado.campos.ocasiao} />
                <CampoBant label="Prazo" valor={estado.campos.prazo} />
                <CampoBant label="Orcamento" valor={estado.campos.orcamento} />
                <CampoBant label="Decisor" valor={estado.campos.decisor} />
              </>
            )}
          </div>

          {/* Alertas */}
          {estado.alertas && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Alertas</p>
              <p className="text-xs text-orange-700 leading-relaxed">{estado.alertas}</p>
            </div>
          )}

          {/* Data estrategica */}
          {estado.data_estrategica && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Data Estrategica</p>
              <p className="text-sm text-green-700 font-semibold">{estado.data_estrategica}</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
