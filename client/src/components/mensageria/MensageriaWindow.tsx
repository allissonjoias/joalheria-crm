import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Loader2, MessageSquare, MoreVertical, Target, X, ListTodo, CheckCircle, ChevronDown, Search, ChevronUp, Upload } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { MensagemItem } from './MensagemItem';
import { MensageriaInput } from './MensageriaInput';
import { CanalBadge } from './CanalBadge';
import { ModoAutoToggle } from './ModoAutoToggle';
import type { Mensagem, Conversa } from '../../hooks/useMensageria';
import api from '../../services/api';

function BANTBadge({ conversa }: { conversa: Conversa }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const score = conversa.bant_score || 0;
  const qualificado = conversa.bant_qualificado === 1;

  const bgColor = qualificado
    ? 'bg-green-500'
    : score >= 2
    ? 'bg-yellow-500'
    : 'bg-gray-400';

  const items = [
    { label: 'N', value: conversa.bant_need, name: 'Necessidade' },
    { label: 'O', value: conversa.bant_budget, name: 'Orcamento' },
    { label: 'D', value: conversa.bant_authority, name: 'Decisor' },
    { label: 'P', value: conversa.bant_timeline, name: 'Prazo' },
  ];

  return (
    <div className="relative">
      <button
        className={`${bgColor} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 transition-colors`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <Target size={12} />
        NODP {score}/4
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1 bg-gray-900 text-white text-xs rounded-lg p-3 min-w-56 z-50 shadow-lg">
          <p className="font-bold mb-2">
            {qualificado ? 'Cliente Qualificado' : 'Em Qualificacao'} ({score}/4)
          </p>
          {items.map(item => (
            <div key={item.label} className="flex gap-2 mb-1">
              <span className={`font-bold ${item.value ? 'text-green-400' : 'text-gray-500'}`}>
                {item.label}:
              </span>
              <span className={item.value ? 'text-gray-200' : 'text-gray-500'}>
                {item.value || 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MensageriaWindowProps {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  enviando: boolean;
  onEnviar: (mensagem: string) => void;
  onEnviarComDara: () => void;
  onEnviarMidia: (arquivo: File, caption?: string) => void;
  onToggleModoAuto: () => void;
  onExcluir?: (id: string) => void;
}

// Modal para criar tarefa a partir de mensagem
function CriarTarefaModal({
  mensagem,
  conversa,
  onClose,
}: {
  mensagem: Mensagem;
  conversa: Conversa;
  onClose: () => void;
}) {
  const textoOriginal = mensagem.conteudo.length > 80
    ? mensagem.conteudo.substring(0, 80) + '...'
    : mensagem.conteudo;
  const [titulo, setTitulo] = useState(textoOriginal);
  const [prioridade, setPrioridade] = useState('media');
  const [dataVencimento, setDataVencimento] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post('/tarefas/from-mensagem', {
        mensagem_id: mensagem.id,
        conversa_id: conversa.id,
        titulo,
        descricao: mensagem.conteudo,
        prioridade,
        data_vencimento: dataVencimento || undefined,
      });
      setSucesso(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      console.error('Erro ao criar tarefa:', e);
    } finally {
      setSalvando(false);
    }
  };

  if (sucesso) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3 animate-in fade-in">
          <CheckCircle size={48} className="text-green-500" />
          <p className="text-lg font-medium text-gray-700">Tarefa criada!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <ListTodo size={20} className="text-alisson-600" />
            <h3 className="text-lg font-semibold text-gray-800">Criar tarefa</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Mensagem original */}
        <div className="mx-5 mt-4 p-3 bg-gray-50 rounded-lg border-l-4 border-alisson-400">
          <p className="text-xs text-gray-500 mb-1">Mensagem original:</p>
          <p className="text-sm text-gray-700 line-clamp-3">{mensagem.conteudo}</p>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-600">Titulo da tarefa</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-alisson-400"
              placeholder="Ex: Ligar para cliente sobre alianca"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-600">Prioridade</label>
              <select
                value={prioridade}
                onChange={e => setPrioridade(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-alisson-400"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-600">Vencimento</label>
              <input
                type="date"
                value={dataVencimento}
                onChange={e => setDataVencimento(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-alisson-400"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !titulo.trim()}
            className="px-4 py-2 text-sm bg-alisson-600 text-white rounded-lg hover:bg-alisson-700 disabled:opacity-50 transition-colors"
          >
            {salvando ? 'Criando...' : 'Criar tarefa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatarDataSeparador(dataStr: string): string {
  const data = new Date(dataStr);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (mesmoDia(data, hoje)) return 'Hoje';
  if (mesmoDia(data, ontem)) return 'Ontem';

  return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function chaveDia(dataStr: string): string {
  const data = new Date(dataStr);
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
}

export function MensageriaWindow({
  conversa,
  mensagens,
  enviando,
  onEnviar,
  onEnviarComDara,
  onEnviarMidia,
  onToggleModoAuto,
  onExcluir,
}: MensageriaWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [msgParaTarefa, setMsgParaTarefa] = useState<Mensagem | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fotoExpandida, setFotoExpandida] = useState(false);

  // Busca dentro da conversa
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [matchAtual, setMatchAtual] = useState(0);
  const buscaInputRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const indicesMatches = useMemo(() => {
    if (!termoBusca.trim()) return [];
    const termo = termoBusca.toLowerCase();
    return mensagens
      .map((msg, idx) => (msg.conteudo?.toLowerCase().includes(termo) ? idx : -1))
      .filter(i => i !== -1);
  }, [mensagens, termoBusca]);

  const scrollParaMatch = useCallback((indexNoArray: number) => {
    const msg = mensagens[indexNoArray];
    if (!msg) return;
    const el = msgRefs.current[msg.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [mensagens]);

  useEffect(() => {
    if (indicesMatches.length > 0) {
      setMatchAtual(0);
      scrollParaMatch(indicesMatches[0]);
    }
  }, [indicesMatches.length, termoBusca]);

  const navegarMatch = (direcao: 'anterior' | 'proximo') => {
    if (indicesMatches.length === 0) return;
    const novoIdx = direcao === 'proximo'
      ? (matchAtual + 1) % indicesMatches.length
      : (matchAtual - 1 + indicesMatches.length) % indicesMatches.length;
    setMatchAtual(novoIdx);
    scrollParaMatch(indicesMatches[novoIdx]);
  };

  const abrirBusca = () => {
    setBuscaAberta(true);
    setTimeout(() => buscaInputRef.current?.focus(), 50);
  };

  const fecharBusca = () => {
    setBuscaAberta(false);
    setTermoBusca('');
    setMatchAtual(0);
  };

  const handleBuscaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') fecharBusca();
    if (e.key === 'Enter') navegarMatch(e.shiftKey ? 'anterior' : 'proximo');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanciaDoFundo = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanciaDoFundo > 120);
  };

  const scrollParaBaixo = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onEnviarMidia(files[0]);
    }
  };

  if (!conversa) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-creme-200">
        <img src="/leao.svg" alt="IAlisson" className="w-48 h-48 opacity-15 mb-6" />
        <h3 className="text-2xl font-light text-gray-500 mb-2">IAlisson</h3>
        <p className="text-sm text-gray-400 text-center max-w-md">
          Envie e receba mensagens de WhatsApp e Instagram.<br/>
          Selecione uma conversa para comecar.
        </p>
      </div>
    );
  }

  const nome = conversa.cliente_nome || conversa.meta_contato_nome || 'Contato';

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay de drag-and-drop */}
      {dragOver && (
        <div className="absolute inset-0 bg-alisson-600/20 border-2 border-dashed border-alisson-600 z-50 flex items-center justify-center rounded-lg backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg px-8 py-6 flex flex-col items-center gap-2">
            <Upload size={40} className="text-alisson-600" />
            <p className="text-lg font-medium text-alisson-600">Solte o arquivo aqui</p>
            <p className="text-sm text-gray-500">Imagem, video ou documento</p>
          </div>
        </div>
      )}
      {/* Header estilo WhatsApp */}
      <div className="bg-alisson-600 px-4 py-2.5 flex items-center gap-3">
        {/* Avatar - clicavel para expandir foto */}
        <button
          className="flex-shrink-0 rounded-full overflow-hidden focus:outline-none hover:ring-2 hover:ring-white/30 transition-all"
          onClick={() => conversa.foto_perfil && setFotoExpandida(true)}
          title={conversa.foto_perfil ? 'Ver foto do perfil' : undefined}
        >
          {conversa.foto_perfil ? (
            <img
              src={conversa.foto_perfil}
              alt={nome}
              className="w-10 h-10 rounded-full object-cover cursor-pointer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
            />
          ) : null}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-alisson-400 ${conversa.foto_perfil ? 'hidden' : ''}`}>
            <span className="text-white font-bold text-lg">{nome.charAt(0).toUpperCase()}</span>
          </div>
        </button>

        {/* Info do contato */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-white truncate">{nome}</p>
          <div className="flex items-center gap-2">
            {conversa.cliente_telefone && (
              <span className="text-xs text-alisson-200">{conversa.cliente_telefone}</span>
            )}
            <CanalBadge canal={conversa.canal} tamanho="sm" />
          </div>
        </div>

        {/* BANT Badge + Ações */}
        <div className="flex items-center gap-2">
          {conversa.bant_score !== undefined && conversa.bant_score > 0 && (
            <BANTBadge conversa={conversa} />
          )}
          <button
            className="p-2 rounded-full transition-colors hover:bg-alisson-500"
            onClick={abrirBusca}
            title="Buscar na conversa"
          >
            <Search size={18} className="text-creme-200" />
          </button>
          <ModoAutoToggle ativo={!!conversa.modo_auto} onToggle={onToggleModoAuto} />
          <div className="relative">
            <button
              className="p-2 rounded-full transition-colors hover:bg-alisson-500"
              onClick={() => setMenuAberto(!menuAberto)}
            >
              <MoreVertical size={20} className="text-creme-200" />
            </button>
            {menuAberto && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-50 min-w-48">
                {onExcluir && (
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    onClick={() => {
                      if (confirm('Excluir conversa e resetar atendimento SDR?')) {
                        onExcluir(conversa.id);
                      }
                      setMenuAberto(false);
                    }}
                  >
                    Excluir conversa e resetar SDR
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra de busca dentro da conversa */}
      {buscaAberta && (
        <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 shadow-sm">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={buscaInputRef}
            type="text"
            value={termoBusca}
            onChange={e => { setTermoBusca(e.target.value); setMatchAtual(0); }}
            onKeyDown={handleBuscaKeyDown}
            placeholder="Buscar na conversa..."
            className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400"
          />
          {termoBusca.trim() && (
            <span className="text-xs text-gray-500 flex-shrink-0 min-w-[50px] text-center">
              {indicesMatches.length > 0 ? `${matchAtual + 1} de ${indicesMatches.length}` : '0 resultados'}
            </span>
          )}
          <button
            onClick={() => navegarMatch('anterior')}
            disabled={indicesMatches.length === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
            title="Resultado anterior (Shift+Enter)"
          >
            <ChevronUp size={16} className="text-gray-600" />
          </button>
          <button
            onClick={() => navegarMatch('proximo')}
            disabled={indicesMatches.length === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
            title="Proximo resultado (Enter)"
          >
            <ChevronDown size={16} className="text-gray-600" />
          </button>
          <button
            onClick={fecharBusca}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="Fechar busca (Esc)"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      )}

      {/* Area de mensagens com fundo wallpaper WhatsApp */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-16 py-4 wa-chat-bg"
        >
          {mensagens.length === 0 && (
            <div className="flex justify-center my-4">
              <div className="bg-white/80 px-4 py-2 rounded-lg shadow-sm text-xs text-wa-time text-center">
                Mensagens aparecerao aqui
              </div>
            </div>
          )}
          {mensagens.map((msg, index) => {
            const diaAtual = chaveDia(msg.criado_em);
            const diaAnterior = index > 0 ? chaveDia(mensagens[index - 1].criado_em) : null;
            const mostrarSeparador = diaAtual !== diaAnterior;
            const matchIdx = indicesMatches.indexOf(index);
            const eMatch = matchIdx !== -1;
            const eMatchAtual = eMatch && matchIdx === matchAtual;

            return (
              <div
                key={msg.id}
                ref={el => { msgRefs.current[msg.id] = el; }}
                className={eMatchAtual ? 'ring-2 ring-yellow-400 ring-offset-1 rounded-lg transition-all' : eMatch ? 'ring-1 ring-yellow-200 rounded-lg transition-all' : undefined}
              >
                {mostrarSeparador && (
                  <div className="flex justify-center my-3">
                    <span className="bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm select-none">
                      {formatarDataSeparador(msg.criado_em)}
                    </span>
                  </div>
                )}
                <MensagemItem mensagem={msg} onCriarTarefa={setMsgParaTarefa} termoBusca={termoBusca} />
              </div>
            );
          })}
          {enviando && (
            <div className="flex justify-end mb-1">
              <div className="bg-wa-bubble-out px-4 py-3 rounded-lg rounded-tr-none shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="text-alisson-600 animate-spin" />
                  <p className="text-sm text-wa-time">IA esta digitando...</p>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Botao scroll para baixo estilo WhatsApp */}
        {showScrollBtn && (
          <button
            onClick={scrollParaBaixo}
            className="absolute bottom-4 right-4 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all z-10"
            aria-label="Ir para o final"
          >
            <ChevronDown size={20} />
          </button>
        )}
      </div>

      {/* Input */}
      <MensageriaInput
        onEnviar={onEnviar}
        onEnviarComDara={onEnviarComDara}
        onEnviarMidia={onEnviarMidia}
        desabilitado={enviando}
        canalAtual={conversa.canal}
      />

      {/* Modal criar tarefa */}
      {msgParaTarefa && (
        <CriarTarefaModal
          mensagem={msgParaTarefa}
          conversa={conversa}
          onClose={() => setMsgParaTarefa(null)}
        />
      )}

      {/* Modal foto de perfil expandida */}
      {fotoExpandida && conversa.foto_perfil && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setFotoExpandida(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={() => setFotoExpandida(false)}
          >
            <X size={28} />
          </button>
          <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <img
              src={conversa.foto_perfil}
              alt={nome}
              className="max-w-[80vw] max-h-[80vh] rounded-lg object-contain shadow-2xl"
            />
            <p className="text-white text-lg font-medium">{nome}</p>
            {conversa.cliente_telefone && (
              <p className="text-white/60 text-sm">{conversa.cliente_telefone}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
