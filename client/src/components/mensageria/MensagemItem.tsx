import { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, Eye, AlertCircle, ListTodo, ChevronDown } from 'lucide-react';
import type { Mensagem } from '../../hooks/useMensageria';

interface MensagemItemProps {
  mensagem: Mensagem;
  onCriarTarefa?: (mensagem: Mensagem) => void;
  termoBusca?: string;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pendente':
      return <Check size={14} className="text-gray-400" />;
    case 'enviado':
      return <Check size={14} className="text-gray-400" />;
    case 'entregue':
      return <CheckCheck size={14} className="text-gray-400" />;
    case 'lido':
      return <CheckCheck size={14} className="text-wa-tick" />;
    case 'falhou':
      return <AlertCircle size={14} className="text-red-500" />;
    default:
      return null;
  }
}

function TextoComDestaque({ texto, termo }: { texto: string; termo?: string }) {
  if (!termo?.trim() || !texto) return <>{texto}</>;
  const regex = new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const partes = texto.split(regex);
  return (
    <>
      {partes.map((parte, i) =>
        parte.toLowerCase() === termo.toLowerCase()
          ? <mark key={i} className="bg-yellow-300 rounded-sm px-0.5">{parte}</mark>
          : parte
      )}
    </>
  );
}

export function MensagemItem({ mensagem, onCriarTarefa, termoBusca }: MensagemItemProps) {
  const [hover, setHover] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAssistant = mensagem.papel === 'assistant';
  const hora = new Date(mensagem.criado_em).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });

  // Fechar menu ao clicar fora
  useEffect(() => {
    if (!menuAberto) return;
    const handleClickFora = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [menuAberto]);

  const handleCopiar = () => {
    navigator.clipboard.writeText(mensagem.conteudo ?? '');
    setMenuAberto(false);
  };

  const handleResponder = () => {
    navigator.clipboard.writeText('> ' + (mensagem.conteudo ?? ''));
    setMenuAberto(false);
  };

  const handleCriarTarefa = () => {
    setMenuAberto(false);
    onCriarTarefa?.(mensagem);
  };

  return (
    <div
      className={`flex mb-1 ${isAssistant ? 'justify-end' : 'justify-start'} group`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); }}
    >
      {/* Botao criar tarefa - lado esquerdo para mensagens do assistente */}
      {isAssistant && hover && onCriarTarefa && (
        <button
          onClick={() => onCriarTarefa(mensagem)}
          className="self-center mr-1 p-1.5 rounded-full bg-white shadow border border-gray-200 hover:bg-alisson-50 hover:border-alisson-300 transition-all opacity-0 group-hover:opacity-100"
          title="Criar tarefa desta mensagem"
        >
          <ListTodo size={14} className="text-alisson-600" />
        </button>
      )}
      <div
        className={`relative max-w-[65%] px-3 py-2 rounded-lg shadow-sm ${
          isAssistant
            ? 'bg-wa-bubble-out rounded-tr-none'
            : 'bg-wa-bubble-in rounded-tl-none'
        }`}
      >
        {/* Triângulo da bolha */}
        <div
          className={`absolute top-0 w-3 h-3 ${
            isAssistant
              ? '-right-1.5 border-l-[6px] border-l-wa-bubble-out border-t-[6px] border-t-wa-bubble-out border-r-[6px] border-r-transparent border-b-[6px] border-b-transparent'
              : '-left-1.5 border-r-[6px] border-r-wa-bubble-in border-t-[6px] border-t-wa-bubble-in border-l-[6px] border-l-transparent border-b-[6px] border-b-transparent'
          }`}
          style={{ display: 'none' }}
        />

        {/* Menu de contexto (chevron) */}
        {hover && (
          <div
            ref={menuRef}
            className={`absolute top-1 z-10 ${isAssistant ? 'right-1' : 'right-1'}`}
          >
            <button
              type="button"
              onClick={() => setMenuAberto(prev => !prev)}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-black/10 transition-colors"
              title="Opcoes da mensagem"
            >
              <ChevronDown size={14} />
            </button>
            {menuAberto && (
              <div className={`absolute top-6 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[130px] ${isAssistant ? 'right-0' : 'right-0'}`}>
                <button
                  type="button"
                  onClick={handleCopiar}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={handleResponder}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Responder
                </button>
                {onCriarTarefa && (
                  <button
                    type="button"
                    onClick={handleCriarTarefa}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Criar tarefa
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Nome do remetente */}
        {!isAssistant && (
          <p className="text-xs font-medium text-alisson-600 mb-0.5">Cliente</p>
        )}
        {isAssistant && (
          <p className="text-xs font-medium text-alisson-400 mb-0.5">Agente IA - Alisson</p>
        )}

        {/* Midia */}
        {mensagem.tipo_midia === 'imagem' && mensagem.midia_url && (
          <img src={mensagem.midia_url} alt="Midia" className="max-w-full rounded-lg mb-1 cursor-pointer" onClick={() => window.open(mensagem.midia_url, '_blank')} />
        )}
        {mensagem.tipo_midia === 'audio' && mensagem.midia_url && (
          <div>
            <audio controls src={mensagem.midia_url} className="mb-1 max-w-full" />
            {mensagem.transcricao && (
              <p className="text-xs text-gray-500 italic mt-1 px-1">
                {mensagem.transcricao}
              </p>
            )}
          </div>
        )}
        {mensagem.tipo_midia === 'video' && mensagem.midia_url && (
          <video controls src={mensagem.midia_url} className="max-w-full rounded-lg mb-1" style={{ maxHeight: 300 }} />
        )}

        {/* Texto (esconde se e placeholder de midia) */}
        {!(mensagem.tipo_midia !== 'texto' && mensagem.conteudo?.startsWith('[')) && (
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            <TextoComDestaque texto={mensagem.conteudo} termo={termoBusca} />
          </div>
        )}

        {/* Hora + Status */}
        <div className={`flex items-center gap-1 mt-1 ${isAssistant ? 'justify-end' : 'justify-end'}`}>
          <span className="text-[11px] text-wa-time">{hora}</span>
          {isAssistant && mensagem.status_envio && (
            <StatusIcon status={mensagem.status_envio} />
          )}
        </div>
      </div>
      {/* Botao criar tarefa - lado direito para mensagens do cliente */}
      {!isAssistant && hover && onCriarTarefa && (
        <button
          onClick={() => onCriarTarefa(mensagem)}
          className="self-center ml-1 p-1.5 rounded-full bg-white shadow border border-gray-200 hover:bg-alisson-50 hover:border-alisson-300 transition-all opacity-0 group-hover:opacity-100"
          title="Criar tarefa desta mensagem"
        >
          <ListTodo size={14} className="text-alisson-600" />
        </button>
      )}
    </div>
  );
}
