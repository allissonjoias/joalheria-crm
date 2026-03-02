import { Check, CheckCheck, Eye, AlertCircle } from 'lucide-react';
import type { Mensagem } from '../../hooks/useMensageria';

interface MensagemItemProps {
  mensagem: Mensagem;
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

export function MensagemItem({ mensagem }: MensagemItemProps) {
  const isAssistant = mensagem.papel === 'assistant';
  const hora = new Date(mensagem.criado_em).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`flex mb-1 ${isAssistant ? 'justify-end' : 'justify-start'}`}>
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

        {/* Nome do remetente */}
        {!isAssistant && (
          <p className="text-xs font-medium text-alisson-600 mb-0.5">Cliente</p>
        )}
        {isAssistant && (
          <p className="text-xs font-medium text-alisson-400 mb-0.5">Dara - Alisson</p>
        )}

        {/* Mídia */}
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

        {/* Texto (esconde se é placeholder de mídia) */}
        {!(mensagem.tipo_midia !== 'texto' && mensagem.conteudo?.startsWith('[')) && (
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {mensagem.conteudo}
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
    </div>
  );
}
