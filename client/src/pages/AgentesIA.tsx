import { useState, useRef, useEffect } from 'react';
import {
  Bot, Plus, Send, RotateCcw, Trash2, Save, Image, Settings,
  ChevronDown, ChevronUp, ArrowLeft, Loader2, Pencil, Copy, Wand2, X, Check,
  Search, AlertTriangle, CheckCircle, XCircle, ArrowRight,
  Paperclip, Camera, Video, Mic, FileText, Play, Pause, Download,
} from 'lucide-react';
import api from '../services/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Agente {
  id: number;
  nome: string;
  area: string;
  prompt_sistema: string;
  foto_url: string | null;
  ativo: number;
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

  if (tela === 'criar' || tela === 'editar') {
    return <FormAgente agente={agenteSelecionado} onVoltar={voltar} onSalvo={voltar} />;
  }

  if (tela === 'simular' && agenteSelecionado) {
    return <Simulador agente={agenteSelecionado} onVoltar={voltar} />;
  }

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot className="text-alisson-500" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-800">Agentes de AI</h1>
            <p className="text-xs text-gray-500">Crie e gerencie seus agentes inteligentes</p>
          </div>
        </div>
        <button
          onClick={abrirCriar}
          className="flex items-center gap-2 px-4 py-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          Novo Agente
        </button>
      </div>

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
                {ag.foto_url ? (
                  <img src={ag.foto_url} alt={ag.nome} className="w-12 h-12 rounded-full object-cover border-2 border-alisson-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-alisson-100 flex items-center justify-center flex-shrink-0">
                    <Bot size={22} className="text-alisson-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{ag.nome}</h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${AREA_CORES[ag.area] || 'bg-gray-100 text-gray-600'}`}>
                    {AREAS.find(a => a.valor === ag.area)?.label || ag.area}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-4 line-clamp-2">
                {ag.prompt_sistema ? ag.prompt_sistema.substring(0, 120) + '...' : 'Sem prompt configurado'}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => abrirSimular(ag)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-alisson-50 hover:bg-alisson-100 text-alisson-700 rounded-lg text-xs font-medium transition-colors"
                >
                  <Send size={14} />
                  Simular
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
    </div>
  );
}

// ─── Formulario de criar/editar agente ───────────────────────────────────────

function FormAgente({ agente, onVoltar, onSalvo }: { agente: Agente | null; onVoltar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState(agente?.nome || '');
  const [area, setArea] = useState(agente?.area || 'sdr');
  const [promptSistema, setPromptSistema] = useState(agente?.prompt_sistema || '');
  const [fotoPreview, setFotoPreview] = useState<string | null>(agente?.foto_url || null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mostrarPrompt, setMostrarPrompt] = useState(true);
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
        await api.put(`/agentes-ia/${agente.id}`, { nome, area, prompt_sistema: promptSistema });
      } else {
        const { data } = await api.post('/agentes-ia', { nome, area, prompt_sistema: promptSistema });
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
          <p className="text-xs text-gray-500">Configure o nome, area de atuacao e prompt do agente</p>
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
              placeholder="Ex: Luma, Dara, Sofia..."
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
        </div>

        {/* Coluna direita: prompt */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <button
              onClick={() => setMostrarPrompt(!mostrarPrompt)}
              className="flex items-center gap-2"
            >
              <Settings size={16} className="text-alisson-500" />
              <span className="font-semibold text-alisson-600 text-sm">Prompt do Sistema</span>
              {mostrarPrompt ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            <span className="text-xs text-gray-400">{promptSistema.length} caracteres</span>
          </div>
          {mostrarPrompt && (
            <textarea
              value={promptSistema}
              onChange={e => setPromptSistema(e.target.value)}
              className="flex-1 p-4 text-sm font-mono resize-none focus:outline-none leading-relaxed"
              placeholder="Cole ou escreva o prompt do sistema aqui. Este prompt define a personalidade, regras e comportamento do agente..."
            />
          )}
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

// ─── Simulador ───────────────────────────────────────────────────────────────

function Simulador({ agente: agenteInicial, onVoltar }: { agente: Agente; onVoltar: () => void }) {
  const [agente, setAgente] = useState<Agente>(agenteInicial);
  const [mensagens, setMensagens] = useState<MensagemSim[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [estado, setEstado] = useState<EstadoLead>({ ...ESTADO_INICIAL });
  const [jsonBruto, setJsonBruto] = useState<any>(null);
  const [mostrarJson, setMostrarJson] = useState(false);
  const [mostrarPrompt, setMostrarPrompt] = useState(false);
  const [mostrarBant, setMostrarBant] = useState(true);
  const [apiMsgs, setApiMsgs] = useState<{ role: string; content: string }[]>([]);
  const [modalMelhoria, setModalMelhoria] = useState(false);
  const [feedbackMelhoria, setFeedbackMelhoria] = useState('');
  const [melhorando, setMelhorando] = useState(false);
  const [melhoriaAplicada, setMelhoriaAplicada] = useState<string | null>(null);
  const [etapaMelhoria, setEtapaMelhoria] = useState<'input' | 'analise' | 'aplicado'>('input');
  const [analiseMelhoria, setAnaliseMelhoria] = useState<any>(null);
  const [promptProposto, setPromptProposto] = useState<string>('');
  const [aplicando, setAplicando] = useState(false);
  const [modalAnalise, setModalAnalise] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [analisePrompt, setAnalisePrompt] = useState<any>(null);
  const [menuAnexo, setMenuAnexo] = useState(false);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [uploadando, setUploadando] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
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
        imagem: `[Lead enviou uma FOTO: ${file.name}]`,
        video: `[Lead enviou um VIDEO: ${file.name}]`,
        audio: data.transcricao
          ? `[Lead enviou um AUDIO. Transcricao: "${data.transcricao}"]`
          : `[Lead enviou um AUDIO de ${formatarTamanho(file.size)}]`,
        documento: `[Lead enviou um DOCUMENTO: ${file.name} (${formatarTamanho(file.size)})]`,
      };
      const textoMidia = descricoes[data.tipo] || `[Lead enviou um arquivo: ${file.name}]`;

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
    setMostrarPrompt(false);
  };

  const abrirMelhoria = () => {
    setFeedbackMelhoria('');
    setMelhoriaAplicada(null);
    setEtapaMelhoria('input');
    setAnaliseMelhoria(null);
    setPromptProposto('');
    setModalMelhoria(true);
    setTimeout(() => feedbackRef.current?.focus(), 100);
  };

  // Etapa 1: Envia feedback e recebe analise + prompt proposto (SEM salvar)
  const enviarMelhoria = async () => {
    if (!feedbackMelhoria.trim() || melhorando) return;
    setMelhorando(true);
    try {
      const { data } = await api.post(`/agentes-ia/${agente.id}/melhorar-prompt`, {
        feedback: feedbackMelhoria.trim(),
        historico_conversa: mensagens.map(m => ({ papel: m.papel, texto: m.texto })),
      });
      setAnaliseMelhoria(data.analise);
      setPromptProposto(data.prompt_melhorado);
      setEtapaMelhoria('analise');
    } catch (e: any) {
      alert('Erro ao analisar: ' + (e.response?.data?.erro || e.message));
    } finally {
      setMelhorando(false);
    }
  };

  // Etapa 2: Aprovar e salvar o prompt proposto
  const aprovarMelhoria = async () => {
    if (!promptProposto || aplicando) return;
    setAplicando(true);
    try {
      await api.post(`/agentes-ia/${agente.id}/aplicar-melhoria`, {
        prompt_melhorado: promptProposto,
      });
      setMelhoriaAplicada(promptProposto);
      setAgente(prev => ({ ...prev, prompt_sistema: promptProposto }));
      setEtapaMelhoria('aplicado');
    } catch (e: any) {
      alert('Erro ao aplicar: ' + (e.response?.data?.erro || e.message));
    } finally {
      setAplicando(false);
    }
  };

  // Rejeitar: volta pra etapa de input
  const rejeitarMelhoria = () => {
    setEtapaMelhoria('input');
    setAnaliseMelhoria(null);
    setPromptProposto('');
  };

  // Analisar prompt standalone (erros, incoerencias, duplicatas)
  const abrirAnalise = async () => {
    setAnalisePrompt(null);
    setModalAnalise(true);
    setAnalisando(true);
    try {
      const { data } = await api.post(`/agentes-ia/${agente.id}/analisar-prompt`);
      setAnalisePrompt(data.analise);
    } catch (e: any) {
      setAnalisePrompt({ nota_geral: 'Erro ao analisar: ' + (e.response?.data?.erro || e.message), erros: [], incoerencias: [], duplicatas: [], melhorias_sugeridas: [], score_qualidade: 0 });
    } finally {
      setAnalisando(false);
    }
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
              <button
                onClick={() => setMostrarPrompt(!mostrarPrompt)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  mostrarPrompt ? 'bg-white/20 text-white' : 'text-alisson-200 hover:text-white'
                }`}
              >
                PROMPT
              </button>
              <button
                onClick={() => setMostrarJson(!mostrarJson)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  mostrarJson ? 'bg-white/20 text-white' : 'text-alisson-200 hover:text-white'
                }`}
              >
                JSON {mostrarJson ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={abrirAnalise}
                className="px-2.5 py-1 rounded text-xs font-semibold transition-colors bg-blue-400/20 text-blue-200 hover:bg-blue-400/30"
                title="Analisar prompt (erros, incoerencias, duplicatas)"
              >
                <span className="flex items-center gap-1"><Search size={12} /> Analisar</span>
              </button>
              <button
                onClick={abrirMelhoria}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  mensagens.length > 0
                    ? 'bg-yellow-400/20 text-yellow-200 hover:bg-yellow-400/30'
                    : 'text-alisson-300/50 cursor-not-allowed'
                }`}
                disabled={mensagens.length === 0}
                title="Apontar melhorias no prompt"
              >
                <span className="flex items-center gap-1"><Wand2 size={12} /> Melhorar</span>
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

          {/* Visualizador de prompt */}
          {mostrarPrompt ? (
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-alisson-600 uppercase tracking-wider">Prompt do Sistema Ativo</p>
                <button
                  onClick={() => navigator.clipboard.writeText(agente.prompt_sistema)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-alisson-600 transition-colors"
                >
                  <Copy size={12} />
                  Copiar
                </button>
              </div>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-4 rounded-lg border border-gray-200 leading-relaxed">
                {agente.prompt_sistema || 'Nenhum prompt configurado'}
              </pre>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Painel lateral - Score e BANT */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {/* Score circular */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Lead Score</p>
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

      {/* Modal Melhorar Prompt (3 etapas) */}
      {modalMelhoria && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header com indicador de etapa */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  etapaMelhoria === 'input' ? 'bg-yellow-100' : etapaMelhoria === 'analise' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {etapaMelhoria === 'input' && <Wand2 size={18} className="text-yellow-600" />}
                  {etapaMelhoria === 'analise' && <Search size={18} className="text-blue-600" />}
                  {etapaMelhoria === 'aplicado' && <CheckCircle size={18} className="text-green-600" />}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">
                    {etapaMelhoria === 'input' && 'Melhorar Prompt'}
                    {etapaMelhoria === 'analise' && 'Revisar Mudancas'}
                    {etapaMelhoria === 'aplicado' && 'Melhoria Aplicada'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {etapaMelhoria === 'input' && 'Etapa 1/3 — Descreva o que precisa melhorar'}
                    {etapaMelhoria === 'analise' && 'Etapa 2/3 — Revise o plano e aprove ou rejeite'}
                    {etapaMelhoria === 'aplicado' && 'Etapa 3/3 — Prompt atualizado com sucesso'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Indicador visual das etapas */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${etapaMelhoria === 'input' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <div className={`w-6 h-0.5 ${etapaMelhoria !== 'input' ? 'bg-green-400' : 'bg-gray-200'}`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${etapaMelhoria === 'analise' ? 'bg-blue-500' : etapaMelhoria === 'aplicado' ? 'bg-green-500' : 'bg-gray-200'}`} />
                  <div className={`w-6 h-0.5 ${etapaMelhoria === 'aplicado' ? 'bg-green-400' : 'bg-gray-200'}`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${etapaMelhoria === 'aplicado' ? 'bg-green-500' : 'bg-gray-200'}`} />
                </div>
                <button onClick={() => setModalMelhoria(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Conteudo */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* ETAPA 1: Input de feedback */}
              {etapaMelhoria === 'input' && (
                <>
                  {mensagens.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Conversa de referencia</p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {mensagens.map((m, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className={`font-semibold flex-shrink-0 ${m.papel === 'lead' ? 'text-blue-600' : 'text-alisson-600'}`}>
                              {m.papel === 'lead' ? 'Lead:' : `${agente.nome}:`}
                            </span>
                            <span className="text-gray-600 truncate">{m.texto}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">O que precisa melhorar?</label>
                    <textarea
                      ref={feedbackRef}
                      value={feedbackMelhoria}
                      onChange={e => setFeedbackMelhoria(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) enviarMelhoria(); }}
                      placeholder={"Ex:\n- A saudacao esta muito formal, deixar mais natural\n- Nao perguntar o nome 2 vezes seguidas\n- Quando o cliente pedir preco, redirecionar para a consultora\n- Adicionar regra para nao usar emojis"}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 resize-none leading-relaxed"
                      rows={5}
                      disabled={melhorando}
                    />
                    <p className="text-xs text-gray-400 mt-1">Ctrl+Enter para enviar. A IA vai analisar e propor as mudancas antes de aplicar.</p>
                  </div>
                </>
              )}

              {/* ETAPA 2: Analise e aprovacao */}
              {etapaMelhoria === 'analise' && analiseMelhoria && (
                <>
                  {/* Resumo */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-blue-800 mb-1">Resumo da analise</p>
                    <p className="text-xs text-blue-700 leading-relaxed">{analiseMelhoria.resumo}</p>
                  </div>

                  {/* Mudancas propostas */}
                  {analiseMelhoria.mudancas?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mudancas propostas</p>
                      {analiseMelhoria.mudancas.map((m: any, i: number) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowRight size={14} className="text-alisson-500" />
                            <span className="text-xs font-bold text-alisson-700">{m.local}</span>
                          </div>
                          {m.de && (
                            <div className="flex items-start gap-2 mb-1.5">
                              <XCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-red-600 line-through leading-relaxed">{m.de}</p>
                            </div>
                          )}
                          <div className="flex items-start gap-2 mb-1.5">
                            <CheckCircle size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-green-700 leading-relaxed">{m.para}</p>
                          </div>
                          {m.motivo && (
                            <p className="text-[11px] text-gray-400 italic ml-5">{m.motivo}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Erros encontrados */}
                  {analiseMelhoria.erros_encontrados?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle size={13} /> Erros encontrados e corrigidos
                      </p>
                      <ul className="space-y-1">
                        {analiseMelhoria.erros_encontrados.map((e: string, i: number) => (
                          <li key={i} className="text-xs text-red-700 leading-relaxed flex items-start gap-1.5">
                            <span className="text-red-400 mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Incoerencias */}
                  {analiseMelhoria.incoerencias_encontradas?.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle size={13} /> Incoerencias detectadas e resolvidas
                      </p>
                      <ul className="space-y-1">
                        {analiseMelhoria.incoerencias_encontradas.map((e: string, i: number) => (
                          <li key={i} className="text-xs text-orange-700 leading-relaxed flex items-start gap-1.5">
                            <span className="text-orange-400 mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Duplicatas */}
                  {analiseMelhoria.duplicatas_encontradas?.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Copy size={13} /> Duplicatas removidas
                      </p>
                      <ul className="space-y-1">
                        {analiseMelhoria.duplicatas_encontradas.map((e: string, i: number) => (
                          <li key={i} className="text-xs text-yellow-700 leading-relaxed flex items-start gap-1.5">
                            <span className="text-yellow-500 mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Preview do prompt proposto */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Preview do prompt proposto</p>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-gray-200 leading-relaxed max-h-48 overflow-y-auto">
                      {promptProposto}
                    </pre>
                  </div>
                </>
              )}

              {/* ETAPA 3: Aplicado */}
              {etapaMelhoria === 'aplicado' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-bold text-green-700 mb-1">Prompt atualizado!</p>
                  <p className="text-sm text-green-600">
                    As mudancas foram aprovadas e salvas. Reinicie a conversa para testar com o novo prompt.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              {etapaMelhoria === 'input' && (
                <>
                  <button onClick={() => setModalMelhoria(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={enviarMelhoria}
                    disabled={melhorando || !feedbackMelhoria.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {melhorando ? (
                      <><Loader2 size={16} className="animate-spin" /> Analisando...</>
                    ) : (
                      <><Search size={16} /> Analisar Mudancas</>
                    )}
                  </button>
                </>
              )}
              {etapaMelhoria === 'analise' && (
                <>
                  <button onClick={rejeitarMelhoria} className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                    <XCircle size={16} /> Rejeitar
                  </button>
                  <button
                    onClick={aprovarMelhoria}
                    disabled={aplicando}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {aplicando ? (
                      <><Loader2 size={16} className="animate-spin" /> Aplicando...</>
                    ) : (
                      <><Check size={16} /> Aprovar e Aplicar</>
                    )}
                  </button>
                </>
              )}
              {etapaMelhoria === 'aplicado' && (
                <button
                  onClick={() => setModalMelhoria(false)}
                  className="ml-auto px-5 py-2.5 bg-alisson-600 hover:bg-alisson-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Analisar Prompt (standalone) */}
      {modalAnalise && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <Search size={18} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Analise do Prompt</h3>
                  <p className="text-xs text-gray-400">Verificacao de erros, incoerencias e duplicatas</p>
                </div>
              </div>
              <button onClick={() => setModalAnalise(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {analisando ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
                  <p className="text-sm text-gray-500">Analisando o prompt...</p>
                </div>
              ) : analisePrompt ? (
                <>
                  {/* Score de qualidade */}
                  <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <svg width="64" height="64" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                        <circle cx="50" cy="50" r="42" fill="none"
                          className={analisePrompt.score_qualidade >= 80 ? 'stroke-green-500' : analisePrompt.score_qualidade >= 50 ? 'stroke-yellow-400' : 'stroke-red-400'}
                          strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={`${(analisePrompt.score_qualidade / 100) * 264} 264`}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-lg font-extrabold ${analisePrompt.score_qualidade >= 80 ? 'text-green-600' : analisePrompt.score_qualidade >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {analisePrompt.score_qualidade}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Qualidade do Prompt</p>
                      <p className="text-xs text-gray-500 leading-relaxed mt-1">{analisePrompt.nota_geral}</p>
                    </div>
                  </div>

                  {/* Erros */}
                  {analisePrompt.erros?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <XCircle size={13} /> Erros ({analisePrompt.erros.length})
                      </p>
                      <ul className="space-y-1.5">
                        {analisePrompt.erros.map((e: string, i: number) => (
                          <li key={i} className="text-xs text-red-700 leading-relaxed flex items-start gap-1.5">
                            <span className="text-red-400 mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Incoerencias */}
                  {analisePrompt.incoerencias?.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle size={13} /> Incoerencias ({analisePrompt.incoerencias.length})
                      </p>
                      <ul className="space-y-1.5">
                        {analisePrompt.incoerencias.map((e: string, i: number) => (
                          <li key={i} className="text-xs text-orange-700 leading-relaxed flex items-start gap-1.5">
                            <span className="text-orange-400 mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Duplicatas */}
                  {analisePrompt.duplicatas?.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Copy size={13} /> Duplicatas ({analisePrompt.duplicatas.length})
                      </p>
                      <ul className="space-y-1.5">
                        {analisePrompt.duplicatas.map((e: string, i: number) => (
                          <li key={i} className="text-xs text-yellow-700 leading-relaxed flex items-start gap-1.5">
                            <span className="text-yellow-500 mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Melhorias sugeridas */}
                  {analisePrompt.melhorias_sugeridas?.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Wand2 size={13} /> Sugestoes de melhoria ({analisePrompt.melhorias_sugeridas.length})
                      </p>
                      <ul className="space-y-1.5">
                        {analisePrompt.melhorias_sugeridas.map((e: string, i: number) => (
                          <li key={i} className="text-xs text-blue-700 leading-relaxed flex items-start gap-1.5">
                            <span className="text-blue-400 mt-0.5">•</span> {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tudo OK */}
                  {!analisePrompt.erros?.length && !analisePrompt.incoerencias?.length && !analisePrompt.duplicatas?.length && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                      <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-green-700">Nenhum problema encontrado!</p>
                      <p className="text-xs text-green-600 mt-1">O prompt esta consistente e sem erros.</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setModalAnalise(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
